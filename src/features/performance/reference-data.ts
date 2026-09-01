import type { PerformanceContractParameterRow, TechnicalParameterRow } from '../../types/database.types'

export function findContractNumericValue(rows: PerformanceContractParameterRow[], key: string): number | null {
  const value = rows.find((row) => row.parameter_key === key)?.numeric_value
  return value == null ? null : Number(value)
}

export function displayTechnicalValue(row: TechnicalParameterRow | undefined): string {
  if (!row) return 'Não configurado'
  if (row.numeric_value != null) return String(row.numeric_value)
  return row.text_value ?? 'Não configurado'
}
