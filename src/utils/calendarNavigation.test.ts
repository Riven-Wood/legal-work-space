import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import {
  calendarTitle,
  calendarTransition,
  calendarVisibleDays,
  navigateCalendar,
  type CalendarView,
} from './calendarNavigation'

const localDate = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12)
const ymd = (date: Date) => format(date, 'yyyy-MM-dd')

describe('日历可见锚点', () => {
  it('月视图上一页移动一个自然月并保留日语义', () => {
    expect(ymd(navigateCalendar(localDate(2024, 3, 31), 'month', -1))).toBe('2024-02-29')
  })

  it('周视图下一页只移动一个自然周', () => {
    expect(ymd(navigateCalendar(localDate(2024, 3, 27), 'week', 1))).toBe('2024-04-03')
  })

  it.each<CalendarView>(['month', 'week'])('生成的 %s 网格包含锚点且日期不重复', (view) => {
    const anchor = localDate(2024, 3, 31)
    const days = calendarVisibleDays(anchor, view)
    const values = days.map(ymd)

    expect(values).toContain('2024-03-31')
    expect(new Set(values).size).toBe(values.length)
    expect(days.every((date) => date.getHours() === 0)).toBe(true)
  })

  it('跨月周标题显示完整日期范围', () => {
    expect(calendarTitle(localDate(2024, 3, 31), 'week')).toBe('2024年3月25日—31日')
    expect(calendarTitle(localDate(2024, 4, 30), 'week')).toBe('2024年4月29日—5月5日')
    expect(calendarTitle(localDate(2024, 12, 30), 'week')).toBe('2024年12月30日—2025年1月5日')
  })

  it('月与周标题都由同一个锚点推导', () => {
    const anchor = localDate(2025, 1, 2)
    expect(calendarTitle(anchor, 'month')).toBe('2025年1月')
    expect(calendarTitle(anchor, 'week')).toBe('2024年12月30日—2025年1月5日')
  })

  it('切换月周视图时保留当前可见锚点', () => {
    const anchor = localDate(2025, 1, 2)
    const next = calendarTransition({ anchor, view: 'month' }, { type: 'set-view', view: 'week' })

    expect(next.view).toBe('week')
    expect(ymd(next.anchor)).toBe('2025-01-02')
  })

  it('今天操作将可见锚点重置为给定的本地今天', () => {
    const today = localDate(2025, 6, 18)
    const next = calendarTransition(
      { anchor: localDate(2024, 12, 30), view: 'week' },
      { type: 'today', today },
    )

    expect(next.view).toBe('week')
    expect(ymd(next.anchor)).toBe('2025-06-18')
  })
})
