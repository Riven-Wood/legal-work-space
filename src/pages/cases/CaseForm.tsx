import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Warning } from '@phosphor-icons/react'
import { db } from '../../db/database'
import type { LawCase, Client } from '../../types'
import { Modal } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { CAUSES, similarity } from '../../utils/format'
import { todayStamp, fmtDateInput } from '../../utils/dates'
import { useApp } from '../../store/AppContext'

interface Props {
  open: boolean
  onClose: () => void
  prefill?: Partial<LawCase>
  isEdit?: boolean
}

export function CaseForm({ open, onClose, prefill, isEdit }: Props) {
  const { navigate } = useApp()
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined

  const [name, setName] = useState('')
  const [clientMode, setClientMode] = useState<'select' | 'new'>('select')
  const [clientId, setClientId] = useState<number | ''>('')
  const [newClientName, setNewClientName] = useState('')
  const [cause, setCause] = useState('')
  const [counterparty, setCounterparty] = useState('')
  const [court, setCourt] = useState('')
  const [caseNo, setCaseNo] = useState('')
  const [filedDate, setFiledDate] = useState('')
  const [fee, setFee] = useState('')
  const [risk, setRisk] = useState<'high' | 'medium' | 'low'>('medium')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setName(prefill?.name ?? '')
      setClientMode('select')
      setClientId(prefill?.clientId ?? '')
      setNewClientName('')
      setCause(prefill?.cause ?? '')
      setCounterparty(prefill?.counterparty ?? '')
      setCourt(prefill?.court ?? '')
      setCaseNo(prefill?.caseNo ?? '')
      setFiledDate(prefill?.filedDate ? fmtDateInput(prefill.filedDate) : fmtDateInput())
      setFee(prefill?.fee ? String(prefill.fee) : '')
      setRisk(prefill?.risk ?? 'medium')
      setNotes(prefill?.notes ?? '')
    }
  }, [open, prefill])

  // 利益冲突检索：对方当事人 与 现有客户 + 已有案件对方当事人 模糊匹配
  const conflictMatches = useMemo(() => {
    if (!counterparty.trim() || !clients) return []
    const kw = counterparty.trim()
    const res: { source: string; name: string; score: number }[] = []
    for (const c of clients) {
      const s = similarity(kw, c.name)
      if (s >= 0.5) res.push({ source: '现有客户', name: c.name, score: s })
    }
    for (const c of cases ?? []) {
      if (prefill?.id && c.id === prefill.id) continue
      if (!c.counterparty) continue
      const s = similarity(kw, c.counterparty)
      if (s >= 0.5) res.push({ source: '已有案件对方当事人', name: c.counterparty, score: s })
    }
    return res.sort((a, b) => b.score - a.score).slice(0, 4)
  }, [counterparty, clients, cases, prefill])

  const clientName = clientMode === 'select' ? clients?.find((c) => c.id === clientId)?.name ?? '' : newClientName.trim()

  const canSave = name.trim() && clientName && cause

  const save = async () => {
    if (!canSave) return
    const now = Date.now()
    let finalClientId = clientId as number | undefined
    if (clientMode === 'new' && newClientName.trim()) {
      const existing = clients?.find((c) => c.name === newClientName.trim())
      if (existing) {
        finalClientId = existing.id
      } else {
        const newClient: Client = {
          name: newClientName.trim(),
          type: 'person',
          createdAt: now,
          updatedAt: now,
        }
        finalClientId = await db.clients.add(newClient)
      }
    }
    const data = {
      name: name.trim(),
      clientId: finalClientId,
      clientName: clientName,
      cause,
      counterparty: counterparty.trim() || undefined,
      court: court.trim() || undefined,
      caseNo: caseNo.trim() || undefined,
      filedDate: filedDate ? new Date(filedDate).getTime() : todayStamp(),
      fee: fee ? Number(fee) : undefined,
      risk,
      notes: notes.trim() || undefined,
      updatedAt: now,
    }
    if (isEdit && prefill?.id) {
      await db.cases.update(prefill.id, data)
      onClose()
      return
    }
    const caseId = await db.cases.add({ ...data, status: 'active', stage: '接案', createdAt: now })
    onClose()
    navigate({ page: 'cases', caseId })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑案件' : '新建案件'}
      width={640}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" disabled={!canSave} onClick={save}>
            保存并进入详情
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="案件名称" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="如：张三诉李四买卖合同纠纷" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="客户" required>
            <div className="flex gap-2">
              <button
                onClick={() => setClientMode('select')}
                className={`rounded-btn border px-3 py-1.5 text-xs ${clientMode === 'select' ? 'border-accent bg-bg-warm text-text-main' : 'border-border text-text-muted'}`}
              >
                选择已有客户
              </button>
              <button
                onClick={() => setClientMode('new')}
                className={`rounded-btn border px-3 py-1.5 text-xs ${clientMode === 'new' ? 'border-accent bg-bg-warm text-text-main' : 'border-border text-text-muted'}`}
              >
                输入新客户
              </button>
            </div>
            {clientMode === 'select' ? (
              <Select value={clientId} onChange={(e) => setClientId(Number(e.target.value))}>
                <option value="">请选择客户</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.type === 'company' ? '（企业）' : ''}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="输入新客户名称，保存时自动创建客户档案"
              />
            )}
          </Field>
        </div>
        <Field label="案由" required>
          <Select value={cause} onChange={(e) => setCause(e.target.value)}>
            <option value="">请选择案由</option>
            {CAUSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="收案日期">
          <TextInput type="date" value={filedDate} onChange={(e) => setFiledDate(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="对方当事人" hint="输入时自动与客户库比对，检测利益冲突">
            <TextInput
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="如：李四（自然人）/ XX科技有限公司"
            />
          </Field>
          {conflictMatches.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-btn bg-bg-warm px-3 py-2 text-xs text-text-main">
              <Warning size={15} className="mt-0.5 shrink-0 text-accent" />
              <div>
                可能与现有客户存在利益冲突：
                {conflictMatches.map((m) => (
                  <span key={m.name} className="ml-1">
                    「{m.name}」（{m.source}，相似度 {Math.round(m.score * 100)}%）
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        <Field label="受理法院">
          <TextInput value={court} onChange={(e) => setCourt(e.target.value)} placeholder="如：北京市朝阳区人民法院" />
        </Field>
        <Field label="案号">
          <TextInput value={caseNo} onChange={(e) => setCaseNo(e.target.value)} placeholder="如：（2026）京0105民初123号" />
        </Field>
        <Field label="律师费金额（元）">
          <TextInput type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" />
        </Field>
        <Field label="风险等级">
          <div className="flex gap-2">
            {(
              [
                ['high', '高'],
                ['medium', '中'],
                ['low', '低'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRisk(k)}
                className={`flex-1 rounded-btn border px-3 py-2 text-sm transition ${
                  risk === k
                    ? k === 'high'
                      ? 'border-danger bg-danger text-white'
                      : k === 'medium'
                        ? 'border-accent bg-accent text-white'
                        : 'border-success bg-success text-white'
                    : 'border-border text-text-muted hover:bg-bg-warm'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <div className="col-span-2">
          <Field label="备注">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="案件背景、注意事项…" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
