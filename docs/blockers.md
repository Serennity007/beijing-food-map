# 未闭合项与外部依赖

分三类：**要你提供/授权的（A）**、**上线前必须补的能力（B）**、**刻意留下的缺口（C）**。
编号一旦发布就不再改动（其他文档按号引用），状态写在条目开头：`[未闭合]` 仍然挡着，`[已闭合]` 表示本机验过。
已闭合的只留一行结论 + 决策出处，展开的过程在 `git log` 与 [decisions.md](./decisions.md)，证据在 [status.md](./status.md)。

## A. 需要你提供凭据或授权（AI 无法自行完成）

1. **[未闭合] 高德 JS API 2.0 Key + 安全密钥**
   填 `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_CODE`（控制台里把 Key 限定到部署域名）。双适配器已实现并有纯函数单测，但**没在真实高德地图上渲染过**，地图选点的高德分支同样未验。没有 Key 时走 MapLibre + 公共瓦片（OpenFreeMap / CARTO）—— 公共瓦片有配额与商用限制，只适合演示。
   2026-09-30 补充：**CARTO 无 Key 瓦片已停止服务**——不再返回瓦片，而是 200 状态的 "API KEY REQUIRED" 水印占位图，应用无法察觉、兜底等于失效（当日线上实测复现）。已把栅格兜底换成 OSM 标准瓦片（`tile.openstreetmap.org`，main `28db85c`，gh-pages `29227df` 已上线，实测直连用户走 OpenFreeMap 主图、代理用户主图超时后落 OSM 兜底，两头都有真实街道）。
   **选定路径（2026-09-30）**：高德 JSAPI 只做**展示与路线、不落库**（条款禁止存储建库，见 `runbooks/amap-key.md` 的合规边界）。代码侧无需改动（`amap-adapter.ts` 缺 Key 自动回退开源底图），已备好：申请步骤与报错对照 `runbooks/amap-key.md`、凭据模板 `apps/web/.env.local.example`（gitignore 忽略，Key 不进仓库）、一键发布 `scripts/deploy-pages.mjs`（Node 实现，天然避开 MSYS 路径坑，已端到端验证）。**剩余唯一动作：账号持有人在高德开放平台实名注册并创建 Web端(JS API) Key + 安全密钥，填入 `.env.local` 后跑一次发布脚本。**

2. **[部分闭合 2026-09-26] 托管平台授权与仓库推送**
   ✅ **GitHub Pages 线上演示已上线**：https://serennity007.github.io/beijing-food-map/ （公开仓库 `Serennity007/beijing-food-map`，gh-pages 分支静态部署，静态演示模式 = 浏览器内引擎 + localStorage）。深链接与 404 回退已实测。
   ⏳ **剩余**：① `main` 源码分支未推上（gh OAuth 缺 `workflow` scope，设备码授权两次未在有效期内完成；**2026-09-30 实测 HTTPS 推送仍被拒**：`refusing to allow an OAuth App to create or update workflow '.github/workflows/deploy-web.yml' without 'workflow' scope`。两条路任选其一：终端跑 `gh auth refresh -h github.com -s workflow` 浏览器授权补 scope；或把本机 `~/.ssh/id_ed25519.pub` 加进 GitHub 账号（Settings → SSH keys）后用 SSH 推——SSH 密钥不受 OAuth scope 限制，实测本机密钥尚未注册（`ssh -T git@github.com` 返回 Permission denied）。补齐后 `git push -u origin main` 即生效；注意 deploy-web.yml 用 `actions/deploy-pages`，main 推上后还需在仓库 Settings → Pages 把源从「分支部署」切到「GitHub Actions」，此后 push 即自动构建部署，gh-pages 手工通道退役）。在 scope 补齐前，最新构建已按原手工通道重推 gh-pages 保住线上更新（gh-pages `83281d5` ← main `1f84ba5`，2026-09-30 实测线上已是新 bundle 且浏览器渲染正常；期间踩中 runbook 记载的 MSYS 路径转换坑产出过一次白屏构建，已由部署后浏览器冒烟抓住并重建修复——上线判据必须用浏览器，见 `runbooks/deploy-pages.md` 手工通道一节）；② 真实后端托管仍待你在 render.com 用 GitHub 登录接同仓库，读 `render.yaml` 一键部署（`docs/runbooks/deploy-api.md`）；③ `Dockerfile` 仍未构建过（本机无 Docker）。
   提交身份 `Pasteliangzhengtao <cse.ztliang22@gzu.edu.cn>` 在 public 仓库会公开可见 —— 改不改由你决定，**AI 不会擅自改 git config**。
   ✅ **源码丢失风险已兜底（2026-09-30）**：发现 GitHub 的 workflow scope 检查按推送差异（tip 对比）而非逐提交——把 main 打一个"移除 `.github/workflows/`"的收尾提交推成远端分支 **`src-backup`** 获得通过。该分支含全部 45 个提交的源码内容（仅 workflow 文件在 tip 缺失，bundle 里有），已做 clone 恢复演练（今日新增的 services 三件套、小程序 envVersion 分离等全部可恢复）。本机万一损坏：`git clone -b src-backup https://github.com/Serennity007/beijing-food-map.git` + 重建 `.github/workflows/`（或从 `beijing-food-map-backup-20260930.bundle` 恢复）。scope 补齐推上 main 后此分支可删。

3. **[未闭合] 真实门店与核验数据源**
   硬约束是不虚构门店、探店、票数。当前 49 家门店、128 条实吃、9 个账号全是合成种子（店名前缀「测试·」、`is_test_data` 恒为 true，production 下引擎拒绝装载）。
   → 演示之外的一切都要先有经人工核验的门店库与核验人力。建店流程（C11）与举报处置（C9）都已闭合，所以现在缺的**只有数据**：用户提交的候选会正常进队列，但队列里只会有合成申请。
   → 已备好一份起点：[`database/import/web-candidates-20260924.json`](../database/import/web-candidates-20260924.json)，9 家真实存在的北京贵州/云南菜馆，来自通用网页检索，**逐条 `verified:false`、门牌与坐标为 null**，只保留店名与来源指针。
   → 2026-09-26 补充：高德「扫街榜」为 App 内榜单产品，开放平台 API 无榜单接口，故未抓取；已建合规收集管线 `scripts/import-amap-candidates.mts` + [`database/import/README.md`](../database/import/README.md)（校验/去重/暂存，不进引擎），供数路径见该 README（需 Web 服务 Key 或 App 内人工记录）。它没进 `seed.ts`（那里的合同是"全是合成数据"，混进真实商家会让水印变成假标签），也没搬运评论/评分/榜单/菜单/图片 —— 说明书明确"能读取不等于允许永久保存"。缺的三件事：① 地理编码或实地选点拿 GCJ-02 坐标；② 人工核验（是否在营业、门牌、菜系归类、风险）；③ 第三方美食站点的数据保存与使用条款确认。

4. **[未闭合] 短信服务凭据**
   `SMS_*` 是预留位。当前登录是内测账号 + 固定码 `888888`（只在非 production 生效）。

## B. 上线前必须补的能力（不补就不能算 production）

5. **[已闭合，附剩余尾巴] 会话签名**
   HMAC 签会话值（`timingSafeEqual` 验签、三段长度与字符集白名单），`SESSION_SECRET` 缺省时每次启动随机生成临时密钥（重启即要求所有人重新登录 —— 刻意的安全默认），`SESSION_TTL_SECONDS` 控有效期，`COOKIE_SECURE` 可独立于 `NODE_ENV` 开启。见 D14。
   → 剩余：真实托管上要固定 `SESSION_SECRET` 并给出轮换流程（旧密钥保留一个验证窗口，避免轮换即踢掉全部在线用户），接进平台的 secret 管理。见 [runbooks/deploy-api.md](./runbooks/deploy-api.md)。

6. **[未闭合] 真实对象存储**
   图片现在是内联合成 data URI，`/media/:id` 做鉴权直出，`/uploads/test-photo` 只登记合成图。缺：真实上传的体积/类型校验、EXIF（含 GPS）剥离、缩略图、CDN、恶意内容处理。
   → 隐私页与法律页目前只声明演示版真正做到的部分；接了真存储之后要同步改措辞（D11 是先例）。

7. **[未闭合] 持久化架构**
   `node:sqlite` 是单文件单进程：不能水平扩容；免费托管层的临时文件系统会在重新部署后清零（投稿与清单随之丢失）；登录限流是进程内滑动窗口，多实例等于限额乘以实例数。
   → 真实运营换 Postgres + 外部限流（`DATABASE_URL`、`SESSION_SECRET` 已在 `.env.example` 预留位）。

8. **[已闭合，附剩余尾巴] 注销的清除任务**
   `deleteAccount()` 先做同步处置（撤销会话、撤销本人公开分享、隐藏 UGC、退出计票、写审计），`deleting` 账号行本身就是持久化任务；`processDeletionJobs()` 幂等，后端启动时与每秒各排空一次，落库失败回滚内存状态等下一轮；静态模式在构造时与注销后各排一次。个人内容真删、显示名与电话清空，只留去标识用户行 + 举报状态 + 审计 —— 与隐私页和"我的"页现在的措辞一致。见 D15。
   → 剩余：接真实对象存储后要补一条"删掉桶里字节"的任务步骤；审计记录保留期到期后的匿名化脚本（现按设计长期保留，用于复核）。

## C. 刻意留下的缺口（避免范围漂移）

9. **[已闭合] 审核侧举报队列与处置闭环**
   读侧 `reportQueue(sessionId, status?)`（角色把关、待处理优先、上限 200、带门店名与 `is_reporter_self`、不输出举报人资料）；写侧 `POST /admin/reports/{id}/actions`（开始复核 / 结案 / 驳回，状态机在 `REPORT_TRANSITIONS`，终态无回退边）。四条硬规则都在引擎里：结案与驳回必填处理结果（400）、`expected_version` 不符 409、**举报人不能处置自己的工单**（403，即使挂着 moderator/admin）、处置只改工单不改门店营业/风险状态（REC-07）。去重键是 同人+同店+同类型+**同 `feedback_target`**；门店页每条公开反馈都能被单独举报，处理结果回写给举报人在"我的"页可见；种子的 `result_note` 一律为 null（不再用固定文案冒充结论）。见 D19。
   → 剩下的三条是产品决策不是代码缺口：没有举报限频/配额；图片与清单条目还没有各自的举报入口（引擎只认 `visit#vN` 形状）；举报人看不到中间态（要中间态得先定处理时限口径）。见 [NEXT.md](./NEXT.md) N3/N4。

10. **[未闭合] 真机与窄屏验证**
    闭环与后台面板在 **531×568** 内嵌视口实测过（命中 `max-width:719px` 断点，所以换行与溢出这一类已经走过一遍），键盘遍历与焦点可见性也测了。仍缺：360/390/430 真实手机宽度、抽屉在真机上的遮挡与地图 inset、捏合与双指手势、软键盘顶起、安全区、**读屏软件**。内嵌浏览器改不了视口，这些在这儿采不到。
    → 需要你在手机/浏览器里打开一次（Pages 上线后就有地址），或者直接接受"531px 已验、真机与读屏未验"。

11. **[已闭合，附剩余尾巴] 新门店提交与地点核验**
    投稿页有建店入口：搜不到这家店 → 手动填坐标或点底图选点申请；命中"地图地点候选" → 用候选的坐标与来源 ID 预填。规则都在 `packages/contracts`：候选创建时同时落一家 `place_status=PENDING` 门店，投稿可以立刻挂上去（SUB-02），而默认层谓词一个字没改就把它挡在外面；**核验通过不等于达标**，还要社区票或编辑背书，这条在门店页与"我的"页都看得见。5 条候选接口 + 核验动作（通过 / 驳回 / 并入）。见 D16–D18 与 [design/restaurant-candidates.md](./design/restaurant-candidates.md)。
    → 剩余三条：
      - **真实供应商 POI 检索**：现在的"地点候选"是内置合成点。真实候选要接高德/腾讯的地点搜索并遵守其数据保存条款（依赖 A1 与 A3）。
      - **provider+poi_id 去重**：规格要求"先按 provider+poi_id 去重"，但自有门店记录里没有任何 provider 字段（种子全是运营/合成来源），所以这条目前只在**候选之间**生效 —— 要等真实门店库带上来源 ID，属于 A3 的一部分，不是补代码能闭合的。
      - **提交人注销后**，其待核验候选仍留在队列里（显示"已注销用户"），因为它关联的门店是地点实体。要不要自动撤回是产品决策，见 NEXT.md N2。
      - 高德适配器的选点只写了代码，没有 Key 可验（属 A1）。

## 明确不做的事

不虚构门店/探店/票数/截图证据；不把真实凭据写进仓库、issue、文档或截图（`.env.example` 只放占位符）；不把 Mock 演示说成 production-ready；隐私与法务文案必须跟着实现实况写。
说明书没要求的一律不做：社交关系、支付、算法排序、推荐流。
破坏性或共享状态动作（部署、`git push --force`、删分支、`rm -rf`、迁移线上库、对真人发消息）先问人再做。
