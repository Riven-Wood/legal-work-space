import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  MagnifyingGlass,
  Plus,
  User,
  Buildings,
  ArrowRight,
  Phone,
  MapPin,
  IdentificationBadge,
  ChatCircleDots,
  NotePencil,
  Paperclip,
  Briefcase,
  X,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { Client, LawCase, ContactRecord, DocFile } from '../../types'
import { fmtDate } from '../../utils/dates'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { CaseForm } from '../cases/CaseForm'

export default function ClientList() {
  const { nav, navigate } = useApp()
  const [kw, setKw] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(nav.clientId ?? null)
  const [addOpen, setAddOpen] = useState(false)

  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const records = useLiveQuery(() => db.contactRecords.where('deleted').equals(0).toArray(), []) as
    | ContactRecord[]
    | undefined

  const caseCount = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of cases ?? []) {
      if (c.clientId) m.set(c.clientId, (m.get(c.clientId) ?? 0) + 1)
    }
    return m
  }, [cases])

  const lastContact = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of records ?? []) {
      const cur = m.get(r.clientId)
      if (!cur || r.date > cur) m.set(r.clientId, r.date)
    }
    return m
  }, [records])

  const filtered = (clients ?? []).filter((c) => !kw.trim() || c.name.toLowerCase().includes(kw.trim().toLowerCase()))
  const selected = clients?.find((c) => c.id === selectedId) ?? null

  return (
    <div className="mx-auto flex h-full max-w-7xl gap-5 p-6">
      {/* 左侧列表 */}
      <div className="card flex w-80 shrink-0 flex-col overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-base font-semibold text-text-main">客户管理</h1>
            <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
              <Plus size={13} /> 新建
            </button>
          </div>
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <TextInput value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索客户名称" className="!py-1.5 !pl-8 text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id!)}
              className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                selectedId === c.id ? 'bg-bg-warm' : 'hover:bg-bg-warm/60'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  selectedId === c.id ? 'bg-accent text-white' : 'bg-bg-warm text-primary-light'
                }`}
              >
                {c.type === 'company' ? <Buildings size={16} /> : <User size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-main">{c.name}</p>
                <p className="text-xs text-text-muted">
                  {caseCount.get(c.id!) ?? 0} 个案件 · 最后联系 {lastContact.get(c.id!) ? fmtDate(lastContact.get(c.id!)) : '—'}
                </p>
              </div>
              <ArrowRight size={14} className="shrink-0 text-text-muted opacity-0 transition group-hover:opacity-100" />
            </button>
          ))}
          {filtered.length === 0 && (
            <EmptyState icon={<User size={24} />} title="暂无客户" action={<button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>新建客户</button>} />
          )}
        </div>
      </div>

      {/* 右侧详情 */}
      <div className="card flex-1 overflow-y-auto">
        {selected ? (
          <ClientDetail client={selected} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-text-muted">选择左侧客户查看详情</p>
          </div>
        )}
      </div>

      <ClientForm open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}

function ClientDetail({ client }: { client: Client }) {
  const { navigate } = useApp()
  const [contactOpen, setContactOpen] = useState(false)
  const [caseFormOpen, setCaseFormOpen] = useState(false)

  const relatedCases = useLiveQuery(
    () => db.cases.where('clientId').equals(client.id!).and((c) => !c.deleted).toArray(),
    [client.id],
  ) as LawCase[] | undefined
  const records = useLiveQuery(
    () => db.contactRecords.where('clientId').equals(client.id!).and((r) => !r.deleted).sortBy('date'),
    [client.id],
  ) as ContactRecord[] | undefined
  const docs = useLiveQuery(
    () => db.docs.where('clientId').equals(client.id!).and((d) => !d.deleted).toArray(),
    [client.id],
  ) as DocFile[] | undefined

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white">
          {client.type === 'company' ? <Buildings size={22} /> : <User size={22} />}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-text-main">{client.name}</h2>
          <p className="text-xs text-text-muted">{client.type === 'company' ? '企业客户' : '个人客户'}</p>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="card-pad mb-5">
        <h3 className="mb-3 text-sm font-semibold text-text-main">基本信息</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-0.5 flex items-center gap-1 text-xs text-text-muted">
              <Phone size={12} /> 联系方式
            </p>
            <p className="text-text-main">{client.phone || '—'}</p>
          </div>
          <div>
            <p className="mb-0.5 flex items-center gap-1 text-xs text-text-muted">
              <MapPin size={12} /> 地址
            </p>
            <p className="text-text-main">{client.address || '—'}</p>
          </div>
          <div className="col-span-2">
            <p className="mb-0.5 flex items-center gap-1 text-xs text-text-muted">
              <IdentificationBadge size={12} /> 身份证号 / 统一信用代码
            </p>
            <p className="text-text-main">{client.idNumber || '—'}</p>
          </div>
          {client.notes && (
            <div className="col-span-2">
              <p className="mb-0.5 text-xs text-text-muted">备注</p>
              <p className="text-text-main">{client.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 关联案件 */}
      <div className="card-pad mb-5">
        <h3 className="mb-3 text-sm font-semibold text-text-main">关联案件（{relatedCases?.length ?? 0}）</h3>
        <div className="space-y-1.5">
          {(relatedCases ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => navigate({ page: 'cases', caseId: c.id })}
              className="flex w-full items-center justify-between rounded-btn px-3 py-2.5 transition hover:bg-bg-warm"
            >
              <div className="min-w-0 text-left">
                <p className="truncate text-sm text-text-main">{c.name}</p>
                <p className="text-xs text-text-muted">
                  {c.cause} · {c.caseNo || '无案号'}
                </p>
              </div>
              <ArrowRight size={14} className="shrink-0 text-text-muted" />
            </button>
          ))}
          {(relatedCases ?? []).length === 0 && <p className="text-sm text-text-muted">暂无关联案件</p>}
        </div>
        <button
          className="btn-ghost btn-sm mt-3"
          onClick={() => setCaseFormOpen(true)}
        >
          <Briefcase size={13} /> 新建关联案件
        </button>
      </div>

      {/* 关联案件新建弹窗（预填客户） */}
      <CaseForm
        open={caseFormOpen}
        onClose={() => setCaseFormOpen(false)}
        prefill={{ clientId: client.id, clientName: client.name }}
      />

      {/* 沟通记录 */}
      <div className="card-pad mb-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text-main">
            <ChatCircleDots size={15} /> 沟通记录
          </h3>
          <button className="btn-ghost btn-sm" onClick={() => setContactOpen(true)}>
            <Plus size={13} /> 记录沟通
          </button>
        </div>
        <div className="space-y-3">
          {(records ?? []).map((r) => (
            <div key={r.id} className="border-l-2 border-bg-warm pl-3">
              <p className="text-xs text-text-muted">{fmtDate(r.date)}</p>
              <p className="mt-0.5 text-sm text-text-main">{r.content}</p>
            </div>
          ))}
          {(records ?? []).length === 0 && <p className="text-sm text-text-muted">暂无沟通记录</p>}
        </div>
      </div>

      {/* 相关文档 */}
      <div className="card-pad">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <Paperclip size={15} /> 相关文档（{(docs ?? []).length}）
        </h3>
        {(docs ?? []).map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-btn px-2 py-2 hover:bg-bg-warm">
            <span className="truncate text-sm text-text-main">{d.name}</span>
            <span className="shrink-0 text-xs text-text-muted">{fmtDate(d.createdAt)}</span>
          </div>
        ))}
        {(docs ?? []).length === 0 && <p className="text-sm text-text-muted">暂无文档</p>}
      </div>

      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} clientId={client.id!} />
    </div>
  )
}

function ClientForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'person' | 'company'>('person')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [notes, setNotes] = useState('')

  const save = async () => {
    if (!name.trim()) return
    await db.clients.add({
      name: name.trim(),
      type,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      idNumber: idNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    onClose()
    setName('')
    setPhone('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新建客户"
      width={520}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!name.trim()}>保存</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="客户名称" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="类型">
          <div className="flex gap-2">
            {(
              [
                ['person', '个人'],
                ['company', '企业'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`flex-1 rounded-btn border px-3 py-2 text-sm transition ${
                  type === k ? 'border-accent bg-bg-warm text-text-main' : 'border-border text-text-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="联系方式">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="手机/电话" />
        </Field>
        <Field label="地址">
          <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label={type === 'company' ? '统一社会信用代码' : '身份证号'}>
          <TextInput value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
        </Field>
        <Field label="备注">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ContactModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: number }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [content, setContent] = useState('')

  const save = async () => {
    if (!content.trim()) return
    await db.contactRecords.add({
      clientId,
      date: new Date(date).getTime(),
      content: content.trim(),
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
      title="记录沟通"
      width={460}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!content.trim()}>保存</button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="日期">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="内容摘要" required>
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="沟通内容、结论、待办…" />
        </Field>
      </div>
    </Modal>
  )
}
