import type { ReactNode } from 'react'

const tagStyles: Record<string, string> = {
  primary: 'bg-primary text-white',
  'primary-light': 'bg-primary-light text-white',
  accent: 'bg-accent text-white',
  danger: 'bg-danger text-white',
  warm: 'bg-bg-warm text-text-main',
  muted: 'bg-bg-warm text-text-muted',
  success: 'bg-success text-white',
  outline: 'bg-transparent border border-border text-text-muted',
}

export function Tag({ color = 'muted', children }: { color?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-tag px-2 py-0.5 text-xs ${tagStyles[color] || tagStyles.muted}`}>
      {children}
    </span>
  )
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
}
