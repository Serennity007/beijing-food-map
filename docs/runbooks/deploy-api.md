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

本地跑：

```bash
cd apps/api && cp .env.example .env   # 填 SQLITE_PATH / ALLOWED_ORIGINS
npm run dev:api                        # 或 npm run start:api
```

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
3. 会话 Cookie 是 `qw_session`，`HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`；`Secure` 只在 `NODE_ENV=production` 时附加。也就是说 demo 部署（development）拿到的 Cookie 不带 `Secure` —— 挂 https 域名仍然走加密传输，但这一点在真实上线前必须连同签名会话一起改掉（见 `../blockers.md`）。

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

回归对账（先 `npm run dev:api` 把本地后端起在 `127.0.0.1:8787`，脚本打的是已在监听的实例）：

```bash
npx tsx scripts/http-contract-check.mts   # 28 项断言，覆盖到分享撤回与审计日志
```

## 下线

删服务 + 删持久卷即可，演示数据没有保留价值。**注销前确认没有把真实凭据写进平台环境变量**；`render.yaml` 与 `.env.example` 里只允许占位值。
