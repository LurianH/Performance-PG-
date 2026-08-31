import { FlaskConical } from 'lucide-react'

export function MockNotice({ children = 'Dados locais de demonstração — nenhum valor é resultado oficial calculado.' }: { children?: string }) {
  return (
    <div className="mock-notice" role="note">
      <FlaskConical size={17} aria-hidden="true" />
      <span><strong>MOCK/DEMONSTRAÇÃO:</strong> {children}</span>
    </div>
  )
}
