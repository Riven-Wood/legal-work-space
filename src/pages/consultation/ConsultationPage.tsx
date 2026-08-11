import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Chats,
  Play,
  Pause,
  Stop,
  Plus,
  PencilSimple,
  Trash,
  Phone,
  Clock,
  CurrencyCny,
  CheckCircle,
  User,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { LegalConsultation, LawCase, Client } from '../../types'
import { fmtDate, fmtDateTime, fmtHours, fmtMoney, fmtDuration, fmtDateInput } from '../../utils/dates'
import { consultationDateRange, parseLocalDateInput, parseLocalDateTimeInput } from '../../utils/consultationDates'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tag } from '../../components/ui/Tag'

export default function ConsultationPage() {
  const { timer, runningSeconds, timerSaving, toggleTimer, endTimer } = useApp()
  const [caseFilter, setCaseFilter] = useState<number | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LegalConsultation | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<LegalConsultation | null>(null)
  const [savedTip, setSavedTip] = useState('')
  const savedTipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const consultations = useLiveQuery(() => db.legalConsultations.where('deleted').equals(0).toArray(), []) as
    | LegalConsultation[]
    | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined

  const caseMap = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c.name])), [cases])
  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients])

  // 本月统计
  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), [])
  const monthStats = useMemo(() => {
    const list = (consultations ?? []).filter((c) => c.date >= monthStart)
    return {
      count: list.length,
      minutes: list.reduce((s, c) => s + c.minutes, 0),
      fee: list.reduce((s, c) => s + (c.fee ?? 0), 0),
    }
  }, [consultations, monthStart])

  const filtered = useMemo(() => {
    let list = [...(consultations ?? [])]
    if (caseFilter !== '') list = list.filter((c) => c.caseId === caseFilter)
    const range = consultationDateRange(from, to)
    if (range.fromInclusive !== undefined) list = list.filter((c) => c.date >= range.fromInclusive!)
    if (range.toExclusive !== undefined) list = list.filter((c) => c.date < range.toExclusive!)
    return list.sort((a, b) => b.date - a.date || (b.start ?? 0) - (a.start ?? 0))
  }, [consultations, caseFilter, from, to])

  const groups = useMemo(() => {
    const m = new Map<string, LegalConsultation[]>()
    for (const c of filtered) {
      const key = fmtDate(c.date)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(c)
    }
    return Array.from(m.entries())
  }, [filtered])

  const totalMinutes = filtered.reduce((s, c) => s + c.minutes, 0)
  const totalFee = filtered.reduce((s, c) => s + (c.fee ?? 0), 0)
  const timerSeconds = timer?.running ? runningSeconds : timer?.accumulated ?? 0

  const finishTimer = async () => {
    const result = await endTimer()
    const message = {
      saved: '✓ 已保存咨询记录',
      'already-saved': '✓ 咨询记录已保存',
      'too-short': '计时不足 10 秒，已丢弃',
      failed: `保存失败：${result.status === 'failed' ? result.error : ''}（计时已暂停，可重试）`,
      'no-timer': '',
    }[result.status]
    setSavedTip(message)
    if (savedTipTimer.current) clearTimeout(savedTipTimer.current)
    savedTipTimer.current = setTimeout(() => setSavedTip(''), 3000)
  }

  const consultName = (c: LegalConsultation) =>
    c.consultant || (c.clientId ? clientMap.get(c.clientId) ?? '' : '')

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* 头部 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text-main">
            <Chats size={22} className="text-accent" /> 法律咨询
          </h1>
          <p className="mt-0.5 text-sm text-text-muted">记录每次咨询的时长、内容与收费，支持电话/当面/线上咨询计时</p>
        </div>
      </div>

      {/* 本月统计 */}
      <div className="mb-5 grid grid-cols-3 gap-4">
        <div className="card-pad flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-warm text-accent">
            <Chats size={18} />
          </div>
          <div>
            <p className="text-xs text-text-muted">本月咨询</p>
            <p className="text-lg font-semibold tabular-nums text-text-main">{monthStats.count} 次</p>
          </div>
        </div>
        <div className="card-pad flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-warm text-primary-light">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-xs text-text-muted">本月时长</p>
            <p className="text-lg font-semibold tabular-nums text-text-main">{fmtHours(monthStats.minutes)}</p>
          </div>
        </div>
        <div className="card-pad flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-warm text-success">
            <CurrencyCny size={18} />
          </div>
          <div>
            <p className="text-xs text-text-muted">本月收费</p>
            <p className="text-lg font-semibold tabular-nums text-accent">{fmtMoney(monthStats.fee)}</p>
          </div>
        </div>
      </div>

      {/* 咨询计时器 */}
      <div className="card mb-5 px-4 py-3">
        {!timer ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-text-main">
                <Phone size={14} className="text-accent" /> 咨询计时
              </p>
              <p className="text-xs text-text-muted">
                接听咨询电话或面谈时开始计时，结束后自动保存为一条咨询记录，可在「账单生成」中按收费金额开单。
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {savedTip && <span className="text-xs font-medium text-success">{savedTip}</span>}
              <button className="btn-primary btn-sm" onClick={() => setStartOpen(true)}>
                <Play size={13} /> 开始咨询计时
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                timer.running ? 'bg-accent text-white' : 'bg-bg-warm text-accent'
              }`}
            >
              <Phone size={18} weight={timer.running ? 'fill' : 'regular'} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-main">
                {consultNameOf(timer, clientMap) || '未填写咨询人'}
              </p>
              <p className="truncate text-xs text-text-muted">
                {timer.description || '未填写咨询内容'}
                {timer.caseId && ` · ${caseMap.get(timer.caseId) ?? '案件已删除'}`}
              </p>
            </div>
            <span className={`text-2xl font-semibold tabular-nums ${timer.running ? 'text-accent' : 'text-text-muted'}`}>
              {fmtDuration(timerSeconds)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${timer.running ? 'bg-success/10 text-success' : 'bg-bg-warm text-text-muted'}`}>
              {timer.running ? '咨询中' : '已暂停'}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {savedTip && <span className="text-xs font-medium text-success">{savedTip}</span>}
              <button className="btn-ghost btn-sm" onClick={toggleTimer} disabled={timerSaving} title={timer.running ? '暂停' : '继续'}>
                {timer.running ? <Pause size={14} /> : <Play size={14} />}
                {timer.running ? '暂停' : '继续'}
              </button>
              <button className="btn-primary btn-sm" onClick={finishTimer} disabled={timerSaving}>
                <Stop size={14} /> {timerSaving ? '保存中…' : '结束并保存'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 筛选 + 手动添加 */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 px-4 py-3">
        <Select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value ? Number(e.target.value) : '')} className="!w-48 !py-1.5 text-xs">
          <option value="">全部咨询</option>
          {(cases ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="!w-36 !py-1.5 text-xs" />
        <span className="text-xs text-text-muted">至</span>
        <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="!w-36 !py-1.5 text-xs" />
        <span className="ml-auto text-sm text-text-muted">
          共 {filtered.length} 次 · <span className="font-semibold tabular-nums text-text-main">{fmtHours(totalMinutes)}</span>
          {totalFee > 0 && <span className="font-semibold tabular-nums text-accent"> · {fmtMoney(totalFee)}</span>}
        </span>
        <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> 手动添加咨询
        </button>
      </div>

      {/* 记录列表 */}
      <div className="space-y-4">
        {groups.map(([day, list]) => (
          <div key={day} className="card overflow-hidden">
            <div className="flex items-center justify-between bg-bg-warm px-4 py-2">
              <span className="text-sm font-medium text-text-main">{day}</span>
              <span className="text-xs tabular-nums text-text-muted">
                共 {list.length} 次 · {fmtHours(list.reduce((s, c) => s + c.minutes, 0))}
              </span>
            </div>
            <div>
              {list.map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-bg-warm/50">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-text-muted">
                    {c.start ? `${fmtDateTime(c.start).slice(11)}-${fmtDateTime(c.end ?? c.start).slice(11)}` : '—'}
                  </span>
                  <Tag color="accent">{fmtHours(c.minutes)}</Tag>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-main">{c.content}</p>
                    <p className="flex items-center gap-2 text-xs text-text-muted">
                      <span className="flex items-center gap-0.5">
                        <User size={11} /> {consultName(c) || '未填写咨询人'}
                      </span>
                      {c.caseId && <span>· {caseMap.get(c.caseId) ?? '案件已删除'}</span>}
                    </p>
                  </div>
                  {c.fee !== undefined && (
                    <span className="shrink-0 text-sm font-medium tabular-nums text-accent">{fmtMoney(c.fee)}</span>
                  )}
                  {c.fee !== undefined && (
                    <span className={`shrink-0 rounded-tag px-2 py-0.5 text-[11px] ${c.paid ? 'bg-success/10 text-success' : 'bg-accent/10 text-accent'}`}>
                      {c.paid ? '已收款' : '未收款'}
                    </span>
                  )}
                  <div className="flex shrink-0 gap-1">
                    <button className="btn-ghost btn-sm !px-2" onClick={() => setEditTarget(c)} title="编辑">
                      <PencilSimple size={13} />
                    </button>
                    <button className="btn-ghost btn-sm !px-2" onClick={() => setConfirmDelete(c)} title="删除">
                      <Trash size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="card">
            <EmptyState
              icon={<Chats size={24} />}
              title="暂无咨询记录"
              action={<button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>手动添加咨询</button>}
            />
          </div>
        )}
      </div>

      {/* 开始咨询计时 */}
      <StartConsultModal open={startOpen} onClose={() => setStartOpen(false)} clients={clients ?? []} cases={cases ?? []} />

      {/* 手动添加 / 编辑 */}
      {(addOpen || editTarget) && (
        <ConsultForm
          key={editTarget?.id ?? 'new'}
          open
          onClose={() => {
            setAddOpen(false)
            setEditTarget(null)
          }}
          target={editTarget}
          clients={clients ?? []}
          cases={cases ?? []}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="删除咨询记录"
        message={`确定删除「${confirmDelete?.content || '未填写内容'}」这条咨询记录吗？`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete?.id) {
            db.legalConsultations.update(confirmDelete.id, { deleted: Date.now(), updatedAt: Date.now() })
          }
          setConfirmDelete(null)
        }}
      />
    </div>
  )
}

function consultNameOf(t: { clientId?: number; consultant?: string }, clientMap: Map<number | undefined, string>) {
  return t.consultant || (t.clientId ? clientMap.get(t.clientId) ?? '' : '')
}

// ========== 开始咨询计时 ==========
function StartConsultModal({
  open,
  onClose,
  clients,
  cases,
}: {
  open: boolean
  onClose: () => void
  clients: Client[]
  cases: LawCase[]
}) {
  const { startTimer } = useApp()
  const [consultant, setConsultant] = useState('')
  const [clientId, setClientId] = useState<number | ''>('')
  const [caseId, setCaseId] = useState<number | ''>('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setSaving(true)
    setError('')
    const result = await startTimer({
      caseId: caseId === '' ? undefined : Number(caseId),
      clientId: clientId === '' ? undefined : Number(clientId),
      consultant: consultant.trim() || undefined,
      content: content.trim() || undefined,
    })
    setSaving(false)
    if (result.status === 'failed') {
      setError(`上一条咨询保存失败：${result.error}。原计时已暂停，请先重试保存。`)
      return
    }
    onClose()
    setConsultant('')
    setClientId('')
    setCaseId('')
    setContent('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="开始咨询计时"
      width={460}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={start} disabled={saving || (!consultant.trim() && clientId === '')}>
            <Play size={13} /> {saving ? '处理中…' : '开始计时'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="rounded-btn bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <Field label="咨询人" hint="可手填姓名，或从下方客户中选择">
          <TextInput value={consultant} onChange={(e) => setConsultant(e.target.value)} placeholder="如：王女士、李经理" />
        </Field>
        <Field label="关联客户（可选）">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联客户</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="关联案件（可选）">
          <Select value={caseId} onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联案件</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="咨询内容简述">
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="如：咨询离婚财产分割、合同纠纷…" />
        </Field>
      </div>
    </Modal>
  )
}

// ========== 手动添加 / 编辑咨询 ==========
function ConsultForm({
  open,
  onClose,
  target,
  clients,
  cases,
}: {
  open: boolean
  onClose: () => void
  target: LegalConsultation | null
  clients: Client[]
  cases: LawCase[]
}) {
  const isEdit = !!target?.id
  const [consultant, setConsultant] = useState(target?.consultant ?? '')
  const [clientId, setClientId] = useState<number | ''>(target?.clientId ?? '')
  const [caseId, setCaseId] = useState<number | ''>(target?.caseId ?? '')
  const [date, setDate] = useState(target ? fmtDateInput(target.date) : fmtDateInput())
  const [start, setStart] = useState(target?.start ? fmtDateTime(target.start).slice(11, 16) : '09:00')
  const [end, setEnd] = useState(target?.end ? fmtDateTime(target.end).slice(11, 16) : '10:00')
  const [minutes, setMinutes] = useState(String(target?.minutes ?? 60))
  const [content, setContent] = useState(target?.content ?? '')
  const [fee, setFee] = useState(target?.fee !== undefined ? String(target.fee) : '')
  const [paid, setPaid] = useState(target?.paid ?? false)

  const calcMinutes = () => {
    if (start && end) {
      const s = new Date(`2000-01-01T${start}`).getTime()
      const e = new Date(`2000-01-01T${end}`).getTime()
      if (e > s) setMinutes(String(Math.round((e - s) / 60000)))
    }
  }

  const save = async () => {
    if (!content.trim()) return
    const dayTs = parseLocalDateInput(date)
    const startTs = parseLocalDateTimeInput(date, start || '09:00')
    const endTs = parseLocalDateTimeInput(date, end || '10:00')
    if (dayTs === undefined || startTs === undefined || endTs === undefined) return
    const base = {
      date: dayTs,
      start: start ? startTs : undefined,
      end: end ? endTs : undefined,
      minutes: Math.max(1, Number(minutes) || 60),
      content: content.trim(),
      consultant: consultant.trim() || undefined,
      clientId: clientId === '' ? undefined : Number(clientId),
      caseId: caseId === '' ? undefined : Number(caseId),
      fee: fee === '' || Number(fee) === 0 ? undefined : Number(fee),
      paid,
      updatedAt: Date.now(),
    }
    if (isEdit && target?.id) {
      await db.legalConsultations.update(target.id, base)
    } else {
      await db.legalConsultations.add({ ...base, source: 'manual', createdAt: Date.now() })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑咨询记录' : '手动添加咨询'}
      width={520}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!content.trim()}>
            保存
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="咨询内容" required>
          <TextInput value={content} onChange={(e) => setContent(e.target.value)} placeholder="如：离婚财产分割咨询" />
        </Field>
        <Field label="咨询人">
          <TextInput value={consultant} onChange={(e) => setConsultant(e.target.value)} placeholder="姓名" />
        </Field>
        <Field label="关联客户">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="关联案件">
          <Select value={caseId} onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="日期" required>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="时长（分钟）">
          <div className="flex items-center gap-2">
            <TextInput type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <button type="button" className="btn-ghost btn-sm shrink-0" onClick={calcMinutes}>
              按起止算
            </button>
          </div>
        </Field>
        <Field label="开始时间">
          <TextInput type="time" value={start} onChange={(e) => setStart(e.target.value)} onBlur={calcMinutes} />
        </Field>
        <Field label="结束时间">
          <TextInput type="time" value={end} onChange={(e) => setEnd(e.target.value)} onBlur={calcMinutes} />
        </Field>
        <Field label="收费金额（元）" hint="不填表示免费咨询">
          <TextInput type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="如：500" />
        </Field>
        <Field label="收款状态">
          <button
            type="button"
            onClick={() => setPaid((v) => !v)}
            className={`flex items-center gap-2 rounded-btn px-3 py-2 text-sm transition ${
              paid ? 'bg-success/10 text-success' : 'bg-bg-warm text-text-muted'
            }`}
          >
            <CheckCircle size={15} weight={paid ? 'fill' : 'regular'} />
            {paid ? '已收款' : '未收款'}
          </button>
        </Field>
      </div>
    </Modal>
  )
}
