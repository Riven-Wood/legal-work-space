import { describe, expect, it, vi } from 'vitest'
import { printHtmlDocument } from './browserPrint'

type PrintableWindow = {
  focus: () => void
  print: () => void
  addEventListener: (name: string, handler: () => void) => void
  removeEventListener: (name: string, handler: () => void) => void
}

function fakeDocument(contentWindow?: PrintableWindow) {
  const listeners = new Map<string, () => void>()
  const windowListeners = new Map<string, () => void>()
  const printableWindow = contentWindow ?? {
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: vi.fn((name: string, handler: () => void) => windowListeners.set(name, handler)),
    removeEventListener: vi.fn((name: string, handler: () => void) => {
      if (windowListeners.get(name) === handler) windowListeners.delete(name)
    }),
  }
  const frame = {
    hidden: false,
    style: { position: '', width: '', height: '', border: '' },
    srcdoc: '',
    contentWindow: printableWindow as PrintableWindow | null,
    addEventListener: vi.fn((name: string, handler: () => void) => listeners.set(name, handler)),
    remove: vi.fn(),
  }
  const document = {
    body: { appendChild: vi.fn(() => listeners.get('load')?.()) },
    createElement: vi.fn(() => frame),
  }
  return { document, frame, listeners, windowListeners }
}

describe('printHtmlDocument', () => {
  it('keeps the iframe after print returns and resolves only after afterprint', async () => {
    const { document, frame, windowListeners } = fakeDocument()
    const printing = printHtmlDocument('<!doctype html><title>safe</title>', document as never)

    expect(frame.hidden).toBe(false)
    expect(frame.style).toMatchObject({ position: 'fixed', width: '0px', height: '0px', border: '0px' })
    expect(frame.srcdoc).toContain('<title>safe</title>')
    expect(frame.contentWindow?.print).toHaveBeenCalledOnce()
    expect(frame.remove).not.toHaveBeenCalled()

    windowListeners.get('afterprint')?.()
    await printing
    expect(frame.remove).toHaveBeenCalledOnce()
    expect(frame.contentWindow?.removeEventListener).toHaveBeenCalledOnce()
  })

  it('cleans up and resolves after a finite timeout once printing has started', async () => {
    vi.useFakeTimers()
    const { document, frame } = fakeDocument()
    const printing = printHtmlDocument('<!doctype html>', document as never, { cleanupTimeoutMs: 50 })
    const resolved = vi.fn()
    void printing.then(resolved)

    await vi.advanceTimersByTimeAsync(49)
    expect(resolved).not.toHaveBeenCalled()
    expect(frame.remove).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(50)
    await expect(printing).resolves.toBeUndefined()
    expect(frame.remove).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('cleans up once when afterprint or load fires repeatedly', async () => {
    const { document, frame, listeners, windowListeners } = fakeDocument()
    const printing = printHtmlDocument('<!doctype html>', document as never)

    listeners.get('load')?.()
    windowListeners.get('afterprint')?.()
    windowListeners.get('afterprint')?.()
    await printing

    expect(frame.contentWindow?.print).toHaveBeenCalledOnce()
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('rejects and cleans up when the iframe has no printable window', async () => {
    const { document, frame } = fakeDocument()
    frame.contentWindow = null

    await expect(printHtmlDocument('<!doctype html>', document as never)).rejects.toThrow('无法创建打印视图')
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('rejects and cleans up immediately when print throws', async () => {
    const printError = new Error('printer unavailable')
    const { document, frame } = fakeDocument({
      focus: vi.fn(),
      print: vi.fn(() => { throw printError }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    await expect(printHtmlDocument('<!doctype html>', document as never)).rejects.toThrow('printer unavailable')
    expect(frame.remove).toHaveBeenCalledOnce()
  })
})
