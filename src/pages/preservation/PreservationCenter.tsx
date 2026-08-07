import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldWarning, Download, FileText, ArrowClockwise, CheckCircle, ArrowRight } from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { Preservation, LawCase } from '../../types'
import { fmtDate, fmtDateTime, daysUntil } from '../../utils/dates'
import { EmptyState } from '../../components/ui/EmptyState'
import { preservationLevel } from '../../components/preservation/PreservationCard'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput, TextArea } from '../../components/ui/Field'

type FilterKey = 'all' | 'overdue' | '7d' | '30d' | '90d'

export default function PreservationCenter() {
  const { navigate } = useApp()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [renewTarget, setRenewTarget] = useState<Preservation | null>(null)
  const [reportOpen, setReportOpen] = useState(false)

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

  const exportCsv = () => {
    const rows = [
      ['案件', '保全类型', '被保全标的', '措施', '到期日期', '倒计时', '状态'],
      ...filtered.map((p) => {
        const d = daysUntil(p.endDate)
        return [
          caseMap.get(p.caseId) ?? '',
          p.type,
          p.target,
          p.measure,
          fmtDate(p.endDate),
          d < 0 ? `已过期${-d}天` : `还有${d}天`,
          p.status === 'renewed' ? '已续期' : '待处理',
        ]
      }),
    ]
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `保全清单_${fmtDate(Date.now())}.csv`
    a.click()
    URL.revokeObjectURL(url)
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

  const reportData = filtered.filter((p) => daysUntil(p.endDate) <= 30)

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
          <button className="btn-ghost btn-sm" onClick={exportCsv}>
            <Download size={14} /> 导出清单
          </button>
          <button className="btn-primary btn-sm" onClick={() => setReportOpen(true)}>
            <FileText size={14} /> 生成执业风险报告
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
                      <button
                        className="max-w-[200px] truncate text-primary hover:underline"
                        onClick={() => navigate({ page: 'cases', caseId: p.caseId })}
                      >
                        {caseMap.get(p.caseId) ?? '案件已删除'}
                      </button>
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
          <button className="flex items-center gap-1 text-xs text-white/80 hover:text-white" onClick={exportCsv}>
            <Download size={13} /> 批量导出
          </button>
          <span className="h-4 w-px bg-white/30" />
          <button className="flex items-center gap-1 text-xs text-white/80 hover:text-white" onClick={batchHandle}>
            <CheckCircle size={13} /> 批量标记已处理
          </button>
        </div>
      )}

      {renewTarget && <RenewInlineModal p={renewTarget} onClose={() => setRenewTarget(null)} />}
      {reportOpen && <RiskReportModal open onClose={() => setReportOpen(false)} items={reportData} caseMap={caseMap} />}
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

function RiskReportModal({
  open,
  onClose,
  items,
  caseMap,
}: {
  open: boolean
  onClose: () => void
  items: Preservation[]
  caseMap: Map<number | undefined, string>
}) {
  const [summary, setSummary] = useState('')

  const print = () => {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = items
      .map(
        (p) =>
          `<tr><td>${caseMap.get(p.caseId) ?? ''}</td><td>${p.type}</td><td>${p.target}</td><td>${fmtDate(p.endDate)}</td><td>${p.renewalCount}次</td></tr>`,
      )
      .join('')
    win.document.write(`<html><head><title>执业风险保全报告</title><style>
      body{font-family:'PingFang SC','SimSun';font-size:13px;color:#3a3a3a;padding:48px;line-height:1.8}
      h1{text-align:center;font-size:22px;color:#5b6e7a}
      h2{color:#5b6e7a;font-size:16px;border-left:4px solid #5b6e7a;padding-left:10px;margin:24px 0 10px}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #e5e3de;padding:7px 10px;text-align:left}
      th{background:#ebe9e4}
    </style></head><body>
      <h1>执业风险——保全到期情况报告</h1>
      <p style="text-align:center">生成日期：${fmtDate(Date.now())}</p>
      <h2>一、风险概况</h2>
      <p>当前共有 ${items.length} 项保全措施在30天内到期或已过期，存在保全失效风险，需尽快办理续期。</p>
      <p>${summary}</p>
      <h2>二、保全清单</h2>
      <table><tr><th>案件</th><th>保全类型</th><th>被保全标的</th><th>到期日期</th><th>续期次数</th></tr>${rows}</table>
      <h2>三、风险提示</h2>
      <p>根据《民事诉讼法》及相关司法解释，保全措施到期未续期将自动失效，可能导致胜诉判决无法执行，请务必在到期前完成续期申请。</p>
      <p style="margin-top:60px;text-align:right">${fmtDateTime(Date.now())}</p>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 500)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="生成执业风险保全报告"
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={print}>
            <Download size={14} /> 生成并导出
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-main">
          将汇总 <span className="font-semibold text-danger">{items.length}</span> 项 30 天内到期/已过期的保全措施，生成正式风险报告。
        </p>
        <Field label="风险概述（可选）">
          <TextArea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="补充风险说明…" />
        </Field>
      </div>
    </Modal>
  )
}
