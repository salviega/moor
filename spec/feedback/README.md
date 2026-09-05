# Feedback a los sponsors — índice

Bitácora viva de lo que **1inch**, **ENS** y **Ledger** documentan o prometen frente a lo que de verdad encontramos al construir Moor. No es una opinión al final del hackathon: cada entrada se escribe **el mismo día** que se descubre algo, con la evidencia a la mano — un archivo:línea, un mensaje de error exacto, un hash de transacción, una captura de Speculos.

No es una queja unilateral: cada archivo abre con lo que funcionó bien. Un patrocinador que documenta algo correctamente merece que quede escrito tanto como uno que no.

| Sponsor | Archivo | Para qué además sirve |
| --- | --- | --- |
| 1inch | [01_1inch.md](./01_1inch.md) | Evidencia de que se probó Aqua/SwapVM a fondo, más allá del happy path |
| ENS | [02_ens.md](./02_ens.md) | Cumple "identify gaps, confusing flows, missing context" si ENSv2 lo pide en su calificación |
| Ledger | [03_ledger.md](./03_ledger.md) | El entregable que Ledger explícitamente pide: feedback de docs y SDKs, con mejoras concretas |

## Cómo se usa cada archivo

1. **Se escribe en el momento**, no de memoria al final. Si algo sorprende durante una fase del [07](../definicion/07_plan-de-trabajo.md), es feedback — se anota antes de resolverlo, porque la sorpresa es el dato.
2. **Formato de cada entrada:** qué se documentaba o se esperaba, qué se encontró en la práctica, la evidencia exacta, el impacto que tuvo en Moor (¿cambió una decisión? ¿costó horas? ¿fue solo una sorpresa sin consecuencia?), y si se reportó aguas arriba.
3. **La severidad no se infla.** Una diferencia entre lo documentado y lo real que no costó nada es una nota, no un hallazgo. Se distingue en la tabla resumen de cada archivo.
4. **Al cerrar cada fase del [07](../definicion/07_plan-de-trabajo.md)**, se revisa si algo de esa fase merece una entrada aquí — es el mismo hábito que revisar si la `spec/` quedó desactualizada.
5. **Antes de enviar (fase 5),** cada archivo cierra con una sección de "reportes abiertos": qué se envió aguas arriba (issue, PR, formulario del sponsor) y qué quedó solo documentado aquí.

## Qué entra y qué no

**Entra:** una discrepancia entre lo que un README, una guía o un tipo de la SDK dice y lo que el código hace; un error opaco que costó tiempo entender; un límite no documentado (de contrato, de dispositivo, de API); algo que funcionó mejor de lo esperado y vale la pena decirlo.

**No entra:** un error nuestro (una llamada mal armada, un ABI desactualizado a mano) — eso es un bug de Moor, no feedback al sponsor. Si la duda es genuina, se anota con esa pregunta abierta en vez de asumir de qué lado está.
