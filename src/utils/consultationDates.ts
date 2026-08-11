export interface ConsultationDateRange {
  fromInclusive?: number
  toExclusive?: number
}

/** Parse an HTML date input as a local calendar day, never as UTC. */
export function parseLocalDateInput(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined
  return date.getTime()
}

export function parseLocalDateTimeInput(dateValue: string, timeValue: string): number | undefined {
  const day = parseLocalDateInput(dateValue)
  const match = /^(\d{2}):(\d{2})$/.exec(timeValue)
  if (day === undefined || !match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  const date = new Date(day)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

/** The upper bound is the next local midnight, so DST-length days remain correct. */
export function consultationDateRange(from: string, to: string): ConsultationDateRange {
  const fromInclusive = parseLocalDateInput(from)
  const toDay = parseLocalDateInput(to)
  if (toDay === undefined) return { fromInclusive }
  const next = new Date(toDay)
  next.setDate(next.getDate() + 1)
  return { fromInclusive, toExclusive: next.getTime() }
}
