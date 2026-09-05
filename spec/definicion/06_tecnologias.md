# 06 — Tecnologías del stack

> **Alcance de este documento:** el inventario concreto — qué se instala, para qué sirve cada pieza y qué se descartó.
> **Depende de:** [05 — Stack y arquitectura](./05_stack-y-arquitectura.md)
> ⚠️ Las versiones son la referencia al momento de escribir (5 de septiembre de 2026, consultadas en npm y en el binario local). **Confirmar la estable vigente al instalar**; lo que no debe cambiar es la elección, no el número.

---

## 1. Base

| Tecnología     | Versión | Para qué                                                                                   |
| -------------- | ------- | ------------------------------------------------------------------------------------------ |
| **Node.js**    | 22 LTS  | Runtime de la Live App (build) y del agente. Fijado en `.nvmrc` y en `engines`             |
| **TypeScript** | 5.9.3   | `strict: true`. Sin `any` en `packages/core`. 7.x existe en npm pero Next 16 declara 5.x; se queda en 5.9 |
| **pnpm**       | 12.3    | Workspaces del monorepo. Lockfile estricto, sin dependencias fantasma. Desde la 12 bloquea build scripts (`allowBuilds`) y paquetes publicados hace muy poco (`minimumReleaseAgeExclude`); ambos configurados en `pnpm-workspace.yaml` |
| **Foundry**    | 1.3.x   | Compilar, probar y desplegar contratos. `forge`, `cast`, `anvil`. Ya instalado localmente  |

Por qué pnpm workspaces y no Turborepo: con tres paquetes y dos apps, los scripts de la raíz con `pnpm -r` alcanzan. Turborepo entra si el CI empieza a tardar, no antes.

---

## 2. Contratos y cadena

| Tecnología                        | Versión         | Para qué                                                                                              |
| --------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| **Solidity**                      | 0.8.x           | `MoorRegistrar`, `MoorProgramFactory`, scripts de despliegue                                          |
| **`1inch/swap-vm`**               | v1.0.2 (git)    | El motor. Se trae con `forge install`; de aquí salen `AquaSwapVMRouter`, `ProgramBuilder`, los opcodes y `CoreInvariants` para las pruebas |
| **`1inch/aqua`**                  | v1.0.0 (git)    | `IAqua`, `AquaApp`, el contrato `Aqua` para redesplegar en Sepolia                                    |
| **`ensdomains/contracts-v2`**     | commit (git)    | `IPermissionedRegistry`, `RegistryRolesLib`, `PermissionedResolver`, `VerifiableFactory`. Trae OpenZeppelin como submódulo |
| **viem**                          | 2.56            | Lectura y escritura de cadena desde TypeScript: `packages/core`, Live App y agente. Un solo cliente para los tres |
| **`@1inch/aqua-sdk`**             | 0.3             | Codificar `ship`/`dock` y parsear eventos `Shipped`/`Docked`/`Pulled`/`Pushed` sin escribir ABIs a mano |

**Por qué Foundry y no Hardhat.** Los tres protocolos de los que depende Moor están hechos con Foundry. Con `forge install` se traen como dependencia y compilan en el mismo árbol; sus scripts de despliegue corren sin traducir; y `CoreInvariants` de SwapVM —la prueba que decide si la dirección del programa se puede cerrar ([05 §5](./05_stack-y-arquitectura.md#5-la-regla-que-no-puede-fallar-solo-la-ledger-mueve-capital-y-la-posición-no-se-deshace-sola))— se hereda tal cual. Además, `@1inch/aqua` y `@1inch/swap-vm` **no están publicados en npm** pese a lo que dicen sus READMEs, así que la vía Hardhat habría empezado copiando fuentes a mano.

**Dos submódulos más de los previstos.** SwapVM y Aqua resuelven sus dependencias por `node_modules` y fijan **OpenZeppelin 5.4.0** y **`@1inch/solidity-utils` 6.9.x**; se traen con `forge install` (`OpenZeppelin/openzeppelin-contracts@v5.4.0`, `1inch/solidity-utils@6.9.10`) y se remapean en `foundry.toml`. ENSv2 lleva su propio OZ 5.3.0; como el resolutor de Foundry no honra remappings por contexto de solc, **todos compilan contra la 5.4.0** — son compatibles en código fuente. `forge coverage` necesita `--ir-minimum` con via-IR.

**Anvil** se usa para las pruebas locales rápidas (fork de Sepolia), no para la demo: la demo va en Sepolia real ([05 §1](./05_stack-y-arquitectura.md#1-decisiones)).

---

## 3. Interfaz — la Live App

| Tecnología                              | Versión | Para qué                                                                                                  |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| **Next.js**                             | 16.3.4  | La Live App. App Router. Es lo que usa el tutorial oficial de Ledger. Casi todo cliente: la Wallet API vive en el navegador |
| **React**                               | 19.2.8  | Viene con Next                                                                                            |
| **`@ledgerhq/wallet-api-client`**       | 1.15    | El puente con Ledger Live: `account.list`, `transaction.signAndBroadcast`. Es la única forma de firmar     |
| **`@ledgerhq/wallet-api-client-react`** | 1.4     | Hooks sobre el cliente: `useAccounts`, `useSignTransaction`. Menos plomería en los componentes             |
| **`@ledgerhq/wallet-api-simulator`**    | 2.3     | Simula Ledger Live en el navegador para desarrollar **sin abrir Ledger Live ni conectar el dispositivo**. Solo desarrollo |
| **Tailwind CSS**                        | 4.x     | Estilos. Configuración por CSS                                                                            |
| **shadcn/ui**                           | —       | Componentes copiados al repo: dialog, sheet, form, toast, slider (el rango)                               |
| **TanStack Query**                      | 5.x     | Polling de balances, estado y records del agente. Caché y reintentos sin escribirlos                     |

**No hay conexión de wallet.** Ni wagmi, ni RainbowKit, ni WalletConnect: dentro de Ledger Live, la cuenta la da la Wallet API y la firma la hace Ledger Live. viem solo lee.

**Dos capas de emulación, dos herramientas.** El `wallet-api-simulator` reemplaza a **Ledger Live** (el host que da cuentas y firma); **Speculos** ([§6](#6-desarrollo-y-calidad)) reemplaza al **dispositivo** (corre la app de Ethereum y muestra lo que la Ledger mostraría). Desarrollo diario con el simulador; verificación de pantallas de firma con Speculos; el dispositivo real solo al cerrar cada pantalla y en la demo.

**`manifest.json`** en la raíz apunta a la URL de la Live App (Vercel en producción, `localhost` en desarrollo) y declara `currencies: ["ethereum_sepolia"]` y los permisos `account.list`, `account.request`, `transaction.signAndBroadcast`. Se carga en Ledger Live con el modo desarrollador.

---

## 4. Formularios y validación

| Tecnología | Versión | Para qué                                                                                          |
| ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| **zod**    | 4.x     | Un esquema por cosa que cruza una frontera: parámetros de posición, records ENS, propuesta del agente, variables de entorno. Vive en `packages/core` |

Los esquemas son la fuente de los tipos TypeScript, y la **propuesta del agente** usa el mismo esquema para validar lo que Claude devuelve ([§5](#5-agente-e-ia)) y lo que la Live App lee de ENS. Si el agente escribe algo que no valida, la Live App lo ignora y lo dice.

Formularios con estado de React y `useActionState`; sin librería de formularios. Son dos formularios.

---

## 5. Agente e IA

| Tecnología               | Versión | Para qué                                                                                                        |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| **Node.js + tsx**        | 22 / 4.x | Correr el agente en TypeScript sin paso de build. Un proceso, un bucle                                          |
| **`@anthropic-ai/sdk`**  | 0.124   | Llamar a Claude cuando hay algo que proponer                                                                   |
| **Claude Opus 5**        | `claude-opus-5` | El modelo. Thinking adaptativo (viene por defecto). Salida estructurada con `messages.parse()` contra el esquema zod de la propuesta |
| **viem**                 | 2.56    | Leer Aqua/SwapVM y escribir `setText` en el subnombre del agente. La llave caliente se carga desde Key Ring     |
| **pino**                 | 10.x    | Logs estructurados. Cada ciclo deja una línea: qué leyó, qué derivó, si propuso                                 |
| **Ledger Key Ring CLI**  | `wallet-cli` 2.1.0 | `wallet-cli ring encrypt/decrypt --key <nombre>`: custodia de la llave del agente, la RPC y la API key de Anthropic, cifradas con la seed de la Ledger y descifradas sin USB en el VPS (solo red) |

**Dónde entra el modelo y dónde no.** Leer precio, leer balances, derivar estado y detectar umbrales es **código determinista** en `packages/core` — no se le pregunta a un modelo cuánto vale `1 − balIn/monto0`. Claude entra **solo cuando se cruza un umbral**: recibe la posición, la lectura y las alternativas ya simuladas por código, y devuelve una propuesta estructurada (`none | widen | narrow | close | renew`, parámetros, razonamiento en dos frases). Una llamada por propuesta, no por ciclo. La salida se valida con zod antes de escribirse en ENS; si no valida, no se escribe.

Se activan los **fallbacks del lado del servidor** del SDK (`fallbacks: "default"`), para que un rechazo del clasificador de seguridad no deje un ciclo sin propuesta.

---

## 6. Desarrollo y calidad

| Tecnología          | Versión | Para qué                                                                                        |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| **Biome**           | 2.5     | Lint y formato de TypeScript en un solo binario. Script `check`                                 |
| **Vitest**          | 5.0     | Pruebas de `packages/core`: derivación de estado, construcción de programa, esquemas             |
| **`@vitest/coverage-v8`** | 5.0 | Motor de cubrimiento de Vitest. `pnpm test` corre con `--coverage`; el umbral vive en `vitest.config.ts` |
| **`forge test`**    | —       | Pruebas de contratos, incluidas las de "lo prohibido debe fallar" y la de dirección contra `CoreInvariants` |
| **`forge fmt`**     | —       | Formato de Solidity                                                                             |
| **Speculos**        | 0.27 (`.venv`) | Emulador oficial del dispositivo Ledger (Nano S+/X, Stax, Flex, Apex). Corre la app de Ethereum sin hardware; API REST, botones automatizables, capturas. Sirve para ver **exactamente qué muestra la pantalla** al firmar `ship`, `createPosition` o `revokeRoles` con nuestros descriptores ERC-7730, y para capturar esas pantallas en CI. Requiere el paquete de sistema `qemu-user-static` |
| **App de Ethereum (ELF)** | 1.22.3 | **Precompilada** por dispositivo en los releases de `LedgerHQ/app-ethereum`; `ledger:emu` la descarga. No hay que compilarla |
| **`erc7730`**       | 1.0.10 (`.venv`) | Linter oficial de descriptores ERC-7730: límites del dispositivo, esquema, y validación del ABI contra Sourcify/Etherscan cuando el contrato está verificado |
| **`@ledgerhq/wallet-cli`** | 2.1.0 (global) | Ledger Wallet CLI. `ring init` (con dispositivo) provisiona el Key Ring; `ring encrypt`/`decrypt --key` después sin dispositivo, con red |
| **GitHub Actions**  | —       | En cada PR: `pnpm check`, `pnpm test`, `forge test`, build de la Live App                        |
| **`.githooks`**     | —       | Pre-commit: `pnpm check` y `forge fmt --check`. Pre-push: pruebas. Como en los otros proyectos    |

**Una prueba que vale por dos:** `packages/core` construye el programa y calcula `strategyHash`; una prueba de Foundry construye el mismo programa en Solidity y compara. Si divergen, la Live App estaría firmando una cosa y mostrando otra.

**Cubrimiento: 90% en `packages/core`, sin umbral ciego en los contratos.** `vitest.config.ts` declara `coverage.thresholds` (`lines`/`functions`/`branches`/`statements`) sobre `include: ["packages/core/src/**/*.ts"]` — igual que en `cuente-conmigo`, el número se valida **dentro** de `pnpm test`, que falla si algo queda por debajo; no hay un paso aparte que "revise el %" después. `forge coverage --report summary` corre en CI para los contratos, pero se lee contra las pruebas críticas nombradas en `AGENTS.md` (la compuerta de dirección, los roles negativos del agente, la paridad de `strategyHash`), no contra un porcentaje: un contrato pequeño y crítico se prueba exhaustivo en sus ramas de decisión, no de manera uniforme.

**Speculos no es una wallet.** Ledger lo dice sin rodeos: no tiene firmware real, solo reimplementa funciones del SDK, y "no debe usarse para guardar cripto ni hacer transacciones". Aquí se usa para una sola cosa: que la pantalla de cada firma esté bien **antes** de tocar el dispositivo, y que un cambio en un descriptor ERC-7730 rompa una captura en CI en vez de sorprendernos en la demo.

---

## 7. Servicios externos

| Servicio                          | Plan     | Para qué                                                                                      |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| **Sepolia RPC** (Alchemy o Infura) | Gratis  | Live App y agente. Un proveedor, dos llaves (una por app) para poder rotarlas por separado    |
| **Faucets de Sepolia**            | Gratis   | ETH para redesplegar Aqua + SwapVM + tokens + contratos propios. **Pedir desde el día uno**    |
| **ENS App (Sepolia, ENSv2)**      | Gratis   | Registrar `salviega.eth` de prueba en ENSv2                                                   |
| **Ledger Live Desktop**           | —        | Modo desarrollador para cargar el `manifest.json` local y probar con el dispositivo real       |
| **Vercel**                        | Hobby    | Hospedar la Live App: proyecto `moor`, Root Directory `apps/live-app`, Node 22, repo conectado. Producción: [getmoor.vercel.app](https://getmoor.vercel.app) — `moor.vercel.app` estaba tomado. *Gotcha:* el `prepare` de la raíz debe tolerar la ausencia de `.git` o tumba el `pnpm install` del build |
| **Anthropic API**                 | Pago por uso | Claude Opus 5 para las propuestas. Pocas llamadas: solo al cruzar umbrales                |
| **VPS** (cualquiera)              | ~5 USD/mes | El agente headless, con Key Ring enrolado                                                   |

---

## 8. Variables de entorno

Validadas con zod al arrancar cada app; si falta una, no arranca. Ninguna vive en el repo.

| Variable                          | Dónde se usa | Notas                                                                          |
| --------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL`     | Live App     | Se inlinea en build; cambiarla exige redesplegar                               |
| `NEXT_PUBLIC_MOOR_REGISTRAR`      | Live App     | Dirección de `MoorRegistrar` en Sepolia                                        |
| `NEXT_PUBLIC_AQUA`, `NEXT_PUBLIC_SWAPVM_ROUTER` | Live App | Direcciones del redespliegue en Sepolia. Las de producción de 1inch **no** aplican. *Hoy no hacen falta:* la Live App las lee de `packages/core/src/addresses.ts`, que `contracts:deploy` reescribe |
| `DEPLOYER_ADDRESS`                | Foundry      | Dueño del `AquaSwapVMRouter` (`Rescuable`). Solo fondos de prueba                |
| `WETH_ADDRESS`                    | Foundry      | Opcional. Si falta, `Deploy.s.sol` despliega un `TestWETH`                      |
| `SEPOLIA_RPC_URL`                 | Agente       | Distinta llave que la de la Live App. Sale de Key Ring                         |
| `AGENT_PRIVATE_KEY`               | Agente       | La llave caliente. **Sale de Key Ring, nunca de un `.env`**                     |
| `ANTHROPIC_API_KEY`               | Agente       | Sale de Key Ring                                                               |
| `AGENT_INTERVAL_SECONDS`          | Agente       | Cadencia del ciclo. Por defecto 300                                            |
| `DEPLOYER_PRIVATE_KEY`            | Foundry      | Solo para scripts de despliegue; local, nunca en CI                            |

Las direcciones de ENSv2 en Sepolia son constantes públicas en `packages/core`, no variables: no cambian por entorno.

---

## 9. Scripts

Desde la raíz, con `pnpm`:

| Script              | Qué hace                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| `dev`               | Live App con el simulador de Wallet API; no requiere Ledger Live                   |
| `dev:ledger`        | Live App en `localhost` para cargarla en Ledger Live con el manifest local          |
| `agent`             | Un ciclo del agente y sale. Para probar                                             |
| `agent:loop`        | El agente en bucle, como corre en el VPS                                            |
| `check`             | Biome sobre todo el monorepo                                                        |
| `test`              | Vitest en `packages/core`, con `--coverage` — falla si el cubrimiento baja de 90%    |
| `contracts:test`    | `forge test` en `packages/contracts`                                                |
| `contracts:coverage`| `forge coverage --report summary` en `packages/contracts` — se lee, no se exige un %  |
| `contracts:deploy`  | (`deploy:sepolia` en el paquete — `deploy` es un comando reservado de pnpm) `script/Deploy.s.sol` en Sepolia (`SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`): Aqua, `AquaSwapVMRouter`, `TestWETH` si no hay `WETH_ADDRESS`, `tWBTC`, `tUSDC`; luego `write-addresses.mjs` reescribe `packages/core/src/addresses.ts` |
| `contracts:deploy:anvil` | Lo mismo contra un Anvil local con la llave 0 de Anvil — es como se verificó el script |
| `demo:taker`        | El taker de demo: ejecuta swaps contra una posición para mostrar fills               |
| `ledger:emu`        | Levanta Speculos con la app de Ethereum y una seed de prueba; la Live App en `dev:ledger` firma contra él |
| `ledger:screens`    | Firma en Speculos cada transacción del flujo (`approve`, `ship`, `createPosition`, `dock`, `revokeRoles`) y guarda las capturas en `packages/erc7730/screens/` |

---

## 10. Lo que se descartó y por qué

| Descartado              | En favor de            | Por qué                                                                                                    |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Hardhat**             | Foundry                | Los tres protocolos son Foundry; `CoreInvariants` no se reutiliza desde Hardhat; los paquetes npm de 1inch no existen |
| **Vite + React**        | Next.js                | El tutorial de Ledger es Next; despliegue directo en Vercel. Lo que se pierde (un servidor que casi no se usa) es barato |
| **wagmi / RainbowKit**  | Wallet API             | Dentro de Ledger Live no hay que conectar wallet: la cuenta y la firma vienen del host                     |
| **ethers**              | viem                   | Tipos más estrictos, menor tamaño, y es lo que usa el ecosistema de Aqua SDK                               |
| **Python para el agente** | TypeScript           | Habría duplicado `packages/core` en otro lenguaje. Una sola implementación de "qué es una posición"        |
| **Vercel AI SDK / AI Gateway** | `@anthropic-ai/sdk` | Un modelo, un proveedor, una llamada por propuesta. La capa de abstracción no paga su costo aquí        |
| **Turborepo**           | pnpm workspaces        | Cinco paquetes. Entra si el CI tarda                                                                       |
| **Base de datos / ORM** | Nada                   | No hay estado propio ([05 §4](./05_stack-y-arquitectura.md#4-dónde-vive-el-estado))                        |
| **Ledger como firmante del agente** | Llave caliente + Key Ring | El agente firma `setText` cada pocos minutos sin humano; una Ledger ahí sería teatro. Lo que sí custodia la Ledger es la llave |

---

## 11. Pendientes

- **Fuente de precio.** Chainlink tiene feeds en Sepolia (BTC/USD); Pyth también. Elegir una y fijarla en `packages/core`. Compartido con el [04](./04_diseno-de-solucion.md#8-decisiones-tomadas-y-pendientes).
- **Verificación de contratos.** El verificador Sourcify de `forge 1.3` no entiende la respuesta de la API actual (`error decoding response body`); la API v2 de Sourcify sí funciona con el standard-json de `forge verify-contract --show-standard-json-input`. Empaquetarlo como script `contracts:verify`. Etherscan requiere `ETHERSCAN_API_KEY`.
- **Descriptores locales en el dispositivo.** El camino es el ERC-7730 Tester de Ledger — ver [07](./07_plan-de-trabajo.md) fase 0 y [`feedback/03_ledger.md`](../feedback/03_ledger.md).
- **Speculos + Clear Signing.** Confirmar cómo se le entregan a la app de Ethereum emulada los descriptores ERC-7730 locales (la app los recibe como metadata firmada; en desarrollo hay que ver qué acepta). Sin eso, Speculos muestra las pantallas de blind signing y no sirve para lo que queremos.
- **Enrolar el Key Ring en un host sin USB.** La instalación ya está clara (`npm i -g @ledgerhq/wallet-cli`; `ring init` con dispositivo; luego solo red). Lo que sigue sin documentar es cómo un segundo host (el VPS) pasa a ser miembro del mismo trustchain. Se resuelve con el dispositivo — ver [`feedback/03_ledger.md`](../feedback/03_ledger.md).
- **Cómo enumerar subnombres** de un `UserRegistry` desde viem: eventos, `UniversalResolverV2` o un índice mínimo. Compartido con el [05](./05_stack-y-arquitectura.md#11-pendientes).
