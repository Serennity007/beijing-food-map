/**
 * 真实图片上传：类型/体积校验 + EXIF（含 GPS）剥离 + 本地磁盘对象存储。
 * 单节点部署（render.com persistent disk / 自管主机）用磁盘适配；换 S3 兼容存储时
 * 实现同一接口即可（put/remove/size），业务层不感知。
 * 隐私要求（隐私页承诺）：上传图片必须剥离 EXIF（含 GPS 定位）后才落盘。
 */
import { mkdirSync, statSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { ApiError } from '@qianwei/contracts';

export const UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export interface StoredObject {
  data: Buffer;
  contentType: string;
}

export interface ObjectStorage {
  put(key: string, data: Buffer): void;
  get(key: string): StoredObject | null;
  remove(key: string): void;
}

export class DiskStorage implements ObjectStorage {
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true });
  }

  private resolve(key: string): string {
    // key 由服务端生成（无 .. 、无路径分隔），仍做一次防御
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new ApiError('VALIDATION_ERROR', '非法对象键', 400);
    return path.join(this.root, key);
  }

  put(key: string, data: Buffer): void {
    writeFileSync(this.resolve(key), data);
  }

  get(key: string): StoredObject | null {
    const p = this.resolve(key);
    try {
      statSync(p);
    } catch {
      return null;
    }
    return { data: readFileSync(p), contentType: 'application/octet-stream' };
  }

  remove(key: string): void {
    try {
      unlinkSync(this.resolve(key));
    } catch {
      /* 已不存在 */
    }
  }
}

/** 魔数嗅探真实类型；不一致即拒（防改后缀）。 */
export function sniffImageType(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * JPEG：按段解析，丢弃全部 APP1 段（Exif/XMP 都在 APP1，含 GPS）。
 * 结构：FFD8 → 段（FF marker + 2B 长度 + payload）→ 扫描数据。保持其余字节原样。
 */
export function stripJpegExif(buf: Buffer): Buffer {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      // SOS/EOI 之后是压缩数据，原样拷到底
      out.push(buf.subarray(i));
      return Buffer.concat(out);
    }
    const len = buf.readUInt16BE(i + 2);
    const segEnd = i + 2 + len;
    if (segEnd > buf.length) return buf;
    const isApp1 = marker === 0xe1;
    if (!isApp1) out.push(buf.subarray(i, segEnd));
    i = segEnd;
  }
  out.push(buf.subarray(i));
  return Buffer.concat(out);
}

/** PNG：移除 eXIf 辅助块（若存在），其余原样。 */
export function stripPngExif(buf: Buffer): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(sig)) return buf;
  const out: Buffer[] = [sig];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('ascii', i + 4, i + 8);
    const chunkEnd = i + 12 + len;
    if (chunkEnd > buf.length) return buf;
    if (type !== 'eXIf') out.push(buf.subarray(i, chunkEnd));
    i = chunkEnd;
  }
  return Buffer.concat(out);
}

/** WebP：移除 EXIF chunk（若存在），其余原样。 */
export function stripWebpExif(buf: Buffer): Buffer {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return buf;
  const chunks: Buffer[] = [];
  let i = 12;
  let changed = false;
  while (i + 8 <= buf.length) {
    const type = buf.toString('ascii', i, i + 4);
    const len = buf.readUInt32LE(i + 4);
    const end = i + 8 + len + (len % 2);
    if (end > buf.length) return buf;
    if (type !== 'EXIF') chunks.push(buf.subarray(i, end));
    else changed = true;
    i = end;
  }
  if (!changed) return buf;
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  buf.copy(header, 0, 0, 4);
  header.writeUInt32LE(body.length + 4, 4);
  buf.copy(header, 8, 8, 12);
  return Buffer.concat([header, body]);
}

export function stripImageExif(buf: Buffer, contentType: string): Buffer {
  switch (contentType) {
    case 'image/jpeg':
      return stripJpegExif(buf);
    case 'image/png':
      return stripPngExif(buf);
    case 'image/webp':
      return stripWebpExif(buf);
    default:
      return buf;
  }
}
