import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { Acp, AcpError } from './acp.mjs'
import { childEnv, engineStatus, engineVersion, findEngine, loggedOut } from './engine.mjs'
import { managedEngine } from './managed-engine.mjs'
import { nativeConfigRoot, nativeSettings } from './native-settings.mjs'
import { registerRpc } from './sdk/harness/contracts.mjs'
import contract from './contracts/plugin.json' with { type: 'json' }
import { acpServers, chooseModel, initialize, loginRequired, nativeModels, promptContent, sessionError, validId } from './protocol.mjs'
import { openAcp } from './turn.mjs'
import manifest from './plugin.json' with { type: 'json' }

const fullId = 'plugin:devin/devin'
const ownerOnly = 'Devin CLI is available to the Studio account and Profile that enabled the plugin.'
const install = 'Install the official Devin CLI on the Studio host and restart the Studio server if its PATH changed.'
const stopReasons = { end_turn: 'stop', refusal: 'stop', max_tokens: 'length', max_turn_requests: 'tool_limit' }
const sameOwner = (left, right) => left.userId === right.userId && left.profile === right.profile
const catalog = (status, models = [], message) => ({
  status, models, source: 'devin-acp', scope: 'available', ...(message ? { message } : {}),
})

async function listModels(run, getEngine) {
  const signal = AbortSignal.any([run.signal, AbortSignal.timeout(20_000)])
  let acp
  let cwd
  try {
    signal.throwIfAborted()
    const engine = await getEngine()
    if (!engine) return catalog('not_installed', [], install)
    cwd = await mkdtemp(join(await realpath(tmpdir()), 'studio-devin-catalog-'))
    signal.throwIfAborted()
    acp = new Acp(engine.executable, engine.args, { cwd, env: engine.env }, ({ id }) => {
      if (id !== undefined) acp.methodNotFound(id)
    })
    run.lifecycle.add(() => acp.close())
    await initialize(acp, signal, manifest.version)
    const session = await acp.request('session/new', { cwd, mcpServers: [] }, signal).catch(error => { throw sessionError(error) })
    const models = nativeModels(session)
    if (models.length) return catalog('ready', models)
    if (await loggedOut(engine, signal)) return catalog('auth_required', [], loginRequired)
    return catalog('empty')
  } catch (error) {
    run.signal.throwIfAborted()
    if (signal.aborted) return catalog('timeout', [], 'Devin model discovery timed out.')
    if (error.message === loginRequired) return catalog('auth_required', [], loginRequired)
    return catalog('error', [], 'Could not load the native Devin model catalog.')
  } finally {
    try { await acp?.close() }
    finally { if (cwd) await rm(cwd, { force: true, recursive: true }) }
  }
}

async function runTurn(input, run, previous, getEngine, signal) {
  const engine = await getEngine()
  if (!engine) throw new Error(install)
  if (!isAbsolute(run.paths.workspaceDir)) throw new Error('Studio must provide an absolute workspace path.')
  const cwd = await realpath(run.paths.workspaceDir)
  signal.throwIfAborted()
  const turn = openAcp(engine, cwd, run, signal)
  const startup = AbortSignal.any([signal, AbortSignal.timeout(25_000)])
  try {
    const capabilities = await initialize(turn.acp, startup, manifest.version)
    const options = { cwd, mcpServers: acpServers(run.mcpServers ?? {}, capabilities.mcpCapabilities) }
    let session
    let sessionId
    if (previous?.cwd === cwd && previous.executable === engine.executable && capabilities.loadSession === true) {
      try {
        session = await turn.acp.request('session/load', { sessionId: previous.sessionId, ...options }, startup)
        if (session?.sessionId && session.sessionId !== previous.sessionId) throw new Error('Devin loaded an unexpected native session.')
        if (session?._meta?.['cognition.ai/isLocked'] === true) throw new Error('The native Devin session is open in another client.')
        sessionId = previous.sessionId
      } catch (error) {
        if (!(error instanceof AcpError)) throw error
        const converted = sessionError(error)
        if (converted !== error) throw converted
        if (![-32016, -32601].includes(error.code)) throw error
      }
    }
    const resumed = Boolean(sessionId)
    if (!resumed) {
      session = await turn.acp.request('session/new', options, startup).catch(error => { throw sessionError(error) })
      sessionId = session?.sessionId
      if (!validId(sessionId)) throw new Error('Devin did not provide a valid ACP session ID.')
    } else if (!(session?.configOptions?.length || session?.models) &&
        (run.model?.model || run.model?.reasoningEffort)) {
      // ACP allows a load response without options. Only continue an unchanged selection.
      if (run.model?.model !== previous.model || run.model?.reasoningEffort !== previous.reasoningEffort) {
        throw new Error('Devin did not return settings for changing the model of the loaded session.')
      }
    }
    if (!resumed || session?.configOptions?.length || session?.models) {
      await chooseModel(turn.acp, sessionId, session, run.model, startup)
    }
    const prompt = await promptContent(input, run, capabilities.promptCapabilities, !resumed, signal)
    const { result, content } = await turn.prompt(sessionId, prompt).catch(error => { throw sessionError(error) })
    if (result?.stopReason === 'cancelled') throw new Error('Devin cancelled the prompt.')
    if (!Object.hasOwn(stopReasons, result?.stopReason)) throw new Error('Devin returned an unsupported ACP stop reason.')
    return {
      native: { sessionId, cwd, executable: engine.executable, model: run.model?.model, reasoningEffort: run.model?.reasoningEffort },
      reply: { content, finishReason: stopReasons[result.stopReason] },
    }
  } catch (error) {
    if (!signal.aborted && startup.aborted && error.name === 'TimeoutError') throw new Error('Devin ACP startup timed out.')
    throw error
  } finally {
    await turn.close()
  }
}

function createSession(owner, session, getEngine) {
  if (session.mode !== 'global') throw new Error('The public Devin CLI supports native Global mode in Studio.')
  if (!sameOwner(owner, session.identity) || session.identity.agentId !== fullId) throw new Error(ownerOnly)
  const disposed = new AbortController()
  let active
  let previous
  return {
    async run(input, run) {
      if (!sameOwner(session.identity, run.identity) || run.identity.sessionId !== session.identity.sessionId ||
          run.identity.agentId !== fullId || run.mode !== session.mode) throw new Error(ownerOnly)
      if (active) throw new Error('Devin CLI already has an active turn in this Studio session.')
      const remaining = run.deadlineAt - Date.now()
      if (remaining <= 0) throw new Error('Devin turn timed out.')
      const deadline = AbortSignal.timeout(remaining)
      const signal = AbortSignal.any([session.signal, run.signal, disposed.signal, deadline])
      signal.throwIfAborted()
      const resume = previous
      previous = undefined
      active = runTurn(input, run, resume, getEngine, signal)
      try {
        const { native, reply } = await active
        signal.throwIfAborted()
        previous = native
        return reply
      } catch (error) {
        if (signal.aborted) throw new Error(deadline.aborted ? 'Devin turn timed out.' : 'Devin turn cancelled.')
        throw error
      } finally {
        active = undefined
      }
    },
    async dispose() {
      disposed.abort()
      previous = undefined
      await active?.catch(() => {})
    },
  }
}

export function definitionFor(owner, getEngine = findEngine, manager) {
  const checkOwner = run => {
    if (!sameOwner(owner, run.identity)) throw new Error(ownerOnly)
  }
  const management = {
    installGuideUrl: manifest.documentation,
    settings(run) { checkOwner(run); return { viewId: 'skills' } },
  }
  if (manager) Object.assign(management, {
    checkUpdate(run) { checkOwner(run); return manager.checkUpdate(run) },
    upgrade(input, run) { checkOwner(run); return manager.upgrade(input, run) },
    remove(run) { checkOwner(run); return manager.remove(run) },
  })
  return {
    id: manifest.id, name: manifest.name, vendor: 'Cognition', description: manifest.description, agentApiVersion: 1,
    async getStatus(run) {
      if (!sameOwner(owner, run.identity)) return { installed: false, version: '', error: ownerOnly }
      return manager ? manager.status(run.signal) : engineStatus(await getEngine(), run.signal)
    },
    management,
    modes: {
      global: { listModels: run => sameOwner(owner, run.identity) ? listModels(run, getEngine) : catalog('auth_required', [], ownerOnly) },
    },
    features: { surfaces: ['chat'], streaming: true, resume: false },
    runtime: { createSession: session => createSession(owner, session, getEngine) },
  }
}

export function apply(ctx) {
  const { userId, profile } = ctx.identity
  const manager = managedEngine(ctx.paths.dataDir)
  const getEngine = async () => (await manager.resolve()).engine
  const owner = { userId, profile }
  const dispose = []
  let settings
  try {
    for (const name of Object.keys(contract.rpc)) {
      dispose.push(registerRpc(ctx, contract, name, async (input, run) => {
        if (!sameOwner(owner, run.identity)) throw new Error(ownerOnly)
        run.signal.throwIfAborted()
        if (name.endsWith('-mcp') || name === 'set-mcp-enabled') {
          const engine = await getEngine()
          if (engine) {
            const version = await engineVersion(engine, run.signal)
            if (!version) throw new Error('Could not verify the selected Devin CLI version for MCP settings.')
            const [major, minor] = version.split('.').map(Number)
            if (major < 3000 || (major === 3000 && minor < 3)) {
              throw new Error('MCP settings here require Devin CLI 3000.3 or later.')
            }
          }
        }
        settings ??= nativeSettings(nativeConfigRoot(childEnv()))
        return settings[name](input, run.signal)
      }))
    }
    const registration = ctx.extensions.agents.register(definitionFor(owner, getEngine, manager))
    dispose.push(() => registration.dispose())
  } catch (error) {
    for (const cleanup of dispose.reverse()) cleanup()
    throw error
  }
  return () => { for (const cleanup of dispose.reverse()) cleanup() }
}
