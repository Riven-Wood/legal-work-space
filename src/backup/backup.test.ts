import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/database'
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BackupValidationError,
  decodeBackup,
  encodeBackup,
} from './backupCodec'
import { clearApplicationData, exportDatabase, restoreDatabase } from './backupService'

describe('backup codec', () => {
  it('round-trips Blob bytes and MIME type through JSON', async () => {
    const originalBytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
    const encoded = await encodeBackup(
      { docs: [{ id: 1, name: '证据.bin', data: new Blob([originalBytes], { type: 'application/octet-stream' }) }] },
      1_700_000_000_000,
    )

    const decoded = decodeBackup(JSON.parse(JSON.stringify(encoded)))
    const restoredBlob = decoded.tables.docs[0].data

    expect(encoded.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
    expect(restoredBlob).toBeInstanceOf(Blob)
    expect((restoredBlob as Blob).type).toBe('application/octet-stream')
    expect(Array.from(new Uint8Array(await (restoredBlob as Blob).arrayBuffer()))).toEqual(Array.from(originalBytes))
  })

  it('restores safe legacy fields and warns when old JSON already lost Blob content', () => {
    const decoded = decodeBackup({
      exportedAt: 1_700_000_000_000,
      tables: {
        clients: [{ id: 3, name: '旧客户' }],
        docs: [{ id: 8, name: '旧证据.pdf', size: 42, mime: 'application/pdf', data: {} }],
        invoiceFiles: [{ id: 9, name: '旧发票.pdf', size: 21, data: {} }],
      },
    })

    expect(decoded.sourceSchemaVersion).toBe(0)
    expect(decoded.tables.clients).toEqual([{ id: 3, name: '旧客户' }])
    expect(decoded.tables.docs[0]).not.toHaveProperty('data')
    expect(decoded.tables.invoiceFiles[0]).not.toHaveProperty('data')
    expect(decoded.warnings).toEqual([
      { code: 'legacy-blob-lost', table: 'docs', rowIndex: 0, field: 'data' },
      { code: 'legacy-blob-lost', table: 'invoiceFiles', rowIndex: 0, field: 'data' },
    ])
  })

  it('rejects malformed and unsupported backups before database access', () => {
    expect(() =>
      decodeBackup({
        format: BACKUP_FORMAT,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: 1_700_000_000_000,
        tables: { clients: { id: 1 } },
      }),
    ).toThrow(BackupValidationError)

    expect(() =>
      decodeBackup({
        format: BACKUP_FORMAT,
        schemaVersion: BACKUP_SCHEMA_VERSION + 1,
        exportedAt: 1_700_000_000_000,
        tables: {},
      }),
    ).toThrow(/unsupported/i)
  })
})

describe('database backup operations', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    db.close()
    await db.delete()
  })

  it('exports every current Dexie table including legal consultations and invoice files', async () => {
    await db.legalConsultations.add({
      date: 1_700_000_000_000,
      minutes: 30,
      content: '咨询内容',
      paid: false,
      source: 'manual',
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    await db.invoiceFiles.add({
      name: '发票.pdf',
      date: 1_700_000_000_000,
      kind: 'invoice',
      size: 3,
      mime: 'application/pdf',
      data: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })

    const backup = await exportDatabase(db)

    expect(Object.keys(backup.tables).sort()).toEqual(db.tables.map((table) => table.name).sort())
    expect(backup.tables.legalConsultations).toHaveLength(1)
    expect(backup.tables.invoiceFiles).toHaveLength(1)
  })

  it('ignores unknown backup table names instead of resolving arbitrary database properties', async () => {
    const backup = await encodeBackup({
      clients: [{ id: 7, name: '可恢复客户', type: 'person', createdAt: 1, updatedAt: 1 }],
      constructor: [{ id: 99 }],
    })

    const result = await restoreDatabase(db, backup)

    expect(await db.clients.get(7)).toMatchObject({ name: '可恢复客户' })
    expect(result.ignoredTables).toEqual(['constructor'])
  })

  it('rolls back all cleared and inserted tables when any restore write fails', async () => {
    await db.clients.add({ id: 1, name: '原客户', type: 'person', createdAt: 1, updatedAt: 1 })
    await db.cases.add({ id: 1, title: '原案件', clientId: 1, status: 'active', createdAt: 1, updatedAt: 1 } as never)
    const invalidForDexie = await encodeBackup({
      clients: [
        { id: 2, name: '新客户 A', type: 'person', createdAt: 2, updatedAt: 2 },
        { id: 2, name: '新客户 B', type: 'person', createdAt: 2, updatedAt: 2 },
      ],
      cases: [{ id: 2, title: '新案件', clientId: 2, status: 'active', createdAt: 2, updatedAt: 2 }],
    })

    await expect(restoreDatabase(db, invalidForDexie)).rejects.toThrow()

    expect(await db.clients.toArray()).toMatchObject([{ id: 1, name: '原客户' }])
    expect(await db.cases.toArray()).toMatchObject([{ id: 1, title: '原案件' }])
  })

  it('clears both newly added data tables while retaining settings', async () => {
    await db.legalConsultations.add({
      date: 1,
      minutes: 10,
      content: '待清空',
      paid: false,
      source: 'manual',
      createdAt: 1,
      updatedAt: 1,
    })
    await db.invoiceFiles.add({
      name: '待清空.pdf',
      date: 1,
      kind: 'invoice',
      size: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.settings.add({
      lawyerName: '保留的律师',
      firmName: '保留的律所',
      hourlyRate: 800,
      includeRetainerHours: true,
      createdAt: 1,
      updatedAt: 1,
    })

    await clearApplicationData(db)

    expect(await db.legalConsultations.count()).toBe(0)
    expect(await db.invoiceFiles.count()).toBe(0)
    expect(await db.settings.toArray()).toMatchObject([{ lawyerName: '保留的律师' }])
  })
})
