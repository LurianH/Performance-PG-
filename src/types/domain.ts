export type DataStatus =
  | 'MEDIDO_SABESP'
  | 'REALIZADO_ATUAL'
  | 'PROJETADO'
  | 'PARCIAL'
  | 'DESCONSIDERADO'
  | 'CALCULADO'
  | 'ESTIMADO'
  | 'NAO_DISPONIVEL'

export type SupplyGroup = 'REDE' | 'XIXOVA'

export interface PerformanceMonthMock {
  competence: string
  vp: number
  reduction: number
  attainment: number
  status: Extract<DataStatus, 'REALIZADO_ATUAL' | 'PARCIAL' | 'PROJETADO'>
}

export interface DmcMock {
  name: string
  supply: SupplyGroup
  channel: string
  hydraulicHealth: 'Crítica' | 'Atenção' | 'Em observação'
  dataReliability: 'Boa' | 'Parcial' | 'Baixa'
  note: string
}
