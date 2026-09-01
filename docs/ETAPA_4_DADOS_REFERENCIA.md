# ETAPA 4 — dados estruturais de referência

Esta etapa carrega somente a topologia oficial dos 14 DMCs e parâmetros contratuais/técnicos versionados. O script é transacional, idempotente e interrompe a carga diante de conflito ou divergência quantitativa.

## Vigências

- Parâmetros contratuais: ciclo analítico iniciado em `2025-12-01`. Essa data não é a data de formação do baseline, formado entre jun/2023 e mai/2024.
- Parâmetros técnicos: `2025-10-01 00:00:00-03:00`, vigência metodológica para análise histórica; não representa vigência regulatória.

## Regra de pressão no PC

- Verde: `10 <= PC <= 50 mca`.
- Amarelo: `3,2 <= PC < 10 mca` (inclusive `3,20`).
- Vermelho por pressão baixa: `PC < 3,2 mca`.
- Vermelho por sobrepressão: `PC > 50 mca`.

A classificação vale exclusivamente para o ponto crítico (PC), não para montante, jusante ou saída de alimentação.

## Ausências preservadas

Não foram cadastrados banda neutra do IAL, janelas de referência, pesos do IPS nem thresholds adicionais. Ausências são apresentadas como “Não configurado”, nunca como zero.

Também permanecem vazias as tabelas de competências mensais, cenários de projeção, importações, RAW e vigências de equipamentos. Nenhum CPE, IAL ou IPS foi implementado.
