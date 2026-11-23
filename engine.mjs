import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
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

export async function findEngine(env = process.env) {
  const override = env.EKKO_DEVIN_EXECUTABLE
  const windows = process.platform === 'win32'
  const name = windows ? 'devin.exe' : 'devin'
  const path = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH')?.[1] ?? ''
  const locations = path.split(delimiter).concat(join(homedir(), '.local', 'bin'))
  if (process.platform === 'darwin') locations.push('/opt/homebrew/bin', '/usr/local/bin')
  const candidates = override ? [override] : locations.filter(isAbsolute).map(dir => join(dir, name))
  for (const candidate of candidates) {
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

export async function engineStatus(engine, signal) {
  signal.throwIfAborted()
  if (!engine) return { installed: false, version: '', source: 'not-installed' }
  try {
    const output = await runCommand(engine, ['--version'], signal)
    const version = output.match(/^devin\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)(?:\s+\([0-9a-f]+\))?$/i)?.[1]
    if (version) return { installed: true, version, source: 'external' }
  } catch {
    signal.throwIfAborted()
  }
  return { installed: false, version: '', source: 'not-installed', error: 'Could not verify the Devin CLI executable.' }
}

export async function loggedOut(engine, signal) {
  try {
    return /^Not logged in\./im.test(await runCommand(engine, ['auth', 'status'], signal))
  } catch {
    signal.throwIfAborted()
    return false
  }
}
