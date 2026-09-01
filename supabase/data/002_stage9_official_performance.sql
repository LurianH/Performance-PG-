-- ETAPA 9 — dados oficiais fornecidos pelo usuário.
-- VP, redução e atingimento permanecem derivados de VD/VCM e parâmetros vigentes.
insert into public.performance_months(competence,vd,vcm,status,source,notes)
values
('2025-12-01',4124696,2289355,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado. Redução derivada: 134.593 m³.'),
('2026-01-01',4126942,2918525,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-02-01',3477706,2474723,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-03-01',3875139,2196797,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-04-01',3833288,2335577,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-05-01',3754421,2233994,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-06-01',3653477,2024482,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-07-01',3677306,2014922,'REALIZED','Apuração oficial ETAPA 9','Realizado consolidado.'),
('2026-08-01',3521180,2007375,'PARTIAL','Apuração oficial ETAPA 9','Mês parcial; não tratar como consolidado.')
on conflict(competence) do update set vd=excluded.vd,vcm=excluded.vcm,status=excluded.status,source=excluded.source,notes=excluded.notes,
  change_justification='Carga oficial controlada da ETAPA 9.';

insert into public.projection_scenarios(name,description,assumptions,active)
values('Projeção técnica oficial ETAPA 9','Trajetória gerencial set–nov/2026 fornecida para apresentação. Sem interpretação financeira.',jsonb_build_object('baseline_vp',1969934,'target_reduction_100',307309.626,'reference_reduction_120',368775,'method','Projeção técnica fornecida'),true)
on conflict(lower(name)) do update set description=excluded.description,assumptions=excluded.assumptions,active=true;

insert into public.projection_values(scenario_id,competence,vd,vcm,status)
select s.id,v.competence,v.vd,v.vcm,'PROJECTED'::public.performance_status from public.projection_scenarios s
cross join (values
  ('2026-09-01'::date,3462153::numeric,2033973::numeric),
  ('2026-10-01'::date,3610736::numeric,2053673::numeric),
  ('2026-11-01'::date,3560379::numeric,2168735::numeric)
) v(competence,vd,vcm)
where s.name='Projeção técnica oficial ETAPA 9'
on conflict(scenario_id,competence) do update set vd=excluded.vd,vcm=excluded.vcm,status=excluded.status,updated_at=now();
