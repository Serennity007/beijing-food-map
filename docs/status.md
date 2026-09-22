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
| `npm run build` | 成功。`index.js` 407 kB（gzip 124 kB）、`maplibre.js` 1 053 kB（gzip 285 kB）、`react.js` 51 kB、CSS 87 kB |

覆盖到的关键行为（分布在三套测试与契约自检里，都是断言不是"看起来对"）：地图聚合与快照过期 409、媒体可见性、搜索、登录限流 429、投稿幂等键、审核写穿后旧快照 409、撤回不复活、清单发布/撤销换发 token、作者不能自审、门店合并、注销后数据处置、审计日志权限。

## not verified（不要当成已交付）

- **视觉与交互**：内嵌浏览器视口是 0×0（`visible=false`），截图与布局无法采集。响应式断点、抽屉遮挡、地图 inset、移动端手势**只做过代码层核对**。
- **真实底图**：高德 Key 与安全密钥未配置，双适配器只跑过纯函数单测，没有在真实地图上渲染过点位。
- **Docker 镜像**：本机无 Docker，`Dockerfile` 未构建过。
- **第三方托管**：后端未部署，`render.yaml` 未在任何账号上导入过；Pages 也还没推送（仓库尚未 `git init`）。
- **无障碍**：未跑过键盘遍历与读屏。
- **迁移演练**：`database/migrations/*.sql` 只在空库上跑过，没有从旧版本升级的路径可验（尚未上线）。

## release_ready：否

差距按性质分三类，详见 [blockers.md](./blockers.md)：数据（合成门店不是真实核验数据）、凭据（地图 Key、短信、云账号需你授权与提供）、能力缺口（签名会话、真实对象存储、审核侧举报队列接口未实现）。
