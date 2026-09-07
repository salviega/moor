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
| **Foundry**    | 1.3.2   | Compilar, probar y desplegar contratos. `forge`, `cast`, `anvil`. **Fijado también en CI** (`foundry-toolchain` `v1.3.2`): `forge fmt` cambia entre versiones y el hook de pre-commit tiene que coincidir con el CI |

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
| **lucide-react**                        | 1.41    | Iconos. Los componentes (botón con motivo de deshabilitado, panel, campo con unidad, aviso con acción, marca de estado, detalles técnicos, skeleton, gráfico de rango, banda de propuesta, toast) son funciones propias en `src/components/`; no hizo falta shadcn/ui. Tokens en `globals.css` (`@theme`) con la paleta de la marca (`brand/README.md`): tinta de fondo, papel para texto, latón como único acento para "requiere tu firma", pizarra para lo secundario; monoespaciada para cifras |
| **TanStack Query**                      | 5.x     | Polling de balances, estado y records del agente. Caché y reintentos sin escribirlos                     |

**No hay conexión de wallet.** Ni wagmi, ni RainbowKit, ni WalletConnect: dentro de Ledger Live, la cuenta la da la Wallet API y la firma la hace Ledger Live. viem solo lee.

**El transporte se crea solo en el navegador.** `WindowMessageTransport` toca `window`, así que `Providers` lo instancia en un `useEffect` y no renderiza nada hasta tenerlo; el prerender estático de Next queda como cascarón. `NEXT_PUBLIC_WALLET_API_SIMULATOR=1` (script `dev`) cambia al transporte del simulador con el perfil `STANDARD` **más una cuenta `ethereum_sepolia`** con la dirección del holder (el perfil no trae ninguna; ver [`feedback/03_ledger.md`](../feedback/03_ledger.md)). Firmar en el simulador devuelve un hash inventado; la app no espera recibos en ese modo.

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
| **Node.js + tsx**        | 22 / 4.x | Correr el agente en local sin paso de build (`pnpm agent`, `agent:loop`); en producción el runtime es Deno, en Supabase |
| **Supabase Edge Functions + pg_cron** | CLI 2.116 | Hospedar el agente: `agent-cycle` corre un ciclo por petición (Deno); `pg_cron` + `pg_net` la llaman cada 5 minutos desde la base. Secretos en el proyecto (`pnpm agent:secrets`) |
| **esbuild**              | 0.28    | `pnpm agent:bundle`: empaqueta `edge.ts` con `@moor/core`, viem y zod en un solo archivo para Deno; `ws` (Node) queda fuera con un stub |
| **Groq API**             | `fetch`, sin SDK | Llamar al modelo cuando hay algo que proponer: el endpoint compatible con OpenAI, `response_format: json_schema` estricto. Tier gratuito, sin tarjeta |
| **gpt-oss-120b** (en Groq) | `openai/gpt-oss-120b` | El modelo. Razonamiento propio; salida estructurada estricta contra el esquema zod de la propuesta, derivado a JSON Schema en `packages/core/src/model.ts` |
| **viem**                 | 2.56    | Leer Aqua/SwapVM y escribir `setText` en el subnombre del agente. La llave caliente llega por el entorno del host |
| **pino**                 | 10.x    | Logs estructurados. Cada ciclo deja una línea: qué leyó, qué derivó, si propuso                                 |
| ~~**Ledger Key Ring CLI**~~ | `wallet-cli` 2.1.0 | Fue el plan para custodiar los secretos del agente. `ring init` funcionó en el portátil; enrolar un host sin USB no está documentado, así que el 6 de septiembre la custodia pasó a Supabase y Key Ring va al [08](./08_roadmap.md) |

**Dónde entra el modelo y dónde no.** Leer precio, leer balances, derivar estado y detectar umbrales es **código determinista** en `packages/core` — no se le pregunta a un modelo cuánto vale `1 − balIn/monto0`. El modelo entra **solo cuando se cruza un umbral**: recibe la posición, la lectura y las alternativas ya simuladas por código, y devuelve una propuesta estructurada (`none | widen | narrow | close | renew`, parámetros, razonamiento en dos frases). Una llamada por propuesta, no por ciclo. La salida se valida con zod antes de escribirse en ENS; si no valida, no se escribe.

El modelo fue primero Claude Opus 5 vía `@anthropic-ai/sdk`; el 6 de septiembre pasó a Groq para que el agente corra sin gasto durante el hackathon. Lo que no cambió: el prompt, el esquema, y que una respuesta que no valida cae a la propuesta determinista — el modelo es una dependencia de un ciclo, nunca del producto.

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
| **Groq API**                      | Gratis   | `gpt-oss-120b` para las propuestas. Tier gratuito: 30 req/min, 1 000 req/día, 200K tokens/día — sobra para una llamada por propuesta |
| **Supabase**                      | Gratis   | El agente: Edge Function `agent-cycle` + `pg_cron`; secretos del proyecto. Capa gratuita                |

---

## 8. Variables de entorno

Validadas con zod al arrancar cada app; si falta una, no arranca. Ninguna vive en el repo.

| Variable                          | Dónde se usa | Notas                                                                          |
| --------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL`     | Live App     | Opcional; por defecto el RPC público de PublicNode. Se inlinea en build. `eth_getLogs` se pide en tramos de 10k bloques por los límites de los RPC públicos |
| ~~`NEXT_PUBLIC_MOOR_REGISTRAR`~~  | Live App     | No existe: las direcciones salen de `packages/core/src/addresses.ts`         |
| `NEXT_PUBLIC_AQUA`, `NEXT_PUBLIC_SWAPVM_ROUTER` | Live App | Direcciones del redespliegue en Sepolia. Las de producción de 1inch **no** aplican. *Hoy no hacen falta:* la Live App las lee de `packages/core/src/addresses.ts`, que `contracts:deploy` reescribe |
| `DEPLOYER_ADDRESS`                | Foundry      | Dueño del `AquaSwapVMRouter` (`Rescuable`). Solo fondos de prueba                |
| `WETH_ADDRESS`                    | Foundry      | Opcional. Si falta, `Deploy.s.sol` despliega un `TestWETH`                      |
| `SEPOLIA_RPC_URL`                 | Agente       | Distinta llave que la de la Live App. Secreto de Supabase (`pnpm agent:secrets`); en local, `.env`. Debe permitir rangos amplios de `eth_getLogs` — PublicNode sí, Alchemy gratis no |
| `AGENT_PRIVATE_KEY`               | Agente       | La llave caliente. **Secreto de Supabase, nunca un archivo del repo**; en local, el `.env` ignorado por git |
| `GROQ_API_KEY`                    | Agente       | Secreto de Supabase. Opcional: sin ella el agente corre con la propuesta determinista |
| `AGENT_INTERVAL_SECONDS`          | Agente       | Cadencia del ciclo. Por defecto 300                                            |
| `AGENT_PARENT_NAME`, `AGENT_MODEL` | Agente      | Nombre del holder (`salviega.eth`) y modelo (`openai/gpt-oss-120b`)                  |
| `AGENT_LOGS_CHUNK`, `AGENT_FROM_BLOCK` | Agente  | Tramo de `eth_getLogs` (10 000; Alchemy gratis solo permite 10) y bloque inicial (11 600 000). El RPC del agente debe permitir rangos amplios: PublicNode sirve |
| `AGENT_DRY_RUN`                   | Agente       | `1`: lee, deriva y registra, pero no envía nada                                |
| `DEPLOYER_PRIVATE_KEY`            | Foundry      | Solo para scripts de despliegue; local, nunca en CI                            |
| `MOOR_HOLDER`, `MOOR_SALT`        | Foundry      | `DeployRegistrar.s.sol`: dueño del nombre y salt del proxy del registry (default 1) |
| `MOOR_AGENT`                      | Foundry      | `SetupHolder.s.sol`: la dirección de la llave del agente que se autoriza       |
| `MOOR_POSITION`, `MOOR_LABEL`     | Foundry      | `CreatePosition.s.sol`: JSON de la posición (`demo:ship`) y label (default `btc-dip`) |

Las direcciones de ENSv2 en Sepolia son constantes públicas en `packages/core`, no variables: no cambian por entorno.

---

## 9. Scripts

Desde la raíz, con `pnpm`:

| Script              | Qué hace                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| `dev`               | Live App con el simulador de Wallet API; no requiere Ledger Live                   |
| `dev:ledger`        | Live App en `localhost` para cargarla en Ledger Live con el manifest local          |
| `agent`             | Un ciclo del agente y sale. Para probar (`AGENT_DRY_RUN=1` para no enviar)          |
| `agent:loop`        | El agente en bucle bajo Node, para una máquina propia; en producción corre en Supabase           |
| `agent:bundle`      | Empaqueta la Edge Function (`supabase/functions/agent-cycle/index.js`, ignorado por git)         |
| `agent:serve`       | La corre en local bajo Deno con el `.env` (puerto 8000); `curl 'localhost:8000/?dry=1'` es un ciclo sin enviar |
| `agent:secrets`     | Sube al proyecto enlazado solo las variables del agente que hay en `.env`                        |
| `agent:deploy`      | Empaqueta y despliega; el cron va aparte con `npx supabase db push` (migración `agent_cron`)     |
| `check`             | Biome sobre todo el monorepo                                                        |
| `test`              | Vitest en `packages/core`, con `--coverage` — falla si el cubrimiento baja de 90%    |
| `contracts:test`    | `forge test` en `packages/contracts`                                                |
| `contracts:coverage`| `forge coverage --report summary` en `packages/contracts` — se lee, no se exige un %  |
| `contracts:deploy`  | (`deploy:sepolia` en el paquete — `deploy` es un comando reservado de pnpm) `script/Deploy.s.sol` en Sepolia (`SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`): Aqua, `AquaSwapVMRouter`, `TestWETH` si no hay `WETH_ADDRESS`, `tWBTC`, `tUSDC`; luego `write-addresses.mjs` reescribe `packages/core/src/addresses.ts` |
| `contracts:deploy:anvil` | Lo mismo contra un Anvil local con la llave 0 de Anvil — es como se verificó el script |
| `contracts:deploy:registrar` | `DeployRegistrar.s.sol` (`MOOR_HOLDER`): `MoorRegistrar` + proxy `UserRegistry` del holder vía `VerifiableFactory`; escribe `deployments/<chainId>.names.json`. Con `--skip-simulation`: la simulación on-chain de forge reporta un `CreateCollision` falso sobre el CREATE2 de la factory |
| `contracts:deploy:resolver` | `DeployResolver.s.sol`: proxy `PermissionedResolver` del holder vía `VerifiableFactory`, root = holder; añade `holderResolver` a `<chainId>.names.json` |
| *(holder, con Ledger)* | `forge script script/SetupHolder.s.sol --ledger` (`MOOR_AGENT`): `setResolver` + `addr`, `setSubregistry`, roles a `MoorRegistrar`, `setupAgent`. Luego `script/CreatePosition.s.sol --ledger` (`MOOR_POSITION`). Son el *First-time setup* y el *nombrar* del 04 como scripts hasta la fase 3 |
| `demo:ship`         | `ShipDemo.s.sol`: envía una posición de prueba desde la wallet del broadcaster (`MOOR_AMOUNT`, `MOOR_PRICE_MIN/MAX`, `MOOR_FEE_BPS`, `MOOR_DAYS`); escribe `deployments/positions/<chainId>-<hash>.json` |
| `demo:taker`        | `DemoTaker.s.sol`: llena esa posición (`MOOR_POSITION`, `MOOR_AMOUNT_IN`) o, con `MOOR_REVERSE=1`, muestra la dirección contraria revirtiendo. Infraestructura de demo, no producto |
| `ledger:emu`        | Levanta Speculos con la app de Ethereum y una seed de prueba; la Live App en `dev:ledger` firma contra él |
| `ledger:screens`    | Renderiza en un Flex emulado las seis firmas del flujo (`approve`, `ship`, `createPosition`, `dock`, `unregister`, `revokeAgent`) con nuestros descriptores ERC-7730 inyectados y guarda las capturas en `packages/erc7730/screens/<firma>/` más `results.json`. Usa el *clear-signing tester* de Ledger (`apps/clear-signing-tester` en `LedgerHQ/device-sdk-ts`, clonado y compilado en `.cs-tester/` la primera vez, commit fijado). Requiere Docker (Speculos corre en contenedor) y **Node 24** (`nvm use 24`). Falla si una firma cubierta por un descriptor no sale clear-signed. En GitHub corre solo a mano (workflow `ledger-screens`, `workflow_dispatch`): tarda ~8 min y no tiene sentido en cada PR; las capturas commiteadas son la evidencia entre corridas |

---

## 10. Lo que se descartó y por qué

| Descartado              | En favor de            | Por qué                                                                                                    |
| ----------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Hardhat**             | Foundry                | Los tres protocolos son Foundry; `CoreInvariants` no se reutiliza desde Hardhat; los paquetes npm de 1inch no existen |
| **Vite + React**        | Next.js                | El tutorial de Ledger es Next; despliegue directo en Vercel. Lo que se pierde (un servidor que casi no se usa) es barato |
| **wagmi / RainbowKit**  | Wallet API             | Dentro de Ledger Live no hay que conectar wallet: la cuenta y la firma vienen del host                     |
| **ethers**              | viem                   | Tipos más estrictos, menor tamaño, y es lo que usa el ecosistema de Aqua SDK                               |
| **Python para el agente** | TypeScript           | Habría duplicado `packages/core` en otro lenguaje. Una sola implementación de "qué es una posición"        |
| **Vercel AI SDK / AI Gateway / SDK del proveedor** | `fetch` + zod | Un modelo, un proveedor, una llamada por propuesta: una petición HTTP y un esquema. Ni la abstracción ni el SDK pagan su costo aquí — pasar de Anthropic a Groq fue reescribir un archivo de treinta líneas |
| **Turborepo**           | pnpm workspaces        | Cinco paquetes. Entra si el CI tarda                                                                       |
| **Base de datos / ORM** | Nada                   | No hay estado propio ([05 §4](./05_stack-y-arquitectura.md#4-dónde-vive-el-estado))                        |
| **Ledger como firmante del agente** | Llave caliente + secretos de Supabase | El agente firma `setText` cada pocos minutos sin humano; una Ledger ahí sería teatro. La Ledger firma lo del holder; la llave del agente la custodia el host (Key Ring: [08](./08_roadmap.md)) |

---

## 11. Pendientes

- ~~**Fuente de precio.**~~ Chainlink BTC/USD en Sepolia, fijado en `packages/core` (`chainlinkSepolia.btcUsd`, `readPrice()`), fase 3.
- **Verificación de contratos.** El verificador Sourcify de `forge 1.3` no entiende la respuesta de la API actual (`error decoding response body`); la API v2 de Sourcify sí funciona con el standard-json de `forge verify-contract --show-standard-json-input`. Empaquetarlo como script `contracts:verify`. Etherscan requiere `ETHERSCAN_API_KEY`.
- ~~**Descriptores locales en el dispositivo.**~~ ~~**Speculos + Clear Signing.**~~ Cerrados en la fase 3: el *clear-signing tester* de `device-sdk-ts` inyecta los descriptores sin firmar a la app de Ethereum en Speculos mediante su *CAL interceptor* (sirve descriptores y certificados a la Device Management Kit); `ledger:screens` lo usa y cinco de las seis firmas salen clear-signed ([`feedback/03_ledger.md`](../feedback/03_ledger.md)). Lo que sigue abierto es el **dispositivo físico**: Ledger Live solo muestra clear signing con descriptores del registro de Ledger, así que la demo en la Flex firma a ciegas hasta que haya PR al registro (fase 5, si aplica a Sepolia).
- ~~**Enrolar el Key Ring en un host sin USB.**~~ Cerrado por otro camino el 6 de septiembre: el agente corre en Supabase y sus secretos son del proyecto; Key Ring en un host propio queda en el [08](./08_roadmap.md). Lo que sigue sin documentar (cómo un segundo host se une al trustchain) sigue anotado en [`feedback/03_ledger.md`](../feedback/03_ledger.md).
- ~~**Cómo enumerar subnombres** de un `UserRegistry` desde viem.~~ Cerrado en la fase 2: `listPositions()` sobre el evento `LabelRegistered` del registry del holder ([05 §11](./05_stack-y-arquitectura.md#11-pendientes)).
