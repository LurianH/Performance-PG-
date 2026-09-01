export function DataState({ loading, error, empty }: { loading: boolean; error: string | null; empty: string }) {
  if (loading) return <div className="empty-state"><strong>Carregando dados…</strong></div>
  if (error) return <div className="empty-state error-state"><strong>Não foi possível carregar os dados oficiais</strong><p>{error}</p></div>
  return <div className="empty-state"><strong>{empty}</strong></div>
}
