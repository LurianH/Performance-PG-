-- Consolida INSERT manual e automático para evitar policies permissivas múltiplas.
drop policy quality_flags_insert_operator on public.measurement_quality_flags;
drop policy quality_flags_insert_import_system on public.measurement_quality_flags;

create policy quality_flags_insert_operator
on public.measurement_quality_flags for insert to authenticated
with check (
  (select private.current_user_role()) in ('ADMIN', 'GESTOR')
  and (
    detected_by = 'USER'
    or (
      detected_by = 'SYSTEM'
      and severity in ('INFO', 'WARNING')
      and flag_type in ('MISSING_TIMESTAMP', 'DUPLICATE', 'NULL_VALUE', 'ZERO_STREAK')
      and nullif(btrim(algorithm_version), '') is not null
      and exists (
        select 1
        from public.raw_measurements rm
        join public.data_imports di on di.id = rm.import_id
        where rm.id = measurement_id
          and di.imported_by = (select auth.uid())
      )
    )
  )
);
