const messages = {
  en: {
    scope: 'Global · Devin user configuration',
    skillsNote: 'Manage SKILL.md files in the native user directory. Devin also loads project and imported skills.',
    mcpNote: 'Project and organization configuration can take precedence. Masked values are kept if left in the same field. Changes apply when Devin starts a new run.',
    settingsNote: 'Edit the native JSON settings shown here. Use null to restore a default and omit a key to keep its value. Projects can override these import switches.',
    settingsFields: 'Supported read_config_from sources',
    name: 'Name', select: 'Select an entry', add: 'New', reload: 'Reload', save: 'Save', saved: 'Saved',
    remove: 'Delete', confirm: 'Delete this entry?', cancel: 'Cancel', removed: 'Deleted',
    editor: 'Content', enabled: 'Enabled', disabled: 'Disabled', loading: 'Loading…', empty: 'No entries yet.',
    enable: 'Enable', disable: 'Disable', duplicate: 'This name already exists.', invalid: 'Enter a name.',
    discard: 'Reload discards your unsaved edits.', apply: 'Continue', skillStub: '# Skill instructions\n\n',
  },
  zh: {
    scope: 'Global · Devin 用户配置',
    skillsNote: '管理原生用户目录中的 SKILL.md 文件。Devin 也会加载项目及导入的 Skill。',
    mcpNote: '项目及组织配置可能优先。保留原字段中的遮罩即可保留该值。Devin 在下一轮启动时载入改动。',
    settingsNote: '编辑下列原生 JSON 设置。用 null 恢复默认，省略字段会保留原值。项目配置可覆盖这些开关。',
    settingsFields: '受支持的 read_config_from 来源',
    name: '名称', select: '选择条目', add: '新建', reload: '重新加载', save: '保存', saved: '已保存',
    remove: '删除', confirm: '删除此条目？', cancel: '取消', removed: '已删除',
    editor: '内容', enabled: '已启用', disabled: '已停用', loading: '加载中…', empty: '暂无条目。',
    enable: '启用', disable: '停用', duplicate: '名称已存在。', invalid: '请输入名称。',
    discard: '重新加载会丢弃未保存的编辑。', apply: '继续', skillStub: '# Skill 指令\n\n',
  },
  'zh-TW': {
    scope: 'Global · Devin 使用者設定',
    skillsNote: '管理原生使用者目錄中的 SKILL.md 檔案。Devin 也會載入專案及匯入的 Skill。',
    mcpNote: '專案及組織設定可能優先。在原欄位保留遮罩即可保留該值。Devin 在下一輪啟動時載入變更。',
    settingsNote: '編輯下列原生 JSON 設定。用 null 恢復預設，省略欄位會保留原值。專案設定可覆寫這些開關。',
    settingsFields: '支援的 read_config_from 來源',
    name: '名稱', select: '選取項目', add: '新增', reload: '重新載入', save: '儲存', saved: '已儲存',
    remove: '刪除', confirm: '刪除此項目？', cancel: '取消', removed: '已刪除',
    editor: '內容', enabled: '已啟用', disabled: '已停用', loading: '載入中…', empty: '尚無項目。',
    enable: '啟用', disable: '停用', duplicate: '名稱已存在。', invalid: '請輸入名稱。',
    discard: '重新載入會捨棄未儲存的編輯。', apply: '繼續', skillStub: '# Skill 指令\n\n',
  },
}

function node(tag, text, className) {
  const el = document.createElement(tag)
  if (text) el.textContent = text
  if (className) el.className = className
  return el
}

function button(text, action, { disabled, danger } = {}) {
  const el = node('button', text, danger ? 'danger' : '')
  el.type = 'button'
  el.disabled = Boolean(disabled)
  el.addEventListener('click', action)
  return el
}

const styles = `
.devin-native { color: var(--text-primary, inherit); font: 14px/1.55 system-ui, sans-serif; padding: 16px; }
.devin-native section { max-width: 54rem; margin: 0 auto; }
.devin-native h2 { font-size: 17px; margin: 0 0 6px; }
.devin-native p { margin: 0 0 10px; }
.devin-native code { display: block; overflow-wrap: anywhere; margin: 8px 0 16px; }
.devin-native form, .devin-native .row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 10px 0; }
.devin-native textarea { box-sizing: border-box; width: 100%; resize: vertical; min-height: 13rem; padding: 10px; }
.devin-native textarea, .devin-native input, .devin-native select, .devin-native button {
  font: inherit; color: inherit; border: 1px solid var(--border-color, #8888); border-radius: 6px; background: var(--bg-secondary, transparent);
}
.devin-native textarea, .devin-native code { font-family: ui-monospace, monospace; direction: ltr; }
.devin-native button, .devin-native input, .devin-native select { padding: 5px 10px; }
.devin-native button { cursor: pointer; }
.devin-native button:disabled { opacity: .5; cursor: default; }
.devin-native .danger, .devin-native .error { color: var(--error, #d05b61); }
.devin-native .status { min-height: 1.5em; }
`

/** @param {HTMLElement} root @param {import('@ekko-studio/plugin-sdk').ClientContext} ctx */
export function mount(root, ctx) {
  const locale = String(ctx.locale || 'en').replaceAll('_', '-').toLowerCase()
  const lang = locale === 'zh-tw' || locale.startsWith('zh-hant') ? 'zh-TW' : locale.split('-')[0]
  const labels = messages[lang] ?? messages.en
  const view = ctx.view
  if (!['skills', 'mcp', 'settings'].includes(view)) return
  const settings = view === 'settings'
  const mcp = view === 'mcp'
  const kind = mcp ? 'mcp' : 'skill'
  const style = node('style', styles)
  const container = node('div', '', 'devin-native')
  const section = node('section')
  const status = node('p', '', 'status')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  container.lang = messages[lang] ? lang : 'en'
  container.append(section, status)
  root.replaceChildren(style, container)

  let list
  let selection
  let editor
  let busy = false
  let closed = false
  const rpc = (op, input = null) => ctx.rpc.call(op, input)
  const entries = () => mcp ? list?.servers ?? [] : (list?.names ?? []).map(name => ({ name }))
  const dirty = () => editor && selection && (selection.create || editor.value !== selection.content)

  async function request(action) {
    if (busy || closed) return
    const draft = dirty() ? editor.value : undefined
    busy = true
    render(draft)
    status.className = 'status'
    status.textContent = labels.loading
    try { status.textContent = await action() || '' }
    catch (error) {
      status.className = 'status error'
      status.textContent = error.message || String(error)
    } finally {
      busy = false
      if (!closed) render(status.classList.contains('error') ? draft : undefined)
    }
  }

  async function load(name = selection?.name) {
    if (settings) {
      selection = await rpc('get-settings')
      list = { path: selection.path }
      return
    }
    list = await rpc(mcp ? 'list-mcp' : 'list-skills')
    name = entries().find(item => item.name === name)?.name
    selection = name ? { name, ...await rpc('get-' + kind, { name }) } : undefined
  }

  function confirmAction(text, action, label = labels.apply, danger = false) {
    const row = node('div', '', 'row')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', text)
    const apply = button(label, action, { danger })
    row.append(node('span', text), apply, button(labels.cancel, () => row.remove()))
    section.querySelector('[data-confirm]')?.remove()
    row.dataset.confirm = 'true'
    section.append(row)
    apply.focus()
  }

  function render(draft) {
    const title = node('h2', labels.scope)
    const note = node('p', labels[view === 'skills' ? 'skillsNote' : view + 'Note'])
    const path = node('code', list?.path)
    const reload = button(labels.reload, () => {
      if (dirty()) confirmAction(labels.discard, () => request(() => load()))
      else request(() => load())
    }, { disabled: busy })
    section.replaceChildren(title, note, path, reload)
    if (settings) section.insertBefore(node('p', labels.settingsFields + ' · ' +
      'agents_standard, cursor, windsurf, claude, copilot, codex, kiro, opencode, zed'), path)

    if (!settings && list) {
      const picker = node('div', '', 'row')
      const select = node('select')
      select.disabled = busy
      select.setAttribute('aria-label', labels.select)
      select.append(new Option(entries().length ? labels.select : labels.empty, ''))
      for (const { name, enabled } of entries()) {
        select.append(new Option(mcp ? name + ' · ' + labels[enabled ? 'enabled' : 'disabled'] : name, name))
      }
      select.value = selection?.create ? '' : selection?.name ?? ''
      select.addEventListener('change', () => {
        const name = select.value
        if (!name) return
        if (dirty()) {
          select.value = selection?.create ? '' : selection?.name ?? ''
          confirmAction(labels.discard, () => request(() => load(name)))
        } else request(() => load(name))
      })
      picker.append(select)

      const form = node('form')
      const name = node('input')
      name.required = true
      name.disabled = busy
      name.maxLength = mcp ? 100 : 64
      name.placeholder = labels.name
      name.setAttribute('aria-label', labels.name)
      const add = node('button', labels.add)
      add.type = 'submit'
      add.disabled = busy
      form.append(name, add)
      form.addEventListener('submit', event => {
        event.preventDefault()
        const value = name.value.trim()
        const create = () => request(async () => {
          if (!value) throw new Error(labels.invalid)
          if (entries().some(item => item.name === value)) throw new Error(labels.duplicate)
          const document = await rpc('get-' + kind, { name: value })
          if (mcp ? document.content : document.revision) throw new Error(labels.duplicate)
          selection = {
            name: value, create: true, revision: document.revision,
            content: mcp ? '{\n  "url": "https://example.com/mcp",\n  "transport": "http"\n}\n' : labels.skillStub,
          }
        })
        if (dirty()) confirmAction(labels.discard, create)
        else create()
      })
      section.append(picker, form)
    }

    editor = undefined
    if (!selection) return
    const selected = selection
    if (!settings) section.append(node('h3', selected.name))
    editor = node('textarea')
    editor.spellcheck = false
    editor.disabled = busy
    editor.setAttribute('aria-label', labels.editor)
    editor.value = draft ?? selected.content
    if (settings) editor.placeholder = '{\n  "read_config_from": { "claude": false }\n}'
    section.append(editor)
    const actions = node('div', '', 'row')
    actions.append(button(labels.save, () => {
      const content = editor.value
      return request(async () => {
        const input = { content, revision: selected.revision }
        if (!settings) input.name = selected.name
        if (mcp) input.create = Boolean(selected.create)
        await rpc(settings ? 'save-settings' : 'save-' + kind, input)
        await load(selected.name)
        return labels.saved
      })
    }, { disabled: busy }))
    if (!settings && !selected.create) {
      if (mcp) {
        const enabled = entries().find(item => item.name === selected.name)?.enabled
        const toggle = () => request(async () => {
          await rpc('set-mcp-enabled', { name: selected.name, revision: selected.revision, enabled: !enabled })
          await load(selected.name)
          return labels.saved
        })
        actions.append(button(labels[enabled ? 'disable' : 'enable'], () => {
          if (dirty()) confirmAction(labels.discard, toggle)
          else toggle()
        }, { disabled: busy }))
      }
      actions.append(button(labels.remove, () => confirmAction(labels.confirm, () => request(async () => {
        await rpc('remove-' + kind, { name: selected.name, revision: selected.revision })
        await load('')
        return labels.removed
      }), labels.remove, true), { disabled: busy, danger: true }))
    }
    section.append(actions)
  }

  void request(() => load())
  return () => { closed = true; root.replaceChildren() }
}
