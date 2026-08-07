import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldWarning, Plus, ArrowClockwise, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { db } from '../../db/database'
import type { Preservation, PreservationType, PreservationMeasure } from '../../types'
import { fmtDate, daysUntil } from '../../utils/dates'
import { Modal, ConfirmDialog } from '../ui/Modal'
import { Field, TextInput, Select, TextArea } from '../ui/Field'

const PRES_TYPES: PreservationType[] = ['财产保全', '证据保全', '行为保全', '诉前保全', '诉讼保全', '执行保全', '其他']
const PRES_MEASURES: PreservationMeasure[] = [
  '冻结银行账户',
  '查封不动产',
  '查封动产',
  '冻结股权',
  '冻结债权',
  '扣押',
  '其他',
]

const TYPE_DOT: Record<string, string> = {
  财产保全: '#b09878',
  证据保全: '#7d8b8f',
  行为保全: '#c4816b',
  诉前保全: '#7a9a7e',
  诉讼保全: '#5b6e7a',
  执行保全: '#8c8c8c',
  其他: '#e5e3de',
}

/** 五级预警样式 */
export function preservationLevel(endDate: number) {
  const d = daysUntil(endDate)
  if (d < 0) return { text: `已过期${Math.abs(d)}天`, cls: 'bg-danger text-white' }
  if (d <= 7) return { text: `还有${d}天到期`, cls: 'bg-danger text-white' }
  if (d <= 30) return { text: `还有${d}天到期`, cls: 'bg-accent text-white' }
  if (d <= 90) return { text: `还有${d}天到期`, cls: 'bg-bg-warm text-text-main' }
  return { text: `${d}天后到期`, cls: 'text-text-muted' }
}

export function autoCalcEndDate(startDate: number, measure: PreservationMeasure): number {
  const d = new Date(startDate)
  const years = (n: number) => new Date(d.setFullYear(d.getFullYear() + n)).getTime()
  const months = (n: number) => new Date(d.setMonth(d.getMonth() + n)).getTime()
  switch (measure) {
    case '冻结银行账户':
      return years(1)
    case '查封不动产':
      return years(3)
    case '查封动产':
      return years(2)
    case '冻结股权':
      return years(2)
    case '冻结债权':
      return years(2)
    default:
      return months(6)
  }
}

export function PreservationCard({ caseId }: { caseId: number }) {
  const [addOpen, setAddOpen] = useState(false)
  const [detail, setDetail] = useState<Preservation | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)
  const preservations = useLiveQuery(
    () => db.preservations.where('caseId').equals(caseId).and((p) => !p.deleted && p.status !== 'handled').toArray(),
    [caseId],
  ) as Preservation[] | undefined

  const sorted = useMemo(
    () => [...(preservations ?? [])].sort((a, b) => Math.abs(daysUntil(a.endDate)) - Math.abs(daysUntil(b.endDate))),
    [preservations],
  )

  return (
    <div className="card-pad">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <ShieldWarning size={15} className="text-danger" />
          保全到期提醒
        </h2>
        <span className="text-xs text-text-muted">{preservations?.length ?? 0} 项保全</span>
      </div>
      <div className="space-y-2">
        {sorted.map((p) => {
          const lv = preservationLevel(p.endDate)
          return (
            <button
              key={p.id}
              onClick={() => setDetail(p)}
              className="flex w-full items-center gap-2 rounded-btn border border-border px-3 py-2 text-left transition hover:border-accent"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_DOT[p.type] || '#8c8c8c' }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-main">{p.target}</p>
                <p className="truncate text-xs text-text-muted">{p.writNo || p.type}</p>
              </div>
              <span className={`shrink-0 rounded-tag px-2 py-0.5 text-[11px] font-medium tabular-nums ${lv.cls}`}>{lv.text}</span>
            </button>
          )
        })}
        {sorted.length === 0 && <p className="text-sm text-text-muted">暂无保全措施</p>}
      </div>
      <button className="btn-ghost btn-sm mt-3 w-full" onClick={() => setAddOpen(true)}>
        <Plus size={13} /> 添加保全
      </button>

      <PreservationForm open={addOpen} onClose={() => setAddOpen(false)} caseId={caseId} />
      {detail && (
        <PreservationDetail
          p={detail}
          onClose={() => setDetail(null)}
          onRenew={() => {
            setRenewOpen(true)
          }}
        />
      )}
      {detail && (
        <RenewModal
          open={renewOpen}
          onClose={() => {
            setRenewOpen(false)
            setDetail(null)
          }}
          p={detail}
        />
      )}
    </div>
  )
}

export function PreservationForm({
  open,
  onClose,
  caseId,
}: {
  open: boolean
  onClose: () => void
  caseId: number
}) {
  const [type, setType] = useState<PreservationType>('财产保全')
  const [target, setTarget] = useState('')
  const [writNo, setWritNo] = useState('')
  const [measure, setMeasure] = useState<PreservationMeasure>('冻结银行账户')
  const [court, setCourt] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [note, setNote] = useState('')

  const calcEnd = () => {
    if (!startDate) return
    const end = autoCalcEndDate(new Date(startDate).getTime(), measure)
    setEndDate(new Date(end).toISOString().slice(0, 10))
  }

  const save = async () => {
    if (!target.trim() || !startDate || !endDate) return
    await db.preservations.add({
      caseId,
      type,
      target: target.trim(),
      writNo: writNo.trim() || undefined,
      measure,
      court: court.trim() || undefined,
      startDate: new Date(startDate).getTime(),
      endDate: new Date(endDate).getTime(),
      renewalCount: 0,
      status: 'active',
      note: note.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    // 同步日历事件
    await db.events.add({
      title: `保全到期：${target.trim()}`,
      date: new Date(endDate).getTime(),
      allDay: true,
      type: 'preservation-expiry',
      caseId,
      reminder: '7d',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    onClose()
    setTarget('')
    setWritNo('')
    setEndDate('')
    setNote('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增保全"
      width={560}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!target.trim() || !startDate || !endDate}>
            保存
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="保全类型" required>
          <Select value={type} onChange={(e) => setType(e.target.value as PreservationType)}>
            {PRES_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="保全措施类型" required>
          <Select value={measure} onChange={(e) => setMeasure(e.target.value as PreservationMeasure)}>
            {PRES_MEASURES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="被保全标的" required>
            <TextInput
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="如：XX银行账户存款50万元 / 位于XX的不动产"
            />
          </Field>
        </div>
        <Field label="保全裁定书案号">
          <TextInput value={writNo} onChange={(e) => setWritNo(e.target.value)} placeholder="如：（2026）X民保字第XX号" />
        </Field>
        <Field label="保全法院">
          <TextInput value={court} onChange={(e) => setCourt(e.target.value)} />
        </Field>
        <Field label="保全起始日期" required>
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="保全到期日期" required>
          <div className="flex gap-2">
            <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <button type="button" className="btn-ghost btn-sm shrink-0 whitespace-nowrap" onClick={calcEnd}>
              自动计算
            </button>
          </div>
        </Field>
        <div className="col-span-2">
          <p className="text-xs text-text-muted">
            根据民事诉讼法，冻结银行存款期限不超过1年，查封动产不超过2年，查封不动产不超过3年，冻结股权不超过2年。自动计算仅为辅助参考，实际到期日以裁定书载明为准，请务必核对。
          </p>
        </div>
        <div className="col-span-2">
          <Field label="备注">
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function PreservationDetail({ p, onClose, onRenew }: { p: Preservation; onClose: () => void; onRenew: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const renewals = useLiveQuery(
    () => db.preservationRenewals.where('preservationId').equals(p.id!).toArray(),
    [p.id],
  ) as (import('../../types').PreservationRenewal)[] | undefined

  return (
    <Modal
      open
      onClose={onClose}
      title="保全详情"
      width={520}
      footer={
        <>
          <button className="btn-ghost btn-sm !text-danger" onClick={() => setConfirmDel(true)}>
            <Trash size={13} /> 删除
          </button>
          <button className="btn-ghost btn-sm" onClick={() => db.preservations.update(p.id!, { status: 'released', updatedAt: Date.now() })}>
            标记已解封
          </button>
          <button className="btn-primary btn-sm" onClick={onRenew}>
            <ArrowClockwise size={13} /> 标记续期
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Detail label="保全类型" value={p.type} />
        <Detail label="保全措施" value={p.measure} />
        <Detail label="被保全标的" value={p.target} wide />
        <Detail label="裁定书案号" value={p.writNo} />
        <Detail label="保全法院" value={p.court} />
        <Detail label="起始日期" value={fmtDate(p.startDate)} />
        <Detail label="到期日期" value={fmtDate(p.endDate)} />
        <Detail label="续期次数" value={`${p.renewalCount} 次`} />
        {p.note && <Detail label="备注" value={p.note} wide />}
      </div>

      {/* 续期历史 */}
      <div className="mt-4 border-t border-border pt-3">
        <button
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={() => setShowHistory((v) => !v)}
        >
          <ArrowClockwise size={12} />
          查看续期历史（{renewals?.length ?? 0} 次）
        </button>
        {showHistory && (
          <div className="mt-2 space-y-1.5">
            {(renewals ?? []).length === 0 && <p className="text-xs text-text-muted">暂无续期记录</p>}
            {(renewals ?? []).map((r) => (
              <div key={r.id} className="rounded-btn bg-bg-warm px-3 py-2 text-xs">
                <p className="text-text-main">
                  {fmtDate(r.beforeDate)} → {fmtDate(r.afterDate)}
                </p>
                {(r.writNo || r.note) && (
                  <p className="mt-0.5 text-text-muted">{r.writNo} {r.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="删除保全"
        message={`确定删除「${p.target}」这项保全措施吗？`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDel(false)}
        onConfirm={() => {
          db.preservations.update(p.id!, { deleted: Date.now(), updatedAt: Date.now() })
          setConfirmDel(false)
          onClose()
        }}
      />
    </Modal>
  )
}

function RenewModal({ open, onClose, p }: { open: boolean; onClose: () => void; p: Preservation }) {
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
      open={open}
      onClose={onClose}
      title="标记续期"
      width={440}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!newDate}>
            保存续期
          </button>
        </>
      }
    >
      <div className="space-y-4">
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

function Detail({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 break-words text-text-main">{value || '—'}</p>
    </div>
  )
}
