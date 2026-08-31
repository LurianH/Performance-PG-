create table public.measurement_quality_flags (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid not null references public.raw_measurements(id) on delete restrict,
  flag_type public.quality_flag_type not null,
  severity public.quality_severity not null,
  detected_by public.flag_detector not null,
  algorithm_version text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint quality_algorithm_required_for_system check (
    detected_by <> 'SYSTEM' or algorithm_version is not null
  )
);

create index measurement_quality_flags_measurement_idx
  on public.measurement_quality_flags (measurement_id, severity);

create table public.measurement_exclusions (
  id uuid primary key default gen_random_uuid(),
  measurement_id uuid references public.raw_measurements(id) on delete restrict,
  dmc_id uuid references public.dmcs(id) on delete restrict,
  source_type public.measurement_source_type,
  channel_type public.measurement_channel_type,
  starts_at timestamptz,
  ends_at timestamptz,
  reason_code text not null,
  justification text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoke_reason text,
  constraint exclusions_reason_not_blank check (btrim(reason_code) <> ''),
  constraint exclusions_justification_not_blank check (btrim(justification) <> ''),
  constraint exclusions_target_present check (
    measurement_id is not null
    or (starts_at is not null and (dmc_id is not null or source_type is not null or channel_type is not null))
  ),
  constraint exclusions_valid_range check (ends_at is null or (starts_at is not null and ends_at > starts_at)),
  constraint exclusions_revocation_complete check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null and revoke_reason is not null and btrim(revoke_reason) <> '')
  )
);

create index measurement_exclusions_measurement_active_idx
  on public.measurement_exclusions (measurement_id) where revoked_at is null;
create index measurement_exclusions_scope_active_idx
  on public.measurement_exclusions (dmc_id, source_type, channel_type, starts_at, ends_at)
  where revoked_at is null;

create function private.enforce_exclusion_revocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.revoked_at is not null then
    raise exception 'A revoked exclusion is immutable';
  end if;

  if row(
    old.measurement_id, old.dmc_id, old.source_type, old.channel_type,
    old.starts_at, old.ends_at, old.reason_code, old.justification,
    old.created_by, old.created_at
  ) is distinct from row(
    new.measurement_id, new.dmc_id, new.source_type, new.channel_type,
    new.starts_at, new.ends_at, new.reason_code, new.justification,
    new.created_by, new.created_at
  ) then
    raise exception 'Exclusion scope and justification are immutable; revoke and create a new exclusion';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_exclusion_revocation() from public, anon, authenticated;

create trigger measurement_exclusions_revocation_only
before update on public.measurement_exclusions
for each row execute function private.enforce_exclusion_revocation();

create view public.validated_measurements
with (security_invoker = true)
as
select
  rm.id as measurement_id,
  rm.measured_at,
  rm.dmc_id,
  rm.source_type,
  rm.supply_group,
  rm.channel_type,
  rm.raw_value,
  case
    when lower(rm.unit) in ('l/s', 'l_s', 'ls') then rm.raw_value * 3.6
    else rm.raw_value
  end as normalized_value,
  rm.unit as raw_unit,
  case
    when lower(rm.unit) in ('l/s', 'l_s', 'ls') then 'm3_h'
    else rm.unit
  end as normalized_unit,
  not (
    rm.raw_value is null
    or active_exclusion.exclusion_id is not null
    or equipment_state.invalid_equipment_state is true
    or coalesce(flags.has_invalid_flag, false)
  ) as is_valid,
  case
    when active_exclusion.exclusion_id is not null then 'EXCLUDED'
    when rm.raw_value is null then 'NULL_VALUE'
    when equipment_state.invalid_equipment_state is true then 'EQUIPMENT_UNAVAILABLE'
    when coalesce(flags.has_invalid_flag, false) then 'INVALID'
    when coalesce(flags.has_warning_flag, false) then 'WARNING'
    else 'VALID'
  end as quality_status,
  active_exclusion.reason_code as exclusion_reason,
  rm.import_id
from public.raw_measurements rm
left join lateral (
  select me.id as exclusion_id, me.reason_code
  from public.measurement_exclusions me
  where me.revoked_at is null
    and (
      me.measurement_id = rm.id
      or (
        me.measurement_id is null
        and (me.dmc_id is null or me.dmc_id = rm.dmc_id)
        and (me.source_type is null or me.source_type = rm.source_type)
        and (me.channel_type is null or me.channel_type = rm.channel_type)
        and me.starts_at <= rm.measured_at
        and (me.ends_at is null or rm.measured_at < me.ends_at)
      )
    )
  order by me.created_at desc
  limit 1
) active_exclusion on true
left join lateral (
  select true as invalid_equipment_state
  from public.equipment_periods ep
  where ep.dmc_id = rm.dmc_id
    and (ep.channel_type is null or ep.channel_type = rm.channel_type)
    and ep.started_at <= rm.measured_at
    and (ep.ended_at is null or rm.measured_at < ep.ended_at)
    and ep.status in ('UNAVAILABLE', 'FAILED', 'NOT_INSTALLED', 'MAINTENANCE')
  limit 1
) equipment_state on true
left join lateral (
  select
    bool_or(mqf.severity = 'INVALID') as has_invalid_flag,
    bool_or(mqf.severity = 'WARNING') as has_warning_flag
  from public.measurement_quality_flags mqf
  where mqf.measurement_id = rm.id
) flags on true;

comment on view public.validated_measurements is
  'Derivação de RAW + flags + expurgos. Não duplica leituras e nunca substitui NULL por zero.';
