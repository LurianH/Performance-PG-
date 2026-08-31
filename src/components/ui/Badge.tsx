import type { ReactNode } from 'react'

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}
