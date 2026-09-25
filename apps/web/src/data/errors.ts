/**
 * B5：把引擎/HTTP 的错误码翻译成"出了什么事 + 下一步做什么"。
 * 只做码→文案映射，不重算业务；未映射的错误原样透出引擎的中文说明
 * （那些话本身是具体的，比如"不能处置自己提交的举报"）。
 * snapshot / revision / query_key 这类技术词不进普通用户视线。
 */
export function readErrorCode(e: unknown): string | null {
  if (typeof e === 'object' && e !== null) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return null;
}

export function describeError(code: string | null, fallback: string): string {
  switch (code) {
    case 'QUERY_EXPIRED':
      return '地图数据刚刚更新过，这次读取没有跟上。请重试或刷新页面。';
    case 'VERSION_CONFLICT':
      return '内容刚被其他人更新过。请刷新页面对照后再操作；你填写的内容还在页面上，不会丢。';
    case 'UNAUTHORIZED':
      return '登录状态已失效，请重新登录后再操作。';
    default:
      return fallback;
  }
}
