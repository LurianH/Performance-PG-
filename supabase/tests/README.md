# Testes SQL/RLS — ETAPA 3

Os testes foram implementados como scripts SQL transacionais e executados no PostgreSQL remoto vazio pela CLI oficial:

- `001_schema_smoke.sql` — regras estruturais e de domínio;
- `002_rls_smoke.sql` — matriz de autorização e RLS.
- `006_hydraulic_diagnostics.sql` — persistência analítica, RLS e executor interno da ETAPA 8.
- `007_stage9_performance.sql` — dados oficiais, fórmulas derivadas e projeções da ETAPA 9.

Cada script inicia com `BEGIN` e termina com `ROLLBACK`. Os e-mails usam o domínio reservado `example.invalid` e os UUIDs são fixos e exclusivos para facilitar a verificação posterior.

## Cobertura validada

1. `anon` não lê nenhuma tabela operacional.
2. sessão Auth sem `profiles` não possui acesso operacional.
3. profile inativo não lê DMCs, RAW, views, performance ou projeções.
4. LEITURA consulta dashboards, mas não altera registros.
5. GESTOR cria importação própria, insere RAW somente nessa importação e não altera/deleta RAW.
6. GESTOR cria e revoga expurgo com justificativa, sem DELETE.
7. ADMIN altera role com justificativa; GESTOR/LEITURA não promovem a si próprios.
8. `audit_log` aceita escrita por trigger, nunca pelo frontend.
9. views `security_invoker` respeitam as policies das tabelas base.
10. equipamento FAILED associado a FLOW invalida FLOW, mas não PRESSURE_PC.
11. revogação de expurgo restaura elegibilidade quando não existe outro impedimento.
12. parâmetros contratuais sem vigência produzem redução/atingimento `NULL`.
13. migrations aplicam do zero sem seeds ou dados oficiais.
14. apuração e projeções preservam `VP = VD - VCM`, redução e atingimento como valores derivados.

Resultado em 2026-08-31: ambos aprovados. A consulta posterior confirmou zero fixtures exatas persistidas.
