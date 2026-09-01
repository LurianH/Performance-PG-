# ETAPA 5 — Importador RAW TXT/CSV/XLSX

## Fluxo

O acesso a `/importacoes` é restrito por rota e navegação a `ADMIN` e `GESTOR`. O wizard exige: Arquivo → Origem → Mapeamento → Pré-validação → Confirmação → Processamento → Resultado. Nenhum RAW é gravado nas quatro primeiras etapas e o botão final é **Confirmar importação RAW**.

## Parsing e preservação

- TXT/CSV: UTF-8 e Windows-1252, BOM detectado, escolha manual de encoding, delimitadores `;`, `,` e tabulação.
- XLSX: `read-excel-file` 9.3.10 carregado dinamicamente apenas para `.xlsx`; células Date são interpretadas como horário local.
- Timestamp: `dd/MM/yyyy HH:mm`, `dd/MM/yyyy HH:mm:ss` e células Excel; timezone `America/Sao_Paulo`, persistida em `metadata_json`.
- Números: ponto ou vírgula decimal simples. Separadores mistos/ambíguos não são interpretados. NULL nunca vira zero.
- SHA-256: calculado com Web Crypto sobre os bytes originais antes de qualquer interpretação.
- Arquivo: bytes originais enviados sem conversão para o bucket privado `hydraulic-imports`; não existe policy de UPDATE/DELETE e o upload usa `upsert: false`.

## Origem e mapeamento

Para DMC, o `supply_group` é derivado do cadastro e não é persistido no RAW. Para saída do reservatório, o usuário seleciona REDE/XIXOVA e `dmc_id` permanece NULL. Cada coluna registra cabeçalho original/normalizado, índice, canal e unidade. A coincidência com `dmc.pc_channel` é sugestão de alta confiança, nunca confirmação automática.

Arquivos podem conter qualquer subconjunto válido. Booster Ocian aceita somente timestamp + PC. Saídas podem conter apenas pressão ou apenas vazão. RAW preserva unidade original (`mca`, `m3_h`, `l_s` ou `raw`).

## Idempotência, rejeições e duplicidades

A verificação usa hash + tipo de origem + DMC/saída. Arquivo já existente no mesmo contexto é bloqueado e deve seguir para reprocessamento. `import_processing_runs` cria histórico sem duplicar arquivo lógico ou RAW.

Linhas sem timestamp interpretável vão para `import_rejected_rows`, com número, payload, motivo e detalhes; a tabela é imutável. Valores numéricos ilegíveis ainda geram RAW NULL com representação original no `raw_payload` e flag `NULL_VALUE` com `parseError`.

`raw_measurements.column_index` identifica a coluna zero-based. A unicidade por import + linha + coluna permite preservar linhas repetidas, timestamps duplicados e cabeçalhos repetidos sem descarte silencioso.

## Qualidade objetiva

Versão do algoritmo: `raw-import-v1`.

- `DUPLICATE`: mesmo canal/coluna e timestamp dentro do arquivo, com indicação de valor conflitante.
- `NULL_VALUE`: nulo ou parsing numérico inseguro.
- `ZERO_STREAK`: sequência configurável; sempre WARNING para revisão e nunca falha automática.
- `MISSING_TIMESTAMP`: associada à primeira leitura após o gap, com início, fim, cadência esperada e quantidade ausente.

Nenhuma flag automática desta etapa recebe severidade INVALID. Não há classificação hidráulica, interpolação, preenchimento de gaps, expurgo ou inferência de falha de sensor/equipamento.

## Batches e falha parcial

O padrão conservador é 500 medições por lote (`DEFAULT_IMPORT_BATCH_SIZE`) e fica registrado em `metadata_json`. O fluxo cria primeiro `data_imports`, preserva o arquivo, marca PROCESSING e então insere RAW. Após o primeiro lote confirmado não se promete rollback do navegador: falha ou interrupção marca `PARTIAL`, mantém RAW imutável e interrompe lotes seguintes. Antes de qualquer RAW, a falha resulta em `FAILED`.

Contagens finais distinguem linhas de origem aceitas/rejeitadas e medições RAW. O progresso exibe medições processadas/total.

## Segurança e limitações atuais

O frontend usa somente sessão autenticada e publishable key. ADMIN/GESTOR podem inserir imports, arquivo, RAW, rejeições e flags objetivas; LEITURA não acessa `/importacoes` nem faz upload. O bucket é privado, sem URL pública permanente. Nenhum segredo administrativo faz parte da aplicação.

O frontend ainda não processa em Web Worker e arquivos muito grandes podem exigir evolução para processamento server-side/Edge Function. Cancelamento é cooperativo entre lotes. A primeira importação oficial, CPE, IAL, IPS, diagnóstico causal e equipment periods permanecem fora desta etapa.
