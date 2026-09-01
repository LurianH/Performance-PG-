# ETAPA 8 — Motor de diagnóstico hidráulico dos DMCs

O diagnóstico é uma camada derivada e rastreável. `raw_measurements` não é atualizado, excluído, interpolado ou preenchido.

## Regras v1

- timezone: `America/Sao_Paulo`;
- janela noturna: 23:00–05:00;
- janela crítica: 23:15–04:45;
- PC `GREEN`: 10 a 50 mca, inclusive;
- PC `YELLOW`: 3,2 a menos de 10 mca;
- `RED_LOW`: abaixo de 3,2 mca somente na janela crítica;
- `RED_HIGH`: acima de 50 mca;
- os limites de PC não são aplicados a montante ou jusante;
- durações usam o intervalo real até a próxima leitura, limitado à cadência predominante mediana. Assim, um gap não é contado como permanência no estado anterior;
- cobertura soma as durações efetivamente observadas nos canais disponíveis;
- FLOW é lido da projeção canônica em L/s; RAW e unidade original permanecem intactos;
- outlier robusto: valor fora de `mediana ± 6 × MAD`, calculado por DMC/canal/período. Outliers são sinalizados e continuam no agregado;
- correlação usa Pearson em pares PC/FLOW com timestamp idêntico, apenas no período noturno, sem inferência causal;
- tendência mensal compara horas abaixo de 10 mca: melhora/piora acima de 10%; dentro dessa faixa é estabilidade; o primeiro mês não possui baseline.

## Persistência e segurança

`analysis_runs` registra período, versão, parâmetros e timestamps. `dmc_hydraulic_daily` e `dmc_hydraulic_monthly` armazenam os agregados com chave por execução/DMC/período. A função interna usa lock transacional e devolve a execução concluída existente para a mesma versão/período, evitando duplicação.

As tabelas possuem RLS. Perfis ativos autenticados têm somente leitura; o frontend não recebe escrita nem execução do motor interno. CPE, IAL e IPS permanecem fora desta etapa.
