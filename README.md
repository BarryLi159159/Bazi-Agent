# Bazi 项目总览（当前进度）

本仓库是一个本地可运行的八字 Agent 工作区，目标是做一个「可追溯、可扩展、可迭代训练」的命理产品。

当前采用的核心组合：
- `bazi-agent-backend`：会话、消息、记忆、排盘接口、模型调用
- `bazi-agent-frontend`：输入页 + 结果页 + 历史记录 + 可视化
- `bazi-mcp-dev`：主排盘数据源
- `bazi-master`：补充数据源（仅在需要时补齐）
- `lifeline-k--main` / `lifekline-main`：UI 和产品结构参考

---

## 1. 当前已经完成

### 后端（已落地）
- `bazi-mcp` 作为主数据源。
- 仅当大运缺 `十二运` 时，补调 `bazi-master`，并回填 `十二运/纳音`。
- 支持会话历史接口：
  - `GET /api/sessions?userExternalId=...&limit=...`
  - 返回 `last_message_preview`（避免前端渲染超长全文）。
- 用户数据持久化：
  - 用户、会话、消息、记忆已打通。
  - `bazi_json.chart_rich` 作为结构化命盘主载体（`schema = chart_rich_v1`）。

### 前端（已落地）
- 三步主流程已简化为：输入 -> 结果（确认页已移除）。
- 支持中英切换（UI 文案双语）。
- 输入页新增并打通：
  - 出生时刻（必填）
  - 出生地点（必填）
  - 当前年龄
  - 当前年份
  - 命盘校验信息（多条记录）：
    - 年份
    - 事件类型
    - 大概好坏
    - 影响程度
- 命盘结果页模块化展示（四柱/五行/大运/神煞/刑冲合会等）。

### 时间处理（已修正）
- 前端提交出生时间时固定按 `+08:00`（北京时间）发送，避免浏览器本地时区导致的小时偏移。

---

## 2. 当前 API / 数据契约

### 主要接口
- `POST /api/chat`
- `GET /api/users/:externalId`
- `GET /api/sessions?userExternalId=...`
- `GET /api/sessions/:sessionId/messages`

### 结构化命盘
- 后端会在 `bazi_json` 内写入 `chart_rich`：
  - `schema: chart_rich_v1`
  - `basic / pillars / fiveElements / fortune / gods / relations / raw`

---

## 3. 本地运行

## 前置
- Node.js 18+
- PostgreSQL 16（本机）

## 启动后端
```bash
cd /Users/li/Desktop/Projects/Bazi/bazi-agent-backend
npm install
npm run migrate
npm run dev
```
默认地址：`http://localhost:8787`

## 启动前端
```bash
cd /Users/li/Desktop/Projects/Bazi/bazi-agent-frontend
npm install
npm run dev
```
默认地址：`http://localhost:5173`（若占用会自动切到 5174/5175）

## 健康检查
```bash
curl http://127.0.0.1:8787/health
```

## 一键清端口（可选）
```bash
lsof -tiTCP:8787,5173,5174,5175 -sTCP:LISTEN | xargs kill -9
```

---

## 4. 与参考 repo 的关系（当前策略）

- 参考其 UI/交互结构（页面层级、信息密度、模块划分）。
- 不直接照搬其“人生 K 线评分逻辑”。
  - `lifeline-k--main`、`lifekline-main` 的 K 线核心多为 LLM 按提示词生成，不是稳定可复现公式。
- 本项目优先走结构化排盘 + 自有规则/策略，保证可控和可追溯。

---

## 5. 下一步建议（按优先级）

1. 设计“可复现”的运势评分引擎  
   - 以 `chart_rich` 字段做明确打分规则（而非纯 LLM 生成曲线）。
2. 增加命盘校验数据闭环  
   - 用用户填写的历史事件做规则权重校准。
3. 结果页继续精修  
   - 信息层级、图表可读性、移动端细节。
4. 训练路线准备  
   - 按会话 + 结构化盘 + 反馈形成后续微调/评估数据集。

---

## 6. 目录说明

- `/Users/li/Desktop/Projects/Bazi/bazi-agent-backend`：主后端（建议主开发）
- `/Users/li/Desktop/Projects/Bazi/bazi-agent-frontend`：主前端（建议主开发）
- `/Users/li/Desktop/Projects/Bazi/bazi-master`：本地 Python 排盘能力
- `/Users/li/Desktop/Projects/Bazi/bazi-mcp-dev`：MCP 排盘能力（当前主源）
- `/Users/li/Desktop/Projects/Bazi/lifeline-k--main`：参考实现（K线+多语言）
- `/Users/li/Desktop/Projects/Bazi/lifekline-main`：参考实现（手动四柱输入流）

