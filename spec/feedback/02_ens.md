# 02 — Feedback: ENS (ENSv2)

> **Alcance de este documento:** bitácora viva de lo que ENS documenta o promete sobre ENSv2 — Permissioned Registry, Permissioned Resolver, Enhanced Access Control — frente a lo que encontramos al construirlo dentro de Moor. Se actualiza el día que algo aparece, no al final.
> **Depende de:** [03 — Bounties §2](../definicion/03_bounties.md#2-ens--best-use-of-ensv2) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md)

Stack en uso: `ensdomains/contracts-v2` (`main`), ENSv2 beta en Sepolia — direcciones fijadas en [05 §11](../definicion/05_stack-y-arquitectura.md#11-pendientes).

---

## Lo que funcionó bien

- **`authorizeTextRoles(name, key, account, grant)` es exactamente la primitiva que un agente necesita.** Permiso de escritura sobre *una* clave de text record, en un nombre o en todos (`name = 0x00`), revocable con el mismo método. Convirtió el diseño "un subnombre por posición para el agente" en "una identidad por holder y ocho claves", con menos nombres y la misma garantía. (2026-09-05, fase 2)
- **Las implementaciones de Sepolia están verificadas en Sourcify con `exact_match`** (`UserRegistryImpl` `0x624a…2050`, `PermissionedResolverImpl` `0x9EAe…365e`), así que el ABI contra el que compilamos es el que corre. Y `VerifiableFactory.deployProxy` funcionó a la primera desde un script Foundry externo.
- **`LabelRegistered` lleva el label en claro.** Enumerar los subnombres de un `UserRegistry` es un solo `eth_getLogs`; no hizo falta indexador ni recorrer `UniversalResolverV2`. Cerró un pendiente que arrastrábamos desde el 05.

---

## Bitácora

### 2026-09-05 — `contracts-v2` no publica tags y el proyecto Foundry vive en un subdirectorio

**Documentado / prometido:** el tutorial para desarrolladores de contratos dice `forge install ensdomains/contracts-v2` y luego importa `IPermissionedRegistry`, `RegistryRolesLib`, etc.

**Encontrado:** el repo no tiene releases ni tags, así que `forge install` queda en `main` y solo se puede fijar por commit en `.gitmodules` (`48b3e2d3`). El proyecto Foundry no está en la raíz sino en `contracts/`, con diez submódulos anidados propios (dos OpenZeppelin distintas —5.3.0 y 4.9.0—, `ens-contracts`, `solady`, `verifiable-factory`, `unruggable-gateways`…) que el tutorial no menciona y que el `remappings.txt` de `contracts/` referencia con rutas relativas a ese subdirectorio. Desde un proyecto externo hay que escribir los remappings apuntando a `lib/contracts-v2/contracts/lib/...` uno por uno.

**Evidencia:** `packages/contracts/foundry.toml` (bloque `remappings`), `lib/contracts-v2/contracts/remappings.txt`, `git submodule status --recursive`.

**Impacto en Moor:** ~45 minutos. Y una consecuencia técnica real: como ENSv2 fija OZ 5.3.0 y SwapVM/Aqua 5.4.0, y el resolutor de Foundry no honra remappings por contexto, todo compila contra 5.4.0 — funciona, pero es una decisión que el tutorial no prepara.

**Reportado:** pendiente. Sugerencias: publicar tags (aunque sean `beta-YYYYMMDD`) para poder fijar versión; y una sección "consumir desde un proyecto Foundry externo" con la lista de remappings necesarios.

### 2026-09-05 — Los roles del Permissioned Resolver son por clave, no por tipo de record

**Documentado / prometido:** la documentación de ENSv2 leída antes de construir (Enhanced Access Control, Permissioned Resolver) describe los recursos como "nombre + tipo de record" (text, addr, contenthash…). Con eso diseñamos el 03 §3 y el 05 §7: el agente no podía escribir en el nombre de la posición sin poder pisar `moor.strategy`, así que necesitaba su propio subnombre por posición.

**Encontrado:** `PermissionedResolver.authorizeTextRoles(bytes name, string key, address account, bool grant)` otorga `ROLE_SET_TEXT` sobre el recurso `keccak(namehash, keccak(key))` — **por clave**. `name = hex"00"` (la raíz) significa "cualquier nombre de este resolver". Hay `authorizeRoles` análogo para los demás tipos.

**Evidencia:** `lib/contracts-v2/contracts/src/resolver/PermissionedResolver.sol` (`authorizeTextRoles`) y `PermissionedResolverLib.sol` (`resource(node, part)`, `partHash(key)`); `packages/contracts/test/MoorRegistrar.t.sol` — el agente escribe `moor.agent.proposal` en `btc-dip.salviega.eth` y `moor.strategy` revierte con `EACUnauthorizedAccountRoles`. Reproducido en Sepolia (fork) con `cast send`.

**Impacto en Moor:** positivo y grande. Cambió el 03 §2–3, el 04 §3/§4/§6 y el 05 §7: una identidad de agente por holder (`agent.<holder>.eth`) en lugar de un subnombre por posición, y sin desplegar resolver propio. Media hora de relectura de código; ninguna hora perdida porque se descubrió antes de escribir el contrato.

**Reportado:** pendiente. Sugerencia: que la guía del Permissioned Resolver muestre `authorizeTextRoles` con un ejemplo de "un servicio puede escribir solo esta clave" — es el caso de uso agente que el bonus de ENS pide, y hoy solo se ve en el código.

### 2026-09-05 — Las carpetas `deployments/` del repo no coinciden con las direcciones vivas de Sepolia, y los proxies no están en Sourcify

**Documentado / prometido:** `contracts-v2/contracts/deployments/` sugiere ser la fuente de direcciones por red; app.ens.dev es la app oficial de la beta.

**Encontrado:** las direcciones que usa app.ens.dev en Sepolia (ETHRegistry `0xbdc8…f0e2`, VerifiableFactory `0x10dc…d7ef`, UserRegistryImpl `0x624a…2050`, UniversalResolverV2 `0x4a18…3c70`) no salen de las carpetas del repo al commit fijado; se obtuvieron leyendo la cadena (`UniversalResolverV2.findResolver`, `getSubregistry`) y la app. Además `ETHRegistry` `0xbdc8…f0e2` y el proxy del resolver `0xc93A…e363` **no están verificados en Sourcify** (`match: null`), así que `erc7730 lint` no puede validar el ABI de los descriptores de `PermissionedRegistry`/`PermissionedResolver` contra ellos (solo avisa; las implementaciones sí están).

**Evidencia:** `curl https://sourcify.dev/server/v2/contract/11155111/0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` → `match: null`; salida de `erc7730 lint packages/erc7730/descriptors/calldata-PermissionedRegistry.json` ("contract source is not available on Sourcify"); tabla del 05 §11.

**Impacto en Moor:** ~30 minutos para fijar las direcciones a mano. Riesgo asumido: si la beta redespliega, la tabla del 05 §11 y `packages/core/src/addresses.ts` quedan viejas sin aviso.

**Reportado:** pendiente. Sugerencia: una tabla única de direcciones de la beta en la documentación (con fecha), y verificar los proxies en Sourcify — a Ledger le sirve para Clear Signing y a cualquiera para leer el ABI.

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

- [x] ~~El tutorial para desarrolladores de contratos no cubre **wildcard resolution** ni da las direcciones de Sepolia en la misma página — hay que confirmar que la tabla de despliegues fijada en el [05](../definicion/05_stack-y-arquitectura.md#11-pendientes) sigue vigente al momento de desplegar (fase 2).~~ Confirmado el 5 de septiembre leyendo la cadena; la entrada de arriba sobre `deployments/` es el resultado.
- [x] ~~No quedó claro en la documentación cómo se **enumeran los subnombres** de un `UserRegistry` sin indexador propio (eventos vs `UniversalResolverV2`).~~ Resuelto con el evento `LabelRegistered` (arriba, en *Lo que funcionó bien*). La documentación no lo dice; el código sí.

---

## Resumen

| # | Área | Se documentaba | Se encontró | Severidad | Reportado |
| - | ---- | --------------- | ----------- | --------- | --------- |
| 1 | Consumo desde Foundry | `forge install` + imports del tutorial | Sin tags; proyecto en subdirectorio; remappings a mano; OZ 5.3 vs 5.4 | Media | pendiente |
| 2 | Permissioned Resolver | Roles por tipo de record | Roles **por clave** (`authorizeTextRoles`) — mejor que lo documentado | Nota (positiva) | pendiente |
| 3 | Direcciones de la beta | Carpetas `deployments/` del repo | No coinciden con app.ens.dev; proxies sin verificar en Sourcify | Baja | pendiente |

## Reportes abiertos (se llena en fase 5)

- [ ] —
