import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  UserCircle,
  Database,
  Info,
  Upload,
  Download,
  Trash,
  Check,
} from '@phosphor-icons/react'
import { db, getSettings } from '../../db/database'
import type { Settings } from '../../types'
import { Field, TextInput } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Modal'
import { downloadBlob, formatBytes } from '../../utils/format'
import { fmtDateTime } from '../../utils/dates'
import { useApp } from '../../store/AppContext'
import {
  BackupEncodingError,
  BackupValidationError,
  MAX_BACKUP_FILE_BYTES,
  parseBackupJson,
  stringifyBackup,
} from '../../backup/backupCodec'
import { clearApplicationData, exportDatabase, restoreDatabase } from '../../backup/backupService'
import { APP_VERSION } from '../../utils/appVersion'

type DataOperation = 'export' | 'import' | 'clear'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function SettingsPage() {
  const { bumpRefresh } = useApp()
  const settings = useLiveQuery(() => getSettings(), []) as Settings | undefined
  const [form, setForm] = useState<Partial<Settings>>({})
  const [saved, setSaved] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [dataOperation, setDataOperation] = useState<DataOperation | null>(null)

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
    setDataOperation('export')
    try {
      const backup = await exportDatabase(db)
      const json = stringifyBackup(backup)
      const blob = new Blob([json], { type: 'application/json' })
      if (blob.size > MAX_BACKUP_FILE_BYTES) {
        throw new BackupEncodingError(
          `备份生成后约 ${formatBytes(blob.size)}，超过 ${formatBytes(MAX_BACKUP_FILE_BYTES)} 的安全上限。请减少超大文件后重试。`,
        )
      }
      downloadBlob(blob, `LegalWorkSpace备份_${fmtDateTime(backup.exportedAt).replace(/[.:\s]/g, '-')}.json`)
      alert(`数据导出成功，已包含全部数据表及文档/票据原文件（${formatBytes(blob.size)}）。`)
    } catch (error) {
      console.error('数据导出失败', error)
      alert(`导出失败：${errorMessage(error)}`)
    } finally {
      setDataOperation(null)
    }
  }

  const doImport = async (file: File) => {
    setImportFile(null)
    setDataOperation('import')
    try {
      if (file.size > MAX_BACKUP_FILE_BYTES) {
        throw new BackupValidationError(
          `备份文件为 ${formatBytes(file.size)}，超过 ${formatBytes(MAX_BACKUP_FILE_BYTES)} 的安全上限，为避免内存耗尽已停止导入。`,
        )
      }
      const input = parseBackupJson(await file.text())
      const result = await restoreDatabase(db, input)
      bumpRefresh()

      const lostFiles = result.warnings.filter((warning) => warning.code === 'legacy-blob-lost').length
      const messages = ['数据导入完成，备份已以单个事务恢复。']
      if (lostFiles > 0) {
        messages.push(
          `警告：该旧版备份中有 ${lostFiles} 个文件的原始内容在当时导出时已丢失，本次仅恢复元数据（文件名、大小等安全字段），这些文件无法下载或预览。`,
        )
      }
      if (result.ignoredTables.length > 0) {
        messages.push(`已安全忽略 ${result.ignoredTables.length} 个当前版本不识别的数据表。`)
      }
      alert(messages.join('\n\n'))
    } catch (error) {
      console.error('数据导入失败', error)
      alert(`导入失败，当前数据未被更改：${errorMessage(error)}`)
    } finally {
      setDataOperation(null)
    }
  }

  const clearAll = async () => {
    setClearOpen(false)
    setDataOperation('clear')
    try {
      await clearApplicationData(db)
      bumpRefresh()
      alert('全部业务数据已清空，律所/律师设置已保留。')
    } catch (error) {
      console.error('清空业务数据失败', error)
      alert(`清空失败，事务已回滚，当前数据未被更改：${errorMessage(error)}`)
    } finally {
      setDataOperation(null)
    }
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

      {/* 数据管理 */}
      <div className="card-pad mb-5">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <Database size={16} /> 数据管理
        </h2>
        <p className="mb-2 text-xs text-text-muted">所有数据保存在浏览器本地（IndexedDB），隐私优先，不上传任何服务器。</p>
        <p className="mb-4 text-xs text-text-muted">备份包含文档和票据原文件；文件较大时导出/导入可能耗时并占用较多内存。</p>
        <div className="flex flex-wrap gap-3">
          <button className="btn-primary btn-sm" onClick={exportData} disabled={dataOperation !== null}>
            <Download size={14} /> {dataOperation === 'export' ? '正在导出…' : '导出全部数据（JSON 备份）'}
          </button>
          <label className={`btn-ghost btn-sm cursor-pointer ${dataOperation !== null ? 'pointer-events-none opacity-50' : ''}`}>
            <Upload size={14} /> {dataOperation === 'import' ? '正在导入…' : '导入数据（JSON 恢复）'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              disabled={dataOperation !== null}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (file) setImportFile(file)
                event.currentTarget.value = ''
              }}
            />
          </label>
          <button className="btn-danger btn-sm" onClick={() => setClearOpen(true)} disabled={dataOperation !== null}>
            <Trash size={14} /> {dataOperation === 'clear' ? '正在清空…' : '清空全部业务数据'}
          </button>
        </div>
      </div>

      {/* 关于 */}
      <div className="card-pad">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
          <Info size={16} /> 关于
        </h2>
        <p className="text-sm text-text-muted">
          Legal Work Space v{APP_VERSION} · 律师工作台 · 纯前端本地存储
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
        }}
      />

      <ConfirmDialog
        open={clearOpen}
        title="清空全部业务数据"
        message="此操作将删除全部案件、客户、文档、发票/票据、法律咨询、日程等业务数据，但会保留当前律所/律师设置。业务数据不可恢复，建议先导出备份。确定继续吗？"
        confirmText="确认清空"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={clearAll}
      />
    </div>
  )
}
