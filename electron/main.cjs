const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { classifyNavigation } = require('./navigation-policy.cjs')

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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
