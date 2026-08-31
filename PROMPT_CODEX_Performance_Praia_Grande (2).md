# PROMPT PARA CODEX — PERFORMANCE PRAIA GRANDE

Quero transformar o protótipo `prototipo_performance_praia_grande_v13.html` em uma aplicação web de produção para acompanhamento do contrato de performance de redução de perdas de Praia Grande/SP.

Antes de alterar qualquer código, faça um diagnóstico breve do repositório atual: stack, estrutura de páginas/componentes, persistência, autenticação, banco de dados e deploy. Depois implemente a solução preservando o padrão visual do protótipo e evitando alterações destrutivas. Se o projeto já tiver Supabase/Vercel ou outra infraestrutura, reutilize-a. Não crie migrations ou tabelas redundantes sem necessidade. Não insira dados oficiais fictícios.

## 1. OBJETIVO DO SISTEMA

Criar um dashboard executivo e técnico para:
- acompanhar o desempenho volumétrico contratual de Praia Grande;
- acompanhar VD, VCM e VP;
- comparar desempenho realizado, meta e projeção;
- diagnosticar pressões dos 14 DMCs;
- cruzar cada DMC com sua saída de alimentação do reservatório;
- separar problemas sistêmicos de alimentação de amplificações locais;
- controlar qualidade/expurgos de dados;
- gerar ranking técnico de investigação, sem confundir esse ranking com desempenho contratual ou pagamento.

O sistema é interno para Lurian/Vitalux. Não criar acesso público da SABESP por padrão.

## 2. REFERÊNCIA VISUAL

Usar `prototipo_performance_praia_grande_v13.html` como especificação visual e funcional principal.

Preservar:
- identidade visual verde/teal;
- leitura executiva limpa;
- cards;
- tabelas;
- badges;
- navegação por seções;
- detalhamento por DMC;
- responsividade;
- rodapé no padrão SBON.

Rodapé:
- esquerda: `Performance Praia Grande - Vitalux Ecoativa`
- direita: `Desenvolvido por Lurian Hackenhaar`

Não redesenhar completamente a interface sem necessidade.

## 3. CONTRATO / APURAÇÃO DE PERFORMANCE

Contrato nº 03.731/23.
Objeto: redução de volume perdido e aumento de eficiência operacional no município de Praia Grande.

Fórmula:
`VP = VD - VCM`

Baseline oficial de VP:
`1.969.934 m³/mês`

Meta de redução 100%:
`307.309,626 m³/mês`

VP equivalente à meta 100%:
`1.662.624,374 m³/mês`

Meta de redução 120%:
`368.775 m³/mês`

VP equivalente a 120%:
`1.601.159 m³/mês`

Período de performance:
`dez/2025 a nov/2026`

Apuração conhecida:
- dez/25: VP 1.835.341 | redução 134.592 | 43,80%
- jan/26: VP 1.208.417 | redução 761.517 | 247,80%
- fev/26: VP 1.002.983 | redução 966.951 | 314,65%
- mar/26: VP 1.678.342 | redução 291.592 | 94,89%
- abr/26: VP 1.497.711 | redução 472.223 | 153,66%
- mai/26: VP 1.520.427 | redução 449.507 | 146,27%
- jun/26: VP 1.628.995 | redução 340.939 | 110,94%
- jul/26: VP 1.662.384 | redução 307.550 | 100,08%
- ago/26: VP 1.513.805 | redução 456.129 | 148,43% | status Parcial

Projeção sazonal-base:
- set/26: VD 3.462.153 | VCM 2.033.973 | VP 1.428.180 | redução 541.754 | 176,3%
- out/26: VD 3.610.736 | VCM 2.053.673 | VP 1.557.062 | redução 412.872 | 134,4%
- nov/26: VD 3.560.379 | VCM 2.168.735 | VP 1.391.644 | redução 578.290 | 188,2%

Manter também um cenário conservador/manual, quando disponível.

IMPORTANTE:
- performance oficial é do TOTAL PRAIA GRANDE;
- DMC é diagnóstico operacional;
- não converter percentual volumétrico automaticamente em percentual de pagamento;
- resultado financeiro deve ficar reservado até haver metodologia financeira validada.

## 4. PROVENIÊNCIA DOS DADOS

Todo valor deve carregar status/origem:
- `MEDIDO_SABESP`
- `REALIZADO_ATUAL`
- `PROJETADO`
- `PARCIAL`
- `DESCONSIDERADO`
- `CALCULADO`
- `ESTIMADO`
- `NAO_DISPONIVEL`

Nunca transformar ausência de dado em zero automaticamente.

## 5. TOPOLOGIA HIDRÁULICA

Hierarquia:
`Reservatório -> Saída REDE/Xixová -> DMC -> PC`

### REDE abastece:
- Castelo Branco II
- Castelo Branco I
- Roberto Vinhas
- Diamantino
- Kennedy I
- Kennedy II
- Aldo Coli
- Oceânica Amabile

### Xixová abastece:
- Booster Ocian
- Júlio de Mesquita
- Sérgio Henrique
- Acre
- Costa e Silva
- Maria do Carmo

Essa associação deve ficar persistida e editável administrativamente.

## 6. IMPORTAÇÃO DAS SÉRIES

Aceitar TXT/CSV/XLSX.

Formato típico:
- timestamp;
- PC;
- pressão montante;
- pressão jusante;
- vazão instantânea.

Alguns arquivos possuem somente pressão.

Regras:
- preservar dado bruto;
- não sobrescrever arquivo original;
- normalizar timestamp;
- trabalhar com cadência original de 15 minutos;
- detectar timestamps faltantes;
- detectar duplicidades;
- detectar valores nulos;
- detectar blocos de zero;
- detectar outliers;
- não interpolar gaps automaticamente;
- permitir expurgo com motivo;
- manter visão RAW e visão VALIDADA;
- registrar usuário/data/motivo do expurgo;
- permitir reprocessamento sem perder o bruto.

Criar um importador com etapa de mapeamento de colunas, porque os nomes podem variar.

## 7. PC E CRITÉRIOS DE PRESSÃO

Os critérios abaixo são critérios técnicos adotados para o PC. Não rotular automaticamente como obrigação regulatória sem fonte contratual/regulatória explícita.

PC:
- verde: `10 <= PC <= 50 mca`
- amarelo: `3,2 <= PC < 10 mca`
- vermelho: `PC < 3,2 mca`
- vermelho: `PC > 50 mca`

Regra exata:
`PC = 3,20 mca` pertence ao amarelo.

Janelas:
- noturna: 23:00–05:00
- crítica: 23:15–04:45

Não aplicar esses semáforos automaticamente a:
- pressão montante;
- pressão jusante;
- pressão da saída REDE;
- pressão da saída Xixová.

Esses canais são variáveis de diagnóstico.

## 8. QUALIDADE DO DADO

Exibir dois eixos separados:
1. `Saúde hidráulica`
2. `Confiabilidade do dado`

Confiabilidade:
- Boa
- Parcial
- Baixa

Falha de instrumentação nunca pode virar aparente melhora hidráulica.

## 9. EXCEÇÕES CONHECIDAS DOS DMCs

### Booster Ocian
- não possui VRP;
- análise local é baseada no logger de pressão do PC;
- ausência de PM/PJ/vazão local não é falha de dado;
- não gerar diagnóstico de setpoint de VRP;
- cruzar PC com alimentação Xixová;
- mostrar pressão mínima, máxima, duração <3,2 e duração <10.

### Sérgio Henrique
- macromedidor/VRP instalados posteriormente, aproximadamente em meados de jan/2026;
- vazão zero anterior à instalação = equipamento não disponível, não vazão hidráulica zero;
- separar pré e pós-instalação.

### Oceânica Amabile
- VRP instalada em 2026;
- zeros anteriores à implantação não entram em estatística de vazão;
- data exata deve ser configurável/confirmável;
- separar pré e pós-instalação.

### Castelo Branco I
- macromedidor avariou em fev/2026 e não retornou;
- vazões posteriores à falha devem ficar inválidas/não disponíveis;
- não impedir análise de pressão;
- há períodos de falha do PC que precisam de expurgo.

### Roberto Vinhas
- há períodos com PC em zero enquanto canais auxiliares permanecem normais;
- tratar como provável falha de sensor/telemetria até validação;
- não contabilizar esses zeros como pressão crítica real.

### Costa e Silva
- há falhas específicas de PC em partes de nov/2025 e mar/2026;
- excluir períodos inválidos antes de calcular indicadores.

### Kennedy II
- em mar/2026 a vazão aparece indisponível/zero; causa a confirmar;
- não interpretar automaticamente como vazão hidráulica zero.

## 10. CPE — CONDIÇÃO PRÉ-EVENTO

Para cada evento noturno, calcular a condição do PC imediatamente antes da perturbação sistêmica.

Classificação:
- Adequada: PC >= 10 mca
- Baixa: 3,2 <= PC < 10 mca
- Crítica: PC < 3,2 mca

Objetivo:
responder se o DMC já estava ruim antes da queda da alimentação.

## 11. IAL — ÍNDICE DE AMPLIFICAÇÃO LOCAL

Não usar simplesmente `Pressão alimentação - Pressão PC`, pois isso é contaminado por cotas e perdas permanentes.

Usar pressão relativa.

Para alimentação:
`r_alim = P_alim(t) / P_alim_ref`

Para PC:
`r_pc = P_pc(t) / P_pc_ref`

IAL:
`IAL = r_alim - r_pc`

Interpretação:
- próximo de zero: PC preserva fração semelhante à alimentação -> componente sistêmico dominante;
- positivo: PC perde proporcionalmente mais -> amplificação local;
- positivo com alimentação preservada: forte evidência de evento predominantemente local;
- negativo: PC preserva proporcionalmente mais pressão que a alimentação; não significa melhora absoluta.

`P_ref` deve ser calculado por mediana diurna válida.
Criar parâmetro administrativo para definir a janela de referência diurna. Não esconder esse parâmetro em código.

O limiar para considerar IAL “próximo de zero” também deve ser configurável.
Não tratar esse limiar como regulatório.

## 12. CLASSIFICAÇÃO EVENTO A EVENTO

Cada timestamp/evento válido pode receber:
- `LOCAL`
- `MISTO`
- `SISTEMICO`
- `INDETERMINADO`

Exemplos:
- alimentação preservada + PC cai: LOCAL;
- alimentação cai + PC perde proporcionalmente ainda mais: MISTO;
- PC acompanha aproximadamente a queda relativa da alimentação: SISTEMICO;
- dado inválido/incompleto: INDETERMINADO.

Uma madrugada pode mudar de classe ao longo do tempo.
Não impor uma única causa para a noite inteira.

## 13. RECORRÊNCIA JÁ VALIDADA

### Xixová — 01 a 08/11/2025
Nos oito primeiros dias analisados houve degrau noturno relevante simultâneo de pressão e vazão em 8/8 dias.

Medianas aproximadas das reduções da transição:
- pressão: 69,7%
- vazão: 62,7%

Isso deve aparecer como evidência de padrão sistêmico da alimentação, não como mínimo isolado.

### Kennedy II
Foi validado em pelo menos duas noites consecutivas que o PC começa a deteriorar antes do colapso forte da alimentação/montante:
- 01→02/11
- 02→03/11

Portanto Kennedy II possui evidência de precursor local antes do componente sistêmico.

Não transformar isso automaticamente em “falha da VRP”; mostrar como hipótese operacional a investigar.

## 14. IPS — ÍNDICE DE PRIORIDADE HIDRÁULICA

Criar ranking técnico de investigação, separado do desempenho contratual.

Modelo inicial configurável, 0–100:
- severidade absoluta do PC: 0–35
- CPE: 0–20
- IAL: 0–20
- persistência/recorrência: 0–15
- problema diurno residual: 0–10

Faixas:
- 80–100: Muito alta
- 60–79: Alta
- 40–59: Moderada
- <40: Menor prioridade

IMPORTANTE:
- pesos devem ficar configuráveis;
- confiabilidade do dado NÃO entra dentro do IPS;
- exibir confiabilidade como selo separado;
- não calcular score quando cobertura válida for insuficiente;
- nesse caso mostrar `Índice não calculado — dados insuficientes`.

## 15. INDICADORES QUANTITATIVOS POR DMC

Calcular, por período selecionado:
- nº de registros válidos;
- cobertura temporal;
- mínimo do PC e timestamp;
- máximo do PC e timestamp;
- média;
- mediana;
- horas PC <3,2;
- horas 3,2<=PC<10;
- horas PC <10;
- nº de noites com ocorrência crítica;
- maior duração contínua <3,2;
- maior duração contínua <10;
- CPE por evento;
- IAL mediano;
- distribuição do IAL;
- %/quantidade de timestamps classificados Local/Misto/Sistêmico/Indeterminado;
- comportamento diurno;
- comparação com alimentação;
- qualidade do dado;
- observações/expurgos.

Não usar percentuais qualitativos inventados.

## 16. INDICADORES DAS SAÍDAS REDE E XIXOVÁ

Mostrar separadamente:
- pressão de saída;
- vazão;
- perfil horário;
- mínimos/máximos;
- degraus operacionais;
- recorrência por dia;
- relação temporal pressão x vazão;
- gaps de telemetria.

Não aplicar semáforo de PC às saídas.

Permitir comparar:
`Saída -> todos os DMCs vinculados`

Criar gráfico sincronizado por timestamp:
- pressão saída;
- vazão saída;
- PC(s) selecionado(s).

## 17. TELAS

### Executivo
- desempenho acumulado;
- meta 100%;
- referência 120%;
- realizado;
- projeção;
- status Parcial/Realizado/Projetado;
- principais alertas operacionais;
- visão REDE x Xixová;
- ranking técnico, deixando claro que não é ranking contratual.

### Apuração
- tabela mensal VD/VCM/VP;
- redução;
- % atingimento;
- origem/status;
- histórico.

### Projeções
- cenário conservador;
- cenário sazonal-base;
- premissas;
- comparação;
- gráfico.

### Diagnóstico de Pressões
- REDE;
- Xixová;
- 14 DMCs;
- saúde hidráulica;
- confiabilidade;
- filtros por alimentação, criticidade, período e qualidade.

### Visão do DMC
- alimentação associada;
- PC;
- PM/PJ se existirem;
- vazão se aplicável;
- gráfico sincronizado;
- indicadores;
- CPE;
- IAL;
- classificação evento a evento;
- expurgos;
- diagnóstico executivo;
- ação recomendada.

### Qualidade de Dados
- gaps;
- duplicidades;
- zeros suspeitos;
- outliers;
- equipamentos indisponíveis;
- expurgos;
- justificativas;
- cobertura válida.

### Configurações técnicas
Somente perfil autorizado:
- thresholds do PC;
- janelas de análise;
- janela de referência diurna;
- banda neutra do IAL;
- pesos do IPS;
- associação DMC -> alimentação;
- marcos de instalação/falha de equipamentos.

## 18. GRÁFICOS

Priorizar:
- séries temporais;
- bandas de pressão;
- comparação saída x PC;
- heatmap diário/horário;
- distribuição das classes de evento;
- horas abaixo dos thresholds;
- evolução mensal;
- ranking IPS;
- gráfico de performance contratual.

Não esconder dados brutos atrás apenas de cards.

## 19. MODELO DE DADOS

Adapte ao stack existente, mas conceitualmente precisamos de entidades equivalentes a:

### dmc
- id
- code
- name
- supply_group (`REDE`, `XIXOVA`)
- pc_channel
- has_vrp
- active

### equipment_periods
- id
- dmc_id
- equipment_type
- start_at
- end_at
- status
- note

### source_series
- id
- source_type (`REDE`, `XIXOVA`, `DMC`)
- dmc_id nullable
- channel_type
- timestamp
- raw_value
- normalized_value
- unit
- import_id
- quality_status

### imports
- id
- filename
- imported_at
- imported_by
- source
- row_count
- valid_count
- rejected_count

### exclusions
- id
- source_series_id ou intervalo
- reason
- created_by
- created_at

### performance_months
- competence
- vd
- vcm
- vp
- reduction
- attainment_pct
- status
- source
- note

### projection_scenarios
- competence
- scenario
- vd
- vcm
- vp
- reduction
- attainment_pct
- assumptions

### event_analysis
- dmc_id
- event_date
- timestamp
- cpe_class
- ial
- event_class
- data_quality
- calculated_at
- algorithm_version

### technical_parameters
- key
- value
- effective_from
- effective_to
- note

Evitar duplicar totais calculáveis.

## 20. AUDITORIA

Toda alteração manual deve registrar:
- quem;
- quando;
- valor anterior;
- valor novo;
- justificativa.

Isso vale especialmente para:
- expurgos;
- thresholds;
- associação de DMC;
- marco de equipamento;
- dados mensais de performance;
- projeções.

## 21. SEGURANÇA

Perfis sugeridos:
- `ADMIN`
- `GESTOR`
- `LEITURA`

ADMIN:
- configura;
- importa;
- expurga;
- edita parâmetros.

GESTOR:
- importa;
- revisa;
- registra observações;
- acessa tudo operacional.

LEITURA:
- somente dashboard e relatórios.

Se já houver autenticação/perfis no projeto, reutilizar.

## 22. EXPORTAÇÃO

Permitir:
- Excel/CSV da base validada;
- relatório executivo;
- relatório por DMC;
- relatório de qualidade/expurgos.

Exportações devem identificar:
- período;
- versão do cálculo;
- data de geração;
- filtros;
- status dos dados.

## 23. REGRAS DE IMPLEMENTAÇÃO

- não inventar dados ausentes;
- não substituir NULL por zero;
- não interpolar automaticamente;
- não misturar RAW e VALIDADO;
- não aplicar critérios de PC em PM/PJ/saídas;
- não considerar zero de equipamento não instalado como leitura real;
- não considerar falha de sensor como evento hidráulico;
- não misturar diagnóstico DMC com apuração contratual;
- não afirmar causa operacional sem evidência;
- mostrar hipótese como hipótese;
- manter cálculos reproduzíveis;
- versionar o algoritmo de CPE/IAL/IPS.

## 24. TESTES

Criar testes para:
- PC = 3,20 -> amarelo;
- PC <3,20 -> crítico;
- PC >50 -> sobrepressão;
- gap não interpolado;
- zero em período `NOT_INSTALLED` -> não válido;
- sensor inválido -> não entra em horas críticas;
- IAL;
- CPE;
- evento com alimentação preservada e PC em queda;
- evento sistêmico;
- evento misto;
- indeterminado por dado ausente;
- cálculo mensal VP = VD - VCM;
- atingimento da meta;
- importação idempotente;
- expurgo auditável.

## 25. ENTREGA

Ao final:
1. informe os arquivos criados/alterados;
2. informe migrations, se houver;
3. explique o modelo de dados;
4. explique os cálculos CPE/IAL/IPS;
5. informe como rodar localmente;
6. informe como publicar;
7. liste pendências que dependem de informação do usuário;
8. não marque como concluído nenhum cálculo que ainda dependa das séries completas.

Prioridade: precisão técnica, rastreabilidade e clareza executiva.
