# Devin CLI for Ekko Studio

在 Studio 中通过 Cognition 的原生 ACP 接口使用本地 Devin CLI。Agent ID 为 `plugin:devin/devin`。支持「全局」流式单聊、托管 CLI 安装和更新，以及原生用户 Skill、MCP 和配置导入管理。

## Install

1. 在 **Studio → 插件中心 → 从来源安装** 输入本插件检出的绝对路径，确认信任后启用。开发调试可用 `ekko-studio plugins link /absolute/path/to/plugin`，然后在同一 Studio 实例启用开发项目。
2. 在 **Studio → Agent 管理 → Devin CLI** 中点「安装」。Studio 从官方 npm 平台包安装原生 CLI。后续可在这里检查更新、应用新版本或删除托管引擎。Studio 服务端需能访问 npm registry，并提供系统 `tar`（Windows 为 `System32\tar.exe`）。
3. 用运行 Studio 的同一个系统账号执行 `devin auth login` 并在浏览器登录。直接用托管 CLI 登录时，从 Studio 状态目录的 `plugins/global/plugin-data/devin/engine/current.json` 读取 `release`。该目录下的 `<release>/package/bin/devin`（Windows 为 `devin.exe`）是完整路径，用它执行 `auth login` 和 `auth status`。企业账号可能需要 **Use Devin CLI** 权限。 [Devin Auth](https://docs.devin.ai/cli/enterprise/devin-auth)
4. 新建单聊，选择 Devin CLI「全局」及项目目录。可以选取 Devin 原生模型或使用默认模型。

已有官方 CLI 可通过服务进程 PATH 自动识别。也可设置 `EKKO_DEVIN_EXECUTABLE` 为二进制的绝对路径后重启 Studio。外部 CLI 的更新和删除由原安装工具负责。Studio 的「删除」动作遇到外部引擎会报明原因并退出。托管删除只回收该引擎，原生登录、配置、日志、会话与外部安装继续可用。手动安装请参阅 [Devin CLI 快速入门](https://docs.devin.ai/cli)。

## Skill、MCP 与配置

在 **Studio → Agent 管理 → Devin CLI → 设置** 进入 **Skill / MCP / 设置**。这三个页面面向启用插件的 Studio 账号和 Profile，编辑 Studio 服务进程所属系统账号的 Devin 用户文件。macOS 和 Linux 使用 `$XDG_CONFIG_HOME/devin`，未设置时使用 `$HOME/.config/devin`。Windows 使用 `%APPDATA%/devin`。界面显示实际路径。相对或空的 `XDG_CONFIG_HOME` 和不明确的 `APPDATA` 会阻止编辑，避免运行目录变化引发错写。

| 页面 | 文件 | 操作 |
| --- | --- | --- |
| **Skill** | `skills/<名称>/SKILL.md` | 新建、编辑和删除直接用户 Skill 的 Markdown。删除保留目录及参考文件。停用开关不属于原生 Skill 格式。 |
| **MCP** | `mcp_config.json` 的 `mcpServers` | 新建、编辑、启用、停用和删除。可编辑 stdio 命令、Streamable HTTP 与 SSE 连接。已知凭证字段、环境变量和请求头会遮罩，保留同一字段的遮罩可保留原值。CLI 3000.3 起使用此文件。发现旧式内联 MCP 时，先由新版 CLI 启动完成官方迁移。 |
| **设置** | `config.json` 的 `read_config_from` | 编辑已文档化的本地导入来源。用 `true` 或 `false` 显式设置，用 `null` 删除该用户覆盖。省略字段会保留原值。示例 `{"read_config_from":{"claude":false}}`。 |

保存后，下一次启动的 Devin 进程读取文件。Global ACP 也会按所选项目加载 `.devin` 配置、项目本地覆盖和兼容来源。管理页只显示直接用户 Skill 和 MCP，启用状态表示用户文件里的声明。项目同名 MCP、项目导入规则和组织策略可影响最终结果。研发模式也会使用服务进程的原生配置目录，因此调试写入请使用独立的 Studio 状态和系统测试目录。符号链接、无效配置和过期文件版本会拒绝写入。

MCP 的登录或令牌清理在服务所属系统账号的 CLI 执行 `devin mcp login <名称>` 或 `devin mcp logout <名称>`。管理页保留原文件中其他服务器和设置。替换某个 MCP 条目会重写该条目内部，条目内部的 JSONC 注释可能改变。遮罩识别常见字段，内嵌在命令参数、Skill 内容或任意自定义值里的秘密仍可能显示。

项目级管理、旧式配置目录和导入来源文件的直接编辑需要用原生 CLI 或编辑器。设置页的编辑范围为本地导入开关。ACP 验收中修改 `permission_mode` 没有改变会话启动模式。主题、CLI 自更新、模型默认值和组织策略遵循原生行为或现有 Studio 模型选择，均在此页管理范围之外。

[Skill 格式](https://docs.devin.ai/cli/extensibility/skills/creating-skills) · [MCP 配置](https://docs.devin.ai/cli/extensibility/mcp/configuration) · [配置导入](https://docs.devin.ai/cli/reference/configuration/read-config-from) · [配置优先级](https://docs.devin.ai/cli/reference/configuration/global-vs-local)

## 运行与权限

- **全局**以启用插件的 Studio 账号及 Profile 为边界，使用 Studio 服务所属系统账号的 Devin 登录、原生模型和权限配置。Devin 发出 ACP 审批时，Studio 提供「仅本次允许」与「拒绝」。由原生策略直接处理的动作仍按 Devin 的配置执行。
- **Studio 模型（scoped）**需要 CLI 将模型请求发送到 Studio 当轮分配的模型代理。公开版 Devin 的 ACP 和用户配置只提供原生模型选择。官方包中的合作伙伴版文档说明，自定义推理端点属于需 Cognition 审批的单独发行版。公开版没有通过 Studio 模型代理的回环验收，插件保留全局模式。 [Devin 模型](https://docs.devin.ai/cli/models) · [ACP 接入](https://docs.devin.ai/cli/acp/zed)
- Studio 传递文本、图片字节和嵌入式文件内容，每轮附件总量上限 8 MiB。按 CLI 协商能力传入当前轮绑定的 Studio MCP。
- 点击「停止」会取消当前原生提示并回收 ACP 进程。Studio 的 Agent 实例存续时，成功轮次可复用同一原生会话。Studio 重启或一次中断后，由 Studio 历史接续到新原生会话。
- 适配器使用 MIT 许可。JSONC 编辑使用随插件分发的 Microsoft jsonc-parser 3.3.1，附 MIT 许可。托管引擎从 Cognition 官方 npm 包独立下载，保留随包分发的文档和 npm 安装标记。 [官方 npm 发布流程](https://github.com/CognitionAI/devin-cli/blob/main/DEVELOPMENT.md#npm-publishing)

## 图标来源

插件随附的 `assets/icon.png` 是适配器的原创字母 D 图标。Devin 产品标识和 Cognition 官方品牌素材见 [Devin 品牌页](https://devin.ai/brand)。

## 开发与复验

需要 Node.js 24.2 或更新的 24.x。发布包覆盖 macOS、Linux 与 Windows 的 x64 和 arm64 平台。原生验收环境为 macOS arm64，测试覆盖官方版本 3000.13.4 和 3000.14.30821。其他平台原生安装、真实账号推理、推理期间取消、第三方 MCP OAuth 和生产附件仍待实测。设置页已用官方 CLI 3000.14.30821 验证原生 ACP 加载 Skill、初始化本地 HTTP MCP，以及应用 Claude 导入开关。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run harness:check
npm test
npm pack --dry-run --ignore-scripts
EKKO_DEVIN_NATIVE_TEST_CLI=/absolute/path/to/devin npm test
```

[运行契约](docs/CONTRACTS.md) · [Studio SDK 开发说明](docs/DEVELOPMENT.md) · [Cognition 官方发行仓库](https://github.com/CognitionAI/devin-cli) · [ACP 官方目录](https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json)
