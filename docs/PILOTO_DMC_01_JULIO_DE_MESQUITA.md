# PILOTO DMC 01 — Júlio de Mesquita

Executado em 1º de setembro de 2026 no projeto Supabase `Performance PG` (`dklwjrwgmsqrjurvcrwu`). Este registro documenta somente ingestão, integridade, qualidade objetiva e disponibilidade. Nenhuma regra de diagnóstico hidráulico foi aplicada.

## Arquivo e mapeamento confirmado

- arquivo: `julio de mesquita.csv` (não versionado);
- tamanho: 1.314.875 bytes;
- SHA-256: `8c6b81b8c0ed…e8098a06`, calculado sobre os bytes originais;
- MIME: `text/csv`;
- encoding: UTF-8 sem BOM;
- delimitador: `;`;
- cabeçalho: ausente;
- 29.134 linhas físicas e seis posições por linha;
- timezone de interpretação: `America/Sao_Paulo`;
- coluna 1: `TIMESTAMP`;
- coluna 2: `49905190 - Pressão 1 (mca)` → `PRESSURE_PC`, `mca`;
- coluna 3: `Pressão Montante (mca)` → `PRESSURE_UPSTREAM`, `mca`;
- coluna 4: `Pressão Jusante (mca)` → `PRESSURE_DOWNSTREAM`, `mca`;
- coluna 5: `Vazão Instantânea 1 (m³/h)` → `FLOW`, `m3_h`;
- coluna 6: `IGNORE`, vazia.

## Cadastro e contexto

O cadastro existente e único `Júlio de Mesquita` foi reutilizado, ativo e com PC oficial `49905190 - Pressão 1 (mca)`. O import foi registrado como `source_type = DMC`, com o `dmc_id` correspondente e `supply_group = NULL`. Nenhum cadastro estrutural foi criado ou alterado.

Antes da carga havia quatro imports de alimentação, 111.582 RAW, 156 flags e nenhum RAW para este DMC. Não existia import do mesmo hash no mesmo contexto.

## Resultado

- import: `e503e3bb-0902-4e56-9e67-62cc2e7a7c3b`;
- status: `COMPLETED`;
- período local: 01/11/2025 00:00:00 a 31/08/2026 23:45:00;
- cadência predominante: 15 minutos;
- timestamps válidos: 29.134;
- timestamps inválidos e rejeições: 0;
- RAW: 116.536, todos válidos na view canônica;
- nulos, erros numéricos e duplicidades: 0;
- cobertura por canal: 99,83% (29.134 de 29.184 timestamps esperados, sem materializar os 50 ausentes).

| Canal | RAW | Unidade RAW | Unidade normalizada | Mínimo | Máximo | Zeros |
|---|---:|---|---|---:|---:|---:|
| `PRESSURE_PC` | 29.134 | `mca` | `mca` | 0 | 17,43 | 2.226 |
| `PRESSURE_UPSTREAM` | 29.134 | `mca` | `mca` | 0 | 31,68 | 1.275 |
| `PRESSURE_DOWNSTREAM` | 29.134 | `mca` | `mca` | 0 | 23,01 | 1.937 |
| `FLOW` | 29.134 | `m3_h` | `l_s` | 0 | 1.265,39 | 7.375 |

O RAW da vazão permanece em `m3_h`. A view canônica já validada gera `normalized_value = raw_value / 3,6` e `normalized_unit = l_s`, sem alterar o RAW.

## Qualidade objetiva e gaps

Foram criadas 437 flags `WARNING`: 425 `ZERO_STREAK` apenas para revisão e 12 `MISSING_TIMESTAMP` (três gaps em cada um dos quatro canais). Não foram criadas flags hidráulicas, expurgos ou valores interpolados.

| Gap | Início local | Fim local | Duração | Ausentes estimados |
|---|---|---|---:|---:|
| 1 | 13/05/2026 10:00 | 13/05/2026 12:15 | 135 min | 8 |
| 2 | 21/05/2026 18:00 | 22/05/2026 00:15 | 375 min | 24 |
| 3 | 25/05/2026 07:30 | 25/05/2026 12:15 | 285 min | 18 |

`ZERO_STREAK`: PC 50, montante 64, jusante 130 e vazão 181. Os zeros foram preservados e permanecem válidos.

## Amostras e sanity checks

Todas as amostras abaixo foram verificadas na view canônica e estão `is_valid = true`.

| Amostra | Timestamp local | Canal | RAW | Normalizado |
|---|---|---|---:|---:|
| primeira | 01/11/2025 00:00 | PC | 1,90 mca | 1,90 mca |
| última | 31/08/2026 23:45 | PC | 2,08 mca | 2,08 mca |
| máximo | 30/05/2026 08:00 | PC | 17,43 mca | 17,43 mca |
| antes do maior gap | 21/05/2026 18:00 | PC | 0 mca | 0 mca |
| depois do maior gap | 22/05/2026 00:15 | PC | 0 mca | 0 mca |
| primeira/zero | 01/11/2025 00:00 | montante | 0 mca | 0 mca |
| última | 31/08/2026 23:45 | montante | 10,80 mca | 10,80 mca |
| máximo | 11/06/2026 23:45 | montante | 31,68 mca | 31,68 mca |
| antes/depois do maior gap | 21/05 18:00 / 22/05 00:15 | montante | 19,68 / 1,89 mca | idêntico ao RAW |
| primeira/zero | 01/11/2025 00:00 | jusante | 0 mca | 0 mca |
| última | 31/08/2026 23:45 | jusante | 3,08 mca | 3,08 mca |
| máximo | 12/02/2026 15:45 | jusante | 23,01 mca | 23,01 mca |
| antes/depois do maior gap | 21/05 18:00 / 22/05 00:15 | jusante | 14,75 / 0,22 mca | idêntico ao RAW |
| primeira/zero | 01/11/2025 00:00 | vazão | 0 m³/h | 0 L/s |
| última | 31/08/2026 23:45 | vazão | 149,06 m³/h | 41,4055556 L/s |
| máximo | 07/05/2026 10:30 | vazão | 1.265,39 m³/h | 351,4972222 L/s |
| antes/depois do maior gap | 21/05 18:00 / 22/05 00:15 | vazão | 322,15 / 55,67 m³/h | 89,4861111 / 15,4638889 L/s |

## Storage, segurança e disponibilidade

O arquivo original foi preservado uma única vez no bucket privado `hydraulic-imports`, em caminho exclusivo por proprietário/import, com `upsert: false`, tamanho e MIME conferidos. A restrição única de hash + origem + DMC bloqueou uma fixture duplicada. Fixtures transacionais também confirmaram que RAW não aceita `UPDATE` nem `DELETE`.

A página `/pressoes` agora consulta dinamicamente os imports DMC concluídos e mostra, por canal, período, contagem RAW, unidade, gaps e cobertura. O cartão não executa análise, classificação, correlação, CPE, IAL ou IPS.

Após o piloto: cinco imports, 228.118 RAW, 593 flags, zero rejeições, cinco objetos no bucket, exatamente um ADMIN ativo e os quatro imports de alimentação preservados com 111.582 RAW. `performance_months`, `projection_scenarios` e `measurement_exclusions` continuam vazios.
