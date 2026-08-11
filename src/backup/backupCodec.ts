export const BACKUP_FORMAT = 'lawyer-workbench-backup'
export const BACKUP_SCHEMA_VERSION = 1
export const MAX_BACKUP_FILE_BYTES = 512 * 1024 * 1024

const BLOB_MARKER = 'lawyer-workbench-blob'
const LEGACY_BLOB_TABLES = new Set(['docs', 'invoiceFiles'])

export type BackupRow = Record<string, unknown>

export interface BackupData {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: number
  tables: Record<string, BackupRow[]>
}

export interface BackupWarning {
  code: 'legacy-blob-lost'
  table: string
  rowIndex: number
  field: string
}

export interface DecodedBackup {
  sourceSchemaVersion: number
  exportedAt: number
  tables: Record<string, BackupRow[]>
  warnings: BackupWarning[]
}

interface SerializedBlob {
  __type: typeof BLOB_MARKER
  mimeType: string
  size: number
  base64: string
}

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupValidationError'
  }
}

export class BackupEncodingError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'BackupEncodingError'
    this.cause = cause
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertTimestamp(value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new BackupValidationError('备份的 exportedAt 必须是有效时间戳')
  }
}

function assertTableRows(tables: Record<string, unknown>): void {
  for (const [tableName, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) {
      throw new BackupValidationError(`备份表“${tableName}”的数据必须是数组`)
    }
    rows.forEach((row, rowIndex) => {
      if (!isRecord(row)) {
        throw new BackupValidationError(`备份表“${tableName}”第 ${rowIndex + 1} 条记录必须是对象`)
      }
    })
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  // 24 KiB 是 3 的倍数，可分块编码后直接拼接，避免构造同等大小的二进制字符串。
  const chunkSize = 24 * 1024
  let result = ''
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))
    let binary = ''
    for (let index = 0; index < chunk.length; index += 1) binary += String.fromCharCode(chunk[index])
    result += btoa(binary)
  }
  return result
}

function base64ToBytes(value: string, expectedSize: number): Uint8Array {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new BackupValidationError('备份中的文件内容不是有效 Base64')
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
  const byteLength = (value.length / 4) * 3 - padding
  if (byteLength !== expectedSize) {
    throw new BackupValidationError('备份中的文件大小与内容不一致')
  }

  const result = new Uint8Array(byteLength)
  const chunkSize = 32 * 1024
  let byteOffset = 0
  try {
    for (let offset = 0; offset < value.length; offset += chunkSize) {
      const binary = atob(value.slice(offset, Math.min(offset + chunkSize, value.length)))
      for (let index = 0; index < binary.length; index += 1) result[byteOffset++] = binary.charCodeAt(index)
    }
  } catch (error) {
    throw new BackupValidationError(`备份中的文件内容无法解码：${error instanceof Error ? error.message : String(error)}`)
  }
  return result
}

async function encodeValue(value: unknown, path: string, ancestors: WeakSet<object>): Promise<unknown> {
  if (value instanceof Blob) {
    try {
      const bytes = new Uint8Array(await value.arrayBuffer())
      return {
        __type: BLOB_MARKER,
        mimeType: value.type,
        size: value.size,
        base64: bytesToBase64(bytes),
      } satisfies SerializedBlob
    } catch (error) {
      throw new BackupEncodingError(`无法读取 ${path} 的文件内容，可能是文件过大或内存不足`, error)
    }
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new BackupEncodingError(`${path} 包含无法写入 JSON 的数值`)
    return value
  }
  if (typeof value === 'undefined') return undefined
  if (typeof value !== 'object') throw new BackupEncodingError(`${path} 包含无法写入 JSON 的数据类型`)
  if (ancestors.has(value)) throw new BackupEncodingError(`${path} 包含循环引用，无法写入 JSON`)

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const encoded: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        encoded.push(await encodeValue(value[index], `${path}[${index}]`, ancestors))
      }
      return encoded
    }

    const entries: [string, unknown][] = []
    for (const [key, child] of Object.entries(value)) {
      const encoded = await encodeValue(child, `${path}.${key}`, ancestors)
      if (typeof encoded !== 'undefined') entries.push([key, encoded])
    }
    return Object.fromEntries(entries)
  } finally {
    ancestors.delete(value)
  }
}

function isSerializedBlob(value: Record<string, unknown>): value is Record<string, unknown> & SerializedBlob {
  return value.__type === BLOB_MARKER
}

function decodeValue(value: unknown, path: string): unknown {
  if (Array.isArray(value)) return value.map((child, index) => decodeValue(child, `${path}[${index}]`))
  if (!isRecord(value)) return value
  if (isSerializedBlob(value)) {
    if (
      typeof value.mimeType !== 'string' ||
      typeof value.size !== 'number' ||
      !Number.isSafeInteger(value.size) ||
      value.size < 0 ||
      typeof value.base64 !== 'string'
    ) {
      throw new BackupValidationError(`${path} 的 Blob 结构不完整`)
    }
    const bytes = base64ToBytes(value.base64, value.size)
    return new Blob([bytes], { type: value.mimeType })
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeValue(child, `${path}.${key}`)]))
}

function decodeCurrentTables(tables: Record<string, unknown>): Record<string, BackupRow[]> {
  const decodedTables = Object.create(null) as Record<string, BackupRow[]>
  for (const [tableName, rows] of Object.entries(tables)) {
    decodedTables[tableName] = (rows as BackupRow[]).map((row, rowIndex) => {
      const decoded = decodeValue(row, `tables.${tableName}[${rowIndex}]`) as BackupRow
      if (
        LEGACY_BLOB_TABLES.has(tableName) &&
        Object.prototype.hasOwnProperty.call(decoded, 'data') &&
        !(decoded.data instanceof Blob)
      ) {
        throw new BackupValidationError(`备份表“${tableName}”第 ${rowIndex + 1} 条记录的 data 不是有效 Blob`)
      }
      return decoded
    })
  }
  return decodedTables
}

function decodeLegacyTables(
  tables: Record<string, unknown>,
): { tables: Record<string, BackupRow[]>; warnings: BackupWarning[] } {
  const decodedTables = Object.create(null) as Record<string, BackupRow[]>
  const warnings: BackupWarning[] = []
  for (const [tableName, rows] of Object.entries(tables)) {
    decodedTables[tableName] = (rows as BackupRow[]).map((row, rowIndex) => {
      const entries = Object.entries(row)
      if (LEGACY_BLOB_TABLES.has(tableName) && Object.prototype.hasOwnProperty.call(row, 'data') && row.data !== null) {
        warnings.push({ code: 'legacy-blob-lost', table: tableName, rowIndex, field: 'data' })
        return Object.fromEntries(entries.filter(([key]) => key !== 'data'))
      }
      return Object.fromEntries(entries)
    })
  }
  return { tables: decodedTables, warnings }
}

export async function encodeBackup(
  tables: Record<string, BackupRow[]>,
  exportedAt = Date.now(),
): Promise<BackupData> {
  assertTimestamp(exportedAt)
  if (!isRecord(tables)) throw new BackupEncodingError('备份表集合必须是对象')

  const encodedTables = Object.create(null) as Record<string, BackupRow[]>
  for (const [tableName, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) throw new BackupEncodingError(`备份表“${tableName}”的数据必须是数组`)
    encodedTables[tableName] = []
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      if (!isRecord(rows[rowIndex])) throw new BackupEncodingError(`备份表“${tableName}”包含无效记录`)
      encodedTables[tableName].push(
        (await encodeValue(rows[rowIndex], `tables.${tableName}[${rowIndex}]`, new WeakSet())) as BackupRow,
      )
    }
  }

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    tables: encodedTables,
  }
}

export function decodeBackup(input: unknown): DecodedBackup {
  if (!isRecord(input)) throw new BackupValidationError('备份顶层必须是对象')
  assertTimestamp(input.exportedAt)
  if (!isRecord(input.tables)) throw new BackupValidationError('备份缺少有效的 tables 对象')
  assertTableRows(input.tables)

  if (typeof input.schemaVersion === 'undefined' && typeof input.format === 'undefined') {
    const legacy = decodeLegacyTables(input.tables)
    return {
      sourceSchemaVersion: 0,
      exportedAt: input.exportedAt,
      tables: legacy.tables,
      warnings: legacy.warnings,
    }
  }

  if (input.format !== BACKUP_FORMAT) throw new BackupValidationError('不是 Legal Work Space 备份文件')
  if (input.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupValidationError(
      `不支持（unsupported）的备份版本：${String(input.schemaVersion)}，当前仅支持 ${BACKUP_SCHEMA_VERSION}`,
    )
  }

  return {
    sourceSchemaVersion: input.schemaVersion,
    exportedAt: input.exportedAt,
    tables: decodeCurrentTables(input.tables),
    warnings: [],
  }
}

export function stringifyBackup(backup: BackupData): string {
  try {
    return JSON.stringify(backup, null, 2)
  } catch (error) {
    throw new BackupEncodingError('无法生成备份 JSON，可能是备份过大或内存不足', error)
  }
}

export function parseBackupJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new BackupValidationError(`备份 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`)
  }
}
