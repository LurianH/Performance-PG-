import { BarChart3, Database, Droplets, Gauge, Settings, ShieldCheck } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Executivo', icon: BarChart3, end: true },
  { to: '/apuracao', label: 'Apuração', icon: Database },
  { to: '/projecoes', label: 'Projeções', icon: Gauge },
  { to: '/pressoes', label: 'Pressões / DMCs', icon: Droplets },
  { to: '/qualidade', label: 'Qualidade', icon: ShieldCheck },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div>
          <h1>Performance Contratual — Praia Grande</h1>
          <p>Ciclo dez/2025 a nov/2026 · desempenho contratual + diagnóstico hidráulico dos DMCs</p>
        </div>
        <span className="demo-label">AMBIENTE DE DEMONSTRAÇÃO</span>
      </div>
      <nav className="tabs" aria-label="Navegação principal">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
