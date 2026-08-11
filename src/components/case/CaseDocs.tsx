import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Paperclip,
  FileText,
  Image as ImageIcon,
  Eye,
  Download,
  Plus,
  Trash,
  ClockCounterClockwise,
  ArrowsClockwise,
  FolderPlus,
  PencilSimple,
  FolderSimple,
  X,
  Upload,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import type { DocFile, DocFolder } from '../../types'
import { fmtDate, fmtDateTime } from '../../utils/dates'
import { formatBytes, downloadBlob } from '../../utils/format'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, TextArea } from '../../components/ui/Field'
import { DocPreview } from '../../components/ui/DocPreview'
import { genVersionGroup } from '../../pages/docs/DocsPage'

// 预置默认分区
const DEFAULT_FOLDERS = ['起诉材料', '证据材料', '裁判文书', '其他']

/**
 * 案件材料管理：分区管理（新建/重命名/删除/移动）+ 文件版本管理（上传新版本/版本历史/恢复版本）
 * + 自由上传/删除/预览
 */
export function CaseDocs({ caseId }: { caseId: number }) {
  const docs = useLiveQuery(
    () => db.docs.where('caseId').equals(caseId).and((d) => !d.deleted).toArray(),
    [caseId],
  ) as DocFile[] | undefined
  const folders = useLiveQuery(
    () => db.docFolders.where('caseId').equals(caseId).and((f) => !f.deleted).sortBy('createdAt'),
    [caseId],
  ) as DocFolder[] | undefined

  const [active, setActive] = useState<number | 'all'>('all')
  const [dragging, setDragging] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<DocFile | null>(null)
  const [historyDoc, setHistoryDoc] = useState<DocFile | null>(null)
  const [newVersionDoc, setNewVersionDoc] = useState<DocFile | null>(null)
  const [moveDoc, setMoveDoc] = useState<DocFile | null>(null)
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<DocFile | null>(null)

  // 首次进入：为该案件懒初始化默认分区
  useEffect(() => {
    if (folders === undefined) return
    if (folders.length === 0) {
      const now = Date.now()
      DEFAULT_FOLDERS.forEach((name, i) => {
        db.docFolders.add({
          caseId,
          name,
          createdAt: now + i,
          updatedAt: now + i,
        })
      })
    }
  }, [caseId, folders])

  // 每组取最新版本
  const latestDocs = useMemo(() => {
    const map = new Map<string, DocFile>()
    for (const d of docs ?? []) {
      const key = d.versionGroup ? `g:${d.versionGroup}` : `i:${d.id}`
      const cur = map.get(key)
      if (!cur || (d.version ?? 1) > (cur.version ?? 1)) map.set(key, d)
    }
    return [...map.values()]
  }, [docs])

  const shown = useMemo(() => {
    let list = latestDocs.sort((a, b) => b.updatedAt - a.updatedAt)
    if (active !== 'all') list = list.filter((d) => d.folderId === active)
    return list
  }, [latestDocs, active])

  // 上传文件到指定分区（active 为 all 时归入默认"其他"分区）
  const handleFiles = async (files: FileList | File[]) => {
    let target: number | undefined
    if (active === 'all') {
      const other = folders?.find((f) => f.name === '其他')
      target = other?.id
    } else {
      target = active
    }
    const now = Date.now()
    for (const f of Array.from(files)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      const category: DocFile['category'] =
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(ext) ? 'evidence' : 'other'
      await db.docs.add({
        name: f.name,
        type: 'other',
        category,
        caseId,
        folderId: target,
        versionGroup: genVersionGroup(),
        version: 1,
        size: f.size,
        mime: f.type,
        data: f,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // 删除整个版本组（软删除）
  const deleteDoc = async (doc: DocFile) => {
    const now = Date.now()
    try {
      if (doc.versionGroup) {
        await db.docs
          .where('versionGroup')
          .equals(doc.versionGroup)
          .modify({ deleted: now, updatedAt: now })
      } else {
        await db.docs.update(doc.id!, { deleted: now, updatedAt: now })
      }
    } catch {
      // 兜底：索引不可用时按记录逐条软删除
      const target = doc.versionGroup
      const all = await db.docs.toArray()
      for (const d of all) {
        if (d.id === doc.id || (target && d.versionGroup === target)) {
          await db.docs.update(d.id!, { deleted: now, updatedAt: now })
        }
      }
    }
    setConfirmDeleteDoc(null)
  }

  const activeFolderName = active === 'all' ? '全部' : (folders?.find((f) => f.id === active)?.name ?? '未分区')

  return (
    <div>
      {/* 标题 + 操作 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-main">案件材料</h2>
        <span className="text-xs text-text-muted">{shown.length} 份文件</span>
      </div>

      {/* 分区标签 */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setActive('all')}
          className={`chip ${active === 'all' ? '!bg-primary !text-white' : ''}`}
        >
          全部
        </button>
        {(folders ?? []).map((f) => (
          <button
            key={f.id}
            onClick={() => f.id !== undefined && setActive(f.id)}
            className={`chip ${active === f.id ? '!bg-primary !text-white' : ''}`}
            title={f.name}
          >
            <FolderSimple size={12} className="mr-1 inline" />
            {f.name}
          </button>
        ))}
        <button className="btn-ghost btn-sm !px-2 text-primary" onClick={() => setManageOpen(true)} title="管理分区">
          <FolderPlus size={14} /> 管理分区
        </button>
      </div>

      {/* 拖拽上传区 */}
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
        className={`rounded-btn border-2 border-dashed p-3 text-center text-xs transition ${
          dragging ? 'border-accent bg-bg-warm' : 'border-border text-text-muted'
        }`}
      >
        <Paperclip size={15} className="mx-auto mb-1" />
        拖拽文件到此处，或
        <label className="cursor-pointer text-accent hover:underline">
          选择文件
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </label>
        <span className="ml-1.5 text-text-muted">上传到「{activeFolderName}」</span>
      </div>

      {/* 文件列表 */}
      <div className="mt-3 space-y-1.5">
        {shown.map((d) => (
          <div key={d.id} className="group flex items-center gap-3 rounded-btn px-2 py-2 transition hover:bg-bg-warm">
            {isImage(d.name) ? <ImageIcon size={17} className="shrink-0 text-primary-light" /> : <FileText size={17} className="shrink-0 text-primary-light" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-main">
                {d.name}
                {d.version !== undefined && (
                  <span className="ml-1.5 rounded bg-accent/15 px-1 py-0.5 text-[10px] font-medium text-accent">v{d.version}</span>
                )}
              </p>
              <p className="truncate text-xs text-text-muted">
                {fmtDate(d.createdAt)} · {formatBytes(d.size)}
                {d.versionNote && ` · ${d.versionNote}`}
              </p>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => d.data && setPreviewDoc(d)} title="预览">
              <Eye size={13} />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => d.data && downloadBlob(d.data, d.name)} title="下载">
              <Download size={13} />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setNewVersionDoc(d)} title="上传新版本">
              <ArrowsClockwise size={13} />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setHistoryDoc(d)} title="版本历史">
              <ClockCounterClockwise size={13} />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setMoveDoc(d)} title="移动分区">
              <FolderSimple size={13} />
            </button>
            <button className="btn-ghost btn-sm !text-danger" onClick={() => setConfirmDeleteDoc(d)} title="删除">
              <Trash size={13} />
            </button>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-text-muted">该分区暂无文件</p>
            <p className="mt-1 text-xs text-text-muted">拖拽文件到上方上传区即可添加案件材料</p>
          </div>
        )}
      </div>

      {/* 弹窗 */}
      <FolderManageModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        caseId={caseId}
        folders={folders ?? []}
      />
      {previewDoc && <DocPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
      {historyDoc && <VersionHistoryModal doc={historyDoc} onClose={() => setHistoryDoc(null)} />}
      {newVersionDoc && (
        <NewVersionModal doc={newVersionDoc} onClose={() => setNewVersionDoc(null)} />
      )}
      {moveDoc && (
        <MoveDocModal doc={moveDoc} folders={folders ?? []} onClose={() => setMoveDoc(null)} />
      )}
      <ConfirmDialog
        open={!!confirmDeleteDoc}
        title="删除文件"
        message={`确定删除「${confirmDeleteDoc?.name ?? ''}」吗？该文件的所有历史版本将一并删除，此操作不可撤销。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDeleteDoc(null)}
        onConfirm={() => confirmDeleteDoc && deleteDoc(confirmDeleteDoc)}
      />
    </div>
  )
}

function isImage(name: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)
}

// ========== 分区管理弹窗 ==========
function FolderManageModal({
  open,
  onClose,
  caseId,
  folders,
}: {
  open: boolean
  onClose: () => void
  caseId: number
  folders: DocFolder[]
}) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDel, setConfirmDel] = useState<DocFolder | null>(null)

  const create = async () => {
    const name = newName.trim()
    if (!name) return
    const now = Date.now()
    await db.docFolders.add({ caseId, name, createdAt: now, updatedAt: now })
    setNewName('')
  }

  const rename = async (f: DocFolder) => {
    const name = editName.trim()
    if (!name) return
    await db.docFolders.update(f.id!, { name, updatedAt: Date.now() })
    setEditingId(null)
  }

  const remove = async (f: DocFolder) => {
    const now = Date.now()
    // 分区内文档移动到"其他"分区（不存在则取消分区）
    const other = folders.find((x) => x.name === '其他' && x.id !== f.id)
    if (f.id !== undefined) {
      await db.docs
        .where('folderId')
        .equals(f.id)
        .modify({ folderId: other?.id, updatedAt: now })
    }
    await db.docFolders.update(f.id!, { deleted: now, updatedAt: now })
    setConfirmDel(null)
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="管理分区" width={440}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="新分区名称，如：委托材料、调解记录"
              className="flex-1 text-xs"
            />
            <button className="btn-primary btn-sm" onClick={create} disabled={!newName.trim()}>
              <Plus size={13} /> 新建
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {folders.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-btn bg-bg-warm px-3 py-2">
                {editingId === f.id ? (
                  <>
                    <TextInput
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && rename(f)}
                      autoFocus
                      className="flex-1 !py-1 text-xs"
                    />
                    <button className="btn-primary btn-sm !px-2" onClick={() => rename(f)}>
                      <X size={12} /> 保存
                    </button>
                    <button className="btn-ghost btn-sm !px-2" onClick={() => setEditingId(null)}>
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <FolderSimple size={15} className="shrink-0 text-primary-light" />
                    <span className="flex-1 text-sm text-text-main">{f.name}</span>
                    <button
                      className="btn-ghost btn-sm !px-2 text-text-muted"
                      onClick={() => {
                        setEditingId(f.id!)
                        setEditName(f.name)
                      }}
                      title="重命名"
                    >
                      <PencilSimple size={13} />
                    </button>
                    <button
                      className="btn-ghost btn-sm !px-2 !text-danger"
                      onClick={() => setConfirmDel(f)}
                      title="删除分区"
                    >
                      <Trash size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
            {folders.length === 0 && <p className="py-3 text-center text-xs text-text-muted">暂无分区</p>}
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!confirmDel}
        title="删除分区"
        message={`确定删除分区「${confirmDel?.name ?? ''}」吗？分区内的文件将移动到「其他」分区，文件本身不会被删除。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={() => confirmDel && remove(confirmDel)}
      />
    </>
  )
}

// ========== 上传新版本弹窗 ==========
function NewVersionModal({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')

  const save = async () => {
    if (!file) return
    // 同组所有版本，计算下一个版本号
    const group = doc.versionGroup ?? `legacy-${doc.id}`
    const versions = await db.docs.where('versionGroup').equals(group).toArray()
    const maxVer = versions.reduce((m, v) => Math.max(m, v.version ?? 1), 0)
    const now = Date.now()
    const newId = await db.docs.add({
      name: file.name,
      type: 'other',
      category: doc.category,
      caseId: doc.caseId,
      clientId: doc.clientId,
      retainerId: doc.retainerId,
      folderId: doc.folderId,
      versionGroup: group,
      version: maxVer + 1,
      versionNote: note.trim() || undefined,
      size: file.size,
      mime: file.type,
      data: file,
      createdAt: now,
      updatedAt: now,
    })
    // 若无 versionGroup 的旧文档，将其纳入版本组（保留为 v1）
    if (!doc.versionGroup) {
      await db.docs.update(doc.id!, { versionGroup: group, version: 1, updatedAt: now })
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`上传新版本 · ${doc.name}`}
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save} disabled={!file}>
            上传新版本
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block cursor-pointer rounded-btn border-2 border-dashed border-border p-5 text-center text-sm text-text-muted transition hover:border-accent">
          <Upload size={18} className="mx-auto mb-1.5" />
          {file ? <span className="text-accent">{file.name}</span> : '点击选择新版本文件'}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Field label="版本说明" hint="如：补充证据一、修订后的起诉状等（可选）">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="本次版本修改了什么？" />
        </Field>
      </div>
    </Modal>
  )
}

// ========== 版本历史弹窗 ==========
function VersionHistoryModal({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const group = doc.versionGroup ?? `legacy-${doc.id}`
  const versions = useLiveQuery(
    () => db.docs.where('versionGroup').equals(group).and((d) => !d.deleted).toArray(),
    [group],
  ) as DocFile[] | undefined

  const sorted = useMemo(() => [...(versions ?? [])].sort((a, b) => (b.version ?? 1) - (a.version ?? 1)), [versions])
  const latest = sorted[0]

  const restore = async (v: DocFile) => {
    const maxVer = sorted.reduce((m, x) => Math.max(m, x.version ?? 1), 0)
    const now = Date.now()
    await db.docs.add({
      name: v.name,
      type: 'other',
      category: v.category,
      caseId: v.caseId,
      clientId: v.clientId,
      retainerId: v.retainerId,
      folderId: v.folderId,
      versionGroup: group,
      version: maxVer + 1,
      versionNote: `恢复自 v${v.version ?? 1}`,
      size: v.size,
      mime: v.mime,
      data: v.data,
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`版本历史 · ${doc.name}`}
      width={560}
      footer={
        <button className="btn-ghost" onClick={onClose}>
          关闭
        </button>
      }
    >
      <div className="space-y-2">
        {sorted.map((v) => {
          const isLatest = latest?.id === v.id
          return (
            <div key={v.id} className={`flex items-center gap-3 rounded-btn px-3 py-2.5 ${isLatest ? 'bg-bg-warm' : ''}`}>
              <span className={`flex h-7 w-9 shrink-0 items-center justify-center rounded text-xs font-semibold ${isLatest ? 'bg-accent text-white' : 'bg-primary-light/15 text-primary-light'}`}>
                v{v.version ?? 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text-main">
                  {v.name}
                  {isLatest && <span className="ml-2 text-[10px] font-medium text-accent">当前版本</span>}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {fmtDateTime(v.createdAt)} · {formatBytes(v.size)}
                  {v.versionNote && ` · ${v.versionNote}`}
                </p>
              </div>
              {!isLatest && (
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => restore(v)}
                  title="将本版本恢复为当前最新版本"
                >
                  <ArrowsClockwise size={13} /> 恢复
                </button>
              )}
              {v.data && (
                <button className="btn-ghost btn-sm" onClick={() => downloadBlob(v.data!, v.name)} title="下载本版本">
                  <Download size={13} />
                </button>
              )}
            </div>
          )
        })}
        {(versions ?? []).length === 0 && <p className="py-6 text-center text-sm text-text-muted">暂无版本记录</p>}
      </div>
    </Modal>
  )
}

// ========== 移动分区弹窗 ==========
function MoveDocModal({
  doc,
  folders,
  onClose,
}: {
  doc: DocFile
  folders: DocFolder[]
  onClose: () => void
}) {
  const [target, setTarget] = useState<number | ''>(doc.folderId ?? '')

  const save = async () => {
    const now = Date.now()
    if (doc.versionGroup) {
      await db.docs
        .where('versionGroup')
        .equals(doc.versionGroup)
        .modify({ folderId: target || undefined, updatedAt: now })
    } else {
      await db.docs.update(doc.id!, { folderId: target || undefined, updatedAt: now })
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`移动分区 · ${doc.name}`}
      width={420}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={save}>
            移动
          </button>
        </>
      }
    >
      <div className="space-y-2">
        {[{ id: '', name: '不分区' }, ...folders].map((f) => (
          <button
            key={String(f.id)}
            onClick={() => setTarget(f.id === '' ? '' : (f.id as number))}
            className={`flex w-full items-center gap-2 rounded-btn px-3 py-2.5 text-sm transition ${
              target === f.id ? 'bg-primary text-white' : 'text-text-main hover:bg-bg-warm'
            }`}
          >
            <FolderSimple size={15} />
            {f.name}
          </button>
        ))}
      </div>
    </Modal>
  )
}
