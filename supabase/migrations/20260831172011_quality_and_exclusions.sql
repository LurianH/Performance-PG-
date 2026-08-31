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
  constraint exclusions_target_unambiguous check (
    (
      measurement_id is not null
      and dmc_id is null
      and source_type is null
      and channel_type is null
      and starts_at is null
      and ends_at is null
    )
    or (
      measurement_id is null
      and starts_at is not null
      and (dmc_id is not null or source_type is not null or channel_type is not null)
    )
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
  not (
    rm.raw_value is null
    or equipment_state.status in (
      'NOT_INSTALLED', 'INSTALLED_NOT_COMMISSIONED', 'UNAVAILABLE', 'FAILED', 'MAINTENANCE'
    )
    or coalesce(flags.has_invalid_flag, false)
    or active_exclusion.exclusion_id is not null
  ) as is_valid,
  case
    when rm.raw_value is null then 'RAW_VALUE_NULL'
    when equipment_state.status in (
      'NOT_INSTALLED', 'INSTALLED_NOT_COMMISSIONED', 'UNAVAILABLE', 'FAILED', 'MAINTENANCE'
    ) then 'EQUIPMENT_' || equipment_state.status::text
    when coalesce(flags.has_invalid_flag, false) then 'QUALITY_FLAG:' || flags.flag_types
    when active_exclusion.exclusion_id is not null then 'EXCLUDED:' || active_exclusion.reason_code
    else null
  end as invalid_reason,
  equipment_state.status as equipment_status,
  coalesce(flags.has_quality_flag, false) as has_quality_flag,
  active_exclusion.exclusion_id is not null as is_excluded,
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
  case
    when rm.raw_value is null then 'NULL_VALUE'
    when equipment_state.status in (
      'NOT_INSTALLED', 'INSTALLED_NOT_COMMISSIONED', 'UNAVAILABLE', 'FAILED', 'MAINTENANCE'
    ) then 'EQUIPMENT_UNAVAILABLE'
    when coalesce(flags.has_invalid_flag, false) then 'INVALID'
    when active_exclusion.exclusion_id is not null then 'EXCLUDED'
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
  select ep.status
  from public.equipment_periods ep
  join public.equipment_period_channels epc on epc.equipment_period_id = ep.id
  where ep.dmc_id = rm.dmc_id
    and epc.channel_type = rm.channel_type
    and ep.started_at <= rm.measured_at
    and (ep.ended_at is null or rm.measured_at < ep.ended_at)
  order by
    case ep.status
      when 'FAILED' then 1
      when 'UNAVAILABLE' then 2
      when 'NOT_INSTALLED' then 3
      when 'INSTALLED_NOT_COMMISSIONED' then 4
      when 'MAINTENANCE' then 5
      when 'AVAILABLE' then 6
    end,
    ep.started_at desc
  limit 1
) equipment_state on true
left join lateral (
  select
    count(*) > 0 as has_quality_flag,
    bool_or(mqf.severity = 'INVALID') as has_invalid_flag,
    bool_or(mqf.severity = 'WARNING') as has_warning_flag,
    string_agg(distinct mqf.flag_type::text, ',' order by mqf.flag_type::text) as flag_types
  from public.measurement_quality_flags mqf
  where mqf.measurement_id = rm.id
) flags on true;

comment on view public.validated_measurements is
  'Explica validade por canal/equipamento, flags e expurgos; RAW e NULL permanecem preservados.';
