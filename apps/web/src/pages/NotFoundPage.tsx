import { Link } from 'react-router-dom';
import { StatusBlock } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page page-narrow">
      <StatusBlock
        kind="error"
        message="链接可能已经失效，或者清单分享已被作者撤销。私密内容对未授权访客也显示同样结果，避免泄露它是否存在。"
        action={
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Link className="btn small" to="/map">
              回到地图
            </Link>
            <Link className="btn small plain" to="/me/collections">
              我的地图
            </Link>
          </div>
        }
      />
    </div>
  );
}
