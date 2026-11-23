import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { officialDistribution, platformTag } from '../distribution.mjs'

const tag = platformTag(process.platform, process.arch)
const version = '3000.14.30821'
const repository = { url: 'git+https://github.com/CognitionAI/devin-cli.git' }
const registry = 'https://registry.npmjs.org/devin/'
const packageVersion = version + '-' + tag
const url = registry + '-/devin-' + packageVersion + '.tgz'
const base = { repository, name: 'devin' }
const platform = { ...base, version: packageVersion, os: [process.platform], cpu: [process.arch] }

async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'devin-dist-'))
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }))
  const stage = join(root, 'stage')
  const pack = join(root, 'package')
  await mkdir(join(pack, 'bin'), { recursive: true })
  await mkdir(stage)
  await writeFile(join(pack, 'package.json'), JSON.stringify(platform))
  await writeFile(join(pack, 'distribution'), 'npm')
  await writeFile(join(pack, 'bin', 'sample'), 'native fixture')
  async function archive() {
    execFileSync('tar', ['-czf', join(root, 'artifact.tgz'), 'package'], { cwd: root })
    return readFile(join(root, 'artifact.tgz'))
  }
  return { stage, pack, archive, signal: new AbortController().signal }
}

function fixtureDistribution(bytes, changes = {}) {
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64')
  return officialDistribution(async (input, options) => {
    assert.equal(options.redirect, 'error')
    if (input === registry + 'latest') {
      return Response.json({ ...base, version,
        optionalDependencies: { ['devin-' + tag]: 'npm:devin@' + packageVersion }, ...changes.latest })
    }
    if (input === registry + packageVersion) {
      return Response.json({ ...platform, dist: { tarball: url, integrity, ...changes.dist }, ...changes.platform })
    }
    assert.equal(input, url)
    assert.ok(!changes.noDownload)
    return new Response(bytes)
  })
}

test('resolves all official pairs and rejects an unsupported OS or architecture', () => {
  for (const os of ['darwin', 'linux', 'win32']) for (const arch of ['arm64', 'x64']) assert.equal(platformTag(os, arch), os + '-' + arch)
  assert.throws(() => platformTag('linux', 'ia32'), /no.*package/)
})

test('downloads the pinned platform package, verifies SHA-512 and retains distribution metadata', async t => {
  const { stage, archive, signal } = await setup(t)
  const distribution = fixtureDistribution(await archive())
  assert.equal(await distribution.latest(signal), version)
  await distribution.install(version, stage, signal)
  assert.equal(await readFile(join(stage, 'package', 'bin', 'sample'), 'utf8'), 'native fixture')
  assert.equal(await readFile(join(stage, 'package', 'distribution'), 'utf8'), 'npm')
  assert.deepEqual(await readdir(stage), ['package'])
})

test('rejects bogus npm metadata, URLs and checksums without activating an extracted package', async t => {
  const { stage, archive, signal } = await setup(t)
  const bytes = await archive()
  await assert.rejects(fixtureDistribution(bytes, { latest: { optionalDependencies: {} } }).latest(signal), /no matching/)
  await assert.rejects(fixtureDistribution(bytes, { platform: { cpu: ['unknown'] }, noDownload: true }).install(version, stage, signal), /metadata is invalid/)
  await assert.rejects(fixtureDistribution(bytes, { dist: { tarball: 'https://example.invalid/file.tgz' }, noDownload: true }).install(version, stage, signal), /metadata is invalid/)
  const mismatch = createHash('sha512').update('mismatch').digest('base64')
  await assert.rejects(fixtureDistribution(bytes, { dist: { integrity: 'sha512-' + mismatch } }).install(version, stage, signal), /checksum did not match/)
  assert.deepEqual(await readdir(stage), [])
})

test('rejects archive symlinks even when the archive has a matching digest', { skip: process.platform === 'win32' }, async t => {
  const { stage, pack, archive, signal } = await setup(t)
  await symlink('/tmp', join(pack, 'external'))
  await assert.rejects(fixtureDistribution(await archive()).install(version, stage, signal), /safely extract/)
  assert.deepEqual(await readdir(stage), [])
})
