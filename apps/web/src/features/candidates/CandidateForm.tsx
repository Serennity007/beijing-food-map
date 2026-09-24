/**
 * 建店与补材料共用的表单。字段上限只是形状提示，真正的边界（北京范围、菜系枚举、
 * 信息来源长度、重复门店判定）全部由引擎判，页面只把返回的字段错误定位回去。
 */
import { useState } from 'react';
import { CUISINES, CUISINE_LABEL, type CandidateFacts, type Cuisine } from '@qianwei/contracts';

interface Props {
  initial: Partial<CandidateFacts>;
  fieldErrors?: Record<string, string>;
  busy?: boolean;
  title?: string;
  submitLabel: string;
  onSubmit: (facts: CandidateFacts) => void;
  onCancel?: () => void;
}

function Err({ msg }: { msg: string | null | undefined }) {
  if (!msg) return null;
  return <span className="err">{msg}</span>;
}

export function CandidateForm({ initial, fieldErrors = {}, busy = false, title = '新建门店申请', submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial.name ?? '');
  const [branch, setBranch] = useState(initial.branch ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [floor, setFloor] = useState(initial.floor_info ?? '');
  const [cuisines, setCuisines] = useState<Cuisine[]>(initial.cuisines ?? []);
  const [lng, setLng] = useState(initial.lng === undefined ? '' : String(initial.lng));
  const [lat, setLat] = useState(initial.lat === undefined ? '' : String(initial.lat));
  const [evidence, setEvidence] = useState(initial.evidence_note ?? '');
  const [local, setLocal] = useState<string | null>(null);

  const coordErr = fieldErrors.lng_lat ?? fieldErrors.lng ?? fieldErrors.lat ?? local;

  function toggle(cuisine: Cuisine): void {
    setCuisines((cur) => (cur.includes(cuisine) ? cur.filter((c) => c !== cuisine) : [...cur, cuisine].slice(0, 3)));
  }

  function submit(): void {
    if (lng.trim() === '' || lat.trim() === '') {
      setLocal('请填写经纬度（GCJ-02）。没有地图选点前先手填，坐标可在门店页看到。');
      return;
    }
    setLocal(null);
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
        <span className="label">坐标（GCJ-02 经纬度）</span>
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
          可以从地图页点一下空白处带进来（推荐），也可以手填。坐标口径是 GCJ-02；
          第三方真实地点检索还没接（缺高德 Key），所以这里的坐标只用于演示核验流程，不是任何真实门店的位置。
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
