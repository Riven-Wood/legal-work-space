const path = require('node:path')
const { fileURLToPath } = require('node:url')

function isWebProtocol(protocol) {
  return protocol === 'http:' || protocol === 'https:'
}

function isPathInside(candidatePath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath))
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function classifyNavigation(rawUrl, { isDev, devUrl, distDir }) {
  let destination
  try {
    destination = new URL(rawUrl)
  } catch {
    return 'denied'
  }

  if (isDev && isWebProtocol(destination.protocol)) {
    try {
      const configuredOrigin = new URL(devUrl)
      if (isWebProtocol(configuredOrigin.protocol) && destination.origin === configuredOrigin.origin) {
        return 'internal'
      }
    } catch {
      // An invalid development URL grants no internal navigation.
    }
  }

  if (!isDev && destination.protocol === 'file:') {
    try {
      return isPathInside(fileURLToPath(destination), distDir) ? 'internal' : 'denied'
    } catch {
      return 'denied'
    }
  }

  return isWebProtocol(destination.protocol) ? 'external-web' : 'denied'
}

module.exports = { classifyNavigation }
