import { describe, expect, it } from 'vitest'
import { buildCasePrintDocument, buildRetainerReportDocument, escapePrintText } from './printDocuments'

describe('escapePrintText', () => {
  it('encodes every HTML-significant character in user text', () => {
    expect(escapePrintText(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
  })
})

describe('print document builders', () => {
  const attacks = ['</style><script>alert(1)</script>', '<img src=x onerror=alert(1)>', `&<>"'`]

  it.each(attacks)('keeps malicious case data as inert text: %s', (attack) => {
    const html = buildCasePrintDocument({
      title: attack,
      caseNo: attack,
      cause: attack,
      stage: attack,
      clientName: attack,
      counterparty: attack,
      court: attack,
      filedDate: '2026-08-10',
      fee: attack,
      risk: attack,
      timelines: [{ date: '2026-08-10', type: attack, title: attack, note: attack }],
      events: [{ date: '2026-08-10', title: attack, countdown: attack }],
      documents: [{ name: attack, createdAt: '2026-08-10', size: attack }],
      hoursSummary: attack,
      exportedAt: '2026-08-10 12:00',
    })

    expect(html).not.toContain(attack)
    expect(html).not.toMatch(/<script|<img[^>]+onerror/i)
    expect(html).toContain(escapePrintText(attack))
  })

  it.each(attacks)('keeps malicious retainer report data as inert text: %s', (attack) => {
    const html = buildRetainerReportDocument({
      clientName: attack,
      period: '2026-01-01 - 2026-12-31',
      contractNo: attack,
      servicePeriod: '2026-01-01 - 2026-12-31',
      workCount: 1,
      totalHours: '1',
      summary: attack,
      typeRows: [{ type: attack, count: 1, hours: '1', percentage: '100.0%' }],
      monthRows: [{ month: attack, count: 1, hours: '1h' }],
      detailRows: [{ date: '2026-08-10', type: attack, content: attack, hours: '1h' }],
      endDate: '2026-12-31',
      receiver: attack,
      generatedAt: '2026-08-10 12:00',
    })

    expect(html).not.toContain(attack)
    expect(html).not.toMatch(/<script|<img[^>]+onerror/i)
    expect(html).toContain(escapePrintText(attack))
  })
})
