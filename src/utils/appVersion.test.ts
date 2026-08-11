import { describe, expect, it } from 'vitest'
import packageMetadata from '../../package.json'
import { APP_VERSION } from './appVersion'

describe('应用版本来源', () => {
  it('界面版本随包版本变化', () => {
    expect(APP_VERSION).toBe(packageMetadata.version)
  })
})
