// ===== 全局类型定义 =====

export interface BaseEntity {
  id?: number
  createdAt: number
  updatedAt: number
  deleted?: number // 软删除标记（时间戳，0 表示未删除）
}

// ---- 案件 ----
export type CaseStatus = 'active' | 'closed' | 'paused'
export type RiskLevel = 'high' | 'medium' | 'low'

export const CASE_STAGES = [
  '接案',
  '立案',
  '举证',
  '庭前会议',
  '开庭',
  '等待判决',
  '执行',
  '结案',
] as const
export type CaseStage = (typeof CASE_STAGES)[number]

export interface LawCase extends BaseEntity {
  name: string
  clientId?: number
  clientName?: string // 冗余客户名（含新建客户自动创建场景）
  cause: string // 案由
  counterparty?: string // 对方当事人
  court?: string // 受理法院
  caseNo?: string // 案号
  filedDate?: number // 收案日期
  fee?: number // 律师费金额
  risk?: RiskLevel
  status: CaseStatus
  stage: CaseStage
  notes?: string
  counterpartyIds?: number[] // 对方当事人关联的客户id（用于利益冲突）
  isRetainerLinked?: boolean // 客户是否有常法顾问合同
}

// 案件时间线事件
export type TimelineType =
  | 'filing'
  | 'court-filed'
  | 'evidence'
  | 'hearing'
  | 'judgment'
  | 'appeal'
  | 'enforcement'
  | 'other'

export interface CaseTimeline extends BaseEntity {
  caseId: number
  date: number
  type: TimelineType
  title: string
  note?: string
}

// 关键日期（从日程中派生/手动维护）
export interface KeyDate extends BaseEntity {
  caseId: number
  type: 'evidence' | 'hearing' | 'appeal' | 'enforcement' | 'preservation' | 'other'
  title: string
  date: number
  remindDays?: number
}

// 待办
export interface Todo extends BaseEntity {
  caseId?: number
  text: string
  done: boolean
  dueDate?: number
}

// ---- 客户 ----
export type ClientType = 'person' | 'company'

export interface Client extends BaseEntity {
  name: string
  type: ClientType
  phone?: string
  address?: string
  idNumber?: string // 身份证号或统一信用代码
  notes?: string
}

export interface ContactRecord extends BaseEntity {
  clientId: number
  date: number
  content: string
}

// ---- 文档 ----
export type DocType = 'pleading' | 'evidence' | 'judgment' | 'retainer' | 'other'
export type DocCategory = 'filing' | 'evidence' | 'judgment' | 'retainer' | 'other'

// 案件材料分区
export interface DocFolder extends BaseEntity {
  caseId: number
  name: string
}

export interface DocFile extends BaseEntity {
  name: string
  type: DocType
  category: DocCategory
  caseId?: number
  clientId?: number
  retainerId?: number
  folderId?: number // 所属案件分区
  versionGroup?: string // 版本组标识：同一组为同一文件的多个版本
  version?: number // 版本号（从 1 开始）
  versionNote?: string // 版本说明
  size: number
  mime?: string
  data?: Blob // IndexedDB 存储文件内容
}

// ---- 日程 ----
export type EventType =
  | 'hearing'
  | 'meeting'
  | 'evidence-deadline'
  | 'appeal-deadline'
  | 'enforcement-deadline'
  | 'preservation-expiry'
  | 'other'

export interface CalendarEvent extends BaseEntity {
  title: string
  date: number // 日期（YYYY-MM-DD 字符串存储为时间戳）
  time?: string
  allDay: boolean
  type: EventType
  caseId?: number
  reminder: 'none' | 'same-day' | '1d' | '3d' | '7d'
  note?: string
}

// ---- 计时 ----
export interface TimeRecord extends BaseEntity {
  caseId?: number
  date: number
  start?: number
  end?: number
  minutes: number
  description?: string
  source: 'manual' | 'timer'
}

// 账单
export interface Invoice extends BaseEntity {
  caseId?: number
  clientId?: number
  fromDate: number
  toDate: number
  rate: number
  laborFee: number
  travelFee: number
  courtFee: number
  otherFee: number
  total: number
  note?: string
}

// ---- 常法客户 ----
export type RetainerStatus = 'active' | 'expiring' | 'expired'
export type RetainerServiceType =
  | '法律咨询'
  | '合同审核'
  | '合同起草'
  | '法律意见书'
  | '参与会议'
  | '参与谈判'
  | '出具律师函'
  | '专项培训'
  | '其他'

export interface Retainer extends BaseEntity {
  clientId?: number
  clientName: string
  startDate: number
  endDate: number
  amount: number
  paymentMethod?: string
  services: RetainerServiceType[]
  contractNo?: string
  onsiteRequired?: boolean
  contactName?: string
  contactPhone?: string
  contractFileId?: number
  notes?: string
  status: RetainerStatus
}

export interface RetainerWork extends BaseEntity {
  retainerId: number
  date: number
  type: RetainerServiceType
  content: string
  hours: number
  participants?: string
  refNo?: string
}

export interface RetainerPayment extends BaseEntity {
  retainerId: number
  date: number
  amount: number
  voucherFileId?: number
  note?: string
}

export interface RetainerReport extends BaseEntity {
  retainerId: number
  fromDate: number
  toDate: number
  content: string // JSON 结构
  status: 'draft' | 'sent'
  generatedAt: number
}

// ---- 保全 ----
export type PreservationType =
  | '财产保全'
  | '证据保全'
  | '行为保全'
  | '诉前保全'
  | '诉讼保全'
  | '执行保全'
  | '其他'

export type PreservationMeasure =
  | '冻结银行账户'
  | '查封不动产'
  | '查封动产'
  | '冻结股权'
  | '冻结债权'
  | '扣押'
  | '其他'

export type PreservationStatus = 'active' | 'released' | 'expired-unrenewed' | 'renewed' | 'handled'

export interface Preservation extends BaseEntity {
  caseId: number
  type: PreservationType
  target: string // 被保全标的
  writNo?: string // 裁定书案号
  measure: PreservationMeasure
  court?: string
  startDate: number
  endDate: number
  renewalCount: number
  status: PreservationStatus
  note?: string
}

export interface PreservationRenewal extends BaseEntity {
  preservationId: number
  beforeDate: number
  afterDate: number
  writNo?: string
  note?: string
}

// ---- 法律咨询 ----
export interface LegalConsultation extends BaseEntity {
  date: number // 咨询日期（当天 0 点时间戳）
  start?: number // 计时开始时间戳
  end?: number // 计时结束时间戳
  minutes: number // 时长（分钟）
  content: string // 咨询内容
  consultant?: string // 咨询人/客户姓名（手填，优先展示）
  clientId?: number // 关联客户（可选）
  caseId?: number // 关联案件（可选）
  fee?: number // 收费金额（可选）
  paid: boolean // 是否已收款
  source: 'timer' | 'manual'
  timerId?: string // 计时会话标识，用于跨重启幂等保存
}

// ---- 发票/票据材料（用户自行上传，替代自动生成账单） ----
export type InvoiceKind = 'invoice' | 'receipt' | 'transfer' | 'other'

export interface InvoiceFile extends BaseEntity {
  name: string // 文件名
  date: number // 票据日期
  kind: InvoiceKind // 类型：发票/收据/转账凭证/其他
  caseId?: number // 关联案件（可选）
  clientId?: number // 关联客户（可选）
  amount?: number // 金额（可选）
  note?: string
  size: number
  mime?: string
  data?: Blob // IndexedDB 存储文件内容
}

// ---- 设置 ----
export interface Settings extends BaseEntity {
  lawyerName: string
  firmName: string
  address?: string
  phone?: string
  email?: string
  bankAccount?: string
  hourlyRate: number
  includeRetainerHours: boolean
}
