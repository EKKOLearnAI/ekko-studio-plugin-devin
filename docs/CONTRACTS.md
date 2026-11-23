# Devin CLI 运行契约

Studio Agent API v1。插件与局部 Agent ID 均为 `devin`。入口 `server.mjs` 在 `apply(ctx)` 注册 Agent，随插件停用注销。声明 `global`、`chat`、`streaming: true`、`resume: false`。Studio 使用原有 Agent SDK 接口，插件没有自定义 RPC 或持久化结构。

## 进程和账号

- `engine.mjs` 从 Studio 进程 PATH、常用用户安装位置或绝对路径 `EKKO_DEVIN_EXECUTABLE` 查找引擎。Agent 管理通过 `devin --version` 探测，外部 CLI 的安装和更新由使用者管理。
- 官方 ACP 入口为 `devin acp`。插件加上官方 `--process-model in-process` 参数，使每轮的进程及资源由 Studio 管理。工作目录为当前受信 Studio 工作区的绝对真实路径。子进程环境按允许列表传递 OS、XDG、终端路径及网络配置。
- 初始握手使用 ACP v1。Devin 3000.14.30821 的引擎名是 `affogato`，未登录时仍返回创建会话成功。若模型目录为空，插件检查 `devin auth status`；提示响应的 ACP `-32000` 映射成统一登录指引。插件通过原生 CLI 登录状态运行，Studio 模型代理凭证和任意父进程变量留在宿主。
- 进入目录查询、创建会话和运行时检查激活者的 Studio 用户及 Profile。运行时还检查 Agent 和 Studio 会话身份。该边界与本机 Devin 原生登录是两层身份，安装者需用 Studio 服务进程所在的 OS 账号登录 Devin。

## 每轮数据、会话与结束

- ACP 会话创建与加载传入当前工作区和同轮 MCP 配置，检查远程协议协商。原生模型及可选推理档位来自会话配置。显式选择需经 ACP 确认，失败时终止该轮。
- 从 Studio 附件服务读取图片和文件字节，按 ACP 协商传入图片或嵌入资源。每轮当前内容和回退历史合计最多 8 MiB 附件数据。单个 ACP 帧最多 16 MiB。格式或协议不支持时返回错误。
- 仅在上次提示成功，仍是同一 Studio Agent 实例、工作区和引擎路径时尝试 `session/load`。加载期间的历史通知不流入新一轮。缺少加载能力、不支持该方法或原生会话不存在时，创建新会话并连同 Studio 历史发送。加载锁定或其他加载错误会显式失败。宿主重启或一次失败/取消后由 Studio 历史接续，插件不写原生 ID 检查点。
- 文本增量合成一次最终文本回复。工具事件只传名称、状态和通用结果。终端和文件行为保留 Devin 的策略；需要 ACP 审批时只处理当前会话，映射为一次允许、拒绝或取消。标题中的常见凭证格式会被遮蔽。原始参数、工具结果、ACP 错误详情和进程 stderr 留在原生进程边界内。
- 取消、超时和释放活动会话都会向当前原生 ID 发送 `session/cancel`，取消待处理的审批，丢弃迟到事件并关闭进程。关闭时先给 ACP 短暂退出时间，再回收子进程。官方 CLI 在自己的数据目录记录原生日志和会话。
