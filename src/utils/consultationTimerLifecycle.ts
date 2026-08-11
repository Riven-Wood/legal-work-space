import { pauseTimer, type ConsultationTimerState } from './consultationTimer'
import type { TimerSaveResult } from './consultationTimerPersistence'

export type TimerEndResult =
  | { status: TimerSaveResult; timer: null }
  | { status: 'failed'; error: string; timer: ConsultationTimerState }

export async function finishConsultationTimer(
  timer: ConsultationTimerState,
  stoppedAt: number,
  persist: (timer: ConsultationTimerState, stoppedAt: number) => Promise<TimerSaveResult>,
): Promise<TimerEndResult> {
  const frozen = pauseTimer(timer, stoppedAt)
  try {
    const status = await persist(frozen, stoppedAt)
    return { status, timer: null }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error && error.message ? error.message : '咨询记录保存失败，请稍后重试',
      timer: frozen,
    }
  }
}

export function createTimerStopCoordinator(
  persist: (timer: ConsultationTimerState, stoppedAt: number) => Promise<TimerSaveResult>,
) {
  const pending = new Map<string, Promise<TimerEndResult>>()
  return (timer: ConsultationTimerState, stoppedAt: number): Promise<TimerEndResult> => {
    const existing = pending.get(timer.id)
    if (existing) return existing
    const operation = finishConsultationTimer(timer, stoppedAt, persist)
    pending.set(timer.id, operation)
    operation.finally(() => pending.delete(timer.id))
    return operation
  }
}
