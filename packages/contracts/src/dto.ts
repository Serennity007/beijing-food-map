import type {
  BusinessStatus,
  CandidateSource,
  CandidateStatus,
  CommunityQualification,
  ContentVersionStatus,
  Cuisine,
  Disclosure,
  DuplicateReason,
  EndorsementStatus,
  FeedbackAttitude,
  LAYERS,
  MapView,
  PlaceVerificationStatus,
  PublicationStatus,
  ReportKind,
  ReportStatus,
  RiskStatus,
  Role,
} from './enums';

export type Layer = (typeof LAYERS)[number];

export interface ApiOk<T> {
  data: T;
  meta: { requestId: string };
}

export interface ApiErr {
  error: { code: string; message: string; fieldErrors?: Record<string, string> };
  meta: { requestId: string };
}

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface PriceSummary {
  /** 用户报告人均，单位元；null 表示未知。 */
  average: number | null;
  report_count: number;
}

export interface RecommendationBasis {
  community: CommunityQualification;
  tally: { recommend: number; neutral: number; not_recommend: number; total: number };
  window_start: string;
  window_end: string;
  editorial: EndorsementStatus;
  editorial_detail: { author: string; visited_date: string; reason: string } | null;
  sources: Array<'community' | 'editorial'>;
  rule_version: string;
}

/** 门店事实。分店是不同 ID。坐标为 GCJ-02。 */
export interface Restaurant {
  id: string;
  name: string;
  branch: string | null;
  cuisines: Cuisine[];
  address: string;
  floor_info: string | null;
  lng: number;
  lat: number;
  coord_system: 'GCJ02';
  price: PriceSummary;
  dish_highlights: string[];
  taste_tags: string[];
  photo_media_ids: string[];
  profile_public: boolean;
  /** 合成测试数据标记：演示种子恒为 true；真实核验数据为 false（生产视图据此隐藏演示水印）。 */
  is_test_data: boolean;
  place_status: PlaceVerificationStatus;
  place_verified_at: string | null;
  business_status: BusinessStatus;
  risk_status: RiskStatus;
  community: CommunityQualification;
  endorsement: EndorsementStatus;
  basis: RecommendationBasis;
  /** 派生：是否满足公共默认好店图层谓词。 */
  in_default_layer: boolean;
  ineligibility_reasons: string[];
  location_version: number;
  merged_into: string | null;
  deleted: boolean;
  version: number;
  updated_at: string;
}

export interface RestaurantDetail extends Restaurant {
  verification_note: string;
  business_status_note: string;
  my_current_feedback: MyFeedback | null;
  feedback_page: Page<FeedbackPublic>;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  snapshot_id: string | null;
}

export interface MediaAsset {
  id: string;
  owner_user_id: string;
  kind: 'photo';
  /** demo 用内联 SVG/PNG data URI，避免未审核对象直链；真实上传为空串（字节经 /media/:id 鉴权直出）。 */
  url: string;
  /** 真实上传的字节类型；demo data-uri 为 undefined。 */
  content_type?: string;
  width: number;
  height: number;
  review_status: ContentVersionStatus;
  is_test_data: boolean;
  exif_stripped: true;
}

export interface FeedbackPublic {
  id: string;
  restaurant_id: string;
  attitude: FeedbackAttitude;
  visited_date: string;
  reason: string;
  dish_names: string[];
  disclosure: Disclosure;
  disclosure_note: string | null;
  author: { display_name: string; is_editor: boolean };
  media_ids: string[];
  revision: number;
  location_version: number;
  counted_in_tally: boolean;
  updated_at: string;
}

export interface MyFeedback {
  visit_id: string;
  attitude: FeedbackAttitude;
  visited_date: string;
  reason: string;
  dish_names: string[];
  disclosure: Disclosure;
  media_ids: string[];
  content_status: ContentVersionStatus;
  /** 已公开版本，待审期间继续展示。 */
  approved_revision: number | null;
  pending_revision: number | null;
  withdrawal_generation: number;
  version: number;
}

export interface MapClusterItem {
  kind: 'cluster';
  id: string;
  count: number;
  longitude: number;
  latitude: number;
  expansion_bounds: Bounds;
  restaurant_ids: string[];
}

export interface MapRestaurantItem {
  kind: 'restaurant';
  id: string;
  name: string;
  branch: string | null;
  longitude: number;
  latitude: number;
  cuisines: Cuisine[];
  price: PriceSummary;
  top_dishes: string[];
  sources: Array<'community' | 'editorial'>;
  pending_verification: boolean;
}

export type MapEntity = MapClusterItem | MapRestaurantItem;

export interface MapItemsResponse {
  coord_system: 'GCJ02';
  mode: 'clusters' | 'restaurants';
  snapshot_id: string;
  query_key: string;
  total_matched: number;
  returned_count: number;
  complete: boolean;
  rule_version: string;
  max_entities: number;
  items: MapEntity[];
}

export interface MapQuery {
  bounds: Bounds;
  zoom: number;
  view: MapView;
  /** 预算上限（元）；未选时不筛选。 */
  budget_max: number | null;
  include_unknown_budget: boolean;
  dish_or_tag: string | null;
  layer: Layer;
  contract_version: string;
}

export interface SubmissionDraft {
  restaurant_id: string | null;
  candidate_id: string | null;
  visited_date: string;
  dish_names: string[];
  reason: string;
  media_ids: string[];
  disclosure: Disclosure | null;
  budget: number | null;
}

export interface Submission {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  attitude: FeedbackAttitude;
  visited_date: string;
  dish_names: string[];
  reason: string;
  media_ids: string[];
  disclosure: Disclosure;
  status: ContentVersionStatus;
  reject_reason: string | null;
  pending_verify_reason: string | null;
  version: number;
  created_at: string;
}

export interface CollectionItemRecord {
  restaurant_id: string;
  position: number;
  note: string | null;
  note_shareable: boolean;
  media_ids: string[];
  added_at: string;
}

export type SystemCollectionKind = 'want' | 'visited' | 'private_stash';

export interface Collection {
  id: string;
  owner_user_id: string;
  kind: 'system' | 'custom';
  system_kind: SystemCollectionKind | null;
  title: string;
  description: string | null;
  items: CollectionItemRecord[];
  publication_status: PublicationStatus;
  active_token: string | null;
  publication_generation: number;
  version: number;
  updated_at: string;
}

export interface SharedCollectionSnapshot {
  token: string;
  title: string;
  description: string | null;
  author_display_name: string;
  published_at: string;
  /** 快照内是否含合成测试门店：为 true 时公开页显示演示水印，真实数据不显示。 */
  contains_test_data: boolean;
  items: Array<{
    restaurant_id: string;
    name: string;
    branch: string | null;
    lng: number;
    lat: number;
    cuisines: Cuisine[];
    note: string | null;
    media_ids: string[];
    /** 作者个人推荐、平台尚未验证，必须显式标识。 */
    pending_verification: boolean;
  }>;
}

/** 部署自描述：前端据此决定是否显示演示水印（production 且无测试数据 = 干净上线态）。 */
export interface DeploymentMeta {
  env: 'development' | 'test' | 'demo_static' | 'production';
  /** 当前库内是否装载了合成测试数据（演示种子）。 */
  test_data_loaded: boolean;
}

export interface SessionUser {
  id: string;
  display_name: string;
  roles: Role[];
  phone_masked: string;
  is_test_data: boolean;
  account_status: 'active' | 'deleting';
}

export interface ReportTicket {
  id: string;
  restaurant_id: string;
  kind: ReportKind;
  detail: string;
  reporter_id: string;
  status: ReportStatus;
  created_at: string;
  /** 处理结果说明：由处置动作写入，不是提交时给定的固定文案。 */
  result_note: string | null;
  /** 可以精确到某条反馈版本（形如 V0092#v1）；只针对门店时为 null。 */
  feedback_target: string | null;
  /** 乐观锁：处置要带 expected_version。 */
  version: number;
  handled_by: string | null;
  handled_at: string | null;
}

export interface ReportQueueEntry extends ReportTicket {
  restaurant_name: string | null;
  /** 审核队列用：举报人本人不能处置自己的举报（与"作者不能自审"同源）。 */
  is_reporter_self: boolean;
}

export interface ModerationQueueEntry {
  id: string;
  type: 'submission' | 'feedback_version' | 'media' | 'publication' | 'endorsement';
  restaurant_id: string | null;
  restaurant_name: string | null;
  author: string;
  preview: string;
  media_ids: string[];
  status: ContentVersionStatus | PublicationStatus;
  version: number;
  /** 图片可能来自没有记录上传时间的旧数据，未知就是 null，不由服务端补当前时刻。 */
  submitted_at: string | null;
  /** 独立核验要求：作者不能自审自己的内容。 */
  is_author_self: boolean;
}

/**
 * 搜索返回的第三方地点候选。没有地图 Key 时它是内置的合成候选，坐标明确标注为演示值；
 * 选中后只进入建店流程，不自动入库、更不自动推荐。
 */
export interface ProviderCandidate {
  provider: string;
  poi_id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
  coord_system: 'GCJ02';
  coord_note: string;
}

export interface SearchResult {
  own: Restaurant[];
  provider_candidates: ProviderCandidate[];
}

/** 重复提示：给人看的线索，引擎不据此自动合并或自动驳回。 */
export interface CandidateDuplicate {
  /** 命中的是已有门店还是另一条候选。 */
  kind: 'restaurant' | 'candidate';
  matched_id: string;
  name: string;
  branch: string | null;
  reason: DuplicateReason;
  /** 近似直线距离（米），不是行走距离；按 poi_id 命中时为 null。 */
  distance_m: number | null;
}

/** 新门店候选：地点实体，与投稿（内容版本）分属两套状态机。 */
export interface RestaurantCandidate {
  id: string;
  /** 作者补材料会递增，旧驳回理由随新版失效。 */
  revision: number;
  name: string;
  branch: string | null;
  address: string;
  floor_info: string | null;
  cuisines: Cuisine[];
  lng: number;
  lat: number;
  coord_system: 'GCJ02';
  source: CandidateSource;
  provider: string | null;
  poi_id: string | null;
  /** "你从哪知道这家店"，审核员判断依据之一。 */
  evidence_note: string;
  status: CandidateStatus;
  /** 候选创建时就落的门店记录，地点状态为 PENDING；驳回后退出图层。 */
  restaurant_id: string | null;
  duplicates: CandidateDuplicate[];
  submitted_by: string;
  author_display_name: string;
  /** 审核队列用：即使审核员有权限，本人的候选也不能自审。 */
  is_author_self: boolean;
  /** 门店当前的地点状态，核验后与候选状态同源。 */
  place_status: PlaceVerificationStatus | null;
  reject_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  /** 乐观锁：审核与补材料都要带 expected_version。 */
  version: number;
  created_at: string;
  updated_at: string;
  is_test_data: boolean;
}

/** 美食打卡/记账：用户个人的到店记录与消费记账（不参与公开推荐与票数）。 */
export interface DiningLog {
  id: string;
  user_id: string;
  restaurant_id: string;
  restaurant_name: string;
  /** 实到日期（Asia/Shanghai 日历日），不允许未来日期。 */
  visited_date: string;
  /** 消费金额（分）；null = 本次未记账。 */
  amount_fen: number | null;
  note: string | null;
  created_at: string;
}

/** 打卡/记账的月度汇总（Asia/Shanghai 当月）。 */
export interface DiningLogStats {
  month: string;
  count: number;
  total_fen: number;
}

export interface DiningLogPage {
  logs: DiningLog[];
  stats: DiningLogStats;
}
