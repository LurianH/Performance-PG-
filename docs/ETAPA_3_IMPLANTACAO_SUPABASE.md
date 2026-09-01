# ETAPA 3 — implantação controlada do Supabase

## Identificação

- projeto: `Performance PG`;
- project ref: `dklwjrwgmsqrjurvcrwu`;
- região informada pela CLI: `us-west-2`;
- implantação: 2026-08-31 16:14 BRT / 19:14 UTC;
- checkpoint ETAPA 2.1: `346ce935dee38bbe1d65fb051075c4f992dc4669`;
- correção final de preflight: `c3c28d5f2294d7b7229ca407b18f34b6bc5108bd`.

## Migrations aplicadas

1. `20260831171958_extensions_and_types.sql`;
2. `20260831172001_profiles.sql`;
3. `20260831172005_hydraulic_structure.sql`;
4. `20260831172008_imports_and_raw.sql`;
5. `20260831172011_quality_and_exclusions.sql`;
6. `20260831172015_performance_and_projections.sql`;
7. `20260831172018_analysis.sql`;
8. `20260831172021_audit.sql`;
9. `20260831172025_rls.sql`.

O dry-run não incluiu seed, roles adicionais ou atualização de Vault.

## Estrutura validada

- 18 tabelas no schema `public`;
- 3 views: `validated_measurements`, `performance_months_derived` e `projection_values_derived`;
- 10 funções no schema `private`, todas com `search_path` fixado;
- 46 entradas de trigger no catálogo;
- 54 policies;
- RLS habilitado nas 18 tabelas;
- as 3 views usam `security_invoker=true`;
- lint remoto: sem erros;
- advisor de segurança: sem issues.

## Smoke tests

`supabase/tests/001_schema_smoke.sql` validou:

- inserção e imutabilidade de RAW;
- criação e revogação de expurgo sem alteração do RAW;
- efeito de `FAILED` restrito ao canal associado;
- `NOT_INSTALLED` inválido sem substituir dado ausente por zero;
- VP derivado apenas quando VD e VCM existem;
- redução e atingimento `NULL` quando faltam parâmetros;
- rejeição de vigências sobrepostas;
- idempotência do contexto de importação e reprocessamento do mesmo RAW;
- auditoria automática.

`supabase/tests/002_rls_smoke.sql` validou:

- `anon` sem acesso funcional;
- usuário autenticado sem profile sem acesso funcional;
- profile inativo sem acesso funcional;
- LEITURA com consulta e sem mutação;
- GESTOR com importação/expurgo e sem alteração de parâmetros ou roles;
- ADMIN com administração permitida e RAW ainda imutável;
- impossibilidade de autopromoção;
- impossibilidade de escrita direta em `audit_log` pelo frontend.

Ambos retornaram sucesso e terminaram com `ROLLBACK`. A consulta posterior confirmou ausência exata dos UUIDs e e-mails reservados das fixtures.

## Estado de usuários

Após a implantação foram identificados profiles existentes no Supabase Auth. O bootstrap controlado do primeiro ADMIN foi concluído na ETAPA 3.1 e está registrado em `docs/ETAPA_3_1_BOOTSTRAP_ADMIN.md`.

## Conexão local

O frontend lê somente:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`.

Essas variáveis ficam em `.env.local`, ignorado pelo Git. O frontend nunca deve receber senha do banco, access token administrativo, chave secreta ou `service_role`.

## Recuperação e rollback

- não usar `supabase db reset` contra o projeto remoto;
- antes de dados oficiais, uma recuperação total pode ser feita criando outro projeto vazio e reaplicando somente migrations aprovadas;
- depois de dados oficiais, preferir backup/PITR disponível no projeto ou uma nova migration corretiva revisada;
- uma reversão destrutiva deve ser previamente autorizada, identificar objetos e impacto e preservar backup;
- divergências de histórico devem ser investigadas com `supabase migration list --linked`, nunca ocultadas por alteração manual sem registro.

## Segredos proibidos no Git

- `SUPABASE_ACCESS_TOKEN`;
- `SUPABASE_DB_PASSWORD`;
- chaves `secret` ou `service_role`;
- connection strings com senha;
- JWTs e credenciais pessoais.

O arquivo temporário administrativo `.env.supabase.local` deve ser removido após a validação. `.env.local` pode conter somente URL e chave publicável e permanece ignorado.
