import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ShieldWarning,
  Alarm,
  Briefcase,
  Handshake,
  Clock,
  TrendUp,
  Check,
  FileText,
  ArrowRight,
  X,
  FolderOpen,
  Lightning,
} from '@phosphor-icons/react'
import { db } from '../db/database'
import { useApp } from '../store/AppContext'
import type { LawCase, Retainer, TimeRecord, Todo, Preservation, DocFile, CalendarEvent } from '../types'
import { fmtDate, fmtHours, fmtMoney, daysUntil, todayStamp, isToday } from '../utils/dates'
import { CASE_STAGES } from '../types'
import { getSettings } from '../db/database'

export default function Dashboard() {
  const { navigate } = useApp()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const retainers = useLiveQuery(() => db.retainers.where('deleted').equals(0).toArray(), []) as Retainer[] | undefined
  const times = useLiveQuery(() => db.timeRecords.where('deleted').equals(0).toArray(), []) as TimeRecord[] | undefined
  const todos = useLiveQuery(() => db.todos.where('deleted').equals(0).toArray(), []) as Todo[] | undefined
  const preservations = useLiveQuery(() => db.preservations.where('deleted').equals(0).toArray(), []) as
    | Preservation[]
    | undefined
  const docs = useLiveQuery(() => db.docs.where('deleted').equals(0).toArray(), []) as DocFile[] | undefined
  const events = useLiveQuery(() => db.events.where('deleted').equals(0).toArray(), []) as CalendarEvent[] | undefined
  const retainerWorks = useLiveQuery(() => db.retainerWorks.where('deleted').equals(0).toArray(), []) as
    | (import('../types').RetainerWork)[]
    | undefined
  const retainerPayments = useLiveQuery(() => db.retainerPayments.where('deleted').equals(0).toArray(), []) as
    | (import('../types').RetainerPayment)[]
    | undefined
  const settings = useLiveQuery(() => getSettings(), []) as (import('../types').Settings) | undefined

  const activeCases = (cases ?? []).filter((c) => c.status === 'active')

  // 本月工时（含常法，可选）
  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), [])
  const monthMinutes = useMemo(() => {
    let m = (times ?? []).filter((t) => t.date >= monthStart).reduce((s, t) => s + t.minutes, 0)
    if (settings?.includeRetainerHours !== false) {
      m += (retainerWorks ?? []).filter((w) => w.date >= monthStart).reduce((s, w) => s + w.hours * 60, 0)
    }
    return m
  }, [times, retainerWorks, monthStart, settings])

  // 本月创收（收案律师费 + 常法付款）
  const nextMonthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime(), [])
  const monthRevenue = useMemo(() => {
    const caseFee = (cases ?? []).filter((c) => c.filedDate && c.filedDate >= monthStart && c.filedDate < nextMonthStart).reduce((sum, c) => sum + (c.fee ?? 0), 0)
    const retainerPaid = (retainerPayments ?? []).filter((p) => p.date >= monthStart && p.date < nextMonthStart).reduce((sum, p) => sum + p.amount, 0)
    return caseFee + retainerPaid
  }, [cases, retainerPayments, monthStart, nextMonthStart])

  // 待续期保全（已过期 + 30天内）
  const urgentPres = (preservations ?? []).filter((p) => {
    if (p.status === 'handled' || p.status === 'released') return false
    const d = daysUntil(p.endDate)
    return d <= 30
  })

  // ===== 预警横幅 =====
  const banners: { id: string; level: 'danger' | 'warn'; text: string; go: () => void }[] = []
  for (const p of urgentPres) {
    const d = daysUntil(p.endDate)
    const caseName = cases?.find((c) => c.id === p.caseId)?.name ?? ''
    if (d < 0) {
      banners.push({
        id: `p-${p.id}`,
        level: 'danger',
        text: `立即处理：${caseName} ${p.type} 已于${fmtDate(p.endDate).slice(5)}到期！请尽快申请续期`,
        go: () => navigate({ page: 'preservation' }),
      })
    } else if (d <= 7) {
      banners.push({
        id: `p-${p.id}`,
        level: 'danger',
        text: `紧急：${caseName} ${p.type} 还有${d}天到期，请立即申请续期`,
        go: () => navigate({ page: 'preservation' }),
      })
    } else {
      banners.push({
        id: `p-${p.id}`,
        level: 'warn',
        text: `注意：${caseName} ${p.type} 还有${d}天到期，建议提前准备续期材料`,
        go: () => navigate({ page: 'preservation' }),
      })
    }
  }
  // 诉讼期限预警（关键事件 7 天内）
  for (const ev of events ?? []) {
    const d = daysUntil(ev.date)
    if (d < 0 || d > 7) continue
    if (ev.type === 'preservation-expiry') continue
    const caseName = cases?.find((c) => c.id === ev.caseId)?.name ?? ''
    banners.push({
      id: `e-${ev.id}`,
      level: d <= 3 ? 'danger' : 'warn',
      text: `${ev.title}截止还有${d}天（案件：${caseName}）`,
      go: () => (ev.caseId ? navigate({ page: 'cases', caseId: ev.caseId }) : navigate({ page: 'calendar' })),
    })
  }
  const visibleBanners = banners.filter((b) => !dismissed.has(b.id))

  // 今日待办（todos + 今日事件）
  const todayEvents = (events ?? []).filter((e) => isToday(e.date) && daysUntil(e.date) >= 0)
  const todayTodos = (todos ?? []).filter((t) => !t.done && (!t.dueDate || daysUntil(t.dueDate) <= 0))

  // 案件阶段分布
  const stageDist = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of activeCases) m.set(c.stage, (m.get(c.stage) ?? 0) + 1)
    return Array.from(m.entries())
  }, [activeCases])

  const recentCases = [...(cases ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5)
  const recentDocs = [...(docs ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* ===== 预警横幅 ===== */}
      {visibleBanners.length > 0 && (
        <div className="mb-5 space-y-2">
          {visibleBanners.map((b) => (
            <div
              key={b.id}
              className={`flex items-center gap-3 rounded-card px-4 py-3 ${
                b.level === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
              }`}
            >
              {b.level === 'danger' ? <ShieldWarning size={18} weight="fill" /> : <Alarm size={18} />}
              <button className="flex-1 text-left text-sm font-medium" onClick={b.go}>
                {b.text}
                <ArrowRight size={13} className="ml-1 inline" />
              </button>
              <button
                className="shrink-0 rounded p-1 hover:bg-black/5"
                onClick={() => setDismissed((prev) => new Set(prev).add(b.id))}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===== 数字卡片 ===== */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <DashCard
          icon={<Briefcase size={18} />}
          label="在办案件"
          value={String(activeCases.length)}
          onClick={() => navigate({ page: 'cases' })}
        />
        <DashCard
          icon={<Handshake size={18} />}
          label="常法客户"
          value={String((retainers ?? []).filter((r) => daysUntil(r.endDate) >= 0).length)}
          onClick={() => navigate({ page: 'retainers' })}
        />
        <DashCard
          icon={<Clock size={18} />}
          label="本月工时"
          value={fmtHours(monthMinutes)}
          onClick={() => navigate({ page: 'billing', billingTab: 'records' })}
        />
        <DashCard
          icon={<TrendUp size={18} />}
          label="本月创收"
          value={fmtMoney(monthRevenue)}
          accent
          onClick={() => navigate({ page: 'billing', billingTab: 'revenue' })}
        />
        <DashCard
          icon={<ShieldWarning size={18} />}
          label="待续期保全"
          value={String(urgentPres.length)}
          danger
          onClick={() => navigate({ page: 'preservation' })}
        />
      </div>

      {/* ===== 第二行 ===== */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 今日待办 */}
        <div className="card-pad">
          <h2 className="mb-4 text-sm font-semibold text-text-main">今日待办</h2>
          <div className="space-y-2">
            {todayEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-btn px-2 py-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span className="flex-1 text-sm text-text-main">{e.title}</span>
                {e.time && <span className="text-xs tabular-nums text-text-muted">{e.time}</span>}
              </div>
            ))}
            {todayTodos.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-btn px-2 py-1.5 hover:bg-bg-warm">
                <button
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border hover:border-accent"
                  onClick={() => db.todos.update(t.id!, { done: true, updatedAt: Date.now() })}
                >
                  <Check size={11} className="text-accent" />
                </button>
                <span className="flex-1 text-sm text-text-main">{t.text}</span>
              </div>
            ))}
            {todayEvents.length === 0 && todayTodos.length === 0 && (
              <p className="py-6 text-center text-sm text-text-muted">今日无事，专注办案。</p>
            )}
          </div>
        </div>

        {/* 案件概览 */}
        <div className="card-pad">
          <h2 className="mb-4 text-sm font-semibold text-text-main">在办案件概览</h2>
          <div className="flex items-center gap-6">
            <div className="relative h-36 w-36 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {stageDist.map(([, n], i) => {
                  const pct = (n / Math.max(1, activeCases.length)) * 100
                  const offset = stageDist.slice(0, i).reduce((s, [, x]) => s + (x / Math.max(1, activeCases.length)) * 100, 0)
                  const colors = ['#4b5563', '#9aa3ad', '#b09878', '#c4816b', '#7a9a7e', '#8c8c8c', '#e5e3de', '#3a3a3a']
                  return (
                    <circle
                      key={i}
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke={colors[i % colors.length]}
                      strokeWidth="4"
                      strokeDasharray={`${pct} ${100 - pct}`}
                      strokeDashoffset={-offset}
                    />
                  )
                })}
                {activeCases.length === 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ebe9e4" strokeWidth="4" />}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold text-text-main">{activeCases.length}</span>
                <span className="text-[10px] text-text-muted">在办</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {stageDist.slice(0, 6).map(([stage, n], i) => {
                const colors = ['#4b5563', '#9aa3ad', '#b09878', '#c4816b', '#7a9a7e', '#8c8c8c']
                return (
                  <div key={stage} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                    <span className="flex-1 text-text-main">{stage}</span>
                    <span className="tabular-nums text-text-muted">{n} 件</span>
                  </div>
                )
              })}
              {stageDist.length === 0 && <p className="text-sm text-text-muted">暂无在办案件</p>}
            </div>
          </div>
          <div className="mt-4 space-y-1">
            {recentCases.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => navigate({ page: 'cases', caseId: c.id })}
                className="flex w-full items-center justify-between rounded-btn px-2 py-1.5 text-left transition hover:bg-bg-warm"
              >
                <span className="truncate text-sm text-text-main">{c.name}</span>
                <span className="ml-3 shrink-0 text-xs text-text-muted">
                  {CASE_STAGES.indexOf(c.stage) >= 0 ? c.stage : ''} · {fmtDate(c.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 第三行：快捷入口 ===== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="card-pad">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
            <FolderOpen size={15} /> 最近文档
          </h2>
          <div className="space-y-1">
            {recentDocs.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate({ page: 'docs', docsTab: 'library' })}
                className="flex w-full items-center gap-2 rounded-btn px-2 py-2 transition hover:bg-bg-warm"
              >
                <FileText size={15} className="shrink-0 text-primary-light" />
                <span className="flex-1 truncate text-sm text-text-main">{d.name}</span>
                <span className="shrink-0 text-xs text-text-muted">{fmtDate(d.updatedAt)}</span>
              </button>
            ))}
            {(docs ?? []).length === 0 && <p className="text-sm text-text-muted">暂无文档，去模板中心创建文书</p>}
          </div>
        </div>
        <div className="card-pad">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
            <Lightning size={15} /> 快捷操作
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <QuickBtn label="新建案件" onClick={() => navigate({ page: 'cases' })} />
            <QuickBtn label="记录工时" onClick={() => navigate({ page: 'billing', billingTab: 'records' })} />
            <QuickBtn label="添加日程" onClick={() => navigate({ page: 'calendar' })} />
            <QuickBtn label="添加保全" onClick={() => navigate({ page: 'preservation' })} />
            <QuickBtn label="新建常法" onClick={() => navigate({ page: 'retainers' })} />
            <QuickBtn label="使用模板" onClick={() => navigate({ page: 'docs', docsTab: 'templates' })} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DashCard({
  icon,
  label,
  value,
  accent,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
  danger?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="card-pad flex items-center gap-3 text-left transition hover:-translate-y-0.5 hover:shadow-pop"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          danger ? 'bg-danger/10 text-danger' : accent ? 'bg-bg-warm text-accent' : 'bg-bg-warm text-primary-light'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p
          className={`truncate text-lg font-semibold tabular-nums ${
            danger ? 'text-danger' : accent ? 'text-accent' : 'text-text-main'
          }`}
        >
          {value}
        </p>
      </div>
    </button>
  )
}

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-btn border border-border px-3 py-2.5 text-sm text-text-main transition hover:border-accent hover:bg-bg-warm"
    >
      {label}
      <ArrowRight size={13} className="text-text-muted" />
    </button>
  )
}
