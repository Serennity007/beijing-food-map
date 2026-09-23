# 决策记录

记录与本任务原始说明书（MASTER_SPEC 第 4 节默认栈）不同或需要解释的选择。日期均为 2026-09-22。

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
`LegalPage` 原来写“上传的图片会剥离 EXIF”“后台按保留策略异步删除”，但代码里既不接受真实照片上传（图片是服务端生成的合成图），也没有异步清除任务（`deleteAccount()` 只做同步处置，`deletion_job_id` 是回执）。文案改成如实描述演示边界 + 生产要求，而不是承诺做不到的事。

## D12 Node 版本与工具链固定
CI（`setup-node`）、`Dockerfile` 与本机验证统一到 Node 24。`engines` 仍声明 `>=22.5`（`node:sqlite` 的引入版本），但 22.x 线上 `node:sqlite` 的开关行为未在本仓库验证过，所以不拿 CI 去赌。

## D13 测试数据与生产的隔离
双层拦截并且有测试盯着（`store.test.ts` 的 DEMO-01）：`seed-cli` 在 `NODE_ENV=production` 下直接拒绝执行，`Store` 构造时 `env === 'production'` 抛 `RuleViolation`，演示登录入口也返回 403。缺的是"发布前扫一遍凭据与测试标记"的独立检查脚本（blockers 里没有单列，属可选加固）。
