import { MagnifyingGlass } from '@phosphor-icons/react'
import { useApp } from '../../store/AppContext'

export function TopBar() {
  const { setSearchOpen } = useApp()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg-card px-5">
      {/* 全局搜索入口 */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex w-72 items-center gap-2 rounded-btn border border-border bg-bg-page px-3 py-1.5 text-sm text-text-muted transition hover:border-accent"
      >
        <MagnifyingGlass size={16} />
        <span>搜索案件、客户、文档…</span>
        <kbd className="ml-auto rounded border border-border bg-bg-card px-1.5 py-0.5 text-[10px] text-text-muted">⌘K</kbd>
      </button>
    </header>
  )
}
