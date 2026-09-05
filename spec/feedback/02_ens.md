# 02 — Feedback: ENS (ENSv2)

> **Alcance de este documento:** bitácora viva de lo que ENS documenta o promete sobre ENSv2 — Permissioned Registry, Permissioned Resolver, Enhanced Access Control — frente a lo que encontramos al construirlo dentro de Moor. Se actualiza el día que algo aparece, no al final.
> **Depende de:** [03 — Bounties §2](../definicion/03_bounties.md#2-ens--best-use-of-ensv2) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md)

Stack en uso: `ensdomains/contracts-v2` (`main`), ENSv2 beta en Sepolia — direcciones fijadas en [05 §11](../definicion/05_stack-y-arquitectura.md#11-pendientes).

---

## Lo que funcionó bien

_Se llena mientras se construye._

---

## Bitácora

### 2026-09-05 — `contracts-v2` no publica tags y el proyecto Foundry vive en un subdirectorio

**Documentado / prometido:** el tutorial para desarrolladores de contratos dice `forge install ensdomains/contracts-v2` y luego importa `IPermissionedRegistry`, `RegistryRolesLib`, etc.

**Encontrado:** el repo no tiene releases ni tags, así que `forge install` queda en `main` y solo se puede fijar por commit en `.gitmodules` (`48b3e2d3`). El proyecto Foundry no está en la raíz sino en `contracts/`, con diez submódulos anidados propios (dos OpenZeppelin distintas —5.3.0 y 4.9.0—, `ens-contracts`, `solady`, `verifiable-factory`, `unruggable-gateways`…) que el tutorial no menciona y que el `remappings.txt` de `contracts/` referencia con rutas relativas a ese subdirectorio. Desde un proyecto externo hay que escribir los remappings apuntando a `lib/contracts-v2/contracts/lib/...` uno por uno.

**Evidencia:** `packages/contracts/foundry.toml` (bloque `remappings`), `lib/contracts-v2/contracts/remappings.txt`, `git submodule status --recursive`.

**Impacto en Moor:** ~45 minutos. Y una consecuencia técnica real: como ENSv2 fija OZ 5.3.0 y SwapVM/Aqua 5.4.0, y el resolutor de Foundry no honra remappings por contexto, todo compila contra 5.4.0 — funciona, pero es una decisión que el tutorial no prepara.

**Reportado:** pendiente. Sugerencias: publicar tags (aunque sean `beta-YYYYMMDD`) para poder fijar versión; y una sección "consumir desde un proyecto Foundry externo" con la lista de remappings necesarios.

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

- [ ] El tutorial para desarrolladores de contratos no cubre **wildcard resolution** ni da las direcciones de Sepolia en la misma página — hay que confirmar que la tabla de despliegues fijada en el [05](../definicion/05_stack-y-arquitectura.md#11-pendientes) sigue vigente al momento de desplegar (fase 2).
- [ ] No quedó claro en la documentación cómo se **enumeran los subnombres** de un `UserRegistry` sin indexador propio (eventos vs `UniversalResolverV2`) — es la decisión que cierra la fase 2 del [07](../definicion/07_plan-de-trabajo.md); si la documentación no basta, es feedback.

---

## Resumen

| # | Área | Se documentaba | Se encontró | Severidad | Reportado |
| - | ---- | --------------- | ----------- | --------- | --------- |
| — | — | — | — | — | — |

## Reportes abiertos (se llena en fase 5)

- [ ] —
