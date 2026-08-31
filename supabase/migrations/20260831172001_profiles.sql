create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'LEITURA',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (btrim(email) <> '')
);

comment on table public.profiles is
  'Perfil de aplicação vinculado a auth.users. Não armazena senha ou credenciais.';

create unique index profiles_email_unique_ci on public.profiles (lower(email));

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    raise exception 'Performance Praia Grande requires an email identity';
  end if;

  insert into public.profiles (id, email, full_name, role, active)
  values (
    new.id,
    new.email,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    'LEITURA',
    true
  );
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

comment on function private.handle_new_auth_user() is
  'Cria perfil LEITURA. user_metadata serve apenas para nome exibido, nunca para autorização.';
