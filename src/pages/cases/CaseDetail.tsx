import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  PencilSimple,
  DotsThree,
  Plus,
  Check,
  FileText,
  X,
  PaperPlaneTilt,
  Stamp,
  Files,
  Gavel,
  SealCheck,
  ArrowUp,
  HandCoins,
  Circle,
  Export,
  Handshake,
  Trash,
  CheckCircle,
  Clock,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { LawCase, Client, DocFile, Todo, CalendarEvent, CaseTimeline, Retainer, EventType, LegalConsultation } from '../../types'
import { CASE_STAGES, type CaseStage, type TimelineType } from '../../types'
import { fmtDate, fmtDateTime, fmtDateInput, daysUntil, fmtMoney, fmtHours } from '../../utils/dates'
import { formatBytes, downloadBlob } from '../../utils/format'
import { calculateAppealDeadline, updateCaseStage, type AppealDocumentType } from '../../utils/legalDeadlines'
import { Tag } from '../../components/ui/Tag'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, TextArea, Select } from '../../components/ui/Field'
import { CaseForm } from './CaseForm'
import { PreservationCard } from '../../components/preservation/PreservationCard'
import { CaseDocs } from '../../components/case/CaseDocs'
import { summarizeCaseConsultations } from '../../utils/caseConsultations'
import { printHtmlDocument } from '../../utils/browserPrint'
import { buildCasePrintDocument } from '../../utils/printDocuments'

const TIMELINE_TYPES: { key: TimelineType; label: string }[] = [
  { key: 'filing', label: '提交起诉状' },
  { key: 'court-filed', label: '法院立案' },
  { key: 'evidence', label: '提交证据' },
  { key: 'hearing', label: '开庭' },
  { key: 'judgment', label: '收到判决' },
  { key: 'appeal', label: '上诉' },
  { key: 'enforcement', label: '申请执行' },
  { key: 'other', label: '其他' },
]

const TIMELINE_ICONS: Record<TimelineType, React.ElementType> = {
  filing: PaperPlaneTilt,
  'court-filed': Stamp,
  evidence: Files,
  hearing: Gavel,
  judgment: SealCheck,
  appeal: ArrowUp,
  enforcement: HandCoins,
  other: Circle,
}

// 关键日期（日历事件）类型选项
const EVENT_TYPE_OPTIONS: { key: EventType; label: string }[] = [
  { key: 'hearing', label: '开庭' },
  { key: 'meeting', label: '会见' },
  { key: 'evidence-deadline', label: '举证截止' },
  { key: 'appeal-deadline', label: '上诉截止' },
  { key: 'enforcement-deadline', label: '申请执行截止' },
  { key: 'preservation-expiry', label: '保全到期' },
  { key: 'other', label: '其他' },
]

const REMINDER_OPTIONS: { key: CalendarEvent['reminder']; label: string }[] = [
  { key: 'none', label: '不提醒' },
  { key: 'same-day', label: '当天' },
  { key: '1d', label: '提前1天' },
  { key: '3d', label: '提前3天' },
  { key: '7d', label: '提前7天' },
]

export default function CaseDetail() {
  const { nav, navigate } = useApp()
  const caseId = nav.caseId!

  const lawCase = useLiveQuery(() => db.cases.get(caseId!), [caseId]) as LawCase | undefined
  const client = useLiveQuery(
    () => (lawCase?.clientId ? db.clients.get(lawCase.clientId) : undefined),
    [lawCase?.clientId],
  ) as Client | undefined
  const timelines = useLiveQuery(
    () => db.timelines.where('caseId').equals(caseId).and((t) => !t.deleted).sortBy('date'),
    [caseId],
  ) as CaseTimeline[] | undefined
  const docs = useLiveQuery(
    () => db.docs.where('caseId').equals(caseId).and((d) => !d.deleted).toArray(),
    [caseId],
  ) as DocFile[] | undefined
  const todos = useLiveQuery(
    () => db.todos.where('caseId').equals(caseId).and((t) => !t.deleted).toArray(),
    [caseId],
  ) as Todo[] | undefined
  const events = useLiveQuery(
    () => db.events.where('caseId').equals(caseId).and((e) => !e.deleted).toArray(),
    [caseId],
  ) as CalendarEvent[] | undefined
  const consultations = useLiveQuery(
    () => db.legalConsultations.where('caseId').equals(caseId).and((record) => !record.deleted).toArray(),
    [caseId],
  ) as LegalConsultation[] | undefined

  const [editOpen, setEditOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [tlOpen, setTlOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addEvOpen, setAddEvOpen] = useState(false)
  const [editEv, setEditEv] = useState<CalendarEvent | null>(null)
  const [confirmDelEv, setConfirmDelEv] = useState<CalendarEvent | null>(null)

  // 常法顾问标记：客户是否有常法顾问合同
  const retainer = useLiveQuery(
    () => {
      if (!lawCase?.clientId) return Promise.resolve([] as Retainer[])
      return db.retainers.where('clientId').equals(lawCase.clientId).and((r) => !r.deleted).toArray()
    },
    [lawCase?.clientId],
  ) as Retainer[] | undefined

  const stageIdx = lawCase ? CASE_STAGES.indexOf(lawCase.stage) : -1
  const sortedTls = useMemo(() => [...(timelines ?? [])].sort((a, b) => b.date - a.date), [timelines])
  const activeTodos = todos?.filter((t) => !t.done) ?? []
  const consultationSummary = summarizeCaseConsultations(consultations ?? [], caseId)
  const totalFee = lawCase?.fee ?? 0

  if (!lawCase) return <div className="p-10 text-center text-text-muted">案件不存在或已删除</div>

  // 阶段推进/回退
  const setStage = async (s: CaseStage) => {
    await updateCaseStage(caseId, s)
  }

  const archiveCase = async () => {
    await db.cases.update(caseId, { status: 'closed', updatedAt: Date.now() })
    setMoreOpen(false)
  }

  const exportCase = () => {
    const data = {
      type: 'lawyer-workbench-case-export',
      exportedAt: new Date().toISOString(),
      case: lawCase,
      client: client ?? undefined,
      timelines: sortedTls,
      docs: docs ?? [],
      todos: todos ?? [],
      events: events ?? [],
      legalConsultations: consultations ?? [],
      retainers: retainer ?? [],
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `案件导出_${lawCase.name}_${fmtDate(Date.now())}.json`)
    setMoreOpen(false)
  }

  const printCase = () => {
    const countdown = (date: number) => daysUntil(date) < 0 ? `已逾期${-daysUntil(date)}天` : daysUntil(date) === 0 ? '今天' : `还有${daysUntil(date)}天`
    const html = buildCasePrintDocument({
      title: lawCase.name,
      caseNo: lawCase.caseNo || '—',
      cause: lawCase.cause,
      stage: lawCase.stage,
      clientName: lawCase.clientName || '—',
      counterparty: lawCase.counterparty || '—',
      court: lawCase.court || '—',
      filedDate: fmtDate(lawCase.filedDate),
      fee: fmtMoney(lawCase.fee),
      risk: lawCase.risk === 'high' ? '高' : lawCase.risk === 'low' ? '低' : '中',
      timelines: sortedTls.map((t) => ({ date: fmtDate(t.date), type: TIMELINE_TYPES.find((x) => x.key === t.type)?.label ?? t.type, title: t.title, note: t.note ?? '' })),
      events: (events ?? []).map((event) => ({ date: fmtDate(event.date), title: event.title, countdown: countdown(event.date) })),
      documents: (docs ?? []).map((doc) => ({ name: doc.name, createdAt: fmtDate(doc.createdAt), size: formatBytes(doc.size) })),
      hoursSummary: `累计 ${fmtHours(consultationSummary.totalMinutes)}，共 ${consultationSummary.count} 条咨询记录`,
      exportedAt: fmtDateTime(Date.now()),
    })
    void printHtmlDocument(html).catch((error) => window.alert(error instanceof Error ? `打印失败：${error.message}` : '打印失败，请重试'))
    setMoreOpen(false)
  }

  const toggleTodo = async (todo: Todo) => {
    await db.todos.update(todo.id!, { done: !todo.done, updatedAt: Date.now() })
  }

  const addTodo = async (text: string) => {
    if (!text.trim()) return
    await db.todos.add({
      caseId,
      text: text.trim(),
      done: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* 顶部标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button className="btn-ghost btn-sm !px-2" onClick={() => navigate({ page: 'cases' })}>
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-text-main">{lawCase.name}</h1>
            {lawCase.caseNo && <p className="text-xs text-text-muted">{lawCase.caseNo}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
            <PencilSimple size={14} /> 编辑
          </button>
          <div className="relative">
            <button className="btn-ghost btn-sm !px-2" onClick={() => setMoreOpen((v) => !v)} title="更多">
              <DotsThree size={16} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-card bg-bg-card shadow-pop">
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main hover:bg-bg-warm"
                  onClick={archiveCase}
                >
                  <CheckCircle size={14} className="text-success" /> 归档案件
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main hover:bg-bg-warm"
                  onClick={exportCase}
                >
                  <Export size={14} className="text-primary-light" /> 导出 JSON
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main hover:bg-bg-warm"
                  onClick={printCase}
                >
                  <FileText size={14} className="text-primary-light" /> 打印详情
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-bg-warm"
                  onClick={() => {
                    setMoreOpen(false)
                    setConfirmDelete(true)
                  }}
                >
                  <Trash size={14} /> 删除案件
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 阶段进度条 */}
      <div className="card mb-5 flex items-center justify-between gap-1 px-6 py-4">
        {CASE_STAGES.map((s, i) => {
          const done = i < stageIdx
          const current = i === stageIdx
          return (
            <div key={s} className="flex flex-1 items-center">
              <button
                onClick={() => setStage(s)}
                title={`推进到「${s}」`}
                className={`flex flex-col items-center gap-1.5 transition ${current ? 'scale-105' : ''}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition ${
                    done
                      ? 'border-accent bg-accent text-white'
                      : current
                        ? 'animate-pulse-soft border-accent bg-accent text-white'
                        : 'border-border bg-transparent text-transparent'
                  }`}
                >
                  {done && <Check size={12} weight="bold" />}
                </span>
                <span className={`text-xs ${current ? 'font-medium text-accent' : done ? 'text-text-main' : 'text-text-muted'}`}>
                  {s}
                </span>
              </button>
              {i < CASE_STAGES.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 rounded ${i < stageIdx ? 'bg-accent' : 'bg-border'}`} />
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* ===== 左主区域 ===== */}
        <div className="space-y-5">
          {/* 基本信息 */}
          <div className="card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-main">基本信息</h2>
              <button className="text-xs text-text-muted hover:text-accent" onClick={() => setEditOpen(true)}>
                <PencilSimple size={13} className="inline" /> 编辑
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <InfoItem label="当事人" value={lawCase.counterparty ? `我方（${lawCase.clientName}） vs ${lawCase.counterparty}` : lawCase.clientName} />
              <InfoItem label="代理人" value={client?.phone ? `${lawCase.clientName}（${client.phone}）` : lawCase.clientName} />
              <InfoItem label="受理法院" value={lawCase.court} />
              <InfoItem label="案由" value={lawCase.cause} />
              <InfoItem label="收案日期" value={fmtDate(lawCase.filedDate)} />
              <InfoItem label="风险等级" value={riskLabel(lawCase.risk)} />
            </div>
            {(retainer ?? []).length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 rounded-btn bg-bg-warm px-3 py-2 text-xs text-text-main">
                <Handshake size={14} className="text-accent" />
                该客户有常法顾问合同（{(retainer ?? []).map((r) => r.clientName).join('、')}）
                <button
                  className="ml-auto text-primary hover:underline"
                  onClick={() => navigate({ page: 'retainers', retainerId: retainer![0].id })}
                >
                  查看 →
                </button>
              </div>
            )}
          </div>

          {/* 案件时间线 */}
          <div className="card-pad">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-main">案件时间线</h2>
              <button className="btn-ghost btn-sm" onClick={() => setTlOpen(true)}>
                <Plus size={13} /> 添加事件
              </button>
            </div>
            <div className="relative ml-2 space-y-4 border-l border-border pl-6">
              {sortedTls.map((t) => {
                const Icon = TIMELINE_ICONS[t.type] ?? Circle
                return (
                  <div key={t.id} className="relative">
                    <span
                      className={`absolute -left-[38px] top-0 flex h-6 w-6 items-center justify-center rounded-full border ${
                        isCurrentMonth(t.date) ? 'border-accent bg-accent text-white' : 'border-border bg-bg-card text-primary-light'
                      }`}
                    >
                      <Icon size={12} />
                    </span>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-text-main">{t.title}</p>
                      <span className="shrink-0 text-xs tabular-nums text-text-muted">{fmtDate(t.date)}</span>
                    </div>
                    {t.note && <p className="mt-0.5 text-xs text-text-muted">{t.note}</p>}
                  </div>
                )
              })}
              {sortedTls.length === 0 && <p className="text-sm text-text-muted">暂无时间线记录</p>}
            </div>
          </div>

          {/* 案件材料（分区 + 版本管理） */}
          <div className="card-pad">
            <CaseDocs caseId={caseId} />
          </div>
        </div>

        {/* ===== 右副区域 ===== */}
        <div className="space-y-5">
          <PreservationCard caseId={caseId} />

          {/* 法律咨询：与咨询中心、全局计时器使用同一数据源 */}
          <div className="card-pad">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
              <Clock size={15} /> 法律咨询
            </h2>
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-text-muted">累计时长</span>
              <span className="font-medium tabular-nums text-text-main">{fmtHours(consultationSummary.totalMinutes)}</span>
            </div>
            <div className="space-y-2">
              {[...(consultations ?? [])]
                .sort((a, b) => b.date - a.date)
                .slice(0, 5)
                .map((record) => (
                  <div key={record.id} className="rounded-btn bg-bg-warm px-3 py-2 text-xs">
                    <div className="flex justify-between gap-3 text-text-main">
                      <span className="truncate">{record.content}</span>
                      <span className="shrink-0 tabular-nums">{record.minutes} 分钟</span>
                    </div>
                    <p className="mt-0.5 text-text-muted">{fmtDate(record.date)}{record.consultant ? ` · ${record.consultant}` : ''}</p>
                  </div>
                ))}
              {consultationSummary.count === 0 && <p className="text-sm text-text-muted">暂无咨询记录</p>}
            </div>
          </div>

          {/* 关键日期 */}
          <div className="card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-main">关键日期</h2>
              <button className="btn-ghost btn-sm" onClick={() => setAddEvOpen(true)}>
                <Plus size={13} /> 添加
              </button>
            </div>
            <div className="space-y-2">
              {(events ?? []).map((ev) => {
                const d = daysUntil(ev.date)
                return (
                  <div
                    key={ev.id}
                    className={`group flex items-center gap-2 rounded-btn px-3 py-2 ${
                      d < 0
                        ? 'bg-danger text-white'
                        : d <= 3
                          ? 'bg-danger text-white'
                          : d <= 7
                            ? 'bg-accent text-white'
                            : 'bg-bg-warm text-text-main'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{ev.title}</p>
                      <p className="text-xs opacity-80">{fmtDate(ev.date)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums">
                      {d < 0 ? `已逾期${-d}天` : d === 0 ? '今天' : `还有${d}天`}
                    </span>
                    <button
                      className="shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-black/10"
                      onClick={() => setEditEv(ev)}
                      title="编辑关键日期"
                    >
                      <PencilSimple size={13} />
                    </button>
                    <button
                      className="shrink-0 rounded p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-black/10"
                      onClick={() => setConfirmDelEv(ev)}
                      title="删除关键日期"
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                )
              })}
              {(events ?? []).length === 0 && <p className="text-sm text-text-muted">暂无关键日期</p>}
            </div>
          </div>

          {/* 费用 */}
          <div className="card-pad">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
              <HandCoins size={15} /> 本案费用
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">律师费</span>
                <span className="font-medium tabular-nums text-accent">{fmtMoney(totalFee)}</span>
              </div>
            </div>
          </div>

          {/* 待办 */}
          <div className="card-pad">
            <h2 className="mb-3 text-sm font-semibold text-text-main">待办</h2>
            <div className="space-y-1">
              {activeTodos.map((t) => (
                <div key={t.id} className="group flex items-center gap-2 rounded-btn px-2 py-1.5 hover:bg-bg-warm">
                  <button
                    onClick={() => toggleTodo(t)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border transition hover:border-accent"
                  >
                    {t.done && <Check size={11} weight="bold" className="text-accent" />}
                  </button>
                  <span className={`flex-1 text-sm ${t.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{t.text}</span>
                  <button
                    className="hidden text-text-muted hover:text-danger group-hover:block"
                    onClick={() => db.todos.update(t.id!, { done: true })}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              {activeTodos.length === 0 && <p className="text-sm text-text-muted">暂无待办</p>}
            </div>
            <QuickTodo onAdd={addTodo} />
          </div>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editOpen && <CaseForm open={editOpen} onClose={() => setEditOpen(false)} prefill={lawCase} isEdit />}

      {/* 时间线添加 */}
      <TimelineModal open={tlOpen} onClose={() => setTlOpen(false)} caseId={caseId} />

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmDelete}
        title="删除案件"
        message={`确定删除案件「${lawCase.name}」吗？删除后可在数据备份中恢复，但界面不再显示。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          db.cases.update(caseId, { deleted: Date.now(), updatedAt: Date.now() }).then(() => navigate({ page: 'cases' }))
        }}
      />

      {/* 关键日期：新增/编辑/删除 */}
      {addEvOpen && <EventModal key="new" caseId={caseId} onClose={() => setAddEvOpen(false)} />}
      {editEv && <EventModal key={`edit-${editEv.id}`} caseId={caseId} ev={editEv} onClose={() => setEditEv(null)} />}
      {confirmDelEv && (
        <ConfirmDialog
          open
          title="删除关键日期"
          message={`确定删除「${confirmDelEv.title}」吗？日历中的对应日程也会一并移除。`}
          confirmText="删除"
          danger
          onCancel={() => setConfirmDelEv(null)}
          onConfirm={() => {
            db.events.update(confirmDelEv.id!, { deleted: Date.now(), updatedAt: Date.now() })
            setConfirmDelEv(null)
          }}
        />
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 truncate text-text-main">{value || '—'}</p>
    </div>
  )
}

function riskLabel(r?: string) {
  if (r === 'high') return '高风险'
  if (r === 'low') return '低风险'
  return '中风险'
}

function isCurrentMonth(ts: number) {
  const now = new Date()
  const d = new Date(ts)
  return now.getFullYear() === d.getFullYear() && now.getMonth() === d.getMonth()
}

function QuickTodo({ onAdd }: { onAdd: (text: string) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="mt-2 flex items-center gap-2">
      <TextInput
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && v.trim()) {
            onAdd(v)
            setV('')
          }
        }}
        placeholder="+ 添加待办"
        className="!py-1.5 text-xs"
      />
    </div>
  )
}

function TimelineModal({ open, onClose, caseId }: { open: boolean; onClose: () => void; caseId: number }) {
  const [date, setDate] = useState(fmtDateInput())
  const [type, setType] = useState<TimelineType>('filing')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')

  const save = async () => {
    if (!title.trim()) return
    await db.timelines.add({
      caseId,
      date: new Date(date).getTime(),
      type,
      title: title.trim(),
      note: note.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    onClose()
    setTitle('')
    setNote('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加时间线事件"
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!title.trim()}>
            保存
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="日期" required>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="事件类型" required>
          <Select value={type} onChange={(e) => setType(e.target.value as TimelineType)}>
            {TIMELINE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="标题" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：提交证据材料" />
        </Field>
        <Field label="备注">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

// ========== 关键日期：新增 / 编辑弹窗（与日历事件同源，编辑同步到日历） ==========
function EventModal({
  caseId,
  ev,
  onClose,
}: {
  caseId: number
  ev?: CalendarEvent | null
  onClose: () => void
}) {
  const isEdit = !!ev?.id
  const [title, setTitle] = useState(ev?.title ?? '')
  const [date, setDate] = useState(ev ? fmtDateInput(ev.date) : fmtDateInput())
  const [type, setType] = useState<EventType>(ev?.type ?? 'other')
  const [reminder, setReminder] = useState<CalendarEvent['reminder']>(ev?.reminder ?? 'none')
  const [note, setNote] = useState(ev?.note ?? '')
  const [appealDocumentType, setAppealDocumentType] = useState<AppealDocumentType | ''>('')
  const [servedDate, setServedDate] = useState('')

  const calculateAppealDate = () => {
    const calculated = calculateAppealDeadline({
      documentType: appealDocumentType || undefined,
      servedDate,
    })
    if (calculated) setDate(calculated)
  }

  const save = async () => {
    if (!title.trim() || !date) return
    const dateTs = new Date(`${date}T09:00`).getTime()
    if (isEdit) {
      await db.events.update(ev.id!, {
        title: title.trim(),
        date: dateTs,
        type,
        reminder,
        note: note.trim() || undefined,
        updatedAt: Date.now(),
      })
    } else {
      await db.events.add({
        title: title.trim(),
        date: dateTs,
        allDay: true,
        type,
        caseId,
        reminder,
        note: note.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? '编辑关键日期' : '添加关键日期'}
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!title.trim() || !date}>
            保存
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="事项标题" required>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：举证期限截止、开庭" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="日期" required>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="类型">
            <Select value={type} onChange={(e) => setType(e.target.value as EventType)}>
              {EVENT_TYPE_OPTIONS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="col-span-2">
            <Field label="提醒设置">
              <Select value={reminder} onChange={(e) => setReminder(e.target.value as CalendarEvent['reminder'])}>
                {REMINDER_OPTIONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
        {type === 'evidence-deadline' && (
          <p className="rounded-btn bg-bg-warm px-3 py-2 text-xs leading-relaxed text-text-muted">
            请按法院举证通知书载明的实际截止日录入，并在备注中写明通知书或其他来源。法院指定期间的法定范围不等于本案实际截止日。
          </p>
        )}
        {type === 'appeal-deadline' && (
          <div className="rounded-btn bg-bg-warm p-3">
            <p className="mb-3 text-xs leading-relaxed text-text-muted">
              仅为计算辅助，以法院送达和法定规则为准；节假日顺延、送达方式、涉外情形等需另行核对。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="文书类型" required>
                <Select value={appealDocumentType} onChange={(e) => setAppealDocumentType(e.target.value as AppealDocumentType | '')}>
                  <option value="">请选择</option>
                  <option value="judgment">一审判决书</option>
                  <option value="ruling">可上诉的一审裁定书</option>
                </Select>
              </Field>
              <Field label="实际送达日期" required>
                <TextInput type="date" value={servedDate} onChange={(e) => setServedDate(e.target.value)} />
              </Field>
            </div>
            <button
              type="button"
              className="btn-ghost btn-sm mt-3"
              disabled={!appealDocumentType || !servedDate}
              onClick={calculateAppealDate}
            >
              填入辅助计算日期
            </button>
          </div>
        )}
        <Field label="备注">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="请注明法院通知书、送达凭证等日期来源" />
        </Field>
      </div>
    </Modal>
  )
}
