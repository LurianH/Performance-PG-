-- Processa cada DMC isoladamente para limitar uso de disco temporário.
create or replace function private.run_one_dmc_hydraulic_diagnostic(
  p_run_id uuid,p_dmc_id uuid,p_period_start date,p_period_end date,p_rule_version text
) returns void language plpgsql security invoker set search_path='' as $$
begin
  create temporary table hydraulic_base on commit drop as
  with source as (
    select vm.measurement_id,vm.channel_type::text channel_type,vm.measured_at,vm.normalized_value::numeric value,
      vm.measured_at at time zone 'America/Sao_Paulo' local_at,
      lead(vm.measured_at) over(partition by vm.channel_type order by vm.measured_at) next_at
    from public.validated_measurements vm where vm.dmc_id=p_dmc_id and vm.is_valid and vm.normalized_value is not null
      and vm.channel_type in ('PRESSURE_PC','PRESSURE_UPSTREAM','PRESSURE_DOWNSTREAM','FLOW')
      and vm.measured_at >= (p_period_start::timestamp at time zone 'America/Sao_Paulo')
      and vm.measured_at < ((p_period_end+2)::timestamp at time zone 'America/Sao_Paulo')
  ), diffs as (
    select *,extract(epoch from(next_at-measured_at))/60.0 diff_minutes from source
  ), cadence as (
    select channel_type,percentile_cont(0.5) within group(order by diff_minutes) cadence_minutes
    from diffs where diff_minutes>0 and diff_minutes<=120 group by channel_type
  ), center as (
    select channel_type,percentile_cont(0.5) within group(order by value) median_value from diffs group by channel_type
  ), mad as (
    select d.channel_type,c.median_value,percentile_cont(0.5) within group(order by abs(d.value-c.median_value)) mad_value
    from diffs d join center c using(channel_type) group by d.channel_type,c.median_value
  )
  select d.*,c.cadence_minutes,greatest(0,least(coalesce(d.diff_minutes,c.cadence_minutes),c.cadence_minutes))/60.0 duration_hours,
    d.local_at::date calendar_date,case when d.local_at::time<time '05:00' then d.local_at::date-1 else d.local_at::date end operational_date,
    (d.local_at::time>=time '23:00' or d.local_at::time<time '05:00') is_night,
    (d.local_at::time>=time '23:15' or d.local_at::time<time '04:45') is_critical,
    (m.mad_value>0 and abs(d.value-m.median_value)>6*m.mad_value) is_robust_outlier,
    greatest(coalesce(d.diff_minutes,0)-c.cadence_minutes,0) gap_minutes
  from diffs d join cadence c using(channel_type) join mad m using(channel_type);

  insert into public.dmc_hydraulic_daily(analysis_run_id,dmc_id,analysis_date,rule_version,pc_min,pc_avg,pc_max,pc_min_at,pc_max_at,hours_below_10,critical_hours_below_3_2,hours_above_50,night_green_pct,night_yellow_pct,night_red_pct,pc_night_avg,flow_avg_l_s,flow_min_l_s,flow_max_l_s,flow_night_avg_l_s,coverage_pct,gap_count,largest_gap_minutes,quality_flags,daily_status,night_pc_flow_correlation)
  with days as (
    select day::date analysis_date from generate_series(p_period_start,p_period_end,interval '1 day') day
  ), stats as (
    select calendar_date analysis_date,min(value) filter(where channel_type='PRESSURE_PC') pc_min,avg(value) filter(where channel_type='PRESSURE_PC') pc_avg,max(value) filter(where channel_type='PRESSURE_PC') pc_max,
      sum(duration_hours) filter(where channel_type='PRESSURE_PC' and value<10) below10,sum(duration_hours) filter(where channel_type='PRESSURE_PC' and value>50) above50,
      avg(value) filter(where channel_type='FLOW') flow_avg,min(value) filter(where channel_type='FLOW') flow_min,max(value) filter(where channel_type='FLOW') flow_max,
      least(100,100*sum(duration_hours)/(24*count(distinct channel_type))) coverage,
      count(*) filter(where gap_minutes>cadence_minutes*0.5) gap_count,max(gap_minutes) largest_gap,
      count(*) filter(where is_robust_outlier and channel_type='FLOW') flow_outliers,
      count(*) filter(where is_robust_outlier and channel_type like 'PRESSURE_%') pressure_outliers
    from hydraulic_base where calendar_date between p_period_start and p_period_end group by calendar_date
  ), extremes as (
    select distinct calendar_date analysis_date,
      first_value(measured_at) over(partition by calendar_date order by value,measured_at) min_at,
      first_value(measured_at) over(partition by calendar_date order by value desc,measured_at) max_at
    from hydraulic_base where channel_type='PRESSURE_PC' and calendar_date between p_period_start and p_period_end
  ), night as (
    select operational_date analysis_date,avg(value) filter(where channel_type='PRESSURE_PC' and is_night) pc_night_avg,
      avg(value) filter(where channel_type='FLOW' and is_night) flow_night_avg,
      sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_critical and value<3.2) critical_low,
      100*sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_night and value between 10 and 50)/nullif(sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_night),0) green_pct,
      100*sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_night and value>=3.2 and value<10)/nullif(sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_night),0) yellow_pct,
      100*sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_night and (value>50 or (is_critical and value<3.2)))/nullif(sum(duration_hours) filter(where channel_type='PRESSURE_PC' and is_night),0) red_pct
    from hydraulic_base where operational_date between p_period_start and p_period_end group by operational_date
  ), aligned as (
    select pc.operational_date analysis_date,corr(pc.value,fl.value) correlation from hydraulic_base pc join hydraulic_base fl on fl.measured_at=pc.measured_at and fl.channel_type='FLOW' and fl.is_night
    where pc.channel_type='PRESSURE_PC' and pc.is_night and pc.operational_date between p_period_start and p_period_end group by pc.operational_date
  )
  select p_run_id,p_dmc_id,d.analysis_date,p_rule_version,s.pc_min,s.pc_avg,s.pc_max,e.min_at,e.max_at,coalesce(s.below10,0),coalesce(n.critical_low,0),coalesce(s.above50,0),n.green_pct,n.yellow_pct,n.red_pct,n.pc_night_avg,s.flow_avg,s.flow_min,s.flow_max,n.flow_night_avg,coalesce(s.coverage,0),coalesce(s.gap_count,0),coalesce(s.largest_gap,0),
    jsonb_build_object('FLOW_OUTLIER',coalesce(s.flow_outliers,0),'PRESSURE_OUTLIER',coalesce(s.pressure_outliers,0),'ZERO_STREAK',(select count(*) from public.measurement_quality_flags q join public.raw_measurements r on r.id=q.measurement_id where r.dmc_id=p_dmc_id and (r.measured_at at time zone 'America/Sao_Paulo')::date=d.analysis_date and q.flag_type='ZERO_STREAK'),'DATA_GAP',coalesce(s.gap_count,0),'LOW_COVERAGE',case when coalesce(s.coverage,0)<75 then 1 else 0 end),
    case when s.pc_min is null then 'NO_DATA' when coalesce(s.coverage,0)<75 then 'DATA_FAILURE' when coalesce(n.critical_low,0)>0 or coalesce(s.above50,0)>0 then 'RED' when coalesce(s.below10,0)>0 then 'YELLOW' else 'GREEN' end,a.correlation
  from days d left join stats s using(analysis_date) left join extremes e using(analysis_date) left join night n using(analysis_date) left join aligned a using(analysis_date);

  insert into public.dmc_hydraulic_monthly(analysis_run_id,dmc_id,competence,rule_version,pc_avg,pc_min,pc_max,hours_below_10,critical_hours_below_3_2,hours_above_50,green_days_pct,yellow_days_pct,red_days_pct,flow_avg_l_s,flow_night_avg_l_s,coverage_pct,data_failure_days,trend,previous_month_delta,night_pc_flow_correlation,quality_flags)
  with monthly as (
    select date_trunc('month',analysis_date)::date competence,avg(pc_avg) pc_avg,min(pc_min) pc_min,max(pc_max) pc_max,sum(hours_below_10) below10,sum(critical_hours_below_3_2) below32,sum(hours_above_50) above50,
      100*count(*) filter(where daily_status='GREEN')/nullif(count(*) filter(where daily_status not in('NO_DATA','DATA_FAILURE')),0)::numeric green_pct,
      100*count(*) filter(where daily_status='YELLOW')/nullif(count(*) filter(where daily_status not in('NO_DATA','DATA_FAILURE')),0)::numeric yellow_pct,
      100*count(*) filter(where daily_status='RED')/nullif(count(*) filter(where daily_status not in('NO_DATA','DATA_FAILURE')),0)::numeric red_pct,
      avg(flow_avg_l_s) flow_avg,avg(flow_night_avg_l_s) flow_night_avg,avg(coverage_pct) coverage,count(*) filter(where daily_status in('NO_DATA','DATA_FAILURE')) failure_days,
      jsonb_build_object('FLOW_OUTLIER',sum((quality_flags->>'FLOW_OUTLIER')::int),'PRESSURE_OUTLIER',sum((quality_flags->>'PRESSURE_OUTLIER')::int),'ZERO_STREAK',sum((quality_flags->>'ZERO_STREAK')::int),'DATA_GAP',sum((quality_flags->>'DATA_GAP')::int),'LOW_COVERAGE',sum((quality_flags->>'LOW_COVERAGE')::int)) flags
    from public.dmc_hydraulic_daily where analysis_run_id=p_run_id and dmc_id=p_dmc_id group by date_trunc('month',analysis_date)
  ), previous as (
    select *,lag(below10) over(order by competence) previous_below10 from monthly
  ), correlations as (
    select date_trunc('month',pc.operational_date)::date competence,corr(pc.value,fl.value) correlation from hydraulic_base pc join hydraulic_base fl on fl.measured_at=pc.measured_at and fl.channel_type='FLOW' and fl.is_night
    where pc.channel_type='PRESSURE_PC' and pc.is_night group by date_trunc('month',pc.operational_date)
  )
  select p_run_id,p_dmc_id,m.competence,p_rule_version,m.pc_avg,m.pc_min,m.pc_max,m.below10,m.below32,m.above50,m.green_pct,m.yellow_pct,m.red_pct,m.flow_avg,m.flow_night_avg,m.coverage,m.failure_days,
    case when m.previous_below10 is null then 'NO_BASELINE' when m.below10<m.previous_below10*0.9 then 'IMPROVEMENT' when m.below10>m.previous_below10*1.1 then 'WORSENING' else 'STABLE' end,
    case when m.previous_below10 is null then null else m.below10-m.previous_below10 end,c.correlation,m.flags from previous m left join correlations c using(competence);

  drop table hydraulic_base;
end;
$$;

create or replace function private.run_dmc_hydraulic_diagnostics(p_period_start date,p_period_end date,p_rule_version text default 'hydraulic-dmc-v1',p_created_by uuid default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_run_id uuid; v_dmc_id uuid;
begin
  if p_period_end<p_period_start then raise exception 'Invalid hydraulic diagnostic period'; end if;
  if btrim(p_rule_version)='' then raise exception 'Rule version is required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('DMC_HYDRAULIC_DIAGNOSTIC|'||p_rule_version||'|'||p_period_start||'|'||p_period_end,0));
  select id into v_run_id from public.analysis_runs where analysis_type='DMC_HYDRAULIC_DIAGNOSTIC' and algorithm_version=p_rule_version and period_start=(p_period_start::timestamp at time zone 'America/Sao_Paulo') and period_end=((p_period_end+1)::timestamp at time zone 'America/Sao_Paulo') and status='COMPLETED' order by created_at desc limit 1;
  if v_run_id is not null then return v_run_id; end if;
  insert into public.analysis_runs(analysis_type,algorithm_version,parameters_snapshot,period_start,period_end,started_at,status,created_by)
  values('DMC_HYDRAULIC_DIAGNOSTIC',p_rule_version,jsonb_build_object('timezone','America/Sao_Paulo','operational_window','23:00-05:00','critical_window','23:15-04:45','pc_green_mca',jsonb_build_array(10,50),'pc_yellow_mca',jsonb_build_array(3.2,10),'pc_critical_min_mca',3.2,'robust_outlier_method','median +/- 6*MAD per DMC/channel/analysis period','duration_method','real timestamp intervals capped at predominant median cadence','execution_partition','one DMC at a time'),p_period_start::timestamp at time zone 'America/Sao_Paulo',(p_period_end+1)::timestamp at time zone 'America/Sao_Paulo',clock_timestamp(),'RUNNING',p_created_by) returning id into v_run_id;
  for v_dmc_id in select distinct vm.dmc_id from public.validated_measurements vm where vm.dmc_id is not null and vm.is_valid and vm.measured_at>=(p_period_start::timestamp at time zone 'America/Sao_Paulo') and vm.measured_at<((p_period_end+1)::timestamp at time zone 'America/Sao_Paulo') loop
    perform private.run_one_dmc_hydraulic_diagnostic(v_run_id,v_dmc_id,p_period_start,p_period_end,p_rule_version);
  end loop;
  update public.analysis_runs set status='COMPLETED',finished_at=clock_timestamp() where id=v_run_id;
  return v_run_id;
exception when others then
  update public.analysis_runs set status='FAILED',finished_at=clock_timestamp() where id=v_run_id;
  raise;
end;
$$;

revoke all on function private.run_one_dmc_hydraulic_diagnostic(uuid,uuid,date,date,text) from public,anon,authenticated;
revoke all on function private.run_dmc_hydraulic_diagnostics(date,date,text,uuid) from public,anon,authenticated;
