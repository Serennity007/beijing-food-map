import type {
  Bounds,
  Collection,
  CollectionItemRecord,
  FeedbackPublic,
  MapEntity,
  MapItemsResponse,
  MapQuery,
  MediaAsset,
  ModerationQueueEntry,
  MyFeedback,
  Page,
  RecommendationBasis,
  Restaurant,
  RestaurantDetail,
  ReportTicket,
  ReportQueueEntry,
  SessionUser,
  SharedCollectionSnapshot,
  Submission,
  SystemCollectionKind,
} from './dto';
import {
  CONTRACT_VERSION,
  RULE_VERSION,
  SOUTHWEST_CUISINES,
  type CommunityQualification,
  type ContentVersionStatus,
  type Cuisine,
  type Disclosure,
  type EndorsementStatus,
  type FeedbackAttitude,
  type Role,
} from './enums';
import {
  BEIJING_BOUNDS,
  clusterPoints,
  isValidGcj02,
} from './geo';
import { testPhotoDataUri } from './photos';
import {
  ALIASES,
  DEMO_LOGIN_CODE,
  SEED_FEEDBACK,
  SEED_RESTAURANTS,
  SEED_USERS,
  type SeedRestaurant,
} from './seed';
import {
  RuleViolation,
  assertVisitDate,
  addDays,
  communityQualification,
  endorsementStatusOn,
  evaluatePublicMapEligibility,
  shanghaiToday,
  tallyCommunity,
  type Clock,
} from './rules';

export const MAX_ENTITIES_PER_RESPONSE = 200;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export interface Revision {
  revision: number;
  status: ContentVersionStatus;
  attitude: FeedbackAttitude;
  reason: string;
  dish_names: string[];
  disclosure: Disclosure;
  media_ids: string[];
  submitted_at: string;
  decided_at: string | null;
  decided_by: string | null;
  reject_reason: string | null;
}

export interface Visit {
  id: string;
  restaurant_id: string;
  user_id: string;
  visited_date: string;
  location_version: number;
  next_revision: number;
  current_revision: number | null;
  withdrawal_generation: number;
  revisions: Revision[];
}

export interface UserRec {
  id: string;
  display_name: string;
  roles: Role[];
  phone_masked: string;
  status: 'active' | 'deleting' | 'deleted';
  deletion_job_id?: string;
  deletion_completed_at?: string;
}

export interface EditorialRec {
  author_user_id: string;
  visited_date: string;
  reason: string;
  verifier_user_id: string | null;
  verified_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
}

export interface RestaurantRec {
  id: string;
  name: string;
  branch: string | null;
  cuisines: Cuisine[];
  address: string;
  floor_info: string | null;
  lng: number;
  lat: number;
  price_avg: number | null;
  price_reports: number;
  dish_highlights: string[];
  taste_tags: string[];
  photo_media_ids: string[];
  profile_public: boolean;
  place_status: SeedRestaurant['place_status'];
  place_verified_date: string | null;
  business_status: SeedRestaurant['business_status'];
  risk_status: SeedRestaurant['risk_status'];
  location_version: number;
  ever_qualified: boolean;
  editorial: EditorialRec | null;
  merged_into: string | null;
  deleted: boolean;
  version: number;
  updated_at: string;
  note: string;
  // 派生
  tally: { recommend: number; neutral: number; not_recommend: number; total: number };
  window_start: string;
  window_end: string;
  community: CommunityQualification;
  endorsement: EndorsementStatus;
  sources: Array<'community' | 'editorial'>;
  in_default_layer: boolean;
  ineligibility_reasons: string[];
}

export interface MediaRec {
  id: string;
  owner_user_id: string;
  url: string;
  width: number;
  height: number;
  review_status: ContentVersionStatus;
  context: 'private' | 'publication';
  publication_id: string | null;
  restaurant_id: string | null;
  /** 没有这个字段就不能报"提交时间"——早前的本机快照里没有它，读取处要按未知处理。 */
  created_at?: string;
}

export interface PublicationRec {
  id: string;
  collection_id: string;
  generation: number;
  status: 'PENDING_REVIEW' | 'PUBLISHED' | 'REVOKED' | 'REJECTED';
  token: string | null;
  title: string;
  description: string | null;
  items: Array<{ restaurant_id: string; note: string | null; media_ids: string[] }>;
  created_at: string;
  published_at: string | null;
  revoked_at: string | null;
}

export interface AuditRec {
  id: string;
  at: string;
  actor_id: string;
  action: string;
  target: string;
  reason: string | null;
  from_version: number | null;
  to_version: number | null;
}

export interface IdempotencyRec {
  key: string;
  user_id: string;
  route: string;
  request_hash: string;
  result: unknown;
  created_at: string;
}

export interface SnapshotRec {
  id: string;
  query_key: string;
  version: number;
  restaurant_ids: string[];
  created_at: string;
}

interface StoreOptions {
  /** production 下拒绝装载测试种子与演示登录后门。 */
  env?: 'development' | 'test' | 'demo_static' | 'production';
  now?: () => number;
}

const SYSTEM_KINDS: Array<{ kind: SystemCollectionKind; title: string }> = [
  { kind: 'want', title: '想吃' },
  { kind: 'visited', title: '吃过' },
  { kind: 'private_stash', title: '私藏' },
];

/**
 * 单一领域引擎：查询、状态机、计票与权限都在这里。
 * 浏览器 demo 走同一个类，后端 API 也只是它的 HTTP 外壳，避免两处规则漂移。
 */
export class Store {
  readonly env: StoreOptions['env'];
  private clock: Clock;
  restaurants = new Map<string, RestaurantRec>();
  users = new Map<string, UserRec>();
  visits: Visit[] = [];
  media = new Map<string, MediaRec>();
  collections = new Map<string, Collection>();
  publications = new Map<string, PublicationRec>();
  reports: ReportTicket[] = [];
  audit: AuditRec[] = [];
  idempotency = new Map<string, IdempotencyRec>();
  snapshots = new Map<string, SnapshotRec>();
  sessions = new Map<string, { user_id: string; created_at: string }>();
  private resultsVersion = 1;
  private seq = 1;
  private lastComputedDay: string | null = null;

  constructor(opts: StoreOptions = {}) {
    this.env = opts.env ?? 'development';
    this.clock = { now: opts.now ?? (() => Date.now()) };
    if (this.env === 'production') {
      throw new RuleViolation('production 环境拒绝装载测试种子，请先接入真实核验数据');
    }
    this.loadSeed();
  }

  now(): number {
    return this.clock.now();
  }
  today(): string {
    return shanghaiToday(this.clock);
  }
  private stamp(): string {
    return new Date(this.clock.now()).toISOString();
  }
  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}${String(this.seq).padStart(4, '0')}`;
  }

  // ---------------------------------------------------------------- 种子

  private loadSeed(): void {
    for (const u of SEED_USERS) {
      this.users.set(u.id, {
        id: u.id,
        display_name: u.display_name,
        roles: [...u.roles],
        phone_masked: u.phone,
        status: u.id === 'U06' ? 'deleted' : 'active',
      });
    }
    for (const s of SEED_RESTAURANTS) {
      const photos = [`M${s.id}a`, `M${s.id}b`].map((id, i) => {
        this.media.set(id, {
          id,
          owner_user_id: 'A01',
          url: testPhotoDataUri(`${s.name}${s.branch ? `·${s.branch}` : ''}`, i === 0 ? '测试图片 · 非真实门店' : '测试图片 · 合成占位'),
          width: 640,
          height: 420,
          review_status: 'APPROVED',
          context: 'private',
          publication_id: null,
          restaurant_id: s.id,
          created_at: this.stamp(),
        });
        return id;
      });
      const rec: RestaurantRec = {
        ...s,
        place_verified_date:
          s.place_verified_days_ago === null ? null : addDays(this.today(), -s.place_verified_days_ago),
        photo_media_ids: photos,
        lng: s.lng,
        lat: s.lat,
        version: 1,
        updated_at: this.stamp(),
        deleted: false,
        merged_into: null,
        editorial: s.editorial
          ? {
              author_user_id: s.editorial.author,
              visited_date: addDays(this.today(), -s.editorial.visited_days_ago),
              reason: s.editorial.reason,
              verifier_user_id: s.editorial.verifier,
              verified_at: this.stamp(),
              revoked_at: null,
              revoke_reason: null,
            }
          : null,
        tally: { recommend: 0, neutral: 0, not_recommend: 0, total: 0 },
        window_start: addDays(this.today(), -179),
        window_end: this.today(),
        community: 'PENDING',
        endorsement: s.editorial ? 'ACTIVE' : 'NONE',
        sources: [],
        in_default_layer: false,
        ineligibility_reasons: [],
      };
      this.restaurants.set(rec.id, rec);
    }
    for (const f of SEED_FEEDBACK) {
      const rest = this.restaurants.get(f.restaurant_id);
      const visited = addDays(this.today(), -f.visited_days_ago);
      const locVersion = rest ? rest.location_version : 1;
      const visit: Visit = {
        id: `V${f.id}`,
        restaurant_id: f.restaurant_id,
        user_id: f.user,
        visited_date: visited,
        location_version: f.restaurant_id === 'R19' ? 1 : locVersion,
        next_revision: 2,
        current_revision: f.status === 'APPROVED' ? 1 : null,
        withdrawal_generation: 0,
        revisions: [
          {
            revision: 1,
            status: f.status,
            attitude: f.attitude,
            reason: f.reason,
            dish_names: f.dish_names,
            disclosure: f.disclosure,
            media_ids: [`MM${f.id}`],
            submitted_at: this.stamp(),
            decided_at: f.status === 'APPROVED' ? this.stamp() : null,
            decided_by: f.status === 'APPROVED' ? 'M01' : null,
            reject_reason: null,
          },
        ],
      };
      this.visits.push(visit);
      this.media.set(`MM${f.id}`, {
        id: `MM${f.id}`,
        owner_user_id: f.user,
        url: testPhotoDataUri(`测试图片 ${f.id}`, '反馈合成图 · 非真实探店'),
        width: 640,
        height: 420,
        review_status: f.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
        context: 'private',
        publication_id: null,
        restaurant_id: f.restaurant_id,
        created_at: this.stamp(),
      });
    }
    // R19 演示旧址票：再补两条同用户不同分店的历史记录（v1）
    for (const [id, user, date] of [
      ['F070', 'U04', 70],
      ['F071', 'U05', 100],
    ] as const) {
      this.visits.push({
        id: `V${id}`,
        restaurant_id: 'R19',
        user_id: user,
        visited_date: addDays(this.today(), -date),
        location_version: 1,
        next_revision: 2,
        current_revision: 1,
        withdrawal_generation: 0,
        revisions: [
          {
            revision: 1,
            status: 'APPROVED',
            attitude: 'recommend',
            reason: '测试反馈（合成）：旧址记录，用于演示搬迁后旧址票不计入新址资格。',
            dish_names: ['凯里红酸汤鱼'],
            disclosure: 'none',
            media_ids: [],
            submitted_at: this.stamp(),
            decided_at: this.stamp(),
            decided_by: 'M01',
            reject_reason: null,
          },
        ],
      });
    }
    for (const u of this.users.values()) this.ensureSystemCollections(u.id);
    this.recomputeAll();
    this.seedDemoCollections();
    this.seedPublications();
    this.seedReports();
  }

  private seedDemoCollections(): void {
    const custom: Collection = {
      id: 'COL0001',
      owner_user_id: 'U01',
      kind: 'custom',
      system_kind: null,
      title: '测试·我的贵州踩点图',
      description: '演示用个人清单（合成内容）',
      items: [
        { restaurant_id: 'R01', position: 0, note: '测试笔记（默认不公开）', note_shareable: false, media_ids: [], added_at: this.stamp() },
        { restaurant_id: 'R20', position: 1, note: '这条勾选了可公开', note_shareable: true, media_ids: [], added_at: this.stamp() },
        { restaurant_id: 'R07', position: 2, note: '待验证店，公开清单需带标识', note_shareable: true, media_ids: [], added_at: this.stamp() },
      ],
      publication_status: 'PRIVATE',
      active_token: null,
      publication_generation: 0,
      version: 1,
      updated_at: this.stamp(),
    };
    this.collections.set(custom.id, custom);
    this.addSystemItem('U01', 'R01', 'want');
    this.addSystemItem('U01', 'R21', 'visited');
    this.addSystemItem('U01', 'R16', 'private_stash');
  }

  private seedPublications(): void {
    const col = this.collections.get('COL0001');
    if (!col) return;
    const pub: PublicationRec = {
      id: 'PUB0001',
      collection_id: col.id,
      generation: 1,
      status: 'PUBLISHED',
      token: 'demo-token-1',
      title: col.title,
      description: col.description,
      items: col.items
        .filter((i) => i.note_shareable)
        .map((i) => ({ restaurant_id: i.restaurant_id, note: i.note, media_ids: i.media_ids })),
      created_at: this.stamp(),
      published_at: this.stamp(),
      revoked_at: null,
    };
    this.publications.set(pub.id, pub);
    col.publication_status = 'PUBLISHED';
    col.active_token = pub.token;
    col.publication_generation = 1;
  }

  private seedReports(): void {
    this.reports.push(
      {
        id: 'REP0001',
        restaurant_id: 'R08',
        kind: 'closed',
        detail: '测试举报（合成）：卷闸门贴了闭店告示。',
        reporter_id: 'U02',
        status: 'IN_REVIEW',
        created_at: this.stamp(),
        result_note: '已生成高优先级工单，闭店结论需人工证据确认，不因举报自动判定。',
      },
      {
        id: 'REP0002',
        restaurant_id: 'R02',
        kind: 'wrong_info',
        detail: '测试举报（合成）：疑似与 R01 是同一家店。',
        reporter_id: 'U03',
        status: 'OPEN',
        created_at: this.stamp(),
        result_note: null,
      },
    );
  }

  // ---------------------------------------------------------------- 派生

  recomputeAll(): void {
    this.lastComputedDay = this.today();
    for (const id of this.restaurants.keys()) this.recompute(id);
  }

  /** 读接口也校验到期，避免资格只能靠定时任务刷新（REC-04）。 */
  ensureFresh(): void {
    if (this.lastComputedDay !== this.today()) this.recomputeAll();
  }

  recompute(restaurantId: string): void {
    const rec = this.restaurants.get(restaurantId);
    if (!rec) return;
    const today = this.today();
    const rows = this.countableRevisions(restaurantId);
    const tally = tallyCommunity(rows, rec.location_version, today);
    rec.tally = {
      recommend: tally.recommend,
      neutral: tally.neutral,
      not_recommend: tally.not_recommend,
      total: tally.total,
    };
    rec.window_start = tally.window_start;
    rec.window_end = tally.window_end;
    const q = communityQualification(tally, rec.ever_qualified);
    if (q === 'QUALIFIED') rec.ever_qualified = true;
    rec.community = q;
    if (!rec.editorial) rec.endorsement = 'NONE';
    else if (rec.editorial.revoked_at) rec.endorsement = 'REVOKED';
    else if (!rec.editorial.verifier_user_id) rec.endorsement = 'NONE';
    else rec.endorsement = endorsementStatusOn(rec.editorial.visited_date, today);
    const res = evaluatePublicMapEligibility({
      profile_public: rec.profile_public,
      place_status: rec.place_status,
      business_status: rec.business_status,
      risk_status: rec.risk_status,
      community: rec.community,
      endorsement: rec.endorsement,
      merged_into: rec.merged_into,
      deleted: rec.deleted,
    });
    rec.in_default_layer = res.in_default_layer;
    rec.sources = res.sources;
    rec.ineligibility_reasons = res.reasons;
  }

  private countableRevisions(restaurantId: string): Array<{
    id: string;
    attitude: FeedbackAttitude;
    visited_date: string;
    disclosure: string;
    author_status: 'active' | 'deleted' | 'excluded';
    content_status: string;
    location_version: number;
  }> {
    const out: Array<{
      id: string;
      attitude: FeedbackAttitude;
      visited_date: string;
      disclosure: string;
      author_status: 'active' | 'deleted' | 'excluded';
      content_status: string;
      location_version: number;
    }> = [];
    for (const v of this.visits) {
      if (v.restaurant_id !== restaurantId || v.current_revision === null) continue;
      const rev = v.revisions.find((x) => x.revision === v.current_revision);
      if (!rev) continue;
      const author = this.users.get(v.user_id);
      out.push({
        id: v.id,
        attitude: rev.attitude,
        visited_date: v.visited_date,
        disclosure: rev.disclosure,
        author_status: author?.status === 'active' ? 'active' : 'deleted',
        content_status: rev.status,
        location_version: v.location_version,
      });
    }
    return out;
  }

  /** 一用户一门店最多一票：按 (user, restaurant) 找当前指针。 */
  findVisit(userId: string, restaurantId: string): Visit | undefined {
    return this.visits.find(
      (v) => v.user_id === userId && v.restaurant_id === this.canonical(restaurantId),
    );
  }

  private touch(restaurantId?: string): void {
    this.resultsVersion += 1;
    if (restaurantId) this.recompute(restaurantId);
  }

  canonical(id: string): string {
    let cur = id;
    for (let i = 0; i < 10; i += 1) {
      const rec = this.restaurants.get(cur);
      if (!rec?.merged_into) return cur;
      cur = rec.merged_into;
    }
    return cur;
  }

  // ---------------------------------------------------------------- 投影

  basisOf(rec: RestaurantRec): RecommendationBasis {
    return {
      community: rec.community,
      tally: rec.tally,
      window_start: rec.window_start,
      window_end: rec.window_end,
      editorial: rec.endorsement,
      editorial_detail: rec.editorial
        ? {
            author: this.users.get(rec.editorial.author_user_id)?.display_name ?? '未知',
            visited_date: rec.editorial.visited_date,
            reason: rec.editorial.reason,
          }
        : null,
      sources: rec.sources,
      rule_version: RULE_VERSION,
    };
  }

  toDto(rec: RestaurantRec): Restaurant {
    return {
      id: rec.id,
      name: rec.name,
      branch: rec.branch,
      cuisines: rec.cuisines,
      address: rec.address,
      floor_info: rec.floor_info,
      lng: rec.lng,
      lat: rec.lat,
      coord_system: 'GCJ02',
      price: { average: rec.price_avg, report_count: rec.price_reports },
      dish_highlights: rec.dish_highlights,
      taste_tags: rec.taste_tags,
      photo_media_ids: rec.photo_media_ids,
      profile_public: rec.profile_public,
      is_test_data: true,
      place_status: rec.place_status,
      place_verified_at: rec.place_verified_date,
      business_status: rec.business_status,
      risk_status: rec.risk_status,
      community: rec.community,
      endorsement: rec.endorsement,
      basis: this.basisOf(rec),
      in_default_layer: rec.in_default_layer,
      ineligibility_reasons: rec.ineligibility_reasons,
      location_version: rec.location_version,
      merged_into: rec.merged_into,
      deleted: rec.deleted,
      version: rec.version,
      updated_at: rec.updated_at,
    };
  }

  mediaOf(id: string): MediaAsset | null {
    const m = this.media.get(id);
    if (!m) return null;
    return {
      id: m.id,
      owner_user_id: m.owner_user_id,
      kind: 'photo',
      url: m.url,
      width: m.width,
      height: m.height,
      review_status: m.review_status,
      is_test_data: true,
      exif_stripped: true,
    };
  }

  /** 未过审图片只有作者与审核人员可读；其他人（含匿名）一律按「不存在」处理。 */
  canViewMedia(sessionId: string | null, mediaId: string): boolean {
    const asset = this.mediaOf(mediaId);
    if (!asset) return false;
    if (asset.review_status === 'APPROVED') return true;
    const viewerId = this.userIdOfSession(sessionId);
    if (!viewerId) return false;
    if (viewerId === asset.owner_user_id) return true;
    return (this.users.get(viewerId)?.roles ?? []).some((r) => r === 'moderator' || r === 'admin');
  }

  /** demo 上传：登记一张明确标注为合成的图片，等待审核（未经审核不公开）。 */
  addTestMedia(sessionId: string | null, restaurantId: string | null): MediaAsset {
    const user = this.requireUser(sessionId);
    const id = this.nextId('MM');
    const rec: MediaRec = {
      id,
      owner_user_id: user.id,
      url: testPhotoDataUri(`测试图片 ${id}`, '用户合成上传 · 非真实探店'),
      width: 640,
      height: 420,
      review_status: 'PENDING',
      context: 'private',
      publication_id: null,
      restaurant_id: restaurantId,
      created_at: this.stamp(),
    };
    this.media.set(id, rec);
    return this.mediaOf(id)!;
  }

  private publicFeedback(rec: Visit, rev: Revision, restaurant: RestaurantRec): FeedbackPublic {
    const counted =
      rev.disclosure === 'none' &&
      rev.status === 'APPROVED' &&
      rec.location_version === restaurant.location_version &&
      (this.users.get(rec.user_id)?.status ?? 'active') === 'active' &&
      tallyCommunity(this.countableRevisions(rec.restaurant_id), restaurant.location_version, this.today()).counted_ids.includes(
        rec.id,
      );
    return {
      id: rec.id,
      restaurant_id: rec.restaurant_id,
      attitude: rev.attitude,
      visited_date: rec.visited_date,
      reason: rev.reason,
      dish_names: rev.dish_names,
      disclosure: rev.disclosure,
      disclosure_note: rev.disclosure === 'none' ? null : '该记录含利益关联，公开但不计入社区独立票',
      author: {
        display_name: this.users.get(rec.user_id)?.display_name ?? '已注销用户',
        is_editor: this.users.get(rec.user_id)?.roles.includes('editor') ?? false,
      },
      media_ids: rev.media_ids,
      revision: rev.revision,
      location_version: rec.location_version,
      counted_in_tally: counted,
      updated_at: rev.decided_at ?? rev.submitted_at,
    };
  }

  /** 该门店可公开的反馈版本：当前指针已批准；旧址记录仍显示但标明历史。 */
  publicFeedbackFor(restaurantId: string): FeedbackPublic[] {
    this.ensureFresh();
    const rec = this.requireRestaurant(restaurantId);
    const out: FeedbackPublic[] = [];
    for (const v of this.visits) {
      if (v.restaurant_id !== restaurantId || v.current_revision === null) continue;
      const rev = v.revisions.find((x) => x.revision === v.current_revision);
      if (!rev || (rev.status !== 'APPROVED' && rev.status !== 'HIDDEN')) continue;
      out.push(this.publicFeedback(v, rev, rec));
    }
    return out.sort((a, b) => b.visited_date.localeCompare(a.visited_date) || a.id.localeCompare(b.id));
  }

  // ---------------------------------------------------------------- 查询

  requireRestaurant(id: string): RestaurantRec {
    const rec = this.restaurants.get(this.canonical(id));
    if (!rec || rec.deleted) throw new ApiError('NOT_FOUND', '门店不存在或未公开', 404);
    return rec;
  }

  private matchesView(rec: RestaurantRec, view: MapQuery['view']): boolean {
    if (view === 'guizhou') return rec.cuisines.includes('guizhou');
    if (view === 'southwest') return rec.cuisines.some((c) => SOUTHWEST_CUISINES.includes(c));
    return !rec.cuisines.some((c) => SOUTHWEST_CUISINES.includes(c));
  }

  private matchesBudget(rec: RestaurantRec, q: MapQuery): boolean {
    if (q.budget_max === null) return true;
    if (rec.price_avg === null) return q.include_unknown_budget;
    return rec.price_avg <= q.budget_max;
  }

  private matchesDish(rec: RestaurantRec, query: string | null): boolean {
    if (!query || !query.trim()) return true;
    const term = query.trim();
    const aliasTerms = ALIASES[term] ?? [];
    const hay = [rec.name, rec.branch ?? '', ...rec.dish_highlights, ...rec.taste_tags, rec.address].join(' ');
    return [term, ...aliasTerms].some((t) => hay.includes(t));
  }

  private inBounds(rec: RestaurantRec, b: Bounds): boolean {
    return rec.lng >= b.west && rec.lng <= b.east && rec.lat >= b.south && rec.lat <= b.north;
  }

  /** 默认可见层：符合公共谓词；待验证层：显式开启后显示未验证候选。 */
  visibleFor(rec: RestaurantRec, layer: MapQuery['layer']): boolean {
    if (rec.deleted || rec.merged_into || !rec.profile_public) return false;
    if (layer === 'pending_verification') return !rec.in_default_layer && rec.place_status !== 'VERIFIED';
    return rec.in_default_layer;
  }

  private queryKey(q: MapQuery): string {
    return [
      CONTRACT_VERSION,
      q.view,
      q.layer,
      q.budget_max ?? 'any',
      q.include_unknown_budget ? 'unk' : 'nounk',
      q.dish_or_tag ?? '',
      q.bounds.west.toFixed(3),
      q.bounds.south.toFixed(3),
      q.bounds.east.toFixed(3),
      q.bounds.north.toFixed(3),
    ].join('|');
  }

  matchedRestaurants(q: MapQuery): RestaurantRec[] {
    this.ensureFresh();
    return [...this.restaurants.values()]
      .filter(
        (rec) =>
          this.visibleFor(rec, q.layer) &&
          this.matchesView(rec, q.view) &&
          this.matchesBudget(rec, q) &&
          this.matchesDish(rec, q.dish_or_tag) &&
          this.inBounds(rec, q.bounds),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  mapItems(q: MapQuery, snapshotId?: string | null): MapItemsResponse {
    if (q.contract_version !== CONTRACT_VERSION) {
      throw new ApiError('VALIDATION_ERROR', '合同版本不匹配，请刷新', 400);
    }
    const key = this.queryKey(q);
    if (snapshotId) {
      const snap = this.snapshots.get(snapshotId);
      if (!snap || snap.query_key !== key || snap.version !== this.resultsVersion) {
        throw new ApiError('QUERY_EXPIRED', '查询快照已过期，请重新拉取地图与列表', 409);
      }
    }
    const matched = this.matchedRestaurants(q);
    const entities = this.buildEntities(matched, q);
    const snapshotIdOut = snapshotId ?? this.rememberSnapshot(key, matched.map((m) => m.id));
    return {
      coord_system: 'GCJ02',
      mode: entities.mode,
      snapshot_id: snapshotIdOut,
      query_key: key,
      total_matched: matched.length,
      returned_count: entities.items.length,
      complete: entities.complete,
      rule_version: RULE_VERSION,
      max_entities: MAX_ENTITIES_PER_RESPONSE,
      items: entities.items,
    };
  }

  private buildEntities(
    matched: RestaurantRec[],
    q: MapQuery,
  ): { items: MapEntity[]; mode: 'clusters' | 'restaurants'; complete: boolean } {
    const clusters = clusterPoints(
      matched.map((m) => ({ id: m.id, lng: m.lng, lat: m.lat })),
      q.zoom,
      MAX_ENTITIES_PER_RESPONSE,
    );
    const single = q.zoom >= 15 || clusters.length === matched.length;
    if (!single) {
      const items: MapEntity[] = clusters.map((c) => ({
        kind: 'cluster' as const,
        id: c.clusterId,
        count: c.items.length,
        longitude: c.lng,
        latitude: c.lat,
        expansion_bounds: c.expansionBounds,
        restaurant_ids: c.items.map((i) => i.id),
      }));
      const truncated = items.length > MAX_ENTITIES_PER_RESPONSE;
      return {
        items: items.slice(0, MAX_ENTITIES_PER_RESPONSE),
        mode: 'clusters',
        complete: !truncated,
      };
    }
    const byCoord = new Map<string, RestaurantRec[]>();
    for (const m of matched) {
      const k = `${m.lng.toFixed(4)},${m.lat.toFixed(4)}`;
      const arr = byCoord.get(k);
      if (arr) arr.push(m);
      else byCoord.set(k, [m]);
    }
    const items: MapEntity[] = [];
    for (const group of byCoord.values()) {
      if (group.length > 1 && q.zoom < 17) {
        const first = group[0]!;
        items.push({
          kind: 'cluster',
          id: `same-coord-${first.id}`,
          count: group.length,
          longitude: first.lng,
          latitude: first.lat,
          expansion_bounds: { west: first.lng - 0.002, south: first.lat - 0.002, east: first.lng + 0.002, north: first.lat + 0.002 },
          restaurant_ids: group.map((g) => g.id),
        });
        continue;
      }
      for (const m of group) {
        items.push({
          kind: 'restaurant',
          id: m.id,
          name: m.name,
          branch: m.branch,
          longitude: m.lng,
          latitude: m.lat,
          cuisines: m.cuisines,
          price: { average: m.price_avg, report_count: m.price_reports },
          top_dishes: m.dish_highlights.slice(0, 2),
          sources: m.sources,
          pending_verification: m.place_status !== 'VERIFIED',
        });
      }
    }
    return { items, mode: 'restaurants', complete: items.length <= MAX_ENTITIES_PER_RESPONSE };
  }

  private rememberSnapshot(key: string, ids: string[]): string {
    const id = `snap-v${this.resultsVersion}-${this.nextId('S')}`;
    this.snapshots.set(id, { id, query_key: key, version: this.resultsVersion, restaurant_ids: ids, created_at: this.stamp() });
    if (this.snapshots.size > 60) {
      const oldest = [...this.snapshots.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (oldest) this.snapshots.delete(oldest.id);
    }
    return id;
  }

  listRestaurants(q: MapQuery, snapshotId: string | null, cursor: string | null, limit: number): Page<Restaurant> {
    const capped = Math.max(1, Math.min(50, limit));
    let ids: string[];
    let snap = snapshotId;
    if (snapshotId) {
      const s = this.snapshots.get(snapshotId);
      if (!s || s.query_key !== this.queryKey(q) || s.version !== this.resultsVersion) {
        throw new ApiError('QUERY_EXPIRED', '查询快照已过期，请重新拉取地图与列表', 409);
      }
      ids = s.restaurant_ids;
    } else {
      const matched = this.matchedRestaurants(q);
      ids = matched.map((m) => m.id);
      snap = this.rememberSnapshot(this.queryKey(q), ids);
    }
    const start = cursor ? Math.max(0, ids.indexOf(cursor)) : 0;
    const page = ids.slice(start, start + capped);
    const next = start + capped < ids.length ? ids[start + capped] ?? null : null;
    return {
      items: page.map((id) => this.toDto(this.restaurants.get(id)!)),
      next_cursor: next,
      snapshot_id: snap,
    };
  }

  search(q: string): { own: Restaurant[]; provider_candidates: Array<{ provider: string; poi_id: string; name: string; address: string }> } {
    const term = q.trim();
    if (!term) return { own: [], provider_candidates: [] };
    const terms = [term, ...(ALIASES[term] ?? [])];
    const own = [...this.restaurants.values()]
      .filter((rec) => !rec.deleted && !rec.merged_into)
      .filter((rec) => {
        const hay = [rec.name, rec.branch ?? '', ...rec.dish_highlights, ...rec.taste_tags, rec.address].join(' ');
        return terms.some((t) => hay.includes(t));
      })
      .slice(0, 20)
      .map((rec) => this.toDto(rec));
    // 供应商候选：demo 不联网调用第三方，明确标注为需人工核验的候选，不自动入库。
    const provider_candidates = own.length === 0 && term.length >= 2
      ? [
          {
            provider: 'demo-provider',
            poi_id: 'POI-DEMO-1',
            name: `候选地点（未入库）·${term}`,
            address: '北京市（供应商候选，仅用于创建门店流程）',
          },
        ]
      : [];
    return { own, provider_candidates };
  }

  detail(id: string, sessionId: string | null): RestaurantDetail {
    const rec = this.requireRestaurant(id);
    const fb = this.publicFeedbackFor(rec.id);
    const viewer = this.userIdOfSession(sessionId);
    return {
      ...this.toDto(rec),
      verification_note:
        rec.place_status === 'VERIFIED'
          ? `地点已核验（${rec.place_verified_date ?? '日期未知'}）`
          : '地点尚未核验：这是候选门店，不代表平台推荐',
      business_status_note:
        rec.business_status === 'UNKNOWN'
          ? '营业状态未核实'
          : rec.business_status === 'OPEN'
            ? '最近核验为营业中（不自动推导当前是否在营业）'
            : rec.business_status === 'SUSPECTED_CLOSED'
              ? '收到闭店反馈，复核中'
              : '已确认闭店',
      my_current_feedback: viewer ? this.myFeedback(rec.id, viewer) : null,
      feedback_page: { items: fb, next_cursor: null, snapshot_id: null },
    };
  }

  myFeedback(restaurantId: string, userId: string): MyFeedback | null {
    const v = this.findVisit(userId, restaurantId);
    if (!v) return null;
    const cur = v.revisions.find((x) => x.revision === v.current_revision) ?? null;
    const pending = [...v.revisions].reverse().find((x) => x.status === 'PENDING') ?? null;
    const shown = pending ?? cur;
    if (!shown) return null;
    return {
      visit_id: v.id,
      attitude: shown.attitude,
      visited_date: v.visited_date,
      reason: shown.reason,
      dish_names: shown.dish_names,
      disclosure: shown.disclosure,
      media_ids: shown.media_ids,
      content_status: shown.status,
      approved_revision: cur?.revision ?? null,
      pending_revision: pending?.revision ?? null,
      withdrawal_generation: v.withdrawal_generation,
      version: v.next_revision,
    };
  }

  // ---------------------------------------------------------------- 会话与权限

  login(userId: string, code: string): { session_id: string; user: SessionUser } {
    if (this.env === 'production') throw new ApiError('FORBIDDEN', '生产环境禁用演示登录', 403);
    if (code !== DEMO_LOGIN_CODE) throw new ApiError('VALIDATION_ERROR', '验证码错误', 400);
    const u = this.users.get(userId);
    if (!u || u.status !== 'active') throw new ApiError('UNAUTHORIZED', '账号不可用', 401);
    const sid = `sess-${this.nextId('S')}`;
    this.sessions.set(sid, { user_id: u.id, created_at: this.stamp() });
    return { session_id: sid, user: this.sessionUser(u.id) };
  }

  sessionUser(userId: string): SessionUser {
    const u = this.users.get(userId);
    if (!u) throw new ApiError('UNAUTHORIZED', '会话无效', 401);
    return {
      id: u.id,
      display_name: u.display_name,
      roles: u.roles,
      phone_masked: u.phone_masked,
      is_test_data: true,
      account_status: u.status === 'active' ? 'active' : 'deleting',
    };
  }

  /** 会话 → 用户 id；匿名、会话失效或账号注销都返回 null（只读接口不该因此报 401）。 */
  userIdOfSession(sessionId: string | null): string | null {
    if (!sessionId) return null;
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const u = this.users.get(s.user_id);
    return u && u.status === 'active' ? u.id : null;
  }

  requireUser(sessionId: string | null): UserRec {
    const s = sessionId ? this.sessions.get(sessionId) : null;
    if (!s) throw new ApiError('UNAUTHORIZED', '需要登录', 401);
    const u = this.users.get(s.user_id);
    if (!u || u.status !== 'active') throw new ApiError('UNAUTHORIZED', '账号已注销或不可用', 401);
    return u;
  }

  /** 隔离内测环境的邀请账号：production 拒绝，真实短信登录由外部供应商适配。 */
  createInvitedUser(input: { id: string; display_name: string; roles: Role[] }, sessionId: string | null): SessionUser {
    this.requireRole(sessionId, ['admin']);
    if (this.env === 'production') throw new ApiError('FORBIDDEN', '生产环境禁用邀请账号', 403);
    if (this.users.has(input.id)) throw new ApiError('VALIDATION_ERROR', '账号已存在', 400);
    this.users.set(input.id, {
      id: input.id,
      display_name: input.display_name,
      roles: input.roles,
      phone_masked: '138****0000',
      status: 'active',
    });
    this.ensureSystemCollections(input.id);
    this.logAudit(this.requireRole(sessionId, ['admin']).id, 'create_invited_user', input.id, null, null, null);
    return this.sessionUser(input.id);
  }

  requireRole(sessionId: string | null, roles: Role[]): UserRec {
    const u = this.requireUser(sessionId);
    if (!u.roles.some((r) => roles.includes(r))) throw new ApiError('FORBIDDEN', '权限不足', 403);
    return u;
  }

  // ---------------------------------------------------------------- 投稿与反馈

  /** 投稿幂等：同 key 同内容返回同结果，同 key 换内容 409。 */
  private idempotent<T>(key: string | undefined, userId: string, route: string, payload: unknown, fn: () => T): T {
    if (!key) return fn();
    const mapKey = `${userId}:${route}:${key}`;
    const hash = stableHash(payload);
    const prev = this.idempotency.get(mapKey);
    if (prev) {
      if (prev.request_hash !== hash) {
        throw new ApiError('IDEMPOTENCY_CONFLICT', '相同幂等键提交了不同内容', 409);
      }
      return prev.result as T;
    }
    const result = fn();
    this.idempotency.set(mapKey, { key, user_id: userId, route, request_hash: hash, result, created_at: this.stamp() });
    return result;
  }

  submitFeedback(input: {
    restaurant_id: string;
    visited_date: string;
    attitude: FeedbackAttitude;
    dish_names: string[];
    reason: string;
    media_ids: string[];
    disclosure: Disclosure | null;
    idempotency_key?: string;
    /** 首版推荐好店走投稿流程：推荐态度需要图片。 */
    require_media_for_recommend?: boolean;
  }, sessionId: string | null): { submission: Submission; created_revision: number } {
    const user = this.requireUser(sessionId);
    return this.idempotent(input.idempotency_key, user.id, 'submitFeedback', input, () => {
      const rec = this.requireRestaurant(input.restaurant_id);
      const today = this.today();
      try {
        assertVisitDate(input.visited_date, today);
      } catch (e) {
        const msg = (e as Error).message;
        throw new ApiError('VALIDATION_ERROR', msg, 400, { visited_date: msg });
      }
      if (!input.disclosure) throw new ApiError('VALIDATION_ERROR', '必须选择利益披露', 400, { disclosure: '请选择与门店的关系' });
      if (input.reason.trim().length < 20) {
        throw new ApiError('VALIDATION_ERROR', '理由需要 20—500 字', 400, { reason: '至少 20 字' });
      }
      if (input.reason.trim().length > 500) throw new ApiError('VALIDATION_ERROR', '理由超过 500 字', 400, { reason: '最多 500 字' });
      if (input.attitude === 'recommend' && input.dish_names.length === 0) {
        throw new ApiError('VALIDATION_ERROR', '推荐需要至少一道菜', 400, { dish_names: '至少填写一道菜' });
      }
      const needsMedia = input.attitude === 'recommend' && (input.require_media_for_recommend ?? true);
      if (needsMedia && input.media_ids.length === 0) {
        throw new ApiError('VALIDATION_ERROR', '推荐好店需要 1—6 张原创图片', 400, { media_ids: '请选择至少一张图片' });
      }
      if (input.media_ids.length > 6) throw new ApiError('VALIDATION_ERROR', '图片最多 6 张', 400);
      for (const mid of input.media_ids) {
        const m = this.media.get(mid);
        if (!m || m.owner_user_id !== user.id) {
          throw new ApiError('FORBIDDEN', '图片不属于当前账号', 403, { media_ids: '只能使用本人上传的图片' });
        }
      }
      if (!isValidGcj02(rec.lng, rec.lat)) throw new ApiError('VALIDATION_ERROR', '门店坐标不在有效范围内', 400);
      const outsideBeijing = !this.inBounds(rec, BEIJING_BOUNDS);
      if (outsideBeijing) throw new ApiError('VALIDATION_ERROR', '首版只收录北京境内餐馆', 400, { restaurant_id: '不在北京范围内' });

      let visit = this.findVisit(user.id, rec.id);
      if (!visit) {
        visit = {
          id: this.nextId('V'),
          restaurant_id: rec.id,
          user_id: user.id,
          visited_date: input.visited_date,
          location_version: rec.location_version,
          next_revision: 1,
          current_revision: null,
          withdrawal_generation: 0,
          revisions: [],
        };
        this.visits.push(visit);
      }
      const revision: Revision = {
        revision: visit.next_revision,
        status: 'PENDING',
        attitude: input.attitude,
        reason: input.reason.trim(),
        dish_names: input.dish_names.map((d) => d.trim()).filter(Boolean),
        disclosure: input.disclosure,
        media_ids: input.media_ids,
        submitted_at: this.stamp(),
        decided_at: null,
        decided_by: null,
        reject_reason: null,
      };
      visit.next_revision += 1;
      visit.revisions.push(revision);
      this.touch(rec.id);
      this.logAudit(user.id, 'submit', `${rec.id}#v${revision.revision}`, null, null, revision.revision);
      return {
        submission: this.submissionOf(visit, revision, rec),
        created_revision: revision.revision,
      };
    });
  }

  private submissionOf(v: Visit, rev: Revision, rec: RestaurantRec): Submission {
    return {
      id: `${v.id}#v${rev.revision}`,
      restaurant_id: rec.id,
      restaurant_name: rec.name + (rec.branch ? `（${rec.branch}）` : ''),
      attitude: rev.attitude,
      visited_date: v.visited_date,
      dish_names: rev.dish_names,
      reason: rev.reason,
      media_ids: rev.media_ids,
      disclosure: rev.disclosure,
      status: rev.status,
      reject_reason: rev.reject_reason,
      pending_verify_reason:
        rec.place_status !== 'VERIFIED' ? '门店地点尚未核验，通过后才会进入好店地图' : null,
      version: rev.revision,
      created_at: rev.submitted_at,
    };
  }

  withdrawMyFeedback(restaurantId: string, sessionId: string | null): { ok: true } {
    const user = this.requireUser(sessionId);
    const rec = this.requireRestaurant(restaurantId);
    const v = this.findVisit(user.id, rec.id);
    if (!v || v.current_revision === null) throw new ApiError('NOT_FOUND', '没有可撤回的反馈', 404);
    v.current_revision = null;
    v.withdrawal_generation += 1;
    // 撤回前待审版本作废：历史版本晚批准也不能重新公开
    for (const rev of v.revisions) {
      if (rev.status === 'PENDING') {
        rev.status = 'WITHDRAWN';
        rev.reject_reason = '作者撤回，待审版本作废';
      }
    }
    this.touch(rec.id);
    this.logAudit(user.id, 'withdraw_feedback', rec.id, null, null, null);
    return { ok: true };
  }

  mySubmissions(sessionId: string | null): Submission[] {
    const user = this.requireUser(sessionId);
    const out: Submission[] = [];
    for (const v of this.visits) {
      if (v.user_id !== user.id) continue;
      const rec = this.restaurants.get(v.restaurant_id);
      if (!rec) continue;
      for (const rev of v.revisions) out.push(this.submissionOf(v, rev, rec));
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  moderationQueue(sessionId: string | null): ModerationQueueEntry[] {
    const actor = this.requireRole(sessionId, ['moderator', 'admin']);
    const entries: ModerationQueueEntry[] = [];
    for (const v of this.visits) {
      const rec = this.restaurants.get(v.restaurant_id);
      if (!rec) continue;
      for (const rev of v.revisions) {
        if (rev.status !== 'PENDING') continue;
        entries.push({
          id: `${v.id}#v${rev.revision}`,
          type: 'feedback_version',
          restaurant_id: rec.id,
          restaurant_name: rec.name,
          author: this.users.get(v.user_id)?.display_name ?? '?',
          preview: `${ATTITUDE_TEXT(rev.attitude)}｜${rev.reason}`,
          media_ids: rev.media_ids,
          status: rev.status,
          version: rev.revision,
          submitted_at: rev.submitted_at,
          is_author_self: revAuthor(v) === actor.id,
        });
      }
    }
    for (const p of this.publications.values()) {
      if (p.status !== 'PENDING_REVIEW') continue;
      const col = this.collections.get(p.collection_id);
      entries.push({
        id: p.id,
        type: 'publication',
        restaurant_id: null,
        restaurant_name: p.title,
        author: this.users.get(col?.owner_user_id ?? '')?.display_name ?? '?',
        preview: `${p.items.length} 家门店｜${p.description ?? ''}`,
        media_ids: p.items.flatMap((i) => i.media_ids),
        status: p.status,
        version: p.generation,
        submitted_at: p.created_at,
        is_author_self: col?.owner_user_id === actor.id,
      });
    }
    for (const m of this.media.values()) {
      if (m.review_status !== 'PENDING') continue;
      entries.push({
        id: m.id,
        type: 'media',
        restaurant_id: m.restaurant_id,
        restaurant_name: m.restaurant_id ? this.restaurants.get(m.restaurant_id)?.name ?? null : null,
        author: this.users.get(m.owner_user_id)?.display_name ?? '?',
        preview: '待审图片',
        media_ids: [m.id],
        status: m.review_status,
        version: 1,
        // 早前的图片记录没存过上传时间，这里只能是"不知道"，不能拿本次读取的时间冒充
        submitted_at: m.created_at ?? null,
        is_author_self: m.owner_user_id === actor.id,
      });
    }
    return entries.sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''));
  }

  /**
   * 审核动作。乐观版本锁：expectedVersion 不匹配 409。
   * 较低 revision 不能覆盖已批准的较高 revision；作者不能自审。
   */
  moderate(input: {
    target: string;
    action: 'approve' | 'reject' | 'hide';
    reason?: string;
    expected_version: number;
  }, sessionId: string | null): { ok: true; community: CommunityQualification; in_default_layer: boolean } {
    const actor = this.requireRole(sessionId, ['moderator', 'admin']);
    const [targetId, revText] = parseTarget(input.target);
    if (targetId.startsWith('PUB')) {
      const pub = this.publications.get(targetId);
      if (!pub) throw new ApiError('NOT_FOUND', '发布申请不存在', 404);
      const col = this.collections.get(pub.collection_id);
      if (!col) throw new ApiError('NOT_FOUND', '清单不存在', 404);
      if (col.owner_user_id === actor.id) throw new ApiError('FORBIDDEN', '作者不能审核自己的发布申请', 403);
      if (pub.status !== 'PENDING_REVIEW') throw new ApiError('VERSION_CONFLICT', '该申请已被处理', 409);
      if (pub.generation !== input.expected_version) throw new ApiError('VERSION_CONFLICT', '版本冲突，请重载后再操作', 409);
      if (input.action === 'approve') {
        // 撤回或新版上线之后，历史待审申请不能越过当前代数重新公开
        if (pub.generation <= col.publication_generation) {
          throw new ApiError('VERSION_CONFLICT', '该发布申请已过期，请作者重新提交', 409);
        }
        for (const older of this.publications.values()) {
          if (older.collection_id === col.id && older.status === 'PUBLISHED') {
            older.status = 'REVOKED';
            older.revoked_at = this.stamp();
          }
        }
        pub.status = 'PUBLISHED';
        pub.token = this.nextId('tok-');
        pub.published_at = this.stamp();
        col.publication_status = 'PUBLISHED';
        col.publication_generation = pub.generation;
        col.active_token = pub.token;
        for (const id of pub.items.flatMap((i) => i.media_ids)) {
          const m = this.media.get(id);
          if (m) {
            m.review_status = 'APPROVED';
            m.context = 'publication';
            m.publication_id = pub.id;
          }
        }
      } else if (input.action === 'reject') {
        pub.status = 'REJECTED';
      } else {
        pub.status = 'REVOKED';
        pub.revoked_at = this.stamp();
        col.publication_status = 'REVOKED';
        col.active_token = null;
        // 与撤回同理：把当前代数推进到本次申请，作废更早的待审申请
        col.publication_generation = Math.max(col.publication_generation, pub.generation);
      }
      this.logAudit(actor.id, `publication_${input.action}`, pub.id, input.reason ?? null, pub.generation, pub.generation);
      this.touch();
      return { ok: true, community: 'PENDING', in_default_layer: false };
    }
    if (revText === undefined && targetId.startsWith('MM')) {
      const m = this.media.get(targetId);
      if (!m) throw new ApiError('NOT_FOUND', '图片不存在', 404);
      if (m.owner_user_id === actor.id) throw new ApiError('FORBIDDEN', '上传者不能审核自己的图片', 403);
      if (m.review_status !== 'PENDING') throw new ApiError('VERSION_CONFLICT', '该图片已处理', 409);
      m.review_status = input.action === 'approve' ? 'APPROVED' : input.action === 'reject' ? 'REJECTED' : 'HIDDEN';
      this.logAudit(actor.id, `media_${input.action}`, m.id, input.reason ?? null, 1, 1);
      this.touch();
      return { ok: true, community: 'PENDING', in_default_layer: false };
    }
    if (revText === undefined) throw new ApiError('VALIDATION_ERROR', '审核目标格式应为 V#####:revision', 400);
    const visit = this.visits.find((v) => v.id === targetId);
    if (!visit) throw new ApiError('NOT_FOUND', '记录不存在', 404);
    const rec = this.requireRestaurant(visit.restaurant_id);
    const rev = visit.revisions.find((x) => x.revision === Number(revText));
    if (!rev) throw new ApiError('NOT_FOUND', '版本不存在', 404);
    if (visit.user_id === actor.id) throw new ApiError('FORBIDDEN', '作者不能审核自己的内容', 403);
    if (rev.status !== 'PENDING' && input.action !== 'hide') throw new ApiError('VERSION_CONFLICT', '该版本已处理', 409);
    if (rev.revision !== input.expected_version) throw new ApiError('VERSION_CONFLICT', '版本冲突，请重载后再操作', 409);
    const currentApproved = visit.revisions.find((x) => x.revision === visit.current_revision);
    if (input.action === 'hide' && (rev.status !== 'APPROVED' || visit.current_revision !== rev.revision)) {
      throw new ApiError('VERSION_CONFLICT', '只能隐藏当前已批准版本', 409);
    }
    if (input.action === 'approve') {
      // 撤回后历史待审版本不能重新公开；较低 revision 不能覆盖已批准的较高 revision
      if (currentApproved && rev.revision < currentApproved.revision) {
        rev.status = 'REJECTED';
        rev.reject_reason = '已有更高版本公开，较低版本不覆盖';
        throw new ApiError('VERSION_CONFLICT', '较低版本不能覆盖已批准的较高版本', 409);
      }
      rev.status = 'APPROVED';
      rev.decided_at = this.stamp();
      rev.decided_by = actor.id;
      visit.current_revision = rev.revision;
    } else if (input.action === 'reject') {
      rev.status = 'REJECTED';
      rev.decided_at = this.stamp();
      rev.decided_by = actor.id;
      rev.reject_reason = input.reason ?? '内容不符合要求';
    } else {
      if (rev.status !== 'APPROVED' || visit.current_revision !== rev.revision) {
        throw new ApiError('VERSION_CONFLICT', '只能隐藏当前已批准版本', 409);
      }
      rev.status = 'HIDDEN';
      visit.current_revision = null;
      rev.reject_reason = input.reason ?? '违规隐藏';
    }
    this.logAudit(actor.id, `feedback_${input.action}`, `${visit.id}#v${rev.revision}`, input.reason ?? null, rev.revision, rev.revision);
    this.touch(rec.id);
    return { ok: true, community: rec.community, in_default_layer: rec.in_default_layer };
  }

  // ---------------------------------------------------------------- 清单

  private ensureSystemCollections(userId: string): void {
    for (const s of SYSTEM_KINDS) {
      const id = `SYS-${userId}-${s.kind}`;
      if (this.collections.has(id)) continue;
      this.collections.set(id, {
        id,
        owner_user_id: userId,
        kind: 'system',
        system_kind: s.kind,
        title: s.title,
        description: null,
        items: [],
        publication_status: 'PRIVATE',
        active_token: null,
        publication_generation: 0,
        version: 1,
        updated_at: this.stamp(),
      });
    }
  }

  private addSystemItem(userId: string, restaurantId: string, kind: SystemCollectionKind): void {
    this.ensureSystemCollections(userId);
    const col = this.collections.get(`SYS-${userId}-${kind}`)!;
    if (col.items.some((i) => i.restaurant_id === restaurantId)) return;
    col.items.push({
      restaurant_id: restaurantId,
      position: col.items.length,
      note: null,
      note_shareable: false,
      media_ids: [],
      added_at: this.stamp(),
    });
    col.version += 1;
    col.updated_at = this.stamp();
  }

  /** 想吃与吃过互斥，私藏与自定义清单可共存；标记吃过不产生公开到店记录或票。 */
  toggleSystemCollectionItem(userId: string, restaurantId: string, kind: SystemCollectionKind, on: boolean): Collection[] {
    this.ensureSystemCollections(userId);
    const rid = this.canonical(restaurantId);
    if (on) {
      if (kind === 'want' || kind === 'visited') {
        const other = kind === 'want' ? 'visited' : 'want';
        const oc = this.collections.get(`SYS-${userId}-${other}`)!;
        oc.items = oc.items.filter((i) => i.restaurant_id !== rid);
        oc.version += 1;
        oc.updated_at = this.stamp();
      }
      this.addSystemItem(userId, rid, kind);
    } else {
      const col = this.collections.get(`SYS-${userId}-${kind}`)!;
      col.items = col.items.filter((i) => i.restaurant_id !== rid);
      col.version += 1;
      col.updated_at = this.stamp();
    }
    return this.listCollectionsForUser(userId);
  }

  listCollectionsForUser(userId: string): Collection[] {
    this.ensureSystemCollections(userId);
    return [...this.collections.values()]
      .filter((c) => c.owner_user_id === userId)
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
      .map((c) => ({ ...c, items: [...c.items] }));
  }

  requireCollection(collectionId: string, userId: string): Collection {
    const col = this.collections.get(collectionId);
    if (!col || col.owner_user_id !== userId) throw new ApiError('NOT_FOUND', '清单不存在', 404);
    return col;
  }

  createCollection(userId: string, title: string, description: string | null): Collection {
    if (!title.trim()) throw new ApiError('VALIDATION_ERROR', '标题必填', 400, { title: '请输入标题' });
    const col: Collection = {
      id: this.nextId('COL'),
      owner_user_id: userId,
      kind: 'custom',
      system_kind: null,
      title: title.trim(),
      description: description?.trim() || null,
      items: [],
      publication_status: 'PRIVATE',
      active_token: null,
      publication_generation: 0,
      version: 1,
      updated_at: this.stamp(),
    };
    this.collections.set(col.id, col);
    return col;
  }

  /** 只改标题/描述；已发布快照不受影响（重新发布才会切换快照）。 */
  updateCollectionMeta(collectionId: string, userId: string, patch: { title?: string; description?: string | null }): Collection {
    const col = this.requireCollection(collectionId, userId);
    if (patch.title !== undefined) {
      const title = patch.title.trim();
      if (!title) throw new ApiError('VALIDATION_ERROR', '标题必填', 400, { title: '请输入标题' });
      if (title.length > 60) throw new ApiError('VALIDATION_ERROR', '标题最多 60 字', 400, { title: '最多 60 字' });
      col.title = title;
    }
    if (patch.description !== undefined) {
      const desc = patch.description?.trim() ?? '';
      if (desc.length > 300) throw new ApiError('VALIDATION_ERROR', '说明最多 300 字', 400, { description: '最多 300 字' });
      col.description = desc || null;
    }
    col.version += 1;
    col.updated_at = this.stamp();
    return { ...col, items: [...col.items] };
  }

  updateCollectionItem(collectionId: string, restaurantId: string, patch: Partial<CollectionItemRecord> & { remove?: boolean }, userId: string): Collection {
    const col = this.requireCollection(collectionId, userId);
    if (patch.remove) {
      col.items = col.items.filter((i) => i.restaurant_id !== restaurantId);
    } else {
      const item = col.items.find((i) => i.restaurant_id === restaurantId);
      if (item) Object.assign(item, patch);
      else
        col.items.push({
          restaurant_id: restaurantId,
          position: col.items.length,
          note: patch.note ?? null,
          note_shareable: patch.note_shareable ?? false,
          media_ids: patch.media_ids ?? [],
          added_at: this.stamp(),
        });
      col.items.sort((a, b) => a.position - b.position);
    }
    col.version += 1;
    col.updated_at = this.stamp();
    return { ...col, items: [...col.items] };
  }

  deleteCollection(collectionId: string, userId: string): { ok: true } {
    const col = this.requireCollection(collectionId, userId);
    // 清单删除后无法再追溯快照作者，必须同时清除其所有历史快照。
    for (const [id, p] of this.publications) {
      if (p.collection_id === col.id) this.publications.delete(id);
    }
    this.collections.delete(col.id);
    return { ok: true };
  }

  requestPublication(collectionId: string, userId: string, shareItemIds: string[]): PublicationRec {
    const col = this.requireCollection(collectionId, userId);
    if (col.kind !== 'custom') throw new ApiError('VALIDATION_ERROR', '系统清单不能直接发布', 400);
    const items = col.items
      .filter((i) => shareItemIds.includes(i.restaurant_id))
      .map((i) => ({
        restaurant_id: i.restaurant_id,
        note: i.note_shareable ? i.note : null,
        media_ids: i.note_shareable ? i.media_ids : [],
      }));
    if (items.length === 0) throw new ApiError('VALIDATION_ERROR', '至少选择一家可公开的门店', 400);
    for (const i of items) this.requireRestaurant(i.restaurant_id);
    const pub: PublicationRec = {
      id: this.nextId('PUB'),
      collection_id: col.id,
      generation: col.publication_generation + 1,
      status: 'PENDING_REVIEW',
      token: null,
      title: col.title,
      description: col.description,
      items,
      created_at: this.stamp(),
      published_at: null,
      revoked_at: null,
    };
    this.publications.set(pub.id, pub);
    col.publication_status = 'PENDING_REVIEW';
    // 新申请不改动 publication_generation：已发布的旧快照在审核通过前继续有效
    col.version += 1;
    return pub;
  }

  /** 撤回公开：同一事务递增 publication_generation，作废此前全部待审申请，旧 token 永不恢复。 */
  unpublishCollection(collectionId: string, userId: string): Collection {
    const col = this.requireCollection(collectionId, userId);
    col.publication_generation += 1;
    for (const p of this.publications.values()) {
      if (p.collection_id !== col.id) continue;
      if (p.status === 'PUBLISHED') {
        p.status = 'REVOKED';
        p.revoked_at = this.stamp();
      } else if (p.status === 'PENDING_REVIEW') {
        p.status = 'REJECTED';
      }
    }
    col.publication_status = 'PRIVATE';
    col.active_token = null;
    col.version += 1;
    return { ...col, items: [...col.items] };
  }

  sharedSnapshot(token: string): SharedCollectionSnapshot {
    const pub = [...this.publications.values()].find((p) => p.token === token && p.status === 'PUBLISHED');
    if (!pub) throw new ApiError('NOT_FOUND', '链接无效或已撤销', 404);
    const col = this.collections.get(pub.collection_id);
    if (!col || col.publication_generation !== pub.generation || col.active_token !== token) {
      throw new ApiError('NOT_FOUND', '链接无效或已撤销', 404);
    }
    const author = this.users.get(col.owner_user_id);
    if (!author || author.status !== 'active') throw new ApiError('NOT_FOUND', '作者账号已注销', 404);
    return {
      token,
      title: pub.title,
      description: pub.description,
      author_display_name: author.display_name,
      published_at: pub.published_at ?? pub.created_at,
      items: pub.items.flatMap((i) => {
        const rec = this.restaurants.get(i.restaurant_id);
        // 快照不能绕过后续隐藏/撤回
        if (!rec || rec.deleted || rec.merged_into || !rec.profile_public) return [];
        return [
          {
            restaurant_id: rec.id,
            name: rec.name,
            branch: rec.branch,
            lng: rec.lng,
            lat: rec.lat,
            cuisines: rec.cuisines,
            note: i.note,
            media_ids: i.media_ids.filter((mid) => {
              const m = this.media.get(mid);
              return m?.review_status === 'APPROVED';
            }),
            pending_verification: !rec.in_default_layer,
          },
        ];
      }),
    };
  }

  // ---------------------------------------------------------------- 举报 / 门店管理 / 注销

  createReport(input: { restaurant_id: string; kind: ReportTicket['kind']; detail: string }, sessionId: string | null): ReportTicket {
    const user = this.requireUser(sessionId);
    const rec = this.requireRestaurant(input.restaurant_id);
    if (!input.detail.trim()) throw new ApiError('VALIDATION_ERROR', '请填写说明', 400, { detail: '必填' });
    const ticket: ReportTicket = {
      id: this.nextId('REP'),
      restaurant_id: rec.id,
      kind: input.kind,
      detail: input.detail.trim(),
      reporter_id: user.id,
      status: 'OPEN',
      created_at: this.stamp(),
      result_note: null,
    };
    this.reports.push(ticket);
    const closedReporters = new Set(
      this.reports
        .filter((x) => x.restaurant_id === rec.id && x.kind === 'closed' && x.status !== 'DISMISSED')
        .map((x) => x.reporter_id),
    );
    // 阈值只生成复核并标疑似闭店，闭店结论仍需人工证据确认，风险状态不被举报改变。
    if (input.kind === 'closed' && closedReporters.size >= 3 && (rec.business_status === 'OPEN' || rec.business_status === 'UNKNOWN')) {
      rec.business_status = 'SUSPECTED_CLOSED';
      this.touch(rec.id);
      this.logAudit('system', 'workorder_created', rec.id, `${closedReporters.size} 个不同账号报告闭店，生成高优先级工单（不自动判定闭店）`, null, null);
    }
    return ticket;
  }

  reportQueue(sessionId: string | null): ReportQueueEntry[] {
    this.requireRole(sessionId, ['moderator', 'admin']);
    return [...this.reports]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      .slice(0, 200)
      .map((r) => ({ ...r, restaurant_name: this.restaurants.get(r.restaurant_id)?.name ?? null }));
  }

  myReports(sessionId: string | null): ReportTicket[] {
    const user = this.requireUser(sessionId);
    return this.reports.filter((r) => r.reporter_id === user.id);
  }

  patchRestaurantStatus(input: { id: string; place_status?: RestaurantRec['place_status']; business_status?: RestaurantRec['business_status']; risk_status?: RestaurantRec['risk_status']; reason?: string }, sessionId: string | null): Restaurant {
    const actor = this.requireRole(sessionId, ['moderator', 'admin']);
    const rec = this.requireRestaurant(input.id);
    if (input.place_status) {
      if (input.place_status !== rec.place_status) {
        rec.location_version += 1;
        // 搬迁/重新核验会递增 location_version，旧址票只作历史
      }
      rec.place_status = input.place_status;
      rec.place_verified_date = input.place_status === 'VERIFIED' ? this.today() : null;
    }
    if (input.business_status) rec.business_status = input.business_status;
    if (input.risk_status) rec.risk_status = input.risk_status;
    rec.version += 1;
    rec.updated_at = this.stamp();
    this.logAudit(actor.id, 'patch_status', rec.id, input.reason ?? null, rec.version - 1, rec.version);
    this.recompute(rec.id);
    this.touch(rec.id);
    return this.toDto(rec);
  }

  /** 门店合并：迁移反馈与清单引用，旧 ID 永久重定向，不自动合并近距离同品牌。 */
  mergeRestaurants(input: { source_id: string; target_id: string; reason: string; expected_version: number }, sessionId: string | null): { canonical: string } {
    const actor = this.requireRole(sessionId, ['admin']);
    const source = this.requireRestaurant(input.source_id);
    const target = this.requireRestaurant(input.target_id);
    if (source.id === target.id) throw new ApiError('VALIDATION_ERROR', '不能与自身合并', 400);
    if (source.version !== input.expected_version) throw new ApiError('VERSION_CONFLICT', '版本冲突，请重载', 409);
    if (!input.reason.trim()) throw new ApiError('VALIDATION_ERROR', '合并必须写明理由', 400);
    const conflicts: string[] = [];
    for (const v of this.visits) {
      if (v.restaurant_id !== source.id) continue;
      if (this.findVisit(v.user_id, target.id)) {
        // 重复票保留规则确定的当前记录，写入冲突日志
        conflicts.push(`${v.user_id} 在两家门店都有记录，保留目标门店票，来源票不再计票`);
        v.current_revision = null;
        v.restaurant_id = target.id;
      } else {
        v.restaurant_id = target.id;
      }
    }
    for (const col of this.collections.values()) {
      const dup = col.items.some((i) => i.restaurant_id === target.id);
      col.items = col.items
        .map((i) => (i.restaurant_id === source.id ? { ...i, restaurant_id: target.id } : i))
        .filter((i, idx, arr) => arr.findIndex((x) => x.restaurant_id === i.restaurant_id) === idx || !dup);
      col.version += 1;
    }
    source.merged_into = target.id;
    source.profile_public = false;
    source.version += 1;
    for (const m of this.media.values()) if (m.restaurant_id === source.id) m.restaurant_id = target.id;
    this.logAudit(actor.id, 'merge', `${source.id}->${target.id}`, input.reason, input.expected_version, source.version);
    if (conflicts.length) this.logAudit('system', 'merge_conflict', target.id, conflicts.join('；'), null, null);
    this.recompute(target.id);
    this.touch();
    return { canonical: target.id };
  }

  /** 注销：立即撤销会话、撤销本人分享、隐藏 UGC、移除计票。 */
  deleteAccount(sessionId: string | null): { deletion_job_id: string } {
    const user = this.requireUser(sessionId);
    user.status = 'deleting';
    user.deletion_job_id = this.nextId('DELJOB');
    for (const v of this.visits) {
      if (v.user_id !== user.id) continue;
      v.current_revision = null;
      v.withdrawal_generation += 1;
      for (const rev of v.revisions) if (rev.status === 'APPROVED' || rev.status === 'PENDING') rev.status = 'WITHDRAWN';
    }
    for (const col of this.collections.values()) {
      if (col.owner_user_id !== user.id) continue;
      this.unpublishCollection(col.id, user.id);
    }
    for (const m of this.media.values()) if (m.owner_user_id === user.id && m.context === 'publication') m.context = 'private';
    for (const r of this.restaurants.values()) if (r.editorial?.author_user_id === user.id) r.editorial = null;
    for (const [sid, s] of [...this.sessions.entries()]) if (s.user_id === user.id) this.sessions.delete(sid);
    this.recomputeAll();
    this.touch();
    this.logAudit(user.id, 'delete_account', user.id, '注销：会话撤销、分享撤销、UGC 隐藏、移出计票', null, null);
    return { deletion_job_id: user.deletion_job_id };
  }

  hasPendingDeletions(): boolean {
    for (const u of this.users.values()) if (u.status === 'deleting') return true;
    return false;
  }

  /** 幂等清除任务。deleting 用户行就是持久化任务，进程重启后继续扫描。 */
  processDeletionJobs(): number {
    let count = 0;
    for (const user of this.users.values()) {
      if (user.status !== 'deleting') continue;
      const uid = user.id;
      const collections = new Set([...this.collections.values()].filter(c => c.owner_user_id === uid).map(c => c.id));
      const media = new Set([...this.media.values()].filter(m => m.owner_user_id === uid).map(m => m.id));
      this.visits = this.visits.filter(v => v.user_id !== uid);
      for (const id of media) this.media.delete(id);
      for (const [id, pub] of this.publications) if (collections.has(pub.collection_id)) this.publications.delete(id);
      for (const id of collections) this.collections.delete(id);
      for (const [key, item] of this.idempotency) if (item.user_id === uid) this.idempotency.delete(key);
      for (const [sid, session] of this.sessions) if (session.user_id === uid) this.sessions.delete(sid);
      for (const r of this.restaurants.values()) {
        r.photo_media_ids = r.photo_media_ids.filter(id => !media.has(id));
        if (r.editorial?.author_user_id === uid) r.editorial = null;
      }
      // 举报和审计保留关联 ID 以供复核，清除该账号提交的自由文本。
      for (const report of this.reports) if (report.reporter_id === uid) report.detail = '账号已注销，说明已清除';
      for (const entry of this.audit) if (entry.actor_id === uid) entry.reason = null;
      user.display_name = '已注销用户';
      user.phone_masked = '';
      user.roles = [];
      user.status = 'deleted';
      user.deletion_completed_at = this.stamp();
      this.logAudit('system', 'delete_account_completed', uid, '账号内容清除完成；保留去标识账号行及复核日志', null, null);
      count += 1;
    }
    if (count) { this.recomputeAll(); this.touch(); }
    return count;
  }

  restoreEndorsement(input: { restaurant_id: string; action: 'revoke' | 'verify'; reason?: string }, sessionId: string | null): Restaurant {
    const actor = this.requireRole(sessionId, ['moderator', 'admin']);
    const rec = this.requireRestaurant(input.restaurant_id);
    if (!rec.editorial) throw new ApiError('NOT_FOUND', '该门店没有编辑背书', 404);
    if (input.action === 'verify') {
      if (rec.editorial.author_user_id === actor.id) throw new ApiError('FORBIDDEN', '背书作者不能自审，即使同时是管理员', 403);
      rec.editorial.verifier_user_id = actor.id;
      rec.editorial.verified_at = this.stamp();
      rec.editorial.revoked_at = null;
    } else {
      rec.editorial.revoked_at = this.stamp();
      rec.editorial.revoke_reason = input.reason ?? '编辑撤回';
    }
    this.logAudit(actor.id, `endorsement_${input.action}`, rec.id, input.reason ?? null, null, null);
    this.recompute(rec.id);
    this.touch(rec.id);
    return this.toDto(rec);
  }

  // ---------------------------------------------------------------- 日志

  logAudit(actorId: string, action: string, target: string, reason: string | null, fromV: number | null, toV: number | null): void {
    this.audit.push({
      id: this.nextId('AUD'),
      at: this.stamp(),
      actor_id: actorId,
      action,
      target,
      reason,
      from_version: fromV,
      to_version: toV,
    });
  }

  auditLog(sessionId: string | null): AuditRec[] {
    this.requireRole(sessionId, ['moderator', 'admin']);
    return [...this.audit].reverse().slice(0, 200);
  }

  /** 定时清理之外，读接口也会重算到期资格，避免只靠定时任务。 */
  refreshExpiredQualification(): void {
    this.recomputeAll();
  }

  /**
   * 整库快照：静态 demo 存 localStorage，后端 API 存 SQLite 文档表。
   * 不含 snapshots（短时查询快照），重启后由查询重建。
   */
  dumpState(): string {
    return JSON.stringify({
      schema: 1,
      results_version: this.resultsVersion,
      seq: this.seq,
      last_computed_day: this.lastComputedDay,
      restaurants: [...this.restaurants.values()],
      users: [...this.users.values()],
      visits: this.visits,
      media: [...this.media.values()],
      collections: [...this.collections.values()],
      publications: [...this.publications.values()],
      reports: this.reports,
      audit: this.audit,
      idempotency: [...this.idempotency.values()],
      sessions: [...this.sessions.entries()],
    });
  }

  loadState(json: string): void {
    const s = JSON.parse(json) as {
      results_version?: number;
      seq?: number;
      last_computed_day?: string | null;
      restaurants?: RestaurantRec[];
      users?: UserRec[];
      visits?: Visit[];
      media?: MediaRec[];
      collections?: Collection[];
      publications?: PublicationRec[];
      reports?: ReportTicket[];
      audit?: AuditRec[];
      idempotency?: IdempotencyRec[];
      sessions?: Array<[string, { user_id: string; created_at: string }]>;
    };
    this.restaurants = new Map((s.restaurants ?? []).map((r) => [r.id, r]));
    this.users = new Map((s.users ?? []).map((u) => [u.id, u]));
    this.visits = s.visits ?? [];
    this.media = new Map((s.media ?? []).map((m) => [m.id, m]));
    this.collections = new Map((s.collections ?? []).map((c) => [c.id, c]));
    this.publications = new Map((s.publications ?? []).map((p) => [p.id, p]));
    this.reports = s.reports ?? [];
    this.audit = s.audit ?? [];
    this.idempotency = new Map((s.idempotency ?? []).map((i) => [`${i.user_id}:${i.route}:${i.key}`, i]));
    this.sessions = new Map((s.sessions ?? []).map(([k, v]) => [k, v]));
    this.resultsVersion = s.results_version ?? this.resultsVersion;
    this.seq = s.seq ?? this.seq;
    this.snapshots.clear();
    this.recomputeAll();
    void s.last_computed_day;
  }
}

function ATTITUDE_TEXT(a: FeedbackAttitude): string {
  return a === 'recommend' ? '推荐' : a === 'neutral' ? '一般' : '不推荐';
}

function revAuthor(v: Visit): string {
  return v.user_id;
}

function parseTarget(target: string): [string, string | undefined] {
  const [id, rev] = target.split('#v');
  return [(id ?? '').trim(), rev];
}

export function stableHash(value: unknown): string {
  const s = JSON.stringify(value, (_k, v) => (typeof v === 'object' && v !== null ? sortKeys(v) : v));
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}
