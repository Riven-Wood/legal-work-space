import { useEffect, useState } from 'react'
import { FileText, Download, FilePdf, FileImage } from '@phosphor-icons/react'
import type { DocFile } from '../../types'
import { Modal } from './Modal'
import { downloadBlob } from '../../utils/format'

/**
 * 文档预览弹窗：PDF / 图片 / 纯文本（txt、md、json、csv 等）内联预览，
 * Word 及其他类型提示下载。
 */
export function DocPreview({ doc, onClose }: { doc: DocFile; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [textErr, setTextErr] = useState(false)

  const isPdf = (doc.name || '').toLowerCase().endsWith('.pdf')
  const isImg = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(doc.name || '')
  const isWord = /\.(docx?|wps|rtf)$/i.test(doc.name || '')
  const isText = /\.(txt|md|markdown|json|csv|log|js|ts|jsx|tsx|html|htm|xml|yml|yaml|py|java|c|cpp|sql|sh)$/i.test(doc.name || '')

  useEffect(() => {
    setUrl(null)
    setText(null)
    setTextErr(false)
    if (!doc.data) return
    if (isPdf || isImg) {
      const u = URL.createObjectURL(doc.data)
      setUrl(u)
      return () => URL.revokeObjectURL(u)
    }
    if (isText) {
      doc.data
        .text()
        .then((t) => setText(t))
        .catch(() => setTextErr(true))
    }
  }, [doc, isPdf, isImg, isText])

  const unsupported = !isPdf && !isImg && !isWord && !isText

  return (
    <Modal
      open
      onClose={onClose}
      title={doc.name}
      width={760}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            关闭
          </button>
          <button className="btn-primary" onClick={() => doc.data && downloadBlob(doc.data, doc.name)}>
            <Download size={14} /> 下载
          </button>
        </>
      }
    >
      <div className="min-h-[420px]">
        {isPdf && url && <iframe src={url} className="h-[560px] w-full rounded-btn border border-border" title="PDF 预览" />}
        {isImg && url && <img src={url} alt={doc.name} className="mx-auto max-h-[560px] max-w-full rounded-btn" />}
        {isText && text !== null && (
          <pre className="max-h-[560px] w-full overflow-auto whitespace-pre-wrap rounded-btn border border-border bg-bg-warm p-4 font-mono text-xs leading-relaxed text-text-main">
            {text}
          </pre>
        )}
        {isText && textErr && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FileText size={40} className="text-primary-light" />
            <p className="text-sm text-text-main">文本内容读取失败</p>
            <button className="btn-primary btn-sm" onClick={() => doc.data && downloadBlob(doc.data, doc.name)}>
              <Download size={13} /> 下载查看
            </button>
          </div>
        )}
        {isWord && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <FileText size={40} className="text-primary-light" />
            <p className="text-sm text-text-main">Word 文档不支持在线预览</p>
            <p className="text-xs text-text-muted">请下载后使用本地软件打开</p>
          </div>
        )}
        {unsupported && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            {isPdf ? <FilePdf size={40} className="text-primary-light" /> : isImg ? <FileImage size={40} className="text-primary-light" /> : <FileText size={40} className="text-primary-light" />}
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
