import { useEffect, useState } from 'react'
import { Clock, Play, Pause, MagnifyingGlass, NotePencil } from '@phosphor-icons/react'
import { useApp } from '../../store/AppContext'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/database'
import { fmtDuration } from '../../utils/dates'
import { Modal } from '../ui/Modal'
import { Field, TextInput, Select } from '../ui/Field'
import type { LawCase } from '../../types'

export function TopBar() {
  const { timer, runningSeconds, toggleTimer, startTimer, stopTimer, setSearchOpen } = useApp()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [caseId, setCaseId] = useState<number | ''>('')
  const [desc, setDesc] = useState('')

  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const activeCases = cases?.filter((c) => c.status === 'active') ?? []

  const seconds = timer?.running ? runningSeconds : timer?.accumulated ?? 0

  const startNew = () => {
    if (!caseId) return
    if (timer?.running && timer.caseId !== caseId) {
      stopTimer()
      // 切换案件：立即开始新计时
      setTimeout(() => {
        startTimer(Number(caseId), desc || undefined)
        setPickerOpen(false)
        setCaseId('')
        setDesc('')
      }, 30)
    } else {
      startTimer(Number(caseId), desc || undefined)
      setPickerOpen(false)
      setCaseId('')
      setDesc('')
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-bg-card px-5">
      {/* 全局搜索入口 */}
      <button
        onClick={() => setSearchOpen(true)}
        className="flex w-72 items-center gap-2 rounded-btn border border-border bg-bg-page px-3 py-1.5 text-sm text-text-muted transition hover:border-accent"
      >
        <MagnifyingGlass size={16} />
        <span>搜索案件、客户、文档…</span>
        <kbd className="ml-auto rounded border border-border bg-bg-card px-1.5 py-0.5 text-[10px] text-text-muted">⌘K</kbd>
      </button>

      {/* 全局计时器 */}
      <div className="flex items-center gap-2">
        {timer && (
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium tabular-nums ${
                timer.running ? 'animate-pulse-soft bg-accent text-white' : 'border border-border bg-bg-warm text-text-main'
              }`}
            >
              <Clock size={15} weight={timer.running ? 'fill' : 'regular'} />
              {fmtDuration(seconds)}
            </span>
            <button
              onClick={toggleTimer}
              className="btn-ghost btn-sm !rounded-full"
              title={timer.running ? '暂停' : '继续'}
            >
              {timer.running ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
        )}
        <button
          onClick={() => setPickerOpen(true)}
          className="btn-primary btn-sm"
          title={timer?.running ? '切换案件计时' : '开始计时'}
        >
          <NotePencil size={14} />
          {timer?.running ? '切换案件' : '开始计时'}
        </button>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={timer?.running ? '切换案件继续计时' : '开始计时'}
        width={460}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setPickerOpen(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={startNew} disabled={!caseId}>
              开始计时
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="关联案件" required>
            <Select value={caseId} onChange={(e) => setCaseId(Number(e.target.value))}>
              <option value="">请选择案件</option>
              {activeCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="工作内容简述">
            <TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="如：起草起诉状、研究证据…" />
          </Field>
          {timer?.running && (
            <p className="text-xs text-text-muted">
              当前计时：{timer.caseId ? (activeCases.find((c) => c.id === timer.caseId)?.name ?? '') : ''} — 切换后自动结束上一段并保存
            </p>
          )}
        </div>
      </Modal>
    </header>
  )
}
