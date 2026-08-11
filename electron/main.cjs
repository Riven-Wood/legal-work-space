const { app, BrowserWindow, shell, ipcMain } = require('electron')
const path = require('path')
const { classifyNavigation } = require('./navigation-policy.cjs')
const { checkForUpdate, downloadFile } = require('./updater.cjs')

const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_URL || 'http://localhost:5173'

const navigationOptions = {
  isDev,
  devUrl: DEV_URL,
  distDir: path.resolve(__dirname, '../dist'),
}

function handleBlockedNavigation(url) {
  if (classifyNavigation(url, navigationOptions) === 'external-web') void shell.openExternal(url)
}

// ---- 应用内更新 ----
// 缓存最近一次检查结果，下载时直接使用其中的资产信息
let lastUpdateInfo = null

function registerUpdateIpc() {
  ipcMain.handle('update:check', async () => {
    try {
      lastUpdateInfo = await checkForUpdate(app.getVersion(), process.platform, process.arch)
      return lastUpdateInfo
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('update:download', async (event) => {
    try {
      const asset = lastUpdateInfo && lastUpdateInfo.status === 'available' ? lastUpdateInfo.asset : null
      if (!asset) return { ok: false, error: '没有可下载的安装包，请先检查更新' }
      const destPath = path.join(app.getPath('downloads'), asset.name)
      await downloadFile(asset.url, destPath, (received, total) => {
        if (!event.sender.isDestroyed()) event.sender.send('update:progress', { received, total })
      })
      return { ok: true, filePath: destPath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('update:open-installer', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath) return { ok: false, error: '路径无效' }
    const err = await shell.openPath(filePath)
    return err ? { ok: false, error: err } : { ok: true }
  })

  ipcMain.handle('update:open-release-page', async (_event, url) => {
    if (typeof url !== 'string' || !/^https:\/\/github\.com\//.test(url)) return { ok: false, error: 'URL 无效' }
    await shell.openExternal(url)
    return { ok: true }
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Legal Work Space',
    backgroundColor: '#f4f3f1',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.once('ready-to-show', () => win.show())

  // 隐藏原生菜单栏（macOS 上保留标准应用菜单，Windows/Linux 隐藏）
  if (process.platform !== 'darwin') {
    win.setMenuBarVisibility(false)
  }

  if (isDev) {
    win.loadURL(DEV_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 新窗口默认拒绝；仅把明确的 HTTP(S) 外部链接交给系统浏览器。
  win.webContents.setWindowOpenHandler(({ url }) => {
    handleBlockedNavigation(url)
    return { action: 'deny' }
  })

  // 防止外部页面替换应用主窗口；允许的 Web 链接仍只在系统浏览器打开。
  win.webContents.on('will-navigate', (event, url) => {
    if (classifyNavigation(url, navigationOptions) === 'internal') return
    event.preventDefault()
    handleBlockedNavigation(url)
  })
}

app.whenReady().then(() => {
  registerUpdateIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
