import {
  ATTITUDES,
  type BusinessStatus,
  type CommunityQualification,
  type DuplicateReason,
  type EndorsementStatus,
  type FeedbackAttitude,
  type PlaceVerificationStatus,
  type RiskStatus,
} from './enums';
import { straightLineMeters } from './geo';

/** 可注入时钟，180 天边界测试用它，不通过改机器时间。 */
export interface Clock {
  /** 返回当前 UTC 时间戳（毫秒）。 */
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export const SCORING_WINDOW_DAYS = 180;

const SHANGHAI_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 服务器确定的 Asia/Shanghai "今天"，格式 YYYY-MM-DD。 */
export function shanghaiToday(clock: Clock = systemClock): string {
  const parts = SHANGHAI_DATE.formatToParts(new Date(clock.now()));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function fromYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y: y ?? 0, m: m ?? 0, d: d ?? 0 };
}

/** 把 YYYY-MM-DD 当作 Asia/Shanghai 日历日编码为可比较整数（days since epoch，UTC 正午对齐避免夏令时/闰秒问题）。 */
export function dayIndex(date: string): number {
  const { y, m, d } = fromYmd(date);
  return Math.floor(Date.UTC(y, m - 1, d, 4, 0, 0) / 86400000);
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = fromYmd(date);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

/**
 * 计票窗口：visited_date ∈ [today - 179 个自然日, today]，两端包含，共 180 个自然日。
 * 明确用上海日历日比较，不用毫秒减法、也不用批准时间。
 */
export function isInScoringWindow(visitedDate: string, today: string): boolean {
  const oldest = addDays(today, -(SCORING_WINDOW_DAYS - 1));
  const idx = dayIndex(visitedDate);
  return idx >= dayIndex(oldest) && idx <= dayIndex(today);
}

/** 未来实吃日期拒绝。 */
export function isFutureVisitDate(visitedDate: string, today: string): boolean {
  return dayIndex(visitedDate) > dayIndex(today);
}

export function assertVisitDate(visitedDate: string, today: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedDate)) {
    throw new RuleViolation('实吃日期格式必须是 YYYY-MM-DD');
  }
  if (isFutureVisitDate(visitedDate, today)) {
    throw new RuleViolation('不能提交未来的实吃日期');
  }
}

export class RuleViolation extends Error {}

export interface FeedbackLike {
  attitude: FeedbackAttitude;
  visited_date: string;
  /** 利益披露为 none 才计独立票。 */
  disclosure: string;
  author_status: 'active' | 'deleted' | 'excluded';
  content_status: string;
  location_version: number;
}

export interface Tally {
  recommend: number;
  neutral: number;
  not_recommend: number;
  total: number;
  window_start: string;
  window_end: string;
  counted_ids: string[];
}

/**
 * 社区计票：只有当前指针、内容通过、地点版本匹配、实吃在窗口内、账号可用、无利益关联、未被剔除的记录进入计数。
 */
export function tallyCommunity<T extends FeedbackLike & { id: string }>(
  rows: T[],
  currentLocationVersion: number,
  today: string,
): Tally {
  const counts: Record<FeedbackAttitude, number> = { recommend: 0, neutral: 0, not_recommend: 0 };
  const counted: string[] = [];
  for (const r of rows) {
    if (r.location_version !== currentLocationVersion) continue;
    if (r.content_status !== 'APPROVED') continue;
    if (r.disclosure !== 'none') continue;
    if (r.author_status !== 'active') continue;
    if (!isInScoringWindow(r.visited_date, today)) continue;
    if (!ATTITUDES.includes(r.attitude)) continue;
    counts[r.attitude] += 1;
    counted.push(r.id);
  }
  return {
    recommend: counts.recommend,
    neutral: counts.neutral,
    not_recommend: counts.not_recommend,
    total: counts.recommend + counts.neutral + counts.not_recommend,
    window_start: addDays(today, -(SCORING_WINDOW_DAYS - 1)),
    window_end: today,
    counted_ids: counted,
  };
}

/**
 * 社区资格：R>=3 且 4R>=3T（T>0）。用整数比较，不用四舍五入后的百分比。
 * previously_qualified 用来区分 LAPSED 与 PENDING。
 */
export function communityQualification(
  t: Pick<Tally, 'recommend' | 'total'>,
  previouslyQualified: boolean,
): CommunityQualification {
  const R = t.recommend;
  const T = t.total;
  const qualified = T > 0 && R >= 3 && 4 * R >= 3 * T;
  if (qualified) return 'QUALIFIED';
  return previouslyQualified ? 'LAPSED' : 'PENDING';
}

/** 编辑背书：实吃日为第 1 天，到实吃日 +179 个自然日结束时失效。 */
export function endorsementActive(visitedDate: string, today: string, status: EndorsementStatus): boolean {
  if (status !== 'ACTIVE') return false;
  return dayIndex(today) <= dayIndex(addDays(visitedDate, SCORING_WINDOW_DAYS - 1));
}

export function endorsementStatusOn(visitedDate: string, today: string): EndorsementStatus {
  return dayIndex(today) <= dayIndex(addDays(visitedDate, SCORING_WINDOW_DAYS - 1)) ? 'ACTIVE' : 'EXPIRED';
}

export interface EligibilityInput {
  profile_public: boolean;
  place_status: PlaceVerificationStatus;
  business_status: BusinessStatus;
  risk_status: RiskStatus;
  community: CommunityQualification;
  endorsement: EndorsementStatus;
  merged_into: string | null;
  deleted: boolean;
}

export interface EligibilityResult {
  in_default_layer: boolean;
  /** 进入默认层的来源；两者可同时存在，不互相覆盖。 */
  sources: Array<'community' | 'editorial'>;
  reasons: string[];
}

/** 公共地图默认好店图层的唯一谓词。 */
export function evaluatePublicMapEligibility(i: EligibilityInput): EligibilityResult {
  const reasons: string[] = [];
  if (i.deleted) reasons.push('门店已删除');
  if (i.merged_into) reasons.push('门店已合并到canonical');
  if (!i.profile_public) reasons.push('门店资料未公开');
  if (i.place_status !== 'VERIFIED') reasons.push('地点未核验通过');
  if (i.business_status === 'CLOSED') reasons.push('已确认闭店');
  if (i.business_status === 'SUSPECTED_CLOSED') reasons.push('疑似闭店，等待复核');
  if (i.risk_status === 'REVIEW_REQUIRED') reasons.push('风险复核中');
  if (i.risk_status === 'BLOCKED') reasons.push('风险阻断');
  const communityOk = i.community === 'QUALIFIED';
  const editorialOk = i.endorsement === 'ACTIVE';
  if (!communityOk && !editorialOk) reasons.push('无有效推荐来源');
  const blocked =
    i.deleted ||
    !!i.merged_into ||
    !i.profile_public ||
    i.place_status !== 'VERIFIED' ||
    (i.business_status !== 'OPEN' && i.business_status !== 'UNKNOWN') ||
    i.risk_status !== 'CLEAR' ||
    (!communityOk && !editorialOk);
  const sources: Array<'community' | 'editorial'> = [];
  if (communityOk) sources.push('community');
  if (editorialOk) sources.push('editorial');
  return { in_default_layer: !blocked, sources, reasons };
}

export interface TransitionRule {
  from: string;
  to: string;
  actor: 'author' | 'moderator' | 'system';
}

export const CONTENT_TRANSITIONS: TransitionRule[] = [
  { from: 'DRAFT', to: 'PENDING', actor: 'author' },
  { from: 'PENDING', to: 'APPROVED', actor: 'moderator' },
  { from: 'PENDING', to: 'REJECTED', actor: 'moderator' },
  { from: 'APPROVED', to: 'HIDDEN', actor: 'moderator' },
  { from: 'APPROVED', to: 'WITHDRAWN', actor: 'author' },
  { from: 'PENDING', to: 'WITHDRAWN', actor: 'author' },
  { from: 'DRAFT', to: 'WITHDRAWN', actor: 'author' },
  { from: 'REJECTED', to: 'PENDING', actor: 'author' },
];

export function canTransition(from: string, to: string, actor: TransitionRule['actor']): boolean {
  return CONTENT_TRANSITIONS.some((r) => r.from === from && r.to === to && (r.actor === actor || actor === 'system'));
}

// -------------------------------------------------------------- 新门店候选

/** 名称相同且近似直线距离在这个半径内才算"可能是同一家"；超出只提示可能是不同分店。 */
export const CANDIDATE_DUP_RADIUS_M = 150;
export const CANDIDATE_MAX_DUP_HINTS = 5;
export const CANDIDATE_MIN_EVIDENCE_CHARS = 10;
export const CANDIDATE_MAX_EVIDENCE_CHARS = 300;

export const CANDIDATE_TRANSITIONS: TransitionRule[] = [
  { from: 'PENDING', to: 'VERIFIED', actor: 'moderator' },
  { from: 'PENDING', to: 'REJECTED', actor: 'moderator' },
  { from: 'PENDING', to: 'MERGED', actor: 'moderator' },
  { from: 'REJECTED', to: 'PENDING', actor: 'author' },
];

export function canTransitionCandidate(from: string, to: string, actor: TransitionRule['actor']): boolean {
  return CANDIDATE_TRANSITIONS.some((r) => r.from === from && r.to === to && r.actor === actor);
}

/** 去掉空白与全角括号差异，只用于"是否可能同一家"的粗筛，不做 fuzzy 匹配。 */
export function normalizeStoreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[（）]/g, (c) => (c === '（' ? '(' : ')'))
    .replace(/[\s·・．.\-_—]/g, '');
}

/** 分店为空按"无分店"归一，避免 '' 与 null 被当成两家。 */
export function branchKey(branch: string | null | undefined): string {
  return normalizeStoreName(branch ?? '');
}

export interface DedupePoint {
  name: string;
  branch: string | null;
  lng: number;
  lat: number;
  provider: string | null;
  poi_id: string | null;
}

export interface DedupeTarget extends DedupePoint {
  id: string;
}

export interface DedupeHit<T extends DedupeTarget> {
  match: T;
  reason: DuplicateReason;
  distance_m: number | null;
}

/**
 * 人工合并候选提示：先 provider+poi_id，再名称/分店/距离。
 * 只产出线索，是否合并由审核员决定 —— 近距离同品牌不同分店不能被自动并掉。
 */
export function matchDuplicates<T extends DedupeTarget>(
  cand: DedupePoint,
  existing: T[],
  opts: { excludeId?: string; radiusM?: number } = {},
): DedupeHit<T>[] {
  const radius = opts.radiusM ?? CANDIDATE_DUP_RADIUS_M;
  const name = normalizeStoreName(cand.name);
  const branch = branchKey(cand.branch);
  const hits: DedupeHit<T>[] = [];
  for (const e of existing) {
    if (opts.excludeId && e.id === opts.excludeId) continue;
    if (cand.provider && cand.poi_id && e.provider === cand.provider && e.poi_id === cand.poi_id) {
      hits.push({ match: e, reason: 'same_poi_id', distance_m: null });
      continue;
    }
    if (!name || normalizeStoreName(e.name) !== name) continue;
    const distance = Math.round(straightLineMeters(cand, e));
    if (branchKey(e.branch) === branch && distance <= radius) {
      hits.push({ match: e, reason: 'name_nearby', distance_m: distance });
    } else {
      hits.push({ match: e, reason: 'same_name_far', distance_m: distance });
    }
  }
  const rank: Record<DuplicateReason, number> = { same_poi_id: 0, name_nearby: 1, same_name_far: 2, same_author_pending: 3 };
  return hits
    .sort((a, b) => rank[a.reason] - rank[b.reason] || (a.distance_m ?? 0) - (b.distance_m ?? 0))
    .slice(0, CANDIDATE_MAX_DUP_HINTS);
}
