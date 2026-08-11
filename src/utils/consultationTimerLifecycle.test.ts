import { describe, expect, it, vi } from 'vitest'
import { createTimerStopCoordinator, finishConsultationTimer } from './consultationTimerLifecycle'
import type { ConsultationTimerState } from './consultationTimer'

const runningTimer: ConsultationTimerState = {
  id: 'retryable',
  running: true,
  startedAt: 1_000,
  accumulated: 5,
  lastTick: 1_000,
  startDate: new Date(2026, 7, 10).getTime(),
}

describe('finishing a consultation timer', () => {
  it('freezes and retains the timer when persistence fails', async () => {
    const result = await finishConsultationTimer(runningTimer, 21_000, async () => {
      throw new Error('磁盘写入失败')
    })

    expect(result).toEqual({
      status: 'failed',
      error: '磁盘写入失败',
      timer: { ...runningTimer, running: false, accumulated: 25, lastTick: 21_000 },
    })
  })

  it.each(['saved', 'already-saved', 'too-short'] as const)('clears after %s', async (status) => {
    const result = await finishConsultationTimer(runningTimer, 21_000, async () => status)
    expect(result).toEqual({ status, timer: null })
  })

  it('persists the frozen snapshot so waiting time cannot increase the record', async () => {
    const persist = vi.fn(async () => 'saved' as const)
    await finishConsultationTimer(runningTimer, 21_000, persist)
    expect(persist).toHaveBeenCalledWith({ ...runningTimer, running: false, accumulated: 25, lastTick: 21_000 }, 21_000)
  })

  it('deduplicates concurrent finish requests for the same timer id', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const persist = vi.fn(async () => {
      await gate
      return 'saved' as const
    })
    const stop = createTimerStopCoordinator(persist)

    const first = stop(runningTimer, 21_000)
    const second = stop(runningTimer, 22_000)
    expect(second).toBe(first)
    expect(persist).toHaveBeenCalledTimes(1)
    release()
    await expect(first).resolves.toMatchObject({ status: 'saved' })
  })
})
