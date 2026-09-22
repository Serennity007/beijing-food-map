import type {
  BusinessStatus,
  Cuisine,
  Disclosure,
  FeedbackAttitude,
  PlaceVerificationStatus,
  RiskStatus,
} from './enums';

/**
 * 演示数据集。全部 is_test_data=true、店名带"测试"前缀、反馈文本明确标注合成，
 * 用于验证交互与计票规则，不代表任何真实餐馆、真实探店或真实票数。
 * 坐标是北京片区的近似锚点（GCJ-02），不是任何门店的实际位置。
 */

export interface SeedRestaurant {
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
  profile_public: boolean;
  place_status: PlaceVerificationStatus;
  place_verified_days_ago: number | null;
  business_status: BusinessStatus;
  risk_status: RiskStatus;
  location_version: number;
  /** 曾达标记录，用来区分 LAPSED 与 PENDING。 */
  ever_qualified: boolean;
  editorial?: { author: string; visited_days_ago: number; reason: string; verifier: string };
  note: string;
}

export interface SeedFeedback {
  id: string;
  restaurant_id: string;
  user: string;
  attitude: FeedbackAttitude;
  visited_days_ago: number;
  reason: string;
  dish_names: string[];
  disclosure: Disclosure;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'WITHDRAWN';
}

export const SEED_USERS = [
  { id: 'U01', display_name: '测试食客01', roles: ['user'] as const, phone: '138****0001' },
  { id: 'U02', display_name: '测试食客02', roles: ['user'] as const, phone: '138****0002' },
  { id: 'U03', display_name: '测试食客03', roles: ['user'] as const, phone: '138****0003' },
  { id: 'U04', display_name: '测试食客04', roles: ['user'] as const, phone: '138****0004' },
  { id: 'U05', display_name: '测试食客05', roles: ['user'] as const, phone: '138****0005' },
  { id: 'U06', display_name: '测试食客06（已注销）', roles: ['user'] as const, phone: '138****0006' },
  { id: 'E01', display_name: '测试编辑01', roles: ['user', 'editor'] as const, phone: '138****0101' },
  { id: 'M01', display_name: '测试审核员01', roles: ['user', 'moderator'] as const, phone: '138****0201' },
  { id: 'A01', display_name: '测试管理员01', roles: ['user', 'moderator', 'admin'] as const, phone: '138****0301' },
];

/** 邀请式内测登录：验证码由服务端下发，固定值只存在于 demo 环境。 */
export const DEMO_LOGIN_CODE = '888888';

const dishesGuizhou = ['凯里红酸汤鱼', '肠旺面', '丝娃娃', '折耳根拌豆腐', '花溪牛肉粉', '糟辣脆皮鱼', '烙锅土豆'];
const dishesSichuan = ['水煮牛肉', '麻婆豆腐', '钵钵鸡', '夫妻肺片', '甜水面'];
const dishesChongqing = ['重庆小面', '毛血旺', '辣子鸡', '碗杂面'];
const dishesYunnan = ['小锅米线', '汽锅鸡', '鲜花饼', '菌子火锅'];
const dishesOther = ['烤鸭', '铜锅涮肉', '炸酱面'];

function r(
  id: string,
  name: string,
  branch: string | null,
  cuisines: Cuisine[],
  area: string,
  lng: number,
  lat: number,
  price_avg: number | null,
  dish_highlights: string[],
  taste_tags: string[],
  note: string,
  extra: Partial<SeedRestaurant> = {},
): SeedRestaurant {
  return {
    id,
    name,
    branch,
    cuisines,
    address: `北京市${area}（演示地址，非真实门店位置）`,
    floor_info: null,
    lng,
    lat,
    price_avg,
    price_reports: price_avg === null ? 0 : 3,
    dish_highlights,
    taste_tags,
    profile_public: true,
    place_status: 'VERIFIED',
    place_verified_days_ago: 21,
    business_status: 'OPEN',
    risk_status: 'CLEAR',
    location_version: 1,
    ever_qualified: false,
    note,
    ...extra,
  };
}

export const SEED_RESTAURANTS: SeedRestaurant[] = [
  r('R01', '测试·黔江酸汤粉', '望京店', ['guizhou'], '朝阳区望京', 116.470, 39.996, 68, [dishesGuizhou[0]!, dishesGuizhou[4]!], ['酸', '辣', '米粉'], '社区达标样板店（3 推荐 0 不推荐）'),
  r('R02', '测试·黔江酸汤粉', '望京同实体重复候选', ['guizhou'], '朝阳区望京', 116.4701, 39.9961, null, [dishesGuizhou[0]!], ['酸'], '门店合并演示：与 R01 视为同一实体候选', { place_status: 'PENDING', place_verified_days_ago: null }),
  r('R03', '测试·黔江酸汤粉', '双井店', ['guizhou'], '朝阳区双井', 116.465, 39.893, 72, [dishesGuizhou[1]!], ['辣'], '同品牌不同分店：票数独立计算'),
  r('R04', '测试·摘星小馆', '三里屯店', ['guizhou'], '朝阳区三里屯', 116.455, 39.937, 158, [dishesGuizhou[5]!, dishesGuizhou[3]!], ['酸', '折耳根'], '曾达标后失票演示：3 推荐 1 一般 1 不推荐，4R=12 < 3T=15 → LAPSED', { ever_qualified: true }),
  r('R05', '测试·蜀香居', '中关村店', ['sichuan'], '海淀区中关村', 116.316, 39.984, 92, [dishesSichuan[0]!, dishesSichuan[1]!], ['麻辣'], '编辑背书样板店（社区未达标，靠 ACTIVE 背书进图）', {
    editorial: {
      author: 'E01',
      visited_days_ago: 40,
      reason: '测试编辑实吃背书（合成内容）：水煮牛肉麻辣层次清晰，编辑本人到店，另一审核员已核验。',
      verifier: 'M01',
    },
  }),
  r('R06', '测试·山城面馆', '劲松店', ['chongqing', 'sichuan'], '朝阳区劲松', 116.459, 39.879, 35, [dishesChongqing[0]!], ['麻辣', '面'], '多标签门店：贵州/西南视图去重计数演示'),
  r('R07', '测试·滇味小锅', '五道口店', ['yunnan'], '海淀区五道口', 116.338, 39.992, 58, [dishesYunnan[0]!, dishesYunnan[3]!], ['鲜', '菌子'], '待验证图层演示：地点 PENDING', { place_status: 'PENDING', place_verified_days_ago: null }),
  r('R08', '测试·黔味楼', '方庄店', ['guizhou'], '丰台区方庄', 116.428, 39.862, 110, [dishesGuizhou[2]!], ['酸'], '疑似闭店：3 条闭店反馈生成工单，但不自动阻断', {
    business_status: 'SUSPECTED_CLOSED',
    risk_status: 'REVIEW_REQUIRED',
  }),
  r('R09', '测试·老凯里', '回龙观店', ['guizhou'], '昌平区回龙观', 116.336, 40.072, 76, [dishesGuizhou[0]!], ['酸'], '已确认闭店：不进默认层，详情仍可看历史', { business_status: 'CLOSED' }),
  r('R10', '测试·川北凉粉', '国贸店', ['sichuan'], '朝阳区国贸', 116.461, 39.909, 45, [dishesSichuan[2]!], ['麻辣', '凉'], '同坐标多店演示（与 R11 完全同点）'),
  r('R11', '测试·重庆碗杂面', '国贸店', ['chongqing'], '朝阳区国贸', 116.461, 39.909, null, [dishesChongqing[3]!], ['麻辣'], '同坐标多店演示（与 R10 完全同点）'),
  r('R12', '测试·云腿米线', '西单店', ['yunnan'], '西城区西单', 116.373, 39.912, 42, [dishesYunnan[0]!], ['鲜'], '预算未知演示：选预算时默认不匹配'),
  r('R13', '测试·北京烤鸭坊', '前门店', ['other'], '西城区前门', 116.397, 39.899, 268, [dishesOther[0]!], ['其他'], '北京其他菜系视图演示'),
  r('R14', '测试·铜锅居', '牛街店', ['other'], '西城区牛街', 116.366, 39.888, 145, [dishesOther[1]!], ['其他'], '北京其他菜系视图演示'),
  r('R15', '测试·酸汤牛肉粉', '海淀黄庄店', ['guizhou'], '海淀区海淀黄庄', 116.326, 39.976, 39, [dishesGuizhou[4]!], ['酸', '辣'], '2 推荐 0 不推荐：R>=3 不满足，保持 PENDING'),
  r('R16', '测试·折耳根小馆', '劲松店', ['guizhou'], '朝阳区劲松', 116.462, 39.881, 55, [dishesGuizhou[3]!], ['折耳根'], '词汇别名演示：折耳根/鱼腥草'),
  r('R17', '测试·贵州烙锅', '亚运村店', ['guizhou'], '朝阳区亚运村', 116.407, 39.999, 88, ['烙锅土豆', dishesGuizhou[1]!], ['辣'], '手动选点投稿演示店（未审核前不进图）'),
  r('R18', '测试·辣子鸡专门店', '望京店', ['chongqing', 'guizhou'], '朝阳区望京', 116.478, 39.999, null, ['辣子鸡'], ['麻辣'], '风险阻断演示：BLOCKED 时两种来源都不放行', { risk_status: 'BLOCKED' }),
  r('R19', '测试·苗家酸汤鱼', '马连道店', ['guizhou'], '西城区马连道', 116.321, 39.891, 120, [dishesGuizhou[0]!], ['酸'], '搬迁演示：location_version 递增后旧址票只作历史', { location_version: 2, place_status: 'PENDING', place_verified_days_ago: null, ever_qualified: true }),
  r('R20', '测试·丝娃娃工作室', '亮马桥店', ['guizhou'], '朝阳区亮马桥', 116.463, 39.948, 78, [dishesGuizhou[2]!], ['酸', '清淡'], '受邀试吃演示：披露后公开但不计票'),
  r('R21', '测试·川味钵钵鸡', '朝外店', ['sichuan'], '朝阳区朝外', 116.449, 39.923, 30, [dishesSichuan[2]!], ['麻辣'], '社区达标样板店 2'),
  r('R22', '测试·云南菌子屋', '苏州街店', ['yunnan'], '海淀区苏州街', 116.322, 39.989, 168, [dishesYunnan[3]!], ['鲜', '季节限定'], '社区达标样板店 3（含 1 条真实负面反馈）'),
  r('R23', '测试·黔菜食堂', '大成路店', ['guizhou'], '丰台区大成路', 116.248, 39.878, 48, [dishesGuizhou[6]!], ['辣'], '营业状态 UNKNOWN 演示：进图但标注营业未核实', { business_status: 'UNKNOWN' }),
  r('R24', '测试·私藏小锅饭', '来广营店', ['guizhou'], '朝阳区来广营', 116.442, 40.041, null, ['小锅饭'], [''], '个人私藏清单演示店（不进默认层：地点 PENDING）', { place_status: 'PENDING', place_verified_days_ago: null }),
];

function fb(
  id: string,
  restaurant_id: string,
  user: string,
  attitude: FeedbackAttitude,
  visited_days_ago: number,
  dish_names: string[],
  disclosure: Disclosure = 'none',
  status: SeedFeedback['status'] = 'APPROVED',
  reason?: string,
): SeedFeedback {
  return {
    id,
    restaurant_id,
    user,
    attitude,
    visited_days_ago,
    dish_names,
    disclosure,
    status,
    reason:
      reason ??
      `测试反馈（合成数据，非真实探店）：门店 ${restaurant_id}，态度=${attitude}，用于验证计票、窗口与披露规则。`,
  };
}

/** 手写样本只覆盖演示要点，其余计票用可预测的合成反馈补足，文案里明确标注合成。 */
export const SEED_FEEDBACK: SeedFeedback[] = [
  // R01：3 推荐 0 不推荐 → QUALIFIED
  fb('F001', 'R01', 'U01', 'recommend', 6, ['凯里红酸汤鱼', '花溪牛肉粉'], 'none', 'APPROVED',
    '测试反馈（合成，非真实探店）：酸汤底发酵感明显，米粉软硬度合适；这条记录用于演示社区推荐票如何进入资格计算。'),
  fb('F002', 'R01', 'U02', 'recommend', 23, ['凯里红酸汤鱼'], 'none'),
  fb('F003', 'R01', 'U03', 'recommend', 51, ['花溪牛肉粉', '折耳根拌豆腐'], 'none'),
  // R03：同品牌另一分店，只有 2 推荐 → PENDING
  fb('F004', 'R03', 'U01', 'recommend', 12, ['肠旺面']),
  fb('F005', 'R03', 'U02', 'recommend', 33, ['肠旺面']),
  // R04：曾达标，现在 3 推荐 1 一般 1 不推荐（4*3>=3*5 成立）→ 仍达标；再加一条不推荐才失效
  fb('F006', 'R04', 'U01', 'recommend', 15, ['糟辣脆皮鱼']),
  fb('F007', 'R04', 'U02', 'recommend', 40, ['糟辣脆皮鱼']),
  fb('F008', 'R04', 'U03', 'recommend', 61, ['折耳根拌豆腐']),
  fb('F009', 'R04', 'U04', 'neutral', 8, ['糟辣脆皮鱼']),
  fb('F010', 'R04', 'U05', 'not_recommend', 3, ['折耳根拌豆腐'], 'none', 'APPROVED',
    '测试反馈（合成）：折耳根生涩、上菜等待久；合法负面反馈照常公开并计入票数，不因负面而删除。'),
  // R05：社区 2 推荐（不达标）+ 编辑背书 ACTIVE
  fb('F011', 'R05', 'U01', 'recommend', 9, ['水煮牛肉']),
  fb('F012', 'R05', 'U02', 'recommend', 28, ['麻婆豆腐']),
  // R06：3 推荐 1 不推荐 → 4*3>=3*4 成立 → QUALIFIED
  fb('F013', 'R06', 'U01', 'recommend', 5, ['重庆小面']),
  fb('F014', 'R06', 'U02', 'recommend', 18, ['碗杂面']),
  fb('F015', 'R06', 'U03', 'recommend', 44, ['重庆小面']),
  fb('F016', 'R06', 'U04', 'not_recommend', 11, ['毛血旺']),
  // R07：地点待验证，票数够也不进默认层
  fb('F017', 'R07', 'U01', 'recommend', 7, ['小锅米线']),
  fb('F018', 'R07', 'U02', 'recommend', 16, ['小锅米线']),
  fb('F019', 'R07', 'U03', 'recommend', 30, ['汽锅鸡']),
  // R08：疑似闭店 + 复核中
  fb('F020', 'R08', 'U01', 'recommend', 20, ['丝娃娃']),
  fb('F021', 'R08', 'U02', 'recommend', 35, ['丝娃娃']),
  fb('F022', 'R08', 'U03', 'recommend', 50, ['烙锅土豆']),
  // R09：闭店
  fb('F023', 'R09', 'U01', 'recommend', 200, ['凯里红酸汤鱼'], 'none', 'APPROVED',
    '测试反馈（合成）：实吃日期在 180 天窗口之外，只作为历史记录显示，不计当前口碑。'),
  fb('F024', 'R09', 'U02', 'recommend', 20, ['凯里红酸汤鱼']),
  fb('F025', 'R09', 'U03', 'recommend', 25, ['花溪牛肉粉']),
  // R10/R11 同坐标
  fb('F026', 'R10', 'U01', 'recommend', 10, ['川北凉粉']),
  fb('F027', 'R10', 'U02', 'recommend', 12, ['川北凉粉']),
  fb('F028', 'R10', 'U03', 'recommend', 14, ['夫妻肺片']),
  fb('F029', 'R11', 'U04', 'recommend', 9, ['碗杂面']),
  fb('F030', 'R11', 'U05', 'recommend', 21, ['碗杂面']),
  fb('F031', 'R11', 'U01', 'recommend', 44, ['重庆小面']),
  // R12 无预算数据
  fb('F032', 'R12', 'U01', 'recommend', 13, ['小锅米线']),
  fb('F033', 'R12', 'U02', 'recommend', 19, ['小锅米线']),
  fb('F034', 'R12', 'U03', 'recommend', 38, ['汽锅鸡']),
  // R13/R14 北京其他
  fb('F035', 'R13', 'U01', 'recommend', 4, ['烤鸭']),
  fb('F036', 'R13', 'U02', 'recommend', 26, ['烤鸭']),
  fb('F037', 'R13', 'U03', 'recommend', 47, ['烤鸭']),
  fb('F038', 'R14', 'U04', 'recommend', 15, ['铜锅涮肉']),
  fb('F039', 'R14', 'U05', 'recommend', 22, ['铜锅涮肉']),
  fb('F040', 'R14', 'U01', 'recommend', 55, ['铜锅涮肉']),
  // R15：2 推荐 → PENDING
  fb('F041', 'R15', 'U01', 'recommend', 8, ['花溪牛肉粉']),
  fb('F042', 'R15', 'U02', 'recommend', 31, ['花溪牛肉粉']),
  // R16：别名演示
  fb('F043', 'R16', 'U01', 'recommend', 11, ['折耳根拌豆腐']),
  fb('F044', 'R16', 'U02', 'recommend', 24, ['折耳根拌豆腐']),
  fb('F045', 'R16', 'U03', 'recommend', 49, ['折耳根拌豆腐']),
  // R17：1 推荐 + 1 待审
  fb('F046', 'R17', 'U01', 'recommend', 6, ['烙锅土豆']),
  fb('F047', 'R17', 'U02', 'recommend', 2, ['肠旺面'], 'none', 'PENDING'),
  // R18：BLOCKED 但票数够
  fb('F048', 'R18', 'U01', 'recommend', 17, ['辣子鸡']),
  fb('F049', 'R18', 'U02', 'recommend', 27, ['辣子鸡']),
  fb('F050', 'R18', 'U03', 'recommend', 41, ['辣子鸡']),
  // R19：旧址 v1 三票；搬迁到 v2 后旧址票只作历史
  fb('F051', 'R19', 'U01', 'recommend', 30, ['凯里红酸汤鱼'], 'none', 'APPROVED', '测试反馈（合成）：旧址记录，location_version=1，不参与新址资格。'),
  fb('F052', 'R19', 'U02', 'recommend', 60, ['凯里红酸汤鱼']),
  fb('F053', 'R19', 'U03', 'recommend', 90, ['酸汤牛肉']),
  // R20：3 条里 2 条披露关联 → 独立票不足
  fb('F054', 'R20', 'U01', 'recommend', 5, ['丝娃娃'], 'invited_tasting', 'APPROVED',
    '测试反馈（合成）：受邀试吃，内容公开并披露关联，但不计入社区独立票。'),
  fb('F055', 'R20', 'U02', 'recommend', 12, ['丝娃娃'], 'gifted_or_promoted'),
  fb('F056', 'R20', 'U03', 'recommend', 33, ['丝娃娃'], 'none'),
  // R21/R22 达标
  fb('F057', 'R21', 'U01', 'recommend', 3, ['钵钵鸡']),
  fb('F058', 'R21', 'U02', 'recommend', 14, ['钵钵鸡']),
  fb('F059', 'R21', 'U03', 'recommend', 29, ['甜水面']),
  fb('F060', 'R22', 'U01', 'recommend', 7, ['菌子火锅']),
  fb('F061', 'R22', 'U02', 'recommend', 25, ['菌子火锅']),
  fb('F062', 'R22', 'U03', 'recommend', 43, ['汽锅鸡']),
  fb('F063', 'R22', 'U04', 'not_recommend', 9, ['鲜花饼']),
  // R23：UNKNOWN 营业
  fb('F064', 'R23', 'U01', 'recommend', 10, ['烙锅土豆']),
  fb('F065', 'R23', 'U02', 'recommend', 32, ['烙锅土豆']),
  fb('F066', 'R23', 'U03', 'recommend', 58, ['小锅饭']),
  // R24：注销账号曾投的票（重算演示）
  fb('F067', 'R24', 'U06', 'recommend', 19, ['小锅饭']),
  fb('F068', 'R24', 'U02', 'recommend', 45, ['小锅饭']),
  // R02 重复候选
  fb('F069', 'R02', 'U05', 'recommend', 13, ['凯里红酸汤鱼']),
  // R25：撤回演示 —— 由前端演示时创建，此处不放种子
];

/** 搜索别名（可维护映射）。 */
export const ALIASES: Record<string, string[]> = {
  鱼腥草: ['折耳根'],
  折耳根: ['鱼腥草'],
  酸汤: ['凯里红酸汤鱼', '苗家酸汤鱼'],
  米线: ['小锅米线'],
  米粉: ['花溪牛肉粉', '黔江酸汤粉'],
};

export const DISH_KEYWORDS = Array.from(
  new Set(
    SEED_RESTAURANTS.flatMap((x) => x.dish_highlights).filter((s) => s && s.length > 1) as string[],
  ),
);
