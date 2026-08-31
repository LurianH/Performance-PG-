# Plano de testes SQL/RLS

Docker/Postgres local não está disponível no ambiente atual. Estes cenários deverão ser implementados com pgTAP e executados por `supabase test db` antes de qualquer aplicação remota:

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

Nenhum desses testes SQL foi marcado como aprovado nesta etapa.
