create view private.hydraulic_valid_measurements as
select r.id measurement_id,r.dmc_id,r.channel_type,r.measured_at,
  case when r.channel_type='FLOW' and lower(r.unit) in('m3/h','m3_h','m3h') then r.raw_value/3.6
    when r.channel_type='FLOW' and lower(r.unit) in('l/s','l_s','ls') then r.raw_value
    when r.channel_type in('PRESSURE_PC','PRESSURE_UPSTREAM','PRESSURE_DOWNSTREAM','PRESSURE_SUPPLY') and lower(r.unit)='mca' then r.raw_value end normalized_value,
  true is_valid
from public.raw_measurements r
where r.raw_value is not null
  and not exists(select 1 from public.measurement_quality_flags q where q.measurement_id=r.id and q.severity='INVALID')
  and not exists(select 1 from public.measurement_exclusions e where e.revoked_at is null and (e.measurement_id=r.id or (e.measurement_id is null and (e.dmc_id is null or e.dmc_id=r.dmc_id) and (e.source_type is null or e.source_type=r.source_type) and (e.channel_type is null or e.channel_type=r.channel_type) and e.starts_at<=r.measured_at and (e.ends_at is null or r.measured_at<e.ends_at))))
  and not exists(select 1 from public.equipment_periods ep join public.equipment_period_channels ec on ec.equipment_period_id=ep.id where ep.dmc_id=r.dmc_id and ec.channel_type=r.channel_type and ep.started_at<=r.measured_at and (ep.ended_at is null or r.measured_at<ep.ended_at) and ep.status in('NOT_INSTALLED','INSTALLED_NOT_COMMISSIONED','UNAVAILABLE','FAILED','MAINTENANCE'));

revoke all on private.hydraulic_valid_measurements from public,anon,authenticated;

do $$ declare definition text; begin
  select pg_get_functiondef('private.run_one_dmc_hydraulic_diagnostic(uuid,uuid,date,date,text)'::regprocedure) into definition;
  definition:=replace(definition,'public.validated_measurements','private.hydraulic_valid_measurements');
  execute definition;
end $$;

comment on view private.hydraulic_valid_measurements is 'Fonte interna equivalente à elegibilidade canônica, otimizada para o motor em lote; preserva RAW e respeita flags INVALID, exclusões e indisponibilidade por canal.';
