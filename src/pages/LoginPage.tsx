import { useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/useAuth'

export function LoginPage() {
  const { signIn, signOut, session, role, isMockMode } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (session && role) return <Navigate to={from} replace />

  if (session && !role) {
    return <main className="login-page"><section className="login-card"><div className="login-mark"><LockKeyhole /></div><h1>Acesso indisponível</h1><p>O perfil está inativo ou ainda não possui autorização válida.</p><button className="primary-button" type="button" onClick={() => void signOut()}>Encerrar sessão</button></section></main>
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(await signIn(email, password))
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark"><LockKeyhole /></div>
        <h1>Performance Praia Grande</h1>
        <p>Acesso interno Vitalux Ecoativa</p>
        {isMockMode ? (
          <div className="mock-notice"><span><strong>Modo demonstração:</strong> Supabase não configurado. A autenticação real permanece desativada.</span></div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" type="submit">Entrar</button>
          </form>
        )}
        {isMockMode && <a className="primary-button button-link" href="/">Continuar no ambiente de demonstração</a>}
      </section>
    </main>
  )
}

export default LoginPage
