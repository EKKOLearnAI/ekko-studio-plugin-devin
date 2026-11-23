import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, rename, unlink, readdir } from 'node:fs/promises'
import { basename, dirname, join, posix, win32 } from 'node:path'
import { applyEdits, createScanner, findNodeAtLocation, getNodeValue, modify, parseTree, SyntaxKind } from './vendor/jsonc-parser.mjs'

import { formatSkill, skillFields } from './skill-markdown.mjs'

const maxBytes = 1024 * 1024
const reserved = new Set(['__proto__', 'prototype', 'constructor'])
const mask = '••••••••'
const formatting = { insertSpaces: true, tabSize: 2 }
const imports = ['agents_standard', 'cursor', 'windsurf', 'claude', 'copilot', 'codex', 'kiro', 'opencode', 'zed']
const importPaths = imports.map(name => ['read_config_from', name])
const get = (node, path) => path.reduce((value, key) => value?.[key], node)
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const revisionOf = bytes => createHash('sha256').update(bytes).digest('hex')
const missing = { text: '', revision: '', mode: 0o600 }
const absent = error => error.code === 'ENOENT'
function edits(source, path, value) {
  if (value !== undefined) return applyEdits(source, modify(source, path, value, { formattingOptions: formatting }))
  // Remove the property and its delimiter separately. This keeps nearby comments
  // and avoids leaving an orphan trailing comma when the last property is removed.
  const node = findNodeAtLocation(parseTree(source), path)
  if (!node) return source
  const property = node.parent
  const children = property.parent.children
  const end = property.offset + property.length
  const scanner = createScanner(source, true)
  scanner.setPosition(end)
  let comma
  if (scanner.scan() === SyntaxKind.CommaToken) comma = scanner.getTokenOffset()
  else {
    const previous = children[children.indexOf(property) - 1]
    if (previous) {
      scanner.setPosition(previous.offset + previous.length)
      if (scanner.scan() === SyntaxKind.CommaToken) comma = scanner.getTokenOffset()
    }
  }
  const patches = [{ offset: property.offset, length: property.length, content: '' }]
  if (comma !== undefined) patches.push({ offset: comma, length: 1, content: '' })
  return applyEdits(source, patches)
}
const json = value => JSON.stringify(value, null, 2) + '\n'
const unsafePath = () => new Error('Devin settings require regular files and directories. Symbolic links are unsupported inside the configuration directory.')

export function nativeConfigRoot(env, platform = process.platform) {
  if (platform === 'win32') {
    const appData = Object.entries(env).find(([key]) => key.toUpperCase() === 'APPDATA')?.[1]
    if (!appData || !win32.isAbsolute(appData) || win32.parse(appData).root.length < 2) throw new Error('Devin CLI requires an absolute APPDATA directory.')
    return win32.join(appData, 'devin')
  }
  if (env.XDG_CONFIG_HOME !== undefined) {
    if (!posix.isAbsolute(env.XDG_CONFIG_HOME)) throw new Error('Set XDG_CONFIG_HOME to an absolute directory or unset it.')
    return posix.join(env.XDG_CONFIG_HOME, 'devin')
  }
  if (!env.HOME || !posix.isAbsolute(env.HOME)) throw new Error('Devin CLI requires an absolute HOME or XDG_CONFIG_HOME directory.')
  return posix.join(env.HOME, '.config', 'devin')
}

function skillName(name) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(name) || reserved.has(name) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) throw new Error('Use 1–64 letters, digits, dashes or underscores for a Skill folder name.')
  return name
}

function serverName(name) {
  if (typeof name !== 'string' || !name.trim() || /[\u0000-\u001f\u007f]/.test(name) ||
      reserved.has(name) || name.length > 100) throw new Error('Use a non-empty MCP server name of at most 100 characters.')
  return name
}

function parse(text, comments = true) {
  const errors = []
  const root = parseTree(text, errors, { allowTrailingComma: comments, disallowComments: !comments })
  if (errors.length || root?.type !== 'object') throw new Error('Expected a valid JSON object.')
  function check(node, depth) {
    if (depth > 32) throw new Error('JSON is nested too deeply.')
    if (node.type === 'object') {
      const keys = new Set()
      for (const [key, value] of node.children.map(child => child.children)) {
        if (keys.has(key.value) || reserved.has(key.value)) throw new Error('Duplicate or reserved JSON keys are unsupported.')
        keys.add(key.value)
        check(value, depth + 1)
      }
    }
    if (node.type === 'array') for (const item of node.children) check(item, depth + 1)
  }
  check(root, 0)
  return getNodeValue(root)
}

function stringMap(value) {
  return object(value) && Object.values(value).every(item => typeof item === 'string')
}

function validateServer(value) {
  const stdio = typeof value.command === 'string' && Boolean(value.command.trim())
  const remote = typeof value.url === 'string' && /^https?:\/\/\S+$/i.test(value.url)
  if (stdio === remote || (stdio && (Object.hasOwn(value, 'url') || value.transport !== undefined && value.transport !== 'stdio')) ||
      (remote && (Object.hasOwn(value, 'command') || value.transport !== undefined && !['http', 'sse'].includes(value.transport)))) {
    throw new Error('Provide a stdio command, or an HTTP(S) URL with http or sse transport.')
  }
  for (const field of ['args', 'oauthScopes', 'disabledTools']) {
    if (value[field] !== undefined && (!Array.isArray(value[field]) || value[field].some(item => typeof item !== 'string'))) {
      throw new Error(field + ' must be an array of strings.')
    }
  }
  for (const field of ['oauthClientId', 'oauthClientSecret', 'oauthResource']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') throw new Error(field + ' must be a string.')
  }
  for (const field of ['env', 'headers']) {
    if (value[field] !== undefined && !stringMap(value[field])) throw new Error(field + ' must be an object of strings.')
  }
  if (value.disabled !== undefined && typeof value.disabled !== 'boolean') throw new Error('disabled must be a boolean.')
}

function isSecret(field, value) {
  return /(?:token|secret|password|credential|api[_-]?key|authorization)/i.test(field) ||
    (field.toLowerCase() === 'url' && typeof value === 'string' && /[?@#]/.test(value))
}

function mapSecrets(value, transform, path = [], protectedValue = false) {
  if (Array.isArray(value)) return value.map((item, index) => mapSecrets(item, transform, [...path, index], protectedValue))
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, mapSecrets(item, transform, [...path, key], protectedValue || ['env', 'headers'].includes(key) || isSecret(key, item)),
  ]))
  return transform(value, path, protectedValue)
}

function mcpSummary(value) {
  const invalid = { transport: 'unknown', target: '' }
  if (typeof value?.url === 'string') {
    if (value.command !== undefined || value.transport !== undefined && !['http', 'sse'].includes(value.transport)) return invalid
    try {
      const address = new URL(value.url)
      if (!['https:', 'http:'].includes(address.protocol)) return invalid
      return { transport: value.transport === 'sse' ? 'sse' : 'http', target: address.origin.slice(0, 1024) }
    } catch { return invalid }
  }
  if (typeof value?.command === 'string' && value.command.trim() && (value.transport === undefined || value.transport === 'stdio')) {
    const target = value.command.split(/[\\/]/).at(-1)
    return { transport: 'stdio', target: /^[a-z0-9_.+-]{1,120}$/i.test(target) ? target : '' }
  }
  return invalid
}

function validatePatch(patch) {
  for (const [key, group] of Object.entries(patch)) {
    if (key !== 'read_config_from' || !object(group) || Object.entries(group).some(([name, value]) =>
      !imports.includes(name) || value !== null && typeof value !== 'boolean')) {
      throw new Error('Supply supported read_config_from sources with true, false or null.')
    }
  }
}

export function nativeSettings(root) {
  const pending = new Map()

  async function folder(parts, create = false) {
    const base = dirname(root)
    if (create) await mkdir(base, { recursive: true, mode: 0o700 })
    let path = base
    for (const part of [basename(root), ...parts]) {
      path = join(path, part)
      if (create) await mkdir(path, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error })
      const state = await lstat(path).catch(error => { if (absent(error)) return null; throw error })
      if (!state) return false
      if (!state.isDirectory() || state.isSymbolicLink()) throw unsafePath()
    }
    return true
  }

  async function read(parts, preview) {
    if (!await folder(parts.slice(0, -1))) return missing
    const path = join(root, ...parts)
    const state = await lstat(path).catch(error => { if (absent(error)) return null; throw error })
    if (!state) return missing
    if (!state.isFile() || state.isSymbolicLink()) throw unsafePath()
    const fd = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
    try {
      const current = await fd.stat()
      if (!current.isFile() || current.dev !== state.dev || current.ino !== state.ino) throw unsafePath()
      if (!preview && current.size > maxBytes) throw new Error('Devin settings file exceeds 1 MiB.')
      const count = preview ? Math.min(preview, current.size) : current.size
      const buffer = Buffer.alloc(count + 1)
      const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0)
      if (bytesRead < count || !preview && bytesRead !== count) throw new Error('This file changed while being read. Reload and try again.')
      const bytes = buffer.subarray(0, bytesRead)
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes, { stream: Boolean(preview && current.size > bytesRead) })
      return { text, revision: revisionOf(bytes), mode: current.mode & 0o777 }
    } finally {
      await fd.close()
    }
  }

  async function change(parts, revision, signal, update) {
    const path = join(root, ...parts)
    // Windows and many macOS home volumes use case-insensitive names.
    const key = path.toLowerCase()
    const task = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
      signal?.throwIfAborted()
      const current = await read(parts)
      if (current.revision !== revision) throw new Error('This file changed. Reload it before saving.')
      const text = await update(current.text)
      if (text === current.text || text === null && !current.revision) return { ok: true }
      if (text !== null && Buffer.byteLength(text) > maxBytes) throw new Error('Devin settings file exceeds 1 MiB.')
      const check = async () => {
        signal?.throwIfAborted()
        if ((await read(parts)).revision !== revision) throw new Error('This file changed. Reload it before saving.')
        signal?.throwIfAborted()
      }
      if (text === null) {
        await check()
        await unlink(path)
        return { ok: true }
      }
      await folder(parts.slice(0, -1), true)
      const temp = join(dirname(path), '.studio-' + randomUUID())
      const fd = await open(temp, 'wx', 0o600)
      try {
        await fd.writeFile(text, 'utf8')
        await fd.chmod(current.mode & 0o777)
        await fd.close()
        await check()
        await rename(temp, path)
        return { ok: true }
      } finally {
        await fd.close()
        await unlink(temp).catch(error => { if (!absent(error)) throw error })
      }
    })
    pending.set(key, task)
    try { return await task }
    finally { if (pending.get(key) === task) pending.delete(key) }
  }

  const config = ['config.json']
  const mcp = ['mcp_config.json']
  const withBom = (text, result) => text.startsWith('\uFEFF') ? '\uFEFF' + result : result
  const sourceOf = text => text.replace(/^\uFEFF/, '') || '{}\n'
  const parseNative = text => parse(sourceOf(text))
  const skill = name => ['skills', skillName(name), 'SKILL.md']

  async function checkMcpLayout() {
    const main = parseNative((await read(config)).text)
    if (Object.hasOwn(main, 'mcpServers')) {
      throw new Error('Legacy inline MCP configuration found. Use Devin CLI to migrate it before editing MCP here.')
    }
  }

  function serversIn(text) {
    const value = parseNative(text).mcpServers
    if (value !== undefined && !object(value)) throw new Error('mcpServers must be an object.')
    return value ?? {}
  }

  function changeMcp(input, signal, update) {
    const name = serverName(input.name)
    return change(mcp, input.revision, signal, async text => {
      await checkMcpLayout()
      const servers = serversIn(text)
      const source = sourceOf(text)
      const current = Object.hasOwn(servers, name) ? servers[name] : undefined
      const result = update(source, ['mcpServers', name], current)
      return result === source ? text : withBom(text, result)
    })
  }

  return {
    async 'list-skills'() {
      const path = join(root, 'skills')
      if (!await folder(['skills'])) return { path, names: [], summaries: [] }
      const entries = await readdir(path, { withFileTypes: true })
      const summaries = []
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        let parts
        try { parts = skill(entry.name) } catch { continue }
        const info = await lstat(join(root, ...parts)).catch(error => { if (absent(error)) return null; throw error })
        if (!info?.isFile()) continue
        const description = await read(parts, 16_384).then(
          preview => skillFields(preview.text).description?.trim().slice(0, 280) ?? '',
          () => '',
        )
        summaries.push({ name: entry.name, description })
      }
      summaries.sort((left, right) => left.name.localeCompare(right.name))
      return { path, names: summaries.map(item => item.name), summaries }
    },
    async 'get-skill'({ name }) {
      const { text, revision } = await read(skill(name))
      return { content: text, revision, ...skillFields(text) }
    },
    'save-skill'({ name, content, revision, description }, signal) {
      if (!content.trim()) throw new Error('A Skill requires Markdown content.')
      return change(skill(name), revision, signal, original =>
        description === undefined ? content : formatSkill(name, original, content, description))
    },
    'remove-skill'({ name, revision }, signal) {
      return change(skill(name), revision, signal, () => null)
    },
    async 'list-mcp'() {
      await checkMcpLayout()
      const { text, revision } = await read(mcp)
      const servers = Object.entries(serversIn(text)).sort(([a], [b]) => a.localeCompare(b))
        .map(([name, value]) => ({ name, enabled: object(value) && value.disabled !== true, ...mcpSummary(value) }))
      return { path: join(root, ...mcp), servers, revision }
    },
    async 'get-mcp'({ name }) {
      await checkMcpLayout()
      const { text, revision } = await read(mcp)
      const servers = serversIn(text)
      const value = Object.hasOwn(servers, serverName(name)) ? servers[name] : undefined
      const content = value === undefined ? '' : json(mapSecrets(value, (item, path, secret) => secret ? mask : item))
      return { content, revision }
    },
    'save-mcp'(input, signal) {
      return changeMcp(input, signal, (source, path, current) => {
        if ((current === undefined) !== input.create) throw new Error('This MCP entry changed. Reload the list.')
        const draft = parse(input.content, false)
        const shown = mapSecrets(current, (item, parts, secret) => secret ? mask : undefined)
        const restored = mapSecrets(draft, (value, parts) => {
          if (value !== mask) return value
          const previous = get(current, parts)
          if (get(shown, parts) !== mask) throw new Error('A masked value can only be kept in its original field.')
          return previous
        })
        validateServer(restored)
        return edits(source, path, restored)
      })
    },
    'set-mcp-enabled'(input, signal) {
      return changeMcp(input, signal, (source, path, current) => {
        if (!object(current)) throw new Error('MCP entry is missing or invalid. Reload the list.')
        return edits(source, [...path, 'disabled'], input.enabled ? undefined : true)
      })
    },
    'remove-mcp'(input, signal) {
      return changeMcp(input, signal, (source, path) => edits(source, path, undefined))
    },
    async 'get-settings'() {
      const { text, revision } = await read(config)
      const value = parseNative(text)
      let output = '{}\n'
      for (const path of importPaths) {
        const setting = get(value, path)
        if (typeof setting === 'boolean') output = edits(output, path, setting)
      }
      return { path: join(root, ...config), content: output, revision, supportedImports: imports }
    },
    'save-settings'({ content, revision }, signal) {
      const patch = parse(content, false)
      validatePatch(patch)
      return change(config, revision, signal, text => {
        const original = parseNative(text)
        let output = sourceOf(text)
        for (const path of importPaths) {
          const value = get(patch, path)
          if (value === undefined || value === get(original, path)) continue
          if (original.read_config_from !== undefined && !object(original.read_config_from)) {
            throw new Error('The native settings group must be an object.')
          }
          output = edits(output, path, value === null ? undefined : value)
        }
        return output === sourceOf(text) ? text : withBom(text, output)
      })
    },
  }
}
