# 08 — Roadmap

> **Alcance de este documento:** lo que Moor **no** hace en este hackathon y sí debería hacer después — qué, por qué, qué exige construir y en qué orden. **No es una promesa; es una lista ordenada de las siguientes apuestas.**
> **Depende de:** [04 — Diseño de la solución](./04_diseno-de-solucion.md) · [05 — Stack y arquitectura](./05_stack-y-arquitectura.md) · [07 — Plan de trabajo](./07_plan-de-trabajo.md)

---

## Marco

La primera versión deja **dos limitaciones honestas** escritas en el [04](./04_diseno-de-solucion.md):

1. **La posición cobra fees solo dentro de su rango.** Si el mercado se aleja, se queda quieta. "Trabaja mientras espera" es tan cierto como ancho sea el rango.
2. **Solo existe dentro de Ledger Live.** El holder que usa otra wallet, un Safe o una smart account no puede usar Moor.

Y una tercera que es de mercado, no de diseño: **en Sepolia no hay takers reales.** La posición se llena porque nosotros la llenamos.

Las tres se resuelven en la misma dirección — más autonomía dentro de límites firmados, más superficies, producción real — y las tres chocan, cada una a su manera, con la regla que hace a Moor lo que es: **el agente propone, la Ledger decide.** Este documento es en buena parte el registro de cómo mantener esa regla mientras se relaja lo demás.

---

## 1. La posición que se mantiene en rango

**El problema.** El holder pone un rango de 58k a 62k con BTC en 100k. BTC sube a 120k. La posición no hace nada durante meses: no cobra fees, no compra, no sirve. El agente lo ve, lo escribe en su subnombre, propone "mueve el rango a 70k–75k"… y si el holder no abre Ledger Live, nadie lo hace.

Tres formas de resolverlo, de menos a más autonomía. **No son excluyentes** y conviene hacerlas en este orden.

### 1a. El rango que sigue al precio — en el programa, sin agente

En vez de un rango en precios absolutos, un rango **relativo a un oráculo**: "compra entre −5 % y −10 % del precio actual". El programa lo recalcula en cada `quote`; el rango se mueve con el mercado **por construcción**, sin firma, sin agente, sin delegar nada. SwapVM ya tiene la pieza para el caso 1D (`_oraclePriceAdjuster1D`, integración con feed externo); para el rango concentrado XD haría falta **un opcode propio** — que es justo el stretch que 1inch puntúa más alto.

- **Qué cambia para el holder:** elige entre "dip a un precio" (v1) y "dip relativo al mercado" (nuevo). Son estrategias distintas: la segunda compra en cualquier caída del 5 %, no en el 58k que tenía en mente. La interfaz lo dice.
- **Qué exige:** opcode `_oracleAnchoredRangeXD` (o nombre similar) probado contra `CoreInvariants`; feed de precio confiable en la cadena de destino; descriptor ERC-7730 nuevo.
- **Qué no toca:** ni el agente, ni los permisos, ni la regla. Es la solución **más Moor**: programable, no delegada.
- **Tamaño:** mediano. Es el primer candidato para el segundo hackathon si 1inch vuelve a estar.

### 1b. Re-ranging con política firmada una vez — el agente actúa dentro de límites

El holder firma, al crear la posición, **una política** y no una acción: "el agente puede mover el rango, dentro de ±X % del precio, como máximo N veces al mes, con al menos H horas entre movimientos, **sin cambiar par ni monto**". La Ledger muestra esos límites con Clear Signing. A partir de ahí el agente detecta la salida del rango, calcula un rango nuevo (volatilidad reciente, distancia al precio, lo que aprenda), lo simula y **lo ejecuta** si cabe en la política. Si no cabe, propone, como hoy.

La regla no se rompe: se sube un nivel. **La Ledger decide la política; el agente decide dentro de ella.** Y el holder puede revocar la política con una firma, igual que hoy revoca al agente.

- **El obstáculo técnico es Aqua:** `ship` es inmutable y el maker es `msg.sender`. Re-rangear es `dock` + `ship` **desde la wallet del holder**. Un EOA no puede delegar eso. Hace falta que la cuenta del holder sea programable:
  - **EIP-7702:** el EOA de la Ledger delega temporalmente su código a un contrato de Moor (`MoorAccountPolicy`) que acepta `dock`+`ship` firmados por la llave del agente **solo si** los parámetros cumplen la política guardada. La Ledger firma la delegación y la política; nada más.
  - **Smart account (ERC-4337) con módulo de permisos** (estilo ERC-7715 / session keys): el mismo módulo de política, como módulo de la cuenta. Es el mismo diseño con otra cuenta; conviene construir el módulo una vez y montarlo en las dos.
- **Qué exige:** `MoorAccountPolicy` (contrato + auditoría, porque ahora sí toca capital dentro de límites); soporte de 7702 en Ledger (confirmar); el agente pasa de escribir `setText` a enviar transacciones, con simulación previa obligatoria y cooldown; un **eval** del agente: backtest de sus decisiones de re-ranging contra precio histórico, para no lanzar un agente que "optimiza" perdiendo dinero.
- **Qué gana Moor:** el "trabaja mientras espera" se vuelve verdad sin comillas, y el track de Ledger de "agentes con capacidades acotadas" queda cubierto de forma literal.
- **Tamaño:** grande. Es **el** feature del segundo hackathon, y comparte cimientos con la sección 2 (cuentas programables).

### 1c. Propuesta con un toque — mientras tanto

Sin cambiar nada de lo anterior: cuando el agente propone, el holder recibe una **notificación** (Ledger Live móvil, correo, Telegram) y aceptar es abrir y tocar una vez. No resuelve el problema; reduce el tiempo que la posición pasa fuera de rango de "hasta que me acuerde" a "hasta que vea el teléfono".

- **Qué exige:** un canal de notificación, que hoy no existe (ver 3.3), y que la Live App abra directo en la propuesta.
- **Tamaño:** pequeño. Puede ir antes que 1a.

### Sobre la inteligencia del agente

El agente de v1 es determinista con una llamada al modelo cuando cruza un umbral. Para 1b necesita más criterio: **cuándo** mover (no en cada vela), **a dónde** (rango que maximice probabilidad de fill × fee, no el más cercano), y **cuándo no** (mercado en pánico: quedarse quieto). Eso es un problema de evaluación antes que de modelo: construir el conjunto de escenarios históricos, medir cada política, y solo entonces dejarlo actuar. La regla del 04 se mantiene: **el agente nunca amplía la exposición más allá de lo firmado**, ni con la mejor razón del mundo.

---

## 2. Más allá de Ledger Live: cualquier EOA, Safe, smart accounts

**Hoy:** la Live App vive dentro de Ledger Live, y la Wallet API le da cuenta y firma. Fuera de ahí, Moor no existe. Cada superficie nueva es la misma pregunta: **¿quién es el maker y cómo firma?**

### 2.1 Web independiente para cualquier EOA

La misma app Next.js servida fuera de Ledger Live, con una **capa de firmante intercambiable**: `SignerAdapter { getAccount(); sign(tx) }` con tres implementaciones — Wallet API (Ledger Live, la de hoy), **wagmi/viem** (MetaMask, Rabby, WalletConnect) y **Ledger por WebHID** (Device Management Kit) para quien tiene Ledger pero no usa Ledger Live, conservando Clear Signing.

- **Qué cambia:** `packages/core` nada. La Live App gana un adaptador y una pantalla de conexión que dentro de Ledger Live no existe. `apps/live-app` pasa a ser `apps/web` con dos modos, o dos apps sobre el mismo core.
- **Qué exige:** wagmi, un conector de WalletConnect (proyecto y llave), el DMK para WebHID, y aceptar que sin Ledger **no hay Clear Signing**: el usuario de MetaMask firma calldata con simulación en pantalla. Se dice claro.
- **Tamaño:** mediano.

### 2.2 Safe (multisig)

El maker es la dirección del Safe. `approve`, `ship`, `dock` y `createPosition` son transacciones del Safe que requieren N de M firmas; `msg.sender` es el Safe, así que Aqua funciona sin tocar nada. En ENS, el Safe es dueño del nombre y del registry.

Y aquí pasa algo bonito: **"el agente propone" se vuelve literal.** El agente puede crear una **transacción pendiente en el Safe** (vía Safe Transaction Service) con el re-range propuesto. No la puede firmar. Los firmantes la ven en su cola, con simulación, y deciden. La regla del 04 se cumple sin ningún contrato nuevo — la multisig **es** el humano en el loop.

- **Forma natural:** una **Safe App** — iframe dentro de la interfaz de Safe, igual que la Live App dentro de Ledger Live. El mismo patrón, otro host. `SignerAdapter` para Safe Apps SDK.
- **Qué exige:** Safe Apps SDK; integración con el Transaction Service (propuestas, estado, firmas) — eso es un **backend mínimo** o llamadas desde el cliente con la API de Safe; que el agente tenga una llave *proponente* registrada como delegado del Safe (Safe lo soporta) — un permiso más acotado todavía que el de v1.
- **Tamaño:** mediano-grande. Es la vía más directa a **tesorerías y DAOs**, que son los holders con más capital improductivo.

### 2.3 Smart accounts y EIP-7702

Es el cimiento de 1b y además resuelve una deuda de v1: **las dos o tres firmas de la sesión de creación se vuelven una** (`approve` + `ship` + `createPosition` en un solo batch). Con 7702, el EOA de la Ledger sigue siendo el EOA de la Ledger; solo gana la capacidad de ejecutar un batch y, si el holder quiere, una política.

- **Qué exige:** `MoorAccountPolicy` como módulo (ver 1b); soporte de 7702 en la Ledger y en la Wallet API (confirmar); descriptores ERC-7730 para la delegación, que es lo más delicado que un usuario firma.
- **Tamaño:** grande, compartido con 1b. **Se construye una vez.**

**Lo que se sabe desde el 6 de septiembre** (sonda en Speculos + revisión de [Streams](https://github.com/JulioMCruz/Streams), que firmó 7702 en esta misma Flex):

- *La Ledger sí, comprobado en la Flex física ese mismo día:* la app de Ethereum firma la delegación (clear, hardcodeada: "Delegate to Simple7702Account · Sepolia") y la transacción tipo 4 que la lleva ([`0xedec5af4…`](https://sepolia.etherscan.io/tx/0xedec5af4b36d7f073f63c0cafb1386d9553a00fb8ec9e5bb369977615a4f938f)), con "smart account upgrade" activado en sus ajustes. **Solo acepta un delegado**, `Simple7702Account` de eth-infinitism (`0x4Cd241E8d1510e30b2076397afc7508Ae59C66c9`, mismo bytecode en Sepolia y Base). Su batch es `executeBatch((address,uint256,bytes)[])`. Y la cuenta del holder, ya delegada, abrió y nombró una posición **con una sola firma**: `one-sig-1.salviega.eth`, [`0xe4a7fdea…`](https://sepolia.etherscan.io/tx/0xe4a7fdea0a2d7565efafffb5db24de991adb5cf035190105ede47c52c0f46c2c), 957 608 gas, todo o nada.
- *La Wallet API no:* la 2.0.0 no expone ni la autorización ni tipo 4, y dentro de Ledger Live no hay WebHID. La delegación tiene que firmarse **una vez, fuera de Ledger Live**, con el DMK (`apps/probe-7702`). Después, cada flujo es una transacción **normal** a la propia dirección del holder — `to: holder, data: executeBatch([...])` — que la Wallet API sí firma. `packages/core/src/batch.ts` (`delegateOf`, `batchCall`) ya la construye.
- *La pantalla, en Speculos, sí:* con un descriptor para `executeBatch` que usa el formato `calldata` anidado de ERC-7730, la app 1.22.3 muestra "Review transaction 1 of 2 / 2 of 2" y renderiza cada llamada con los descriptores de `ship` y `createPosition` existentes. Capturas en `packages/erc7730/screens/batch7702Nested/`; el detalle en [`feedback/03_ledger.md`](../feedback/03_ledger.md).
- *En el dispositivo real, hoy, a ciegas — y no por Moor:* `pnpm --filter @moor/probe-7702 cal` pregunta a los servidores de Ledger, con el mismo `ContextModule` del signer, qué recibiría la app: **ningún descriptor** para Aqua ni MoorRegistrar (esperado: no están en el registro) y **ninguno para `Simple7702Account`** en Sepolia, mainnet ni Base. Ledger acepta un único delegado y no describe su `executeBatch` en ninguna red, así que cualquier batch 7702 firmado con una Ledger es ciego por construcción. La incógnita de si el metadata service resuelve el delegado detrás de una EOA (`ProxyContextFieldLoader`, firmado con su PKI) sigue abierta, pero queda **detrás** de ese paso.
- *Lo que desbloquea el camino es el registro, y lo empujamos el 7 de septiembre:* dos PRs a `ethereum/clear-signing-erc7730-registry`, una entidad por PR como exige el registro — [#2953](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2953) (`MoorRegistrar` + Aqua en Sepolia) y [#2954](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2954) (`Simple7702Account`: `execute` y `executeBatch` con `calldata` anidado, útil para cualquier dApp que use el delegado de Ledger). Publicados, la sesión de una firma se ve en palabras en cualquier Flex; hasta entonces, la evidencia vive en Speculos.
- *La Live App ya sabe firmar así* (`sessionCalls` en `packages/core/src/batch.ts`): si el código de la cuenta es `0xef0100‖Simple7702Account` y la sesión tiene más de una llamada, firma **un** `executeBatch` a su propia dirección — por la Wallet API, como siempre; si no, exactamente como antes. La app lee el código de la cuenta y nunca delega: el opt-in es del holder, en cadena, desde `apps/probe-7702`. Queda para después del hackathon llevar ese paso único dentro del producto (y decidir si se ofrece), y `MoorAccountPolicy` (1b).
- *Lo que cambia si entra:* la cuenta del holder pasa a ser una smart account 4337 permanente (ERC-1271, ejecución por EntryPoint — ambas exigen igual su firma; el kill switch es des-delegar a `0x0`); `AGENTS.md` gana una excepción explícita a "Wallet API y nada más" para el paso único; y la atomicidad se vuelve gratis: un `createPosition` que falla ya no deja una posición abierta sin nombre.

### 2.4 Lo que la expansión obliga a construir

Cosas que en v1 no existen porque un solo holder dentro de Ledger Live no las necesita:

| Necesidad | Por qué aparece | Qué es |
| --- | --- | --- |
| **Indexador de posiciones** | Enumerar subnombres de un registry por eventos no escala a miles de holders ni sirve para "todas las posiciones de Moor" | Un servicio que sigue eventos de los registries y de Aqua y expone una API de lectura. Primer **backend** real de Moor |
| **Secretos del agente en Ledger Key Ring** | En v1 la llave caliente la custodia Supabase. El track de Ledger destaca *Key Ring en hosts sin USB*, pero el enrolamiento de un segundo host no está documentado ([feedback](../feedback/03_ledger.md)) | Un host propio enrolado en el trustchain de la Ledger del holder, arrancando el ciclo con `wallet-cli ring decrypt`. v1 lo tuvo escrito (`run.sh` + systemd, retirados el 6 sep — están en el historial) |
| **Agente multi-tenant** | Un proceso por holder con Key Ring de *su* Ledger no escala; Key Ring es por seed | O el holder corre su propio agente (Moor lo empaqueta), o Moor opera uno hospedado con otro modelo de secretos (KMS, enrolamiento por holder). Decisión de producto, no solo técnica |
| **Notificaciones** | 1c y toda la expansión | Canal push/correo/Telegram; el agente lo dispara |
| **`MoorRegistrar` para dueños no-EOA** | Safe y smart accounts como dueños de nombre y posición | Ya es agnóstico a la dirección; hay que probarlo con cuentas contrato y ajustar el flujo de primera vez |
| **Posiciones bajo `moor.eth`** | Holders sin nombre ENS (descartado en [04 §7](./04_diseno-de-solucion.md#7-qué-queda-fuera-de-esta-versión)) | Registry compartido de Moor con *namespace aliasing*; el nombre es nuestro, el control sigue siendo suyo |

---

## 3. Lo demás que quedó fuera del 04

**3.1 Más pares y más estrategias.** WBTC/USDC primero; después cualquier par con liquidez y oráculo. Y las otras figuras de SwapVM que ya existen: subasta holandesa ("vende bajando el precio hasta que alguien tome"), TWAP ("compra repartido en el tiempo"), órdenes con oráculo. Cada una es un programa y una pantalla; el resto de Moor no cambia.

**3.2 Producción real: mainnet y L2.** Aqua y SwapVM ya están en 15 redes con direcciones canónicas y **takers reales**: ahí la posición se llena sola, que es lo que la demo simula. Lo que falta es ENSv2 en mainnet, que depende del calendario de ENS Labs. Mientras no llegue: ENSv1 con subnombres y fuses del NameWrapper como puente, perdiendo granularidad de permisos — o esperar. Y publicar los descriptores ERC-7730 en el registro de Ledger para que Clear Signing funcione para cualquiera, no solo en modo desarrollador.

**3.3 Distribución.** Enviar el manifest a Ledger Discover (proceso de revisión de Ledger); Safe App al catálogo de Safe. Ambos son procesos, no código.

**3.4 Auditoría.** `MoorRegistrar` es pequeño y no toca tokens. `MoorAccountPolicy` (1b/2.3) **sí**, dentro de límites: antes de mainnet, auditoría externa.

---

## Orden propuesto

| # | Qué | Desbloquea | Tamaño | Cuándo |
| --- | --- | --- | --- | --- |
| 1 | **1c** Notificación + un toque | Baja el tiempo fuera de rango sin tocar la regla | S | Justo después del hackathon |
| 2 | **1a** Rango relativo a oráculo (opcode propio) | "Trabaja mientras espera" sin delegar; puntos con 1inch | M | Segundo hackathon |
| 3 | **2.1** Web para cualquier EOA + Ledger por WebHID | Usuarios fuera de Ledger Live | M | Segundo hackathon |
| 4 | **2.3 + 1b** 7702 / smart account + `MoorAccountPolicy` + agente que actúa dentro de política | Una sola firma; re-ranging autónomo acotado | L | Segundo hackathon, la apuesta central |
| 5 | **2.2** Safe App + agente proponente | Tesorerías y DAOs | M–L | Segundo hackathon si hay track de Safe; si no, después |
| 6 | **2.4** Indexador, agente multi-tenant, notificaciones | Todo lo anterior a escala | L | Después |
| 7 | **3.2** Mainnet + L2, ENSv2 en mainnet, ERC-7730 publicados | Takers reales | M (+ esperar a ENS) | Cuando ENSv2 llegue a mainnet |
| 8 | **3.4** Auditoría de `MoorAccountPolicy` | Mainnet con política | — | Antes del 7 |

Si el segundo hackathon tiene los mismos tres patrocinadores, la jugada es **2 + 4**: el opcode propio para 1inch, la política con 7702 para Ledger, y el agente como delegado con permisos para ENS. Si tiene Safe, entra el 5.

---

## Lo que no entra en ningún roadmap

Hay cosas que Moor no va a hacer aunque la lista de arriba se cumpla entera, porque dejarían de ser Moor:

- **Custodiar.** Nunca un contrato de Moor es maker de nada ni tiene aprobación sobre tokens de nadie.
- **Que el agente actúe fuera de una política firmada.** Ni "por seguridad", ni "porque era obvio". Si no cabe en lo firmado, propone.
- **Cobrar sin decirlo.** Si algún día Moor cobra, es un parámetro visible del programa que la Ledger muestra al firmar.
- **Prometer fills o fees.** La posición se llena si el mercado pasa por ahí. Se dice así en cada pantalla.
