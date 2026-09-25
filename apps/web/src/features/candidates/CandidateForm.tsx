/**
 * 建店与补材料共用的表单。字段上限只是形状提示，真正的边界（北京范围、菜系枚举、
 * 信息来源长度、重复门店判定）全部由引擎判，页面只把返回的字段错误定位回去。
 *
 * B3：传入 draftKey 时（建店流程），已填内容会存本机 —— 跳去地图选点再回来不丢店名与说明；
 * initial 里非空的字段（刚选的点、第三方候选）优先于草稿。补材料不传 draftKey，行为不变。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BEIJING_BOUNDS,
  BEIJING_CENTER,
  CUISINES,
  CUISINE_LABEL,
  isValidGcj02,
  type CandidateFacts,
  type Cuisine,
} from '@qianwei/contracts';
import { MapView } from '../map/MapView';

interface Props {
  initial: Partial<CandidateFacts>;
  fieldErrors?: Record<string, string>;
  busy?: boolean;
  title?: string;
  submitLabel: string;
  onSubmit: (facts: CandidateFacts) => void;
  onCancel?: () => void;
  /** 传入后已填字段持久化到本机（按账号分键），跨页面选点往返可恢复。 */
  draftKey?: string;
}

function Err({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <span className="err">{msg}</span>;
}

interface FormDraft {
  name: string;
  branch: string;
  address: string;
  floor: string;
  cuisines: Cuisine[];
  evidence: string;
  lng: string;
  lat: string;
}

function readDraft(key: string): FormDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o !== 'object' || o === null) return null;
    return {
      name: typeof o.name === 'string' ? o.name : '',
      branch: typeof o.branch === 'string' ? o.branch : '',
      address: typeof o.address === 'string' ? o.address : '',
      floor: typeof o.floor === 'string' ? o.floor : '',
      cuisines: Array.isArray(o.cuisines) ? o.cuisines.filter((c): c is Cuisine => typeof c === 'string') : [],
      evidence: typeof o.evidence === 'string' ? o.evidence : '',
      lng: typeof o.lng === 'string' ? o.lng : '',
      lat: typeof o.lat === 'string' ? o.lat : '',
    };
  } catch {
    return null;
  }
}

export function CandidateForm({ initial, fieldErrors = {}, busy = false, title = '新建门店申请', submitLabel, onSubmit, onCancel, draftKey }: Props) {
  const restored = useRef(false);
  // 提交/取消后置位：卸载不再把刚清掉的草稿写回去
  const closed = useRef(false);
  const [name, setName] = useState(initial.name ?? '');
  const [branch, setBranch] = useState(initial.branch ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [floor, setFloor] = useState(initial.floor_info ?? '');
  const [cuisines, setCuisines] = useState<Cuisine[]>(initial.cuisines ?? []);
  const [lng, setLng] = useState(initial.lng === undefined ? '' : String(initial.lng));
  const [lat, setLat] = useState(initial.lat === undefined ? '' : String(initial.lat));
  const [evidence, setEvidence] = useState(initial.evidence_note ?? '');
  const [local, setLocal] = useState<string | null>(null);
  /* 内嵌选点小地图：没带坐标进来时默认展开，把"选位置"变成主路径（B3 的完全体）。 */
  const [mapOpen, setMapOpen] = useState(
    () => !(typeof initial.lng === 'number' && typeof initial.lat === 'number' && isValidGcj02(initial.lng, initial.lat)),
  );
  const pickerViewport = useMemo(
    () =>
      typeof initial.lng === 'number' && typeof initial.lat === 'number' && isValidGcj02(initial.lng, initial.lat)
        ? {
            bounds: { west: initial.lng - 0.008, south: initial.lat - 0.006, east: initial.lng + 0.008, north: initial.lat + 0.006 },
            zoom: 15,
            center: { lng: initial.lng, lat: initial.lat },
          }
        : { bounds: { ...BEIJING_BOUNDS }, zoom: 11, center: { ...BEIJING_CENTER } },
    // 仅按挂载时的初值决定初始视野；之后由用户在地图上自行移动。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function pickOnMap(point: { lng: number; lat: number }): void {
    setLng(point.lng.toFixed(5));
    setLat(point.lat.toFixed(5));
    setLocal(null);
  }

  /* 只在首次挂载时用草稿补 initial 没有的字段；initial 非空值（刚选的点/候选）永远优先。 */
  useEffect(() => {
    if (!draftKey || restored.current) return;
    restored.current = true;
    const d = readDraft(draftKey);
    if (!d) return;
    if (!initial.name && d.name) setName(d.name);
    if (!initial.branch && d.branch) setBranch(d.branch);
    if (!initial.address && d.address) setAddress(d.address);
    if (!initial.floor_info && d.floor) setFloor(d.floor);
    if ((!initial.cuisines || initial.cuisines.length === 0) && d.cuisines.length > 0) setCuisines(d.cuisines);
    if (!initial.evidence_note && d.evidence) setEvidence(d.evidence);
    if (initial.lng === undefined && d.lng !== '') setLng(d.lng);
    if (initial.lat === undefined && d.lat !== '') setLat(d.lat);
  }, [draftKey, initial]);

  /* 有 draftKey 才落草稿，每次输入同步写（与投稿草稿同一做法），跳去地图选点的路上不丢字。 */
  useEffect(() => {
    if (!draftKey || closed.current) return;
    const d: FormDraft = { name, branch, address, floor, cuisines, evidence, lng, lat };
    const hasAny =
      d.name !== '' ||
      d.branch !== '' ||
      d.address !== '' ||
      d.floor !== '' ||
      d.cuisines.length > 0 ||
      d.evidence !== '' ||
      d.lng !== '' ||
      d.lat !== '';
    try {
      if (hasAny) localStorage.setItem(draftKey, JSON.stringify(d));
      else localStorage.removeItem(draftKey);
    } catch {
      /* 本机没有存储权限时只是不能恢复，不影响提交 */
    }
  }, [draftKey, name, branch, address, floor, cuisines, evidence, lng, lat]);

  function clearDraft(): void {
    closed.current = true;
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* 忽略 */
    }
  }

  const coordErr = fieldErrors.lng_lat ?? fieldErrors.lng ?? fieldErrors.lat ?? local;

  function toggle(cuisine: Cuisine): void {
    setCuisines((cur) => (cur.includes(cuisine) ? cur.filter((c) => c !== cuisine) : [...cur, cuisine].slice(0, 3)));
  }

  function submit(): void {
    if (lng.trim() === '' || lat.trim() === '') {
      setLocal('请先选位置：回地图页点一下空白处，选「在这里新增门店」带坐标进来；确实知道坐标时也可以在下面手填。');
      return;
    }
    setLocal(null);
    clearDraft();
    onSubmit({
      name: name.trim(),
      branch: branch.trim() === '' ? null : branch.trim(),
      address: address.trim(),
      floor_info: floor.trim() === '' ? null : floor.trim(),
      cuisines,
      lng: Number(lng),
      lat: Number(lat),
      source: initial.source ?? 'manual_point',
      provider: initial.provider ?? null,
      poi_id: initial.poi_id ?? null,
      evidence_note: evidence.trim(),
    });
  }

  return (
    <div className="panel">
      <h2>{title}</h2>
      <p className="hint">
        提交后这家店会以「地点待核验」的状态进入库，只出现在显式开启的待验证图层，不代表平台推荐。
        审核员核验地点、确认营业与风险状态之后，它才可能凭社区票或编辑背书进入好店地图。
      </p>
      <label className="field">
        <span className="label">门店名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：某某酸汤鱼" />
        <Err msg={fieldErrors.name} />
      </label>
      <label className="field">
        <span className="label">分店（可留空）</span>
        <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="例如：望京店" />
        <Err msg={fieldErrors.branch} />
      </label>
      <label className="field">
        <span className="label">地址</span>
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="写到门牌号，便于审核定位" />
        <Err msg={fieldErrors.address} />
      </label>
      <label className="field">
        <span className="label">楼层（可留空）</span>
        <input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="例如：3 层 305" />
        <Err msg={fieldErrors.floor_info} />
      </label>
      <div className="field">
        <span className="label">菜系（最多 3 个）</span>
        <div className="chips" role="group" aria-label="菜系标签">
          {CUISINES.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${cuisines.includes(c) ? 'active' : ''}`}
              aria-pressed={cuisines.includes(c)}
              onClick={() => toggle(c)}
            >
              {CUISINE_LABEL[c]}
            </button>
          ))}
        </div>
        <Err msg={fieldErrors.cuisines} />
      </div>
      <div className="field">
        <span className="label">位置（GCJ-02 经纬度）</span>
        <button
          type="button"
          className="btn small plain"
          aria-expanded={mapOpen}
          aria-controls="candidate-picker-map"
          onClick={() => setMapOpen((o) => !o)}
        >
          {mapOpen ? '收起选点地图' : '在地图上选点'}
        </button>
        {mapOpen && (
          <div className="picker-map" id="candidate-picker-map">
            <MapView
              engine="maplibre"
              variant="picker"
              canvasLabel="选点地图：聚焦后可用方向键移动、加号与减号缩放；选点请用鼠标或触屏点击地图，坐标会自动填入下方输入框。"
              entities={[]}
              loading={false}
              error={null}
              selectedId={null}
              userLocation={null}
              insets={{ bottom: 0 }}
              initialViewport={pickerViewport}
              fitSignal={0}
              focusRequest={null}
              onSelectRestaurant={() => {}}
              onSelectCluster={() => {}}
              onMapPoint={pickOnMap}
              onViewportChange={() => {}}
              onRequestLocation={() => {}}
              onRetry={() => {}}
              onChangeEngine={() => {}}
            />
          </div>
        )}
        <div className="btn-row">
          <input
            type="number"
            step="0.00001"
            value={lng}
            aria-label="经度"
            placeholder="经度，例如 116.47"
            onChange={(e) => setLng(e.target.value)}
            style={{ maxWidth: 150 }}
          />
          <input
            type="number"
            step="0.00001"
            value={lat}
            aria-label="纬度"
            placeholder="纬度，例如 39.99"
            onChange={(e) => setLat(e.target.value)}
            style={{ maxWidth: 150 }}
          />
        </div>
        <p className="hint">
          {lng.trim() !== '' && lat.trim() !== ''
            ? `已选位置 ${lng}, ${lat}，可直接在输入框微调，或再次点击地图更换。`
            : '点击地图任意位置，坐标会自动填进输入框；也可以直接手填。'}
          坐标口径为 GCJ-02；第三方真实地点检索还没接（缺高德 Key），这里的坐标只用于演示核验流程，
          不是任何真实门店的位置。
        </p>
        <Err msg={coordErr} />
      </div>
      <label className="field">
        <span className="label">信息来源（你从哪知道这家店）</span>
        <textarea
          rows={3}
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="例如：10 月在合生 3 楼新开的店面，招牌写凯里酸汤鱼；不是自己也不是店员。"
        />
        <Err msg={fieldErrors.evidence_note} />
      </label>
      <div className="btn-row">
        <button className="btn" type="button" disabled={busy} onClick={submit}>
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn small plain" type="button" disabled={busy} onClick={onCancel}>
            取消
          </button>
        )}
      </div>
      <Err msg={fieldErrors.source} />
      <Err msg={fieldErrors.poi_id} />
    </div>
  );
}
