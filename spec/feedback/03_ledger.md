# 03 — Feedback: Ledger

> **Alcance de este documento:** bitácora viva de lo que Ledger documenta o promete sobre la Wallet API, Clear Signing/ERC-7730, el Ledger Agent Stack y Speculos, frente a lo que encontramos al construir Moor. Se actualiza el día que algo aparece, no al final. **Es además el entregable que el track de Ledger pide** ("feedback on overall experience using Ledger docs & SDKs") — ver [03 — Bounties §3](../definicion/03_bounties.md#3-ledger--ai-agents-x-ledger").
> **Depende de:** [03 — Bounties §3](../definicion/03_bounties.md#3-ledger--ai-agents-x-ledger) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md) · [06 — Tecnologías](../definicion/06_tecnologias.md)

Stack en uso: `@ledgerhq/wallet-api-client`, `@ledgerhq/wallet-api-client-react`, `@ledgerhq/wallet-api-simulator`, Speculos, `wallet-cli ring` (Key Ring CLI), `erc7730` (Python).

---

## Lo que funcionó bien

_Se llena mientras se construye._

---

## Bitácora

_Sin entradas todavía — la fase 0 del [07](../definicion/07_plan-de-trabajo.md) es donde se prueba por primera vez la Wallet API y Speculos contra un contrato real._

<!--
### AAAA-MM-DD — Título corto del hallazgo

**Documentado / prometido:** qué dice la guía de la Wallet API, del DMK, de ERC-7730 o de Speculos.

**Encontrado:** qué pasó de verdad — mensaje de error completo, comportamiento del dispositivo o del emulador.

**Evidencia:** archivo:línea, comando exacto, captura de Speculos, hash de tx en Sepolia.

**Impacto en Moor:** ¿cambió una decisión del 05 o el 06? ¿costó horas? ¿fue una sorpresa sin consecuencia?

**Reportado:** enlace al issue/PR si se abrió, o "pendiente".
-->

---

## Cosas puntuales a vigilar (de la investigación previa a construir)

Huecos ya detectados en la documentación leída antes de escribir código, listados como riesgos en el [05 §10](../definicion/05_stack-y-arquitectura.md#10-riesgos-técnicos) y con fecha de verificación en el [07](../definicion/07_plan-de-trabajo.md):

- [ ] **6 sep** — ¿la Wallet API firma y transmite `data` arbitrario contra un contrato en Sepolia (`transaction.signAndBroadcast`), o solo transferencias simples? Ninguna página consultada lo dice con un ejemplo de llamada a contrato.
- [ ] **6 sep** — ¿cómo recibe la app de Ethereum en **Speculos** un descriptor ERC-7730 local, si el dispositivo real solo acepta descriptores firmados por el registro de Ledger? Es el mismo hueco que otro equipo documentó como "`withContextModule` parece self-serve pero no lo es en producción" — confirmar si aplica igual en Speculos.
- [ ] **Instalación del Key Ring CLI en Linux** y su flujo de enrolamiento en un host sin USB: la página del track lo describe en prosa; la documentación de `ai-tools` de Ledger, al momento de escribir esto, no menciona `wallet-cli ring` ni sus comandos.
- [ ] Tooling de **ERC-7730**: confirmar los límites de caracteres por campo (`intent`, `label`) antes del primer `lint`, para no descubrirlos a mitad de la fase 0.

---

## Resumen

| # | Área | Se documentaba | Se encontró | Severidad | Reportado |
| - | ---- | --------------- | ----------- | --------- | --------- |
| — | — | — | — | — | — |

## Reportes abiertos (se llena en fase 5)

- [ ] —
