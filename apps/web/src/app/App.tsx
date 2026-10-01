import { Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApi } from '../data/api';
import { MapPage } from '../pages/MapPage';
import { RestaurantPage } from '../pages/RestaurantPage';
import { LoginPage } from '../pages/LoginPage';
import { SubmitPage } from '../pages/SubmitPage';
import { MePage } from '../pages/MePage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { CollectionEditPage } from '../pages/CollectionEditPage';
import { SharedPage } from '../pages/SharedPage';
import { AdminPage } from '../pages/AdminPage';
import { LegalPage } from '../pages/LegalPage';
import { NotFoundPage } from '../pages/NotFoundPage';

const TABS = [
  { to: '/map', label: '逛地图', icon: '◎' },
  { to: '/submit', label: '推荐好店', icon: '✎' },
  { to: '/me/collections', label: '我的地图', icon: '★' },
];

export function App() {
  const { user, demoBadge, signOut, seedProfile } = useApi();
  const loc = useLocation();
  const onMap = loc.pathname.startsWith('/map');

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="topbar">
        <Link className="brand" to="/map">
          <span className="brand-mark" aria-hidden="true">黔</span>
          <span className="brand-text">
            <strong>京城黔味地图</strong>
            <small>北京 · 贵州菜与西南风味</small>
          </span>
        </Link>
        <span className="demo-badge" title="所有餐馆、实吃与票数均为合成测试数据">
          {demoBadge}
        </span>
        <nav className="topnav">
          {user ? (
            <>
              <span className="who" title="当前为内测邀请账号">
                {user.display_name}
                {user.roles.some((r) => r !== 'user') ? `（${user.roles.filter((r) => r !== 'user').join('/')}）` : ''}
              </span>
              <Link to="/me">我的</Link>
              <button className="link-btn" type="button" onClick={() => void signOut()}>
                退出
              </button>
            </>
          ) : (
            <Link to="/login">登录</Link>
          )}
        </nav>
      </header>

      <main className="main" id="main" tabIndex={-1}>
        <Suspense fallback={<div className="page-loading">加载中…</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/map" replace />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/restaurants/:id" element={<RestaurantPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/me" element={<MePage />} />
            <Route path="/me/collections" element={<CollectionsPage />} />
            <Route path="/me/collections/:id" element={<CollectionEditPage />} />
            <Route path="/s/:token" element={<SharedPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>

      <nav className="tabbar" aria-label="主入口">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={loc.pathname.startsWith(t.to) ? 'active' : ''}>
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>

      <footer className={onMap ? 'footer footer-map' : 'footer'}>
        <Link to="/privacy">隐私</Link>
        <Link to="/terms">用户条款</Link>
        <Link to="/admin">内容后台</Link>
        <span>
          {seedProfile === 'real'
            ? '预览版：门店与地址来自公开资料，坐标为区域估算、待实地核验；推荐票数将来自真实用户的实吃投稿。'
            : '演示版本：门店、图片、实吃记录与票数全部为合成测试数据，不代表任何真实餐馆。'}
        </span>
      </footer>
    </div>
  );
}
