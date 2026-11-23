import { isMap, parseDocument } from './vendor/yaml.mjs'

const opening = /^\uFEFF?---[ \t]*\r?\n/
const closing = /^---[ \t]*(?:\r?\n|$)/m

// A nonstandard or malformed header remains fully editable in raw Markdown mode.
function splitSkill(content) {
  const start = opening.exec(content)
  if (!start) return { bodyOffset: 0, description: '' }
  const remainder = content.slice(start[0].length)
  const end = closing.exec(remainder)
  if (!end) return undefined
  const header = remainder.slice(0, end.index)
  if (header.length > 16_384) return undefined
  let document
  try { document = parseDocument(header, { prettyErrors: false }) }
  catch { return undefined }
  if (document.errors.length || document.warnings.length || (document.contents !== null && !isMap(document.contents))) return undefined
  const description = document.get('description')
  if (document.has('description') && typeof description !== 'string') return undefined
  const offset = start[0].length + end.index + end[0].length
  return { bodyOffset: offset, description: description ?? '', prefix: content.slice(0, offset), document,
    start: start[0], end: end[0] }
}

export function skillFields(content) {
  const fields = splitSkill(content)
  if (!fields) return {}
  return { description: fields.description, bodyOffset: fields.bodyOffset }
}

export function formatSkill(name, original, body, description) {
  const fields = splitSkill(original)
  if (!fields) throw new Error('This Skill header needs the full Markdown editor.')
  const eol = fields.start?.endsWith('\r\n') ? '\r\n' : '\n'
  if (description === fields.description) {
    const prefix = fields.prefix ?? ''
    return prefix + (prefix && !prefix.endsWith('\n') ? eol : '') + body
  }
  const document = fields.document ?? parseDocument('')
  if (!fields.document) document.set('name', name)
  if (description) document.set('description', description)
  else document.delete('description')
  const end = fields.end?.endsWith('\n') ? fields.end : (fields.end ?? '---') + eol
  return (fields.start ?? '---' + eol) + document.toString().replaceAll('\n', eol) + end + body
}
