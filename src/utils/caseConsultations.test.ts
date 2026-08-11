import { describe, expect, it } from 'vitest'
import { summarizeCaseConsultations } from './caseConsultations'
import type { LegalConsultation } from '../types'

describe('case consultation summary', () => {
  it('uses non-deleted legal consultations for the selected case without double counting legacy records', () => {
    const consultations = [
      { id: 1, caseId: 7, minutes: 30, deleted: 0 },
      { id: 2, caseId: 7, minutes: 45, deleted: 123 },
      { id: 3, caseId: 8, minutes: 60, deleted: 0 },
      { id: 4, caseId: 7, minutes: 15 },
    ] as LegalConsultation[]

    expect(summarizeCaseConsultations(consultations, 7)).toEqual({ count: 2, totalMinutes: 45 })
  })
})
