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

**后端不读 `.env` 文件**：`apps/api` 没有内置 dotenv 加载器，只读真实环境变量。本地要这样注入 —— `SESSION_SECRET=xxx npm run dev:api`、先 `export`、或用平台的 secret 注入。从 `.env.example` 复制一份改名成 `.env` 是**不会生效**的（这是最容易白排 20 分钟的一条）。

会话相关的三个都已接入：`SESSION_SECRET`（留空 = 每次启动随机临时密钥，重启后所有人都要重新登录；填固定值 ≥32 字符后重启仍承认旧 Cookie）、`SESSION_TTL_SECONDS`（60—2592000，默认 2592000）、`COOKIE_SECURE`（可独立于 `NODE_ENV` 打开；production 强制为真且要求密钥必填）。

**不要往这些文件里写真实密钥**，它们只是占位模板（`.gitignore` 已忽略 `.env*`，只放行 `*.example`）。

## 登录

预置合成账号 + 固定验证码 `888888`：

- `U01`…`U05` 普通测试食客；`U06` 已注销（验证登录被拒）
- `E01` 编辑（实吃背书）、`M01` 审核员、`A01` 管理员（`/admin`）

固定验证码与测试种子在 `NODE_ENV=production` 下会被引擎直接拒绝启动 —— 这是刻意的护栏，不要绕过。

## 重置数据

| 模式 | 数据在哪 | 怎么清 |
| --- | --- | --- |
| 静态演示 | `localStorage['qianwei.state']`、`localStorage['qianwei.session']`、投稿草稿 `localStorage['qianwei.draft.<用户|anon>']` | 浏览器控制台 `localStorage.removeItem('qianwei.state')` 后刷新；要看得干净就连草稿一起 `localStorage.clear()` |
| 后端演示 | `SQLITE_PATH`（默认 `apps/api/data/demo.sqlite`） | `npm run seed:test` 重置为基线，或直接删文件后重启（会自动跑迁移并重新装载种子） |

`npm run seed:test` 会先 `DELETE FROM documents`，只在非 production 下可用。

**要跑会写数据的验证（契约自检、注销/发布演练、浏览器实测）时把后端指到独立库**，这样不会覆盖默认演示库里别的任务留下的状态，也不需要跑完再 `seed:test` 回基线：

```bash
# Windows 风格绝对路径：workspace 脚本的 cwd 是 apps/api，相对路径会落进 apps/api/work/
SQLITE_PATH="C:/…/56aa730c/work/verify-$(date +%m%d).sqlite" npm run dev
```

空库会自己跑迁移并由合成种子初始化，日志里能看到"由合成测试种子初始化并落库"。要确认默认库没被写过：它的逐 `kind` 计数应等于种子基线（`collection=28 media=117 meta=1 publication=1 report=2 restaurant=24 user=9 visit=71`）。

## 改了什么要跑什么

```bash
npm run typecheck                          # 三个 workspace 的 tsc --noEmit
npm test -w @qianwei/contracts             # vitest：领域引擎（本轮 61 项）
npm test -w @qianwei/web                   # vitest：地图纯函数（本轮 14 项）
npm test -w @qianwei/api                   # node:test：HTTP 合同与交接项（本轮 25 项，另有临时库的重启续跑用例）
npm run build                              # apps/web/dist（含 tsc，构建即类型检查）
npx tsx scripts/http-contract-check.mts    # 用真实前端 Http 客户端打真实后端，逐接口对账（本轮 29 项）
```

计数只是本轮快照，别当期望值抄：以你真的跑出来的输出为准。

`scripts/http-contract-check.mts` 是前后端联动的回归防线：它 import 前端 `Http` 客户端，带 Cookie Jar（内存 `Map`，不落盘）打 **`127.0.0.1:8787` 上已经在监听的后端**（跑之前先按上一节把后端起在独立库上），29 项断言覆盖地图聚合、快照复用、详情与"我的反馈"身份回填、图片鉴权可见性、搜索别名、会话、投稿幂等、清单增删改、发布申请→审核批准→分享快照→撤回失效、举报队列与我的举报、审计日志。它会写库，改了 `packages/contracts/src/store.ts` 或 `apps/api/src/http/handlers.ts` 都应该跑它。

`apps/api` 的路由有 OpenAPI 覆盖测试：新增路由必须同时在 `src/http/openapi.ts` 登记，否则 `"openapi.json 覆盖全部路由"` 会失败。

## 常见故障

- 启动即退出码 1 且只打印一行原因：`readConfig`/`boot` 的失败路径故意不回显环境变量值和堆栈，按文案里的变量名排查。
- `未找到数据库迁移目录 database/migrations`：从仓库根跑脚本，或显式设置迁移路径；cwd 不对时定位会失败。
- `NODE_ENV=production 下禁止装载合成测试种子`：见上一节，demo 只能用 development/test。
- SQLite 文件打不开：目录不存在或只读；`openDatabase` 会尝试建目录，容器里要确保 `SQLITE_PATH` 所在目录对运行用户可写（WAL 需要同目录写权限）。
- 端口占用：`PORT` / `VITE_API_PROXY` 改一处不改另一处会让代理 502。
- 页面顶部出现"网络不可用，显示的是上次加载的数据"，而网络面板里请求长这样：`file:///D:/program/Git/api/v1/me`。不是后端坏了，是 Git Bash 把 `VITE_API_BASE=/api` 当成 POSIX 路径转换了 —— 用 `MSYS_NO_PATHCONV=1 VITE_API_BASE=/api npm run dev` 重启。
- 电脑休眠或重启后，后台的 `npm run dev` 已经没了，但浏览器标签页还停在上一屏：这时候 `localStorage` 的读写照样"通过"，看着像服务端还在。判据是先 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/v1/health/ready` 拿到 200（走前端代理也可以 `http://localhost:5173/api/v1/health/ready`），再信这轮实测。
