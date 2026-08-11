import { useCallback, useEffect, useState } from 'react'
import { DownloadSimple, ArrowClockwise, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { Modal } from '../ui/Modal'
import {
  getDesktopUpdater,
  formatBytes,
  type UpdateCheckResult,
  type UpdateProgress,
} from '../../utils/desktopUpdater'

type Phase = 'checking' | 'available' | 'up-to-date' | 'error' | 'downloading' | 'downloaded'

export const MANUAL_UPDATE_CHECK_EVENT = 'manual-update-check'

export function triggerManualUpdateCheck() {
  window.dispatchEvent(new CustomEvent(MANUAL_UPDATE_CHECK_EVENT))
}

/**
 * 应用内更新管理：启动后静默检查一次（仅在发现新版本时弹窗）；
 * 设置页「检查更新」通过 manual-update-check 事件触发，无论结果都弹窗反馈。
 * 浏览器环境下（无桌面 preload）不渲染任何内容。
 */
export function UpdateManager() {
  const updater = getDesktopUpdater()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('checking')
  const [info, setInfo] = useState<UpdateCheckResult | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const runCheck = useCallback(
    async (manual: boolean) => {
      if (!updater) return
      if (manual) {
        setInfo(null)
        setPhase('checking')
        setOpen(true)
      }
      const result = await updater.check()
      if (result.status === 'available') {
        setInfo(result)
        setPhase('available')
        setOpen(true)
      } else if (manual) {
        setInfo(result)
        setPhase(result.status === 'up-to-date' ? 'up-to-date' : 'error')
      }
    },
    [updater],
  )

  // 启动后延迟静默检查；订阅手动检查事件
  useEffect(() => {
    if (!updater) return
    const timer = setTimeout(() => void runCheck(false), 3000)
    const onManual = () => void runCheck(true)
    window.addEventListener(MANUAL_UPDATE_CHECK_EVENT, onManual)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(MANUAL_UPDATE_CHECK_EVENT, onManual)
    }
  }, [updater, runCheck])

  // 下载进度订阅
  useEffect(() => {
    if (!updater) return
    return updater.onProgress(setProgress)
  }, [updater])

  if (!updater) return null

  const startDownload = async () => {
    setDownloadError(null)
    setProgress(null)
    setPhase('downloading')
    const result = await updater.download()
    if (result.ok && result.filePath) {
      setFilePath(result.filePath)
      setPhase('downloaded')
    } else {
      setDownloadError(result.error || '下载失败')
      setPhase('available')
    }
  }

  const percent =
    progress && progress.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : null

  const title =
    phase === 'checking'
      ? '检查更新'
      : phase === 'up-to-date'
        ? '检查更新'
        : phase === 'error'
          ? '检查更新'
          : `发现新版本 v${info?.latestVersion ?? ''}`

  return (
    <Modal
      open={open}
      onClose={() => phase !== 'downloading' && setOpen(false)}
      title={title}
      width={480}
      footer={
        <>
          {phase === 'available' && (
            <>
              <button className="btn-ghost" onClick={() => setOpen(false)}>
                稍后
              </button>
              {info?.asset ? (
                <button className="btn-primary" onClick={startDownload}>
                  <DownloadSimple size={14} /> 立即下载（{formatBytes(info.asset.size)}）
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={() => info?.releaseUrl && updater.openReleasePage(info.releaseUrl)}
                >
                  前往发布页下载
                </button>
              )}
            </>
          )}
          {phase === 'downloaded' && (
            <>
              <button className="btn-ghost" onClick={() => setOpen(false)}>
                关闭
              </button>
              <button className="btn-primary" onClick={() => filePath && updater.openInstaller(filePath)}>
                打开安装包
              </button>
            </>
          )}
          {(phase === 'up-to-date' || phase === 'error') && (
            <button className="btn-primary" onClick={() => setOpen(false)}>
              知道了
            </button>
          )}
        </>
      }
    >
      {phase === 'checking' && (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <ArrowClockwise size={15} className="animate-spin" /> 正在检查新版本…
        </p>
      )}

      {phase === 'available' && info && (
        <div className="space-y-3">
          <p className="text-sm text-text-main">
            当前版本 v{info.currentVersion} → 新版本 v{info.latestVersion}
          </p>
          {info.notes && (
            <div className="max-h-48 overflow-y-auto rounded-btn bg-bg-warm/60 p-3 text-xs leading-relaxed whitespace-pre-wrap text-text-muted">
              {info.notes}
            </div>
          )}
          {downloadError && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <WarningCircle size={14} /> {downloadError}，可重试或前往发布页手动下载
            </p>
          )}
          <p className="text-xs text-text-muted">更新不会删除你的业务数据，数据保存在本机应用数据目录中。</p>
        </div>
      )}

      {phase === 'downloading' && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-bg-warm">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${percent ?? 8}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">
            {percent !== null
              ? `正在下载 ${percent}%（${formatBytes(progress!.received)} / ${formatBytes(progress!.total)}）`
              : `正在下载 ${progress ? formatBytes(progress.received) : ''} …`}
          </p>
        </div>
      )}

      {phase === 'downloaded' && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm text-text-main">
            <CheckCircle size={15} className="text-success" /> 安装包已下载完成
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            点击「打开安装包」后按提示安装即可覆盖旧版本，业务数据不受影响。文件位置：{filePath}
          </p>
        </div>
      )}

      {phase === 'up-to-date' && (
        <p className="flex items-center gap-1.5 text-sm text-text-main">
          <CheckCircle size={15} className="text-success" /> 当前已是最新版本
          {info?.currentVersion ? `（v${info.currentVersion}）` : ''}
        </p>
      )}

      {phase === 'error' && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <WarningCircle size={15} /> 检查更新失败{info?.error ? `：${info.error}` : ''}
          </p>
          <p className="text-xs text-text-muted">请检查网络连接后重试，或稍后在设置页再次检查。</p>
        </div>
      )}
    </Modal>
  )
}
