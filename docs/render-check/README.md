# render-check · 页面渲染证据

这些图是**真实浏览器渲染**的截图，用于支撑 `docs/status.md` 的 verified 账目，不替代命令级证据。

## 拍摄环境

- 基线轮（`1-`–`8-`，2026-09-24/25）：内嵌视口 531×568（命中 `max-width:719px` 窄屏断点，不是桌面宽度）。
- 第一轮起（`9-` 起，2026-09-25/26）：真实设置视口 **390×844 / 360×640 / 1440×900**，360/390 手机宽度首次覆盖；仍非真机。
- 数据通道：`1-3`/`5` 静态模式；其余后端模式（真实 HTTP + SQLite 独立库）。

## 环境伪影（不要误报）

- 内嵌浏览器在标签页被节流时，CSS transition 与地图相机动画会**冻结在中途**（实测抽屉高度停在起始值、相机停在中途坐标）。截图前注入 `.drawer { transition: none }` 仅用于测量；真实浏览器中动画 180–350ms 正常完成，布局数值以稳态为准。
- `-full` 后缀的整页拼接图会把固定底栏重复画进拼接位，属截图伪影不是布局缺陷（已用实测坐标核对过）。
- 公共底图瓦片（OpenFreeMap/CARTO）在验证期间多次超时或出 "API KEY REQUIRED" 水印，属外部服务不稳定，不是本仓库缺陷；`10-`/`28-` 等图恰好拍到正常渲染稳态。

## 文件清单

| 文件 | 内容 |
| --- | --- |
| `1-map-530px.png` | 基线：地图页（旧三行工具栏形态，当时地图只剩窄缝——B1 的动因） |
| `2-restaurant-basis-530px-full.png` | 基线：门店依据区块 |
| `3-shared-snapshot-530px-full.png` | 基线：分享只读快照 |
| `4-me-candidate-progress-530px-full.png` | 基线：我的建店申请进度 |
| `5-admin-location-verify-530px.png` | 基线：后台地点核验 |
| `6-map-other-cuisines-530px.png` / `7-search-yakitori-530px.png` / `8-admin-report-530px.png` | 基线：其他菜系视图 / 搜索 / 后台举报复核 |
| `9-map-390-firstscreen.png` | 首屏改造：两行工具栏 + 低档抽屉 + 地图主体（可视约 60% 屏高） |
| `10-search-focus-outofview-390.png` | 搜索跨视野定位：相机飞至目标、卡片高亮、署名不被遮 |
| `11-search-failed-390.png` | 搜索失败态：关键词保留 + 重试按钮（后端宕机实测） |
| `12-search-noresult-apply-entry-390.png` | 重试恢复；无结果态带「申请新增门店」入口 |
| `13-candidate-draft-kept-390.png` | 建店草稿：选点往返坐标带入、店名/说明零丢失 |
| `14-map-390-filter-panel.png` | 筛选面板：已选计数、待验证分组与提示 |
| `15-map-360-short.png` / `16-map-1440-desktop.png` | 360 短屏 / 1440 桌面无回归 |
| `17-detail-pending-390.png` / `18-detail-quick-390.png` / `19-detail-quick-1440.png` | 详情页速览重构：不达标醒目常显、价格锚点前形态、完整依据折叠 |
| `20-restyle-map-390.png` / `21-restyle-detail-390.png` / `22-restyle-map-1440.png` / `23-restyle-admin-1440.png` | 审美第一遍：令牌/阴影/悬停反馈在四类页面 |
| `24-picker-in-form-390.png` | 表单内嵌选点地图（端到端提交回执 RC0123 见 status.md） |
| `25-guizhou-elements-390.png` / `26-qian-dictionary-390.png` | 贵州元素：蜡染织带 + 黔字徽标 / 黔味小词典 |
| `27-premium-detail-390.png` / `28-premium-map-390.png` / `29-premium-detail-1440.png` | 高级感升级：衬线标题、价格锚点、毛玻璃工具栏、去边框分层 |
| `30-live-pages-390.png` | **线上实拍**：https://serennity007.github.io/beijing-food-map/ 全套 UI 生效 |

小程序样式完善（2026-09-26）：

| 文件 | 页面 | 看到的关键点 |
| --- | --- | --- |
| `34-miniprogram-index-styled.png` | 小程序首页 | 全局样式落地后：工具栏（搜索+菜系chips+待验证开关）、原生地图、好店卡片列表、tabBar 图标 |
| `35-miniprogram-submit-styled.png` | 小程序投稿页 | 修复样式缺失（app.wxss 未生成）后的表单卡片形态 |
| `36-miniprogram-me-styled.png` | 小程序我的页 | 登录态卡片与 tabBar 选中态 |

小程序功能对齐与 UI 写路径（2026-09-26/27，DevTools 模拟器 ws://127.0.0.1:9420 + 本机 8787 后端 + 全新 SQLite）：

| 文件 | 看到的关键点 |
| --- | --- |
| `37-miniprogram-admin.png` – `44-miniprogram-revise-submitted.png` | 功能对齐轮：后台六分区（待审队列 VF047#v1/MMF047 带操作按钮、地点核验空态、门店状态检索、审计日志）、清单编辑 COL0001 全要素（已公开徽标/3 条目笔记/发布区）、修订页预填与提交回执 VF001#v2 PENDING、A01/U01 入口差异 |
| `45-miniprogram-ui-collection-items.png` | UI 写路径：U01 新建清单「测试·UI写路径验证清单」→ 搜索"酸汤粉"命中平台收录门店 → 加入清单成功 |
| `46-miniprogram-ui-publish-pending.png` | 提交发布回执：发布申请 PUB0005 · PENDING_REVIEW |
| `47-miniprogram-ui-admin-approved.png` | A01 后台待审队列「通过」PUB0005：已处置提示 |
| `48-miniprogram-ui-published.png` | U01 重进清单：徽标已公开 + 生效令牌 tok-… |
| `49-miniprogram-ui-feedback-withdrawn.png` | U01 详情 R01「撤回」（showModal 确认）：已撤回、票数重算、重进后反馈区消失 |
| `50-miniprogram-ui-account-deleted.png` | U05 注销（showModal 确认）：回执 DELJOB…、回到未登录态 |

> 45–50 由 `miniprogram/scripts/verify-write-ui.mjs` 自动拍摄（showModal 经 mockWxMethod 自动确认，业务接口零 mock，18/18 项断言通过，详见 status.md）。

分享只读页与编辑背书 tab（2026-09-27，与 Web `/s/:token` 及后台背书面板对齐）：

| 文件 | 看到的关键点 |
| --- | --- |
| `51-miniprogram-ui-share-snapshot.png` | 清单分享只读页（Web /s/:token 对应）：有效 token 渲染快照全要素（标题/作者/发布时间/条目/笔记/不可变提示） |
| `52-miniprogram-ui-share-entry.png` | 清单编辑页「预览公开页」入口 → 跳转分享页且渲染同一快照 |
| `53-miniprogram-ui-endorsement.png` | 后台编辑背书 tab：检索 R05 → 背书有效徽标/作者/实吃日期/有效期至 |
| `54-miniprogram-ui-endorsement-revoked.png` | 背书核验→填理由撤销→徽标转「背书已撤销」 |

> 51–54 由 `miniprogram/scripts/verify-share-endorse.mjs` 自动拍摄（HTTP 造数 + UI 断言，16/16 项通过，详见 status.md）。

完整对齐与视觉打磨轮（2026-09-27，与 Web /privacy /terms 及地图交互对齐）：

| 文件 | 看到的关键点 |
| --- | --- |
| `55-miniprogram-ui-legal-privacy.png` | 隐私说明页：织带页头点缀 + 衬线标题 + 收集/可见/删除注销三区块 |
| `56-miniprogram-ui-legal-terms.png` | 用户条款页：页内互切后内容规则/推荐规则/免责声明 |
| `57-miniprogram-ui-me-legal.png` | 我的页：隐私说明/用户条款入口 + 全面板（投稿/建店/举报/打卡/清单） |
| `58-miniprogram-ui-index-flyto.png` | 地图页搜索「酸汤」→ 结果带「在地图查看」→ 相机飞至望京门店（callout 显示店名） |
| `59-miniprogram-ui-admin-polish.png` | 内容后台七分区回归（待审队列/地点核验/举报复核/门店状态/合并/编辑背书/审计日志） |

> 55–59 由 `miniprogram/scripts/verify-polish.mjs` 自动拍摄（14/14 项断言通过，详见 status.md）。

设计系统 v2 · 美观大气简约轮（2026-09-27，两端同一设计语言）：

| 文件 | 看到的关键点 |
| --- | --- |
| `60-miniprogram-v2-index.png` – `64-miniprogram-v2-submit.png` | 小程序 v2：令牌化全局样式（去边框白卡/填充式表单/衬线标题/织带点缀）下的 首页/详情/我的/后台/投稿 五页实拍 |
| `65-web-v2-map-390.png` / `66-web-v2-detail-390.png` | Web 精修（圆角 16px/面板留白 20px/按钮加饱满/标题 27px）后 390 宽实拍（浏览器实拍，地图瓦片在内嵌浏览器未加载属环境伪影） |

> 60–64 由 `miniprogram/scripts/shots-v2.mjs` 拍摄；65–66 由浏览器实拍。小程序功能回归 verify-polish 14/14 通过。
