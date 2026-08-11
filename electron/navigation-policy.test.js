import path from 'node:path'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { classifyNavigation } = require('./navigation-policy.cjs')
const distDir = path.resolve(process.cwd(), 'dist')

describe('classifyNavigation', () => {
  it('allows only the configured HTTP(S) origin during development', () => {
    const options = { isDev: true, devUrl: 'http://localhost:5173/app', distDir }

    expect(classifyNavigation('http://localhost:5173/cases/1', options)).toBe('internal')
    expect(classifyNavigation('https://localhost:5173/cases/1', options)).toBe('external-web')
    expect(classifyNavigation('http://localhost:5174/cases/1', options)).toBe('external-web')
    expect(classifyNavigation('http://example.test', options)).toBe('external-web')
  })

  it('allows normalized file URLs only inside dist during production', () => {
    const options = { isDev: false, devUrl: 'http://localhost:5173', distDir }
    const inside = new URL('assets/app.js', `file://${distDir}/`).href
    const sibling = new URL('../secrets.txt', `file://${distDir}/`).href
    const encodedEscape = `file://${distDir}/%2e%2e/secrets.txt`
    const encodedSeparator = `file://${distDir}/assets%2F..%2Fsecrets.txt`

    expect(classifyNavigation(inside, options)).toBe('internal')
    expect(classifyNavigation(sibling, options)).toBe('denied')
    expect(classifyNavigation(encodedEscape, options)).toBe('denied')
    expect(classifyNavigation(encodedSeparator, options)).toBe('denied')
    expect(classifyNavigation(`file://${distDir}-backup/index.html`, options)).toBe('denied')
  })

  it('classifies web destinations as external and denies all other inputs', () => {
    const options = { isDev: true, devUrl: 'https://app.example.test', distDir }

    expect(classifyNavigation('https://outside.example.test/path', options)).toBe('external-web')
    expect(classifyNavigation('httpx://outside.example.test', options)).toBe('denied')
    expect(classifyNavigation('javascript:alert(1)', options)).toBe('denied')
    expect(classifyNavigation('data:text/html,hello', options)).toBe('denied')
    expect(classifyNavigation('mailto:user@example.test', options)).toBe('denied')
    expect(classifyNavigation('custom://open', options)).toBe('denied')
    expect(classifyNavigation('not a url', options)).toBe('denied')
  })
})
