# Runbook：接入高德 JS API（展示与路线，不落库）

2026-09-30 选定的真实底图路径：**高德 JSAPI 只做展示与路线，检索结果当场展示、不写入数据库**（高德开放平台条款禁止把结果存储/复制进自己的库；能读取不等于允许永久保存）。地图选点、导航深链、底图渲染走高德；门店数据仍来自本应用自有的种子/用户 UGC 与人工核验管线。

代码侧已全部就绪（`amap-adapter.ts`）：`VITE_AMAP_KEY` 缺失时自动回退开源底图并提示，不会白屏；`VITE_AMAP_SECURITY_CODE` 在 JSAPI 加载前挂 `window._AMapSecurityConfig`。

## 一次性申请（需要账号持有人操作）

1. 打开 [高德开放平台](https://console.amap.com/) 注册/登录，完成**个人开发者实名认证**（支付宝授权即可，免费；认证后有 JSAPI 免费日配额，演示绰绰有余，以控制台显示为准）。
2. 控制台 → **应用管理 → 我的应用 → 创建新应用**（名称随意，如「京城黔味地图」）。
3. 在该应用下 **添加 Key**：
   - 服务平台务必选 **「Web端(JS API)」**（选错类型线上会报 `USERKEY_PLAT_NOMATCH`）；
   - **域名白名单**填 `serennity007.github.io`（只能填域名，不带 `https://` 与路径）。将来绑自定义域名后要回来加一行。
   - 注意（2026-10-05 实测）：控制台**不接受** `localhost`、`127.0.0.1` 这类地址（报「不符合规范的域名」），本地调试不用也不必加白名单——白名单生效后，本机打开页面时高德域名校验不过，`amap-adapter` 会捕获加载失败并自动回退开源底图，本地演示不受影响；高德底图以线上 `serennity007.github.io` 验证为准。
4. 提交后得到两个值：**Key** 和与之配对的 **安全密钥（jscode）**。两个字段必须成对使用。

## 接线与发布

```bash
# 1) 复制示例为 .env.local（已被 .gitignore 忽略，Key 永不进仓库），填入两个真实值
cp apps/web/.env.local.example apps/web/.env.local

# 2) 一键构建 + 校验 + 推 gh-pages（Node 脚本，天然避开 Git Bash 的 MSYS 路径坑）
node scripts/deploy-pages.mjs

# 3) 线上验证（等 Pages 构建 built 后，CDN 可能要强刷）
#    打开 https://serennity007.github.io/beijing-food-map/ → 右上「高德底图」
#    期望：底图切换为高德渲染，控制台无 INVALID_USER_SCODE / INVALID_USER_DOMAIN
```

## 常见报错对照

| 控制台报错 | 原因 |
| --- | --- |
| `INVALID_USER_SCODE` | 安全密钥没配对/没挂上（检查 `.env.local` 两个值是否来自同一个 Key） |
| `USERKEY_PLAT_NOMATCH` | Key 的服务平台类型选错了，必须是「Web端(JS API)」 |
| 加载即失败 / 域名校验不通过 | 域名白名单没含 `serennity007.github.io`，回控制台补 |

## 坐标逐店核验（Key 到位后的既定动作，2026-10-05 起执行）

**合规口径**：在公开地图上人工确认各店地址对应的地标/街区，记录我们自己的核验结论；
**不把高德检索/POI 结果写入数据库**。核验通过才转 `place_status: VERIFIED`（seed-real 的 `rr()` extra 写
`{ place_status: 'VERIFIED', place_verified_days_ago: 1 }`，note 追加核验依据与日期）。

流程（在**真实网络的浏览器**上，本沙盒曾封锁 `ags.wsd.autonavi.com` 导致瓦片全空，见 blockers）：

1. 打开线上 `/map`，切「高德底图」；按片区设置相机（ localStorage `qianwei.mapviewport` +
   `qianwei.mapfilters.v3` 写入 bounds/view 后刷新即可复位到片区），7 片可覆盖全部 35 家：
   ①贵州视图 三里屯/朝阳门（R50 R55 R56 R61 R67）②东部（R53 R62 R65）③北部（R51 R52 R68）
   ④清河/双榆树（R63 R64）⑤西南视图 全片（R57 R69–R72 R75 R76 R80 R81 R83 R84）
   ⑥南城/亦庄（R54 R74）⑦北京其他视图（R58 R59 R60 R77 R78 R79）。
2. 每片截图对照公开地址：针落在正确街区/商场 → 核验通过；错位 → 按人工判断修 seed 坐标；
   商圈级/地址两源冲突的（R66 渔乡寨、R67 黔苗、R68 醉美遵义）保持 PENDING，不硬转。
3. 翻转后跑门禁 → `node scripts/deploy-pages.mjs` → 线上确认右上角徽标数字递减，
   「新收录·待核验」层只剩如实保留的几家；全部核验后徽标自动变「预览版 · 公开资料整理」。

2026-10-05 进度：**R63 已核验**（和盈中心=小营西路×毛纺路口东 120 米，坐标由此修正约 700 米），
其余 34 家待核验。

## 安全模型与合规边界（写给自己看）

- JSAPI 的 Key 与安全密钥都会出现在**公开的前端产物**里——这是高德 JSAPI 自身的设计，防滥用靠**域名白名单**（Key 只在白名单域名下可用）而不是保密。所以白名单必须配，且不要把同一个 Key 给别的域名用。
- 用途限定「展示与路线」：地理编码/逆地理、路线规划、底图渲染的结果只在页面上当场展示；**不把检索结果、POI 数据写入数据库或导出**。门店数据只能来自自有种子、用户 UGC 与人工核验（见 `database/import/README.md`）。
- 回退：任何时候删掉 `apps/web/.env.local` 再跑一次发布脚本，即回到开源底图，线上不会坏。
