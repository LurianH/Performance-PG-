import type { EquipmentPeriodMockViewModel, TechnicalParameterMockViewModel } from '../../types/view-models'

/** MOCK/DEMONSTRAÇÃO: parâmetros exibidos apenas para preparar a UI; não persistidos. */
export const technicalParametersMock: TechnicalParameterMockViewModel[] = [
  { key: 'PC_NORMAL_MIN', label: 'PC normal mínimo', value: '10', unit: 'mca', category: 'PRESSURE' },
  { key: 'PC_CRITICAL_MIN', label: 'PC crítico mínimo', value: '3,20', unit: 'mca', category: 'PRESSURE' },
  { key: 'PC_MAX', label: 'PC máximo', value: '50', unit: 'mca', category: 'PRESSURE' },
  { key: 'NIGHT_WINDOW', label: 'Janela noturna', value: '23:00–05:00', category: 'WINDOW' },
  { key: 'CRITICAL_WINDOW', label: 'Janela crítica', value: '23:15–04:45', category: 'WINDOW' },
  { key: 'IAL_NEUTRAL_BAND', label: 'Banda neutra IAL', value: 'Não definida', category: 'IAL' },
  { key: 'IPS_WEIGHTS', label: 'Pesos IPS', value: 'Estrutura preparada', category: 'IPS' },
]

/** MOCK/DEMONSTRAÇÃO: marcos conhecidos, sem datas oficiais persistidas. */
export const equipmentPeriodsMock: EquipmentPeriodMockViewModel[] = [
  { dmc: 'Sérgio Henrique', supply: 'XIXOVA', equipment: 'Macromedidor / VRP', status: 'NOT_INSTALLED', period: 'Período anterior à implantação' },
  { dmc: 'Oceânica Amabile', supply: 'REDE', equipment: 'VRP', status: 'NOT_INSTALLED', period: 'Data exata a confirmar' },
  { dmc: 'Castelo Branco I', supply: 'REDE', equipment: 'Macromedidor', status: 'FAILED', period: 'Desde fev/2026 (referência)' },
]
