# 项目状态

> 结论先行：**demo 级可用，未达上线标准。**
> 三段分开记账 —— 代码写了什么（implemented）/ 本机验过什么（verified）/ 没验过什么（not verified）。
> `release_ready: 否`，阻塞项见 [blockers.md](./blockers.md)。

## implemented

**领域引擎（`packages/contracts`，唯一规则实现处）**
- 24 家合成门店 + 9 个合成账号 + 69 条合成反馈，全部带 `is_test_data=true` 水印；`production` 下 Store 拒绝装载。
- 资格谓词：资料可公开 AND 地点 VERIFIED AND 营业 OPEN/UNKNOWN AND 风险 CLEAR AND（社区 QUALIFIED OR 编辑 ACTIVE）。不满足时详情接口返回具体不符合项。
- 社区计票 `R ≥ 3 且 4R ≥ 3T`，窗口是 Asia/Shanghai 含两端的 180 个自然日；读时重算过期，撤回立即退出公开与计票且历史版本不复活，低 revision 不能覆盖已批准的 revision。
- 利益披露非"无关联"的记录公开披露但不计入独立票；编辑背书需非作者核验。
- 服务端固定网格聚合（`cellDegForZoom` 分档），点击展开带 `expansion_bounds`；快照/`queryKey` 过期返回 409 `QUERY_EXPIRED`；列表上限 200；写操作乐观锁 `expected_version`。
- 坐标全程 GCJ-02，只在 MapLibre 渲染边界转 WGS84。

**网页端（`apps/web`）**：地图首页 + 筛选/搜索 + 详情、投稿、我的（清单/反馈/注销）、清单编辑与发布/撤回、分享只读页、`/admin` 审核台、登录、法律页。地图适配器双实现（MapLibre 公共瓦片 + 高德 JS API 2.0），无 Key 时走瓦片兜底。

**演示后端（`apps/api`）**：`node:http` 外壳 + `node:sqlite` 文档表持久化 + SQL 迁移 + OpenAPI 3.0 全量覆盖 + 会话 Cookie + 登录限流 + Origin/Sec-Fetch-Site 跨站写拦截 + 图片鉴权直出 + 审计日志。

**运行模式**：`VITE_API_BASE` 为空时前端用 `StaticClient`（浏览器内跑同一引擎，落 `localStorage`）；非空时用 `Http` 客户端。页面层只依赖 `ApiClient` 接口，规则不会两套。

## verified（本机 Node 24，命令均退出码 0）

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 3 个 workspace 全绿（`strict` + `noUncheckedIndexedAccess`） |
| `npm test` | **89 项通过，0 失败**：contracts 57 / api 18 / web 14 |
| `npx tsx scripts/http-contract-check.mts` | **28 项断言通过**（前端真实 `Http` 客户端 × 已监听后端，带 Cookie Jar；需先 `npm run dev:api`） |
| `npm run build` | 成功。`index.js` 408 kB（gzip 125 kB）、`maplibre.js` 1 053 kB（gzip 285 kB）、`react.js` 51 kB、CSS 87 kB |
| Pages 构建预演（`MSYS_NO_PATHCONV=1 VITE_BASE=/repo/ npm run build` + 404 替换） | 资源前缀与深链接回退值都正确；顺带发现 Windows Git Bash 会把 `VITE_BASE` 当路径转换的坑，已写进 runbook |
| 浏览器实测（内嵌 Chromium，静态模式 + `VITE_API_BASE=/api` 走后端各一遍） | 三条闭环全部走通并看到预期文案，控制台无报错：见下节 |
| 工作树完整性（`git ls-files --others --ignored`） | 源码全部被跟踪。**曾发现 `.gitignore` 的裸 `data/` 规则连 `apps/web/src/data/` 一起吞掉**（3 个数据层文件不在提交里），已锚定为 `/data/` + `apps/api/data/` |

### 浏览器实测看到的（不是代码推断）

- **地图闭环**：真实 OpenFreeMap 瓦片渲染出北京城区，聚合点徽标计数、缩放到档、筛选片、预算与菜名搜索、抽屉三档（点按与拖动都能换档）、"回到北京全图"复位、点标记平移出遮挡区。
- **投稿闭环**：U02 改一条已有反馈 → 预填原内容（实吃日期保持 2026-08-31，不会被顶成今天）→ 提交生成 `VF002#v2` 待审、旧版继续公开计票 → M01 在 `内容后台` 通过 → 门店页显示"第 2 版"，审计日志留下 `— → 2`、`2 → 2` 两条。
- **清单闭环**：新建自建清单（初始未发布）→ 搜索加店 → 预览即快照 → 提交发布（`PUB0008` 待审）→ M01 通过后 `/s/tok-0010` 匿名可读 → 作者撤销分享后同一链接显示"链接无效或已撤销"。
- **纠错闭环**：门店页提交"闭店／搬走"工单 → 我的页"我的纠错与举报"列出该单并标注待处理。
- **未登录与 404**：投稿页允许先写草稿并说明权限由服务端判定；未知路由与失效分享统一显示"链接可能已经失效…"，不泄露私密内容是否存在。
- **法律页**：EXIF 与注销两段措辞与实现一致（只声明演示版真正做到的部分）。

覆盖到的关键行为（分布在三套测试与契约自检里，都是断言不是"看起来对"）：地图聚合与快照过期 409、媒体可见性、搜索、登录限流 429、投稿幂等键、审核写穿后旧快照 409、撤回不复活、清单发布/撤销换发 token、作者不能自审、门店合并、注销后数据处置、审计日志权限。

## not verified（不要当成已交付）

- **响应式与真机**：内嵌浏览器只有一个固定桌面视口。窄屏断点、抽屉在小屏下的遮挡、移动端捏合与双指手势**没有实际跑过**（上节列出的抽屉/地图表现是桌面视口里点按与拖动的结果，不能外推到手机）。
- **真实底图**：高德 Key 与安全密钥未配置，双适配器只在 MapLibre 公共瓦片上跑通过，高德那条路径只有纯函数单测，没有在真实高德地图上渲染过点位。
- **Docker 镜像**：本机无 Docker，`Dockerfile` 未构建过。
- **第三方托管**：后端未部署，`render.yaml` 未在任何账号上导入过。仓库已本地 `git init` 并提交，目标远端已确认为 `Serennity007/beijing-food-map`（public），**尚未推送** —— 这台机器上 `gh` 登录的不是该账号，需要你本人先 `gh auth login`。
- **无障碍**：未跑过键盘遍历与读屏。
- **迁移演练**：`database/migrations/*.sql` 只在空库上跑过，没有从旧版本升级的路径可验（尚未上线）。

## release_ready：否

差距按性质分三类，详见 [blockers.md](./blockers.md)：数据（合成门店不是真实核验数据）、凭据（地图 Key、短信、云账号需你授权与提供）、能力缺口（签名会话、真实对象存储、审核侧举报队列接口未实现）。
