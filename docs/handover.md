# 交接文档（给接手的 AI / 工程师）

项目：京城黔味地图（北京贵州菜与西南美食地图）—— **可运行的演示版**，网页端优先。
规格来源：《北京美食地图｜完整 AI 开发执行说明书 V2.0》+《AI 执行包》（含 `ACCEPTANCE.md` 验收合同）。
本文件回答三个问题：现在到底算什么状态、规则写在哪、改东西要连带改什么。
**下一步做什么不在这里** —— 见 [NEXT.md](./NEXT.md)（待决问题与可优化项）与 [blockers.md](./blockers.md)（外部依赖）。

## 0. 5 分钟上手

**只想把网页打开给人看**：双击仓库根的 `一键演示.bat`，或 `node scripts/serve-demo.mjs`（加 `--api` 起后端模式）。
上台前跑 `node scripts/demo-check.mjs`（后端模式要加 `--base=http://127.0.0.1:<端口>`，没有 `--port`）看 ALL GREEN。
交付视角的说明在 [../DELIVERY.md](../DELIVERY.md)，照着讲的六幕脚本在 [演示动线.md](./演示动线.md)。开发命令：

```bash
npm install            # npm workspaces，锁文件 package-lock.json（没有 pnpm，见 D01）
npm run dev            # 前端 :5173 + 演示后端 127.0.0.1:8787
npm run typecheck
npm test               # contracts/web 是 vitest，api 是 node:test，输出格式不同
npm run build          # apps/web/dist
```

需要 **Node ≥ 22.5**（后端用内置 `node:sqlite`），本机与 CI/镜像固定 **Node 24**。
只想看前端：`npm run dev:web`，不开后端 —— 浏览器内跑同一份领域引擎，数据在 `localStorage`。

## 1. 状态口径（不许混淆这三层）

| 层 | 现在的事实 |
| --- | --- |
| implemented | 领域引擎（含新门店候选与地点核验、举报工单处置）+ 11 个页面 + 演示后端 44 条接口操作 + OpenAPI + Pages workflow |
| verified | typecheck 0；135 项测试 0 失败；契约自检 61 项；`npm run build` 成功；演示自检静态 7 / 后端 14 项 ALL GREEN；**内嵌浏览器实测（视口 531×568，命中 `max-width:719px` 窄屏断点，不是桌面宽度）**覆盖地图 / 投稿审核 / 清单发布撤销 / 举报处置 / 建店核验 / 注销 / 键盘遍历；写路径全部跑在独立 SQLite 文件上 |
| release_ready | **否**。数据全是合成的；真实对象存储与可水平扩展的持久化没有；地图 Key、真实 POI、短信、托管、推送都依赖人给凭据或授权；真机与读屏没验 |

逐条证据与"没验过什么"在 [status.md](./status.md) —— **那份才是账本**，本表只是摘要。
**外部依赖类阻塞项接手的 AI 无法自行完成**：别去猜凭据、别自己部署、别给真人发消息。

## 2. 规则只有一份实现：`packages/contracts`

`Store`（`src/store.ts`）是唯一规则实现处，`StaticClient` 与 `apps/api` 都调它。
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
  reports.test.ts     举报工单的生成/去重/状态机/角色与版本锁（8）
apps/web/src/data/
  api.tsx      ApiClient 接口 + Provider（VITE_API_BASE 决定用哪个实现）
  client.ts    StaticClient：浏览器内 Store + localStorage（草稿键前缀也从这里单一导出）
  http.ts      Http：真实 fetch + HttpOnly Cookie
apps/web/src/features/
  candidates/CandidateForm.tsx  建店与补材料共用的表单（投稿页与"我的"页都用它，别再抄第二份）
  map/         双适配器（maplibre-adapter / amap-adapter）+ types + MapView + 纯函数测试
  map-data/useMapData.ts        视野请求与快照、防抖、竞态处理
apps/api/src/
  app.ts       node:http 外壳、优雅退出、Cookie 解析、注销清除任务排空（启动一次 + 每秒一次，hasPendingDeletions() 先短路）
  env.ts       只读白名单环境变量；配置错误只报变量名不回显值
  http/handlers.ts   路由表（method + path + summary 即 OpenAPI 来源）
  http/openapi.ts    OpenAPI 3.0 文档（有测试强制它覆盖全部路由）
  http/query.ts body.ts   入参校验：类型/整数/枚举/长度，非法直接 400
  http/security.ts   Origin / Sec-Fetch-Site 跨站写拦截 + 登录限流
  http/session.ts    会话 Cookie 的 HMAC 签名与校验
  db/repository.ts   整库当 JSON 文档存取（dumpState/loadState），不是真实表结构
scripts/
  serve-demo.mjs  零依赖演示服务（可拉起后端并代理 /api，保留访客 Host）
  demo-check.mjs  上台前自检（PASS/FAIL + ALL GREEN）
  http-contract-check.mts  前端真实 Http 客户端 × 已监听后端，逐接口对账
```

网页路由：`/map`、`/restaurants/:id`、`/submit`、`/me`、`/me/collections`、`/me/collections/:id`、`/s/:token`、`/login`、`/admin`、`/privacy`、`/terms`、`*` → 404（`apps/web/src/app/App.tsx`）。
API 路由（全在 `/api/v1` 下，44 条操作 / 38 个路径）：`/health/live` `/health/ready` `/today` `/map/items` `/restaurants` `/restaurants/search` `/restaurants/:id` `/media/:id` `/uploads/test-photo` `/auth/login` `/auth/logout` `/me` `/me/submissions` `/me/reports` `/submissions` `/restaurants/:id/my-feedback` `POST|DELETE /restaurants/:id/collection-item` `/collections` `/collections/:id` `/collections/:id/items/:restaurantId` `/collections/:id/publication-requests` `/collections/:id/unpublish` `/shared-collections/:token` `/reports` `/restaurant-candidates` `POST /restaurant-candidates/:id/materials` `/admin/queue` `/admin/reports` `POST /admin/reports/:id/actions` `/admin/candidates` `/admin/candidates/:id/actions` `/admin/audit-log` `/admin/moderation/:target/actions` `/admin/restaurants/:id/status` `/admin/restaurants/:id/merge` `/admin/editorial-endorsements/verify|revoke`。

`localStorage` 键：`qianwei.state`（引擎快照）、`qianwei.session`、`qianwei.mapviewport`、`qianwei.mapfilters`、`qianwei.mapengine`、`qianwei.draft.<userId|anon>`、`qianwei.fallback`（Pages 深链接回退，见 `public/404.html`）。

## 3. 不许回退的业务不变量（13 条）

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
13. **举报工单只是复核线索，不是结论**：同人+同店+同类型+**同 `feedback_target`** 且未结案时复用同一张单；`OPEN → IN_REVIEW → RESOLVED|DISMISSED` 的终态**没有回退边**（`REPORT_TRANSITIONS` 里没有指向 `OPEN` 的转移）；结案与驳回必须写明处理结果；处置人不能是举报人本人（403，即使挂着 moderator/admin）；**处置工单不会改门店的营业/风险状态** —— 闭店与"需人工复核"只能在 `PATCH /admin/restaurants/:id/status` 单独确认，3 个举报不会自动判闭店（REC-07）。

## 4. 改东西的连带清单（最容易漏的部分）

| 你要改的 | 必须同时改 |
| --- | --- |
| 一个枚举值 | `enums.ts` 的中文标签 → `dto.ts` 字段类型 → `openapi.ts` schema → 用到的页面文案 → 测试 |
| 一个 DTO 字段 | `dto.ts` → `openapi.ts`（`nullable` 要写清）→ `http.ts` 与 `client.ts` 两个实现 → 页面 |
| **新增/改一条 API 路由** | `handlers.ts` 路由表 → `openapi.ts` 条目（**"openapi 覆盖全部路由"测试会红**）→ `http.ts` 方法 → `StaticClient` 同名方法 → 页面 → `scripts/http-contract-check.mts` 断言 |
| 校验规则 | `query.ts`/`body.ts`（服务端）与引擎内校验**两处都要**，否则静态模式与后端模式行为不同 |
| 种子数据 | `seed.ts` → 基线计数（`collection=28 media=224 meta=1 publication=1 report=2 restaurant=49 user=9 visit=128`）→ 依赖这些 ID 的测试与 `status.md` 的 verified 表 |
| 地图渲染 | 两个适配器都要过（`maplibre-adapter.ts` / `amap-adapter.ts`），共用 `MapAdapter` 接口（`features/map/types.ts`），纯函数测试在 `map.test.ts` |
| 迁移 | `database/migrations/*.sql`（启动时幂等应用），同时改 `repository.ts` 的文档结构 |
| **新增一个实体** | `store.ts` 的集合 + `dumpState`/`loadState` → `repository.ts` 的 `ENTITY_KINDS`/`DumpedState`/`rowsFor`/`parseDump`/`load` 分支（文档表通用形状，**不需要新迁移**）→ `dto.ts` → `openapi.ts` schema → `client.ts` 接口 + `StaticClient` + `http.ts` → 页面 → 契约自检 → `status.md` |
| **给已有实体加可选字段** | 想清楚它是否进入**唯一性/去重键**。举报加 `feedback_target` 时就因为去重键没带上它，导致"举报第二条反馈"命中第一条的工单、关联被静默丢掉 |
| 展示任何时间戳 | 一律走 `rules.ts` 的 `shanghaiDay` / `shanghaiDateTime`，**不要 `slice(0, 10)`**（UTC 16:00 之后上海已是次日） |
| 展示任何枚举 | 一律取 `enums.ts` 的 `*_LABEL`（状态、举报类型与状态、候选状态与来源、重复原因、地点状态）。直接输出枚举在这个仓库复发过三次 |
| 任何可聚焦控件 | 有 `label` 或 `aria-label`；chip 型开关带 `aria-pressed`；图片有 `alt`。键盘遍历已建立基线（status.md），别让它退化 |

`Store` 的只读接口入参**一律是 sessionId**，内部只经 `userIdOfSession()` 换算一次。曾有 bug 是 `detail()` 把 sessionId 当 userId 用，`my_current_feedback` 恒为 null，两种模式都不报错（D10）；契约自检现在盯着这条。

## 5. 已经踩过的坑（别重新发明）

**Windows / Node 24 / 本地环境**
- `spawn('npm.cmd')` 报 EINVAL（Node 对 .bat/.cmd 的安全修复）→ 调 npm 自带的 `npm-cli.js`（`serve-demo.mjs`、`dev.mjs` 都这么做）。
- Git Bash 把以 `/` 开头的环境变量值当 POSIX 路径转换：`VITE_BASE=/repo/` 会变成 `/program/Git/repo/` → 前缀 `MSYS_NO_PATHCONV=1`。同一个坑吃 `VITE_API_BASE=/api`，症状更隐蔽：不报错，只是所有请求打到 `file:///D:/program/Git/api/v1/...`，页面显示"网络不可用"，看着像后端坏了。Linux runner 无此问题，所以本地预演不能替代 CI。
- `npm run build` 手工构建**不会**写 `apps/web/dist/.demo-mode` 标记，演示自检的"构建模式与运行方式一致"那项就会红。要构建就走 `serve-demo.mjs`。
- PowerShell 内联脚本里 `$_` 会被 MSYS 吞掉；要导数据用 `ConvertTo-Csv`。Bash heredoc 里放中文引号会断，用 Write 工具。
- `server.close()` 会被代理的 keep-alive 空闲连接按住整个 `keepAliveTimeout`，重启期间新进程撞 `EADDRINUSE` → `app.ts` 里有 `closeIdleConnections()`。

**验证纪律（这一条最贵）**
- **会写数据的验证一律指独立库**：`SQLITE_PATH=<项目绝对路径>/work/xxx.sqlite`（`openDatabase` 会建父目录，空库自动由合成种子初始化）。要给 **Windows 风格的绝对路径**：workspace 脚本的 cwd 是 `apps/api` 而不是仓库根，相对路径会落进 `apps/api/work/`；Git Bash 的 `$PWD` 展开成 `/c/Users/...`，Node 在 Windows 上解析出来又是另一个地方，你会盯着一个空库排障。写默认库的话，别的任务留下的状态查不回来，而且 `npm run seed:test` 会整库覆盖。
- **`netstat` 显示 8787 有监听，不代表只有一个后端在答**：残留的 `tsx watch` 子进程和新进程可以同时挂在 8787 上，浏览器与 `curl` 分别打到**两个不同的库**（实测出现过"界面里的 REP0003 后端查不到、后端里的 REP0025 界面没见过"）。动手前 `netstat -ano | grep :8787` 只应有一个 PID，且与进程启动时间对得上；杀的时候 `taskkill //PID <pid> //T //F` 连子进程一起。
- **停掉后台任务不等于停掉服务**：任务管理器式的停止只杀 `npm run dev:api` 的外壳，`tsx watch` 子进程还占着端口。症状是"新库没生效"，日志里那行「启动失败：端口不可用」是唯一线索。
- **演示与验证不要用 watch 模式起后端**：`tsx watch` 在改 `packages/contracts` 后重启，新进程撞不到端口时留下"仍在监听、会话已丢"的后端。`serve-demo.mjs` 已改用 `npm run start -w @qianwei/api`。
- **契约自检不能在同一库上跑第二遍**：`createCandidate` 走幂等缓存，第二次运行同键同内容返回**第一次的响应快照**（`version` 是旧值），后面的 `expected_version` 必然 409。这不是缺陷（幂等重放本该返回同一结果，见 NEXT.md N7），但意味着每轮验证换新库。
- **别用 Git Bash 的 `curl -d '中文'` 写数据**：控制台代码页会把 UTF-8 请求体压成乱码，服务端如实存下来，于是界面上出现 `处理结果：___`，看着像编码 bug。要么 `--data-binary @file.json`，要么直接在浏览器里输入。
- 后台起的 `npm run dev` 会随休眠/重启消失，而浏览器标签页还留着上一次的界面：这时 `localStorage` 读写照样"通过"。判断前先 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8787/api/v1/health/ready`，拿到 200 再信实测结论。
- 内嵌浏览器（CDP）只在页面**可见**时能截图；页面切到后台会报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`，但 `evaluate_script` / `take_snapshot` 仍可用 —— 结构证据优先于截图。
- 内嵌视口固定 531×568 改不了，它**命中 `max-width:719px` 窄屏断点**。别把它的结果写成"桌面视口实测"（这个标签错过一次，已全库更正）。

**写测试时容易自己骗自己**
- `requireRestaurant()` 返回的是 Map 里的**活动对象**，不是副本。先 `const before = ...` 再改它，`before.x` 会跟着变。要比"改前/改后"必须先存标量。
- 同一个 `requireRestaurant()` 会先走 `canonical()`：门店被合并后，用旧 ID 取到的是 **target 记录**。断言"旧 ID 永久重定向"要读 `s.restaurants.get(id).merged_into`。
- 幂等重放**不该**接受内容变化（同键换内容 → 409 才是对的）。
- `location_version` 在"驳回 → 补材料"路径上的递增次数不符合直觉，别按感觉写期望值（见 NEXT.md N1 的子问题）。
- 断言某句固定文案之前先确认它不是种子写死的。举报的 `result_note` 曾经是种子给的固定句子，等于用文案冒充处置结论；现在种子一律 null，只能由处置动作写入。

**只有实测能抓到的缺陷类型（代码审阅看不出来）**
- 相机 zoom 是连续值，服务端 `integer` 校验直接 400 → `useMapData.ts` 用 `Math.floor(viewport.zoom)`。
- `fitBounds` 首帧不生效 → `MapView.tsx` 用 `viewportRef` + `fitSignal` 读最新 inset，而不是挂载时的闭包。
- 代理改写 `Host` 让后端把"浏览器↔演示服务"这条真同源判成跨站，写操作全 403（跨站页面伪造不了 Host，所以保留 Host 不放松 CSRF 判断）。
- 错误提示的渲染条件写反：建店告警原本挂在"表单已关闭"上，结果表单开着时 401/409/非字段错误全都看不见。
- 展示层自己加工数据 = 缺陷温床：枚举回潮（`社区：QUALIFIED`、`门店地点：VERIFIED`）、时间截 UTC、"提交时间"拿当前时刻冒充（真实字段缺失时宁可显示"时间未知"，不许造数据）。规则是**展示层只搬运，不计算**。
- 交互退化：改已有反馈不回填表单会把实吃日期顶成今天（假记录风险）；静态模式刷新即掉登录（`StaticClient.login/logout` 漏 `persist()`）。

**仓库完整性**
`.gitignore` 裸写 `data/` 会连 `apps/web/src/data/` 一起吞掉 —— 整个数据层曾经不在前两个提交里，克隆下来无法构建（已锚定成 `/data/` 与 `apps/api/data/`）。`work/` 是每轮门禁新建的临时库与日志，已忽略。推送前必查：
```bash
git ls-files --others --exclude-standard            # 期望空
git ls-files --others --ignored --exclude-standard  # 逐条确认都是产物
```

## 6. 验收门禁（改完必须全绿再说"完成"）

```bash
npm run typecheck                            # 期望退出码 0，3 个 workspace
npm test -w @qianwei/contracts               # 期望 92 通过（store 63 + candidates 21 + reports 8）
npm test -w @qianwei/web                     # 期望 14 通过（vitest）
npm test -w @qianwei/api                     # 期望 29 pass / 0 fail（node:test）
SQLITE_PATH="C:/绝对/路径/work/gate.sqlite" npm run start:api &   # 另开终端；每轮换新库；用 start 不要用 dev
npx tsx scripts/http-contract-check.mts      # 期望 61 项，前端真实 Http 客户端 × 已监听后端
node scripts/demo-check.mjs --api --base=http://127.0.0.1:<端口>   # 期望 ALL GREEN（14 项）
npm run build                                # 期望退出码 0
```

**数字会变，别照抄**：跑之前先实测一遍，报告里写你这次真的看到的数（历史 测试/契约自检：89/28 → 100/29 → 125/47 → 134/57 → 135/61）。
`npm run seed:test` 只在想把**默认**演示库恢复成种子基线时用（整库覆盖，先确认没人在里面留状态）。
契约自检的 Cookie Jar 是脚本内的内存 `Map`，不落盘；手动 `curl -c` 试过登录接口后，把生成的 jar/凭据文件删掉再提交。
浏览器实测的路径与预期文案见 [status.md](./status.md)；本地环境细节见 [runbooks/local-dev.md](./runbooks/local-dev.md)。

## 7. 沟通与操作约定

- 汇报分三档：**implemented / verified / release_ready**，只写你真的跑过命令或真的看过页面的部分。
- 不写"看起来对了"当证据；测试断言、命令退出码、浏览器里看到的确切文案才算 verified。
- 不把 Mock 演示说成 production-ready；不做范围漂移（说明书没要求的社交、支付、算法排序一律不做）。
- 凭据一律不进仓库、issue、文档、截图；`.env.example` 只放占位符。
- 法务/隐私文案跟着实现走：做不到的事不要承诺（D11 已为此改过一版）。
- 破坏性或共享状态动作先问人：部署、`git push --force`、删分支、`rm -rf`、迁移线上库、对真人发消息。本地提交和文件编辑可以直接做。
- **不要擅自改 git config**（提交身份由用户决定）。
- 不确定就写成问题，不要猜着改：待决清单在 [NEXT.md](./NEXT.md)。

## 8. 文档索引

- [../DELIVERY.md](../DELIVERY.md) 怎么最快看到它、能演示到哪一步、哪些话不能说
- [../README.md](../README.md) 快速开始、两种运行模式、值得手动验证的规则
- [status.md](./status.md) **账本**：implemented / verified / not verified / release_ready
- [NEXT.md](./NEXT.md) 待决问题（N1–N8）+ 可优化清单（O1–O8）+ 需要授权的事
- [blockers.md](./blockers.md) 未闭合项与外部依赖（编号稳定，别的文档按号引用）
- [decisions.md](./decisions.md) D01–D20 与原始说明书不同的选择及原因
- [演示动线.md](./演示动线.md) 六幕讲解脚本（含屏幕上应出现的确切文案与翻车预案）
- [design/restaurant-candidates.md](./design/restaurant-candidates.md) 建店与地点核验的方案及其依据的规格条款
- [render-check/](./render-check/) 渲染证据截图 + 拍摄环境说明
- [runbooks/local-dev.md](./runbooks/local-dev.md) · [deploy-pages.md](./runbooks/deploy-pages.md) · [deploy-api.md](./runbooks/deploy-api.md)
- `ACCEPTANCE.md`（在交接包里，不在本仓库）验收合同：行为、数据与证据的要求，`release_ready` 的判据
