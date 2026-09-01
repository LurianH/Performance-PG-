begin;

do $bootstrap$
declare
  v_admin_id uuid;
  v_admin_count integer;
begin
  select count(*), (array_agg(id))[1]
    into v_admin_count, v_admin_id
  from public.profiles
  where role = 'ADMIN' and active is true;

  if v_admin_count <> 1 then
    raise exception 'ETAPA 4 abortada: esperado exatamente 1 ADMIN ativo, encontrado %', v_admin_count;
  end if;

  create temporary table expected_dmcs (
    name text primary key,
    supply_group public.supply_group not null,
    pc_channel text not null,
    has_vrp boolean not null,
    notes text
  ) on commit drop;

  insert into expected_dmcs values
    ('Castelo Branco II', 'REDE', '49945316 - Pressão 1 (mca)', true, null),
    ('Castelo Branco I', 'REDE', '49939160 - Pressão 1 (mca)', true, null),
    ('Roberto Vinhas', 'REDE', '49944798 - Pressão 1 (mca)', true, null),
    ('Diamantino', 'REDE', '49950531 - Pressão 1 (mca)', true, null),
    ('Kennedy I', 'REDE', '49949639 - Pressão 1 (mca)', true, null),
    ('Kennedy II', 'REDE', '49952441 - Pressão 1 (mca)', true, null),
    ('Aldo Coli', 'REDE', '49951952 - Pressão 1 (mca)', true, null),
    ('Oceânica Amabile', 'REDE', '49707382 - Pressão 1 (mca)', true, null),
    ('Booster Ocian', 'XIXOVA', 'Pressão 1 (mca)', false, 'Setor sem VRP. Monitoramento do PC realizado por logger de pressão.'),
    ('Júlio de Mesquita', 'XIXOVA', '49905190 - Pressão 1 (mca)', true, null),
    ('Sérgio Henrique', 'XIXOVA', '49952958 - Pressão 1 (mca)', true, null),
    ('Acre', 'XIXOVA', '49945776 - Pressão 1 (mca)', true, null),
    ('Costa e Silva', 'XIXOVA', '49948374 - Pressão 1 (mca)', true, null),
    ('Maria do Carmo', 'XIXOVA', '49844054 - Pressão 1 (mca)', true, null);

  if exists (
    select 1 from public.dmcs d join expected_dmcs e on lower(e.name) = lower(d.name)
    where row(d.supply_group, d.pc_channel, d.has_vrp, d.active, d.notes)
      is distinct from row(e.supply_group, e.pc_channel, e.has_vrp, true, e.notes)
  ) then
    raise exception 'ETAPA 4 abortada: DMC existente conflita com a referência oficial';
  end if;

  if exists (select 1 from public.dmcs d where not exists (select 1 from expected_dmcs e where lower(e.name) = lower(d.name))) then
    raise exception 'ETAPA 4 abortada: existem DMCs fora do conjunto oficial esperado';
  end if;

  insert into public.dmcs (name, supply_group, pc_channel, has_vrp, active, notes)
  select e.name, e.supply_group, e.pc_channel, e.has_vrp, true, e.notes
  from expected_dmcs e
  where not exists (select 1 from public.dmcs d where lower(d.name) = lower(e.name));

  if exists (
    select 1 from public.performance_contract_parameters
    where parameter_key in ('VP_BASELINE', 'REDUCTION_TARGET_100', 'REDUCTION_TARGET_120')
      and not (effective_from = date '2025-12-01' and effective_to is null)
  ) then
    raise exception 'ETAPA 4 abortada: vigência contratual conflitante';
  end if;

  insert into public.performance_contract_parameters
    (parameter_key, numeric_value, effective_from, effective_to, notes, created_by)
  select x.parameter_key, x.numeric_value, date '2025-12-01', null, x.notes, v_admin_id
  from (values
    ('VP_BASELINE', 1969934::numeric, 'VP médio oficial de referência utilizado para apuração do contrato. Baseline formado no período jun/2023 a mai/2024.'),
    ('REDUCTION_TARGET_100', 307309.626::numeric, 'Meta de redução correspondente a 100% do objetivo volumétrico.'),
    ('REDUCTION_TARGET_120', 368775::numeric, 'Referência volumétrica correspondente a 120% da meta.')
  ) x(parameter_key, numeric_value, notes)
  where not exists (
    select 1 from public.performance_contract_parameters p
    where p.parameter_key = x.parameter_key and p.effective_from = date '2025-12-01'
  );

  if exists (
    select 1 from public.performance_contract_parameters p
    join (values
      ('VP_BASELINE', 1969934::numeric, 'VP médio oficial de referência utilizado para apuração do contrato. Baseline formado no período jun/2023 a mai/2024.'),
      ('REDUCTION_TARGET_100', 307309.626::numeric, 'Meta de redução correspondente a 100% do objetivo volumétrico.'),
      ('REDUCTION_TARGET_120', 368775::numeric, 'Referência volumétrica correspondente a 120% da meta.')
    ) x(parameter_key, numeric_value, notes) using (parameter_key)
    where row(p.numeric_value, p.text_value, p.effective_from, p.effective_to, p.notes)
      is distinct from row(x.numeric_value, null::text, date '2025-12-01', null::date, x.notes)
  ) then
    raise exception 'ETAPA 4 abortada: parâmetro contratual conflitante';
  end if;

  if exists (
    select 1 from public.technical_parameters
    where key in ('PC_NORMAL_MIN','PC_CRITICAL_MIN','PC_MAX','NIGHT_START','NIGHT_END','CRITICAL_WINDOW_START','CRITICAL_WINDOW_END')
      and not (effective_from = timestamptz '2025-10-01 00:00:00-03' and effective_to is null)
  ) then
    raise exception 'ETAPA 4 abortada: vigência técnica conflitante';
  end if;

  insert into public.technical_parameters
    (key, numeric_value, text_value, effective_from, effective_to, notes, created_by)
  select x.key, x.numeric_value, x.text_value, timestamptz '2025-10-01 00:00:00-03', null,
    'Vigência metodológica para análise histórica das séries disponíveis. Não representa vigência regulatória.', v_admin_id
  from (values
    ('PC_NORMAL_MIN', 10::numeric, null::text),
    ('PC_CRITICAL_MIN', 3.2::numeric, null::text),
    ('PC_MAX', 50::numeric, null::text),
    ('NIGHT_START', null::numeric, '23:00'),
    ('NIGHT_END', null::numeric, '05:00'),
    ('CRITICAL_WINDOW_START', null::numeric, '23:15'),
    ('CRITICAL_WINDOW_END', null::numeric, '04:45')
  ) x(key, numeric_value, text_value)
  where not exists (
    select 1 from public.technical_parameters p
    where p.key = x.key and p.effective_from = timestamptz '2025-10-01 00:00:00-03'
  );

  if exists (
    select 1 from public.technical_parameters p
    join (values
      ('PC_NORMAL_MIN', 10::numeric, null::text), ('PC_CRITICAL_MIN', 3.2::numeric, null::text),
      ('PC_MAX', 50::numeric, null::text), ('NIGHT_START', null::numeric, '23:00'),
      ('NIGHT_END', null::numeric, '05:00'), ('CRITICAL_WINDOW_START', null::numeric, '23:15'),
      ('CRITICAL_WINDOW_END', null::numeric, '04:45')
    ) x(key, numeric_value, text_value) using (key)
    where row(p.numeric_value, p.text_value, p.json_value, p.effective_from, p.effective_to, p.notes)
      is distinct from row(x.numeric_value, x.text_value, null::jsonb, timestamptz '2025-10-01 00:00:00-03', null::timestamptz,
        'Vigência metodológica para análise histórica das séries disponíveis. Não representa vigência regulatória.')
  ) then
    raise exception 'ETAPA 4 abortada: parâmetro técnico conflitante';
  end if;

  if (select count(*) from public.dmcs) <> 14
    or (select count(*) from public.dmcs where supply_group = 'REDE') <> 8
    or (select count(*) from public.dmcs where supply_group = 'XIXOVA') <> 6
    or (select count(*) from public.dmcs where has_vrp) <> 13
    or (select count(*) from public.dmcs where not has_vrp) <> 1
    or (select count(*) from public.performance_contract_parameters where effective_to is null) <> 3
    or (select count(*) from public.technical_parameters where effective_to is null) <> 7
    or (select count(*) from public.performance_months) <> 0
    or (select count(*) from public.projection_scenarios) <> 0
    or (select count(*) from public.raw_measurements) <> 0
    or (select count(*) from public.data_imports) <> 0
    or (select count(*) from public.equipment_periods) <> 0 then
    raise exception 'ETAPA 4 abortada: checkpoint quantitativo divergente';
  end if;
end
$bootstrap$;

commit;
