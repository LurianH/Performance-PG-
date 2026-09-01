# ETAPA 7 — Importação operacional de DMCs

A rota `/importacoes` passou a suportar `SUPPLY_OUTLET` e `DMC` usando o mesmo pipeline validado nos pilotos. Nenhuma migration, política ou regra hidráulica foi adicionada.

## Fluxo DMC

1. ADMIN ou GESTOR seleciona a origem `DMC`.
2. A interface carrega somente DMCs ativos e exige uma seleção válida.
3. O usuário seleciona um CSV e confirma encoding, delimitador e presença de cabeçalho.
4. Cada coluna pode ser marcada como `TIMESTAMP`, `PRESSURE_PC`, `PRESSURE_UPSTREAM`, `PRESSURE_DOWNSTREAM`, `FLOW` ou `IGNORE`.
5. Pressões mantêm unidade RAW `mca`; vazão exige confirmação entre `m3_h` e `l_s`.
6. A pré-validação apresenta período, linhas, cadência, mapeamentos, unidades, RAW previsto, mínimos, máximos, flags, gaps e cobertura por canal.
7. Somente após confirmação explícita o pipeline preserva o arquivo no bucket privado, cria `data_imports`, RAW, rejeições e flags.

Para DMC, o pipeline grava `source_type = DMC`, exige `dmc_id` e mantém `supply_group = NULL`. A proteção existente por hash + origem + DMC continua bloqueando uma segunda importação antes do Storage e também no índice único do banco.

## Histórico e disponibilidade

O histórico agora lista imports de alimentação e DMC com origem, alvo, todos os canais, período, RAW agregado, cobertura e status. Os detalhes são somente leitura e separam RAW, unidade original/normalizada, mínimo, máximo, flags, gaps e cobertura por canal.

A página `/pressoes` continua genérica e baseada nos imports DMC concluídos; nenhum nome de DMC foi hardcodado. Não há diagnóstico, semáforo, limites hidráulicos, correlação, CPE, IAL, IPS, expurgo, performance ou projeção.
