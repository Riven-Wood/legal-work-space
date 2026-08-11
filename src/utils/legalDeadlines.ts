import { db } from '../db/database'
import type { CaseStage } from '../types'

export type AppealDocumentType = 'judgment' | 'ruling'

export function calculateAppealDeadline({
  documentType,
  servedDate,
}: {
  documentType?: AppealDocumentType
  servedDate: string
}): string | undefined {
  if (!documentType || !servedDate) return undefined
  const date = new Date(`${servedDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  date.setDate(date.getDate() + (documentType === 'judgment' ? 15 : 10))
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function updateCaseStage(caseId: number, stage: CaseStage, updatedAt = Date.now()) {
  return db.cases.update(caseId, { stage, updatedAt })
}
