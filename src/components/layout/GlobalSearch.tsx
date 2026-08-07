import { useEffect, useMemo, useState } from 'react'
import { MagnifyingGlass, Briefcase, UsersThree, Handshake, FolderOpen, FileText, Clock } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useApp } from '../../store/AppContext'
import { db } from '../../db/database'
import type { LawCase, Client, Retainer, DocFile, DocTemplate, TimeRecord, RetainerWork } from '../../types'

interface Group {
  label: string
  icon: React.ElementType
  items: { id: number; title: string; sub?: string; action: () => void }[]
}

export function GlobalSearch() {
  const { searchOpen, setSearchOpen, navigate } = useApp()
  const [q, setQ] = useState('')

  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const clients = useLiveQuery(() => db.clients.where('deleted').equals(0).toArray(), []) as Client[] | undefined
  const retainers = useLiveQuery(() => db.retainers.where('deleted').equals(0).toArray(), []) as Retainer[] | undefined
  const docs = useLiveQuery(() => db.docs.where('deleted').equals(0).toArray(), []) as DocFile[] | undefined
  const templates = useLiveQuery(() => db.templates.where('deleted').equals(0).toArray(), []) as
    | DocTemplate[]
    | undefined
  const timeRecords = useLiveQuery(() => db.timeRecords.where('deleted').equals(0).toArray(), []) as
    | TimeRecord[]
    | undefined
  const retainerWorks = useLiveQuery(() => db.retainerWorks.where('deleted').equals(0).toArray(), []) as
    | RetainerWork[]
    | undefined

  useEffect(() => {
    if (!searchOpen) return
    setQ('')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen, setSearchOpen])

  // Cmd/Ctrl + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  const kw = q.trim().toLowerCase()

  const groups = useMemo<Group[]>(() => {
    if (!kw) return []
    const result: Group[] = []
    const match = (s?: string) => (s ?? '').toLowerCase().includes(kw)

    const caseItems = (cases ?? [])
      .filter((c) => match(c.name) || match(c.caseNo) || match(c.clientName))
      .slice(0, 5)
      .map((c) => ({
        id: c.id!,
        title: c.name,
        sub: `${c.caseNo || '无案号'} · ${c.clientName || ''}`,
        action: () => navigate({ page: 'cases', caseId: c.id }),
      }))
    if (caseItems.length)
      result.push({ label: '案件', icon: Briefcase, items: caseItems })

    const clientItems = (clients ?? [])
      .filter((c) => match(c.name) || match(c.phone))
      .slice(0, 5)
      .map((c) => ({
        id: c.id!,
        title: c.name,
        sub: c.type === 'person' ? '个人客户' : '企业客户',
        action: () => navigate({ page: 'clients', clientId: c.id }),
      }))
    if (clientItems.length)
      result.push({ label: '客户', icon: UsersThree, items: clientItems })

    const retainerItems = (retainers ?? [])
      .filter((r) => match(r.clientName) || match(r.contractNo))
      .slice(0, 5)
      .map((r) => ({
        id: r.id!,
        title: r.clientName,
        sub: '常法客户',
        action: () => navigate({ page: 'retainers', retainerId: r.id }),
      }))
    if (retainerItems.length)
      result.push({ label: '常法客户', icon: Handshake, items: retainerItems })

    const docItems = (docs ?? [])
      .filter((d) => match(d.name))
      .slice(0, 5)
      .map((d) => ({
        id: d.id!,
        title: d.name,
        sub: '文档',
        action: () => navigate({ page: 'docs', docsTab: 'library' }),
      }))
    if (docItems.length) result.push({ label: '文档', icon: FolderOpen, items: docItems })

    const templateItems = (templates ?? [])
      .filter((t) => match(t.name) || match(t.category))
      .slice(0, 5)
      .map((t) => ({
        id: t.id!,
        title: t.name,
        sub: `模板 · ${t.category}`,
        action: () => navigate({ page: 'docs', docsTab: 'templates' }),
      }))
    if (templateItems.length) result.push({ label: '模板', icon: FileText, items: templateItems })

    // 工作记录（工时 + 常法工作）
    const workItems: { id: number; title: string; sub?: string; action: () => void }[] = []
    for (const r of timeRecords ?? []) {
      if (!match(r.description)) continue
      const caseName = (cases ?? []).find((c) => c.id === r.caseId)?.name
      workItems.push({
        id: r.id!,
        title: r.description ?? '未填写内容',
        sub: `工时 · ${caseName ?? '未关联案件'}`,
        action: () => navigate({ page: 'billing', billingTab: 'records' }),
      })
      if (workItems.length >= 5) break
    }
    if (workItems.length < 5) {
      for (const w of retainerWorks ?? []) {
        if (!match(w.content)) continue
        workItems.push({
          id: 100000 + w.id!,
          title: w.content,
          sub: `常法工作 · ${(retainers ?? []).find((r) => r.id === w.retainerId)?.clientName ?? ''}`,
          action: () => navigate({ page: 'retainers', retainerId: w.retainerId }),
        })
        if (workItems.length >= 5) break
      }
    }
    if (workItems.length) result.push({ label: '工作记录', icon: Clock, items: workItems })

    return result
  }, [kw, cases, clients, retainers, docs, templates, timeRecords, retainerWorks, navigate])

  if (!searchOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={() => setSearchOpen(false)}
    >
      <div
        className="animate-fade-in w-[560px] overflow-hidden rounded-card bg-bg-card shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <MagnifyingGlass size={18} className="text-text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索案件、客户、常法客户、文档、模板…"
            className="flex-1 bg-transparent text-base text-text-main outline-none placeholder:text-text-muted/70"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-3">
          {kw && groups.length === 0 && (
            <p className="py-8 text-center text-sm text-text-muted">未找到相关结果</p>
          )}
          {groups.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-text-muted">
                <g.icon size={14} />
                {g.label}
              </div>
              {g.items.map((it) => (
                <button
                  key={`${g.label}-${it.id}`}
                  onClick={() => {
                    it.action()
                    setSearchOpen(false)
                  }}
                  className="flex w-full items-center justify-between rounded-btn px-3 py-2.5 text-left transition hover:bg-bg-warm"
                >
                  <span className="truncate text-sm text-text-main">{it.title}</span>
                  <span className="ml-4 shrink-0 text-xs text-text-muted">{it.sub}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
