# 02 — Feedback: ENS (ENSv2)

> **Alcance de este documento:** bitácora viva de lo que ENS documenta o promete sobre ENSv2 — Permissioned Registry, Permissioned Resolver, Enhanced Access Control — frente a lo que encontramos al construirlo dentro de Moor. Se actualiza el día que algo aparece, no al final.
> **Depende de:** [03 — Bounties §2](../definicion/03_bounties.md#2-ens--best-use-of-ensv2) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md)

Stack en uso: `ensdomains/contracts-v2` (`main`), ENSv2 beta en Sepolia — direcciones fijadas en [05 §11](../definicion/05_stack-y-arquitectura.md#11-pendientes).

---

## Lo que funcionó bien

_Se llena mientras se construye._

---

## Bitácora

_Sin entradas todavía — la fase 2 del [07](../definicion/07_plan-de-trabajo.md) es donde se registra el nombre y se otorgan los primeros roles._

<!--
### AAAA-MM-DD — Título corto del hallazgo

**Documentado / prometido:** qué dice la guía de ENSv2 o el tutorial para desarrolladores de contratos.

**Encontrado:** qué pasó de verdad.

**Evidencia:** archivo:línea, comando exacto (`cast`, `forge`), mensaje de error completo, hash de tx en Sepolia.

**Impacto en Moor:** ¿cambió una decisión del 04 o el 05? ¿costó horas? ¿fue una sorpresa sin consecuencia?

**Reportado:** enlace al issue/PR si se abrió, o "pendiente".
-->

---

## Cosas puntuales a vigilar (de la investigación previa a construir)

Estas no son hallazgos todavía — son huecos que ya se detectaron en la documentación leída antes de escribir código, y que hay que confirmar en la fase 2:

- [ ] El tutorial para desarrolladores de contratos no cubre **wildcard resolution** ni da las direcciones de Sepolia en la misma página — hay que confirmar que la tabla de despliegues fijada en el [05](../definicion/05_stack-y-arquitectura.md#11-pendientes) sigue vigente al momento de desplegar.
- [ ] No quedó claro en la documentación cómo se **enumeran los subnombres** de un `UserRegistry` sin indexador propio (eventos vs `UniversalResolverV2`) — es la decisión que cierra la fase 2 del [07](../definicion/07_plan-de-trabajo.md); si la documentación no basta, es feedback.

---

## Resumen

| # | Área | Se documentaba | Se encontró | Severidad | Reportado |
| - | ---- | --------------- | ----------- | --------- | --------- |
| — | — | — | — | — | — |

## Reportes abiertos (se llena en fase 5)

- [ ] —
