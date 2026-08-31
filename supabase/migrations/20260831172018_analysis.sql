create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  analysis_type text not null,
  algorithm_version text not null,
  parameters_snapshot jsonb not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  status public.analysis_status not null default 'PENDING',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint analysis_type_not_blank check (btrim(analysis_type) <> ''),
  constraint analysis_algorithm_not_blank check (btrim(algorithm_version) <> ''),
  constraint analysis_period_valid check (period_end > period_start),
  constraint analysis_execution_valid check (finished_at is null or (started_at is not null and finished_at >= started_at))
);

create table public.event_analysis (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.analysis_runs(id) on delete restrict,
  dmc_id uuid not null references public.dmcs(id) on delete restrict,
  event_date date not null,
  measured_at timestamptz not null,
  cpe_class text,
  ial numeric,
  event_class text,
  data_quality text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index event_analysis_run_dmc_time_idx
  on public.event_analysis (analysis_run_id, dmc_id, measured_at);

create table public.ips_results (
  id uuid primary key default gen_random_uuid(),
  analysis_run_id uuid not null references public.analysis_runs(id) on delete restrict,
  dmc_id uuid not null references public.dmcs(id) on delete restrict,
  score_total numeric,
  severity_score numeric,
  cpe_score numeric,
  ial_score numeric,
  persistence_score numeric,
  daytime_deficit_score numeric,
  weights_snapshot jsonb not null,
  valid_coverage_pct numeric,
  calculation_status text not null,
  reason_not_calculable text,
  created_at timestamptz not null default now(),
  constraint ips_score_range check (score_total is null or score_total between 0 and 100),
  constraint ips_coverage_range check (valid_coverage_pct is null or valid_coverage_pct between 0 and 100),
  constraint ips_calculability_consistency check (
    (calculation_status = 'CALCULATED' and score_total is not null and reason_not_calculable is null)
    or (calculation_status = 'NOT_CALCULABLE' and score_total is null and reason_not_calculable is not null)
  )
);

create unique index ips_results_run_dmc_unique on public.ips_results (analysis_run_id, dmc_id);

comment on table public.ips_results is
  'IPS pertence à execução/período e preserva pesos/cobertura; nunca é atributo fixo do DMC.';
