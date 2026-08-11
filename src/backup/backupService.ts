import type Dexie from 'dexie'
import { decodeBackup, encodeBackup, type BackupData, type BackupRow, type DecodedBackup } from './backupCodec'

export interface RestoreResult extends DecodedBackup {
  ignoredTables: string[]
}

export async function exportDatabase(database: Dexie): Promise<BackupData> {
  const tables = Object.create(null) as Record<string, BackupRow[]>
  // 从 Dexie schema 取表，而非手写名单；新增表会自动进入备份。
  for (const table of database.tables) tables[table.name] = (await table.toArray()) as BackupRow[]
  return encodeBackup(tables)
}

export async function restoreDatabase(database: Dexie, input: unknown): Promise<RestoreResult> {
  // 所有结构校验和 Blob 解码都在事务前完成，避免用无效备份触碰当前数据。
  const decoded = decodeBackup(input)
  const knownTables = new Map(database.tables.map((table) => [table.name, table] as const))
  const ignoredTables = Object.keys(decoded.tables).filter((tableName) => !knownTables.has(tableName))
  const rowsToRestore = Object.entries(decoded.tables).flatMap(([tableName, rows]) => {
    const table = knownTables.get(tableName)
    return table ? [{ table, rows }] : []
  })

  await database.transaction('rw', database.tables, async () => {
    // 恢复的语义是整库快照：旧备份未包含的后续新表也必须清空，不与现有数据混合。
    for (const table of database.tables) await table.clear()
    for (const { table, rows } of rowsToRestore) {
      if (rows.length > 0) await table.bulkAdd(rows)
    }
  })

  return { ...decoded, ignoredTables }
}

export async function clearApplicationData(database: Dexie): Promise<void> {
  const dataTables = database.tables.filter((table) => table.name !== 'settings')
  await database.transaction('rw', dataTables, async () => {
    for (const table of dataTables) await table.clear()
  })
}
