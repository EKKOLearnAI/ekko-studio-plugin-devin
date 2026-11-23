# Devin CLI for Ekko Studio

在 Studio 中通过 Cognition 的原生 ACP 接口使用本地 Devin CLI。Agent ID 为 `plugin:devin/devin`。0.1.0 提供「全局」单聊和流式回复。

## Install

1. 在运行 Studio 服务端的机器上安装官方 Devin CLI。macOS 可运行 `brew install --cask devin-cli`。Linux、WSL 和 Windows 的安装方法见 [Devin CLI 快速入门](https://docs.devin.ai/cli)。
2. 用运行 Studio 的同一个系统账号执行 `devin --version`、`devin auth login` 和 `devin auth status`。按 Cognition 的流程在浏览器完成登录。企业账号可能需要 **Use Devin CLI** 角色。 [Devin Auth](https://docs.devin.ai/cli/enterprise/devin-auth)
3. 打开 **Studio → 插件中心 → 从来源安装**，输入 `github:EKKOLearnAI/ekko-studio-plugin-devin#v0.1.0`，确认信任后启用。也可输入本仓库检出的绝对路径做本地安装。
4. 在 **Studio → Agent 管理** 查看 **Devin CLI** 和版本。新建单聊，选择 Devin CLI「全局」及项目目录。可以选取原生模型或使用 Devin 的默认模型。

如果 Studio 找不到 `devin`，在 Studio 服务进程环境中设置 `EKKO_DEVIN_EXECUTABLE` 为官方二进制的绝对路径，再重启 Studio。Windows 请指向原生 `devin.exe`。若模型目录返回 `auth_required`，确认 Studio 服务和登录终端使用同一系统账号及 Devin 数据目录。原生凭证、配置、Skill 和 MCP 由 Devin CLI 管理。

## 运行与权限

- 每轮使用 Studio 当前工作区和 Devin 的原生权限策略。Devin 发出 ACP 审批时，Studio 提供「仅本次允许」和「拒绝」。某些操作由原生权限策略直接处理。
- Studio 传递文本、图片字节和嵌入式文件内容，每轮附件总量上限 8 MiB。按 CLI 协商能力传入当前轮绑定的 Studio MCP。
- 点击「停止」会取消当前原生提示并回收本轮 ACP 进程。Studio 的 Agent 实例存续时，成功轮次可复用同一原生会话。Studio 重启或一轮中断后，新原生会话由 Studio 历史接续。
- Studio 服务进程所属系统账号持有 Devin 原生登录、配置、日志和会话。插件的运行只授权给启用插件的 Studio 账号及 Profile。此仓库以 MIT 许可分发适配器，需从 Cognition 单独安装专有 CLI。
- 已用官方 macOS arm64 版 3000.14.30821 验证握手、登录门槛、原生会话加载和未登录时取消。真实账号推理、推理期间取消、实际附件与 MCP 执行，以及 Linux 和 Windows 原生 CLI 待验。GitHub Actions 在 macOS、Linux 和 Windows 运行 ACP 夹具。

## 开发与复验

需要 Node.js 24.2 或更新的 24.x。可选的官方 CLI 测试使用临时原生数据目录，复验未登录行为。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run harness:check
npm test
npm pack --dry-run --ignore-scripts
EKKO_DEVIN_NATIVE_TEST_CLI=/absolute/path/to/devin npm test
```

[运行契约](docs/CONTRACTS.md) · [Studio SDK 开发说明](docs/DEVELOPMENT.md) · [Cognition 官方发行仓库](https://github.com/CognitionAI/devin-cli) · [ACP 官方目录](https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json)
