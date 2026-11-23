import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { access, readFile, rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { promisify } from 'node:util'
import { childEnv, stableVersion } from './engine.mjs'

const exec = promisify(execFile)
const origin = 'https://registry.npmjs.org'
const repository = 'git+https://github.com/CognitionAI/devin-cli.git'
const supportedHosts = new Set(['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64'])
const archiveLimit = 256 * 1024 * 1024

export function platformTag(platform, arch) {
  const tag = platform + '-' + arch
  if (!supportedHosts.has(tag)) throw new Error('Cognition does not publish a managed Devin CLI package for this platform.')
  return tag
}

async function tarCommand(env) {
  const locations = process.platform === 'win32'
    ? [env.SystemRoot, env.SYSTEMROOT, env.WINDIR].filter(dir => dir && isAbsolute(dir))
        .map(dir => join(dir, 'System32', 'tar.exe'))
    : ['/usr/bin/tar', '/bin/tar']
  for (const location of locations) {
    try { await access(location); return location } catch { /* Check the next system location. */ }
  }
  throw new Error('The system tar executable is required to install the managed Devin CLI.')
}

function safeArchivePath(name) {
  if (name === 'package/') return true
  const [root, ...segments] = name.replace(/\/$/, '').split('/')
  return root === 'package' && segments.length > 0 && segments.every(part =>
    /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part) && !part.endsWith('.') &&
    !/^(?:aux|con|nul|prn|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))
}

async function untar(archive, stage, signal) {
  const env = childEnv()
  const tar = await tarCommand(env)
  const options = { cwd: stage, env: { ...env, LC_ALL: 'C' }, signal, timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true }
  try {
    const { stdout: names } = await exec(tar, ['-tf', archive], options)
    const { stdout: types } = await exec(tar, ['-tvf', archive], options)
    const entries = names.replace(/\r?\n$/, '').split(/\r?\n/)
    const modeLines = types.replace(/\r?\n$/, '').split(/\r?\n/)
    if (entries.length !== modeLines.length || new Set(entries.map(name => name.toLowerCase().replace(/\/$/, ''))).size !== entries.length ||
        modeLines.some(line => !/^[-d][rwx-]{9}\s/.test(line)) ||
        entries.some(name => !safeArchivePath(name))) {
      throw new Error('Invalid archive paths or member types.')
    }
    await exec(tar, ['-xf', archive, '--no-same-owner', '--no-same-permissions'], options)
  } catch {
    signal.throwIfAborted()
    throw new Error('Could not safely extract the official Devin CLI package.')
  }
}

function samePackage(info, version) {
  return info?.name === 'devin' && typeof version === 'string' && info.version === version && info.repository?.url === repository
}

export function officialDistribution(fetcher = fetch, platform = process.platform, arch = process.arch) {
  async function metadata(reference, signal) {
    try {
      const res = await fetcher(origin + '/devin/' + reference, {
        redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      })
      if (res.ok) return await res.json()
    } catch {
      signal.throwIfAborted()
    }
    throw new Error('Could not read the official Devin CLI release from npm.')
  }

  async function latest(signal) {
    const tag = platformTag(platform, arch)
    const info = await metadata('latest', signal)
    if (!samePackage(info, info?.version) || !stableVersion.test(info.version) ||
        info.optionalDependencies?.['devin-' + tag] !== 'npm:devin@' + info.version + '-' + tag) {
      throw new Error('The latest official Devin CLI release has no matching platform package.')
    }
    return info.version
  }

  async function install(version, stage, signal) {
    if (typeof version !== 'string' || !stableVersion.test(version)) throw new Error('An exact stable Devin CLI version is required.')
    const packageVersion = version + '-' + platformTag(platform, arch)
    const info = await metadata(packageVersion, signal)
    const url = origin + '/devin/-/devin-' + packageVersion + '.tgz'
    const integrity = info?.dist?.integrity
    const digest = typeof integrity === 'string' && integrity.match(/^sha512-([A-Za-z0-9+/]{86}==)$/)?.[1]
    if (!samePackage(info, packageVersion) || info.os?.length !== 1 || info.os[0] !== platform ||
        info.cpu?.length !== 1 || info.cpu[0] !== arch || info.dist?.tarball !== url || !digest) {
      throw new Error('The Devin CLI platform package metadata is invalid.')
    }
    const archive = join(stage, '.download.tgz')
    try {
      const response = await fetcher(url, { redirect: 'error', signal })
      if (!response.ok || !response.body) throw new Error('Could not download the official Devin CLI package.')
      const hash = createHash('sha512')
      let bytes = 0
      await pipeline(Readable.fromWeb(response.body), new Transform({
        transform(chunk, _, callback) {
          bytes += chunk.length
          if (bytes > archiveLimit) callback(new Error('The Devin CLI package exceeds the download size limit.'))
          else { hash.update(chunk); callback(null, chunk) }
        },
      }), createWriteStream(archive, { mode: 0o600, flags: 'wx' }), { signal })
      if (hash.digest('base64') !== digest) throw new Error('The official Devin CLI package checksum did not match.')
      await untar(archive, stage, signal)
      const packageJson = JSON.parse(await readFile(join(stage, 'package', 'package.json'), 'utf8'))
      if (!samePackage(packageJson, packageVersion) || (await readFile(join(stage, 'package', 'distribution'), 'utf8')).trim() !== 'npm') {
        throw new Error('The extracted Devin CLI package did not identify itself as the official npm distribution.')
      }
    } finally {
      await rm(archive, { force: true })
    }
  }

  return { latest, install }
}
