# DeerFlow 源码阅读指南

本文是一份面向源码学习和二次开发的阅读路线。目标不是逐文件罗列，而是帮助你按系统运行链路建立完整心智模型：先理解应用如何启动，再理解一次消息如何执行，最后深入模型、工具、sandbox、skills、memory、subagents、持久化和前端 UI。

建议配合 `docs/PROJECT_ARCHITECTURE_ANALYSIS.md` 一起阅读。那份文档偏系统架构分析，本文偏源码阅读顺序和方法。

## 1. 阅读前准备

先从仓库根目录建立全局结构：

```text
deer-flow/
  backend/
    app/gateway/                  # FastAPI Gateway
    app/channels/                 # IM 渠道集成
    packages/harness/deerflow/    # Agent harness 核心
    tests/                        # 后端测试
  frontend/
    src/app/                      # Next.js App Router 页面
    src/core/                     # 前端业务核心逻辑
    src/components/               # UI 组件
  skills/
    public/                       # 内置 skills
  docker/
    nginx/                        # 统一入口代理
  config.example.yaml             # 主配置模板
  extensions_config.example.json  # MCP / skills 扩展配置模板
```

阅读时建议始终围绕两个问题：

1. 用户一次消息从前端到模型再到前端，是怎么流动的？
2. 一个 agent 能力是通过模型、prompt、middleware、tools、sandbox、skills、memory 中哪一层实现的？

## 2. 第一阶段：先建立运行入口模型

### 2.1 读部署和入口

先看这些文件：

```text
docker/docker-compose.yaml
docker/docker-compose-dev.yaml
docker/nginx/nginx.local.conf
docker/nginx/nginx.conf
Makefile
backend/langgraph.json
```

重点理解：

- 生产环境有哪些服务：`nginx`、`frontend`、`gateway`、可选 `provisioner`。
- 本地开发和生产部署的区别。
- nginx 如何把 `/api/langgraph/*` 重写到 Gateway。
- Gateway 在生产 compose 中已经承担 agent runtime。
- `backend/langgraph.json` 仍然定义 `lead_agent`，用于 LangGraph CLI/Studio 兼容场景。

读完后你应该能回答：

- 浏览器访问 `http://localhost:2026` 后请求会被转发到哪里？
- 前端调用 LangGraph SDK 时，最终请求的是哪个后端 router？
- `gateway` 容器挂载了哪些运行时目录？

### 2.2 读配置系统

核心文件：

```text
config.example.yaml
extensions_config.example.json
backend/packages/harness/deerflow/config/app_config.py
backend/packages/harness/deerflow/config/model_config.py
backend/packages/harness/deerflow/config/tool_config.py
backend/packages/harness/deerflow/config/sandbox_config.py
backend/packages/harness/deerflow/config/paths.py
backend/packages/harness/deerflow/config/extensions_config.py
```

重点理解：

- `config.yaml` 如何被定位和加载。
- `$ENV_VAR` 如何解析。
- `AppConfig` 包含哪些子配置。
- `extensions_config.json` 为什么独立于 `config.yaml`。
- `.deer-flow`、`skills/`、thread 目录如何定位。

建议画出自己的配置优先级：

```text
显式环境变量
  -> 项目根目录配置
  -> legacy backend/repo root fallback
  -> 默认值
```

## 3. 第二阶段：读 Gateway 启动生命周期

核心文件：

```text
backend/app/gateway/app.py
backend/app/gateway/deps.py
backend/app/gateway/config.py
backend/app/gateway/auth_middleware.py
backend/app/gateway/csrf_middleware.py
backend/app/gateway/authz.py
```

阅读顺序：

1. 从 `create_app()` 看 FastAPI app 如何创建。
2. 看 middleware 添加顺序：认证、CSRF、CORS。
3. 看 router include 列表，建立 API 分类。
4. 看 `lifespan()`，理解 Gateway 启动时初始化哪些资源。
5. 进入 `langgraph_runtime()`，看运行时 singleton 如何挂到 `app.state`。

重点关注 `langgraph_runtime()` 初始化的对象：

```text
stream_bridge
database engine
checkpointer
store
run_store
feedback_repo
thread_store
run_event_store
run_manager
```

读完后你应该能回答：

- Gateway 启动失败最可能卡在哪些资源初始化上？
- 为什么 routers 不直接 import 全局对象，而是通过 `deps.py` 获取？
- auth、CSRF、permission check 分别在哪一层工作？

## 4. 第三阶段：读一次消息的完整后端链路

这是理解项目最重要的一段。

核心文件：

```text
backend/app/gateway/routers/thread_runs.py
backend/app/gateway/routers/runs.py
backend/app/gateway/services.py
backend/packages/harness/deerflow/runtime/runs/manager.py
backend/packages/harness/deerflow/runtime/runs/worker.py
backend/packages/harness/deerflow/runtime/stream_bridge/base.py
backend/packages/harness/deerflow/runtime/stream_bridge/memory.py
backend/packages/harness/deerflow/runtime/serialization.py
```

推荐阅读路线：

1. `thread_runs.py`
   - 看 `/api/threads/{thread_id}/runs/stream`。
   - 看请求模型 `RunCreateRequest`。
   - 看 run create、wait、cancel、join、stream 的 API 形态。

2. `services.py`
   - 看 `start_run()` 如何创建 `RunRecord`。
   - 看 `build_run_config()` 如何把 thread、assistant、metadata、context 组合成 RunnableConfig。
   - 看 `merge_run_context_overrides()` 如何转发 DeerFlow 自定义上下文。
   - 看 `sse_consumer()` 如何把 StreamBridge event 格式化成 SSE。

3. `manager.py`
   - 看 `RunManager` 如何管理 run 状态。
   - 看 `create_or_reject()` 如何处理同一 thread 的并发 run。
   - 看 cancel/interrupt/rollback 的状态变化。

4. `worker.py`
   - 看 `run_agent()` 的完整执行流程。
   - 看 runtime context 如何注入 LangGraph Runtime。
   - 看 agent factory 如何被调用。
   - 看 `agent.astream()` 产出的 chunk 如何转换为 SSE event。
   - 看成功、取消、rollback、异常的 finally 逻辑。

读完后你应该能画出这条链路：

```text
thread_runs.stream_run
  -> services.start_run
  -> RunManager.create_or_reject
  -> asyncio.create_task(run_agent)
  -> agent_factory(make_lead_agent)
  -> agent.astream
  -> StreamBridge.publish
  -> sse_consumer
  -> browser
```

## 5. 第四阶段：读 Lead Agent 构造

核心文件：

```text
backend/packages/harness/deerflow/agents/lead_agent/agent.py
backend/packages/harness/deerflow/agents/lead_agent/prompt.py
backend/packages/harness/deerflow/agents/thread_state.py
backend/packages/harness/deerflow/agents/features.py
backend/packages/harness/deerflow/agents/factory.py
```

阅读顺序：

1. `thread_state.py`
   - 先理解 DeerFlow 在 LangChain `AgentState` 上增加了哪些字段。
   - 重点看 `artifacts`、`viewed_images` 的 reducer。

2. `agent.py`
   - 从 `make_lead_agent()` 进入。
   - 看 `_get_runtime_config()` 如何合并 `configurable` 和 `context`。
   - 看 `_resolve_model_name()` 如何选择模型。
   - 看 `_build_middlewares()` 的装配顺序。
   - 看 `_make_lead_agent()` 如何处理 bootstrap、自定义 agent、plan mode、subagent mode。

3. `prompt.py`
   - 看 `SYSTEM_PROMPT_TEMPLATE` 的主要区块。
   - 看 memory、skills、subagent、ACP、自定义 mount 如何动态注入。
   - 看 `apply_prompt_template()` 如何拼接最终系统提示词。

4. `factory.py`
   - 这是 SDK 级纯参数 factory。
   - 用来理解 DeerFlow 如何从配置驱动应用形态，抽象到可嵌入 Python harness。

重点理解：

- `make_lead_agent()` 是应用级、配置驱动入口。
- `create_deerflow_agent()` 是 SDK 级、纯参数入口。
- 当前 Web 应用主要走 `make_lead_agent()`。

## 6. 第五阶段：读 Middleware

目录：

```text
backend/packages/harness/deerflow/agents/middlewares/
```

建议先读这些：

```text
thread_data_middleware.py
uploads_middleware.py
tool_error_handling_middleware.py
summarization_middleware.py
title_middleware.py
memory_middleware.py
todo_middleware.py
view_image_middleware.py
clarification_middleware.py
loop_detection_middleware.py
subagent_limit_middleware.py
deferred_tool_filter_middleware.py
```

阅读方法：

- 每个 middleware 都问三个问题：
  - 它在模型调用前做什么？
  - 它在模型调用后做什么？
  - 它读写了 `ThreadState` 的哪些字段？

重点关注：

- `ThreadDataMiddleware` 如何准备 workspace/uploads/outputs。
- `UploadsMiddleware` 如何把上传文件列表注入消息。
- `SummarizationMiddleware` 如何削减上下文。
- `TitleMiddleware` 如何生成会话标题。
- `MemoryMiddleware` 如何触发记忆更新。
- `ClarificationMiddleware` 如何中断执行。

## 7. 第六阶段：读模型系统

核心文件：

```text
backend/packages/harness/deerflow/models/factory.py
backend/packages/harness/deerflow/models/openai_codex_provider.py
backend/packages/harness/deerflow/models/claude_provider.py
backend/packages/harness/deerflow/models/vllm_provider.py
backend/packages/harness/deerflow/models/mindie_provider.py
backend/packages/harness/deerflow/models/patched_openai.py
backend/packages/harness/deerflow/models/patched_deepseek.py
backend/packages/harness/deerflow/models/credential_loader.py
```

阅读重点：

- `create_chat_model()` 如何把配置变成 LangChain `BaseChatModel`。
- `supports_thinking`、`supports_reasoning_effort`、`supports_vision` 分别影响哪些能力。
- OpenAI-compatible gateway 为什么要默认开启 `stream_usage`。
- Codex provider 如何从 CLI credential 读取认证。
- Claude provider 如何支持 Claude Code OAuth。
- vLLM provider 如何兼容 reasoning 字段和 Qwen thinking 模式。

读完后你应该能新增一个模型配置，并判断它是否需要自定义 provider。

## 8. 第七阶段：读工具系统

核心入口：

```text
backend/packages/harness/deerflow/tools/tools.py
backend/packages/harness/deerflow/tools/builtins/
backend/packages/harness/deerflow/sandbox/tools.py
```

建议阅读顺序：

1. `tools.py`
   - 看 `get_available_tools()` 如何组合配置工具、内置工具、MCP 工具、ACP 工具。
   - 看工具去重、tool group、host bash 隐藏、tool_search deferred registry。

2. `sandbox/tools.py`
   - 这是文件和命令工具的核心。
   - 看 `bash_tool`、`ls_tool`、`glob_tool`、`grep_tool`、`read_file_tool`、`write_file_tool`、`str_replace_tool`。
   - 重点看 local sandbox 下路径校验和虚拟路径替换。

3. `tools/builtins/`
   - `task_tool.py`：subagent 委派。
   - `present_file_tool.py`：产物展示。
   - `clarification_tool.py`：澄清工具。
   - `view_image_tool.py`：图片读取。
   - `tool_search.py`：延迟工具搜索。
   - `invoke_acp_agent_tool.py`：调用 ACP agent。
   - `setup_agent_tool.py`：bootstrap 自定义 agent。

阅读时重点关注安全边界：

- 工具参数如何校验。
- 哪些路径允许读。
- 哪些路径允许写。
- bash 在 LocalSandbox 下为什么默认不一定可用。
- 工具异常如何避免泄漏宿主路径。

## 9. 第八阶段：读 Sandbox

核心文件：

```text
backend/packages/harness/deerflow/sandbox/sandbox.py
backend/packages/harness/deerflow/sandbox/sandbox_provider.py
backend/packages/harness/deerflow/sandbox/middleware.py
backend/packages/harness/deerflow/sandbox/local/local_sandbox.py
backend/packages/harness/deerflow/sandbox/local/local_sandbox_provider.py
backend/packages/harness/deerflow/sandbox/security.py
backend/packages/harness/deerflow/sandbox/search.py
backend/packages/harness/deerflow/sandbox/file_operation_lock.py
```

阅读顺序：

1. `sandbox.py`：抽象接口，定义 execute/read/write/list/glob/grep。
2. `sandbox_provider.py`：provider 生命周期，`acquire/get/release`。
3. `middleware.py`：agent run 中何时 acquire sandbox。
4. `local_sandbox_provider.py`：如何配置 path mappings。
5. `local_sandbox.py`：本地路径解析、命令执行、输出反向映射。
6. `security.py`：host bash 允许策略。

重点理解虚拟路径到真实路径的转换：

```text
/mnt/user-data/workspace -> .deer-flow/.../workspace
/mnt/user-data/uploads   -> .deer-flow/.../uploads
/mnt/user-data/outputs   -> .deer-flow/.../outputs
/mnt/skills              -> skills/
```

## 10. 第九阶段：读 Skills 系统

核心文件：

```text
backend/packages/harness/deerflow/skills/types.py
backend/packages/harness/deerflow/skills/parser.py
backend/packages/harness/deerflow/skills/validation.py
backend/packages/harness/deerflow/skills/security_scanner.py
backend/packages/harness/deerflow/skills/installer.py
backend/packages/harness/deerflow/skills/storage/skill_storage.py
backend/packages/harness/deerflow/skills/storage/local_skill_storage.py
backend/packages/harness/deerflow/skills/storage/__init__.py
```

同时读几个实际 skill：

```text
skills/public/data-analysis/SKILL.md
skills/public/frontend-design/SKILL.md
skills/public/deep-research/SKILL.md
skills/public/chart-visualization/SKILL.md
```

重点理解：

- `SKILL.md` 的 frontmatter schema。
- public skill 和 custom skill 的差异。
- skills 如何被启用/禁用。
- skills 如何进入系统提示词。
- 为什么 skill 内容采用渐进加载，而不是全部注入 prompt。
- skill archive 安装时如何避免路径穿越和嵌套 `SKILL.md`。

## 11. 第十阶段：读 Memory

核心文件：

```text
backend/packages/harness/deerflow/agents/memory/storage.py
backend/packages/harness/deerflow/agents/memory/prompt.py
backend/packages/harness/deerflow/agents/memory/updater.py
backend/packages/harness/deerflow/agents/memory/queue.py
backend/packages/harness/deerflow/agents/memory/message_processing.py
backend/packages/harness/deerflow/agents/memory/summarization_hook.py
backend/packages/harness/deerflow/agents/middlewares/memory_middleware.py
backend/app/gateway/routers/memory.py
```

阅读重点：

- memory JSON 的结构。
- memory 文件路径如何按 user/agent 隔离。
- MemoryMiddleware 在一次 run 后做了什么。
- memory update 是同步还是异步。
- summarization 前为什么需要 flush memory。
- Gateway memory API 如何读写全局记忆。

读完后你应该能回答：

- memory 和 thread history 有什么区别？
- memory 何时注入 prompt？
- memory 何时更新？

## 12. 第十一阶段：读 Subagents

核心文件：

```text
backend/packages/harness/deerflow/tools/builtins/task_tool.py
backend/packages/harness/deerflow/subagents/
backend/packages/harness/deerflow/agents/middlewares/subagent_limit_middleware.py
backend/packages/harness/deerflow/config/subagents_config.py
```

重点理解：

- subagent 类型如何注册。
- `general-purpose` 和 `bash` 的差异。
- 自定义 subagent 如何配置 model、tools、skills、prompt、timeout。
- 父 agent 的 sandbox/thread_data/tool_groups 如何传给子 agent。
- 为什么子 agent 不再暴露 `task`。
- 子任务状态如何通过 custom event 推给前端。

## 13. 第十二阶段：读 MCP 与 ACP

MCP 核心文件：

```text
backend/packages/harness/deerflow/mcp/client.py
backend/packages/harness/deerflow/mcp/tools.py
backend/packages/harness/deerflow/mcp/cache.py
backend/packages/harness/deerflow/mcp/oauth.py
backend/app/gateway/routers/mcp.py
```

ACP 核心文件：

```text
backend/packages/harness/deerflow/config/acp_config.py
backend/packages/harness/deerflow/tools/builtins/invoke_acp_agent_tool.py
```

重点理解：

- MCP server 支持 `stdio`、`sse`、`http`。
- MCP tools 如何缓存和动态刷新。
- Gateway 修改 `extensions_config.json` 后，LangGraph runtime 如何感知变化。
- tool_search 开启后，MCP 工具为什么会 deferred。
- ACP agent 与 subagent 的区别：ACP agent 是外部 agent 进程/协议，subagent 是 DeerFlow 内部 agent executor。

## 14. 第十三阶段：读持久化与权限隔离

核心目录：

```text
backend/packages/harness/deerflow/persistence/
backend/packages/harness/deerflow/runtime/runs/store/
backend/packages/harness/deerflow/runtime/events/store/
backend/packages/harness/deerflow/runtime/checkpointer/
backend/packages/harness/deerflow/runtime/store/
backend/app/gateway/auth/
backend/app/gateway/authz.py
```

重点理解：

- `database.backend` 支持 memory、sqlite、postgres。
- SQLAlchemy engine 如何初始化。
- SQLite 为什么启用 WAL。
- run、run events、feedback、thread meta 分别存什么。
- checkpointer 和 store 的关系。
- user_id 如何通过 contextvar 做隔离。
- owner check 如何防止用户访问别人的 thread/run/artifact。

## 15. 第十四阶段：读上传、产物和文件转换

核心文件：

```text
backend/app/gateway/routers/uploads.py
backend/app/gateway/routers/artifacts.py
backend/packages/harness/deerflow/uploads/manager.py
backend/packages/harness/deerflow/utils/file_conversion.py
backend/packages/harness/deerflow/tools/builtins/present_file_tool.py
frontend/src/core/uploads/
frontend/src/components/workspace/artifacts/
```

重点理解：

- 上传文件如何校验文件名、大小、总量。
- 上传文件如何写入 thread uploads 目录。
- 哪些文档类型可以转换 Markdown。
- artifact URL 如何从虚拟路径映射到真实文件。
- `present_files` 如何让前端出现产物入口。

## 16. 第十五阶段：读 IM Channels

核心文件：

```text
backend/app/channels/service.py
backend/app/channels/manager.py
backend/app/channels/base.py
backend/app/channels/message_bus.py
backend/app/channels/store.py
backend/app/channels/telegram.py
backend/app/channels/slack.py
backend/app/channels/feishu.py
backend/app/channels/dingtalk.py
backend/app/channels/wecom.py
backend/app/channels/wechat.py
backend/app/channels/discord.py
backend/app/gateway/routers/channels.py
```

重点理解：

- ChannelService 如何从 config 加载 channel。
- MessageBus 如何转发平台消息。
- ChannelManager 如何把 IM 消息转换为 DeerFlow run。
- 不同平台的连接方式：long polling、socket mode、WebSocket 等。
- IM session 如何设置 assistant_id、context、thread_id。

## 17. 第十六阶段：读前端源码

建议先建立页面路由：

```text
frontend/src/app/page.tsx
frontend/src/app/workspace/page.tsx
frontend/src/app/workspace/layout.tsx
frontend/src/app/workspace/chats/page.tsx
frontend/src/app/workspace/chats/[thread_id]/page.tsx
frontend/src/app/workspace/agents/page.tsx
frontend/src/app/(auth)/login/page.tsx
frontend/src/app/(auth)/setup/page.tsx
```

再读业务 core：

```text
frontend/src/core/api/api-client.ts
frontend/src/core/api/fetcher.ts
frontend/src/core/config/index.ts
frontend/src/core/threads/hooks.ts
frontend/src/core/messages/utils.ts
frontend/src/core/uploads/
frontend/src/core/models/
frontend/src/core/skills/
frontend/src/core/mcp/
frontend/src/core/memory/
frontend/src/core/settings/
frontend/src/core/auth/
```

最后读 UI：

```text
frontend/src/components/workspace/input-box.tsx
frontend/src/components/workspace/messages/message-list.tsx
frontend/src/components/workspace/messages/message-list-item.tsx
frontend/src/components/workspace/messages/message-group.tsx
frontend/src/components/workspace/messages/subtask-card.tsx
frontend/src/components/workspace/artifacts/
frontend/src/components/workspace/settings/
frontend/src/components/ai-elements/
frontend/src/components/ui/
```

前端重点理解：

- `getAPIClient()` 如何创建 LangGraph SDK client。
- CSRF header 如何注入。
- `useStream()` 如何绑定 thread 和 assistant。
- `sendMessage()` 如何先上传文件再 submit。
- optimistic message 如何合并。
- stream event 如何更新 title、subtask、retry toast。
- message grouping 如何区分 human、assistant、tool、clarification、present files、subagent。
- artifact viewer 如何读取后端产物。

## 18. 第十七阶段：读测试来确认行为

后端测试非常适合反推设计意图。建议按主题读：

```text
backend/tests/test_create_deerflow_agent.py
backend/tests/test_create_deerflow_agent_live.py
backend/tests/test_lead_agent_prompt.py
backend/tests/test_model_factory.py
backend/tests/test_sandbox_tools_security.py
backend/tests/test_local_sandbox_provider_mounts.py
backend/tests/test_uploads_router.py
backend/tests/test_memory_storage.py
backend/tests/test_memory_router.py
backend/tests/test_subagent_executor.py
backend/tests/test_runs_api_endpoints.py
backend/tests/test_run_manager.py
backend/tests/test_run_event_store.py
backend/tests/test_threads_router.py
backend/tests/test_auth_middleware.py
backend/tests/test_authz.py
backend/tests/test_mcp_client_config.py
backend/tests/test_skills_loader.py
backend/tests/test_skills_installer.py
```

前端测试：

```text
frontend/tests/unit/
frontend/tests/e2e/
```

读测试时重点关注：

- 哪些行为被明确保护。
- 哪些边界条件被覆盖。
- 哪些 fixture 模拟了真实运行环境。
- 新功能应该放在哪个测试层。

## 19. 推荐完整阅读路线

如果时间有限，按这个顺序读：

```text
1. docker/nginx/nginx.local.conf
2. docker/docker-compose.yaml
3. backend/app/gateway/app.py
4. backend/app/gateway/deps.py
5. backend/app/gateway/routers/thread_runs.py
6. backend/app/gateway/services.py
7. backend/packages/harness/deerflow/runtime/runs/worker.py
8. backend/packages/harness/deerflow/agents/lead_agent/agent.py
9. backend/packages/harness/deerflow/agents/lead_agent/prompt.py
10. backend/packages/harness/deerflow/agents/thread_state.py
11. backend/packages/harness/deerflow/models/factory.py
12. backend/packages/harness/deerflow/tools/tools.py
13. backend/packages/harness/deerflow/sandbox/tools.py
14. backend/packages/harness/deerflow/sandbox/local/local_sandbox.py
15. backend/packages/harness/deerflow/config/paths.py
16. backend/packages/harness/deerflow/skills/storage/skill_storage.py
17. backend/packages/harness/deerflow/tools/builtins/task_tool.py
18. backend/packages/harness/deerflow/agents/memory/storage.py
19. frontend/src/core/api/api-client.ts
20. frontend/src/core/threads/hooks.ts
21. frontend/src/core/messages/utils.ts
22. frontend/src/components/workspace/messages/message-list.tsx
23. frontend/src/components/workspace/input-box.tsx
```

如果目标是二次开发，建议再按需求补读：

| 开发目标 | 优先阅读 |
| --- | --- |
| 新增模型 provider | `models/factory.py`、`models/*provider.py`、`config/model_config.py` |
| 新增工具 | `tools/tools.py`、`sandbox/tools.py`、`tools/builtins/` |
| 新增 sandbox backend | `sandbox/sandbox.py`、`sandbox_provider.py`、`local_sandbox_provider.py` |
| 新增 skill 管理能力 | `skills/storage/`、`skills/installer.py`、`gateway/routers/skills.py` |
| 改聊天 UI | `core/threads/hooks.ts`、`core/messages/utils.ts`、`components/workspace/messages/` |
| 改上传/产物 | `routers/uploads.py`、`routers/artifacts.py`、`core/uploads/`、`components/workspace/artifacts/` |
| 改权限/多用户 | `auth/`、`authz.py`、`runtime/user_context.py`、`persistence/` |
| 改子代理 | `task_tool.py`、`subagents/`、`subagents_config.py` |
| 改 IM bot | `app/channels/`、`routers/channels.py` |

## 20. 建议做的源码练习

为了确认你真的理解了代码，可以做这些小练习：

1. 跟踪一次 `sendMessage()`，写出从前端到 `agent.astream()` 的函数调用链。
2. 新增一个只读工具，观察它如何进入 `get_available_tools()`。
3. 创建一个最小 custom skill，确认它如何出现在 prompt 的 `<available_skills>` 中。
4. 上传一个文本文件，跟踪它从 Gateway 到 `/mnt/user-data/uploads` 的路径变化。
5. 打开 plan/pro 模式，观察 TodoMiddleware 如何改变消息流。
6. 打开 ultra 模式，观察 `task` tool call 如何生成 subtask card。
7. 改一个模型配置，确认 `create_chat_model()` 最终传给模型类的参数。
8. 模拟一个工具异常，确认 ToolErrorHandlingMiddleware 如何处理。
9. 删除一个 thread，确认 LangGraph state 和 DeerFlow 文件目录分别如何清理。
10. 阅读一个 backend test，并找到它保护的生产行为。

## 21. 阅读时容易混淆的概念

### Gateway runs API 与 LangGraph Server

仓库有 `backend/langgraph.json`，但生产 compose 中 Gateway 已经实现了 LangGraph Platform 兼容的 runs API。前端的 LangGraph SDK 请求 `/api/langgraph/*`，nginx 会重写到 Gateway。不要误以为生产路径一定有独立 LangGraph server 进程。

### Memory 与 thread history

Thread history 是一次会话的消息和 checkpoint。Memory 是跨会话的结构化长期摘要。Memory 会注入 prompt，但不是完整历史记录。

### Skills 与 tools

Tool 是模型可以直接调用的函数。Skill 是任务工作流说明和资源集合，通常先通过 `read_file` 加载 `SKILL.md`，再按其中指引调用工具或读取资源。

### Subagent 与 ACP agent

Subagent 是 DeerFlow 内部用 `task` 工具启动的子 agent。ACP agent 是通过 ACP 协议调用的外部 agent，例如 Codex 或 Claude Code adapter。

### Sandbox 与 workspace

Agent 看到的是 sandbox 内虚拟路径。LocalSandbox 会映射到宿主机真实路径。不要在 agent-facing 逻辑里直接暴露宿主绝对路径。

### Artifact 与 upload

Upload 是用户输入文件，位于 `/mnt/user-data/uploads`。Artifact 是 agent 生成并展示给用户的输出，通常位于 `/mnt/user-data/outputs`。

## 22. 最后建议

阅读 DeerFlow 这类项目时，不要从所有文件平铺开始。最有效的方法是抓住一条主链路：

```text
前端 submit
  -> Gateway runs API
  -> RunManager
  -> run_agent
  -> make_lead_agent
  -> middleware
  -> model/tool/sandbox
  -> StreamBridge
  -> 前端渲染
```

围绕这条链路读完后，再横向展开到 memory、skills、subagents、MCP、channels 和 persistence。这样读，代码规模虽大，但每个模块的位置和边界会比较清楚。

