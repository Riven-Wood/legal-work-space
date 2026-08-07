import Dexie, { type Table } from 'dexie'
import type {
  LawCase,
  Client,
  DocFile,
  DocTemplate,
  CalendarEvent,
  TimeRecord,
  Invoice,
  Retainer,
  RetainerWork,
  RetainerPayment,
  RetainerReport,
  Preservation,
  PreservationRenewal,
  Settings,
  Todo,
  CaseTimeline,
  ContactRecord,
} from '../types'

export class LawyerDB extends Dexie {
  cases!: Table<LawCase, number>
  clients!: Table<Client, number>
  docs!: Table<DocFile, number>
  templates!: Table<DocTemplate, number>
  events!: Table<CalendarEvent, number>
  timeRecords!: Table<TimeRecord, number>
  invoices!: Table<Invoice, number>
  retainers!: Table<Retainer, number>
  retainerWorks!: Table<RetainerWork, number>
  retainerPayments!: Table<RetainerPayment, number>
  retainerReports!: Table<RetainerReport, number>
  preservations!: Table<Preservation, number>
  preservationRenewals!: Table<PreservationRenewal, number>
  settings!: Table<Settings, number>
  todos!: Table<Todo, number>
  timelines!: Table<CaseTimeline, number>
  contactRecords!: Table<ContactRecord, number>

  constructor() {
    super('lawyer-workbench')
    this.version(1).stores({
      cases: '++id, clientId, status, stage, cause, createdAt, updatedAt, deleted',
      clients: '++id, name, type, createdAt, updatedAt, deleted',
      docs: '++id, caseId, clientId, retainerId, type, category, createdAt, updatedAt, deleted',
      templates: '++id, category, createdAt, updatedAt, deleted',
      events: '++id, date, type, caseId, createdAt, updatedAt, deleted',
      timeRecords: '++id, caseId, date, createdAt, updatedAt, deleted',
      invoices: '++id, caseId, clientId, createdAt, updatedAt, deleted',
      retainers: '++id, clientId, status, endDate, createdAt, updatedAt, deleted',
      retainerWorks: '++id, retainerId, date, type, createdAt, updatedAt, deleted',
      retainerPayments: '++id, retainerId, date, createdAt, updatedAt, deleted',
      retainerReports: '++id, retainerId, createdAt, updatedAt, deleted',
      preservations: '++id, caseId, type, endDate, status, createdAt, updatedAt, deleted',
      preservationRenewals: '++id, preservationId, createdAt, updatedAt, deleted',
      settings: '++id, createdAt, updatedAt',
      todos: '++id, caseId, done, createdAt, updatedAt, deleted',
      timelines: '++id, caseId, date, type, createdAt, updatedAt, deleted',
      contactRecords: '++id, clientId, date, createdAt, updatedAt, deleted',
    })
  }
}

export const db = new LawyerDB()

// 自动给所有表创建的新记录补默认 deleted = 0，避免被 where('deleted').equals(0) 漏掉
const TABLE_NAMES = [
  'cases',
  'clients',
  'docs',
  'templates',
  'events',
  'timeRecords',
  'invoices',
  'retainers',
  'retainerWorks',
  'retainerPayments',
  'retainerReports',
  'preservations',
  'preservationRenewals',
  'todos',
  'timelines',
  'contactRecords',
] as const
for (const name of TABLE_NAMES) {
  ;(db as unknown as Record<string, { hook: (event: string, cb: (key: number, obj: Record<string, unknown>) => void) => unknown }>)[
    name
  ].hook('creating', (_key, obj) => {
    if (typeof obj.deleted === 'undefined') obj.deleted = 0
  })
}

// ===== 通用 helper =====
export const now = () => Date.now()

export async function softDelete<T extends { deleted?: number }>(
  table: Table<T, number>,
  id: number,
): Promise<void> {
  await table.update(id, { deleted: now() } as never)
}

export async function liveList<T extends { deleted?: number }>(
  table: Table<T, number>,
): Promise<T[]> {
  return table.where('deleted').equals(0).toArray().catch(() => table.toArray())
}

// 默认设置 —— 仅读取（可安全用于 useLiveQuery）
export async function getSettings(): Promise<Settings | undefined> {
  const all = await db.settings.toArray()
  return all[0]
}

// 初始化默认设置 —— 仅在首次写入（不在 liveQuery 中调用）
export async function ensureSettings(): Promise<Settings> {
  const existing = await getSettings()
  if (existing) return existing
  const def: Settings = {
    createdAt: now(),
    updatedAt: now(),
    lawyerName: '',
    firmName: '',
    hourlyRate: 800,
    includeRetainerHours: true,
    version: '1.0.0',
  }
  await db.settings.add(def)
  return def
}

// 获取所有未删除记录（兼容 deleted 索引缺失情况）
export async function getAll<T>(table: Table<T, number>): Promise<T[]> {
  try {
    return await table.where('deleted').equals(0).toArray()
  } catch {
    return table.toArray()
  }
}
