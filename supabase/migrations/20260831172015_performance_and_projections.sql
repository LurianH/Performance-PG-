create table public.performance_months (
  id uuid primary key default gen_random_uuid(),
  competence date not null,
  vd numeric,
  vcm numeric,
  status public.performance_status not null,
  source text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint performance_competence_month_start check (competence = date_trunc('month', competence)::date),
  constraint performance_source_not_blank check (btrim(source) <> '')
);

create unique index performance_months_competence_unique on public.performance_months (competence);

create view public.performance_months_derived
with (security_invoker = true)
as
select
  pm.*,
  case when pm.vd is not null and pm.vcm is not null then pm.vd - pm.vcm end as vp,
  case when pm.vd is not null and pm.vcm is not null then 1969934::numeric - (pm.vd - pm.vcm) end as reduction,
  case when pm.vd is not null and pm.vcm is not null
    then ((1969934::numeric - (pm.vd - pm.vcm)) / 307309.626::numeric) * 100
  end as attainment_pct
from public.performance_months pm;

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
  case when pv.vd is not null and pv.vcm is not null then 1969934::numeric - (pv.vd - pv.vcm) end as reduction,
  case when pv.vd is not null and pv.vcm is not null
    then ((1969934::numeric - (pv.vd - pv.vcm)) / 307309.626::numeric) * 100
  end as attainment_pct
from public.projection_values pv;

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
  'VP, redução e atingimento são derivados para evitar redundância. Constantes são referências contratuais fornecidas, não dados mensais.';
