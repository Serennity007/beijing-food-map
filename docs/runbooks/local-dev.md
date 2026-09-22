# Runbook：本地开发

## 前置

- Node ≥ 22.5（后端用内置 `node:sqlite`）。**所有验证都在 Node 24 上跑过**，CI 与镜像也固定 Node 24；Node 22.x 的 `node:sqlite` 仍属实验特性，是否免开关未在本仓库验证。
- 无数据库服务、无 Docker 依赖即可开发：持久化用 `node:sqlite` + 仓库内 SQL 迁移。

## 起服务

```bash
npm install
npm run dev        # 前端 http://localhost:5173 + 后端 http://127.0.0.1:8787
npm run dev:web    # 只起前端（静态演示模式，数据在浏览器 localStorage）
npm run dev:api    # 只起后端
```

`scripts/dev.mjs` 给两个子进程的输出加 `[api]` / `[web]` 前缀，任一进程退出即整体退出，不留占用端口的孤儿进程。后端挂了不影响前端：静态模式在浏览器里跑同一套领域引擎。

Vite dev server 把 `/api` 代理到 `VITE_API_PROXY`（默认 `http://127.0.0.1:8787`），所以本地跑后端链路时同源即可，不需要动 CORS 白名单。

## 环境变量

复制根目录 `.env.example` 按需填写；`apps/api/.env.example` 是后端单独的变量。文件里分了三类：【已接入】是当前代码真正读取的，【上线前接入】只是预留的集成点，填了也不会生效。

**不要往这些文件里写真实密钥**，它们只是占位模板（`.gitignore` 已忽略 `.env*`，只放行 `*.example`）。

## 登录

预置合成账号 + 固定验证码 `888888`：

- `U01`…`U05` 普通测试食客；`U06` 已注销（验证登录被拒）
- `E01` 编辑（实吃背书）、`M01` 审核员、`A01` 管理员（`/admin`）

固定验证码与测试种子在 `NODE_ENV=production` 下会被引擎直接拒绝启动 —— 这是刻意的护栏，不要绕过。

## 重置数据

| 模式 | 数据在哪 | 怎么清 |
| --- | --- | --- |
| 静态演示 | `localStorage['qianwei.state']`、`localStorage['qianwei.session']` | 浏览器控制台 `localStorage.removeItem('qianwei.state')` 后刷新 |
| 后端演示 | `SQLITE_PATH`（默认 `apps/api/data/demo.sqlite`） | `npm run seed:test` 重置为基线，或直接删文件后重启（会自动跑迁移并重新装载种子） |

`npm run seed:test` 会先 `DELETE FROM documents`，只在非 production 下可用。

## 改了什么要跑什么

```bash
npm run typecheck                          # 三个 workspace 的 tsc --noEmit
npm test                                   # contracts 领域引擎 / api HTTP 合同 / web 地图纯函数
npm run build                              # apps/web/dist（含 tsc，构建即类型检查）
npx tsx scripts/http-contract-check.mts    # 用真实前端 Http 客户端打真实后端，逐接口对账
```

`scripts/http-contract-check.mts` 是前后端联动的回归防线：它 import 前端 `Http` 客户端，带 Cookie Jar 打 **`127.0.0.1:8787` 上已经在监听的后端**（跑之前先 `npm run dev:api`），28 项断言覆盖地图聚合、快照复用、详情与"我的反馈"身份回填、图片鉴权可见性、搜索别名、会话、投稿幂等、清单增删改、发布申请→审核批准→分享快照→撤回失效、举报与审计日志。它会写进演示库，跑完 `npm run seed:test` 回基线。改了 `packages/contracts/src/store.ts` 或 `apps/api/src/http/handlers.ts` 都应该跑它。

`apps/api` 的路由有 OpenAPI 覆盖测试：新增路由必须同时在 `src/http/openapi.ts` 登记，否则 `"openapi.json 覆盖全部路由"` 会失败。

## 常见故障

- 启动即退出码 1 且只打印一行原因：`readConfig`/`boot` 的失败路径故意不回显环境变量值和堆栈，按文案里的变量名排查。
- `未找到数据库迁移目录 database/migrations`：从仓库根跑脚本，或显式设置迁移路径；cwd 不对时定位会失败。
- `NODE_ENV=production 下禁止装载合成测试种子`：见上一节，demo 只能用 development/test。
- SQLite 文件打不开：目录不存在或只读；`openDatabase` 会尝试建目录，容器里要确保 `SQLITE_PATH` 所在目录对运行用户可写（WAL 需要同目录写权限）。
- 端口占用：`PORT` / `VITE_API_PROXY` 改一处不改另一处会让代理 502。
