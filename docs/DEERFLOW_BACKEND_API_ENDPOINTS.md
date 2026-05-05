# DeerFlow 后端接口清单

本文档整理当前 DeerFlow 后端所有主要 HTTP 接口。你当前是 `make docker-start` 部署，对外统一入口是：

```text
http://服务器IP:2026
```

所以接口完整访问形式通常是：

```text
http://服务器IP:2026/api/...
```

例如：

```text
http://38.76.212.20:2026/api/models
```

## 访问入口

| 入口 | 用途 | 说明 |
| --- | --- | --- |
| `/` | DeerFlow 前端 | nginx 转发到 frontend |
| `/api/*` | DeerFlow Gateway API | nginx 转发到 gateway:8001 |
| `/api/langgraph/*` | LangGraph SDK 兼容入口 | nginx rewrite 到 `/api/*` |
| `/health` | 健康检查 | gateway 健康接口 |
| `/docs` | Swagger UI | `GATEWAY_ENABLE_DOCS` 未关闭时可用 |
| `/redoc` | ReDoc | `GATEWAY_ENABLE_DOCS` 未关闭时可用 |
| `/openapi.json` | OpenAPI schema | `GATEWAY_ENABLE_DOCS` 未关闭时可用 |

## 认证与 CSRF

当前 Gateway 的认证中间件是 fail-closed：除公开接口外，其他接口都要求登录后的 `access_token` cookie。

公开接口：

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/redoc` | ReDoc |
| `GET` | `/openapi.json` | OpenAPI schema |
| `POST` | `/api/v1/auth/login/local` | 本地账号登录 |
| `POST` | `/api/v1/auth/register` | 注册普通用户 |
| `POST` | `/api/v1/auth/logout` | 登出 |
| `GET` | `/api/v1/auth/setup-status` | 检查是否需要初始化管理员 |
| `POST` | `/api/v1/auth/initialize` | 首次初始化管理员 |

状态变更请求还会触发 CSRF 校验：

```text
POST / PUT / PATCH / DELETE
```

除认证豁免接口外，需要同时带：

```text
Cookie: access_token=...
Cookie: csrf_token=...
X-CSRF-Token: <csrf_token>
```

## Auth 接口

前缀：

```text
/api/v1/auth
```

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login/local` | 本地邮箱密码登录，成功后设置 cookie | 公开 |
| `POST` | `/api/v1/auth/register` | 注册普通用户，成功后自动登录 | 公开 |
| `POST` | `/api/v1/auth/logout` | 清除登录 cookie | 公开 |
| `POST` | `/api/v1/auth/change-password` | 修改当前用户密码，可用于 setup 流程 | 需要登录 |
| `GET` | `/api/v1/auth/me` | 获取当前登录用户 | 需要登录 |
| `GET` | `/api/v1/auth/setup-status` | 检查是否还没有管理员账号 | 公开，有限流 |
| `POST` | `/api/v1/auth/initialize` | 创建首个管理员账号 | 公开，仅首次可用 |
| `GET` | `/api/v1/auth/oauth/{provider}` | OAuth 登录占位接口 | 当前未实现 |
| `GET` | `/api/v1/auth/callback/{provider}` | OAuth 回调占位接口 | 当前未实现 |

## Models 接口

前缀：

```text
/api
```

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/models` | 获取已配置模型列表 | 需要登录 |
| `GET` | `/api/models/{model_name}` | 获取指定模型详情 | 需要登录 |

## MCP 接口

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/mcp/config` | 获取 MCP server 配置 | 需要登录 |
| `PUT` | `/api/mcp/config` | 更新 MCP server 配置 | 需要登录 + CSRF |

## Memory 接口

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/memory` | 获取当前用户 memory 数据 | 需要登录 |
| `POST` | `/api/memory/reload` | 从存储文件重新加载 memory | 需要登录 + CSRF |
| `DELETE` | `/api/memory` | 清空 memory 数据 | 需要登录 + CSRF |
| `POST` | `/api/memory/facts` | 创建一条 memory fact | 需要登录 + CSRF |
| `DELETE` | `/api/memory/facts/{fact_id}` | 删除一条 memory fact | 需要登录 + CSRF |
| `PATCH` | `/api/memory/facts/{fact_id}` | 更新一条 memory fact | 需要登录 + CSRF |
| `GET` | `/api/memory/export` | 导出 memory 数据 | 需要登录 |
| `POST` | `/api/memory/import` | 导入并覆盖 memory 数据 | 需要登录 + CSRF |
| `GET` | `/api/memory/config` | 获取 memory 配置 | 需要登录 |
| `GET` | `/api/memory/status` | 获取 memory 配置和当前数据 | 需要登录 |

## Skills 接口

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/skills` | 获取全部 skills | 需要登录 |
| `POST` | `/api/skills/install` | 从 thread 文件安装 `.skill` 包 | 需要登录 + CSRF |
| `GET` | `/api/skills/custom` | 获取自定义 skills | 需要登录 |
| `GET` | `/api/skills/custom/{skill_name}` | 获取自定义 skill 的 `SKILL.md` 内容 | 需要登录 |
| `PUT` | `/api/skills/custom/{skill_name}` | 编辑自定义 skill | 需要登录 + CSRF |
| `DELETE` | `/api/skills/custom/{skill_name}` | 删除自定义 skill | 需要登录 + CSRF |
| `GET` | `/api/skills/custom/{skill_name}/history` | 获取自定义 skill 历史 | 需要登录 |
| `POST` | `/api/skills/custom/{skill_name}/rollback` | 回滚自定义 skill | 需要登录 + CSRF |
| `GET` | `/api/skills/{skill_name}` | 获取指定 skill 详情 | 需要登录 |
| `PUT` | `/api/skills/{skill_name}` | 启用或禁用指定 skill | 需要登录 + CSRF |

## Agents 接口

这些接口受 `config.yaml` 控制，需要：

```yaml
agents_api:
  enabled: true
```

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/agents` | 获取自定义 agent 列表 | 需要登录 |
| `GET` | `/api/agents/check?name={name}` | 检查 agent 名称是否可用 | 需要登录 |
| `GET` | `/api/agents/{name}` | 获取指定 agent 配置和 SOUL.md | 需要登录 |
| `POST` | `/api/agents` | 创建自定义 agent | 需要登录 + CSRF |
| `PUT` | `/api/agents/{name}` | 更新自定义 agent | 需要登录 + CSRF |
| `DELETE` | `/api/agents/{name}` | 删除自定义 agent | 需要登录 + CSRF |
| `GET` | `/api/user-profile` | 获取全局 USER.md 用户画像 | 需要登录 |
| `PUT` | `/api/user-profile` | 更新全局 USER.md 用户画像 | 需要登录 + CSRF |

## Threads 接口

前缀：

```text
/api/threads
```

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/threads` | 创建 thread | 需要登录 + CSRF |
| `POST` | `/api/threads/search` | 搜索 thread 列表 | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}` | 获取 thread 信息 | 需要登录 |
| `PATCH` | `/api/threads/{thread_id}` | 更新 thread metadata | 需要登录 + CSRF |
| `DELETE` | `/api/threads/{thread_id}` | 删除 thread 及相关本地数据 | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/state` | 获取 thread 当前状态 | 需要登录 |
| `POST` | `/api/threads/{thread_id}/state` | 更新 thread 状态，用于恢复/人工介入 | 需要登录 + CSRF |
| `POST` | `/api/threads/{thread_id}/history` | 获取 thread checkpoint 历史 | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/token-usage` | 获取 thread token 用量聚合 | 需要登录 |

## Thread Runs 接口

这些是主要 agent 执行接口。

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/threads/{thread_id}/runs` | 创建后台 run，立即返回 | 需要登录 + CSRF |
| `POST` | `/api/threads/{thread_id}/runs/stream` | 创建 run 并通过 SSE 流式返回 | 需要登录 + CSRF |
| `POST` | `/api/threads/{thread_id}/runs/wait` | 创建 run 并等待完成 | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/runs` | 获取 thread 下所有 runs | 需要登录 |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}` | 获取 run 详情 | 需要登录 |
| `POST` | `/api/threads/{thread_id}/runs/{run_id}/cancel` | 取消 run | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/join` | 加入已有 run 的 SSE 流 | 需要登录 |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/stream` | 加入已有 run 的 SSE 流 | 需要登录 |
| `POST` | `/api/threads/{thread_id}/runs/{run_id}/stream` | 取消后继续消费剩余 SSE 事件 | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/messages` | 获取 thread 维度消息列表 | 需要登录 |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/messages` | 获取指定 run 的消息 | 需要登录 |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/events` | 获取指定 run 的事件流记录 | 需要登录 |

## Stateless Runs 接口

前缀：

```text
/api/runs
```

这些接口可以不预先创建 thread。若请求体中 `config.configurable.thread_id` 存在，会复用该 thread；否则自动创建临时 thread。

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/runs/stream` | 无状态创建 run 并 SSE 流式返回 | 需要登录 + CSRF |
| `POST` | `/api/runs/wait` | 无状态创建 run 并等待完成 | 需要登录 + CSRF |
| `GET` | `/api/runs/{run_id}/messages` | 按 run_id 获取消息 | 需要登录 |
| `GET` | `/api/runs/{run_id}/feedback` | 按 run_id 获取反馈 | 需要登录 |

## Feedback 接口

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `PUT` | `/api/threads/{thread_id}/runs/{run_id}/feedback` | 创建或更新当前用户对 run 的反馈 | 需要登录 + CSRF |
| `DELETE` | `/api/threads/{thread_id}/runs/{run_id}/feedback` | 删除当前用户对 run 的反馈 | 需要登录 + CSRF |
| `POST` | `/api/threads/{thread_id}/runs/{run_id}/feedback` | 新增一条反馈 | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/feedback` | 获取 run 的反馈列表 | 需要登录 |
| `GET` | `/api/threads/{thread_id}/runs/{run_id}/feedback/stats` | 获取 run 的反馈统计 | 需要登录 |
| `DELETE` | `/api/threads/{thread_id}/runs/{run_id}/feedback/{feedback_id}` | 删除指定反馈记录 | 需要登录 + CSRF |

## Artifacts 接口

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/threads/{thread_id}/artifacts/{path:path}` | 获取 agent 生成的文件或 artifact | 需要登录 |

常见参数：

```text
?download=true
```

用于强制下载文件。

## Uploads 接口

前缀：

```text
/api/threads/{thread_id}/uploads
```

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/threads/{thread_id}/uploads` | 上传文件到 thread | 需要登录 + CSRF |
| `GET` | `/api/threads/{thread_id}/uploads/limits` | 获取上传限制 | 需要登录 |
| `GET` | `/api/threads/{thread_id}/uploads/list` | 获取已上传文件列表 | 需要登录 |
| `DELETE` | `/api/threads/{thread_id}/uploads/{filename}` | 删除已上传文件 | 需要登录 + CSRF |

## Suggestions 接口

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/threads/{thread_id}/suggestions` | 根据对话上下文生成后续问题建议 | 需要登录 + CSRF |

## Channels 接口

用于 IM channel 集成状态管理。

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `GET` | `/api/channels/` | 获取所有 channel 状态 | 需要登录 |
| `POST` | `/api/channels/{name}/restart` | 重启指定 channel | 需要登录 + CSRF |

## Assistants 兼容接口

这些接口用于兼容 LangGraph Platform SDK。

前缀：

```text
/api/assistants
```

| Method | Path | 说明 | 认证 |
| --- | --- | --- | --- |
| `POST` | `/api/assistants/search` | 搜索 assistants | 需要登录 + CSRF |
| `GET` | `/api/assistants/{assistant_id}` | 获取 assistant | 需要登录 |
| `GET` | `/api/assistants/{assistant_id}/graph` | 获取 assistant graph 结构 | 需要登录 |
| `GET` | `/api/assistants/{assistant_id}/schemas` | 获取 assistant schema 信息 | 需要登录 |

## LangGraph 兼容路径

nginx 会把：

```text
/api/langgraph/{path}
```

rewrite 成：

```text
/api/{path}
```

所以前端或 LangGraph SDK 常见调用是：

| 外部路径 | Gateway 实际路径 |
| --- | --- |
| `/api/langgraph/threads` | `/api/threads` |
| `/api/langgraph/threads/search` | `/api/threads/search` |
| `/api/langgraph/threads/{thread_id}/runs/stream` | `/api/threads/{thread_id}/runs/stream` |
| `/api/langgraph/assistants/search` | `/api/assistants/search` |
| `/api/langgraph/runs/stream` | `/api/runs/stream` |

注意：`/api/langgraph/*` 是 nginx/Next.js 层面的兼容路径，Gateway 内部真实 router 仍然是 `/api/*`。

## Provisioner 可选接口

仅在 Kubernetes/provisioner sandbox 模式下使用。服务端口是 `8002`，nginx 中也有：

```text
/api/sandboxes -> provisioner:8002
```

provisioner 自身接口：

| Method | Path | 说明 |
| --- | --- | --- |
| `GET` | `/health` | provisioner 健康检查 |
| `POST` | `/api/sandboxes` | 创建 sandbox Pod + NodePort Service |
| `GET` | `/api/sandboxes` | 列出所有 sandboxes |
| `GET` | `/api/sandboxes/{sandbox_id}` | 查询指定 sandbox 状态 |
| `DELETE` | `/api/sandboxes/{sandbox_id}` | 删除指定 sandbox |

## 最常用业务接入接口

如果你的业务后端要调用 DeerFlow，优先关注这些：

| 阶段 | Method | Path |
| --- | --- | --- |
| 登录 | `POST` | `/api/v1/auth/login/local` |
| 创建会话 | `POST` | `/api/threads` |
| 发起流式 agent | `POST` | `/api/threads/{thread_id}/runs/stream` |
| 等待 agent 完成 | `POST` | `/api/threads/{thread_id}/runs/wait` |
| 获取消息 | `GET` | `/api/threads/{thread_id}/messages` |
| 上传文件 | `POST` | `/api/threads/{thread_id}/uploads` |
| 获取 artifact | `GET` | `/api/threads/{thread_id}/artifacts/{path:path}` |
| 获取模型 | `GET` | `/api/models` |
| 获取 skills | `GET` | `/api/skills` |

## curl 示例

检查服务：

```bash
curl http://38.76.212.20:2026/health
```

检查初始化状态：

```bash
curl http://38.76.212.20:2026/api/v1/auth/setup-status
```

登录并保存 cookie：

```bash
curl -i -c cookies.txt \
  -X POST http://38.76.212.20:2026/api/v1/auth/login/local \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "username=admin@example.com&password=你的密码"
```

读取 CSRF token：

```bash
CSRF=$(grep csrf_token cookies.txt | awk '{print $7}')
```

创建 thread：

```bash
curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -X POST http://38.76.212.20:2026/api/threads \
  -d '{"metadata":{"source":"business-backend"}}'
```

获取模型列表：

```bash
curl -b cookies.txt http://38.76.212.20:2026/api/models
```

