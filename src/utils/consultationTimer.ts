import type { LegalConsultation } from '../types'
import { parseLocalDateInput } from './consultationDates'

export interface ConsultationTimerState {
  id: string
  running: boolean
  startedAt: number
  caseId?: number
  clientId?: number
  consultant?: string
  description?: string
  accumulated: number
  lastTick: number
  startDate: number
}

export function elapsedTimerSeconds(timer: ConsultationTimerState, now: number): number {
  const currentSegment = timer.running ? Math.max(0, Math.floor((now - timer.lastTick) / 1000)) : 0
  return Math.max(0, timer.accumulated) + currentSegment
}

export function restoreConsultationTimer(raw: string | null): ConsultationTimerState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<ConsultationTimerState>
    if (
      typeof value.id !== 'string' ||
      typeof value.running !== 'boolean' ||
      typeof value.startedAt !== 'number' ||
      typeof value.accumulated !== 'number' ||
      typeof value.lastTick !== 'number' ||
      typeof value.startDate !== 'number'
    ) return null
    return value as ConsultationTimerState
  } catch {
    return null
  }
}

export function pauseTimer(timer: ConsultationTimerState, now: number): ConsultationTimerState {
  if (!timer.running) return timer
  return { ...timer, running: false, accumulated: elapsedTimerSeconds(timer, now), lastTick: now }
}

export function resumeTimer(timer: ConsultationTimerState, now: number): ConsultationTimerState {
  if (timer.running) return timer
  return { ...timer, running: true, lastTick: now }
}

export function buildTimerConsultation(
  timer: ConsultationTimerState,
  stoppedAt: number,
): Omit<LegalConsultation, 'id'> | undefined {
  const elapsed = elapsedTimerSeconds(timer, stoppedAt)
  if (elapsed < 10) return undefined
  return {
    date: timer.startDate,
    start: timer.startedAt,
    end: stoppedAt,
    minutes: Math.max(1, Math.round(elapsed / 60)),
    content: timer.description || '法律咨询',
    consultant: timer.consultant,
    clientId: timer.clientId,
    caseId: timer.caseId,
    paid: false,
    source: 'timer',
    timerId: timer.id,
    createdAt: stoppedAt,
    updatedAt: stoppedAt,
  }
}

export function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  const input = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return parseLocalDateInput(input)!
}
