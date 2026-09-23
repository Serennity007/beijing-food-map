# 决策记录

记录与本任务原始说明书（MASTER_SPEC 第 4 节默认栈）不同或需要解释的选择。D01–D13 记于 2026-09-22，D14–D16 记于 2026-09-23。

## D01 包管理器用 npm workspaces，不用 pnpm
仓库所在机器没有 `pnpm`，说明书要求“命名可依仓库兼容调整并记录”。影响：锁文件为 `package-lock.json`，CI 用 `npm ci` + `actions/setup-node@v4` 的 npm 缓存。业务合同不依赖包管理器。

## D02 一套领域引擎，两种宿主
`packages/contracts` 里的 `Store` 同时被静态 SPA（浏览器内 + localStorage）和 `apps/api`（HTTP + SQLite）使用。规则只有一份实现，不存在“前端算一遍、后端算一遍”的漂移。代价：引擎必须保持无 Node/浏览器专有依赖（`btoa` 与 `Buffer` 双路径已处理）。

## D03 演示部署只有静态前端，后端不上了 Pages
GitHub Pages 不能运行 NestJS/Postgres/SQLite 进程。用户选择的“GitHub 仓库 + 免费后端托管”中，后端托管需要先获得第三方平台授权，因此本仓库默认可部署形态是：Pages 静态站 + 浏览器内引擎（`StaticClient`）。设置 `VITE_API_BASE` 后同一份前端切换到 `Http`，接口合同不变。

## D04 后端用 node:sqlite 而不是 PostgreSQL
目标是可运行的 demo，避免要求本机装 Postgres/Docker。仓储层把整库状态当作一个 JSON 文档存取（`dumpState`/`loadState`），迁移脚本与真实表结构留待生产化。风险与替换路径见 blockers.md。

## D05 管理后台在同一 SPA 内的 `/admin` 路由
说明书建议 `/admin/*` 独立界面。演示阶段把后台作为同一应用的路由，减少一份构建；权限判定仍在服务端/引擎里（`requireRole`），前端隐藏入口不作为安全边界，这一点在页面上明确写出。生产化时拆成独立构建只是打包配置改动。

## D06 地图双实现，默认 MapLibre + 免费瓦片
用户要求“两者都做，Key 到位后切换”。业务坐标统一 GCJ-02；MapLibre 适配器在渲染前一次性转 WGS84，高德适配器原样使用。切换按钮在地图右上角，偏好写入 `localStorage['qianwei.mapengine']`。没有高德 Key 时切到高德会给出明确错误并回退列表，不出现空白地图。

## D07 图片是内联合成 SVG data URI
演示不接对象存储，`testPhotoDataUri()` 生成带“测试图片 · 非真实门店”字样的图。上传走 `POST /uploads/test-photo`（静态模式为引擎内 `addTestMedia`），默认 `PENDING`。可见性判断收在 `Store.canViewMedia()`：已过审人人可读，未过审只有作者与审核人员可读，其余（含匿名）按「不存在」处理并返回统一 404。`/media/:id` 因此是鉴权代理（读出 data URI 再吐字节），不是可猜的直链。

## D08 演示登录用邀请账号 + 固定验证码
没有短信服务，固定码 `888888` 只存在于 `demo`/`development` 环境；`Store` 在 `env === 'production'` 时直接拒绝该入口和测试种子。真实上线前替换为服务端短信验证码（限频、短时、单次使用）。

## D09 数据边界
24 家门店全部店名前缀“测试·”、地址写明“演示地址，非真实门店位置”、`is_test_data=true`，每张合成反馈的理由文本里都写明非真实探店。没有任何一条真实餐馆、真实探店或真实票数被编造。种子数据的用途是让每条业务规则都有可复现的正反例。

## D10 读接口的入参统一是 sessionId，不是 userId
`Store` 的只读接口一律收 `sessionId`，内部用 `userIdOfSession()` 换算，匿名/失效会话/已注销都得到 `null` 而不抛 401。此前 `detail()` 直接把 sessionId 当 userId 用，导致 `my_current_feedback` 恒为 null —— 静态模式和 HTTP 模式同时中招且都不报错。教训：身份换算只能有一处，且必须被契约测试覆盖（`scripts/http-contract-check.mts` 现在盯着这条）。

## D11 隐私与法务文案按实现实况写
`LegalPage` 原来写”上传的图片会剥离 EXIF””后台按保留策略异步删除”，但代码里既不接受真实照片上传（图片是服务端生成的合成图），也没有异步清除任务（`deleteAccount()` 只做同步处置，`deletion_job_id` 是回执）。文案改成如实描述演示边界 + 生产要求，而不是承诺做不到的事。
第二轮（D15 落地后）又收了一次口：注销的说明现在分清”立即发生”与”随后自动继续”两段 —— 立即撤销会话与本人公开分享、隐藏投稿与资料、票数即时重算；随后清除投稿/图片/清单/分享快照并清空显示名与电话；去标识的用户行、举报状态与审计记录保留。原来那句”按保留策略异步删除或匿名化”仍然删掉，因为它承诺的是一个没有实现物的保留策略。同一轮补上”本机的投稿草稿会立即删除”，因为草稿确实是账号内容且确实会被清。原则不变：**能做到多少写多少，两句措辞之间的差别也要跟代码对齐。**

## D12 Node 版本与工具链固定
CI（`setup-node`）、`Dockerfile` 与本机验证统一到 Node 24。`engines` 仍声明 `>=22.5`（`node:sqlite` 的引入版本），但 22.x 线上 `node:sqlite` 的开关行为未在本仓库验证过，所以不拿 CI 去赌。

## D13 测试数据与生产的隔离
双层拦截并且有测试盯着（`store.test.ts` 的 DEMO-01）：`seed-cli` 在 `NODE_ENV=production` 下直接拒绝执行，`Store` 构造时 `env === 'production'` 抛 `RuleViolation`，演示登录入口也返回 403。缺的是"发布前扫一遍凭据与测试标记"的独立检查脚本（blockers 里没有单列，属可选加固）。

## D14 会话 Cookie 签 HMAC，密钥缺省时故意只在本次进程有效
`apps/api/src/http/session.ts` 把 Cookie 值从"裸的随机 session id"换成 `id.过期秒.HMAC-SHA256(base64url)`：验签用 `timingSafeEqual`，三段各自带长度与字符集白名单，整串超过 256 字符直接拒。HTTP 边缘只信签名和过期，身份换算仍然只在引擎里做（D10），登出与注销的即时失效仍靠库里的会话行 —— 两道门是叠加的，不是替换。
密钥没配时用模块级随机密钥，代价是**重启后所有人要重新登录**。这是刻意选的安全默认：本地演示里掉登录只是麻烦，而"没配密钥也照样长期有效"才是会被忘掉的那种洞。`SESSION_SECRET` 一旦设置就必须 ≥32 字符，`NODE_ENV=production` 下必填且必须开 `COOKIE_SECURE`（`COOKIE_SECURE` 也可以单独设成 `true`，因为 demo 后端必须以 development 跑，不能拿环境名去推 HTTPS）。
配置只读真实环境变量、不内置 `.env` 加载器（两个 `.env.example` 都写明了注入方式），错误消息只报变量名不回显值。

## D15 注销的清除任务用 `deleting` 账号行本身当持久队列
`Store.processDeletionJobs()` 幂等，`status='deleting'` 的行就是待办任务，因此不需要新增任务表或定时器持久化，也不会出现"内存里排着、进程一死就丢"的中间态。后端在 `listen()` 时排空一次、之后每秒一次（`hasPendingDeletions()` 先短路，避免为了一次注销每秒把整库 `dumpState()` 序列化一遍），某次落库失败就把 store 回滚到本轮之前的快照等下次重试；静态模式在 `StaticClient` 构造时排空一次，注销后再 `setTimeout(0)` 排一次。
种子账号 U06 直接以 `status='deleted'` 落库（不是 `deleting`），所以启动时的排空不会把演示库里那个"已注销"示例用例反复扫成噪声。
`deletion_job_id` 因此是真的任务编号，不再只是回执 —— 这是"我的"页与隐私页敢写"后台会自动继续完成清除"的唯一原因（见 D11）。
