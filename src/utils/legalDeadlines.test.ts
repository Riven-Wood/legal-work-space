import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import { autoCalcEndDate, PRESERVATION_RULE_NOTICE } from '../components/preservation/PreservationCard'
import { calculateAppealDeadline, updateCaseStage } from './legalDeadlines'

describe('案件期限规则', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it.each(['立案', '等待判决'] as const)('切换到“%s”只更新案件阶段，不生成期限日程', async (stage) => {
    const caseId = await db.cases.add({
      name: '期限测试案件',
      caseNo: '',
      cause: '合同纠纷',
      stage: '接案',
      status: 'active',
      clientName: '测试客户',
      filedDate: Date.parse('2026-08-01T09:00:00+08:00'),
      fee: 0,
      risk: 'medium',
      createdAt: Date.parse('2026-08-01T09:00:00+08:00'),
      updatedAt: Date.parse('2026-08-01T09:00:00+08:00'),
    })

    await updateCaseStage(caseId, stage, Date.parse('2026-08-10T09:00:00+08:00'))

    expect((await db.cases.get(caseId))?.stage).toBe(stage)
    expect(await db.events.where('caseId').equals(caseId).count()).toBe(0)
  })

  it('缺少送达日期或文书类型时不计算上诉辅助日期', () => {
    expect(calculateAppealDeadline({ documentType: undefined, servedDate: '2026-08-10' })).toBeUndefined()
    expect(calculateAppealDeadline({ documentType: 'judgment', servedDate: '' })).toBeUndefined()
  })

  it('按用户输入的文书类型和送达日期计算民事上诉辅助日期', () => {
    expect(calculateAppealDeadline({ documentType: 'judgment', servedDate: '2026-08-10' })).toBe('2026-08-25')
    expect(calculateAppealDeadline({ documentType: 'ruling', servedDate: '2026-08-10' })).toBe('2026-08-20')
  })
})

describe('财产保全期限规则', () => {
  it('“其他”措施不生成武断的默认期限', () => {
    expect(autoCalcEndDate(Date.parse('2026-08-10T09:00:00+08:00'), '其他')).toBeUndefined()
  })

  it('向用户显示现行条号和法院文书优先的风险提示', () => {
    expect(PRESERVATION_RULE_NOTICE).toContain('第485条')
    expect(PRESERVATION_RULE_NOTICE).toContain('不直接等同于本案实际期限')
    expect(PRESERVATION_RULE_NOTICE).toContain('法院裁定书、协助执行通知书等文书')
  })
})
