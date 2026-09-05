# 02 — Solución

> **Alcance de este documento:** qué es Moor y cómo funciona para el usuario. **No define pantallas ni stack.**
> **Depende de:** [01 — Contexto y Problema](./01_contexto-y-problema.md)

---

## Qué es

**Moor convierte el tiempo de espera del holding en capital productivo.**

Elimina el trade-off del [01](./01_contexto-y-problema.md) convirtiendo el holding en una **posición productiva y programable**. Programable en dos sentidos: **qué hace la posición y quién puede tocarla.**

El usuario define una estrategia y la autoriza desde su hardware wallet en una sola sesión: **después de eso no vuelve a firmar**. Sus activos permanecen bajo el control de su wallet y generan fees a través de **1inch Aqua** cada vez que el mercado pasa por su rango.

Y cuando se alcanza la condición que definió —por ejemplo, un determinado precio— **la posición ya contiene la orden**: se llena sin requerir una nueva firma.

El ciclo del holder deja de tener un hueco improductivo:

**Holding → definir estrategia → generar fees mientras espera → ejecutar compra/venta → seguir en holding.**

---

## Cómo funciona

Seis pasos, y solo los tres primeros piden algo del usuario.

### 1. Definir

El usuario define su estrategia directamente desde **Ledger Live**: qué activo quiere poner a trabajar y bajo qué condiciones quiere comprar o vender.

Moor convierte esa estrategia en un programa ejecutable.

### 2. Firmar

El usuario autoriza la posición en su Ledger **en una sola sesión de firma**: la aprobación del token (una vez por token), la creación de la posición en Aqua y la de su nombre. Son dos o tres confirmaciones seguidas, **y ninguna más mientras la posición viva**. Cambiar la estrategia exige volver al dispositivo — por diseño del protocolo, no por una regla de Moor.

Gracias a **Clear Signing**, no está firmando un hash o calldata que no puede interpretar: ve exactamente qué está autorizando.

### 3. Nombrar

Una vez creada, la posición recibe su propia identidad en ENS. Por ejemplo:

`btc-dip.salviega.eth`

Ese nombre contiene los datos de la estrategia y permite que cualquier aplicación pueda resolver y entender la posición.

### 4. Trabajar

A partir de ahí, **los tokens no se mueven de la wallet**.

A través de **1inch Aqua**, la posición cobra un fee por cada trade que ejecuta dentro de su rango. Cuánto trabaja depende de qué tan ancho sea el rango y qué tan cerca esté del precio: un rango angosto y lejano es una orden límite que cobra al llenarse; uno que llega hasta cerca del precio actual empieza a trabajar casi de inmediato. La interfaz ofrece las dos y explica la diferencia ([04 §6](./04_diseno-de-solucion.md#6-reglas-de-negocio)). Que la posición se mantenga en rango sola es el primer punto del [08 — Roadmap](./08_roadmap.md).

### 5. Ejecutar

Cuando el precio llega al rango definido, **la orden puede ejecutarse sin una firma adicional**. La estrategia ya había sido autorizada desde el principio.

### 6. Vigilar

Mientras todo esto ocurre, un agente monitorea el precio y el estado de la posición. Si detecta que algo cambió, **puede simular y proponer el siguiente paso**.

Pero hay una regla fundamental:

> **El agente propone. La Ledger decide.**

El agente puede monitorear, razonar y simular, pero **no puede ejecutar acciones que cambien la estrategia o muevan el capital**.

---

## Qué resuelve

- **Rendimiento sin ceder custodia:** el capital genera fees sin salir del control de la wallet.
- **Ejecución sin estar presente:** la orden ya está autorizada, así que la oportunidad no depende de que el usuario esté mirando el precio.
- **Firma que se entiende:** con Clear Signing el usuario ve qué autoriza, no un hash opaco.
- **Identidad legible e interoperable:** la posición vive en un nombre ENS que cualquier aplicación puede resolver.
- **Automatización con límites:** el agente vigila y propone, pero la autoridad para mover capital nunca sale de la Ledger.

**El capital trabaja mientras espera, pero el usuario mantiene el control.**

---

## Alcance inicial

La superficie de uso es **Ledger Live**: el usuario define, firma y consulta sus posiciones desde ahí, con la hardware wallet como única autoridad sobre el capital.

_Pendiente: redes, activos y tipos de estrategia soportados en la primera versión._
