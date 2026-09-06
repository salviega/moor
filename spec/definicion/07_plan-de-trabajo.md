# 07 — Plan de trabajo

> **Alcance de este documento:** cómo se construye lo definido en los documentos anteriores — fases, orden, verificación y recortes.
> **Depende de:** [05 — Stack y arquitectura](./05_stack-y-arquitectura.md) · [06 — Tecnologías](./06_tecnologias.md)

> **Este documento es también la traza del proyecto.** Lo que ya está hecho y verificado va ~~tachado~~. Una fase solo se tacha completa cuando su verificación pasó de verdad, no cuando el código existe. El detalle de cada cambio vive en el [CHANGELOG](../../CHANGELOG.md).

---

## Marco

La aplicación vive en la **raíz del monorepo** — `apps/`, `packages/`, con `spec/` al lado ([05 §3](./05_stack-y-arquitectura.md#3-estructura-del-proyecto)).

**Lo que enmarca el plan:** cierre de submissions el **13 de septiembre de 2026**; hoy es 5 — **ocho días**. Construye **una sola persona**, así que las fases van en serie estricta y los recortes se deciden desde el inicio, no al final. Punto de partida: repositorio vacío sin commits, spec cerrada del 01 al 08, Foundry 1.3 / Node 22 / pnpm 11 instalados, Ledger física disponible.

Cada fase termina **desplegada en Sepolia y verificable**. Si el tiempo se acaba en cualquier punto, lo que hay ya sirve para la demo.

El detalle operativo —qué se corre antes de cada commit y en qué orden— vive en el [`AGENTS.md`](../../AGENTS.md) del repositorio; el registro de cada cambio, con sus hashes de Sepolia, en el [`CHANGELOG.md`](../../CHANGELOG.md).
Lo que sorprende de la documentación de un sponsor frente a lo que hace su código —un error opaco, un límite no documentado, algo que funcionó mejor de lo esperado— se anota el mismo día en [`feedback/`](../feedback/), no al final.

**Cuatro reglas atraviesan todas las fases**, no negociables por velocidad:

1. **Commits repartidos, todos los días.** 1inch descalifica una sola entrada el último día; los otros dos lo miran también.
2. **Todo contrato que el usuario firme nace con su descriptor ERC-7730.** Sin él la Ledger muestra blind signing, que es lo contrario del pitch. El descriptor se escribe en la misma fase que el contrato, no al final, y su pantalla se verifica en Speculos antes que en el dispositivo.
3. **Toda promesa del [04](./04_diseno-de-solucion.md) tiene una prueba que intenta romperla.** La dirección del programa, los permisos negativos del agente, la paridad del `strategyHash`. La prueba se escribe antes que el código y se la ve fallar por la razón esperada.
4. **Inglés en todo lo que ve un juez.** UI de la Live App, README público, video y submission. La `spec/` sigue en español. Sin i18n: un solo idioma en la app.

### Calendario

| Fase | Qué                                          | Días | Fechas       |
| ---- | -------------------------------------------- | ---- | ------------ |
| ~~0~~ | ~~Andamiaje y Sepolia~~ cerrada el 5 sep     | 1.5  | 5–6 sep      |
| ~~1~~ | ~~El programa y la regla que no puede fallar~~ cerrada el 5 sep | 2    | 6–8 sep      |
| ~~2~~ | ~~El nombre y los permisos~~ cerrada el 5 sep | 1.5  | 8–9 sep      |
| ~~3~~ | ~~La Live App~~ cerrada el 6 sep (clear signing en la Flex real queda en negativo, aceptado) | 2    | 9–11 sep     |
| 4    | El agente                                    | 1    | 11–12 sep    |
| 5    | Demo y submission                            | 1    | 12–13 sep    |
| —    | Stretch: opcode propio                       | —    | solo si sobra |

Las fechas son de fin de fase. Una fase que se atrasa **no empuja a la 5**: come de la fase siguiente, según *Orden y recortes*.

---

## Fase 0 — Andamiaje y Sepolia

**Objetivo:** que un cambio trivial llegue a producción, y que Sepolia y la Ledger estén listas antes de escribir producto.

- ~~**Primer commit hoy.** Monorepo pnpm: `apps/live-app`, `apps/agent`, `packages/{contracts,core,erc7730}`, Biome, `.nvmrc`, `.githooks`, GitHub Actions con `check`, `test`, `forge test` y build de la Live App.~~ Cerrado el 5 de septiembre: [PR #2](https://github.com/salviega/moor/pull/2), CI verde en los dos jobs. `packages/core` arranca con 20 pruebas y 100 % de cubrimiento.
- ~~`forge install` de `1inch/swap-vm`, `1inch/aqua` y `ensdomains/contracts-v2` en `packages/contracts`; compila en limpio.~~ Cerrado el 5 de septiembre: `test/Deps.t.sol` compila e instancia los tres bajo solc 0.8.30 via-IR. Costó dos submódulos más (OZ 5.4.0, `solidity-utils` 6.9.10) y una sola OZ para todos — detalle en el [06 §2](./06_tecnologias.md#2-contratos-y-cadena) y en [`feedback/`](../feedback/).
- ~~**Registrar `salviega.eth` en ENSv2 Sepolia.** Es el padre de todas las posiciones de la demo; sin él no hay subnombres.~~ Hecho por el holder el 5 de septiembre en app.ens.dev. Verificado con `UniversalResolverV2.findResolver` → resolver `0xc93A…e363`, `addr` → `0xd7a4…564c`; subregistry en cero, como corresponde hasta la fase 2.
- ~~**Redesplegar Aqua y SwapVM en Sepolia** con su código oficial sin modificar, más WBTC y USDC de prueba con `mint` libre. Script `contracts:deploy` que escribe las direcciones en `packages/core`. Pedir ETH de faucet con anticipación: es la partida grande.~~ **Preguntar a los mentores de 1inch si el redespliegue califica** — sigue pendiente, con el `exact_match` de Sourcify como evidencia.
  - ~~*5 sep:* `script/Deploy.s.sol` + `scripts/write-addresses.mjs` listos y **verificados contra Anvil**. Falta correrlo en Sepolia.~~ **Desplegado en Sepolia el 5 de septiembre** (0.0075 ETH): Aqua [`0xB874…7140`](https://sepolia.etherscan.io/address/0xB8747B3e2F90154420165FB2fc4707D638797140), `AquaSwapVMRouter` [`0xdD02…04Cd`](https://sepolia.etherscan.io/address/0xdD026eA05C9256A1162dC3d41102579458A804Cd), `TestWETH` [`0x10C5…dfA0`](https://sepolia.etherscan.io/address/0x10C5026152eB4f79119d6cFb75205aEB6E98dfA0), `tWBTC` [`0xfA92…7deC`](https://sepolia.etherscan.io/address/0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC), `tUSDC` [`0x274a…57AB`](https://sepolia.etherscan.io/address/0x274aaB610937e018310cCedC0b05B543b75557AB). `router.AQUA()` coincide onchain; `addresses.ts` reescrito por el script. **Aqua verificado en Sourcify con `exact_match`** — el bytecode redesplegado es el oficial byte a byte, que es la evidencia para la pregunta a 1inch. Hashes en el CHANGELOG. *Gotcha:* `pnpm deploy` es un comando reservado; el script se llama `deploy:sepolia`.
- ~~**Descriptor ERC-7730 de Aqua** (`ship`, `dock`; `approve` es el estándar que Ledger ya trae): el contrato ya existe, así que este se puede hacer desde el día uno~~ y verificar en el dispositivo → **fase 3** (ERC-7730 Tester). Los de los contratos propios van con cada contrato (regla 2).
  - *5 sep:* `packages/erc7730/descriptors/calldata-Aqua.json` escrito desde el ABI compilado y `erc7730 lint` limpio (límites del dispositivo: owner ≤ 22, URL ≤ 26). Apunta ya a la dirección real [`0xB874…7140`](https://sepolia.etherscan.io/address/0xB8747B3e2F90154420165FB2fc4707D638797140), verificada en Sourcify, así que el lint valida el ABI. **Falta verlo en el dispositivo** (ERC-7730 Tester, fase 3).
- ~~**Ledger Live en modo desarrollador** con una Live App vacía desplegada en Vercel (**[getmoor.vercel.app](https://getmoor.vercel.app)**, proyecto `moor`, Root Directory `apps/live-app`, Node 22, repo de GitHub conectado: cada merge a `main` despliega) y cargada vía `manifest.json` (hecho por el holder el 5 de septiembre) (`currencies: ["ethereum_sepolia"]`; permisos `account.list`, `account.request`, `transaction.signAndBroadcast`), cuenta de Ethereum Sepolia, y la Ledger firmando **una llamada real a un contrato en Sepolia** vía `transaction.signAndBroadcast` — esto valida que la Wallet API sirve para `ship`. Verificar cómo se cargan descriptores ERC-7730 locales y que el dispositivo los muestra.~~
  - ~~*5 sep:* la Live App tiene [`/sign-test`](https://getmoor.vercel.app/sign-test) … **Falta que el holder lo ejecute desde Ledger Live**.~~ **Firmado desde Ledger Live con la Ledger Flex el 5 de septiembre:** [`0x3160e91f…`](https://sepolia.etherscan.io/tx/0x3160e91f23a196f60c8dc8092c5e062ef9d97a399cd88d9a5c918c974321f392) — `from 0xAA1a…62E1`, `to` tUSDC, `mint(0xAA1a…62E1, 1,000e6)`, `status 1`, saldo resultante 1,000 tUSDC. **La Wallet API firma y transmite `data` arbitrario en Sepolia.** El riesgo del 05 §10 queda cerrado; el plan B (WebHID/DMK) no hace falta. De paso salió un hallazgo de UX de Ledger Live al añadir la cuenta de Sepolia — en [`feedback/03_ledger.md`](../feedback/03_ledger.md).
- ~~**Speculos** corriendo la app de Ethereum con una seed de prueba (`ledger:emu`)~~. La Live App firmando contra él y la pregunta de los descriptores locales (**si Speculos muestra la pantalla clear-signed de `Aqua.ship`, el riesgo de Clear Signing queda despejado sin tocar el dispositivo**) → **fase 3**, con el ERC-7730 Tester.
  - ~~*5 sep:* `ledger:emu` cableado (Speculos 0.27 en `.venv`, **ELF precompilado** `app-1.22.3-flex.elf` de los releases de `LedgerHQ/app-ethereum` — no hay que compilar la app). Bloqueado en una dependencia de sistema: `sudo apt install qemu-user-static`.~~ **Speculos verificado el 5 de septiembre** tras instalar `qemu-user-static`: la app de Ethereum 1.22.3 arranca en el Flex emulado ([captura](../../packages/erc7730/screens/phase0-ethereum-app-1.22.3-home-flex.png)), `getAppConfiguration` → `1.22.3`, `getPublicKey m/44'/60'/0'/0/0` → `0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D` con `9000`.
  - **Descriptores locales:** Ledger publica un [ERC-7730 Tester](https://app.devicesdk.ledger.com/clear-signing-tools) que "inyecta el descriptor y muestra los campos contra un dispositivo o Speculos". Es el camino para ver `Aqua.ship` clear-signed antes del registro público; cómo evita la verificación PKI de la app no está documentado — se prueba en la fase 3 con el descriptor y una transacción real de Sepolia.
- **Key Ring enrolado** en el host donde va a correr el agente. **Único ítem abierto de la fase 0:** espera a tener el VPS; el portátil ya es miembro.
  - *5 sep:* `@ledgerhq/wallet-cli` 2.1.0 instalado. **`ring init` hecho en el portátil del holder** (miembro `salviega-HP-EliteBook`, trustchain `0013bf83…72f9fc`); `encrypt`/`decrypt` después solo necesitan red. **La documentación no dice cómo enrolar un segundo host sin USB** (el VPS) — anotado en [`feedback/03_ledger.md`](../feedback/03_ledger.md); se resuelve con el dispositivo en la mano.

Cualquier sorpresa en este paso —de la Wallet API, de Speculos, del redespliegue, del Key Ring— va a [`feedback/`](../feedback/) el mismo día.

**Verificación:** ~~CI en verde en el primer PR~~ (PR #2) · ~~`salviega.eth` resuelve en Sepolia desde un resolver ENSv2~~ (`UniversalResolverV2`) · ~~el SwapVM redesplegado responde `quote()` contra una posición de prueba~~ (hecho en la fase 1) · Speculos muestra clear-signed la pantalla de `Aqua.ship` con el descriptor local → **pasa a la fase 3** vía el ERC-7730 Tester (Speculos sí corre la app y responde APDUs) · ~~la Live App abre dentro de Ledger Live y una llamada a contrato en Sepolia se firma~~ (`mint` de tUSDC, hash arriba) — clear-signed no, porque `mint` no tiene descriptor; eso es Aqua en la fase 3.

**Fase 0 cerrada el 5 de septiembre**, un día antes del calendario, con dos ítems que se mueven de fase a propósito (`quote()` → fase 1, descriptores en el dispositivo → fase 3) y uno que espera al host: el Key Ring en el VPS.

**Lo que esta fase decidió:** la Wallet API **sí** firma `data` arbitrario en Sepolia (sin plan B WebHID); el redespliegue de Aqua **es** viable y reproducible (`exact_match` en Sourcify, sin fork de Base); los descriptores locales en el dispositivo quedan para el ERC-7730 Tester en la fase 3.

---

## Fase 1 — El programa y la regla que no puede fallar

**Objetivo:** una posición unidireccional de liquidez concentrada que se llena onchain en Sepolia, y la prueba de que no se deshace. Es el riesgo nº 1 del [05 §10](./05_stack-y-arquitectura.md#10-riesgos-técnicos); va primero a propósito.

- ~~**Pruebas primero** (regla 3): swap en dirección correcta llena; swap en dirección contraria revierte y `quote` devuelve cero; el programa pasa `CoreInvariants` de SwapVM; `dock` desde una cuenta que no es maker revierte. Verlas fallar.~~ `test/MoorProgram.t.sol` (8) + `test/MoorProgramInvariants.t.sol` (1): fallaron primero por lo esperado (dos por errores míos de prueba, útiles igual) y pasan las 10. Precisión: `quote` y `swap` **revierten** en la dirección contraria — no devuelven cero.
- ~~`MoorProgramFactory` (Solidity) con el programa del [05 §1](./05_stack-y-arquitectura.md#1-decisiones)~~ `src/MoorProgram.sol`: `Deadline` → `JumpIfTokenIn(permitido → 38)` → **`Deadline(0)`** como trampa → `FeeFlatIn` → `XYCConcentrateSwap`. Dos cosas que la lectura del código cambió respecto al 05: en modo Aqua los balances **no van en el programa** (los da Aqua, así que no hay `DynamicBalances`), y la trampa no es `Revert` porque el router oficial de Aqua **no despacha ese opcode** — `UnknownOpcode(1)` — así que la dirección prohibida revierte con `DeadlineReached(0)`: "esa dirección venció en la época 0". Anotado en [`feedback/01_1inch.md`](../feedback/01_1inch.md).
- ~~`buildProgram()` en `packages/core` (TypeScript): mismo bytecode, mismo `strategyHash`. **Prueba de paridad** Solidity ↔ TypeScript.~~ `packages/core/src/program.ts`: `buildProgram`, `buildOrder`, `strategyHash`, `sqrtPriceX18`, `rangeToSqrtBounds`. Paridad por **golden vectors**: `test_goldenVectors` en Foundry imprime programa, traits y hash; `program.test.ts` fija los mismos bytes. Y la conversión de precios humanos (USDC/BTC, decimales distintos) a `sqrt(B/A)·1e18` vive solo en TypeScript, con pruebas.
- ~~`deriveState()` y cálculo de fees en `packages/core` según [05 §6](./05_stack-y-arquitectura.md#6-el-cálculo-central-estado-y-fees-de-una-posición), con pruebas Vitest.~~ `deriveState()` (fase 0) y `fees.ts` (`feeEarnedFromGrossIn`, `accrue`): la fee se deriva del `amountIn` bruto de cada `Swapped` porque SwapVM la reinvierte en el balance sin separarla. 44 pruebas, ramas al 100 %.
- ~~Script `demo:taker`: ejecuta swaps contra una posición en Sepolia~~ `script/ShipDemo.s.sol` + `script/DemoTaker.s.sol` (`pnpm demo:ship`, `pnpm demo:taker`, `MOOR_REVERSE=1` para la dirección contraria), verificados primero en Anvil.
- ~~Descriptor ERC-7730 del `AquaSwapVMRouter` si el holder llega a firmar algo contra él (hoy no; confirmar).~~ Confirmado: el holder solo firma contra Aqua (`ship`/`dock`) y contra los contratos de ENS; contra el router firman los takers. No hace falta.

~~**Compuerta de decisión — 7 de septiembre al mediodía.** Si la dirección no se puede cerrar con `_jumpIfTokenIn` sin romper invariantes, se cambia al plan B.~~ **Resuelta el 5 de septiembre, dos días antes, sin plan B:** el harness `CoreInvariants` de SwapVM pasa sobre el programa en la dirección permitida (simetría exact-in/out, quote/swap, monotonía, redondeo a favor del maker, suficiencia de balance), y la dirección prohibida revierte en `quote` y en `swap`. El "trabaja mientras espera" del 02 y el 04 se mantiene tal como está escrito.

**Verificación:** ~~en Sepolia, `ship` desde una wallet de prueba; `demo:taker` llena parcialmente; `deriveState()` reporta `trabajando`; el swap inverso revierte.~~ **Hecho el 5 de septiembre en Sepolia:** posición `0x35a92a7d…` de 1,000 tUSDC en 58k–62k USDC/BTC, `ship` [`0xf5bf8022…`](https://sepolia.etherscan.io/tx/0xf5bf8022d92eb2f7442ff783d3f7805e4b8274c1c8e2b00b7150a8ad5dac8355); el taker trajo 0.01 tWBTC y recibió 605.857783 tUSDC (≈ 60,586 USDC/BTC, dentro del rango, fee incluida) [`0xe76cc5cf…`](https://sepolia.etherscan.io/tx/0xe76cc5cf16e51a611c96abe17bff7a79f487273c3de75ecbfb78180dac867501); `deriveState()` sobre los balances reales → `working` (60.6 % convertido); el intento inverso revierte con `DeadlineReached(0)` en `quote`. Mismos números que en Anvil: la matemática es determinista.

**Fase 1 cerrada el 5 de septiembre**, tres días antes del calendario.

---

## Fase 2 — El nombre y los permisos

**Objetivo:** `btc-dip.salviega.eth` existe en ENSv2 Sepolia, describe la posición, y el agente demostrablemente no puede tocarla.

- ~~**Pruebas primero:** agente `setText` sobre la posición → revierte; agente `grantRoles` → revierte; agente `unregister` / `renew` → revierte; `hasRoles()` negativo para todo salvo el text de su propio subnombre; `revokeRoles` lo deja mudo; `unregister` funciona tras `dock`; el subnombre no es transferible.~~ `test/MoorRegistrar.t.sol`, 13 pruebas contra el `UserRegistry` y el `PermissionedResolver` reales de `contracts-v2`. Ajuste al leer el código: los permisos del resolver son **por clave** (`authorizeTextRoles`), así que el agente escribe `moor.agent.*` en el nombre de la posición y `moor.strategy` le revierte; `hasRoles` es exacto sobre los ocho recursos; `revokeAgent` lo deja mudo.
- ~~**Flujo de primera vez como script Foundry** (la pantalla viene en la fase 3): `UserRegistry` proxy vía `VerifiableFactory`, `setSubregistry` en `salviega.eth`, `PermissionedResolver` del holder, roles a `MoorRegistrar` según [05 §7](./05_stack-y-arquitectura.md#7-autenticación-y-permisos).~~ `DeployRegistrar.s.sol` (deployer: registrar + proxy del registry) y `SetupHolder.s.sol` (holder, `--ledger`: `setSubregistry`, roles, `setupAgent`). Sí hace falta resolver propio (`DeployResolver.s.sol`): el de app.ens.dev conserva el root en la wallet que registró el nombre. Ensayado completo en un fork de Sepolia con el holder suplantado; el registrar y el registry ya están en Sepolia.
- ~~`MoorRegistrar.createPosition(label, strategyHash, params, agentKey)`: registra el subnombre con `expiry = deadline` y sin `ROLE_CAN_TRANSFER_ADMIN`; escribe los records `moor.*` del [04 §3](./04_diseno-de-solucion.md#3-modelo-de-datos); registra `agent.<label>`; otorga `ROLE_SET_TEXT` a la llave del agente **solo ahí**.~~ Quedó en tres funciones: `createPosition(registry, resolver, parent, label, expiry, records)`, `setupAgent(...)` (una vez por holder: `agent.<holder>.eth` + las ocho claves) y `revokeAgent(...)`. Sepolia: `0xe6915D2E5e8Db86661a66472e5B178d0dB419966`, Sourcify `exact_match`.
- ~~Descriptor ERC-7730 de `MoorRegistrar.createPosition` y de `revokeRoles` (registry y resolver), en la misma fase (regla 2).~~ Tres descriptores en `packages/erc7730/descriptors/`: `MoorRegistrar` (limpio en `erc7730 lint`), `PermissionedRegistry` y `PermissionedResolver` (el lint solo avisa que los proxies de ENS no están en Sourcify).
- ~~`packages/core`: leer y escribir records; **enumerar las posiciones de un holder** — aquí se decide entre eventos del registry y `UniversalResolverV2`, y se cierra el pendiente del [05 §11](./05_stack-y-arquitectura.md#11-pendientes).~~ `names.ts`: nodos, DNS-encode, recursos EAC, roles, codificación de records y `listPositions()` sobre `LabelRegistered` (eventos, no `UniversalResolverV2`: el label viene en claro y el registry es por holder). 54 pruebas en core.

**Verificación:** `UniversalResolverV2` resuelve `moor.strategy` de `btc-dip.salviega.eth` en Sepolia; las pruebas negativas pasan; un tercero comprueba `hasRoles` con `cast call` y obtiene `false` para todo lo que no sea el text del agente. **Cerrada el 5 de septiembre en Sepolia real**, firmado desde la Ledger Flex: `btc-dip.salviega.eth` resuelve vía `UniversalResolverV2` los siete records `moor.*` y `addr` = holder (`createPosition` tx `0xdb7e1132…5d2c`); `agent.salviega.eth` → llave del agente; `hasRoles` del agente es `true` solo en `(cualquier nombre, moor.agent.*)` y `false` en `(btc-dip, moor.strategy)`, sin roles root ni sobre la posición; su `setText(moor.agent.checkedAt)` pasa y `setText(moor.strategy)` revierte. La posición no es transferible y su `expiry` es el `deadline` del programa. Hashes completos en el CHANGELOG. *Nota:* la llave del agente tiene 0 ETH en Sepolia; hay que fondearla antes de la fase 4. *Cambio de holder (5 sep):* `salviega.eth` se había registrado desde otra wallet (`0xd7A4…564C`, que no está en la Ledger); el holder de la demo pasa a ser la cuenta Ledger `0xAA1aEf44DDE610F433f271C6A8749139DD5162E1` (`m/44'/60'/0'/0/0`), el nombre se le transfirió (`safeTransferFrom` del ERC-1155 del ETHRegistry), su registry es `0xE924…3922` y su resolver `0x694A…E1E3`. El registry `0x6b1D…9E81` del primer holder y el resolver `0xc93A…e363` de app.ens.dev quedan sin uso.

---

## Fase 3 — La Live App

**Objetivo:** crear y cerrar una posición desde Ledger Live con la Ledger física, todo clear-signed.

- ~~Las cinco pantallas del [04 §5](./04_diseno-de-solucion.md#5-pantallas), en inglés: **Positions**, **New position**, **Review & sign**, **Position detail**, **First-time setup**.~~ Hechas el 5 sep (`apps/live-app/src/app/`): Positions lista los nombres del registry del holder (`LabelRegistered`) con estado, % convertido y pulso del agente; New position → Review & sign explica qué pasa y qué no y lista cada firma con lo que la Ledger muestra; Position detail con panel del agente, *Close* (dock + unregister) y *Revoke agent*; First-time setup como pantalla de estado (recorte permitido: las firmas de la primera vez siguen en `SetupHolder.s.sol`).
- ~~Wallet API: `useAccounts`; `signAndBroadcast` para `approve` → `ship` → `createPosition` en una sola sesión, con la pantalla *Review & sign* listando cada firma y lo que la Ledger va a mostrar. Desarrollo diario con `wallet-api-simulator`; prueba con dispositivo al cerrar cada pantalla.~~ `useSignSession()` corre las `Call` de `packages/core` una tras otra por `client.transaction.signAndBroadcast` y espera cada recibo. El simulador no trae cuenta de Sepolia: `pnpm dev` le añade una con la dirección del holder, así las lecturas son las reales. Probado en el navegador contra Sepolia real y **en el dispositivo el 5 sep**: desde Ledger Live Desktop con la Flex, la Live App creó `btc-dip-2.salviega.eth` con tres firmas (`approve` `0x4c81…ed35`, `ship` `0x0ba8…79c0`, `createPosition` `0x35f2…4f45`); maker = la cuenta Ledger, `moor.amount` en el nombre, 1,000 tUSDC en Aqua. Firmado a ciegas: los descriptores aún no llegan al dispositivo.
- ~~Lecturas con viem + TanStack Query desde `packages/core`: lista de posiciones, estado, fees, records.~~ `reads.ts` (records por `UniversalResolverV2`, balances de Aqua, precio Chainlink, `deriveState`) y `session.ts` (constructores de `approve`/`ship`/`createPosition`/`dock`/`unregister`/`revokeAgent`/`setupAgent`), con paridad byte a byte contra el `ship` y el `createPosition` reales de Sepolia. 76 pruebas en core. Los fees por fills quedan para cuando el agente los escriba (fase 4).
- ~~Carga de los descriptores ERC-7730 de `packages/erc7730` en Ledger Live modo desarrollador (cierra el pendiente del [06 §11](./06_tecnologias.md#11-pendientes)).~~ Cerrado en negativo: Ledger Live no carga descriptores locales; el dispositivo solo clear-signa lo que está en el registro de Ledger. La verificación de pantallas vive en Speculos (`ledger:screens`); la Flex firma a ciegas en la demo, y la Live App dice en cada paso qué mostraría una Ledger con el descriptor publicado.
- ~~`ledger:screens` en CI: cada transacción del flujo firmada en Speculos y su captura guardada en `packages/erc7730/screens/`. Un cambio en un descriptor que altere la pantalla rompe el CI, no la demo.~~ Hecho el 5 sep con el *clear-signing tester* de Ledger (`device-sdk-ts`): las seis firmas del flujo renderizadas en un Flex emulado con nuestros descriptores; `ship`, `createPosition`, `dock`, `unregister` y `revokeAgent` **clear-signed** ("Open Moor position", "Position name btc-dip", "Under name salviega.eth", "Agent address"…), `approve` a ciegas porque es la pantalla ERC-20 de Ledger y los tokens de testnet no están en su CAL. 55 capturas y `results.json` en `packages/erc7730/screens/`; workflow `ledger-screens` (manual, `workflow_dispatch`, ~8 min) que regenera y hace `git diff` — no en cada PR, que ya tarda bastante.
- **Recorte interno permitido:** *First-time setup* puede quedar como script si aprieta el tiempo; la demo usa una cuenta ya configurada en la fase 2.

**Verificación:** las capturas de Speculos de las cinco firmas del flujo en el repo, legibles en términos del producto; video corto de la Ledger física mostrando "ship 1,000 USDC…" clear-signed y la posición apareciendo en *Positions* leída desde ENS; cerrar la posición también clear-signed, y el nombre desaparece. *Estado (5 sep):* la posición se creó desde la Ledger y aparece en *Positions* leída desde ENS (`btc-dip-2.salviega.eth`). ~~**Pendiente para cerrar la fase:** clear signing en el dispositivo (descriptores ERC-7730 cargados; hoy es blind signing), las capturas de Speculos, y probar *Close* con el dispositivo (hecho solo en el simulador).~~ Capturas de Speculos hechas (cinco de seis clear-signed). Clear signing en la Flex real: no posible sin el registro de Ledger (decisión: se acepta el blind signing en la demo y se muestra la pantalla emulada). *Close* con el dispositivo: pendiente, opcional — la sesión está cubierta por las capturas de `dock` y `unregister`.

---

## Fase 4 — El agente

**Objetivo:** un proceso headless en un VPS, sin USB, que vigila, escribe en su subnombre, propone una vez, y que verificablemente no puede hacer más.

- ~~`apps/agent`: bucle cada 300 s. Precio desde el feed **Chainlink BTC/USD en Sepolia**. `deriveState()` de `packages/core`; `setText` de `moor.agent.*` con viem.~~ Hecho el 6 sep: `apps/agent/src/main.ts` lee registry y resolver del nombre, enumera las posiciones (`LabelRegistered`), `readPositionView()` + `readPrice()`, y escribe las ocho claves en un solo `multicall` por posición. Probado en seco contra Sepolia: ve `btc-dip` y `btc-dip-2`, ambas `farFromRange` con el precio a 29 % del rango.
- ~~**Umbrales v1**, fijos y documentados en el código; al cruzar uno, **una** llamada a `claude-opus-5` con `messages.parse()` contra el esquema zod de la propuesta, thinking adaptativo, `fallbacks: "default"`. Si la salida no valida, no se escribe.~~ `packages/core/src/agent.ts` (`THRESHOLDS`, `detectTriggers`, `deterministicProposal`, `simulate`, `proposalPrompt`, `shouldPropose`), 25 pruebas; `apps/agent/src/model.ts` llama a `client.beta.messages.parse` con `betaZodOutputFormat(Proposal)`, `fallbacks: "default"` y thinking adaptativo; una refusal o una salida que no valida caen a la propuesta determinista. La llamada real a Claude está por probar (falta la API key en el entorno).
- Secretos por **Key Ring** (`wallet-cli ring`) en el VPS: llave del agente, RPC, `ANTHROPIC_API_KEY`. `systemd` para el bucle. *Escrito* (`apps/agent/deploy/moor-agent.service`, `run.sh` con `wallet-cli ring decrypt`); **pendiente** el VPS y el enrolamiento del Key Ring (arrastrado desde la fase 0).
- ~~Live App: **panel del agente** en *Position detail* (última lectura con su antigüedad, propuesta si la hay); **Accept proposal** → sesión `dock` + `ship` + `createPosition`; **Revoke agent** → `revokeRoles`.~~ Hecho: panel (fase 3), *Accept proposal* (`acceptProposalCalls`: `dock` + `unregister`, y para widen/narrow/renew `ship` + `createPosition` del sucesor `<label>-N` con lo que quedaba) y *Revoke agent* (`revokeAgent`).
- **Recorte interno permitido:** si aprieta, *Accept proposal* se reemplaza por *Close* + *New position* manuales, y la propuesta es texto determinista sin llamar a Claude.

**Verificación:** el agente corre en el VPS sin dispositivo conectado; `moor.agent.checkedAt` avanza cada ciclo; se fuerza un umbral y aparece una propuesta válida en la Live App; `cast call hasRoles` muestra que el agente no puede nada más; *Revoke agent* lo silencia y la posición sigue operando.

---

## Fase 5 — Demo y submission

**Objetivo:** que un juez pueda ver y reproducir sin nosotros en la sala.

- **Guion de demo (5 min):** el problema en una frase → crear posición en Ledger Live con la Ledger en cámara → `demo:taker` la llena y se ven los eventos → el agente propone → aceptar clear-signed → `hasRoles` en vivo mostrando lo que el agente no puede.
- **Video grabado el 12**, no el 13: ENS lo exige, y la beta de ENSv2 puede caerse el último día.
- **README público en inglés:** qué es, arquitectura (el diagrama del [05 §2](./05_stack-y-arquitectura.md#2-arquitectura)), cómo correr cada pieza, direcciones en Sepolia, hashes de las transacciones de la demo, enlace a `spec/`.
- **Revisión de requisitos por track**, con la lista del [03](./03_bounties.md#requisitos-que-atraviesan-los-tres) en la mano: historial de commits, ejecución onchain, sin hardcode, código abierto, video, empezado en el evento.
- **Confirmación de 1inch** sobre el redespliegue, preguntada en la fase 0 y cerrada aquí por escrito.
- **Cerrar `feedback/`:** cada archivo lleva su tabla resumen llena y su sección de reportes abiertos dice qué se envió aguas arriba y qué quedó solo documentado.
- **Submission a los tres tracks el 13 por la mañana**, no por la noche.

**Verificación:** una persona ajena sigue el README y reproduce `ship` + fill + `hasRoles` en Sepolia sin ayuda; el video está subido; las tres submissions muestran confirmación.

---

## Stretch — Opcode propio

Solo si la fase 4 cierra el **12 al mediodía**. `_oracleAnchoredRangeXD` según [08 §1a](./08_roadmap.md#1a-el-rango-que-sigue-al-precio--en-el-programa-sin-agente): rango relativo a un oráculo, probado contra `CoreInvariants`. Sube puntos con 1inch y es la respuesta al "fees solo dentro del rango". Si no llega, **se menciona en el video como roadmap**, no se improvisa.

---

## Orden y recortes

Se corta **desde atrás**, en este orden, y cada recorte se anota en este documento el día que se decide:

1. El stretch del opcode propio.
2. Claude en el agente → la propuesta queda como texto determinista.
3. *Accept proposal* → queda *Close* + *New position* manuales.
4. *First-time setup* como pantalla → queda como script.
5. El panel del agente en la Live App → queda solo la verificación con `cast`.

**Nunca se corta:** la firma con la Ledger clear-signed; la dirección del programa (o su plan B, declarado en el 02 y el 04); las pruebas negativas de los permisos del agente; fills onchain en Sepolia; commits diarios; el video.

---

## Riesgos

La tabla del [05 §10](./05_stack-y-arquitectura.md#10-riesgos-técnicos), con la fecha en que se sabe:

| Riesgo | Se sabe el | Si se materializa |
| --- | --- | --- |
| La dirección no se puede cerrar en el programa | **7 sep, mediodía** | Plan B `_limitSwap1D`; recortar el 02 y el 04 ese día |
| Redesplegar Aqua/SwapVM en Sepolia se complica | **6 sep** | Fork de Base con `chainId` real + `transaction.sign`; frágil pero funcional |
| 1inch no acepta el redespliegue como "oficial" | **≤ 8 sep** (respuesta de mentores) | Fork de Base para el track de 1inch; Sepolia sigue para ENS y Ledger |
| Descriptores ERC-7730 locales no cargan en Ledger Live ni en Speculos | **6 sep** | Mostrar descriptor y simulación en la Live App; decirlo en el video |
| La Wallet API no firma `data` arbitrario en Sepolia | **6 sep** | Firma vía WebHID (DMK) fuera de la Live App |
| ENSv2 beta se cae o cambia | Cualquier día; **video el 12** | Direcciones y ABI fijadas; el video es la demo de respaldo |
| Una sola persona: enfermedad, imprevisto | Cualquier día | El orden de recortes es la mitigación; lo que hay sirve |
