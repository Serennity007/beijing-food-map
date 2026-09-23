# 项目状态

> 结论先行：**demo 级可用，未达上线标准。**
> 三段分开记账 —— 代码写了什么（implemented）/ 本机验过什么（verified）/ 没验过什么（not verified）。
> `release_ready: 否`，阻塞项见 [blockers.md](./blockers.md)。

## implemented

**领域引擎（`packages/contracts`，唯一规则实现处）**
- 24 家合成门店 + 9 个合成账号 + 71 条合成反馈，全部带 `is_test_data=true` 水印；`production` 下 Store 拒绝装载。
- 资格谓词：资料可公开 AND 地点 VERIFIED AND 营业 OPEN/UNKNOWN AND 风险 CLEAR AND（社区 QUALIFIED OR 编辑 ACTIVE）。不满足时详情接口返回具体不符合项。
- 社区计票 `R ≥ 3 且 4R ≥ 3T`，窗口是 Asia/Shanghai 含两端的 180 个自然日；读时重算过期，撤回立即退出公开与计票且历史版本不复活，低 revision 不能覆盖已批准的 revision。
- 利益披露非"无关联"的记录公开披露但不计入独立票；编辑背书需非作者核验。
- 服务端固定网格聚合（`cellDegForZoom` 分档），点击展开带 `expansion_bounds`；快照/`queryKey` 过期返回 409 `QUERY_EXPIRED`；列表上限 200；写操作乐观锁 `expected_version`。
- 坐标全程 GCJ-02，只在 MapLibre 渲染边界转 WGS84。

**网页端（`apps/web`）**：地图首页 + 筛选/搜索 + 详情、投稿、我的（清单/反馈/举报/注销）、清单编辑与发布/撤回、分享只读页、`/admin` 审核台（含举报复核面板）、登录、法律页。地图适配器双实现（MapLibre 公共瓦片 + 高德 JS API 2.0），无 Key 时走瓦片兜底。举报与状态的中文标签统一取自 `contracts/enums.ts`，页面里不再各写一份。

**演示后端（`apps/api`）**：`node:http` 外壳 + `node:sqlite` 文档表持久化 + SQL 迁移 + OpenAPI 3.0 全量覆盖 + HMAC 签名会话 Cookie（`SESSION_SECRET` 缺失时用进程内临时密钥，`SESSION_TTL_SECONDS` 控有效期，`COOKIE_SECURE` 可独立于 `NODE_ENV` 开启）+ 登录限流 + Origin/Sec-Fetch-Site 跨站写拦截 + 图片鉴权直出 + 审计日志 + 注销清除任务排空（启动时与每秒各跑一次，失败自动重试）。

**运行模式**：`VITE_API_BASE` 为空时前端用 `StaticClient`（浏览器内跑同一引擎，落 `localStorage`）；非空时用 `Http` 客户端。页面层只依赖 `ApiClient` 接口，规则不会两套。两种模式下注销都会立即清掉本机投稿草稿 `qianwei.draft.<userId>`（键名前缀由 `data/client.ts` 单一来源导出，投稿页不再自己拼字符串）。

## verified（本机 Node 24，命令均退出码 0）

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 3 个 workspace 全绿（`strict` + `noUncheckedIndexedAccess`），退出码 0 |
| `npm test -w @qianwei/contracts` / `-w @qianwei/web` / `-w @qianwei/api` | **100 项通过，0 失败**：contracts 61 / web 14 / api 25（三条命令各自退出码 0） |
| `npx tsx scripts/http-contract-check.mts` | **29 项断言通过**（前端真实 `Http` 客户端 × 已监听后端，带 Cookie Jar；需先起后端，含新增的 `reportQueue` 一条） |
| `npm run build` | 退出码 0，19.87s。`index.js` 411.94 kB（gzip 125.77）、`maplibre.js` 1 052.94 kB（gzip 284.54）、`react.js` 50.95 kB（gzip 18.03）、CSS 87.27 kB（gzip 14.20） |
| 写路径跑在独立库上 | 契约自检与浏览器实测都指向 `SQLITE_PATH=<绝对路径>/work/phase0-reaccept.sqlite`（空库由合成种子初始化并落库）；默认演示库 `apps/api/data/demo.sqlite` 时间戳未变，逐 `kind` 计数仍等于种子基线（`collection=28 media=117 meta=1 publication=1 report=2 restaurant=24 user=9 visit=71`），9 个账号状态未变 |
| 孤儿快照排查 | 两个库都过：每条 `publication` 都能找到归属 `collection`（孤儿 0），`PUBLISHED` 且无 token 的记录 0 |
| Pages 构建预演（`MSYS_NO_PATHCONV=1 VITE_BASE=/repo/ npm run build` + 404 替换） | 资源前缀与深链接回退值都正确；顺带发现 Windows Git Bash 会把 `VITE_BASE` 当路径转换的坑，已写进 runbook |
| 浏览器实测（内嵌 Chromium，静态模式 + `VITE_API_BASE=/api` 走后端各一遍） | 三条闭环全部走通并看到预期文案，控制台无报错：见下节 |
| 工作树完整性（`git ls-files --others --ignored`） | 源码全部被跟踪。**曾发现 `.gitignore` 的裸 `data/` 规则连 `apps/web/src/data/` 一起吞掉**（3 个数据层文件不在提交里），已锚定为 `/data/` + `apps/api/data/` |

### 浏览器实测看到的（不是代码推断）

- **地图闭环**：真实 OpenFreeMap 瓦片渲染出北京城区，聚合点徽标计数、缩放到档、筛选片、预算与菜名搜索、抽屉三档（点按与拖动都能换档）、"回到北京全图"复位、点标记平移出遮挡区。
- **投稿闭环**：U02 改一条已有反馈 → 预填原内容（实吃日期保持 2026-08-31，不会被顶成今天）→ 提交生成 `VF002#v2` 待审、旧版继续公开计票 → M01 在 `内容后台` 通过 → 门店页显示"第 2 版"，审计日志留下 `— → 2`、`2 → 2` 两条。
- **清单闭环**：新建自建清单（初始未发布）→ 搜索加店 → 预览即快照 → 提交发布（`PUB0008` 待审）→ M01 通过后 `/s/tok-0010` 匿名可读 → 作者撤销分享后同一链接显示"链接无效或已撤销"。
- **纠错闭环**：门店页提交"闭店／搬走"工单 → 我的页"我的纠错与举报"列出该单并标注待处理。
- **举报复核队列**：M01 登录进 `/admin` → "举报复核"列出 REP0002（信息有误 · 待处理）与 REP0001（闭店／搬走 · 复核中），门店名已解析、带处理结果说明；点"核验门店状态"跳到门店状态页并预选该店（已核验 / 疑似闭店 / 需人工复核 / 不在层内 + 具体不符合项）。举报与状态的中文措辞在"我的"页与后台完全一致，因为两边读的是同一份 `enums.ts` 标签。
- **注销闭环（HTTP 模式 + 独立库）**：U02 登录后 `/api/v1/me` 返回其会话身份 → 本机先落一条 `qianwei.draft.U02` → "申请注销账号"确认后页面显示"删除任务编号 DELJOB0014，后台会自动继续完成清除；票数已按撤回处理重算" → 本机会话立即失效、`qianwei.draft.U02` 被清除而 `qianwei.draft.anon` 保留 → 用 U02 重新登录返回 401「账号不可用」→ 库里该用户 `status=deleted`、显示名变"已注销用户"、电话字段清空，其清单/图片/投稿/发布快照/会话行全部消失，只保留去标识的用户行 + 1 条举报 + 2 条审计；U01 的 4 个清单与 22 条投稿未受影响，种子分享链接 `demo-token-1` 仍 200。
- **控制台**：整轮实测只有我为了验证"注销后不能重登"而故意发出的 401/404 探测请求报错，应用自身没有产生 error/warning。
- **未登录与 404**：投稿页允许先写草稿并说明权限由服务端判定；未知路由与失效分享统一显示"链接可能已经失效…"，不泄露私密内容是否存在。
- **法律页**：EXIF 与注销两段措辞与实现一致（只声明演示版真正做到的部分）。

覆盖到的关键行为（分布在三套测试与契约自检里，都是断言不是"看起来对"）：地图聚合与快照过期 409、媒体可见性、搜索、登录限流 429、投稿幂等键、审核写穿后旧快照 409、撤回不复活、清单发布/撤销换发 token、作者不能自审、门店合并、注销后数据处置、审计日志权限。本轮新增：会话 Cookie 的签名/篡改拒绝/TTL 与 `Secure` 独立开关（`apps/api/test/session.test.ts`）、进程重启后继续完成未跑完的注销清除且旧分享永久失效（`apps/api/test/handover.test.ts`）、举报队列的角色把关与门店摘要（api 测试 + 契约自检第 21 项）。

## not verified（不要当成已交付）

- **响应式与真机**：内嵌浏览器只有一个固定桌面视口。窄屏断点、抽屉在小屏下的遮挡、移动端捏合与双指手势**没有实际跑过**（上节列出的抽屉/地图表现是桌面视口里点按与拖动的结果，不能外推到手机）。
- **真实底图**：高德 Key 与安全密钥未配置，双适配器只在 MapLibre 公共瓦片上跑通过，高德那条路径只有纯函数单测，没有在真实高德地图上渲染过点位。
- **Docker 镜像**：本机无 Docker，`Dockerfile` 未构建过。
- **第三方托管**：后端未部署，`render.yaml` 未在任何账号上导入过。仓库已本地 `git init` 并提交，目标远端已确认为 `Serennity007/beijing-food-map`（public），**尚未推送** —— 这台机器上 `gh` 登录的不是该账号，需要你本人先 `gh auth login`。
- **无障碍**：未跑过键盘遍历与读屏。
- **迁移演练**：`database/migrations/*.sql` 只在空库上跑过，没有从旧版本升级的路径可验（尚未上线）。

## release_ready：否

差距按性质分三类，详见 [blockers.md](./blockers.md)：数据（合成门店不是真实核验数据）、凭据（地图 Key、短信、云账号需你授权与提供）、能力缺口（真实对象存储、可水平扩展的持久化、举报工单的状态流转、第三方候选点的建店核验流程）。

签名会话与注销的后台清除任务本轮已闭合（见上表），不再是能力缺口。
