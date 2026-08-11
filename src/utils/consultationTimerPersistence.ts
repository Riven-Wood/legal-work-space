import { db } from '../db/database'
import { buildTimerConsultation, type ConsultationTimerState } from './consultationTimer'

export type TimerSaveResult = 'saved' | 'already-saved' | 'too-short'

export async function saveTimerConsultation(timer: ConsultationTimerState, stoppedAt: number): Promise<TimerSaveResult> {
  const record = buildTimerConsultation(timer, stoppedAt)
  if (!record) return 'too-short'
  return db.transaction('rw', db.legalConsultations, async () => {
    const existing = await db.legalConsultations.filter((item) => item.timerId === timer.id).first()
    if (existing) return 'already-saved'
    await db.legalConsultations.add(record)
    return 'saved'
  })
}
