# Bootstrap seguro do primeiro ADMIN

Este procedimento será usado uma única vez, depois que o projeto Supabase real e as migrations forem validados e aplicados com autorização explícita.

Não há senha de bootstrap, promoção automática por domínio, `service_role` no frontend ou usuário ADMIN criado por migration.

## Procedimento

1. Criar o usuário normalmente pelo Supabase Auth.
2. Confirmar que o usuário validou o e-mail.
3. Copiar o UUID diretamente da área de usuários do Supabase Auth.
4. Confirmar visualmente que UUID e e-mail pertencem à mesma pessoa.
5. No SQL Editor administrativo, substituir os dois placeholders e executar a transação abaixo.
6. Exigir exatamente uma linha alterada.
7. Conferir `profiles` e `audit_log`.
8. Testar o login e o acesso administrativo.

```sql
begin;

update public.profiles
set
  role = 'ADMIN',
  role_change_justification = 'Bootstrap inicial do primeiro administrador'
where id = '<USER_UUID>'::uuid
  and email = '<EMAIL_CONFIRMADO>'
  and active = true
  and role = 'LEITURA';

-- Deve retornar exatamente uma linha.
select id, email, role, active
from public.profiles
where id = '<USER_UUID>'::uuid
  and email = '<EMAIL_CONFIRMADO>';

commit;
```

Se o `UPDATE` alterar zero linhas, executar `rollback` em vez de ampliar o filtro. Revisar UUID, e-mail, estado do perfil e papel atual.

O trigger de auditoria registra a alteração como `ROLE_CHANGE`, incluindo `old_data`, `new_data`, timestamp e justificativa. Em execução pelo SQL Editor, `user_id` poderá ser `NULL` porque a operação usa contexto administrativo de banco, não uma sessão Auth da aplicação.

Depois que o primeiro ADMIN existir, mudanças de papel devem ocorrer somente pelo fluxo normal da aplicação, protegido por RLS e auditoria.
