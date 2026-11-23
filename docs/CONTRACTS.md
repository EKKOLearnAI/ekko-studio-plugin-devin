# Devin CLI 运行契约

Studio Agent API v1。插件与局部 Agent ID 均为 `devin`。入口 `server.mjs` 在 `apply(ctx)` 注册 Agent，随插件停用注销。声明 `global`、`chat`、`streaming: true`、`resume: false`。插件通过现有 Agent SDK 管理安装、检查更新、升级和删除。运行会话沿用原有契约。

## 托管引擎

- 官方 npm `devin@latest` 发布条目按当前平台标识对应包，例如 macOS arm64 使用 `devin@3000.14.30821-darwin-arm64`。插件校验 Cognition 仓库、包名、版本、OS、架构、固定下载地址、SHA-512 和解包路径，随后核对二进制版本，并用独立临时 Home 运行 ACP v1 握手。
- Studio 通过 `getStatus`、`checkUpdate`、`upgrade` 和 `remove` 管理引擎。首次安装使用当前稳定发行版。操作串行执行，校验当前版本与预期版本。新包在插件私有 `engine/release-…` 目录暂存，校验通过后以原子文件切换发布。升级失败、取消或版本不匹配时保留当前引擎。旧版回收后不再参与路径解析。
- `current.json` 的 `schemaVersion` 为 1。存在 `release` 时使用对应的原生内嵌二进制。旧版 0.1.0 无此文件，继续检测原有外部 CLI。托管删除后保存只有 `schemaVersion` 的记录，使偶然出现的 PATH 安装保持非活动。显式的绝对路径覆盖仍有最高优先级。
- 外部 PATH、Homebrew、官方安装器和 npm 安装由原发行工具管理。插件的托管回收范围是私有引擎目录下的活动版本。Devin 原生登录、配置、日志、会话、用户文件及外部路径位于该范围之外。公共宿主按静态管理能力绘制按钮，外部安装的删除请求由插件明确拒绝。
- scoped 的 Studio 契约要求真正使用 `run.model` 对应的代理地址和凭证。常规 Devin ACP 提供 Cognition 原生模型选择。官方发布包的合作伙伴文档把自定义端点限定在单独审批的构建，本版只登记 `global`。

## 原生用户设置

- Agent `management.settings` 返回本插件 `skills` 视图。清单用 `agent-settings` 声明 `skills`、`mcp`、`settings` 三个入口。设置页和 RPC 校验实际 Studio `run.identity` 中的激活者和 Profile。RPC 全部在 `contracts/plugin.json` 注册和校验，并随插件停用释放。
- 原生根目录由 Global CLI 子进程继承的系统环境决定。页面路径使用同样的 `HOME`、`XDG_CONFIG_HOME` 或 `APPDATA`，且只访问固定文件。请求携带基于文件字节的版本，避免用旧页面内容覆盖新文件。写入通过同目录临时文件和原子替换完成，取消和冲突会阻止写入。普通读取不创建目录。符号链接文件和原生根目录内的链接目录不进入读写范围。
- Skill 入口读取直接用户 `skills/<名称>/SKILL.md`。原样写入 Markdown，删除只移除该文件。MCP 执行文件编辑不会测试连接或启动本地命令。启动后的 CLI 自行处理 MCP 连接、版本优先级、凭证和工具审批。MCP 管理在检测到早期引擎或仍存在旧内联配置时停止操作。
- 设置 RPC 只读写 `config.json` 的本地 `read_config_from` 开关。支持 `agents_standard`、`cursor`、`windsurf`、`claude`、`copilot`、`codex`、`kiro`、`opencode`、`zed`。保留所有未编辑字段和其周围 JSONC 内容。设置页和引擎目录互相独立，托管引擎移除后原生配置继续可用。
- `.devin`、项目本地文件、兼容目录和组织策略由 CLI 启动后解析。宿主 Agent 设置回调没有绑定到可信工作区，独立的项目管理入口需要宿主契约提供工作区授权。公开 CLI 当前只有 Global 注册。

JSONC 解析及增加/替换使用 vendored Microsoft jsonc-parser 3.3.1。文件来自 npm 包 `lib/esm/main.js` 和它的依赖，由 esbuild 打包为可独立导入的 ESM。许可见 `vendor/LICENSE.jsonc-parser`。 [上游发行版本](https://github.com/microsoft/node-jsonc-parser/tree/v3.3.1)

## 进程和账号

- `engine.mjs` 从 Studio 进程 PATH、常用用户安装位置或绝对路径 `EKKO_DEVIN_EXECUTABLE` 查找外部引擎。管理页使用 `devin --version` 探测。Windows 支持官方安装器和官方 npm 包中的原生 `devin.exe`。
- 官方 ACP 入口为 `devin acp`。插件加上官方 `--process-model in-process` 参数，使每轮的进程及资源由 Studio 管理。工作目录为当前受信 Studio 工作区的绝对真实路径。子进程环境按允许列表传递 OS、XDG、终端路径及网络配置。
- 初始握手使用 ACP v1。Devin 3000.14.30821 的引擎名是 `affogato`，未登录时仍返回创建会话成功。若模型目录为空，插件检查 `devin auth status`；提示响应的 ACP `-32000` 映射成统一登录指引。插件通过原生 CLI 登录状态运行，Studio 模型代理凭证和任意父进程变量留在宿主。
- 进入目录查询、创建会话和运行时检查激活者的 Studio 用户及 Profile。运行时还检查 Agent 和 Studio 会话身份。该边界与本机 Devin 原生登录是两层身份，安装者需用 Studio 服务进程所在的 OS 账号登录 Devin。

## 每轮数据、会话与结束

- ACP 会话创建与加载传入当前工作区和同轮 MCP 配置，检查远程协议协商。原生模型及可选推理档位来自会话配置。显式选择需经 ACP 确认，失败时终止该轮。
- 从 Studio 附件服务读取图片和文件字节，按 ACP 协商传入图片或嵌入资源。每轮当前内容和回退历史合计最多 8 MiB 附件数据。单个 ACP 帧最多 16 MiB。格式或协议不支持时返回错误。
- 仅在上次提示成功，仍是同一 Studio Agent 实例、工作区和引擎路径时尝试 `session/load`。加载期间的历史通知不流入新一轮。缺少加载能力、不支持该方法或原生会话不存在时，创建新会话并连同 Studio 历史发送。加载锁定或其他加载错误会显式失败。宿主重启或一次失败/取消后由 Studio 历史接续，插件不写原生 ID 检查点。
- 文本增量合成一次最终文本回复。工具事件只传名称、状态和通用结果。终端和文件行为保留 Devin 的策略；需要 ACP 审批时只处理当前会话，映射为一次允许、拒绝或取消。标题中的常见凭证格式会被遮蔽。原始参数、工具结果、ACP 错误详情和进程 stderr 留在原生进程边界内。
- 取消、超时和释放活动会话都会向当前原生 ID 发送 `session/cancel`，取消待处理的审批，丢弃迟到事件并关闭进程。关闭时先给 ACP 短暂退出时间，再回收子进程。官方 CLI 在自己的数据目录记录原生日志和会话。
