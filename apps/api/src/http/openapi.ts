import {
  ATTITUDES,
  BUSINESS_STATUSES,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
  CUISINES,
  CONTRACT_VERSION,
  DISCLOSURES,
  DUPLICATE_REASONS,
  ERROR_CODES,
  LAYERS,
  PLACE_STATUSES,
  RISK_STATUSES,
  VIEWS,
} from '@qianwei/contracts';
import type { RouteDef } from './router';
import { MAX_PAGE_LIMIT } from './query';

/**
 * 手写 OpenAPI 3.0 文档。
 * paths 的方法/路径/摘要直接取自真实路由表（buildRouter 的结果），
 * 参数与请求体逐条手写，测试会断言"每个路由都被文档覆盖"，避免文档变成装饰。
 */

type Schema = Record<string, unknown>;

const str = (fmt?: string): Schema => ({ type: 'string', ...(fmt ? { format: fmt } : {}) });
const num = (): Schema => ({ type: 'number' });
const int = (min?: number, max?: number): Schema => ({ type: 'integer', ...(min !== undefined ? { minimum: min } : {}), ...(max !== undefined ? { maximum: max } : {}) });
const bool = (): Schema => ({ type: 'boolean' });
const nullable = (s: Schema): Schema => ({ ...s, nullable: true });
const arr = (s: Schema): Schema => ({ type: 'array', items: s });
const obj = (props: Record<string, Schema>, required: string[] = []): Schema => ({
  type: 'object',
  properties: props,
  ...(required.length ? { required } : {}),
  additionalProperties: true,
});
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const enumOf = (values: readonly string[], extra: 'nullable' | 'none' = 'none'): Schema =>
  extra === 'nullable' ? nullable({ type: 'string', enum: [...values] }) : { type: 'string', enum: [...values] };

const META = obj({ requestId: str() }, ['requestId']);

function ok(data: Schema, description = '成功'): Schema {
  return { description, content: { 'application/json': { schema: obj({ data, meta: ref('ResponseMeta') }, ['data', 'meta']) } } };
}

const ERROR_BODY = obj(
  {
    error: obj({ code: ref('ErrorCode'), message: str(), fieldErrors: { type: 'object', additionalProperties: str() } }, ['code', 'message']),
    meta: ref('ResponseMeta'),
  },
  ['error', 'meta'],
);

function err(status: number, code: string, description: string): Schema {
  return {
    description,
    content: {
      'application/json': {
        schema: ERROR_BODY,
        example: { error: { code, message: description }, meta: { requestId: '00000000-0000-0000-0000-000000000000' } },
      },
    },
  };
}

const BOUNDS = obj({ west: num(), south: num(), east: num(), north: num() }, ['west', 'south', 'east', 'north']);

const PRICE = obj({ average: nullable(num()), report_count: int() }, ['average', 'report_count']);

const BASIS = obj(
  {
    community: enumOf(['PENDING', 'QUALIFIED', 'LAPSED']),
    tally: obj({ recommend: int(), neutral: int(), not_recommend: int(), total: int() }, ['recommend', 'neutral', 'not_recommend', 'total']),
    window_start: str('date'),
    window_end: str('date'),
    editorial: enumOf(['NONE', 'ACTIVE', 'EXPIRED', 'REVOKED']),
    editorial_detail: nullable(obj({ author: str(), visited_date: str('date'), reason: str() }, ['author', 'visited_date', 'reason'])),
    sources: arr(enumOf(['community', 'editorial'])),
    rule_version: str(),
  },
  ['community', 'tally', 'window_start', 'window_end', 'editorial', 'editorial_detail', 'sources', 'rule_version'],
);

/** Restaurant 是 contracts/dto.ts 的投影；required 列出稳定不变的核心字段。 */
const RESTAURANT: Schema = obj(
  {
    id: str(),
    name: str(),
    branch: nullable(str()),
    cuisines: arr(enumOf(['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'])),
    address: str(),
    floor_info: nullable(str()),
    lng: num(),
    lat: num(),
    coord_system: { type: 'string', enum: ['GCJ02'] },
    price: ref('PriceSummary'),
    dish_highlights: arr(str()),
    taste_tags: arr(str()),
    photo_media_ids: arr(str()),
    profile_public: bool(),
    is_test_data: { type: 'boolean', enum: [true], description: 'demo 数据水印，恒为 true' },
    place_status: enumOf(PLACE_STATUSES),
    place_verified_at: nullable(str('date')),
    business_status: enumOf(BUSINESS_STATUSES),
    risk_status: enumOf(RISK_STATUSES),
    community: enumOf(['PENDING', 'QUALIFIED', 'LAPSED']),
    endorsement: enumOf(['NONE', 'ACTIVE', 'EXPIRED', 'REVOKED']),
    basis: ref('RecommendationBasis'),
    in_default_layer: bool(),
    ineligibility_reasons: arr(str()),
    location_version: int(),
    merged_into: nullable(str()),
    deleted: bool(),
    version: int(),
    updated_at: str('date-time'),
  },
  [
    'id',
    'name',
    'branch',
    'cuisines',
    'address',
    'lng',
    'lat',
    'coord_system',
    'price',
    'profile_public',
    'is_test_data',
    'place_status',
    'business_status',
    'risk_status',
    'community',
    'endorsement',
    'basis',
    'in_default_layer',
    'ineligibility_reasons',
    'location_version',
    'version',
    'updated_at',
  ],
);

const MY_FEEDBACK = obj(
  {
    visit_id: str(),
    attitude: enumOf(ATTITUDES),
    visited_date: str('date'),
    reason: str(),
    dish_names: arr(str()),
    disclosure: enumOf(DISCLOSURES),
    media_ids: arr(str()),
    content_status: enumOf(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'WITHDRAWN']),
    approved_revision: nullable(int()),
    pending_revision: nullable(int()),
    withdrawal_generation: int(),
    version: int(),
  },
  ['visit_id', 'attitude', 'visited_date', 'reason', 'dish_names', 'disclosure', 'media_ids', 'content_status', 'withdrawal_generation', 'version'],
);

const FEEDBACK_PUBLIC = obj(
  {
    id: str(),
    restaurant_id: str(),
    attitude: enumOf(ATTITUDES),
    visited_date: str('date'),
    reason: str(),
    dish_names: arr(str()),
    disclosure: enumOf(DISCLOSURES),
    disclosure_note: nullable(str()),
    author: obj({ display_name: str(), is_editor: bool() }, ['display_name', 'is_editor']),
    media_ids: arr(str()),
    revision: int(),
    location_version: int(),
    counted_in_tally: bool(),
    updated_at: str('date-time'),
  },
  ['id', 'restaurant_id', 'attitude', 'visited_date', 'reason', 'dish_names', 'disclosure', 'author', 'media_ids', 'revision', 'location_version', 'counted_in_tally', 'updated_at'],
);

const RESTAURANT_DETAIL: Schema = {
  allOf: [ref('Restaurant'), obj({ verification_note: str(), business_status_note: str(), my_current_feedback: nullable(ref('MyFeedback')) })],
};

const PAGE = (items: Schema): Schema => obj({ items: arr(items), next_cursor: nullable(str()), snapshot_id: nullable(str()) }, ['items', 'next_cursor', 'snapshot_id']);

const MAP_CLUSTER = obj(
  {
    kind: { type: 'string', enum: ['cluster'] },
    id: str(),
    count: int(1),
    longitude: num(),
    latitude: num(),
    expansion_bounds: ref('Bounds'),
    restaurant_ids: arr(str()),
  },
  ['kind', 'id', 'count', 'longitude', 'latitude', 'expansion_bounds', 'restaurant_ids'],
);

const MAP_RESTAURANT = obj(
  {
    kind: { type: 'string', enum: ['restaurant'] },
    id: str(),
    name: str(),
    branch: nullable(str()),
    longitude: num(),
    latitude: num(),
    cuisines: arr(enumOf(['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'])),
    price: ref('PriceSummary'),
    top_dishes: arr(str()),
    sources: arr(enumOf(['community', 'editorial'])),
    pending_verification: bool(),
  },
  ['kind', 'id', 'name', 'branch', 'longitude', 'latitude', 'cuisines', 'price', 'top_dishes', 'sources', 'pending_verification'],
);

const MAP_ITEMS = obj(
  {
    coord_system: { type: 'string', enum: ['GCJ02'] },
    mode: { type: 'string', enum: ['clusters', 'restaurants'] },
    snapshot_id: str(),
    query_key: str(),
    total_matched: int(0),
    returned_count: int(0),
    complete: bool(),
    rule_version: str(),
    max_entities: int(1),
    items: arr({ oneOf: [ref('MapClusterItem'), ref('MapRestaurantItem')], discriminator: { propertyName: 'kind' } }),
  },
  ['coord_system', 'mode', 'snapshot_id', 'query_key', 'total_matched', 'returned_count', 'complete', 'rule_version', 'max_entities', 'items'],
);

const SESSION_USER = obj(
  {
    id: str(),
    display_name: str(),
    roles: arr(enumOf(['user', 'editor', 'moderator', 'admin'])),
    phone_masked: str(),
    is_test_data: { type: 'boolean', enum: [true] },
    account_status: { type: 'string', enum: ['active', 'deleting'] },
  },
  ['id', 'display_name', 'roles', 'phone_masked', 'is_test_data', 'account_status'],
);

const SUBMISSION = obj(
  {
    id: str(),
    restaurant_id: str(),
    restaurant_name: str(),
    attitude: enumOf(ATTITUDES),
    visited_date: str('date'),
    dish_names: arr(str()),
    reason: str(),
    media_ids: arr(str()),
    disclosure: enumOf(DISCLOSURES),
    status: enumOf(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'WITHDRAWN']),
    reject_reason: nullable(str()),
    pending_verify_reason: nullable(str()),
    version: int(),
    created_at: str('date-time'),
  },
  ['id', 'restaurant_id', 'restaurant_name', 'attitude', 'visited_date', 'dish_names', 'reason', 'media_ids', 'disclosure', 'status', 'version', 'created_at'],
);

const COLLECTION_ITEM = obj(
  { restaurant_id: str(), position: int(0), note: nullable(str()), note_shareable: bool(), media_ids: arr(str()), added_at: str('date-time') },
  ['restaurant_id', 'position', 'note', 'note_shareable', 'media_ids', 'added_at'],
);

const COLLECTION = obj(
  {
    id: str(),
    owner_user_id: str(),
    kind: { type: 'string', enum: ['system', 'custom'] },
    system_kind: nullable(enumOf(['want', 'visited', 'private_stash'])),
    title: str(),
    description: nullable(str()),
    items: arr(ref('CollectionItem')),
    publication_status: enumOf(['PRIVATE', 'PENDING_REVIEW', 'PUBLISHED', 'REVOKED']),
    active_token: nullable(str()),
    publication_generation: int(0),
    version: int(),
    updated_at: str('date-time'),
  },
  ['id', 'owner_user_id', 'kind', 'system_kind', 'title', 'items', 'publication_status', 'active_token', 'publication_generation', 'version', 'updated_at'],
);

const SHARED_SNAPSHOT = obj(
  {
    token: str(),
    title: str(),
    description: nullable(str()),
    author_display_name: str(),
    published_at: str('date-time'),
    items: arr(
      obj(
        {
          restaurant_id: str(),
          name: str(),
          branch: nullable(str()),
          lng: num(),
          lat: num(),
          cuisines: arr(enumOf(['guizhou', 'sichuan', 'chongqing', 'yunnan', 'other'])),
          note: nullable(str()),
          media_ids: arr(str()),
          pending_verification: bool(),
        },
        ['restaurant_id', 'name', 'branch', 'lng', 'lat', 'cuisines', 'note', 'media_ids', 'pending_verification'],
      ),
    ),
  },
  ['token', 'title', 'author_display_name', 'published_at', 'items'],
);

const REPORT = obj(
  {
    id: str(),
    restaurant_id: str(),
    kind: enumOf(['closed', 'wrong_location', 'wrong_info', 'abuse']),
    detail: str(),
    reporter_id: str(),
    status: enumOf(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']),
    created_at: str('date-time'),
    result_note: nullable(str()),
    /** 精确到某条反馈版本（形如 V0092#v1）；只针对门店时为 null。 */
    feedback_target: nullable(str()),
    version: int(1),
    handled_by: nullable(str()),
    handled_at: nullable(str('date-time')),
  },
  ['id', 'restaurant_id', 'kind', 'detail', 'reporter_id', 'status', 'created_at', 'version'],
);

/** 美食打卡/记账：个人到店记录与消费记账（不参与公开推荐与票数）。 */
const DINING_LOG = obj(
  {
    id: str(),
    user_id: str(),
    restaurant_id: str(),
    restaurant_name: str(),
    visited_date: str('date'),
    amount_fen: nullable(int(0)),
    note: nullable(str()),
    created_at: str('date-time'),
  },
  ['id', 'user_id', 'restaurant_id', 'restaurant_name', 'visited_date', 'created_at'],
);

/** 打卡/记账月度汇总。 */
const DINING_LOG_STATS = obj(
  {
    month: str(),
    count: int(0),
    total_fen: int(0),
  },
  ['month', 'count', 'total_fen'],
);

/** 审计条目：只记录谁在什么时候对什么做了什么，不含验证码与令牌。 */
const AUDIT_REC = obj(
  {
    id: str(),
    at: str('date-time'),
    actor_id: str(),
    action: str(),
    target: str(),
    reason: nullable(str()),
    from_version: nullable(int()),
    to_version: nullable(int()),
  },
  ['id', 'at', 'actor_id', 'action', 'target'],
);

const QUEUE_ENTRY = obj(
  {
    id: str(),
    type: enumOf(['submission', 'feedback_version', 'media', 'publication', 'endorsement']),
    restaurant_id: nullable(str()),
    restaurant_name: nullable(str()),
    author: str(),
    preview: str(),
    media_ids: arr(str()),
    status: enumOf(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN', 'WITHDRAWN', 'PRIVATE', 'PENDING_REVIEW', 'PUBLISHED', 'REVOKED']),
    version: int(),
    submitted_at: nullable(str('date-time')),
    is_author_self: bool(),
  },
  ['id', 'type', 'author', 'preview', 'media_ids', 'status', 'version', 'submitted_at', 'is_author_self'],
);

const MODERATION_RESULT = obj({ ok: { type: 'boolean', enum: [true] }, community: enumOf(['PENDING', 'QUALIFIED', 'LAPSED']), in_default_layer: bool(), restaurant: nullable(ref('Restaurant')) }, ['ok', 'community', 'in_default_layer']);

/** 查询参数：/map/items 与 /restaurants 共用同一份规范化解析。 */
const CANDIDATE_DUPLICATE = obj(
  {
    kind: enumOf(['restaurant', 'candidate']),
    matched_id: str(),
    name: str(),
    branch: nullable(str()),
    reason: enumOf(DUPLICATE_REASONS),
    /** 近似直线距离（米），不是行走距离；按地点数据源 ID 命中时为 null。 */
    distance_m: nullable(num()),
  },
  ['kind', 'matched_id', 'name', 'reason', 'distance_m'],
);

const RESTAURANT_CANDIDATE: Schema = obj(
  {
    id: str(),
    revision: int(1),
    name: str(),
    branch: nullable(str()),
    address: str(),
    floor_info: nullable(str()),
    cuisines: arr(enumOf(CUISINES)),
    lng: num(),
    lat: num(),
    coord_system: { type: 'string', enum: ['GCJ02'] },
    source: enumOf(CANDIDATE_SOURCES),
    provider: nullable(str()),
    poi_id: nullable(str()),
    evidence_note: str(),
    status: enumOf(CANDIDATE_STATUSES),
    restaurant_id: nullable(str()),
    duplicates: arr(ref('CandidateDuplicate')),
    submitted_by: str(),
    author_display_name: str(),
    is_author_self: bool(),
    place_status: enumOf(PLACE_STATUSES, 'nullable'),
    reject_reason: nullable(str()),
    decided_by: nullable(str()),
    decided_at: nullable(str()),
    version: int(1),
    created_at: str(),
    updated_at: str(),
    is_test_data: { type: 'boolean', enum: [true] },
  },
  ['id', 'revision', 'name', 'address', 'cuisines', 'lng', 'lat', 'source', 'evidence_note', 'status', 'duplicates', 'submitted_by', 'is_author_self', 'version', 'created_at', 'updated_at', 'is_test_data'],
);

const PROVIDER_CANDIDATE = obj(
  {
    provider: str(),
    poi_id: str(),
    name: str(),
    address: str(),
    lng: num(),
    lat: num(),
    coord_system: { type: 'string', enum: ['GCJ02'] },
    coord_note: str(),
  },
  ['provider', 'poi_id', 'name', 'address', 'lng', 'lat', 'coord_system', 'coord_note'],
);

/** 建店事实：创建时全部必填（由 required 列指出），补材料时只带想改的字段。 */
const CANDIDATE_FACT_PROPS: Record<string, Schema> = {
  name: str(),
  branch: nullable(str()),
  address: str(),
  floor_info: nullable(str()),
  cuisines: arr(enumOf(CUISINES)),
  lng: num(),
  lat: num(),
  source: enumOf(CANDIDATE_SOURCES),
  provider: nullable(str()),
  poi_id: nullable(str()),
  evidence_note: str(),
};

const MAP_QUERY_PARAMS: Schema[] = [
  q('west', 'number', '视野西边界（GCJ-02 经度）；与其余三个边界同时提供，缺省用北京默认视野', false),
  q('south', 'number', '视野南边界（GCJ-02 纬度）', false),
  q('east', 'number', '视野东边界（GCJ-02 经度）', false),
  q('north', 'number', '视野北边界（GCJ-02 纬度）', false),
  q('zoom', 'integer', '地图层级 0—22，缺省 11；z15 及以上返回单店而非聚合', false),
  q('view', 'string', `视图分组，缺省 guizhou；取值 ${VIEWS.join(' | ')}`, false),
  q('budget', 'number', '人均预算上限（元），1—100000；不传即不筛选', false),
  q('include_unknown', 'string', '人均未知的门店是否算进预算筛选：1|0，缺省 0', false),
  q('dish', 'string', '菜名/标签词，最长 50 字符，含别名映射（如 鱼腥草→折耳根）', false),
  q('layer', 'string', `图层，缺省 qualified；取值 ${LAYERS.join(' | ')}`, false),
  q('snapshot', 'string', '上一次响应返回的 snapshot_id；结果集版本变化后返回 409 QUERY_EXPIRED', false),
  q('contract_version', 'string', '可选；提供时必须等于服务端合同版本，否则 400', false),
];

const PAGE_PARAMS: Schema[] = [q('cursor', 'string', '上一页返回的 next_cursor（门店 ID）', false), q('limit', 'integer', `每页 1—${MAX_PAGE_LIMIT}，缺省 20`, false)];

function q(name: string, type: 'string' | 'number' | 'integer' | 'boolean', description: string, required: boolean): Schema {
  return { name, in: 'query', required, description, schema: { type } };
}

function p(name: string, description: string, maxLen = 16): Schema {
  return { name, in: 'path', required: true, description, schema: { type: 'string', maxLength: maxLen } };
}

function body(schema: Schema, required = true): Schema {
  return { required, content: { 'application/json': { schema } } };
}

const SUBMIT_BODY = obj(
  {
    restaurant_id: str(),
    visited_date: str('date'),
    attitude: enumOf(ATTITUDES),
    dish_names: arr(str()),
    reason: str(),
    media_ids: arr(str()),
    disclosure: nullable(enumOf(DISCLOSURES)),
    require_media_for_recommend: bool(),
  },
  ['restaurant_id', 'visited_date', 'attitude', 'reason', 'disclosure'],
);

const WRITES_NOTE = { description: '写接口需会话 Cookie；非幂等写操作会做 Origin / Sec-Fetch-Site 同源校验。' };

const MEDIA_ASSET = obj(
  {
    id: str(),
    owner_user_id: str(),
    kind: { type: 'string', enum: ['photo'] },
    url: str('uri'),
    width: int(),
    height: int(),
    review_status: enumOf(['PENDING', 'APPROVED', 'REJECTED']),
    is_test_data: { type: 'boolean', enum: [true] },
    exif_stripped: { type: 'boolean', enum: [true] },
  },
  ['id', 'owner_user_id', 'kind', 'url', 'width', 'height', 'review_status', 'is_test_data', 'exif_stripped'],
);

function documentOperations(): Record<string, Record<string, unknown>> {
  return {
    'GET /health/live': { tags: ['ops'], summary: '进程存活', security: [], responses: { '200': ok(obj({ status: { type: 'string', enum: ['ok'] }, service: str() }, ['status'])) } },
    'GET /health/ready': {
      tags: ['ops'],
      summary: '存储就绪',
      description: '真的向 SQLite 写一行再删除；不返回路径、版本等内部拓扑。',
      security: [],
      responses: { '200': ok(obj({ status: { type: 'string', enum: ['ready'] } }, ['status'])), '503': err(503, 'PROVIDER_UNAVAILABLE', '存储未就绪') },
    },
    'GET /today': { tags: ['ops'], summary: '服务器今天（Asia/Shanghai）', security: [], responses: { '200': ok({ type: 'string', format: 'date' }) } },
    'GET /meta': {
      tags: ['ops'],
      summary: '部署自描述：环境与测试数据装载状态',
      description: '前端据此决定演示水印显隐：production 且未装载测试种子时，界面不出现任何演示/测试标记。',
      security: [],
      responses: {
        '200': ok(
          obj({ env: { type: 'string', enum: ['development', 'test', 'demo_static', 'production'] }, test_data_loaded: { type: 'boolean' }, seed_profile: { type: 'string', enum: ['synthetic', 'real'] } }, ['env', 'test_data_loaded', 'seed_profile']),
        ),
      },
    },

    'GET /map/items': {
      tags: ['map'],
      summary: '地图实体（聚合或单店）',
      description: '返回 snapshot_id，与 /restaurants 共用同一份规范化查询。',
      security: [],
      parameters: MAP_QUERY_PARAMS,
      responses: {
        '200': ok(ref('MapItemsResponse')),
        '400': err(400, 'VALIDATION_ERROR', '查询参数不合法（含合同版本不匹配）'),
        '409': err(409, 'QUERY_EXPIRED', '快照已过期，需重新拉取'),
      },
    },
    'GET /restaurants': {
      tags: ['map'],
      summary: '与地图同查询同快照的分页列表',
      security: [],
      parameters: [...MAP_QUERY_PARAMS, ...PAGE_PARAMS],
      responses: {
        '200': ok(PAGE(ref('Restaurant'))),
        '400': err(400, 'VALIDATION_ERROR', '查询参数不合法'),
        '409': err(409, 'QUERY_EXPIRED', '快照已过期'),
      },
    },
    'GET /restaurants/search': {
      tags: ['map'],
      summary: '站内搜索',
      description: 'provider_candidates 只作为"需人工核验的候选"，不自动入库。',
      security: [],
      parameters: [q('q', 'string', '查询词，最长 50 字符', true)],
      responses: {
        '200': ok(obj({ own: arr(ref('Restaurant')), provider_candidates: arr(ref('ProviderCandidate')) }, ['own', 'provider_candidates'])),
        '400': err(400, 'VALIDATION_ERROR', '缺少或过长的 q'),
      },
    },
    'GET /restaurants/{id}': {
      tags: ['map'],
      summary: '门店详情',
      description: '已删除、已合并为不可见、以及不存在的 id 统一 404，不泄露存在性。my_current_feedback 仅登录时有值。',
      security: [],
      parameters: [p('id', '门店 ID')],
      responses: {
        '200': ok(ref('RestaurantDetail')),
        '404': err(404, 'NOT_FOUND', '门店不存在或不可见'),
      },
    },

    'GET /media/{id}': {
      tags: ['media'],
      summary: '图片字节流',
      description: '唯一不套 JSON 信封的读接口。已过审的公开；未过审的只有作者可读，其余情况一律 404（不区分无权限与不存在）。图片内容是明确标注的合成占位图。',
      security: [],
      parameters: [p('id', '图片 ID（种子为 MMF###，上传返回 MM<seq>）', 64)],
      responses: {
        '200': {
          description: '图片字节',
          content: { 'image/svg+xml': { schema: { type: 'string', format: 'binary' } } },
        },
        '404': err(404, 'NOT_FOUND', '图片不存在或无权访问'),
      },
    },
    'POST /media/uploads': {
      tags: ['media'],
      summary: '真实图片上传',
      description: '请求体为原始图片字节，Content-Type 声明 image/jpeg|png|webp；魔数校验后剥离 EXIF（含 GPS）入对象存储（UPLOAD_DIR，磁盘适配）。登记为 PENDING：未过审只有作者与审核员可见。',
      security: [{ session: [] }],
      requestBody: { required: true, content: { 'image/jpeg': { schema: { type: 'string', format: 'binary' } }, 'image/png': { schema: { type: 'string', format: 'binary' } }, 'image/webp': { schema: { type: 'string', format: 'binary' } } } },
      responses: {
        '201': ok(ref('MediaAsset')),
        '400': err(400, 'VALIDATION_ERROR', '类型不符或超过大小上限'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
      },
    },
    'POST /uploads/test-photo': {
      tags: ['media'],
      summary: 'demo 上传：登记一张合成占位图',
      description: '替代真实对象存储签名上传；返回的图片 review_status 为 PENDING，只有作者可见。',
      requestBody: body(obj({ restaurant_id: nullable(str()) })),
      responses: {
        '201': ok(ref('MediaAsset')),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '403': err(403, 'FORBIDDEN', 'Origin 不在白名单'),
      },
    },

    'POST /auth/login': {
      tags: ['auth'],
      summary: '内测登录',
      description: '固定验证码只存在于 demo 环境；NODE_ENV=production 时 Store 直接拒绝。按 IP+账号限流。',
      security: [],
      requestBody: body(obj({ user_id: str(), code: str() }, ['user_id', 'code'])),
      responses: {
        '200': ok(obj({ user: ref('SessionUser') }, ['user'])),
        '400': err(400, 'VALIDATION_ERROR', '验证码错误'),
        '401': err(401, 'UNAUTHORIZED', '账号不可用'),
        '403': err(403, 'FORBIDDEN', '来源不在允许列表内'),
        '429': err(429, 'RATE_LIMITED', '登录尝试过于频繁'),
      },
    },
    'POST /auth/phone/code': {
      tags: ['auth'],
      summary: '发送手机验证码',
      description: '真实登录路径的第一步。验证码 6 位、5 分钟有效、单次使用、最多试 5 次；同手机号 1 条/分钟、同 IP 10 条/小时。供应商由 SMS_PROVIDER 配置（none=未配置即 503）。',
      security: [],
      requestBody: body(obj({ phone: str() }, ['phone'])),
      responses: {
        '200': ok(obj({ ok: { type: 'boolean', enum: [true] }, ttl_seconds: { type: 'integer' } }, ['ok', 'ttl_seconds'])),
        '400': err(400, 'VALIDATION_ERROR', '手机号格式不正确'),
        '429': err(429, 'RATE_LIMITED', '发送过于频繁'),
        '503': err(503, 'SMS_UNCONFIGURED', '短信服务未配置'),
      },
    },
    'POST /auth/phone/login': {
      tags: ['auth'],
      summary: '手机验证码登录',
      description: '校验通过即创建/复用账号（同手机号哈希同一账号）并发会话 Cookie。生产的真实登录路径；演示账号登录在 production 会被 403 拒绝。',
      security: [],
      requestBody: body(obj({ phone: str(), code: str() }, ['phone', 'code'])),
      responses: {
        '200': ok(obj({ user: ref('SessionUser'), created: { type: 'boolean' } }, ['user', 'created'])),
        '400': err(400, 'VALIDATION_ERROR', '验证码错误或已过期'),
        '429': err(429, 'RATE_LIMITED', '登录尝试过于频繁'),
      },
    },
    'POST /auth/logout': { tags: ['auth'], summary: '注销会话', security: [], ...WRITES_NOTE, responses: { '200': ok(obj({ ok: { type: 'boolean', enum: [true] } }, ['ok'])), '403': err(403, 'FORBIDDEN', '来源校验失败') } },
    'GET /me': { tags: ['auth'], summary: '当前用户', security: [], responses: { '200': ok(nullable(ref('SessionUser')), '未登录时 data 为 null') } },
    'DELETE /me': {
      tags: ['auth'],
      summary: '注销账号',
      description: '立即撤销会话、撤销本人分享、隐藏 UGC 并移出计票。',
      responses: { '200': ok(obj({ deletion_job_id: str() }, ['deletion_job_id'])), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '来源校验失败') },
    },
    'GET /me/submissions': { tags: ['feedback'], summary: '我的投稿', responses: { '200': ok(arr(ref('Submission'))), '401': err(401, 'UNAUTHORIZED', '需要登录') } },
    'GET /me/reports': { tags: ['reports'], summary: '我的举报', responses: { '200': ok(arr(ref('ReportTicket'))), '401': err(401, 'UNAUTHORIZED', '需要登录') } },

    'POST /me/dining-logs': {
      tags: ['dining'],
      summary: '新增美食打卡/记账',
      description: '个人到店记录与消费记账，只本人可见，不参与公开推荐与票数计算。日期不允许未来；金额为门店现场消费（元）。',
      requestBody: body(
        obj(
          {
            restaurant_id: str(),
            visited_date: str(),
            amount: { type: 'number', description: '消费金额（元），0—100000；不传即只打卡不记账', nullable: true },
            note: nullable(str()),
          },
          ['restaurant_id', 'visited_date'],
        ),
      ),
      responses: {
        '201': ok(ref('DiningLog')),
        '400': err(400, 'VALIDATION_ERROR', '日期格式非法/日期是未来/金额越界/备注超长'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '404': err(404, 'NOT_FOUND', '门店不存在'),
      },
    },

    'GET /me/dining-logs': {
      tags: ['dining'],
      summary: '我的打卡/记账列表（含当月次数与消费合计）',
      responses: {
        '200': ok(ref('DiningLogPage')),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
      },
    },

    'DELETE /me/dining-logs/{id}': {
      tags: ['dining'],
      summary: '删除我的打卡/记账记录',
      responses: {
        '200': ok(obj({ ok: { type: 'boolean' } })),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '404': err(404, 'NOT_FOUND', '记录不存在或不属于本人'),
      },
    },

    'POST /submissions': {
      tags: ['feedback'],
      summary: '提交实吃反馈',
      description: 'Idempotency-Key 幂等：同键同内容返回同一结果；同键换内容 409。理由需 20—500 字，推荐态度需至少一道菜与图片。',
      parameters: [{ name: 'idempotency-key', in: 'header', required: false, schema: { type: 'string', maxLength: 128 }, description: '幂等键（也可放在 body.idempotency_key）' }],
      requestBody: body(SUBMIT_BODY),
      responses: {
        '201': ok(ref('Submission')),
        '400': err(400, 'VALIDATION_ERROR', '领域校验失败（含 fieldErrors）'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '404': err(404, 'NOT_FOUND', '门店不存在'),
        '409': err(409, 'IDEMPOTENCY_CONFLICT', '相同幂等键提交了不同内容'),
      },
    },
    'PUT /restaurants/{id}/my-feedback': {
      tags: ['feedback'],
      summary: '提交/更新我的反馈',
      parameters: [p('id', '门店 ID')],
      requestBody: body(SUBMIT_BODY),
      responses: { '200': ok(ref('Submission')), '400': err(400, 'VALIDATION_ERROR', '领域校验失败'), '401': err(401, 'UNAUTHORIZED', '需要登录') },
    },
    'DELETE /restaurants/{id}/my-feedback': {
      tags: ['feedback'],
      summary: '撤回反馈',
      description: '撤回后待审版本作废，历史版本之后被批准也不会重新公开。',
      parameters: [p('id', '门店 ID')],
      responses: { '200': ok(obj({ ok: { type: 'boolean', enum: [true] } }, ['ok'])), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '没有可撤回的反馈') },
    },
    'PUT /restaurants/{id}/collection-item': {
      tags: ['collections'],
      summary: '系统清单开关（想吃/吃过/私藏）',
      description: '想吃与吃过互斥；标记吃过不产生公开到店记录或票。',
      parameters: [p('id', '门店 ID')],
      requestBody: body(obj({ kind: enumOf(['want', 'visited', 'private_stash']), on: bool() }, ['kind', 'on'])),
      responses: { '200': ok(arr(ref('Collection'))), '400': err(400, 'VALIDATION_ERROR', 'kind 非法'), '401': err(401, 'UNAUTHORIZED', '需要登录') },
    },

    'GET /collections': { tags: ['collections'], summary: '我的清单', responses: { '200': ok(arr(ref('Collection'))), '401': err(401, 'UNAUTHORIZED', '需要登录') } },
    'POST /collections': {
      tags: ['collections'],
      summary: '新建自定义清单',
      requestBody: body(obj({ title: str(), description: nullable(str()) }, ['title'])),
      responses: { '201': ok(ref('Collection')), '400': err(400, 'VALIDATION_ERROR', '标题必填'), '401': err(401, 'UNAUTHORIZED', '需要登录') },
    },
    'GET /collections/{id}': {
      tags: ['collections'],
      summary: '清单详情',
      description: '他人清单（含其私有清单）统一 404，不区分"不存在"与"无权"。',
      parameters: [p('id', '清单 ID', 32)],
      responses: { '200': ok(ref('Collection')), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '清单不存在') },
    },
    'PATCH /collections/{id}': {
      tags: ['collections'],
      summary: '改标题/描述',
      parameters: [p('id', '清单 ID', 32)],
      requestBody: body(obj({ title: str(), description: nullable(str()) })),
      responses: { '200': ok(ref('Collection')), '400': err(400, 'VALIDATION_ERROR', '标题不能为空'), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '清单不存在') },
    },
    'DELETE /collections/{id}': {
      tags: ['collections'],
      summary: '删除清单',
      description: '同时把该清单已发布的快照置为 REVOKED，旧 token 立即失效。',
      parameters: [p('id', '清单 ID', 32)],
      responses: { '200': ok(obj({ ok: { type: 'boolean', enum: [true] } }, ['ok'])), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '清单不存在') },
    },
    'PUT /collections/{id}/items/{restaurantId}': {
      tags: ['collections'],
      summary: '新增或更新条目',
      parameters: [p('id', '清单 ID', 32), p('restaurantId', '门店 ID')],
      requestBody: body(obj({ note: nullable(str()), note_shareable: bool(), position: int(0), media_ids: arr(str()) })),
      responses: { '200': ok(ref('Collection')), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '清单不存在') },
    },
    'DELETE /collections/{id}/items/{restaurantId}': {
      tags: ['collections'],
      summary: '移除条目',
      parameters: [p('id', '清单 ID', 32), p('restaurantId', '门店 ID')],
      responses: { '200': ok(ref('Collection')), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '清单不存在') },
    },
    'POST /collections/{id}/publication-requests': {
      tags: ['collections'],
      summary: '申请公开清单',
      description: '只有勾选 note_shareable 的条目会带上笔记与图片；系统清单不能发布。',
      parameters: [p('id', '清单 ID', 32)],
      requestBody: body(obj({ share_item_ids: arr(str()) }, ['share_item_ids'])),
      responses: {
        '201': ok(obj({ id: str(), status: enumOf(['PENDING_REVIEW']), generation: int(1) }, ['id', 'status', 'generation'])),
        '400': err(400, 'VALIDATION_ERROR', '至少选择一家可公开的门店'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '404': err(404, 'NOT_FOUND', '清单不存在'),
      },
    },
    'POST /collections/{id}/unpublish': {
      tags: ['collections'],
      summary: '撤回公开',
      description: '同一事务递增 publication_generation 并作废此前全部待审申请。',
      parameters: [p('id', '清单 ID', 32)],
      responses: { '200': ok(ref('Collection')), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '清单不存在') },
    },
    'GET /shared-collections/{token}': {
      tags: ['collections'],
      summary: '分享快照',
      description: '公开访问；条目带 pending_verification，表示作者个人推荐、平台尚未验证。',
      security: [],
      parameters: [p('token', '发布 token', 80)],
      responses: { '200': ok(ref('SharedCollectionSnapshot')), '404': err(404, 'NOT_FOUND', '链接无效或已撤销') },
    },

    'POST /restaurant-candidates': {
      tags: ['candidates'],
      summary: '提交新门店候选（建店流程入口）',
      description:
        '返回候选 ID、它新建的门店 ID 与重复提示；新建门店的地点状态一律 PENDING，不自动入库为推荐、' +
        '也不自动合并。坐标 GCJ-02 且必须在北京范围内。支持 Idempotency-Key 头。',
      requestBody: body(
        obj(CANDIDATE_FACT_PROPS, ['name', 'address', 'cuisines', 'lng', 'lat', 'source', 'evidence_note']),
      ),
      responses: {
        '201': ok(ref('RestaurantCandidate')),
        '400': err(400, 'VALIDATION_ERROR', '字段缺失/越界，或同一作者已有被驳回的相同申请（应去补材料）'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '409': err(409, 'IDEMPOTENCY_CONFLICT', '相同幂等键提交了不同内容'),
      },
    },
    'GET /me/restaurant-candidates': {
      tags: ['candidates'],
      summary: '我的建店申请进度',
      description: '含待核验原因与驳回理由；只返回本人提交的候选。',
      responses: { '200': ok(arr(ref('RestaurantCandidate'))), '401': err(401, 'UNAUTHORIZED', '需要登录') },
    },
    'POST /restaurant-candidates/{id}/materials': {
      tags: ['candidates'],
      summary: '被驳回的建店申请补充材料',
      description: '同一条候选 revision 递增并回到 PENDING，不新开一条；换坐标会递增 location_version。',
      parameters: [p('id', '候选 ID')],
      requestBody: body(obj({ ...CANDIDATE_FACT_PROPS, expected_version: int(1) }, ['expected_version'])),
      responses: {
        '200': ok(ref('RestaurantCandidate')),
        '400': err(400, 'VALIDATION_ERROR', '当前状态不需要补材料，或字段非法'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '403': err(403, 'FORBIDDEN', '只能补自己提交的候选'),
        '404': err(404, 'NOT_FOUND', '候选不存在或无权查看'),
        '409': err(409, 'VERSION_CONFLICT', '版本冲突，请重载'),
      },
    },
    'GET /admin/candidates': {
      tags: ['admin'],
      summary: '地点核验队列',
      description: '需要 moderator 或 admin；待核验的排在前面，上限 200；可选 status 过滤。',
      parameters: [q('status', 'string', `按候选状态过滤：${CANDIDATE_STATUSES.join(' | ')}`, false)],
      responses: { '200': ok(arr(ref('RestaurantCandidate'))), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '权限不足') },
    },
    'POST /admin/candidates/{id}/actions': {
      tags: ['admin'],
      summary: '核验通过 / 驳回 / 并入已有门店',
      description:
        '本人提交的候选不能自审，即使同时是审核人员；驳回与并入必须写理由；并入走门店合并规则（仅 admin）。' +
        '核验通过只解决"地点"，进默认好店层仍需社区票或编辑背书。',
      parameters: [p('id', '候选 ID')],
      requestBody: body(
        obj(
          { action: enumOf(['verify', 'reject', 'merge']), reason: nullable(str()), target_restaurant_id: nullable(str()), expected_version: int(1) },
          ['action', 'expected_version'],
        ),
      ),
      responses: {
        '200': ok(ref('RestaurantCandidate')),
        '400': err(400, 'VALIDATION_ERROR', 'action 非法、缺理由或该状态不可执行此操作'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '403': err(403, 'FORBIDDEN', '权限不足，或作者自审'),
        '404': err(404, 'NOT_FOUND', '候选不存在或无权查看'),
        '409': err(409, 'VERSION_CONFLICT', '版本冲突，请重载后再操作'),
      },
    },

    'POST /reports': {
      tags: ['reports'],
      summary: '举报门店',
      description:
        '3 个不同账号报告闭店只会生成复核工单并把营业状态标为 SUSPECTED_CLOSED，不自动判定闭店。' +
        '同一人对同一门店的同一类问题在未结案前不重复开单；结案后可另开一单，旧单不复活。',
      requestBody: body(
        obj(
          {
            restaurant_id: str(),
            kind: enumOf(['closed', 'wrong_location', 'wrong_info', 'abuse']),
            detail: str(),
            feedback_target: nullable(str()),
          },
          ['restaurant_id', 'kind', 'detail'],
        ),
      ),
      responses: { '201': ok(ref('ReportTicket')), '400': err(400, 'VALIDATION_ERROR', 'kind 非法、说明为空或关联反馈不属于该门店'), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '门店不存在') },
    },

    'GET /admin/reports': {
      tags: ['admin'],
      summary: '举报复核队列（待处理优先，上限 200）',
      description: '可按状态过滤；is_reporter_self 标记"举报人本人不能处置自己的举报"。',
      parameters: [q('status', 'string', '按工单状态过滤：OPEN | IN_REVIEW | RESOLVED | DISMISSED', false)],
      responses: { '200': ok(arr(ref('ReportQueueEntry'))), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '权限不足') },
    },
    'POST /admin/reports/{id}/actions': {
      tags: ['admin'],
      summary: '工单处置：开始复核 / 结案 / 驳回',
      description:
        '结案与驳回必须写处理结果，且是终态不可回退；处置工单不会改动门店的闭店或风险结论（两者是分开的事务）。' +
        '举报人本人不能处置自己的举报，即使他同时是审核人员。',
      requestBody: body(obj({ action: enumOf(['start', 'resolve', 'dismiss']), reason: nullable(str()), expected_version: int(1) }, ['action', 'expected_version'])),
      parameters: [p('id', '工单 ID')],
      responses: {
        '200': ok(ref('ReportQueueEntry')),
        '400': err(400, 'VALIDATION_ERROR', 'action 非法、缺处理结果或该状态不可执行此操作'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '403': err(403, 'FORBIDDEN', '权限不足，或举报人处置自己的举报'),
        '404': err(404, 'NOT_FOUND', '工单不存在'),
        '409': err(409, 'VERSION_CONFLICT', '版本冲突，请重载后再操作'),
      },
    },
    'GET /admin/queue': {
      tags: ['admin'],
      summary: '审核队列',
      description: '需要 moderator 或 admin 角色；is_author_self 标记"作者不能自审"。',
      responses: { '200': ok(arr(ref('ModerationQueueEntry'))), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '权限不足') },
    },
    'GET /admin/audit-log': {
      tags: ['admin'],
      summary: '审计日志',
      description: '最近 200 条倒序，只给审核人员；条目不含验证码、令牌与私有笔记。',
      responses: { '200': ok(arr(ref('AuditRec'))), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '权限不足') },
    },
    'POST /admin/moderation/{target}/actions': {
      tags: ['admin'],
      summary: '执行审核动作',
      description: 'target 形如 V0092%23v1（# 必须 percent-encode），发布申请为 PUB0001；expected_version 不匹配返回 409。',
      parameters: [{ name: 'target', in: 'path', required: true, description: '审核目标（含版本后缀）', schema: { type: 'string', maxLength: 80 } }],
      requestBody: body(obj({ action: enumOf(['approve', 'reject', 'hide']), reason: nullable(str()), expected_version: int(1) }, ['action', 'expected_version'])),
      responses: {
        '200': ok(ref('ModerationResult')),
        '400': err(400, 'VALIDATION_ERROR', '目标格式或 action 非法'),
        '401': err(401, 'UNAUTHORIZED', '需要登录'),
        '403': err(403, 'FORBIDDEN', '作者不能审核自己的内容'),
        '404': err(404, 'NOT_FOUND', '目标不存在'),
        '409': err(409, 'VERSION_CONFLICT', '版本冲突或较低版本覆盖已批准版本'),
      },
    },
    'PATCH /admin/restaurants/{id}/status': {
      tags: ['admin'],
      summary: '变更核验/营业/风险状态',
      description: 'place_status 变化会递增 location_version，旧址票从此只作历史。',
      parameters: [p('id', '门店 ID')],
      requestBody: body(obj({ place_status: enumOf(PLACE_STATUSES), business_status: enumOf(BUSINESS_STATUSES), risk_status: enumOf(RISK_STATUSES), reason: nullable(str()) })),
      responses: { '200': ok(ref('Restaurant')), '400': err(400, 'VALIDATION_ERROR', '状态取值非法'), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '权限不足'), '404': err(404, 'NOT_FOUND', '门店不存在') },
    },
    'POST /admin/restaurants/{id}/merge': {
      tags: ['admin'],
      summary: '合并门店（仅 admin）',
      description: '反馈与清单引用迁移到 target，source 永久重定向；不按距离自动合并。',
      parameters: [p('id', '来源门店 ID')],
      requestBody: body(obj({ target_id: str(), reason: str(), expected_version: int(1) }, ['target_id', 'reason', 'expected_version'])),
      responses: { '200': ok(obj({ canonical: str() }, ['canonical'])), '401': err(401, 'UNAUTHORIZED', '需要登录'), '403': err(403, 'FORBIDDEN', '需要 admin'), '409': err(409, 'VERSION_CONFLICT', '版本冲突') },
    },
    'POST /admin/editorial-endorsements/verify': {
      tags: ['admin'],
      summary: '核验编辑背书',
      requestBody: body(obj({ restaurant_id: str(), reason: nullable(str()) }, ['restaurant_id'])),
      responses: { '200': ok(ref('Restaurant')), '403': err(403, 'FORBIDDEN', '背书作者不能自审'), '404': err(404, 'NOT_FOUND', '该门店没有编辑背书') },
    },
    'POST /admin/editorial-endorsements/revoke': {
      tags: ['admin'],
      summary: '撤回编辑背书',
      requestBody: body(obj({ restaurant_id: str(), reason: nullable(str()) }, ['restaurant_id'])),
      responses: { '200': ok(ref('Restaurant')), '401': err(401, 'UNAUTHORIZED', '需要登录'), '404': err(404, 'NOT_FOUND', '该门店没有编辑背书') },
    },
  };
}

/** paths 由真实路由表驱动；每个路由必须能在 operations 里找到 key。 */
export function buildOpenApi(routes: RouteDef[]): Record<string, unknown> {
  const operations = documentOperations();
  const paths: Record<string, Record<string, unknown>> = {};
  const missing: string[] = [];
  for (const r of routes) {
    const openapiPath = toTemplate(r.path);
    const op = operations[`${r.method} ${openapiPath}`];
    if (!op) {
      missing.push(`${r.method} ${openapiPath}`);
      continue;
    }
    const bucket = (paths[openapiPath] ??= {});
    bucket[r.method.toLowerCase()] = {
      operationId: operationId(r.method, openapiPath),
      tags: ['misc'],
      ...op,
      summary: (op as { summary?: string }).summary ?? r.summary,
    };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: '京城黔味地图 API',
      version: CONTRACT_VERSION,
      description:
        '北京贵州菜与西南美食地图 demo 的 HTTP 外壳。全部业务规则由 @qianwei/contracts 的 Store 实现，' +
        '本 API 只做参数校验、权限会话与持久化。数据为合成测试数据（is_test_data 恒为 true），不代表任何真实门店、真实探店或真实票数。',
    },
    servers: [{ url: '/api/v1', description: '默认基路径' }],
    tags: [
      { name: 'ops', description: '运行状态' },
      { name: 'map', description: '地图、列表与详情' },
      { name: 'media', description: '图片资源与 demo 上传' },
      { name: 'auth', description: '会话与账号注销' },
      { name: 'feedback', description: '实吃投稿与撤回' },
      { name: 'dining', description: '美食打卡与记账（个人）' },
      { name: 'collections', description: '清单、分享与发布' },
      { name: 'reports', description: '举报' },
      { name: 'candidates', description: '新门店候选与地点核验' },
      { name: 'admin', description: '审核与门店治理' },
    ],
    security: [{ cookieAuth: [] }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'apiKey',
          name: 'qw_session',
          description: '登录后由服务端下发 HttpOnly; SameSite=Lax; Path=/ 会话 Cookie。',
        },
      },
      schemas: {
        ResponseMeta: META,
        ErrorCode: enumOf(ERROR_CODES),
        ApiError: ERROR_BODY,
        Bounds: BOUNDS,
        PriceSummary: PRICE,
        RecommendationBasis: BASIS,
        Restaurant: RESTAURANT,
        MyFeedback: MY_FEEDBACK,
        FeedbackPublic: FEEDBACK_PUBLIC,
        RestaurantDetail: RESTAURANT_DETAIL,
        RestaurantPage: PAGE(ref('Restaurant')),
        MediaAsset: MEDIA_ASSET,
        MapClusterItem: MAP_CLUSTER,
        MapRestaurantItem: MAP_RESTAURANT,
        MapItemsResponse: MAP_ITEMS,
        SessionUser: SESSION_USER,
        Submission: SUBMISSION,
        CollectionItem: COLLECTION_ITEM,
        Collection: COLLECTION,
        SharedCollectionSnapshot: SHARED_SNAPSHOT,
        ReportTicket: REPORT,
        DiningLog: DINING_LOG,
        DiningLogStats: DINING_LOG_STATS,
        DiningLogPage: obj(
          {
            logs: arr(ref('DiningLog')),
            stats: ref('DiningLogStats'),
          },
          ['logs', 'stats'],
        ),
        RestaurantCandidate: RESTAURANT_CANDIDATE,
        CandidateDuplicate: CANDIDATE_DUPLICATE,
        ProviderCandidate: PROVIDER_CANDIDATE,
        ReportQueueEntry: { allOf: [ref('ReportTicket'), obj({ restaurant_name: { type: 'string', nullable: true }, is_reporter_self: bool() }, ['restaurant_name', 'is_reporter_self'])] },
        ModerationQueueEntry: QUEUE_ENTRY,
        ModerationResult: MODERATION_RESULT,
        AuditRec: AUDIT_REC,
      },
    },
    paths,
    'x-undocumented-routes': missing,
    'x-notes': {
      envelope: '成功 { data, meta:{requestId} }；失败 { error:{code,message,fieldErrors?}, meta:{requestId} }',
      unknownErrors: '未预期异常统一 500 + code INTERNAL + 通用文案，不回显堆栈与环境变量',
      unmatchedRoutes: '路径或方法未匹配一律 404 NOT_FOUND（不枚举可用路由）',
      dataIsSynthetic: '所有记录 is_test_data=true；生产环境（NODE_ENV=production）拒绝启动',
    },
  };
}

/** 路由模板 /restaurants/:id → OpenAPI 的 /restaurants/{id}。 */
function toTemplate(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_m, name: string) => `{${name}}`);
}

function operationId(method: string, path: string): string {
  const seg = path
    .split('/')
    .filter((s) => s.length > 0)
    .map((s) => (s.startsWith('{') ? `by-${s.slice(1, -1)}` : s))
    .join('-');
  return `${method.toLowerCase()}-${seg}`;
}
