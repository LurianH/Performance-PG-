# Supabase — ETAPA 2

Esta pasta foi inicializada pela CLI oficial e contém somente configuração e migrations locais.

## Estado deliberado

- nenhum projeto remoto foi criado ou vinculado;
- nenhuma migration foi aplicada local ou remotamente;
- nenhum seed ou dado oficial foi criado;
- cadastro público está desabilitado;
- tabelas novas não são expostas automaticamente;
- `anon` não recebe acesso aos dados operacionais;
- o primeiro ADMIN deverá ser promovido pelo procedimento privilegiado e auditado documentado;
- o procedimento do primeiro ADMIN está documentado em `docs/BOOTSTRAP_ADMIN.md` e não foi executado;
- reprocessamentos usam `import_processing_runs` e reutilizam o mesmo RAW;
- parâmetros contratuais possuem tabela versionada própria, sem valores iniciais.

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

Não executar `db push`, `db reset` ou qualquer comando de aplicação sem autorização explícita.
