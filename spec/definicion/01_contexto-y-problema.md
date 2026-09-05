# 01 — Contexto y Problema

> **Alcance de este documento:** qué está pasando y por qué duele. **No propone solución.**

---

## Contexto

Un holder cripto tiene un ciclo muy simple: mantiene sus activos en su hardware wallet esperando una oportunidad de compra o venta. Cuando aparece, ejecuta la operación y vuelve a esperar.

**Holding → esperar una oportunidad → ejecutar compra/venta → volver a holding → esperar.**

El tiempo de espera es la mayor parte del ciclo, y durante todo ese tiempo **el capital permanece improductivo**.

## Problema

Para generar rendimiento mientras espera, el usuario tiene que sacar esos activos de su hardware wallet y depositarlos en un protocolo de lending, un vault o un liquidity pool.

Pero al hacerlo cambia la naturaleza del holding: **los activos dejan de estar bajo el control directo de su wallet y pasan a estar en un smart contract.**

El usuario termina enfrentando un trade-off:

> **¿Mantener el control sobre sus activos o poner su capital a trabajar?**

Hoy hay que elegir uno de los dos. La pregunta que queda abierta es si tiene que ser así:

> **¿Y si ese capital pudiera seguir en holding, pero trabajar mientras espera?**
