# DeerFlow 启动与 Claude Code 配置指南

本文说明当前 DeerFlow 项目的启动方式、为什么官方文档使用 `make`、如何不通过 `make` 手动启动，以及如何接入 Claude Code / 自定义 Claude Code API。

## 1. 为什么项目用 `make`

根目录的 `Makefile` 是项目提供的统一启动入口。它不是 DeerFlow 运行时必须依赖的技术，而是把一组复杂命令封装成短命令，减少手动操作。

`make` 主要封装这些事情：

- 生成 `config.yaml` 和本地 `.env`。
- 检查 Node.js、pnpm、uv、nginx 等依赖。
- 安装 backend / frontend 依赖。
- 启动 frontend、Gateway、nginx。
- Docker 模式下启动 nginx、frontend、gateway、可选 provisioner。
- 初始化 sandbox 镜像。
- 执行 doctor/check/test/lint 等辅助流程。

所以官方推荐：

```bash
make setup
make dev
```

或 Docker 模式：

```bash
make docker-init
make docker-start
```

本质上，`make` 是“项目脚本入口”，不是业务代码的一部分。

## 2. Windows 注意事项

当前项目 README 明确建议 Windows 用户使用 **Git Bash** 运行本地开发流程。原因是项目中的部分服务脚本是 bash 脚本，并依赖 Git for Windows 的工具，例如 `cygpath`。

不建议直接在 PowerShell 或 cmd.exe 里跑本地 `make dev` 流程。

推荐：

```bash
cd /e/02_development_space/open_project/deer-flow
make setup
make dev
```

如果用 PowerShell，只适合执行简单查看命令；真正启动服务建议切到 Git Bash。

## 3. 推荐启动方式：Docker 模式

Docker 模式最接近项目推荐部署方式，适合少踩本机环境坑。

### 3.1 首次准备

在 Git Bash 中进入项目：

```bash
cd /e/02_development_space/open_project/deer-flow
```

生成配置：

```bash
make setup
```

或使用完整模板：

```bash
make config
```

编辑：

```text
config.yaml
.env
extensions_config.json
```

### 3.2 初始化 sandbox 镜像

```bash
make docker-init
```

### 3.3 启动

```bash
make docker-start
```

访问：

```text
http://localhost:2026
```

### 3.4 停止

```bash
make docker-stop
```

或生产 compose：

```bash
make down
```

## 4. 推荐启动方式：本地开发模式

本地开发模式会在本机直接跑 backend、frontend、nginx。

### 4.1 检查环境

```bash
make check
```

项目要求大致包括：

- Python 3.12+
- Node.js 22+
- pnpm
- uv
- nginx
- Git Bash on Windows

### 4.2 安装依赖

```bash
make install
```

### 4.3 启动

```bash
make dev
```

访问：

```text
http://localhost:2026
```

## 5. 不使用 make 的手动启动方式

如果你不想用 `make`，可以手动启动底层服务。需要自己负责进程顺序、环境变量、配置文件和 nginx。

### 5.1 准备配置

根目录需要有：

```text
config.yaml
.env
extensions_config.json
```

可以从模板复制：

```bash
cp config.example.yaml config.yaml
cp extensions_config.example.json extensions_config.json
cp .env.example .env
```

### 5.2 启动 Gateway

```bash
cd backend
uv sync
PYTHONPATH=. uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001
```

PowerShell 形式：

```powershell
cd E:\02_development_space\open_project\deer-flow\backend
uv sync
$env:PYTHONPATH="."
uv run uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001
```

### 5.3 启动前端

```bash
cd frontend
corepack pnpm install
corepack pnpm dev
```

默认前端端口：

```text
http://localhost:3000
```

### 5.4 启动 nginx 统一入口

项目推荐通过 nginx 暴露统一入口 `:2026`：

```text
http://localhost:2026
```

nginx 负责：

- `/` -> frontend `:3000`
- `/api/*` -> Gateway `:8001`
- `/api/langgraph/*` -> Gateway LangGraph-compatible API

本地 nginx 配置位于：

```text
docker/nginx/nginx.local.conf
```

如果不启动 nginx，也可以临时让前端直接访问 Gateway，但需要正确设置前端环境变量，例如 `NEXT_PUBLIC_BACKEND_BASE_URL`、`NEXT_PUBLIC_LANGGRAPH_BASE_URL`，并处理 CORS。

因此手动模式下仍建议保留 nginx。

## 6. Claude Code 接入方式

DeerFlow 支持 CLI-backed provider，包括 Claude Code OAuth provider。配置入口在 `config.yaml` 的 `models` 字段。

### 6.1 Claude Code OAuth Provider

如果你的 Claude Code 认证来自本机 Claude Code，例如：

- `CLAUDE_CODE_OAUTH_TOKEN`
- `ANTHROPIC_AUTH_TOKEN`
- `CLAUDE_CODE_CREDENTIALS_PATH`
- `~/.claude/.credentials.json`

可以在 `config.yaml` 中配置：

```yaml
models:
  - name: claude-code
    display_name: Claude Code
    use: deerflow.models.claude_provider:ClaudeChatModel
    model: claude-sonnet-4-6
    max_tokens: 4096
    supports_thinking: true
```

然后在 `.env` 中放入 token：

```env
CLAUDE_CODE_OAUTH_TOKEN=your_token_here
```

或：

```env
ANTHROPIC_AUTH_TOKEN=your_token_here
```

也可以指定 credentials 文件：

```env
CLAUDE_CODE_CREDENTIALS_PATH=C:\Users\your-name\.claude\.credentials.json
```

Docker 模式下，compose 已经挂载了：

```text
~/.claude -> /root/.claude
~/.codex  -> /root/.codex
```

所以如果你的认证文件在用户目录，容器中也能读取。

### 6.2 自定义 Claude Code API 是 Anthropic-compatible 网关

如果你的“自定义 Claude Code API”本质是 Anthropic-compatible API，通常更适合使用 LangChain Anthropic provider 或项目的 Claude provider，具体取决于网关协议。

示例：

```yaml
models:
  - name: custom-claude
    display_name: Custom Claude
    use: langchain_anthropic:ChatAnthropic
    model: claude-sonnet-4-6
    api_key: $ANTHROPIC_API_KEY
    base_url: https://your-custom-claude-api.example.com
    max_tokens: 4096
    supports_thinking: true
```

`.env`：

```env
ANTHROPIC_API_KEY=your_api_key_here
```

注意：是否支持 `base_url` 取决于你使用的 provider 类和网关兼容性。如果启动时报参数不支持，需要改用对应自定义 provider 或 OpenAI-compatible 配置。

### 6.3 自定义 Claude Code API 是 OpenAI-compatible 网关

如果你的自定义 API 是 OpenAI-compatible，即接口形态类似 `/v1/chat/completions` 或 `/v1/responses`，可以配置为：

```yaml
models:
  - name: custom-claude-openai-compatible
    display_name: Custom Claude API
    use: langchain_openai:ChatOpenAI
    model: your-model-name
    api_key: $CUSTOM_CLAUDE_API_KEY
    base_url: https://your-custom-api.example.com/v1
    max_tokens: 4096
    supports_thinking: false
```

`.env`：

```env
CUSTOM_CLAUDE_API_KEY=your_api_key_here
```

如果你的网关支持 OpenAI Responses API，可以加：

```yaml
    use_responses_api: true
    output_version: responses/v1
```

## 7. 启动后如何选择模型

启动后访问：

```text
http://localhost:2026
```

在 Web UI 中进入设置或模型选择区域，选择你在 `config.yaml` 中配置的模型，例如：

```text
Claude Code
Custom Claude API
```

如果列表中没有出现：

1. 检查 `config.yaml` 是否被当前进程读取。
2. 检查 YAML 缩进。
3. 检查 Gateway 日志是否有 config load error。
4. 重启服务。

## 8. 常见问题

### 8.1 为什么 PowerShell 里 pnpm 报执行策略错误

PowerShell 可能禁止执行 `pnpm.ps1`：

```text
无法加载文件 pnpm.ps1，因为在此系统上禁止运行脚本
```

可以使用：

```powershell
corepack pnpm install
corepack pnpm dev
```

但本项目整体仍建议用 Git Bash 启动。

### 8.2 Node 版本要求

DeerFlow 当前 README 要求 Node.js 22+。你之前环境中 `node --version` 是：

```text
v22.14.0
```

这对 DeerFlow 是满足的。

### 8.3 git status 报 dubious ownership

如果 Git 报：

```text
fatal: detected dubious ownership in repository
```

可以执行：

```bash
git config --global --add safe.directory E:/02_development_space/open_project/deer-flow
```

这是 Git 安全检查，不是 DeerFlow 本身问题。

### 8.4 启动后 2026 访问不了

按顺序检查：

```bash
make doctor
make check
```

或手动检查：

```bash
curl http://localhost:8001/health
curl http://localhost:3000
curl http://localhost:2026/health
```

如果 `8001` 正常但 `2026` 不正常，通常是 nginx 问题。

如果 `3000` 不正常，通常是前端依赖或 Next.js 启动问题。

如果 `8001` 不正常，通常是 Python 依赖、配置文件或模型配置问题。

### 8.5 Claude Code 模型启动时报认证错误

检查：

```bash
echo $CLAUDE_CODE_OAUTH_TOKEN
echo $ANTHROPIC_AUTH_TOKEN
echo $CLAUDE_CODE_CREDENTIALS_PATH
```

PowerShell：

```powershell
echo $env:CLAUDE_CODE_OAUTH_TOKEN
echo $env:ANTHROPIC_AUTH_TOKEN
echo $env:CLAUDE_CODE_CREDENTIALS_PATH
```

Docker 模式下还要确认 `.env` 是否被 compose 读取，以及 `~/.claude` 是否正确挂载。

## 9. 建议的最小启动流程

如果你只是想尽快把当前项目跑起来，建议：

```bash
cd /e/02_development_space/open_project/deer-flow
make setup
```

编辑 `config.yaml` 和 `.env`，放入 Claude Code 配置。

然后：

```bash
make docker-init
make docker-start
```

访问：

```text
http://localhost:2026
```

如果你要本地热更新开发：

```bash
make check
make install
make dev
```

