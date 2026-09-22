import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/app.css';
import { App } from './app/App';
import { ApiProvider } from './data/api';

const basename = import.meta.env.BASE_URL || '/';

/** 静态托管没有 SPA 回退时，404.html 会把原始路径交回这里。 */
try {
  const fallback = sessionStorage.getItem('qianwei.fallback');
  if (fallback) {
    sessionStorage.removeItem('qianwei.fallback');
    const clean = basename.replace(/\/$/, '');
    window.history.replaceState(null, '', clean + (fallback === '/' ? '/' : fallback));
  }
} catch {
  /* 无法读写会话存储时按当前地址启动 */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </ApiProvider>
  </StrictMode>,
);
