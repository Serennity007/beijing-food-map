import type { BusinessStatus, Cuisine, PlaceVerificationStatus, RiskStatus, Role } from './enums';
import type { SeedRestaurant } from './seed';

/**
 * 真实门店种子（预览版）。与合成种子（seed.ts）的区别：
 *
 * - 店名是**真实存在**的北京贵州/云南/本地经典餐馆，事实字段（店名、地址、招牌菜）
 *   来自公开资料检索（Tripadvisor / 携程美食 / 网易旅游等，2026-09-30 检索），来源写在每家店的 note 里；
 * - 一律 **is_test_data=false**（真实事实，非测试数据）、**零票数零反馈**（不编造任何探店与口碑，
 *   好店资格必须由真实用户的实吃投稿或编辑的实吃背书产生）；
 * - 坐标是**区域级 GCJ-02 估算锚点**（精度 ±数百米），所以 place_status 全部 PENDING——
 *   「地点待核验」徽标如实呈现这一状态；拿到高德 Key 实地核验后才转 VERIFIED；
 * - 人均留空（price_avg=null）：公开资料上的人均不能冒充「用户报告人均」。
 *
 * 登录账号结构沿用合成种子（U01/E01/M01/A01 等演示账号），显示名去掉「测试」前缀。
 */

export interface SeedRealUser {
  id: string;
  display_name: string;
  roles: readonly Role[];
  phone: string;
}

export const SEED_REAL_USERS: SeedRealUser[] = [
  { id: 'U01', display_name: '主理人', roles: ['user'] as const, phone: '138****0001' },
  { id: 'U02', display_name: '朋友02', roles: ['user'] as const, phone: '138****0002' },
  { id: 'U03', display_name: '朋友03', roles: ['user'] as const, phone: '138****0003' },
  { id: 'U04', display_name: '朋友04', roles: ['user'] as const, phone: '138****0004' },
  { id: 'U05', display_name: '朋友05', roles: ['user'] as const, phone: '138****0005' },
  { id: 'U06', display_name: '用户06（已注销）', roles: ['user'] as const, phone: '138****0006' },
  { id: 'E01', display_name: '编辑01', roles: ['user', 'editor'] as const, phone: '138****0101' },
  { id: 'M01', display_name: '审核员01', roles: ['user', 'moderator'] as const, phone: '138****0201' },
  { id: 'A01', display_name: '管理员01', roles: ['user', 'moderator', 'admin'] as const, phone: '138****0301' },
];

const SOURCE = '来源：Tripadvisor / 携程美食 / 网易旅游等公开页（2026-09-30 检索）';

function rr(
  id: string,
  name: string,
  branch: string | null,
  cuisines: Cuisine[],
  address: string,
  lng: number,
  lat: number,
  dish_highlights: string[],
  taste_tags: string[],
  source: string,
  extra: Partial<SeedRestaurant> = {},
): SeedRestaurant {
  return {
    id,
    name,
    branch,
    cuisines,
    address,
    floor_info: null,
    lng,
    lat,
    price_avg: null,
    price_reports: 0,
    dish_highlights,
    taste_tags,
    profile_public: true,
    place_status: 'PENDING' as PlaceVerificationStatus,
    place_verified_days_ago: null,
    business_status: 'OPEN' as BusinessStatus,
    risk_status: 'CLEAR' as RiskStatus,
    location_version: 1,
    ever_qualified: false,
    note: `${source}；${SOURCE}`,
    ...extra,
  };
}

export const SEED_REAL_RESTAURANTS: SeedRestaurant[] = [
  // ---------------------------------------------------------- 贵州菜
  rr('R50', '三个贵州人', '建外SOHO店', ['guizhou'],
    '北京市朝阳区东三环中路39号建外SOHO东区', 116.4565, 39.9089,
    ['酸汤鱼', '丝娃娃', '蕨粑', '叶儿粑'], ['酸', '辣'],
    '北京开设较早的代表性贵州菜馆之一（三位贵州画家创立），招牌红酸汤系列'),
  rr('R51', '贵州大厦驻京办餐厅', null, ['guizhou'],
    '北京市朝阳区北三环樱花西街18号贵州大厦2楼', 116.4135, 39.9675,
    ['酸汤鱼', '丝娃娃', '米豆腐', '花溪牛肉粉', '折耳根'], ['酸', '辣', '黔味'],
    '驻京办餐厅，公开评价中公认较地道的贵州味'),
  rr('R52', '三个贵州人', '蓝色港湾店', ['guizhou'],
    '北京市朝阳区朝阳公园路6号蓝色港湾', 116.4735, 39.9470,
    ['酸汤鱼', '叶儿粑'], ['酸', '辣'],
    '与建外SOHO店同品牌不同分店，公开资料人均约114元'),
  rr('R53', '2贵酸汤鱼土家菜', '甘露园店', ['guizhou'],
    '北京市朝阳区青年路甘露园南里一区', 116.4920, 39.9235,
    ['酸汤鱼', '土家腊味'], ['酸', '辣'],
    '社区黔菜馆，公开资料人均约76元', { business_status: 'UNKNOWN' }),
  rr('R54', '苗岭酸汤鱼·贵州菜', '亦庄店', ['guizhou'],
    '北京市大兴区亦庄凉水河一街（赢海庄园院内）', 116.5050, 39.7905,
    ['酸汤鱼', '苗家小炒'], ['酸', '辣'],
    '公开评分 4.3/5（Trip.com）', { business_status: 'UNKNOWN' }),

  // ---------------------------------------------------------- 云南菜
  rr('R55', '一坐一忘云南菜', '三里屯店', ['yunnan'],
    '北京市朝阳区三里屯北小街1号', 116.4520, 39.9455,
    ['汽锅鸡', '小锅米线', '菌子时蔬'], ['鲜', '滇味'],
    '北京文艺云南菜代表店，主打汽锅鸡'),
  rr('R56', '中8楼', '太古里店', ['yunnan'],
    '北京市朝阳区三里屯路19号三里屯太古里南区4层', 116.4550, 39.9375,
    ['汽锅鸡', '鲜花饼', '改良滇菜'], ['鲜'],
    '改良滇菜，与一坐一忘同区域'),
  rr('R57', '中8楼', '颐堤港店', ['yunnan'],
    '北京市朝阳区酒仙桥路18号颐堤港', 116.4935, 39.9685,
    ['汽锅鸡', '小锅米线'], ['鲜'],
    '公开资料人均约98元'),

  // ---------------------------------------------------------- 北京经典（「北京其他」视图）
  rr('R58', '四季民福烤鸭店', '故宫店', ['other'],
    '北京市东城区南池子大街11号', 116.4022, 39.9130,
    ['北京烤鸭', '贝勒烤肉', '宫廷杏仁豆腐'], ['京味', '烤鸭'],
    '故宫东华门旁，公开资料人均约160元'),
  rr('R59', '护国寺小吃', '总店', ['other'],
    '北京市西城区护国寺大街93号', 116.3740, 39.9350,
    ['豆汁焦圈', '豌豆黄', '驴打滚', '面茶'], ['小吃', '京味'],
    '1956 年开业的京味小吃老字号'),
  rr('R60', '聚宝源', '牛街店', ['other'],
    '北京市西城区牛街', 116.3655, 39.8875,
    ['铜锅涮肉', '手切鲜羊肉'], ['清真', '涮肉'],
    '牛街知名清真涮肉'),
];

/** 真实档案的搜索别名补充（与合成档案的 ALIASES 合并使用）。 */
export const REAL_ALIASES: Record<string, string[]> = {
  烤鸭: ['北京烤鸭'],
  涮肉: ['铜锅涮肉'],
  驻京办: ['贵州大厦'],
};
