-- ETAPA 5: sem equipment_period aplicável, a condição deve ser FALSE, não NULL.
-- Isso garante que zero RAW e flags WARNING não invalidem automaticamente a leitura.
create or replace view public.validated_measurements
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
    or coalesce(equipment_state.status in (
      'NOT_INSTALLED', 'INSTALLED_NOT_COMMISSIONED', 'UNAVAILABLE', 'FAILED', 'MAINTENANCE'
    ), false)
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
  case when lower(rm.unit) in ('l/s', 'l_s', 'ls') then rm.raw_value * 3.6 else rm.raw_value end as normalized_value,
  rm.unit as raw_unit,
  case when lower(rm.unit) in ('l/s', 'l_s', 'ls') then 'm3_h' else rm.unit end as normalized_unit,
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
      when 'FAILED' then 1 when 'UNAVAILABLE' then 2 when 'NOT_INSTALLED' then 3
      when 'INSTALLED_NOT_COMMISSIONED' then 4 when 'MAINTENANCE' then 5 when 'AVAILABLE' then 6
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
  'Explica validade por canal/equipamento, flags e expurgos; ausência de equipment_period não invalida e RAW zero permanece zero.';
