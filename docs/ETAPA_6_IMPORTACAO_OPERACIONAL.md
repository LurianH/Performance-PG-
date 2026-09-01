# ETAPA 6 — Importação operacional pelo site

## Escopo

A rota `/importacoes` operacionaliza no navegador autenticado o pipeline RAW validado nos PILOTOS 01 a 04. A tela aceita exclusivamente arquivos CSV para saídas de abastecimento `REDE` e `XIXOVA`, nos canais `PRESSURE_SUPPLY` e `FLOW`.

Somente perfis ativos `ADMIN` e `GESTOR` alcançam a rota e executam escrita. A autorização é aplicada em duas camadas: `ProtectedRoute` no React e RLS/grants no Supabase. Perfis `LEITURA` não acessam a página nem recebem policies de INSERT/UPDATE para o pipeline.

## Fluxo operacional

1. selecionar alimentação, canal, unidade original e arquivo CSV;
2. calcular SHA-256 sobre os bytes originais;
3. detectar encoding, delimitador e presença de cabeçalho;
4. mapear exatamente uma coluna `TIMESTAMP` e uma coluna do canal escolhido;
5. bloquear hash já existente no mesmo contexto antes da pré-validação;
6. revisar arquivo, origem, alimentação, canal, período, linhas, RAW previsto, unidade, mínimo, máximo, flags, gaps, cobertura e rejeições;
7. confirmar explicitamente a gravação;
8. preservar o original no bucket privado `hydraulic-imports`, com caminho exclusivo e `upsert: false`;
9. inserir RAW em lotes, registrar rejeições e flags objetivas e concluir o `data_import`;
10. recarregar resultado e histórico diretamente do banco.

O serviço repete a verificação de idempotência antes de criar o `data_import`. A proteção única do banco permanece como última barreira contra concorrência. A mensagem operacional de bloqueio é: **“Este arquivo já foi importado.”**

## Integridade

- `raw_value` e unidade original permanecem preservados;
- a normalização ocorre somente na view validada já existente;
- zeros continuam sendo zeros;
- gaps não geram linhas artificiais;
- ausência não é substituída por zero;
- não há interpolação, preenchimento, propagação ou exclusão automática;
- o upload nunca sobrescreve um objeto existente;
- RAW continua protegido contra UPDATE e DELETE;
- histórico e detalhes são somente leitura.

As páginas de alimentação e qualidade continuam consultando o banco e não receberam contagens fixas. Esta etapa não implementa DMC, CPE, IAL, IPS, correlação, causalidade, projeções, performance contratual ou expurgos.
