import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Handshake, MagnifyingGlass, ArrowRight, Dot } from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { Retainer, Client, RetainerWork, RetainerServiceType } from '../../types'
import { fmtDate, fmtHours, daysUntil } from '../../utils/dates'
import { fmtMoney } from '../../utils/dates'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tag } from '../../components/ui/Tag'

const SERVICES: RetainerServiceType[] = [
  '法律咨询',
  '合同审核',
  '合同起草',
  '法律意见书',
  '参与会议',
  '参与谈判',
  '出具律师函',
  '专项培训',
  '其他',
]

export function retainerStatus(r: Retainer): RetainerStatus {
  const d = daysUntil(r.endDate)
  if (d < 0) return 'expired'
  if (d <= 30) return 'expiring'
  return 'active'
}

type RetainerStatus = 'active' | 'expiring' | 'expired'

export default function RetainerList() {
  const { navigate } = useApp()
  const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [kw, setKw] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const retainers = useLiveQuery(() => db.retainers.where('deleted').equals(0).toArray(), []) as Retainer[] | undefined
  const works = useLiveQuery(() => db.retainerWorks.where('deleted').equals(0).toArray(), []) as RetainerWork[] | undefined

  const monthStart = useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  }, [])

  const monthHours = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of works ?? []) {
      if (w.date < monthStart) continue
      m.set(w.retainerId, (m.get(w.retainerId) ?? 0) + w.hours)
    }
    return m
  }, [works, monthStart])

  const withStatus = (retainers ?? []).map((r) => ({ ...r, st: retainerStatus(r) }))
  const filtered = withStatus
    .filter((r) => (filter === 'all' ? true : r.st === filter))
    .filter((r) => !kw.trim() || r.clientName.toLowerCase().includes(kw.trim().toLowerCase()))
    .sort((a, b) => a.endDate - b.endDate)

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-main">常法客户</h1>
          <p className="mt-0.5 text-sm text-text-muted">共 {filtered.length} 家，即将到期客户排最前</p>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={16} weight="bold" /> 新建常法客户
        </button>
      </div>

      <div className="card mb-5 flex items-center gap-3 px-4 py-3">
        <div className="flex rounded-tag bg-bg-warm p-0.5">
          {(
            [
              ['all', '全部'],
              ['active', '服务中'],
              ['expiring', '即将到期'],
              ['expired', '已到期'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded px-3 py-1 text-sm transition ${
                filter === k ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜客户名称" className="!w-48 !py-1.5 !pl-8 text-xs" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Handshake size={26} />}
            title="暂无常法客户"
            action={<button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}><Plus size={14} /> 新建常法客户</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate({ page: 'retainers', retainerId: r.id })}
              className="card group flex flex-col gap-3 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-pop"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-text-main">{r.clientName}</h3>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {fmtDate(r.startDate)} - {fmtDate(r.endDate)}
                  </p>
                </div>
                <Tag color={r.st === 'active' ? 'success' : r.st === 'expiring' ? 'accent' : 'danger'}>
                  {r.st === 'active' ? '服务中' : r.st === 'expiring' ? '即将到期' : '已到期'}
                </Tag>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">合同金额</span>
                <span className="font-semibold tabular-nums text-accent">{fmtMoney(r.amount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-text-muted">
                <span>本月服务 {fmtHours((monthHours.get(r.id!) ?? 0) * 60)}</span>
                <span className="flex items-center gap-1">
                  <Dot color={r.st === 'expiring' ? '#b09878' : r.st === 'expired' ? '#c4816b' : '#7a9a7e'} />
                  {r.st === 'expired' ? `已到期 ${Math.abs(daysUntil(r.endDate))} 天` : `剩余 ${daysUntil(r.endDate)} 天`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <RetainerForm open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

export function RetainerForm({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: Retainer }) {
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const [clientMode, setClientMode] = useState<'select' | 'new'>('select')
  const [clientId, setClientId] = useState<number | ''>('')
  const [newClientName, setNewClientName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [amount, setAmount] = useState('')
  const [services, setServices] = useState<RetainerServiceType[]>([])
  const [contractNo, setContractNo] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('一次性付清')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [notes, setNotes] = useState('')

  const clientName = clientMode === 'select' ? clients?.find((c) => c.id === clientId)?.name ?? '' : newClientName.trim()
  const canSave = clientName && startDate && endDate && services.length > 0

  const save = async () => {
    if (!canSave) return
    const now = Date.now()
    let finalClientId = clientId as number | undefined
    if (clientMode === 'new' && newClientName.trim()) {
      const existing = clients?.find((c) => c.name === newClientName.trim())
      finalClientId = existing?.id ?? (await db.clients.add({ name: newClientName.trim(), type: 'company', createdAt: now, updatedAt: now }))
    }
    const data = {
      clientId: finalClientId,
      clientName,
      startDate: new Date(startDate).getTime(),
      endDate: new Date(endDate).getTime(),
      amount: Number(amount) || 0,
      services,
      contractNo: contractNo.trim() || undefined,
      paymentMethod,
      contactName: contactName.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      notes: notes.trim() || undefined,
      status: 'active' as const,
      updatedAt: now,
    }
    if (prefill?.id) {
      await db.retainers.update(prefill.id, data)
    } else {
      await db.retainers.add({ ...data, createdAt: now })
    }
    onClose()
  }

  const toggleService = (s: RetainerServiceType) => {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prefill ? '编辑常法客户' : '新建常法客户'}
      width={620}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!canSave}>保存</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="客户名称" required>
            <div className="mb-2 flex gap-2">
              <button
                onClick={() => setClientMode('select')}
                className={`rounded-btn border px-3 py-1 text-xs ${clientMode === 'select' ? 'border-accent bg-bg-warm' : 'border-border text-text-muted'}`}
              >
                选择已有客户
              </button>
              <button
                onClick={() => setClientMode('new')}
                className={`rounded-btn border px-3 py-1 text-xs ${clientMode === 'new' ? 'border-accent bg-bg-warm' : 'border-border text-text-muted'}`}
              >
                输入新客户
              </button>
            </div>
            {clientMode === 'select' ? (
              <Select value={clientId} onChange={(e) => setClientId(Number(e.target.value))}>
                <option value="">请选择客户</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            ) : (
              <TextInput value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="新客户名称（自动创建档案）" />
            )}
          </Field>
        </div>
        <Field label="服务开始日期" required>
          <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="服务截止日期" required>
          <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="合同金额（年度顾问费）" required>
          <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </Field>
        <Field label="付款方式">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option>一次性付清</option>
            <option>按季度支付</option>
            <option>按半年支付</option>
            <option>按年支付</option>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="服务内容范围" required hint="后续记录工作时的工作类型选项">
            <div className="flex flex-wrap gap-1.5">
              {SERVICES.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleService(s)}
                  className={`chip ${services.includes(s) ? '!bg-accent !text-white' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="合同编号">
          <TextInput value={contractNo} onChange={(e) => setContractNo(e.target.value)} />
        </Field>
        <Field label="对接人姓名">
          <TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="对接人联系方式">
          <TextInput value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </Field>
        <Field label="是否有驻场要求">
          <Select value={''} onChange={() => {}}>
            <option value="">否</option>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="备注">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
