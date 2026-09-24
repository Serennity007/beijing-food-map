/** 唯一业务状态枚举。前端、后端、后台都从这里导入，禁止各自手写。 */

export const CUISINES = ['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'] as const;
export type Cuisine = (typeof CUISINES)[number];

/** 视图分组：这是产品分类，不是行政区划定义。贵州菜同时属于西南风味。 */
export const VIEWS = ['guizhou', 'southwest', 'other'] as const;
export type MapView = (typeof VIEWS)[number];

export const CUISINE_LABEL: Record<Cuisine, string> = {
  guizhou: '贵州菜',
  sichuan: '四川菜',
  chongqing: '重庆菜',
  yunnan: '云南菜',
  other: '其他菜系',
};

export const VIEW_LABEL: Record<MapView, string> = {
  guizhou: '贵州菜',
  southwest: '西南风味',
  other: '北京其他',
};

/** 西南风味包含的菜系标签。 */
export const SOUTHWEST_CUISINES: Cuisine[] = ['guizhou', 'sichuan', 'chongqing', 'yunnan'];

export const CONTENT_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'HIDDEN',
  'WITHDRAWN',
] as const;
export type ContentVersionStatus = (typeof CONTENT_STATUSES)[number];

export const PLACE_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type PlaceVerificationStatus = (typeof PLACE_STATUSES)[number];

export const PLACE_STATUS_LABEL: Record<PlaceVerificationStatus, string> = {
  PENDING: '待核验',
  VERIFIED: '已核验',
  REJECTED: '核验未通过',
};

/** 候选门店的来源：没有地图 Key 时只有手动选点，第三方候选是接入位。 */
export const CANDIDATE_SOURCES = ['manual_point', 'provider_poi'] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const CANDIDATE_SOURCE_LABEL: Record<CandidateSource, string> = {
  manual_point: '手动选点',
  provider_poi: '地图地点候选',
};

export const CANDIDATE_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'MERGED'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  PENDING: '待核验',
  VERIFIED: '已核验通过',
  REJECTED: '已驳回',
  MERGED: '已并入已有门店',
};

/** 重复提示只是给人看的线索，引擎绝不据此自动合并或自动驳回。 */
export const DUPLICATE_REASONS = ['same_poi_id', 'name_nearby', 'same_name_far', 'same_author_pending'] as const;
export type DuplicateReason = (typeof DUPLICATE_REASONS)[number];

export const DUPLICATE_REASON_LABEL: Record<DuplicateReason, string> = {
  same_poi_id: '同一地点数据源 ID',
  name_nearby: '名称相同且距离很近，可能是同一家',
  same_name_far: '名称相同但距离较远，可能是不同分店',
  same_author_pending: '你已经提交过同一家店的待核验申请',
};

export const BUSINESS_STATUSES = [
  'UNKNOWN',
  'OPEN',
  'SUSPECTED_CLOSED',
  'CLOSED',
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const RISK_STATUSES = ['CLEAR', 'REVIEW_REQUIRED', 'BLOCKED'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

export const COMMUNITY_QUALIFICATIONS = ['PENDING', 'QUALIFIED', 'LAPSED'] as const;
export type CommunityQualification = (typeof COMMUNITY_QUALIFICATIONS)[number];

/** 资格枚举要直接展示给用户，所以中文措辞跟规则语义一起放在合同层。 */
export const COMMUNITY_QUALIFICATION_LABEL: Record<CommunityQualification, string> = {
  PENDING: '尚未达标',
  QUALIFIED: '已达标',
  LAPSED: '已失效（近期口碑变化）',
};

export const ENDORSEMENT_STATUSES = ['NONE', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type EndorsementStatus = (typeof ENDORSEMENT_STATUSES)[number];

export const PUBLICATION_STATUSES = ['PRIVATE', 'PENDING_REVIEW', 'PUBLISHED', 'REVOKED'] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const ATTITUDES = ['recommend', 'neutral', 'not_recommend'] as const;
export type FeedbackAttitude = (typeof ATTITUDES)[number];

export const ATTITUDE_LABEL: Record<FeedbackAttitude, string> = {
  recommend: '推荐',
  neutral: '一般',
  not_recommend: '不推荐',
};

/** 利益披露为必选枚举。非 NONE 的记录可公开披露但不计社区独立票。 */
export const DISCLOSURES = ['none', 'owner_or_staff', 'invited_tasting', 'gifted_or_promoted', 'other'] as const;
export type Disclosure = (typeof DISCLOSURES)[number];

export const DISCLOSURE_LABEL: Record<Disclosure, string> = {
  none: '无关联，自费实吃',
  owner_or_staff: '店方或员工',
  invited_tasting: '受邀试吃',
  gifted_or_promoted: '获赠或推广',
  other: '其他关联',
};

export const REPORT_KINDS = ['closed', 'wrong_location', 'wrong_info', 'abuse'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  closed: '闭店／搬走',
  wrong_location: '位置有误',
  wrong_info: '信息有误',
  abuse: '内容违规',
};

export const REPORT_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: '待处理',
  IN_REVIEW: '复核中',
  RESOLVED: '已处理',
  DISMISSED: '已驳回',
};

/** 举报工单的处置动作。结案与驳回都必须留理由。 */
export const REPORT_ACTIONS = ['start', 'resolve', 'dismiss'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  start: '开始复核',
  resolve: '确认并结案',
  dismiss: '驳回',
};

export const ROLES = ['user', 'editor', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const LAYERS = ['qualified', 'pending_verification'] as const;
export type MapLayer = (typeof LAYERS)[number];

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'QUERY_EXPIRED',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  QUERY_EXPIRED: 409,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503,
};

export const RULE_VERSION = 'recommendation-v1';
/** 加了新门店候选与地点核验接口（阶段 1A）。 */
export const CONTRACT_VERSION = '2.0-demo-2';
