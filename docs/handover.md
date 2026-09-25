# 交接文档（给接手的 AI / 工程师）

项目：京城黔味地图（北京贵州菜与西南美食地图）—— **可运行的演示版**，网页端优先。
规格来源：《北京美食地图｜完整 AI 开发执行说明书 V2.0》+《AI 执行包》。
本文件回答三个问题：现在到底算什么状态、规则写在哪、改东西要连带改什么。

## 0. 5 分钟上手

**只想把网页打开给人看**（不需要记命令）：双击仓库根的 `一键演示.bat`，或 `node scripts/serve-demo.mjs`。
上台前跑 `node scripts/demo-check.mjs` 看 ALL GREEN。交付视角的说明在 [../DELIVERY.md](../DELIVERY.md)，
照着讲的六幕脚本在 [演示动线.md](./演示动线.md)。下面是开发用的命令。

```bash
npm install            # npm workspaces，锁文件 package-lock.json（没有 pnpm，见 decisions D01）
npm run dev            # 前端 :5173 + 演示后端 127.0.0.1:8787，日志打在终端（要落盘自己重定向，`*.log` 已 gitignore）
npm run typecheck
npm test               # 注意：contracts/web 是 vitest，api 是 node:test，输出格式不同
npm run build          # apps/web/dist
```

需要 **Node ≥ 22.5**（后端用内置 `node:sqlite`），本机与 CI/镜像固定 **Node 24**。

只想看前端：`npm run dev:web`，不开后端 —— 浏览器内跑同一份领域引擎，数据在 `localStorage`。

## 1. 状态口径（不许混淆这三层）

| 层 | 现在的事实 |
| --- | --- |
| implemented | 领域引擎（含**新门店候选与地点核验**）+ 11 个页面 + 演示后端 44 条接口操作（含签名会话、注销清除任务、**举报队列与处置**、**5 条候选接口**）+ OpenAPI + Pages workflow 全部写完 |
| verified | typecheck 全绿；测试 **135 项 0 失败**（contracts 92 / api 29 / web 14）；HTTP 契约自检 **61 项**；`npm run build` 成功；**内嵌浏览器实测（视口 531×568，命中 `max-width:719px` 窄屏断点，不是桌面宽度）**在两种模式下各走一遍（地图 / 投稿审核 / 清单发布分享撤销 / **纠错与举报处置闭环** / **建店申请与地点核验** / 注销处置）；后端模式的写操作这次是**经 `serve-demo.mjs --api` 自带的代理**跑的（上一轮走的是 vite 代理，那条 403 缺陷只在今天这条路暴露）；写路径全部跑在独立 SQLite 文件上，默认演示库本机未生成 |
| release_ready | **否**。合成数据不是真实核验数据；签名会话与注销清除、建店与地点核验、举报工单处置闭环都已闭合，但真实对象存储与可水平扩展的持久化没有；地图选点与真实 POI 数据源依赖凭据；窄屏与真机没验；后端没部署；仓库没推送到 GitHub |

细节账目在 [status.md](./status.md)（含"浏览器实测看到的"逐条证据）与 [blockers.md](./blockers.md)。**外部依赖类阻塞项接手的 AI 无法自行完成**，别去猜凭据、别自己部署、别给真人发消息。

## 2. 规则只有一份实现：`packages/contracts`

`Store`（`src/store.ts`，1934 行）是唯一规则实现处，`StaticClient` 和 `apps/api` 都调它。
**任何业务判断都不允许在页面里重算一遍**，那是这个仓库最容易退化出 bug 的方式。

```
packages/contracts/src/
  enums.ts     所有枚举 + 中文标签（枚举要直接展示给用户，措辞跟语义放一起）
  dto.ts       对外数据结构（页面/接口读到的形状）
  rules.ts     180 天窗口、社区计票、资格谓词、名称规范化与重复候选匹配、举报工单状态机、上海时区日历日展示等纯函数
  geo.ts       网格聚合分档 cellDegForZoom、GCJ-02 ↔ WGS84、近似直线距离
  store.ts     Store：读接口收 sessionId，写接口收 sessionId + expected_version
  seed.ts      49 门店 / 9 账号 / 128 条实吃记录，全是合成，is_test_data=true
  photos.ts    内联合成 SVG data URI（代替对象存储）
packages/contracts/test/
  store.test.ts       领域与谓词（63）
  candidates.test.ts  建店候选与地点核验（21）
  reports.test.ts     举报工单的生成/去重/状态机/角色与版本锁（7）
apps/web/src/data/
  api.tsx      ApiClient 接口 + Provider（VITE_API_BASE 决定用哪个实现）
  client.ts    StaticClient：浏览器内 Store + localStorage
  http.ts      Http：真实 fetch + HttpOnly Cookie
apps/web/src/features/candidates/
  CandidateForm.tsx  建店与补材料共用的表单（投稿页与"我的"页都用它，别再抄第二份）
apps/api/src/
  app.ts       node:http 外壳、优雅退出、Cookie 解析、注销清除任务的排空（启动一次 + 每秒一次，`hasPendingDeletions()` 先短路）
  http/handlers.ts   路由表（method + path + summary 即 OpenAPI 来源）
  http/openapi.ts    OpenAPI 3.0 文档（有测试强制它覆盖全部路由）
  http/query.ts body.ts   入参校验：类型/整数/枚举/长度，非法直接 400
  http/security.ts   Origin / Sec-Fetch-Site 跨站写拦截 + 登录限流
  http/session.ts    会话 Cookie 的 HMAC 签名与校验（密钥来自 env.ts，缺省时每次启动随机）
  db/repository.ts   整库当 JSON 文档存取（dumpState/loadState），不是真实表结构
```

网页路由：`/map`、`/restaurants/:id`、`/submit`、`/me`、`/me/collections`、`/me/collections/:id`、`/s/:token`、`/login`、`/admin`、`/privacy`、`/terms`、`*` → 404（`apps/web/src/app/App.tsx:61-74`）。
API 路由（全部在 `/api/v1` 下）：`/health/live` `/health/ready` `/today` `/map/items` `/restaurants` `/restaurants/search` `/restaurants/:id` `/media/:id` `/uploads/test-photo` `/auth/login` `/auth/logout` `/me` `/me/submissions` `/me/reports` `/submissions` `/restaurants/:id/my-feedback` `POST|DELETE /restaurants/:id/collection-item` `/collections` `/collections/:id` `/collections/:id/items/:restaurantId` `/collections/:id/publication-requests` `/collections/:id/unpublish` `/shared-collections/:token` `/reports` `/restaurant-candidates` `POST /restaurant-candidates/:id/materials` `/admin/queue` `/admin/reports` `POST /admin/reports/:id/actions` `/admin/candidates` `/admin/candidates/:id/actions` `/admin/audit-log` `/admin/moderation/:target/actions` `/admin/restaurants/:id/status` `/admin/restaurants/:id/merge` `/admin/editorial-endorsements/verify|revoke`。

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
11. **建店只给 `PENDING` 地点**：候选创建时落的门店必须靠原有谓词被默认层挡住；核验通过也**不等于**好店达标（还要社区票或编辑背书）。重复只出提示，绝不自动合并、不自动驳回。同一作者重复提交同一家店复用同一条候选。驳回必填理由、理由回传给作者、状态不可回退（`REJECTED → PENDING` 只能由作者补材料触发）。
12. **本人提交的建店申请不能本人核验**，即使同时是 moderator/admin —— `decideCandidate` 与 `patchRestaurantStatus`（候选来源门店的 `place_status` 变更）两处都把守，缺一处就有绕过路径。
13. **举报工单只是复核线索，不是结论**：同人+同店+同类型且未结案时复用同一张单（不产生第二张）；`OPEN → IN_REVIEW → RESOLVED|DISMISSED` 的终态**没有回退边**（`REPORT_TRANSITIONS` 里就没有指向 `OPEN` 的转移）；结案与驳回必须写明处理结果；处置人不能是举报人本人（403，即使他挂着 moderator/admin）；**处置工单不会改门店的营业/风险状态** —— 闭店与"需人工复核"只能在 `PATCH /admin/restaurants/:id/status` 单独确认，3 个举报不会自动判闭店（REC-07）。

## 4. 改东西的连带清单（最容易漏的部分）

| 你要改的 | 必须同时改 |
| --- | --- |
| 一个枚举值 | `enums.ts` 的中文标签 → `dto.ts` 字段类型 → `openapi.ts` schema → 用到的页面文案 → `store.test.ts` |
| 一个 DTO 字段 | `dto.ts` → `openapi.ts`（`nullable` 要写清，见 `submitted_at` 的处理）→ `http.ts` 与 `client.ts` 两个实现 → 页面 |
| **新增/改一条 API 路由** | `handlers.ts` 路由表 → `openapi.ts` 条目（**"openapi 覆盖全部路由"测试会红**）→ `http.ts` 方法 → `StaticClient` 同名方法 → 页面 → `scripts/http-contract-check.mts` 断言 |
| 校验规则 | `query.ts`/`body.ts`（服务端）与引擎内校验**两处都要**，否则静态模式与后端模式行为不同 |
| 种子数据 | `seed.ts` → 基线计数（`collection=28 media=224 meta=1 publication=1 report=2 restaurant=49 user=9 visit=128`）→ 依赖这些 ID 的测试与 `status.md` 的 verified 表 |
| 地图渲染 | 两个适配器都要过（`maplibre-adapter.ts` / `amap-adapter.ts`），共用 `MapAdapter` 接口（`features/map/types.ts`），纯函数测试在 `map.test.ts` |
| 迁移 | `database/migrations/*.sql`（启动时幂等应用），同时改 `repository.ts` 的文档结构 |
| **新增一个实体**（例：本轮的候选） | `store.ts` 的集合 + `dumpState`/`loadState` → `repository.ts` 的 `ENTITY_KINDS`/`DumpedState`/`rowsFor`/`parseDump`/`load` 分支（文档表通用形状，**不需要新迁移**）→ `dto.ts` → `openapi.ts` 的 schema → `client.ts` 接口 + `StaticClient` + `http.ts` → 页面 → 契约自检 → `status.md` 的 verified 表 |
| 候选/核验相关 | 中文标签一律取 `enums.ts`（`CANDIDATE_STATUS_LABEL` / `CANDIDATE_SOURCE_LABEL` / `DUPLICATE_REASON_LABEL` / `PLACE_STATUS_LABEL`）；表单只用 `features/candidates/CandidateForm.tsx` 那一份 |

`Store` 的只读接口入参**一律是 sessionId**，内部只经 `userIdOfSession()` 换算一次。曾有 bug 是 `detail()` 把 sessionId 当 userId 用，`my_current_feedback` 恒为 null，两种模式都不报错（decisions D10）；契约自检现在盯着这条。

## 5. 已经踩过的坑（别重新发明）

**Windows / Node 24**
- `spawn('npm.cmd')` 报 EINVAL → `scripts/dev.mjs` 改为调用 npm 自带的 `npm-cli.js`。
- Git Bash 把以 `/` 开头的环境变量值当 POSIX 路径转换：`VITE_BASE=/repo/` 会变成 `/program/Git/repo/` → 前缀 `MSYS_NO_PATHCONV=1`（Linux runner 无此问题，本地预演不能替代 CI）。同一个坑也吃 `VITE_API_BASE=/api`，而且症状更隐蔽：不报错，只是所有请求打到 `file:///D:/program/Git/api/v1/...`，页面显示"网络不可用，显示的是上次加载的数据"，看着像后端坏了。
- **会写数据的验证一律指独立库**：`SQLITE_PATH=<项目绝对路径>/work/xxx.sqlite`（`openDatabase` 会 `mkdir -p` 父目录，空库自动由合成种子初始化）。要给 **Windows 风格的绝对路径**：workspace 脚本的 cwd 是 `apps/api` 而不是仓库根，相对路径会落进 `apps/api/work/`；Git Bash 的 `$PWD` 展开成 `/c/Users/...`，Node 在 Windows 上解析出来是另一个地方，你会盯着一个空库排障。契约自检、注销演练、浏览器实测都写库；写默认演示库的话，另一个任务留下的状态就查不回来了，而且 `npm run seed:test` 会整库覆盖。默认库该长什么样见上面"种子数据"那行的基线计数。
- 后台起的 `npm run dev` 会随休眠/重启一起没了，而浏览器标签页还留着上一次的界面：这时候 localStorage 的读写照样"通过"，看着像服务端还在。判断前先 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/v1/health/ready`，拿到 200 再信实测结论。
- PowerShell 内联脚本里 `$_` 会被 MSYS 吞掉；要导数据用 `ConvertTo-Csv`。
- `server.close()` 会被代理的 keep-alive 空闲连接按住整个 `keepAliveTimeout`，`tsx watch` 重启期间新进程撞 `EADDRINUSE` 后永久退出 → `app.ts` 里加了 `closeIdleConnections()`。

**本轮浏览器实测抓出来的 6 个缺陷**（代码审阅没看出来，提交 `74dfdc4`）
- 相机 zoom 是连续值，服务端 `integer` 校验直接 400 → `useMapData.ts` 用 `Math.floor(viewport.zoom)`。
- `fitBounds` 首帧不生效 → `MapView.tsx` 用 `viewportRef` + `fitSignal`，读最新 inset 而不是挂载时闭包。
- 审核台"提交时间"拿当前时刻冒充 → `MediaRec.created_at`（三处构造点）+ DTO `string | null` + 页面显示"时间未知"。**未知就显示不知道，不许造数据。**
- 改已有反馈不回填表单，实吃日期被顶成今天（假记录风险）→ `SubmitPage.tsx` 回填 effect；前提是"空白草稿不算有草稿"，否则一进页面落的空草稿会挡掉回填。
- 静态模式刷新即掉登录 → `StaticClient.login/logout` 漏了 `persist()`。
- 枚举原样输出 `社区：QUALIFIED` → 中文标签进 `enums.ts`。

**本轮（阶段 1A）新踩到的**
- **停掉后台任务不等于停掉服务**：`TaskStop` 只杀 `npm run dev:api` 的外壳，`tsx watch` 子进程还占着 8787。症状是"新库没生效"：我起了 `SQLITE_PATH=work/browser-1a.sqlite` 的新实例，日志里写着「启动失败：端口不可用」，而浏览器实测的数据全落在上一个库。判断前先看新进程日志有没有这行，或直接 `netstat -ano | grep 8787` 比对 PID；必要时 `taskkill //PID <pid> //F`。
- **契约自检不能在同一库上跑第二遍**：`createCandidate` 走幂等缓存，第二次运行同键同内容会返回**第一次的响应快照**（`version` 还是旧值），于是后面的 `expected_version` 必然 409。这不是缺陷（幂等重放本来就该返回同一结果），但意味着每轮验证都要换一个新的 `SQLITE_PATH`。
- **`requireRestaurant()` 返回的是 Map 里的活动对象**，不是副本。测试里 `const before = s.requireRestaurant(id)` 之后改它，`before.x` 会跟着变（我就这样写出过一次假失败断言）。要比"改前/改后"必须先存标量。
- 同一个 `requireRestaurant()` 会先走 `canonical()`：门店被合并后，用旧 ID 取到的是 **target 记录**。所以断言"旧 ID 永久重定向"要读 `s.restaurants.get(id).merged_into`，而不是 `requireRestaurant(id).merged_into`。
- 枚举回潮：`/me` 的候选卡片把 `place_status` 原样打成了 `VERIFIED`。凡是新加的展示字段，先查 `enums.ts` 有没有标签，没有就补标签而不是直接输出。
- 错误提示的渲染条件别写反：建店的告警原本挂在"表单已关闭"上，结果表单开着时的 401/409/非字段错误全都看不见。

**本轮（阶段 1B）新踩到的**
- **`netstat` 显示 8787 有监听，不代表只有一个后端在答**：上一轮 `tsx watch` 的残留子进程和这一轮新起的进程可以同时挂在 8787 上，浏览器与 `curl` 会分别打到**两个不同的库**（我就是这样看到"界面里的 REP0003 后端查不到、后端里的 REP0025 界面没见过"）。动手前 `netstat -ano | grep :8787` 只应有一个 PID，且要和 `Get-CimInstance Win32_Process` 查到的启动时间对上；杀的时候用 `taskkill //PID <pid> //T //F` 连子进程一起。
- **演示与验证不要用 watch 模式**：`serve-demo.mjs` 原先用 `npm run dev -w @qianwei/api`（= `tsx watch`），演示途中改一下 `packages/contracts` 就会重启后端，新进程撞不到端口就静默留下一个"还在监听但会话已丢"的后端。已改成 `npm run start -w @qianwei/api`。
- **别用 Git Bash 的 `curl -d '中文'` 写数据**：控制台代码页会把 UTF-8 请求体压成乱码，服务端如实存下来（它收到的就是那串字节），于是你在界面上看到"处理结果：`___`"并以为是编码 bug。要么把 body 放进文件 `--data-binary @file.json`，要么直接在浏览器里输入。存心验编码链路时再看网络层，不要顺手当测试数据。

**仓库完整性**：`.gitignore` 裸写 `data/` 连 `apps/web/src/data/` 一起吞掉，**整个数据层不在前两个提交里**，克隆下来无法构建（提交 `2ef99e6`）。推送前必查：
```bash
git ls-files --others --exclude-standard            # 期望空
git ls-files --others --ignored --exclude-standard  # 逐条确认都是产物
```

## 6. 验收门禁（改完必须全绿再说"完成"）

```bash
npm run typecheck                            # 期望退出码 0，3 个 workspace
npm test -w @qianwei/contracts               # 期望 91 通过（3 个文件：store 63 + candidates 21 + reports 7，vitest）
npm test -w @qianwei/web                     # 期望 14 通过（vitest）
npm test -w @qianwei/api                     # 期望 29 pass / 0 fail（node:test，输出是 ℹ tests / pass / fail）
SQLITE_PATH="C:/绝对/路径/work/gate-1b.sqlite" npm run start:api &   # 另开终端，别写默认库；每轮换新库；用 start 不要用 dev（watch 会中途重启）
npx tsx scripts/http-contract-check.mts      # 期望 61 项，前端真实 Http 客户端 × 已监听后端
npm run build                                # 期望退出码 0
```

数字会变，别照抄：跑之前先按上面命令实测一遍，报告里写你这次真的看到的数（历史：57/18/14 = 89 与 28 项 → 阶段 0 的 61/25/14 = 100 与 29 项 → 阶段 1A 的 82/29/14 = 125 与 47 项 → 阶段 1B 的 91/29/14 = 134 与 57 项 → 1B 补上"举报可以指向具体反馈"后的 92/29/14 = 135 与 61 项）。`npm run seed:test` 只在你想把**默认**演示库恢复成种子基线时用（它整库覆盖，先确认没有别的任务在里面留状态）。

浏览器实测的操作路径与预期文案见 [status.md](./status.md) 的"浏览器实测看到的"；本地环境细节见 [runbooks/local-dev.md](./runbooks/local-dev.md)。
契约自检的 Cookie Jar 是脚本内的内存 `Map`，不落盘；如果你手动用 `curl -c` 试过登录接口，把生成的 jar/凭据文件删掉再提交。

## 7. 待办（按"能不能自主做"分）

**接手的 AI 可以直接做**（按建议优先级）
1. **阶段 2 手机端界面**：360/390/430 宽度、抽屉遮挡、地图 inset、捏合与双指手势 —— blockers C10。建店表单、后台「地点核验」与「举报复核」面板都只在 **531px** 这一个视口看过（它已命中窄屏断点，所以换行与溢出这一类已经走过一遍），真机宽度与手势没有。这一项需要你在真机上看一次，或者直接接受"531px 已验、真机未验"。
2. **两个待决问题需要人拍板**（详见 `docs/questions-for-next-review.md`）：核验状态翻转是否该递增 `location_version`（现状会清零已有社区票，已用特征测试钉住）；提交人注销后其待核验候选要不要自动退出队列。
3. **举报闭环剩下的尾巴**（1B 本轮只做了规格要求的那圈）：限频/配额没做（同一账号一天能开多少单没有上限，只有"同人同店同类同目标不重复开单"的去重）；`feedback_target` 现在由门店页每条公开反馈的"举报这条内容"填入，但**图片与清单条目还没有各自的举报入口**（引擎接受任意 `visit#vN` 形状的指针，要指向媒体得先扩校验）；举报人看不到处理过程（只有终态的处理结果），要中间态就要先定 SLA 口径。这三条都是产品决策，不是补代码就能自证的。
4. Docker 镜像构建验证（本机无 Docker，`Dockerfile` 从未构建）。

**本轮（阶段 1B）已闭合**：举报工单的写接口与状态机、去重、自报自审拦截、处理结果回写给举报人（见 §3 第 13 条与 blockers C9）。§7 上一版列出的 4 个小口子一并收掉：门店详情"核验日期"重复显示 → 改为只显示 `verification_note`；页头同时暴露"登录"与"内测登录" → 只留一个；后台打印原始 ISO 时间戳 → `rules.ts` 新增 `shanghaiDay`/`shanghaiDateTime`，7 处展示统一按上海日历日（UTC 16:00 之后不再显示成前一天）；举报卡片不显示举报人 → 保持不显示，并把"为什么不显示是谁举报"写在卡片上。

**必须先拿到人类授权/凭据，不要自行推进**
- 推送到 GitHub：目标仓库 `Serennity007/beijing-food-map`（public）。**这台机器上 `gh` 已经登录到 Serennity007**（token scopes: gist/read:org/repo），所以原机器上"你先登录我再推"的卡点已经解除 —— 但推送仍然要用户明确同意。
- ⚠️ 现在 `origin` 是一个**指向源机器本地路径的失效 remote**：`D:/桌面/qianwei-project-20260924/code/beijing-food-map`，`git ls-remote origin` 直接 fatal。推送前必须先换地址，这一步由用户确认后再做。本机 git 提交身份是 `Pasteliangzhengtao <cse.ztliang22@gzu.edu.cn>`，public 仓库里会公开可见，改不改由用户决定（**不要擅自改 git config**）。
- 后端托管（Render/Fly/Railway）、`VITE_AMAP_KEY` + 安全密钥、短信服务、云账号、任何付费开通、任何对真人发送消息。
- 真实门店数据：需要经人工核验的门店库。**虚构门店/探店/票数/截图是硬约束禁止项。** 建店流程（C11）已经通了，所以现在缺的只是数据与核验人力，不是功能。

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
- [decisions.md](./decisions.md) D01–D20 与原始说明书不同的选择及原因
- [design/restaurant-candidates.md](./design/restaurant-candidates.md) 阶段 1A 的方案与它依据的规格条款
- [questions-for-next-review.md](./questions-for-next-review.md) 本轮**没定下来**或**自评做得不够好**的问题，按优先级排，等外部意见
- [runbooks/local-dev.md](./runbooks/local-dev.md) · [deploy-pages.md](./runbooks/deploy-pages.md) · [deploy-api.md](./deploy-api.md)
