# RELEASE · 上线路径与清单

**状态口径**：代码侧的"上线形态"已于 2026-09-27 闭合并实测（见 §2）；能否对外上线取决于 §3 的人事项——尤其是**真实核验数据**，没有任何脚本可以替代。

---

## 1. 设计原则（为什么演示数据仍带「测试·」前缀）

硬约束（沿用项目第一天的不变量）：**不虚构**门店、探店、票数、核验证据。合成种子带 `is_test_data=true`、店名「测试·」前缀；`production` 下引擎**拒绝装载**它们。这不是演示脚手架的临时标记，而是"不把 Mock 说成真实"的机制本体：

- 演示水印（页面底部的"合成测试数据"提示、"演示快照"徽标、顶栏 demoBadge）**全部由数据的 `is_test_data` 驱动**——真实核验数据入库后这些标记**自动消失**，不需要改任何界面代码；
- 前端通过 `GET /meta`（部署自描述）判断水印显隐：`env=production && test_data_loaded=false` 即干净上线态。

## 2. 代码侧已闭合（2026-09-27 实测）

| 项 | 状态 |
| --- | --- |
| production 空引擎装配 | `Store({ env:'production', seed:false })` 启动不装种子，随后从 SQLite `loadState` 恢复真实数据；空库即干净初态（地图 0 家，`/meta → {env:'production', test_data_loaded:false}`） |
| 测试种子防漏 | `production` + 种子 → Store 构造抛 RuleViolation、启动失败；`seed-cli` 同样拒绝；演示登录/邀请账号 → 403 |
| 演示水印数据驱动 | Web：顶栏 badge、地图抽屉、详情、分享页（`contains_test_data`）；小程序：首页/详情/我的/修订/投稿页脚、分享页徽标——都只在实际载入 `is_test_data` 数据时出现 |
| DTO 生产可装载 | `is_test_data` 由字面量 `true` 宽化为 `boolean`（Restaurant/MediaAsset/SessionUser/Submission/RestaurantCandidate），真实数据类型可编译 |
| 记录级标记 | 种子写入 `true`；产品流创建（建店候选转正等）按环境判定（demo=true，production=false）；老库缺字段按 true 兜底（保守显示水印） |
| 生产启动护栏 | `SESSION_SECRET`（≥32 字符）缺失直接拒绝启动 |

## 3. 上线前人的清单（按顺序，缺一不可）

1. **真实核验数据供数**（唯一的"内容"来源，走 `database/import/README.md` 的管线）：
   高德开放平台 Key → 搜索 POI 导出 → `npx tsx scripts/import-amap-candidates.mts` 暂存 → 人工核验（门牌/在营/菜系）→ 走产品自身流程：建店候选（`provider:'amap'` + `poi_id`，引擎自动去重）→ 审核员地点核验 → 进图。**绕过核验的批量写入不允许。**
2. **凭据与环境变量**（全都不进仓库，见 `.env.example`）：`SESSION_SECRET`（≥32 字符随机）、高德 Key、短信服务商凭据、对象存储凭据、备案域名。
3. **真实登录**：接入短信服务商（`store.ts` 预留外部供应商适配点；production 已拒绝邀请账号与固定码）。上线后验证码：短时有效、单次使用、限频与费用上限在服务端。
4. **微信小程序发布前置**：企业主体小程序账号、备案 HTTPS 域名（替换 `miniprogram/src/api.ts` 的 `BASE`）、`msgSecCheck` 内容安全接口接入（M2）。
5. **法律文本复核**：隐私说明/用户条款中描述当前部署事实的句子（如"不接入短信服务""图片为服务端合成"）在接入真实能力后**必须同步更新**。
6. **对象存储**：演示用合成图（data-uri）替换为真实上传 + 审核管线。
7. **真机验证**：微信真机 + 读屏走查（模拟器验证已覆盖逻辑层）。
8. **部署**：API 用 `render.yaml` / 自管 Node ≥22.5 + SQLite（或按 repository 层换 Postgres）；Web 静态部署 GitHub Pages（`docs/runbooks/deploy-pages.md`）或同域托管。
9. **N1 规则拍板**（decisions.md D21）：核验清票规则待人拍板，属产品决策。

## 4. 上线态自检（部署后跑一遍）

```bash
curl -s https://<api>/api/v1/meta
# 期望：{"env":"production","test_data_loaded":false} —— 任何 true 都说明测试数据混入了生产库
curl -s -X POST https://<api>/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"user_id":"U01","code":"888888"}' -o /dev/null -w '%{http_code}'
# 期望：403（演示登录在生产被拒绝）
```

页面上：地图/详情/分享/我的**不出现**任何"演示/测试/合成"字样；出现即说明库里有 `is_test_data` 数据，按 §3.1 流程清理。
