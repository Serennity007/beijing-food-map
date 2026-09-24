# Runbook：部署演示后端 API

> **状态：已准备好制品，未部署。**
> 注册/登录第三方平台、创建服务、绑定域名、产生费用都是操作你的账号，需要先拿到明确授权。
> 本仓库里的 `Dockerfile` 与 `render.yaml` 是为授权后直接可用而写的，字段以平台控制台当前版本为准。
> 另外：这台机器上没有 Docker（`docker: command not found`），镜像**没有本地构建验证过**，第一次 `docker build` 请当作待验证项。

Pages 上的演示不依赖本服务：静态模式在浏览器里跑同一套领域引擎。后端只用于验证真实 HTTP 链路（会话 Cookie、幂等键、乐观锁版本、服务端聚合、图片鉴权直出）。

## 运行形态

单进程 `node:http` + 内置 `node:sqlite`，用 `tsx` 直跑 TS 源码，无构建步骤、无原生编译依赖、无外部数据库服务。

启动顺序（`apps/api/src/index.ts`）：`readConfig()` → `boot(cfg)`（打开 SQLite → 应用 `database/migrations/*.sql` → 建 Store → 有持久化状态就 `loadState` 读回，否则装载合成种子并落库）→ `listen()`。失败时只打印一行固定原因文案，不回显环境变量值，也不打印堆栈，退出码 1。`SIGINT`/`SIGTERM` 会先关监听再关数据库。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | 监听端口；平台注入的端口必须透传 |
| `HOST` | `127.0.0.1` | 容器里填 `0.0.0.0` |
| `NODE_ENV` | `development` | **不能填 `production`**：Store 会拒绝装载合成测试种子并直接失败退出，这是护栏不是 bug |
| `SQLITE_PATH` | `./data/demo.sqlite` | 目录不存在会自动创建；运行用户必须可写（WAL 需要同目录写权限） |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 逗号分隔、只到 `scheme://host`、**不允许 `*`**（会话是 Cookie，跨站写必须显式放行） |
| `LOGIN_RATE_LIMIT_PER_MIN` | `10` | 按 `IP + 账号` 的进程内滑动窗口 |
| `SESSION_SECRET` | 空 | 会话 Cookie 的 HMAC 密钥。**留空 = 每次启动随机临时密钥，重启后所有旧 Cookie 失效、所有人重新登录**；填固定值须 ≥32 字符（`NODE_ENV=production` 下必填）。轮换密钥等同于踢掉全部在线会话 |
| `SESSION_TTL_SECONDS` | `2592000` | 会话有效期，合法区间 60—2592000；签进 Cookie 载荷里，服务端按签名判定过期 |
| `COOKIE_SECURE` | 空 | `true`/`false`，**可以独立于 `NODE_ENV` 打开**。demo 必须以 development 跑（种子护栏），所以在 https 域名上部署时要显式设成 `true`，否则 Cookie 不带 `Secure`；production 下强制为真且设 `false` 会启动失败 |

本地跑（后端**不读 `.env` 文件**，只读真实环境变量 —— 复制一份 `.env` 不会生效）：

```bash
cd apps/api                            # 相对路径按进程 cwd 解析；这里已经是 apps/api
ALLOWED_ORIGINS=http://localhost:5173 npm run dev:api   # 或 npm run start:api，SQLITE_PATH 用默认的 ./data/demo.sqlite
```

Git Bash 里别用 `SQLITE_PATH="$PWD/..."`：`$PWD` 展开成 `/c/Users/...`，Node 在 Windows 上会把它当盘相对路径解析到别处（表现为"库是空的、种子每次都重载"）。要么给 `C:/...` 风格的绝对路径，要么用相对路径。

镜像（有 Docker 的环境）：

```bash
docker build -t qianwei-api:demo .
docker run --rm -p 8080:8080 -e PORT=8080 -e HOST=0.0.0.0 \
  -e ALLOWED_ORIGINS=https://<pages域名> -v qianwei-data:/data qianwei-api:demo
```

`render.yaml` 用 `runtime: docker` 指向同一个 Dockerfile，`SQLITE_PATH` 指到平台的临时目录。

## 部署后必做的接线

1. 后端公网 Origin 加进前端构建变量 `VITE_API_BASE`（只写 `scheme://host`，`api.tsx` 会归一化为 `<origin>/api/v1`），重新构建前端。
2. 前端站点 Origin（Pages 是 `https://<用户名>.github.io`，只到域名不含仓库路径）加进 `ALLOWED_ORIGINS`，否则浏览器会拦掉带凭据的跨域写。
3. 会话 Cookie 是 `qw_session`，值为 `session_id.过期秒.HMAC-SHA256` —— 改 Cookie 里的任何一段都会被判未登录，过期由签名里的时间戳决定（`SESSION_TTL_SECONDS`），`Max-Age` 与它同步。属性是 `HttpOnly; SameSite=Lax; Path=/`，`Secure` 由 `COOKIE_SECURE=true` 或 `NODE_ENV=production` 决定：**demo 以 development 跑，挂 https 时记得显式开 `COOKIE_SECURE`**。密钥留空时重启即全员掉登录，要保住登录态就注入固定 `SESSION_SECRET`（进平台的 secret 管理，不要写进 `render.yaml`）。
4. 重新部署不需要为注销做善后：`status='deleting'` 的账号行本身就是待办任务，新进程启动时会先排空一轮（之后每秒一轮），没清完的继续清。反过来说，**别在注销还没跑完时直接删持久卷** —— 那等于把清除任务连同数据一起丢掉，虽然演示数据本来就没有保留价值。

## 持久化的现实约束

- SQLite 是**单文件、单进程**方案：多实例部署会让各副本各持一份状态并互相覆盖，演示层不能水平扩容。
- 登录限流是**进程内**的，多实例下等于把限额乘以实例数。
- 免费托管层通常是临时文件系统：重新部署或实例重启后 `SQLITE_PATH` 会回到初始状态（迁移重跑、种子重载）。要保留投稿/清单数据必须换持久盘或 Postgres。
- 数据迁移是幂等的：`schema_migrations` 记录已应用版本，新镜像启动只会应用未跑过的文件。

## 验证清单（部署完成后逐条打）

```bash
curl -s https://<后端>/                      # 根信息：base_path / openapi / health / data_notice
curl -s https://<后端>/health/live           # {"status":"ok",...}
curl -s https://<后端>/health/ready          # 真往 write_probe 写一行再删；503 = 存储不可写
curl -s https://<后端>/openapi.json | head -c 200
curl -s "https://<后端>/api/v1/map/items?west=115.42&south=39.44&east=117.52&north=41.06&zoom=11&view=southwest&include_unknown=0&layer=qualified"
```

`/health/live`、`/health/ready`、`/openapi.json` 同时接受根路径和 `/api/v1` 前缀两种写法（部署探针用）。浏览器侧再确认：登录拿得到 `Set-Cookie`、`/admin` 队列非空、连续 11 次错误登录返回 429。

回归对账（先把本地后端起在 `127.0.0.1:8787`，脚本打的是已在监听的实例；建议按 [local-dev.md](./local-dev.md) 把库指到独立文件）：

```bash
npx tsx scripts/http-contract-check.mts   # 本轮 57 项断言，覆盖到建店与地点核验、分享撤回、举报队列与审计日志
```

## 下线

删服务 + 删持久卷即可，演示数据没有保留价值。**注销前确认没有把真实凭据写进平台环境变量**；`render.yaml` 与 `.env.example` 里只允许占位值。
