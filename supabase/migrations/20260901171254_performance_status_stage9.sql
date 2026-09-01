alter type public.performance_status add value if not exists 'REALIZED';
alter type public.performance_status add value if not exists 'PARTIAL';
alter type public.performance_status add value if not exists 'PROJECTED';

create or replace function private.require_performance_change_justification()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (old.status in ('MEDIDO_SABESP','REALIZADO_ATUAL','REALIZED') or new.status in ('MEDIDO_SABESP','REALIZADO_ATUAL','REALIZED'))
    and row(old.competence,old.vd,old.vcm,old.status,old.source,old.notes)
      is distinct from row(new.competence,new.vd,new.vcm,new.status,new.source,new.notes)
    and nullif(btrim(new.change_justification),'') is null then
    raise exception 'Changes to measured/realized performance require change_justification';
  end if;
  return new;
end $$;

revoke all on function private.require_performance_change_justification() from public,anon,authenticated;
