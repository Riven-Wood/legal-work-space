// 应用内更新：查询 GitHub Releases 最新版本 + 下载安装包
// 方案说明：macOS 未签名无法做 Squirrel 自动替换，因此采用「检查 + 一键下载 + 打开安装包」半自动流程。
const https = require('https')
const fs = require('fs')
const path = require('path')

const REPO = 'Riven-Wood/legal-work-space'
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const USER_AGENT = 'legal-work-space-updater'

function requestJson(url, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirectsLeft <= 0) return reject(new Error('重定向次数过多'))
        return resolve(requestJson(res.headers.location, redirectsLeft - 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`请求失败：HTTP ${res.statusCode}`))
      }
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new Error('响应不是合法 JSON'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => req.destroy(new Error('请求超时')))
  })
}

// 语义化版本比较：a > b 返回正数，相等 0，a < b 返回负数。容忍前导 v 与三段以内数字。
function compareSemver(a, b) {
  const pa = String(a).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = String(b).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

// 按当前平台/架构挑选安装包资产
function pickAsset(assets, platform, arch) {
  const list = Array.isArray(assets) ? assets : []
  const match = (pred) => list.find((a) => a && typeof a.name === 'string' && pred(a.name))
  if (platform === 'darwin') {
    // 优先匹配架构（Legal Work Space-1.1.0-arm64.dmg），兜底任意 dmg
    return (
      match((n) => n.endsWith('.dmg') && n.includes(arch)) ||
      match((n) => n.endsWith('.dmg')) ||
      match((n) => n.endsWith('.zip') && n.includes(arch))
    )
  }
  if (platform === 'win32') return match((n) => n.endsWith('.exe'))
  if (platform === 'linux') return match((n) => n.endsWith('.AppImage'))
  return undefined
}

async function checkForUpdate(currentVersion, platform, arch) {
  const release = await requestJson(LATEST_API)
  const latest = String(release.tag_name || '').replace(/^v/i, '')
  if (!latest) return { status: 'error', error: '未获取到版本号' }
  if (compareSemver(latest, currentVersion) <= 0) {
    return { status: 'up-to-date', currentVersion, latestVersion: latest }
  }
  const asset = pickAsset(release.assets, platform, arch)
  return {
    status: 'available',
    currentVersion,
    latestVersion: latest,
    releaseName: release.name || `v${latest}`,
    notes: typeof release.body === 'string' ? release.body : '',
    asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null,
    releaseUrl: release.html_url || `https://github.com/${REPO}/releases/latest`,
  }
}

function downloadFile(url, destPath, onProgress, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        if (redirectsLeft <= 0) return reject(new Error('重定向次数过多'))
        return resolve(downloadFile(res.headers.location, destPath, onProgress, redirectsLeft - 1))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`下载失败：HTTP ${res.statusCode}`))
      }
      const total = Number(res.headers['content-length']) || 0
      let received = 0
      const file = fs.createWriteStream(destPath)
      res.on('data', (chunk) => {
        received += chunk.length
        if (onProgress) onProgress(received, total)
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve(destPath)))
      file.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })
    req.on('error', (err) => {
      fs.unlink(destPath, () => {})
      reject(err)
    })
    req.setTimeout(30000, () => req.destroy(new Error('下载超时')))
  })
}

module.exports = { checkForUpdate, downloadFile, compareSemver, pickAsset }
