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
| 0    | Andamiaje y Sepolia                          | 1.5  | 5–6 sep      |
| 1    | El programa y la regla que no puede fallar   | 2    | 6–8 sep      |
| 2    | El nombre y los permisos                     | 1.5  | 8–9 sep      |
| 3    | La Live App                                  | 2    | 9–11 sep     |
| 4    | El agente                                    | 1    | 11–12 sep    |
| 5    | Demo y submission                            | 1    | 12–13 sep    |
| —    | Stretch: opcode propio                       | —    | solo si sobra |

Las fechas son de fin de fase. Una fase que se atrasa **no empuja a la 5**: come de la fase siguiente, según *Orden y recortes*.

---

## Fase 0 — Andamiaje y Sepolia

**Objetivo:** que un cambio trivial llegue a producción, y que Sepolia y la Ledger estén listas antes de escribir producto.

- **Primer commit hoy.** Monorepo pnpm: `apps/live-app`, `apps/agent`, `packages/{contracts,core,erc7730}`, Biome, `.nvmrc`, `.githooks`, GitHub Actions con `check`, `test`, `forge test` y build de la Live App.
- ~~`forge install` de `1inch/swap-vm`, `1inch/aqua` y `ensdomains/contracts-v2` en `packages/contracts`; compila en limpio.~~ Cerrado el 5 de septiembre: `test/Deps.t.sol` compila e instancia los tres bajo solc 0.8.30 via-IR. Costó dos submódulos más (OZ 5.4.0, `solidity-utils` 6.9.10) y una sola OZ para todos — detalle en el [06 §2](./06_tecnologias.md#2-contratos-y-cadena) y en [`feedback/`](../feedback/).
- **Registrar `salviega.eth` en ENSv2 Sepolia.** Es el padre de todas las posiciones de la demo; sin él no hay subnombres.
- **Redesplegar Aqua y SwapVM en Sepolia** con su código oficial sin modificar, más WBTC y USDC de prueba con `mint` libre. Script `contracts:deploy` que escribe las direcciones en `packages/core`. Pedir ETH de faucet con anticipación: es la partida grande. **Preguntar a los mentores de 1inch si el redespliegue califica, el mismo día.**
- **Descriptor ERC-7730 de Aqua** (`approve`, `ship`, `dock`): el contrato ya existe, así que este se puede hacer desde el día uno y verificar en el dispositivo. Los de los contratos propios van con cada contrato (regla 2).
- **Ledger Live en modo desarrollador** con una Live App vacía desplegada en Vercel y cargada vía `manifest.json` (`currencies: ["ethereum_sepolia"]`; permisos `account.list`, `account.request`, `transaction.signAndBroadcast`), cuenta de Ethereum Sepolia, y la Ledger firmando **una llamada real a un contrato en Sepolia** vía `transaction.signAndBroadcast` — esto valida que la Wallet API sirve para `ship`. Verificar cómo se cargan descriptores ERC-7730 locales y que el dispositivo los muestra.
- **Speculos** corriendo la app de Ethereum con una seed de prueba (`ledger:emu`), y la Live App firmando contra él vía `dev:ledger`. Confirmar cómo recibe la app emulada los descriptores ERC-7730 locales: **si Speculos muestra la pantalla clear-signed de `Aqua.ship`, el riesgo de Clear Signing queda despejado sin tocar el dispositivo.**
- **Key Ring enrolado** en el host donde va a correr el agente.

Cualquier sorpresa en este paso —de la Wallet API, de Speculos, del redespliegue, del Key Ring— va a [`feedback/`](../feedback/) el mismo día.

**Verificación:** CI en verde en el primer PR; `salviega.eth` resuelve en Sepolia desde un resolver ENSv2; el SwapVM redesplegado responde `quote()` contra una posición de prueba; Speculos muestra clear-signed la pantalla de `Aqua.ship` con el descriptor local; la Live App abre dentro de Ledger Live y una llamada a contrato en Sepolia se firma y se muestra clear-signed en el dispositivo.

**Lo que esta fase decide:** si la Wallet API firma `data` arbitrario en Sepolia (si no → plan B WebHID del [05 §10](./05_stack-y-arquitectura.md#10-riesgos-técnicos)); si los descriptores locales se cargan (si no → transparencia en la Live App); si el redespliegue de Aqua es viable (si no → fork de Base).

---

## Fase 1 — El programa y la regla que no puede fallar

**Objetivo:** una posición unidireccional de liquidez concentrada que se llena onchain en Sepolia, y la prueba de que no se deshace. Es el riesgo nº 1 del [05 §10](./05_stack-y-arquitectura.md#10-riesgos-técnicos); va primero a propósito.

- **Pruebas primero** (regla 3): swap en dirección correcta llena; swap en dirección contraria revierte y `quote` devuelve cero; el programa pasa `CoreInvariants` de SwapVM; `dock` desde una cuenta que no es maker revierte. Verlas fallar.
- `MoorProgramFactory` (Solidity) con el programa del [05 §1](./05_stack-y-arquitectura.md#1-decisiones): `_dynamicBalancesXD` → `_jumpIfTokenIn` (bloquea la dirección contraria) → `_xycConcentrateGrowLiquidityXD` → fee → `_deadline`.
- `buildProgram()` en `packages/core` (TypeScript): mismo bytecode, mismo `strategyHash`. **Prueba de paridad** Solidity ↔ TypeScript.
- `deriveState()` y cálculo de fees en `packages/core` según [05 §6](./05_stack-y-arquitectura.md#6-el-cálculo-central-estado-y-fees-de-una-posición), con pruebas Vitest.
- Script `demo:taker`: ejecuta swaps contra una posición en Sepolia y muestra los eventos `Pulled`/`Pushed`.
- Descriptor ERC-7730 del `AquaSwapVMRouter` si el holder llega a firmar algo contra él (hoy no; confirmar).

**Compuerta de decisión — 7 de septiembre al mediodía.** Si la dirección no se puede cerrar con `_jumpIfTokenIn` sin romper invariantes, se cambia al **plan B** ese mismo día: `_limitSwap1D` + `_invalidateTokenOut1D`, una orden límite pura y unidireccional por construcción, y se recorta el "trabaja mientras espera" del [02](./02_solucion.md) y del [04 §6](./04_diseno-de-solucion.md#6-reglas-de-negocio) a "cobra fee al llenarse". No se deja para después: el 04 y el video dependen de saberlo.

**Verificación:** en Sepolia, `ship` desde una wallet de prueba; `demo:taker` llena parcialmente; `deriveState()` reporta `trabajando`; el swap inverso revierte. Hashes de transacción en el CHANGELOG.

---

## Fase 2 — El nombre y los permisos

**Objetivo:** `btc-dip.salviega.eth` existe en ENSv2 Sepolia, describe la posición, y el agente demostrablemente no puede tocarla.

- **Pruebas primero:** agente `setText` sobre la posición → revierte; agente `grantRoles` → revierte; agente `unregister` / `renew` → revierte; `hasRoles()` negativo para todo salvo el text de su propio subnombre; `revokeRoles` lo deja mudo; `unregister` funciona tras `dock`; el subnombre no es transferible.
- **Flujo de primera vez como script Foundry** (la pantalla viene en la fase 3): `UserRegistry` proxy vía `VerifiableFactory`, `setSubregistry` en `salviega.eth`, `PermissionedResolver` del holder, roles a `MoorRegistrar` según [05 §7](./05_stack-y-arquitectura.md#7-autenticación-y-permisos).
- `MoorRegistrar.createPosition(label, strategyHash, params, agentKey)`: registra el subnombre con `expiry = deadline` y sin `ROLE_CAN_TRANSFER_ADMIN`; escribe los records `moor.*` del [04 §3](./04_diseno-de-solucion.md#3-modelo-de-datos); registra `agent.<label>`; otorga `ROLE_SET_TEXT` a la llave del agente **solo ahí**.
- Descriptor ERC-7730 de `MoorRegistrar.createPosition` y de `revokeRoles` (registry y resolver), en la misma fase (regla 2).
- `packages/core`: leer y escribir records; **enumerar las posiciones de un holder** — aquí se decide entre eventos del registry y `UniversalResolverV2`, y se cierra el pendiente del [05 §11](./05_stack-y-arquitectura.md#11-pendientes).

**Verificación:** `UniversalResolverV2` resuelve `moor.strategy` de `btc-dip.salviega.eth` en Sepolia; las pruebas negativas pasan; un tercero comprueba `hasRoles` con `cast call` y obtiene `false` para todo lo que no sea el text del agente.

---

## Fase 3 — La Live App

**Objetivo:** crear y cerrar una posición desde Ledger Live con la Ledger física, todo clear-signed.

- Las cinco pantallas del [04 §5](./04_diseno-de-solucion.md#5-pantallas), en inglés: **Positions**, **New position**, **Review & sign**, **Position detail**, **First-time setup**.
- Wallet API: `useAccounts`; `signAndBroadcast` para `approve` → `ship` → `createPosition` en una sola sesión, con la pantalla *Review & sign* listando cada firma y lo que la Ledger va a mostrar. Desarrollo diario con `wallet-api-simulator`; prueba con dispositivo al cerrar cada pantalla.
- Lecturas con viem + TanStack Query desde `packages/core`: lista de posiciones, estado, fees, records.
- Carga de los descriptores ERC-7730 de `packages/erc7730` en Ledger Live modo desarrollador (cierra el pendiente del [06 §11](./06_tecnologias.md#11-pendientes)).
- `ledger:screens` en CI: cada transacción del flujo firmada en Speculos y su captura guardada en `packages/erc7730/screens/`. Un cambio en un descriptor que altere la pantalla rompe el CI, no la demo.
- **Recorte interno permitido:** *First-time setup* puede quedar como script si aprieta el tiempo; la demo usa una cuenta ya configurada en la fase 2.

**Verificación:** las capturas de Speculos de las cinco firmas del flujo en el repo, legibles en términos del producto; video corto de la Ledger física mostrando "ship 1,000 USDC…" clear-signed y la posición apareciendo en *Positions* leída desde ENS; cerrar la posición también clear-signed, y el nombre desaparece.

---

## Fase 4 — El agente

**Objetivo:** un proceso headless en un VPS, sin USB, que vigila, escribe en su subnombre, propone una vez, y que verificablemente no puede hacer más.

- `apps/agent`: bucle cada 300 s. Precio desde el feed **Chainlink BTC/USD en Sepolia** — decisión que cierra el pendiente compartido del [04 §8](./04_diseno-de-solucion.md#8-decisiones-tomadas-y-pendientes), [05 §11](./05_stack-y-arquitectura.md#11-pendientes) y [06 §11](./06_tecnologias.md#11-pendientes). `deriveState()` de `packages/core`; `setText` de `moor.agent.*` con viem.
- **Umbrales v1**, fijos y documentados en el código: precio a más de un porcentaje del rango durante más de N horas; posición `completada`; vencimiento a menos de 24 h. Al cruzar uno: **una** llamada a `claude-opus-5` con `messages.parse()` contra el esquema zod de la propuesta ([04 §3](./04_diseno-de-solucion.md#3-modelo-de-datos)), thinking adaptativo, `fallbacks: "default"`. Si la salida no valida, no se escribe.
- Secretos por **Key Ring** (`wallet-cli ring`) en el VPS: llave del agente, RPC, `ANTHROPIC_API_KEY`. `systemd` para el bucle.
- Live App: **panel del agente** en *Position detail* (última lectura con su antigüedad, propuesta si la hay); **Accept proposal** → sesión `dock` + `ship` + `createPosition`; **Revoke agent** → `revokeRoles`.
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
