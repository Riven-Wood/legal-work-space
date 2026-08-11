// 桌面端应用内更新的渲染层封装。浏览器环境（无 preload 注入）下所有方法安全降级。
export interface UpdateAsset {
  name: string
  url: string
  size: number
}

export interface UpdateCheckResult {
  status: 'up-to-date' | 'available' | 'error'
  currentVersion?: string
  latestVersion?: string
  releaseName?: string
  notes?: string
  asset?: UpdateAsset | null
  releaseUrl?: string
  error?: string
}

export interface UpdateProgress {
  received: number
  total: number
}

interface DesktopUpdaterApi {
  check: () => Promise<UpdateCheckResult>
  download: () => Promise<{ ok: boolean; filePath?: string; error?: string }>
  openInstaller: (filePath: string) => Promise<{ ok: boolean; error?: string }>
  openReleasePage: (url: string) => Promise<{ ok: boolean; error?: string }>
  onProgress: (callback: (progress: UpdateProgress) => void) => () => void
}

declare global {
  interface Window {
    desktopUpdater?: DesktopUpdaterApi
  }
}

export const isDesktopUpdaterAvailable = (): boolean => typeof window !== 'undefined' && !!window.desktopUpdater

export const getDesktopUpdater = (): DesktopUpdaterApi | null =>
  isDesktopUpdaterAvailable() ? (window.desktopUpdater as DesktopUpdaterApi) : null

export function formatBytes(n: number): string {
  if (!n || n <= 0) return '0 MB'
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
