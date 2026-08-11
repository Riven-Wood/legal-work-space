import { describe, expect, it } from 'vitest'
import { consultationDateRange, parseLocalDateInput, parseLocalDateTimeInput } from './consultationDates'
import { startOfLocalDay } from './consultationTimer'

describe('consultation local calendar dates', () => {
  it('parses a date input as local midnight rather than UTC midnight', () => {
    const stamp = parseLocalDateInput('2026-08-10')
    expect(stamp).toBe(new Date(2026, 7, 10).getTime())
    expect(new Date(stamp!).getHours()).toBe(0)
  })

  it('includes local midnight on from and the whole local to day', () => {
    const range = consultationDateRange('2026-08-10', '2026-08-10')
    expect(range).toEqual({
      fromInclusive: new Date(2026, 7, 10).getTime(),
      toExclusive: new Date(2026, 7, 11).getTime(),
    })
    expect(new Date(2026, 7, 10, 23, 59, 59, 999).getTime()).toBeLessThan(range.toExclusive!)
  })

  it('uses the same local day for manual entries and timer entries', () => {
    const manualDay = parseLocalDateInput('2026-08-10')
    const manualStart = parseLocalDateTimeInput('2026-08-10', '21:30')
    expect(manualDay).toBe(startOfLocalDay(manualStart!))
  })

  it.each(['', '2026-02-30', 'not-a-date'])('rejects empty or invalid input %j clearly', (input) => {
    expect(parseLocalDateInput(input)).toBeUndefined()
  })
})
