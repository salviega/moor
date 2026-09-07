# 03 — Feedback: Ledger

> **Alcance de este documento:** bitácora viva de lo que Ledger documenta o promete sobre la Wallet API, Clear Signing/ERC-7730, el Ledger Agent Stack y Speculos, frente a lo que encontramos al construir Moor. Se actualiza el día que algo aparece, no al final. **Es además el entregable que el track de Ledger pide** ("feedback on overall experience using Ledger docs & SDKs") — ver [03 — Bounties §3](../definicion/03_bounties.md#3-ledger--ai-agents-x-ledger").
> **Depende de:** [03 — Bounties §3](../definicion/03_bounties.md#3-ledger--ai-agents-x-ledger) · [05 — Stack y arquitectura](../definicion/05_stack-y-arquitectura.md) · [06 — Tecnologías](../definicion/06_tecnologias.md)

Stack en uso: `@ledgerhq/wallet-api-client`, `@ledgerhq/wallet-api-client-react`, `@ledgerhq/wallet-api-simulator`, Speculos, `wallet-cli ring` (Key Ring CLI), `erc7730` (Python).

---

## Lo que funcionó bien

- **La app de Ethereum viene precompilada.** Los releases de `LedgerHQ/app-ethereum` (1.22.3) traen un ELF por dispositivo (`flex`, `stax`, `nanox`, `nanos2`, `apex_p`). Otro equipo documentó en un hackathon anterior que había que compilarla con la imagen Docker de `ledger-app-builder` (~8 GB); ya no. `gh release download` y listo. Esto vuelve viable Speculos en fase 0.
- **`erc7730 lint` es exacto y útil desde el primer intento.** Señala los límites del dispositivo (owner ≤ 22, URL ≤ 26) con el mensaje preciso, y degrada a aviso —no a error— cuando el ABI no se puede validar contra Sourcify/Etherscan porque el contrato aún no está desplegado. Es lo correcto para un flujo donde el descriptor se escribe antes que el despliegue.
- **La Wallet API hizo lo que promete al primer intento.** Desde Ledger Live Desktop con una Flex, `transaction.signAndBroadcast` con `amount` 0 y `data` de una llamada a contrato (`TestToken.mint`) en Ethereum Sepolia firmó y transmitió sin fricción: [`0x3160e91f…`](https://sepolia.etherscan.io/tx/0x3160e91f23a196f60c8dc8092c5e062ef9d97a399cd88d9a5c918c974321f392). El único aviso fue el esperado — sin descriptor ERC-7730, `mint` se muestra como llamada genérica.
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

**Resuelto (2026-09-05, fase 3):** sí es automatizable. El "ERC-7730 Tester" web tiene un hermano CLI, `apps/clear-signing-tester` en `LedgerHQ/device-sdk-ts` — ver la entrada siguiente.

### 2026-09-05 — Buscar "Sepolia" en *Add account* lleva a crear una cuenta de Arbitrum

**Documentado / prometido:** para usar una Live App en Sepolia hace falta una cuenta de *Ethereum Sepolia* en Ledger Live; la moneda existe (`ethereum_sepolia`, "Ethereum Sepolia", `isTestnetFor: "ethereum"`).

**Encontrado:** con el modo desarrollador de la pestaña *Developer* activo (el que permite cargar un manifest local), el selector *Select asset* de *Add account* devuelve para "SEPOLIA" **un solo resultado: "Sepolia ETH (SETH)"**, con icono genérico — un *token*, no la red. Elegirlo abre el flujo de **Arbitrum** y termina en "We couldn't add a new Arbitrum account — cannot be added before you receive assets". La red Ethereum Sepolia no aparece en esa búsqueda. El holder creó la cuenta equivocada y envió 1 ETH (por suerte por la red correcta, así que quedó en la dirección y no en Arbitrum).

**Evidencia:** [`img/2026-09-05-ledger-live-select-asset-sepolia.png`](./img/2026-09-05-ledger-live-select-asset-sepolia.png), [`img/2026-09-05-ledger-live-arbitrum-account-error.png`](./img/2026-09-05-ledger-live-arbitrum-account-error.png). Verificado con `cast balance` en ambas cadenas: 1.0 ETH en Ethereum Sepolia, 0 en Arbitrum Sepolia.

**Impacto en Moor:** media hora y una cuenta inútil. Sin consecuencia en el diseño, pero es exactamente la fricción que un juez de Ledger viviría al probar la demo si no está avisado.

**Reportado:** pendiente. Sugerencias: (1) que las redes de testnet aparezcan en *Select asset* cuando el modo desarrollador está activo, o que la búsqueda diga "activa Developer mode en Experimental features para ver redes de prueba"; (2) distinguir visualmente token vs. red en los resultados — "Sepolia ETH (SETH)" con una S genérica se lee como la red.

### 2026-09-05 — El Key Ring en un host sin USB: el track lo pide, la documentación no lo cubre

**Documentado / prometido:** la página del track dice literalmente *"Bring the Key Ring to hosts with no USB port: enroll a VPS, a CI runner, or a hosted agent"*. La página de `ledger-cli` y el README de `wallet-cli` describen `ring init` (dispositivo requerido, provisiona el trustchain) y `ring encrypt`/`decrypt` (sin dispositivo, con red).

**Encontrado:** ninguno de los dos documentos dice cómo un **segundo** host se vuelve miembro del trustchain — si se copian credenciales locales, si hay un flujo de *join*, si el dispositivo tiene que aprobar al nuevo miembro. `ring init` "set up this machine as a member" sugiere que hay un modelo de membresía, pero no está descrito.

**Evidencia:** `wallet-cli ring --help` (2.1.0); `developers.ledger.com/docs/ai-tools/ledger-cli`; `apps/wallet-cli/README.md` en `LedgerHQ/ledger-live`. `developers.ledger.com/docs/ai-tools/wallet-cli` devuelve 404 (el enlace correcto es `ledger-cli`).

**Impacto en Moor:** el agente en el VPS depende de esto (05 §7, 07 fase 0). Se resolverá probando con el dispositivo en la mano; mientras, es un pendiente con fecha.

**Reportado:** pendiente. Sugerencia: una guía "Key Ring on a headless host" con el flujo exacto de enrolamiento, ya que es uno de los dos ítems que el track destaca.

### 2026-09-05 — El simulador de la Wallet API no trae cuenta de Sepolia, y una cuenta añadida a mano falla en `lastSyncDate.toISOString`

**Documentado / prometido:** `@ledgerhq/wallet-api-simulator` 2.3 sirve para desarrollar una Live App sin Ledger Live; el perfil `STANDARD` trae cuentas de Bitcoin y Ethereum.

**Encontrado:** ninguna cuenta con `currency: "ethereum_sepolia"`, así que `account.request({ currencyIds: ["ethereum_sepolia"] })` lanza `No account available for the requested currencies` — y el hook `useRequestAccount` se traga el error en su estado sin nada en consola: el botón "no hace nada". Al extender el perfil con una cuenta escrita a mano (`{...profiles.STANDARD, accounts: [...]}`), `serializeAccount` revienta con `TypeError: lastSyncDate.toISOString is not a function`: el perfil espera cuentas ya pasadas por `deserializeAccount` (fecha como `Date`, balances como `BigNumber`), que es lo que hace internamente con su `accounts.json`, pero no está documentado ni tipado en la firma de `getSimulatorTransport`.

**Evidencia:** `node_modules/@ledgerhq/wallet-api-simulator/lib/profiles/standard/{index.js,accounts.json}`; `apps/live-app/src/lib/wallet-api.ts` (`simulatorProfile`, con `deserializeAccount` importado de `@ledgerhq/wallet-api-client`, que reexporta `wallet-api-core`).

**Impacto en Moor:** ~40 minutos. Ninguna decisión cambió.

**Reportado:** pendiente. Sugerencias: un perfil con cuentas de testnet (Sepolia al menos), o documentar cómo añadir una y que el tipo del perfil exija `Account` deserializado; y que `useRequestAccount` haga `console.error` en desarrollo cuando la petición falla.

### 2026-09-05 — Los hooks de `wallet-api-client-react` devuelven `void`, no el resultado

**Documentado / prometido:** `useSignAndBroadcastTransaction()` da `signAndBroadcastTransaction(...)` y un `transactionHash` en estado.

**Encontrado:** la función devuelve `Promise<void>`; el hash llega por estado en el siguiente render. Para una sesión de varias firmas encadenadas (approve → ship → createPosition, esperando cada recibo) eso no sirve: hay que usar `useWalletAPIClient().client.transaction.signAndBroadcast(...)`, que sí devuelve el hash. Funciona, pero el camino "con hooks" del tutorial se queda corto en el primer flujo real.

**Evidencia:** `node_modules/@ledgerhq/wallet-api-client-react/lib/hooks/useSignAndBroadcastTransaction.d.ts`; `apps/live-app/src/lib/session.tsx`.

**Impacto en Moor:** 15 minutos. Nota, no hallazgo.

**Reportado:** pendiente. Sugerencia: que las funciones de los hooks devuelvan lo mismo que el cliente.

### 2026-09-05 — El clear-signing tester de `device-sdk-ts` inyecta descriptores sin firmar en Speculos y guarda capturas: es `ledger:screens`

**Documentado / prometido:** la guía *Validate & Submit* solo menciona el Tester web. Nada enlaza el CLI.

**Encontrado:** `apps/clear-signing-tester` en `LedgerHQ/device-sdk-ts` (rama `develop`) hace exactamente lo que el track pide para CI: levanta Speculos en Docker con la app de Ethereum (`--custom-app` acepta el ELF precompilado de los releases), inyecta descriptores ERC-7730 **sin firmar** con `--erc7730-files` a través de su *CAL interceptor* (sirve descriptores y certificados a la Device Management Kit en lugar del CAL de producción), firma transacciones crudas y guarda una captura por pantalla con `--screenshot-folder-path`, con veredicto `clear_signed` / `partially_clear_signed` / `blind_signed` y código de salida. Con nuestros cuatro descriptores, cinco de las seis firmas del flujo salen **clear-signed** en un Flex emulado; `ledger:screens` lo envuelve (clon fijado a `bb0cc89381ca`, Node 24, Docker) y CI compara las capturas.

Tres cosas que costaron: (1) el paquete npm `@ledgerhq/ethereum-clear-signing-tester` es un snapshot de noviembre de 2025 sin `--erc7730-files` ni capturas — hay que compilar el monorepo (`pnpm install && pnpm build:libs`, ~3 min, Node ≥ 24); (2) `tokenAmount` con `tokenPath` muestra `1000000000 ???` para un token que no está en el CAL de Ledger (nuestros tokens de Sepolia): el descriptor es correcto, pero la pantalla no dice "1,000 tUSDC"; (3) `approve` sale a ciegas por la misma razón — es la pantalla ERC-20 propia de Ledger y necesita el token en el CAL. Lo que **no** resuelve: el dispositivo físico. Ledger Live no carga descriptores locales; la Flex firma a ciegas hasta que el registro los publique.

**Evidencia:** `packages/erc7730/scripts/screens.mjs`, `packages/erc7730/screens/*/` (55 capturas) y `screens/results.json`; `ship/05.png` ("Amount committed 1000000000 ???"); `approve/` (3 pantallas, sin descriptor).

**Impacto en Moor:** cierra el pendiente de `ledger:screens` (07, fase 3) que llevaba desde la fase 0, ~2 horas incluidas la búsqueda y la compilación. Cambió el 05 §10/§11 y el 06 §11.

**Reportado:** pendiente. Sugerencias: enlazar el CLI desde *Validate & Submit* y publicarlo en npm con `--erc7730-files`; permitir inyectar metadata de tokens (ticker, decimales) junto a los descriptores para que `tokenAmount` no muestre `???` en testnets; y una vía de desarrollador para cargar un descriptor local en Ledger Live (aunque sea con un aviso en pantalla), que hoy no existe.

### 2026-09-06 — La app de Ethereum 1.22.3 clear-signa llamadas anidadas con el formato `calldata` de ERC-7730 — y nada lo documenta

**Documentado / prometido:** el esquema ERC-7730 v1 define un formato de campo `calldata` ("the field is itself a calldata embedded in main call; another ERC 7730 should be used to parse this field", con `calleePath`/`amountPath`). Ninguna guía de Clear Signing de Ledger lo menciona, ni dice qué versión de la app lo soporta, ni cómo se comporta con `executeBatch` de una smart account. El equipo de Streams (mismo dispositivo, misma Flex) dejó escrito que "clear-signing of nested calls is limited".

**Encontrado:** funciona, y bien. Con un descriptor para `Simple7702Account.executeBatch((address,uint256,bytes)[])` cuyo `calls.[].data` es `format: "calldata"` con `calleePath: "calls.[].target"`, la Flex emulada (app 1.22.3, `clear-signing-tester` `bb0cc893`) muestra el intent del batch, los dos contratos, y luego **"Review transaction 1 of 2" / "2 of 2"** con cada llamada interna renderizada por *nuestros* descriptores de `ship` y `createPosition` — título, campos, records, todo en palabras del producto; ni una pantalla de calldata crudo. `erc7730 lint` 1.0.10 acepta el formato sin errores. Dos matices: (1) el tester lo clasifica `partially_clear_signed`, no `clear_signed`, sin decir qué campo lo degrada — lo único a medias visible es el `1000000000 ???` del token de Sepolia que ya tenía `ship` solo, y `ship` solo sí sale `clear_signed`; (2) el mismo batch enviado a la dirección del holder (la forma real de 7702: `to` = la propia EOA) sale a ciegas, porque un descriptor se ata a un `deployments[].address` y ninguno puede atarse a la EOA de cada usuario. El SDK tiene el mecanismo para resolverlo — `ProxyContextFieldLoader` pide a `metadata-service /v2/ethereum/{chainId}/contract/proxy/delegate` un descriptor **firmado por la PKI de Ledger** para la implementación detrás de un proxy — pero es del lado del servidor: si su backend trata el indicador `0xef0100‖delegado` como un proxy, el camino 7702 clear-signa en dispositivos reales; si no, nadie fuera de Ledger puede hacerlo.

**Evidencia:** `packages/erc7730/screens/batch7702Nested/` (22 capturas) y `batch7702Blind/` (3), `screens/results-probe.json`, `descriptors/probe/calldata-Simple7702Account.json`; reproducible con `pnpm ledger:screens -- --probe`. Código del SDK: `packages/signer/context-module/src/modules/ethereum/proxy/` en `device-sdk-ts` `bb0cc893`.

**Dispositivo físico, la misma tarde (`apps/probe-7702`, Flex, cuenta `0xAA1a…62E1`, Ledger Live cerrado, DMK por WebHID):** la app firmó la autorización 7702 — en claro, "Delegate to Simple7702Account · Sepolia" — y la transacción tipo 4 auto-patrocinada ([`0xedec5af4…`](https://sepolia.etherscan.io/tx/0xedec5af4b36d7f073f63c0cafb1386d9553a00fb8ec9e5bb369977615a4f938f), 36 837 gas; la doc del signer no dice que `signTransaction` acepte tipo 4, y lo acepta). Después, **una posición entera con una firma**: `executeBatch([ship, createPosition])` a la propia dirección, tipo 2 normal ([`0xe4a7fdea…`](https://sepolia.etherscan.io/tx/0xe4a7fdea0a2d7565efafffb5db24de991adb5cf035190105ede47c52c0f46c2c), 957 608 gas): `Shipped` en Aqua, nombre registrado, ocho records, `PositionCreated`. Lo que mostró la pantalla en esa firma no lo dice un log, y el recuerdo de quien firmó ("las palabras de nuestro descriptor") **no puede ser cierto**: `pnpm --filter @moor/probe-7702 cal` construye el mismo `ContextModule` que usa el signer y pregunta a los servidores de Ledger lo que la app recibiría — para Aqua, MoorRegistrar, la EOA delegada y `Simple7702Account` la respuesta es *ningún descriptor de calldata*, en Sepolia, mainnet y Base (solo `ethereumDynamicNetwork`, el nombre e icono de la red); el control `USDC.approve` en mainnet devuelve `ethereumTransactionInfo` firmado. Con blind signing activado en la app, la Flex firmó el batch a ciegas con su aviso, igual que firma `ship` solo desde Ledger Live. La forma de saber qué muestra una pantalla es la foto o la captura de Speculos; el recuerdo no vale como evidencia.

**Impacto en Moor:** el camino de "un flujo, una firma" del [08 §2.3](../definicion/08_roadmap.md#23-smart-accounts-y-eip-7702) funciona de punta a punta en el dispositivo real y en Sepolia; lo que lo detiene no es la Ledger sino el **registro**: Ledger acepta un único delegado 7702 y **no tiene descriptor para su `executeBatch` en ninguna red**, así que todo batch 7702 firmado con una Ledger es hoy ciego por construcción, con o sin Moor. La incógnita de la resolución del delegado detrás de una EOA queda detrás de ese paso. Lo que sí podemos hacer nosotros: publicar en el registro ERC-7730 el descriptor de `Simple7702Account.executeBatch` con `calldata` anidado (el de `descriptors/probe/`) junto a los de Moor.

**Reportado:** el punto 3 lo hicimos nosotros el 7 de septiembre — dos PRs al registro (una entidad por PR, esquema v2, fixtures `testsv2/` construidos con los mismos builders de la Live App): [ethereum/clear-signing-erc7730-registry#2953](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2953) (`MoorRegistrar` + Aqua en Sepolia) y [#2954](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2954) (`Simple7702Account`: `execute` y `executeBatch` con `calldata` anidado). Al convertir a v2: `required`/`excluded` ya no existen — cada parámetro lleva `visible: "always" | "never"` — y el linter 1.0.10 pide un campo también para la ruta contenedora de un array (`#.records.[]`, `#.calls.[]`) aunque sus hijos estén cubiertos; el propio descriptor de Morpho lo dispara. Pendiente de enviar a Ledger como sugerencias: (1) documentar el formato `calldata` anidado en la guía de Clear Signing, con la versión mínima de la app y un ejemplo con `executeBatch`; (2) que el tester diga *qué* campo hace "parcial" un veredicto; (4) documentar si el metadata service resuelve descriptores para EOAs delegadas por 7702 (`ProxyContextFieldLoader`), que es lo que haría útil el #2954 en la forma real (`to` = la EOA); (5) documentar que `signTransaction` acepta tipo 4.

<!--
### 2026-09-07 — Un `format: "calldata"` anidado solo resuelve contra lo que ya está fusionado en el registro

**Documentado / prometido:** nada dice explícitamente que la resolución de un campo `calldata` anidado dependa del estado de `master`, pero `index.calldata.json` en la raíz del registro mapea cada `eip155:$chainId:$address` a su descriptor (README, sección *Index files*) — es razonable asumir que ese índice es lo que un `calleePath` consulta para encontrar el descriptor del contrato llamado.

**Encontrado:** el CI del registro corrió las pruebas de `#2954` (`Simple7702Account`, `calldata` anidado sobre `ship`/`createPosition`) contra su propia rama, `eth-infinitism-simple7702account`, que sale de `master` **antes** de que `#2953` (los descriptores de Aqua y MoorRegistrar, la entidad `moor`) se fusionara — confirmado pidiendo `registry/moor/` en esa rama vía la API (404) y buscando la dirección de Aqua/MoorRegistrar en su `index.calldata.json` (ninguna entrada). Las cuatro pruebas de `#2954` (execute/executeBatch × dos motores) fallan igual: el campo anidado llega como calldata crudo en hex en vez de interpretarse — `"field kind at [1] 'Action': expected nested, got scalar"`. No es un descriptor mal escrito: es que el entorno de pruebas de un PR no ve los descriptores de otro PR todavía sin fusionar, aunque ambos estén abiertos a la vez y se necesiten mutuamente.

**Evidencia:** [ethereum/clear-signing-erc7730-registry#2954](https://github.com/ethereum/clear-signing-erc7730-registry/pull/2954), comentario del bot de CI del 2026-09-07 03:27 UTC (`actions/runs/34079633063`); `#2953` en la misma fecha, mismo bot, 5/5 pruebas en verde (`actions/runs/34079629207`) — la entidad que no depende de nada pasa; la que depende de otro PR abierto, no.

**Impacto en Moor:** ninguno sobre el producto — el batch 7702 en Sepolia ya está probado y funciona (entrada del 6 de septiembre arriba). Es una nota sobre cómo enviar PRs a un registro con dependencias cruzadas entre entidades: si dos entradas se citan una a la otra por dirección, hay que fusionar (o al menos rebasear) la que no depende de nada primero, o abrir ambas desde la misma rama, para que el CI de la segunda vea a la primera.

**Reportado:** comentario dejado en `#2954` explicando la causa y pidiendo que se fusione `#2953` primero (o se re-corra el CI de `#2954` tras rebasear sobre `master` una vez `#2953` esté dentro).

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
