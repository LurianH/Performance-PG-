# ETAPA 9 — Apuração contratual e painel executivo

## Escopo

Esta etapa persiste a apuração oficial disponível do ciclo dezembro/2025 a novembro/2026 e a projeção técnica dos meses ainda não realizados. O diagnóstico hidráulico da ETAPA 8 é somente consumido pelas telas; não é recalculado nem convertido em causalidade contratual.

## Regras contratuais

- baseline de VP: `1.969.934 m³/mês`;
- meta de redução a 100%: `307.309,626 m³/mês`;
- VP de referência a 100%: `1.662.624,374 m³/mês`;
- referência a 120%: redução de `368.775 m³/mês` e VP de `1.601.159 m³/mês`;
- `VP = VD - VCM`;
- `redução = baseline - VP`;
- `atingimento = redução / 307.309,626 × 100`.

Os resultados de VP, redução e atingimento são derivados no banco. Não há interpretação financeira, CPE, IAL ou IPS nesta etapa.

## Estados

- `REALIZED`: mês oficial consolidado;
- `PARTIAL`: mês oficial ainda parcial;
- `PROJECTED`: valor exclusivamente projetado.

Realizado, parcial e projetado permanecem visual e semanticamente separados. Dezembro resulta em redução derivada de `134.593 m³`; outubro projetado resulta em VP de `1.557.063 m³` e redução de `412.871 m³`, conforme as fórmulas acima.

## Rastreabilidade

Os nove meses oficiais possuem a fonte `Apuração oficial ETAPA 9`. Setembro, outubro e novembro pertencem ao cenário `Projeção técnica oficial ETAPA 9`. A carga é idempotente e não duplica competências nem cenários.
