import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  action,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-warm text-primary-light">{icon}</div>
      <p className="text-sm text-text-muted">{title}</p>
      {action}
    </div>
  )
}
