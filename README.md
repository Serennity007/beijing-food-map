# 京城黔味地图（演示版）

北京贵州菜与西南美食地图的**可运行演示**：地图首页发现门店 → 查看推荐依据 → 收藏/导航；搜不到这家店时先提交**建店申请**（地点待人工核验）→ “我吃过”投稿 → 人工审核 → 形成有效推荐 → 回到地图；个人清单 → 显式发布不可变快照 → 分享 / 撤回。

按《北京美食地图｜完整 AI 开发执行说明书 V2.0》实现。所有门店、地址、图片、实吃记录与票数都是**合成测试数据**，不代表任何真实餐馆。

## 快速开始

```bash
npm install
npm run dev          # 前端 http://localhost:5173 + 演示后端 http://127.0.0.1:8787
npm run dev:web      # 只要前端（静态演示模式，数据存在浏览器 localStorage）
npm run typecheck
npm test             # 领域引擎、后端合同与地图纯函数测试（本轮 100 项：contracts 61 / web 14 / api 25）
npx tsx scripts/http-contract-check.mts   # 前端 HTTP 客户端 × 已监听后端的逐接口对账（本轮 29 项，先把后端起在 127.0.0.1:8787）
npm run build        # apps/web/dist
```

需要 Node ≥ 22.5（后端使用内置 `node:sqlite`）；CI、镜像与本机验证都固定用 Node 24。

## 两种运行模式

| 模式 | 触发 | 数据来源 | 用途 |
| --- | --- | --- | --- |
| 静态演示 | 默认 | 浏览器内运行同一套领域引擎 + `localStorage` | GitHub Pages、离线试用 |
| 后端演示 | 构建/运行时设置 `VITE_API_BASE` | `apps/api` + SQLite | 验证真实 HTTP 链路、鉴权、幂等、并发版本 |

页面层只依赖 `apps/web/src/data/client.ts` 里的 `ApiClient` 接口，两种模式共用同一批页面。业务规则（180 天窗口、社区计票、资格谓词、清单权限）在 `packages/contracts` 里只实现一次。

## 登录

没有接入短信服务。`/login` 使用预置合成邀请账号，验证码固定 `888888`：

- `U01…U05` 普通测试食客（投稿、清单、分享）
- `E01` 编辑（实吃背书）、`M01` 审核员、`A01` 管理员（`/admin` 后台）
- `U06` 已注销账号（用于验证登录被拒与会话处置）

固定验证码和测试种子在 `production` 配置下会被引擎直接拒绝。

## 值得动手验证的规则

- 默认图层谓词：资料可公开 AND 地点 VERIFIED AND 营业 OPEN/UNKNOWN AND 风险 CLEAR AND（社区 QUALIFIED 或编辑 ACTIVE）。不满足时详情页会列出具体不符合项。
- 社区计票：`R ≥ 3` 且 `4R ≥ 3T`，窗口为 Asia/Shanghai 的 180 个自然日（含两端）。收藏、点赞、编辑背书都不入票。
- 撤回立即退出公开与计票，历史版本不会自动复活；较低 revision 不能覆盖已批准的较高 revision。
- 利益披露非“无关联”的记录会公开披露，但不算独立票。
- 分享快照不可变；撤销后旧 token 永久失效，`publication_generation` 递增会作废此前全部待审发布申请。
- 作者不能审核自己的内容或发布申请，即使同时是管理员。

## 目录

```
packages/contracts/   # 枚举、DTO、坐标/聚合、资格规则、领域引擎 Store、测试种子
apps/web/             # Vite + React 19 SPA（含 /admin 路由）
apps/api/             # 演示后端：node:http + SQLite 持久化 + OpenAPI
database/migrations/  # SQL 迁移（启动时幂等应用）
scripts/              # 统一开发入口 + HTTP 契约自检
docs/                 # handover / decisions / status / blockers / runbooks
```

## 部署

- 网页端：`.github/workflows/deploy-web.yml` 构建 `apps/web/dist` 并发布到 GitHub Pages（测试是发布门禁）；`apps/web/public/404.html` 负责深链接回退。步骤见 `docs/runbooks/deploy-pages.md`。
- 后端：需要第三方托管平台（Render/Fly/Railway 等）账号授权后才有真实地址。仓库内已备好 `Dockerfile` 与 `render.yaml`，**均未构建/未部署**，参数与坑见 `docs/runbooks/deploy-api.md`。Pages 上的演示不依赖后端。
- 本地开发与环境变量：`docs/runbooks/local-dev.md`。

## 当前状态

接手改动请先读 `docs/handover.md`（现状口径、规则在哪、改一处的连带清单、已踩过的坑、验收门禁）。
见 `docs/status.md`（implemented / verified / 未 verified / release_ready 分列）与 `docs/blockers.md`（真实地图 Key、短信、云账号授权、真机视觉验证等外部依赖，以及刻意留下的缺口）。
