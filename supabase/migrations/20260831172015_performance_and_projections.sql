create table public.performance_months (
  id uuid primary key default gen_random_uuid(),
  competence date not null,
  vd numeric,
  vcm numeric,
  status public.performance_status not null,
  source text not null,
  notes text,
  change_justification text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint performance_competence_month_start check (competence = date_trunc('month', competence)::date),
  constraint performance_source_not_blank check (btrim(source) <> '')
);

create unique index performance_months_competence_unique on public.performance_months (competence);

create function private.require_performance_change_justification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (old.status in ('MEDIDO_SABESP', 'REALIZADO_ATUAL')
      or new.status in ('MEDIDO_SABESP', 'REALIZADO_ATUAL'))
    and row(old.competence, old.vd, old.vcm, old.status, old.source, old.notes)
      is distinct from row(new.competence, new.vd, new.vcm, new.status, new.source, new.notes)
    and nullif(btrim(new.change_justification), '') is null then
    raise exception 'Changes to measured/realized performance require change_justification';
  end if;
  return new;
end;
$$;

revoke all on function private.require_performance_change_justification() from public, anon, authenticated;

create trigger performance_months_require_change_justification
before update on public.performance_months
for each row execute function private.require_performance_change_justification();

create table public.performance_contract_parameters (
  id uuid primary key default gen_random_uuid(),
  parameter_key text not null,
  numeric_value numeric,
  text_value text,
  effective_from date not null,
  effective_to date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint performance_contract_parameter_key_not_blank check (btrim(parameter_key) <> ''),
  constraint performance_contract_parameter_one_value check (num_nonnulls(numeric_value, text_value) = 1),
  constraint performance_contract_parameter_valid_range check (effective_to is null or effective_to >= effective_from),
  constraint performance_contract_known_numeric_positive check (
    parameter_key not in ('VP_BASELINE', 'REDUCTION_TARGET_100', 'REDUCTION_TARGET_120')
    or numeric_value > 0
  ),
  constraint performance_contract_parameter_no_overlap exclude using gist (
    parameter_key with =,
    (daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]')) with &&
  )
);

create index performance_contract_parameters_lookup_idx
  on public.performance_contract_parameters (parameter_key, effective_from, effective_to);

create view public.performance_months_derived
with (security_invoker = true)
as
select
  pm.*,
  case when pm.vd is not null and pm.vcm is not null then pm.vd - pm.vcm end as vp,
  case when pm.vd is not null and pm.vcm is not null and baseline.numeric_value is not null
    then baseline.numeric_value - (pm.vd - pm.vcm)
  end as reduction,
  case when pm.vd is not null and pm.vcm is not null
      and baseline.numeric_value is not null and target.numeric_value is not null
    then ((baseline.numeric_value - (pm.vd - pm.vcm)) / target.numeric_value) * 100
  end as attainment_pct
  ,baseline.id as baseline_parameter_id
  ,baseline.effective_from as baseline_parameter_effective_from
  ,target.id as target_100_parameter_id
  ,target.effective_from as target_100_parameter_effective_from
from public.performance_months pm
left join lateral (
  select p.id, p.numeric_value, p.effective_from
  from public.performance_contract_parameters p
  where p.parameter_key = 'VP_BASELINE'
    and p.effective_from <= pm.competence
    and (p.effective_to is null or pm.competence <= p.effective_to)
  order by p.effective_from desc
  limit 1
) baseline on true
left join lateral (
  select p.id, p.numeric_value, p.effective_from
  from public.performance_contract_parameters p
  where p.parameter_key = 'REDUCTION_TARGET_100'
    and p.effective_from <= pm.competence
    and (p.effective_to is null or pm.competence <= p.effective_to)
  order by p.effective_from desc
  limit 1
) target on true;

create table public.projection_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  assumptions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projection_scenario_name_not_blank check (btrim(name) <> '')
);

create unique index projection_scenarios_name_unique_ci on public.projection_scenarios (lower(name));

create table public.projection_values (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.projection_scenarios(id) on delete restrict,
  competence date not null,
  vd numeric,
  vcm numeric,
  status public.performance_status not null default 'PROJETADO',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projection_competence_month_start check (competence = date_trunc('month', competence)::date)
);

create unique index projection_values_scenario_competence_unique
  on public.projection_values (scenario_id, competence);

create view public.projection_values_derived
with (security_invoker = true)
as
select
  pv.*,
  case when pv.vd is not null and pv.vcm is not null then pv.vd - pv.vcm end as vp,
  case when pv.vd is not null and pv.vcm is not null and baseline.numeric_value is not null
    then baseline.numeric_value - (pv.vd - pv.vcm)
  end as reduction,
  case when pv.vd is not null and pv.vcm is not null
      and baseline.numeric_value is not null and target.numeric_value is not null
    then ((baseline.numeric_value - (pv.vd - pv.vcm)) / target.numeric_value) * 100
  end as attainment_pct
  ,baseline.id as baseline_parameter_id
  ,baseline.effective_from as baseline_parameter_effective_from
  ,target.id as target_100_parameter_id
  ,target.effective_from as target_100_parameter_effective_from
from public.projection_values pv
left join lateral (
  select p.id, p.numeric_value, p.effective_from
  from public.performance_contract_parameters p
  where p.parameter_key = 'VP_BASELINE'
    and p.effective_from <= pv.competence
    and (p.effective_to is null or pv.competence <= p.effective_to)
  order by p.effective_from desc
  limit 1
) baseline on true
left join lateral (
  select p.id, p.numeric_value, p.effective_from
  from public.performance_contract_parameters p
  where p.parameter_key = 'REDUCTION_TARGET_100'
    and p.effective_from <= pv.competence
    and (p.effective_to is null or pv.competence <= p.effective_to)
  order by p.effective_from desc
  limit 1
) target on true;

create table public.technical_parameters (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  numeric_value numeric,
  text_value text,
  json_value jsonb,
  effective_from timestamptz not null,
  effective_to timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint technical_parameter_key_not_blank check (btrim(key) <> ''),
  constraint technical_parameter_one_value check (
    num_nonnulls(numeric_value, text_value, json_value) = 1
  ),
  constraint technical_parameter_valid_range check (effective_to is null or effective_to > effective_from),
  constraint technical_parameter_no_overlap exclude using gist (
    key with =,
    (tstzrange(effective_from, coalesce(effective_to, 'infinity'::timestamptz), '[)')) with &&
  )
);

create trigger performance_months_set_updated_at before update on public.performance_months
for each row execute function private.set_updated_at();
create trigger projection_scenarios_set_updated_at before update on public.projection_scenarios
for each row execute function private.set_updated_at();
create trigger projection_values_set_updated_at before update on public.projection_values
for each row execute function private.set_updated_at();

comment on view public.performance_months_derived is
  'VP, redução e atingimento são derivados. Sem parâmetro contratual vigente, resultados dependentes permanecem NULL.';

comment on table public.performance_contract_parameters is
  'Baseline e metas contratuais versionados, separados de parâmetros técnicos hidráulicos.';
