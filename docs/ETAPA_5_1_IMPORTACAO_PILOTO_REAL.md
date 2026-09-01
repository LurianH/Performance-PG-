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
