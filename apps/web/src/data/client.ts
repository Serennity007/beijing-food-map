import {
  CONTRACT_VERSION,
  Store,
  type Bounds,
  type CandidateFacts,
  type CandidateStatus,
  type Collection,
  type Disclosure,
  type FeedbackAttitude,
  type Layer,
  type MapClusterItem,
  type MapItemsResponse,
  type MapView,
  type PlaceVerificationStatus,
  type BusinessStatus,
  type RiskStatus,
  type ModerationQueueEntry,
  type Page,
  type ProviderCandidate,
  type ReportTicket,
  type ReportQueueEntry,
  type DiningLog,
  type DiningLogPage,
  type DeploymentMeta,
  type ReportStatus,
  type Restaurant,
  type RestaurantCandidate,
  type RestaurantDetail,
  type SessionUser,
  type SharedCollectionSnapshot,
  type Submission,
  type SystemCollectionKind,
  type AuditRec,
} from '@qianwei/contracts';

/**
 * 数据边界。静态部署（GitHub Pages）用浏览器内 Store + localStorage；
 * 有后端时用同一套方法名的 HTTP 实现。页面层不知道自己是哪一种。
 */

export interface MapQueryInput {
  bounds: Bounds;
  zoom: number;
  view: MapView;
  budget_max: number | null;
  include_unknown_budget: boolean;
  dish_or_tag: string | null;
  layer: Layer;
}

export interface SearchResult {
  own: Restaurant[];
  provider_candidates: ProviderCandidate[];
}

/** 建店申请：创建时全量提供，补材料时只给要改的字段。 */
export interface CandidateCreateInput extends CandidateFacts {
  idempotency_key?: string;
}

export interface CandidateDecision {
  id: string;
  action: 'verify' | 'reject' | 'merge';
  reason?: string;
  target_restaurant_id?: string;
  expected_version: number;
}

export interface SubmitInput {
  restaurant_id: string;
  visited_date: string;
  attitude: FeedbackAttitude;
  dish_names: string[];
  reason: string;
  media_ids: string[];
  disclosure: Disclosure | null;
  idempotency_key?: string;
  require_media_for_recommend?: boolean;
}

export interface PatchStatusInput {
  id: string;
  place_status?: PlaceVerificationStatus;
  business_status?: BusinessStatus;
  risk_status?: RiskStatus;
  reason?: string;
}

export interface ReportDecision {
  id: string;
  action: 'start' | 'resolve' | 'dismiss';
  reason?: string;
  expected_version: number;
}

export interface ReportInput {
  restaurant_id: string;
  kind: ReportTicket['kind'];
  detail: string;
  feedback_target?: string | null;
}

export interface ApiClient {
  readonly mode: 'static' | 'http';
  /** 部署自描述：环境与测试数据装载状态（决定演示水印显隐）。 */
  meta(): Promise<DeploymentMeta>;
  mapItems(q: MapQueryInput, snapshotId?: string | null): Promise<MapItemsResponse>;
  listRestaurants(q: MapQueryInput, snapshotId: string | null, cursor: string | null, limit: number): Promise<Page<Restaurant>>;
  search(q: string): Promise<SearchResult>;
  detail(id: string): Promise<RestaurantDetail>;
  /** 图片一律经服务端权限检查后给出可显示地址；不暴露未审核对象直链。 */
  mediaUrls(ids: string[]): Promise<Record<string, string>>;
  uploadTestPhoto(restaurantId: string | null): Promise<string>;
  login(userId: string, code: string): Promise<SessionUser>;
  logout(): Promise<void>;
  me(): Promise<SessionUser | null>;
  submit(input: SubmitInput): Promise<Submission>;
  mySubmissions(): Promise<Submission[]>;
  withdrawFeedback(restaurantId: string): Promise<void>;
  /** 新门店候选（阶段 1A）：建店只得到"地点待核验"，不自动进好店层。 */
  createCandidate(input: CandidateCreateInput): Promise<RestaurantCandidate>;
  myCandidates(): Promise<RestaurantCandidate[]>;
  resubmitCandidate(id: string, patch: Partial<CandidateFacts>, expectedVersion: number): Promise<RestaurantCandidate>;
  candidateQueue(status?: CandidateStatus | null): Promise<RestaurantCandidate[]>;
  decideCandidate(input: CandidateDecision): Promise<RestaurantCandidate>;
  collections(): Promise<Collection[]>;
  createCollection(title: string, description: string | null): Promise<Collection>;
  updateCollection(collectionId: string, patch: { title?: string; description?: string | null }): Promise<Collection>;
  toggleSystemItem(restaurantId: string, kind: SystemCollectionKind, on: boolean): Promise<Collection[]>;
  updateCollectionItem(collectionId: string, restaurantId: string, patch: { note?: string | null; note_shareable?: boolean; remove?: boolean; position?: number }): Promise<Collection>;
  deleteCollection(collectionId: string): Promise<void>;
  requestPublication(collectionId: string, shareItemIds: string[]): Promise<{ id: string; status: string; generation: number }>;
  unpublish(collectionId: string): Promise<Collection>;
  sharedSnapshot(token: string): Promise<SharedCollectionSnapshot>;
  createReport(input: ReportInput): Promise<ReportTicket>;
  reportQueue(status?: ReportStatus | null): Promise<ReportQueueEntry[]>;
  /** 工单处置：开始复核 / 结案 / 驳回。举报人本人不能处置自己的举报。 */
  decideReport(input: ReportDecision): Promise<ReportQueueEntry>;
  myReports(): Promise<ReportTicket[]>;
  createDiningLog(input: { restaurant_id: string; visited_date: string; amount_yuan?: number | null; note?: string | null }): Promise<DiningLog>;
  myDiningLogs(): Promise<DiningLogPage>;
  deleteDiningLog(id: string): Promise<{ ok: true }>;
  auditLog(): Promise<AuditRec[]>;
  moderationQueue(): Promise<ModerationQueueEntry[]>;
  moderate(input: { target: string; action: 'approve' | 'reject' | 'hide'; reason?: string; expected_version: number }): Promise<{ ok: true; restaurant: Restaurant | null }>;
  patchRestaurantStatus(input: PatchStatusInput): Promise<Restaurant>;
  mergeRestaurants(input: { source_id: string; target_id: string; reason: string; expected_version: number }): Promise<{ canonical: string }>;
  revokeOrVerifyEndorsement(input: { restaurant_id: string; action: 'verify' | 'revoke'; reason?: string }): Promise<Restaurant>;
  deleteAccount(): Promise<{ deletion_job_id: string }>;
  today(): Promise<string>;
}

export class ClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

const LS_SESSION = 'qianwei.session';
const LS_STATE = 'qianwei.state';
export const LS_DRAFT_PREFIX = 'qianwei.draft.';

/** 投稿草稿是账号内容，只存在这台浏览器里；注销时随账号数据一起清掉。 */
export function clearLocalDraft(userId: string): void {
  try {
    localStorage.removeItem(`${LS_DRAFT_PREFIX}${userId}`);
  } catch {
    /* 隐私模式下 localStorage 不可写 */
  }
}

/** 静态部署：浏览器内跑同一份领域引擎，状态存 localStorage。 */
export class StaticClient implements ApiClient {
  readonly mode = 'static' as const;
  private store: Store;
  private session: string | null;

  constructor() {
    this.store = new Store({ env: 'demo_static' });
    const saved = safeGet(LS_STATE);
    if (saved) {
      try {
        this.store.loadState(saved);
      } catch {
        safeRemove(LS_STATE);
      }
    }
    if (this.store.processDeletionJobs()) this.persist();
    this.session = safeGet(LS_SESSION);
    if (this.session && !this.store.sessions.has(this.session)) this.session = null;
  }

  private persist(): void {
    try {
      localStorage.setItem(LS_STATE, this.store.dumpState());
    } catch {
      /* 配额超限时保持内存可用，不静默改数据 */
    }
  }

  private sid(): string | null {
    return this.session;
  }

  async mapItems(q: MapQueryInput, snapshotId?: string | null): Promise<MapItemsResponse> {
    return this.store.mapItems({ ...q, contract_version: CONTRACT_VERSION }, snapshotId ?? null);
  }

  async meta(): Promise<DeploymentMeta> {
    return this.store.deploymentMeta();
  }

  async listRestaurants(q: MapQueryInput, snapshotId: string | null, cursor: string | null, limit: number) {
    return this.store.listRestaurants({ ...q, contract_version: CONTRACT_VERSION }, snapshotId, cursor, limit);
  }

  async search(q: string) {
    return this.store.search(q);
  }

  async detail(id: string) {
    return this.store.detail(id, this.sid());
  }

  async mediaUrls(ids: string[]) {
    const out: Record<string, string> = {};
    for (const id of ids) {
      const m = this.store.mediaOf(id);
      if (!m) continue;
      // 未经审核的图片只有作者与审核人员可见（与 /media/:id 同一条规则）
      if (this.store.canViewMedia(this.session, id)) out[id] = m.url;
    }
    return out;
  }

  async uploadTestPhoto(restaurantId: string | null) {
    const m = this.store.addTestMedia(this.sid(), restaurantId);
    this.persist();
    return m.id;
  }

  async login(userId: string, code: string) {
    const r = this.store.login(userId, code);
    this.session = r.session_id;
    // 会话活在内核的 sessions 里，不落快照的话刷新页面就会连会话一起丢掉
    this.persist();
    localStorage.setItem(LS_SESSION, r.session_id);
    return r.user;
  }

  async logout() {
    if (this.session) this.store.sessions.delete(this.session);
    this.session = null;
    this.persist();
    localStorage.removeItem(LS_SESSION);
  }

  async me() {
    if (!this.session) return null;
    try {
      return this.store.sessionUser(this.store.requireUser(this.session).id);
    } catch {
      this.session = null;
      localStorage.removeItem(LS_SESSION);
      return null;
    }
  }

  async submit(input: SubmitInput) {
    const r = this.store.submitFeedback(input, this.sid());
    this.persist();
    return r.submission;
  }

  async mySubmissions() {
    return this.store.mySubmissions(this.sid());
  }

  async withdrawFeedback(restaurantId: string) {
    this.store.withdrawMyFeedback(restaurantId, this.sid());
    this.persist();
  }

  async createCandidate(input: CandidateCreateInput) {
    const r = this.store.createCandidate(input, this.sid());
    this.persist();
    return r;
  }

  async myCandidates() {
    return this.store.myCandidates(this.sid());
  }

  async resubmitCandidate(id: string, patch: Partial<CandidateFacts>, expectedVersion: number) {
    const r = this.store.resubmitCandidateMaterials({ id, patch, expected_version: expectedVersion }, this.sid());
    this.persist();
    return r;
  }

  async candidateQueue(status?: CandidateStatus | null) {
    return this.store.candidateQueue(this.sid(), status ?? null);
  }

  async decideCandidate(input: CandidateDecision) {
    const r = this.store.decideCandidate(input, this.sid());
    this.persist();
    return r;
  }

  async collections() {
    const u = this.store.requireUser(this.sid());
    return this.store.listCollectionsForUser(u.id);
  }

  async createCollection(title: string, description: string | null) {
    const u = this.store.requireUser(this.sid());
    const c = this.store.createCollection(u.id, title, description);
    this.persist();
    return c;
  }

  async updateCollection(collectionId: string, patch: { title?: string; description?: string | null }) {
    const u = this.store.requireUser(this.sid());
    const c = this.store.updateCollectionMeta(collectionId, u.id, patch);
    this.persist();
    return c;
  }

  async toggleSystemItem(restaurantId: string, kind: SystemCollectionKind, on: boolean) {
    const u = this.store.requireUser(this.sid());
    const r = this.store.toggleSystemCollectionItem(u.id, restaurantId, kind, on);
    this.persist();
    return r;
  }

  async updateCollectionItem(collectionId: string, restaurantId: string, patch: { note?: string | null; note_shareable?: boolean; remove?: boolean; position?: number }) {
    const u = this.store.requireUser(this.sid());
    const c = this.store.updateCollectionItem(collectionId, restaurantId, patch, u.id);
    this.persist();
    return c;
  }

  async deleteCollection(collectionId: string) {
    const u = this.store.requireUser(this.sid());
    this.store.deleteCollection(collectionId, u.id);
    this.persist();
  }

  async requestPublication(collectionId: string, shareItemIds: string[]) {
    const u = this.store.requireUser(this.sid());
    const p = this.store.requestPublication(collectionId, u.id, shareItemIds);
    this.persist();
    return { id: p.id, status: p.status, generation: p.generation };
  }

  async unpublish(collectionId: string) {
    const u = this.store.requireUser(this.sid());
    const c = this.store.unpublishCollection(collectionId, u.id);
    this.persist();
    return c;
  }

  async sharedSnapshot(token: string) {
    return this.store.sharedSnapshot(token);
  }

  async createReport(input: ReportInput) {
    const r = this.store.createReport(input, this.sid());
    this.persist();
    return r;
  }

  async reportQueue(status?: ReportStatus | null) {
    return this.store.reportQueue(this.sid(), status ?? null);
  }

  async decideReport(input: ReportDecision) {
    const r = this.store.decideReport(input, this.sid());
    this.persist();
    return r;
  }

  async myReports() {
    return this.store.myReports(this.sid());
  }

  async createDiningLog(input: { restaurant_id: string; visited_date: string; amount_yuan?: number | null; note?: string | null }) {
    const r = this.store.createDiningLog(this.sid(), input);
    this.persist();
    return r;
  }

  async myDiningLogs() {
    return this.store.myDiningLogs(this.sid());
  }

  async deleteDiningLog(id: string) {
    const r = this.store.deleteDiningLog(this.sid(), id);
    this.persist();
    return r;
  }

  async auditLog() {
    return this.store.auditLog(this.sid());
  }

  async moderationQueue() {
    return this.store.moderationQueue(this.sid());
  }

  async moderate(input: { target: string; action: 'approve' | 'reject' | 'hide'; reason?: string; expected_version: number }) {
    this.store.moderate(input, this.sid());
    this.persist();
    const visitId = input.target.split('#v')[0] ?? '';
    const visit = this.store.visits.find((v) => v.id === visitId);
    return {
      ok: true as const,
      restaurant: visit ? this.store.toDto(this.store.requireRestaurant(visit.restaurant_id)) : null,
    };
  }

  async patchRestaurantStatus(input: PatchStatusInput) {
    const r = this.store.patchRestaurantStatus(input, this.sid());
    this.persist();
    return r;
  }

  async mergeRestaurants(input: { source_id: string; target_id: string; reason: string; expected_version: number }) {
    const r = this.store.mergeRestaurants(input, this.sid());
    this.persist();
    return r;
  }

  async revokeOrVerifyEndorsement(input: { restaurant_id: string; action: 'verify' | 'revoke'; reason?: string }) {
    const r = this.store.restoreEndorsement(input, this.sid());
    this.persist();
    return r;
  }

  async deleteAccount() {
    const r = this.store.deleteAccount(this.sid());
    setTimeout(() => { this.store.processDeletionJobs(); this.persist(); }, 0);
    this.session = null;
    localStorage.removeItem(LS_SESSION);
    this.persist();
    return r;
  }

  async today() {
    return this.store.today();
  }

  resetForTest(): void {
    localStorage.removeItem(LS_STATE);
    localStorage.removeItem(LS_SESSION);
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function safeRemove(k: string): void {
  try {
    localStorage.removeItem(k);
  } catch {
    /* 无存储权限时忽略 */
  }
}
