# ETAPA 5.1 — Importação piloto real

## PILOTO 01 — PRESSÃO REDE

- Arquivo: `pressao rede.csv`
- SHA-256 abreviado: `e6b9ce8c1a41b4ef…`
- Import ID: `c39789ea-15ef-46ff-ba77-980b6a46fc94`
- Status: `COMPLETED`
- Origem: `SUPPLY_OUTLET / REDE`, sem DMC
- Cabeçalho: não possui (`has_header = false`)
- Encoding/delimitador: UTF-8 / `;`
- Timezone: `America/Sao_Paulo`
- Mapeamento: Coluna 1 = `TIMESTAMP`; Coluna 2 = `PRESSURE_SUPPLY`, `mca`
- Período: 01/11/2025 00:00 a 31/08/2026 18:00
- Linhas físicas/dados/RAW: 27.659 / 27.659 / 27.659
- Rejeições: 0
- Flags: 27 (`MISSING_TIMESTAMP`: 26; `ZERO_STREAK`: 1; demais: 0)
- Gaps: 26; maior gap 3.915 minutos (65h15)
- Duplicidades/nulos/erros numéricos: 0 / 0 / 0
- Mínimo/máximo brutos descritivos: 0,00 / 41,74 mca

Sanity checks aprovados: primeira leitura 01/11/2025 00:00 = 25,00 mca; segunda 00:15 = 25,08 mca; linha 13.830 em 26/03/2026 08:30 = 25,39 mca; última em 31/08/2026 18:00 = 24,86 mca. A primeira linha foi preservada. A view validada manteve valor/unidade, sem invalidação artificial.

A idempotência encontrou exatamente um import para o mesmo hash/origem/contexto, sem segunda confirmação ou duplicação. UPDATE e DELETE de RAW foram bloqueados no teste transacional de RLS. O arquivo original permanece no bucket privado `hydraulic-imports`; nenhum expurgo ou resultado CPE/IAL/IPS foi criado.

## PILOTO 02 — VAZÃO REDE

- Arquivo: `vazao rede.csv`
- SHA-256 abreviado: `6d95f51adeeded2d…`
- Import ID: `f32677a9-dbb1-434e-8db1-d25f6f524f91`
- Status: `COMPLETED`
- Origem: `SUPPLY_OUTLET / REDE`, sem DMC
- Cabeçalho: não possui (`has_header = false`, confiança alta)
- Encoding/delimitador: UTF-8 / `;`
- Timezone: `America/Sao_Paulo`
- Mapeamento: Coluna 1 = `TIMESTAMP`; Coluna 2 = `FLOW`, `m3_h`; Coluna 3 vazia = `IGNORE`
- Período: 01/11/2025 00:00 a 31/08/2026 23:45
- Linhas físicas/dados/RAW: 28.546 / 28.546 / 28.546
- Rejeições: 0
- Flags: 2 (`MISSING_TIMESTAMP`: 1; `ZERO_STREAK`: 1; demais: 0)
- Gap: 1; 06/03/2026 18:00 a 13/03/2026 09:45; 9.585 minutos; 638 timestamps esperados ausentes
- Duplicidades/nulos/erros numéricos: 0 / 0 / 0
- Mínimo/máximo RAW: 0,00 / 5.854,04 m³/h
- Unidade RAW: `m3_h`
- Unidade normalizada: `l_s`
- Fórmula: `normalized_value = raw_value / 3,6`

A normalização foi confirmada em todas as 28.546 leituras, com erro numérico máximo zero na comparação SQL. O RAW permaneceu em m³/h. Exemplos persistidos: 2.075,05 → 576,402777778 L/s; 1.956,66 → 543,516666667 L/s; 796,51 → 221,252777778 L/s; 2.326,45 → 646,236111111 L/s; 3.333,47 → 925,963888889 L/s; 1.378,06 → 382,794444444 L/s.

O `ZERO_STREAK` representa 13 leituras zero, permanece WARNING para revisão e não invalida o RAW. Não houve `SENSOR_FAILURE`, indisponibilidade de equipamento ou expurgo. O arquivo original, com 851.612 bytes e MIME `text/csv`, foi preservado no bucket privado `hydraulic-imports` sem upsert.

No cruzamento exploratório não persistente com `PRESSURE_SUPPLY / REDE`, foram encontrados 27.021 timestamps coincidentes: 92,5884% sobre a união das séries, 97,6933% da série de pressão e 94,6577% da série de vazão. Há 638 timestamps somente com pressão e 1.525 somente com vazão. A pressão possui 26 gaps e a vazão 1 gap. Nenhum `analysis_run`, CPE, IAL, IPS ou classificação causal foi criado.

A idempotência reconheceu exatamente um import para o mesmo hash/origem/REDE e uma tentativa transacional duplicada foi bloqueada sem criar terceiro import. UPDATE e DELETE do RAW deste piloto foram igualmente bloqueados em transação com rollback. Status final: concluído e validado.
