// 预加载脚本：在保持 contextIsolation + sandbox 的前提下，向渲染进程暴露受控的更新能力
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopUpdater', {
  // 检查更新 → { status: 'up-to-date' | 'available' | 'error', ... }
  check: () => ipcRenderer.invoke('update:check'),
  // 下载安装包（结果通过 update:progress / 返回值通知）→ { ok, filePath? , error? }
  download: () => ipcRenderer.invoke('update:download'),
  // 打开已下载的安装包
  openInstaller: (filePath) => ipcRenderer.invoke('update:open-installer', filePath),
  // 在系统浏览器打开发布页（下载失败时的兜底）
  openReleasePage: (url) => ipcRenderer.invoke('update:open-release-page', url),
  // 订阅下载进度 ({ received, total })，返回取消订阅函数
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('update:progress', listener)
    return () => ipcRenderer.removeListener('update:progress', listener)
  },
})
