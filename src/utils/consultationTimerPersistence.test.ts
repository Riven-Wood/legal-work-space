import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { saveTimerConsultation } from './consultationTimerPersistence'
import type { ConsultationTimerState } from './consultationTimer'

const stoppedTimer: ConsultationTimerState = {
  id: 'stable-session-id',
  running: false,
  startedAt: 1_000,
  accumulated: 60,
  lastTick: 61_000,
  startDate: 0,
  caseId: 7,
}

afterEach(async () => {
  await db.legalConsultations.clear()
})

describe('timer consultation persistence', () => {
  it('saves a restored timer session only once', async () => {
    expect(await saveTimerConsultation(stoppedTimer, 100_000)).toBe('saved')
    expect(await saveTimerConsultation(stoppedTimer, 200_000)).toBe('already-saved')

    const records = await db.legalConsultations.toArray()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ timerId: 'stable-session-id', end: 100_000, minutes: 1 })
  })

  it('reports a controlled database failure and allows the frozen timer to be retried', async () => {
    const add = vi.spyOn(db.legalConsultations, 'add').mockRejectedValueOnce(new Error('磁盘写入失败'))

    await expect(saveTimerConsultation(stoppedTimer, 100_000)).rejects.toThrow('磁盘写入失败')
    add.mockRestore()

    expect(await saveTimerConsultation(stoppedTimer, 100_000)).toBe('saved')
    expect(await db.legalConsultations.filter((item) => item.timerId === 'stable-session-id').count()).toBe(1)
  })

  it('returns too-short without writing a record', async () => {
    expect(await saveTimerConsultation({ ...stoppedTimer, accumulated: 9 }, 100_000)).toBe('too-short')
    expect(await db.legalConsultations.count()).toBe(0)
  })
})
