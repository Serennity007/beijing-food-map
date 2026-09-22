# 阻塞项与外部依赖

分三类：**要你提供/授权的**、**上线前必须补的能力**、**本轮刻意留下的缺口**。
账目口径见 [status.md](./status.md)：这里的每一项都是"未 verified"。

## A. 需要你提供凭据或授权（我无法自行完成）

1. **高德 JS API 2.0 Key + 安全密钥**
   填 `VITE_AMAP_KEY` / `VITE_AMAP_SECURITY_CODE`（控制台里把 Key 限定到部署域名）。
   代码侧双适配器已实现并跑过纯函数单测，但**没有在真实地图上渲染过**。没有 Key 时走 MapLibre + 公共瓦片（OpenFreeMap / CARTO）兜底 —— 公共瓦片有配额与商用限制，只适合演示。

2. **托管平台授权**
   `Dockerfile` 与 `render.yaml` 已写好但**未在任何账号上构建或导入**：这台机器没有 Docker，注册/创建服务/绑定域名都是操作你的账号。
   前端仓库的归属已确认：推到 `Serennity007/beijing-food-map`（public）。卡点是本机 `gh` 当前登录的是另一个账号，而你要求"你先登录，我再推"。
   → 需要你在那台机器上执行 `gh auth login`（或 `git credential` 换成目标账号），之后我才能建仓、推 `main`、开 Pages。

3. **真实门店与核验数据源**
   说明书的硬约束是不虚构门店、探店、票数。当前 24 家门店、69 条反馈、9 个账号全是合成种子，店名以「测试·」开头、`is_test_data` 恒为 true，production 配置下引擎直接拒绝装载。
   → 演示之外的一切都要先有经人工核验的门店库。

4. **短信服务凭据**
   `SMS_*` 变量是预留位。当前登录是内测账号 + 固定码 `888888`（只在非 production 生效）。

## B. 上线前必须补的能力（不补就不能算 production）

5. **签名会话**
   demo 把随机 session id 存库，Cookie 不签名，且 `Secure` 只在 `NODE_ENV=production` 才附加 —— 而 demo 又必须是 development。真实上线要接 `SESSION_SECRET` + 签名/带有效期的令牌，并把 Cookie 强制 `Secure`。

6. **真实对象存储**
   图片是内联合成 data URI，`/media/:id` 做鉴权直出，`/uploads/test-photo` 只登记合成图。缺：真实上传的体积/类型校验、EXIF（含 GPS）剥离、缩略图、CDN、恶意内容处理。

7. **持久化架构**
   `node:sqlite` 是单文件单进程：不能水平扩容；免费托管层的临时文件系统会在重新部署后清零（投稿与清单随之丢失）；登录限流是进程内滑动窗口，多实例等于限额乘以实例数。
   → 真实运营换 Postgres + 外部限流（`DATABASE_URL`、`SESSION_SECRET` 已在 `.env.example` 预留）。

8. **注销的异步清除任务**
   `deleteAccount()` 做的是同步处置：撤销会话、撤销本人公开分享、隐藏 UGC、退出计票、写审计；`deletion_job_id` 只是回执，**没有后台任务真的删除或匿名化记录**，账号行停在 `deleting`。隐私页已按实况写明。

## C. 本轮刻意留下的缺口（避免范围漂移）

9. **审核侧举报队列没有接口**
   `POST /reports` 和 `GET /me/reports` 都在，但 `Store` 只有 `createReport`/`myReports`，没有 `GET /admin/reports`，`AdminPage` 也没有对应面板 —— 所以举报目前只能由举报人自己看到。
   设计已定，实现留给下一轮：`Store.reportQueue(sessionId)` 用 `requireRole(['moderator','admin'])` 把关，最新在前、上限 200，条目带门店与被举报反馈摘要；再加路由、OpenAPI 条目（api 的"openapi 覆盖全部路由"测试会强制）、`Http`/`StaticClient` 两个实现和管理台列表。

10. **真机与窄屏验证**
    桌面视口里的三条闭环（地图/投稿/清单/纠错）已在内嵌浏览器实测并通过，见 [status.md](./status.md) 的"浏览器实测看到的"。仍缺的是：窄屏断点下的布局、抽屉在手机上的遮挡与地图 inset、捏合与双指手势、读屏与键盘遍历 —— 内嵌浏览器只有一个固定桌面视口，这些没法在这儿采。
    → 需要你在手机/浏览器里打开一次（Pages 上线后就有地址），或者直接接受"桌面逻辑与界面已验、移动端未验"。

## 明确不做的事

不虚构门店/探店/票数/截图证据；不把真实凭据写进仓库、issue 或文档（`.env.example` 只放占位符）；不在未获授权的情况下部署、付费开通或对真人发送消息；不把 Mock 演示说成 production-ready。
