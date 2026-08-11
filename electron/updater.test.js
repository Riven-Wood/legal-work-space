import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { compareSemver, pickAsset } = require('./updater.cjs')

describe('compareSemver', () => {
  it('compares numeric segments', () => {
    expect(compareSemver('1.1.0', '1.0.0')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '1.1.0')).toBeLessThan(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0)
  })

  it('tolerates leading v and missing segments', () => {
    expect(compareSemver('v1.2.0', '1.2.0')).toBe(0)
    expect(compareSemver('1.2', '1.2.0')).toBe(0)
    expect(compareSemver('v1.10.0', 'v1.9.0')).toBeGreaterThan(0)
  })
})

describe('pickAsset', () => {
  const assets = [
    { name: 'Legal-Work-Space-1.1.0-arm64.dmg', browser_download_url: 'https://x/dmg' },
    { name: 'Legal-Work-Space-1.1.0-arm64-mac.zip', browser_download_url: 'https://x/zip' },
    { name: 'Legal-Work-Space-Setup-1.1.0.exe', browser_download_url: 'https://x/exe' },
    { name: 'Legal-Work-Space-1.1.0.AppImage', browser_download_url: 'https://x/appimage' },
    { name: 'latest-mac.yml', browser_download_url: 'https://x/yml' },
  ]

  it('picks arm64 dmg on macOS arm64', () => {
    expect(pickAsset(assets, 'darwin', 'arm64').name).toBe('Legal-Work-Space-1.1.0-arm64.dmg')
  })

  it('falls back to any dmg on other mac archs', () => {
    expect(pickAsset(assets, 'darwin', 'x64').name).toBe('Legal-Work-Space-1.1.0-arm64.dmg')
  })

  it('picks exe on Windows', () => {
    expect(pickAsset(assets, 'win32', 'x64').name).toBe('Legal-Work-Space-Setup-1.1.0.exe')
  })

  it('picks AppImage on Linux', () => {
    expect(pickAsset(assets, 'linux', 'x64').name).toBe('Legal-Work-Space-1.1.0.AppImage')
  })

  it('returns undefined when nothing matches', () => {
    expect(pickAsset([], 'darwin', 'arm64')).toBeUndefined()
    expect(pickAsset(assets, 'freebsd', 'x64')).toBeUndefined()
  })
})
