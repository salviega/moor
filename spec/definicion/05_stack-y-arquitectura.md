# 05 — Stack y arquitectura

> **Alcance de este documento:** cómo se construye — decisiones técnicas, dónde vive el estado, permisos, costos y riesgos. **No repite el diseño de producto.**
> **Depende de:** [03 — Bounties](./03_bounties.md) · [04 — Diseño de la solución](./04_diseno-de-solucion.md)

---

## 1. Decisiones

Cada una con lo que se descartó y por qué. Las cuatro primeras vienen del [03](./03_bounties.md#decisiones); la quinta lo revisa.

| Decisión | Se elige | Se descarta | Por qué |
| --- | --- | --- | --- |
| Motor de la posición | **SwapVM** sobre Aqua: `AquaSwapVMRouter`, `useAquaInsteadOfSignature = true` | `AquaApp` propio compuesto con la SDK de Aqua | La SDK solo codifica `ship`/`dock`; la lógica exigía un AMM en Solidity. SwapVM ya es un `AquaApp` y puntúa más |
| Programa | Liquidez concentrada **unidireccional**: `_dynamicBalancesXD` → salto por `tokenIn` → `_xycConcentrateGrowLiquidityXD` → fee → `_deadline` | Range order bidireccional | Un rango bidireccional vende de vuelta si el precio regresa. El salto condicional por token de entrada cierra la dirección contraria (ver §5) |
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
│        ├─ btc-dip.salviega.eth        records: moor.strategy, moor.program… │
│        └─ agent.btc-dip.salviega.eth  records: moor.agent.*            │
│   PermissionedResolver del holder (roles por nombre y tipo de record)   │
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

- **`MoorRegistrar`** — llamado por el holder en `createPosition`. Registra el subnombre en el `UserRegistry` del holder, escribe los records de la posición en su resolver, registra `agent.<label>` y le otorga a la llave del agente `ROLE_SET_TEXT` sobre ese recurso. Necesita `ROLE_REGISTRAR` en el registry y los roles de escritura de records (con sus admin) en el resolver del holder, otorgados en la primera vez.
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

Un rango de liquidez concentrada es, por naturaleza, bidireccional: si el precio entra, convierte; si sale por donde entró, deconvierte. Para Moor eso sería un defecto: el 04 promete que lo comprado se queda comprado. La dirección se cierra **en el programa**, con el control de flujo de SwapVM: la instrucción de salto por token de entrada (`_jumpIfTokenIn`) desvía a un final sin swap cualquier trade cuyo `tokenIn` sea el token que la posición está comprando. Un taker que intente vendérselo de vuelta recibe una `quote` de cero y un `swap` que revierte.

**Cómo se verifica.** Pruebas de contratos que intentan lo prohibido y esperan que falle: `dock` desde el agente, `setText` sobre la posición desde el agente, `grantRoles` desde el agente, swap en dirección contraria. Y la prueba de dirección corre además contra `CoreInvariants` de SwapVM, porque un programa que rompe simetría exact-in/out se comporta raro con los takers reales.

> **Riesgo declarado:** que `_jumpIfTokenIn` combinado con balances dinámicos no baste para cerrar la dirección sin romper invariantes es la **primera cosa que se verifica en la fase 1**. Si no se puede, el plan B es un programa 1D con `_limitSwap1D` + `_invalidateTokenOut1D` — una orden límite pura, unidireccional por construcción, que cobra fee solo al llenarse — y el "trabaja mientras espera" del 02 se recorta honestamente a eso.

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

**Precio para la interfaz.** Mientras no se decida la fuente ([04 §8](./04_diseno-de-solucion.md#8-decisiones-tomadas-y-pendientes)), la Live App usa el último precio escrito por el agente y dice de cuándo es. Si tiene más de una hora, lo marca.

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
| `ROLE_REGISTRAR`, `ROLE_RENEW` | `MoorRegistrar` | Crea y renueva subnombres cuando el holder firma `createPosition` |
| `ROLE_UNREGISTER`, `ROLE_SET_RESOLVER` | Holder, sobre cada posición | Da de baja el nombre al cerrar; cambia resolver |
| `ROLE_CAN_TRANSFER_ADMIN` | **Nadie** | La posición es **intransferible**: está atada a la wallet cuyos tokens usa Aqua |
| Roles admin (`role << 128`) | Solo el holder | Nadie más puede delegar ni ampliar. Incluye revocar a `MoorRegistrar` |
| Cualquier rol | **Agente: ninguno** | — |

`expiry` del subnombre = `_deadline` del programa SwapVM. Cuando la estrategia vence, el nombre vence.

### ENSv2 — Permissioned Resolver (una instancia por holder)

Los recursos de EAC son `namehash + tipo de record`, no por clave. Por eso el agente **no** escribe en el nombre de la posición: si tuviera `ROLE_SET_TEXT` ahí para `moor.agent.proposal`, también podría pisar `moor.strategy`.

| Recurso | Rol | Quién |
| --- | --- | --- |
| `btc-dip.salviega.eth` · text / addr / contenthash | Todos | Holder; `MoorRegistrar` solo en `createPosition` (con roles otorgados en la primera vez) |
| `btc-dip.salviega.eth` · cualquiera | — | **Agente: ninguno** |
| `agent.btc-dip.salviega.eth` · text | `ROLE_SET_TEXT` | Agente (llave caliente, custodiada en Key Ring) |
| `agent.btc-dip.salviega.eth` · addr / contenthash / alias / clear | — | Agente: ninguno |

**Verificable:** `hasRoles(resource, roleBitmap, agente)` devuelve `false` para todo lo que no sea el text del subnombre del agente. Un juez lo comprueba sin creernos.

**Kill switch:** `revokeRoles(...)` firmado en la Ledger. EAC es reversible, así que el agente queda mudo sin tocar la posición. Lo mismo aplica a `MoorRegistrar`: el holder puede revocarle `ROLE_REGISTRAR` y Moor deja de poder crear posiciones bajo su nombre.

### Ledger

- Todo lo anterior lo firma el holder en el dispositivo, vía Wallet API (`transaction.signAndBroadcast`) desde la Live App.
- **Clear Signing** requiere un descriptor **ERC-7730** por contrato y función que el holder firme: `approve` (estándar), `Aqua.ship`/`dock`, `MoorRegistrar.createPosition`, `PermissionedRegistry.revokeRoles`, `PermissionedResolver.revokeRoles`. Sin descriptor, la Ledger muestra blind signing.
- La llave del agente **no es una Ledger** y no debe serlo: firma `setText` cada pocos minutos sin humano. Lo que sí es Ledger es la custodia de esa llave y de los demás secretos del agente, en Key Ring.

---

## 8. Trabajos automáticos

| Proceso | Cada cuánto | Qué hace | Si falla |
| --- | --- | --- | --- |
| **Agente** | Cada 5 minutos (por confirmar) | Lee precio y balances de cada posición del holder, deriva estado, escribe `moor.agent.*`; si un umbral se cruza, simula y escribe propuesta | **Nada se rompe.** La posición sigue operando. La Live App ve `checkedAt` viejo y lo dice como aviso |
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
| **La dirección no se puede cerrar en el programa** (§5b) | La posición deconvierte si el precio regresa; el 04 promete lo contrario | Verificar en fase 1, primero. Plan B: `_limitSwap1D` + invalidador — orden límite pura, y recortar el "trabaja mientras espera" |
| **Redesplegar Aqua/SwapVM en Sepolia se complica** | Sin motor de posición | Plan B: fork de Base con `chainId` real + `transaction.sign` y broadcast propio. Frágil pero funcional. Empezar el redespliegue en fase 0 |
| **1inch no acepta el redespliegue como "oficial"** | Descalifica el track de 1inch | Preguntar a los mentores en los primeros días, con la regla ("redeployments allowed") en la mano |
| **Clear Signing con descriptores no publicados** | La Ledger muestra blind signing en la demo | Verificar en fase 0 que Ledger Live en modo desarrollador acepta descriptores ERC-7730 locales, y usar **Speculos** para ver la pantalla exacta de cada firma sin depender del dispositivo. Si no, plan B: mostrar el descriptor y la simulación en la Live App y ser transparentes |
| **ENSv2 beta cambia o se cae** | Nombres o roles fallan en la demo | Fijar direcciones y ABI a una fecha; grabar la demo en video además del vivo (lo pide ENS igual) |
| **La Wallet API no expone lo que hace falta** (p. ej. `data` arbitrario en Sepolia) | La Live App no puede firmar `ship` | Probar en fase 0 con una transacción real a un contrato en Sepolia. Plan B: firma vía WebHID (DMK) fuera de la Live App |
| **Sin takers, no hay fills** | Demo sin ejecución onchain | El taker de demo (§8) es tarea de fase 1, no un extra |
| **Tiempo** | Lo de siempre | El [07](./07_plan-de-trabajo.md) recorta desde atrás: primero cae el stretch de opcodes, luego las propuestas simuladas, nunca la firma ni los permisos |

---

## 11. Pendientes

- **Confirmar con 1inch** que Aqua y SwapVM redesplegados sin modificar en Sepolia califican como "official contracts".
- Verificar que Ledger Live acepta descriptores ERC-7730 locales en modo desarrollador, y cómo se cargan.
- Fuente de precio (compartida con el 04).
- Cadencia del agente y umbrales de propuesta (compartido con el 04).
- Cómo enumera la Live App los subnombres de un `UserRegistry`: eventos, `UniversalResolverV2`, o un índice mínimo en `packages/core`.

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

Aqua y SwapVM: las direcciones canónicas de producción (`0x1111113ccf1426a8e30e2bff5e005d929bf6a90a`, `0x111111338c5091E8440b67B168bAe16a668AC0De`) **no aplican en Sepolia**; las nuestras salen del redespliegue en fase 0.
