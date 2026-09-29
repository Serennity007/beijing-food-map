/**
 * UGC 文本内容审核适配层。
 * production（微信小程序生态）必须接 msgSecCheck：微信要求用户产生的内容在展示/存储前过内容安全接口。
 * Provider 落点：
 *   - wechat：微信 msgSecCheck（需要 WECHAT_APPID + WECHAT_APP_SECRET，access_token 自动管理缓存）；
 *   - passthrough：未配置时直通（开发/演示），production 未配置会在启动日志里显著提醒。
 * 判定策略：命中违规 → 拒绝（400）；审核服务本身不可达 → production 拒绝（503，宁停勿漏），非生产直通并记日志。
 */
import type { AppConfig } from '../env';

export interface TextVerdict {
  ok: boolean;
  /** 拒绝时给用户的提示（不回传平台内部错误细节）。 */
  message?: string;
}

export interface ContentModeration {
  readonly name: 'wechat' | 'passthrough';
  checkText(text: string, scene: string): Promise<TextVerdict>;
}

interface WxTokenState {
  token: string;
  expiresAt: number;
  refreshing?: Promise<string>;
}

export class WechatMsgSecCheck implements ContentModeration {
  readonly name = 'wechat' as const;
  private token: WxTokenState | null = null;

  constructor(private appid: string, private secret: string) {}

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt > now) return this.token.token;
    if (this.token?.refreshing) return this.token.refreshing;
    const refreshing = (async () => {
      const res = await fetch(
        `https://api.weixin.qq.com/cgi-bin/stable_token?grant_type=client_credential&appid=${encodeURIComponent(this.appid)}&secret=${encodeURIComponent(this.secret)}`,
      );
      const j = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; errcode?: number } | null;
      if (!j?.access_token) throw new Error(`token ${j?.errcode ?? 'unknown'}`);
      this.token = { token: j.access_token, expiresAt: Date.now() + Math.max(60, (j.expires_in ?? 7200) - 120) * 1000 };
      return this.token.token;
    })();
    this.token = { ...(this.token ?? { token: '', expiresAt: 0 }), refreshing };
    try {
      return await refreshing;
    } finally {
      // 单飞结束；下一次过期后重新取
      if (this.token) this.token.refreshing = undefined;
    }
  }

  async checkText(text: string, scene: string): Promise<TextVerdict> {
    const token = await this.accessToken();
    let res: Response;
    try {
      res = await fetch(`https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text, scene: scene === 'report' ? 3 : 2 }),
      });
    } catch {
      return { ok: false, message: 'CONTENT_CHECK_UNAVAILABLE' };
    }
    const j = (await res.json().catch(() => null)) as { errcode?: number; result?: { suggest?: string; label?: number } } | null;
    if (!j) return { ok: false, message: 'CONTENT_CHECK_UNAVAILABLE' };
    if (j.errcode === 87014) return { ok: false, message: '内容包含不允许的信息，请修改后再提交' };
    // 成功必须显式 errcode===0 且带 result；缺失/异常都按"审核服务不可用"处理（production 拒绝）
    if (j.errcode !== 0 || !j.result) return { ok: false, message: 'CONTENT_CHECK_UNAVAILABLE' };
    const suggest = j.result.suggest ?? 'pass';
    if (suggest === 'pass') return { ok: true };
    return { ok: false, message: '内容包含不允许的信息，请修改后再提交' };
  }
}

export class PassThroughModeration implements ContentModeration {
  readonly name = 'passthrough' as const;
  async checkText(): Promise<TextVerdict> {
    return { ok: true };
  }
}

export function createContentModeration(cfg: AppConfig): ContentModeration {
  if (cfg.wechatAppid && cfg.wechatAppSecret) return new WechatMsgSecCheck(cfg.wechatAppid, cfg.wechatAppSecret);
  if (cfg.nodeEnv === 'production') {
    process.stderr.write('[moderation] 生产环境未配置 WECHAT_APPID/WECHAT_APP_SECRET：内容审核为直通模式，微信审核要求 UGC 必须过 msgSecCheck，上线前必须配置\n');
  }
  return new PassThroughModeration();
}
