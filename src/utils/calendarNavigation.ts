import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isSameYear,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export type CalendarView = 'month' | 'week' | 'list'
export interface CalendarState { anchor: Date; view: CalendarView }
export type CalendarAction =
  | { type: 'navigate'; direction: -1 | 1 }
  | { type: 'set-view'; view: CalendarView }
  | { type: 'today'; today: Date }
  | { type: 'set-anchor'; anchor: Date }

export function calendarTransition(state: CalendarState, action: CalendarAction): CalendarState {
  if (action.type === 'navigate') {
    return { ...state, anchor: navigateCalendar(state.anchor, state.view, action.direction) }
  }
  if (action.type === 'set-view') return { ...state, view: action.view }
  if (action.type === 'today') return { ...state, anchor: action.today }
  return { ...state, anchor: action.anchor }
}

export function navigateCalendar(anchor: Date, view: CalendarView, direction: -1 | 1): Date {
  return view === 'week' ? addWeeks(anchor, direction) : addMonths(anchor, direction)
}

export function calendarVisibleDays(anchor: Date, view: CalendarView): Date[] {
  const interval = view === 'week'
    ? { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
    : {
        start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
      }
  return eachDayOfInterval(interval)
}

export function calendarTitle(anchor: Date, view: CalendarView): string {
  if (view !== 'week') return format(anchor, 'yyyy年M月')

  const start = startOfWeek(anchor, { weekStartsOn: 1 })
  const end = endOfWeek(anchor, { weekStartsOn: 1 })
  if (isSameMonth(start, end)) return `${format(start, 'yyyy年M月d日')}—${format(end, 'd日')}`
  if (isSameYear(start, end)) return `${format(start, 'yyyy年M月d日')}—${format(end, 'M月d日')}`
  return `${format(start, 'yyyy年M月d日')}—${format(end, 'yyyy年M月d日')}`
}
