# 03 — Feedback: Ledger

> **Alcance de este documento:** bitácora viva de lo que Ledger documenta o promete sobre la Wallet API, Clear Signing/ERC-7730, el Ledger Agent Stack y Speculos, frente a lo que encontramos al construir Moor. Se actualiza el día que algo aparece, no al final. **Es además el entregable que el track de Ledger pide** ("feedback on overall experience using Ledger docs & SDKs") — ver [03 — Bounties §3](../definicion/03_bounties.md#3-ledger--ai-agents-x-ledger").
> **Depende de:** [03 — Bounties §3](../definicion/03_bounties.md#3-ledger--ai-agents-x-ledger) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md) · [06 — Tecnologías](../definicion/06_tecnologias.md)

Stack en uso: `@ledgerhq/wallet-api-client`, `@ledgerhq/wallet-api-client-react`, `@ledgerhq/wallet-api-simulator`, Speculos, `wallet-cli ring` (Key Ring CLI), `erc7730` (Python).

---

## Lo que funcionó bien

- **La app de Ethereum viene precompilada.** Los releases de `LedgerHQ/app-ethereum` (1.22.3) traen un ELF por dispositivo (`flex`, `stax`, `nanox`, `nanos2`, `apex_p`). Otro equipo documentó en un hackathon anterior que había que compilarla con la imagen Docker de `ledger-app-builder` (~8 GB); ya no. `gh release download` y listo. Esto vuelve viable Speculos en fase 0.
- **`erc7730 lint` es exacto y útil desde el primer intento.** Señala los límites del dispositivo (owner ≤ 22, URL ≤ 26) con el mensaje preciso, y degrada a aviso —no a error— cuando el ABI no se puede validar contra Sourcify/Etherscan porque el contrato aún no está desplegado. Es lo correcto para un flujo donde el descriptor se escribe antes que el despliegue.
- **`wallet-cli` se instala con un `npm i -g`** y `ring --help` explica el modelo en cinco líneas: `init` con dispositivo, `encrypt`/`decrypt` sin dispositivo y con red, `keys`, `destroy`. Salida JSON estructurada — pensada para agentes.

---

## Bitácora

### 2026-09-05 — `pip install speculos` instala, pero no corre sin `qemu-user-static`

**Documentado / prometido:** el README de Speculos ofrece `pip install speculos` como vía recomendada; `qemu-user-static` aparece solo en la lista de paquetes `apt` de la instalación "desde fuente".

**Encontrado:** el paquete de pip instala bien y `speculos --help` funciona, pero al arrancar cualquier app falla con `speculos: failed to execute qemu: "qemu-arm-static" not found` — después de haber parseado el ELF y levantado el servidor APDU, así que el error llega tarde y sin la instrucción de qué instalar.

**Evidencia:** `.venv/bin/speculos --model flex --display headless … app-1.22.3-flex.elf` → log en la sesión del 5 de septiembre; `packages/erc7730/scripts/emu.mjs` ahora comprueba `qemu-arm-static` antes de arrancar y lo dice.

**Impacto en Moor:** una hora entre diagnosticar y documentar; y una dependencia `sudo` que no puede instalar un script del repo. Sin consecuencia en el diseño. **Resuelto el mismo día:** con `qemu-user-static` instalado, Speculos arranca la app precompilada 1.22.3 y responde APDUs (`getAppConfiguration`, `getPublicKey`) al primer intento.

**Reportado:** pendiente. Sugerencia: que el README ponga `qemu-user-static` junto al `pip install`, o que Speculos lo compruebe al inicio con un mensaje que nombre el paquete.

### 2026-09-05 — Existe un "ERC-7730 Tester", pero no se sabe cómo pasa la PKI

**Documentado / prometido:** la guía *Validate & Submit* de Clear Signing enlaza un **ERC-7730 Tester** (`app.devicesdk.ledger.com/clear-signing-tools`) que "inyecta tu descriptor y muestra los campos resultantes contra un dispositivo real o Speculos", como paso previo al PR al registro.

**Encontrado:** es exactamente lo que hace falta para verificar un descriptor propio antes de publicarlo — y contradice la experiencia documentada por otro equipo de que un descriptor local no puede renderizarse porque el dispositivo exige la firma PKI de Ledger. Lo que la página **no** dice: si el Tester usa una build de la app con PKI de prueba, si Ledger firma el descriptor al vuelo, o si hace falta un dispositivo/Speculos en un modo especial. Tampoco si es automatizable (para `ledger:screens` en CI) o solo interactivo en el navegador.

**Evidencia:** `developers.ledger.com/docs/clear-signing/for-dapps/validate-submit`; `packages/erc7730/descriptors/calldata-Aqua.json` listo para probarlo.

**Impacto en Moor:** cambia el plan de `ledger:screens` (07, fase 3): de "imposible sin el registro" a "posible con el Tester, quizá no automatizable". Se decide en la fase 3.

**Reportado:** pendiente. Sugerencia: documentar el mecanismo del Tester (qué firma qué) y si expone una CLI/API para CI.

### 2026-09-05 — El Key Ring en un host sin USB: el track lo pide, la documentación no lo cubre

**Documentado / prometido:** la página del track dice literalmente *"Bring the Key Ring to hosts with no USB port: enroll a VPS, a CI runner, or a hosted agent"*. La página de `ledger-cli` y el README de `wallet-cli` describen `ring init` (dispositivo requerido, provisiona el trustchain) y `ring encrypt`/`decrypt` (sin dispositivo, con red).

**Encontrado:** ninguno de los dos documentos dice cómo un **segundo** host se vuelve miembro del trustchain — si se copian credenciales locales, si hay un flujo de *join*, si el dispositivo tiene que aprobar al nuevo miembro. `ring init` "set up this machine as a member" sugiere que hay un modelo de membresía, pero no está descrito.

**Evidencia:** `wallet-cli ring --help` (2.1.0); `developers.ledger.com/docs/ai-tools/ledger-cli`; `apps/wallet-cli/README.md` en `LedgerHQ/ledger-live`. `developers.ledger.com/docs/ai-tools/wallet-cli` devuelve 404 (el enlace correcto es `ledger-cli`).

**Impacto en Moor:** el agente en el VPS depende de esto (05 §7, 07 fase 0). Se resolverá probando con el dispositivo en la mano; mientras, es un pendiente con fecha.

**Reportado:** pendiente. Sugerencia: una guía "Key Ring on a headless host" con el flujo exacto de enrolamiento, ya que es uno de los dos ítems que el track destaca.

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
