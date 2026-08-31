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
begin
  record_id := case when tg_op = 'DELETE' then old.id else new.id end;
  reason := case
    when tg_table_name = 'measurement_exclusions' and tg_op <> 'DELETE'
      then coalesce(new.justification, new.revoke_reason)
    when tg_table_name = 'technical_parameters' and tg_op <> 'DELETE'
      then new.notes
    else null
  end;

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
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    reason
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.write_audit_log() from public, anon, authenticated;

create trigger audit_profiles after insert or update or delete on public.profiles
for each row execute function private.write_audit_log();
create trigger audit_dmcs after insert or update or delete on public.dmcs
for each row execute function private.write_audit_log();
create trigger audit_equipment_periods after insert or update or delete on public.equipment_periods
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

comment on table public.audit_log is
  'Trilha append-only preenchida por triggers; sem edição direta pelo frontend.';
