import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Receipt,
  ChartBar,
  UploadSimple,
  Download,
  Eye,
  PencilSimple,
  Trash,
  TrendUp,
  Wallet,
  FileText,
  User,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { InvoiceFile, InvoiceKind, LawCase, Client, DocFile } from '../../types'
import { fmtDate, fmtMoney, fmtDateInput } from '../../utils/dates'
import { downloadBlob, formatBytes } from '../../utils/format'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { DocPreview } from '../../components/ui/DocPreview'

const KIND_META: Record<InvoiceKind, { label: string; cls: string }> = {
  invoice: { label: '发票', cls: 'bg-success/10 text-success' },
  receipt: { label: '收据', cls: 'bg-accent/10 text-accent' },
  transfer: { label: '转账凭证', cls: 'bg-primary-light/10 text-primary-light' },
  other: { label: '其他', cls: 'bg-bg-warm text-text-muted' },
}

const KIND_OPTIONS: { key: InvoiceKind; label: string }[] = [
  { key: 'invoice', label: '发票' },
  { key: 'receipt', label: '收据' },
  { key: 'transfer', label: '转账凭证' },
  { key: 'other', label: '其他' },
]

export default function BillingPage() {
  const { nav, navigate } = useApp()
  const tab = nav.billingTab ?? 'invoice'

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex gap-2">
        {(
          [
            ['invoice', '发票材料', Receipt],
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
      {tab === 'invoice' && <InvoiceFiles />}
      {tab === 'revenue' && <RevenueBoard />}
    </div>
  )
}

// ========== 发票材料管理（用户自行上传，不做自动账单） ==========
function InvoiceFiles() {
  const [kindFilter, setKindFilter] = useState<InvoiceKind | 'all'>('all')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<InvoiceFile | null>(null)
  const [preview, setPreview] = useState<InvoiceFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<InvoiceFile | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const files = useLiveQuery(() => db.invoiceFiles.where('deleted').equals(0).toArray(), []) as InvoiceFile[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined

  const caseMap = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c.name])), [cases])
  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients])

  const filtered = useMemo(() => {
    let list = [...(files ?? [])]
    if (kindFilter !== 'all') list = list.filter((f) => f.kind === kindFilter)
    return list.sort((a, b) => b.date - a.date || (b.id ?? 0) - (a.id ?? 0))
  }, [files, kindFilter])

  const totalAmount = filtered.reduce((s, f) => s + (f.amount ?? 0), 0)
  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), [])
  const monthAmount = (files ?? [])
    .filter((f) => f.date >= monthStart && f.amount !== undefined)
    .reduce((s, f) => s + (f.amount ?? 0), 0)

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setPendingFile(f)
    setUploadOpen(true)
  }

  const openPreview = (f: InvoiceFile) => {
    if (!f.data) return
    // 复用通用文档预览（字段兼容 DocFile）
    setPreview(f)
  }

  return (
    <div>
      {/* 上传区 */}
      <div
        className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) {
            setPendingFile(f)
            setUploadOpen(true)
          }
        }}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-main">发票与票据材料</p>
          <p className="text-xs text-text-muted">
            自行上传发票、收据、转账凭证等材料归档管理，系统不自动生成账单。已传 {filtered.length} 份，共 {fmtMoney(totalAmount)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-text-muted">本月 {fmtMoney(monthAmount)}</span>
          <button className="btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
            <UploadSimple size={14} /> 上传发票/票据
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx" className="hidden" onChange={pickFile} />
        </div>
      </div>

      {/* 类型筛选 */}
      <div className="card mb-5 flex flex-wrap items-center gap-2 px-4 py-3">
        {(
          [
            ['all', '全部'],
            ['invoice', '发票'],
            ['receipt', '收据'],
            ['transfer', '转账凭证'],
            ['other', '其他'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setKindFilter(k)}
            className={`chip ${kindFilter === k ? '!bg-primary !text-white' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="space-y-2">
        {filtered.map((f) => {
          const kind = KIND_META[f.kind]
          return (
            <div key={f.id} className="group card flex items-center gap-3 px-4 py-3">
              <FileText size={18} className="shrink-0 text-primary-light" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm text-text-main">
                  {f.name}
                  <span className={`shrink-0 rounded-tag px-2 py-0.5 text-[10px] ${kind.cls}`}>{kind.label}</span>
                </p>
                <p className="truncate text-xs text-text-muted">
                  {fmtDate(f.date)}
                  {f.caseId && <span> · {caseMap.get(f.caseId) ?? '案件已删除'}</span>}
                  {f.clientId && <span> · {clientMap.get(f.clientId) ?? '客户已删除'}</span>}
                  {f.note && <span> · {f.note}</span>}
                </p>
              </div>
              {f.amount !== undefined && (
                <span className="shrink-0 text-sm font-medium tabular-nums text-accent">{fmtMoney(f.amount)}</span>
              )}
              <span className="shrink-0 text-xs tabular-nums text-text-muted">{formatBytes(f.size)}</span>
              <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                <button className="btn-ghost btn-sm !px-2" onClick={() => openPreview(f)} title="预览">
                  <Eye size={13} />
                </button>
                <button className="btn-ghost btn-sm !px-2" onClick={() => f.data && downloadBlob(f.data, f.name)} title="下载">
                  <Download size={13} />
                </button>
                <button className="btn-ghost btn-sm !px-2" onClick={() => setEditTarget(f)} title="编辑">
                  <PencilSimple size={13} />
                </button>
                <button className="btn-ghost btn-sm !px-2 !text-danger" onClick={() => setConfirmDelete(f)} title="删除">
                  <Trash size={13} />
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card">
            <EmptyState
              icon={<Receipt size={24} />}
              title="暂无发票材料"
              action={<button className="btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>上传第一份发票</button>}
            />
          </div>
        )}
      </div>

      {/* 上传弹窗 */}
      {(uploadOpen || editTarget) && (
        <UploadInvoiceModal
          key={editTarget?.id ?? 'new'}
          open
          file={pendingFile}
          target={editTarget}
          onClose={() => {
            setUploadOpen(false)
            setEditTarget(null)
            setPendingFile(null)
          }}
          cases={cases ?? []}
          clients={clients ?? []}
        />
      )}

      {/* 预览 */}
      {preview && (
        <DocPreview doc={preview as unknown as DocFile} onClose={() => setPreview(null)} />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="删除票据材料"
        message={`确定删除「${confirmDelete?.name ?? ''}」吗？`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete?.id) {
            db.invoiceFiles.update(confirmDelete.id, { deleted: Date.now(), updatedAt: Date.now() })
          }
          setConfirmDelete(null)
        }}
      />
    </div>
  )
}

// ========== 上传 / 编辑发票材料 ==========
function UploadInvoiceModal({
  open,
  onClose,
  file,
  target,
  cases,
  clients,
}: {
  open: boolean
  onClose: () => void
  file: File | null
  target: InvoiceFile | null
  cases: LawCase[]
  clients: Client[]
}) {
  const isEdit = !!target?.id
  const [kind, setKind] = useState<InvoiceKind>(target?.kind ?? 'invoice')
  const [date, setDate] = useState(target ? fmtDateInput(target.date) : fmtDateInput())
  const [caseId, setCaseId] = useState<number | ''>(target?.caseId ?? '')
  const [clientId, setClientId] = useState<number | ''>(target?.clientId ?? '')
  const [amount, setAmount] = useState(target?.amount !== undefined ? String(target.amount) : '')
  const [note, setNote] = useState(target?.note ?? '')

  const save = async () => {
    if (!target && !file) return
    const base = {
      kind,
      date: new Date(date).getTime(),
      caseId: caseId === '' ? undefined : Number(caseId),
      clientId: clientId === '' ? undefined : Number(clientId),
      amount: amount === '' || Number(amount) === 0 ? undefined : Number(amount),
      note: note.trim() || undefined,
      updatedAt: Date.now(),
    }
    if (isEdit && target?.id) {
      await db.invoiceFiles.update(target.id, base)
    } else if (file) {
      await db.invoiceFiles.add({
        ...base,
        name: file.name,
        size: file.size,
        mime: file.type,
        data: file,
        createdAt: Date.now(),
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `编辑票据 · ${target?.name}` : `上传票据 · ${file?.name ?? ''}`}
      width={500}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save}>
            保存
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="票据类型" required>
          <Select value={kind} onChange={(e) => setKind(e.target.value as InvoiceKind)}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="票据日期" required>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
        <Field label="金额（元）" hint="不填则不参与收入统计">
          <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="如：5000" />
        </Field>
        <Field label="备注">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：XX案代理费发票" />
        </Field>
      </div>
    </Modal>
  )
}

// ========== 收入看板（基于上传发票金额） ==========
function RevenueBoard() {
  const files = useLiveQuery(() => db.invoiceFiles.where('deleted').equals(0).toArray(), []) as InvoiceFile[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients])

  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const monthStart = new Date(thisYear, thisMonth, 1).getTime()
  const nextMonthStart = new Date(thisYear, thisMonth + 1, 1).getTime()

  const monthFee = useMemo(
    () =>
      (files ?? [])
        .filter((f) => f.amount !== undefined && f.date >= monthStart && f.date < nextMonthStart)
        .reduce((s, f) => s + (f.amount ?? 0), 0),
    [files, monthStart, nextMonthStart],
  )
  const monthCount = useMemo(
    () => (files ?? []).filter((f) => f.date >= monthStart && f.date < nextMonthStart).length,
    [files, monthStart, nextMonthStart],
  )
  const totalFee = useMemo(
    () => (files ?? []).filter((f) => f.amount !== undefined).reduce((s, f) => s + (f.amount ?? 0), 0),
    [files],
  )

  // 近6个月发票金额
  const trend = useMemo(() => {
    const arr: { label: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1)
      const s = d.getTime()
      const e = new Date(thisYear, thisMonth - i + 1, 1).getTime()
      const amount = (files ?? [])
        .filter((f) => f.amount !== undefined && f.date >= s && f.date < e)
        .reduce((sum, f) => sum + (f.amount ?? 0), 0)
      arr.push({ label: `${d.getMonth() + 1}月`, amount })
    }
    return arr
  }, [files, thisYear, thisMonth])

  const maxAmount = Math.max(...trend.map((t) => t.amount), 1)

  // 客户发票金额排行（按关联客户，未关联的按"未关联"归并）
  const ranking = useMemo(() => {
    const m = new Map<string, { name: string; count: number; fee: number }>()
    for (const f of files ?? []) {
      if (f.amount === undefined) continue
      const name = f.clientId ? clientMap.get(f.clientId) ?? '客户已删除' : '未关联客户'
      const cur = m.get(name) ?? { name, count: 0, fee: 0 }
      cur.count += 1
      cur.fee += f.amount
      m.set(name, cur)
    }
    return [...m.values()].sort((a, b) => b.fee - a.fee).slice(0, 6)
  }, [files, clientMap])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<TrendUp size={18} />} label="本月发票金额" value={fmtMoney(monthFee)} accent />
        <StatCard icon={<Receipt size={18} />} label="本月票据张数" value={`${monthCount} 张`} />
        <StatCard icon={<Wallet size={18} />} label="累计票据金额" value={fmtMoney(totalFee)} />
      </div>

      <div className="card-pad">
        <h2 className="mb-4 text-sm font-semibold text-text-main">近 6 个月发票金额趋势</h2>
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
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <User size={15} /> 客户发票金额排行
        </h2>
        <div className="space-y-2">
          {ranking.map((r, i) => (
            <div key={r.name} className="flex w-full items-center gap-3 rounded-btn px-3 py-2.5">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < 3 ? 'bg-accent text-white' : 'bg-bg-warm text-text-muted'}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-main">{r.name}</p>
                <p className="text-xs text-text-muted">{r.count} 张票据</p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-accent">{fmtMoney(r.fee)}</span>
            </div>
          ))}
          {ranking.length === 0 && <EmptyState icon={<ChartBar size={24} />} title="暂无发票数据，请先上传发票材料" />}
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
