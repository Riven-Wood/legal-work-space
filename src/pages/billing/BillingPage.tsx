import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Clock,
  Receipt,
  ChartBar,
  Plus,
  PencilSimple,
  Trash,
  Download,
  TrendUp,
  CurrencyCny,
  Wallet,
  Play,
  Pause,
  Stop,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { TimeRecord, LawCase, Invoice, RetainerWork, Settings } from '../../types'
import { fmtDate, fmtHours, fmtMoney, fmtDateTime, fmtDuration, fmtDateInput, daysUntil } from '../../utils/dates'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tag } from '../../components/ui/Tag'
import { getSettings } from '../../db/database'

export default function BillingPage() {
  const { nav, navigate } = useApp()
  const tab = nav.billingTab ?? 'records'

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-5 flex gap-2">
        {(
          [
            ['records', '工时记录', Clock],
            ['invoice', '账单生成', Receipt],
            ['revenue', '收入看板', ChartBar],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => navigate({ page: 'billing', billingTab: k })}
            className={`flex items-center gap-1.5 rounded-btn px-4 py-2 text-sm transition ${
              tab === k ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-warm'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'records' && <TimeRecords />}
      {tab === 'invoice' && <InvoiceGen />}
      {tab === 'revenue' && <RevenueBoard />}
    </div>
  )
}

// ========== 工时记录 ==========
function TimeRecords() {
  const { timer, runningSeconds, startTimer, toggleTimer, endTimer } = useApp()
  const [caseFilter, setCaseFilter] = useState<number | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [startOpen, setStartOpen] = useState(false)
  const [startCaseId, setStartCaseId] = useState<number | ''>('')
  const [startDesc, setStartDesc] = useState('')
  const [savedTip, setSavedTip] = useState('')
  const savedTipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<TimeRecord | null>(null)

  const records = useLiveQuery(() => db.timeRecords.where('deleted').equals(0).toArray(), []) as TimeRecord[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const settings = useLiveQuery(() => getSettings(), []) as Settings | undefined
  const retainerWorks = useLiveQuery(() => db.retainerWorks.where('deleted').equals(0).toArray(), []) as
    | RetainerWork[]
    | undefined

  const caseMap = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c.name])), [cases])
  const activeCases = useMemo(() => (cases ?? []).filter((c) => c.status === 'active'), [cases])

  const includeRetainer = settings?.includeRetainerHours ?? true

  // 合并常法工时（可选）
  const allRecords = useMemo(() => {
    const list = [...(records ?? [])]
    if (includeRetainer) {
      for (const w of retainerWorks ?? []) {
        list.push({
          id: `r-${w.id}` as unknown as number,
          caseId: undefined,
          date: w.date,
          minutes: Math.round(w.hours * 60),
          description: `[常法] ${w.content}`,
          source: 'manual' as const,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        } as TimeRecord)
      }
    }
    return list.sort((a, b) => b.date - a.date)
  }, [records, retainerWorks, includeRetainer])

  const filtered = useMemo(() => {
    let list = allRecords
    if (caseFilter !== '') list = list.filter((r) => r.caseId === caseFilter)
    if (from) list = list.filter((r) => r.date >= new Date(from).getTime())
    if (to) list = list.filter((r) => r.date <= new Date(`${to}T23:59:59`).getTime())
    return list
  }, [allRecords, caseFilter, from, to])

  // 按日期分组
  const groups = useMemo(() => {
    const m = new Map<string, TimeRecord[]>()
    for (const r of filtered) {
      const key = fmtDate(r.date)
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(r)
    }
    return Array.from(m.entries())
  }, [filtered])

  const totalMinutes = filtered.reduce((s, r) => s + r.minutes, 0)

  const timerSeconds = timer?.running ? runningSeconds : timer?.accumulated ?? 0

  const startNew = () => {
    if (!startCaseId) return
    startTimer(Number(startCaseId), startDesc.trim() || undefined)
    setStartOpen(false)
    setStartCaseId('')
    setStartDesc('')
  }

  const finishTimer = () => {
    const total = timer
      ? timer.accumulated + (timer.running ? Math.floor((Date.now() - timer.lastTick) / 1000) : 0)
      : 0
    endTimer()
    setSavedTip(total >= 10 ? '✓ 已保存工时记录' : '计时不足 10 秒，未保存')
    if (savedTipTimer.current) clearTimeout(savedTipTimer.current)
    savedTipTimer.current = setTimeout(() => setSavedTip(''), 3000)
  }

  return (
    <div>
      {/* 计时器 */}
      <div className="card mb-5 px-4 py-3">
        {!timer ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-main">工时计时</p>
              <p className="text-xs text-text-muted">记录你在某个案件上的实际工作耗时，结束后自动保存为工时记录，可用于「账单生成」按费率计费。</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {savedTip && <span className="text-xs font-medium text-success">{savedTip}</span>}
              <button className="btn-primary btn-sm" onClick={() => setStartOpen(true)}>
                <Play size={13} /> 开始计时
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
              <Clock size={18} weight={timer.running ? 'fill' : 'regular'} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-main">
                {timer.caseId ? caseMap.get(timer.caseId) ?? '已删除案件' : '未关联案件'}
              </p>
              <p className="truncate text-xs text-text-muted">{timer.description || '未填写工作内容'}</p>
            </div>
            <span className={`text-2xl font-semibold tabular-nums ${timer.running ? 'text-accent' : 'text-text-muted'}`}>
              {fmtDuration(timerSeconds)}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${timer.running ? 'bg-success/10 text-success' : 'bg-bg-warm text-text-muted'}`}>
              {timer.running ? '计时中' : '已暂停'}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {savedTip && <span className="text-xs font-medium text-success">{savedTip}</span>}
              <button className="btn-ghost btn-sm" onClick={toggleTimer} title={timer.running ? '暂停' : '继续'}>
                {timer.running ? <Pause size={14} /> : <Play size={14} />}
                {timer.running ? '暂停' : '继续'}
              </button>
              <button className="btn-primary btn-sm" onClick={finishTimer}>
                <Stop size={14} /> 结束并保存
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-3 px-4 py-3">
        <Select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value ? Number(e.target.value) : '')} className="!w-48 !py-1.5 text-xs">
          <option value="">全部案件</option>
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
          合计 <span className="font-semibold tabular-nums text-accent">{fmtHours(totalMinutes)}</span>
        </span>
        <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> 手动添加工时
        </button>
      </div>

      <div className="space-y-4">
        {groups.map(([day, list]) => (
          <div key={day} className="card overflow-hidden">
            <div className="flex items-center justify-between bg-bg-warm px-4 py-2">
              <span className="text-sm font-medium text-text-main">{day}</span>
              <span className="text-xs tabular-nums text-text-muted">
                共 {list.length} 条 · {fmtHours(list.reduce((s, r) => s + r.minutes, 0))}
              </span>
            </div>
            <div>
              {list.map((r) => (
                <div key={String(r.id)} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-bg-warm/50">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-text-muted">
                    {r.start ? `${fmtDateTime(r.start).slice(11)}-${fmtDateTime(r.end).slice(11)}` : '—'}
                  </span>
                  <Tag color="accent" >{fmtHours(r.minutes)}</Tag>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-main">{r.description || '未填写工作内容'}</p>
                    <p className="text-xs text-text-muted">
                      {r.caseId ? caseMap.get(r.caseId) ?? '已删除案件' : r.description?.startsWith('[常法]') ? '常法工作' : '未关联案件'}
                    </p>
                  </div>
                  {!String(r.id).startsWith('r-') && (
                    <div className="flex shrink-0 gap-1">
                      <button className="btn-ghost btn-sm !px-2" onClick={() => setConfirmDelete(r)}>
                        <Trash size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="card">
            <EmptyState icon={<Clock size={24} />} title="暂无工时记录" action={<button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>手动添加工时</button>} />
          </div>
        )}
      </div>

      <AddTimeModal open={addOpen} onClose={() => setAddOpen(false)} cases={cases ?? []} />

      {/* 开始计时 */}
      <Modal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        title={timer ? '切换案件继续计时' : '开始计时'}
        width={460}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setStartOpen(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={startNew} disabled={!startCaseId}>
              开始计时
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="关联案件" required>
            <Select value={startCaseId} onChange={(e) => setStartCaseId(Number(e.target.value))}>
              <option value="">请选择案件</option>
              {activeCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="工作内容简述">
            <TextInput value={startDesc} onChange={(e) => setStartDesc(e.target.value)} placeholder="如：起草起诉状、研究证据…" />
          </Field>
          {timer && (
            <p className="text-xs text-text-muted">
              当前计时：{timer.caseId ? (caseMap.get(timer.caseId) ?? '') : ''} — 开始新计时将自动结束并保存当前这一段
            </p>
          )}
        </div>
      </Modal>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="删除工时记录"
        message={`确定删除「${confirmDelete?.description || '未填写内容'}」这条工时记录吗？`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete && typeof confirmDelete.id === 'number') {
            db.timeRecords.update(confirmDelete.id, { deleted: Date.now(), updatedAt: Date.now() })
          }
          setConfirmDelete(null)
        }}
      />
    </div>
  )
}

function AddTimeModal({
  open,
  onClose,
  cases,
}: {
  open: boolean
  onClose: () => void
  cases: LawCase[]
}) {
  const [caseId, setCaseId] = useState<number | ''>('')
  const [date, setDate] = useState(fmtDateInput())
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [minutes, setMinutes] = useState('60')
  const [desc, setDesc] = useState('')

  const calcMinutes = () => {
    if (start && end) {
      const s = new Date(`2000-01-01T${start}`).getTime()
      const e = new Date(`2000-01-01T${end}`).getTime()
      if (e > s) setMinutes(String(Math.round((e - s) / 60000)))
    }
  }

  const save = async () => {
    if (!caseId || !date) return
    await db.timeRecords.add({
      caseId: Number(caseId),
      date: new Date(date).getTime(),
      minutes: Number(minutes) || 0,
      description: desc.trim() || undefined,
      source: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    onClose()
    setDesc('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="手动添加工时"
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!caseId || !date}>保存</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="关联案件" required>
            <Select value={caseId} onChange={(e) => setCaseId(Number(e.target.value))}>
              <option value="">请选择案件</option>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="日期" required>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="时长（小时）">
          <div className="flex items-center gap-2">
            <TextInput type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <button className="btn-ghost btn-sm shrink-0" onClick={calcMinutes}>
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
        <div className="col-span-2">
          <Field label="工作内容">
            <TextArea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="如：起草起诉状、研究法律问题…" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

// ========== 账单生成 ==========
function InvoiceGen() {
  const [caseId, setCaseId] = useState<number | ''>('')
  const [from, setFrom] = useState(fmtDateInput(new Date(new Date().setMonth(new Date().getMonth() - 1)).getTime()))
  const [to, setTo] = useState(fmtDateInput())
  const [travelFee, setTravelFee] = useState('0')
  const [courtFee, setCourtFee] = useState('0')
  const [otherFee, setOtherFee] = useState('0')

  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const records = useLiveQuery(() => db.timeRecords.where('deleted').equals(0).toArray(), []) as TimeRecord[] | undefined
  const settings = useLiveQuery(() => getSettings(), []) as Settings | undefined

  const lawCase = cases?.find((c) => c.id === caseId)

  const periodRecords = useMemo(
    () =>
      (records ?? []).filter(
        (r) =>
          r.caseId === caseId &&
          r.date >= new Date(from).getTime() &&
          r.date <= new Date(`${to}T23:59:59`).getTime(),
      ),
    [records, caseId, from, to],
  )

  const totalMinutes = periodRecords.reduce((s, r) => s + r.minutes, 0)
  const rate = settings?.hourlyRate ?? 800
  const laborFee = (totalMinutes / 60) * rate
  const total = laborFee + Number(travelFee) + Number(courtFee) + Number(otherFee)

  const exportPdf = () => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>账单</title><style>
        body{font-family:'PingFang SC','SimSun';font-size:13px;color:#3a3a3a;padding:60px;line-height:1.7}
        h1{text-align:center;font-size:20px;margin-bottom:32px;color:#5b6e7a}
        .row{display:flex;justify-content:space-between;margin-bottom:4px}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th,td{border:1px solid #e5e3de;padding:8px;text-align:left}
        th{background:#ebe9e4;font-weight:600}
        .total{font-size:15px;font-weight:700;text-align:right;margin:16px 0}
        .sig{margin-top:48px}
      </style></head><body>
        <h1>律师服务费用账单</h1>
        <p><b>${settings?.firmName || ''}</b></p>
        <p>律师：${settings?.lawyerName || ''}　电话：${settings?.phone || ''}</p>
        <p>致：${lawCase?.clientName ?? ''}</p>
        <p>案件：${lawCase?.name ?? ''}（${lawCase?.caseNo ?? ''}）</p>
        <p>计费期间：${fmtDate(new Date(from).getTime())} - ${fmtDate(new Date(to).getTime())}</p>
        <table>
          <tr><th>项目</th><th>明细</th><th>金额（元）</th></tr>
          <tr><td>律师费</td><td>${fmtHours(totalMinutes)} × 费率 ${rate}元/小时</td><td>${laborFee.toFixed(2)}</td></tr>
          <tr><td>差旅费</td><td></td><td>${Number(travelFee).toFixed(2)}</td></tr>
          <tr><td>法院费用</td><td></td><td>${Number(courtFee).toFixed(2)}</td></tr>
          <tr><td>其他费用</td><td></td><td>${Number(otherFee).toFixed(2)}</td></tr>
        </table>
        <p class="total">合计：¥${total.toFixed(2)}</p>
        <p>收款账户：${settings?.bankAccount || ''}</p>
        <div class="sig"><p>日期：${fmtDate(Date.now())}</p></div>
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_420px]">
      <div className="card-pad">
        <h2 className="mb-4 text-sm font-semibold text-text-main">账单参数</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="选择案件" required>
              <Select value={caseId} onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">请选择案件</option>
                {(cases ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="计费开始日期">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="计费结束日期">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="差旅费（元）">
            <TextInput type="number" value={travelFee} onChange={(e) => setTravelFee(e.target.value)} />
          </Field>
          <Field label="法院费用（元）">
            <TextInput type="number" value={courtFee} onChange={(e) => setCourtFee(e.target.value)} />
          </Field>
          <Field label="其他费用（元）">
            <TextInput type="number" value={otherFee} onChange={(e) => setOtherFee(e.target.value)} />
          </Field>
        </div>
        <div className="mt-5 rounded-btn bg-bg-warm p-4 text-sm">
          <p className="mb-2 font-medium text-text-main">工时汇总</p>
          <div className="flex justify-between">
            <span className="text-text-muted">期间工时</span>
            <span className="font-medium tabular-nums">{fmtHours(totalMinutes)}（{periodRecords.length} 条）</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-text-muted">小时费率（设置中配置）</span>
            <span className="font-medium tabular-nums">{rate} 元/小时</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-text-muted">律师费</span>
            <span className="font-semibold tabular-nums text-accent">{fmtMoney(laborFee)}</span>
          </div>
        </div>
      </div>

      {/* A4 预览 */}
      <div className="card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-main">账单预览</h2>
          <button className="btn-primary btn-sm" onClick={exportPdf} disabled={!lawCase}>
            <Download size={13} /> 导出 PDF
          </button>
        </div>
        <div className="bg-white p-8 shadow-card" style={{ minHeight: 420 }}>
          <h3 className="mb-6 text-center text-lg font-bold text-primary">律师服务费用账单</h3>
          <p className="text-sm">{settings?.firmName || '律师事务所'}</p>
          <p className="text-sm">律师：{settings?.lawyerName || ''}</p>
          <p className="mt-2 text-sm">致：{lawCase?.clientName ?? '—'}</p>
          <p className="text-sm">案件：{lawCase?.name ?? '—'}</p>
          <p className="text-sm">计费期间：{fmtDate(new Date(from).getTime())} - {fmtDate(new Date(to).getTime())}</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-2 text-left font-medium">项目</th>
                <th className="py-2 text-left font-medium">明细</th>
                <th className="py-2 text-right font-medium">金额</th>
              </tr>
            </thead>
            <tbody className="text-text-main">
              <tr>
                <td className="py-2">律师费</td>
                <td className="py-2 text-xs text-text-muted">{fmtHours(totalMinutes)} × {rate}元/小时</td>
                <td className="py-2 text-right tabular-nums">{laborFee.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2">差旅费</td>
                <td className="py-2" />
                <td className="py-2 text-right tabular-nums">{Number(travelFee).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2">法院费用</td>
                <td className="py-2" />
                <td className="py-2 text-right tabular-nums">{Number(courtFee).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-2">其他费用</td>
                <td className="py-2" />
                <td className="py-2 text-right tabular-nums">{Number(otherFee).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-right text-base font-bold tabular-nums text-text-main">合计：¥{total.toFixed(2)}</p>
          <p className="mt-8 text-xs text-text-muted">收款账户：{settings?.bankAccount || '未配置'}</p>
          <p className="mt-6 text-right text-xs text-text-muted">{fmtDate(Date.now())}</p>
        </div>
      </div>
    </div>
  )
}

// ========== 收入看板 ==========
function RevenueBoard() {
  const { navigate } = useApp()
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const invoices = useLiveQuery(() => db.invoices.where('deleted').equals(0).toArray(), []) as Invoice[] | undefined
  const payments = useLiveQuery(() => db.retainerPayments.where('deleted').equals(0).toArray(), []) as
    | (import('../../types').RetainerPayment)[]
    | undefined

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const monthStart = new Date(thisYear, thisMonth, 1).getTime()
  const nextMonthStart = new Date(thisYear, thisMonth + 1, 1).getTime()

  const monthRevenue = useMemo(() => {
    let sum = 0
    for (const c of cases ?? []) {
      if (c.fee && c.filedDate && c.filedDate >= monthStart && c.filedDate < nextMonthStart) sum += c.fee
    }
    // 常法付款也算本月回款
    return sum
  }, [cases, monthStart, nextMonthStart])

  const monthPaid = useMemo(
    () => (payments ?? []).filter((p) => p.date >= monthStart && p.date < nextMonthStart).reduce((s, p) => s + p.amount, 0),
    [payments, monthStart, nextMonthStart],
  )

  const unpaidTotal = useMemo(
    () =>
      (cases ?? [])
        .filter((c) => c.status !== 'closed')
        .reduce((s, c) => s + (c.fee ?? 0), 0) -
      (payments ?? []).reduce((s, p) => s + p.amount, 0),
    [cases, payments],
  )

  // 近6个月收入（律师费按收案月计）
  const trend = useMemo(() => {
    const arr: { label: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1)
      const s = d.getTime()
      const e = new Date(thisYear, thisMonth - i + 1, 1).getTime()
      const amount =
        (cases ?? []).filter((c) => c.filedDate && c.filedDate >= s && c.filedDate < e).reduce((sum, c) => sum + (c.fee ?? 0), 0) +
        (payments ?? []).filter((p) => p.date >= s && p.date < e).reduce((sum, p) => sum + p.amount, 0)
      arr.push({ label: `${d.getMonth() + 1}月`, amount })
    }
    return arr
  }, [cases, payments, thisYear, thisMonth])

  const maxAmount = Math.max(...trend.map((t) => t.amount), 1)

  const ranking = useMemo(
    () => [...(cases ?? [])].filter((c) => c.fee).sort((a, b) => (b.fee ?? 0) - (a.fee ?? 0)).slice(0, 6),
    [cases],
  )

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<TrendUp size={18} />} label="本月创收" value={fmtMoney(monthRevenue)} accent />
        <StatCard icon={<CurrencyCny size={18} />} label="本月回款" value={fmtMoney(monthPaid)} accent />
        <StatCard icon={<Wallet size={18} />} label="未回款总额" value={fmtMoney(Math.max(0, unpaidTotal))} />
      </div>

      <div className="card-pad">
        <h2 className="mb-4 text-sm font-semibold text-text-main">近 6 个月收入趋势</h2>
        <div className="flex h-48 items-end gap-6 px-4">
          {trend.map((t, i) => {
            const isCurrent = i === trend.length - 1
            const h = Math.max(6, (t.amount / maxAmount) * 150)
            return (
              <div key={t.label} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs tabular-nums text-text-muted">{t.amount > 0 ? `¥${Math.round(t.amount / 1000)}k` : ''}</span>
                <div
                  className={`w-full max-w-[48px] rounded-t transition-all ${isCurrent ? 'bg-accent' : 'bg-primary-light/70'}`}
                  style={{ height: h }}
                />
                <span className={`text-xs ${isCurrent ? 'font-medium text-accent' : 'text-text-muted'}`}>{t.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card-pad">
        <h2 className="mb-4 text-sm font-semibold text-text-main">案件收入排行</h2>
        <div className="space-y-2">
          {ranking.map((c, i) => (
            <button
              key={c.id}
              onClick={() => navigate({ page: 'cases', caseId: c.id })}
              className="flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-left transition hover:bg-bg-warm"
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < 3 ? 'bg-accent text-white' : 'bg-bg-warm text-text-muted'}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-main">{c.name}</p>
                <p className="text-xs text-text-muted">{c.clientName} · {fmtDate(c.filedDate)}</p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-accent">{fmtMoney(c.fee)}</span>
            </button>
          ))}
          {ranking.length === 0 && <EmptyState icon={<ChartBar size={24} />} title="暂无收入数据" />}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="card-pad flex items-center gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent ? 'bg-bg-warm text-accent' : 'bg-bg-warm text-primary-light'}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-text-muted">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${accent ? 'text-accent' : 'text-text-main'}`}>{value}</p>
      </div>
    </div>
  )
}
