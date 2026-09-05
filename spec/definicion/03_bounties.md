# 03 — Bounties

> **Alcance de este documento:** a qué premios se presenta Moor, qué exige cada uno y qué obliga eso a construir. **No define diseño ni stack**, pero condiciona a los dos.
> **Depende de:** [02 — Solución](./02_solucion.md)

---

## Marco

Moor se presenta a **tres bounties**, y los tres caen sobre una sola pieza del producto:

| Pieza del [02](./02_solucion.md)                  | Bounty                       |
| ------------------------------------------------- | ---------------------------- |
| La posición genera fees sin salir de la wallet    | **1inch — Aqua / SwapVM**    |
| La posición tiene identidad propia y resoluble    | **ENS — ENSv2**              |
| El agente propone y la Ledger decide              | **Ledger — AI Agents**       |

Eso no es coincidencia y es la apuesta del proyecto: **no son tres integraciones pegadas a un demo, son las tres capas de la misma posición** — dónde trabaja el capital, cómo se llama, y quién puede moverlo. Si alguna se cae, se cae una parte del producto, no un patrocinio.

**Bolsa total a la que se aplica: $13,000** ($5,000 + $4,500 + $3,500).

---

## 1. 1inch — 💧 Build an Aqua App

**Premio:** $5,000 · 🥇 $2,500 · 🥈 $1,500 · 🥉 $1,000

**Qué es 1inch.** Red de protocolos descentralizados enfocada en unificar liquidez de DeFi; su agregador de DEX es de 2019. **Aqua** es su lanzamiento reciente: replantea el diseño de un DEX con **provisión de liquidez self-custodial**, que permite generar rendimiento sobre los tokens **sin depositarlos en otro contrato**.

**Qué pide el track.** Crear una app propia sobre Aqua que implemente una **posición DeFi sofisticada**. Si se usa **SwapVM**, se pueden modificar sus opcodes y definir instrucciones propias. La posición final debe demostrarse con **scripts de prueba o una UI**.

> **Los proyectos que usen SwapVM puntúan más alto en el juzgamiento final.**

**Requisitos de calificación:**

- Usar los contratos oficiales de Aqua/SwapVM (se permite redesplegar un SwapVM modificado).
- Mostrar **ejecución onchain de transferencias de tokens** en la demo final (forks locales son válidos).
- Historial de commits decente — **nada de una sola entrada el último día**.

**Recursos:**

- SwapVM — https://github.com/1inch/swap-vm/tree/main
- Aqua — https://github.com/1inch/aqua
- Aqua SDK — https://github.com/1inch/sdks/tree/master/typescript/aqua

**Qué significa para Moor.** Es el corazón del [02](./02_solucion.md): "los tokens no se mueven de la wallet" es exactamente la propiedad self-custodial de Aqua. La estrategia del usuario —generar fees mientras espera y llenar la orden al alcanzar el precio— es la "posición sofisticada" que pide el track, y es el lugar natural para **SwapVM**, que además sube el puntaje.

**Decisión:** SwapVM con opcodes existentes vía `AquaSwapVMRouter` y `useAquaInsteadOfSignature`; la posición es un *range order* de liquidez concentrada. Ver *Decisiones* al final.

---

## 2. ENS — 🧬 Best Use of ENSv2

**Premio:** $5,000 en total; el track paga $4,500 · 🥇 $1,500 · 🥈 $1,500 · 🥉 $1,000 · 🏅 Runner-Up $500

**Qué es ENS.** El puntero universal de internet: convierte direcciones en nombres legibles como `yourname.eth`, un perfil onchain portable que funciona en cualquier app, cadena y wallet. Se usa para reemplazar direcciones crudas por identidades reales y para construir ecosistemas de subnombres a escala.

**Qué pide el track.** **ENSv2 beta está vivo en Sepolia.** Explorar el nuevo registro jerárquico: resolver subnombres desde el resolver del padre con **wildcard resolution**, o desplegar un **registry de subnombres propio** para tokenizarlos y gobernarlos con reglas propias. Usar **Enhanced Access Control** —el sistema de permisos por roles compartido entre registries y resolvers— para delegar derechos específicos, como dejar que una cuenta edite solo ciertos text records. Dar a los subnombres su propio **Permissioned Resolver**, mezclar aliasing de records o de namespaces, y combinarlo para nombres expirables, revocables, transferibles o no.

> **Bonus por meter agentes de IA:** agentes como namespaces, cada uno con su identidad y permisos.

**Requisitos de calificación:**

- Construido sobre **ENSv2 en Sepolia**.
- Las funciones de ENSv2 deben ser **centrales al producto, no un adorno**.
- Demo **funcional, sin valores hardcodeados**.
- Video o demo en vivo (idealmente ambos) y **código abierto** en GitHub o similar.

**Recursos:**

- Permissioned Registry — https://docs.ens.domains/ensv2/permissioned-registry
- Permissioned Resolver — https://docs.ens.domains/ensv2/permissioned-resolver
- Enhanced Access Control — https://docs.ens.domains/ensv2/enhanced-access-control
- Guía para desarrolladores de contratos — https://docs.ens.domains/ensv2/tutorial-contract-developers

**Qué significa para Moor.** El paso 3 del [02](./02_solucion.md) —`btc-dip.salviega.eth`— deja de ser una etiqueta bonita: cada posición es un **subnombre bajo el nombre del usuario**, con su propio resolver donde viven los datos de la estrategia, y con **Enhanced Access Control** repartiendo exactamente lo que el [02](./02_solucion.md) promete: **el agente puede leer y escribir su lectura del mercado, pero no tocar la estrategia ni el capital**. La regla "el agente propone, la Ledger decide" se vuelve un permiso onchain, no una promesa. Eso también entra por el bonus de agentes con identidad y permisos propios.

**Decisión:** registry de subnombres propio bajo el nombre del usuario, un Permissioned Resolver por usuario, y el agente como subnombre con sus propios permisos. Ver *Decisiones* al final.

_Riesgo: el track exige que ENSv2 sea central y sin hardcodear. Un nombre puesto a mano no califica; hay que crear el subnombre y sus permisos de verdad en Sepolia._

---

## 3. Ledger — 🤖 AI Agents x Ledger

**Premio:** $5,000 en total; el track paga $3,500 · 🥇 $2,000 · 🥈 $1,000 · 🥉 $500

**Qué pide el track.** Agentes de IA y productos con IA que usen **Ledger como capa de confianza**. Debe **empezarse durante el evento**. Buscan proyectos donde la seguridad respaldada por el dispositivo sea **central al producto**: agentes que guardan secretos que no pueden filtrar, agentes que pagan por lo que usan, sistemas que piden un humano antes de algo irreversible, y productos que hacen el comportamiento autónomo **más seguro en vez de saltarse la intención del usuario**.

Lo que más quieren ver:

1. **Agentes que usan secretos que no pueden filtrar:** un broker entrega capacidades acotadas, nunca la API key.
2. **Llevar el Key Ring a hosts sin puerto USB:** enrolar un VPS, un runner de CI o un agente hospedado.
   → _Estos dos deben construirse sobre el **Ledger Agent Stack**, en particular el **Ledger Key Ring CLI** (`wallet-cli ring`)._
3. **Agentes que pagan** por APIs, herramientas o servicios con flujos de pago asegurados por Ledger, incluido el patrón **x402**.
4. **Agentes con humano en el loop** donde Ledger aprueba acciones de alto riesgo antes de que se muevan fondos o escalen permisos.

**Recursos:**

- Detalles del track — https://developers.ledger.com/ethonline
- Crear una Live App con la Wallet API (la superficie dentro de Ledger Live) — https://developers.ledger.com/docs/ledger-live/discover/integration/wallet-api/examples/live-app-creation/start
- Speculos, el emulador del dispositivo — https://github.com/LedgerHQ/speculos · https://www.ledger.com/blog/speculos-emulator

**Qué significa para Moor.** Moor entra por el **punto 4**, y casi con la frase textual del [02](./02_solucion.md): **el agente propone, la Ledger decide**. El agente monitorea, razona y simula; lo irreversible —cambiar la estrategia o mover el capital— exige el dispositivo. Suma el **Clear Signing** del paso 2: el usuario ve qué autoriza en vez de firmar un hash opaco, que es justo lo contrario de "saltarse la intención del usuario". La superficie es **Ledger Live**.

**Decisión:** punto 4 como núcleo, más Key Ring (puntos 1 y 2) para los secretos del agente. x402 no. Ver *Decisiones* al final.

---

## Requisitos que atraviesan los tres

Fallar uno de estos descalifica sin importar qué tan bueno esté el producto:

- **Historial de commits real.** Commits repartidos durante el evento; ni un solo commit el último día (1inch lo pide explícito).
- **Ejecución onchain en la demo.** Transferencias de tokens de verdad. Todo en **Sepolia**: ENSv2 solo existe ahí, y Aqua/SwapVM se redespliegan ahí (ver *Decisiones*).
- **Nada hardcodeado.** La demo tiene que funcionar de verdad (ENS lo pide explícito, y aplica al criterio de los tres).
- **Código abierto y accesible** en GitHub.
- **Video y/o demo en vivo** en el showcase de la submission.
- **Empezado durante el evento** (Ledger lo pide explícito).

---

## Decisiones

Los cuatro pendientes de la primera versión de este documento, cerrados el 5 de septiembre de 2026 tras leer los recursos de los tres tracks. El detalle técnico de cada una vive en el [05](./05_stack-y-arquitectura.md); aquí queda el qué y el porqué.

### 1. SwapVM con opcodes existentes, sobre Aqua

**Se descarta** componer "solo con la SDK de Aqua": la SDK únicamente codifica `ship()`/`dock()` y parsea eventos. La lógica de una posición vive en un `AquaApp` en Solidity, así que esa ruta significaba escribir un AMM propio — más trabajo y menos puntaje.

**Se elige** SwapVM, que ya es un `AquaApp`: con `useAquaInsteadOfSignature = true` el mismo bytecode se autoriza contra el balance virtual de Aqua en lugar de una firma EIP-712 (`AquaSwapVMRouter`). La posición se programa con `_xycConcentrateGrowLiquidityXD` — liquidez concentrada en un rango de precio. Un *range order*: el capital espera fuera del rango, y cuando el precio entra, cada trade lo convierte al otro activo cobrando fee. **"Generar fees mientras espera" y "la posición ya contiene la orden" son el mismo mecanismo**, no dos que haya que unir.

**Modificar opcodes queda como stretch**, no como cimiento: SwapVM exige cinco invariantes (simetría exact-in/out, quote = swap, monotonía de precio, redondeo a favor del maker, suficiencia de balance) y advierte que el orden de instrucciones es crítico para la seguridad. Un opcode propio se prueba contra `CoreInvariants` al final, si sobra tiempo.

**Consecuencia:** `ship()` hace la estrategia inmutable. Cambiarla es `dock()` + `ship()` nuevo, con firma en la Ledger. No existe una forma de cambiar la estrategia sin el dispositivo — eso es "el agente propone, la Ledger decide" garantizado por el protocolo, no por Moor.

### 2. Registry de subnombres propio, un Permissioned Resolver por usuario

**Se descarta** wildcard sobre el resolver del padre: no crea ningún objeto onchain — la posición no tendría token, expiración, permisos ni revocación — y se parece a lo que ya se hacía en ENSv1. Es la opción que más fácil pierde frente a "ENSv2 central, no cosmético".

**Se elige** el flujo del tutorial oficial: `UserRegistry` proxy vía Verifiable Factory → `setSubregistry()` en el nombre del usuario → contrato registrador de Moor con `ROLE_REGISTRAR` y `ROLE_RENEW`. Cada posición es un subnombre real, y las funciones de ENSv2 hacen trabajo de producto:

| Función de ENSv2                                  | Qué hace en Moor                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| Subnombre tokenizado (ERC-1155)                   | La posición existe onchain, con dueño                                             |
| **No** otorgar `ROLE_CAN_TRANSFER_ADMIN`          | La posición es intransferible: está atada a la wallet cuyos tokens usa Aqua        |
| `expiry` del registro                             | Espeja el `_deadline` del programa SwapVM; si la estrategia vence, el nombre vence |
| `unregister()`                                    | Al hacer `dock()`, el nombre se da de baja. Nombre y posición viven y mueren juntos |
| Permissioned Resolver con roles por nombre **y por clave** de text record | Es donde entran los permisos del agente (decisión 3)              |

Un resolver **por usuario**, no por posición: el que el holder ya tiene en app.ens.dev sirve. Sus recursos de EAC son `(nombre, clave de text record)` —`authorizeTextRoles(name, key, account, grant)`, con `name = 0x00` para *cualquier* nombre del resolver—, así que un solo resolver reparte permisos por clave sin desplegar nada más. *(Corregido en la fase 2: la lectura previa de la documentación decía "por tipo de record"; ver [`feedback/02_ens.md`](../feedback/02_ens.md).)*

**Prerrequisito:** el nombre del usuario (`salviega.eth` para la demo) tiene que existir en ENSv2 Sepolia. Va en la fase 0 del [07](./07_plan-de-trabajo.md).

### 3. El agente tiene cero permisos sobre la posición; escribe solo en su propio subnombre

Al traducir la regla del [02](./02_solucion.md) a roles apareció un problema aparente: la documentación sugería que los recursos del resolver eran por **tipo** de record, y dar `ROLE_SET_TEXT` al agente sobre `btc-dip.salviega.eth` le habría permitido pisar `moor.strategy`. El código de `PermissionedResolver` resuelve el problema: `authorizeTextRoles` otorga `ROLE_SET_TEXT` **por clave**, así que el agente escribe `moor.agent.*` en el nombre de la posición y no puede tocar ninguna otra clave.

**Se elige** la forma que el bonus de ENS describe con sus palabras — agentes como namespaces con identidad y permisos propios:

```
btc-dip.salviega.eth          la posición. Records moor.*: estrategia, strategyHash de Aqua, par, rango…
                              Escribe: solo el usuario, desde la Ledger.
                              Records moor.agent.*: última lectura, simulación, propuesta.
                              Escribe: la llave del agente, con ROLE_SET_TEXT solo en esas ocho claves.
agent.salviega.eth            la identidad del agente (una por holder). addr = su llave caliente.
```

Roles exactos del agente:

- **Resolver:** `ROLE_SET_TEXT` únicamente, y únicamente sobre las ocho claves `moor.agent.*` (recurso `(cualquier nombre, clave)`). Nada sobre `moor.strategy` ni las demás claves del holder; nada de `ROLE_SET_ADDR`, `ROLE_SET_CONTENTHASH`, `ROLE_SET_ALIAS`, `ROLE_CLEAR`.
- **Registry:** ninguno. No `unregister`, no `renew`, no `setResolver`, no transferencia.
- **Roles admin** (`role << 128`): ninguno. No puede delegar ni ampliar lo que tiene.
- **Aqua:** no es maker, no tiene `approve`, no puede `ship` ni `dock`.

Esto es **verificable por cualquiera** con `hasRoles()`: un juez comprueba onchain que el agente no puede tocar la posición en vez de creernos. Y como EAC es reversible, el usuario tiene un *kill switch*: `revokeRoles()` firmado en la Ledger y el agente queda mudo.

### 4. Ledger: humano-en-el-loop como núcleo, Key Ring para los secretos del agente, x402 no

El criterio que más pesa en el track es *"something we can run without you in the room"*. Eso obliga a que el agente corra headless en un VPS, y ahí Key Ring deja de ser dispersión y pasa a ser necesidad: el agente tiene secretos —su llave caliente para escribir records en Sepolia, la RPC, la API del LLM— y `wallet-cli ring` los cifra con llaves derivadas de la seed de la Ledger y los descifra sin USB en el host. Es exactamente los puntos 1 y 2 del track, a costo bajo: es una herramienta que se usa, no una que se construye. El mismo agente marca tres de los cuatro puntos.

**x402 se descarta.** El agente de Moor no necesita pagar por nada; meterle pagos por APIs sería una integración pegada al demo, que es lo que este documento dice que no somos.

**Alerta:** Clear Signing no viene solo. Para que la Ledger muestre "shipping 1,000 USDC a rango 58k–62k" en vez de calldata, hace falta metadata **ERC-7730** para cada contrato que el usuario firma — Aqua, el registrador de Moor, el resolver. Sin ella la demo muestra *blind signing*, lo contrario del pitch. Es tarea del [07](./07_plan-de-trabajo.md).

### Lo que salió de los recursos y no estaba en ningún pendiente

**La demo corre en una sola cadena: Sepolia** — *revisado el 5 de septiembre de 2026 al leer la Wallet API.* Primero se decidió dos cadenas (Aqua en fork local + ENSv2 en Sepolia) porque Aqua está en 15 redes de producción y ninguna testnet, y 1inch acepta forks. Pero la Wallet API de Ledger Live firma y transmite solo a redes que Ledger Live conoce; un fork de Anvil no lo es, Sepolia sí. Así que Aqua y SwapVM se **redespliegan en Sepolia con su código oficial sin modificar** (1inch: "redeployments allowed"), y los fills de la demo los hace un taker nuestro — igual que habría pasado en el fork. El fork queda como plan B. Detalle y riesgos en el [05](./05_stack-y-arquitectura.md#1-decisiones).

**"Una sola firma" no es exacto.** El maker de Aqua es `msg.sender` de `ship()`, así que no se puede delegar a un contrato de Moor sin romper la autocustodia. El usuario firma `approve` (una vez por token), `ship` y la creación del nombre: dos o tres firmas en una sola sesión, **y cero después**. El [02](./02_solucion.md) quedó corregido en ese sentido.

---

## Pendientes

- **Confirmar con los mentores de 1inch** que Aqua y SwapVM redesplegados sin modificar en Sepolia cuentan como "official contracts". Preguntar en los primeros días, con la regla en la mano.
