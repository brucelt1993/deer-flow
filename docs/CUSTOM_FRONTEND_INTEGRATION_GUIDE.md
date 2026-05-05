# 自建前端对接 DeerFlow 后端指南

本文说明如何把当前 DeerFlow 项目作为独立后端 agent runtime 使用，并用你自己的前端进行对接。

结论先说清楚：可以对接，但它不是 OpenAI `/v1/chat/completions` 协议，而是 **LangGraph-compatible Runs API + DeerFlow Gateway API**。你自建前端需要按 DeerFlow/LangGraph 的线程、run、SSE、上传、产物和鉴权协议接入。

## 1. 后端能力边界

DeerFlow 后端提供两类接口：

| 类型 | 作用 | 典型路径 |
| --- | --- | --- |
| LangGraph-compatible Runs API | 创建线程 run、流式聊天、取消、恢复、读取 run 消息 | `/api/threads/{thread_id}/runs/stream` |
| DeerFlow Gateway API | 模型、上传、产物、skills、MCP、memory、agents、auth、channels 等 | `/api/models`、`/api/threads/{thread_id}/uploads` |

如果保留项目自带 nginx，对外推荐路径是：

```text
https://your-domain.com/api/langgraph
```

nginx 会把：

```text
/api/langgraph/*
```

重写到 Gateway 的：

```text
/api/*
```

如果绕过 nginx，直接连 Gateway，则基础地址是：

```text
http://gateway-host:8001/api
```

## 2. 推荐部署拓扑

### 2.1 保留 DeerFlow nginx

这是最省事的方式：

```text
Your Frontend
  -> https://deerflow-domain.com/api/langgraph
  -> nginx :2026
  -> Gateway :8001
```

优点：

- 路径和当前官方前端一致。
- nginx 已处理 `/api/langgraph` rewrite。
- nginx 已处理 SSE 相关 buffering 配置。
- 上传、artifact、auth、health 等路径一致。

你的前端只需要配置：

```text
DEERFLOW_LANGGRAPH_BASE_URL=https://deerflow-domain.com/api/langgraph
DEERFLOW_BACKEND_BASE_URL=https://deerflow-domain.com
```

### 2.2 直接连 Gateway

```text
Your Frontend
  -> http://gateway-host:8001/api
  -> Gateway :8001
```

这种方式需要你自己处理：

- CORS。
- Cookie 鉴权跨域。
- CSRF header。
- SSE 代理 buffering。
- `/api/langgraph` 路径兼容。

如果你的前端和 Gateway 不同域，需要设置 Gateway 环境变量：

```bash
GATEWAY_CORS_ORIGINS=https://your-frontend-domain.com
```

不要使用 `*` 搭配 cookie credentials。

## 3. 核心对接方式一：使用 LangGraph JS SDK

这是推荐方式。当前 DeerFlow 前端也是用这个方式。

安装：

```bash
pnpm add @langchain/langgraph-sdk
```

创建 client：

```ts
import { Client } from "@langchain/langgraph-sdk/client";

export const deerflowClient = new Client({
  apiUrl: "https://deerflow-domain.com/api/langgraph",
});
```

如果你直接连接 Gateway，不经过 nginx：

```ts
export const deerflowClient = new Client({
  apiUrl: "http://gateway-host:8001/api",
});
```

## 4. 最小聊天流式示例

```ts
import { Client } from "@langchain/langgraph-sdk/client";

const client = new Client({
  apiUrl: "https://deerflow-domain.com/api/langgraph",
});

const threadId = crypto.randomUUID();

const stream = client.runs.stream(threadId, "lead_agent", {
  input: {
    messages: [
      {
        type: "human",
        content: [
          {
            type: "text",
            text: "你好，帮我分析一下 DeerFlow 的架构",
          },
        ],
      },
    ],
  },
  config: {
    recursion_limit: 1000,
  },
  context: {
    model_name: "claude-code",
    thinking_enabled: true,
    is_plan_mode: false,
    subagent_enabled: false,
    thread_id: threadId,
  },
  streamMode: ["values", "messages-tuple", "custom"],
  streamSubgraphs: true,
});

for await (const event of stream) {
  console.log(event);
}
```

注意：

- `assistant_id` 一般用 `lead_agent`。
- `threadId` 由前端生成或从历史会话读取。
- `context.model_name` 必须对应后端 `config.yaml` 中的模型 `name`。
- 响应是 stream event，不是一次性 JSON。

## 5. 当前前端的参考实现

可以直接参考当前项目：

```text
frontend/src/core/api/api-client.ts
frontend/src/core/threads/hooks.ts
frontend/src/core/messages/utils.ts
frontend/src/core/uploads/
frontend/src/components/workspace/messages/
frontend/src/components/workspace/artifacts/
```

关键点：

- `api-client.ts` 创建 LangGraph SDK client。
- `hooks.ts` 使用 `useStream()` 发送消息、接收 stream、上传文件、合并 optimistic messages。
- `messages/utils.ts` 解析消息类型、tool calls、reasoning、present files、clarification、subagent。

## 6. 纯 HTTP/SSE 对接方式

如果你不想使用 LangGraph SDK，可以直接调 HTTP。

### 6.1 创建并流式运行

请求：

```http
POST /api/threads/{thread_id}/runs/stream
Content-Type: application/json
Accept: text/event-stream
```

如果经过 nginx，对外路径是：

```http
POST /api/langgraph/threads/{thread_id}/runs/stream
```

请求体：

```json
{
  "assistant_id": "lead_agent",
  "input": {
    "messages": [
      {
        "type": "human",
        "content": [
          {
            "type": "text",
            "text": "你好"
          }
        ]
      }
    ]
  },
  "config": {
    "recursion_limit": 1000
  },
  "context": {
    "model_name": "claude-code",
    "thinking_enabled": true,
    "is_plan_mode": false,
    "subagent_enabled": false
  },
  "stream_mode": ["values", "messages-tuple", "custom"],
  "stream_subgraphs": true,
  "multitask_strategy": "reject",
  "on_disconnect": "cancel"
}
```

响应为 SSE：

```text
event: metadata
data: {"run_id":"...","thread_id":"..."}
id: ...

event: values
data: {...}
id: ...

event: messages
data: [...]
id: ...

event: custom
data: {"type":"task_started",...}
id: ...

event: end
data: null
id: ...
```

### 6.2 fetch 读取 SSE 示例

```ts
async function streamDeerFlowMessage(params: {
  baseUrl: string;
  threadId: string;
  text: string;
}) {
  const res = await fetch(
    `${params.baseUrl}/api/langgraph/threads/${params.threadId}/runs/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      credentials: "include",
      body: JSON.stringify({
        assistant_id: "lead_agent",
        input: {
          messages: [
            {
              type: "human",
              content: [{ type: "text", text: params.text }],
            },
          ],
        },
        context: {
          thinking_enabled: true,
          is_plan_mode: false,
          subagent_enabled: false,
        },
        stream_mode: ["values", "messages-tuple", "custom"],
        stream_subgraphs: true,
      }),
    },
  );

  if (!res.ok || !res.body) {
    throw new Error(`Run stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);
      if (!event) continue;

      if (event.event === "end") {
        return;
      }

      console.log(event.event, event.data);
    }
  }
}

function parseSseFrame(frame: string) {
  const lines = frame.split("\n");
  let event = "message";
  let data = "";
  let id: string | undefined;

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      event = line.slice("event: ".length);
    } else if (line.startsWith("data: ")) {
      data += line.slice("data: ".length);
    } else if (line.startsWith("id: ")) {
      id = line.slice("id: ".length);
    }
  }

  return {
    event,
    id,
    data: data ? JSON.parse(data) : null,
  };
}
```

生产建议使用成熟 SSE parser，避免多行 data、断线续传等边界问题。

## 7. Run context 参数说明

DeerFlow 通过 `context` 控制运行模式。

常用字段：

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `model_name` | string | 指定使用 `config.yaml` 中哪个模型 |
| `thinking_enabled` | boolean | 是否开启模型 thinking/reasoning |
| `reasoning_effort` | string | reasoning 强度，如 `low`、`medium`、`high`、`xhigh` |
| `is_plan_mode` | boolean | 是否开启 TodoMiddleware |
| `subagent_enabled` | boolean | 是否暴露 `task` 子代理工具 |
| `max_concurrent_subagents` | number | 单轮最多并行子代理数 |
| `agent_name` | string | 使用自定义 agent |
| `is_bootstrap` | boolean | 是否进入 bootstrap agent 创建流程 |

典型模式映射：

```ts
const context = {
  model_name: "claude-code",
  thinking_enabled: true,
  is_plan_mode: mode === "pro" || mode === "ultra",
  subagent_enabled: mode === "ultra",
  reasoning_effort:
    mode === "ultra" ? "high" :
    mode === "pro" ? "medium" :
    mode === "thinking" ? "low" :
    undefined,
};
```

## 8. 消息格式

推荐使用 LangChain message 兼容格式：

```json
{
  "type": "human",
  "content": [
    {
      "type": "text",
      "text": "用户输入"
    }
  ]
}
```

也可以使用较简单的：

```json
{
  "role": "user",
  "content": "用户输入"
}
```

但当前前端使用的是结构化 content，建议自建前端也沿用。

## 9. 线程 ID 管理

DeerFlow 的聊天状态按 `thread_id` 隔离。你的前端需要自己管理 thread id。

新会话：

```ts
const threadId = crypto.randomUUID();
```

继续旧会话：

```ts
const threadId = existingThread.thread_id;
```

同一个 thread 连续发送消息，后端会通过 checkpoint/store 恢复上下文。

注意：

- `thread_id` 只能包含字母、数字、下划线、短横线。
- 不要使用包含 `/`、`\`、`.` 的字符串。

## 10. 获取模型列表

请求：

```http
GET /api/models
```

示例：

```ts
async function listModels(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/models`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load models");
  return res.json();
}
```

前端可以用返回的模型 `name` 作为 `context.model_name`。

## 11. 文件上传对接

上传 API：

```http
POST /api/threads/{thread_id}/uploads
Content-Type: multipart/form-data
```

示例：

```ts
async function uploadFiles(baseUrl: string, threadId: string, files: File[]) {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  const res = await fetch(
    `${baseUrl}/api/threads/${encodeURIComponent(threadId)}/uploads`,
    {
      method: "POST",
      body: form,
      credentials: "include",
    },
  );

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }

  return res.json();
}
```

返回中会包含：

```json
{
  "success": true,
  "files": [
    {
      "filename": "example.pdf",
      "virtual_path": "/mnt/user-data/uploads/example.pdf",
      "artifact_url": "/api/threads/.../artifacts/..."
    }
  ]
}
```

发送消息时，把上传文件信息放到 human message 的 `additional_kwargs.files`：

```json
{
  "type": "human",
  "content": [
    {
      "type": "text",
      "text": "请分析我上传的文件"
    }
  ],
  "additional_kwargs": {
    "files": [
      {
        "filename": "example.pdf",
        "size": 123456,
        "path": "/mnt/user-data/uploads/example.pdf",
        "status": "uploaded"
      }
    ]
  }
}
```

后端的 UploadsMiddleware 会在下一次 agent run 中把文件列表注入上下文。

## 12. Artifact 产物展示

Agent 生成最终文件后，通常会放到：

```text
/mnt/user-data/outputs
```

然后调用 `present_files` 工具。你的前端需要识别 assistant message 中的 tool call：

```ts
function hasPresentFiles(message: any) {
  return (
    message.type === "ai" &&
    message.tool_calls?.some((toolCall: any) => toolCall.name === "present_files")
  );
}

function extractPresentFiles(message: any) {
  const files: string[] = [];
  for (const toolCall of message.tool_calls ?? []) {
    if (
      toolCall.name === "present_files" &&
      Array.isArray(toolCall.args?.filepaths)
    ) {
      files.push(...toolCall.args.filepaths);
    }
  }
  return files;
}
```

文件读取路径一般走：

```http
GET /api/threads/{thread_id}/artifacts/{artifact_path}
```

实际 URL 生成逻辑可以参考：

```text
frontend/src/components/workspace/artifacts/
backend/app/gateway/routers/artifacts.py
```

## 13. 历史会话与消息

常用接口：

```http
GET /api/threads/search
GET /api/threads/{thread_id}/runs
GET /api/threads/{thread_id}/runs/{run_id}/messages
DELETE /api/langgraph/threads/{thread_id}
DELETE /api/threads/{thread_id}
```

当前前端的历史消息逻辑在：

```text
frontend/src/core/threads/hooks.ts
```

它会：

1. 查询 thread runs。
2. 按 run 分页拉历史 messages。
3. 与当前 stream 中的 messages 去重合并。
4. 与 optimistic messages 合并。

如果自建前端想简单一点，可以先只做当前线程内 streaming，不做历史分页。等核心聊天跑通后再补历史。

## 14. 取消运行

取消 run：

```http
POST /api/threads/{thread_id}/runs/{run_id}/cancel?action=interrupt
```

或：

```http
POST /api/threads/{thread_id}/runs/{run_id}/stream?action=interrupt&wait=1
```

常见 action：

| action | 说明 |
| --- | --- |
| `interrupt` | 中断当前 run，保留已有 checkpoint |
| `rollback` | 中断并尝试回滚到 run 前 checkpoint |

如果使用 LangGraph SDK，通常可以直接用 SDK 的 stop/join stream 逻辑。

## 15. 鉴权对接

当前 Gateway 默认有 AuthMiddleware 和 CSRF middleware。

认证接口前缀：

```text
/api/v1/auth
```

典型流程：

1. 首次部署访问 `/setup` 创建 admin。
2. 登录后后端设置 HttpOnly cookie。
3. 前端后续请求带 `credentials: "include"`。
4. 状态变更请求带 CSRF header。

fetch 示例：

```ts
await fetch(`${baseUrl}/api/models`, {
  credentials: "include",
});
```

跨域时必须确保：

- Gateway CORS 允许你的前端 origin。
- `Access-Control-Allow-Credentials` 正确。
- cookie SameSite/Secure 策略符合部署域名。

## 16. CSRF 对接

当前前端实现会从 `csrf_token` cookie 读取值，并在状态变更请求中设置：

```http
X-CSRF-Token: <csrf_token>
```

你自建前端也需要类似逻辑：

```ts
function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}

function csrfHeaders(method: string) {
  const stateChanging = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  if (!stateChanging) return {};

  const token = readCookie("csrf_token");
  return token ? { "X-CSRF-Token": decodeURIComponent(token) } : {};
}
```

状态变更请求：

```ts
await fetch(url, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    ...csrfHeaders("POST"),
  },
  body: JSON.stringify(payload),
});
```

如果使用 LangGraph SDK，需要像当前项目 `api-client.ts` 一样，通过 SDK 的 `onRequest` hook 注入 CSRF header。

## 17. 反向代理要求

如果你自建 nginx / Caddy / Traefik / 云网关，SSE 路径必须关闭 buffering。

nginx 示例：

```nginx
location /api/langgraph/ {
    proxy_pass http://gateway:8001/api/;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";

    proxy_buffering off;
    proxy_cache off;
    proxy_set_header X-Accel-Buffering no;

    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    chunked_transfer_encoding on;
}
```

如果 SSE buffering 没关，症状通常是：

- 前端长时间收不到 token。
- 后端日志显示已生成，但浏览器等到结束才一次性收到。
- 中间代理超时断开。

## 18. 自定义 Agent 对接

如果你在 DeerFlow 中创建了自定义 agent，前端可以有两种方式使用。

方式一：assistant_id 使用自定义 agent 名称：

```ts
client.runs.stream(threadId, "my-agent", {
  input: { messages: [...] },
});
```

Gateway 会把非 `lead_agent` 的 assistant_id 转成 `agent_name`。

方式二：显式传 context：

```json
{
  "assistant_id": "lead_agent",
  "context": {
    "agent_name": "my-agent"
  }
}
```

自定义 agent 配置通常位于：

```text
.deer-flow/agents/{agent_name}/
```

## 19. 前端最小功能清单

如果你要做一个能用的自定义前端，最小功能建议：

1. 登录或复用 DeerFlow cookie。
2. 创建 `thread_id`。
3. 发送 human message。
4. 读取 SSE stream。
5. 渲染 assistant text。
6. 渲染 tool call 状态。
7. 支持停止 run。
8. 拉取模型列表。
9. 文件上传。
10. 产物展示。

第一版可以先不做：

- 历史分页。
- skills 管理。
- MCP 管理。
- memory 设置。
- 自定义 agent gallery。
- IM channel 管理。

## 20. 最小 React Hook 示例

```ts
import { useCallback, useMemo, useState } from "react";
import { Client } from "@langchain/langgraph-sdk/client";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function useDeerFlowChat(options: {
  apiUrl: string;
  modelName?: string;
}) {
  const client = useMemo(
    () =>
      new Client({
        apiUrl: options.apiUrl,
      }),
    [options.apiUrl],
  );

  const [threadId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [running, setRunning] = useState(false);

  const send = useCallback(
    async (text: string) => {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setRunning(true);

      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const stream = client.runs.stream(threadId, "lead_agent", {
          input: {
            messages: [
              {
                type: "human",
                content: [{ type: "text", text }],
              },
            ],
          },
          context: {
            model_name: options.modelName,
            thinking_enabled: true,
            is_plan_mode: false,
            subagent_enabled: false,
          },
          streamMode: ["values", "messages-tuple", "custom"],
          streamSubgraphs: true,
        });

        for await (const event of stream) {
          if (event.event === "messages") {
            const data = event.data as unknown;
            // 实际生产中建议按 LangGraph message chunk 精细解析。
            const chunkText = extractTextFromStreamData(data);
            if (chunkText) {
              assistantText += chunkText;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: assistantText,
                  };
                }
                return next;
              });
            }
          }
        }
      } finally {
        setRunning(false);
      }
    },
    [client, threadId, options.modelName],
  );

  return {
    threadId,
    messages,
    running,
    send,
  };
}

function extractTextFromStreamData(data: unknown): string {
  // 这里仅作为占位。真实项目建议直接参考当前仓库的
  // frontend/src/core/messages/utils.ts
  // 和 frontend/src/core/threads/hooks.ts。
  if (typeof data === "string") return data;
  return "";
}
```

这个示例只展示接入形态。真实生产渲染建议复用当前项目里的 message parsing 思路。

## 21. 常见错误排查

### 21.1 404

检查你使用的是哪种 base URL：

```text
保留 nginx: https://domain/api/langgraph
直连 Gateway: http://host:8001/api
```

不要把 nginx 模式和直连 Gateway 模式混用。

### 21.2 401

说明没有登录或 cookie 没带上。

检查：

```ts
credentials: "include"
```

跨域时检查 cookie domain、SameSite、Secure、CORS。

### 21.3 403 CSRF

状态变更请求缺少：

```http
X-CSRF-Token
```

从 `csrf_token` cookie 读取并写入 header。

### 21.4 409

同一 thread 已有 active run。默认 `multitask_strategy` 是 `reject`。

可选：

```json
"multitask_strategy": "interrupt"
```

或：

```json
"multitask_strategy": "rollback"
```

### 21.5 SSE 不流式

检查代理 buffering。nginx 必须：

```nginx
proxy_buffering off;
proxy_cache off;
proxy_set_header X-Accel-Buffering no;
```

### 21.6 模型不生效

检查：

- `context.model_name` 是否等于 `config.yaml` 中模型的 `name`。
- Gateway 是否读取了正确的 `config.yaml`。
- 修改配置后是否重启服务。
- `/api/models` 是否能看到该模型。

## 22. 建议实施顺序

建议按以下顺序接：

1. 跑通 `/api/models`。
2. 跑通最小 `/runs/stream` 文本聊天。
3. 加入 LangGraph SDK 或完善 SSE parser。
4. 加入登录和 CSRF。
5. 加入停止 run。
6. 加入上传。
7. 加入 artifact 展示。
8. 加入历史会话。
9. 加入 model/mode 选择。
10. 再考虑 skills、MCP、memory、自定义 agents 管理页。

