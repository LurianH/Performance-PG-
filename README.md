# Performance Praia Grande

Aplicação React, TypeScript e Vite com fundação visual, autenticação preparada e schema Supabase implantado. As telas continuam usando dados locais marcados como demonstração até a autorização das próximas etapas.

## Execução

```bash
npm install
npm run dev
```

Validação de produção:

```bash
npm run lint
npm run build
```

## Configuração local do Supabase

Crie `.env.local` com valores do projeto correspondente:

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
```

Use somente a chave `publishable` no frontend. `.env.local` está ignorado pelo Git.

## Limites atuais

- sem dados oficiais;
- sem implementação de CPE, IAL, IPS ou cálculos hidráulicos;
- sem seed, importador ou publicação na Vercel;
- sem primeiro ADMIN até autorização explícita e execução de `docs/BOOTSTRAP_ADMIN.md`.

Consulte `docs/ETAPA_3_IMPLANTACAO_SUPABASE.md` para o registro da implantação e recuperação.
