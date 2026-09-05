# 01 — Feedback: 1inch (Aqua / SwapVM)

> **Alcance de este documento:** bitácora viva de lo que 1inch documenta o promete sobre Aqua y SwapVM, frente a lo que encontramos al construirlos dentro de Moor. Se actualiza el día que algo aparece, no al final.
> **Depende de:** [03 — Bounties §1](../definicion/03_bounties.md#1-1inch--build-an-aqua-app) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md)

Stack en uso: `1inch/swap-vm` (`main`), `1inch/aqua` (`main`), `@1inch/aqua-sdk` 0.3.1. Redespliegue propio en Sepolia — ver [05 §1](../definicion/05_stack-y-arquitectura.md#1-decisiones).

---

## Lo que funcionó bien

_Se llena mientras se construye. Primer candidato ya visible desde la investigación: el catálogo `docs/PROGRAMS.md` de SwapVM da ejemplos de composición de instrucciones que evitan tener que leer el bytecode a mano._

---

## Bitácora

### 2026-09-05 — Los paquetes npm que anuncian los READMEs no existen

**Documentado / prometido:** el README de SwapVM muestra un badge de npm para `@1inch/swap-vm`, y el de Aqua para `@1inch/aqua`. Sus `remappings.txt` apuntan a `node_modules/` (`@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/`, `@1inch/aqua/=node_modules/@1inch/aqua/`), y `swap-vm/package.json` depende de `"@1inch/aqua": "github:1inch/aqua#v1.0.0"`.

**Encontrado:** `npm view @1inch/swap-vm version` y `npm view @1inch/aqua version` no devuelven nada (5 de septiembre de 2026). Los repos son híbridos Hardhat/Foundry cuyo flujo esperado es `yarn install` dentro del propio repo; consumirlos desde otro proyecto Foundry con `forge install` funciona, pero hay que proveer uno mismo OpenZeppelin 5.4.0 y `@1inch/solidity-utils` 6.9.x como submódulos y escribir los remappings a mano. `@1inch/aqua-sdk` (TypeScript) sí está publicado.

**Evidencia:** `packages/contracts/foundry.toml` (bloque `remappings`), `lib/swap-vm/remappings.txt`, `lib/aqua/remappings.txt`, `lib/swap-vm/package.json`.

**Impacto en Moor:** ~1 hora de la fase 0 en averiguar el layout y las versiones exactas. Ninguna decisión cambió; reforzó la de Foundry sobre Hardhat, porque con Hardhat habría empezado copiando fuentes a mano.

**Reportado:** pendiente. Sugerencia concreta: o publicar los paquetes que los badges anuncian, o documentar en el README el consumo desde Foundry externo con las dos dependencias y los remappings.

### 2026-09-05 — `Revert` está documentado como instrucción de control de flujo, pero el router de Aqua no lo despacha

**Documentado / prometido:** `docs/PROGRAMS.md` lista `Revert` entre las instrucciones de control de flujo disponibles para componer programas, y `src/instructions/Controls.sol` lo implementa (`InstructionRevert(bytes)`).

**Encontrado:** `src/opcodes/AquaOpcodes.sol` (el set que despacha `AquaSwapVMRouter`) no incluye `Revert`; solo `Opcodes.sol` (router genérico) lo tiene. Un programa Aqua con `Revert` revierte con `UnknownOpcode(1)` — falla, pero con un error ajeno. Descubierto por la prueba que esperaba `InstructionRevert(MoorWrongDirection)`.

**Evidencia:** `lib/swap-vm/src/opcodes/AquaOpcodes.sol` (`_runOpcode`), `lib/swap-vm/src/opcodes/Opcodes.sol:48`, `packages/contracts/test/MoorProgram.t.sol` (primera corrida).

**Impacto en Moor:** cambió la trampa de dirección a `Deadline(0)` — sí despachado, determinista y de 7 bytes — con la lectura "esa dirección venció en la época 0". Media hora.

**Reportado:** pendiente. Sugerencia: o despachar `Revert` (y `Stop`) en `AquaOpcodes`, o marcar en `PROGRAMS.md` qué instrucciones existen en cada set de opcodes.

### 2026-09-05 — El catálogo de instrucciones del README usa nombres que no existen en el código

**Documentado / prometido:** el README de SwapVM presenta el set de instrucciones con nombres como `_xycConcentrateGrowLiquidityXD`, `_xycConcentrateGrowPriceRange2D`, `_limitSwapOnlyFull1D`, `_jumpIfTokenIn`, `_deadline`, `_oraclePriceAdjuster1D`… (30 en total, con sufijos `1D`/`2D`/`XD`).

**Encontrado:** ninguno de esos 30 nombres aparece en `src/`. Las librerías reales se llaman `XYCConcentrateSwap`, `LimitSwapFullAmount`, `JumpIfTokenIn`, `Deadline`, `OraclePriceAdjuster`… y algunas distinciones del README (`GrowLiquidity` vs `GrowPriceRange`) no existen como opcodes separados — hay un solo `XYCConcentrateSwap`. `docs/PROGRAMS.md` sí usa los nombres del código. Quien diseña leyendo el README (nosotros, durante toda la spec) llega al código con un vocabulario que no encaja; el mapeo hay que reconstruirlo abriendo `OpcodeList.sol`.

**Evidencia:** `grep -oE "_[a-zA-Z]+(1D|2D|XD)" README.md` → 30 nombres; `grep -rl <nombre> src/` → 0 archivos para cada uno; `src/libs/OpcodeList.sol` y `src/instructions/*.sol` para los nombres reales.

**Impacto en Moor:** el 05 se escribió con los nombres del README (`_dynamicBalancesXD → _jumpIfTokenIn → _xycConcentrateGrowLiquidityXD`) y hubo que reescribirlo en la fase 1. Un par de horas de lectura que `PROGRAMS.md` habría ahorrado si el README apuntara a él como fuente de nombres.

**Reportado:** pendiente. Sugerencia: alinear el README con `OpcodeList.sol` (o añadir una tabla nombre-del-README → librería), y enlazar `PROGRAMS.md` desde la sección de instrucciones.

**Lo que el README sí acierta:** dice explícitamente que en modo Aqua no hay instrucción de balances ("Balance Instruction: None — Aqua manages"). Nuestro 05 lo pasó por alto; eso fue error de lectura nuestro, no del documento.

### 2026-09-05 — Lo que funcionó: `CoreInvariants` y la base de pruebas Aqua se reutilizan tal cual

**Encontrado:** `test/invariants/CoreInvariants.t.sol` es un contrato abstracto con un solo método que implementar (`_executeSwap`) y una configuración por struct; `test/base/AquaSwapVMTest.sol` trae `shipStrategy`, `swap`, `quote` y un `MockTaker` listos. Desde un proyecto externo con `forge install`, un programa nuevo tiene su suite de invariantes en ~80 líneas. Es lo que decidió la compuerta del plan en una tarde.

### 2026-09-05 — Lo que funcionó: el redespliegue reproduce el bytecode oficial

**Encontrado:** `Aqua` compilado desde el submódulo `v1.0.0` con los ajustes de su `foundry.toml` (solc 0.8.30, via-IR) y desplegado en Sepolia (0xB8747B3e2F90154420165FB2fc4707D638797140) verifica en Sourcify con **`exact_match`** — mismo bytecode y metadata que la fuente. Es lo que hace defendible "official contracts" ante el jurado aun sin despliegue oficial en testnet: la reproducibilidad está.

### 2026-09-05 — Lo que funcionó: instalación limpia con tags

**Encontrado:** `forge install 1inch/swap-vm` y `forge install 1inch/aqua` resuelven al último tag (`v1.0.2`, `v1.0.0`) sin pedir nada, y la combinación SwapVM + Aqua + OZ 5.4.0 + solidity-utils 6.9.10 compila en limpio con solc 0.8.30 via-IR — mismos ajustes que sus `foundry.toml`. Cero fricción una vez resuelto lo anterior.

<!--
### AAAA-MM-DD — Título corto del hallazgo

**Documentado / prometido:** qué dice el README, la guía o el tipo de la SDK.

**Encontrado:** qué pasó de verdad.

**Evidencia:** archivo:línea, comando exacto, mensaje de error completo, hash de tx en Sepolia.

**Impacto en Moor:** ¿cambió una decisión del 05? ¿costó horas? ¿fue una sorpresa sin consecuencia?

**Reportado:** enlace al issue/PR si se abrió, o "pendiente".
-->

---

## Preguntas abiertas para los mentores

- [ ] ¿Un redespliegue sin modificar de Aqua y SwapVM en Sepolia cuenta como "official contracts" para la calificación? (Pregunta de la fase 0 del [07](../definicion/07_plan-de-trabajo.md).)

---

## Resumen

| # | Área | Se documentaba | Se encontró | Severidad | Reportado |
| - | ---- | --------------- | ----------- | --------- | --------- |
| — | — | — | — | — | — |

## Reportes abiertos (se llena en fase 5)

- [ ] —
