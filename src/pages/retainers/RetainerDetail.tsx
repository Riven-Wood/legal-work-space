import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowLeft,
  PencilSimple,
  DotsThree,
  Plus,
  ChatCircleDots,
  CurrencyCny,
  Download,
  ChartPieSlice,
  ArrowClockwise,
  FileText,
  Briefcase,
  UsersThree,
  Archive,
  Trash,
  Paperclip,
  Eye,
  Upload,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type {
  Retainer,
  RetainerWork,
  RetainerPayment,
  RetainerServiceType,
  LawCase,
  Client,
  DocFile,
} from '../../types'
import { fmtDate, fmtHours, fmtMoney, daysUntil, fmtDateTime, fmtDateInput } from '../../utils/dates'
import { formatBytes, downloadBlob } from '../../utils/format'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { Tag } from '../../components/ui/Tag'
import { EmptyState } from '../../components/ui/EmptyState'
import { RetainerForm, retainerStatus } from './RetainerList'

export default function RetainerDetail() {
  const { nav, navigate } = useApp()
  const retainerId = nav.retainerId!

  const retainer = useLiveQuery(() => db.retainers.get(retainerId), [retainerId]) as Retainer | undefined
  const works = useLiveQuery(
    () => db.retainerWorks.where('retainerId').equals(retainerId).and((w) => !w.deleted).toArray(),
    [retainerId],
  ) as RetainerWork[] | undefined
  const payments = useLiveQuery(
    () => db.retainerPayments.where('retainerId').equals(retainerId).and((p) => !p.deleted).sortBy('date'),
    [retainerId],
  ) as RetainerPayment[] | undefined
  const relatedCases = useLiveQuery(
    () => db.cases.where('clientId').equals(retainer?.clientId ?? -1).and((c) => !c.deleted).toArray(),
    [retainer?.clientId],
  ) as LawCase[] | undefined
  const contractFile = useLiveQuery(
    () => (retainer?.contractFileId ? db.docs.get(retainer.contractFileId) : undefined),
    [retainer?.contractFileId],
  ) as DocFile | undefined

  const [tab, setTab] = useState<'work' | 'contract' | 'stats'>('work')
  const [editOpen, setEditOpen] = useState(false)
  const [workOpen, setWorkOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [renewOpen, setRenewOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sortedWorks = useMemo(() => [...(works ?? [])].sort((a, b) => b.date - a.date), [works])

  if (!retainer) return <div className="p-10 text-center text-text-muted">常法客户不存在</div>

  const st = retainerStatus(retainer)
  const progress = retainer.startDate && retainer.endDate
    ? Math.min(100, Math.max(0, ((Date.now() - retainer.startDate) / (retainer.endDate - retainer.startDate)) * 100))
    : 0

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* 顶部标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button className="btn-ghost btn-sm !px-2" onClick={() => navigate({ page: 'retainers' })}>
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-text-main">{retainer.clientName}</h1>
            <p className="text-xs text-text-muted">
              {fmtDate(retainer.startDate)} - {fmtDate(retainer.endDate)} · 常年法律顾问
            </p>
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
              <div className="absolute right-0 top-full z-30 mt-1 w-40 overflow-hidden rounded-card bg-bg-card shadow-pop">
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main hover:bg-bg-warm"
                  onClick={() => {
                    setMoreOpen(false)
                    setRenewOpen(true)
                  }}
                >
                  <ArrowClockwise size={14} className="text-accent" /> 续签合同
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main hover:bg-bg-warm"
                  onClick={() => {
                    db.retainers.update(retainerId, { status: 'expired', updatedAt: Date.now() })
                    setMoreOpen(false)
                  }}
                >
                  <Archive size={14} className="text-primary-light" /> 归档
                </button>
                <button
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger hover:bg-bg-warm"
                  onClick={() => {
                    setMoreOpen(false)
                    setConfirmDelete(true)
                  }}
                >
                  <Trash size={14} /> 删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 服务进度条 */}
      <div className="card mb-5 px-6 py-4">
        <div className="flex items-center gap-4">
          <span className="shrink-0 text-xs text-text-muted">{fmtDate(retainer.startDate)}</span>
          <div className="relative h-2 flex-1 rounded-full bg-border">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
            <span className="absolute -top-[7px] h-4 w-4 rounded-full border-2 border-accent bg-bg-card" style={{ left: `calc(${progress}% - 8px)` }} />
          </div>
          <span className="shrink-0 text-xs text-text-muted">{fmtDate(retainer.endDate)}</span>
          <span
            className={`shrink-0 text-xs font-medium tabular-nums ${
              st === 'expired' ? 'text-danger' : st === 'expiring' ? 'text-accent' : 'text-success'
            }`}
          >
            {st === 'expired' ? `已到期 ${Math.abs(daysUntil(retainer.endDate))} 天` : `剩余 ${daysUntil(retainer.endDate)} 天`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* 左主区域 */}
        <div>
          <div className="mb-4 flex gap-2">
            {(
              [
                ['work', '工作记录'],
                ['contract', '合同与费用'],
                ['stats', '统计概览'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-btn px-4 py-2 text-sm transition ${
                  tab === k ? 'bg-primary text-white' : 'bg-bg-card text-text-muted hover:bg-bg-warm'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'work' && (
            <WorkTab retainer={retainer} works={sortedWorks} onAdd={() => setWorkOpen(true)} />
          )}
          {tab === 'contract' && (
            <ContractTab retainer={retainer} payments={payments ?? []} contractFile={contractFile} onAdd={() => setPayOpen(true)} />
          )}
          {tab === 'stats' && <StatsTab retainer={retainer} works={works ?? []} />}
        </div>

        {/* 右副区域 */}
        <div className="space-y-4">
          <div className="card-pad">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
              <UsersThree size={15} /> 客户信息
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">对接人</span><span>{retainer.contactName || '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">联系电话</span><span>{retainer.contactPhone || '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">合同编号</span><span>{retainer.contractNo || '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">服务内容</span></div>
              <div className="flex flex-wrap gap-1">
                {retainer.services.map((s) => (
                  <Tag key={s} color="warm">{s}</Tag>
                ))}
              </div>
            </div>
          </div>

          <div className="card-pad">
            <h3 className="mb-3 text-sm font-semibold text-text-main">本月工作摘要</h3>
            {(() => {
              const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
              const mw = (works ?? []).filter((w) => w.date >= ms)
              return (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-text-muted">工作次数</span><span className="font-medium">{mw.length} 次</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">合计时长</span><span className="font-medium tabular-nums">{fmtHours(mw.reduce((s, w) => s + w.hours * 60, 0))}</span></div>
                </div>
              )
            })()}
          </div>

          <div className="card-pad">
            <h3 className="mb-3 text-sm font-semibold text-text-main">快速操作</h3>
            <div className="space-y-2">
              <button className="btn-primary btn-sm w-full" onClick={() => setWorkOpen(true)}>
                <Plus size={13} /> 记录工作
              </button>
              <button className="btn-ghost btn-sm w-full" onClick={() => setPayOpen(true)}>
                <CurrencyCny size={13} /> 添加付款
              </button>
              <button className="btn-ghost btn-sm w-full" onClick={() => setReportOpen(true)}>
                <Download size={13} /> 生成顾问报告
              </button>
            </div>
          </div>

          <div className="card-pad">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
              <Briefcase size={15} /> 关联诉讼案件
            </h3>
            <div className="space-y-1">
              {(relatedCases ?? []).map((c) => (
                <button key={c.id} onClick={() => navigate({ page: 'cases', caseId: c.id })} className="block w-full truncate rounded-btn px-2 py-1.5 text-left text-sm text-text-main transition hover:bg-bg-warm">
                  {c.name}
                </button>
              ))}
              {(relatedCases ?? []).length === 0 && <p className="text-xs text-text-muted">暂无关联诉讼案件</p>}
            </div>
          </div>
        </div>
      </div>

      {editOpen && <RetainerForm open={editOpen} onClose={() => setEditOpen(false)} prefill={retainer} />}
      <WorkModal open={workOpen} onClose={() => setWorkOpen(false)} retainer={retainer} />
      <PayModal open={payOpen} onClose={() => setPayOpen(false)} retainer={retainer} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} retainer={retainer} works={works ?? []} />
      <RenewRetainerModal
        open={renewOpen}
        onClose={() => setRenewOpen(false)}
        retainer={retainer}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="删除常法客户"
        message={`确定删除常法客户「${retainer.clientName}」吗？其工作记录、付款记录将一并隐藏。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          db.retainers.update(retainerId, { deleted: Date.now(), updatedAt: Date.now() }).then(() => navigate({ page: 'retainers' }))
        }}
      />
    </div>
  )
}

// ===== 工作记录 =====
function WorkTab({ retainer, works, onAdd }: { retainer: Retainer; works: RetainerWork[]; onAdd: () => void }) {
  const [typeFilter, setTypeFilter] = useState('')
  const [confirmDel, setConfirmDel] = useState<RetainerWork | null>(null)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const monthWorks = works.filter((w) => w.date >= monthStart)

  const filtered = works.filter((w) => !typeFilter || w.type === typeFilter)

  return (
    <div className="card-pad">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-text-muted">
          本月汇总：<span className="font-medium text-text-main">工作 {monthWorks.length} 次</span>，合计{' '}
          <span className="font-medium tabular-nums text-accent">{fmtHours(monthWorks.reduce((s, w) => s + w.hours * 60, 0))}</span>
        </div>
        <button className="btn-primary btn-sm" onClick={onAdd}>
          <Plus size={13} /> 新增工作记录
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button onClick={() => setTypeFilter('')} className={`chip ${!typeFilter ? '!bg-primary !text-white' : ''}`}>
          全部
        </button>
        {retainer.services.map((s) => (
          <button key={s} onClick={() => setTypeFilter(s)} className={`chip ${typeFilter === s ? '!bg-primary !text-white' : ''}`}>
            {s}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map((w) => (
          <div key={w.id} className="flex items-center gap-3 rounded-btn border border-border px-4 py-3 transition hover:border-accent">
            <div className="w-20 shrink-0 text-xs tabular-nums text-text-muted">{fmtDate(w.date)}</div>
            <Tag color="warm">{w.type}</Tag>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-main">{w.content}</p>
              {w.participants && <p className="text-xs text-text-muted">参与：{w.participants}</p>}
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums text-accent">{fmtHours(w.hours * 60)}</span>
            <button className="btn-ghost btn-sm !px-2 shrink-0" onClick={() => setConfirmDel(w)}>
              <DotsThree size={14} className="text-danger" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <EmptyState icon={<ChatCircleDots size={22} />} title="暂无工作记录" />}
      </div>

      <ConfirmDialog
        open={!!confirmDel}
        title="删除工作记录"
        message={`确定删除 ${fmtDate(confirmDel?.date ?? 0)} 的「${confirmDel?.content ?? ''}」记录吗？`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          if (confirmDel?.id) db.retainerWorks.update(confirmDel.id, { deleted: Date.now(), updatedAt: Date.now() })
          setConfirmDel(null)
        }}
      />
    </div>
  )
}

function WorkModal({ open, onClose, retainer }: { open: boolean; onClose: () => void; retainer: Retainer }) {
  const [date, setDate] = useState(fmtDateInput())
  const [type, setType] = useState<RetainerServiceType>(retainer.services[0] ?? '法律咨询')
  const [content, setContent] = useState('')
  const [hours, setHours] = useState('1')
  const [participants, setParticipants] = useState('')
  const [refNo, setRefNo] = useState('')

  const save = async () => {
    if (!content.trim() || !hours) return
    await db.retainerWorks.add({
      retainerId: retainer.id!,
      date: new Date(date).getTime(),
      type,
      content: content.trim(),
      hours: Number(hours),
      participants: participants.trim() || undefined,
      refNo: refNo.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    onClose()
    setContent('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新增工作记录"
      width={520}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!content.trim()}>保存</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="工作类型" required>
          <Select value={type} onChange={(e) => setType(e.target.value as RetainerServiceType)}>
            {retainer.services.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="工作内容描述" required>
            <TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="如：审核采购合同并出具修改意见…" />
          </Field>
        </div>
        <Field label="服务时长（小时）">
          <TextInput type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </Field>
        <Field label="参与人员">
          <TextInput value={participants} onChange={(e) => setParticipants(e.target.value)} />
        </Field>
        <Field label="关联事项编号">
          <TextInput value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

// ===== 合同与费用 =====
function ContractTab({
  retainer,
  payments,
  contractFile,
  onAdd,
}: {
  retainer: Retainer
  payments: RetainerPayment[]
  contractFile?: DocFile
  onAdd: () => void
}) {
  const paid = payments.reduce((s, p) => s + p.amount, 0)
  const unpaid = Math.max(0, retainer.amount - paid)

  // 该常法客户关联的全部文档（合同文件 + 付款凭证）
  const retainerDocs = useLiveQuery(
    () => db.docs.where('retainerId').equals(retainer.id!).and((d) => !d.deleted).toArray(),
    [retainer.id],
  ) as DocFile[] | undefined
  const docMap = useMemo(() => new Map((retainerDocs ?? []).map((d) => [d.id, d])), [retainerDocs])

  const uploadContract = async (file: File) => {
    const now = Date.now()
    const docId = await db.docs.add({
      name: file.name,
      type: 'other',
      category: 'retainer',
      retainerId: retainer.id,
      size: file.size,
      mime: file.type,
      data: file,
      createdAt: now,
      updatedAt: now,
    })
    await db.retainers.update(retainer.id!, { contractFileId: docId, updatedAt: now })
  }

  return (
    <div className="space-y-4">
      <div className="card-pad">
        <h3 className="mb-3 text-sm font-semibold text-text-main">合同信息</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-text-muted">合同编号</p><p className="mt-0.5">{retainer.contractNo || '—'}</p></div>
          <div><p className="text-xs text-text-muted">付款方式</p><p className="mt-0.5">{retainer.paymentMethod || '—'}</p></div>
          <div><p className="text-xs text-text-muted">开始日期</p><p className="mt-0.5">{fmtDate(retainer.startDate)}</p></div>
          <div><p className="text-xs text-text-muted">截止日期</p><p className="mt-0.5">{fmtDate(retainer.endDate)}</p></div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-btn border border-border px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm text-text-main">
            <FileText size={15} className="text-primary-light" />
            {contractFile ? <span className="max-w-[200px] truncate">{contractFile.name}</span> : <span className="text-text-muted">未上传合同文件</span>}
          </span>
          <div className="flex shrink-0 gap-1.5">
            {contractFile && (
              <button className="btn-ghost btn-sm" onClick={() => contractFile.data && downloadBlob(contractFile.data, contractFile.name)}>
                <Download size={13} /> 下载
              </button>
            )}
            <label className="btn-ghost btn-sm cursor-pointer">
              <Upload size={13} /> {contractFile ? '重新上传' : '上传合同'}
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadContract(e.target.files[0])} />
            </label>
          </div>
        </div>
      </div>

      <div className="card-pad">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-main">付款记录</h3>
          <button className="btn-primary btn-sm" onClick={onAdd}>
            <Plus size={13} /> 添加付款记录
          </button>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-btn bg-bg-warm p-4 text-sm">
          <div><p className="text-xs text-text-muted">合同总额</p><p className="mt-0.5 font-semibold tabular-nums">{fmtMoney(retainer.amount)}</p></div>
          <div><p className="text-xs text-text-muted">已付总额</p><p className="mt-0.5 font-semibold tabular-nums text-success">{fmtMoney(paid)}</p></div>
          <div><p className="text-xs text-text-muted">未付金额</p><p className="mt-0.5 font-semibold tabular-nums text-accent">{fmtMoney(unpaid)}</p></div>
        </div>
        <div className="space-y-1.5">
          {payments.map((p) => {
            const voucher = p.voucherFileId ? docMap.get(p.voucherFileId) : undefined
            return (
              <div key={p.id} className="flex items-center justify-between rounded-btn border border-border px-4 py-2.5">
                <div>
                  <p className="text-sm text-text-main">{fmtDate(p.date)}</p>
                  <p className="text-xs text-text-muted">{p.note || '付款'}</p>
                  {voucher && (
                    <button
                      className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => voucher.data && downloadBlob(voucher.data, voucher.name)}
                    >
                      <Paperclip size={11} /> 凭证：{voucher.name}
                    </button>
                  )}
                </div>
                <span className="text-sm font-semibold tabular-nums text-text-main">{fmtMoney(p.amount)}</span>
              </div>
            )
          })}
          {payments.length === 0 && <p className="text-sm text-text-muted">暂无付款记录</p>}
        </div>
      </div>
    </div>
  )
}

function PayModal({ open, onClose, retainer }: { open: boolean; onClose: () => void; retainer: Retainer }) {
  const [date, setDate] = useState(fmtDateInput())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [voucher, setVoucher] = useState<File | null>(null)

  const save = async () => {
    if (!amount) return
    const now = Date.now()
    let voucherFileId: number | undefined
    if (voucher) {
      voucherFileId = await db.docs.add({
        name: voucher.name,
        type: 'other',
        category: 'retainer',
        retainerId: retainer.id,
        size: voucher.size,
        mime: voucher.type,
        data: voucher,
        createdAt: now,
        updatedAt: now,
      })
    }
    await db.retainerPayments.add({
      retainerId: retainer.id!,
      date: new Date(date).getTime(),
      amount: Number(amount),
      voucherFileId,
      note: note.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    })
    onClose()
    setAmount('')
    setVoucher(null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="添加付款记录"
      width={440}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!amount}>保存</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="付款日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="金额（元）" required>
          <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="付款凭证" hint="可上传截图或 PDF 凭证">
          <label className="flex cursor-pointer items-center gap-2 rounded-btn border border-dashed border-border px-3 py-2.5 text-sm text-text-muted transition hover:border-accent">
            <Upload size={15} />
            {voucher ? <span className="truncate text-text-main">{voucher.name}</span> : '点击上传凭证'}
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => setVoucher(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>
        <Field label="备注">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

// ===== 续签弹窗 =====
function RenewRetainerModal({ open, onClose, retainer }: { open: boolean; onClose: () => void; retainer: Retainer }) {
  const [newEnd, setNewEnd] = useState('')
  const [newAmount, setNewAmount] = useState(String(retainer.amount))
  const [note, setNote] = useState('')

  const save = async () => {
    if (!newEnd) return
    await db.retainers.update(retainer.id!, {
      startDate: retainer.endDate,
      endDate: new Date(newEnd).getTime(),
      amount: Number(newAmount) || retainer.amount,
      notes: note.trim() || retainer.notes,
      status: 'active',
      updatedAt: Date.now(),
    })
    onClose()
    setNewEnd('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="续签合同"
      width={440}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!newEnd}>续签</button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          当前服务期至 {fmtDate(retainer.endDate)}，续签后新服务期从 {fmtDate(retainer.endDate)} 次日开始。
        </p>
        <Field label="新服务截止日期" required>
          <TextInput type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
        </Field>
        <Field label="新合同金额（元）">
          <TextInput type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
        </Field>
        <Field label="备注">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="续约条款说明…" />
        </Field>
      </div>
    </Modal>
  )
}

// ===== 统计概览 =====
function StatsTab({ retainer, works }: { retainer: Retainer; works: RetainerWork[] }) {
  const totalCount = works.length
  const totalHours = works.reduce((s, w) => s + w.hours, 0)
  const avgMonthly = totalHours / Math.max(1, Math.ceil(daysUntil(retainer.endDate) > 0 ? (retainer.endDate - retainer.startDate) / (30 * 86400000) : 1))

  const byType = useMemo(() => {
    const m = new Map<string, { count: number; hours: number }>()
    for (const w of works) {
      const cur = m.get(w.type) ?? { count: 0, hours: 0 }
      cur.count++
      cur.hours += w.hours
      m.set(w.type, cur)
    }
    return Array.from(m.entries()).sort((a, b) => b[1].hours - a[1].hours)
  }, [works])

  const byMonth = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of works) {
      const key = fmtDate(w.date).slice(0, 7)
      m.set(key, (m.get(key) ?? 0) + w.hours)
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
  }, [works])

  const maxMonth = Math.max(...byMonth.map(([, v]) => v), 1)
  const maxType = Math.max(...byType.map(([, v]) => v.hours), 1)
  const pieColors = ['#9aa3ad', '#b09878', '#ebe9e4', '#8c8c8c', '#4b5563', '#c4816b', '#7a9a7e', '#e5e3de', '#3a3a3a']

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card-pad">
        <h3 className="mb-3 text-sm font-semibold text-text-main">总量</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-btn bg-bg-warm p-3">
            <p className="text-xs text-text-muted">工作次数总计</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-text-main">{totalCount} 次</p>
          </div>
          <div className="rounded-btn bg-bg-warm p-3">
            <p className="text-xs text-text-muted">工作时长总计</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-text-main">{fmtHours(totalHours * 60)}</p>
          </div>
          <div className="rounded-btn bg-bg-warm p-3">
            <p className="text-xs text-text-muted">平均每月时长</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-accent">{fmtHours(avgMonthly * 60)}</p>
          </div>
          <div className="rounded-btn bg-bg-warm p-3">
            <p className="text-xs text-text-muted">合同剩余天数</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-text-main">{Math.max(0, daysUntil(retainer.endDate))} 天</p>
          </div>
        </div>
      </div>

      <div className="card-pad">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <ChartPieSlice size={15} /> 工作类型分布
        </h3>
        <div className="flex items-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              {byType.map(([, v], i) => {
                const offset = byType.slice(0, i).reduce((s, [, x]) => s + (x.hours / totalHours) * 100, 0)
                return (
                  <circle
                    key={i}
                    cx="18"
                    cy="18"
                    r="15.915"
                    fill="none"
                    stroke={pieColors[i % pieColors.length]}
                    strokeWidth="4"
                    strokeDasharray={`${(v.hours / totalHours) * 100} ${100 - (v.hours / totalHours) * 100}`}
                    strokeDashoffset={-offset}
                  />
                )
              })}
              {totalHours === 0 && <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ebe9e4" strokeWidth="4" />}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div>
                <p className="text-sm font-semibold text-text-main">{totalHours}h</p>
                <p className="text-[10px] text-text-muted">总时长</p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {byType.map(([t, v], i) => (
              <div key={t} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                <span className="flex-1 truncate text-text-main">{t}</span>
                <span className="tabular-nums text-text-muted">{v.count}次 / {v.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-pad md:col-span-2">
        <h3 className="mb-4 text-sm font-semibold text-text-main">月度工作量</h3>
        <div className="flex h-40 items-end gap-4 px-2">
          {byMonth.map(([m, v], i) => (
            <div key={m} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-xs tabular-nums text-text-muted">{v}h</span>
              <div
                className={`w-full max-w-[44px] rounded-t ${i === byMonth.length - 1 ? 'bg-accent' : 'bg-primary-light/70'}`}
                style={{ height: `${(v / maxMonth) * 110}px` }}
              />
              <span className="text-xs text-text-muted">{m}</span>
            </div>
          ))}
          {byMonth.length === 0 && <p className="py-8 text-center text-sm text-text-muted">暂无工作数据</p>}
        </div>
      </div>
    </div>
  )
}

// ===== 顾问报告 =====
function ReportModal({
  open,
  onClose,
  retainer,
  works,
}: {
  open: boolean
  onClose: () => void
  retainer: Retainer
  works: RetainerWork[]
}) {
  const [period, setPeriod] = useState<'year' | 'half' | 'custom'>('year')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [receiver, setReceiver] = useState('')
  const [summary, setSummary] = useState('')

  const save = () => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    const now = Date.now()
    const fromDate =
      period === 'year'
        ? new Date(now).setFullYear(new Date(now).getFullYear() - 1)
        : period === 'half'
          ? new Date(now).setMonth(new Date(now).getMonth() - 6)
          : new Date(customFrom).getTime()
    const toDate = period === 'custom' ? new Date(customTo).getTime() : now

    const periodWorks = works
      .filter((w) => w.date >= fromDate && w.date <= toDate)
      .sort((a, b) => b.date - a.date)

    const content = JSON.stringify({
      period: [fromDate, toDate],
      receiver: receiver || retainer.contactName || '',
      summary,
      works: periodWorks,
      generatedAt: now,
    })
    db.retainerReports
      .add({
        retainerId: retainer.id!,
        fromDate,
        toDate,
        content,
        status: 'draft',
        generatedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .catch(() => {})
    // 打开预览打印
    openReportPrint(retainer, periodWorks, receiver || retainer.contactName || '', summary, fromDate, toDate)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="生成顾问报告"
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={period === 'custom' && (!customFrom || !customTo)}>
            生成并预览
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="报告周期">
          <div className="flex gap-2">
            {(
              [
                ['year', '近一年'],
                ['half', '近半年'],
                ['custom', '自定义'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`flex-1 rounded-btn border px-3 py-2 text-sm transition ${
                  period === k ? 'border-accent bg-bg-warm text-text-main' : 'border-border text-text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        {period === 'custom' && (
          <div className="flex gap-3">
            <Field label="开始日期">
              <TextInput type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </Field>
            <Field label="结束日期">
              <TextInput type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </Field>
          </div>
        )}
        <Field label="报告接收人">
          <TextInput value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder={retainer.contactName || '默认对接人'} />
        </Field>
        <Field label="报告摘要说明">
          <TextArea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="可选的报告摘要说明…" />
        </Field>
      </div>
    </Modal>
  )
}

function openReportPrint(
  retainer: Retainer,
  works: RetainerWork[],
  receiver: string,
  summary: string,
  fromDate: number,
  toDate: number,
) {
  const win = window.open('', '_blank')
  if (!win) return
  const totalHours = works.reduce((s, w) => s + w.hours, 0)
  const byType = new Map<string, { count: number; hours: number }>()
  for (const w of works) {
    const cur = byType.get(w.type) ?? { count: 0, hours: 0 }
    cur.count++
    cur.hours += w.hours
    byType.set(w.type, cur)
  }
  const monthMap = new Map<string, { count: number; hours: number }>()
  for (const w of works) {
    const key = `${new Date(w.date).getFullYear()}年${new Date(w.date).getMonth() + 1}月`
    const cur = monthMap.get(key) ?? { count: 0, hours: 0 }
    cur.count++
    cur.hours += w.hours
    monthMap.set(key, cur)
  }

  const typeRows = Array.from(byType.entries())
    .map(
      ([t, v]) =>
        `<tr><td>${t}</td><td>${v.count}</td><td>${v.hours}</td><td>${((v.hours / Math.max(totalHours, 0.001)) * 100).toFixed(1)}%</td></tr>`,
    )
    .join('')
  const monthRows = Array.from(monthMap.entries())
    .map(([m, v]) => `<tr><td>${m}</td><td>${v.count}</td><td>${v.hours}h</td></tr>`)
    .join('')
  const detailRows = works
    .map(
      (w) =>
        `<tr><td>${fmtDate(w.date)}</td><td>${w.type}</td><td>${w.content}</td><td>${w.hours}h</td></tr>`,
    )
    .join('')

  win.document.write(`<html><head><title>常年法律顾问服务报告</title><style>
    body{font-family:'PingFang SC','SimSun';font-size:13px;color:#3a3a3a;line-height:1.8;padding:48px}
    h1{text-align:center;font-size:22px;color:#4b5563;margin-bottom:4px}
    .cover{text-align:center;padding:80px 0}
    .cover h1{font-size:28px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:1px solid #e5e3de;padding:7px 10px;text-align:left;font-size:12px}
    th{background:#ebe9e4;font-weight:600}
    h2{color:#4b5563;font-size:16px;border-left:4px solid #4b5563;padding-left:10px;margin:28px 0 12px}
    .bar{background:#ebe9e4;height:10px;border-radius:5px;overflow:hidden;margin:2px 0}
    .bar i{display:block;height:100%;background:#b09878}
  </style></head><body>
    <div class="cover">
      <h1>常年法律顾问服务年度报告</h1>
      <p style="font-size:16px;margin-top:12px">${retainer.clientName}</p>
      <p style="margin-top:8px">报告周期：${fmtDate(fromDate)} - ${fmtDate(toDate)}</p>
      <p style="margin-top:40px">${retainer.contractNo ? retainer.contractNo : ''}</p>
    </div>
    <h2>第一部分 服务概况</h2>
    <p>服务期限：${fmtDate(retainer.startDate)} - ${fmtDate(retainer.endDate)}</p>
    <p>服务期内工作总次数：${works.length} 次，服务总时长：${totalHours} 小时</p>
    <p>${summary || ''}</p>
    <h2>第二部分 工作内容汇总</h2>
    <table><tr><th>工作类型</th><th>次数</th><th>合计时长（小时）</th><th>占比</th></tr>${typeRows}<tr><td><b>合计</b></td><td><b>${works.length}</b></td><td><b>${totalHours}</b></td><td><b>100%</b></td></tr></table>
    <h2>第三部分 月度工作分布</h2>
    <table><tr><th>月份</th><th>次数</th><th>时长</th></tr>${monthRows}</table>
    <h2>第四部分 工作明细列表</h2>
    <table><tr><th>日期</th><th>类型</th><th>内容描述</th><th>时长</th></tr>${detailRows || '<tr><td colspan="4">无记录</td></tr>'}</table>
    <h2>第五部分 总结与建议</h2>
    <p style="min-height:120px">（律师填写）</p>
    <h2>第六部分 续约提示</h2>
    <p>合同到期日期：${fmtDate(retainer.endDate)}，建议提前两个月与客户沟通续约事宜。</p>
    <p style="margin-top:60px;text-align:right">${receiver}（收）</p>
    <p style="text-align:right">${fmtDateTime(Date.now())}</p>
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}
