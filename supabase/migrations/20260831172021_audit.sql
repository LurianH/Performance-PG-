create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  justification text,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_user_idx on public.audit_log (user_id, created_at desc);

create function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_id uuid;
  reason text;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    record_id := old.id;
  else
    record_id := new.id;
  end if;

  reason := null;
  audit_action := tg_op;

  if tg_table_name = 'profiles' and tg_op = 'UPDATE' then
    reason := new.role_change_justification;
    if (old.role, old.active) is distinct from (new.role, new.active) then
      audit_action := 'ROLE_CHANGE';
    end if;
  elsif tg_table_name = 'measurement_exclusions' and tg_op = 'INSERT' then
    reason := new.justification;
    audit_action := 'EXCLUSION_CREATE';
  elsif tg_table_name = 'measurement_exclusions' and tg_op = 'UPDATE' then
    reason := new.revoke_reason;
    if old.revoked_at is null and new.revoked_at is not null then
      audit_action := 'EXCLUSION_REVOKE';
    end if;
  elsif tg_table_name = 'performance_months' then
    if tg_op = 'UPDATE' then
      reason := new.change_justification;
    end if;
    audit_action := 'PERFORMANCE_CHANGE';
  elsif tg_table_name in ('technical_parameters', 'performance_contract_parameters') then
    if tg_op <> 'DELETE' then
      reason := new.notes;
    end if;
    audit_action := 'PARAMETER_CHANGE';
  elsif tg_table_name in ('equipment_periods', 'equipment_period_channels') then
    audit_action := 'EQUIPMENT_PERIOD_CHANGE';
  elsif tg_table_name in ('projection_scenarios', 'projection_values') then
    audit_action := 'PROJECTION_CHANGE';
  end if;

  insert into public.audit_log (
    user_id, entity_type, entity_id, action, old_data, new_data, justification
  ) values (
    case
      when exists (select 1 from auth.users au where au.id = (select auth.uid()))
        then (select auth.uid())
      else null
    end,
    tg_table_name,
    record_id,
    audit_action,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    reason
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.write_audit_log() from public, anon, authenticated;

create trigger audit_profiles after insert or update or delete on public.profiles
for each row execute function private.write_audit_log();
create trigger audit_dmcs after insert or update or delete on public.dmcs
for each row execute function private.write_audit_log();
create trigger audit_equipment_periods after insert or update or delete on public.equipment_periods
for each row execute function private.write_audit_log();
create trigger audit_equipment_period_channels after insert or update or delete on public.equipment_period_channels
for each row execute function private.write_audit_log();
create trigger audit_measurement_exclusions after insert or update or delete on public.measurement_exclusions
for each row execute function private.write_audit_log();
create trigger audit_measurement_quality_flags after insert or update or delete on public.measurement_quality_flags
for each row execute function private.write_audit_log();
create trigger audit_performance_months after insert or update or delete on public.performance_months
for each row execute function private.write_audit_log();
create trigger audit_projection_scenarios after insert or update or delete on public.projection_scenarios
for each row execute function private.write_audit_log();
create trigger audit_projection_values after insert or update or delete on public.projection_values
for each row execute function private.write_audit_log();
create trigger audit_technical_parameters after insert or update or delete on public.technical_parameters
for each row execute function private.write_audit_log();
create trigger audit_performance_contract_parameters after insert or update or delete on public.performance_contract_parameters
for each row execute function private.write_audit_log();

comment on table public.audit_log is
  'Trilha append-only. action permanece texto controlado pelos triggers para permitir evolução sem migration de enum.';
