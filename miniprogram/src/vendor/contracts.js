"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// ../packages/contracts/src/index.ts
var index_exports = {};
__export(index_exports, {
  ALIASES: () => ALIASES,
  ATTITUDES: () => ATTITUDES,
  ATTITUDE_LABEL: () => ATTITUDE_LABEL,
  ApiError: () => ApiError,
  BEIJING_BOUNDS: () => BEIJING_BOUNDS,
  BEIJING_CENTER: () => BEIJING_CENTER,
  BUSINESS_STATUSES: () => BUSINESS_STATUSES,
  CANDIDATE_DUP_RADIUS_M: () => CANDIDATE_DUP_RADIUS_M,
  CANDIDATE_MAX_DUP_HINTS: () => CANDIDATE_MAX_DUP_HINTS,
  CANDIDATE_MAX_EVIDENCE_CHARS: () => CANDIDATE_MAX_EVIDENCE_CHARS,
  CANDIDATE_MIN_EVIDENCE_CHARS: () => CANDIDATE_MIN_EVIDENCE_CHARS,
  CANDIDATE_SOURCES: () => CANDIDATE_SOURCES,
  CANDIDATE_SOURCE_LABEL: () => CANDIDATE_SOURCE_LABEL,
  CANDIDATE_STATUSES: () => CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABEL: () => CANDIDATE_STATUS_LABEL,
  CANDIDATE_TRANSITIONS: () => CANDIDATE_TRANSITIONS,
  COMMUNITY_QUALIFICATIONS: () => COMMUNITY_QUALIFICATIONS,
  COMMUNITY_QUALIFICATION_LABEL: () => COMMUNITY_QUALIFICATION_LABEL,
  CONTENT_STATUSES: () => CONTENT_STATUSES,
  CONTENT_TRANSITIONS: () => CONTENT_TRANSITIONS,
  CONTRACT_VERSION: () => CONTRACT_VERSION,
  CUISINES: () => CUISINES,
  CUISINE_LABEL: () => CUISINE_LABEL,
  DEMO_LOGIN_CODE: () => DEMO_LOGIN_CODE,
  DISCLOSURES: () => DISCLOSURES,
  DISCLOSURE_LABEL: () => DISCLOSURE_LABEL,
  DISH_KEYWORDS: () => DISH_KEYWORDS,
  DUPLICATE_REASONS: () => DUPLICATE_REASONS,
  DUPLICATE_REASON_LABEL: () => DUPLICATE_REASON_LABEL,
  ENDORSEMENT_STATUSES: () => ENDORSEMENT_STATUSES,
  ERROR_CODES: () => ERROR_CODES,
  ERROR_HTTP_STATUS: () => ERROR_HTTP_STATUS,
  LAYERS: () => LAYERS,
  MAX_ENTITIES_PER_RESPONSE: () => MAX_ENTITIES_PER_RESPONSE,
  PLACE_STATUSES: () => PLACE_STATUSES,
  PLACE_STATUS_LABEL: () => PLACE_STATUS_LABEL,
  PUBLICATION_STATUSES: () => PUBLICATION_STATUSES,
  REPORT_ACTIONS: () => REPORT_ACTIONS,
  REPORT_ACTION_LABEL: () => REPORT_ACTION_LABEL,
  REPORT_ACTION_TARGET: () => REPORT_ACTION_TARGET,
  REPORT_KINDS: () => REPORT_KINDS,
  REPORT_KIND_LABEL: () => REPORT_KIND_LABEL,
  REPORT_STATUSES: () => REPORT_STATUSES,
  REPORT_STATUS_LABEL: () => REPORT_STATUS_LABEL,
  REPORT_TRANSITIONS: () => REPORT_TRANSITIONS,
  RISK_STATUSES: () => RISK_STATUSES,
  ROLES: () => ROLES,
  RULE_VERSION: () => RULE_VERSION,
  RuleViolation: () => RuleViolation,
  SCORING_WINDOW_DAYS: () => SCORING_WINDOW_DAYS,
  SEED_FEEDBACK: () => SEED_FEEDBACK,
  SEED_RESTAURANTS: () => SEED_RESTAURANTS,
  SEED_USERS: () => SEED_USERS,
  SOUTHWEST_CUISINES: () => SOUTHWEST_CUISINES,
  Store: () => Store,
  VIEWS: () => VIEWS,
  VIEW_LABEL: () => VIEW_LABEL,
  addDays: () => addDays,
  assertVisitDate: () => assertVisitDate,
  branchKey: () => branchKey,
  canTransition: () => canTransition,
  canTransitionCandidate: () => canTransitionCandidate,
  canTransitionReport: () => canTransitionReport,
  cellDegForZoom: () => cellDegForZoom,
  clusterPoints: () => clusterPoints,
  communityQualification: () => communityQualification,
  dayIndex: () => dayIndex,
  daysBetween: () => daysBetween,
  endorsementActive: () => endorsementActive,
  endorsementStatusOn: () => endorsementStatusOn,
  evaluatePublicMapEligibility: () => evaluatePublicMapEligibility,
  gcj02ToWgs84: () => gcj02ToWgs84,
  gridCell: () => gridCell,
  isFutureVisitDate: () => isFutureVisitDate,
  isInScoringWindow: () => isInScoringWindow,
  isValidGcj02: () => isValidGcj02,
  matchDuplicates: () => matchDuplicates,
  normalizeStoreName: () => normalizeStoreName,
  shanghaiDateTime: () => shanghaiDateTime,
  shanghaiDay: () => shanghaiDay,
  shanghaiToday: () => shanghaiToday,
  stableHash: () => stableHash,
  straightLineMeters: () => straightLineMeters,
  systemClock: () => systemClock,
  tallyCommunity: () => tallyCommunity,
  testPhotoDataUri: () => testPhotoDataUri,
  wgs84ToGcj02: () => wgs84ToGcj02,
  zoomBucket: () => zoomBucket
});
module.exports = __toCommonJS(index_exports);

// ../packages/contracts/src/enums.ts
var CUISINES = ["guizhou", "sichuan", "chongqing", "yunnan", "other"];
var VIEWS = ["guizhou", "southwest", "other"];
var CUISINE_LABEL = {
  guizhou: "\u8D35\u5DDE\u83DC",
  sichuan: "\u56DB\u5DDD\u83DC",
  chongqing: "\u91CD\u5E86\u83DC",
  yunnan: "\u4E91\u5357\u83DC",
  other: "\u5176\u4ED6\u83DC\u7CFB"
};
var VIEW_LABEL = {
  guizhou: "\u8D35\u5DDE\u83DC",
  southwest: "\u897F\u5357\u98CE\u5473",
  other: "\u5317\u4EAC\u5176\u4ED6"
};
var SOUTHWEST_CUISINES = ["guizhou", "sichuan", "chongqing", "yunnan"];
var CONTENT_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "HIDDEN",
  "WITHDRAWN"
];
var PLACE_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];
var PLACE_STATUS_LABEL = {
  PENDING: "\u5F85\u6838\u9A8C",
  VERIFIED: "\u5DF2\u6838\u9A8C",
  REJECTED: "\u6838\u9A8C\u672A\u901A\u8FC7"
};
var CANDIDATE_SOURCES = ["manual_point", "provider_poi"];
var CANDIDATE_SOURCE_LABEL = {
  manual_point: "\u624B\u52A8\u9009\u70B9",
  provider_poi: "\u5730\u56FE\u5730\u70B9\u5019\u9009"
};
var CANDIDATE_STATUSES = ["PENDING", "VERIFIED", "REJECTED", "MERGED"];
var CANDIDATE_STATUS_LABEL = {
  PENDING: "\u5F85\u6838\u9A8C",
  VERIFIED: "\u5DF2\u6838\u9A8C\u901A\u8FC7",
  REJECTED: "\u5DF2\u9A73\u56DE",
  MERGED: "\u5DF2\u5E76\u5165\u5DF2\u6709\u95E8\u5E97"
};
var DUPLICATE_REASONS = ["same_poi_id", "name_nearby", "same_name_far", "same_author_pending"];
var DUPLICATE_REASON_LABEL = {
  same_poi_id: "\u540C\u4E00\u5730\u70B9\u6570\u636E\u6E90 ID",
  name_nearby: "\u540D\u79F0\u76F8\u540C\u4E14\u8DDD\u79BB\u5F88\u8FD1\uFF0C\u53EF\u80FD\u662F\u540C\u4E00\u5BB6",
  same_name_far: "\u540D\u79F0\u76F8\u540C\u4F46\u8DDD\u79BB\u8F83\u8FDC\uFF0C\u53EF\u80FD\u662F\u4E0D\u540C\u5206\u5E97",
  same_author_pending: "\u4F60\u5DF2\u7ECF\u63D0\u4EA4\u8FC7\u540C\u4E00\u5BB6\u5E97\u7684\u5F85\u6838\u9A8C\u7533\u8BF7"
};
var BUSINESS_STATUSES = [
  "UNKNOWN",
  "OPEN",
  "SUSPECTED_CLOSED",
  "CLOSED"
];
var RISK_STATUSES = ["CLEAR", "REVIEW_REQUIRED", "BLOCKED"];
var COMMUNITY_QUALIFICATIONS = ["PENDING", "QUALIFIED", "LAPSED"];
var COMMUNITY_QUALIFICATION_LABEL = {
  PENDING: "\u5C1A\u672A\u8FBE\u6807",
  QUALIFIED: "\u5DF2\u8FBE\u6807",
  LAPSED: "\u5DF2\u5931\u6548\uFF08\u8FD1\u671F\u53E3\u7891\u53D8\u5316\uFF09"
};
var ENDORSEMENT_STATUSES = ["NONE", "ACTIVE", "EXPIRED", "REVOKED"];
var PUBLICATION_STATUSES = ["PRIVATE", "PENDING_REVIEW", "PUBLISHED", "REVOKED"];
var ATTITUDES = ["recommend", "neutral", "not_recommend"];
var ATTITUDE_LABEL = {
  recommend: "\u63A8\u8350",
  neutral: "\u4E00\u822C",
  not_recommend: "\u4E0D\u63A8\u8350"
};
var DISCLOSURES = ["none", "owner_or_staff", "invited_tasting", "gifted_or_promoted", "other"];
var DISCLOSURE_LABEL = {
  none: "\u65E0\u5173\u8054\uFF0C\u81EA\u8D39\u5B9E\u5403",
  owner_or_staff: "\u5E97\u65B9\u6216\u5458\u5DE5",
  invited_tasting: "\u53D7\u9080\u8BD5\u5403",
  gifted_or_promoted: "\u83B7\u8D60\u6216\u63A8\u5E7F",
  other: "\u5176\u4ED6\u5173\u8054"
};
var REPORT_KINDS = ["closed", "wrong_location", "wrong_info", "abuse"];
var REPORT_KIND_LABEL = {
  closed: "\u95ED\u5E97\uFF0F\u642C\u8D70",
  wrong_location: "\u4F4D\u7F6E\u6709\u8BEF",
  wrong_info: "\u4FE1\u606F\u6709\u8BEF",
  abuse: "\u5185\u5BB9\u8FDD\u89C4"
};
var REPORT_STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"];
var REPORT_STATUS_LABEL = {
  OPEN: "\u5F85\u5904\u7406",
  IN_REVIEW: "\u590D\u6838\u4E2D",
  RESOLVED: "\u5DF2\u5904\u7406",
  DISMISSED: "\u5DF2\u9A73\u56DE"
};
var REPORT_ACTIONS = ["start", "resolve", "dismiss"];
var REPORT_ACTION_LABEL = {
  start: "\u5F00\u59CB\u590D\u6838",
  resolve: "\u786E\u8BA4\u5E76\u7ED3\u6848",
  dismiss: "\u9A73\u56DE"
};
var ROLES = ["user", "editor", "moderator", "admin"];
var LAYERS = ["qualified", "pending_verification"];
var ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VERSION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "QUERY_EXPIRED",
  "RATE_LIMITED",
  "PROVIDER_UNAVAILABLE"
];
var ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  QUERY_EXPIRED: 409,
  RATE_LIMITED: 429,
  PROVIDER_UNAVAILABLE: 503
};
var RULE_VERSION = "recommendation-v1";
var CONTRACT_VERSION = "2.0-demo-2";

// ../packages/contracts/src/geo.ts
var PI = Math.PI;
var A = 6378245;
var EE = 0.006693421622965943;
function outOfChina(lng, lat) {
  return !(lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}
function transformLng(x, y) {
  let r2 = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r2 += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  r2 += (20 * Math.sin(y * PI) + 40 * Math.sin(y / 3 * PI)) * 2 / 3;
  r2 += (160 * Math.sin(y / 12 * PI) + 320 * Math.sin(y * PI / 30)) * 2 / 3;
  return r2;
}
function transformLat(x, y) {
  let r2 = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r2 += (20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2 / 3;
  r2 += (20 * Math.sin(x * PI / 12) + 40 * Math.sin(x * PI / 30)) * 2 / 3;
  r2 += (150 * Math.sin(x / 12 * PI) + 300 * Math.sin(x / 30 * PI)) * 2 / 3;
  return r2;
}
function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat };
  const d = delta(lng, lat);
  return { lng: lng + d.dLng, lat: lat + d.dLat };
}
function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) return { lng, lat };
  const d = delta(lng, lat);
  return { lng: lng - d.dLng, lat: lat - d.dLat };
}
function delta(lng, lat) {
  let dLat = transformLat(lng - 105, lat - 35);
  let dLng = transformLng(lng - 105, lat - 35);
  const radLat = lat / 180 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = dLat * 180 / (A * (1 - EE) / (magic * sqrtMagic) * PI);
  dLng = dLng * 180 / (A / sqrtMagic * Math.cos(radLat) * PI);
  return { dLng, dLat };
}
function straightLineMeters(a, b) {
  const R = 63710088e-1;
  const p1 = a.lat * PI / 180;
  const p2 = b.lat * PI / 180;
  const dp = p2 - p1;
  const dl = (b.lng - a.lng) * PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
function isValidGcj02(lng, lat) {
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= 73.66 && lng <= 135.05 && lat >= 3.86 && lat <= 53.55;
}
var BEIJING_BOUNDS = { west: 115.42, south: 39.44, east: 117.52, north: 41.06 };
var BEIJING_CENTER = { lng: 116.407, lat: 39.904 };
function gridCell(lng, lat, zoom) {
  const cellDeg = cellDegForZoom(zoom);
  return { gx: Math.floor(lng / cellDeg), gy: Math.floor(lat / cellDeg) };
}
function cellDegForZoom(zoom) {
  if (zoom >= 15) return 9e-4;
  if (zoom >= 13) return 4e-3;
  if (zoom >= 11) return 0.016;
  if (zoom >= 9) return 0.062;
  return 0.25;
}
function clusterPoints(items, zoom, maxEntities) {
  const bucket = zoomBucket(zoom);
  const cellDeg = cellDegForZoom(bucket);
  const groups = /* @__PURE__ */ new Map();
  for (const it of items) {
    const key = `${Math.floor(it.lng / cellDeg)}:${Math.floor(it.lat / cellDeg)}`;
    const arr = groups.get(key);
    if (arr) arr.push(it);
    else groups.set(key, [it]);
  }
  const out = [];
  for (const [key, group] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const parts = key.split(":");
    const gx = Number(parts[0]);
    const gy = Number(parts[1]);
    const lng = group.reduce((s, i) => s + i.lng, 0) / group.length;
    const lat = group.reduce((s, i) => s + i.lat, 0) / group.length;
    out.push({
      clusterId: `v1-z${bucket}-x${gx}-y${gy}`,
      lng,
      lat,
      items: group,
      expansionBounds: {
        west: gx * cellDeg,
        south: gy * cellDeg,
        east: (gx + 1) * cellDeg,
        north: (gy + 1) * cellDeg
      }
    });
  }
  out.sort((a, b) => b.items.length - a.items.length || a.clusterId.localeCompare(b.clusterId));
  void maxEntities;
  return out;
}
function zoomBucket(zoom) {
  return Math.max(6, Math.min(18, Math.floor(zoom)));
}

// ../packages/contracts/src/rules.ts
var systemClock = { now: () => Date.now() };
var SCORING_WINDOW_DAYS = 180;
var SHANGHAI_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
function shanghaiToday(clock = systemClock) {
  const parts = SHANGHAI_DATE.formatToParts(new Date(clock.now()));
  const get = (t) => {
    var _a, _b;
    return (_b = (_a = parts.find((p) => p.type === t)) == null ? void 0 : _a.value) != null ? _b : "00";
  };
  return `${get("year")}-${get("month")}-${get("day")}`;
}
var SHANGHAI_STAMP = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});
function shanghaiParts(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const parts = SHANGHAI_STAMP.formatToParts(new Date(ms));
  const get = (t) => {
    var _a, _b;
    return (_b = (_a = parts.find((p) => p.type === t)) == null ? void 0 : _a.value) != null ? _b : "00";
  };
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
function shanghaiDay(iso) {
  var _a, _b;
  return (_b = (_a = shanghaiParts(iso)) == null ? void 0 : _a.date) != null ? _b : iso.slice(0, 10);
}
function shanghaiDateTime(iso) {
  const p = shanghaiParts(iso);
  return p ? `${p.date} ${p.time}` : iso.slice(0, 16).replace("T", " ");
}
function fromYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return { y: y != null ? y : 0, m: m != null ? m : 0, d: d != null ? d : 0 };
}
function dayIndex(date) {
  const { y, m, d } = fromYmd(date);
  return Math.floor(Date.UTC(y, m - 1, d, 4, 0, 0) / 864e5);
}
function addDays(date, days) {
  const { y, m, d } = fromYmd(date);
  const t = new Date(Date.UTC(y, m - 1, d) + days * 864e5);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
function daysBetween(from, to) {
  return dayIndex(to) - dayIndex(from);
}
function isInScoringWindow(visitedDate, today) {
  const oldest = addDays(today, -(SCORING_WINDOW_DAYS - 1));
  const idx = dayIndex(visitedDate);
  return idx >= dayIndex(oldest) && idx <= dayIndex(today);
}
function isFutureVisitDate(visitedDate, today) {
  return dayIndex(visitedDate) > dayIndex(today);
}
function assertVisitDate(visitedDate, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedDate)) {
    throw new RuleViolation("\u5B9E\u5403\u65E5\u671F\u683C\u5F0F\u5FC5\u987B\u662F YYYY-MM-DD");
  }
  if (isFutureVisitDate(visitedDate, today)) {
    throw new RuleViolation("\u4E0D\u80FD\u63D0\u4EA4\u672A\u6765\u7684\u5B9E\u5403\u65E5\u671F");
  }
}
var RuleViolation = class extends Error {
};
function tallyCommunity(rows, currentLocationVersion, today) {
  const counts = { recommend: 0, neutral: 0, not_recommend: 0 };
  const counted = [];
  for (const r2 of rows) {
    if (r2.location_version !== currentLocationVersion) continue;
    if (r2.content_status !== "APPROVED") continue;
    if (r2.disclosure !== "none") continue;
    if (r2.author_status !== "active") continue;
    if (!isInScoringWindow(r2.visited_date, today)) continue;
    if (!ATTITUDES.includes(r2.attitude)) continue;
    counts[r2.attitude] += 1;
    counted.push(r2.id);
  }
  return {
    recommend: counts.recommend,
    neutral: counts.neutral,
    not_recommend: counts.not_recommend,
    total: counts.recommend + counts.neutral + counts.not_recommend,
    window_start: addDays(today, -(SCORING_WINDOW_DAYS - 1)),
    window_end: today,
    counted_ids: counted
  };
}
function communityQualification(t, previouslyQualified) {
  const R = t.recommend;
  const T = t.total;
  const qualified = T > 0 && R >= 3 && 4 * R >= 3 * T;
  if (qualified) return "QUALIFIED";
  return previouslyQualified ? "LAPSED" : "PENDING";
}
function endorsementActive(visitedDate, today, status) {
  if (status !== "ACTIVE") return false;
  return dayIndex(today) <= dayIndex(addDays(visitedDate, SCORING_WINDOW_DAYS - 1));
}
function endorsementStatusOn(visitedDate, today) {
  return dayIndex(today) <= dayIndex(addDays(visitedDate, SCORING_WINDOW_DAYS - 1)) ? "ACTIVE" : "EXPIRED";
}
function evaluatePublicMapEligibility(i) {
  const reasons = [];
  if (i.deleted) reasons.push("\u95E8\u5E97\u5DF2\u5220\u9664");
  if (i.merged_into) reasons.push("\u95E8\u5E97\u5DF2\u5408\u5E76\u5230canonical");
  if (!i.profile_public) reasons.push("\u95E8\u5E97\u8D44\u6599\u672A\u516C\u5F00");
  if (i.place_status !== "VERIFIED") reasons.push("\u5730\u70B9\u672A\u6838\u9A8C\u901A\u8FC7");
  if (i.business_status === "CLOSED") reasons.push("\u5DF2\u786E\u8BA4\u95ED\u5E97");
  if (i.business_status === "SUSPECTED_CLOSED") reasons.push("\u7591\u4F3C\u95ED\u5E97\uFF0C\u7B49\u5F85\u590D\u6838");
  if (i.risk_status === "REVIEW_REQUIRED") reasons.push("\u98CE\u9669\u590D\u6838\u4E2D");
  if (i.risk_status === "BLOCKED") reasons.push("\u98CE\u9669\u963B\u65AD");
  const communityOk = i.community === "QUALIFIED";
  const editorialOk = i.endorsement === "ACTIVE";
  if (!communityOk && !editorialOk) reasons.push("\u65E0\u6709\u6548\u63A8\u8350\u6765\u6E90");
  const blocked = i.deleted || !!i.merged_into || !i.profile_public || i.place_status !== "VERIFIED" || i.business_status !== "OPEN" && i.business_status !== "UNKNOWN" || i.risk_status !== "CLEAR" || !communityOk && !editorialOk;
  const sources = [];
  if (communityOk) sources.push("community");
  if (editorialOk) sources.push("editorial");
  return { in_default_layer: !blocked, sources, reasons };
}
var CONTENT_TRANSITIONS = [
  { from: "DRAFT", to: "PENDING", actor: "author" },
  { from: "PENDING", to: "APPROVED", actor: "moderator" },
  { from: "PENDING", to: "REJECTED", actor: "moderator" },
  { from: "APPROVED", to: "HIDDEN", actor: "moderator" },
  { from: "APPROVED", to: "WITHDRAWN", actor: "author" },
  { from: "PENDING", to: "WITHDRAWN", actor: "author" },
  { from: "DRAFT", to: "WITHDRAWN", actor: "author" },
  { from: "REJECTED", to: "PENDING", actor: "author" }
];
function canTransition(from, to, actor) {
  return CONTENT_TRANSITIONS.some((r2) => r2.from === from && r2.to === to && (r2.actor === actor || actor === "system"));
}
var CANDIDATE_DUP_RADIUS_M = 150;
var CANDIDATE_MAX_DUP_HINTS = 5;
var CANDIDATE_MIN_EVIDENCE_CHARS = 10;
var CANDIDATE_MAX_EVIDENCE_CHARS = 300;
var CANDIDATE_TRANSITIONS = [
  { from: "PENDING", to: "VERIFIED", actor: "moderator" },
  { from: "PENDING", to: "REJECTED", actor: "moderator" },
  { from: "PENDING", to: "MERGED", actor: "moderator" },
  { from: "REJECTED", to: "PENDING", actor: "author" }
];
var REPORT_TRANSITIONS = [
  { from: "OPEN", to: "IN_REVIEW", actor: "moderator" },
  { from: "OPEN", to: "RESOLVED", actor: "moderator" },
  { from: "OPEN", to: "DISMISSED", actor: "moderator" },
  { from: "IN_REVIEW", to: "RESOLVED", actor: "moderator" },
  { from: "IN_REVIEW", to: "DISMISSED", actor: "moderator" }
];
var REPORT_ACTION_TARGET = {
  start: "IN_REVIEW",
  resolve: "RESOLVED",
  dismiss: "DISMISSED"
};
function canTransitionReport(from, to, actor) {
  return REPORT_TRANSITIONS.some((r2) => r2.from === from && r2.to === to && r2.actor === actor);
}
function canTransitionCandidate(from, to, actor) {
  return CANDIDATE_TRANSITIONS.some((r2) => r2.from === from && r2.to === to && r2.actor === actor);
}
function normalizeStoreName(name) {
  return name.trim().toLowerCase().replace(/[（）]/g, (c) => c === "\uFF08" ? "(" : ")").replace(/[\s·・．.\-_—]/g, "");
}
function branchKey(branch) {
  return normalizeStoreName(branch != null ? branch : "");
}
function matchDuplicates(cand, existing, opts = {}) {
  var _a;
  const radius = (_a = opts.radiusM) != null ? _a : CANDIDATE_DUP_RADIUS_M;
  const name = normalizeStoreName(cand.name);
  const branch = branchKey(cand.branch);
  const hits = [];
  for (const e of existing) {
    if (opts.excludeId && e.id === opts.excludeId) continue;
    if (cand.provider && cand.poi_id && e.provider === cand.provider && e.poi_id === cand.poi_id) {
      hits.push({ match: e, reason: "same_poi_id", distance_m: null });
      continue;
    }
    if (!name || normalizeStoreName(e.name) !== name) continue;
    const distance = Math.round(straightLineMeters(cand, e));
    if (branchKey(e.branch) === branch && distance <= radius) {
      hits.push({ match: e, reason: "name_nearby", distance_m: distance });
    } else {
      hits.push({ match: e, reason: "same_name_far", distance_m: distance });
    }
  }
  const rank = { same_poi_id: 0, name_nearby: 1, same_name_far: 2, same_author_pending: 3 };
  return hits.sort((a, b) => {
    var _a2, _b;
    return rank[a.reason] - rank[b.reason] || ((_a2 = a.distance_m) != null ? _a2 : 0) - ((_b = b.distance_m) != null ? _b : 0);
  }).slice(0, CANDIDATE_MAX_DUP_HINTS);
}

// ../packages/contracts/src/seed.ts
var SEED_USERS = [
  { id: "U01", display_name: "\u6D4B\u8BD5\u98DF\u5BA201", roles: ["user"], phone: "138****0001" },
  { id: "U02", display_name: "\u6D4B\u8BD5\u98DF\u5BA202", roles: ["user"], phone: "138****0002" },
  { id: "U03", display_name: "\u6D4B\u8BD5\u98DF\u5BA203", roles: ["user"], phone: "138****0003" },
  { id: "U04", display_name: "\u6D4B\u8BD5\u98DF\u5BA204", roles: ["user"], phone: "138****0004" },
  { id: "U05", display_name: "\u6D4B\u8BD5\u98DF\u5BA205", roles: ["user"], phone: "138****0005" },
  { id: "U06", display_name: "\u6D4B\u8BD5\u98DF\u5BA206\uFF08\u5DF2\u6CE8\u9500\uFF09", roles: ["user"], phone: "138****0006" },
  { id: "E01", display_name: "\u6D4B\u8BD5\u7F16\u8F9101", roles: ["user", "editor"], phone: "138****0101" },
  { id: "M01", display_name: "\u6D4B\u8BD5\u5BA1\u6838\u545801", roles: ["user", "moderator"], phone: "138****0201" },
  { id: "A01", display_name: "\u6D4B\u8BD5\u7BA1\u7406\u545801", roles: ["user", "moderator", "admin"], phone: "138****0301" }
];
var DEMO_LOGIN_CODE = "888888";
var dishesGuizhou = ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C", "\u80A0\u65FA\u9762", "\u4E1D\u5A03\u5A03", "\u6298\u8033\u6839\u62CC\u8C46\u8150", "\u82B1\u6EAA\u725B\u8089\u7C89", "\u7CDF\u8FA3\u8106\u76AE\u9C7C", "\u70D9\u9505\u571F\u8C46"];
var dishesSichuan = ["\u6C34\u716E\u725B\u8089", "\u9EBB\u5A46\u8C46\u8150", "\u94B5\u94B5\u9E21", "\u592B\u59BB\u80BA\u7247", "\u751C\u6C34\u9762"];
var dishesChongqing = ["\u91CD\u5E86\u5C0F\u9762", "\u6BDB\u8840\u65FA", "\u8FA3\u5B50\u9E21", "\u7897\u6742\u9762"];
var dishesYunnan = ["\u5C0F\u9505\u7C73\u7EBF", "\u6C7D\u9505\u9E21", "\u9C9C\u82B1\u997C", "\u83CC\u5B50\u706B\u9505"];
var dishesOther = ["\u70E4\u9E2D", "\u94DC\u9505\u6DAE\u8089", "\u70B8\u9171\u9762"];
function r(id, name, branch, cuisines, area, lng, lat, price_avg, dish_highlights, taste_tags, note, extra = {}) {
  return {
    id,
    name,
    branch,
    cuisines,
    address: `\u5317\u4EAC\u5E02${area}\uFF08\u6F14\u793A\u5730\u5740\uFF0C\u975E\u771F\u5B9E\u95E8\u5E97\u4F4D\u7F6E\uFF09`,
    floor_info: null,
    lng,
    lat,
    price_avg,
    price_reports: price_avg === null ? 0 : 3,
    dish_highlights,
    taste_tags,
    profile_public: true,
    place_status: "VERIFIED",
    place_verified_days_ago: 21,
    business_status: "OPEN",
    risk_status: "CLEAR",
    location_version: 1,
    ever_qualified: false,
    note,
    ...extra
  };
}
var SEED_RESTAURANTS = [
  r("R01", "\u6D4B\u8BD5\xB7\u9ED4\u6C5F\u9178\u6C64\u7C89", "\u671B\u4EAC\u5E97", ["guizhou"], "\u671D\u9633\u533A\u671B\u4EAC", 116.47, 39.996, 68, [dishesGuizhou[0], dishesGuizhou[4]], ["\u9178", "\u8FA3", "\u7C73\u7C89"], "\u793E\u533A\u8FBE\u6807\u6837\u677F\u5E97\uFF083 \u63A8\u8350 0 \u4E0D\u63A8\u8350\uFF09"),
  r("R02", "\u6D4B\u8BD5\xB7\u9ED4\u6C5F\u9178\u6C64\u7C89", "\u671B\u4EAC\u540C\u5B9E\u4F53\u91CD\u590D\u5019\u9009", ["guizhou"], "\u671D\u9633\u533A\u671B\u4EAC", 116.4701, 39.9961, null, [dishesGuizhou[0]], ["\u9178"], "\u95E8\u5E97\u5408\u5E76\u6F14\u793A\uFF1A\u4E0E R01 \u89C6\u4E3A\u540C\u4E00\u5B9E\u4F53\u5019\u9009", { place_status: "PENDING", place_verified_days_ago: null }),
  r("R03", "\u6D4B\u8BD5\xB7\u9ED4\u6C5F\u9178\u6C64\u7C89", "\u53CC\u4E95\u5E97", ["guizhou"], "\u671D\u9633\u533A\u53CC\u4E95", 116.465, 39.893, 72, [dishesGuizhou[1]], ["\u8FA3"], "\u540C\u54C1\u724C\u4E0D\u540C\u5206\u5E97\uFF1A\u7968\u6570\u72EC\u7ACB\u8BA1\u7B97"),
  r("R04", "\u6D4B\u8BD5\xB7\u6458\u661F\u5C0F\u9986", "\u4E09\u91CC\u5C6F\u5E97", ["guizhou"], "\u671D\u9633\u533A\u4E09\u91CC\u5C6F", 116.455, 39.937, 158, [dishesGuizhou[5], dishesGuizhou[3]], ["\u9178", "\u6298\u8033\u6839"], "\u66FE\u8FBE\u6807\u540E\u5931\u7968\u6F14\u793A\uFF1A3 \u63A8\u8350 1 \u4E00\u822C 1 \u4E0D\u63A8\u8350\uFF0C4R=12 < 3T=15 \u2192 LAPSED", { ever_qualified: true }),
  r("R05", "\u6D4B\u8BD5\xB7\u8700\u9999\u5C45", "\u4E2D\u5173\u6751\u5E97", ["sichuan"], "\u6D77\u6DC0\u533A\u4E2D\u5173\u6751", 116.316, 39.984, 92, [dishesSichuan[0], dishesSichuan[1]], ["\u9EBB\u8FA3"], "\u7F16\u8F91\u80CC\u4E66\u6837\u677F\u5E97\uFF08\u793E\u533A\u672A\u8FBE\u6807\uFF0C\u9760 ACTIVE \u80CC\u4E66\u8FDB\u56FE\uFF09", {
    editorial: {
      author: "E01",
      visited_days_ago: 40,
      reason: "\u6D4B\u8BD5\u7F16\u8F91\u5B9E\u5403\u80CC\u4E66\uFF08\u5408\u6210\u5185\u5BB9\uFF09\uFF1A\u6C34\u716E\u725B\u8089\u9EBB\u8FA3\u5C42\u6B21\u6E05\u6670\uFF0C\u7F16\u8F91\u672C\u4EBA\u5230\u5E97\uFF0C\u53E6\u4E00\u5BA1\u6838\u5458\u5DF2\u6838\u9A8C\u3002",
      verifier: "M01"
    }
  }),
  r("R06", "\u6D4B\u8BD5\xB7\u5C71\u57CE\u9762\u9986", "\u52B2\u677E\u5E97", ["chongqing", "sichuan"], "\u671D\u9633\u533A\u52B2\u677E", 116.459, 39.879, 35, [dishesChongqing[0]], ["\u9EBB\u8FA3", "\u9762"], "\u591A\u6807\u7B7E\u95E8\u5E97\uFF1A\u8D35\u5DDE/\u897F\u5357\u89C6\u56FE\u53BB\u91CD\u8BA1\u6570\u6F14\u793A"),
  r("R07", "\u6D4B\u8BD5\xB7\u6EC7\u5473\u5C0F\u9505", "\u4E94\u9053\u53E3\u5E97", ["yunnan"], "\u6D77\u6DC0\u533A\u4E94\u9053\u53E3", 116.338, 39.992, 58, [dishesYunnan[0], dishesYunnan[3]], ["\u9C9C", "\u83CC\u5B50"], "\u5F85\u9A8C\u8BC1\u56FE\u5C42\u6F14\u793A\uFF1A\u5730\u70B9 PENDING", { place_status: "PENDING", place_verified_days_ago: null }),
  r("R08", "\u6D4B\u8BD5\xB7\u9ED4\u5473\u697C", "\u65B9\u5E84\u5E97", ["guizhou"], "\u4E30\u53F0\u533A\u65B9\u5E84", 116.428, 39.862, 110, [dishesGuizhou[2]], ["\u9178"], "\u7591\u4F3C\u95ED\u5E97\uFF1A3 \u6761\u95ED\u5E97\u53CD\u9988\u751F\u6210\u5DE5\u5355\uFF0C\u4F46\u4E0D\u81EA\u52A8\u963B\u65AD", {
    business_status: "SUSPECTED_CLOSED",
    risk_status: "REVIEW_REQUIRED"
  }),
  r("R09", "\u6D4B\u8BD5\xB7\u8001\u51EF\u91CC", "\u56DE\u9F99\u89C2\u5E97", ["guizhou"], "\u660C\u5E73\u533A\u56DE\u9F99\u89C2", 116.336, 40.072, 76, [dishesGuizhou[0]], ["\u9178"], "\u5DF2\u786E\u8BA4\u95ED\u5E97\uFF1A\u4E0D\u8FDB\u9ED8\u8BA4\u5C42\uFF0C\u8BE6\u60C5\u4ECD\u53EF\u770B\u5386\u53F2", { business_status: "CLOSED" }),
  r("R10", "\u6D4B\u8BD5\xB7\u5DDD\u5317\u51C9\u7C89", "\u56FD\u8D38\u5E97", ["sichuan"], "\u671D\u9633\u533A\u56FD\u8D38", 116.461, 39.909, 45, [dishesSichuan[2]], ["\u9EBB\u8FA3", "\u51C9"], "\u540C\u5750\u6807\u591A\u5E97\u6F14\u793A\uFF08\u4E0E R11 \u5B8C\u5168\u540C\u70B9\uFF09"),
  r("R11", "\u6D4B\u8BD5\xB7\u91CD\u5E86\u7897\u6742\u9762", "\u56FD\u8D38\u5E97", ["chongqing"], "\u671D\u9633\u533A\u56FD\u8D38", 116.461, 39.909, null, [dishesChongqing[3]], ["\u9EBB\u8FA3"], "\u540C\u5750\u6807\u591A\u5E97\u6F14\u793A\uFF08\u4E0E R10 \u5B8C\u5168\u540C\u70B9\uFF09"),
  r("R12", "\u6D4B\u8BD5\xB7\u4E91\u817F\u7C73\u7EBF", "\u897F\u5355\u5E97", ["yunnan"], "\u897F\u57CE\u533A\u897F\u5355", 116.373, 39.912, 42, [dishesYunnan[0]], ["\u9C9C"], "\u9884\u7B97\u672A\u77E5\u6F14\u793A\uFF1A\u9009\u9884\u7B97\u65F6\u9ED8\u8BA4\u4E0D\u5339\u914D"),
  r("R13", "\u6D4B\u8BD5\xB7\u5317\u4EAC\u70E4\u9E2D\u574A", "\u524D\u95E8\u5E97", ["other"], "\u897F\u57CE\u533A\u524D\u95E8", 116.397, 39.899, 268, [dishesOther[0]], ["\u5176\u4ED6"], "\u5317\u4EAC\u5176\u4ED6\u83DC\u7CFB\u89C6\u56FE\u6F14\u793A"),
  r("R14", "\u6D4B\u8BD5\xB7\u94DC\u9505\u5C45", "\u725B\u8857\u5E97", ["other"], "\u897F\u57CE\u533A\u725B\u8857", 116.366, 39.888, 145, [dishesOther[1]], ["\u5176\u4ED6"], "\u5317\u4EAC\u5176\u4ED6\u83DC\u7CFB\u89C6\u56FE\u6F14\u793A"),
  r("R15", "\u6D4B\u8BD5\xB7\u9178\u6C64\u725B\u8089\u7C89", "\u6D77\u6DC0\u9EC4\u5E84\u5E97", ["guizhou"], "\u6D77\u6DC0\u533A\u6D77\u6DC0\u9EC4\u5E84", 116.326, 39.976, 39, [dishesGuizhou[4]], ["\u9178", "\u8FA3"], "2 \u63A8\u8350 0 \u4E0D\u63A8\u8350\uFF1AR>=3 \u4E0D\u6EE1\u8DB3\uFF0C\u4FDD\u6301 PENDING"),
  r("R16", "\u6D4B\u8BD5\xB7\u6298\u8033\u6839\u5C0F\u9986", "\u52B2\u677E\u5E97", ["guizhou"], "\u671D\u9633\u533A\u52B2\u677E", 116.462, 39.881, 55, [dishesGuizhou[3]], ["\u6298\u8033\u6839"], "\u8BCD\u6C47\u522B\u540D\u6F14\u793A\uFF1A\u6298\u8033\u6839/\u9C7C\u8165\u8349"),
  r("R17", "\u6D4B\u8BD5\xB7\u8D35\u5DDE\u70D9\u9505", "\u4E9A\u8FD0\u6751\u5E97", ["guizhou"], "\u671D\u9633\u533A\u4E9A\u8FD0\u6751", 116.407, 39.999, 88, ["\u70D9\u9505\u571F\u8C46", dishesGuizhou[1]], ["\u8FA3"], "\u624B\u52A8\u9009\u70B9\u6295\u7A3F\u6F14\u793A\u5E97\uFF08\u672A\u5BA1\u6838\u524D\u4E0D\u8FDB\u56FE\uFF09"),
  r("R18", "\u6D4B\u8BD5\xB7\u8FA3\u5B50\u9E21\u4E13\u95E8\u5E97", "\u671B\u4EAC\u5E97", ["chongqing", "guizhou"], "\u671D\u9633\u533A\u671B\u4EAC", 116.478, 39.999, null, ["\u8FA3\u5B50\u9E21"], ["\u9EBB\u8FA3"], "\u98CE\u9669\u963B\u65AD\u6F14\u793A\uFF1ABLOCKED \u65F6\u4E24\u79CD\u6765\u6E90\u90FD\u4E0D\u653E\u884C", { risk_status: "BLOCKED" }),
  r("R19", "\u6D4B\u8BD5\xB7\u82D7\u5BB6\u9178\u6C64\u9C7C", "\u9A6C\u8FDE\u9053\u5E97", ["guizhou"], "\u897F\u57CE\u533A\u9A6C\u8FDE\u9053", 116.321, 39.891, 120, [dishesGuizhou[0]], ["\u9178"], "\u642C\u8FC1\u6F14\u793A\uFF1Alocation_version \u9012\u589E\u540E\u65E7\u5740\u7968\u53EA\u4F5C\u5386\u53F2", { location_version: 2, place_status: "PENDING", place_verified_days_ago: null, ever_qualified: true }),
  r("R20", "\u6D4B\u8BD5\xB7\u4E1D\u5A03\u5A03\u5DE5\u4F5C\u5BA4", "\u4EAE\u9A6C\u6865\u5E97", ["guizhou"], "\u671D\u9633\u533A\u4EAE\u9A6C\u6865", 116.463, 39.948, 78, [dishesGuizhou[2]], ["\u9178", "\u6E05\u6DE1"], "\u53D7\u9080\u8BD5\u5403\u6F14\u793A\uFF1A\u62AB\u9732\u540E\u516C\u5F00\u4F46\u4E0D\u8BA1\u7968"),
  r("R21", "\u6D4B\u8BD5\xB7\u5DDD\u5473\u94B5\u94B5\u9E21", "\u671D\u5916\u5E97", ["sichuan"], "\u671D\u9633\u533A\u671D\u5916", 116.449, 39.923, 30, [dishesSichuan[2]], ["\u9EBB\u8FA3"], "\u793E\u533A\u8FBE\u6807\u6837\u677F\u5E97 2"),
  r("R22", "\u6D4B\u8BD5\xB7\u4E91\u5357\u83CC\u5B50\u5C4B", "\u82CF\u5DDE\u8857\u5E97", ["yunnan"], "\u6D77\u6DC0\u533A\u82CF\u5DDE\u8857", 116.322, 39.989, 168, [dishesYunnan[3]], ["\u9C9C", "\u5B63\u8282\u9650\u5B9A"], "\u793E\u533A\u8FBE\u6807\u6837\u677F\u5E97 3\uFF08\u542B 1 \u6761\u771F\u5B9E\u8D1F\u9762\u53CD\u9988\uFF09"),
  r("R23", "\u6D4B\u8BD5\xB7\u9ED4\u83DC\u98DF\u5802", "\u5927\u6210\u8DEF\u5E97", ["guizhou"], "\u4E30\u53F0\u533A\u5927\u6210\u8DEF", 116.248, 39.878, 48, [dishesGuizhou[6]], ["\u8FA3"], "\u8425\u4E1A\u72B6\u6001 UNKNOWN \u6F14\u793A\uFF1A\u8FDB\u56FE\u4F46\u6807\u6CE8\u8425\u4E1A\u672A\u6838\u5B9E", { business_status: "UNKNOWN" }),
  r("R24", "\u6D4B\u8BD5\xB7\u79C1\u85CF\u5C0F\u9505\u996D", "\u6765\u5E7F\u8425\u5E97", ["guizhou"], "\u671D\u9633\u533A\u6765\u5E7F\u8425", 116.442, 40.041, null, ["\u5C0F\u9505\u996D"], [""], "\u4E2A\u4EBA\u79C1\u85CF\u6E05\u5355\u6F14\u793A\u5E97\uFF08\u4E0D\u8FDB\u9ED8\u8BA4\u5C42\uFF1A\u5730\u70B9 PENDING\uFF09", { place_status: "PENDING", place_verified_days_ago: null }),
  // ---------------------------------------------------------- 常见品类扩充（R25–R42，全部合成）
  // 这些是"北京常见的店型"：烧烤、火锅、串串、铜锅涮肉、小吃、面馆、烘焙、茶点、早茶。
  // 走的是说明书里的「北京其他」视图（CUISINES 的 other 标签），不是贵州/西南分类的扩张；
  // 名字、地址、坐标、人均与票数全部是合成占位，不代表任何真实餐馆。
  r("R25", "\u6D4B\u8BD5\xB7\u5317\u65B0\u6865\u70E7\u70E4", "\u603B\u5E97", ["other"], "\u4E1C\u57CE\u533A\u5317\u65B0\u6865", 116.41, 39.941, 95, ["\u70E4\u7F8A\u8089\u4E32", "\u70E4\u9E21\u7FC5"], ["\u70E7\u70E4", "\u591C\u5BB5"], "\u5E38\u89C1\u54C1\u7C7B\u6837\u677F\uFF1A\u70E7\u70E4\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R26", "\u6D4B\u8BD5\xB7\u7C0B\u8857\u9EBB\u5C0F", "\u4E1C\u76F4\u95E8\u5E97", ["other"], "\u4E1C\u57CE\u533A\u4E1C\u76F4\u95E8\u5185", 116.421, 39.942, 150, ["\u9EBB\u8FA3\u5C0F\u9F99\u867E"], ["\u8FA3", "\u591C\u5BB5"], "\u5E38\u89C1\u54C1\u7C7B\u6837\u677F\uFF1A\u5C0F\u9F99\u867E\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R27", "\u6D4B\u8BD5\xB7\u5DDD\u6E1D\u4E32\u4E32\u9999", "\u4E09\u91CC\u5C6F\u5E97", ["sichuan", "chongqing"], "\u671D\u9633\u533A\u4E09\u91CC\u5C6F", 116.452, 39.938, 78, ["\u725B\u8089\u4E32\u4E32", "\u94B5\u94B5\u9E21"], ["\u9EBB\u8FA3"], "\u591A\u6807\u7B7E\u6F14\u793A\uFF1A\u540C\u65F6\u5C5E\u5DDD\u4E0E\u6E1D\uFF0C\u897F\u5357\u89C6\u56FE\u6309\u95E8\u5E97 ID \u53BB\u91CD"),
  r("R28", "\u6D4B\u8BD5\xB7\u8001\u5317\u4EAC\u94DC\u9505\u6DAE\u8089", "\u725B\u8857\u5E97", ["other"], "\u897F\u57CE\u533A\u725B\u8857", 116.365, 39.887, 130, ["\u94DC\u9505\u6DAE\u8089"], ["\u6E05\u6C64"], "\u5E38\u89C1\u54C1\u7C7B\u6837\u677F\uFF1A\u6DAE\u7F8A\u8089\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R29", "\u6D4B\u8BD5\xB7\u65B9\u7816\u5382\u70B8\u9171\u9762", "\u603B\u5E97", ["other"], "\u4E1C\u57CE\u533A\u65B9\u5BB6\u80E1\u540C", 116.404, 39.936, 32, ["\u70B8\u9171\u9762"], ["\u9762\u98DF"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u9762\u9986\uFF0C\u53EA\u6709 2 \u7968 \u2192 \u672A\u8FBE\u6807\uFF08R>=3 \u4E0D\u6EE1\u8DB3\uFF09"),
  r("R30", "\u6D4B\u8BD5\xB7\u62A4\u56FD\u5BFA\u5C0F\u5403", "\u603B\u5E97", ["other"], "\u897F\u57CE\u533A\u62A4\u56FD\u5BFA", 116.374, 39.935, 28, ["\u8C46\u6C41\u7126\u5708", "\u9A74\u6253\u6EDA"], ["\u5C0F\u5403"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u4F20\u7EDF\u5C0F\u5403\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R31", "\u6D4B\u8BD5\xB7\u671D\u9633\u70D8\u7119\u5DE5\u574A", "\u53CC\u4E95\u5E97", ["other"], "\u671D\u9633\u533A\u53CC\u4E95", 116.468, 39.892, 45, ["\u53EF\u9882"], ["\u751C\u70B9"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u70D8\u7119\u5496\u5561\uFF0C1 \u7968\u4E0D\u8FBE\u6807"),
  r("R32", "\u6D4B\u8BD5\xB7\u671B\u4EAC\u51B7\u9762\u70E4\u8089", "\u671B\u4EAC\u5E97", ["other"], "\u671D\u9633\u533A\u671B\u4EAC", 116.472, 39.994, 40, ["\u51B7\u9762", "\u70E4\u8089"], ["\u70E7\u70E4"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u671D\u9C9C\u65CF\u51B7\u9762\u4E0E\u70E4\u8089\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R33", "\u6D4B\u8BD5\xB7\u9EBB\u8FA3\u70EB\u7814\u7A76\u6240", "\u4E94\u9053\u53E3\u5E97", ["sichuan"], "\u6D77\u6DC0\u533A\u4E94\u9053\u53E3", 116.337, 39.991, 26, ["\u9EBB\u8FA3\u70EB"], ["\u9EBB\u8FA3"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u9EBB\u8FA3\u70EB\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R34", "\u6D4B\u8BD5\xB7\u4E91\u5357\u70E7\u70E4\u5C0F\u9986", "\u52B2\u677E\u5E97", ["yunnan"], "\u671D\u9633\u533A\u52B2\u677E", 116.455, 39.88, 66, ["\u70E4\u8C46\u8150", "\u83CC\u5B50\u706B\u9505"], ["\u70E7\u70E4", "\u9C9C"], "\u5E38\u89C1\u54C1\u7C7B\u5E26\u8D1F\u9762\u7968\uFF1A3 \u63A8\u8350 1 \u4E0D\u63A8\u8350\u4ECD\u8FBE\u6807\uFF084R=12 >= 3T=12\uFF09"),
  r("R35", "\u6D4B\u8BD5\xB7\u8D35\u9633\u70D9\u9505\u70E7\u70E4", "\u65B9\u5E84\u5E97", ["guizhou"], "\u4E30\u53F0\u533A\u65B9\u5E84", 116.43, 39.865, 58, ["\u70D9\u9505\u571F\u8C46", "\u70E4\u8111\u82B1"], ["\u8FA3", "\u70E7\u70E4"], "\u8D35\u5DDE\u83DC\u91CC\u7684\u70E7\u70E4\u54C1\u7C7B\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R36", "\u6D4B\u8BD5\xB7\u671D\u5916\u65E5\u5F0F\u5C45\u9152\u5C4B", "\u671D\u5916\u5E97", ["other"], "\u671D\u9633\u533A\u671D\u5916", 116.451, 39.925, 210, ["\u5BFF\u53F8\u62FC\u76D8"], ["\u65E5\u6599"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u65E5\u6599\uFF0C\u96F6\u7968 \u2192 \u65E0\u6709\u6548\u63A8\u8350\u6765\u6E90"),
  r("R37", "\u6D4B\u8BD5\xB7\u897F\u5355\u7CA4\u5F0F\u8336\u70B9", "\u897F\u5355\u5E97", ["other"], "\u897F\u57CE\u533A\u897F\u5355", 116.371, 39.91, 98, ["\u867E\u997A", "\u6D41\u6C99\u5305"], ["\u7CA4\u5F0F"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u8336\u70B9\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R38", "\u6D4B\u8BD5\xB7\u4E2D\u5173\u6751\u897F\u5317\u9762\u9986", "\u4E2D\u5173\u6751\u5E97", ["other"], "\u6D77\u6DC0\u533A\u4E2D\u5173\u6751", 116.318, 39.982, 30, ["\u6CB9\u6CFC\u9762"], ["\u9762\u98DF"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u897F\u5317\u9762\uFF0C2 \u7968\u672A\u8FBE\u6807"),
  r("R39", "\u6D4B\u8BD5\xB7\u4EA6\u5E84\u6DF1\u591C\u70E7\u70E4", "\u4EA6\u5E84\u5E97", ["other"], "\u5927\u5174\u533A\u4EA6\u5E84", 116.505, 39.79, 70, ["\u70E4\u8170\u5B50"], ["\u70E7\u70E4", "\u591C\u5BB5"], "\u5E38\u89C1\u54C1\u7C7B + \u8425\u4E1A\u72B6\u6001 UNKNOWN\uFF1A\u8FDB\u56FE\u4F46\u6807\u6CE8\u672A\u6838\u5B9E", { business_status: "UNKNOWN" }),
  r("R40", "\u6D4B\u8BD5\xB7\u901A\u5DDE\u7096\u83DC\u9986", "\u901A\u5DDE\u4E07\u8FBE\u5E97", ["other"], "\u901A\u5DDE\u533A\u901A\u5DDE\u4E07\u8FBE", 116.64, 39.9, 55, ["\u732A\u8089\u7096\u7C89\u6761"], ["\u5BB6\u5E38"], "\u5E38\u89C1\u54C1\u7C7B + \u5730\u70B9 PENDING\uFF1A\u53EA\u5728\u5F85\u9A8C\u8BC1\u56FE\u5C42", { place_status: "PENDING", place_verified_days_ago: null }),
  r("R41", "\u6D4B\u8BD5\xB7\u56DE\u9F99\u89C2\u5BB6\u5EAD\u706B\u9505", "\u56DE\u9F99\u89C2\u5E97", ["sichuan"], "\u660C\u5E73\u533A\u56DE\u9F99\u89C2", 116.334, 40.07, 88, ["\u9E33\u9E2F\u9505"], ["\u9EBB\u8FA3", "\u6E05\u6DE1"], "\u5E38\u89C1\u54C1\u7C7B\uFF1A\u793E\u533A\u706B\u9505\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R42", "\u6D4B\u8BD5\xB7\u77F3\u666F\u5C71\u65E9\u8336\u697C", "\u77F3\u666F\u5C71\u5E97", ["other"], "\u77F3\u666F\u5C71\u533A\u9C81\u8C37", 116.195, 39.906, 60, ["\u80A0\u7C89"], ["\u7CA4\u5F0F"], "\u5E38\u89C1\u54C1\u7C7B + \u98CE\u9669\u590D\u6838\u4E2D\uFF1A\u7968\u6570\u591F\u4E5F\u4E0D\u8FDB\u56FE", { risk_status: "REVIEW_REQUIRED" }),
  // ---------------------------------------------------------- 日料板块（R43–R49，全部合成）
  // 「北京其他」容纳非西南菜系的店型，日料是其中常见的一类。
  // 店名沿用用户提到的品类词（居酒屋/烧鸟/寿喜烧/寿司/拉面/汤豆腐/章鱼烧），
  // 但一律带「测试·」前缀：这些名字与地址、坐标、人均、票数都是合成占位，
  // 不代表任何真实商家，也不构成对同名真实店铺的事实陈述。
  r("R43", "\u6D4B\u8BD5\xB7\u79CB\u7530\u5BB6\u5C45\u9152\u5C4B", "\u4E09\u91CC\u5C6F\u5E97", ["other"], "\u671D\u9633\u533A\u4E09\u91CC\u5C6F", 116.454, 39.937, 165, ["\u70E7\u9E1F", "\u5BFF\u559C\u70E7", "\u6E05\u9152"], ["\u5C45\u9152\u5C4B", "\u591C\u5BB5"], "\u65E5\u6599\u677F\u5757\u6837\u677F\uFF1A\u5C45\u9152\u5C4B\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R44", "\u6D4B\u8BD5\xB7\u70E7\u9E1F\u6DF1\u591C\u98DF\u5802", "\u671B\u4EAC\u5E97", ["other"], "\u671D\u9633\u533A\u671B\u4EAC", 116.474, 39.995, 110, ["\u70E4\u9E21\u76AE", "\u70E7\u9E1F"], ["\u5C45\u9152\u5C4B", "\u591C\u5BB5"], "\u65E5\u6599\u677F\u5757\uFF1A\u70E7\u9E1F\uFF08\u793E\u533A\u8FBE\u6807\uFF09"),
  r("R45", "\u6D4B\u8BD5\xB7\u5BFF\u559C\u70E7\u4E13\u95E8\u5E97", "\u56FD\u8D38\u5E97", ["other"], "\u671D\u9633\u533A\u56FD\u8D38", 116.4625, 39.9095, 240, ["\u5BFF\u559C\u70E7", "\u548C\u725B"], ["\u751C\u54B8"], "\u65E5\u6599\u677F\u5757\uFF1A\u5BFF\u559C\u70E7\uFF0C\u4EBA\u5747\u6700\u9AD8\u6863\uFF08\u9884\u7B97\u7B5B\u9009\u6F14\u793A\uFF09"),
  r("R46", "\u6D4B\u8BD5\xB7\u672D\u5E4C\u62C9\u9762\u7AD9", "\u4E94\u9053\u53E3\u5E97", ["other"], "\u6D77\u6DC0\u533A\u4E94\u9053\u53E3", 116.3395, 39.9925, 52, ["\u5473\u564C\u62C9\u9762"], ["\u9762", "\u6D53\u6C64"], "\u65E5\u6599\u677F\u5757\uFF1A\u62C9\u9762\uFF0C2 \u7968\u672A\u8FBE\u6807"),
  r("R47", "\u6D4B\u8BD5\xB7\u6C5F\u6237\u524D\u5BFF\u53F8", "\u4EAE\u9A6C\u6865\u5E97", ["other"], "\u671D\u9633\u533A\u4EAE\u9A6C\u6865", 116.4645, 39.9485, 320, ["\u5BFF\u53F8\u62FC\u76D8", "\u9CD7\u9C7C"], ["\u65E5\u6599"], "\u65E5\u6599\u677F\u5757\uFF1A\u5BFF\u53F8\uFF08\u793E\u533A\u8FBE\u6807\uFF09\uFF0C\u4E0E R36 \u540C\u54C1\u7C7B\u4E0D\u540C\u6863\u4F4D"),
  r("R48", "\u6D4B\u8BD5\xB7\u4EAC\u90FD\u6C64\u8C46\u8150", "\u91D1\u878D\u8857\u5E97", ["other"], "\u897F\u57CE\u533A\u91D1\u878D\u8857", 116.361, 39.919, 188, ["\u6C64\u8C46\u8150", "\u6000\u77F3\u5C0F\u4EFD"], ["\u6E05\u6DE1"], "\u65E5\u6599\u677F\u5757\uFF1A\u6C64\u8C46\u8150\uFF0C1 \u7968\u672A\u8FBE\u6807"),
  r("R49", "\u6D4B\u8BD5\xB7\u5927\u962A\u7AE0\u9C7C\u70E7\u5C0F\u94FA", "\u53CC\u4E95\u5E97", ["other"], "\u671D\u9633\u533A\u53CC\u4E95", 116.4665, 39.8925, null, ["\u7AE0\u9C7C\u70E7"], ["\u5C0F\u5403"], "\u65E5\u6599\u677F\u5757\uFF1A\u8857\u5934\u5C0F\u5403\uFF0C\u4EBA\u5747\u672A\u77E5 + \u96F6\u7968\uFF08\u9884\u7B97\u4E0E\u8FBE\u6807\u53CC\u91CD\u6F14\u793A\u4F4D\uFF09")
];
function fb(id, restaurant_id, user, attitude, visited_days_ago, dish_names, disclosure = "none", status = "APPROVED", reason) {
  return {
    id,
    restaurant_id,
    user,
    attitude,
    visited_days_ago,
    dish_names,
    disclosure,
    status,
    reason: reason != null ? reason : `\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\u6570\u636E\uFF0C\u975E\u771F\u5B9E\u63A2\u5E97\uFF09\uFF1A\u95E8\u5E97 ${restaurant_id}\uFF0C\u6001\u5EA6=${attitude}\uFF0C\u7528\u4E8E\u9A8C\u8BC1\u8BA1\u7968\u3001\u7A97\u53E3\u4E0E\u62AB\u9732\u89C4\u5219\u3002`
  };
}
var SEED_FEEDBACK = [
  // R01：3 推荐 0 不推荐 → QUALIFIED
  fb(
    "F001",
    "R01",
    "U01",
    "recommend",
    6,
    ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C", "\u82B1\u6EAA\u725B\u8089\u7C89"],
    "none",
    "APPROVED",
    "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF0C\u975E\u771F\u5B9E\u63A2\u5E97\uFF09\uFF1A\u9178\u6C64\u5E95\u53D1\u9175\u611F\u660E\u663E\uFF0C\u7C73\u7C89\u8F6F\u786C\u5EA6\u5408\u9002\uFF1B\u8FD9\u6761\u8BB0\u5F55\u7528\u4E8E\u6F14\u793A\u793E\u533A\u63A8\u8350\u7968\u5982\u4F55\u8FDB\u5165\u8D44\u683C\u8BA1\u7B97\u3002"
  ),
  fb("F002", "R01", "U02", "recommend", 23, ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"], "none"),
  fb("F003", "R01", "U03", "recommend", 51, ["\u82B1\u6EAA\u725B\u8089\u7C89", "\u6298\u8033\u6839\u62CC\u8C46\u8150"], "none"),
  // R03：同品牌另一分店，只有 2 推荐 → PENDING
  fb("F004", "R03", "U01", "recommend", 12, ["\u80A0\u65FA\u9762"]),
  fb("F005", "R03", "U02", "recommend", 33, ["\u80A0\u65FA\u9762"]),
  // R04：曾达标，现在 3 推荐 1 一般 1 不推荐（4*3>=3*5 成立）→ 仍达标；再加一条不推荐才失效
  fb("F006", "R04", "U01", "recommend", 15, ["\u7CDF\u8FA3\u8106\u76AE\u9C7C"]),
  fb("F007", "R04", "U02", "recommend", 40, ["\u7CDF\u8FA3\u8106\u76AE\u9C7C"]),
  fb("F008", "R04", "U03", "recommend", 61, ["\u6298\u8033\u6839\u62CC\u8C46\u8150"]),
  fb("F009", "R04", "U04", "neutral", 8, ["\u7CDF\u8FA3\u8106\u76AE\u9C7C"]),
  fb(
    "F010",
    "R04",
    "U05",
    "not_recommend",
    3,
    ["\u6298\u8033\u6839\u62CC\u8C46\u8150"],
    "none",
    "APPROVED",
    "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF09\uFF1A\u6298\u8033\u6839\u751F\u6DA9\u3001\u4E0A\u83DC\u7B49\u5F85\u4E45\uFF1B\u5408\u6CD5\u8D1F\u9762\u53CD\u9988\u7167\u5E38\u516C\u5F00\u5E76\u8BA1\u5165\u7968\u6570\uFF0C\u4E0D\u56E0\u8D1F\u9762\u800C\u5220\u9664\u3002"
  ),
  // R05：社区 2 推荐（不达标）+ 编辑背书 ACTIVE
  fb("F011", "R05", "U01", "recommend", 9, ["\u6C34\u716E\u725B\u8089"]),
  fb("F012", "R05", "U02", "recommend", 28, ["\u9EBB\u5A46\u8C46\u8150"]),
  // R06：3 推荐 1 不推荐 → 4*3>=3*4 成立 → QUALIFIED
  fb("F013", "R06", "U01", "recommend", 5, ["\u91CD\u5E86\u5C0F\u9762"]),
  fb("F014", "R06", "U02", "recommend", 18, ["\u7897\u6742\u9762"]),
  fb("F015", "R06", "U03", "recommend", 44, ["\u91CD\u5E86\u5C0F\u9762"]),
  fb("F016", "R06", "U04", "not_recommend", 11, ["\u6BDB\u8840\u65FA"]),
  // R07：地点待验证，票数够也不进默认层
  fb("F017", "R07", "U01", "recommend", 7, ["\u5C0F\u9505\u7C73\u7EBF"]),
  fb("F018", "R07", "U02", "recommend", 16, ["\u5C0F\u9505\u7C73\u7EBF"]),
  fb("F019", "R07", "U03", "recommend", 30, ["\u6C7D\u9505\u9E21"]),
  // R08：疑似闭店 + 复核中
  fb("F020", "R08", "U01", "recommend", 20, ["\u4E1D\u5A03\u5A03"]),
  fb("F021", "R08", "U02", "recommend", 35, ["\u4E1D\u5A03\u5A03"]),
  fb("F022", "R08", "U03", "recommend", 50, ["\u70D9\u9505\u571F\u8C46"]),
  // R09：闭店
  fb(
    "F023",
    "R09",
    "U01",
    "recommend",
    200,
    ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"],
    "none",
    "APPROVED",
    "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF09\uFF1A\u5B9E\u5403\u65E5\u671F\u5728 180 \u5929\u7A97\u53E3\u4E4B\u5916\uFF0C\u53EA\u4F5C\u4E3A\u5386\u53F2\u8BB0\u5F55\u663E\u793A\uFF0C\u4E0D\u8BA1\u5F53\u524D\u53E3\u7891\u3002"
  ),
  fb("F024", "R09", "U02", "recommend", 20, ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"]),
  fb("F025", "R09", "U03", "recommend", 25, ["\u82B1\u6EAA\u725B\u8089\u7C89"]),
  // R10/R11 同坐标
  fb("F026", "R10", "U01", "recommend", 10, ["\u5DDD\u5317\u51C9\u7C89"]),
  fb("F027", "R10", "U02", "recommend", 12, ["\u5DDD\u5317\u51C9\u7C89"]),
  fb("F028", "R10", "U03", "recommend", 14, ["\u592B\u59BB\u80BA\u7247"]),
  fb("F029", "R11", "U04", "recommend", 9, ["\u7897\u6742\u9762"]),
  fb("F030", "R11", "U05", "recommend", 21, ["\u7897\u6742\u9762"]),
  fb("F031", "R11", "U01", "recommend", 44, ["\u91CD\u5E86\u5C0F\u9762"]),
  // R12 无预算数据
  fb("F032", "R12", "U01", "recommend", 13, ["\u5C0F\u9505\u7C73\u7EBF"]),
  fb("F033", "R12", "U02", "recommend", 19, ["\u5C0F\u9505\u7C73\u7EBF"]),
  fb("F034", "R12", "U03", "recommend", 38, ["\u6C7D\u9505\u9E21"]),
  // R13/R14 北京其他
  fb("F035", "R13", "U01", "recommend", 4, ["\u70E4\u9E2D"]),
  fb("F036", "R13", "U02", "recommend", 26, ["\u70E4\u9E2D"]),
  fb("F037", "R13", "U03", "recommend", 47, ["\u70E4\u9E2D"]),
  fb("F038", "R14", "U04", "recommend", 15, ["\u94DC\u9505\u6DAE\u8089"]),
  fb("F039", "R14", "U05", "recommend", 22, ["\u94DC\u9505\u6DAE\u8089"]),
  fb("F040", "R14", "U01", "recommend", 55, ["\u94DC\u9505\u6DAE\u8089"]),
  // R15：2 推荐 → PENDING
  fb("F041", "R15", "U01", "recommend", 8, ["\u82B1\u6EAA\u725B\u8089\u7C89"]),
  fb("F042", "R15", "U02", "recommend", 31, ["\u82B1\u6EAA\u725B\u8089\u7C89"]),
  // R16：别名演示
  fb("F043", "R16", "U01", "recommend", 11, ["\u6298\u8033\u6839\u62CC\u8C46\u8150"]),
  fb("F044", "R16", "U02", "recommend", 24, ["\u6298\u8033\u6839\u62CC\u8C46\u8150"]),
  fb("F045", "R16", "U03", "recommend", 49, ["\u6298\u8033\u6839\u62CC\u8C46\u8150"]),
  // R17：1 推荐 + 1 待审
  fb("F046", "R17", "U01", "recommend", 6, ["\u70D9\u9505\u571F\u8C46"]),
  fb("F047", "R17", "U02", "recommend", 2, ["\u80A0\u65FA\u9762"], "none", "PENDING"),
  // R18：BLOCKED 但票数够
  fb("F048", "R18", "U01", "recommend", 17, ["\u8FA3\u5B50\u9E21"]),
  fb("F049", "R18", "U02", "recommend", 27, ["\u8FA3\u5B50\u9E21"]),
  fb("F050", "R18", "U03", "recommend", 41, ["\u8FA3\u5B50\u9E21"]),
  // R19：旧址 v1 三票；搬迁到 v2 后旧址票只作历史
  fb("F051", "R19", "U01", "recommend", 30, ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"], "none", "APPROVED", "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF09\uFF1A\u65E7\u5740\u8BB0\u5F55\uFF0Clocation_version=1\uFF0C\u4E0D\u53C2\u4E0E\u65B0\u5740\u8D44\u683C\u3002"),
  fb("F052", "R19", "U02", "recommend", 60, ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"]),
  fb("F053", "R19", "U03", "recommend", 90, ["\u9178\u6C64\u725B\u8089"]),
  // R20：3 条里 2 条披露关联 → 独立票不足
  fb(
    "F054",
    "R20",
    "U01",
    "recommend",
    5,
    ["\u4E1D\u5A03\u5A03"],
    "invited_tasting",
    "APPROVED",
    "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF09\uFF1A\u53D7\u9080\u8BD5\u5403\uFF0C\u5185\u5BB9\u516C\u5F00\u5E76\u62AB\u9732\u5173\u8054\uFF0C\u4F46\u4E0D\u8BA1\u5165\u793E\u533A\u72EC\u7ACB\u7968\u3002"
  ),
  fb("F055", "R20", "U02", "recommend", 12, ["\u4E1D\u5A03\u5A03"], "gifted_or_promoted"),
  fb("F056", "R20", "U03", "recommend", 33, ["\u4E1D\u5A03\u5A03"], "none"),
  // R21/R22 达标
  fb("F057", "R21", "U01", "recommend", 3, ["\u94B5\u94B5\u9E21"]),
  fb("F058", "R21", "U02", "recommend", 14, ["\u94B5\u94B5\u9E21"]),
  fb("F059", "R21", "U03", "recommend", 29, ["\u751C\u6C34\u9762"]),
  fb("F060", "R22", "U01", "recommend", 7, ["\u83CC\u5B50\u706B\u9505"]),
  fb("F061", "R22", "U02", "recommend", 25, ["\u83CC\u5B50\u706B\u9505"]),
  fb("F062", "R22", "U03", "recommend", 43, ["\u6C7D\u9505\u9E21"]),
  fb("F063", "R22", "U04", "not_recommend", 9, ["\u9C9C\u82B1\u997C"]),
  // R23：UNKNOWN 营业
  fb("F064", "R23", "U01", "recommend", 10, ["\u70D9\u9505\u571F\u8C46"]),
  fb("F065", "R23", "U02", "recommend", 32, ["\u70D9\u9505\u571F\u8C46"]),
  fb("F066", "R23", "U03", "recommend", 58, ["\u5C0F\u9505\u996D"]),
  // R24：注销账号曾投的票（重算演示）
  fb("F067", "R24", "U06", "recommend", 19, ["\u5C0F\u9505\u996D"]),
  fb("F068", "R24", "U02", "recommend", 45, ["\u5C0F\u9505\u996D"]),
  // R02 重复候选
  fb("F069", "R02", "U05", "recommend", 13, ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"]),
  // ---------------------------------------------------------- 常见品类的合成票（F072 起）
  // 每家"达标"店固定 3 个不同账号的自费推荐（disclosure=none、窗口内），沿用与 R01 相同的计票口径；
  // 理由文本一律自带"合成/非真实探店"字样，避免被误读成真实口碑。
  fb("F072", "R25", "U01", "recommend", 4, ["\u70E4\u7F8A\u8089\u4E32"], "none", "APPROVED", "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF0C\u975E\u771F\u5B9E\u63A2\u5E97\uFF09\uFF1A\u70AD\u706B\u5473\u8DB3\u3001\u80A5\u7626\u6BD4\u4F8B\u5408\u9002\uFF0C\u7528\u4E8E\u6F14\u793A\u70E7\u70E4\u54C1\u7C7B\u7684\u793E\u533A\u8BA1\u7968\u3002"),
  fb("F073", "R25", "U02", "recommend", 17, ["\u70E4\u7F8A\u8089\u4E32"]),
  fb("F074", "R25", "U03", "recommend", 39, ["\u70E4\u9E21\u7FC5"]),
  fb("F075", "R26", "U01", "recommend", 8, ["\u9EBB\u8FA3\u5C0F\u9F99\u867E"]),
  fb("F076", "R26", "U04", "recommend", 22, ["\u9EBB\u8FA3\u5C0F\u9F99\u867E"]),
  fb("F077", "R26", "E01", "recommend", 47, ["\u9EBB\u8FA3\u5C0F\u9F99\u867E"]),
  fb("F078", "R27", "U02", "recommend", 6, ["\u725B\u8089\u4E32\u4E32"]),
  fb("F079", "R27", "U03", "recommend", 19, ["\u725B\u8089\u4E32\u4E32"]),
  fb("F080", "R27", "U05", "recommend", 35, ["\u94B5\u94B5\u9E21"]),
  fb("F081", "R28", "U01", "recommend", 11, ["\u94DC\u9505\u6DAE\u8089"]),
  fb("F082", "R28", "U03", "recommend", 26, ["\u94DC\u9505\u6DAE\u8089"]),
  fb("F083", "R28", "M01", "recommend", 52, ["\u94DC\u9505\u6DAE\u8089"]),
  fb("F084", "R29", "U02", "recommend", 9, ["\u70B8\u9171\u9762"]),
  fb("F085", "R29", "U05", "recommend", 31, ["\u70B8\u9171\u9762"]),
  fb("F086", "R30", "U01", "recommend", 13, ["\u8C46\u6C41\u7126\u5708"]),
  fb("F087", "R30", "U04", "recommend", 28, ["\u9A74\u6253\u6EDA"]),
  fb("F088", "R30", "U05", "recommend", 44, ["\u8C46\u6C41\u7126\u5708"]),
  fb("F089", "R31", "U03", "recommend", 7, ["\u53EF\u9882"]),
  fb("F090", "R32", "U01", "recommend", 15, ["\u51B7\u9762"]),
  fb("F091", "R32", "U02", "recommend", 33, ["\u70E4\u8089"]),
  fb("F092", "R32", "A01", "recommend", 58, ["\u51B7\u9762"]),
  fb("F093", "R33", "U04", "recommend", 5, ["\u9EBB\u8FA3\u70EB"]),
  fb("F094", "R33", "U05", "recommend", 21, ["\u9EBB\u8FA3\u70EB"]),
  fb("F095", "R33", "E01", "recommend", 40, ["\u9EBB\u8FA3\u70EB"]),
  fb("F096", "R34", "U01", "recommend", 10, ["\u70E4\u8C46\u8150"]),
  fb("F097", "R34", "U02", "recommend", 24, ["\u83CC\u5B50\u706B\u9505"]),
  fb("F098", "R34", "U03", "recommend", 46, ["\u70E4\u8C46\u8150"]),
  fb("F099", "R34", "U04", "not_recommend", 12, ["\u83CC\u5B50\u706B\u9505"], "none", "APPROVED", "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF09\uFF1A\u4E0A\u83DC\u6162\u3001\u5206\u91CF\u504F\u5C0F\uFF1B\u8D1F\u9762\u7968\u7167\u5E38\u8BA1\u5165\u5206\u6BCD\u3002"),
  fb("F100", "R35", "U01", "recommend", 14, ["\u70D9\u9505\u571F\u8C46"]),
  fb("F101", "R35", "U05", "recommend", 29, ["\u70E4\u8111\u82B1"]),
  fb("F102", "R35", "U03", "recommend", 55, ["\u70D9\u9505\u571F\u8C46"]),
  fb("F103", "R37", "U02", "recommend", 8, ["\u867E\u997A"]),
  fb("F104", "R37", "U04", "recommend", 23, ["\u6D41\u6C99\u5305"]),
  fb("F105", "R37", "U05", "recommend", 41, ["\u867E\u997A"]),
  fb("F106", "R38", "U01", "recommend", 18, ["\u6CB9\u6CFC\u9762"]),
  fb("F107", "R38", "U02", "recommend", 36, ["\u6CB9\u6CFC\u9762"]),
  fb("F108", "R39", "U04", "recommend", 20, ["\u70E4\u8170\u5B50"]),
  fb("F109", "R40", "U05", "recommend", 27, ["\u732A\u8089\u7096\u7C89\u6761"]),
  fb("F110", "R41", "U01", "recommend", 12, ["\u9E33\u9E2F\u9505"]),
  fb("F111", "R41", "U03", "recommend", 30, ["\u9E33\u9E2F\u9505"]),
  fb("F112", "R41", "U05", "recommend", 50, ["\u9E33\u9E2F\u9505"]),
  fb("F113", "R42", "U02", "recommend", 16, ["\u80A0\u7C89"]),
  // ---------------------------------------------------------- 日料板块的合成票（F114 起）
  fb("F114", "R43", "U01", "recommend", 5, ["\u70E7\u9E1F", "\u6E05\u9152"], "none", "APPROVED", "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF0C\u975E\u771F\u5B9E\u63A2\u5E97\uFF09\uFF1A\u9E21\u76AE\u70E4\u5F97\u5E72\u3001\u6C64\u6C41\u4E0D\u9F41\uFF0C\u7528\u4E8E\u6F14\u793A\u65E5\u6599\u54C1\u7C7B\u7684\u793E\u533A\u8BA1\u7968\u3002"),
  fb("F115", "R43", "U02", "recommend", 20, ["\u5BFF\u559C\u70E7"]),
  fb("F116", "R43", "U04", "recommend", 42, ["\u70E7\u9E1F"]),
  fb("F117", "R44", "U01", "recommend", 9, ["\u70E4\u9E21\u76AE"]),
  fb("F118", "R44", "U03", "recommend", 27, ["\u70E7\u9E1F"]),
  fb("F119", "R44", "E01", "recommend", 51, ["\u70E7\u9E1F"]),
  fb("F120", "R45", "U02", "recommend", 12, ["\u5BFF\u559C\u70E7"]),
  fb("F121", "R45", "U05", "recommend", 33, ["\u548C\u725B"]),
  fb("F122", "R45", "M01", "recommend", 58, ["\u5BFF\u559C\u70E7"]),
  fb("F123", "R46", "U01", "recommend", 14, ["\u5473\u564C\u62C9\u9762"]),
  fb("F124", "R46", "U05", "recommend", 37, ["\u5473\u564C\u62C9\u9762"]),
  fb("F125", "R47", "U03", "recommend", 8, ["\u5BFF\u53F8\u62FC\u76D8"]),
  fb("F126", "R47", "U04", "recommend", 25, ["\u9CD7\u9C7C"]),
  fb("F127", "R47", "A01", "recommend", 46, ["\u5BFF\u53F8\u62FC\u76D8"]),
  fb("F128", "R48", "U02", "recommend", 19, ["\u6C64\u8C46\u8150"])
  // R49 零票：预算未知 + 无推荐来源，两项都不达标，留作对照
  // R50：撤回演示 —— 由前端演示时创建，此处不放种子
];
var ALIASES = {
  \u9C7C\u8165\u8349: ["\u6298\u8033\u6839"],
  \u6298\u8033\u6839: ["\u9C7C\u8165\u8349"],
  \u9178\u6C64: ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C", "\u82D7\u5BB6\u9178\u6C64\u9C7C"],
  \u7C73\u7EBF: ["\u5C0F\u9505\u7C73\u7EBF"],
  \u7C73\u7C89: ["\u82B1\u6EAA\u725B\u8089\u7C89", "\u9ED4\u6C5F\u9178\u6C64\u7C89"],
  \u70E7\u70E4: ["\u70E4\u7F8A\u8089\u4E32", "\u70E4\u9E21\u7FC5", "\u70E4\u8C46\u8150", "\u70E4\u8111\u82B1", "\u70E4\u8170\u5B50"],
  \u64B8\u4E32: ["\u70E4\u7F8A\u8089\u4E32"],
  \u706B\u9505: ["\u94DC\u9505\u6DAE\u8089", "\u83CC\u5B50\u706B\u9505", "\u9E33\u9E2F\u9505"],
  \u4E32\u4E32: ["\u725B\u8089\u4E32\u4E32", "\u94B5\u94B5\u9E21"],
  \u5C0F\u5403: ["\u8C46\u6C41\u7126\u5708", "\u9A74\u6253\u6EDA"],
  \u9762: ["\u70B8\u9171\u9762", "\u6CB9\u6CFC\u9762", "\u51B7\u9762"],
  \u65E5\u6599: ["\u70E7\u9E1F", "\u5BFF\u559C\u70E7", "\u5BFF\u53F8\u62FC\u76D8", "\u5473\u564C\u62C9\u9762", "\u6C64\u8C46\u8150", "\u7AE0\u9C7C\u70E7"],
  \u5C45\u9152\u5C4B: ["\u70E7\u9E1F", "\u6E05\u9152"],
  \u70E7\u9E1F: ["\u70E4\u9E21\u76AE"],
  \u5BFF\u559C\u70E7: ["\u548C\u725B"],
  \u5BFF\u53F8: ["\u5BFF\u53F8\u62FC\u76D8"],
  \u62C9\u9762: ["\u5473\u564C\u62C9\u9762"]
};
var DISH_KEYWORDS = Array.from(
  new Set(
    SEED_RESTAURANTS.flatMap((x) => x.dish_highlights).filter((s) => s && s.length > 1)
  )
);

// ../packages/contracts/src/photos.ts
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var PALETTE = [
  ["#2f6f5e", "#e9dcc3"],
  ["#7a3b2e", "#f2e2d5"],
  ["#3d4f6b", "#e4e8ef"],
  ["#6b4f2a", "#f3ead9"],
  ["#4a3b5c", "#ece6f2"]
];
function testPhotoDataUri(label, subtitle = "\u6D4B\u8BD5\u56FE\u7247 \xB7 \u975E\u771F\u5B9E\u95E8\u5E97") {
  const [bg, fg] = PALETTE[Math.abs(hash(label)) % PALETTE.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
<rect width="640" height="420" fill="${bg}"/>
<circle cx="320" cy="180" r="96" fill="${fg}" opacity="0.9"/>
<path d="M200 330 h240" stroke="${fg}" stroke-width="10" stroke-linecap="round" opacity="0.85"/>
<text x="32" y="52" font-family="system-ui,sans-serif" font-size="30" fill="${fg}">${esc(label)}</text>
<text x="32" y="392" font-family="system-ui,sans-serif" font-size="22" fill="${fg}" opacity="0.9">${esc(subtitle)}</text>
</svg>`;
  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}
function hash(s) {
  let h = 0;
  for (const ch of s) h = h * 31 + ch.codePointAt(0) | 0;
  return h;
}
function toBase64(s) {
  if (typeof btoa === "function" && typeof TextEncoder !== "undefined") {
    const bytes = new TextEncoder().encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
  return Buffer.from(s, "utf8").toString("base64");
}

// ../packages/contracts/src/store.ts
var MAX_ENTITIES_PER_RESPONSE = 200;
var ApiError = class extends Error {
  constructor(code, message, status = 400, fieldErrors) {
    super(message);
    __publicField(this, "code", code);
    __publicField(this, "status", status);
    __publicField(this, "fieldErrors", fieldErrors);
  }
};
var SYSTEM_KINDS = [
  { kind: "want", title: "\u60F3\u5403" },
  { kind: "visited", title: "\u5403\u8FC7" },
  { kind: "private_stash", title: "\u79C1\u85CF" }
];
var Store = class {
  constructor(opts = {}) {
    __publicField(this, "env");
    __publicField(this, "clock");
    __publicField(this, "restaurants", /* @__PURE__ */ new Map());
    __publicField(this, "candidates", /* @__PURE__ */ new Map());
    __publicField(this, "users", /* @__PURE__ */ new Map());
    __publicField(this, "visits", []);
    __publicField(this, "media", /* @__PURE__ */ new Map());
    __publicField(this, "collections", /* @__PURE__ */ new Map());
    __publicField(this, "publications", /* @__PURE__ */ new Map());
    __publicField(this, "reports", []);
    __publicField(this, "audit", []);
    __publicField(this, "idempotency", /* @__PURE__ */ new Map());
    __publicField(this, "snapshots", /* @__PURE__ */ new Map());
    __publicField(this, "sessions", /* @__PURE__ */ new Map());
    __publicField(this, "resultsVersion", 1);
    __publicField(this, "seq", 1);
    __publicField(this, "lastComputedDay", null);
    var _a, _b;
    this.env = (_a = opts.env) != null ? _a : "development";
    this.clock = { now: (_b = opts.now) != null ? _b : (() => Date.now()) };
    if (this.env === "production") {
      throw new RuleViolation("production \u73AF\u5883\u62D2\u7EDD\u88C5\u8F7D\u6D4B\u8BD5\u79CD\u5B50\uFF0C\u8BF7\u5148\u63A5\u5165\u771F\u5B9E\u6838\u9A8C\u6570\u636E");
    }
    this.loadSeed();
  }
  now() {
    return this.clock.now();
  }
  today() {
    return shanghaiToday(this.clock);
  }
  stamp() {
    return new Date(this.clock.now()).toISOString();
  }
  nextId(prefix) {
    this.seq += 1;
    return `${prefix}${String(this.seq).padStart(4, "0")}`;
  }
  // ---------------------------------------------------------------- 种子
  loadSeed() {
    for (const u of SEED_USERS) {
      this.users.set(u.id, {
        id: u.id,
        display_name: u.display_name,
        roles: [...u.roles],
        phone_masked: u.phone,
        status: u.id === "U06" ? "deleted" : "active"
      });
    }
    for (const s of SEED_RESTAURANTS) {
      const photos = [`M${s.id}a`, `M${s.id}b`].map((id, i) => {
        this.media.set(id, {
          id,
          owner_user_id: "A01",
          url: testPhotoDataUri(`${s.name}${s.branch ? `\xB7${s.branch}` : ""}`, i === 0 ? "\u6D4B\u8BD5\u56FE\u7247 \xB7 \u975E\u771F\u5B9E\u95E8\u5E97" : "\u6D4B\u8BD5\u56FE\u7247 \xB7 \u5408\u6210\u5360\u4F4D"),
          width: 640,
          height: 420,
          review_status: "APPROVED",
          context: "private",
          publication_id: null,
          restaurant_id: s.id,
          created_at: this.stamp()
        });
        return id;
      });
      const rec = {
        ...s,
        place_verified_date: s.place_verified_days_ago === null ? null : addDays(this.today(), -s.place_verified_days_ago),
        photo_media_ids: photos,
        lng: s.lng,
        lat: s.lat,
        version: 1,
        updated_at: this.stamp(),
        deleted: false,
        merged_into: null,
        editorial: s.editorial ? {
          author_user_id: s.editorial.author,
          visited_date: addDays(this.today(), -s.editorial.visited_days_ago),
          reason: s.editorial.reason,
          verifier_user_id: s.editorial.verifier,
          verified_at: this.stamp(),
          revoked_at: null,
          revoke_reason: null
        } : null,
        tally: { recommend: 0, neutral: 0, not_recommend: 0, total: 0 },
        window_start: addDays(this.today(), -179),
        window_end: this.today(),
        community: "PENDING",
        endorsement: s.editorial ? "ACTIVE" : "NONE",
        sources: [],
        in_default_layer: false,
        ineligibility_reasons: []
      };
      this.restaurants.set(rec.id, rec);
    }
    for (const f of SEED_FEEDBACK) {
      const rest = this.restaurants.get(f.restaurant_id);
      const visited = addDays(this.today(), -f.visited_days_ago);
      const locVersion = rest ? rest.location_version : 1;
      const visit = {
        id: `V${f.id}`,
        restaurant_id: f.restaurant_id,
        user_id: f.user,
        visited_date: visited,
        location_version: f.restaurant_id === "R19" ? 1 : locVersion,
        next_revision: 2,
        current_revision: f.status === "APPROVED" ? 1 : null,
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
            decided_at: f.status === "APPROVED" ? this.stamp() : null,
            decided_by: f.status === "APPROVED" ? "M01" : null,
            reject_reason: null
          }
        ]
      };
      this.visits.push(visit);
      this.media.set(`MM${f.id}`, {
        id: `MM${f.id}`,
        owner_user_id: f.user,
        url: testPhotoDataUri(`\u6D4B\u8BD5\u56FE\u7247 ${f.id}`, "\u53CD\u9988\u5408\u6210\u56FE \xB7 \u975E\u771F\u5B9E\u63A2\u5E97"),
        width: 640,
        height: 420,
        review_status: f.status === "APPROVED" ? "APPROVED" : "PENDING",
        context: "private",
        publication_id: null,
        restaurant_id: f.restaurant_id,
        created_at: this.stamp()
      });
    }
    for (const [id, user, date] of [
      ["F070", "U04", 70],
      ["F071", "U05", 100]
    ]) {
      this.visits.push({
        id: `V${id}`,
        restaurant_id: "R19",
        user_id: user,
        visited_date: addDays(this.today(), -date),
        location_version: 1,
        next_revision: 2,
        current_revision: 1,
        withdrawal_generation: 0,
        revisions: [
          {
            revision: 1,
            status: "APPROVED",
            attitude: "recommend",
            reason: "\u6D4B\u8BD5\u53CD\u9988\uFF08\u5408\u6210\uFF09\uFF1A\u65E7\u5740\u8BB0\u5F55\uFF0C\u7528\u4E8E\u6F14\u793A\u642C\u8FC1\u540E\u65E7\u5740\u7968\u4E0D\u8BA1\u5165\u65B0\u5740\u8D44\u683C\u3002",
            dish_names: ["\u51EF\u91CC\u7EA2\u9178\u6C64\u9C7C"],
            disclosure: "none",
            media_ids: [],
            submitted_at: this.stamp(),
            decided_at: this.stamp(),
            decided_by: "M01",
            reject_reason: null
          }
        ]
      });
    }
    for (const u of this.users.values()) this.ensureSystemCollections(u.id);
    this.recomputeAll();
    this.seedDemoCollections();
    this.seedPublications();
    this.seedReports();
  }
  seedDemoCollections() {
    const custom = {
      id: "COL0001",
      owner_user_id: "U01",
      kind: "custom",
      system_kind: null,
      title: "\u6D4B\u8BD5\xB7\u6211\u7684\u8D35\u5DDE\u8E29\u70B9\u56FE",
      description: "\u6F14\u793A\u7528\u4E2A\u4EBA\u6E05\u5355\uFF08\u5408\u6210\u5185\u5BB9\uFF09",
      items: [
        { restaurant_id: "R01", position: 0, note: "\u6D4B\u8BD5\u7B14\u8BB0\uFF08\u9ED8\u8BA4\u4E0D\u516C\u5F00\uFF09", note_shareable: false, media_ids: [], added_at: this.stamp() },
        { restaurant_id: "R20", position: 1, note: "\u8FD9\u6761\u52FE\u9009\u4E86\u53EF\u516C\u5F00", note_shareable: true, media_ids: [], added_at: this.stamp() },
        { restaurant_id: "R07", position: 2, note: "\u5F85\u9A8C\u8BC1\u5E97\uFF0C\u516C\u5F00\u6E05\u5355\u9700\u5E26\u6807\u8BC6", note_shareable: true, media_ids: [], added_at: this.stamp() }
      ],
      publication_status: "PRIVATE",
      active_token: null,
      publication_generation: 0,
      version: 1,
      updated_at: this.stamp()
    };
    this.collections.set(custom.id, custom);
    this.addSystemItem("U01", "R01", "want");
    this.addSystemItem("U01", "R21", "visited");
    this.addSystemItem("U01", "R16", "private_stash");
  }
  seedPublications() {
    const col = this.collections.get("COL0001");
    if (!col) return;
    const pub = {
      id: "PUB0001",
      collection_id: col.id,
      generation: 1,
      status: "PUBLISHED",
      token: "demo-token-1",
      title: col.title,
      description: col.description,
      items: col.items.filter((i) => i.note_shareable).map((i) => ({ restaurant_id: i.restaurant_id, note: i.note, media_ids: i.media_ids })),
      created_at: this.stamp(),
      published_at: this.stamp(),
      revoked_at: null
    };
    this.publications.set(pub.id, pub);
    col.publication_status = "PUBLISHED";
    col.active_token = pub.token;
    col.publication_generation = 1;
  }
  seedReports() {
    this.reports.push(
      {
        id: "REP0001",
        restaurant_id: "R08",
        kind: "closed",
        detail: "\u6D4B\u8BD5\u4E3E\u62A5\uFF08\u5408\u6210\uFF09\uFF1A\u5377\u95F8\u95E8\u8D34\u4E86\u95ED\u5E97\u544A\u793A\u3002",
        reporter_id: "U02",
        status: "IN_REVIEW",
        created_at: this.stamp(),
        // 复核中还没有结论：result_note 只能由真实处置动作写入，不能预先放一句固定话冒充结果。
        result_note: null,
        feedback_target: null,
        version: 2,
        handled_by: "M01",
        handled_at: this.stamp()
      },
      {
        id: "REP0002",
        restaurant_id: "R02",
        kind: "wrong_info",
        detail: "\u6D4B\u8BD5\u4E3E\u62A5\uFF08\u5408\u6210\uFF09\uFF1A\u7591\u4F3C\u4E0E R01 \u662F\u540C\u4E00\u5BB6\u5E97\u3002",
        reporter_id: "U03",
        status: "OPEN",
        created_at: this.stamp(),
        result_note: null,
        feedback_target: null,
        version: 1,
        handled_by: null,
        handled_at: null
      }
    );
  }
  // ---------------------------------------------------------------- 派生
  recomputeAll() {
    this.lastComputedDay = this.today();
    for (const id of this.restaurants.keys()) this.recompute(id);
  }
  /** 读接口也校验到期，避免资格只能靠定时任务刷新（REC-04）。 */
  ensureFresh() {
    if (this.lastComputedDay !== this.today()) this.recomputeAll();
  }
  recompute(restaurantId) {
    const rec = this.restaurants.get(restaurantId);
    if (!rec) return;
    const today = this.today();
    const rows = this.countableRevisions(restaurantId);
    const tally = tallyCommunity(rows, rec.location_version, today);
    rec.tally = {
      recommend: tally.recommend,
      neutral: tally.neutral,
      not_recommend: tally.not_recommend,
      total: tally.total
    };
    rec.window_start = tally.window_start;
    rec.window_end = tally.window_end;
    const q = communityQualification(tally, rec.ever_qualified);
    if (q === "QUALIFIED") rec.ever_qualified = true;
    rec.community = q;
    if (!rec.editorial) rec.endorsement = "NONE";
    else if (rec.editorial.revoked_at) rec.endorsement = "REVOKED";
    else if (!rec.editorial.verifier_user_id) rec.endorsement = "NONE";
    else rec.endorsement = endorsementStatusOn(rec.editorial.visited_date, today);
    const res = evaluatePublicMapEligibility({
      profile_public: rec.profile_public,
      place_status: rec.place_status,
      business_status: rec.business_status,
      risk_status: rec.risk_status,
      community: rec.community,
      endorsement: rec.endorsement,
      merged_into: rec.merged_into,
      deleted: rec.deleted
    });
    rec.in_default_layer = res.in_default_layer;
    rec.sources = res.sources;
    rec.ineligibility_reasons = res.reasons;
  }
  countableRevisions(restaurantId) {
    const out = [];
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
        author_status: (author == null ? void 0 : author.status) === "active" ? "active" : "deleted",
        content_status: rev.status,
        location_version: v.location_version
      });
    }
    return out;
  }
  /** 一用户一门店最多一票：按 (user, restaurant) 找当前指针。 */
  findVisit(userId, restaurantId) {
    return this.visits.find(
      (v) => v.user_id === userId && v.restaurant_id === this.canonical(restaurantId)
    );
  }
  touch(restaurantId) {
    this.resultsVersion += 1;
    if (restaurantId) this.recompute(restaurantId);
  }
  canonical(id) {
    let cur = id;
    for (let i = 0; i < 10; i += 1) {
      const rec = this.restaurants.get(cur);
      if (!(rec == null ? void 0 : rec.merged_into)) return cur;
      cur = rec.merged_into;
    }
    return cur;
  }
  // ---------------------------------------------------------------- 投影
  basisOf(rec) {
    var _a, _b;
    return {
      community: rec.community,
      tally: rec.tally,
      window_start: rec.window_start,
      window_end: rec.window_end,
      editorial: rec.endorsement,
      editorial_detail: rec.editorial ? {
        author: (_b = (_a = this.users.get(rec.editorial.author_user_id)) == null ? void 0 : _a.display_name) != null ? _b : "\u672A\u77E5",
        visited_date: rec.editorial.visited_date,
        reason: rec.editorial.reason
      } : null,
      sources: rec.sources,
      rule_version: RULE_VERSION
    };
  }
  toDto(rec) {
    return {
      id: rec.id,
      name: rec.name,
      branch: rec.branch,
      cuisines: rec.cuisines,
      address: rec.address,
      floor_info: rec.floor_info,
      lng: rec.lng,
      lat: rec.lat,
      coord_system: "GCJ02",
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
      updated_at: rec.updated_at
    };
  }
  mediaOf(id) {
    const m = this.media.get(id);
    if (!m) return null;
    return {
      id: m.id,
      owner_user_id: m.owner_user_id,
      kind: "photo",
      url: m.url,
      width: m.width,
      height: m.height,
      review_status: m.review_status,
      is_test_data: true,
      exif_stripped: true
    };
  }
  /** 未过审图片只有作者与审核人员可读；其他人（含匿名）一律按「不存在」处理。 */
  canViewMedia(sessionId, mediaId) {
    var _a, _b;
    const asset = this.mediaOf(mediaId);
    if (!asset) return false;
    if (asset.review_status === "APPROVED") return true;
    const viewerId = this.userIdOfSession(sessionId);
    if (!viewerId) return false;
    if (viewerId === asset.owner_user_id) return true;
    return ((_b = (_a = this.users.get(viewerId)) == null ? void 0 : _a.roles) != null ? _b : []).some((r2) => r2 === "moderator" || r2 === "admin");
  }
  /** demo 上传：登记一张明确标注为合成的图片，等待审核（未经审核不公开）。 */
  addTestMedia(sessionId, restaurantId) {
    const user = this.requireUser(sessionId);
    const id = this.nextId("MM");
    const rec = {
      id,
      owner_user_id: user.id,
      url: testPhotoDataUri(`\u6D4B\u8BD5\u56FE\u7247 ${id}`, "\u7528\u6237\u5408\u6210\u4E0A\u4F20 \xB7 \u975E\u771F\u5B9E\u63A2\u5E97"),
      width: 640,
      height: 420,
      review_status: "PENDING",
      context: "private",
      publication_id: null,
      restaurant_id: restaurantId,
      created_at: this.stamp()
    };
    this.media.set(id, rec);
    return this.mediaOf(id);
  }
  publicFeedback(rec, rev, restaurant) {
    var _a, _b, _c, _d, _e, _f, _g;
    const counted = rev.disclosure === "none" && rev.status === "APPROVED" && rec.location_version === restaurant.location_version && ((_b = (_a = this.users.get(rec.user_id)) == null ? void 0 : _a.status) != null ? _b : "active") === "active" && tallyCommunity(this.countableRevisions(rec.restaurant_id), restaurant.location_version, this.today()).counted_ids.includes(
      rec.id
    );
    return {
      id: rec.id,
      restaurant_id: rec.restaurant_id,
      attitude: rev.attitude,
      visited_date: rec.visited_date,
      reason: rev.reason,
      dish_names: rev.dish_names,
      disclosure: rev.disclosure,
      disclosure_note: rev.disclosure === "none" ? null : "\u8BE5\u8BB0\u5F55\u542B\u5229\u76CA\u5173\u8054\uFF0C\u516C\u5F00\u4F46\u4E0D\u8BA1\u5165\u793E\u533A\u72EC\u7ACB\u7968",
      author: {
        display_name: (_d = (_c = this.users.get(rec.user_id)) == null ? void 0 : _c.display_name) != null ? _d : "\u5DF2\u6CE8\u9500\u7528\u6237",
        is_editor: (_f = (_e = this.users.get(rec.user_id)) == null ? void 0 : _e.roles.includes("editor")) != null ? _f : false
      },
      media_ids: rev.media_ids,
      revision: rev.revision,
      location_version: rec.location_version,
      counted_in_tally: counted,
      updated_at: (_g = rev.decided_at) != null ? _g : rev.submitted_at
    };
  }
  /** 该门店可公开的反馈版本：当前指针已批准；旧址记录仍显示但标明历史。 */
  publicFeedbackFor(restaurantId) {
    this.ensureFresh();
    const rec = this.requireRestaurant(restaurantId);
    const out = [];
    for (const v of this.visits) {
      if (v.restaurant_id !== restaurantId || v.current_revision === null) continue;
      const rev = v.revisions.find((x) => x.revision === v.current_revision);
      if (!rev || rev.status !== "APPROVED" && rev.status !== "HIDDEN") continue;
      out.push(this.publicFeedback(v, rev, rec));
    }
    return out.sort((a, b) => b.visited_date.localeCompare(a.visited_date) || a.id.localeCompare(b.id));
  }
  // ---------------------------------------------------------------- 查询
  requireRestaurant(id) {
    const rec = this.restaurants.get(this.canonical(id));
    if (!rec || rec.deleted) throw new ApiError("NOT_FOUND", "\u95E8\u5E97\u4E0D\u5B58\u5728\u6216\u672A\u516C\u5F00", 404);
    return rec;
  }
  matchesView(rec, view) {
    if (view === "guizhou") return rec.cuisines.includes("guizhou");
    if (view === "southwest") return rec.cuisines.some((c) => SOUTHWEST_CUISINES.includes(c));
    return !rec.cuisines.some((c) => SOUTHWEST_CUISINES.includes(c));
  }
  matchesBudget(rec, q) {
    if (q.budget_max === null) return true;
    if (rec.price_avg === null) return q.include_unknown_budget;
    return rec.price_avg <= q.budget_max;
  }
  matchesDish(rec, query) {
    var _a, _b;
    if (!query || !query.trim()) return true;
    const term = query.trim();
    const aliasTerms = (_a = ALIASES[term]) != null ? _a : [];
    const hay = [rec.name, (_b = rec.branch) != null ? _b : "", ...rec.dish_highlights, ...rec.taste_tags, rec.address].join(" ");
    return [term, ...aliasTerms].some((t) => hay.includes(t));
  }
  inBounds(rec, b) {
    return rec.lng >= b.west && rec.lng <= b.east && rec.lat >= b.south && rec.lat <= b.north;
  }
  /** 默认可见层：符合公共谓词；待验证层：显式开启后显示未验证候选。 */
  visibleFor(rec, layer) {
    if (rec.deleted || rec.merged_into || !rec.profile_public) return false;
    if (layer === "pending_verification") return !rec.in_default_layer && rec.place_status === "PENDING";
    return rec.in_default_layer;
  }
  queryKey(q) {
    var _a, _b;
    return [
      CONTRACT_VERSION,
      q.view,
      q.layer,
      (_a = q.budget_max) != null ? _a : "any",
      q.include_unknown_budget ? "unk" : "nounk",
      (_b = q.dish_or_tag) != null ? _b : "",
      q.bounds.west.toFixed(3),
      q.bounds.south.toFixed(3),
      q.bounds.east.toFixed(3),
      q.bounds.north.toFixed(3)
    ].join("|");
  }
  matchedRestaurants(q) {
    this.ensureFresh();
    return [...this.restaurants.values()].filter(
      (rec) => this.visibleFor(rec, q.layer) && this.matchesView(rec, q.view) && this.matchesBudget(rec, q) && this.matchesDish(rec, q.dish_or_tag) && this.inBounds(rec, q.bounds)
    ).sort((a, b) => a.id.localeCompare(b.id));
  }
  mapItems(q, snapshotId) {
    if (q.contract_version !== CONTRACT_VERSION) {
      throw new ApiError("VALIDATION_ERROR", "\u5408\u540C\u7248\u672C\u4E0D\u5339\u914D\uFF0C\u8BF7\u5237\u65B0", 400);
    }
    const key = this.queryKey(q);
    if (snapshotId) {
      const snap = this.snapshots.get(snapshotId);
      if (!snap || snap.query_key !== key || snap.version !== this.resultsVersion) {
        throw new ApiError("QUERY_EXPIRED", "\u67E5\u8BE2\u5FEB\u7167\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u62C9\u53D6\u5730\u56FE\u4E0E\u5217\u8868", 409);
      }
    }
    const matched = this.matchedRestaurants(q);
    const entities = this.buildEntities(matched, q);
    const snapshotIdOut = snapshotId != null ? snapshotId : this.rememberSnapshot(key, matched.map((m) => m.id));
    return {
      coord_system: "GCJ02",
      mode: entities.mode,
      snapshot_id: snapshotIdOut,
      query_key: key,
      total_matched: matched.length,
      returned_count: entities.items.length,
      complete: entities.complete,
      rule_version: RULE_VERSION,
      max_entities: MAX_ENTITIES_PER_RESPONSE,
      items: entities.items
    };
  }
  buildEntities(matched, q) {
    const clusters = clusterPoints(
      matched.map((m) => ({ id: m.id, lng: m.lng, lat: m.lat })),
      q.zoom,
      MAX_ENTITIES_PER_RESPONSE
    );
    const single = q.zoom >= 15 || clusters.length === matched.length;
    if (!single) {
      const items2 = clusters.map((c) => ({
        kind: "cluster",
        id: c.clusterId,
        count: c.items.length,
        longitude: c.lng,
        latitude: c.lat,
        expansion_bounds: c.expansionBounds,
        restaurant_ids: c.items.map((i) => i.id)
      }));
      const truncated = items2.length > MAX_ENTITIES_PER_RESPONSE;
      return {
        items: items2.slice(0, MAX_ENTITIES_PER_RESPONSE),
        mode: "clusters",
        complete: !truncated
      };
    }
    const byCoord = /* @__PURE__ */ new Map();
    for (const m of matched) {
      const k = `${m.lng.toFixed(4)},${m.lat.toFixed(4)}`;
      const arr = byCoord.get(k);
      if (arr) arr.push(m);
      else byCoord.set(k, [m]);
    }
    const items = [];
    for (const group of byCoord.values()) {
      if (group.length > 1 && q.zoom < 17) {
        const first = group[0];
        items.push({
          kind: "cluster",
          id: `same-coord-${first.id}`,
          count: group.length,
          longitude: first.lng,
          latitude: first.lat,
          expansion_bounds: { west: first.lng - 2e-3, south: first.lat - 2e-3, east: first.lng + 2e-3, north: first.lat + 2e-3 },
          restaurant_ids: group.map((g) => g.id)
        });
        continue;
      }
      for (const m of group) {
        items.push({
          kind: "restaurant",
          id: m.id,
          name: m.name,
          branch: m.branch,
          longitude: m.lng,
          latitude: m.lat,
          cuisines: m.cuisines,
          price: { average: m.price_avg, report_count: m.price_reports },
          top_dishes: m.dish_highlights.slice(0, 2),
          sources: m.sources,
          pending_verification: m.place_status !== "VERIFIED"
        });
      }
    }
    return { items, mode: "restaurants", complete: items.length <= MAX_ENTITIES_PER_RESPONSE };
  }
  rememberSnapshot(key, ids) {
    const id = `snap-v${this.resultsVersion}-${this.nextId("S")}`;
    this.snapshots.set(id, { id, query_key: key, version: this.resultsVersion, restaurant_ids: ids, created_at: this.stamp() });
    if (this.snapshots.size > 60) {
      const oldest = [...this.snapshots.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (oldest) this.snapshots.delete(oldest.id);
    }
    return id;
  }
  listRestaurants(q, snapshotId, cursor, limit) {
    var _a;
    const capped = Math.max(1, Math.min(50, limit));
    let ids;
    let snap = snapshotId;
    if (snapshotId) {
      const s = this.snapshots.get(snapshotId);
      if (!s || s.query_key !== this.queryKey(q) || s.version !== this.resultsVersion) {
        throw new ApiError("QUERY_EXPIRED", "\u67E5\u8BE2\u5FEB\u7167\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u62C9\u53D6\u5730\u56FE\u4E0E\u5217\u8868", 409);
      }
      ids = s.restaurant_ids;
    } else {
      const matched = this.matchedRestaurants(q);
      ids = matched.map((m) => m.id);
      snap = this.rememberSnapshot(this.queryKey(q), ids);
    }
    const start = cursor ? Math.max(0, ids.indexOf(cursor)) : 0;
    const page = ids.slice(start, start + capped);
    const next = start + capped < ids.length ? (_a = ids[start + capped]) != null ? _a : null : null;
    return {
      items: page.map((id) => this.toDto(this.restaurants.get(id))),
      next_cursor: next,
      snapshot_id: snap
    };
  }
  search(q) {
    var _a;
    const term = q.trim();
    if (!term) return { own: [], provider_candidates: [] };
    const terms = [term, ...(_a = ALIASES[term]) != null ? _a : []];
    const own = [...this.restaurants.values()].filter((rec) => !rec.deleted && !rec.merged_into).filter((rec) => {
      var _a2;
      const hay = [rec.name, (_a2 = rec.branch) != null ? _a2 : "", ...rec.dish_highlights, ...rec.taste_tags, rec.address].join(" ");
      return terms.some((t) => hay.includes(t));
    }).slice(0, 20).map((rec) => this.toDto(rec));
    const provider_candidates = own.length === 0 && term.length >= 2 ? [demoProviderCandidate(term)] : [];
    return { own, provider_candidates };
  }
  detail(id, sessionId) {
    var _a, _b;
    const rec = this.requireRestaurant(id);
    const fb2 = this.publicFeedbackFor(rec.id);
    const viewer = this.userIdOfSession(sessionId);
    return {
      ...this.toDto(rec),
      verification_note: rec.place_status === "VERIFIED" ? `\u5730\u70B9\u5DF2\u6838\u9A8C\uFF08${(_a = rec.place_verified_date) != null ? _a : "\u65E5\u671F\u672A\u77E5"}\uFF09` : rec.place_status === "REJECTED" ? `\u5730\u70B9\u6838\u9A8C\u672A\u901A\u8FC7\uFF1A${(_b = this.candidateRejectReason(rec.id)) != null ? _b : "\u5BA1\u6838\u5458\u672A\u586B\u5199\u5177\u4F53\u539F\u56E0"}` : "\u5730\u70B9\u5C1A\u672A\u6838\u9A8C\uFF1A\u8FD9\u662F\u5019\u9009\u95E8\u5E97\uFF0C\u4E0D\u4EE3\u8868\u5E73\u53F0\u63A8\u8350",
      business_status_note: rec.business_status === "UNKNOWN" ? "\u8425\u4E1A\u72B6\u6001\u672A\u6838\u5B9E" : rec.business_status === "OPEN" ? "\u6700\u8FD1\u6838\u9A8C\u4E3A\u8425\u4E1A\u4E2D\uFF08\u4E0D\u81EA\u52A8\u63A8\u5BFC\u5F53\u524D\u662F\u5426\u5728\u8425\u4E1A\uFF09" : rec.business_status === "SUSPECTED_CLOSED" ? "\u6536\u5230\u95ED\u5E97\u53CD\u9988\uFF0C\u590D\u6838\u4E2D" : "\u5DF2\u786E\u8BA4\u95ED\u5E97",
      my_current_feedback: viewer ? this.myFeedback(rec.id, viewer) : null,
      feedback_page: { items: fb2, next_cursor: null, snapshot_id: null }
    };
  }
  myFeedback(restaurantId, userId) {
    var _a, _b, _c, _d;
    const v = this.findVisit(userId, restaurantId);
    if (!v) return null;
    const cur = (_a = v.revisions.find((x) => x.revision === v.current_revision)) != null ? _a : null;
    const pending = (_b = [...v.revisions].reverse().find((x) => x.status === "PENDING")) != null ? _b : null;
    const shown = pending != null ? pending : cur;
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
      approved_revision: (_c = cur == null ? void 0 : cur.revision) != null ? _c : null,
      pending_revision: (_d = pending == null ? void 0 : pending.revision) != null ? _d : null,
      withdrawal_generation: v.withdrawal_generation,
      version: v.next_revision
    };
  }
  // ---------------------------------------------------------------- 会话与权限
  login(userId, code) {
    if (this.env === "production") throw new ApiError("FORBIDDEN", "\u751F\u4EA7\u73AF\u5883\u7981\u7528\u6F14\u793A\u767B\u5F55", 403);
    if (code !== DEMO_LOGIN_CODE) throw new ApiError("VALIDATION_ERROR", "\u9A8C\u8BC1\u7801\u9519\u8BEF", 400);
    const u = this.users.get(userId);
    if (!u || u.status !== "active") throw new ApiError("UNAUTHORIZED", "\u8D26\u53F7\u4E0D\u53EF\u7528", 401);
    const sid = `sess-${this.nextId("S")}`;
    this.sessions.set(sid, { user_id: u.id, created_at: this.stamp() });
    return { session_id: sid, user: this.sessionUser(u.id) };
  }
  sessionUser(userId) {
    const u = this.users.get(userId);
    if (!u) throw new ApiError("UNAUTHORIZED", "\u4F1A\u8BDD\u65E0\u6548", 401);
    return {
      id: u.id,
      display_name: u.display_name,
      roles: u.roles,
      phone_masked: u.phone_masked,
      is_test_data: true,
      account_status: u.status === "active" ? "active" : "deleting"
    };
  }
  /** 会话 → 用户 id；匿名、会话失效或账号注销都返回 null（只读接口不该因此报 401）。 */
  userIdOfSession(sessionId) {
    if (!sessionId) return null;
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    const u = this.users.get(s.user_id);
    return u && u.status === "active" ? u.id : null;
  }
  requireUser(sessionId) {
    const s = sessionId ? this.sessions.get(sessionId) : null;
    if (!s) throw new ApiError("UNAUTHORIZED", "\u9700\u8981\u767B\u5F55", 401);
    const u = this.users.get(s.user_id);
    if (!u || u.status !== "active") throw new ApiError("UNAUTHORIZED", "\u8D26\u53F7\u5DF2\u6CE8\u9500\u6216\u4E0D\u53EF\u7528", 401);
    return u;
  }
  /** 隔离内测环境的邀请账号：production 拒绝，真实短信登录由外部供应商适配。 */
  createInvitedUser(input, sessionId) {
    this.requireRole(sessionId, ["admin"]);
    if (this.env === "production") throw new ApiError("FORBIDDEN", "\u751F\u4EA7\u73AF\u5883\u7981\u7528\u9080\u8BF7\u8D26\u53F7", 403);
    if (this.users.has(input.id)) throw new ApiError("VALIDATION_ERROR", "\u8D26\u53F7\u5DF2\u5B58\u5728", 400);
    this.users.set(input.id, {
      id: input.id,
      display_name: input.display_name,
      roles: input.roles,
      phone_masked: "138****0000",
      status: "active"
    });
    this.ensureSystemCollections(input.id);
    this.logAudit(this.requireRole(sessionId, ["admin"]).id, "create_invited_user", input.id, null, null, null);
    return this.sessionUser(input.id);
  }
  requireRole(sessionId, roles) {
    const u = this.requireUser(sessionId);
    if (!u.roles.some((r2) => roles.includes(r2))) throw new ApiError("FORBIDDEN", "\u6743\u9650\u4E0D\u8DB3", 403);
    return u;
  }
  // ---------------------------------------------------------------- 投稿与反馈
  /** 投稿幂等：同 key 同内容返回同结果，同 key 换内容 409。 */
  idempotent(key, userId, route, payload, fn) {
    if (!key) return fn();
    const mapKey = `${userId}:${route}:${key}`;
    const hash2 = stableHash(payload);
    const prev = this.idempotency.get(mapKey);
    if (prev) {
      if (prev.request_hash !== hash2) {
        throw new ApiError("IDEMPOTENCY_CONFLICT", "\u76F8\u540C\u5E42\u7B49\u952E\u63D0\u4EA4\u4E86\u4E0D\u540C\u5185\u5BB9", 409);
      }
      return prev.result;
    }
    const result = fn();
    this.idempotency.set(mapKey, { key, user_id: userId, route, request_hash: hash2, result, created_at: this.stamp() });
    return result;
  }
  submitFeedback(input, sessionId) {
    const user = this.requireUser(sessionId);
    return this.idempotent(input.idempotency_key, user.id, "submitFeedback", input, () => {
      var _a;
      const rec = this.requireRestaurant(input.restaurant_id);
      const today = this.today();
      try {
        assertVisitDate(input.visited_date, today);
      } catch (e) {
        const msg = e.message;
        throw new ApiError("VALIDATION_ERROR", msg, 400, { visited_date: msg });
      }
      if (!input.disclosure) throw new ApiError("VALIDATION_ERROR", "\u5FC5\u987B\u9009\u62E9\u5229\u76CA\u62AB\u9732", 400, { disclosure: "\u8BF7\u9009\u62E9\u4E0E\u95E8\u5E97\u7684\u5173\u7CFB" });
      if (input.reason.trim().length < 20) {
        throw new ApiError("VALIDATION_ERROR", "\u7406\u7531\u9700\u8981 20\u2014500 \u5B57", 400, { reason: "\u81F3\u5C11 20 \u5B57" });
      }
      if (input.reason.trim().length > 500) throw new ApiError("VALIDATION_ERROR", "\u7406\u7531\u8D85\u8FC7 500 \u5B57", 400, { reason: "\u6700\u591A 500 \u5B57" });
      if (input.attitude === "recommend" && input.dish_names.length === 0) {
        throw new ApiError("VALIDATION_ERROR", "\u63A8\u8350\u9700\u8981\u81F3\u5C11\u4E00\u9053\u83DC", 400, { dish_names: "\u81F3\u5C11\u586B\u5199\u4E00\u9053\u83DC" });
      }
      const needsMedia = input.attitude === "recommend" && ((_a = input.require_media_for_recommend) != null ? _a : true);
      if (needsMedia && input.media_ids.length === 0) {
        throw new ApiError("VALIDATION_ERROR", "\u63A8\u8350\u597D\u5E97\u9700\u8981 1\u20146 \u5F20\u539F\u521B\u56FE\u7247", 400, { media_ids: "\u8BF7\u9009\u62E9\u81F3\u5C11\u4E00\u5F20\u56FE\u7247" });
      }
      if (input.media_ids.length > 6) throw new ApiError("VALIDATION_ERROR", "\u56FE\u7247\u6700\u591A 6 \u5F20", 400);
      for (const mid of input.media_ids) {
        const m = this.media.get(mid);
        if (!m || m.owner_user_id !== user.id) {
          throw new ApiError("FORBIDDEN", "\u56FE\u7247\u4E0D\u5C5E\u4E8E\u5F53\u524D\u8D26\u53F7", 403, { media_ids: "\u53EA\u80FD\u4F7F\u7528\u672C\u4EBA\u4E0A\u4F20\u7684\u56FE\u7247" });
        }
      }
      if (!isValidGcj02(rec.lng, rec.lat)) throw new ApiError("VALIDATION_ERROR", "\u95E8\u5E97\u5750\u6807\u4E0D\u5728\u6709\u6548\u8303\u56F4\u5185", 400);
      const outsideBeijing = !this.inBounds(rec, BEIJING_BOUNDS);
      if (outsideBeijing) throw new ApiError("VALIDATION_ERROR", "\u9996\u7248\u53EA\u6536\u5F55\u5317\u4EAC\u5883\u5185\u9910\u9986", 400, { restaurant_id: "\u4E0D\u5728\u5317\u4EAC\u8303\u56F4\u5185" });
      let visit = this.findVisit(user.id, rec.id);
      if (!visit) {
        visit = {
          id: this.nextId("V"),
          restaurant_id: rec.id,
          user_id: user.id,
          visited_date: input.visited_date,
          location_version: rec.location_version,
          next_revision: 1,
          current_revision: null,
          withdrawal_generation: 0,
          revisions: []
        };
        this.visits.push(visit);
      }
      const revision = {
        revision: visit.next_revision,
        status: "PENDING",
        attitude: input.attitude,
        reason: input.reason.trim(),
        dish_names: input.dish_names.map((d) => d.trim()).filter(Boolean),
        disclosure: input.disclosure,
        media_ids: input.media_ids,
        submitted_at: this.stamp(),
        decided_at: null,
        decided_by: null,
        reject_reason: null
      };
      visit.next_revision += 1;
      visit.revisions.push(revision);
      this.touch(rec.id);
      this.logAudit(user.id, "submit", `${rec.id}#v${revision.revision}`, null, null, revision.revision);
      return {
        submission: this.submissionOf(visit, revision, rec),
        created_revision: revision.revision
      };
    });
  }
  submissionOf(v, rev, rec) {
    var _a;
    return {
      id: `${v.id}#v${rev.revision}`,
      restaurant_id: rec.id,
      restaurant_name: rec.name + (rec.branch ? `\uFF08${rec.branch}\uFF09` : ""),
      attitude: rev.attitude,
      visited_date: v.visited_date,
      dish_names: rev.dish_names,
      reason: rev.reason,
      media_ids: rev.media_ids,
      disclosure: rev.disclosure,
      status: rev.status,
      reject_reason: rev.reject_reason,
      pending_verify_reason: rec.place_status === "PENDING" ? "\u95E8\u5E97\u5730\u70B9\u5C1A\u672A\u6838\u9A8C\uFF0C\u901A\u8FC7\u540E\u624D\u4F1A\u8FDB\u5165\u597D\u5E97\u5730\u56FE" : rec.place_status === "REJECTED" ? `\u95E8\u5E97\u5730\u70B9\u6838\u9A8C\u672A\u901A\u8FC7\uFF1A${(_a = this.candidateRejectReason(rec.id)) != null ? _a : "\u5BA1\u6838\u5458\u672A\u586B\u5199\u5177\u4F53\u539F\u56E0"}` : null,
      version: rev.revision,
      created_at: rev.submitted_at
    };
  }
  withdrawMyFeedback(restaurantId, sessionId) {
    const user = this.requireUser(sessionId);
    const rec = this.requireRestaurant(restaurantId);
    const v = this.findVisit(user.id, rec.id);
    if (!v || v.current_revision === null) throw new ApiError("NOT_FOUND", "\u6CA1\u6709\u53EF\u64A4\u56DE\u7684\u53CD\u9988", 404);
    v.current_revision = null;
    v.withdrawal_generation += 1;
    for (const rev of v.revisions) {
      if (rev.status === "PENDING") {
        rev.status = "WITHDRAWN";
        rev.reject_reason = "\u4F5C\u8005\u64A4\u56DE\uFF0C\u5F85\u5BA1\u7248\u672C\u4F5C\u5E9F";
      }
    }
    this.touch(rec.id);
    this.logAudit(user.id, "withdraw_feedback", rec.id, null, null, null);
    return { ok: true };
  }
  mySubmissions(sessionId) {
    const user = this.requireUser(sessionId);
    const out = [];
    for (const v of this.visits) {
      if (v.user_id !== user.id) continue;
      const rec = this.restaurants.get(v.restaurant_id);
      if (!rec) continue;
      for (const rev of v.revisions) out.push(this.submissionOf(v, rev, rec));
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  moderationQueue(sessionId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    const entries = [];
    for (const v of this.visits) {
      const rec = this.restaurants.get(v.restaurant_id);
      if (!rec) continue;
      for (const rev of v.revisions) {
        if (rev.status !== "PENDING") continue;
        entries.push({
          id: `${v.id}#v${rev.revision}`,
          type: "feedback_version",
          restaurant_id: rec.id,
          restaurant_name: rec.name,
          author: (_b = (_a = this.users.get(v.user_id)) == null ? void 0 : _a.display_name) != null ? _b : "?",
          preview: `${ATTITUDE_TEXT(rev.attitude)}\uFF5C${rev.reason}`,
          media_ids: rev.media_ids,
          status: rev.status,
          version: rev.revision,
          submitted_at: rev.submitted_at,
          is_author_self: revAuthor(v) === actor.id
        });
      }
    }
    for (const p of this.publications.values()) {
      if (p.status !== "PENDING_REVIEW") continue;
      const col = this.collections.get(p.collection_id);
      entries.push({
        id: p.id,
        type: "publication",
        restaurant_id: null,
        restaurant_name: p.title,
        author: (_e = (_d = this.users.get((_c = col == null ? void 0 : col.owner_user_id) != null ? _c : "")) == null ? void 0 : _d.display_name) != null ? _e : "?",
        preview: `${p.items.length} \u5BB6\u95E8\u5E97\uFF5C${(_f = p.description) != null ? _f : ""}`,
        media_ids: p.items.flatMap((i) => i.media_ids),
        status: p.status,
        version: p.generation,
        submitted_at: p.created_at,
        is_author_self: (col == null ? void 0 : col.owner_user_id) === actor.id
      });
    }
    for (const m of this.media.values()) {
      if (m.review_status !== "PENDING") continue;
      entries.push({
        id: m.id,
        type: "media",
        restaurant_id: m.restaurant_id,
        restaurant_name: m.restaurant_id ? (_h = (_g = this.restaurants.get(m.restaurant_id)) == null ? void 0 : _g.name) != null ? _h : null : null,
        author: (_j = (_i = this.users.get(m.owner_user_id)) == null ? void 0 : _i.display_name) != null ? _j : "?",
        preview: "\u5F85\u5BA1\u56FE\u7247",
        media_ids: [m.id],
        status: m.review_status,
        version: 1,
        // 早前的图片记录没存过上传时间，这里只能是"不知道"，不能拿本次读取的时间冒充
        submitted_at: (_k = m.created_at) != null ? _k : null,
        is_author_self: m.owner_user_id === actor.id
      });
    }
    return entries.sort((a, b) => {
      var _a2, _b2;
      return ((_a2 = b.submitted_at) != null ? _a2 : "").localeCompare((_b2 = a.submitted_at) != null ? _b2 : "");
    });
  }
  /**
   * 审核动作。乐观版本锁：expectedVersion 不匹配 409。
   * 较低 revision 不能覆盖已批准的较高 revision；作者不能自审。
   */
  moderate(input, sessionId) {
    var _a, _b, _c, _d, _e;
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    const [targetId, revText] = parseTarget(input.target);
    if (targetId.startsWith("PUB")) {
      const pub = this.publications.get(targetId);
      if (!pub) throw new ApiError("NOT_FOUND", "\u53D1\u5E03\u7533\u8BF7\u4E0D\u5B58\u5728", 404);
      const col = this.collections.get(pub.collection_id);
      if (!col) throw new ApiError("NOT_FOUND", "\u6E05\u5355\u4E0D\u5B58\u5728", 404);
      if (col.owner_user_id === actor.id) throw new ApiError("FORBIDDEN", "\u4F5C\u8005\u4E0D\u80FD\u5BA1\u6838\u81EA\u5DF1\u7684\u53D1\u5E03\u7533\u8BF7", 403);
      if (pub.status !== "PENDING_REVIEW") throw new ApiError("VERSION_CONFLICT", "\u8BE5\u7533\u8BF7\u5DF2\u88AB\u5904\u7406", 409);
      if (pub.generation !== input.expected_version) throw new ApiError("VERSION_CONFLICT", "\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8F7D\u540E\u518D\u64CD\u4F5C", 409);
      if (input.action === "approve") {
        if (pub.generation <= col.publication_generation) {
          throw new ApiError("VERSION_CONFLICT", "\u8BE5\u53D1\u5E03\u7533\u8BF7\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u4F5C\u8005\u91CD\u65B0\u63D0\u4EA4", 409);
        }
        for (const older of this.publications.values()) {
          if (older.collection_id === col.id && older.status === "PUBLISHED") {
            older.status = "REVOKED";
            older.revoked_at = this.stamp();
          }
        }
        pub.status = "PUBLISHED";
        pub.token = this.nextId("tok-");
        pub.published_at = this.stamp();
        col.publication_status = "PUBLISHED";
        col.publication_generation = pub.generation;
        col.active_token = pub.token;
        for (const id of pub.items.flatMap((i) => i.media_ids)) {
          const m = this.media.get(id);
          if (m) {
            m.review_status = "APPROVED";
            m.context = "publication";
            m.publication_id = pub.id;
          }
        }
      } else if (input.action === "reject") {
        pub.status = "REJECTED";
      } else {
        pub.status = "REVOKED";
        pub.revoked_at = this.stamp();
        col.publication_status = "REVOKED";
        col.active_token = null;
        col.publication_generation = Math.max(col.publication_generation, pub.generation);
      }
      this.logAudit(actor.id, `publication_${input.action}`, pub.id, (_a = input.reason) != null ? _a : null, pub.generation, pub.generation);
      this.touch();
      return { ok: true, community: "PENDING", in_default_layer: false };
    }
    if (revText === void 0 && targetId.startsWith("MM")) {
      const m = this.media.get(targetId);
      if (!m) throw new ApiError("NOT_FOUND", "\u56FE\u7247\u4E0D\u5B58\u5728", 404);
      if (m.owner_user_id === actor.id) throw new ApiError("FORBIDDEN", "\u4E0A\u4F20\u8005\u4E0D\u80FD\u5BA1\u6838\u81EA\u5DF1\u7684\u56FE\u7247", 403);
      if (m.review_status !== "PENDING") throw new ApiError("VERSION_CONFLICT", "\u8BE5\u56FE\u7247\u5DF2\u5904\u7406", 409);
      m.review_status = input.action === "approve" ? "APPROVED" : input.action === "reject" ? "REJECTED" : "HIDDEN";
      this.logAudit(actor.id, `media_${input.action}`, m.id, (_b = input.reason) != null ? _b : null, 1, 1);
      this.touch();
      return { ok: true, community: "PENDING", in_default_layer: false };
    }
    if (revText === void 0) throw new ApiError("VALIDATION_ERROR", "\u5BA1\u6838\u76EE\u6807\u683C\u5F0F\u5E94\u4E3A V#####:revision", 400);
    const visit = this.visits.find((v) => v.id === targetId);
    if (!visit) throw new ApiError("NOT_FOUND", "\u8BB0\u5F55\u4E0D\u5B58\u5728", 404);
    const rec = this.requireRestaurant(visit.restaurant_id);
    const rev = visit.revisions.find((x) => x.revision === Number(revText));
    if (!rev) throw new ApiError("NOT_FOUND", "\u7248\u672C\u4E0D\u5B58\u5728", 404);
    if (visit.user_id === actor.id) throw new ApiError("FORBIDDEN", "\u4F5C\u8005\u4E0D\u80FD\u5BA1\u6838\u81EA\u5DF1\u7684\u5185\u5BB9", 403);
    if (rev.status !== "PENDING" && input.action !== "hide") throw new ApiError("VERSION_CONFLICT", "\u8BE5\u7248\u672C\u5DF2\u5904\u7406", 409);
    if (rev.revision !== input.expected_version) throw new ApiError("VERSION_CONFLICT", "\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8F7D\u540E\u518D\u64CD\u4F5C", 409);
    const currentApproved = visit.revisions.find((x) => x.revision === visit.current_revision);
    if (input.action === "hide" && (rev.status !== "APPROVED" || visit.current_revision !== rev.revision)) {
      throw new ApiError("VERSION_CONFLICT", "\u53EA\u80FD\u9690\u85CF\u5F53\u524D\u5DF2\u6279\u51C6\u7248\u672C", 409);
    }
    if (input.action === "approve") {
      if (currentApproved && rev.revision < currentApproved.revision) {
        rev.status = "REJECTED";
        rev.reject_reason = "\u5DF2\u6709\u66F4\u9AD8\u7248\u672C\u516C\u5F00\uFF0C\u8F83\u4F4E\u7248\u672C\u4E0D\u8986\u76D6";
        throw new ApiError("VERSION_CONFLICT", "\u8F83\u4F4E\u7248\u672C\u4E0D\u80FD\u8986\u76D6\u5DF2\u6279\u51C6\u7684\u8F83\u9AD8\u7248\u672C", 409);
      }
      rev.status = "APPROVED";
      rev.decided_at = this.stamp();
      rev.decided_by = actor.id;
      visit.current_revision = rev.revision;
    } else if (input.action === "reject") {
      rev.status = "REJECTED";
      rev.decided_at = this.stamp();
      rev.decided_by = actor.id;
      rev.reject_reason = (_c = input.reason) != null ? _c : "\u5185\u5BB9\u4E0D\u7B26\u5408\u8981\u6C42";
    } else {
      if (rev.status !== "APPROVED" || visit.current_revision !== rev.revision) {
        throw new ApiError("VERSION_CONFLICT", "\u53EA\u80FD\u9690\u85CF\u5F53\u524D\u5DF2\u6279\u51C6\u7248\u672C", 409);
      }
      rev.status = "HIDDEN";
      visit.current_revision = null;
      rev.reject_reason = (_d = input.reason) != null ? _d : "\u8FDD\u89C4\u9690\u85CF";
    }
    this.logAudit(actor.id, `feedback_${input.action}`, `${visit.id}#v${rev.revision}`, (_e = input.reason) != null ? _e : null, rev.revision, rev.revision);
    this.touch(rec.id);
    return { ok: true, community: rec.community, in_default_layer: rec.in_default_layer };
  }
  // ---------------------------------------------------------------- 清单
  ensureSystemCollections(userId) {
    for (const s of SYSTEM_KINDS) {
      const id = `SYS-${userId}-${s.kind}`;
      if (this.collections.has(id)) continue;
      this.collections.set(id, {
        id,
        owner_user_id: userId,
        kind: "system",
        system_kind: s.kind,
        title: s.title,
        description: null,
        items: [],
        publication_status: "PRIVATE",
        active_token: null,
        publication_generation: 0,
        version: 1,
        updated_at: this.stamp()
      });
    }
  }
  addSystemItem(userId, restaurantId, kind) {
    this.ensureSystemCollections(userId);
    const col = this.collections.get(`SYS-${userId}-${kind}`);
    if (col.items.some((i) => i.restaurant_id === restaurantId)) return;
    col.items.push({
      restaurant_id: restaurantId,
      position: col.items.length,
      note: null,
      note_shareable: false,
      media_ids: [],
      added_at: this.stamp()
    });
    col.version += 1;
    col.updated_at = this.stamp();
  }
  /** 想吃与吃过互斥，私藏与自定义清单可共存；标记吃过不产生公开到店记录或票。 */
  toggleSystemCollectionItem(userId, restaurantId, kind, on) {
    this.ensureSystemCollections(userId);
    const rid = this.canonical(restaurantId);
    if (on) {
      if (kind === "want" || kind === "visited") {
        const other = kind === "want" ? "visited" : "want";
        const oc = this.collections.get(`SYS-${userId}-${other}`);
        oc.items = oc.items.filter((i) => i.restaurant_id !== rid);
        oc.version += 1;
        oc.updated_at = this.stamp();
      }
      this.addSystemItem(userId, rid, kind);
    } else {
      const col = this.collections.get(`SYS-${userId}-${kind}`);
      col.items = col.items.filter((i) => i.restaurant_id !== rid);
      col.version += 1;
      col.updated_at = this.stamp();
    }
    return this.listCollectionsForUser(userId);
  }
  listCollectionsForUser(userId) {
    this.ensureSystemCollections(userId);
    return [...this.collections.values()].filter((c) => c.owner_user_id === userId).sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)).map((c) => ({ ...c, items: [...c.items] }));
  }
  requireCollection(collectionId, userId) {
    const col = this.collections.get(collectionId);
    if (!col || col.owner_user_id !== userId) throw new ApiError("NOT_FOUND", "\u6E05\u5355\u4E0D\u5B58\u5728", 404);
    return col;
  }
  createCollection(userId, title, description) {
    if (!title.trim()) throw new ApiError("VALIDATION_ERROR", "\u6807\u9898\u5FC5\u586B", 400, { title: "\u8BF7\u8F93\u5165\u6807\u9898" });
    const col = {
      id: this.nextId("COL"),
      owner_user_id: userId,
      kind: "custom",
      system_kind: null,
      title: title.trim(),
      description: (description == null ? void 0 : description.trim()) || null,
      items: [],
      publication_status: "PRIVATE",
      active_token: null,
      publication_generation: 0,
      version: 1,
      updated_at: this.stamp()
    };
    this.collections.set(col.id, col);
    return col;
  }
  /** 只改标题/描述；已发布快照不受影响（重新发布才会切换快照）。 */
  updateCollectionMeta(collectionId, userId, patch) {
    var _a, _b;
    const col = this.requireCollection(collectionId, userId);
    if (patch.title !== void 0) {
      const title = patch.title.trim();
      if (!title) throw new ApiError("VALIDATION_ERROR", "\u6807\u9898\u5FC5\u586B", 400, { title: "\u8BF7\u8F93\u5165\u6807\u9898" });
      if (title.length > 60) throw new ApiError("VALIDATION_ERROR", "\u6807\u9898\u6700\u591A 60 \u5B57", 400, { title: "\u6700\u591A 60 \u5B57" });
      col.title = title;
    }
    if (patch.description !== void 0) {
      const desc = (_b = (_a = patch.description) == null ? void 0 : _a.trim()) != null ? _b : "";
      if (desc.length > 300) throw new ApiError("VALIDATION_ERROR", "\u8BF4\u660E\u6700\u591A 300 \u5B57", 400, { description: "\u6700\u591A 300 \u5B57" });
      col.description = desc || null;
    }
    col.version += 1;
    col.updated_at = this.stamp();
    return { ...col, items: [...col.items] };
  }
  updateCollectionItem(collectionId, restaurantId, patch, userId) {
    var _a, _b, _c;
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
          note: (_a = patch.note) != null ? _a : null,
          note_shareable: (_b = patch.note_shareable) != null ? _b : false,
          media_ids: (_c = patch.media_ids) != null ? _c : [],
          added_at: this.stamp()
        });
      col.items.sort((a, b) => a.position - b.position);
    }
    col.version += 1;
    col.updated_at = this.stamp();
    return { ...col, items: [...col.items] };
  }
  deleteCollection(collectionId, userId) {
    const col = this.requireCollection(collectionId, userId);
    for (const [id, p] of this.publications) {
      if (p.collection_id === col.id) this.publications.delete(id);
    }
    this.collections.delete(col.id);
    return { ok: true };
  }
  requestPublication(collectionId, userId, shareItemIds) {
    const col = this.requireCollection(collectionId, userId);
    if (col.kind !== "custom") throw new ApiError("VALIDATION_ERROR", "\u7CFB\u7EDF\u6E05\u5355\u4E0D\u80FD\u76F4\u63A5\u53D1\u5E03", 400);
    const items = col.items.filter((i) => shareItemIds.includes(i.restaurant_id)).map((i) => ({
      restaurant_id: i.restaurant_id,
      note: i.note_shareable ? i.note : null,
      media_ids: i.note_shareable ? i.media_ids : []
    }));
    if (items.length === 0) throw new ApiError("VALIDATION_ERROR", "\u81F3\u5C11\u9009\u62E9\u4E00\u5BB6\u53EF\u516C\u5F00\u7684\u95E8\u5E97", 400);
    for (const i of items) this.requireRestaurant(i.restaurant_id);
    const pub = {
      id: this.nextId("PUB"),
      collection_id: col.id,
      generation: col.publication_generation + 1,
      status: "PENDING_REVIEW",
      token: null,
      title: col.title,
      description: col.description,
      items,
      created_at: this.stamp(),
      published_at: null,
      revoked_at: null
    };
    this.publications.set(pub.id, pub);
    col.publication_status = "PENDING_REVIEW";
    col.version += 1;
    return pub;
  }
  /** 撤回公开：同一事务递增 publication_generation，作废此前全部待审申请，旧 token 永不恢复。 */
  unpublishCollection(collectionId, userId) {
    const col = this.requireCollection(collectionId, userId);
    col.publication_generation += 1;
    for (const p of this.publications.values()) {
      if (p.collection_id !== col.id) continue;
      if (p.status === "PUBLISHED") {
        p.status = "REVOKED";
        p.revoked_at = this.stamp();
      } else if (p.status === "PENDING_REVIEW") {
        p.status = "REJECTED";
      }
    }
    col.publication_status = "PRIVATE";
    col.active_token = null;
    col.version += 1;
    return { ...col, items: [...col.items] };
  }
  sharedSnapshot(token) {
    var _a;
    const pub = [...this.publications.values()].find((p) => p.token === token && p.status === "PUBLISHED");
    if (!pub) throw new ApiError("NOT_FOUND", "\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u64A4\u9500", 404);
    const col = this.collections.get(pub.collection_id);
    if (!col || col.publication_generation !== pub.generation || col.active_token !== token) {
      throw new ApiError("NOT_FOUND", "\u94FE\u63A5\u65E0\u6548\u6216\u5DF2\u64A4\u9500", 404);
    }
    const author = this.users.get(col.owner_user_id);
    if (!author || author.status !== "active") throw new ApiError("NOT_FOUND", "\u4F5C\u8005\u8D26\u53F7\u5DF2\u6CE8\u9500", 404);
    return {
      token,
      title: pub.title,
      description: pub.description,
      author_display_name: author.display_name,
      published_at: (_a = pub.published_at) != null ? _a : pub.created_at,
      items: pub.items.flatMap((i) => {
        const rec = this.restaurants.get(i.restaurant_id);
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
              return (m == null ? void 0 : m.review_status) === "APPROVED";
            }),
            pending_verification: !rec.in_default_layer
          }
        ];
      })
    };
  }
  // ---------------------------------------------------------------- 举报 / 门店管理 / 注销
  createReport(input, sessionId) {
    var _a;
    const user = this.requireUser(sessionId);
    const rec = this.requireRestaurant(input.restaurant_id);
    if (!input.detail.trim()) throw new ApiError("VALIDATION_ERROR", "\u8BF7\u586B\u5199\u8BF4\u660E", 400, { detail: "\u5FC5\u586B" });
    const target = ((_a = input.feedback_target) == null ? void 0 : _a.trim()) || null;
    if (target) {
      const [visitId] = target.split("#v");
      const visit = this.visits.find((v) => v.id === visitId);
      if (!visit || visit.restaurant_id !== rec.id) {
        throw new ApiError("VALIDATION_ERROR", "\u4E3E\u62A5\u5173\u8054\u7684\u53CD\u9988\u4E0D\u5C5E\u4E8E\u8FD9\u5BB6\u95E8\u5E97", 400, { feedback_target: "\u4E0E\u95E8\u5E97\u4E0D\u4E00\u81F4" });
      }
    }
    const open = this.reports.find(
      (x) => {
        var _a2;
        return x.reporter_id === user.id && x.restaurant_id === rec.id && x.kind === input.kind && ((_a2 = x.feedback_target) != null ? _a2 : null) === target && (x.status === "OPEN" || x.status === "IN_REVIEW");
      }
    );
    if (open) return open;
    const ticket = {
      id: this.nextId("REP"),
      restaurant_id: rec.id,
      kind: input.kind,
      detail: input.detail.trim(),
      reporter_id: user.id,
      status: "OPEN",
      created_at: this.stamp(),
      result_note: null,
      feedback_target: target,
      version: 1,
      handled_by: null,
      handled_at: null
    };
    this.reports.push(ticket);
    const closedReporters = new Set(
      this.reports.filter((x) => x.restaurant_id === rec.id && x.kind === "closed" && x.status !== "DISMISSED").map((x) => x.reporter_id)
    );
    if (input.kind === "closed" && closedReporters.size >= 3 && (rec.business_status === "OPEN" || rec.business_status === "UNKNOWN")) {
      rec.business_status = "SUSPECTED_CLOSED";
      this.touch(rec.id);
      this.logAudit("system", "workorder_created", rec.id, `${closedReporters.size} \u4E2A\u4E0D\u540C\u8D26\u53F7\u62A5\u544A\u95ED\u5E97\uFF0C\u751F\u6210\u9AD8\u4F18\u5148\u7EA7\u5DE5\u5355\uFF08\u4E0D\u81EA\u52A8\u5224\u5B9A\u95ED\u5E97\uFF09`, null, null);
    }
    return ticket;
  }
  reportQueue(sessionId, status = null) {
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    return [...this.reports].filter((r2) => status ? r2.status === status : true).sort(
      (a, b) => (a.status === "OPEN" ? 0 : a.status === "IN_REVIEW" ? 1 : 2) - (b.status === "OPEN" ? 0 : b.status === "IN_REVIEW" ? 1 : 2) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
    ).slice(0, MAX_ENTITIES_PER_RESPONSE).map((r2) => {
      var _a, _b;
      return {
        ...r2,
        restaurant_name: (_b = (_a = this.restaurants.get(r2.restaurant_id)) == null ? void 0 : _a.name) != null ? _b : null,
        is_reporter_self: r2.reporter_id === actor.id
      };
    });
  }
  myReports(sessionId) {
    const user = this.requireUser(sessionId);
    return this.reports.filter((r2) => r2.reporter_id === user.id);
  }
  /**
   * 工单处置。只改工单本身：门店的闭店/风险结论是另一套操作（REC-07 要求两者分开），
   * 举报人本人也不能处置自己的举报 —— 与「作者不能自审」同源。
   */
  decideReport(input, sessionId) {
    var _a, _b, _c, _d;
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    const ticket = this.reports.find((r2) => r2.id === input.id);
    if (!ticket) throw new ApiError("NOT_FOUND", "\u4E3E\u62A5\u5DE5\u5355\u4E0D\u5B58\u5728", 404);
    if (ticket.reporter_id === actor.id) {
      throw new ApiError("FORBIDDEN", "\u4E0D\u80FD\u5904\u7F6E\u81EA\u5DF1\u63D0\u4EA4\u7684\u4E3E\u62A5\uFF0C\u8BF7\u4EA4\u7ED9\u5176\u4ED6\u5BA1\u6838\u4EBA\u5458", 403);
    }
    if (ticket.version !== input.expected_version) throw new ApiError("VERSION_CONFLICT", "\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8F7D\u540E\u518D\u64CD\u4F5C", 409);
    const to = REPORT_ACTION_TARGET[input.action];
    if (!canTransitionReport(ticket.status, to, "moderator")) {
      throw new ApiError("VALIDATION_ERROR", `\u8BE5\u5DE5\u5355\u5F53\u524D\u4E3A\u300C${REPORT_STATUS_LABEL[ticket.status]}\u300D\uFF0C\u4E0D\u80FD\u6267\u884C\u6B64\u64CD\u4F5C`, 400);
    }
    const reason = (_b = (_a = input.reason) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (input.action !== "start" && !reason) {
      throw new ApiError("VALIDATION_ERROR", "\u7ED3\u6848\u4E0E\u9A73\u56DE\u90FD\u5FC5\u987B\u5199\u660E\u5904\u7406\u7ED3\u679C", 400, { reason: "\u5FC5\u586B" });
    }
    ticket.status = to;
    ticket.handled_by = actor.id;
    ticket.handled_at = this.stamp();
    ticket.result_note = input.action === "start" ? ticket.result_note : reason;
    ticket.version += 1;
    this.logAudit(actor.id, `report_${input.action}`, ticket.id, reason || null, ticket.version - 1, ticket.version);
    return {
      ...ticket,
      restaurant_name: (_d = (_c = this.restaurants.get(ticket.restaurant_id)) == null ? void 0 : _c.name) != null ? _d : null,
      is_reporter_self: false
    };
  }
  patchRestaurantStatus(input, sessionId) {
    var _a;
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    const rec = this.requireRestaurant(input.id);
    if (input.place_status && input.place_status !== rec.place_status) {
      const authorId = this.candidateAuthorOfRestaurant(rec.id);
      if (authorId && authorId === actor.id) {
        throw new ApiError("FORBIDDEN", "\u672C\u4EBA\u63D0\u4EA4\u7684\u95E8\u5E97\u5019\u9009\u4E0D\u80FD\u81EA\u5BA1\uFF0C\u8BF7\u4EA4\u7ED9\u5176\u4ED6\u5BA1\u6838\u4EBA\u5458", 403);
      }
    }
    if (input.place_status) {
      if (input.place_status !== rec.place_status) {
        rec.location_version += 1;
      }
      rec.place_status = input.place_status;
      rec.place_verified_date = input.place_status === "VERIFIED" ? this.today() : null;
    }
    if (input.business_status) rec.business_status = input.business_status;
    if (input.risk_status) rec.risk_status = input.risk_status;
    rec.version += 1;
    rec.updated_at = this.stamp();
    this.logAudit(actor.id, "patch_status", rec.id, (_a = input.reason) != null ? _a : null, rec.version - 1, rec.version);
    this.recompute(rec.id);
    this.touch(rec.id);
    return this.toDto(rec);
  }
  /** 门店合并：迁移反馈与清单引用，旧 ID 永久重定向，不自动合并近距离同品牌。 */
  mergeRestaurants(input, sessionId) {
    const actor = this.requireRole(sessionId, ["admin"]);
    const source = this.requireRestaurant(input.source_id);
    const target = this.requireRestaurant(input.target_id);
    if (source.id === target.id) throw new ApiError("VALIDATION_ERROR", "\u4E0D\u80FD\u4E0E\u81EA\u8EAB\u5408\u5E76", 400);
    if (source.version !== input.expected_version) throw new ApiError("VERSION_CONFLICT", "\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8F7D", 409);
    if (!input.reason.trim()) throw new ApiError("VALIDATION_ERROR", "\u5408\u5E76\u5FC5\u987B\u5199\u660E\u7406\u7531", 400);
    const conflicts = [];
    for (const v of this.visits) {
      if (v.restaurant_id !== source.id) continue;
      if (this.findVisit(v.user_id, target.id)) {
        conflicts.push(`${v.user_id} \u5728\u4E24\u5BB6\u95E8\u5E97\u90FD\u6709\u8BB0\u5F55\uFF0C\u4FDD\u7559\u76EE\u6807\u95E8\u5E97\u7968\uFF0C\u6765\u6E90\u7968\u4E0D\u518D\u8BA1\u7968`);
        v.current_revision = null;
        v.restaurant_id = target.id;
      } else {
        v.restaurant_id = target.id;
      }
    }
    for (const col of this.collections.values()) {
      const dup = col.items.some((i) => i.restaurant_id === target.id);
      col.items = col.items.map((i) => i.restaurant_id === source.id ? { ...i, restaurant_id: target.id } : i).filter((i, idx, arr) => arr.findIndex((x) => x.restaurant_id === i.restaurant_id) === idx || !dup);
      col.version += 1;
    }
    source.merged_into = target.id;
    source.profile_public = false;
    source.version += 1;
    for (const m of this.media.values()) if (m.restaurant_id === source.id) m.restaurant_id = target.id;
    this.logAudit(actor.id, "merge", `${source.id}->${target.id}`, input.reason, input.expected_version, source.version);
    if (conflicts.length) this.logAudit("system", "merge_conflict", target.id, conflicts.join("\uFF1B"), null, null);
    this.recompute(target.id);
    this.touch();
    return { canonical: target.id };
  }
  // ------------------------------------------------- 新门店候选与地点核验（阶段 1A）
  /** 门店是否由某条候选建出来：决定"作者不能自审地点"这条把关是否生效。 */
  candidateOfRestaurant(restaurantId) {
    for (const c of this.candidates.values()) if (c.restaurant_id === restaurantId) return c;
    return null;
  }
  candidateAuthorOfRestaurant(restaurantId) {
    var _a, _b;
    return (_b = (_a = this.candidateOfRestaurant(restaurantId)) == null ? void 0 : _a.submitted_by) != null ? _b : null;
  }
  candidateRejectReason(restaurantId) {
    const c = this.candidateOfRestaurant(restaurantId);
    return c && c.status === "REJECTED" ? c.reject_reason : null;
  }
  requireCandidate(id) {
    const c = this.candidates.get(id);
    if (!c) throw new ApiError("NOT_FOUND", "\u8BE5\u5EFA\u5E97\u7533\u8BF7\u4E0D\u5B58\u5728\u6216\u4F60\u65E0\u6743\u67E5\u770B", 404);
    return c;
  }
  /** 建店事实的唯一校验处 —— 静态模式与后端模式必须走同一段代码。 */
  checkCandidateFacts(i) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const err = (field, msg) => new ApiError("VALIDATION_ERROR", msg, 400, { [field]: msg });
    const name = (_b = (_a = i.name) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (name.length < 2 || name.length > 40) throw err("name", "\u95E8\u5E97\u540D\u9700\u8981 2\u201440 \u4E2A\u5B57");
    const branch = (_d = (_c = i.branch) == null ? void 0 : _c.trim()) != null ? _d : "";
    if (branch.length > 30) throw err("branch", "\u5206\u5E97\u540D\u6700\u591A 30 \u4E2A\u5B57");
    const address = (_f = (_e = i.address) == null ? void 0 : _e.trim()) != null ? _f : "";
    if (address.length < 5 || address.length > 120) throw err("address", "\u5730\u5740\u9700\u8981 5\u2014120 \u4E2A\u5B57");
    const floor = (_h = (_g = i.floor_info) == null ? void 0 : _g.trim()) != null ? _h : "";
    if (floor.length > 40) throw err("floor_info", "\u697C\u5C42\u4FE1\u606F\u6700\u591A 40 \u4E2A\u5B57");
    if (!Array.isArray(i.cuisines) || i.cuisines.length === 0) throw err("cuisines", "\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u83DC\u7CFB");
    if (i.cuisines.length > 3) throw err("cuisines", "\u83DC\u7CFB\u6807\u7B7E\u6700\u591A 3 \u4E2A");
    for (const c of i.cuisines) if (!CUISINES.includes(c)) throw err("cuisines", "\u83DC\u7CFB\u6807\u7B7E\u4E0D\u5728\u5141\u8BB8\u503C\u5185");
    if (!Number.isFinite(i.lng) || !Number.isFinite(i.lat) || !isValidGcj02(i.lng, i.lat)) {
      throw err("lng_lat", "\u5750\u6807\u7F3A\u5931\u6216\u4E0D\u5728 GCJ-02 \u5408\u6CD5\u8303\u56F4");
    }
    if (!this.inBounds({ lng: i.lng, lat: i.lat }, BEIJING_BOUNDS)) throw err("lng_lat", "\u9996\u7248\u53EA\u6536\u5F55\u5317\u4EAC\u5883\u5185\u9910\u9986");
    if (!CANDIDATE_SOURCES.includes(i.source)) throw err("source", "\u8BF7\u9009\u62E9\u5730\u70B9\u6765\u6E90");
    if (i.source === "provider_poi" && (!i.provider || !i.poi_id)) throw err("poi_id", "\u9009\u62E9\u5730\u56FE\u5730\u70B9\u5019\u9009\u65F6\u5FC5\u987B\u5E26\u6765\u6E90 ID");
    const note = (_j = (_i = i.evidence_note) == null ? void 0 : _i.trim()) != null ? _j : "";
    if (note.length < CANDIDATE_MIN_EVIDENCE_CHARS || note.length > CANDIDATE_MAX_EVIDENCE_CHARS) {
      throw err("evidence_note", `\u8BF7\u5199\u660E\u4FE1\u606F\u6765\u6E90\uFF08${CANDIDATE_MIN_EVIDENCE_CHARS}\u2014${CANDIDATE_MAX_EVIDENCE_CHARS} \u5B57\uFF09`);
    }
    return {
      ...i,
      name,
      branch: branch || null,
      address,
      floor_info: floor || null,
      cuisines: [...new Set(i.cuisines)],
      source: i.source,
      provider: ((_k = i.provider) == null ? void 0 : _k.trim()) || null,
      poi_id: ((_l = i.poi_id) == null ? void 0 : _l.trim()) || null,
      evidence_note: note
    };
  }
  /** 重复提示在读取时重算：门店库会增长，落库的提示会过期。 */
  candidateDuplicates(c) {
    const stores = [...this.restaurants.values()].filter((r2) => !r2.deleted && !r2.merged_into && r2.id !== c.restaurant_id).map((r2) => ({ id: r2.id, name: r2.name, branch: r2.branch, lng: r2.lng, lat: r2.lat, provider: null, poi_id: null }));
    const others = [...this.candidates.values()].filter((x) => x.id !== c.id && x.status !== "MERGED");
    const hits = [];
    for (const h of matchDuplicates(c, stores)) {
      hits.push({ kind: "restaurant", matched_id: h.match.id, name: h.match.name, branch: h.match.branch, reason: h.reason, distance_m: h.distance_m });
    }
    for (const h of matchDuplicates(c, others)) {
      hits.push({ kind: "candidate", matched_id: h.match.id, name: h.match.name, branch: h.match.branch, reason: h.reason, distance_m: h.distance_m });
    }
    return hits.slice(0, CANDIDATE_MAX_DUP_HINTS);
  }
  toCandidateDto(c, sessionId, extraHints = []) {
    var _a, _b;
    const actor = this.userIdOfSession(sessionId);
    const rest = c.restaurant_id ? this.restaurants.get(c.restaurant_id) : null;
    return {
      id: c.id,
      revision: c.revision,
      name: c.name,
      branch: c.branch,
      address: c.address,
      floor_info: c.floor_info,
      cuisines: [...c.cuisines],
      lng: c.lng,
      lat: c.lat,
      coord_system: "GCJ02",
      source: c.source,
      provider: c.provider,
      poi_id: c.poi_id,
      evidence_note: c.evidence_note,
      status: c.status,
      restaurant_id: c.restaurant_id,
      duplicates: [...extraHints, ...this.candidateDuplicates(c)],
      submitted_by: c.submitted_by,
      author_display_name: (_b = (_a = this.users.get(c.submitted_by)) == null ? void 0 : _a.display_name) != null ? _b : "\u5DF2\u6CE8\u9500\u7528\u6237",
      is_author_self: actor !== null && actor === c.submitted_by,
      place_status: rest && !rest.deleted && !rest.merged_into ? rest.place_status : null,
      reject_reason: c.reject_reason,
      decided_by: c.decided_by,
      decided_at: c.decided_at,
      version: c.version,
      created_at: c.created_at,
      updated_at: c.updated_at,
      is_test_data: true
    };
  }
  /**
   * 建店申请：落一条候选 + 一家地点状态为 PENDING 的门店。
   * 门店能立刻被投稿（SUB-02 要求投稿状态真实），但默认层谓词一个字都没改就把它挡在外面。
   */
  createCandidate(input, sessionId) {
    const user = this.requireUser(sessionId);
    return this.idempotent(input.idempotency_key, user.id, "createCandidate", input, () => {
      const facts = this.checkCandidateFacts(input);
      const mine = [...this.candidates.values()].filter((c) => c.submitted_by === user.id && c.status !== "MERGED");
      const hit = matchDuplicates(facts, mine)[0];
      if (hit) {
        if (hit.match.status === "PENDING") {
          return this.toCandidateDto(hit.match, sessionId, [
            {
              kind: "candidate",
              matched_id: hit.match.id,
              name: hit.match.name,
              branch: hit.match.branch,
              reason: "same_author_pending",
              distance_m: hit.distance_m
            }
          ]);
        }
        throw new ApiError("VALIDATION_ERROR", "\u8FD9\u5BB6\u5E97\u4F60\u4E4B\u524D\u63D0\u4EA4\u7684\u5019\u9009\u5DF2\u88AB\u9A73\u56DE\uFF0C\u8BF7\u5728\u539F\u7533\u8BF7\u4E0A\u8865\u5145\u6750\u6599", 400, {
          candidate_id: hit.match.id
        });
      }
      const rid = this.nextId("R");
      const rec = {
        id: rid,
        name: facts.name,
        branch: facts.branch,
        cuisines: [...facts.cuisines],
        address: facts.address,
        floor_info: facts.floor_info,
        lng: facts.lng,
        lat: facts.lat,
        price_avg: null,
        price_reports: 0,
        dish_highlights: [],
        taste_tags: [],
        photo_media_ids: [],
        profile_public: true,
        place_status: "PENDING",
        place_verified_date: null,
        business_status: "UNKNOWN",
        risk_status: "CLEAR",
        location_version: 1,
        ever_qualified: false,
        editorial: null,
        merged_into: null,
        deleted: false,
        version: 1,
        updated_at: this.stamp(),
        note: "\u7528\u6237\u63D0\u4EA4\u7684\u65B0\u95E8\u5E97\u5019\u9009\uFF1A\u5730\u70B9\u5F85\u4EBA\u5DE5\u6838\u9A8C\uFF0C\u4E0D\u4EE3\u8868\u5E73\u53F0\u63A8\u8350",
        tally: { recommend: 0, neutral: 0, not_recommend: 0, total: 0 },
        window_start: addDays(this.today(), -(SCORING_WINDOW_DAYS - 1)),
        window_end: this.today(),
        community: "PENDING",
        endorsement: "NONE",
        sources: [],
        in_default_layer: false,
        ineligibility_reasons: []
      };
      this.restaurants.set(rid, rec);
      this.recompute(rid);
      const cand = {
        id: this.nextId("RC"),
        revision: 1,
        ...facts,
        cuisines: [...facts.cuisines],
        status: "PENDING",
        restaurant_id: rid,
        submitted_by: user.id,
        reject_reason: null,
        decided_by: null,
        decided_at: null,
        version: 1,
        created_at: this.stamp(),
        updated_at: this.stamp()
      };
      this.candidates.set(cand.id, cand);
      this.logAudit(user.id, "candidate_create", `${cand.id}->${rid}`, facts.evidence_note, null, 1);
      this.touch(rid);
      return this.toCandidateDto(cand, sessionId);
    });
  }
  myCandidates(sessionId) {
    const user = this.requireUser(sessionId);
    return [...this.candidates.values()].filter((c) => c.submitted_by === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, MAX_ENTITIES_PER_RESPONSE).map((c) => this.toCandidateDto(c, sessionId));
  }
  /** 地点核验队列：待核验的排在前面，上限与其他列表一致。 */
  candidateQueue(sessionId, status = null) {
    this.requireRole(sessionId, ["moderator", "admin"]);
    return [...this.candidates.values()].filter((c) => status ? c.status === status : true).sort(
      (a, b) => (a.status === "PENDING" ? 0 : 1) - (b.status === "PENDING" ? 0 : 1) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)
    ).slice(0, MAX_ENTITIES_PER_RESPONSE).map((c) => this.toCandidateDto(c, sessionId));
  }
  /** 核验 / 驳回 / 并入已有门店。作者不能自审本人的候选，即使他同时是管理员。 */
  decideCandidate(input, sessionId) {
    var _a, _b, _c, _d;
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    const c = this.requireCandidate(input.id);
    if (c.submitted_by === actor.id) {
      throw new ApiError("FORBIDDEN", "\u672C\u4EBA\u63D0\u4EA4\u7684\u95E8\u5E97\u5019\u9009\u4E0D\u80FD\u81EA\u5BA1\uFF0C\u8BF7\u4EA4\u7ED9\u5176\u4ED6\u5BA1\u6838\u4EBA\u5458", 403);
    }
    if (c.version !== input.expected_version) throw new ApiError("VERSION_CONFLICT", "\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8F7D\u540E\u518D\u64CD\u4F5C", 409);
    const to = input.action === "verify" ? "VERIFIED" : input.action === "reject" ? "REJECTED" : "MERGED";
    if (!canTransitionCandidate(c.status, to, "moderator")) {
      throw new ApiError("VALIDATION_ERROR", `\u8BE5\u5019\u9009\u5F53\u524D\u4E3A\u300C${CANDIDATE_STATUS_LABEL[c.status]}\u300D\uFF0C\u4E0D\u80FD\u6267\u884C\u6B64\u64CD\u4F5C`, 400);
    }
    const reason = (_b = (_a = input.reason) == null ? void 0 : _a.trim()) != null ? _b : "";
    if (input.action !== "verify" && !reason) {
      throw new ApiError("VALIDATION_ERROR", "\u9A73\u56DE\u6216\u5E76\u5165\u90FD\u5FC5\u987B\u5199\u660E\u7406\u7531", 400, { reason: "\u5FC5\u586B" });
    }
    if (!c.restaurant_id) throw new ApiError("NOT_FOUND", "\u8BE5\u5019\u9009\u6CA1\u6709\u5173\u8054\u95E8\u5E97\u8BB0\u5F55", 404);
    const rec = this.requireRestaurant(c.restaurant_id);
    if (input.action === "verify") {
      this.patchRestaurantStatus({ id: rec.id, place_status: "VERIFIED", reason: reason || `\u6838\u9A8C\u5EFA\u5E97\u7533\u8BF7 ${c.id}` }, sessionId);
    } else if (input.action === "reject") {
      this.patchRestaurantStatus({ id: rec.id, place_status: "REJECTED", reason }, sessionId);
      c.reject_reason = reason;
    } else {
      const targetId = (_d = (_c = input.target_restaurant_id) == null ? void 0 : _c.trim()) != null ? _d : "";
      if (!targetId) throw new ApiError("VALIDATION_ERROR", "\u8BF7\u9009\u62E9\u8981\u5E76\u5165\u7684\u5DF2\u6709\u95E8\u5E97", 400, { target_restaurant_id: "\u5FC5\u586B" });
      const target = this.requireRestaurant(targetId);
      if (target.id === rec.id) throw new ApiError("VALIDATION_ERROR", "\u4E0D\u80FD\u5E76\u5165\u81EA\u5DF1", 400, { target_restaurant_id: "\u540C\u4E00\u95E8\u5E97" });
      this.mergeRestaurants({ source_id: rec.id, target_id: target.id, reason, expected_version: rec.version }, sessionId);
      c.restaurant_id = target.id;
    }
    c.status = to;
    c.decided_by = actor.id;
    c.decided_at = this.stamp();
    c.version += 1;
    c.updated_at = c.decided_at;
    this.logAudit(actor.id, `candidate_${input.action}`, c.id, reason || null, c.version - 1, c.version);
    this.touch();
    return this.toCandidateDto(c, sessionId);
  }
  /** 被驳回的候选由作者补材料重新回到待核验：同一条记录递增 revision，不新开一条。 */
  resubmitCandidateMaterials(input, sessionId) {
    var _a;
    const user = this.requireUser(sessionId);
    const c = this.requireCandidate(input.id);
    if (c.submitted_by !== user.id) throw new ApiError("FORBIDDEN", "\u53EA\u80FD\u5728\u672C\u4EBA\u63D0\u4EA4\u7684\u5019\u9009\u4E0A\u8865\u5145\u6750\u6599", 403);
    if (c.version !== input.expected_version) throw new ApiError("VERSION_CONFLICT", "\u7248\u672C\u51B2\u7A81\uFF0C\u8BF7\u91CD\u8F7D\u540E\u518D\u64CD\u4F5C", 409);
    if (!canTransitionCandidate(c.status, "PENDING", "author")) {
      throw new ApiError("VALIDATION_ERROR", `\u5F53\u524D\u72B6\u6001\u300C${CANDIDATE_STATUS_LABEL[c.status]}\u300D\u4E0D\u9700\u8981\u8865\u5145\u6750\u6599`, 400);
    }
    const facts = this.checkCandidateFacts({ ...c, ...input.patch, source: (_a = input.patch.source) != null ? _a : c.source });
    const fromVersion = c.version;
    Object.assign(c, facts);
    c.revision += 1;
    c.status = "PENDING";
    c.reject_reason = null;
    c.decided_by = null;
    c.decided_at = null;
    c.version = fromVersion + 1;
    c.updated_at = this.stamp();
    const rec = c.restaurant_id ? this.restaurants.get(c.restaurant_id) : null;
    if (rec && !rec.deleted && !rec.merged_into) {
      const moved = rec.lng !== facts.lng || rec.lat !== facts.lat;
      rec.name = facts.name;
      rec.branch = facts.branch;
      rec.address = facts.address;
      rec.floor_info = facts.floor_info;
      rec.cuisines = [...facts.cuisines];
      rec.lng = facts.lng;
      rec.lat = facts.lat;
      if (moved) {
        rec.location_version += 1;
      }
      if (rec.place_status !== "PENDING") {
        rec.place_status = "PENDING";
        rec.place_verified_date = null;
      }
      rec.version += 1;
      rec.updated_at = c.updated_at;
      this.recompute(rec.id);
      this.logAudit(user.id, "candidate_resubmit", `${c.id}->${rec.id}${moved ? "\uFF08\u5750\u6807\u53D8\u5316\uFF0Clocation_version \u9012\u589E\uFF09" : ""}`, null, fromVersion, c.version);
    } else {
      this.logAudit(user.id, "candidate_resubmit", c.id, "\u5173\u8054\u95E8\u5E97\u5DF2\u4E0D\u5B58\u5728\uFF0C\u4EC5\u5019\u9009\u672C\u8EAB\u56DE\u5230\u5F85\u6838\u9A8C", fromVersion, c.version);
    }
    this.touch(rec == null ? void 0 : rec.id);
    return this.toCandidateDto(c, sessionId);
  }
  /** 注销：立即撤销会话、撤销本人分享、隐藏 UGC、移除计票。 */
  deleteAccount(sessionId) {
    var _a;
    const user = this.requireUser(sessionId);
    user.status = "deleting";
    user.deletion_job_id = this.nextId("DELJOB");
    for (const v of this.visits) {
      if (v.user_id !== user.id) continue;
      v.current_revision = null;
      v.withdrawal_generation += 1;
      for (const rev of v.revisions) if (rev.status === "APPROVED" || rev.status === "PENDING") rev.status = "WITHDRAWN";
    }
    for (const col of this.collections.values()) {
      if (col.owner_user_id !== user.id) continue;
      this.unpublishCollection(col.id, user.id);
    }
    for (const m of this.media.values()) if (m.owner_user_id === user.id && m.context === "publication") m.context = "private";
    for (const r2 of this.restaurants.values()) if (((_a = r2.editorial) == null ? void 0 : _a.author_user_id) === user.id) r2.editorial = null;
    for (const [sid, s] of [...this.sessions.entries()]) if (s.user_id === user.id) this.sessions.delete(sid);
    this.recomputeAll();
    this.touch();
    this.logAudit(user.id, "delete_account", user.id, "\u6CE8\u9500\uFF1A\u4F1A\u8BDD\u64A4\u9500\u3001\u5206\u4EAB\u64A4\u9500\u3001UGC \u9690\u85CF\u3001\u79FB\u51FA\u8BA1\u7968", null, null);
    return { deletion_job_id: user.deletion_job_id };
  }
  hasPendingDeletions() {
    for (const u of this.users.values()) if (u.status === "deleting") return true;
    return false;
  }
  /** 幂等清除任务。deleting 用户行就是持久化任务，进程重启后继续扫描。 */
  processDeletionJobs() {
    var _a;
    let count = 0;
    for (const user of this.users.values()) {
      if (user.status !== "deleting") continue;
      const uid = user.id;
      const collections = new Set([...this.collections.values()].filter((c) => c.owner_user_id === uid).map((c) => c.id));
      const media = new Set([...this.media.values()].filter((m) => m.owner_user_id === uid).map((m) => m.id));
      this.visits = this.visits.filter((v) => v.user_id !== uid);
      for (const id of media) this.media.delete(id);
      for (const [id, pub] of this.publications) if (collections.has(pub.collection_id)) this.publications.delete(id);
      for (const id of collections) this.collections.delete(id);
      for (const [key, item] of this.idempotency) if (item.user_id === uid) this.idempotency.delete(key);
      for (const [sid, session] of this.sessions) if (session.user_id === uid) this.sessions.delete(sid);
      for (const r2 of this.restaurants.values()) {
        r2.photo_media_ids = r2.photo_media_ids.filter((id) => !media.has(id));
        if (((_a = r2.editorial) == null ? void 0 : _a.author_user_id) === uid) r2.editorial = null;
      }
      for (const report of this.reports) if (report.reporter_id === uid) report.detail = "\u8D26\u53F7\u5DF2\u6CE8\u9500\uFF0C\u8BF4\u660E\u5DF2\u6E05\u9664";
      for (const entry of this.audit) if (entry.actor_id === uid) entry.reason = null;
      user.display_name = "\u5DF2\u6CE8\u9500\u7528\u6237";
      user.phone_masked = "";
      user.roles = [];
      user.status = "deleted";
      user.deletion_completed_at = this.stamp();
      this.logAudit("system", "delete_account_completed", uid, "\u8D26\u53F7\u5185\u5BB9\u6E05\u9664\u5B8C\u6210\uFF1B\u4FDD\u7559\u53BB\u6807\u8BC6\u8D26\u53F7\u884C\u53CA\u590D\u6838\u65E5\u5FD7", null, null);
      count += 1;
    }
    if (count) {
      this.recomputeAll();
      this.touch();
    }
    return count;
  }
  restoreEndorsement(input, sessionId) {
    var _a, _b;
    const actor = this.requireRole(sessionId, ["moderator", "admin"]);
    const rec = this.requireRestaurant(input.restaurant_id);
    if (!rec.editorial) throw new ApiError("NOT_FOUND", "\u8BE5\u95E8\u5E97\u6CA1\u6709\u7F16\u8F91\u80CC\u4E66", 404);
    if (input.action === "verify") {
      if (rec.editorial.author_user_id === actor.id) throw new ApiError("FORBIDDEN", "\u80CC\u4E66\u4F5C\u8005\u4E0D\u80FD\u81EA\u5BA1\uFF0C\u5373\u4F7F\u540C\u65F6\u662F\u7BA1\u7406\u5458", 403);
      rec.editorial.verifier_user_id = actor.id;
      rec.editorial.verified_at = this.stamp();
      rec.editorial.revoked_at = null;
    } else {
      rec.editorial.revoked_at = this.stamp();
      rec.editorial.revoke_reason = (_a = input.reason) != null ? _a : "\u7F16\u8F91\u64A4\u56DE";
    }
    this.logAudit(actor.id, `endorsement_${input.action}`, rec.id, (_b = input.reason) != null ? _b : null, null, null);
    this.recompute(rec.id);
    this.touch(rec.id);
    return this.toDto(rec);
  }
  // ---------------------------------------------------------------- 日志
  logAudit(actorId, action, target, reason, fromV, toV) {
    this.audit.push({
      id: this.nextId("AUD"),
      at: this.stamp(),
      actor_id: actorId,
      action,
      target,
      reason,
      from_version: fromV,
      to_version: toV
    });
  }
  auditLog(sessionId) {
    this.requireRole(sessionId, ["moderator", "admin"]);
    return [...this.audit].reverse().slice(0, 200);
  }
  /** 定时清理之外，读接口也会重算到期资格，避免只靠定时任务。 */
  refreshExpiredQualification() {
    this.recomputeAll();
  }
  /**
   * 整库快照：静态 demo 存 localStorage，后端 API 存 SQLite 文档表。
   * 不含 snapshots（短时查询快照），重启后由查询重建。
   */
  dumpState() {
    return JSON.stringify({
      schema: 1,
      results_version: this.resultsVersion,
      seq: this.seq,
      last_computed_day: this.lastComputedDay,
      restaurants: [...this.restaurants.values()],
      candidates: [...this.candidates.values()],
      users: [...this.users.values()],
      visits: this.visits,
      media: [...this.media.values()],
      collections: [...this.collections.values()],
      publications: [...this.publications.values()],
      reports: this.reports,
      audit: this.audit,
      idempotency: [...this.idempotency.values()],
      sessions: [...this.sessions.entries()]
    });
  }
  loadState(json) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    const s = JSON.parse(json);
    this.restaurants = new Map(((_a = s.restaurants) != null ? _a : []).map((r2) => [r2.id, r2]));
    this.candidates = new Map(((_b = s.candidates) != null ? _b : []).map((c) => [c.id, c]));
    this.users = new Map(((_c = s.users) != null ? _c : []).map((u) => [u.id, u]));
    this.visits = (_d = s.visits) != null ? _d : [];
    this.media = new Map(((_e = s.media) != null ? _e : []).map((m) => [m.id, m]));
    this.collections = new Map(((_f = s.collections) != null ? _f : []).map((c) => [c.id, c]));
    this.publications = new Map(((_g = s.publications) != null ? _g : []).map((p) => [p.id, p]));
    this.reports = (_h = s.reports) != null ? _h : [];
    this.audit = (_i = s.audit) != null ? _i : [];
    this.idempotency = new Map(((_j = s.idempotency) != null ? _j : []).map((i) => [`${i.user_id}:${i.route}:${i.key}`, i]));
    this.sessions = new Map(((_k = s.sessions) != null ? _k : []).map(([k, v]) => [k, v]));
    this.resultsVersion = (_l = s.results_version) != null ? _l : this.resultsVersion;
    this.seq = (_m = s.seq) != null ? _m : this.seq;
    this.snapshots.clear();
    this.recomputeAll();
    void s.last_computed_day;
  }
};
function ATTITUDE_TEXT(a) {
  return a === "recommend" ? "\u63A8\u8350" : a === "neutral" ? "\u4E00\u822C" : "\u4E0D\u63A8\u8350";
}
function demoProviderCandidate(term) {
  const h = [...stableHash(term)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return {
    provider: "demo-provider",
    poi_id: `POI-DEMO-${h % 977 + 1}`,
    name: `\u5019\u9009\u5730\u70B9\uFF08\u672A\u5165\u5E93\uFF09\xB7${term}`,
    address: "\u5317\u4EAC\u5E02\uFF08\u4F9B\u5E94\u5546\u5019\u9009\uFF0C\u4EC5\u7528\u4E8E\u521B\u5EFA\u95E8\u5E97\u6D41\u7A0B\uFF09",
    lng: Number((BEIJING_CENTER.lng + (h % 21 - 10) / 100).toFixed(5)),
    lat: Number((BEIJING_CENTER.lat + (Math.floor(h / 7) % 21 - 10) / 100).toFixed(5)),
    coord_system: "GCJ02",
    coord_note: "\u6F14\u793A\u5408\u6210\u5750\u6807\uFF0C\u975E\u771F\u5B9E\u95E8\u5E97\u4F4D\u7F6E"
  };
}
function revAuthor(v) {
  return v.user_id;
}
function parseTarget(target) {
  const [id, rev] = target.split("#v");
  return [(id != null ? id : "").trim(), rev];
}
function stableHash(value) {
  const s = JSON.stringify(value, (_k, v) => typeof v === "object" && v !== null ? sortKeys(v) : v);
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = sortKeys(value[k]);
    return out;
  }
  return value;
}
