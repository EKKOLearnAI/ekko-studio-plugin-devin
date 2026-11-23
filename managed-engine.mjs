import { randomUUID } from 'node:crypto'
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Acp } from './acp.mjs'
import { officialDistribution } from './distribution.mjs'
import { acpArgs, childEnv, engineStatus, engineVersion, executableName, externalOverride, findEngine, stableVersion } from './engine.mjs'
import { initialize } from './protocol.mjs'
import { validateModel } from './sdk/harness/contracts.mjs'
import contract from './contracts/plugin.json' with { type: 'json' }
import manifest from './plugin.json' with { type: 'json' }

const releaseName = /^release-[a-zA-Z0-9]+$/
const externalMessage = 'This Devin CLI is managed outside Studio. Use its original installation method to update or remove it.'
const operations = new Map()

async function ownedDirectory(path) {
  let info
  try { info = await lstat(path) } catch (error) { if (error.code === 'ENOENT') return false; throw error }
  if (!info.isDirectory()) throw new Error('The managed Devin CLI directory is invalid.')
  return true
}

async function selection(root) {
  if (!await ownedDirectory(root)) return undefined
  const path = join(root, 'current.json')
  let value
  try {
    if (!(await lstat(path)).isFile()) throw new Error()
    value = validateModel(contract, 'managedEngineSelection', JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw new Error('The managed Devin CLI selection could not be read.')
  }
  if (value.release === undefined) return null
  if (releaseName.test(value.release)) return value.release
  throw new Error('The managed Devin CLI selection is invalid.')
}

async function select(root, value) {
  const temporary = join(root, '.selection-' + randomUUID())
  try {
    const record = validateModel(contract, 'managedEngineSelection', {
      schemaVersion: 1, ...(value ? { release: value } : {}),
    })
    await writeFile(temporary, JSON.stringify(record) + '\n', { mode: 0o600, flag: 'wx' })
    await rename(temporary, join(root, 'current.json'))
  } finally {
    await rm(temporary, { force: true })
  }
}

async function releaseEngine(directory) {
  const executable = join(directory, 'package', 'bin', executableName)
  const real = await realpath(executable).catch(error => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (!real) return null
  const root = await realpath(directory)
  if (real !== join(root, 'package', 'bin', executableName) || !(await lstat(executable)).isFile()) {
    throw new Error('The managed Devin CLI points outside its package.')
  }
  return { executable: real, args: acpArgs, env: childEnv() }
}

async function verifyAcp(engine, directory, signal) {
  const home = await mkdtemp(join(directory, '.verify-'))
  const env = {
    ...engine.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: home, XDG_DATA_HOME: home,
    XDG_CACHE_HOME: home, XDG_STATE_HOME: home, APPDATA: home, LOCALAPPDATA: home,
    TEMP: home, TMPDIR: home, TMP: home,
  }
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(10_000)])
  try {
    const acp = new Acp(engine.executable, engine.args, { cwd: home, env }, ({ id }) => {
      if (id !== undefined) acp.methodNotFound(id)
    })
    try { await initialize(acp, timeout, manifest.version) }
    finally { await acp.close() }
  } finally {
    await rm(home, { recursive: true, force: true, maxRetries: 3 })
  }
}

function newer(latest, version) {
  if (!version) return true
  const before = version.split('.').map(Number)
  const after = latest.split('.').map(Number)
  const index = after.findIndex((part, i) => part !== before[i])
  return index >= 0 && after[index] > before[index]
}

function serialize(root, task) {
  const prior = operations.get(root) || Promise.resolve()
  const current = prior.catch(() => {}).then(task)
  operations.set(root, current)
  return current.finally(() => { if (operations.get(root) === current) operations.delete(root) })
}

function cleanRelease(path) {
  return rm(path, { recursive: true, force: true, maxRetries: 3 })
}

export function managedEngine(dataDir, {
  distribution = officialDistribution(), external = findEngine, override = externalOverride,
  version = engineVersion, verify = verifyAcp,
} = {}) {
  const root = join(dataDir, 'engine')

  async function resolve() {
    if (override()) return { engine: await external(), source: 'external' }
    const selected = await selection(root)
    if (selected) {
      const directory = join(root, selected)
      return { engine: await ownedDirectory(directory) ? await releaseEngine(directory) : null, source: 'managed' }
    }
    if (selected === undefined) {
      const engine = await external()
      if (engine) return { engine, source: 'external' }
    }
    return { engine: null, source: 'managed' }
  }

  async function status(signal) {
    try {
      const { engine, source } = await resolve()
      if (engine && source === 'managed') {
        const actual = await version(engine, signal)
        return actual && stableVersion.test(actual)
          ? { installed: true, version: actual, source }
          : { installed: false, version: '', source, error: 'Could not verify the Studio-managed Devin CLI version.' }
      }
      return await engineStatus(engine, signal, source)
    } catch {
      signal.throwIfAborted()
      return { installed: false, version: '', source: 'error', error: 'Could not read the managed Devin CLI selection.' }
    }
  }

  async function checkUpdate(run) {
    const current = await status(run.signal)
    if (current.source === 'error') throw new Error(current.error)
    if (current.source !== 'managed') {
      return { currentVersion: current.version, latestVersion: current.version, updateAvailable: false, message: externalMessage }
    }
    const latest = await distribution.latest(run.signal)
    return { currentVersion: current.version, latestVersion: latest, updateAvailable: newer(latest, current.version) }
  }

  function upgrade(input, run) {
    return serialize(root, async () => {
      run.signal.throwIfAborted()
      if (typeof input.version !== 'string' || !stableVersion.test(input.version)) throw new Error('An exact stable Devin CLI version is required.')
      if ((await resolve()).source === 'external') throw new Error(externalMessage)
      const current = await status(run.signal)
      if (current.source !== 'managed' || current.version !== input.expectedVersion || !newer(input.version, current.version)) {
        throw new Error('The Devin CLI version changed. Check for updates again.')
      }
      const previous = await selection(root)
      await mkdir(root, { recursive: true, mode: 0o700 })
      await ownedDirectory(root)
      const stage = await mkdtemp(join(root, 'release-'))
      let selected = false
      try {
        run.progress({ message: 'Downloading the official Devin CLI package', percent: 15 })
        await distribution.install(input.version, stage, run.signal)
        run.progress({ message: 'Verifying the Devin CLI version and ACP protocol', percent: 85 })
        const engine = await releaseEngine(stage)
        if (!engine || await version(engine, run.signal) !== input.version) throw new Error('The Devin CLI package version does not match the requested release.')
        await verify(engine, stage, run.signal)
        if (await selection(root) !== previous || (await resolve()).source !== 'managed') {
          throw new Error('The Devin CLI selection changed during installation.')
        }
        run.signal.throwIfAborted()
        await select(root, stage.slice(root.length + 1))
        selected = true
        if (previous) await cleanRelease(join(root, previous)).catch(() => {})
        return { installedVersion: input.version }
      } finally {
        if (!selected) await cleanRelease(stage)
      }
    })
  }

  function remove(run) {
    return serialize(root, async () => {
      run.signal.throwIfAborted()
      if ((await resolve()).source === 'external') throw new Error(externalMessage)
      const release = await selection(root)
      if (!release) return
      await cleanRelease(join(root, release))
      // A null selection keeps incidental PATH entries inactive after removing a managed engine.
      await select(root, null)
    })
  }

  return { resolve, status, checkUpdate, upgrade, remove }
}
