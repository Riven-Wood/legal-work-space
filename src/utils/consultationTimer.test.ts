import { describe, expect, it } from 'vitest'
import {
  buildTimerConsultation,
  elapsedTimerSeconds,
  pauseTimer,
  resumeTimer,
  restoreConsultationTimer,
  type ConsultationTimerState,
} from './consultationTimer'

const runningTimer: ConsultationTimerState = {
  id: 'timer-1',
  running: true,
  startedAt: 1_000,
  accumulated: 0,
  lastTick: 1_000,
  startDate: 0,
  caseId: 7,
  clientId: 9,
  consultant: '张三',
  description: '合同咨询',
}

describe('consultation timer state', () => {
  it('includes the current segment when a running timer stops', () => {
    expect(elapsedTimerSeconds(runningTimer, 62_000)).toBe(61)
  })

  it('does not include time spent waiting after pause', () => {
    const paused = pauseTimer(runningTimer, 31_000)
    expect(elapsedTimerSeconds(paused, 91_000)).toBe(30)
  })

  it('continues from accumulated time after resume', () => {
    const paused = pauseTimer(runningTimer, 31_000)
    const resumed = resumeTimer(paused, 91_000)
    expect(elapsedTimerSeconds(resumed, 121_000)).toBe(60)
  })

  it('clamps a restored timer whose clock moved backwards', () => {
    expect(elapsedTimerSeconds({ ...runningTimer, accumulated: 12, lastTick: 20_000 }, 10_000)).toBe(12)
  })

  it('restores a persisted running timer for a later stop', () => {
    const restored = restoreConsultationTimer(JSON.stringify({ ...runningTimer, lastTick: 10_000 }))
    expect(restored && elapsedTimerSeconds(restored, 40_000)).toBe(30)
  })

  it('rejects malformed persisted timer state', () => {
    expect(restoreConsultationTimer('{"running":true}')).toBeNull()
  })
})

describe('timer consultation record', () => {
  it.each([
    [29, 1],
    [30, 1],
    [89, 1],
    [90, 2],
  ])('rounds %i seconds to %i minutes consistently', (seconds, minutes) => {
    const timer = { ...runningTimer, accumulated: seconds, running: false }
    expect(buildTimerConsultation(timer, 200_000)?.minutes).toBe(minutes)
  })

  it('does not save a timer shorter than ten seconds', () => {
    expect(buildTimerConsultation({ ...runningTimer, accumulated: 9, running: false }, 200_000)).toBeUndefined()
  })

  it('keeps stable timer metadata and the actual stop time', () => {
    const record = buildTimerConsultation({ ...runningTimer, accumulated: 90, running: false }, 200_000)
    expect(record).toMatchObject({
      date: 0,
      start: 1_000,
      end: 200_000,
      minutes: 2,
      content: '合同咨询',
      consultant: '张三',
      caseId: 7,
      clientId: 9,
      source: 'timer',
      paid: false,
      timerId: 'timer-1',
    })
  })
})
