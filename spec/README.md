# Moor — Documentación

**Convierte el tiempo de espera del holding en capital productivo.**

Un holder guarda sus activos en su hardware wallet y espera una oportunidad. Para que ese capital rinda mientras tanto, hoy tiene que sacarlo de la wallet y meterlo en un contrato: elige entre control o rendimiento. Moor convierte el holding en una **posición productiva y programable** que se firma una vez desde la Ledger, genera fees a través de 1inch Aqua sin que los tokens salgan de la wallet, ya contiene la orden que se llenará al llegar el precio, y tiene un nombre ENS que cualquiera puede leer. Un agente vigila y propone; **la Ledger decide.**

---

## Definición del proyecto

Ocho documentos, en orden. Cada uno asume el anterior.

| #                                             | Documento                 | De qué trata                                                                 |
| --------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| [01](./definicion/01_contexto-y-problema.md)  | **Contexto y problema**   | El ciclo del holder, el capital improductivo y el trade-off custodia/rendimiento |
| [02](./definicion/02_solucion.md)             | **Solución**              | Qué es Moor y los seis pasos: definir, firmar, nombrar, trabajar, ejecutar, vigilar |
| [03](./definicion/03_bounties.md)             | **Bounties**              | 1inch/Aqua, ENSv2 y Ledger: qué exige cada premio y qué obliga a construir   |
| [04](./definicion/04_diseno-de-solucion.md)   | **Diseño de la solución** | Actores, flujos, pantallas, modelo de datos y reglas de negocio              |
| [05](./definicion/05_stack-y-arquitectura.md) | **Stack y arquitectura**  | Decisiones técnicas, contratos, permisos onchain y costos                    |
| [06](./definicion/06_tecnologias.md)          | **Tecnologías**           | Qué se instala, para qué sirve cada pieza y qué se descartó                  |
| [07](./definicion/07_plan-de-trabajo.md)      | **Plan de trabajo**       | Las fases de construcción, cómo se verifica cada una y qué se recorta        |
| [08](./definicion/08_roadmap.md)              | **Roadmap**               | Lo que no entra en este hackathon: mantener el rango solo, salir de Ledger Live, producción |

**Por dónde empezar según quién seas:** para entender el proyecto, el 01 y el 02 bastan. Para saber a qué nos estamos presentando y qué es obligatorio, el 03. Para trabajar en producto, el 04. Para escribir código, el 05 y el 06. Para saber qué sigue ahora mismo, el 07. Para saber qué sigue después, el 08.

---

## Decisiones ya tomadas

- **Tres bounties, una sola posición:** 1inch Aqua/SwapVM (dónde trabaja el capital), ENSv2 (cómo se llama), Ledger (quién puede moverlo). Bolsa: $13,000.
- **SwapVM sobre Aqua**, con opcodes existentes: la posición es un rango de liquidez concentrada **unidireccional**. Modificar opcodes es stretch.
- **Registry de subnombres propio bajo el nombre del holder** + un Permissioned Resolver por holder. El agente es un subnombre con un solo permiso: escribir sus propios text records.
- **Una sola cadena: Sepolia.** Aqua y SwapVM redesplegados sin modificar; ENSv2 en su beta oficial.
- **Ledger:** humano en el loop como núcleo, Key Ring para los secretos del agente, Clear Signing con ERC-7730 para todo lo que se firma. x402 no.
- **Sin estado propio.** Todo vive en Aqua, SwapVM y ENS. Sin base de datos.
- **Monorepo** con pnpm: Foundry para contratos, Next.js para la Live App, TypeScript + Claude Opus 5 para el agente.

---

## Feedback a los sponsors

Aparte de la definición, [`feedback/`](./feedback/) es una bitácora viva de lo que 1inch, ENS y Ledger documentan o prometen frente a lo que encontramos al construir — se actualiza mientras se avanza, no al final. Es también, para Ledger, parte del entregable que el track pide.

---

## Estado

**Documentación completa del 01 al 08. Construcción: fases 0 y 1 cerradas el 5 de septiembre; fase 2 (ENSv2) cerrada también el 5 — `btc-dip.salviega.eth` vive en Sepolia firmado desde la Ledger; sigue la fase 3, la Live App** ([07](./definicion/07_plan-de-trabajo.md)) — monorepo y CI en verde, Aqua/SwapVM redesplegados en Sepolia (Aqua con `exact_match` en Sourcify), `salviega.eth` en ENSv2, Live App en [Vercel](https://getmoor.vercel.app), Speculos verificado. Primera firma real desde Ledger Live hecha (`mint` de tUSDC). Pendiente que espera al host: el Key Ring en el VPS. Cierre de submissions el 13 de septiembre de 2026. Los pendientes de cada tema están al final de su documento; los que atraviesan varios (fuente de precio, enumerar subnombres, confirmar el redespliegue con 1inch) tienen fase asignada en el 07.
