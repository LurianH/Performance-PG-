do $$ declare definition text; marker text; replacement text; begin
  marker:='from diffs d join cadence c using(channel_type) join mad m using(channel_type);';
  replacement:=marker||E'\n\n  create index on hydraulic_base(channel_type,measured_at);\n  create index on hydraulic_base(calendar_date);\n  create index on hydraulic_base(operational_date);\n  analyze hydraulic_base;';
  select pg_get_functiondef('private.run_one_dmc_hydraulic_diagnostic(uuid,uuid,date,date,text)'::regprocedure) into definition;
  if strpos(definition,marker)=0 then raise exception 'Hydraulic workset marker not found'; end if;
  execute replace(definition,marker,replacement);
end $$;
