# DeerFlow 后端端口清单

本文档列举 DeerFlow 当前项目中后端相关的端口、访问入口、Docker 网络地址和可选运行模式端口。重点以你当前使用的 `make docker-start` 为准。

## 端口总览

| 端口 | 服务 | 当前 `make docker-start` 是否使用 | 对外暴露 | 说明 |
| --- | --- | --- | --- | --- |
| `2026` | nginx 统一入口 | 是 | 是 | 浏览器和外部 API 调用入口，转发到 frontend 或 gateway |
| `8001` | Gateway / FastAPI / Agent Runtime | 是 | 否，容器内访问 | DeerFlow 后端核心 API，nginx 会代理到这里 |
| `3000` | Next.js frontend dev server | 是 | 否，容器内访问 | 前端服务，nginx 会代理到这里 |
| `8002` | Sandbox Provisioner | 可选 | 否，容器内访问 | 仅 Kubernetes/provisioner sandbox 模式启用 |
| `8080` | AIO Sandbox 容器内部服务端口 | 可选 | 取决于 sandbox 模式 | sandbox 容器内默认 HTTP API 端口 |
| `30000-32767` | Kubernetes NodePort | 可选 | 取决于 K8s 网络 | provisioner 模式下 K8s 自动分配 sandbox 访问端口 |
| `26443` | 本地 K8s API 示例端口 | 可选 | 否 | compose 示例中 `K8S_API_SERVER=https://host.docker.internal:26443` |
| `5432` | PostgreSQL 示例端口 | 可选 | 否 | 仅你把数据库切到 Postgres 时需要 |
| `6379` | Redis 示例端口 | 可选 | 否 | 仅你把 stream bridge 配成 Redis 时需要 |
| `11434` | Ollama 示例端口 | 可选 | 取决于模型部署 | 本地 Ollama 模型服务常用端口 |
| `8000` | vLLM / OpenAI-compatible 示例端口 | 可选 | 取决于模型部署 | `config.yaml` 示例中的本地模型网关 |
| `8989` | MindIE 示例端口 | 可选 | 取决于模型部署 | `config.yaml` 示例中的 MindIE 模型服务 |

## 当前 Docker 开发部署

你使用的是：

```bash
make docker-start
```

实际调用链是：

```text
Makefile
-> scripts/docker.sh start
-> docker compose -p deer-flow-dev -f docker-compose-dev.yaml
```

当前入口：

```text
http://服务器IP:2026
```

API 入口：

```text
http://服务器IP:2026/api/...
```

LangGraph 兼容入口：

```text
http://服务器IP:2026/api/langgraph/...
```

内部服务链路：

```mermaid
flowchart LR
  Client[浏览器或业务后端] --> Nginx[nginx:2026]
  Nginx --> FE[frontend:3000]
  Nginx --> GW[gateway:8001]
  GW --> Agent[Agent Runtime]
```

## `2026`: nginx 统一入口

来源：

- `docker/docker-compose-dev.yaml`
- `docker/docker-compose.yaml`
- `docker/nginx/nginx.conf`

dev compose 配置：

```yaml
ports:
  - "2026:2026"
```

production compose 配置：

```yaml
ports:
  - "${PORT:-2026}:2026"
```

含义：

- 外部访问 DeerFlow 的统一入口。
- `/` 转发到 frontend。
- `/api/*` 转发到 gateway。
- `/api/langgraph/*` 会 rewrite 到 gateway 的 `/api/*`。

常用访问：

```bash
curl http://服务器IP:2026/health
curl http://服务器IP:2026/api/models
curl http://服务器IP:2026/api/v1/auth/setup-status
```

注意：当前 dev compose 的 `"2026:2026"` 会监听公网网卡。服务器部署时，如果不想公网暴露，应改成：

```yaml
ports:
  - "127.0.0.1:2026:2026"
```

或者用防火墙限制 `2026`。

## `8001`: Gateway 后端核心端口

来源：

- `backend/app/gateway/config.py`
- `backend/Makefile`
- `scripts/serve.sh`
- `docker/docker-compose-dev.yaml`
- `docker/docker-compose.yaml`
- `docker/nginx/nginx.conf`

启动命令：

```bash
uvicorn app.gateway.app:app --host 0.0.0.0 --port 8001
```

作用：

- FastAPI Gateway
- 认证 API
- threads / runs / messages
- skills / agents / artifacts / uploads
- LangGraph-compatible API
- Agent Runtime

Docker 内部访问：

```text
http://gateway:8001
```

外部不要直接访问 `8001`，推荐经 nginx：

```text
http://服务器IP:2026/api/...
```

容器内连通性测试：

```bash
docker exec -it deer-flow-frontend sh -lc 'wget -S -O- http://gateway:8001/health'
```

相关环境变量：

```text
GATEWAY_PORT=8001
DEER_FLOW_INTERNAL_GATEWAY_BASE_URL=http://gateway:8001
DEER_FLOW_CHANNELS_LANGGRAPH_URL=http://gateway:8001/api
DEER_FLOW_CHANNELS_GATEWAY_URL=http://gateway:8001
```

## `3000`: Next.js 前端端口

来源：

- `scripts/serve.sh`
- `docker/nginx/nginx.conf`
- `docker/nginx/nginx.local.conf`

作用：

- Next.js dev server 或生产 frontend 服务。
- Docker 内部由 nginx 转发访问。

Docker 内部地址：

```text
http://frontend:3000
```

本地非 Docker 开发地址：

```text
http://localhost:3000
```

外部用户通常不直接访问 `3000`，而是访问：

```text
http://服务器IP:2026
```

## `8002`: Sandbox Provisioner 端口

来源：

- `docker/provisioner/Dockerfile`
- `docker/provisioner/app.py`
- `docker/docker-compose-dev.yaml`
- `docker/docker-compose.yaml`

启动命令：

```bash
uvicorn app:app --host 0.0.0.0 --port 8002
```

作用：

- 在 Kubernetes/provisioner sandbox 模式下创建、查询、删除 sandbox Pod。
- 默认不是所有部署都会启用。
- `make docker-start` 会根据 `config.yaml` 的 sandbox 配置判断是否启动 provisioner。

内部访问：

```text
http://provisioner:8002
```

健康检查：

```bash
docker exec -it deer-flow-provisioner sh -lc 'curl http://localhost:8002/health'
```

nginx 中也有 provisioner 代理：

```text
/api/sandboxes -> provisioner:8002
```

## `8080`: AIO Sandbox 内部端口

来源：

- `backend/packages/harness/deerflow/config/sandbox_config.py`
- `backend/packages/harness/deerflow/community/aio_sandbox/aio_sandbox_provider.py`
- `docker/provisioner/app.py`

作用：

- AIO sandbox 容器内部默认服务端口。
- 本地 Docker sandbox 模式会把宿主机某个端口映射到容器 `8080`。
- provisioner/K8s 模式下，Kubernetes Service 的 `targetPort` 也是 `8080`。

配置示例：

```yaml
sandbox:
  port: 8080
```

注意：

- `8080` 是 sandbox 容器内部端口。
- 真正从 backend 访问时，可能是宿主机映射端口或 K8s NodePort。

## `30000-32767`: Kubernetes NodePort 范围

来源：

- `docker/provisioner/README.md`
- `docker/provisioner/app.py`

作用：

- provisioner 模式下，每个 sandbox Pod 会创建一个 NodePort Service。
- K8s 默认 NodePort 范围通常是 `30000-32767`。
- provisioner 返回：

```text
http://host.docker.internal:{NodePort}
```

然后 gateway 通过这个 URL 访问 sandbox。

## `26443`: 本地 Kubernetes API 示例端口

来源：

- `docker/docker-compose-dev.yaml`
- `docker/docker-compose.yaml`
- `docker/provisioner/README.md`

配置：

```text
K8S_API_SERVER=https://host.docker.internal:26443
```

作用：

- provisioner 容器访问宿主机 Kubernetes API。
- 这是示例值，不是 DeerFlow 必然监听的端口。
- 如果你的 kubeconfig 不是这个端口，要按实际 K8s API server 改。

## `5432`: PostgreSQL 可选端口

来源：

- `config.yaml`
- `config.example.yaml`
- `backend/packages/harness/deerflow/config/database_config.py`
- `backend/packages/harness/deerflow/config/checkpointer_config.py`

配置示例：

```yaml
database:
  backend: postgres
  connection_string: postgresql://user:password@localhost:5432/deerflow
```

说明：

- 当前 Docker 默认不是 Postgres。
- 默认更偏向 SQLite，本地数据在 `.deer-flow/data`。
- 只有你切换到 Postgres 时才需要开放/连通 `5432`。

## `6379`: Redis 可选端口

来源：

- `backend/packages/harness/deerflow/config/stream_bridge_config.py`

配置示例：

```text
redis://localhost:6379/0
```

说明：

- 仅当 stream bridge 配置为 Redis 时使用。
- 默认不是必须端口。

## 外部模型服务端口

这些端口不是 DeerFlow 自己监听，而是 `config.yaml` 中模型服务的示例地址。

| 端口 | 示例服务 | 示例配置 |
| --- | --- | --- |
| `11434` | Ollama | `http://localhost:11434` 或 Docker 中 `http://host.docker.internal:11434` |
| `8000` | vLLM / OpenAI-compatible gateway | `http://localhost:8000/v1` |
| `8989` | MindIE | `http://localhost:8989/v1` |

Docker 部署时，如果模型服务跑在宿主机上，容器里不能用 `localhost` 指宿主机，应使用：

```text
http://host.docker.internal:<port>
```

例如：

```yaml
base_url: http://host.docker.internal:11434
```

## 本地非 Docker 启动端口

如果使用：

```bash
make dev
```

实际由 `scripts/serve.sh` 启动：

| 端口 | 服务 |
| --- | --- |
| `8001` | Gateway |
| `3000` | Frontend |
| `2026` | 本地 nginx 反向代理 |

本地 nginx upstream：

```text
127.0.0.1:8001 -> Gateway
127.0.0.1:3000 -> Frontend
```

统一访问：

```text
http://localhost:2026
```

## 生产 Docker 启动端口

如果使用：

```bash
make up
```

实际使用：

```text
docker/docker-compose.yaml
```

默认对外端口仍然是：

```text
2026
```

可以通过环境变量改：

```bash
PORT=8088 make up
```

对应访问：

```text
http://服务器IP:8088
```

## 防火墙建议

如果是公网服务器，建议只暴露：

```text
2026/tcp
```

并且更推荐在前面加 HTTPS 反向代理，只让公网访问：

```text
80/tcp
443/tcp
```

内部端口不要直接暴露到公网：

```text
8001/tcp
3000/tcp
8002/tcp
8080/tcp
5432/tcp
6379/tcp
```

## 当前部署排查命令

查看容器状态：

```bash
cd /app/deer-flow
export DEER_FLOW_ROOT=/app/deer-flow
docker compose -p deer-flow-dev -f docker/docker-compose-dev.yaml ps
```

测试统一入口：

```bash
curl http://127.0.0.1:2026/health
curl http://127.0.0.1:2026/api/models
```

测试 gateway 内部连通：

```bash
docker exec -it deer-flow-frontend sh -lc 'wget -S -O- http://gateway:8001/health'
```

查看真实日志：

```bash
tail -n 200 logs/gateway.log
tail -n 200 logs/frontend.log
docker compose -p deer-flow-dev -f docker/docker-compose-dev.yaml logs nginx
```

