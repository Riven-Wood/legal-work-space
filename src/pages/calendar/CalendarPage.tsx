import { useMemo, useReducer, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  format,
  getDay,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  CaretLeft,
  CaretRight,
  Plus,
  CalendarBlank,
  Gavel,
  UsersThree,
  Timer,
  ShieldWarning,
  ArrowUpRight,
  NotePencil,
  Trash,
} from '@phosphor-icons/react'
import { db } from '../../db/database'
import type { CalendarEvent, LawCase, EventType } from '../../types'
import { fmtDate, fmtDateInput, daysUntil } from '../../utils/dates'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { Field, TextInput, Select, TextArea } from '../../components/ui/Field'
import { useApp } from '../../store/AppContext'
import { calendarTitle, calendarTransition, calendarVisibleDays } from '../../utils/calendarNavigation'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// 每种类型使用高区分度配色：text 为文字色，bg 为浅底色（白底日历上保证可读性）
const TYPE_META: Record<EventType, { label: string; text: string; bg: string }> = {
  hearing: { label: '开庭', text: '#b91c1c', bg: '#fdecec' },
  meeting: { label: '会见', text: '#1d4ed8', bg: '#e8f0fe' },
  'evidence-deadline': { label: '举证截止', text: '#c2410c', bg: '#fdf0e3' },
  'appeal-deadline': { label: '上诉截止', text: '#7c3aed', bg: '#f1eafd' },
  'enforcement-deadline': { label: '申请执行截止', text: '#0f766e', bg: '#e0f2f0' },
  'preservation-expiry': { label: '保全到期', text: '#15803d', bg: '#e7f5ea' },
  other: { label: '其他', text: '#5b6470', bg: '#eff1f3' },
}

export default function CalendarPage() {
  const [{ view, anchor: visibleDate }, dispatchCalendar] = useReducer(calendarTransition, undefined, () => ({
    view: 'month' as const,
    anchor: new Date(),
  }))
  const [addOpen, setAddOpen] = useState(false)
  const [editEv, setEditEv] = useState<CalendarEvent | null>(null)
  const [confirmDel, setConfirmDel] = useState<CalendarEvent | null>(null)

  const events = useLiveQuery(() => db.events.where('deleted').equals(0).toArray(), []) as CalendarEvent[] | undefined
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const caseMap = useMemo(() => new Map((cases ?? []).map((c) => [c.id, c.name])), [cases])

  const selectedEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => isSameDay(new Date(e.date), visibleDate))
        .sort((a, b) => (a.allDay ? -1 : 1) - (b.allDay ? -1 : 1)),
    [events, visibleDate],
  )

  const listEvents = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.date >= startOfMonth(visibleDate).getTime() && e.date <= endOfMonth(visibleDate).getTime())
        .sort((a, b) => a.date - b.date),
    [events, visibleDate],
  )

  const weekDays = useMemo(() => calendarVisibleDays(visibleDate, 'week'), [visibleDate])

  const monthCells = useMemo(() => calendarVisibleDays(visibleDate, 'month'), [visibleDate])

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events ?? []) {
      const key = format(new Date(e.date), 'yyyy-MM-dd')
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(e)
    }
    return m
  }, [events])

  return (
    <div className="mx-auto max-w-[1560px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex rounded-tag bg-bg-warm p-0.5">
            {(
              [
                ['month', '月视图'],
                ['week', '周视图'],
                ['list', '列表'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => dispatchCalendar({ type: 'set-view', view: k })}
                className={`rounded px-3 py-1 text-sm transition ${
                  view === k ? 'bg-primary text-white' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="btn-ghost btn-sm !px-2"
              onClick={() => dispatchCalendar({ type: 'navigate', direction: -1 })}
              aria-label={view === 'week' ? '上一周' : '上一月'}
              title={view === 'week' ? '上一周' : '上一月'}
            >
              <CaretLeft size={14} />
            </button>
            <span className="min-w-[120px] text-center text-sm font-semibold text-text-main">
              {calendarTitle(visibleDate, view)}
            </span>
            <button
              className="btn-ghost btn-sm !px-2"
              onClick={() => dispatchCalendar({ type: 'navigate', direction: 1 })}
              aria-label={view === 'week' ? '下一周' : '下一月'}
              title={view === 'week' ? '下一周' : '下一月'}
            >
              <CaretRight size={14} />
            </button>
            <button className="btn-ghost btn-sm ml-1" onClick={() => dispatchCalendar({ type: 'today', today: new Date() })}>今天</button>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus size={15} weight="bold" /> 添加日程
        </button>
      </div>

      {/* 图例：与日历上的文字标签同款配色，方便对照 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(TYPE_META).map(([k, v]) => (
          <span
            key={k}
            className="rounded-tag px-2 py-0.5 text-[11px] font-medium"
            style={{ background: v.bg, color: v.text }}
          >
            {v.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* ===== 日历主体 ===== */}
        <div className="card p-4">
          {view === 'month' && (
            <div>
              <div className="mb-2 grid grid-cols-7 text-center text-xs text-text-muted">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthCells.map((d, i) => {
                  const key = format(d, 'yyyy-MM-dd')
                  const dayEvents = eventsByDay.get(key) ?? []
                  const selected = isSameDay(d, visibleDate)
                  const today = isSameDay(d, new Date())
                  const inMonth = isSameMonth(d, visibleDate)
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        dispatchCalendar({ type: 'set-anchor', anchor: d })
                      }}
                      className={`flex min-h-[110px] flex-col items-stretch gap-1 rounded-btn border p-1.5 text-left transition ${
                        selected
                          ? 'border-accent bg-bg-warm'
                          : today
                            ? 'border-primary/40 bg-bg-warm/50'
                            : 'border-transparent hover:bg-bg-warm/50'
                      }`}
                    >
                      <span
                        className={`text-xs leading-none ${
                          today ? 'font-bold text-accent' : inMonth ? 'font-medium text-text-main' : 'text-text-muted/50'
                        }`}
                      >
                        {format(d, 'd')}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {dayEvents.slice(0, 3).map((e) => {
                          const meta = TYPE_META[e.type]
                          return (
                            <span
                              key={e.id}
                              className="block w-full truncate rounded px-1 py-px text-[10px] leading-[1.5] font-medium"
                              style={{ background: meta.bg, color: meta.text }}
                              title={`【${meta.label}】${e.title}`}
                            >
                              {e.title}
                            </span>
                          )
                        })}
                        {dayEvents.length > 3 && (
                          <span className="px-1 text-[10px] leading-tight text-text-muted">
                            +{dayEvents.length - 3} 更多
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((d) => {
                const key = format(d, 'yyyy-MM-dd')
                const dayEvents = eventsByDay.get(key) ?? []
                const selected = isSameDay(d, visibleDate)
                const today = isSameDay(d, new Date())
                return (
                  <div key={key}>
                    <button
                      onClick={() => dispatchCalendar({ type: 'set-anchor', anchor: d })}
                      className={`w-full rounded-btn border p-2 text-center ${
                        selected ? 'border-accent bg-bg-warm' : today ? 'border-primary/40' : 'border-transparent'
                      }`}
                    >
                      <p className="text-xs text-text-muted">{format(d, 'EE', { locale: zhCN })}</p>
                      <p className={`text-sm font-semibold ${today ? 'text-accent' : 'text-text-main'}`}>{format(d, 'd')}</p>
                    </button>
                    <div className="mt-1.5 space-y-1">
                      {dayEvents.map((e) => {
                        const meta = TYPE_META[e.type]
                        return (
                          <div
                            key={e.id}
                            className="truncate rounded-tag px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ background: meta.bg, color: meta.text }}
                            title={`【${meta.label}】${e.title}`}
                          >
                            {e.title}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {view === 'list' && (
            <div className="space-y-1.5">
              {listEvents.map((e) => {
                const meta = TYPE_META[e.type]
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-btn px-3 py-2.5 transition hover:bg-bg-warm">
                    <span className="w-20 shrink-0 text-xs tabular-nums text-text-muted">{fmtDate(e.date)}</span>
                    <span
                      className="shrink-0 rounded-tag px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: meta.bg, color: meta.text }}
                    >
                      {meta.label}
                    </span>
                    <span className="flex-1 truncate text-sm text-text-main">{e.title}</span>
                    {e.caseId && <span className="shrink-0 text-xs text-text-muted">{caseMap.get(e.caseId)}</span>}
                  </div>
                )
              })}
              {listEvents.length === 0 && <p className="py-10 text-center text-sm text-text-muted">本月暂无日程</p>}
            </div>
          )}
        </div>

        {/* ===== 右侧：选中日期事件 ===== */}
        <div className="space-y-4">
          <div className="card-pad">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text-main">
              <CalendarBlank size={15} />
              {format(visibleDate, 'M月d日 EEEE', { locale: zhCN })}
            </h3>
            <div className="space-y-2">
              {selectedEvents.map((e) => {
                const meta = TYPE_META[e.type]
                const d = daysUntil(e.date)
                return (
                  <div key={e.id} className="group rounded-btn border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded-tag px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: meta.bg, color: meta.text }}
                      >
                        {meta.label}
                      </span>
                      {d <= 7 && <span className="text-[11px] font-medium text-danger">{d < 0 ? `已逾期${-d}天` : d === 0 ? '今天' : `还有${d}天`}</span>}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-text-main">{e.title}</p>
                    {e.caseId && (
                      <p className="mt-0.5 text-xs text-text-muted">{caseMap.get(e.caseId)}</p>
                    )}
                    {e.time && !e.allDay && <p className="text-xs text-text-muted">时间：{e.time}</p>}
                    {e.note && <p className="mt-1 text-xs text-text-muted">{e.note}</p>}
                    <div className="mt-2 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        className="flex items-center gap-1 rounded-tag px-2 py-0.5 text-[11px] text-text-muted transition hover:bg-bg-warm hover:text-text-main"
                        onClick={() => setEditEv(e)}
                        title="编辑日程"
                      >
                        <NotePencil size={12} /> 编辑
                      </button>
                      <button
                        className="flex items-center gap-1 rounded-tag px-2 py-0.5 text-[11px] text-text-muted transition hover:bg-bg-warm hover:text-danger"
                        onClick={() => setConfirmDel(e)}
                        title="删除日程"
                      >
                        <Trash size={12} /> 删除
                      </button>
                    </div>
                  </div>
                )
              })}
              {selectedEvents.length === 0 && <p className="py-6 text-center text-sm text-text-muted">当日无安排</p>}
            </div>
            <button className="btn-ghost btn-sm mt-3 w-full" onClick={() => setAddOpen(true)}>
              <Plus size={13} /> 添加当日日程
            </button>
          </div>
        </div>
      </div>

      <AddEventModal open={addOpen} onClose={() => setAddOpen(false)} defaultDate={visibleDate} />
      {editEv && (
        <AddEventModal open onClose={() => setEditEv(null)} defaultDate={new Date(editEv.date)} ev={editEv} />
      )}
      {confirmDel && (
        <ConfirmDialog
          open
          title="删除日程"
          message={`确定删除「${confirmDel.title}」吗？删除后案件详情中对应的关键日期也会一并移除。`}
          confirmText="删除"
          danger
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            db.events.update(confirmDel.id!, { deleted: Date.now(), updatedAt: Date.now() })
            setConfirmDel(null)
          }}
        />
      )}
    </div>
  )
}

function AddEventModal({
  open,
  onClose,
  defaultDate,
  ev,
}: {
  open: boolean
  onClose: () => void
  defaultDate: Date
  ev?: CalendarEvent | null
}) {
  const { navigate } = useApp()
  const cases = useLiveQuery(() => db.cases.where('deleted').equals(0).toArray(), []) as LawCase[] | undefined
  const isEdit = !!ev?.id
  const [title, setTitle] = useState(ev?.title ?? '')
  const [date, setDate] = useState(ev ? fmtDateInput(ev.date) : format(defaultDate, 'yyyy-MM-dd'))
  const [time, setTime] = useState(ev?.time ?? '')
  const [allDay, setAllDay] = useState(ev ? ev.allDay : true)
  const [type, setType] = useState<EventType>(ev?.type ?? 'hearing')
  const [caseId, setCaseId] = useState<number | ''>(ev?.caseId ?? '')
  const [reminder, setReminder] = useState<'none' | 'same-day' | '1d' | '3d' | '7d'>(ev?.reminder ?? 'none')
  const [note, setNote] = useState(ev?.note ?? '')

  const save = async () => {
    if (!title.trim()) return
    const dateTs = new Date(`${date}T${time || '09:00'}`).getTime()
    const base = {
      title: title.trim(),
      date: dateTs,
      time: allDay ? undefined : time || undefined,
      allDay,
      type,
      caseId: caseId || undefined,
      reminder,
      note: note.trim() || undefined,
      updatedAt: Date.now(),
    }
    if (isEdit) {
      await db.events.update(ev.id!, base)
    } else {
      await db.events.add({
        ...base,
        createdAt: Date.now(),
      })
    }
    onClose()
    setTitle('')
    setNote('')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑日程' : '添加日程'}
      width={520}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save} disabled={!title.trim()}>保存</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="事件标题" required>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：张三案开庭" />
          </Field>
        </div>
        <Field label="日期" required>
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="时间">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllDay((v) => !v)}
              className={`rounded-tag px-2.5 py-1 text-xs ${allDay ? 'bg-primary text-white' : 'bg-bg-warm text-text-muted'}`}
            >
              全天
            </button>
            {!allDay && <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </div>
        </Field>
        <Field label="类型" required>
          <Select value={type} onChange={(e) => setType(e.target.value as EventType)}>
            <option value="hearing">开庭</option>
            <option value="meeting">会见</option>
            <option value="evidence-deadline">举证截止</option>
            <option value="appeal-deadline">上诉截止</option>
            <option value="enforcement-deadline">申请执行截止</option>
            <option value="preservation-expiry">保全到期</option>
            <option value="other">其他</option>
          </Select>
        </Field>
        <Field label="关联案件">
          <Select value={caseId} onChange={(e) => setCaseId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">不关联</option>
            {(cases ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="提醒设置">
          <Select value={reminder} onChange={(e) => setReminder(e.target.value as typeof reminder)}>
            <option value="none">不提醒</option>
            <option value="same-day">当天</option>
            <option value="1d">提前1天</option>
            <option value="3d">提前3天</option>
            <option value="7d">提前7天</option>
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="备注">
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
