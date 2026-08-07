import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  UserCircle,
  Clock,
  Database,
  Info,
  Upload,
  Download,
  Trash,
  Check,
  ToggleLeft,
  ToggleRight,
} from '@phosphor-icons/react'
import { db, getSettings } from '../../db/database'
import type { Settings, BackupData } from '../../types'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Modal'
import { downloadBlob } from '../../utils/format'
import { fmtDateTime } from '../../utils/dates'
import { useApp } from '../../store/AppContext'

export default function SettingsPage() {
  const { bumpRefresh } = useApp()
  const settings = useLiveQuery(() => getSettings(), []) as Settings | undefined
  const [form, setForm] = useState<Partial<Settings>>({})
  const [saved, setSaved] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)

  useEffect(() => {
    if (settings && Object.keys(form).length === 0) setForm(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const set = (k: keyof Settings, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!settings?.id) return
    await db.settings.update(settings.id, { ...form, updatedAt: Date.now() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const exportData = async () => {
    const tables: Record<string, unknown[]> = {}
    const names = [
      'cases',
      'clients',
      'docs',
      'templates',
      'events',
      'timeRecords',
      'invoices',
      'retainers',
      'retainerWorks',
      'retainerPayments',
      'retainerReports',
      'preservations',
      'preservationRenewals',
      'settings',
      'todos',
      'timelines',
      'contactRecords',
    ] as const
    for (const name of names) {
      const table = (db as unknown as Record<string, { toArray: () => Promise<unknown[]> }>)[name]
      if (table) tables[name] = await table.toArray()
    }
    const backup: BackupData = { exportedAt: Date.now(), tables }
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `LegalWorkSpace备份_${fmtDateTime(Date.now()).replace(/[.:\s]/g, '-')}.json`)
  }

  const doImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupData
        for (const [name, rows] of Object.entries(data.tables ?? {})) {
          const table = (db as unknown as Record<string, { clear: () => Promise<void>; bulkAdd: (r: unknown[]) => Promise<unknown> }>)[name]
          if (table && Array.isArray(rows)) {
            await table.clear()
            if (rows.length > 0) await table.bulkAdd(rows)
          }
        }
        bumpRefresh()
        alert('数据导入成功')
      } catch {
        alert('导入失败：文件格式不正确')
      }
    }
    reader.readAsText(file)
  }

  const clearAll = async () => {
    const names = [
      'cases',
      'clients',
      'docs',
      'events',
      'timeRecords',
      'invoices',
      'retainers',
      'retainerWorks',
      'retainerPayments',
      'retainerReports',
      'preservations',
      'preservationRenewals',
      'todos',
      'timelines',
      'contactRecords',
    ] as const
    for (const name of names) {
      await (db as unknown as Record<string, { clear: () => Promise<void> }>)[name].clear()
    }
    await db.templates.clear()
    setClearOpen(false)
    bumpRefresh()
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-5 text-xl font-semibold text-text-main">设置</h1>

      {/* 律师信息 */}
      <div className="card-pad mb-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <UserCircle size={16} /> 律所 / 律师信息
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="姓名">
            <TextInput value={form.lawyerName ?? ''} onChange={(e) => set('lawyerName', e.target.value)} />
          </Field>
          <Field label="律所名称">
            <TextInput value={form.firmName ?? ''} onChange={(e) => set('firmName', e.target.value)} />
          </Field>
          <Field label="地址">
            <TextInput value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="电话">
            <TextInput value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="邮箱">
            <TextInput value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="银行账户" hint="用于账单模板">
            <TextInput value={form.bankAccount ?? ''} onChange={(e) => set('bankAccount', e.target.value)} />
          </Field>
        </div>
      </div>

      {/* 费率 */}
      <div className="card-pad mb-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <Clock size={16} /> 计费设置
        </h2>
        <div className="space-y-4">
          <Field label="默认小时费率（元/小时）" hint="账单生成时自动计算律师费">
            <TextInput
              type="number"
              value={form.hourlyRate ?? 800}
              onChange={(e) => set('hourlyRate', Number(e.target.value))}
              className="!w-48"
            />
          </Field>
          <button
            onClick={() => set('includeRetainerHours', !(form.includeRetainerHours ?? true))}
            className="flex w-full items-center justify-between rounded-btn border border-border px-4 py-3 text-left"
          >
            <div>
              <p className="text-sm font-medium text-text-main">常法工时纳入计费统计</p>
              <p className="text-xs text-text-muted">开启后，常法客户工作记录时长计入计时计费模块的工时统计</p>
            </div>
            {form.includeRetainerHours !== false ? (
              <ToggleRight size={28} className="shrink-0 text-accent" />
            ) : (
              <ToggleLeft size={28} className="shrink-0 text-text-muted" />
            )}
          </button>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="card-pad mb-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <Database size={16} /> 数据管理
        </h2>
        <p className="mb-4 text-xs text-text-muted">所有数据保存在浏览器本地（IndexedDB），隐私优先，不上传任何服务器。</p>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary btn-sm" onClick={exportData}>
            <Download size={14} /> 导出全部数据（JSON 备份）
          </button>
          <label className="btn-ghost btn-sm cursor-pointer">
            <Upload size={14} /> 导入数据（JSON 恢复）
            <input type="file" accept=".json" className="hidden" onChange={(e) => e.target.files?.[0] && setImportFile(e.target.files[0])} />
          </label>
          <button className="btn-danger btn-sm" onClick={() => setClearOpen(true)}>
            <Trash size={14} /> 清空所有数据
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="card-pad">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <Info size={16} /> 关于
        </h2>
        <p className="text-sm text-text-muted">
          Legal Work Space v{form.version ?? '1.0.0'} · 律师工作台 · 纯前端本地存储
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="btn-primary" onClick={save}>
          {saved && <Check size={15} />}
          {saved ? '已保存' : '保存设置'}
        </button>
      </div>

      <ConfirmDialog
        open={!!importFile}
        title="导入数据"
        message="导入将用备份文件覆盖当前全部数据（案件、客户、文档、日程等），当前数据会被清空！建议先导出备份。确定继续导入吗？"
        confirmText="确认导入"
        danger
        onCancel={() => setImportFile(null)}
        onConfirm={() => {
          if (importFile) doImport(importFile)
          setImportFile(null)
        }}
      />

      <ConfirmDialog
        open={clearOpen}
        title="清空所有数据"
        message="此操作将删除全部案件、客户、文档、日程等数据，且不可恢复！建议先导出备份。确定继续吗？"
        confirmText="确认清空"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={clearAll}
      />
    </div>
  )
}
