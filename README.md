# Devin CLI for Ekko Studio

在 Studio 中通过 Cognition 的原生 ACP 接口使用本地 Devin CLI。Agent ID 为 `plugin:devin/devin`。0.2.0 提供托管安装、检查更新、升级和删除，以及「全局」流式单聊。

## Install

1. 在 **Studio → 插件中心 → 从来源安装** 输入本插件检出的绝对路径，确认信任后启用。开发调试可用 `ekko-studio plugins link /absolute/path/to/plugin`，然后在同一 Studio 实例启用开发项目。
2. 在 **Studio → Agent 管理 → Devin CLI** 中点「安装」。Studio 从官方 npm 平台包安装原生 CLI。后续可在这里检查更新、应用新版本或删除托管引擎。Studio 服务端需能访问 npm registry，并提供系统 `tar`（Windows 为 `System32\tar.exe`）。
3. 用运行 Studio 的同一个系统账号执行 `devin auth login` 并在浏览器登录。直接用托管 CLI 登录时，从 Studio 状态目录的 `plugins/global/plugin-data/devin/engine/current.json` 读取 `release`。该目录下的 `<release>/package/bin/devin`（Windows 为 `devin.exe`）是完整路径，用它执行 `auth login` 和 `auth status`。企业账号可能需要 **Use Devin CLI** 权限。 [Devin Auth](https://docs.devin.ai/cli/enterprise/devin-auth)
4. 新建单聊，选择 Devin CLI「全局」及项目目录。可以选取 Devin 原生模型或使用默认模型。

已有官方 CLI 可通过服务进程 PATH 自动识别。也可设置 `EKKO_DEVIN_EXECUTABLE` 为二进制的绝对路径后重启 Studio。外部 CLI 的更新和删除由原安装工具负责。Studio 的「删除」动作遇到外部引擎会报明原因并退出。托管删除只回收该引擎，原生登录、配置、日志、会话与外部安装继续可用。手动安装请参阅 [Devin CLI 快速入门](https://docs.devin.ai/cli)。

## 运行与权限

- **全局**以启用插件的 Studio 账号及 Profile 为边界，使用 Studio 服务所属系统账号的 Devin 登录、原生模型和权限配置。Devin 发出 ACP 审批时，Studio 提供「仅本次允许」与「拒绝」。由原生策略直接处理的动作仍按 Devin 的配置执行。
- **Studio 模型（scoped）**需要 CLI 将模型请求发送到 Studio 当轮分配的模型代理。公开版 Devin 的 ACP 和用户配置只提供原生模型选择。官方包中的合作伙伴版文档说明，自定义推理端点属于需 Cognition 审批的单独发行版。公开版没有通过 Studio 模型代理的回环验收，插件保留全局模式。 [Devin 模型](https://docs.devin.ai/cli/models) · [ACP 接入](https://docs.devin.ai/cli/acp/zed)
- Studio 传递文本、图片字节和嵌入式文件内容，每轮附件总量上限 8 MiB。按 CLI 协商能力传入当前轮绑定的 Studio MCP。
- 点击「停止」会取消当前原生提示并回收 ACP 进程。Studio 的 Agent 实例存续时，成功轮次可复用同一原生会话。Studio 重启或一次中断后，由 Studio 历史接续到新原生会话。
- 适配器使用 MIT 许可。托管引擎从 Cognition 官方 npm 包独立下载，保留随包分发的文档和 npm 安装标记。 [官方 npm 发布流程](https://github.com/CognitionAI/devin-cli/blob/main/DEVELOPMENT.md#npm-publishing)

## 图标来源

插件随附的 `assets/icon.png` 是适配器的原创字母 D 图标。Devin 产品标识和 Cognition 官方品牌素材见 [Devin 品牌页](https://devin.ai/brand)。

## 开发与复验

需要 Node.js 24.2 或更新的 24.x。发布包覆盖 macOS、Linux 与 Windows 的 x64 和 arm64 平台。原生验收环境为 macOS arm64，测试覆盖官方版本 3000.13.4 和 3000.14.30821。其他平台原生安装、真实账号推理、推理期间取消和生产附件及 MCP 使用仍待实测。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run harness:check
npm test
npm pack --dry-run --ignore-scripts
EKKO_DEVIN_NATIVE_TEST_CLI=/absolute/path/to/devin npm test
```

[运行契约](docs/CONTRACTS.md) · [Studio SDK 开发说明](docs/DEVELOPMENT.md) · [Cognition 官方发行仓库](https://github.com/CognitionAI/devin-cli) · [ACP 官方目录](https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json)
