import type * as C from '@qianwei/contracts';
import { ClientError, type ApiClient, type MapQueryInput, type PatchStatusInput, type SubmitInput } from './client';

/** 有后端时（VITE_API_BASE 指向已部署 API）走这条路径；静态部署用 StaticClient。 */
export class Http implements ApiClient {
  readonly mode = 'http' as const;
  private base: string;

  constructor(base: string) {
    this.base = base.replace(/\/$/, '');
  }

  private async req<T>(path: string, init: RequestInit = {}, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        credentials: 'include',
        ...init,
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ClientError('PROVIDER_UNAVAILABLE', '网络不可用，显示的是上次加载的数据', 503);
    }
    const json = (await res.json().catch(() => null)) as
      | { data?: T; error?: { code: string; message: string; fieldErrors?: Record<string, string> } }
      | null;
    if (!res.ok || json?.error) {
      throw new ClientError(
        json?.error?.code ?? 'PROVIDER_UNAVAILABLE',
        json?.error?.message ?? `请求失败（${res.status}）`,
        res.status,
        json?.error?.fieldErrors,
      );
    }
    return (json?.data ?? null) as T;
  }

  private static qs(q: MapQueryInput & { snapshot?: string | null; cursor?: string | null; limit?: number }): string {
    const p = new URLSearchParams();
    p.set('west', String(q.bounds.west));
    p.set('south', String(q.bounds.south));
    p.set('east', String(q.bounds.east));
    p.set('north', String(q.bounds.north));
    p.set('zoom', String(q.zoom));
    p.set('view', q.view);
    if (q.budget_max !== null) p.set('budget', String(q.budget_max));
    p.set('include_unknown', q.include_unknown_budget ? '1' : '0');
    if (q.dish_or_tag) p.set('dish', q.dish_or_tag);
    p.set('layer', q.layer);
    if (q.snapshot) p.set('snapshot', q.snapshot);
    if (q.cursor) p.set('cursor', q.cursor);
    if (q.limit) p.set('limit', String(q.limit));
    return `?${p.toString()}`;
  }

  mapItems(q: MapQueryInput, snapshot?: string | null) {
    return this.req<C.MapItemsResponse>(`/map/items${Http.qs({ ...q, snapshot })}`);
  }

  listRestaurants(q: MapQueryInput, snapshot: string | null, cursor: string | null, limit: number) {
    return this.req<C.Page<C.Restaurant>>(`/restaurants${Http.qs({ ...q, snapshot, cursor, limit })}`);
  }

  search(q: string) {
    return this.req<{ own: C.Restaurant[]; provider_candidates: Array<{ provider: string; poi_id: string; name: string; address: string }> }>(
      `/restaurants/search?q=${encodeURIComponent(q)}`,
    );
  }

  detail(id: string) {
    return this.req<C.RestaurantDetail>(`/restaurants/${encodeURIComponent(id)}`);
  }

  async mediaUrls(ids: string[]) {
    const out: Record<string, string> = {};
    for (const id of ids) out[id] = `${this.base}/media/${encodeURIComponent(id)}`;
    return out;
  }

  /** demo 专用：后端登记一张标注为合成的图片，替代真实对象存储签名上传。 */
  async uploadTestPhoto(restaurantId: string | null) {
    const r = await this.req<{ id: string }>('/uploads/test-photo', { method: 'POST' }, { restaurant_id: restaurantId });
    return r.id;
  }

  async login(userId: string, code: string) {
    const r = await this.req<{ user: C.SessionUser }>('/auth/login', { method: 'POST' }, { user_id: userId, code });
    return r.user;
  }

  async logout() {
    await this.req<{ ok: true }>('/auth/logout', { method: 'POST' });
  }

  me() {
    return this.req<C.SessionUser | null>('/me');
  }

  submit(input: SubmitInput) {
    return this.req<C.Submission>(
      '/submissions',
      { method: 'POST', headers: input.idempotency_key ? { 'idempotency-key': input.idempotency_key } : {} },
      input,
    );
  }

  mySubmissions() {
    return this.req<C.Submission[]>('/me/submissions');
  }

  async withdrawFeedback(restaurantId: string) {
    await this.req<{ ok: true }>(`/restaurants/${encodeURIComponent(restaurantId)}/my-feedback`, { method: 'DELETE' });
  }

  collections() {
    return this.req<C.Collection[]>('/collections');
  }

  createCollection(title: string, description: string | null) {
    return this.req<C.Collection>('/collections', { method: 'POST' }, { title, description });
  }

  updateCollection(collectionId: string, patch: { title?: string; description?: string | null }) {
    return this.req<C.Collection>(`/collections/${encodeURIComponent(collectionId)}`, { method: 'PATCH' }, patch);
  }

  toggleSystemItem(restaurantId: string, kind: C.SystemCollectionKind, on: boolean) {
    return this.req<C.Collection[]>(`/restaurants/${encodeURIComponent(restaurantId)}/collection-item`, { method: 'PUT' }, { kind, on });
  }

  updateCollectionItem(
    collectionId: string,
    restaurantId: string,
    patch: { note?: string | null; note_shareable?: boolean; remove?: boolean; position?: number },
  ) {
    return this.req<C.Collection>(
      `/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(restaurantId)}`,
      { method: patch.remove ? 'DELETE' : 'PUT' },
      patch.remove ? undefined : patch,
    );
  }

  async deleteCollection(collectionId: string) {
    await this.req<{ ok: true }>(`/collections/${encodeURIComponent(collectionId)}`, { method: 'DELETE' });
  }

  requestPublication(collectionId: string, shareItemIds: string[]) {
    return this.req<{ id: string; status: string; generation: number }>(
      `/collections/${encodeURIComponent(collectionId)}/publication-requests`,
      { method: 'POST' },
      { share_item_ids: shareItemIds },
    );
  }

  unpublish(collectionId: string) {
    return this.req<C.Collection>(`/collections/${encodeURIComponent(collectionId)}/unpublish`, { method: 'POST' });
  }

  sharedSnapshot(token: string) {
    return this.req<C.SharedCollectionSnapshot>(`/shared-collections/${encodeURIComponent(token)}`);
  }

  createReport(input: { restaurant_id: string; kind: C.ReportTicket['kind']; detail: string }) {
    return this.req<C.ReportTicket>('/reports', { method: 'POST' }, input);
  }

  myReports() {
    return this.req<C.ReportTicket[]>('/me/reports');
  }

  auditLog() {
    return this.req<C.AuditRec[]>('/admin/audit-log');
  }

  moderationQueue() {
    return this.req<C.ModerationQueueEntry[]>('/admin/queue');
  }

  async moderate(input: { target: string; action: 'approve' | 'reject' | 'hide'; reason?: string; expected_version: number }) {
    const r = await this.req<{ ok: true; restaurant: C.Restaurant | null }>(
      `/admin/moderation/${encodeURIComponent(input.target)}/actions`,
      { method: 'POST' },
      { action: input.action, reason: input.reason, expected_version: input.expected_version },
    );
    return { ok: true as const, restaurant: r.restaurant ?? null };
  }

  patchRestaurantStatus(input: PatchStatusInput) {
    return this.req<C.Restaurant>(`/admin/restaurants/${encodeURIComponent(input.id)}/status`, { method: 'PATCH' }, input);
  }

  mergeRestaurants(input: { source_id: string; target_id: string; reason: string; expected_version: number }) {
    return this.req<{ canonical: string }>(`/admin/restaurants/${encodeURIComponent(input.source_id)}/merge`, { method: 'POST' }, input);
  }

  revokeOrVerifyEndorsement(input: { restaurant_id: string; action: 'verify' | 'revoke'; reason?: string }) {
    return this.req<C.Restaurant>(`/admin/editorial-endorsements/${input.action}`, { method: 'POST' }, input);
  }

  deleteAccount() {
    return this.req<{ deletion_job_id: string }>('/me', { method: 'DELETE' });
  }

  today() {
    return this.req<string>('/today');
  }
}
