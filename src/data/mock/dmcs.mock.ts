import type { DmcMock } from '../../types/domain'

/** MOCK/DEMONSTRAÇÃO: conteúdo qualitativo para reprodução visual apenas.
 * Não é ranking IPS e não deriva de cálculo hidráulico. */
export const dmcsMock: DmcMock[] = [
  { name: 'Castelo Branco II', supply: 'REDE', channel: '49945316', hydraulicHealth: 'Crítica', dataReliability: 'Parcial', note: 'Série de demonstração com ressalvas de qualidade.' },
  { name: 'Castelo Branco I', supply: 'REDE', channel: '49939160', hydraulicHealth: 'Crítica', dataReliability: 'Baixa', note: 'Vazão posterior à falha deve permanecer indisponível.' },
  { name: 'Roberto Vinhas', supply: 'REDE', channel: '49944798', hydraulicHealth: 'Atenção', dataReliability: 'Baixa', note: 'Zeros suspeitos do PC exigem validação antes de qualquer indicador.' },
  { name: 'Diamantino', supply: 'REDE', channel: '49950531', hydraulicHealth: 'Crítica', dataReliability: 'Parcial', note: 'Diagnóstico demonstrativo, sem cálculo nesta etapa.' },
  { name: 'Kennedy I', supply: 'REDE', channel: '49949639', hydraulicHealth: 'Crítica', dataReliability: 'Baixa', note: 'Vazão indisponível não é tratada como zero.' },
  { name: 'Kennedy II', supply: 'REDE', channel: '49952441', hydraulicHealth: 'Crítica', dataReliability: 'Parcial', note: 'Precursor local permanece como hipótese operacional.' },
  { name: 'Aldo Coli', supply: 'REDE', channel: '49951952', hydraulicHealth: 'Atenção', dataReliability: 'Parcial', note: 'Outliers de vazão ainda dependem de saneamento.' },
  { name: 'Oceânica Amabile', supply: 'REDE', channel: '49707382', hydraulicHealth: 'Atenção', dataReliability: 'Parcial', note: 'Separação pré/pós-instalação será configurável futuramente.' },
  { name: 'Booster Ocian', supply: 'XIXOVA', channel: 'Logger Pressão 1', hydraulicHealth: 'Crítica', dataReliability: 'Boa', note: 'Setor sem VRP; ausência de PM/PJ/vazão não é falha.' },
  { name: 'Júlio de Mesquita', supply: 'XIXOVA', channel: '49905190', hydraulicHealth: 'Atenção', dataReliability: 'Parcial', note: 'Vazão parcial e ainda não validada.' },
  { name: 'Sérgio Henrique', supply: 'XIXOVA', channel: '49952958', hydraulicHealth: 'Crítica', dataReliability: 'Parcial', note: 'Pré-instalação deve permanecer não disponível.' },
  { name: 'Acre', supply: 'XIXOVA', channel: '49945776', hydraulicHealth: 'Atenção', dataReliability: 'Parcial', note: 'Blocos de zero exigem validação.' },
  { name: 'Costa e Silva', supply: 'XIXOVA', channel: '49948374', hydraulicHealth: 'Em observação', dataReliability: 'Baixa', note: 'Falhas do PC devem ser expurgadas antes da análise.' },
  { name: 'Maria do Carmo', supply: 'XIXOVA', channel: '49844054', hydraulicHealth: 'Atenção', dataReliability: 'Parcial', note: 'Dropouts pontuais ainda não foram tratados.' },
]
