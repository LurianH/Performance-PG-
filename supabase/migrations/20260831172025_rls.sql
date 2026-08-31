-- Helper privado evita recursão nas policies de profiles.
create function private.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.active = true
$$;

revoke all on function private.current_user_role() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;

-- RLS em todas as tabelas expostas no schema public.
alter table public.profiles enable row level security;
alter table public.dmcs enable row level security;
alter table public.equipment_periods enable row level security;
alter table public.data_imports enable row level security;
alter table public.raw_measurements enable row level security;
alter table public.measurement_quality_flags enable row level security;
alter table public.measurement_exclusions enable row level security;
alter table public.performance_months enable row level security;
alter table public.projection_scenarios enable row level security;
alter table public.projection_values enable row level security;
alter table public.technical_parameters enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.event_analysis enable row level security;
alter table public.ips_results enable row level security;
alter table public.audit_log enable row level security;

-- Grants explícitos: anon não recebe acesso a dados operacionais.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert, update, delete on public.profiles to authenticated;

grant select on public.dmcs, public.equipment_periods, public.data_imports,
  public.raw_measurements, public.measurement_quality_flags,
  public.measurement_exclusions, public.performance_months,
  public.projection_scenarios, public.projection_values,
  public.technical_parameters, public.analysis_runs, public.event_analysis,
  public.ips_results to authenticated;

grant select on public.validated_measurements,
  public.performance_months_derived, public.projection_values_derived to authenticated;

grant insert, update on public.data_imports to authenticated;
grant insert on public.raw_measurements to authenticated;
grant insert, update, delete on public.measurement_quality_flags to authenticated;
grant insert, update on public.measurement_exclusions to authenticated;
grant insert, update, delete on public.performance_months to authenticated;
grant insert, update, delete on public.projection_scenarios to authenticated;
grant insert, update, delete on public.projection_values to authenticated;
grant insert, update on public.technical_parameters to authenticated;
grant insert, update on public.dmcs, public.equipment_periods to authenticated;
grant delete on public.dmcs, public.equipment_periods to authenticated;
grant insert, update on public.analysis_runs, public.event_analysis, public.ips_results to authenticated;

-- Profiles: usuário lê o próprio; ADMIN lê/administra todos.
create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.current_user_role()) = 'ADMIN'
);

create policy profiles_insert_admin on public.profiles
for insert to authenticated
with check ((select private.current_user_role()) = 'ADMIN');
create policy profiles_update_admin on public.profiles
for update to authenticated
using ((select private.current_user_role()) = 'ADMIN')
with check ((select private.current_user_role()) = 'ADMIN');
create policy profiles_delete_admin on public.profiles
for delete to authenticated
using ((select private.current_user_role()) = 'ADMIN');

-- Leitura operacional para qualquer perfil ativo.
create policy dmcs_select_active_role on public.dmcs
for select to authenticated using ((select private.current_user_role()) is not null);
create policy equipment_select_active_role on public.equipment_periods
for select to authenticated using ((select private.current_user_role()) is not null);
create policy imports_select_active_role on public.data_imports
for select to authenticated using ((select private.current_user_role()) is not null);
create policy raw_select_active_role on public.raw_measurements
for select to authenticated using ((select private.current_user_role()) is not null);
create policy quality_flags_select_active_role on public.measurement_quality_flags
for select to authenticated using ((select private.current_user_role()) is not null);
create policy exclusions_select_active_role on public.measurement_exclusions
for select to authenticated using ((select private.current_user_role()) is not null);
create policy performance_select_active_role on public.performance_months
for select to authenticated using ((select private.current_user_role()) is not null);
create policy scenarios_select_active_role on public.projection_scenarios
for select to authenticated using ((select private.current_user_role()) is not null);
create policy projection_values_select_active_role on public.projection_values
for select to authenticated using ((select private.current_user_role()) is not null);
create policy parameters_select_active_role on public.technical_parameters
for select to authenticated using ((select private.current_user_role()) is not null);
create policy analysis_runs_select_active_role on public.analysis_runs
for select to authenticated using ((select private.current_user_role()) is not null);
create policy event_analysis_select_active_role on public.event_analysis
for select to authenticated using ((select private.current_user_role()) is not null);
create policy ips_results_select_active_role on public.ips_results
for select to authenticated using ((select private.current_user_role()) is not null);

-- DMC/equipamentos: somente ADMIN altera cadastro e vigências.
create policy dmcs_insert_admin on public.dmcs for insert to authenticated
with check ((select private.current_user_role()) = 'ADMIN');
create policy dmcs_update_admin on public.dmcs for update to authenticated
using ((select private.current_user_role()) = 'ADMIN')
with check ((select private.current_user_role()) = 'ADMIN');
create policy dmcs_delete_admin on public.dmcs for delete to authenticated
using ((select private.current_user_role()) = 'ADMIN');

create policy equipment_insert_admin on public.equipment_periods for insert to authenticated
with check ((select private.current_user_role()) = 'ADMIN');
create policy equipment_update_admin on public.equipment_periods for update to authenticated
using ((select private.current_user_role()) = 'ADMIN')
with check ((select private.current_user_role()) = 'ADMIN');
create policy equipment_delete_admin on public.equipment_periods for delete to authenticated
using ((select private.current_user_role()) = 'ADMIN');

-- Importações e RAW: GESTOR/ADMIN inserem; RAW não possui policies de update/delete.
create policy imports_insert_operator on public.data_imports for insert to authenticated
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and imported_by = (select auth.uid())
);
create policy imports_update_operator on public.data_imports for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy raw_insert_operator on public.raw_measurements for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));

-- Flags manuais: operações frontend limitadas a detected_by USER.
create policy quality_flags_insert_operator on public.measurement_quality_flags for insert to authenticated
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and detected_by = 'USER'
);
create policy quality_flags_update_operator on public.measurement_quality_flags for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR') and detected_by = 'USER')
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR') and detected_by = 'USER');
create policy quality_flags_delete_operator on public.measurement_quality_flags for delete to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR') and detected_by = 'USER');

-- Expurgos reversíveis: sem DELETE; revogação ocorre via UPDATE auditado.
create policy exclusions_insert_operator on public.measurement_exclusions for insert to authenticated
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and created_by = (select auth.uid())
  and revoked_at is null
);
create policy exclusions_update_operator on public.measurement_exclusions for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and revoked_at is not null
  and revoked_by = (select auth.uid())
);

-- Performance e projeções: GESTOR/ADMIN operam.
create policy performance_insert_operator on public.performance_months for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy performance_update_operator on public.performance_months for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy performance_delete_operator on public.performance_months for delete to authenticated
using ((select private.current_user_role()) = 'ADMIN');

create policy scenarios_insert_operator on public.projection_scenarios for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy scenarios_update_operator on public.projection_scenarios for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy scenarios_delete_admin on public.projection_scenarios for delete to authenticated
using ((select private.current_user_role()) = 'ADMIN');

create policy projection_values_insert_operator on public.projection_values for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy projection_values_update_operator on public.projection_values for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy projection_values_delete_admin on public.projection_values for delete to authenticated
using ((select private.current_user_role()) = 'ADMIN');

-- Parâmetros versionados: somente ADMIN.
create policy parameters_insert_admin on public.technical_parameters for insert to authenticated
with check ((select private.current_user_role()) = 'ADMIN');
create policy parameters_update_admin on public.technical_parameters for update to authenticated
using ((select private.current_user_role()) = 'ADMIN')
with check ((select private.current_user_role()) = 'ADMIN');
-- Resultados derivados: preparação para executor autorizado, sem motor nesta etapa.
create policy analysis_runs_insert_operator on public.analysis_runs for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy analysis_runs_update_operator on public.analysis_runs for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy event_analysis_insert_operator on public.event_analysis for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy event_analysis_update_operator on public.event_analysis for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy ips_results_insert_operator on public.ips_results for insert to authenticated
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));
create policy ips_results_update_operator on public.ips_results for update to authenticated
using ((select private.current_user_role()) in ('ADMIN', 'GESTOR'))
with check ((select private.current_user_role()) in ('ADMIN', 'GESTOR'));

-- Auditoria é append-only e visível apenas para ADMIN; não há grants de escrita.
grant select on public.audit_log to authenticated;
create policy audit_log_select_admin on public.audit_log
for select to authenticated using ((select private.current_user_role()) = 'ADMIN');
