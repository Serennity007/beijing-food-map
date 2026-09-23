# 交接文档（给接手的 AI / 工程师）

项目：京城黔味地图（北京贵州菜与西南美食地图）—— **可运行的演示版**，网页端优先。
规格来源：《北京美食地图｜完整 AI 开发执行说明书 V2.0》+《AI 执行包》。
本文件回答三个问题：现在到底算什么状态、规则写在哪、改东西要连带改什么。

## 0. 5 分钟上手

```bash
npm install            # npm workspaces，锁文件 package-lock.json（没有 pnpm，见 decisions D01）
npm run dev            # 前端 :5173 + 演示后端 127.0.0.1:8787，日志打在终端（要落盘自己重定向，`*.log` 已 gitignore）
npm run typecheck      # 3 个 workspace
npm test               # 注意：contracts/web 是 vitest，api 是 node:test，输出格式不同
npm run build          # 产物 apps/web/dist
```

需要 **Node ≥ 22.5**（后端用内置 `node:sqlite`），本机与 CI/镜像固定 **Node 24**。

只想看前端：`npm run dev:web`，不开后端 —— 浏览器内跑同一份领域引擎，数据在 `localStorage`。

## 1. 状态口径（不许混淆这三层）

| 层 | 现在的事实 |
| --- | --- |
| implemented | 领域引擎 + 11 个页面 + 演示后端 + OpenAPI + Pages workflow 全部写完 |
| verified | typecheck 全绿；测试 **89 项 0 失败**（contracts 57 / api 18 / web 14）；HTTP 契约自检 **28 项**；`npm run build` 成功；**桌面视口浏览器实测**三条闭环走通（静态模式与 `/api` 后端模式各一遍） |
| release_ready | **否**。合成数据不是真实核验数据；地图 Key / 短信 / 云账号需要你提供或授权；签名会话、真实对象存储、审核侧举报队列未做 |

细节账目在 [status.md](./status.md)（含"浏览器实测看到的"逐条证据）与 [blockers.md](./blockers.md)。**外部依赖类阻塞项接手的 AI 无法自行完成**，别去猜凭据、别自己部署、别给真人发消息。

## 2. 规则只有一份实现：`packages/contracts`

`Store`（`src/store.ts`，1885 行）是唯一规则实现处，`StaticClient` 和 `apps/api` 都调它。
**任何业务判断都不允许在页面里重算一遍**，那是这个仓库最容易退化出 bug 的方式。

```
packages/contracts/src/
  enums.ts     所有枚举 + 中文标签（枚举要直接展示给用户，措辞跟语义放一起）
  dto.ts       对外数据结构（页面/接口读到的形状）
  rules.ts     180 天窗口、社区计票、资格谓词等纯函数
  geo.ts       网格聚合分档 cellDegForZoom、GCJ-02 ↔ WGS84
  store.ts     Store：读接口收 sessionId，写接口收 sessionId + expected_version
  seed.ts      24 门店 / 9 账号 / 69 条反馈，全是合成，is_test_data=true
  photos.ts    内联合成 SVG data URI（代替对象存储）
apps/web/src/data/
  api.tsx      ApiClient 接口 + Provider（VITE_API_BASE 决定用哪个实现）
  client.ts    StaticClient：浏览器内 Store + localStorage
  http.ts      Http：真实 fetch + HttpOnly Cookie
apps/api/src/
  app.ts       node:http 外壳、优雅退出、Cookie 解析
  http/handlers.ts   路由表（method + path + summary 即 OpenAPI 来源）
  http/openapi.ts    OpenAPI 3.0 文档（有测试强制它覆盖全部路由）
  http/query.ts body.ts   入参校验：类型/整数/枚举/长度，非法直接 400
  http/security.ts   Origin / Sec-Fetch-Site 跨站写拦截 + 登录限流
  db/repository.ts   整库当 JSON 文档存取（dumpState/loadState），不是真实表结构
```

网页路由：`/map`、`/restaurants/:id`、`/submit`、`/me`、`/me/collections`、`/me/collections/:id`、`/s/:token`、`/login`、`/admin`、`/privacy`、`/terms`、`*` → 404（`apps/web/src/app/App.tsx:61-74`）。
API 路由（全部在 `/api/v1` 下）：`/health/live` `/health/ready` `/today` `/map/items` `/restaurants` `/restaurants/search` `/restaurants/:id` `/media/:id` `/uploads/test-photo` `/auth/login` `/auth/logout` `/me` `/me/submissions` `/me/reports` `/submissions` `/restaurants/:id/my-feedback` `POST|DELETE /restaurants/:id/collection-item` `/collections` `/collections/:id` `/collections/:id/items/:restaurantId` `/collections/:id/publication-requests` `/collections/:id/unpublish` `/shared-collections/:token` `/reports` `/admin/queue` `/admin/audit-log` `/admin/moderation/:target/actions` `/admin/restaurants/:id/status` `/admin/restaurants/:id/merge` `/admin/editorial-endorsements/verify|revoke`。

`localStorage` 键：`qianwei.state`（引擎快照）、`qianwei.session`、`qianwei.mapviewport`、`qianwei.mapfilters`、`qianwei.mapengine`、`qianwei.draft.<userId|anon>`、`qianwei.fallback`（Pages 深链接回退，见 `public/404.html`）。

## 3. 不许回退的业务不变量

1. 资格谓词：资料可公开 AND 地点 `VERIFIED` AND 营业 `OPEN|UNKNOWN` AND 风险 `CLEAR` AND（社区 `QUALIFIED` OR 编辑 `ACTIVE`）；不满足时详情接口要列出**具体不符合项**。
2. 社区计票 `R ≥ 3 且 4R ≥ 3T`，窗口是 **Asia/Shanghai 含两端的 180 个自然日**；读时重算过期。收藏、点赞、编辑背书都不入票。
3. 利益披露非"无关联"→ 公开披露但**不计入独立票**。
4. 新版本 `PENDING` 期间，已批准的旧版本继续公开且继续计票；撤回立即退出公开与计票，**历史版本永不复活**；低 revision 不能覆盖已批准的 revision。
5. 分享快照不可变；撤销后旧 token 永久失效；`publication_generation` 递增作废此前所有待审发布申请。
6. 作者不能审核自己的内容或发布申请，**即使他同时是管理员**。
7. 私密内容（未过审图片、未发布清单、他人私有数据）的可见性判定在服务端/引擎（`canViewMedia`），前端隐藏入口不是安全边界；无权与不存在统一 404 同一文案。
8. 坐标全程 GCJ-02，**只在 MapLibre 渲染边界转 WGS84**。高德原样使用。
9. 列表上限 200；地图快照 `queryKey` 过期回 409 `QUERY_EXPIRED`；写操作乐观锁 `expected_version`。
10. 测试种子与固定验证码 `888888` 在 `NODE_ENV=production` 下被引擎直接拒绝装载。

## 4. 改东西的连带清单（最容易漏的部分）

| 你要改的 | 必须同时改 |
| --- | --- |
| 一个枚举值 | `enums.ts` 的中文标签 → `dto.ts` 字段类型 → `openapi.ts` schema → 用到的页面文案 → `store.test.ts` |
| 一个 DTO 字段 | `dto.ts` → `openapi.ts`（`nullable` 要写清，见 `submitted_at` 的处理）→ `http.ts` 与 `client.ts` 两个实现 → 页面 |
| **新增/改一条 API 路由** | `handlers.ts` 路由表 → `openapi.ts` 条目（**"openapi 覆盖全部路由"测试会红**）→ `http.ts` 方法 → `StaticClient` 同名方法 → 页面 → `scripts/http-contract-check.mts` 断言 |
| 校验规则 | `query.ts`/`body.ts`（服务端）与引擎内校验**两处都要**，否则静态模式与后端模式行为不同 |
| 种子数据 | `seed.ts` → 基线计数（`collection=28 media=117 meta=1 publication=1 report=2 restaurant=24 user=9 visit=71`）→ 依赖这些 ID 的测试与 `status.md` 的 verified 表 |
| 地图渲染 | 两个适配器都要过（`maplibre-adapter.ts` / `amap-adapter.ts`），共用 `MapAdapter` 接口（`features/map/types.ts`），纯函数测试在 `map.test.ts` |
| 迁移 | `database/migrations/*.sql`（启动时幂等应用），同时改 `repository.ts` 的文档结构 |

`Store` 的只读接口入参**一律是 sessionId**，内部只经 `userIdOfSession()` 换算一次。曾有 bug 是 `detail()` 把 sessionId 当 userId 用，`my_current_feedback` 恒为 null，两种模式都不报错（decisions D10）；契约自检现在盯着这条。

## 5. 已经踩过的坑（别重新发明）

**Windows / Node 24**
- `spawn('npm.cmd')` 报 EINVAL → `scripts/dev.mjs` 改为调用 npm 自带的 `npm-cli.js`。
- Git Bash 把以 `/` 开头的环境变量值当 POSIX 路径转换：`VITE_BASE=/repo/` 会变成 `/program/Git/repo/` → 前缀 `MSYS_NO_PATHCONV=1`（Linux runner 无此问题，本地预演不能替代 CI）。
- PowerShell 内联脚本里 `$_` 会被 MSYS 吞掉；要导数据用 `ConvertTo-Csv`。
- `server.close()` 会被代理的 keep-alive 空闲连接按住整个 `keepAliveTimeout`，`tsx watch` 重启期间新进程撞 `EADDRINUSE` 后永久退出 → `app.ts` 里加了 `closeIdleConnections()`。

**本轮浏览器实测抓出来的 6 个缺陷**（代码审阅没看出来，提交 `74dfdc4`）
- 相机 zoom 是连续值，服务端 `integer` 校验直接 400 → `useMapData.ts` 用 `Math.floor(viewport.zoom)`。
- `fitBounds` 首帧不生效 → `MapView.tsx` 用 `viewportRef` + `fitSignal`，读最新 inset 而不是挂载时闭包。
- 审核台"提交时间"拿当前时刻冒充 → `MediaRec.created_at`（三处构造点）+ DTO `string | null` + 页面显示"时间未知"。**未知就显示不知道，不许造数据。**
- 改已有反馈不回填表单，实吃日期被顶成今天（假记录风险）→ `SubmitPage.tsx` 回填 effect；前提是"空白草稿不算有草稿"，否则一进页面落的空草稿会挡掉回填。
- 静态模式刷新即掉登录 → `StaticClient.login/logout` 漏了 `persist()`。
- 枚举原样输出 `社区：QUALIFIED` → 中文标签进 `enums.ts`。

**仓库完整性**：`.gitignore` 裸写 `data/` 连 `apps/web/src/data/` 一起吞掉，**整个数据层不在前两个提交里**，克隆下来无法构建（提交 `2ef99e6`）。推送前必查：
```bash
git ls-files --others --exclude-standard            # 期望空
git ls-files --others --ignored --exclude-standard  # 逐条确认都是产物
```

## 6. 验收门禁（改完必须全绿再说"完成"）

```bash
npm run typecheck
npm test                      # 期望 57 + 14（vitest）
npm test -w @qianwei/api      # 期望 18（node:test，输出是 ℹ tests / pass / fail）
npm run dev:api               # 另开一个终端
npx tsx scripts/http-contract-check.mts   # 期望 28 项，前端真实 Http 客户端 × 已监听后端
npm run build && npm run seed:test        # 恢复种子基线
```

浏览器实测的操作路径与预期文案见 [status.md](./status.md) 的"浏览器实测看到的"；本地环境细节见 [runbooks/local-dev.md](./runbooks/local-dev.md)。
契约自检的 Cookie Jar 是脚本内的内存 `Map`，不落盘；如果你手动用 `curl -c` 试过登录接口，把生成的 jar/凭据文件删掉再提交。

## 7. 待办（按"能不能自主做"分）

**接手的 AI 可以直接做**
1. 审核侧举报队列接口：`Store.reportQueue(sessionId)` 用 `requireRole(['moderator','admin'])` 把关、最新在前、上限 200、条目带门店与被举报反馈摘要；再加路由 + OpenAPI 条目 + 两个客户端实现 + 管理台面板（设计已定，见 blockers C9）。目前举报只有举报人自己看得到。
2. 签名会话（`SESSION_SECRET` + 有效期，Cookie 强制 `Secure`）与把 `Secure` 从"只在 production"改成可独立开启。
3. 注销的异步清除任务：`deleteAccount()` 现在只做同步处置，`deletion_job_id` 是回执，没有后台任务真的删除/匿名化，账号行停在 `deleting`。
4. 窄屏与真机：内嵌浏览器只有一个固定桌面视口，响应式断点、抽屉遮挡、地图 inset、移动端手势**都没跑过**。Pages 有地址后用手机打开一次即可结掉 blockers 第 10 项。
5. Docker 镜像构建验证（本机无 Docker，`Dockerfile` 从未构建）。

**必须先拿到人类授权/凭据，不要自行推进**
- 推送到 GitHub：目标仓库已确认 `Serennity007/beijing-food-map`（public），本机 `gh` 当前**未登录**。用户指令原文是"你先登录，我再推 Serennity007"。登录完成后建仓、推 `main`、确认 Pages source = GitHub Actions、回报线上地址。注意本机 git 提交身份是 `Pasteliangzhengtao <cse.ztliang22@gzu.edu.cn>`，public 仓库里会公开可见，改不改由用户决定（**不要擅自改 git config**）。
- 后端托管（Render/Fly/Railway）、`VITE_AMAP_KEY` + 安全密钥、短信服务、云账号、任何付费开通、任何对真人发送消息。
- 真实门店数据：需要经人工核验的门店库。**虚构门店/探店/票数/截图是硬约束禁止项。**

## 8. 给接手 AI 的沟通约定

- 汇报分三档：**implemented / verified / release_ready**，只写你真的跑过命令或真的看过页面的部分。
- 不写"看起来对了"当证据；测试断言、命令退出码、浏览器里看到的文案才算 verified。
- 不把 Mock 演示说成 production-ready；不做范围漂移（说明书没要求的社交、支付、算法排序一律不做）。
- 凭据一律不进仓库、issue、文档、截图；`.env.example` 只放占位符。
- 法务/隐私文案跟着实现走：做不到的事不要承诺（decisions D11 已经为此改过一版）。
- 破坏性动作先问：部署、`git push --force`、删分支、`rm -rf`、迁移线上库。本地提交和文件编辑可以直接做。

## 9. 文档索引

- [README.md](../README.md) 快速开始、两种运行模式、值得手动验证的规则
- [status.md](./status.md) implemented / verified / not verified / release_ready 分账
- [blockers.md](./blockers.md) A 需要你提供 / B 上线前必须补 / C 刻意留的缺口
- [decisions.md](./decisions.md) D01–D13 与原始说明书不同的选择及原因
- [runbooks/local-dev.md](./runbooks/local-dev.md) · [deploy-pages.md](./runbooks/deploy-pages.md) · [deploy-api.md](./deploy-api.md)
