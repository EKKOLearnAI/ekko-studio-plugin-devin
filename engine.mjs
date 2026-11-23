import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
export const stableVersion = /^\d{1,10}\.\d{1,10}\.\d{1,10}$/
export const acpArgs = Object.freeze(['acp', '--process-model', 'in-process'])
const inherited = new Set([
  'PATH', 'PATHEXT', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'SYSTEMROOT', 'WINDIR', 'COMSPEC',
  'TMPDIR', 'TEMP', 'TMP', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME',
  'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
])

export function childEnv(parent = process.env) {
  return Object.fromEntries(Object.entries(parent).filter(([key]) => inherited.has(key.toUpperCase())))
}

export const executableName = process.platform === 'win32' ? 'devin.exe' : 'devin'
export const externalOverride = (env = process.env) => env.EKKO_DEVIN_EXECUTABLE?.trim()

export async function findEngine(env = process.env) {
  const override = externalOverride(env)
  const windows = process.platform === 'win32'
  const path = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
  const locations = path.split(delimiter).filter(isAbsolute).concat(join(homedir(), '.local', 'bin'))
  if (process.platform === 'darwin') locations.push('/opt/homebrew/bin', '/usr/local/bin')
  if (windows && env.LOCALAPPDATA && isAbsolute(env.LOCALAPPDATA)) locations.push(join(env.LOCALAPPDATA, 'devin', 'cli', 'bin'))
  if (windows && env.APPDATA && isAbsolute(env.APPDATA)) locations.push(join(env.APPDATA, 'npm'))
  const candidates = override ? [override] : locations.flatMap(dir => {
    const native = join(dir, executableName)
    if (!windows) return [native]
    const alias = 'devin-win32-' + process.arch
    return [
      native,
      join(dir, 'node_modules', alias, 'bin', executableName),
      join(dir, 'node_modules', 'devin', 'node_modules', alias, 'bin', executableName),
    ]
  })
  for (const candidate of new Set(candidates)) {
    if (!isAbsolute(candidate) || (windows && !candidate.toLowerCase().endsWith('.exe'))) continue
    try {
      await access(candidate, windows ? constants.F_OK : constants.X_OK)
      if ((await stat(candidate)).isFile()) {
        return { executable: await realpath(candidate), args: acpArgs, env: childEnv(env) }
      }
    } catch { /* Continue through absolute installation locations. */ }
  }
  return null
}

async function runCommand(engine, args, signal) {
  const { stdout } = await execFileAsync(engine.executable, args, {
    env: engine.env, signal, timeout: 5000, maxBuffer: 8192, windowsHide: true,
  })
  return stdout.trim()
}

export async function engineVersion(engine, signal) {
  signal.throwIfAborted()
  try {
    const output = await runCommand(engine, ['--version'], signal)
    return output.match(/^devin\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(?:\s+\([0-9a-f]+\))?$/i)?.[1]
  } catch {
    signal.throwIfAborted()
    return undefined
  }
}

export async function engineStatus(engine, signal, source = 'external') {
  signal.throwIfAborted()
  if (!engine) return { installed: false, version: '', source: source === 'managed' ? 'managed' : 'not-installed' }
  const version = await engineVersion(engine, signal)
  if (version) return { installed: true, version, source }
  return { installed: false, version: '', source, error: 'Could not verify the Devin CLI executable.' }
}

export async function loggedOut(engine, signal) {
  try {
    return /^Not logged in\./im.test(await runCommand(engine, ['auth', 'status'], signal))
  } catch {
    signal.throwIfAborted()
    return false
  }
}
