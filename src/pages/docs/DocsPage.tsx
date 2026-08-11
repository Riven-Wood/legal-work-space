import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FolderOpen,
  MagnifyingGlass,
  Upload,
  FileText,
  Download,
  Trash,
  Eye,
  FileDoc,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { DocFile, DocFolder, LawCase, Client, Retainer } from '../../types'
import { fmtDate } from '../../utils/dates'
import { formatBytes, downloadBlob } from '../../utils/format'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tag } from '../../components/ui/Tag'
import { DocPreview } from '../../components/ui/DocPreview'

export default function DocsPage() {
  return <DocLibrary />
}

// ========== 文档库 ==========
function DocLibrary() {
  const docs = useLiveQuery(() => db.docs.where('deleted').equals(0).toArray(), []) as DocFile[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const retainers = useLiveQuery(() => db.retainers.where('deleted').equals(0).toArray(), []) as Retainer[] | undefined
  const folders = useLiveQuery(() => db.docFolders.where('deleted').equals(0).toArray(), []) as DocFolder[] | undefined

  const [caseFilter, setCaseFilter] = useState<number | ''>('')
  const [typeFilter, setTypeFilter] = useState('')
  const [kw, setKw] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocFile | null>(null)
  const [previewDoc, setPreviewDoc] = useState<DocFile | null>(null)

  const caseMap = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c.name])), [cases])
  const clientMap = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c.name])), [clients])
  const retainerMap = useMemo(() => new Map((retainers ?? []).map((r) => [r.id, r.clientName])), [retainers])
  const folderMap = useMemo(() => new Map((folders ?? []).map((f) => [f.id, f.name])), [folders])

  // 只显示每个版本组的最新版本（旧版本在案件详情的版本历史中查看）
  const latestDocs = useMemo(() => {
    const map = new Map<string, DocFile>()
    for (const d of docs ?? []) {
      const key = d.versionGroup ? `g:${d.versionGroup}` : `i:${d.id}`
      const cur = map.get(key)
      if (!cur || (d.version ?? 1) > (cur.version ?? 1)) map.set(key, d)
    }
    return [...map.values()]
  }, [docs])

  const filtered = useMemo(() => {
    let list = [...latestDocs].sort((a, b) => b.createdAt - a.createdAt)
    if (caseFilter !== '') list = list.filter((d) => d.caseId === caseFilter)
    if (typeFilter) list = list.filter((d) => d.category === typeFilter)
    if (kw.trim()) list = list.filter((d) => d.name.toLowerCase().includes(kw.trim().toLowerCase()))
    return list
  }, [latestDocs, caseFilter, typeFilter, kw])

  const dropFiles = async (files: FileList | File[]) => {
    setUploadOpen(true)
    await new Promise((r) => setTimeout(r, 50))
    window.dispatchEvent(new CustomEvent('docs-upload-files', { detail: Array.from(files) }))
  }

  // 旧版模板草稿（仅有 HTML content、无文件数据）兜底导出为 Word
  const exportHtmlDoc = (d: DocFile) => {
    const content = (d as DocFile & { content?: string }).content
    if (!content) return
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:'PingFang SC','SimSun';font-size:14px;line-height:1.8;padding:40px;color:#3a3a3a}h1{text-align:center;font-size:20px;margin-bottom:24px}</style></head><body>${content}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    downloadBlob(blob, `${d.name.replace(/\.docx?$/, '')}.doc`)
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-main">文档管理</h1>
        <span className="text-xs text-text-muted">共 {filtered.length} 份文档</span>
      </div>

      <div className="card mb-5 flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextInput value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索文件名" className="!pl-8 text-xs" />
        </div>
        <Select value={caseFilter} onChange={(e) => setCaseFilter(e.target.value ? Number(e.target.value) : '')} className="!w-44 !py-1.5 text-xs">
          <option value="">全部案件</option>
          {(cases ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="!w-36 !py-1.5 text-xs">
          <option value="">全部类型</option>
          <option value="filing">起诉材料</option>
          <option value="evidence">证据材料</option>
          <option value="judgment">裁判文书</option>
          <option value="retainer">常法顾问</option>
          <option value="other">其他</option>
        </Select>
        <button className="btn-primary btn-sm" onClick={() => setUploadOpen(true)}>
          <Upload size={14} /> 上传文档
        </button>
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
          dropFiles(e.dataTransfer.files)
        }}
        className={`mb-5 rounded-btn border-2 border-dashed p-4 text-center text-xs transition ${
          dragging ? 'border-accent bg-bg-warm text-text-main' : 'border-border text-text-muted'
        }`}
      >
        支持将文件拖拽到页面任意位置上传
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">文件名</th>
              <th className="th">关联案件/客户</th>
              <th className="th">案件分区</th>
              <th className="th">版本</th>
              <th className="th">类型</th>
              <th className="th">上传日期</th>
              <th className="th">大小</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const isLegacyHtml = !d.data && !!(d as DocFile & { content?: string }).content
              return (
                <tr key={d.id} className="tr-hover">
                  <td className="td max-w-[240px]">
                    <span className="flex items-center gap-2">
                      <FileText size={15} className="shrink-0 text-primary-light" />
                      <span className="truncate">{d.name}</span>
                    </span>
                  </td>
                  <td className="td text-text-muted">
                    {d.caseId
                      ? caseMap.get(d.caseId) ?? '—'
                      : d.retainerId
                        ? `常法：${retainerMap.get(d.retainerId) ?? ''}`
                        : d.clientId
                          ? clientMap.get(d.clientId) ?? '—'
                          : '—'}
                  </td>
                  <td className="td text-text-muted">{d.folderId ? folderMap.get(d.folderId) ?? '—' : '—'}</td>
                  <td className="td">
                    {d.version ? <Tag color="warm">v{d.version}</Tag> : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="td">
                    <Tag color="muted">{docCatLabel(d.category)}</Tag>
                  </td>
                  <td className="td text-text-muted">{fmtDate(d.createdAt)}</td>
                  <td className="td text-text-muted tabular-nums">{formatBytes(d.size)}</td>
                  <td className="td">
                    <div className="flex gap-1.5">
                      {d.data && (
                        <>
                          <button className="btn-ghost btn-sm !px-2" onClick={() => downloadBlob(d.data!, d.name)} title="下载">
                            <Download size={13} />
                          </button>
                          <button className="btn-ghost btn-sm !px-2" onClick={() => setPreviewDoc(d)} title="预览">
                            <Eye size={13} />
                          </button>
                        </>
                      )}
                      {isLegacyHtml && (
                        <button className="btn-ghost btn-sm !px-2" onClick={() => exportHtmlDoc(d)} title="导出为 Word">
                          <FileDoc size={13} />
                        </button>
                      )}
                      <button
                        className="btn-ghost btn-sm !px-2 !text-danger"
                        onClick={() => setConfirmDeleteDoc(d)}
                        title="删除"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={<FolderOpen size={24} />} title="暂无文档" />}
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmDeleteDoc}
        title="删除文档"
        message={`确定删除文档「${confirmDeleteDoc?.name ?? ''}」吗？删除后该文件的所有版本将不可见。此操作不可撤销。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDeleteDoc(null)}
        onConfirm={() => {
          const doc = confirmDeleteDoc
          if (doc?.id) {
            // 软删除该版本组下的全部版本
            if (doc.versionGroup) {
              db.docs
                .where('versionGroup')
                .equals(doc.versionGroup)
                .modify({ deleted: Date.now(), updatedAt: Date.now() })
            } else {
              db.docs.update(doc.id, { deleted: Date.now(), updatedAt: Date.now() })
            }
          }
          setConfirmDeleteDoc(null)
        }}
      />

      {/* 文档预览 */}
      {previewDoc && <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}

function docCatLabel(cat: string) {
  return { filing: '起诉材料', evidence: '证据材料', judgment: '裁判文书', retainer: '常法顾问', other: '其他' }[cat] ?? '其他'
}

// ========== 上传弹窗 ==========
function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const [caseId, setCaseId] = useState<number | ''>('')
  const [folderId, setFolderId] = useState<number | ''>('')
  const [pending, setPending] = useState<File[]>([])
  const [cat, setCat] = useState('other')

  // 选择案件后加载该案件的分区
  const folders = useLiveQuery(
    () => {
      if (!caseId) return Promise.resolve([] as DocFolder[])
      return db.docFolders.where('caseId').equals(caseId).and((f) => !f.deleted).toArray()
    },
    [caseId],
  ) as DocFolder[] | undefined

  useEffect(() => {
    const handler = (e: Event) => {
      setPending((e as CustomEvent).detail as File[])
    }
    window.addEventListener('docs-upload-files', handler)
    return () => window.removeEventListener('docs-upload-files', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setPending([])
      setCaseId('')
      setFolderId('')
      setCat('other')
    }
  }, [open])

  const save = async () => {
    if (pending.length === 0) return
    const now = Date.now()
    for (const f of pending) {
      await db.docs.add({
        name: f.name,
        type: 'other',
        category: (cat as DocFile['category']) || 'other',
        caseId: caseId || undefined,
        folderId: folderId || undefined,
        versionGroup: genVersionGroup(),
        version: 1,
        size: f.size,
        mime: f.type,
        data: f,
        createdAt: now,
        updatedAt: now,
      })
    }
    setPending([])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="上传文档"
      width={520}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={pending.length === 0}>
            上传 {pending.length > 0 ? `（${pending.length} 个文件）` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block cursor-pointer rounded-btn border-2 border-dashed border-border p-6 text-center text-sm text-text-muted transition hover:border-accent">
          <Upload size={20} className="mx-auto mb-2" />
          点击选择文件（可多选）
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setPending(Array.from(e.target.files ?? []))}
          />
        </label>
        {pending.length > 0 && (
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-btn bg-bg-warm p-3">
            {pending.map((f, i) => (
              <p key={i} className="truncate text-xs text-text-main">
                {f.name} · {formatBytes(f.size)}
              </p>
            ))}
          </div>
        )}
        <Field label="关联案件" hint="上传至案件文档区（可选，也可关联到常法客户）">
          <Select value={caseId} onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联案件</option>
            {(cases ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        {caseId !== '' && (
          <Field label="案件分区" hint="选择文件归入的案件分区（可选）">
            <Select value={folderId} onChange={(e) => setFolderId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">暂不分区</option>
              {(folders ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="文档类型">
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="other">其他</option>
            <option value="filing">起诉材料</option>
            <option value="evidence">证据材料</option>
            <option value="judgment">裁判文书</option>
            <option value="retainer">常法顾问</option>
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

// 生成唯一版本组标识
export function genVersionGroup(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
