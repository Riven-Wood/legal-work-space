import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldWarning, Plus, ArrowClockwise, CheckCircle } from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { Preservation, LawCase } from '../../types'
import { fmtDate, daysUntil } from '../../utils/dates'
import { EmptyState } from '../../components/ui/EmptyState'
import { preservationLevel, PreservationForm } from '../../components/preservation/PreservationCard'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput, TextArea } from '../../components/ui/Field'

type FilterKey = 'all' | 'overdue' | '7d' | '30d' | '90d'

export default function PreservationCenter() {
  const { navigate } = useApp()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [renewTarget, setRenewTarget] = useState<Preservation | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const preservations = useLiveQuery(() => db.preservations.where('deleted').equals(0).toArray(), []) as
    | Preservation[]
    | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const caseMap = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c.name])), [cases])

  const urgentOnly = (preservations ?? []).filter((p) => p.status !== 'handled' && p.status !== 'released' && p.status !== 'expired-unrenewed')

  const filtered = useMemo(() => {
    let list = urgentOnly
    if (filter === 'overdue') list = list.filter((p) => daysUntil(p.endDate) < 0)
    if (filter === '7d') list = list.filter((p) => daysUntil(p.endDate) >= 0 && daysUntil(p.endDate) <= 7)
    if (filter === '30d') list = list.filter((p) => daysUntil(p.endDate) > 7 && daysUntil(p.endDate) <= 30)
    if (filter === '90d') list = list.filter((p) => daysUntil(p.endDate) > 30 && daysUntil(p.endDate) <= 90)
    return [...list].sort((a, b) => {
      const da = daysUntil(a.endDate)
      const dbd = daysUntil(b.endDate)
      if (da < 0 && dbd < 0) return dbd - da
      return da - dbd
    })
  }, [urgentOnly, filter])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const batchHandle = async () => {
    for (const id of selected) {
      await db.preservations.update(id, { status: 'handled', updatedAt: Date.now() })
    }
    setSelected(new Set())
  }

  const counts = useMemo(() => {
    return {
      all: urgentOnly.length,
      overdue: urgentOnly.filter((p) => daysUntil(p.endDate) < 0).length,
      '7d': urgentOnly.filter((p) => daysUntil(p.endDate) >= 0 && daysUntil(p.endDate) <= 7).length,
      '30d': urgentOnly.filter((p) => daysUntil(p.endDate) > 7 && daysUntil(p.endDate) <= 30).length,
      '90d': urgentOnly.filter((p) => daysUntil(p.endDate) > 30 && daysUntil(p.endDate) <= 90).length,
    }
  }, [urgentOnly])

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text-main">
            <ShieldWarning size={22} className="text-danger" /> 保全预警汇总
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">按紧急程度排序，已过期保全优先处理</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> 新增保全预警
          </button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="card mb-5 flex flex-wrap items-center gap-2 px-4 py-3">
        {(
          [
            ['all', '全部'],
            ['overdue', '已过期'],
            ['7d', '7天内到期'],
            ['30d', '30天内到期'],
            ['90d', '90天内到期'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`chip ${filter === k ? '!bg-primary !text-white' : ''}`}
          >
            {label}
            <span className={`tabular-nums ${filter === k ? 'text-white' : 'text-text-muted'}`}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle size={26} className="text-success" />}
            title="暂无待续期的保全，干得漂亮！"
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-10">
                  <input
                    type="checkbox"
                    className="accent-[#b09878]"
                    checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id!))}
                    onChange={() => {
                      if (filtered.every((p) => selected.has(p.id!))) setSelected(new Set())
                      else setSelected(new Set(filtered.map((p) => p.id!)))
                    }}
                  />
                </th>
                <th className="th">案件</th>
                <th className="th">保全类型</th>
                <th className="th">被保全标的</th>
                <th className="th">到期日期</th>
                <th className="th">倒计时</th>
                <th className="th">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const lv = preservationLevel(p.endDate)
                return (
                  <tr key={p.id} className="tr-hover">
                    <td className="td">
                      <input
                        type="checkbox"
                        className="accent-[#b09878]"
                        checked={selected.has(p.id!)}
                        onChange={() => toggle(p.id!)}
                      />
                    </td>
                    <td className="td">
                      {p.caseId === 0 ? (
                        <span className="text-text-muted">未关联案件</span>
                      ) : (
                        <button
                          className="max-w-[200px] truncate text-primary hover:underline"
                          onClick={() => navigate({ page: 'cases', caseId: p.caseId })}
                        >
                          {caseMap.get(p.caseId) ?? '案件已删除'}
                        </button>
                      )}
                    </td>
                    <td className="td text-text-muted">{p.type}</td>
                    <td className="td max-w-[220px]">
                      <span className="block truncate" title={p.target}>
                        {p.target}
                      </span>
                    </td>
                    <td className="td tabular-nums text-text-muted">{fmtDate(p.endDate)}</td>
                    <td className="td">
                      <span className={`rounded-tag px-2 py-0.5 text-[11px] tabular-nums ${lv.cls}`}>{lv.text}</span>
                    </td>
                    <td className="td">
                      <button className="btn-ghost btn-sm" onClick={() => setRenewTarget(p)}>
                        <ArrowClockwise size={13} /> 标记续期
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-5 py-3 text-white shadow-pop">
          <span className="text-sm">已选 {selected.size} 项</span>
          <button className="flex items-center gap-1 text-xs text-white/80 hover:text-white" onClick={batchHandle}>
            <CheckCircle size={13} /> 批量标记已处理
          </button>
        </div>
      )}

      {renewTarget && <RenewInlineModal p={renewTarget} onClose={() => setRenewTarget(null)} />}
      {addOpen && <PreservationForm open onClose={() => setAddOpen(false)} cases={cases ?? []} />}
    </div>
  )
}

function RenewInlineModal({ p, onClose }: { p: Preservation; onClose: () => void }) {
  const [newDate, setNewDate] = useState('')
  const [writNo, setWritNo] = useState('')
  const [note, setNote] = useState('')

  const save = async () => {
    if (!newDate) return
    await db.preservationRenewals.add({
      preservationId: p.id!,
      beforeDate: p.endDate,
      afterDate: new Date(newDate).getTime(),
      writNo: writNo.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await db.preservations.update(p.id!, {
      endDate: new Date(newDate).getTime(),
      renewalCount: (p.renewalCount || 0) + 1,
      status: 'renewed',
      updatedAt: Date.now(),
    })
    // 同步更新关联的"保全到期"日历事件日期
    const expiryEvents = await db.events
      .where('caseId').equals(p.caseId)
      .and((e) => e.type === 'preservation-expiry' && !e.deleted && (e.title || '').includes(p.target))
      .toArray()
    for (const ev of expiryEvents) {
      await db.events.update(ev.id!, { date: new Date(newDate).getTime(), updatedAt: Date.now() })
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="标记续期"
      width={440}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!newDate}>保存续期</button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          {p.type} · {p.target}，原到期日 {fmtDate(p.endDate)}
        </p>
        <Field label="新到期日期" required>
          <TextInput type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </Field>
        <Field label="续期裁定书案号">
          <TextInput value={writNo} onChange={(e) => setWritNo(e.target.value)} />
        </Field>
        <Field label="备注">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
