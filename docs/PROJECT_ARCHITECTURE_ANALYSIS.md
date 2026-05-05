# DeerFlow 当前项目架构分析

本文基于当前仓库代码结构整理，覆盖系统架构、核心能力、底层运行原理、主要组件和关键源码入口。

## 1. 项目定位

DeerFlow 2.0 是一个开源的 super agent harness。它不是单纯的聊天后端，而是把 LangGraph/LangChain agent runtime、工具系统、技能系统、sandbox、长期记忆、子代理、文件产物管理、Web 工作台和 IM 渠道整合在一起的 agent 操作系统。

从代码组织看，项目主要分为三层：

| 层级 | 路径 | 职责 |
| --- | --- | --- |
| 前端工作台 | `frontend/` | Next.js UI、聊天流式交互、文件上传、产物展示、设置、文档 |
| Gateway 应用 | `backend/app/gateway/` | FastAPI API 网关、鉴权、runs、threads、uploads、models、MCP、skills、memory、channels |
| Harness 核心 | `backend/packages/harness/deerflow/` | Agent factory、middleware、model factory、tools、sandbox、skills、memory、runtime、persistence |

生产部署中，nginx 暴露统一入口 `:2026`，将页面请求转发给 frontend，将 `/api/*` 转发给 Gateway，将 `/api/langgraph/*` 重写到 Gateway 内部的 LangGraph 兼容 runs API。

## 2. 总体架构

```mermaid
flowchart TD
    Browser[Browser / Web UI] --> Nginx[Nginx :2026]

    Nginx -->|/| Frontend[Next.js Frontend :3000]
    Nginx -->|/api/*| Gateway[FastAPI Gateway :8001]
    Nginx -->|/api/langgraph/* rewrite| Gateway

    Gateway --> Auth[Auth / CSRF / Permission]
    Gateway --> Runs[Runs API]
    Gateway --> Uploads[Uploads / Artifacts]
    Gateway --> ConfigAPI[Models / MCP / Skills / Memory / Agents API]
    Gateway --> Channels[IM Channel Service]

    Runs --> RunManager[RunManager]
    Runs --> StreamBridge[StreamBridge SSE]
    Runs --> Worker[run_agent Worker]

    Worker --> LeadAgent[Lead Agent]
    LeadAgent --> ModelFactory[Model Factory]
    LeadAgent --> Middleware[Middleware Chain]
    LeadAgent --> Tools[Tools / MCP / ACP]
    LeadAgent --> Sandbox[Sandbox]
    LeadAgent --> Memory[Memory]
    LeadAgent --> Subagents[Subagents]

    Sandbox --> ThreadData[Thread Filesystem]
    ThreadData --> Workspace[/mnt/user-data/workspace]
    ThreadData --> UploadDir[/mnt/user-data/uploads]
    ThreadData --> OutputDir[/mnt/user-data/outputs]
```

关键入口：

- Agent 创建：`backend/packages/harness/deerflow/agents/lead_agent/agent.py`
- Prompt 构造：`backend/packages/harness/deerflow/agents/lead_agent/prompt.py`
- Gateway 应用：`backend/app/gateway/app.py`
- Run 启动：`backend/app/gateway/services.py`
- Run worker：`backend/packages/harness/deerflow/runtime/runs/worker.py`
- 前端流式 hook：`frontend/src/core/threads/hooks.ts`
- nginx 路由：`docker/nginx/nginx.local.conf`、`docker/nginx/nginx.conf`

## 3. 请求运行链路

一次用户消息的完整链路大致如下：

1. 用户在前端聊天框发送消息。
2. `frontend/src/core/threads/hooks.ts` 中的 `useThreadStream()` 调用 LangGraph SDK 的 `useStream()`。
3. 前端请求 `/api/langgraph/threads/{thread_id}/runs/stream`。
4. nginx 将 `/api/langgraph/*` 重写为 Gateway 的 `/api/*`。
5. Gateway 的 `thread_runs.py` 接收请求，调用 `start_run()`。
6. `start_run()` 创建 `RunRecord`，启动后台 `asyncio.Task` 执行 `run_agent()`。
7. `run_agent()` 构建 runtime context、checkpointer、store、callbacks，并调用 agent factory。
8. `make_lead_agent()` 根据运行上下文选择模型、工具、middleware 和 prompt。
9. LangGraph agent 通过 `agent.astream()` 流式执行。
10. Worker 将 LangGraph stream chunk 转换成 SSE event，发布到 `StreamBridge`。
11. Gateway SSE consumer 把事件推回前端。
12. 前端实时渲染消息、工具调用、reasoning、subtask 状态和最终产物。

## 4. Agent 核心设计

主 agent 的工厂函数是 `make_lead_agent(config)`。它保持 LangGraph Server 兼容签名，内部调用 `_make_lead_agent()` 完成实际装配。

核心装配内容：

- 解析 runtime context：`model_name`、`thinking_enabled`、`reasoning_effort`、`is_plan_mode`、`subagent_enabled`、`agent_name`。
- 解析自定义 agent 配置：从 `.deer-flow/agents/{name}/` 读取 agent 配置和 `SOUL.md`。
- 创建模型：通过 `create_chat_model()` 反射创建 LangChain chat model。
- 加载工具：通过 `get_available_tools()` 组合配置工具、内置工具、MCP 工具和 ACP 工具。
- 构建 middleware chain：注入 sandbox、summary、todo、memory、title、vision、loop detection 等能力。
- 构造系统提示词：注入 skills、memory、subagent 规则、工作目录说明、引用规范等。
- 指定状态 schema：使用扩展后的 `ThreadState`。

`ThreadState` 在 LangChain `AgentState` 的基础上增加了 DeerFlow 专用状态：

```python
class ThreadState(AgentState):
    sandbox: SandboxState | None
    thread_data: ThreadDataState | None
    title: str | None
    artifacts: list[str]
    todos: list | None
    uploaded_files: list[dict] | None
    viewed_images: dict[str, ViewedImageData]
```

这意味着 DeerFlow 的一次对话不只是 message history，而是一个可恢复、可扩展的运行状态。

## 5. Middleware 机制

Middleware 是 DeerFlow 扩展 LangGraph agent 行为的主要方式。主链路在 `backend/packages/harness/deerflow/agents/lead_agent/agent.py` 的 `_build_middlewares()` 中装配。

主要 middleware：

| Middleware | 作用 |
| --- | --- |
| ToolErrorHandlingMiddleware | 将工具异常转换成模型可理解的 ToolMessage，避免运行直接崩溃 |
| DeerFlowSummarizationMiddleware | 上下文过长时总结历史消息，降低 token 压力 |
| TodoMiddleware | plan/pro 模式下提供任务列表管理 |
| TokenUsageMiddleware | 记录 token 使用情况 |
| TitleMiddleware | 自动生成会话标题 |
| MemoryMiddleware | 将对话异步进入记忆更新流程 |
| ViewImageMiddleware | 支持视觉模型读取图片 |
| DeferredToolFilterMiddleware | tool_search 模式下隐藏延迟加载工具 schema |
| SubagentLimitMiddleware | 限制单轮并行 subagent 数量 |
| LoopDetectionMiddleware | 检测重复工具调用循环 |
| ClarificationMiddleware | 处理澄清请求，中断后续执行 |

这种设计让核心 agent 保持相对稳定，而功能增强通过 middleware 插入。

## 6. 模型系统

模型工厂位于 `backend/packages/harness/deerflow/models/factory.py`。

模型配置来自 `config.yaml` 的 `models` 字段。每个模型通过 `use` 指定反射路径，例如：

```yaml
models:
  - name: gpt-4o
    display_name: GPT-4o
    use: langchain_openai:ChatOpenAI
    model: gpt-4o
    api_key: $OPENAI_API_KEY
```

`create_chat_model()` 的关键逻辑：

- 根据模型 name 查找 `ModelConfig`。
- 通过 `resolve_class()` 反射加载模型类。
- 根据 `thinking_enabled` 合并 `when_thinking_enabled` / `when_thinking_disabled` 配置。
- 对 vLLM、OpenAI-compatible gateway、Anthropic thinking、Codex provider 做特殊兼容。
- 自动打开 `stream_usage`，保证流式响应里能拿到 token usage。
- 注入 LangSmith/Langfuse tracing callbacks。

这使 DeerFlow 支持 OpenAI、Anthropic、DeepSeek、vLLM、Codex CLI、Claude Code OAuth，以及任意 LangChain 兼容模型。

## 7. 工具系统

工具入口是 `backend/packages/harness/deerflow/tools/tools.py` 的 `get_available_tools()`。

工具来源分为四类：

1. 配置工具：来自 `config.yaml` 的 `tools`。
2. 内置工具：`present_files`、`ask_clarification`、`view_image`、`task`、文件工具、bash 等。
3. MCP 工具：来自 `extensions_config.json` 中启用的 MCP servers。
4. ACP 工具：通过 `invoke_acp_agent` 调用 Codex、Claude Code 等 ACP agent。

工具加载时会做几类保护：

- 根据 tool group 过滤工具。
- 在 LocalSandboxProvider 且未显式允许时隐藏 host bash。
- 检测工具配置名与工具对象名不一致的问题。
- MCP 工具按配置文件 mtime 缓存失效。
- tool_search 开启时，将 MCP 工具注册为 deferred tools，避免一次性暴露过多 schema。
- 按工具名去重，避免模型收到重复 function schema。

## 8. Sandbox 与文件系统

Sandbox 是 DeerFlow 的安全边界和工作区抽象。Agent 看到的是虚拟路径：

| 虚拟路径 | 语义 |
| --- | --- |
| `/mnt/user-data/workspace` | 临时工作区 |
| `/mnt/user-data/uploads` | 用户上传文件 |
| `/mnt/user-data/outputs` | 最终产物输出目录 |
| `/mnt/skills` | skills 目录，只读 |
| `/mnt/acp-workspace` | ACP agent 独立工作区 |

真实路径由 `backend/packages/harness/deerflow/config/paths.py` 管理。典型布局：

```text
.deer-flow/
  users/{user_id}/
    memory.json
    agents/{agent_name}/memory.json
    threads/{thread_id}/
      user-data/
        workspace/
        uploads/
        outputs/
      acp-workspace/
```

LocalSandbox 位于 `backend/packages/harness/deerflow/sandbox/local/local_sandbox.py`，它负责：

- 虚拟路径到宿主路径的映射。
- 防止路径穿越。
- 处理只读挂载，例如 skills。
- 在命令、文件内容、输出中做路径转换。
- 在 Windows 下兼容 PowerShell、cmd、sh。
- 对 agent 可见输出做宿主路径脱敏。

项目也支持 Docker / AIO sandbox / provisioner 形态，用于更强隔离或 Kubernetes 部署。

## 9. Skills 系统

Skills 是 DeerFlow 的可扩展工作流知识机制。目录结构通常是：

```text
skills/
  public/
    skill-name/
      SKILL.md
      references/
      scripts/
  custom/
    user-skill/
      SKILL.md
```

Skill 不会完整塞入系统提示词。`prompt.py` 会生成一个 `<skill_system>` 区块，只列出 skill 的名称、描述和 `SKILL.md` 路径。模型在判断任务匹配某个 skill 后，再调用 `read_file` 读取具体内容。

这种“渐进加载”降低了上下文占用，也让 skill 可以携带脚本、参考资料、模板等额外资源。

Skill 管理能力包括：

- 解析 `SKILL.md` frontmatter。
- 加载 public/custom skills。
- 启用/禁用 skills。
- 安装 skill archive。
- 安全扫描 skill 内容。
- 可选的 skill self-evolution，由 agent 在完成复杂任务后创建或修补 custom skill。

## 10. Sub-agents

Sub-agent 通过内置 `task` 工具暴露。开启 `subagent_enabled` 后，系统提示词会要求主 agent 对复杂任务进行拆解、并行委派、最终综合。

`task_tool.py` 的主要流程：

1. 校验 `subagent_type` 是否存在。
2. 对 bash subagent 进行 host bash 安全检查。
3. 从父 agent 继承 sandbox、thread_data、thread_id、model metadata、trace_id。
4. 继承父级 tool group 限制。
5. 合并父级和子级 skill allowlist。
6. 加载子代理工具，但禁止递归暴露 `task`。
7. 创建 `SubagentExecutor` 后台执行。
8. 通过 LangGraph custom stream event 推送 `task_started`、`task_running`、`task_completed` 等状态。

这让 DeerFlow 可以在一个主会话里做并行研究、并行代码探索或复杂任务拆解。

## 11. Memory 系统

Memory 默认是文件存储，位于 `backend/packages/harness/deerflow/agents/memory/`。

默认 memory 结构包括：

- `user.workContext`
- `user.personalContext`
- `user.topOfMind`
- `history.recentMonths`
- `history.earlierContext`
- `history.longTermBackground`
- `facts`

Memory 支持：

- 全局记忆。
- 用户级记忆。
- 用户 + agent 级记忆。
- prompt 注入，限制最大 token。
- conversation 后台更新。
- summarization 前 flush。

Memory 的定位不是完整聊天记录，而是长期偏好、事实、背景、近期重点的结构化摘要。

## 12. Runtime 与流式系统

Gateway 启动时通过 `langgraph_runtime()` 初始化运行时组件：

- `StreamBridge`：SSE 事件桥。
- SQLAlchemy engine：SQLite/Postgres/memory。
- checkpointer：LangGraph checkpoint 存储。
- store：LangGraph store。
- run store：运行记录存储。
- feedback repository。
- thread metadata store。
- run event store。
- `RunManager`。

`RunManager` 管理 run 状态：

- `pending`
- `running`
- `success`
- `interrupted`
- `error`

`run_agent()` 是后台执行核心。它会：

- 创建 RunJournal，记录消息、生命周期、token usage。
- 发布 metadata SSE event。
- 构造 agent。
- 绑定 checkpointer 和 store。
- 根据请求 stream mode 调用 `agent.astream()`。
- 把 LangGraph stream chunk 序列化为 SSE event。
- 支持 interrupt/rollback。
- 完成后同步 title、run completion 等信息。

`MemoryStreamBridge` 保存每个 run 的事件 buffer，支持 `Last-Event-ID`，前端断线后可以续接最近事件。

## 13. Gateway API

Gateway 是 FastAPI 应用，主要 router 包括：

| Router | 路径 | 作用 |
| --- | --- | --- |
| `models.py` | `/api/models` | 查询可用模型 |
| `mcp.py` | `/api/mcp` | 管理 MCP 配置 |
| `skills.py` | `/api/skills` | 管理 skills |
| `memory.py` | `/api/memory` | 读写 memory |
| `uploads.py` | `/api/threads/{thread_id}/uploads` | 文件上传 |
| `artifacts.py` | `/api/threads/{thread_id}/artifacts` | 访问产物 |
| `threads.py` | `/api/threads` | 线程元数据和清理 |
| `thread_runs.py` | `/api/threads/{thread_id}/runs` | LangGraph 兼容 runs |
| `runs.py` | `/api/runs` | 无状态 runs |
| `agents.py` | `/api/agents` | 自定义 agent |
| `auth.py` | `/api/v1/auth` | 本地鉴权 |
| `channels.py` | `/api/channels` | IM 渠道状态 |

Gateway 还内置：

- AuthMiddleware：认证兜底。
- CSRFMiddleware：双提交 Cookie CSRF 防护。
- CORS 配置。
- 首次启动 admin 检查。
- 从无鉴权升级到有鉴权时的 orphan thread 迁移。

## 14. 前端架构

前端基于 Next.js、React、LangGraph SDK、TanStack Query、Radix UI、streamdown。

主要模块：

- `frontend/src/app/workspace/`：工作台页面。
- `frontend/src/core/threads/hooks.ts`：线程、历史消息、流式 run。
- `frontend/src/core/api/`：LangGraph SDK client 和 fetch 封装。
- `frontend/src/core/uploads/`：上传文件处理。
- `frontend/src/core/messages/`：消息解析、分组、reasoning 和 tool call 展示逻辑。
- `frontend/src/components/workspace/`：聊天框、消息列表、artifact viewer、设置页等。

前端消息渲染策略：

- 合并历史消息、实时 stream 消息和 optimistic 消息。
- 按 human、assistant processing、assistant final、present files、clarification、subagent 分组。
- 识别 `<think>`、`reasoning_content`、tool calls。
- 对 `task` tool call 渲染 subtask card。
- 对 `present_files` tool call 渲染产物入口。

## 15. 上传与产物链路

上传流程：

1. 前端将文件上传到 `/api/threads/{thread_id}/uploads`。
2. Gateway 校验文件数量、单文件大小、总大小、文件名安全。
3. 文件写入 `.deer-flow/.../uploads/`。
4. 可选将 PDF、PPT、Excel、Word 等转换成 Markdown。
5. 返回虚拟路径，例如 `/mnt/user-data/uploads/foo.pdf`。
6. 前端把文件 metadata 放入 human message 的 `additional_kwargs.files`。
7. 下一次 agent run 中，UploadsMiddleware 将文件列表注入上下文。
8. Agent 用 `read_file` 或相关工具读取上传文件。

产物流程：

1. Agent 在 `/mnt/user-data/outputs` 写最终文件。
2. Agent 调用 `present_files`。
3. 前端解析 tool call，展示 artifact 入口。
4. Gateway 的 artifacts router 根据虚拟路径解析真实文件并返回内容。

## 16. IM Channel 架构

ChannelService 位于 `backend/app/channels/service.py`。它从 `config.yaml` 的 `channels` 字段读取配置，按需启动：

- DingTalk
- Discord
- Feishu / Lark
- Slack
- Telegram
- WeChat
- WeCom

内部组件：

- `MessageBus`：渠道消息总线。
- `ChannelStore`：渠道会话状态。
- `ChannelManager`：把 IM 消息转为 DeerFlow run，并把响应发回渠道。
- 具体 channel class：负责不同平台的连接、收消息、发消息。

这使 DeerFlow 可以不只通过 Web UI 使用，也可以作为企业 IM bot 接收任务。

## 17. 配置体系

核心配置文件：

- `config.yaml`：模型、工具、sandbox、memory、database、checkpointer、run_events、channels 等。
- `extensions_config.json`：MCP servers 和 skills 启用状态。
- `.env`：API key、部署变量。

`AppConfig` 位于 `backend/packages/harness/deerflow/config/app_config.py`。它负责：

- 查找配置文件。
- 解析 YAML。
- 解析 `$ENV_VAR`。
- 应用数据库默认值。
- 加载 extensions config。
- 校验 config version。
- 支持运行时配置刷新。

路径类配置优先级大致是：

1. 显式环境变量，如 `DEER_FLOW_CONFIG_PATH`、`DEER_FLOW_HOME`、`DEER_FLOW_SKILLS_PATH`。
2. 项目根目录默认路径。
3. legacy backend/repo root fallback。

## 18. 安全边界

项目里可以看到多层安全考虑：

- Gateway 层：AuthMiddleware、CSRF、权限装饰器、owner check。
- 文件层：thread_id/user_id 正则校验、防路径穿越、symlink 防护、上传大小限制。
- Sandbox 层：虚拟路径映射、host path 脱敏、skills 只读挂载、LocalSandbox 下默认隐藏 host bash。
- Tool 层：工具去重、host bash 安全开关、MCP 配置动态启停。
- Persistence 层：用户隔离，thread/run/feedback/user_id 关联。
- Upgrade 层：无鉴权旧数据迁移到 admin owner。

不过 LocalSandbox 本质仍是在宿主机执行命令，适合开发环境。生产更推荐 Docker/AIO sandbox 或 provisioner。

## 19. 架构特点与判断

DeerFlow 当前架构的核心特点是“配置驱动 + middleware 扩展 + sandbox 隔离 + LangGraph 状态化执行”。

优点：

- 能力边界清晰：模型、工具、skills、memory、sandbox 都是独立模块。
- 扩展性强：通过反射路径加载模型、工具、sandbox provider、memory storage。
- 适合长任务：有 run 状态、SSE、checkpoint、event store、rollback/interruption。
- 适合复杂任务：支持 subagent 并行、skills 渐进加载、文件工作区和产物输出。
- 应用化程度高：已有 Web UI、鉴权、上传、IM channel、设置页、API 管理。

代价：

- 配置面较大，部署前必须理解 `config.yaml` 和 `extensions_config.json`。
- Gateway 同时承担 API、runtime、channel lifecycle，长期运行时需要关注 worker 数、数据库和 sandbox 资源。
- LocalSandbox 安全边界较弱，生产场景需要改用更隔离的 sandbox provider。
- LangGraph 兼容 API 是自实现层，需要持续跟随 LangGraph SDK 协议变化。

## 20. 推荐阅读顺序

如果要继续深入代码，建议按以下顺序阅读：

1. `backend/app/gateway/app.py`
2. `backend/app/gateway/services.py`
3. `backend/packages/harness/deerflow/runtime/runs/worker.py`
4. `backend/packages/harness/deerflow/agents/lead_agent/agent.py`
5. `backend/packages/harness/deerflow/agents/lead_agent/prompt.py`
6. `backend/packages/harness/deerflow/tools/tools.py`
7. `backend/packages/harness/deerflow/sandbox/tools.py`
8. `backend/packages/harness/deerflow/config/paths.py`
9. `frontend/src/core/threads/hooks.ts`
10. `frontend/src/core/messages/utils.ts`

