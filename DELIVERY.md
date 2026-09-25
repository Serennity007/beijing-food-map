# 京城黔味地图 · 交付说明（2026-09-25）

北京贵州菜与西南美食地图的**可运行演示版**：网页优先，两种模式同一套业务规则。
这份文件回答"怎么最快看到它、能演示到哪一步、哪些话不能说"。工程账目在 `docs/`，从这里进。

## 30 秒看到网页

不想记命令就双击：

| 双击这个 | 它会做什么 |
| --- | --- |
| `一键演示.bat` | 装依赖（首次）→ 构建 → 起本地服务 → 自动开浏览器。**静态模式**，数据在你自己浏览器里，不需要后端 |
| `一键演示-后端模式.bat` | 同上，并顺带拉起演示后端、代理 `/api`。写 `work/demo-*.sqlite` **独立库**，不碰默认演示库。后端模式下的登录与写操作已在本机实测走通 |
| `演示自检.bat` | 上台前跑一次，看 **ALL GREEN**。检的是"打开就能看"这件事：产物在、站点可达、深链接回退、资源齐、模式对、后端探针、水印在、默认库没被写脏 |
| `复原演示数据.bat` | 用合成种子整库覆盖默认演示库（覆盖式操作，先确认没人在里面留状态） |

命令行等价物：

```bash
npm install                # Node ≥ 22.5，建议 24（后端用内置 node:sqlite）
node scripts/serve-demo.mjs            # 静态模式，默认 4173，被占自动往后找
node scripts/serve-demo.mjs --api      # 后端模式
node scripts/demo-check.mjs            # 演示自检（后端模式加 --api）
```

启动后会打印本机地址和**同 Wi-Fi 手机可开的局域网地址**。

## 演示账号

`U01…U05` 普通食客 · `E01` 编辑 · `M01` 审核员 · `A01` 管理员。验证码统一 `888888`。
`U06` 是"已注销"账号，故意留着验证登录被拒。固定验证码与测试种子在 `NODE_ENV=production` 下被引擎直接拒绝装载。

**照着讲**：`docs/演示动线.md`（六幕，每幕给讲解词 + 屏幕上应出现的确切文案 + 翻车预案）。

## 两种模式，一套规则

| 模式 | 数据在哪 | 用途 |
| --- | --- | --- |
| 静态演示 | 浏览器内跑同一份领域引擎 + `localStorage` | 双击就能看、离线、Pages 部署形态 |
| 后端演示 | `apps/api` + SQLite（独立文件） | 验真实 HTTP 链路、鉴权、幂等、版本冲突、注销后台任务 |

页面层只依赖 `ApiClient` 接口；业务规则（180 天窗口、社区计票、资格谓词、清单权限、建店与地点核验、举报工单处置）在 `packages/contracts` 里**只实现一次**。

## 口径：三档，别混

- **implemented** —— 领域引擎 + 11 个页面 + 演示后端 44 条接口操作（38 个路径）+ OpenAPI + Pages workflow。
- **verified** —— 本机（Windows + Node 24.18.0）跑出来的：typecheck 3 workspace 全绿；测试 **135 项 0 失败**（contracts 92 / api 29 / web 14）；HTTP 契约自检 **61 项**；`npm run build` 退出码 0；演示自检静态 7 项 / 后端 14 项 ALL GREEN；两种模式浏览器实测闭环走通（**含 `--api` 后端模式下的举报处置全链路**）；键盘遍历与焦点可见性实测过（Tab 顺序、跳转链接、方向键平移、回车展开聚合）。逐条证据在 `docs/status.md`。
- **release_ready：否** —— 数据全是合成的；真实对象存储、可水平扩展的持久化、地图选点与真实 POI 数据源、真机与窄屏适配、后端部署、仓库推送都还没做。分账见 `docs/blockers.md`。

## 指标口径（讲"凭什么推荐"时用）

- 社区计票：`R ≥ 3 且 4R ≥ 3T`，窗口是 **Asia/Shanghai 含两端的 180 个自然日**；收藏、点赞、编辑背书都不入票；利益披露非"无关联"的记录公开披露但不算独立票。
- 默认好店图层谓词：资料可公开 AND 地点 `VERIFIED` AND 营业 `OPEN|UNKNOWN` AND 风险 `CLEAR` AND（社区 `QUALIFIED` OR 编辑 `ACTIVE`）。不满足时详情页列出**具体不符合项**。
- 建店与推荐是两件事：用户提交新店只得到"地点待核验"，**核验通过也不等于好店达标**。

## 目录

```
一键演示.bat / 一键演示-后端模式.bat / 演示自检.bat / 复原演示数据.bat
scripts/serve-demo.mjs      零依赖静态服务 + 可选拉起后端并代理 /api
scripts/demo-check.mjs      演示自检（PASS/FAIL + ALL GREEN）
scripts/dev.mjs             开发期同时起前后端
scripts/http-contract-check.mts  前端真实 Http 客户端 × 已监听后端，61 项对账
packages/contracts/         唯一规则实现处（枚举/DTO/规则/引擎/种子）
apps/web/                   Vite + React 19 SPA（含 /admin）
apps/api/                   node:http + node:sqlite + OpenAPI
database/migrations/        SQL 迁移（启动时幂等应用）
docs/                       handover / status / blockers / decisions / 演示动线
                            design/ 方案 · render-check/ 渲染证据 · questions-for-next-review.md 待决
```

## 不承诺的事（对外讲的时候必须守住）

- 不虚构门店、探店、票数、截图证据；所有数据带 `is_test_data=true`、店名前缀「测试·」。
- 不把演示说成 production-ready；被问到上线就指 `docs/status.md` 与 `docs/blockers.md`。
- 真实地图 Key、短信服务、云账号、任何付费开通、任何对真人发消息 —— 都需要人先授权。
- 凭据不进仓库、issue、文档、截图；`.env.example` 只放占位符。

## 给接手改代码的人

先读 `docs/handover.md`：现状口径、规则唯一实现处、不许回退的 13 条业务不变量、改一处的连带清单、已踩过的坑、验收门禁。
本轮**没定下来**的问题集中在 `docs/questions-for-next-review.md`（13 条：Q1–Q10 出自阶段 1A，Q11–Q13 出自阶段 1B 的接口语义、运营死角与匿名边界；含一条会影响功能实际价值的规则疑问）。
