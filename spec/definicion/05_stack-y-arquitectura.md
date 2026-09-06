# 05 — Stack y arquitectura

> **Alcance de este documento:** cómo se construye — decisiones técnicas, dónde vive el estado, permisos, costos y riesgos. **No repite el diseño de producto.**
> **Depende de:** [03 — Bounties](./03_bounties.md) · [04 — Diseño de la solución](./04_diseno-de-solucion.md)

---

## 1. Decisiones

Cada una con lo que se descartó y por qué. Las cuatro primeras vienen del [03](./03_bounties.md#decisiones); la quinta lo revisa.

| Decisión | Se elige | Se descarta | Por qué |
| --- | --- | --- | --- |
| Motor de la posición | **SwapVM** sobre Aqua: `AquaSwapVMRouter`, `useAquaInsteadOfSignature = true` | `AquaApp` propio compuesto con la SDK de Aqua | La SDK solo codifica `ship`/`dock`; la lógica exigía un AMM en Solidity. SwapVM ya es un `AquaApp` y puntúa más |
| Programa | Liquidez concentrada **unidireccional**: `Deadline` → `JumpIfTokenIn(permitido)` → trampa `Deadline(0)` → `FeeFlatIn` → `XYCConcentrateSwap`. Sin balances en el programa: los da Aqua | Range order bidireccional | Un rango bidireccional vende de vuelta si el precio regresa. El salto por token de entrada cierra la dirección contraria (ver §5). La trampa es `Deadline(0)` porque el router de Aqua no despacha `Revert` |
| Identidad de la posición | **Registry de subnombres propio** bajo el nombre del holder + **un Permissioned Resolver por holder** | Wildcard sobre el resolver del padre | Wildcard no crea objeto onchain: sin token, expiración, permisos ni revocación. No pasa "ENSv2 central" |
| Modificar opcodes de SwapVM | **No** en el MVP; stretch al final | Opcode propio desde el día uno | Cinco invariantes + orden de instrucciones crítico; se prueba contra `CoreInvariants` solo si sobra tiempo |
| **Cadena** (revisa al 03) | **Una: Sepolia.** Aqua y SwapVM redesplegados con su código oficial sin modificar; ENSv2 en su beta | Dos cadenas: Aqua en fork local + ENSv2 en Sepolia | La Wallet API de Ledger Live firma y transmite solo a redes que Ledger Live conoce; un fork de Anvil no lo es, Sepolia sí. Aqua no tiene despliegue en testnet. 1inch permite redesplegar |
| Estado propio de Moor | **Ninguno.** Todo vive en Aqua, SwapVM y ENS | Base de datos para posiciones o propuestas | Nada que guardar que no esté ya onchain, y cada dato fuera de la cadena es un dato que puede mentir |
| Repositorio | **Monorepo**: contratos, Live App, agente y paquetes compartidos | Repos separados | Un solo historial de commits (lo mira 1inch), tipos compartidos entre contratos y TypeScript, un solo `install` |

> **Sobre la revisión de cadena.** El [03](./03_bounties.md) decidió dos cadenas cuando aún no se había leído la Wallet API. Redesplegar en Sepolia cuesta: hay que correr los scripts de despliegue de Aqua y SwapVM, desplegar WBTC y USDC de prueba, y **no hay takers reales** — los fills de la demo los hace un bot nuestro. Pero en el fork también los haría: nadie va a esperar a que BTC caiga en la demo. Lo que se gana es que la Live App firma por el camino oficial y Clear Signing funciona sin trucos. **Plan B** si el redespliegue se complica: fork de Base con su `chainId` real, `transaction.sign` (sin broadcast) y transmitir nosotros al fork; frágil porque Ledger Live estima gas contra la Base real. Confirmar con los mentores de 1inch que un redespliegue sin modificar califica — está en pendientes.

Las tecnologías concretas (framework de la Live App, toolchain de contratos, runtime del agente) se deciden en el [06](./06_tecnologias.md).

---

## 2. Arquitectura

Una cadena, tres protocolos, dos procesos nuestros. Y una regla que atraviesa el dibujo: **solo la Ledger firma cosas que muevan capital o cambien permisos**.

```
┌─ Ledger Live ──────────────────────────────────────────────────────────┐
│  Live App de Moor  (Wallet API: account.list · transaction.signAndBroadcast) │
│  define · revisa · firma con Clear Signing (ERC-7730) · consulta       │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ firma: approve · ship · dock · createPosition · revokeRoles
                                 ▼
┌─ Sepolia ──────────────────────────────────────────────────────────────┐
│                                                                        │
│  Aqua (redesplegado)          SwapVM (redesplegado)                    │
│   ship(strategy) / dock()      AquaSwapVMRouter                        │
│   balances virtuales           programa: rango unidireccional           │
│   pull() / push() ◄───────────  quote() / swap()  ◄──── takers (bot demo)│
│                                                                        │
│  ENSv2 (beta oficial)                                                  │
│   salviega.eth                                                         │
│    └─ UserRegistry del holder  ──── MoorRegistrar (ROLE_REGISTRAR)     │
│        ├─ btc-dip.salviega.eth   records: moor.strategy… + moor.agent.* │
│        └─ agent.salviega.eth     addr: la llave del agente             │
│   PermissionedResolver del holder (roles por nombre y por clave)        │
│                                                                        │
└──────────▲──────────────────────────────────────────▲──────────────────┘
           │ lee: precio, balances, quotes            │ escribe: solo moor.agent.* (ROLE_SET_TEXT)
           │                                          │
   ┌───────┴──────────────────────────────────────────┴───────┐
   │  Agente  (proceso headless en un VPS)                     │
   │  secretos en Ledger Key Ring (wallet-cli ring)            │
   │  cada N minutos: lee → deriva estado → simula → propone   │
   │  nunca firma nada que no sea un setText en su subnombre   │
   └──────────────────────────────────────────────────────────┘
```

**Cómo se hablan.** El record `moor.strategy` del subnombre guarda `chainId:strategyHash`; con eso cualquier app resuelve el nombre y encuentra la posición en Aqua. La Live App lee Aqua para balances y estado, lee ENS para la lista de posiciones y las propuestas del agente, y es la única que construye transacciones para la Ledger. El agente lee lo mismo y escribe en un solo lugar.

**Qué no habla con qué.** El nombre describe la posición, no la controla: nada en ENS puede mover un token en Aqua. El agente no tiene ninguna ruta hacia `ship`/`dock` ni hacia los records de la posición. `MoorRegistrar` puede crear subnombres bajo el registry del holder y nada más — y ese permiso lo otorga el holder en la primera vez y lo puede revocar.

**Contratos propios.** Dos, pequeños:

- **`MoorRegistrar`** — sin estado ni dueño. `createPosition` (lo firma el holder): registra el subnombre en el `UserRegistry` del holder con `expiry` = vencimiento y sin `ROLE_CAN_TRANSFER_ADMIN`, y escribe `addr` y los records `moor.*` en el resolver del holder; rechaza claves que no empiecen por `moor.` o que sean `moor.agent.*`. `setupAgent` (una vez por holder): registra `agent.<holder>.eth`, le pone `addr` y otorga a la llave del agente `ROLE_SET_TEXT` sobre las ocho claves `moor.agent.*` en cualquier nombre del resolver. `revokeAgent`: las quita. Necesita `ROLE_REGISTRAR` en el registry y `ROLE_SET_TEXT | ROLE_SET_ADDR | ROLE_SET_TEXT_ADMIN` en el resolver, otorgados en la primera vez; solo actúa si `msg.sender` es root de ambos (Sepolia: `0xe6915D2E5e8Db86661a66472e5B178d0dB419966`, Sourcify `exact_match`).
- **`MoorProgramFactory`** (o una librería) — construye el bytecode del programa a partir de par, rango, fee y vencimiento, de forma determinista, para que la Live App, el agente y las pruebas produzcan el mismo programa y el mismo `strategyHash`.

Nada de Moor toca tokens. Nada de Moor es `maker` de nada.

---

## 3. Estructura del proyecto

Monorepo. Los nombres de carpeta son tentativos hasta el [06](./06_tecnologias.md); la división no.

```
moor/
├── spec/                      esta documentación
├── apps/
│   ├── live-app/              la Live App de Ledger Live (web)
│   └── agent/                 el agente headless
├── packages/
│   ├── contracts/             MoorRegistrar, MoorProgramFactory, despliegues de Aqua/SwapVM en Sepolia, pruebas
│   ├── core/                  TypeScript compartido: construir programa, derivar estado, leer/escribir records, direcciones
│   └── erc7730/               descriptores de Clear Signing: Aqua, SwapVM router, MoorRegistrar, resolver
├── manifest.json              manifiesto de la Live App para Ledger Live (modo desarrollador)
└── .github/workflows/         typecheck · lint · pruebas de contratos · build
```

`packages/core` existe para que **no haya dos implementaciones de "qué es una posición"**: la Live App y el agente derivan estado, construyen programas y leen records con el mismo código, y las pruebas de contratos verifican que el `strategyHash` que produce coincide con el de Solidity.

---

## 4. Dónde vive el estado

No hay base de datos. El [04](./04_diseno-de-solucion.md#3-modelo-de-datos) reparte cada campo; aquí, quién es la fuente de verdad de qué y qué se deriva.

| Dato | Fuente de verdad | Cómo se lee |
| --- | --- | --- |
| Lista de posiciones de un holder | Subnombres del `UserRegistry` del holder que tienen `moor.strategy` | Enumerar el registry (eventos `NameRegistered` o consulta directa) y resolver records |
| Parámetros de la posición | Records ENS (`moor.*`) y el programa en SwapVM | `resolver.text(node, key)`; el programa se decodifica con `packages/core` |
| Monto restante y convertido | Balances virtuales en Aqua | `aqua.safeBalances(maker, strategyHash, tokenIn, tokenOut)` |
| Fees acumulados | Diferencia entre balances virtuales y lo que un programa sin fee habría dejado | Derivado en `packages/core`, a partir de balances y trades (eventos `Pulled`/`Pushed`) |
| Estado (`esperando`… `cerrada`) | Derivado | Balances + precio + `_deadline` + existencia del nombre. Ver §6 |
| Lectura y propuesta del agente | Records `moor.agent.*` del subnombre del agente | `resolver.text` |
| Precio | Externo | Fuente por definir ([04 §8](./04_diseno-de-solucion.md#8-decisiones-tomadas-y-pendientes)). El agente escribe la que usó |

**Lo único efímero:** caché en memoria del agente entre ciclos, y estado de interfaz en la Live App. Ninguno de los dos es fuente de nada.

---

## 5. La regla que no puede fallar: solo la Ledger mueve capital, y la posición no se deshace sola

Dos invariantes, cada uno garantizado por el protocolo y no por código nuestro.

**a) Nadie más que la wallet del holder puede mover, comprometer o liberar su capital.**

- Aqua identifica al `maker` como `msg.sender` de `ship()`. Un contrato intermedio sería el maker y los tokens se pedirían a él, no al holder: por eso el holder llama a Aqua directamente y **no existe** ninguna función de Moor que haga `ship` o `dock`.
- La única `approve` es del holder hacia Aqua. Ni el agente ni los contratos de Moor tienen aprobación sobre ningún token.
- El agente no tiene rol alguno en el registry ni sobre los records de la posición (§7). Se comprueba con `hasRoles()`.

**b) Una posición de comprar nunca vende; una de vender nunca compra.**

Un rango de liquidez concentrada es, por naturaleza, bidireccional: si el precio entra, convierte; si sale por donde entró, deconvierte. Para Moor eso sería un defecto: el 04 promete que lo comprado se queda comprado. La dirección se cierra **en el programa**, con el control de flujo de SwapVM: `JumpIfTokenIn(tokenPermitido, 38)` salta al cuerpo solo cuando el taker trae el token que la posición compra; cualquier otro `tokenIn` cae en la instrucción siguiente, `Deadline(0)`, que revierte con `DeadlineReached(0)` — esa dirección venció en la época 0. Un taker que intente vendérselo de vuelta recibe un `quote` y un `swap` que **revierten**. Verificado el 5 de septiembre con el harness `CoreInvariants` de SwapVM (`test/MoorProgramInvariants.t.sol`) y en Sepolia.

**Cómo se verifica.** Pruebas de contratos que intentan lo prohibido y esperan que falle: `dock` desde el agente, `setText` sobre la posición desde el agente, `grantRoles` desde el agente, swap en dirección contraria. Y la prueba de dirección corre además contra `CoreInvariants` de SwapVM, porque un programa que rompe simetría exact-in/out se comporta raro con los takers reales.

> ~~**Riesgo declarado:** que `_jumpIfTokenIn` combinado con balances dinámicos no baste para cerrar la dirección sin romper invariantes.~~ **Cerrado el 5 de septiembre:** basta, y con margen — el programa pasa `CoreInvariants` en la dirección permitida. El plan B (`_limitSwap1D`) no hizo falta.

---

## 6. El cálculo central: estado y fees de una posición

Todo lo que la Live App y el agente muestran sale de cuatro lecturas y una función pura en `packages/core`.

**Entradas**

- `balIn`, `balOut` — balances virtuales en Aqua (`safeBalances`).
- `monto0` — monto inicial, del record `moor.range`/programa (o del evento `Shipped`).
- `precio` — fuente externa, el mismo que el agente escribe en `moor.agent.price`.
- `vence`, `precioMin`, `precioMax`, `side` — del programa / records.
- `existe` — el subnombre está registrado y no ha expirado; la estrategia no fue `dock`-eada.

**Derivación**

```
convertido  = 1 − balIn / monto0                      (0 si nada se ha operado)
enRango     = precioMin ≤ precio ≤ precioMax
estado      = !existe               → cerrada
              now > vence           → vencida
              convertido ≥ 1        → completada
              convertido > 0 || enRango → trabajando
              else                  → esperando
```

**Fees.** Aqua no separa fee de principal: el fee queda dentro del balance virtual. Se deriva reconstruyendo los trades desde los eventos `Pulled`/`Pushed` de la estrategia y comparando lo recibido con lo que habría dado la curva sin fee. `packages/core` lo hace en una función que también usan las pruebas de contratos, así que si el cálculo se desvía del contrato, falla una prueba.

**Precio para la interfaz.** Chainlink BTC/USD en Sepolia, por `readPrice()` de `packages/core` (decidido en la fase 3, [04 §8](./04_diseno-de-solucion.md#8-decisiones-tomadas-y-pendientes)); la Live App muestra el precio y de cuándo es. El panel del agente muestra además el precio que el agente escribió, con su hora, y lo marca si tiene más de una hora.

---

## 7. Autenticación y permisos

No hay cuentas ni sesiones: la identidad es la wallet, y **los permisos se hacen cumplir onchain**, en tres lugares.

### Aqua

| Quién | Puede | No puede |
| --- | --- | --- |
| **Holder** (maker, `msg.sender` de `ship`) | `approve`, `ship`, `dock` | — |
| **Takers** | `quote`, `swap` contra la posición dentro del rango y en la dirección permitida | Nada fuera del programa |
| **Agente** | Leer balances y quotes | `approve`, `ship`, `dock`. No es maker, no tiene aprobación |
| **Contratos de Moor** | Nada | No son maker de nada, no tienen aprobación |

### ENSv2 — Permissioned Registry (`UserRegistry` del holder, bajo `salviega.eth`)

| Rol | Quién lo tiene | Efecto |
| --- | --- | --- |
| `ROLE_REGISTRAR` | `MoorRegistrar` | Crea subnombres cuando el holder firma `createPosition` / `setupAgent` |
| `ROLE_UNREGISTER`, `ROLE_RENEW`, `ROLE_SET_RESOLVER` (+ sus admin) | Holder, sobre cada posición (`MoorRoles.NAME_OWNER`) | Da de baja el nombre al cerrar; renueva; cambia resolver |
| `ROLE_CAN_TRANSFER_ADMIN` | **Nadie** | La posición es **intransferible**: está atada a la wallet cuyos tokens usa Aqua |
| Roles root (`MoorRoles.HOLDER_REGISTRY_ROOT`, todos con sus admin) | Solo el holder | Nadie más puede delegar ni ampliar. Incluye revocar a `MoorRegistrar` (`revokeRootRoles`) |
| Cualquier rol | **Agente: ninguno** | — |

`expiry` del subnombre = `_deadline` del programa SwapVM. Cuando la estrategia vence, el nombre vence. El registry del holder es un proxy de `UserRegistryImpl` desplegado por `VerifiableFactory` (Sepolia, salviega: `0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922`, root = la cuenta Ledger `0xAA1a…62E1`, salt `keccak("moor", holder)`).

### ENSv2 — Permissioned Resolver (uno por holder)

Los recursos de EAC del `PermissionedResolver` son `keccak(namehash, keccak(clave))` para los text records —**por clave**, no por tipo— y `namehash = 0` significa *cualquier nombre del resolver* (`authorizeTextRoles(name, key, account, grant)`). Por eso el agente sí escribe en el nombre de la posición, pero solo en sus ocho claves, y no hace falta un subnombre por posición para el agente. El resolver sí es propio del holder —proxy de `PermissionedResolverImpl` vía `VerifiableFactory`, root = holder (`DeployResolver.s.sol`)—: el que app.ens.dev crea al registrar el nombre conserva su root en la wallet que registró aunque el nombre se transfiera ([feedback/02_ens](../feedback/02_ens.md)).

| Recurso | Rol | Quién |
| --- | --- | --- |
| root del resolver | `ROLE_SET_TEXT`, `ROLE_SET_ADDR`, `ROLE_SET_TEXT_ADMIN` (`MoorRoles.REGISTRAR_ON_RESOLVER`) | `MoorRegistrar`: escribe `addr` y `moor.*` en `createPosition`, otorga y revoca las claves del agente |
| root del resolver · todos los roles de records y sus admin (`MoorRoles.HOLDER_RESOLVER_ROOT`) | — | Holder, desde `initialize` |
| `(cualquier nombre, moor.agent.checkedAt)` … `(cualquier nombre, moor.agent.simulation)` — ocho recursos | `ROLE_SET_TEXT` | Agente (llave caliente, custodiada en Key Ring) |
| `(btc-dip.salviega.eth, moor.strategy)` y cualquier otra clave, `addr`, `contenthash`, alias, clear | — | **Agente: ninguno** |

**Verificable:** `resolver.hasRoles(resource, ROLE_SET_TEXT, agente)` es `true` exactamente para los ocho recursos que devuelve `agentResources()` de `packages/core` y `false` para cualquier otro; `hasRootRoles` es `false` para el agente en registry y resolver. Un juez lo comprueba con `cast call` sin creernos.

**Kill switch:** `MoorRegistrar.revokeAgent(resolver, agente)` firmado en la Ledger (o `authorizeTextRoles(..., false)` directo en el resolver). EAC es reversible, así que el agente queda mudo sin tocar la posición. Lo mismo aplica a `MoorRegistrar`: el holder puede revocarle `ROLE_REGISTRAR` en el registry y sus roles en el resolver, y Moor deja de poder crear posiciones bajo su nombre.

### Ledger

- Todo lo anterior lo firma el holder en el dispositivo, vía Wallet API (`transaction.signAndBroadcast`) desde la Live App.
- **Clear Signing** requiere un descriptor **ERC-7730** por contrato y función que el holder firme: `approve` (estándar), `Aqua.ship`/`dock`, `MoorRegistrar.createPosition`/`setupAgent`/`revokeAgent`, `PermissionedRegistry.setSubregistry`/`grantRootRoles`/`revokeRootRoles`/`unregister`, `PermissionedResolver.grantRootRoles`/`revokeRootRoles`/`authorizeTextRoles` — los tres archivos de `packages/erc7730/descriptors/`. Sin descriptor, la Ledger muestra blind signing.
- La llave del agente **no es una Ledger** y no debe serlo: firma `setText` cada pocos minutos sin humano. Lo que sí es Ledger es la custodia de esa llave y de los demás secretos del agente, en Key Ring.

---

## 8. Trabajos automáticos

| Proceso | Cada cuánto | Qué hace | Si falla |
| --- | --- | --- | --- |
| **Agente** | Cada 5 minutos (`AGENT_INTERVAL_SECONDS`, 300) | Lee precio (Chainlink) y balances de cada posición del holder, deriva estado, escribe las ocho `moor.agent.*` en **un** `multicall` de `setText` por posición; si un umbral se cruza, simula las alternativas en código y pide a Claude que elija — una llamada por propuesta; sin `ANTHROPIC_API_KEY`, la propuesta determinista | **Nada se rompe.** La posición sigue operando. La Live App ve `checkedAt` viejo y lo dice como aviso |
| **Taker de demo** | Solo durante la demo | Ejecuta `swap` contra la posición dentro del rango para mostrar fills y fees onchain | Sin él no hay fills en Sepolia (no hay takers reales). Es infraestructura de demo, no de producto |
| **Vencimiento** | Onchain, sin proceso | `_deadline` deja de aceptar swaps; `expiry` deja el nombre disponible | No puede fallar: lo hace el protocolo |

El agente es **idempotente y sin memoria obligatoria**: cada ciclo parte de leer la cadena. Si se reinicia, no pierde nada que importe.

---

## 9. Costos

Para el hackathon y para la demo; no hay modelo de negocio en esta versión.

| Concepto | Costo | Nota |
| --- | --- | --- |
| Gas en Sepolia | 0 | Faucets. Redesplegar Aqua + SwapVM + tokens de prueba + contratos propios es la partida grande de ETH de prueba: pedirlo con anticipación |
| RPC Sepolia | 0 | Plan gratuito de cualquier proveedor alcanza para un agente cada 5 min y una Live App |
| VPS del agente | ~5 USD/mes | O un host gratuito; lo que importa es que sea headless y que Key Ring esté enrolado ahí |
| Modelo de IA del agente | Variable, bajo | Una llamada por ciclo con propuesta, no por ciclo. Se decide en el [06](./06_tecnologias.md) |
| Nombre `salviega.eth` en ENSv2 Sepolia | 0 | Registro de prueba |
| Ledger | Ya se tiene | Un dispositivo para la demo; Ledger Live en modo desarrollador |

---

## 10. Riesgos técnicos

Ordenados por cuánto daño hacen si se materializan.

| Riesgo | Qué pasa | Qué se hace |
| --- | --- | --- |
| ~~**La dirección no se puede cerrar en el programa** (§5b)~~ **Cerrado el 5 sep:** `JumpIfTokenIn` + trampa `Deadline(0)`, `CoreInvariants` en verde, verificado en Sepolia | — | Sin plan B necesario |
| ~~**Redesplegar Aqua/SwapVM en Sepolia se complica**~~ **Cerrado el 5 sep:** desplegados y verificados en Sourcify con `exact_match` | — | Sin plan B necesario |
| **1inch no acepta el redespliegue como "oficial"** | Descalifica el track de 1inch | Preguntar a los mentores en los primeros días, con la regla ("redeployments allowed") en la mano |
| **Clear Signing con descriptores no publicados** | La Ledger muestra blind signing en la demo | *Cerrado en fase 3, mitad y mitad:* Speculos sí muestra la pantalla exacta de cada firma con nuestros descriptores (`ledger:screens`, cinco de seis clear-signed, capturas en el repo); la Flex real sigue en blind signing porque Ledger Live solo acepta descriptores del registro. La Live App muestra en *Review & sign* lo que la Ledger mostraría ("Ledger shows: …") y es transparente al respecto |
| **ENSv2 beta cambia o se cae** | Nombres o roles fallan en la demo | Fijar direcciones y ABI a una fecha; grabar la demo en video además del vivo (lo pide ENS igual) |
| ~~**La Wallet API no expone lo que hace falta** (p. ej. `data` arbitrario en Sepolia)~~ **Cerrado el 5 sep:** `signAndBroadcast` con `data` a `TestToken.mint` desde Ledger Live, [`0x3160e91f…`](https://sepolia.etherscan.io/tx/0x3160e91f23a196f60c8dc8092c5e062ef9d97a399cd88d9a5c918c974321f392) | — | Sin plan B necesario |
| **Sin takers, no hay fills** | Demo sin ejecución onchain | El taker de demo (§8) es tarea de fase 1, no un extra |
| **Tiempo** | Lo de siempre | El [07](./07_plan-de-trabajo.md) recorta desde atrás: primero cae el stretch de opcodes, luego las propuestas simuladas, nunca la firma ni los permisos |

---

## 11. Pendientes

- **Confirmar con 1inch** que Aqua y SwapVM redesplegados sin modificar en Sepolia califican como "official contracts".
- ~~Verificar que Ledger Live acepta descriptores ERC-7730 locales en modo desarrollador, y cómo se cargan.~~ No los acepta: el dispositivo exige descriptores del registro de Ledger. Lo que sí existe es el *clear-signing tester* (`device-sdk-ts`), que los inyecta en Speculos — es lo que corre `ledger:screens` (fase 3). En la Flex real la demo firma a ciegas hasta que el registro los publique.
- ~~Fuente de precio (compartida con el 04).~~ Chainlink BTC/USD, fase 3.
- Cadencia del agente y umbrales de propuesta (compartido con el 04).
- ~~Cómo enumera la Live App los subnombres de un `UserRegistry`.~~ Cerrado en la fase 2: el evento `LabelRegistered(tokenId, labelHash, label, owner, expiry, sender)` del registry del holder lleva el label en claro; `listPositions()` en `packages/core` hace un `eth_getLogs` desde el bloque de creación del registry (salviega: 11642925) y filtra `sender == MoorRegistrar`, menos `agent`. Sin indexador.

**Direcciones ENSv2 en Sepolia** (de la tabla oficial de despliegues, a fijar en `packages/core`):

| Contrato | Dirección |
| --- | --- |
| `ETHRegistry` | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| `RootRegistry` | `0x8115186e8f2e0b0281e86ab91f0f48ba90364354` |
| `ETHRegistrar` | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` |
| `VerifiableFactory` | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` |
| `UserRegistryImpl` | `0x624a25d67b59d587752ebec8dded8827dae52050` |
| `PermissionedResolverImpl` | `0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e` |
| `UniversalResolverV2` | `0x4a1817d13e9cf196f471725176355c1234b63c70` |
| **`MoorRegistrar`** (fase 2, Sourcify `exact_match`) | `0xe6915D2E5e8Db86661a66472e5B178d0dB419966` |
| Registry de `salviega.eth` (proxy `UserRegistryImpl`, root = holder Ledger `0xAA1aEf44DDE610F433f271C6A8749139DD5162E1`) | `0xE924f689Ee48B43F7D1c5Ac683E9f4648f553922` |
| Resolver de `salviega.eth` (proxy `PermissionedResolverImpl`, root = holder Ledger) | `0x694A2f963164C152A23b91Ef0DE53FE9B02aE1E3` |
| Resolver anterior de app.ens.dev (root = `0xd7A4…`, sin uso) | `0xc93Ad19307813019b9595147823b035DD93ce363` |

Aqua y SwapVM: las direcciones canónicas de producción (`0x1111113ccf1426a8e30e2bff5e005d929bf6a90a`, `0x111111338c5091E8440b67B168bAe16a668AC0De`) **no aplican en Sepolia**. Las nuestras, del redespliegue del 5 de septiembre: Aqua `0xB8747B3e2F90154420165FB2fc4707D638797140` (Sourcify `exact_match`), `AquaSwapVMRouter` `0xdD026eA05C9256A1162dC3d41102579458A804Cd`, `TestWETH` `0x10C5026152eB4f79119d6cFb75205aEB6E98dfA0`, `tWBTC` `0xfA92A297eC2cCC8Ec010ACa475F07240e2D47deC`, `tUSDC` `0x274aaB610937e018310cCedC0b05B543b75557AB` — fuente de verdad en `packages/core/src/addresses.ts`.
