// Layout adapted from Ekko Studio’s MIT-licensed Cline plugin (see LICENSE).
const themeStyles = `
  :root{--dv-space:var(--spacing-scale,1);--dv-border:var(--border-width,1px) solid var(--border-color);color-scheme:var(--studio-color-scheme,normal)}
  html,body,#root{height:100%;min-height:0;margin:0}#root{padding:0}
  .dv-settings *,.dv-manager *{box-sizing:border-box}
  @media(max-width:768px){.dv-manager .dv-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
  .dv-settings,.dv-manager{display:flex;flex-direction:column;width:100%;height:100%;min-height:0;min-width:0;color:var(--text-primary);font:var(--font-size-base,14px)/var(--line-height,1.6) var(--font-family,system-ui);letter-spacing:var(--letter-spacing,normal)}
  .dv-settings button,.dv-manager button{display:inline-flex;align-items:center;justify-content:center;gap:calc(6px * var(--dv-space));min-height:var(--control-height,28px);padding:4px 10px;border:var(--dv-border);border-radius:var(--radius-component,6px);background:transparent;line-height:1.4;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
  .dv-settings button:hover,.dv-manager button:hover{background:var(--bg-secondary)}
  .dv-settings button.primary,.dv-manager button.primary{background:var(--accent-primary);border-color:var(--accent-primary);color:var(--dv-on-accent)}
  .dv-settings button.quiet,.dv-manager button.quiet{border-color:transparent}
  .dv-manager button.danger{color:var(--error,var(--text-secondary))}
  .dv-settings button:disabled,.dv-manager button:disabled{opacity:.5;cursor:default}
  .dv-settings input,.dv-settings textarea,.dv-manager input:not([type=checkbox]),.dv-manager textarea{padding:5px 10px;border:var(--dv-border);border-radius:var(--radius-component,6px);background:var(--theme-input-bg,var(--bg-input,var(--bg-secondary)));color:var(--text-primary);font:inherit;min-width:0;max-width:100%}
  .dv-settings input:disabled,.dv-settings textarea:disabled,.dv-manager input:disabled,.dv-manager textarea:disabled{cursor:default;opacity:.5}
  .dv-settings textarea,.dv-manager textarea{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:calc(var(--font-size-base,14px) * 13 / 14);line-height:1.6;resize:vertical}
  .dv-settings :focus-visible,.dv-manager :focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}
  .dv-page-header{display:flex;flex-shrink:0;align-items:center;justify-content:space-between;gap:calc(12px * var(--dv-space));flex-wrap:wrap;padding:calc(12px * var(--dv-space)) calc(20px * var(--dv-space));border-bottom:var(--dv-border)}
  .dv-page-header h1{font-size:calc(var(--font-size-base,14px) * 16 / 14);font-weight:600;line-height:1.5;margin:0}
  .dv-page-header .dv-buttons{margin-inline-start:auto}
  .dv-page-content{flex:1;min-height:0;overflow:auto;padding:calc(20px * var(--dv-space));display:flex;flex-direction:column;gap:calc(16px * var(--dv-space));min-width:0}
  .dv-manager p,.dv-settings p{margin:0;color:var(--text-secondary);overflow-wrap:anywhere}
  .dv-source-path{display:block;font:calc(var(--font-size-base,14px) * 12 / 14)/1.6 ui-monospace,monospace;color:var(--text-muted,var(--text-secondary));overflow-wrap:anywhere}
  .dv-source-info{font-size:calc(var(--font-size-base,14px) * 12 / 14);color:var(--text-secondary)}
  .dv-source-info summary{cursor:pointer}.dv-source-info p,.dv-source-info code{margin-top:8px}
  .dv-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:calc(12px * var(--dv-space))}
  .dv-stat{padding:calc(14px * var(--dv-space));border:var(--dv-border);border-radius:var(--radius-component,8px);background:var(--theme-card-bg,var(--bg-card));display:flex;flex-direction:column;gap:6px}
  .dv-stat span{font-size:calc(var(--font-size-base,14px) * 11 / 14);color:var(--text-muted,var(--text-secondary))}.dv-stat strong{font-size:calc(var(--font-size-base,14px) * 24 / 14);font-weight:600;line-height:1}.dv-stat.active strong{color:var(--success,var(--accent-primary))}
  .dv-toolbar,.dv-buttons{display:flex;align-items:center;gap:calc(8px * var(--dv-space));flex-wrap:wrap}
  .dv-toolbar .dv-buttons{margin-inline-start:auto}
  .dv-manager .dv-toolbar input{flex:1;max-width:360px;min-width:0}
  .dv-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:calc(14px * var(--dv-space))}
  .dv-row{display:flex;flex-direction:column;gap:calc(12px * var(--dv-space));padding:calc(16px * var(--dv-space));border:var(--dv-border);border-radius:var(--radius-component,8px);background:var(--theme-card-bg,var(--bg-card));min-width:0}
  .dv-summary{flex:1;min-width:0;overflow-wrap:anywhere}.dv-summary strong{font-size:calc(var(--font-size-base,14px) * 15 / 14);font-weight:600}.dv-summary p{font-size:calc(var(--font-size-base,14px) * 13 / 14);margin-top:8px}
  .dv-row-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  .dv-row-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:var(--dv-border);padding-top:10px}
  .dv-badges{display:flex;gap:6px;flex-wrap:wrap}
  .dv-badge{display:inline-flex;padding:1px 7px;border:var(--dv-border);border-radius:var(--radius-component,4px);font-size:calc(var(--font-size-base,14px) * 11 / 14);color:var(--text-secondary)}
  .dv-badge.active{color:var(--success,var(--accent-primary));border-color:currentColor}
  .dv-manager button.dv-switch{flex-shrink:0;min-height:18px;width:32px;height:18px;padding:2px;justify-content:flex-start;border:0;border-radius:12px;background:var(--text-muted)}
  .dv-manager button.dv-switch[aria-checked=true]{background:var(--accent-primary)}
  .dv-switch::after{content:'';width:14px;height:14px;border-radius:50%;background:var(--dv-on-accent);transition:transform .15s}
  .dv-switch[aria-checked=true]::after{transform:translateX(14px)}
  .dv-empty{grid-column:1/-1;text-align:center;padding:48px 16px}
  .dv-dialog{width:min(600px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:0;border:var(--dv-border);border-radius:var(--radius-component,12px);background:var(--theme-overlay-bg,var(--bg-card));color:var(--text-primary)}
  .dv-dialog::backdrop{background:color-mix(in srgb,var(--text-primary) 30%,transparent)}
  .dv-editor{display:flex;flex-direction:column;gap:calc(16px * var(--dv-space));padding:calc(24px * var(--dv-space));min-width:0}.dv-editor[hidden]{display:none}
  .dv-editor h2{font-size:18px;margin:0;font-weight:600}.dv-editor fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:16px;min-width:0}
  .dv-editor label{display:flex;flex-direction:column;gap:6px}.dv-editor label strong{font-size:14px;font-weight:500}.dv-editor label p{font-size:12px}
  .dv-editor textarea{min-height:220px;width:100%}.dv-editor .dv-check{flex-direction:row;align-items:center;gap:8px}
  .dv-editor>.dv-buttons{justify-content:flex-end;border-top:var(--dv-border);padding-top:16px}
  .dv-message{white-space:pre-wrap;overflow-wrap:anywhere}.dv-message:empty{display:none}.dv-message[role=alert]{border-inline-start:3px solid var(--accent-primary);padding-inline-start:12px}
  .dv-settings [data-theme-surface=card],.dv-manager [data-theme-surface=card]{--dv-border:var(--border-width,1px) solid var(--theme-card-border,var(--border-color));border-radius:var(--theme-card-radius,var(--radius-component,8px));box-shadow:var(--theme-card-shadow,none)}
  .dv-settings [data-theme-surface=input],.dv-manager [data-theme-surface=input]{--dv-border:var(--border-width,1px) solid var(--theme-input-border,var(--border-color));border-radius:var(--theme-input-radius,var(--radius-component,6px));box-shadow:var(--theme-input-shadow,none)}
  .dv-dialog{--dv-border:var(--border-width,1px) solid var(--theme-overlay-border,var(--border-color));border-radius:var(--theme-overlay-radius,var(--radius-component,12px));box-shadow:var(--theme-overlay-shadow,none)}
  .dv-settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:calc(16px * var(--dv-space));min-width:0}
  .dv-section{display:flex;flex-direction:column;gap:12px;min-width:0;border:var(--dv-border);border-radius:var(--radius-component,10px);padding:calc(16px * var(--dv-space));background:var(--theme-card-bg,var(--bg-card))}
  .dv-section h2{font-size:calc(var(--font-size-base,14px) * 14 / 14);font-weight:600;margin:0}.dv-runtime{grid-column:1/-1}
  .dv-runtime-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.dv-runtime-heading p{font-size:12px}.dv-runtime-heading button{margin-inline-start:auto}.dv-runtime>p{font-size:12px}
  .dv-field{display:flex;flex-direction:column;gap:6px;margin:0}.dv-field strong{font-size:13px;font-weight:500}.dv-field input,.dv-field textarea{width:100%}.dv-field p{font-size:12px}
  .dv-section .dv-field:has(textarea){flex:1}.dv-field textarea{flex:1;min-height:260px}
  .dv-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dv-settings a{color:var(--accent-primary)}.dv-settings summary{cursor:pointer;color:var(--text-secondary)}.dv-settings pre{white-space:pre-wrap;overflow-wrap:anywhere}
  .dv-skills .dv-page-content{padding:0;overflow:hidden;gap:0}
  .dv-skills-layout{display:flex;flex:1;min-width:0;min-height:0}
  .dv-skills-sidebar{display:flex;flex-direction:column;width:280px;flex-shrink:0;min-height:0;border-inline-end:var(--dv-border);overflow:auto}
  .dv-skills-sidebar .dv-source-info{padding:12px;border-top:var(--dv-border);margin-top:auto}
  .dv-skills-sidebar .dv-message{padding:12px}
  .dv-skills .dv-items{display:flex;flex-direction:column;gap:2px;padding:8px}
  .dv-skill-group{margin:8px 4px 4px;font-size:12px;font-weight:500;color:var(--text-muted)}
  .dv-manager .dv-skill-select{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0;text-align:start;padding:8px 12px;border-color:transparent;background:transparent;white-space:normal}
  .dv-manager .dv-skill-select[aria-pressed=true]{background:color-mix(in srgb,var(--accent-primary) 10%,transparent);color:var(--text-primary)}
  .dv-skill-select strong,.dv-skill-select small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dv-skill-select strong{font-size:13px;font-weight:500}.dv-skill-select small{font-size:11px;color:var(--text-muted,var(--text-secondary))}.dv-skill-select .dv-summary{overflow:hidden}
  .dv-skill-dot{width:6px;height:6px;flex-shrink:0;border-radius:50%;background:var(--text-muted)}.dv-skill-dot.active{background:var(--success,var(--accent-primary))}
  .dv-skill-detail{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:auto;padding:calc(16px * var(--dv-space)) calc(20px * var(--dv-space));gap:12px}
  .dv-detail-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-bottom:12px;border-bottom:var(--dv-border)}.dv-detail-heading h2{margin:0;font-size:15px;font-weight:600;overflow-wrap:anywhere}
  .dv-file-heading{padding:8px 0;border-bottom:var(--dv-border);font:12px ui-monospace,monospace;color:var(--text-muted)}
  .dv-skill-content{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
  .dv-skills .dv-toolbar input{max-width:200px}.dv-manager .dv-back{display:none}
  @media(max-width:768px){.dv-page-header{padding:12px;gap:10px}.dv-page-content{padding:12px}.dv-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.dv-items,.dv-settings-grid{grid-template-columns:1fr}.dv-dialog{width:calc(100vw - 24px)}.dv-editor{padding:16px}.dv-manager .dv-toolbar input{max-width:none}.dv-runtime .dv-field{display:flex;align-items:stretch;gap:6px}.dv-skills-sidebar{width:100%;border:0}.dv-skill-detail{display:none;padding:12px}.dv-show-detail .dv-skills-sidebar{display:none}.dv-show-detail .dv-skill-detail{display:flex}.dv-manager .dv-back{display:inline-flex}.dv-skills .dv-toolbar{flex:1;justify-content:flex-end}.dv-skills .dv-toolbar input{width:100%;max-width:180px;flex-basis:120px}}
  .dv-editor [hidden],.dv-settings [hidden]{display:none}
  .dv-editor textarea.dv-description{min-height:0}
  .dv-row-heading h2{font-size:15px;font-weight:600;margin:0}
  .dv-mode-heading{font-size:13px;font-weight:600;margin:0}
  .dv-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .dv-mode{padding:10px 0;border-top:var(--dv-border)}
  .dv-mode p{font-size:12px}
  @media(max-width:768px){.dv-modes{grid-template-columns:1fr;gap:0}}

`
const messages = {
  en: {
    skills: 'Skills', mcp: 'MCP servers', settings: 'Configuration file', refresh: 'Refresh', reload: 'Reload',
    search: 'Search Skills', searchMcp: 'Search MCP servers', addSkill: 'Add skill', addMcp: 'Add MCP server',
    list: 'Skill list', select: 'Select a skill to view its details.',
    emptySkills: 'No skills yet. Add a skill to get started.', emptyMcp: 'No MCP servers yet. Add a server to get started.',
    noMatches: 'No matching items.', sources: 'Sources and when changes apply', location: 'Configuration location',
    global: 'Local global', total: 'Total', enabled: 'Enabled', disabled: 'Disabled', enable: 'Enable', disable: 'Disable',
    skillsInfo: 'Changes are saved to the Devin user directory and apply on the next turn. Project and imported skills are loaded by Devin in the selected project.',
    skillsLimit: 'Devin has no native enable switch for a user Skill.',
    mcpInfo: 'Changes are saved to the Devin user configuration and apply on the next turn. Project and organization settings can take precedence.',
    mcpAuth: 'Use devin mcp login <name> for OAuth authentication.',
    edit: 'Edit', remove: 'Delete', cancel: 'Cancel', save: 'Save', saving: 'Saving…', loading: 'Loading…',
    saved: 'Saved. Changes apply on the next turn.', deleted: 'Deleted. The change applies on the next turn.',
    deleteConfirm: 'Delete this item? The change applies on the next turn.',
    discard: 'Discard unsaved edits?', duplicate: 'This name already exists. Edit the existing item.',
    name: 'Name', skillName: 'Use letters, numbers, hyphens or underscores.',
    description: 'Description', descriptionTip: 'Describe when the skill should be used. This metadata is optional.',
    body: 'Skill content (Markdown)', raw: 'Full SKILL.md (Markdown)', fullFile: 'Edit full SKILL.md',
    rawOnly: 'This file needs the full Markdown editor to preserve its header.',
    serverConfig: 'Server configuration (JSON)',
    serverHelp: 'Use command / args / env, or url / transport / headers. Leave masked values in place to keep them.',
    nextTurn: 'Enable on the next turn', invalidJson: 'Enter a JSON object.',
    unknownTransport: 'Unrecognized transport',
    runtime: 'Runtime', status: 'Engine status', installed: 'Installed', missing: 'Not installed', unknown: 'Unavailable',
    managed: 'Studio-managed', external: 'External', manage: 'Open Agent management',
    install: 'Use Agent management to install Devin CLI or manage an existing Studio installation.',
    modes: 'Run modes', globalInfo: 'Uses the native Devin account and models on the Studio host. The selected project may override user configuration.',
    scopedInfo: 'Scoped mode is unavailable in the public Devin CLI integration. Studio’s model proxy and per-profile configuration do not apply here.',
    auth: 'Devin sign-in', authInfo: 'Run this command as the operating system account running Studio. For a Studio-managed install, use the full path to the managed binary.',
    importTitle: 'Native configuration', importLabel: 'Configuration imports (JSON)',
    importHelp: 'Edit read_config_from. Use true or false to set a user override and null to restore the default. Omitted keys are preserved.',
    example: 'Configuration example', importSources: 'Supported sources', docs: 'Devin configuration docs', authDocs: 'Devin sign-in docs',
  },
  zh: {
    skills: 'Skill 管理', mcp: 'MCP 管理', settings: '配置文件', refresh: '刷新', reload: '重新读取',
    search: '搜索名称或描述', searchMcp: '搜索 MCP 服务', addSkill: '添加 Skill', addMcp: '添加 MCP 服务',
    list: 'Skill 列表', select: '选择 Skill 查看详情。',
    emptySkills: '还没有 Skill，点击「添加 Skill」开始。', emptyMcp: '还没有 MCP 服务，点击「添加 MCP 服务」开始。',
    noMatches: '没有匹配的项目。', sources: '来源与生效方式', location: '配置位置',
    global: '本机全局', total: '全部', enabled: '已启用', disabled: '已停用', enable: '启用', disable: '停用',
    skillsInfo: '修改保存到 Devin 用户目录，下一轮生效。Devin 也会从所选项目加载项目及导入的 Skill。',
    skillsLimit: 'Devin 用户 Skill 没有原生启停开关。',
    mcpInfo: '修改保存到 Devin 用户配置，下一轮生效。项目和组织配置可能优先。',
    mcpAuth: 'MCP OAuth 请使用 devin mcp login <名称>。',
    edit: '编辑', remove: '删除', cancel: '取消', save: '保存', saving: '正在保存…', loading: '正在读取…',
    saved: '已保存，下一轮生效。', deleted: '已删除，下一轮生效。', deleteConfirm: '删除此项？修改将在下一轮生效。',
    discard: '放弃尚未保存的编辑？', duplicate: '名称已经存在，请编辑现有项目。',
    name: '名称', skillName: '使用字母、数字、连字符或下划线。',
    description: '描述', descriptionTip: '说明适合使用这个 Skill 的场景。此项可选。',
    body: 'Skill 内容（Markdown）', raw: '完整 SKILL.md（Markdown）', fullFile: '编辑完整 SKILL.md',
    rawOnly: '请在完整 Markdown 编辑器中保留原有文件头。',
    serverConfig: '服务配置（JSON）', serverHelp: '使用 command / args / env，或 url / transport / headers。在原字段保留遮罩即可保留该值。',
    nextTurn: '在下一轮运行中启用', invalidJson: '请填写 JSON 对象。', unknownTransport: '无法识别的传输类型',
    runtime: '运行环境', status: '引擎状态', installed: '已安装', missing: '未安装', unknown: '无法读取',
    managed: 'Studio 托管', external: '外部安装', manage: '打开 Agent 管理',
    install: '在 Agent 管理中安装 Devin CLI，或管理 Studio 托管的引擎。',
    modes: '运行模式', globalInfo: '使用 Studio 服务所在系统账号的原生 Devin 登录和模型。所选项目可以覆盖用户配置。',
    scopedInfo: '公开版 Devin CLI 的 Studio 接入不支持 Scoped。Studio 模型代理和按 Profile 隔离的配置不在此处生效。',
    auth: 'Devin 登录', authInfo: '请用运行 Studio 的系统账号执行命令。Studio 托管安装请使用托管二进制的完整路径。',
    importTitle: '原生配置', importLabel: '配置导入（JSON）',
    importHelp: '编辑 read_config_from。用 true 或 false 设置用户覆盖，用 null 恢复默认。省略字段则保留原值。',
    example: '查看配置示例', importSources: '支持的来源', docs: 'Devin 配置文档', authDocs: 'Devin 登录文档',
  },
  'zh-TW': {
    skills: 'Skill 管理', mcp: 'MCP 管理', settings: '設定檔', refresh: '重新整理', reload: '重新讀取',
    search: '搜尋名稱或描述', searchMcp: '搜尋 MCP 服務', addSkill: '新增 Skill', addMcp: '新增 MCP 服務',
    list: 'Skill 清單', select: '選取 Skill 查看詳情。',
    emptySkills: '目前沒有 Skill，請點選「新增 Skill」。', emptyMcp: '目前沒有 MCP 服務，請點選「新增 MCP 服務」。',
    noMatches: '沒有相符的項目。', sources: '來源與生效方式', location: '設定位置',
    global: '本機全域', total: '全部', enabled: '已啟用', disabled: '已停用', enable: '啟用', disable: '停用',
    skillsInfo: '變更儲存至 Devin 的使用者目錄，下一輪生效。Devin 也會載入所選專案及匯入的 Skill。',
    skillsLimit: 'Devin 使用者 Skill 沒有原生啟停開關。',
    mcpInfo: '變更儲存至 Devin 使用者設定，下一輪生效。專案與組織設定可能優先。',
    mcpAuth: 'MCP OAuth 請使用 devin mcp login <名稱>。',
    edit: '編輯', remove: '刪除', cancel: '取消', save: '儲存', saving: '正在儲存…', loading: '正在讀取…',
    saved: '已儲存，下一輪生效。', deleted: '已刪除，下一輪生效。', deleteConfirm: '刪除此項目？變更將在下一輪生效。',
    discard: '捨棄尚未儲存的編輯？', duplicate: '名稱已存在，請編輯既有項目。',
    name: '名稱', skillName: '使用字母、數字、連字號或底線。',
    description: '描述', descriptionTip: '說明適合使用這個 Skill 的情境。此項選填。',
    body: 'Skill 內容（Markdown）', raw: '完整 SKILL.md（Markdown）', fullFile: '編輯完整 SKILL.md',
    rawOnly: '請在完整 Markdown 編輯器中保留原有檔案標頭。',
    serverConfig: '服務設定（JSON）', serverHelp: '使用 command / args / env，或 url / transport / headers。在原欄位保留遮罩即可保留該值。',
    nextTurn: '下一輪執行時啟用', invalidJson: '請填寫 JSON 物件。', unknownTransport: '無法辨識的傳輸類型',
    runtime: '執行環境', status: '引擎狀態', installed: '已安裝', missing: '未安裝', unknown: '無法讀取',
    managed: 'Studio 管理', external: '外部安裝', manage: '開啟 Agent 管理',
    install: '在 Agent 管理中安裝 Devin CLI，或管理由 Studio 安裝的引擎。',
    modes: '執行模式', globalInfo: '使用執行 Studio 的系統帳號之原生 Devin 登入及模型。所選專案可覆寫使用者設定。',
    scopedInfo: '公開版 Devin CLI 的 Studio 整合不支援 Scoped。Studio 模型代理與依 Profile 隔離的設定不適用。',
    auth: 'Devin 登入', authInfo: '請使用執行 Studio 的系統帳號執行指令。Studio 管理的安裝請使用執行檔的完整路徑。',
    importTitle: '原生設定', importLabel: '設定匯入（JSON）',
    importHelp: '編輯 read_config_from。用 true 或 false 設定使用者覆寫，用 null 恢復預設。省略欄位則保留原值。',
    example: '查看設定範例', importSources: '支援的來源', docs: 'Devin 設定說明', authDocs: 'Devin 登入說明',
  },
}

function element(tag, text, className) {
  const node = document.createElement(tag)
  if (text) node.textContent = text
  if (className) node.className = className
  return node
}

function button(label, click, className) {
  const node = element('button', label, className)
  node.type = 'button'
  node.onclick = click
  return node
}

function card(className = 'dv-section') {
  const node = element('section', '', className)
  node.dataset.themeSurface = 'card'
  return node
}

function labelledInput(tag, label) {
  const input = element(tag)
  input.setAttribute('aria-label', label)
  input.spellcheck = false
  input.dataset.themeSurface = 'input'
  if (tag === 'textarea') input.dir = 'ltr'
  return input
}

function field(label, input, help) {
  const caption = element('strong', label)
  const wrapper = element('label', '', 'dv-field')
  wrapper.append(caption, input)
  if (help) wrapper.append(element('p', help))
  return { wrapper, caption }
}

function notice(initial = '') {
  const node = element('p', initial, 'dv-message')
  node.setAttribute('role', 'status')
  node.setAttribute('aria-live', 'polite')
  return node
}

function announce(node, message, error = false) {
  node.setAttribute('role', error ? 'alert' : 'status')
  node.textContent = message
}

function pathLabel(t) {
  const path = element('code', '', 'dv-source-path')
  path.setAttribute('aria-label', t.location)
  return path
}

function updateAccent(root) {
  const canvas = element('canvas')
  const paint = canvas.getContext('2d')
  if (!paint) return
  paint.fillStyle = getComputedStyle(root).getPropertyValue('--accent-primary').trim() || 'CanvasText'
  paint.fillRect(0, 0, 1, 1)
  const rgb = Array.from(paint.getImageData(0, 0, 1, 1).data.slice(0, 3), value => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  root.style.setProperty('--dv-on-accent', luminance > 0.179 ? '#000' : '#fff')
}

export async function mount(root, ctx) {
  if (!['skills', 'mcp', 'settings'].includes(ctx.view)) return
  const locale = (ctx.locale ?? 'en').replaceAll('_', '-').toLowerCase()
  const lang = locale === 'zh-tw' || locale.startsWith('zh-hant') ? 'zh-TW' : locale.split('-')[0]
  const t = messages[lang] ?? messages.en
  root.lang = messages[lang] ? lang : 'en'
  root.replaceChildren(element('style', themeStyles))
  updateAccent(root)
  const appearance = new MutationObserver(() => updateAccent(root))
  appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] })
  ctx.lifecycle.add(() => appearance.disconnect())
  if (ctx.view === 'settings') await mountSettings(root, ctx, t)
  else await mountResources(root, ctx, t)
}

async function mountResources(root, ctx, t) {
  const skills = ctx.view === 'skills'
  const kind = skills ? 'skill' : 'mcp'
  const title = skills ? t.skills : t.mcp
  let disposed = false
  let busy = false
  let loaded = false
  let items = []
  let listRevision = ''
  let selected = ''
  let editing = null
  let baseline = ''
  let skillDocument
  let detailGeneration = 0

  const container = element('section', '', 'dv-manager' + (skills ? ' dv-skills' : ''))
  const header = element('header', '', 'dv-page-header')
  const headerActions = element('div', '', 'dv-buttons')
  const toolbar = element('div', '', 'dv-toolbar')
  const search = labelledInput('input', skills ? t.search : t.searchMcp)
  search.type = 'search'
  search.placeholder = search.getAttribute('aria-label')
  const add = button(skills ? t.addSkill : t.addMcp, () => openEditor(), 'primary')
  const refresh = button(t.refresh, () => operation(load), 'quiet')
  headerActions.append(refresh)
  toolbar.append(search)
  if (skills) {
    headerActions.append(add)
    header.append(element('h1', title), toolbar, headerActions)
  } else {
    toolbar.append(add)
    header.append(element('h1', title), headerActions)
  }

  const body = element('div', '', 'dv-page-content')
  const path = pathLabel(t)
  const source = element('details', '', 'dv-source-info')
  source.append(element('summary', t.sources), element('p', skills ? t.skillsInfo : t.mcpInfo), path)
  if (!skills) source.append(element('p', t.mcpAuth))
  const status = notice(t.loading)
  const list = element('div', '', 'dv-items')
  const detail = element('section', '', 'dv-skill-detail')
  const counts = []
  if (skills) {
    const layout = element('div', '', 'dv-skills-layout')
    const sidebar = element('aside', '', 'dv-skills-sidebar')
    sidebar.setAttribute('aria-label', t.list)
    sidebar.append(status, list, source)
    layout.append(sidebar, detail)
    body.append(layout)
  } else {
    const stats = element('div', '', 'dv-stats')
    for (const [label, decoration] of [[t.total, ''], [t.enabled, ' active'], [t.disabled, '']]) {
      const stat = card('dv-stat' + decoration)
      const count = element('strong', '0')
      counts.push(count)
      stat.append(element('span', label), count)
      stats.append(stat)
    }
    body.append(status, stats, toolbar, source, list)
  }

  const dialog = element('dialog', '', 'dv-dialog')
  const editor = element('form', '', 'dv-editor')
  dialog.append(editor)
  const editorHeading = element('h2')
  const editorStatus = notice()
  const fields = element('fieldset')
  const name = labelledInput('input', t.name)
  name.required = true
  name.maxLength = skills ? 64 : 100
  const description = labelledInput('textarea', t.description)
  description.rows = 2
  description.className = 'dv-description'
  description.maxLength = 16384
  const descriptionField = field(t.description, description, t.descriptionTip)
  const contentLabel = skills ? t.body : t.serverConfig
  const content = labelledInput('textarea', contentLabel)
  content.required = true
  content.maxLength = 1048576
  const contentField = field(contentLabel, content, skills ? undefined : t.serverHelp)
  const toggleField = element('label', '', 'dv-check')
  const option = labelledInput('input', skills ? t.fullFile : t.nextTurn)
  option.type = 'checkbox'
  toggleField.append(option, element('span', skills ? t.fullFile : t.nextTurn))
  const rawHelp = element('p', t.rawOnly)
  fields.append(field(t.name, name, skills ? t.skillName : undefined).wrapper)
  if (skills) fields.append(descriptionField.wrapper, rawHelp)
  fields.append(contentField.wrapper, toggleField)
  const editorActions = element('div', '', 'dv-buttons')
  const cancel = button(t.cancel, requestClose)
  const save = button(t.save, saveEditor, 'primary')
  editorActions.append(cancel, save)
  editor.append(editorHeading, fields, editorStatus, editorActions)
  container.append(header, body, dialog)
  root.append(container)
  ctx.lifecycle.add(() => {
    disposed = true
    dialog.close()
  })
  dialog.oncancel = event => {
    event.preventDefault()
    void requestClose()
  }
  editor.onsubmit = saveEditor
  editor.onkeydown = event => {
    if (event.key === 'Enter' && !event.isComposing && event.target.type === 'text') {
      event.preventDefault()
      saveEditor()
    }
  }
  search.oninput = renderList
  if (skills) option.onchange = changeSkillMode

  const rpc = (method, input = null) => ctx.rpc.call(method, input)
  const draft = () => JSON.stringify([name.value, description.value, content.value, skills ? undefined : option.checked])
  const message = () => dialog.open ? editorStatus : status

  function setBusy(value) {
    busy = value
    container.setAttribute('aria-busy', String(value))
    refresh.disabled = value
    search.disabled = value || !loaded
    add.disabled = value || !loaded
    fields.disabled = value
    save.disabled = value
    cancel.disabled = value
    for (const control of container.querySelectorAll('.dv-items button,.dv-skill-detail button')) control.disabled = value || control.dataset.unavailable === 'true'
  }

  async function operation(action, success = '') {
    if (busy || disposed) return
    setBusy(true)
    announce(message(), loaded ? '' : t.loading)
    try {
      await action()
      if (!disposed && success) announce(message(), success)
    } catch (error) {
      if (!disposed) announce(message(), error.message, true)
    } finally {
      if (!disposed) setBusy(false)
    }
  }

  async function load() {
    const result = await rpc(skills ? 'list-skills' : 'list-mcp')
    if (disposed) return
    items = skills ? result.summaries : result.servers
    path.textContent = result.path
    if (!skills) {
      listRevision = result.revision
      const enabled = items.filter(item => item.enabled).length
      for (const [index, count] of [items.length, enabled, items.length - enabled].entries()) {
        counts[index].textContent = String(count)
      }
    }
    loaded = true
    renderList()
  }

  function readSkill(item) {
    item.document ??= rpc('get-skill', { name: item.name }).catch(error => {
      delete item.document
      throw error
    })
    return item.document
  }

  function setSkillMode(raw) {
    option.checked = raw
    const label = raw ? t.raw : t.body
    content.setAttribute('aria-label', label)
    contentField.caption.textContent = label
    descriptionField.wrapper.hidden = raw
    description.value = raw ? '' : skillDocument.description
    content.value = raw ? skillDocument.content : skillDocument.content.slice(skillDocument.bodyOffset)
    baseline = draft()
  }

  async function changeSkillMode() {
    const raw = option.checked
    try {
      if (baseline !== draft() && !await ctx.ui.confirm(t.discard)) option.checked = !raw
      else if (!disposed) setSkillMode(raw)
    } catch (error) {
      option.checked = !raw
      if (!disposed) announce(editorStatus, error.message, true)
    }
  }

  function closeEditor() {
    dialog.close()
    add.focus()
  }

  async function requestClose() {
    if (busy || disposed) return
    try {
      if (baseline === draft() || await ctx.ui.confirm(t.discard)) {
        if (!disposed) closeEditor()
      }
    } catch (error) {
      if (!disposed) announce(editorStatus, error.message, true)
    }
  }

  async function openEditor(item = null) {
    await operation(async () => {
      let value
      if (item) value = skills ? await readSkill(item) : await rpc('get-mcp', { name: item.name })
      if (disposed) return
      if (item && !skills && !value.content) throw new Error(t.noMatches)
      editing = item
      name.value = item?.name ?? ''
      name.disabled = Boolean(item)
      const label = item ? t.edit + ' ' + item.name : skills ? t.addSkill : t.addMcp
      editorHeading.textContent = label
      dialog.setAttribute('aria-label', label)
      announce(editorStatus, '')
      dialog.dataset.revision = value?.revision ?? (skills ? '' : listRevision)
      if (skills) {
        skillDocument = value ?? { content: '', description: '', bodyOffset: 0 }
        const rawOnly = skillDocument.bodyOffset === undefined
        toggleField.hidden = rawOnly
        rawHelp.hidden = !rawOnly
        setSkillMode(rawOnly)
      } else {
        const config = item ? JSON.parse(value.content) : { command: 'npx', args: [] }
        if (config && typeof config === 'object' && !Array.isArray(config)) delete config.disabled
        content.value = JSON.stringify(config, null, 2)
        option.checked = item?.enabled ?? true
        baseline = draft()
      }
      dialog.showModal()
    })
    if (dialog.open && !disposed) (item ? content : name).focus()
  }

  function saveEditor(event) {
    event?.preventDefault()
    if (busy || !editor.reportValidity()) return
    void operation(async () => {
      const input = { name: name.value.trim(), content: content.value, revision: dialog.dataset.revision }
      if (!editing && items.some(item => item.name === input.name)) throw new Error(t.duplicate)
      if (skills) {
        if (!option.checked) input.description = description.value
      } else {
        let config
        try { config = JSON.parse(content.value) } catch { throw new Error(t.invalidJson) }
        if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(t.invalidJson)
        if (option.checked) delete config.disabled
        else config.disabled = true
        input.content = JSON.stringify(config)
        input.create = !editing
      }
      await rpc('save-' + kind, input)
      if (disposed) return
      if (skills) selected = input.name
      closeEditor()
      await load()
    }, t.saved)
  }

  function itemActions(item) {
    const actions = element('div', '', 'dv-buttons')
    const edit = button(t.edit, () => openEditor(item), 'quiet')
    edit.setAttribute('aria-label', t.edit + ' ' + item.name)
    const remove = button(t.remove, () => operation(async () => {
      if (!await ctx.ui.confirm(t.deleteConfirm + ' (' + item.name + ')') || disposed) return
      const revision = skills ? (await readSkill(item)).revision : listRevision
      if (disposed) return
      await rpc('remove-' + kind, { name: item.name, revision })
      await load()
      if (!disposed) announce(status, t.deleted)
    }), 'quiet danger')
    remove.setAttribute('aria-label', t.remove + ' ' + item.name)
    actions.append(edit, remove)
    return actions
  }

  function renderDetail(item) {
    const generation = ++detailGeneration
    detail.replaceChildren()
    if (!item) {
      detail.append(element('p', t.select, 'dv-empty'))
      return
    }
    const heading = element('div', '', 'dv-detail-heading')
    const back = button(t.list, () => {
      container.classList.remove('dv-show-detail')
      list.querySelector('[aria-pressed=true]')?.focus()
    }, 'dv-back quiet')
    heading.append(back, element('h2', item.name), itemActions(item))
    const badges = element('div', '', 'dv-badges')
    badges.append(element('span', t.global, 'dv-badge'))
    const file = element('code', path.textContent + '/' + item.name + '/SKILL.md', 'dv-source-path')
    const description = element('p', item.description)
    const preview = element('pre', t.loading, 'dv-skill-content')
    detail.append(heading, badges, description, element('p', t.skillsLimit, 'dv-source-info'), file, element('div', 'SKILL.md', 'dv-file-heading'), preview)
    void readSkill(item).then(value => {
      if (disposed || generation !== detailGeneration) return
      description.textContent = value.description || ''
      description.hidden = !value.description
      preview.textContent = value.content.slice(value.bodyOffset ?? 0)
    }, error => {
      if (!disposed && generation === detailGeneration) announce(preview, error.message, true)
    })
  }

  function renderSkillList(filtered) {
    if (!filtered.some(item => item.name === selected)) selected = filtered[0].name
    list.append(element('h2', t.global + ' · ' + filtered.length, 'dv-skill-group'))
    for (const item of filtered) {
      const row = element('article')
      const summary = element('span', '', 'dv-summary')
      summary.append(element('strong', item.name))
      if (item.description) summary.append(element('small', item.description))
      const select = button('', () => {
        selected = item.name
        container.classList.add('dv-show-detail')
        renderList()
        const target = matchMedia('(max-width:768px)').matches
          ? detail.querySelector('.dv-back') : list.querySelector('[aria-pressed=true]')
        target?.focus()
      }, 'dv-skill-select')
      select.setAttribute('aria-label', item.name + ' · ' + t.global)
      select.setAttribute('aria-pressed', String(selected === item.name))
      select.append(summary)
      row.append(select)
      list.append(row)
    }
    renderDetail(filtered.find(item => item.name === selected))
  }

  function renderMcpCards(filtered) {
    const labels = { stdio: 'stdio', http: 'HTTP', sse: 'SSE', unknown: t.unknownTransport }
    for (const item of filtered) {
      const row = card('dv-row')
      const summary = element('div', '', 'dv-summary')
      const heading = element('div', '', 'dv-row-heading')
      const badges = element('div', '', 'dv-badges')
      badges.append(element('span', labels[item.transport], 'dv-badge'), element('span', t.global, 'dv-badge'),
        element('span', item.enabled ? t.enabled : t.disabled, 'dv-badge' + (item.enabled ? ' active' : '')))
      heading.append(element('h2', item.name), badges)
      summary.append(heading)
      if (item.target) summary.append(element('p', item.target))
      const toggle = button('', () => operation(async () => {
        await rpc('set-mcp-enabled', { name: item.name, revision: listRevision, enabled: !item.enabled })
        await load()
      }, t.saved), 'dv-switch')
      if (item.transport === 'unknown') toggle.dataset.unavailable = 'true'
      toggle.setAttribute('role', 'switch')
      toggle.setAttribute('aria-checked', String(item.enabled))
      toggle.setAttribute('aria-label', (item.enabled ? t.disable : t.enable) + ' ' + item.name)
      const footer = element('div', '', 'dv-row-footer')
      footer.append(itemActions(item), toggle)
      row.append(summary, footer)
      list.append(row)
    }
  }

  function renderList() {
    list.replaceChildren()
    const query = search.value.trim().toLocaleLowerCase()
    const filtered = items.filter(item => [item.name, item.description, item.transport, item.target]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(query))
    if (!filtered.length) {
      if (loaded) list.append(element('p', items.length ? t.noMatches : skills ? t.emptySkills : t.emptyMcp, 'dv-empty'))
      if (skills) {
        container.classList.remove('dv-show-detail')
        renderDetail(null)
      }
      return
    }
    if (skills) renderSkillList(filtered)
    else renderMcpCards(filtered)
  }

  await operation(load)
}

function docLink(label, href) {
  const link = element('a', label)
  link.href = href
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  return link
}

async function mountSettings(root, ctx, t) {
  let disposed = false
  let busy = false
  let revision
  let baseline = ''

  const container = element('section', '', 'dv-settings')
  const header = element('header', '', 'dv-page-header')
  const actions = element('div', '', 'dv-actions')
  const save = button(t.save, saveSettings, 'primary')
  const reload = button(t.reload, reloadSettings)
  actions.append(save, reload)
  header.append(element('h1', t.settings), actions)
  const content = element('div', '', 'dv-page-content')
  const status = notice(t.loading)
  const grid = element('div', '', 'dv-settings-grid')
  const runtime = card('dv-section dv-runtime')
  const runtimeHeading = element('div', '', 'dv-runtime-heading')
  const version = element('p', t.loading)
  const engineError = notice()
  const installHelp = element('p', t.install)
  installHelp.hidden = true
  const manage = button(t.manage, async () => {
    try { await ctx.ui.navigate('/studio/agents') }
    catch (error) { if (!disposed) announce(status, error.message, true) }
  })
  runtimeHeading.append(element('h2', t.runtime), version, manage)
  runtime.append(runtimeHeading, engineError, installHelp, element('h3', t.modes, 'dv-mode-heading'))
  const modes = element('div', '', 'dv-modes')
  for (const [mode, description] of [['Global', t.globalInfo], ['Scoped', t.scopedInfo]]) {
    const group = element('div', '', 'dv-mode')
    group.append(element('strong', mode), element('p', description))
    modes.append(group)
  }
  runtime.append(modes)

  const account = card()
  account.append(element('h2', t.auth), element('p', t.authInfo),
    element('code', 'devin auth login', 'dv-source-path'),
    docLink(t.authDocs, 'https://docs.devin.ai/cli/enterprise/devin-auth'))

  const configuration = card()
  const editor = labelledInput('textarea', t.importLabel)
  editor.maxLength = 1048576
  const example = element('details')
  const supported = element('p')
  example.append(element('summary', t.example),
    element('pre', '{\n  "read_config_from": {\n    "claude": false,\n    "cursor": null\n  }\n}'),
    supported, docLink(t.docs, 'https://docs.devin.ai/cli/reference/configuration/read-config-from'))
  const location = pathLabel(t)
  configuration.append(element('h2', t.importTitle), field(t.importLabel, editor, t.importHelp).wrapper,
    example, location)
  grid.append(runtime, account, configuration)
  content.append(status, grid)
  container.append(header, content)
  root.append(container)
  ctx.lifecycle.add(() => { disposed = true })

  function setBusy(value) {
    busy = value
    container.setAttribute('aria-busy', String(value))
    editor.disabled = value || revision === undefined
    save.disabled = editor.disabled
    reload.disabled = value
  }

  function renderRuntime(result) {
    if (result.status === 'rejected') {
      version.textContent = t.status + ' · ' + t.unknown
      installHelp.hidden = true
      announce(engineError, result.reason.message, true)
      return
    }
    const engine = result.value
    const source = engine.source === 'external' ? t.external : t.managed
    const engineStatus = engine.installed
      ? [t.installed, engine.version, source].join(' · ') : engine.error ? t.unknown : t.missing
    version.textContent = t.status + ' · ' + engineStatus
    installHelp.hidden = engine.installed || Boolean(engine.error)
    announce(engineError, engine.error ?? '', Boolean(engine.error))
  }

  async function load() {
    const [runtime, configuration] = await Promise.allSettled([
      ctx.rpc.call('get-runtime', null), ctx.rpc.call('get-settings', null),
    ])
    if (disposed) return
    renderRuntime(runtime)
    if (configuration.status === 'rejected') throw configuration.reason
    const result = configuration.value
    revision = result.revision
    location.textContent = result.path
    supported.textContent = t.importSources + ' · ' + result.supportedImports.join(', ')
    editor.value = result.content
    baseline = editor.value
  }

  async function operation(action, initial, success = '') {
    if (busy || disposed) return
    announce(status, initial)
    setBusy(true)
    try {
      await action()
      if (!disposed) announce(status, success)
    } catch (error) {
      if (!disposed) announce(status, error.message, true)
    } finally {
      if (!disposed) setBusy(false)
    }
  }

  async function reloadSettings() {
    if (busy || disposed) return
    try {
      if (editor.value === baseline || await ctx.ui.confirm(t.discard)) {
        await operation(load, t.loading)
      }
    } catch (error) {
      if (!disposed) announce(status, error.message, true)
    }
  }

  function saveSettings() {
    void operation(async () => {
      let patch
      try { patch = JSON.parse(editor.value) } catch { throw new Error(t.invalidJson) }
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error(t.invalidJson)
      await ctx.rpc.call('save-settings', { revision, content: editor.value })
      baseline = editor.value
      await load()
    }, t.saving, t.saved)
  }

  await operation(load, t.loading)
}
