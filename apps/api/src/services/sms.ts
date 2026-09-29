/**
 * 短信验证码发送适配层。
 * Provider 接口是真实供应商（阿里云/腾讯云 SMS 等）的落点：
 *   - console：把验证码写进服务端日志（开发/联调用，生产禁用）；
 *   - http：通用 Webhook 网关——POST SMS_HTTP_URL，body 为 { phone, code, template }，
 *     鉴权用 SMS_HTTP_TOKEN（Bearer）。绝大多数聚合 SMS 网关都是这个形状；
 *   - none：未配置。send 一律抛错（production 缺省值，避免悄悄降级）。
 * 凭据只从环境变量来，绝不写进日志或响应。
 */
import type { AppConfig } from '../env';
import { ApiError } from '@qianwei/contracts';

export interface SmsProvider {
  readonly name: 'console' | 'http' | 'none';
  send(phone: string, code: string): Promise<void>;
}

export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console' as const;
  async send(phone: string, code: string): Promise<void> {
    smsLog.write(`[sms:console] ${phone.slice(0, 3)}****${phone.slice(-4)} -> ${code}（仅限非生产环境）\n`);
  }
}

/** console 供应商的输出出口；测试注入用，默认写 stderr。 */
export const smsLog: { write: (line: string) => void } = {
  write: (line: string) => {
    process.stderr.write(line);
  },
};

export class HttpSmsProvider implements SmsProvider {
  readonly name = 'http' as const;
  constructor(private url: string, private token: string | undefined) {}
  async send(phone: string, code: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({ phone, code, template: 'login' }),
      });
    } catch {
      throw new ApiError('PROVIDER_UNAVAILABLE', '短信服务暂时不可用，请稍后再试', 503);
    }
    if (!res.ok) {
      throw new ApiError('PROVIDER_UNAVAILABLE', '短信服务暂时不可用，请稍后再试', 503);
    }
  }
}

export class UnconfiguredSmsProvider implements SmsProvider {
  readonly name = 'none' as const;
  async send(): Promise<void> {
    throw new ApiError('SMS_UNCONFIGURED', '短信服务未配置，请联系运营方', 503);
  }
}

export function createSmsProvider(cfg: AppConfig): SmsProvider {
  if (cfg.smsProvider === 'http') return new HttpSmsProvider(cfg.smsHttpUrl!, cfg.smsHttpToken);
  if (cfg.smsProvider === 'console') return new ConsoleSmsProvider();
  return new UnconfiguredSmsProvider();
}

/** 短信验证码生命周期：哈希存储、短时有效、单次使用、尝试次数上限。 */
export interface SmsChallenge {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
}

export const SMS_CODE_TTL_MS = 5 * 60_000;
export const SMS_MAX_ATTEMPTS = 5;

/** djb2 变体哈希（进程内比对用，非持久化）。 */
export function smsCodeHash(code: string): string {
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) >>> 0;
  return `c${h.toString(16)}-${code.length}`;
}

/** 中国大陆手机号。 */
export function isCnPhone(phone: string): boolean {
  return /^1\d{10}$/.test(phone);
}

export class SmsChallengeStore {
  private challenges = new Map<string, SmsChallenge>();

  save(phone: string, code: string, now = Date.now()): void {
    this.challenges.set(phone, {
      codeHash: smsCodeHash(code),
      expiresAt: now + SMS_CODE_TTL_MS,
      attempts: 0,
      used: false,
    });
  }

  /** 校验：过期/未发/超次/用错 → false；成功即销毁（单次使用）。 */
  consume(phone: string, code: string, now = Date.now()): boolean {
    const ch = this.challenges.get(phone);
    if (!ch || ch.used || now > ch.expiresAt) {
      this.challenges.delete(phone);
      return false;
    }
    if (ch.attempts >= SMS_MAX_ATTEMPTS) {
      this.challenges.delete(phone);
      return false;
    }
    if (ch.codeHash !== smsCodeHash(code)) {
      ch.attempts += 1;
      return false;
    }
    this.challenges.delete(phone);
    return true;
  }

  invalidate(phone: string): void {
    this.challenges.delete(phone);
  }
}
