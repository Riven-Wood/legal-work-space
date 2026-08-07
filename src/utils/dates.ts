import { format, differenceInCalendarDays, parseISO, isSameDay, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function todayStamp(): number {
  return startOfDay(new Date()).getTime()
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function fmtDate(ts?: number | null, pattern = 'yyyy.MM.dd'): string {
  if (!ts) return '—'
  return format(new Date(ts), pattern, { locale: zhCN })
}

export function fmtDateTime(ts?: number | null): string {
  if (!ts) return '—'
  return format(new Date(ts), 'yyyy.MM.dd HH:mm', { locale: zhCN })
}

export function fmtMoney(n?: number | null): string {
  if (n === null || n === undefined) return '¥0'
  return `¥${Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtHours(minutes: number): string {
  const h = minutes / 60
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`
}

export function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((x) => String(x).padStart(2, '0')).join(':')
}

/** 距今天数：正数=还有N天，0=今天，负数=已过期N天 */
export function daysUntil(ts: number): number {
  return differenceInCalendarDays(startOfDay(new Date(ts)), startOfDay(new Date()))
}

export function isToday(ts: number): boolean {
  return isSameDay(new Date(ts), new Date())
}

export function dayStr(ts: number): string {
  return format(new Date(ts), 'yyyy-MM-dd')
}

export function strToDay(s: string): number {
  return parseISO(s).getTime()
}

export function addDaysStamp(ts: number, days: number): number {
  return addDays(new Date(ts), days).getTime()
}

/** 倒计时标签与样式级别 */
export function countdownLabel(ts: number): { text: string; level: 'overdue' | 'urgent' | 'warning' | 'normal' | 'far' } {
  const d = daysUntil(ts)
  if (d < 0) return { text: `已逾期${Math.abs(d)}天`, level: 'overdue' }
  if (d === 0) return { text: '今天到期', level: 'urgent' }
  if (d <= 3) return { text: `还有${d}天`, level: 'urgent' }
  if (d <= 7) return { text: `还有${d}天`, level: 'warning' }
  return { text: `${d}天后`, level: 'normal' }
}
