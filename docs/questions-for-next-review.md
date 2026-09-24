# 本轮没定下来 / 自评做得不够好的问题（阶段 1A · 2026-09-24）

给下一个 AI（GPT）看。请**逐条**回答，能给结论就给结论，需要我补信息就点名要哪个文件。
项目：京城黔味地图（北京贵州菜地图，可运行演示版）。本轮做的是"新门店提交与地点核验"（原规划里的阶段 1A）。

读之前需要的三条硬约束（来自原始说明书与仓库交接文档）：

1. 业务规则只在 `packages/contracts` 的 `Store` 里实现一次，页面不得重算；静态模式（浏览器内引擎 + localStorage）与 HTTP 模式（后端）必须行为一致。
2. 不许虚构门店 / 探店 / 票数 / 核验证据；所有数据带 `is_test_data=true`；`production` 下引擎拒绝装载测试种子。
3. 不许回退的业务不变量见 `docs/handover.md` §3（计票 `R≥3 且 4R≥3T`、180 个上海自然日、分享快照不可变、作者不能自审、私有内容判定在服务端、GCJ-02 只在渲染边界转换等）。

本轮改完的门禁状态（这台机器实测，Windows + Node 24.18.0）：typecheck 3 个 workspace 全绿；测试 **125 项 0 失败**（contracts 82 / api 29 / web 14）；HTTP 契约自检 **47 项**；`npm run build` 退出码 0；两种模式的建店闭环都在桌面视口实测过。

---

## Q1 【最高优先，影响正确性】核验状态翻转会不会把已有社区票清零？

**现状**：`Store.patchRestaurantStatus()`（`packages/contracts/src/store.ts:1730`）只要 `place_status` 变了就 `location_version += 1`。而计票 `tallyCommunity()` 用 `location_version === 当前版本` 过滤，所以**递增等于把该门店此前所有已批准反馈移出计票**。

**实测到的后果**（我把它钉成了特征测试，`packages/contracts/test/candidates.test.ts` 里那条 `特征锁定（存疑）`）：

```
R07（种子里地点 PENDING、3 推荐 0 一般 0 不推荐、community=QUALIFIED）
  → 审核员执行 place_status=VERIFIED
  → location_version 1 → 2
  → tally 变 0/0/0，community 变 LAPSED，仍不在默认好店层
```

也就是说"审核员给一家店核验通过"这个动作，反而让这家店**离上榜更远**，要重新攒 3 票。

**为什么我犹豫**：原始说明书只在**搬迁**处写了"递增 location_version 并将地点强制设为 PENDING"（MASTER_SPEC:230、验收项 REC-09）。核验状态翻转不是搬迁。但既有测试 `apps/api/test/api.test.ts:317` 明确断言"变更核验状态要递增 location_version"，说明这是上一轮刻意定下的行为，我判断它可能是有意的（"重新核验等于重新取证"），不敢单方面改，所以只加了特征测试把它钉住 + 写这条问题。

**请回答**：
- (a) 现状正确，核验翻转就该作废旧票 → 那我要不要在门店页/后台把这个后果**明说**给审核员（现在完全看不出来）？
- (b) 现状错误，只有坐标真的变了才递增 → 那 `patchRestaurantStatus` 该怎么拿到"坐标变了"这个信号（它现在根本不接收坐标）？是不是应该把"改坐标"从"改状态"里拆成独立接口？
- (c) 中间态：`PENDING→VERIFIED` 不递增，`VERIFIED→PENDING/REJECTED`（重新取证）才递增？
- 顺带：`ever_qualified` 让掉票后显示 `LAPSED`（"已失效（近期口碑变化）"），但真实原因其实是"审核动作把票归档了"，这个措辞会不会误导用户？

---

## Q2 【产品与安全边界】建店申请要不要在提交时就真的落一家门店？

**我选的方案**：`POST /restaurant-candidates` 在创建候选记录的**同时**新建一条 `place_status=PENDING`、`profile_public=true`、`business_status=UNKNOWN`、`risk_status=CLEAR` 的门店，并返回两个 ID。

**理由**：验收项 SUB-02 要求"新店手动点 → 投稿 → 内容过审，但地点未核验"，投稿必须挂在一个真实存在的门店 ID 上；而默认好店层的谓词（`rules.ts:evaluatePublicMapEligibility`）本来就要求 `place_status === 'VERIFIED'`，所以不改一行谓词就能把它挡在外面。规格也允许"待验证"作为显式开启的独立图层存在。

**我担心的**：
1. 未审核内容进了**公开可读**的待验证图层（空心标记 + "不代表平台推荐"）。任何登录用户都能往公开地图上放一个点位，审核前它就在图上。这是不是太宽？
2. 垃圾/恶意的量级：没有频控（只有"同作者同名同址复用候选"这一条），一个人换名字就能刷出很多条。
3. 备选方案是"候选审核通过后才建店"，但那样 SUB-02 的投稿时机要重新设计，而且候选队列里看不到门店详情。

**请回答**：现在这个取舍可以接受吗？如果不行，最小改法是什么（例如：新候选默认 `profile_public=false`，只有审核员"受理"后才进待验证图层；或者给建店申请加每账号每日上限——但那是新增规则，说明书没要求，我不确定算不算范围漂移）。

---

## Q3 【我拍脑袋拍的数】重复判定的口径

`packages/contracts/src/rules.ts:230,247,283`：

- 半径 `CANDIDATE_DUP_RADIUS_M = 150` 米，用 `straightLineMeters`（近似直线距离）；
- 名称匹配 = `normalizeStoreName()`：trim + 小写 + 全角括号转半角 + 删空白与 `·・．.-—`；
- 分店必须完全一致才算"可能同一家"，否则只提示"同名但远，可能是不同分店"；
- provider+poi_id 精确匹配这条**只对候选之间生效**：自有门店记录里没有 `provider`/`poi_id` 字段（种子全是运营/合成来源），我没有给 `RestaurantRec` 加这两个恒为 null 的字段。

**请回答**：
1. 150 m 对北京商场店合适吗（同商场不同楼层可能 >150 m；同一条街两家不同分店可能 <150 m）？要不要按"同一 address 归一化后相同"提权？
2. 要不要给门店加 `provider`/`poi_id`？加了现在没有数据，是死字段；不加则规格里"先按 provider+poi_id 去重"这条永远不成立。
3. 名称匹配要不要做包含关系（"凯里酸汤鱼"vs"凯里酸汤鱼(望京店)"）或拼音/别名表（仓库里已有一张 `ALIASES` 用于菜品搜索）？

---

## Q4 【一致性瑕疵】补材料时 location_version 的递增不对称

`resubmitCandidateMaterials()`（`store.ts:2066`）里我写成：**只有坐标真的变了**才递增 `location_version`；而"状态从 REJECTED 回到 PENDING"不递增。但**驳回那一步**走 `patchRestaurantStatus`，按 Q1 的现状会递增一次。

结果：一次"驳回 → 补材料（不动坐标）"会让 location_version 从 1 变 2，尽管门店坐标一动没动。测试里我如实断言了这个数（`candidates.test.ts:176` 期望 2）。

**请回答**：这是 Q1 的子问题吗？如果 Q1 选 (b)/(c)，这里是否自动一致？还是补材料应该显式"回到原地点版本"？

---

## Q5 【没决定的边界】提交人注销之后，他建的店和待核验候选怎么办？

现状（我实测过）：注销的清除任务会删掉投稿/图片/清单/分享快照，把显示名改成"已注销用户"，但**候选记录保留**、它创建的门店也保留，队列里显示"提交人 已注销用户"。

我的判断：门店是地点实体（不该因为一个人注销就消失），候选是审核线索（保留才能复核），显示名是从 users 表派生的所以自动去标识。

**请回答**：待核验的候选留在审核队列里、但永远等不到提交人来补材料了 —— 该自动标成 REJECTED（理由"提交人已注销"）？还是保留给审核员手动处置？隐私页现在的措辞是"去标识的账号 ID、举报状态与审计记录会保留"，**没提建店申请**，要不要补一句（法务文案必须跟实现一致，这是本仓库的硬规矩，见 decisions D11）。

---

## Q6 【设计味道不好】幂等重放返回的是旧快照

`Store.idempotent()` 缓存的是**当时的响应对象**。所以同一个 `Idempotency-Key` 重放 `createCandidate`，返回的 `version` 是第一次的值；如果这一轮里候选已被审核（version 变过），紧接着用返回的 version 去 `decideCandidate` 必然 409。

我在契约自检里就撞上过一次（同一库跑第二遍直接 409 中断）。当前处理：不改引擎，只在文档里写"每轮验证换一个新 SQLite 文件"。

**请回答**：重放应该返回"缓存的原始响应"（幂等语义的教科书定义）还是"该资源的当前状态"？如果要前者，是否该在响应里带一个 `idempotent_replay: true` 标记，让调用方知道 version 可能过期？

---

## Q7 【自评做得不好】三处 UI/交互我不满意

1. **坐标靠手填**。表单里写明了"当前部署没有地图选点，也没有真实供应商地点检索（缺高德 Key）"，但"手动选点"本来是产品流程里的一个动词，现在退化成两个 number 输入框。有高德 Key 之后应该改成在地图上点。这块要不要现在就接 MapLibre 的点击选点（公共瓦片可用，不需要 Key）而不是等高德？
2. **后台"并入已有门店"是一个手填门店 ID 的文本框**。仓库里其实已经有 `StorePicker` 组件（`AdminPage.tsx:318`，门店状态面板在用），我没复用 —— 因为并入还需要"从重复提示里点选"，两套选择逻辑叠在一个组件上要改它的接口。这是偷懒，还是合理的最小改动？
3. **建店表单是一整块长表单**（8 个字段 + 坐标 + 来源说明），没有分步、没有预览、错误全部内联。窄屏与软键盘顶起完全没验。

**请回答**：按"演示版可接受、生产要重做"的标准，这三条哪条必须现在补？

---

## Q8 【小】合同版本从 2.0-demo-1 升到 2.0-demo-2 的连带影响

`mapItems` 的 `query_key` 里含合同版本，所以旧快照会 409 `QUERY_EXPIRED`（正确行为）；静态模式 localStorage 里的旧快照没有 `candidates` 键，`loadState` 用 `?? []` 兜住了（实测刷新后正常）。

**请回答**：要不要在 UI 上把 `QUERY_EXPIRED` / 合同版本变化翻译成"页面数据版本已更新，请刷新"，还是保持现在这样（错误文案"查询快照已过期，请重新拉取地图与列表"对普通用户不可理解）？

---

## Q9 【依赖告警，需要授权】npm audit 有 2 个 critical

```
maplibre-gl  <=6.4.0   critical  XSS Sanitizer Bypass in DOM.sanitize()  GHSA-jrc7-96c5-q579
@vitest/mocker  2.1.0-4.1.10  moderate  Path Traversal / Arbitrary File Read  GHSA-82fw-gwwq-j7x9
```

升级 maplibre-gl 是 breaking change（`npm audit fix --force` 会装 6.11.1），属于"降级/升级依赖 = 需确认"的动作，我没动。

**请回答**：下一轮要不要单独开一个 PR 只做依赖升级 + 回归？地图弹窗/标记的 HTML 是我们自己拼的（`maplibre-adapter.ts`），如果要升级我需要先审一遍哪里把用户可控字符串送进了 popup 的 HTML。

---

## Q10 【下一步顺序】两个候选方向，哪个先？

- **A：阶段 1B 举报工单闭环**（原规划的第 2 优先级，做法与本轮 1A 同构，我可以独立做完）。
- **B：地图选点 + 真实供应商 POI 接入位**（依赖高德 Key，但 MapLibre 点击选点不需要 Key，可以先做）。
- 另有两件仓库外的事：`origin` remote 现在指向源机器的失效本地路径（`D:/桌面/...`），而这台机器的 `gh` **已经登录到目标账号 Serennity007** —— 也就是说推送 GitHub 的技术卡点解除了，只差用户同意。

**请回答**：A 还是 B 先？以及"推送 GitHub"这件事，按本仓库的规矩（破坏性/共享状态动作先问）我该准备到什么程度（列步骤但不执行）？

---

## 附：本轮实际改动清单（便于你核对上面的描述）

**新增**：`packages/contracts/test/candidates.test.ts`（21 项）、`apps/web/src/features/candidates/CandidateForm.tsx`、`docs/design/restaurant-candidates.md`、本文件。
**改动**：`enums.ts`（候选状态/来源/重复原因 + 中文标签、`PLACE_STATUS_LABEL`、合同版本）、`dto.ts`（`RestaurantCandidate`/`CandidateDuplicate`/`ProviderCandidate`/`SearchResult`）、`rules.ts`（名称规范化、候选状态机、`matchDuplicates`）、`store.ts`（`candidates` 集合、5 个方法、`visibleFor` 收紧、`patchRestaurantStatus` 自审把关、`dumpState`/`loadState`）、`handlers.ts` + `openapi.ts` + `repository.ts`（5 条路由 + schema + 新 documents kind）、`client.ts`/`http.ts`（两个客户端各 5 个方法）、`SubmitPage.tsx`/`MePage.tsx`/`AdminPage.tsx`（建店入口、进度与补材料、地点核验队列）、`scripts/http-contract-check.mts`（+18 项）、`README.md`/`status.md`/`blockers.md`/`decisions.md`/`handover.md`。
**实测抓到并当场修掉的 2 个缺陷**：`/me` 候选卡片把枚举原样输出成 `门店地点：VERIFIED`（改用 `PLACE_STATUS_LABEL`）；投稿页建店错误提示的渲染条件写成"表单已关闭"，导致表单开着时 401/409/非字段错误全都看不见。
