import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  PencilSimple,
  DotsThree,
  Plus,
  Clock,
  Check,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download,
  X,
  Eye,
  FilePdf,
  Upload,
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
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { LawCase, Client, DocFile, Todo, CalendarEvent, CaseTimeline, Retainer } from '../../types'
import { CASE_STAGES, type CaseStage, type TimelineType } from '../../types'
import { fmtDate, fmtDateTime, fmtDateInput, daysUntil, fmtMoney, fmtHours } from '../../utils/dates'
import { formatBytes, downloadBlob } from '../../utils/format'
import { Tag } from '../../components/ui/Tag'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, TextArea, Select } from '../../components/ui/Field'
import { CaseForm } from './CaseForm'
import { PreservationCard } from '../../components/preservation/PreservationCard'

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

const DOC_CATS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'filing', label: '起诉材料' },
  { key: 'evidence', label: '证据材料' },
  { key: 'judgment', label: '裁判文书' },
  { key: 'other', label: '其他' },
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
  const times = useLiveQuery(
    () => db.timeRecords.where('caseId').equals(caseId).and((t) => !t.deleted).toArray(),
    [caseId],
  ) as (import('../../types').TimeRecord)[] | undefined

  const [editOpen, setEditOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [tlOpen, setTlOpen] = useState(false)
  const [docCat, setDocCat] = useState('all')
  const [dragging, setDragging] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocFile | null>(null)

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
  const totalMinutes = times?.reduce((s, t) => s + t.minutes, 0) ?? 0
  const totalFee = lawCase?.fee ?? 0

  if (!lawCase) return <div className="p-10 text-center text-text-muted">案件不存在或已删除</div>

  // 阶段推进/回退
  const setStage = async (s: CaseStage) => {
    await db.cases.update(caseId, { stage: s, updatedAt: Date.now() })
    // 立案 → 自动生成举证期限
    if (s === '立案') {
      const hasEvidence = await db.events
        .where('caseId').equals(caseId)
        .and((e) => e.type === 'evidence-deadline' && !e.deleted)
        .count()
      if (!hasEvidence) {
        await db.events.add({
          title: '举证期限截止',
          date: new Date(new Date().setDate(new Date().getDate() + 30)).getTime(),
          allDay: true,
          type: 'evidence-deadline',
          caseId,
          reminder: '7d',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    }
    // 收到判决 → 自动生成上诉截止日
    if (s === '等待判决') {
      const hasAppeal = await db.events
        .where('caseId').equals(caseId)
        .and((e) => e.type === 'appeal-deadline' && !e.deleted)
        .count()
      if (!hasAppeal) {
        await db.events.add({
          title: '上诉截止日',
          date: new Date(new Date().setDate(new Date().getDate() + 15)).getTime(),
          allDay: true,
          type: 'appeal-deadline',
          caseId,
          reminder: '7d',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    }
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
      timeRecords: times ?? [],
      retainers: retainer ?? [],
    }
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `案件导出_${lawCase.name}_${fmtDate(Date.now())}.json`)
    setMoreOpen(false)
  }

  const printCase = () => {
    const win = window.open('', '_blank')
    if (!win) return
    const tlRows = sortedTls
      .map((t) => `<tr><td>${fmtDate(t.date)}</td><td>${TIMELINE_TYPES.find((x) => x.key === t.type)?.label ?? t.type}</td><td>${t.title}</td><td>${t.note ?? ''}</td></tr>`)
      .join('')
    const evRows = (events ?? [])
      .map((e) => `<tr><td>${fmtDate(e.date)}</td><td>${e.title}</td><td>${e.caseId ? '' : ''}${daysUntil(e.date) < 0 ? `已逾期${-daysUntil(e.date)}天` : daysUntil(e.date) === 0 ? '今天' : `还有${daysUntil(e.date)}天`}</td></tr>`)
      .join('')
    win.document.write(`<html><head><title>${lawCase.name}</title><style>
      body{font-family:'PingFang SC','SimSun';font-size:13px;color:#3a3a3a;padding:48px;line-height:1.8}
      h1{text-align:center;font-size:22px;color:#5b6e7a}
      h2{color:#5b6e7a;font-size:15px;border-left:4px solid #5b6e7a;padding-left:10px;margin:24px 0 10px}
      table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #e5e3de;padding:7px 10px;text-align:left}
      th{background:#ebe9e4}
      .kv{display:flex;justify-content:space-between;padding:2px 0}
    </style></head><body>
      <h1>${lawCase.name}</h1>
      <p style="text-align:center">案号：${lawCase.caseNo || '—'}　案由：${lawCase.cause}　阶段：${lawCase.stage}</p>
      <h2>基本信息</h2>
      <div class="kv"><span>客户</span><span>${lawCase.clientName || '—'}</span></div>
      <div class="kv"><span>对方当事人</span><span>${lawCase.counterparty || '—'}</span></div>
      <div class="kv"><span>受理法院</span><span>${lawCase.court || '—'}</span></div>
      <div class="kv"><span>收案日期</span><span>${fmtDate(lawCase.filedDate)}</span></div>
      <div class="kv"><span>律师费</span><span>${fmtMoney(lawCase.fee)}</span></div>
      <div class="kv"><span>风险等级</span><span>${lawCase.risk === 'high' ? '高' : lawCase.risk === 'low' ? '低' : '中'}</span></div>
      <h2>案件时间线</h2>
      <table><tr><th>日期</th><th>类型</th><th>标题</th><th>备注</th></tr>${tlRows || '<tr><td colspan="4">无记录</td></tr>'}</table>
      <h2>关键日期</h2>
      <table><tr><th>日期</th><th>事项</th><th>倒计时</th></tr>${evRows || '<tr><td colspan="3">无记录</td></tr>'}</table>
      <h2>文档清单</h2>
      <table><tr><th>文件名</th><th>上传日期</th><th>大小</th></tr>${(docs ?? []).map((d) => `<tr><td>${d.name}</td><td>${fmtDate(d.createdAt)}</td><td>${formatBytes(d.size)}</td></tr>`).join('') || '<tr><td colspan="3">无文档</td></tr>'}</table>
      <h2>工时汇总</h2>
      <p>累计 ${fmtHours(totalMinutes)}，共 ${times?.length ?? 0} 条记录</p>
      <p style="margin-top:60px;text-align:right">导出日期：${fmtDateTime(Date.now())}</p>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
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

  // 文件上传
  const handleFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
      const isPdf = ext === 'pdf'
      let category: DocFile['category'] = 'other'
      if (isImg || isPdf) category = 'evidence'
      await db.docs.add({
        name: f.name,
        type: 'other',
        category,
        caseId,
        size: f.size,
        mime: f.type,
        data: f,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  const downloadDoc = async (doc: DocFile) => {
    if (doc.data) {
      downloadBlob(doc.data, doc.name)
    }
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

          {/* 文档区 */}
          <div className="card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-main">文档区</h2>
              <span className="text-xs text-text-muted">{docs?.length ?? 0} 份文件</span>
            </div>
            <div className="mb-3 flex gap-1.5">
              {DOC_CATS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setDocCat(c.key)}
                  className={`chip ${docCat === c.key ? '!bg-primary !text-white' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                handleFiles(e.dataTransfer.files)
              }}
              className={`rounded-btn border-2 border-dashed p-4 text-center text-xs transition ${
                dragging ? 'border-accent bg-bg-warm' : 'border-border text-text-muted'
              }`}
            >
              <Paperclip size={16} className="mx-auto mb-1" />
              拖拽文件到此处上传，或
              <label className="cursor-pointer text-accent hover:underline">
                选择文件
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </div>
            <div className="mt-3 space-y-1">
              {(docs ?? [])
                .filter((d) => docCat === 'all' || d.category === docCat)
                .map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-btn px-2 py-2 transition hover:bg-bg-warm">
                    {isImage(d.name) ? <ImageIcon size={16} className="text-primary-light" /> : <FileText size={16} className="text-primary-light" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-main">{d.name}</p>
                      <p className="text-xs text-text-muted">
                        {fmtDate(d.createdAt)} · {formatBytes(d.size)}
                      </p>
                    </div>
                    <button className="btn-ghost btn-sm" onClick={() => setPreviewDoc(d)}>
                      <Eye size={13} /> 预览
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => downloadDoc(d)}>
                      <Download size={13} /> 下载
                    </button>
                  </div>
                ))}
              {(docs ?? []).length === 0 && <p className="py-3 text-center text-sm text-text-muted">暂无文档</p>}
            </div>
          </div>
        </div>

        {/* ===== 右副区域 ===== */}
        <div className="space-y-5">
          <PreservationCard caseId={caseId} />

          {/* 关键日期 */}
          <div className="card-pad">
            <h2 className="mb-3 text-sm font-semibold text-text-main">关键日期</h2>
            <div className="space-y-2">
              {(events ?? []).map((ev) => {
                const d = daysUntil(ev.date)
                return (
                  <div
                    key={ev.id}
                    className={`flex items-center justify-between rounded-btn px-3 py-2 ${
                      d < 0
                        ? 'bg-danger text-white'
                        : d <= 3
                          ? 'bg-danger text-white'
                          : d <= 7
                            ? 'bg-accent text-white'
                            : 'bg-bg-warm text-text-main'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{ev.title}</p>
                      <p className="text-xs opacity-80">{fmtDate(ev.date)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-medium tabular-nums">
                      {d < 0 ? `已逾期${-d}天` : d === 0 ? '今天' : `还有${d}天`}
                    </span>
                  </div>
                )
              })}
              {(events ?? []).length === 0 && <p className="text-sm text-text-muted">暂无关键日期</p>}
            </div>
          </div>

          {/* 工时费用 */}
          <div className="card-pad">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
              <Clock size={15} /> 工时与费用
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">累计工时</span>
                <span className="font-medium tabular-nums text-text-main">{fmtHours(totalMinutes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">本案律师费</span>
                <span className="font-medium tabular-nums text-accent">{fmtMoney(totalFee)}</span>
              </div>
            </div>
            <button
              className="mt-3 w-full text-center text-xs text-primary hover:underline"
              onClick={() => navigate({ page: 'billing', billingTab: 'records' })}
            >
              查看完整工时记录 →
            </button>
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

      {/* 文档预览 */}
      {previewDoc && <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
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

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(name)
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
    // 收到判决 → 自动生成上诉截止日（+15天）
    if (type === 'judgment') {
      const hasAppeal = await db.events
        .where('caseId').equals(caseId)
        .and((e) => e.type === 'appeal-deadline' && !e.deleted)
        .count()
      if (!hasAppeal) {
        await db.events.add({
          title: '上诉截止日',
          date: new Date(new Date(date).setDate(new Date(date).getDate() + 15)).getTime(),
          allDay: true,
          type: 'appeal-deadline',
          caseId,
          reminder: '7d',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    }
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

// ===== 文档预览弹窗（PDF/图片内联预览，Word 提示下载） =====
function DocPreview({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const isPdf = (doc.name || '').toLowerCase().endsWith('.pdf')
  const isImg = /\.(png|jpe?g|gif|webp)$/i.test(doc.name || '')

  useEffect(() => {
    if (!doc.data) return
    const u = URL.createObjectURL(doc.data)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [doc])

  const isWord = /\.(docx?|wps)$/i.test(doc.name || '')

  return (
    <Modal open onClose={onClose} title={doc.name} width={760} footer={
      <>
        <button className="btn-ghost" onClick={onClose}>关闭</button>
        <button className="btn-primary" onClick={() => doc.data && downloadBlob(doc.data, doc.name)}>
          <Download size={14} /> 下载
        </button>
      </>
    }>
      <div className="min-h-[420px]">
        {isPdf && url && (
          <iframe src={url} className="h-[560px] w-full rounded-btn border border-border" title="PDF 预览" />
        )}
        {isImg && url && <img src={url} alt={doc.name} className="mx-auto max-h-[560px] max-w-full rounded-btn" />}
        {isWord && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FileText size={40} className="text-primary-light" />
            <p className="text-sm text-text-main">Word 文档不支持在线预览</p>
            <p className="text-xs text-text-muted">请下载后使用本地软件打开</p>
          </div>
        )}
        {!isPdf && !isImg && !isWord && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FileText size={40} className="text-primary-light" />
            <p className="text-sm text-text-main">该文件类型不支持在线预览</p>
            <button className="btn-primary btn-sm" onClick={() => doc.data && downloadBlob(doc.data, doc.name)}>
              <Download size={13} /> 下载查看
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
