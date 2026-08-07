import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  FolderOpen,
  SquaresFour,
  MagnifyingGlass,
  Upload,
  FileText,
  Download,
  PencilSimple,
  Trash,
  ArrowLeft,
  TextB,
  ListBullets,
  TextAlignLeft,
  TextAlignRight,
  TextH,
  Eye,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import { useApp } from '../../store/AppContext'
import type { DocFile, DocTemplate, LawCase, Client, Retainer, TemplateCategory } from '../../types'
import { fmtDate, fmtDateTime, fmtMoney } from '../../utils/dates'
import { formatBytes, downloadBlob } from '../../utils/format'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tag } from '../../components/ui/Tag'

const CATEGORIES: TemplateCategory[] = [
  '起诉状',
  '答辩状',
  '代理词',
  '上诉状',
  '律师函',
  '法律意见书',
  '财产保全申请书',
  '证据目录',
]

const BUILTIN_TEMPLATES: { name: string; category: TemplateCategory; description: string; content: string }[] = [
  {
    name: '民事起诉状（通用）',
    category: '起诉状',
    description: '原告基于事实与理由请求法院支持其诉讼请求的书面文书',
    content: `<h1 style="text-align:center">民事起诉状</h1><p>原告：{委托人}</p><p>被告：{对方当事人}</p><p>案由：{案由}</p><p>诉讼请求：</p><p>一、</p><p>二、</p><p>事实与理由：</p><p style="text-align:right">此致<br/>{受理法院}</p><p style="text-align:right">起诉人：{委托人}</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '民事答辩状',
    category: '答辩状',
    description: '被告针对原告起诉状提出的答辩意见',
    content: `<h1 style="text-align:center">民事答辩状</h1><p>答辩人：{委托人}</p><p>被答辩人：{对方当事人}</p><p>答辩人因{案由}一案，现提出答辩意见如下：</p><p>一、</p><p>二、</p><p style="text-align:right">此致<br/>{受理法院}</p><p style="text-align:right">答辩人：{委托人}</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '代理词',
    category: '代理词',
    description: '庭审后提交法庭的代理意见书',
    content: `<h1 style="text-align:center">代理词</h1><p>尊敬的审判长、审判员：</p><p>{委托人}与{对方当事人}之间{案由}一案，本人作为原告/被告的委托诉讼代理人，现发表如下代理意见：</p><p>一、</p><p>二、</p><p style="text-align:right">代理人：</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '民事上诉状',
    category: '上诉状',
    description: '当事人不服一审判决向二审法院提起上诉',
    content: `<h1 style="text-align:center">民事上诉状</h1><p>上诉人：{委托人}</p><p>被上诉人：{对方当事人}</p><p>上诉人因{案由}一案，不服人民法院（判决书文号）民事判决，现依法提起上诉。</p><p>上诉请求：</p><p>一、</p><p>事实与理由：</p><p style="text-align:right">此致<br/>中级人民法院</p><p style="text-align:right">上诉人：{委托人}</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '律师函',
    category: '律师函',
    description: '受当事人委托向对方发出正式法律函件',
    content: `<h1 style="text-align:center">律师函</h1><p>致：{对方当事人}</p><p>事务所（以下简称"本所"）接受{委托人}的委托，指派律师就贵方与{委托人}之间{案由}事宜，特出具本律师函。</p><p>一、</p><p>二、</p><p>请贵方于收到本函后三日内与{委托人}联系处理上述事宜。</p><p style="text-align:right">律师事务所</p><p style="text-align:right">律师：</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '法律意见书',
    category: '法律意见书',
    description: '就特定法律问题出具的专业分析意见',
    content: `<h1 style="text-align:center">法律意见书</h1><p>致：{委托人}</p><p>关于：{案由}相关法律问题</p><p>一、基本情况</p><p>二、法律依据</p><p>三、分析意见</p><p>四、结论与建议</p><p style="text-align:right">律师事务所</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '财产保全申请书',
    category: '财产保全申请书',
    description: '请求法院对被申请人财产采取保全措施',
    content: `<h1 style="text-align:center">财产保全申请书</h1><p>申请人：{委托人}</p><p>被申请人：{对方当事人}</p><p>请求事项：</p><p>一、请求依法查封、冻结被申请人名下财产，保全金额人民币____元。</p><p>事实与理由：</p><p>申请人诉被申请人{案由}一案，为防止被申请人转移财产，特申请财产保全。</p><p style="text-align:right">此致<br/>{受理法院}</p><p style="text-align:right">申请人：{委托人}</p><p style="text-align:right">{当前日期}</p>`,
  },
  {
    name: '证据目录',
    category: '证据目录',
    description: '按组列明证据名称、来源与证明目的',
    content: `<h1 style="text-align:center">证据目录</h1><p>案件：{委托人} 诉 {对方当事人} {案由}一案</p><table style="width:100%;border-collapse:collapse"><tr style="background:#ebe9e4"><th style="border:1px solid #e5e3de;padding:6px">序号</th><th style="border:1px solid #e5e3de;padding:6px">证据名称</th><th style="border:1px solid #e5e3de;padding:6px">来源</th><th style="border:1px solid #e5e3de;padding:6px">证明目的</th></tr><tr><td style="border:1px solid #e5e3de;padding:6px">1</td><td style="border:1px solid #e5e3de;padding:6px"></td><td style="border:1px solid #e5e3de;padding:6px"></td><td style="border:1px solid #e5e3de;padding:6px"></td></tr></table><p style="text-align:right">提交人：{委托人}</p><p style="text-align:right">{当前日期}</p>`,
  },
]

export default function DocsPage() {
  const { nav, navigate } = useApp()
  const tab = nav.docsTab ?? 'library'
  const [docId, setDocId] = useState<number | null>(nav.docId ?? null)

  useEffect(() => {
    if (nav.docId) setDocId(nav.docId)
  }, [nav.docId])

  // 监听文档库中"编辑草稿"事件
  useEffect(() => {
    const handler = (e: Event) => setDocId((e as CustomEvent).detail as number)
    window.addEventListener('open-doc-editor', handler)
    return () => window.removeEventListener('open-doc-editor', handler)
  }, [])

  if (docId) {
    return <DocEditor docId={docId} onBack={() => setDocId(null)} />
  }

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => navigate({ page: 'docs', docsTab: 'library' })}
            className={`flex items-center gap-1.5 rounded-btn px-4 py-2 text-sm transition ${
              tab === 'library' ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-warm'
            }`}
          >
            <FolderOpen size={15} /> 文档库
          </button>
          <button
            onClick={() => navigate({ page: 'docs', docsTab: 'templates' })}
            className={`flex items-center gap-1.5 rounded-btn px-4 py-2 text-sm transition ${
              tab === 'templates' ? 'bg-primary text-white' : 'text-text-muted hover:bg-bg-warm'
            }`}
          >
            <SquaresFour size={15} /> 模板中心
          </button>
        </div>
      </div>
      {tab === 'library' ? <DocLibrary /> : <TemplateCenter onUse={(d) => setDocId(d)} />}
    </div>
  )
}

// ========== 文档库 ==========
function DocLibrary() {
  const docs = useLiveQuery(() => db.docs.where('deleted').equals(0).toArray(), []) as DocFile[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const retainers = useLiveQuery(() => db.retainers.where('deleted').equals(0).toArray(), []) as Retainer[] | undefined

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

  const filtered = useMemo(() => {
    let list = [...(docs ?? [])].sort((a, b) => b.createdAt - a.createdAt)
    if (caseFilter !== '') list = list.filter((d) => d.caseId === caseFilter)
    if (typeFilter) list = list.filter((d) => d.category === typeFilter)
    if (kw.trim()) list = list.filter((d) => d.name.toLowerCase().includes(kw.trim().toLowerCase()))
    return list
  }, [docs, caseFilter, typeFilter, kw])

  const dropFiles = async (files: FileList | File[]) => {
    setUploadOpen(true)
    await new Promise((r) => setTimeout(r, 50))
    window.dispatchEvent(new CustomEvent('docs-upload-files', { detail: Array.from(files) }))
  }

  return (
    <div>
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
              <th className="th">类型</th>
              <th className="th">上传日期</th>
              <th className="th">大小</th>
              <th className="th">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="tr-hover">
                <td className="td max-w-[280px]">
                  <span className="flex items-center gap-2">
                    <FileText size={15} className="shrink-0 text-primary-light" />
                    <span className="truncate">{d.name}</span>
                  </span>
                </td>
                <td className="td text-text-muted">
                  {d.caseId ? caseMap.get(d.caseId) ?? '—' : d.retainerId ? `常法：${retainerMap.get(d.retainerId) ?? ''}` : d.clientId ? clientMap.get(d.clientId) ?? '—' : '—'}
                </td>
                <td className="td">
                  <Tag color="muted">{docCatLabel(d.category)}</Tag>
                </td>
                <td className="td text-text-muted">{fmtDate(d.createdAt)}</td>
                <td className="td text-text-muted tabular-nums">{formatBytes(d.size)}</td>
                <td className="td">
                  <div className="flex gap-1.5">
                    <button
                      className="btn-ghost btn-sm !px-2"
                      onClick={() => d.data && downloadBlob(d.data, d.name)}
                      title="下载"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      className="btn-ghost btn-sm !px-2"
                      onClick={() => d.data && setPreviewDoc(d)}
                      title="预览"
                    >
                      <Eye size={13} />
                    </button>
                    {d.content !== undefined && (
                      <button
                        className="btn-ghost btn-sm !px-2"
                        onClick={() => window.dispatchEvent(new CustomEvent('open-doc-editor', { detail: d.id }))}
                        title="编辑草稿"
                      >
                        <PencilSimple size={13} />
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
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState icon={<FolderOpen size={24} />} title="暂无文档" />}
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!confirmDeleteDoc}
        title="删除文档"
        message={`确定删除文档「${confirmDeleteDoc?.name ?? ''}」吗？此操作不可撤销。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirmDeleteDoc(null)}
        onConfirm={() => {
          if (confirmDeleteDoc?.id) db.docs.update(confirmDeleteDoc.id, { deleted: Date.now(), updatedAt: Date.now() })
          setConfirmDeleteDoc(null)
        }}
      />

      {/* 文档预览 */}
      {previewDoc && <DocLibraryPreview doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  )
}

function DocLibraryPreview({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!doc.data) return
    const u = URL.createObjectURL(doc.data)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [doc])
  const isPdf = (doc.name || '').toLowerCase().endsWith('.pdf')
  const isImg = /\.(png|jpe?g|gif|webp)$/i.test(doc.name || '')
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
        {isPdf && url && <iframe src={url} className="h-[560px] w-full rounded-btn border border-border" title="PDF 预览" />}
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

function docCatLabel(cat: string) {
  return { filing: '起诉材料', evidence: '证据材料', judgment: '裁判文书', retainer: '常法顾问', other: '其他' }[cat] ?? '其他'
}

// ========== 上传弹窗 ==========
function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const [caseId, setCaseId] = useState<number | ''>('')
  const [pending, setPending] = useState<File[]>([])
  const [cat, setCat] = useState('other')

  useEffect(() => {
    const handler = (e: Event) => {
      setPending((e as CustomEvent).detail as File[])
    }
    window.addEventListener('docs-upload-files', handler)
    return () => window.removeEventListener('docs-upload-files', handler)
  }, [])

  useEffect(() => {
    if (open) {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.onchange = () => setPending(Array.from(input.files ?? []))
      // 由按钮触发的文件选择在组件内部处理
      setPending((p) => p)
    }
  }, [open])

  const save = async () => {
    if (pending.length === 0) return
    for (const f of pending) {
      await db.docs.add({
        name: f.name,
        type: 'other',
        category: (cat as DocFile['category']) || 'other',
        caseId: caseId || undefined,
        size: f.size,
        mime: f.type,
        data: f,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
          <button className="btn-ghost" onClick={onClose}>取消</button>
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

// ========== 模板中心 ==========
function TemplateCenter({ onUse }: { onUse: (docId: number) => void }) {
  const [cat, setCat] = useState<string>('全部')
  const templates = useLiveQuery(() => db.templates.where('deleted').equals(0).toArray(), []) as
    | DocTemplate[]
    | undefined
  const [useOpen, setUseOpen] = useState(false)
  const [selected, setSelected] = useState<DocTemplate | null>(null)

  // 首次进入初始化内置模板
  useEffect(() => {
    db.templates.count().then(async (n) => {
      if (n === 0) {
        const now = Date.now()
        for (let i = 0; i < BUILTIN_TEMPLATES.length; i++) {
          await db.templates.add({ ...BUILTIN_TEMPLATES[i], deleted: 0, createdAt: now + i, updatedAt: now + i })
        }
      }
    })
  }, [])

  const filtered = (templates ?? []).filter((t) => cat === '全部' || t.category === cat)

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {['全部', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`chip ${cat === c ? '!bg-primary !text-white' : ''}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((t) => (
          <div key={t.id} className="card flex flex-col gap-2 p-5 transition hover:shadow-pop">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-main">{t.name}</h3>
              <Tag color="warm">{t.category}</Tag>
            </div>
            <p className="flex-1 text-xs leading-relaxed text-text-muted">{t.description}</p>
            <button
              className="btn-primary btn-sm mt-2 w-full"
              onClick={() => {
                setSelected(t)
                setUseOpen(true)
              }}
            >
              使用此模板
            </button>
          </div>
        ))}
      </div>
      <UseTemplateModal
        open={useOpen}
        onClose={() => setUseOpen(false)}
        template={selected}
        onDone={(docId) => {
          setUseOpen(false)
          onUse(docId)
        }}
      />
    </div>
  )
}

function UseTemplateModal({
  open,
  onClose,
  template,
  onDone,
}: {
  open: boolean
  onClose: () => void
  template: DocTemplate | null
  onDone: (docId: number) => void
}) {
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const [caseId, setCaseId] = useState<number | ''>('')

  const save = async () => {
    if (!template) return
    const lawCase = cases?.find((c) => c.id === caseId)
    let content = template.content
    if (lawCase) {
      content = fillVars(content, {
        '委托人': lawCase.clientName ?? '',
        '对方当事人': lawCase.counterparty ?? '',
        '受理法院': lawCase.court ?? '',
        '案由': lawCase.cause,
        '当前日期': fmtDateTime(Date.now()).split(' ')[0],
      })
    }
    const now = Date.now()
    const docId = await db.docs.add({
      name: `${template.name}（${fmtDate(now)}）`,
      type: 'other',
      category: 'filing',
      caseId: caseId || undefined,
      size: new Blob([content]).size,
      mime: 'text/html',
      templateId: template.id,
      content,
      createdAt: now,
      updatedAt: now,
    })
    onClose()
    onDone(docId)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="使用模板"
      width={480}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>
            创建文书草稿
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text-main">
          模板：<span className="font-medium">{template?.name}</span>
        </p>
        <Field label="关联案件" hint="选择案件后自动填充委托人、对方当事人、法院等信息">
          <Select value={caseId} onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联（手动填写变量）</option>
            {(cases ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

function fillVars(content: string, vars: Record<string, string>) {
  let out = content
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{${k}}`, v || `【${k}】`)
  }
  return out
}

// ========== 编辑器 ==========
function DocEditor({ docId, onBack }: { docId: number; onBack: () => void }) {
  const doc = useLiveQuery(() => db.docs.get(docId), [docId]) as DocFile | undefined
  const editorRef = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (editorRef.current && doc?.content) {
      editorRef.current.innerHTML = doc.content
    }
  }, [docId, doc?.content])

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
  }

  const save = async () => {
    if (!doc || !editorRef.current) return
    await db.docs.update(docId, {
      content: editorRef.current.innerHTML,
      size: new Blob([editorRef.current.innerHTML]).size,
      updatedAt: Date.now(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const exportWord = () => {
    if (!doc || !editorRef.current) return
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:'PingFang SC','SimSun';font-size:14px;line-height:1.8;padding:40px;color:#3a3a3a}h1{text-align:center;font-size:20px;margin-bottom:24px}</style></head><body>${editorRef.current.innerHTML}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    downloadBlob(blob, `${doc.name.replace(/\.docx?$/, '')}.doc`)
  }

  const exportPdf = () => {
    if (!editorRef.current) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(
      `<html><head><title>${doc?.name ?? '文书'}</title><style>body{font-family:'PingFang SC','SimSun';font-size:14px;line-height:1.8;padding:48px;color:#3a3a3a}h1{text-align:center;font-size:20px;margin-bottom:24px}table{border-collapse:collapse}td,th{border:1px solid #e5e3de;padding:6px}</style></head><body>${editorRef.current.innerHTML}</body></html>`,
    )
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="btn-ghost btn-sm !px-2" onClick={onBack}>
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 className="text-base font-semibold text-text-main">{doc?.name ?? '文书草稿'}</h1>
            <p className="text-xs text-text-muted">自动填充变量：{'委托人'}、{'对方当事人'}、{'受理法院'}、{'案由'}、{'当前日期'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={save}>
            {saved ? '✓ 已保存' : '保存草稿'}
          </button>
          <button className="btn-ghost btn-sm" onClick={exportWord}>
            <Download size={13} /> 导出 Word
          </button>
          <button className="btn-primary btn-sm" onClick={exportPdf}>
            导出 PDF
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-btn border border-border bg-bg-card p-1.5">
        <button className="btn-ghost btn-sm !px-2" onClick={() => exec('bold')} title="加粗">
          <TextB size={14} />
        </button>
        <button className="btn-ghost btn-sm !px-2" onClick={() => exec('formatBlock', '<h3>')} title="标题">
          <TextH size={14} />
        </button>
        <button className="btn-ghost btn-sm !px-2" onClick={() => exec('insertUnorderedList')} title="列表">
          <ListBullets size={14} />
        </button>
        <button className="btn-ghost btn-sm !px-2" onClick={() => exec('justifyLeft')} title="左对齐">
          <TextAlignLeft size={14} />
        </button>
        <button className="btn-ghost btn-sm !px-2" onClick={() => exec('justifyRight')} title="右对齐">
          <TextAlignRight size={14} />
        </button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button
          className="btn-ghost btn-sm !px-2"
          onClick={() => {
            const v = prompt('请输入需要插入的变量名（如 委托人）：')
            if (v) exec('insertHTML', `{${v}}`)
          }}
        >
          插入变量
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="card min-h-[600px] px-10 py-8 text-sm leading-8 text-text-main outline-none focus:border-accent"
        style={{ whiteSpace: 'pre-wrap' }}
        onBlur={save}
      />
    </div>
  )
}
