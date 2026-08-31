import { Outlet } from 'react-router-dom'
import { AppFooter } from '../components/layout/AppFooter'
import { AppHeader } from '../components/layout/AppHeader'

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="page-container">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}
