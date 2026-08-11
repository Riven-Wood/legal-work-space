const DEFAULT_CLEANUP_TIMEOUT_MS = 60_000

export function printHtmlDocument(
  html: string,
  ownerDocument: Document = document,
  { cleanupTimeoutMs = DEFAULT_CLEANUP_TIMEOUT_MS }: { cleanupTimeoutMs?: number } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = ownerDocument.createElement('iframe')
    Object.assign(frame.style, {
      position: 'fixed',
      width: '0px',
      height: '0px',
      border: '0px',
    })
    frame.srcdoc = html

    let started = false
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (timeoutId !== undefined) clearTimeout(timeoutId)
      frame.contentWindow?.removeEventListener('afterprint', handleAfterPrint)
      frame.remove()
      if (error) reject(error)
      else resolve()
    }
    const handleAfterPrint = () => finish()

    frame.addEventListener('load', () => {
      if (started || settled) return
      started = true
      try {
        if (!frame.contentWindow) throw new Error('无法创建打印视图')
        frame.contentWindow.addEventListener('afterprint', handleAfterPrint)
        frame.contentWindow.focus()
        frame.contentWindow.print()
        if (!settled) timeoutId = setTimeout(() => finish(), cleanupTimeoutMs)
      } catch (error) {
        finish(error instanceof Error ? error : new Error('打印失败'))
      }
    }, { once: true })

    ownerDocument.body.appendChild(frame)
  })
}
