import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { executableName } from '../engine.mjs'
import { managedEngine } from '../managed-engine.mjs'

async function setup(t) {
  const home = await mkdtemp(join(await realpath(tmpdir()), 'devin-management-'))
  t.after(() => rm(home, { recursive: true, force: true, maxRetries: 3 }))
  const dataDir = join(home, 'plugin-data')
  const engineDir = join(dataDir, 'engine')
  const credentials = join(home, 'native-credentials')
  await writeFile(credentials, 'synthetic-native-login')
  const externalBinary = join(home, 'external-cli')
  const config = { external: false, override: false, latest: '3000.13.4', failAcp: false }
  const run = { signal: new AbortController().signal, progress() {} }
  const copies = []
  const manager = managedEngine(dataDir, {
    external: async () => config.external ? { executable: externalBinary, args: [], env: {} } : null,
    override: () => config.override,
    version: ({ executable }) => readFile(executable, 'utf8'),
    verify: async () => { if (config.failAcp) throw new Error('incompatible ACP') },
    distribution: {
      async latest() { return config.latest },
      async install(version, stage, signal) {
        signal.throwIfAborted()
        const bin = join(stage, 'package', 'bin')
        await mkdir(bin, { recursive: true })
        await writeFile(join(bin, executableName), version, { mode: 0o700 })
        copies.push(stage)
      },
    },
  })
  return { manager, run, copies, config, home, engineDir, credentials, externalBinary }
}

test('installs, updates, and removes the selected release while preserving native data and a later external CLI', async t => {
  const { manager, run, copies, config, engineDir, credentials, externalBinary } = await setup(t)
  assert.deepEqual(await manager.status(run.signal), { installed: false, version: '', source: 'managed' })
  assert.deepEqual(await manager.checkUpdate(run), { currentVersion: '', latestVersion: '3000.13.4', updateAvailable: true })
  assert.deepEqual(await manager.upgrade({ version: '3000.13.4', expectedVersion: '' }, run), { installedVersion: '3000.13.4' })
  assert.equal((await manager.resolve()).engine.executable, join(copies[0], 'package', 'bin', executableName))
  await writeFile(externalBinary, 'external-marker')
  config.external = true
  config.latest = '3000.14.30821'
  assert.deepEqual(await manager.checkUpdate(run), { currentVersion: '3000.13.4', latestVersion: '3000.14.30821', updateAvailable: true })
  await manager.upgrade({ version: config.latest, expectedVersion: '3000.13.4' }, run)
  assert.equal((await manager.resolve()).engine.executable, join(copies[1], 'package', 'bin', executableName))
  assert.deepEqual(await manager.status(run.signal), { installed: true, version: config.latest, source: 'managed' })
  assert.equal((await readdir(engineDir)).filter(name => name.startsWith('release-')).length, 1)
  await manager.remove(run)
  assert.deepEqual(await manager.status(run.signal), { installed: false, version: '', source: 'managed' })
  assert.deepEqual(await readdir(engineDir), ['current.json'])
  assert.equal(await readFile(credentials, 'utf8'), 'synthetic-native-login')
  assert.equal(await readFile(externalBinary, 'utf8'), 'external-marker')
  config.override = true
  assert.equal((await manager.resolve()).engine.executable, externalBinary)
})

test('leaves PATH and explicit external installs alone, including an invalid override', async t => {
  const { manager, run, config, externalBinary } = await setup(t)
  await writeFile(externalBinary, 'external-marker')
  config.external = true
  assert.equal((await manager.resolve()).source, 'external')
  assert.equal((await manager.checkUpdate(run)).updateAvailable, false)
  await assert.rejects(manager.upgrade({ version: config.latest, expectedVersion: '' }, run), /managed outside Studio/)
  await assert.rejects(manager.remove(run), /managed outside Studio/)
  assert.equal(await readFile(externalBinary, 'utf8'), 'external-marker')
  config.external = false
  config.override = true
  assert.equal((await manager.status(run.signal)).source, 'not-installed')
  await assert.rejects(manager.upgrade({ version: config.latest, expectedVersion: '' }, run), /managed outside Studio/)
})

test('preserves the active release on ACP failure, stale or aborted updates, and a regressed latest tag', async t => {
  const { manager, run, copies, config, engineDir } = await setup(t)
  await manager.upgrade({ version: config.latest, expectedVersion: '' }, run)
  config.latest = '3000.14.30821'
  config.failAcp = true
  const update = { version: config.latest, expectedVersion: '3000.13.4' }
  await assert.rejects(manager.upgrade(update, run), /incompatible ACP/)
  await assert.rejects(manager.upgrade({ ...update, expectedVersion: '' }, run), /version changed/)
  const controller = new AbortController()
  controller.abort(new Error('cancelled update'))
  await assert.rejects(manager.upgrade(update, { ...run, signal: controller.signal }), /cancelled update/)
  assert.equal((await manager.status(run.signal)).version, '3000.13.4')
  assert.equal((await manager.resolve()).engine.executable, join(copies[0], 'package', 'bin', executableName))
  assert.equal((await readdir(engineDir)).filter(name => name.startsWith('release-')).length, 1)
  config.latest = '3000.12.57'
  assert.equal((await manager.checkUpdate(run)).updateAvailable, false)
})

test('serializes two installers so a stale expected version cannot replace a completed install', async t => {
  const { manager, run, copies, config } = await setup(t)
  const input = { version: config.latest, expectedVersion: '' }
  const results = await Promise.allSettled([manager.upgrade(input, run), manager.upgrade(input, run)])
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected'])
  assert.match(results[1].reason.message, /version changed/)
  assert.equal(copies.length, 1)
})

test('rejects a linked management directory and preserves the target sentinel', { skip: process.platform === 'win32' }, async t => {
  const { manager, run, home, engineDir } = await setup(t)
  const other = join(home, 'elsewhere')
  await mkdir(other)
  const marker = join(other, 'sentinel')
  await writeFile(marker, 'untouched')
  await mkdir(join(home, 'plugin-data'))
  await symlink(other, engineDir, 'dir')
  assert.equal((await manager.status(run.signal)).source, 'error')
  await assert.rejects(manager.remove(run), /directory is invalid/)
  await assert.rejects(manager.upgrade({ version: '3000.13.4', expectedVersion: '' }, run), /directory is invalid/)
  assert.equal(await readFile(marker, 'utf8'), 'untouched')
})
