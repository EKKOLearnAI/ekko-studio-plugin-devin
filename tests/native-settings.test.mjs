import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { nativeConfigRoot, nativeSettings } from '../native-settings.mjs'

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'devin-native-settings-test-'))
  t.after(() => rm(parent, { force: true, recursive: true }))
  const root = join(parent, 'xdg', 'devin')
  return { root, parent, store: nativeSettings(root) }
}

test('native user roots and unstable environment paths', () => {
  assert.equal(nativeConfigRoot({ HOME: '/home/devin', XDG_CONFIG_HOME: '/alternate path' }, 'darwin'), '/alternate path/devin')
  assert.equal(nativeConfigRoot({ HOME: '/home/devin' }, 'linux'), '/home/devin/.config/devin')
  assert.equal(nativeConfigRoot({ AppData: 'C:\\Users\\Devin\\AppData\\Roaming' }, 'win32'), 'C:\\Users\\Devin\\AppData\\Roaming\\devin')
  assert.throws(() => nativeConfigRoot({ HOME: '/home/devin', XDG_CONFIG_HOME: 'relative' }, 'darwin'), /absolute/)
  assert.throws(() => nativeConfigRoot({ HOME: '/home/devin', XDG_CONFIG_HOME: '' }, 'linux'), /absolute/)
  assert.throws(() => nativeConfigRoot({}, 'win32'), /APPDATA/)
  assert.throws(() => nativeConfigRoot({ APPDATA: '\\devin-data' }, 'win32'), /APPDATA/)
})

test('Skill CRUD uses only direct SKILL.md, rejects traversal and protects sibling data', async t => {
  const { root, parent, store } = await fixture(t)
  const path = join(root, 'skills')
  assert.deepEqual(await store['list-skills'](), { path, names: [], summaries: [] })
  await assert.rejects(readdir(join(parent, 'xdg')), { code: 'ENOENT' })
  const name = 'studio-skill'
  const content = '---\ndescription: 测试\n---\n# Instructions\n'
  assert.deepEqual(await store['get-skill']({ name }), { content: '', revision: '', description: '', bodyOffset: 0 })
  await store['save-skill']({ name, content, revision: '' })
  assert.deepEqual((await store['list-skills']()).names, [name])
  const document = await store['get-skill']({ name })
  assert.equal(document.content, content)
  assert.equal(document.description, '测试')
  assert.equal(content.slice(document.bodyOffset), '# Instructions\n')
  assert.deepEqual((await store['list-skills']()).summaries, [{ name, description: '测试' }])
  await writeFile(join(path, name, 'reference.md'), 'Keep me')
  await store['save-skill']({ name, revision: document.revision, content: '# Edited\n' })
  await assert.rejects(store['remove-skill']({ name, revision: document.revision }), /changed/)
  const updated = await store['get-skill']({ name })
  await store['remove-skill']({ name, revision: updated.revision })
  assert.deepEqual((await store['list-skills']()).names, [])
  assert.equal(await readFile(join(path, name, 'reference.md'), 'utf8'), 'Keep me')
  await assert.rejects(store['get-skill']({ name: '../project' }), /folder name/)
  await assert.rejects(store['get-skill']({ name: 'LPT1' }), /folder name/)
})

test('configuration avoids linked roots and files', { skip: process.platform === 'win32' }, async t => {
  const { root, parent, store } = await fixture(t)
  const outside = join(parent, 'elsewhere')
  await mkdir(outside)
  await mkdir(join(parent, 'xdg'))
  await symlink(outside, root)
  await assert.rejects(store['get-settings'](), /Symbolic links/)
  await assert.rejects(store['save-skill']({ name: 'link', content: '# Test', revision: '' }), /Symbolic links/)
  await rm(root)
  await mkdir(root)
  await writeFile(join(outside, 'config.json'), '{"theme_mode":"dark"}')
  await symlink(join(outside, 'config.json'), join(root, 'config.json'))
  await assert.rejects(store['get-settings'](), /Symbolic links/)
  assert.equal(await readFile(join(outside, 'config.json'), 'utf8'), '{"theme_mode":"dark"}')
})

test('native MCP CRUD, masking, toggling, and compatibility protect other user entries and fields', async t => {
  const { root, store } = await fixture(t)
  await mkdir(root, { recursive: true })
  const filename = join(root, 'mcp_config.json')
  const name = 'remote'
  const original = '{\n  // preserve outer docs\n  "mcpServers": {\n    "existing": {"command":"node","args":["safe.mjs"]}\n  },\n  "future": 42\n}\n'
  await writeFile(filename, original)
  const entry = {
    url: 'https://example.invalid/mcp?key=secret-url', headers: { Authorization: 'Bearer private' },
    oauthClientSecret: 'secret-oauth', transport: 'http', disabledTools: ['blocked'], future: true,
  }
  const { revision } = await store['list-mcp']()
  await store['save-mcp']({ name, revision, content: JSON.stringify(entry), create: true })
  const summary = (await store['list-mcp']()).servers.find(item => item.name === name)
  assert.deepEqual(summary, { name, enabled: true, transport: 'http', target: 'https://example.invalid' })
  assert.doesNotMatch(JSON.stringify(summary), /mcp\?|secret-url|Bearer private/)
  let current = await store['get-mcp']({ name })
  assert.doesNotMatch(current.content, /secret-url|Bearer private|secret-oauth/)
  assert.match(current.content, /••••••••/)
  const content = JSON.stringify({ ...JSON.parse(current.content), transport: 'sse' })
  await assert.rejects(store['save-mcp']({ name, ...current, create: true }), /changed/)
  await store['save-mcp']({ name, ...current, content, create: false })
  current = await store['get-mcp']({ name })
  await store['set-mcp-enabled']({ name, revision: current.revision, enabled: false })
  assert.equal((await store['list-mcp']()).servers.find(value => value.name === name).enabled, false)
  let raw = await readFile(filename, 'utf8')
  assert.match(raw, /secret-url/)
  assert.match(raw, /Bearer private/)
  assert.match(raw, /secret-oauth/)
  assert.match(raw, /"future": true/)
  assert.match(raw, /preserve outer docs/)
  current = await store['get-mcp']({ name })
  await store['set-mcp-enabled']({ name, revision: current.revision, enabled: true })
  const listing = await store['list-mcp']()
  assert.equal(listing.servers.find(value => value.name === name).enabled, true)
  await assert.rejects(store['save-mcp']({
    name: 'bad', revision: listing.revision, content: '{"url":"https://example.invalid","headers":{"Authorization":"••••••••"}}', create: true,
  }), /original field/)
  await assert.rejects(store['save-mcp']({ name: 'bad', revision: listing.revision, content: '{"command":"node","args":[5]}', create: true }), /array of strings/)
  await assert.rejects(store['save-mcp']({ name: 'bad', revision: listing.revision, content: '{"constructor":{},"command":"node"}', create: true }), /reserved/)
  await store['remove-mcp']({ name, revision: listing.revision })
  assert.deepEqual((await store['list-mcp']()).servers, [{ name: 'existing', enabled: true, transport: 'stdio', target: 'node' }])
  raw = await readFile(filename, 'utf8')
  assert.match(raw, /"future": 42/)
  assert.doesNotMatch(raw, /Bearer private/)
  await writeFile(join(root, 'config.json'), '{"mcpServers":{"old":{"command":"node"}}}')
  await assert.rejects(store['list-mcp'](), /Legacy inline/)
  assert.equal(await readFile(filename, 'utf8'), raw)
})

test('config patches only documented fields and retains JSONC comments, unknown settings and secrets', async t => {
  const { root, parent, store } = await fixture(t)
  await mkdir(root, { recursive: true })
  const path = join(root, 'config.json')
  const project = join(parent, 'project')
  await mkdir(join(project, '.devin'), { recursive: true })
  const projectConfig = join(project, '.devin', 'config.local.json')
  await writeFile(projectConfig, '{"read_config_from":{"agents_standard":true}}')
  await writeFile(path, '\uFEFF{\n  // keep this comment\n  "agent": {"model":"swe-1-6-fast","subagent_model":"keep"},\n  "proxy": {"url":"http://secret:private@example.invalid"},\n  "theme_mode":"dark",\n  "read_config_from":{"codex":true,"futureSource":true}\n}\n')
  const settings = await store['get-settings']()
  assert.deepEqual(JSON.parse(settings.content), { read_config_from: { codex: true } })
  const { revision } = settings
  assert.throws(() => store['save-settings']({ revision, content: '{"proxy":{}}' }), /supported read_config_from/)
  assert.throws(() => store['save-settings']({ revision, content: '{"permission_mode":"bogus"}' }), /supported read_config_from/)
  await store['save-settings']({ revision, content: '{"read_config_from":{"agents_standard":false,"codex":null}}' })
  assert.deepEqual(JSON.parse((await store['get-settings']()).content), {
    read_config_from: { agents_standard: false },
  })
  const raw = await readFile(path, 'utf8')
  assert.ok(raw.startsWith('\uFEFF'))
  assert.match(raw, /keep this comment/)
  assert.match(raw, /subagent_model/)
  assert.match(raw, /futureSource/)
  assert.match(raw, /secret:private/)
  assert.match(raw, /theme_mode/)
  assert.equal(await readFile(projectConfig, 'utf8'), '{"read_config_from":{"agents_standard":true}}')
})

test('stale parallel settings and aborted native changes leave the current revision intact', async t => {
  const { root, store } = await fixture(t)
  assert.equal((await store['get-settings']()).revision, '')
  await assert.rejects(store['save-settings'](
    { revision: '', content: '{"read_config_from":{"claude":true}}' }, AbortSignal.abort()), { name: 'AbortError' })
  const results = await Promise.allSettled([
    store['save-settings']({ revision: '', content: '{"read_config_from":{"claude":false}}' }),
    store['save-settings']({ revision: '', content: '{"read_config_from":{"claude":true}}' }),
  ])
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'rejected'])
  assert.match(results[1].reason.message, /changed/)
  assert.deepEqual(await readdir(root), ['config.json'])
  assert.deepEqual(JSON.parse((await store['get-settings']()).content), { read_config_from: { claude: false } })
  await writeFile(join(root, 'config.json'), '{"theme_mode":"dark","theme_mode":"light"}')
  await assert.rejects(store['get-settings'](), /Duplicate/)
})

test('removing the only JSONC property preserves trailing comments and a valid empty object', async t => {
  const { root, store } = await fixture(t)
  await mkdir(root, { recursive: true })
  const path = join(root, 'config.json')
  await writeFile(path, '{"read_config_from":{\n  // keep next to the old default\n  "claude": false,\n}}\n')
  let settings = await store['get-settings']()
  await store['save-settings']({ revision: settings.revision, content: '{"read_config_from":{"claude":null}}' })
  settings = await store['get-settings']()
  assert.deepEqual(JSON.parse(settings.content), {})
  assert.match(await readFile(path, 'utf8'), /keep next to the old default/)
})

test('Skill structured editing preserves YAML comments, custom keys and the raw editing fallback', async t => {
  const { store } = await fixture(t)
  const name = 'structured'
  const original = '---\r\n# retain this comment\r\nname: structured\r\ndescription: |-\r\n  Line one\r\n  Line two\r\ntriggers: [user]\r\n---\r\n# Original\r\n'
  await store['save-skill']({ name, revision: '', content: original })
  const document = await store['get-skill']({ name })
  assert.equal(document.description, 'Line one\nLine two')
  const body = '# Updated\r\n'
  await store['save-skill']({ name, revision: document.revision, content: body, description: document.description })
  const bodyEdit = await store['get-skill']({ name })
  assert.equal(bodyEdit.content, original.slice(0, document.bodyOffset) + body)
  await store['save-skill']({ name, revision: bodyEdit.revision, content: body, description: 'Updated description' })
  const descriptionEdit = await store['get-skill']({ name })
  assert.match(descriptionEdit.content, /# retain this comment/)
  assert.match(descriptionEdit.content, /triggers: \[ user \]|triggers: \[user\]/)
  assert.equal(descriptionEdit.description, 'Updated description')
  assert.equal(descriptionEdit.content.slice(descriptionEdit.bodyOffset), body)
  const malformed = '---\ndescription: [\n---\n# Body\n'
  await store['save-skill']({ name, revision: descriptionEdit.revision, content: malformed })
  const raw = await store['get-skill']({ name })
  assert.equal(raw.bodyOffset, undefined)
  assert.equal(raw.content, malformed)
  await assert.rejects(store['save-skill']({ name, revision: raw.revision, content: body, description: 'Unexpected' }), /full Markdown editor/)
  await store['save-skill']({ name, revision: raw.revision, content: body })
  assert.equal((await store['get-skill']({ name })).content, body)
})
