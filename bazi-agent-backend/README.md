# Bazi Agent Backend (MVP)

第一阶段后端 + Agent 服务，目标是先把这几件事跑通：

- 用户与会话持久化（PostgreSQL）
- 多轮聊天消息存储
- 记忆抽取（简化规则）
- 八字计算接入（优先 `bazi-mcp-dev`，失败回退 `bazi-master`）
- 模型回复（有 OpenAI Key 用模型，无 Key 用规则兜底）

## 目录结构

```txt
bazi-agent-backend/
  migrations/001_init.sql
  src/
    agent/
    db/
    routes/
    scripts/migrate.ts
    app.ts
    server.ts
```

## 依赖关系

- 八字 MCP 源：`../bazi-mcp-dev`
- Python 八字源：`../bazi-master`

后端会按顺序尝试：

1. 读取 `../bazi-mcp-dev/dist/index.js` 的 `getBaziDetail`
2. 回退执行 `../bazi-master/bazi.py`

## 快速开始

### 1) 启动 PostgreSQL

在 `bazi-agent-backend` 目录下执行：

```bash
docker compose up -d
```

### 2) 配置环境变量

```bash
cp .env.example .env
```

至少确认以下字段：

- `DATABASE_URL`
- `BAZI_MCP_DIST_PATH`
- `BAZI_MASTER_SCRIPT_PATH`

可选：

- `OPENAI_API_KEY`（不填则启用规则兜底回复）

### 3) 安装依赖

```bash
npm install
```

### 4) 编译八字 MCP（让后端可直接调用）

```bash
npm run build:bazi-mcp
```

### 5) 初始化数据库

```bash
npm run migrate
```

### 6) 启动服务

```bash
npm run dev
```

默认地址：`http://localhost:8787`

## API

### Health

```bash
curl http://localhost:8787/health
```

### Upsert 用户

```bash
curl -X POST http://localhost:8787/api/users/upsert \
  -H 'Content-Type: application/json' \
  -d '{
    "externalId": "user_001",
    "displayName": "Li",
    "gender": 1,
    "birthSolarDatetime": "1998-07-31T14:10:00+08:00"
  }'
```

### 发起聊天（自动建会话 + 自动尝试排盘）

```bash
curl -X POST http://localhost:8787/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "userExternalId": "user_001",
    "message": "我最近想换工作，想看看今年求职方向",
    "baziInput": {
      "solarDatetime": "1998-07-31T14:10:00+08:00",
      "gender": 1,
      "eightCharProviderSect": 2
    }
  }'
```

### 查询会话消息

```bash
curl "http://localhost:8787/api/sessions/<sessionId>/messages?limit=50"
```

## 当前实现边界

- 记忆抽取是规则版，后续可替换成模型提炼。
- 八字调用优先本地 `bazi-mcp-dev` 编译产物，尚未走远程 MCP transport。
- 尚未加鉴权（下一阶段建议加 JWT + tenant 隔离）。

## 下一阶段建议

- 加认证（JWT）
- 增加用户画像摘要（模型定期压缩）
- 增加 RAG（命理语料 + 你自己的问答数据）
- 接前端聊天 UI（流式返回 + 历史会话列表）
