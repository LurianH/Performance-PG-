# ETAPA 3.1 — bootstrap controlado do primeiro ADMIN

## Identificação e resultado

- projeto: `Performance PG` (`dklwjrwgmsqrjurvcrwu`);
- conclusão: 2026-08-31 21:00 BRT / 2026-09-01 00:00 UTC;
- usuário promovido: `englurian@gmail.com`;
- UUID parcial: `22cfa840…294e`;
- transição: `LEITURA` para `ADMIN`;
- estado final: ativo;
- ADMINs ativos: exatamente 1;
- demais profiles ativos: 8 em `LEITURA`.

O UUID anterior deixou de existir após a conta ser recriada no Supabase Auth. O bootstrap definitivo foi executado somente depois da confirmação manual do novo UUID e da repetição integral do preflight UUID + e-mail.

## Auditoria

- ação: `ROLE_CHANGE`;
- `old_data.role`: `LEITURA`;
- `new_data.role`: `ADMIN`;
- justificativa: `Bootstrap inicial do primeiro administrador do Performance Praia Grande.`;
- exatamente um profile foi alterado.

## Autenticação real

- login com senha digitada manualmente pelo usuário: aprovado;
- sessão restaurada após recarregar a página: aprovada;
- carregamento do profile: aprovado;
- role `ADMIN` reconhecida no frontend e no banco: aprovada;
- acesso a `/configuracoes`: aprovado;
- logout: aprovado;
- retorno a `/login` após logout: aprovado;
- acesso direto a `/configuracoes` sem sessão: redirecionado para `/login`.

Nenhuma senha foi lida, recuperada, alterada ou registrada.

## Autorização

ADMIN:

- grant-base para parâmetros administrativos: presente;
- RAW sem grant de `UPDATE` e `DELETE`;
- `audit_log` sem grant de `INSERT` direto;
- nenhum dado oficial foi criado durante o teste.

LEITURA:

- role reconhecida em sessão RLS transacional;
- consultas operacionais permitidas;
- parâmetros técnicos restritos à policy de ADMIN;
- alteração de profiles restrita à policy de ADMIN;
- nenhum profile LEITURA foi promovido ou modificado.

## Correção de frontend

O `ProtectedRoute` já restringia `/configuracoes` a ADMIN, mas o link permanecia visível para LEITURA e o `RoleGuard` ainda não era consumido. A ETAPA 3.1 passou a:

- centralizar a regra de autorização por role;
- usar a mesma regra em `ProtectedRoute` e `RoleGuard`;
- ocultar o link `Configurações` para roles não administrativas;
- cobrir ADMIN, LEITURA e ausência de role com testes unitários.

## Validação final

- ESLint: aprovado;
- TypeScript: aprovado;
- Vitest: 24 testes aprovados;
- build Vite: aprovado;
- testes SQL/RLS transacionais: aprovados;
- fixtures persistidas: nenhuma;
- seed ou dado oficial: nenhum;
- importador, CPE, IAL, IPS e deploy: não executados.

O arquivo administrativo temporário foi removido após as verificações. O frontend conserva somente `.env.local` ignorado pelo Git, com URL e chave publicável.
