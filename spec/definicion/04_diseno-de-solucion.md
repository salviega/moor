# 04 — Diseño de la solución

> **Alcance de este documento:** diseño de producto — actores, flujos, pantallas, modelo de datos y reglas. **No define stack ni arquitectura técnica.**
> **Depende de:** [01 — Contexto y Problema](./01_contexto-y-problema.md) · [02 — Solución](./02_solucion.md) · [03 — Bounties](./03_bounties.md)

---

## 1. Principios de diseño

Seis reglas que ordenan todas las decisiones que siguen:

1. **El capital no se mueve.** Los tokens salen de la wallet únicamente en el instante en que un trade los intercambia, y solo hasta el monto que ese trade paga. Nunca hay un depósito, nunca hay un "retirar".
2. **Una sesión de firma, y ninguna más.** Todo lo que pasa después de crear la posición lo garantiza el protocolo, no Moor. Si algo requiere volver al dispositivo, es porque el usuario está cambiando de opinión, no porque el sistema lo necesite para funcionar.
3. **Lo que la Ledger muestra es lo que pasa.** Cada firma se ve en el dispositivo en términos del producto ("comprar BTC entre 58k y 62k con 1,000 USDC"), nunca como calldata. Si una acción no se puede mostrar así, no se ofrece.
4. **El agente propone, la Ledger decide — y cualquiera puede comprobarlo.** La separación no es una política de Moor: son permisos onchain que un tercero puede verificar sin confiar en nosotros.
5. **La posición es legible por cualquiera.** Tiene un nombre, y ese nombre dice qué es, qué hace y en qué estado está. Cualquier app que resuelva ENS la entiende sin conocer Moor.
6. **No se promete lo que el protocolo no garantiza.** La posición no promete llenarse ni promete fees: se llena si el precio entra al rango y hay quien opere; cobra fees solo cuando eso pasa. La interfaz lo dice así.

---

## 2. Actores y qué hace cada uno

| Actor                          | Identidad                              | Qué hace                                                                                                          |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Holder**                     | Su wallet, con la Ledger como firmante | Define posiciones, las firma, las consulta, acepta o ignora propuestas del agente, las cierra                    |
| **Agente**                     | Su propio subnombre ENS y una llave caliente | Monitorea precio y estado, simula, escribe propuestas en su subnombre. **No puede mover capital ni cambiar estrategia** |
| **Takers**                     | Cualquiera: bots, solvers, arbitrajistas | Operan contra la posición cuando les conviene. Son quienes la llenan y quienes pagan los fees                   |
| **Cualquier app**              | —                                      | Resuelve el nombre ENS de una posición y entiende qué es, sin conocer Moor                                        |

La **Ledger** no es un actor: es la única autoridad sobre el capital. Aparece en cada flujo como el lugar donde el holder decide.

Hay **un solo tipo de usuario**. No hay roles, ni cuentas, ni sesiones: la identidad es la wallet. El agente no es un usuario, es un servicio con permisos acotados sobre un nombre.

---

## 3. Modelo de datos

Una posición no es un registro en una base de datos: es la composición de tres cosas onchain que se referencian entre sí. Moor no guarda estado propio.

### Posición

| Campo             | Tipo                                         | Dónde vive                    | Notas                                                                        |
| ----------------- | -------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `label`           | texto corto                                  | ENS (subnombre)               | `btc-dip` en `btc-dip.salviega.eth`. Lo elige el holder                     |
| `owner`           | dirección                                    | ENS (dueño del token) + Aqua (maker) | Siempre la misma: la wallet del holder. Intransferible                 |
| `par`             | `tokenIn` / `tokenOut`                       | Aqua (estrategia) + ENS (record) | El token que se entrega y el que se recibe. Ej. USDC → WBTC               |
| `direccion`       | `comprar` · `vender`                         | Programa SwapVM + ENS         | Una sola. Ver §6                                                             |
| `monto`           | cantidad de `tokenIn`                        | Aqua (balance virtual)        | Lo que se pone a trabajar. Nunca sale de la wallet hasta que un trade lo toma |
| `rango`           | `precioMin` / `precioMax`                    | Programa SwapVM + ENS         | Entre qué precios la posición opera y cobra fees                             |
| `fee`             | bps                                          | Programa SwapVM + ENS         | Lo que cobra por trade a los takers                                          |
| `vence`           | timestamp                                    | Programa SwapVM (`_deadline`) + ENS (`expiry`) | Los dos son el mismo instante                              |
| `strategyHash`    | bytes32                                      | Aqua                          | Identidad de la estrategia. Inmutable                                        |
| `programa`        | bytecode                                     | SwapVM + ENS (record)         | Lo que la posición hace. Inmutable                                           |
| `estado`          | derivado                                     | —                             | Se calcula, no se guarda. Ver §6                                             |

### Records ENS de la posición (`<label>.<holder>.eth`)

| Record                 | Contenido                                   | Quién escribe |
| ---------------------- | ------------------------------------------- | ------------- |
| `addr`                 | Wallet del holder                           | Holder        |
| `moor.version`         | Versión del esquema de records              | Holder        |
| `moor.strategy`        | `chainId:strategyHash`                      | Holder        |
| `moor.program`         | Bytecode del programa SwapVM                | Holder        |
| `moor.pair`            | `tokenIn:tokenOut`                          | Holder        |
| `moor.side`            | `buy` · `sell`                              | Holder        |
| `moor.range`           | `precioMin:precioMax`                       | Holder        |
| `moor.agent`           | Nombre del subnombre del agente             | Holder        |

Todo lo que el agente **no** puede tocar está aquí. Todo esto se escribe en la sesión de creación y no cambia: cambiar la estrategia es crear otra posición.

### Propuesta del agente

Vive en los records del subnombre del agente, `agent.<label>.<holder>.eth`. Es lo único que el agente escribe.

| Record                      | Contenido                                                            |
| --------------------------- | -------------------------------------------------------------------- |
| `moor.agent.checkedAt`      | Timestamp de la última lectura. Si es viejo, la interfaz lo dice     |
| `moor.agent.price`          | Precio observado y fuente                                            |
| `moor.agent.state`          | Estado derivado según el agente (§6)                                 |
| `moor.agent.filled`         | Porcentaje del monto ya convertido                                   |
| `moor.agent.fees`           | Fees acumulados estimados                                            |
| `moor.agent.proposal`       | `none` · `widen` · `narrow` · `close` · `renew`, con parámetros propuestos |
| `moor.agent.reasoning`      | Por qué, en una o dos frases                                         |
| `moor.agent.simulation`     | Qué pasaría si se acepta: fees estimados, exposición resultante      |

Una propuesta **no hace nada por sí misma**. Es texto que el holder lee en la Live App y, si le convence, convierte en firmas en la Ledger.

### Agente

| Campo    | Tipo        | Notas                                                                     |
| -------- | ----------- | ------------------------------------------------------------------------- |
| `nombre` | subnombre   | `agent.<label>.<holder>.eth`. Uno por posición                            |
| `addr`   | dirección   | Su llave caliente. Es lo que el holder autoriza y lo que puede revocar    |
| `roles`  | derivado    | Exactamente uno: escribir text records en su propio subnombre. Ver §6     |

---

## 4. Flujos

### 4.0 Primera vez (una sola vez por holder)

Antes de la primera posición, el holder necesita que su nombre pueda tener subnombres administrados por Moor. Ocurre una vez y no se repite.

1. Abre Moor en Ledger Live. Moor detecta que `salviega.eth` aún no tiene registry de Moor.
2. La Live App explica qué va a pasar: se crea un registry de subnombres bajo su nombre y un resolver propio, y se autoriza al registrador de Moor a crear posiciones ahí — **y a nada más**.
3. Firma en la Ledger. Cada transacción se muestra en términos del producto.
4. Listo. Desde ahora, crear una posición es la sesión del 4.1.

> Este flujo existe porque las posiciones viven bajo el nombre del holder, no bajo el de Moor. Es el costo de que `btc-dip.salviega.eth` sea de salviega y no de nosotros.

### 4.1 Crear una posición — definir, firmar, nombrar

1. **Definir.** El holder elige: qué quiere hacer (*comprar BTC en un dip* / *vender BTC en una subida*), con cuánto, entre qué precios, hasta cuándo, y cómo se va a llamar. La interfaz muestra el precio actual y dónde queda el rango respecto a él.
2. **Entender.** Antes de firmar, una pantalla dice con claridad qué va a pasar: "Tus 1,000 USDC se quedan en tu wallet. Cuando BTC baje de 62,000, la posición empieza a comprar y cobra 0.3 % por cada trade. Si llega a 58,000, habrás convertido todo. Si nunca baja, no pasa nada y puedes cerrarla cuando quieras." Y qué **no** va a pasar: nadie más puede mover ese dinero, ni Moor ni el agente.
3. **Firmar.** Una sesión con la Ledger, dos o tres confirmaciones seguidas, cada una clear-signed:
   - Autorizar a Aqua sobre USDC (solo la primera vez que se usa ese token).
   - Crear la posición: estrategia y monto.
   - Nombrarla: el subnombre, sus records y el subnombre del agente con su único permiso.
4. **Nombrar.** La posición ya existe y se llama `btc-dip.salviega.eth`. La Live App la muestra en *Mis posiciones* con estado *esperando*.

A partir de aquí el holder puede cerrar Ledger Live. No hace falta nada más.

### 4.2 Esperar y trabajar

No hay flujo de usuario: es el protocolo trabajando solo.

- Mientras el precio está **fuera** del rango, la posición está quieta. No convierte, no cobra fees. El monto sigue en la wallet.
- Cuando el precio **entra** al rango, los takers empiezan a operar contra ella: cada trade convierte una parte del monto al otro token y deja un fee. El holder lo ve en la Live App como *% convertido* y *fees acumulados*.
- Si el precio **atraviesa** el rango completo, todo el monto quedó convertido. La posición está *completada*.

El holder puede mirar cuando quiera. No tiene que hacerlo.

### 4.3 Ejecutar

No hay un momento de "ejecución" separado del anterior: **la orden se llena mientras trabaja**. Es lo que el 02 llama "la posición ya contiene la orden". Lo que sí es una regla dura: **la posición es unidireccional** (§6). Una posición de *comprar* solo compra. Si el precio entra al rango, convierte, y luego vuelve a subir, **no vende de vuelta**. Lo comprado se queda comprado, sin que el holder tenga que correr a cerrar nada.

### 4.4 Vigilar y proponer

1. El agente corre solo, cada pocos minutos. Lee el precio, lee el estado de la posición en Aqua, calcula estado, % convertido y fees.
2. Escribe su lectura en `agent.btc-dip.salviega.eth`. Siempre, aunque no haya nada que proponer: así el holder sabe que el agente está vivo.
3. Si detecta algo que merece atención —el precio se alejó tanto del rango que la posición lleva días sin trabajar; la posición se completó; el vencimiento está cerca—, **simula** alternativas y escribe una propuesta con su razonamiento y el resultado simulado.
4. El holder la ve en la Live App, en la ficha de la posición, marcada como *propuesta del agente*. Puede ignorarla.
5. Si la acepta, la Live App la convierte en la sesión de firma correspondiente (cerrar; o cerrar y crear una nueva con el rango propuesto). La Ledger muestra qué se va a hacer. El holder confirma o no.

El agente **nunca** llega al paso 5 por su cuenta. No tiene cómo: no es el maker en Aqua, no tiene permisos en el registry, y en el resolver solo puede escribir sus propios records.

### 4.5 Cerrar

1. El holder elige *cerrar* en la ficha de la posición (o acepta una propuesta de cierre).
2. La Ledger muestra: "Cerrar btc-dip.salviega.eth. Tus tokens siguen en tu wallet; se deja de operar." Firma.
3. La estrategia se da de baja en Aqua y el subnombre se da de baja en ENS. Nombre y posición mueren juntos.

Si el holder no hace nada y llega el vencimiento, la posición deja de operar sola (`_deadline`) y el nombre expira solo (`expiry`). Los tokens nunca salieron de la wallet, así que no hay nada que "recuperar".

### 4.6 Silenciar al agente

En cualquier momento, desde la ficha de la posición: *revocar agente*. Una firma en la Ledger y el agente pierde su único permiso. La posición sigue trabajando exactamente igual: el agente nunca fue necesario para eso.

---

## 5. Pantallas

Todo vive dentro de **Ledger Live**, como Live App. Una acción principal por pantalla.

| Pantalla                  | Qué muestra                                                                                                                 | Acción principal            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **Mis posiciones**        | Lista de subnombres del holder bajo su registry de Moor, con estado, % convertido y fees. Aviso si el agente lleva mucho sin reportar | *Nueva posición*      |
| **Nueva posición**        | Formulario: qué (comprar/vender), par, monto, rango con el precio actual marcado, vencimiento, nombre                       | *Revisar*                   |
| **Revisar y firmar**      | Qué va a pasar y qué no, en lenguaje llano. Lista de las firmas que vienen, con lo que la Ledger va a mostrar en cada una | *Firmar con Ledger*         |
| **Ficha de posición**     | Estado, rango vs precio actual, % convertido, fees, vencimiento, nombre ENS. Panel del agente: última lectura y propuesta si la hay | *Cerrar* / *Aceptar propuesta* |
| **Primera vez**           | Explica el registry y el resolver que se van a crear bajo su nombre y qué se autoriza al registrador de Moor                | *Configurar con Ledger*     |

Fuera de Ledger Live no hay pantallas de Moor. Pero el nombre `btc-dip.salviega.eth` resuelve en cualquier app de ENS y muestra sus records: esa es la "pantalla pública", y no la construimos nosotros.

---

## 6. Reglas de negocio

**Sobre el capital**

- Los tokens salen de la wallet **solo** cuando un taker los intercambia, y solo por el monto que ese trade paga. No existe "depositar" ni "retirar".
- Solo la wallet del holder puede crear o dar de baja una estrategia. Ni Moor ni el agente pueden, y no es una política: es que el protocolo identifica al maker por quien firma.

**Sobre la posición**

- **Unidireccional.** Una posición de *comprar* solo acepta trades que le entregan `tokenOut` a cambio de `tokenIn`. Nunca al revés. Lo convertido se queda convertido aunque el precio regrese.
- **Inmutable.** Estrategia, rango, fee y vencimiento no cambian. "Modificar" es cerrar y crear otra, con firma.
- **Intransferible.** El nombre no se puede transferir porque el capital que representa es de una wallet concreta.
- **Nombre y estrategia viven y mueren juntos.** Mismo vencimiento; al cerrar una se cierra la otra.
- **El rango se define del lado correcto del precio.** Una posición de *comprar* tiene su rango por debajo del precio actual; una de *vender*, por encima. Si el holder pone un rango que ya contiene el precio actual, la interfaz lo advierte: la posición empezaría a operar de inmediato.

**Sobre los fees — y esto hay que decirlo sin adornos**

- La posición **cobra fees solo cuando opera**, y opera solo cuando el precio está dentro del rango. Fuera del rango, está quieta y no gana nada.
- Eso significa que "trabaja mientras espera" es tan cierto como ancho sea el rango: un rango angosto lejos del precio es una orden límite que cobra fees solo al llenarse; un rango que llega hasta cerca del precio actual empieza a trabajar casi de inmediato, convirtiendo poco a poco a medida que el precio baja. **La interfaz ofrece las dos y explica la diferencia.** No se esconde detrás del promedio.

**Sobre el agente**

- Puede: leer todo, escribir text records **únicamente** en su propio subnombre.
- No puede: nada más. Ni en la posición, ni en el registry, ni en Aqua. No puede otorgarse ni pedir más permisos.
- Sus propuestas no tienen efecto hasta que el holder las firma. Si el agente se cae, la posición no se entera.
- Si su última lectura tiene más de una hora, la interfaz lo dice como aviso, no como error: la posición sigue bien; el que está callado es el agente.

**Estados de una posición** (derivados, nunca guardados)

| Estado        | Cuándo                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| `esperando`   | Precio fuera del rango, nada convertido                                      |
| `trabajando`  | Precio dentro del rango o algo ya convertido, y queda monto por convertir     |
| `completada`  | Todo el monto convertido                                                     |
| `vencida`     | Pasó el vencimiento. Ya no opera; el nombre expiró o está por expirar        |
| `cerrada`     | El holder la dio de baja                                                     |

---

## 7. Qué queda fuera de esta versión

- **Más de un par.** La primera versión es WBTC/USDC. La mecánica es la misma para cualquier par; la interfaz no.
- **Estrategias que no sean un rango.** SwapVM permite subastas holandesas, TWAP, órdenes con oráculo. Una sola figura, bien hecha, primero.
- **Que el agente ejecute algo, incluso con límites.** Hay versiones razonables de "el agente puede cerrar si el precio cae 30 %". No en esta: la regla es binaria y verificable, y eso vale más que la conveniencia.
- **Notificaciones fuera de Ledger Live.** El holder ve las propuestas cuando abre la app. Sin push, sin correo, sin Telegram.
- **Posiciones bajo un nombre de Moor** (`btc-dip.salviega.moor.eth`) para quien no tiene nombre ENS. Simplifica el onboarding, pero contradice el principio 5 a medias: el nombre sería nuestro, no suyo. Se evalúa después.
- **Cuentas, sesiones, base de datos.** No hay. Si algún día hacen falta, será por analítica, no por producto.

---

## 8. Decisiones tomadas y pendientes

**Tomadas**

- Un solo tipo de usuario; sin roles ni cuentas. La identidad es la wallet.
- La posición es un rango unidireccional de liquidez concentrada; "trabajar" y "ejecutar" son el mismo mecanismo.
- El agente escribe solo en su propio subnombre y no tiene ninguna capacidad de ejecución. Se revoca con una firma.
- Las posiciones viven bajo el nombre del holder, con un flujo de primera vez que lo habilita.
- La interfaz dice explícitamente que los fees se cobran solo dentro del rango.

**Pendientes**

- Fuente de precio del agente y de la interfaz (oráculo, DEX, ambos).
- Qué umbrales disparan una propuesta del agente (días sin operar, distancia al rango, cercanía del vencimiento).
- Si la pantalla *Revisar y firmar* muestra una estimación de fees; el principio 6 sugiere que no, o que sea muy conservadora.
- Cómo se ve el flujo de *aceptar propuesta* cuando implica cerrar y crear (dos posiciones, dos nombres): ¿el nuevo hereda el label con sufijo?
