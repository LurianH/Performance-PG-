-- ETAPA 7: garante que retomadas concorrentes ou repetidas não dupliquem
-- flags objetivas produzidas pela mesma versão do algoritmo.
create unique index measurement_quality_flags_system_idempotency_unique
on public.measurement_quality_flags (measurement_id, flag_type, algorithm_version);

comment on index public.measurement_quality_flags_system_idempotency_unique is
  'Chave idempotente das flags objetivas do importador por medição, tipo e versão do algoritmo.';
