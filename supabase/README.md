# Supabase — ETAPA 3

Esta pasta contém a configuração, as migrations versionadas e os smoke tests transacionais da primeira implantação controlada.

## Estado atual

- projeto remoto vinculado: `Performance PG` (`dklwjrwgmsqrjurvcrwu`);
- nove migrations aplicadas em 2026-08-31;
- nenhum seed ou dado oficial foi criado;
- a configuração local declara cadastro público desabilitado;
- a configuração local declara tabelas novas não expostas automaticamente;
- `anon` não recebe acesso aos dados operacionais;
- o primeiro ADMIN deverá ser promovido pelo procedimento privilegiado e auditado documentado;
- o procedimento do primeiro ADMIN está documentado em `docs/BOOTSTRAP_ADMIN.md` e não foi executado;
- reprocessamentos usam `import_processing_runs` e reutilizam o mesmo RAW;
- parâmetros contratuais possuem tabela versionada própria, sem valores iniciais.

O primeiro ADMIN ainda não foi promovido. O procedimento de `docs/BOOTSTRAP_ADMIN.md` depende de confirmação explícita do usuário.

## Imutabilidade RAW

Usuários da aplicação (`authenticated`) dependem simultaneamente de grants e RLS. ADMIN e GESTOR podem inserir RAW apenas dentro de uma importação autorizada; nenhum perfil possui UPDATE/DELETE.

O trigger `prevent_raw_mutation` bloqueia UPDATE/DELETE mesmo quando uma role de serviço ignora RLS. Um administrador real do banco ainda possui capacidade extraordinária de alterar estrutura/desabilitar triggers, mas isso é procedimento de recuperação fora do fluxo da aplicação e deve ser tratado como incidente administrativo, nunca como correção operacional.

## Ordem das migrations

1. extensões e enums;
2. profiles e criação automática de perfil LEITURA;
3. DMCs e vigências de equipamentos;
4. importações e RAW imutável;
5. flags, expurgos e view validada;
6. performance, projeções e parâmetros;
7. execuções e resultados derivados;
8. auditoria;
9. grants e RLS.

## Testes remotos

- `tests/001_schema_smoke.sql`: RAW, expurgos, canal/equipamento, performance, vigências, importação e auditoria;
- `tests/002_rls_smoke.sql`: `anon`, sem profile, inativo, LEITURA, GESTOR e ADMIN;
- ambos usam `BEGIN`/`ROLLBACK` e UUIDs/e-mails reservados de fixture;
- a verificação posterior confirmou ausência dos UUIDs e e-mails de fixture.

Não executar novo `db push`, `db reset`, seed ou bootstrap de ADMIN sem autorização explícita.
