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
