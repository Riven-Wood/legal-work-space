export function escapePrintText(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const e = escapePrintText

export interface CasePrintData {
  title: string; caseNo: string; cause: string; stage: string; clientName: string; counterparty: string
  court: string; filedDate: string; fee: string; risk: string; hoursSummary: string; exportedAt: string
  timelines: Array<{ date: string; type: string; title: string; note: string }>
  events: Array<{ date: string; title: string; countdown: string }>
  documents: Array<{ name: string; createdAt: string; size: string }>
}

export function buildCasePrintDocument(data: CasePrintData): string {
  const timelines = data.timelines.map((row) => `<tr><td>${e(row.date)}</td><td>${e(row.type)}</td><td>${e(row.title)}</td><td>${e(row.note)}</td></tr>`).join('')
  const events = data.events.map((row) => `<tr><td>${e(row.date)}</td><td>${e(row.title)}</td><td>${e(row.countdown)}</td></tr>`).join('')
  const documents = data.documents.map((row) => `<tr><td>${e(row.name)}</td><td>${e(row.createdAt)}</td><td>${e(row.size)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="UTF-8"><title>${e(data.title)}</title><style>
body{font-family:'PingFang SC','SimSun';font-size:13px;color:#3a3a3a;padding:48px;line-height:1.8}h1{text-align:center;font-size:22px;color:#5b6e7a}h2{color:#5b6e7a;font-size:15px;border-left:4px solid #5b6e7a;padding-left:10px;margin:24px 0 10px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #e5e3de;padding:7px 10px;text-align:left}th{background:#ebe9e4}.kv{display:flex;justify-content:space-between;padding:2px 0}
</style></head><body><h1>${e(data.title)}</h1><p style="text-align:center">案号：${e(data.caseNo)}　案由：${e(data.cause)}　阶段：${e(data.stage)}</p>
<h2>基本信息</h2><div class="kv"><span>客户</span><span>${e(data.clientName)}</span></div><div class="kv"><span>对方当事人</span><span>${e(data.counterparty)}</span></div><div class="kv"><span>受理法院</span><span>${e(data.court)}</span></div><div class="kv"><span>收案日期</span><span>${e(data.filedDate)}</span></div><div class="kv"><span>律师费</span><span>${e(data.fee)}</span></div><div class="kv"><span>风险等级</span><span>${e(data.risk)}</span></div>
<h2>案件时间线</h2><table><tr><th>日期</th><th>类型</th><th>标题</th><th>备注</th></tr>${timelines || '<tr><td colspan="4">无记录</td></tr>'}</table><h2>关键日期</h2><table><tr><th>日期</th><th>事项</th><th>倒计时</th></tr>${events || '<tr><td colspan="3">无记录</td></tr>'}</table><h2>文档清单</h2><table><tr><th>文件名</th><th>上传日期</th><th>大小</th></tr>${documents || '<tr><td colspan="3">无文档</td></tr>'}</table><h2>工时汇总</h2><p>${e(data.hoursSummary)}</p><p style="margin-top:60px;text-align:right">导出日期：${e(data.exportedAt)}</p></body></html>`
}

export interface RetainerReportData {
  clientName: string; period: string; contractNo: string; servicePeriod: string; workCount: number
  totalHours: string; summary: string; endDate: string; receiver: string; generatedAt: string
  typeRows: Array<{ type: string; count: number; hours: string; percentage: string }>
  monthRows: Array<{ month: string; count: number; hours: string }>
  detailRows: Array<{ date: string; type: string; content: string; hours: string }>
}

export function buildRetainerReportDocument(data: RetainerReportData): string {
  const types = data.typeRows.map((row) => `<tr><td>${e(row.type)}</td><td>${e(row.count)}</td><td>${e(row.hours)}</td><td>${e(row.percentage)}</td></tr>`).join('')
  const months = data.monthRows.map((row) => `<tr><td>${e(row.month)}</td><td>${e(row.count)}</td><td>${e(row.hours)}</td></tr>`).join('')
  const details = data.detailRows.map((row) => `<tr><td>${e(row.date)}</td><td>${e(row.type)}</td><td>${e(row.content)}</td><td>${e(row.hours)}</td></tr>`).join('')
  return `<!doctype html><html><head><meta charset="UTF-8"><title>常年法律顾问服务报告</title><style>
body{font-family:'PingFang SC','SimSun';font-size:13px;color:#3a3a3a;line-height:1.8;padding:48px}h1{text-align:center;font-size:22px;color:#4b5563;margin-bottom:4px}.cover{text-align:center;padding:80px 0}.cover h1{font-size:28px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #e5e3de;padding:7px 10px;text-align:left;font-size:12px}th{background:#ebe9e4;font-weight:600}h2{color:#4b5563;font-size:16px;border-left:4px solid #4b5563;padding-left:10px;margin:28px 0 12px}
</style></head><body><div class="cover"><h1>常年法律顾问服务年度报告</h1><p style="font-size:16px;margin-top:12px">${e(data.clientName)}</p><p style="margin-top:8px">报告周期：${e(data.period)}</p><p style="margin-top:40px">${e(data.contractNo)}</p></div>
<h2>第一部分 服务概况</h2><p>服务期限：${e(data.servicePeriod)}</p><p>服务期内工作总次数：${e(data.workCount)} 次，服务总时长：${e(data.totalHours)} 小时</p><p>${e(data.summary)}</p><h2>第二部分 工作内容汇总</h2><table><tr><th>工作类型</th><th>次数</th><th>合计时长（小时）</th><th>占比</th></tr>${types}<tr><td><b>合计</b></td><td><b>${e(data.workCount)}</b></td><td><b>${e(data.totalHours)}</b></td><td><b>100%</b></td></tr></table><h2>第三部分 月度工作分布</h2><table><tr><th>月份</th><th>次数</th><th>时长</th></tr>${months}</table><h2>第四部分 工作明细列表</h2><table><tr><th>日期</th><th>类型</th><th>内容描述</th><th>时长</th></tr>${details || '<tr><td colspan="4">无记录</td></tr>'}</table><h2>第五部分 总结与建议</h2><p style="min-height:120px">（律师填写）</p><h2>第六部分 续约提示</h2><p>合同到期日期：${e(data.endDate)}，建议提前两个月与客户沟通续约事宜。</p><p style="margin-top:60px;text-align:right">${e(data.receiver)}（收）</p><p style="text-align:right">${e(data.generatedAt)}</p></body></html>`
}
