# Supabase — ETAPA 2

Esta pasta foi inicializada pela CLI oficial e contém somente configuração e migrations locais.

## Estado deliberado

- nenhum projeto remoto foi criado ou vinculado;
- nenhuma migration foi aplicada local ou remotamente;
- nenhum seed ou dado oficial foi criado;
- cadastro público está desabilitado;
- tabelas novas não são expostas automaticamente;
- `anon` não recebe acesso aos dados operacionais;
- o primeiro ADMIN deverá ser promovido por um procedimento privilegiado e auditado, a definir antes da conexão real.

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
