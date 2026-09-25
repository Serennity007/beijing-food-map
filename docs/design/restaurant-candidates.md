# 设计说明：新门店候选与地点核验

状态：**已实现并本机验证**（2026-09-24）。口径见 [status.md](../status.md)：contracts 92 / api 29 / web 14 = 135 项测试 0 失败，契约自检 61 项，两种模式浏览器实测闭环走通。
本文里"待验证图层只显示 PENDING"与"作者不能自审建店申请"两条已落地为决策 D17/D18。
实现过程中发现、但**没有单方面改**的问题集中在 [NEXT.md](../NEXT.md)，其中 N1（核验翻转会把已有社区票清零）与本流程直接相关。

## 1. 为什么要做

`SubmitPage.tsx` 头部原本写着"第三方地点候选没有建店能力，所以不提供提交入口"。结果是：
用户发现一家未收录的店，只能等人工把它塞进种子数据（blockers A3），贡献链路是断的。

规格本来就要求这条链路，不是新增范围：

| 规格条款 | 要求 |
| --- | --- |
| 说明书 §"搜索与建店"（MASTER_SPEC:80） | 供应商候选选中后**只进入建店流程** |
| MASTER_SPEC:249 | `POST /restaurant-candidates`：手动点或获授权地点引用；返回候选 ID/重复提示，**未自动推荐** |
| MASTER_SPEC:115 | 地点核验三态 `PENDING / VERIFIED / REJECTED` |
| MASTER_SPEC:228 | 去重先 provider+poi_id，再用名称/地址/距离**提出人工合并候选**；近距离不自动合并 |
| ACCEPTANCE:54（SUB-02） | 新店手动点→投稿→内容过审，但地点未核验：投稿状态真实、不进默认好店图、**作者可见进度与待核验原因** |
| ACCEPTANCE:9 | 模拟坐标只用于受控测试，不当作真实餐馆发布 |

## 2. 实体：候选独立于反馈

`RestaurantCandidate` 是新实体，**不塞进反馈版本（`Visit`/`Revision`）里**。理由：投稿是用餐内容，
建店是地点实体（产品规划 §"数据模型" 明令不能"一次上传就新增一家店"），两者的审核人、状态机、
计票影响都不同。

一条候选对应一家由它创建的门店记录：

```
候选 PENDING ──审核通过──> VERIFIED（门店 place_status=VERIFIED）
      ├──审核驳回──> REJECTED（门店 place_status=REJECTED，退出两个图层）
      │        └──作者补材料──> PENDING（revision+1，回到待核验）
      └──并入已有门店──> MERGED（走门店合并：反馈迁移、旧 ID 永久重定向）
```

候选**创建的同时**就落一条门店记录，`place_status='PENDING'`、`business_status='UNKNOWN'`、
`risk_status='CLEAR'`、`profile_public=true`。这样 SUB-02 的"投稿真实、地点未核验"才成立 ——
作者能立刻对这家店投稿，而默认层谓词（`rules.ts` 的 `evaluatePublicMapEligibility`）**一个字都不改**
就能把它挡在外面。不新增第二套资格判断是刻意的。

## 3. 新建/改动的规则（全部在 `packages/contracts`）

1. **候选不会自动变推荐**。建店只给 `PENDING` 地点，进默认层仍要过原有全部条件（含社区 3 票或编辑背书）。
   测试要钉住"核验通过但仍不达标"这条。
2. **待验证图层只显示 `PENDING`**：`visibleFor` 从 `place_status !== 'VERIFIED'` 收紧成
   `place_status === 'PENDING'`。被驳回的门店不该继续以"待验证"的名义出现在公开地图上。
   种子里没有 REJECTED 门店，所以这条不影响既有断言。
3. **重复提交不产生重复门店**：同一作者、名称规范化后相同、分店相同、距离 ≤ 150 m 的候选，
   状态还是 `PENDING` → 直接返回已有那条，不新建门店；已是 `REJECTED` → 400 并指明去补材料。
4. **重复提示不自动合并**：命中已有门店时只返回 `duplicates`（原因 + 近似直线距离），
   审核员据此选"并入已有门店"。同名但距离远只提示"可能是不同分店"，绝不自动合并。
5. **作者不能自审自己的建店申请**，即使他同时是 moderator/admin —— 与既有第 6 条不变量同源。
   `decideCandidate` 与 `patchRestaurantStatus`（针对候选来源的门店）两处都把关。
6. **驳回理由必须回传给作者**：详情页 `verification_note`、投稿回执 `pending_verify_reason`
   和"我的"页都要显示，且驳回后不复活（`REJECTED → PENDING` 只能由作者补材料触发，
   补材料会把门店地点状态打回 `PENDING` 并递增 `location_version`）。
7. **无地图 Key 也要走得通**：手动选点提交 GCJ-02 坐标；内置的 demo-provider 候选补上
   **明确标注为合成**的坐标与 `coord_note`，选中即预填。真实第三方 POI 检索是接入位，不伪造结果。

## 4. 接口（5 条，两种模式同名同义）

```
POST  /restaurant-candidates                  登录用户建候选，201，支持 Idempotency-Key
GET    /me/restaurant-candidates              作者看进度
POST  /restaurant-candidates/:id/materials    作者对被驳回的候选补材料（乐观锁）
GET    /admin/candidates                       审核员的地点核验队列
POST  /admin/candidates/:id/actions            verify | reject | merge（乐观锁 + 作者自审 403）
```

## 5. 刻意不做

- 不给候选做审核内容之外的第二套资格判断；不碰计票、窗口、分享、隐私边界。
- 不在种子数据里加候选（种子基线计数与多处测试绑定，加了要改的账太多且不必要）。
- 不做真实 POI 检索、不做自动合并、不做"提交即建店即上线"。
- 地点核验的**独立工单状态流转**不与举报工单混用；举报闭环仍是下一阶段（1B）。

## 6. 连带清单（本层要一起改的位置）

`enums.ts`（状态/来源/重复原因 + 中文标签）→ `dto.ts`（`RestaurantCandidate`/`CandidateDuplicate`/
`ProviderCandidate`）→ `rules.ts`（名称规范化、候选状态机表）→ `store.ts`（`candidates` 集合、
5 个方法、`visibleFor`、`patchRestaurantStatus` 自审把关、`dumpState`/`loadState`）→
`apps/api`（`handlers.ts` 路由表、`openapi.ts` 条目、`body.ts` 校验、`repository.ts` 的
`ENTITY_KINDS` 与重组分支）→ `apps/web`（`client.ts` 接口 + `StaticClient`、`http.ts`、
`SubmitPage`、`MePage`、`AdminPage`）→ `scripts/http-contract-check.mts` 断言 → 测试与文档。
