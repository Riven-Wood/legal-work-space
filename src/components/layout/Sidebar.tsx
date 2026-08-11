import { useState } from 'react'
import {
  House,
  Briefcase,
  UsersThree,
  Handshake,
  FolderOpen,
  CalendarBlank,
  Chats,
  Receipt,
  ShieldWarning,
  GearSix,
  Sidebar as SidebarIcon,
} from '@phosphor-icons/react'
import { useApp, type PageKey } from '../../store/AppContext'
import logoUrl from '../../assets/logo.png'

const MENU: { key: PageKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: '首页仪表盘', icon: House },
  { key: 'cases', label: '案件管理', icon: Briefcase },
  { key: 'clients', label: '客户管理', icon: UsersThree },
  { key: 'retainers', label: '常法客户', icon: Handshake },
  { key: 'docs', label: '文档管理', icon: FolderOpen },
  { key: 'calendar', label: '日历日程', icon: CalendarBlank },
  { key: 'consultation', label: '法律咨询', icon: Chats },
  { key: 'billing', label: '账单管理', icon: Receipt },
  { key: 'preservation', label: '保全提醒', icon: ShieldWarning },
]

export function Sidebar() {
  const { nav, navigate } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [hoverExpand, setHoverExpand] = useState(false)
  const effectiveCollapsed = collapsed && !hoverExpand

  return (
    <aside
      className="flex h-full flex-col border-r border-border bg-bg-card transition-all duration-200"
      style={{ width: effectiveCollapsed ? 64 : 216 }}
      onMouseEnter={() => setHoverExpand(true)}
      onMouseLeave={() => setHoverExpand(false)}
    >
      {/* 顶部品牌 */}
      <div className="flex h-14 items-center gap-2.5 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          <img src={logoUrl} alt="Legal Work Space" className="h-full w-full object-cover" />
        </div>
        {!effectiveCollapsed && (
          <span className="whitespace-nowrap text-[15px] font-semibold tracking-wide text-text-main">Legal Work Space</span>
        )}
      </div>

      {/* 菜单 */}
      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2">
        {MENU.map((item) => {
          const active = nav.page === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              onClick={() => navigate({ page: item.key })}
              title={item.label}
              className={`group relative flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-sm transition-colors ${
                active ? 'bg-bg-warm font-medium text-text-main' : 'text-text-muted hover:bg-bg-warm/70 hover:text-text-main'
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-accent" />}
              <Icon size={19} weight={active ? 'fill' : 'regular'} className={active ? 'text-accent' : ''} />
              {!effectiveCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* 底部 */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            律
          </div>
          {!effectiveCollapsed && (
            <button
              onClick={() => navigate({ page: 'settings' })}
              className="flex flex-1 items-center gap-2 text-xs text-text-muted hover:text-text-main"
            >
              <GearSix size={16} />
              <span>设置</span>
            </button>
          )}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-btn px-2 py-1.5 text-xs text-text-muted transition hover:bg-bg-warm hover:text-text-main"
        >
          <SidebarIcon size={16} />
          {!effectiveCollapsed && <span>折叠导航</span>}
        </button>
      </div>
    </aside>
  )
}
