import type {
  BusinessStatus,
  CommunityQualification,
  ContentVersionStatus,
  Cuisine,
  Disclosure,
  EndorsementStatus,
  FeedbackAttitude,
  LAYERS,
  MapView,
  PlaceVerificationStatus,
  PublicationStatus,
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
  is_test_data: true;
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
  /** demo 用内联 SVG/PNG data URI，避免未审核对象直链。 */
  url: string;
  width: number;
  height: number;
  review_status: ContentVersionStatus;
  is_test_data: true;
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

export interface SessionUser {
  id: string;
  display_name: string;
  roles: Role[];
  phone_masked: string;
  is_test_data: true;
  account_status: 'active' | 'deleting';
}

export interface ReportTicket {
  id: string;
  restaurant_id: string;
  kind: 'closed' | 'wrong_location' | 'wrong_info' | 'abuse';
  detail: string;
  reporter_id: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  result_note: string | null;
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
  submitted_at: string;
  /** 独立核验要求：作者不能自审自己的内容。 */
  is_author_self: boolean;
}
