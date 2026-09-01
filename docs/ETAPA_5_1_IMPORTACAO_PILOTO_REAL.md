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

## Preparação do PILOTO 02 — VAZÃO REDE

Antes da importação, a normalização foi corrigida por migration aditiva. **Unidade canônica normalizada de vazão do Performance Praia Grande: L/s.** FLOW em `m3_h` é dividido por 3,6; FLOW em `l_s` permanece inalterado. A view `validated_measurements` nunca modifica RAW e não inventa conversão para unidade incompatível.

Pré-validação repetida sem upload: `vazao rede.csv`, SHA-256 `6d95f51adeeded2d…`, sem cabeçalho (confiança alta), UTF-8, delimitador `;`, período local de 01/11/2025 00:00 a 31/08/2026 23:45, 28.546 linhas físicas, 28.546 timestamps válidos, nenhuma rejeição, duplicidade, nulidade ou erro numérico, 1 gap e 28.546 RAW previstos. Origem prevista: `SUPPLY_OUTLET / REDE`, sem DMC; canal `FLOW`; RAW `m3_h`; normalizado `l_s`. A importação permanece não confirmada.
