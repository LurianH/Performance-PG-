import { useEffect, useState } from 'react'

export interface ReferenceQuery<T> {
  data: T
  loading: boolean
  error: string | null
}

export function useReferenceQuery<T>(loader: () => Promise<T>, initialData: T, enabled = true): ReferenceQuery<T> {
  const [state, setState] = useState<ReferenceQuery<T>>({ data: initialData, loading: enabled, error: null })
  useEffect(() => {
    let active = true
    if (!enabled) {
      setState({ data: initialData, loading: false, error: null })
      return () => { active = false }
    }
    setState((current) => ({ ...current, loading: true, error: null }))
    void loader().then((data) => active && setState({ data, loading: false, error: null })).catch((error: unknown) => {
      if (active) setState({ data: initialData, loading: false, error: error instanceof Error ? error.message : 'Falha ao carregar dados' })
    })
    return () => { active = false }
  }, [enabled, loader, initialData])
  return state
}
