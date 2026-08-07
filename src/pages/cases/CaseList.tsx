import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, MagnifyingGlass, Briefcase, ArrowRight, Dot } from '@phosphor-icons/react'
import { db } from '../../db/database'
import type { LawCase, Client } from '../../types'
import { CASE_STAGES, type CaseStage } from '../../types'
import { useApp } from '../../store/AppContext'
import { fmtDate, daysUntil, fmtMoney } from '../../utils/dates'
import { CAUSES } from '../../utils/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tag } from '../../components/ui/Tag'
import { CaseForm } from './CaseForm'
import { Field, TextInput, Select } from '../../components/ui/Field'

const STATUS_LABEL: Record<string, string> = { active: '在办', closed: '已结', paused: '暂缓' }

export default function CaseList() {
  const { navigate } = useApp()
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed' | 'paused'>('active')
  const [causeFilter, setCauseFilter] = useState<string[]>([])
  const [kw, setKw] = useState('')
  const [sortBy, setSortBy] = useState<'filed' | 'updated' | 'hearing'>('filed')
  const [formOpen, setFormOpen] = useState(false)

  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const events = useLiveQuery(() => db.events.where('deleted').equals(0).toArray(), []) as
    | (import('../../types').CalendarEvent)[]
    | undefined

  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c])), [clients])

  // 计算每个案件下一个关键日期（开庭/期限）
  const nextKeyDate = useMemo(() => {
    const map = new Map<number, { title: string; date: number }>()
    for (const ev of events ?? []) {
      if (!ev.caseId || ev.date < Date.now()) continue
      const cur = map.get(ev.caseId)
      if (!cur || ev.date < cur.date) {
        map.set(ev.caseId, { title: ev.title, date: ev.date })
      }
    }
    return map
  }, [events])

  const filtered = useMemo(() => {
    let list = (cases ?? []).filter((c) => (statusFilter === 'all' ? true : c.status === statusFilter))
    if (causeFilter.length > 0) list = list.filter((c) => causeFilter.includes(c.cause))
    if (kw.trim()) {
      const k = kw.trim().toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(k) ||
          (c.clientName ?? '').toLowerCase().includes(k) ||
          (c.caseNo ?? '').toLowerCase().includes(k),
      )
    }
    const byDate = (ts?: number) => ts ?? 0
    list = [...list].sort((a, b) => {
      if (sortBy === 'filed') return byDate(b.filedDate) - byDate(a.filedDate)
      if (sortBy === 'updated') return byDate(b.updatedAt) - byDate(a.updatedAt)
      // hearing: 按下一个关键日期排序
      const da = nextKeyDate.get(a.id!)?.date ?? 0
      const dbb = nextKeyDate.get(b.id!)?.date ?? 0
      return da - dbb
    })
    return list
  }, [cases, statusFilter, causeFilter, kw, sortBy, nextKeyDate])

  const stageIndex = (s: CaseStage) => CASE_STAGES.indexOf(s)

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* 标题 + 新建 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-main">案件管理</h1>
          <p className="mt-0.5 text-sm text-text-muted">共 {filtered.length} 个案件</p>
        </div>
        <button className="btn-primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} weight="bold" />
          新建案件
        </button>
      </div>

      {/* 筛选栏 */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex rounded-tag bg-bg-warm p-0.5">
          {(
            [
              ['all', '全部'],
              ['active', '在办'],
              ['closed', '已结'],
              ['paused', '暂缓'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={`rounded px-3 py-1 text-sm transition ${
                statusFilter === k ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="搜案件名/客户/案号"
            className="!w-52 !py-1.5 !pl-8 text-xs"
          />
        </div>
        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'filed' | 'updated' | 'hearing')}
          className="!w-32 !py-1.5 text-xs"
        >
          <option value="filed">按收案日期</option>
          <option value="updated">按更新日期</option>
          <option value="hearing">按开庭日期</option>
        </Select>
      </div>

      {/* 案由多选 */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {CAUSES.map((cause) => (
          <button
            key={cause}
            onClick={() =>
              setCauseFilter((prev) => (prev.includes(cause) ? prev.filter((c) => c !== cause) : [...prev, cause]))
            }
            className={`chip ${causeFilter.includes(cause) ? '!bg-accent !text-white' : ''}`}
          >
            {cause}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Briefcase size={26} />}
            title="还没有案件，点击新建第一个案件"
            action={
              <button className="btn-primary btn-sm" onClick={() => setFormOpen(true)}>
                <Plus size={14} /> 新建案件
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const kd = nextKeyDate.get(c.id!)
            const d = kd ? daysUntil(kd.date) : null
            const client = clientMap.get(c.clientId!)
            return (
              <button
                key={c.id}
                onClick={() => navigate({ page: 'cases', caseId: c.id })}
                className="card group flex flex-col gap-3 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-text-main">{c.name}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                      <Tag color="warm">{c.cause}</Tag>
                      <span className="truncate">{c.caseNo || '无案号'}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100" />
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="max-w-[120px] truncate text-text-muted">{c.clientName || client?.name || '未关联客户'}</span>
                  <Dot color="#b09878" />
                  <span className="text-xs text-text-muted">
                    {CASE_STAGES[stageIndex(c.stage)]} · {STATUS_LABEL[c.status]}
                  </span>
                </div>

                {/* 进度条 */}
                <div className="flex items-center gap-1">
                  {CASE_STAGES.map((s, i) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full ${i < stageIndex(c.stage) ? 'bg-accent' : i === stageIndex(c.stage) ? 'bg-primary-light' : 'bg-bg-warm'}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-text-muted">收案 {fmtDate(c.filedDate)}</span>
                  {kd ? (
                    <span
                      className={`font-medium tabular-nums ${
                        d !== null && d <= 3 ? 'text-danger' : d !== null && d <= 7 ? 'text-accent' : 'text-text-muted'
                      }`}
                    >
                      {kd.title} {d !== null && (d < 0 ? `已过${-d}天` : d === 0 ? '今天' : `${d}天`)}
                    </span>
                  ) : (
                    <span className="text-text-muted">{c.fee ? fmtMoney(c.fee) : ''}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <CaseForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
