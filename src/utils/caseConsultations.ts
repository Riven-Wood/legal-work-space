import type { LegalConsultation } from '../types'

export function summarizeCaseConsultations(consultations: LegalConsultation[], caseId: number) {
  const records = consultations.filter((record) => record.caseId === caseId && !record.deleted)
  return {
    count: records.length,
    totalMinutes: records.reduce((sum, record) => sum + record.minutes, 0),
  }
}
