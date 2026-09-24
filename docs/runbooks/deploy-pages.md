# Runbook：部署网页端到 GitHub Pages

Pages 只承载**静态前端**。静态模式下浏览器内跑的是与后端同一份领域引擎（`packages/contracts`），数据写在 `localStorage`，所以 Pages 上不需要任何后端也能演示完整闭环。

## 一次性仓库设置

目标仓库：`https://github.com/Serennity007/beijing-food-map`（public，免费版 Pages 要求 public）。
本地 `origin` 已指向该地址，仓库已提交但**尚未推送**（等 `gh auth login` 完成）。
仓库名决定 `VITE_BASE`，但 workflow 是从 `github.event.repository.name` 推导的，改名不用改文件；只有下面的本地预演命令要跟着换。

1. 仓库 `Settings → Pages → Build and deployment → Source` 选 **GitHub Actions**（不是 "Deploy from a branch"）。
2. `Settings → Actions → General → Workflow permissions` 允许 `Read and write permissions`（或依赖 workflow 里已声明的 `pages: write`）。
3. 推送到 `main` 即触发 `.github/workflows/deploy-web.yml`；也可在 Actions 里手动 `workflow_dispatch`。

## 工作流做了什么

```
npm ci → npm run typecheck → npm test → VITE_BASE=/<仓库名>/ npm run build
       → sed 替换 dist/404.html 的 __BASE__ → upload-pages-artifact(apps/web/dist) → deploy-pages
```

- **测试是发布门禁**：134 项用例（contracts 91 / api 29 / web 14，本轮计数）任一失败就不部署。
- `VITE_BASE` 决定资源前缀与 `BrowserRouter` 的 `basename`；项目页必须是 `/<仓库名>/`，用户站点页留 `/`。
- 深链接回退：Pages 不做 SPA history 回退，`apps/web/public/404.html` 会把原始路径写进 `sessionStorage['qianwei.fallback']` 再跳回应用根，`main.tsx` 用同一路径继续挂载路由。`__BASE__` 由上面的 `sed` 替换成真实公共路径；未替换时脚本会按 URL 首段猜一个兜底值。

## 让它连后端演示 API（可选）

`VITE_API_BASE` 是**构建期**变量，改它必须重新构建：

- 留空 → `StaticClient`（localStorage）。
- 填后端地址，只写 `scheme://host`（例如 `https://qianwei-api-demo.onrender.com`）；`api.tsx` 会归一化为 `<origin>/api/v1`。

同时后端要把 Pages 的 Origin 加进 `ALLOWED_ORIGINS`（Origin 只到域名，不含仓库路径），会话 Cookie 才写得进来。详见 [deploy-api.md](./deploy-api.md)。

在 Actions 里加变量：仓库 `Settings → Secrets and variables → Actions → Variables` 新建 `VITE_API_BASE`，然后把 workflow 的构建步骤改成带 `env: VITE_API_BASE: ${{ vars.VITE_API_BASE }}`。不加该变量时，Pages 就是纯静态演示。

## 自定义域名

`Settings → Pages → Custom domain` 填域名并按提示加 DNS `CNAME`；随后 `VITE_BASE` 要改成 `/`（站点在域名根上），后端的 `ALLOWED_ORIGINS` 加 `https://<你的域名>`。

## 本地预演 Pages 构建

推送前先按工作流的方式构建一次，确认资源前缀与深链接回退都对：

```bash
MSYS_NO_PATHCONV=1 VITE_BASE=/beijing-food-map/ npm run build
sed -i "s|__BASE__|/beijing-food-map/|g" apps/web/dist/404.html
grep -o 'src="[^"]*"' apps/web/dist/index.html | head -1   # 期望 /beijing-food-map/assets/...
grep -o "var base = '[^']*'" apps/web/dist/404.html        # 期望 /beijing-food-map/
```

**Windows + Git Bash 的坑**：不加 `MSYS_NO_PATHCONV=1` 时，MSYS 会把以 `/` 开头的环境变量值当 POSIX 路径转换，`VITE_BASE=/repo/` 会变成 `/program/Git/repo/`，构建出的资源前缀全错。Linux runner（GitHub Actions）没有这个问题，所以这一步只能证明"本地构建可用"，不能替代 CI。

## 推送前：确认源码没被 ignore 规则吞掉

CI 只看得到已经提交的文件，`.gitignore` 写宽了不会让本地构建失败，只会让仓库缺件（缺的文件往往正是跑不起来的那几个）：

```bash
git ls-files --others --exclude-standard          # 期望为空；有输出就是有源码没提交
git ls-files --others --ignored --exclude-standard # 被忽略的未跟踪文件，逐条确认都是产物
```

本项目踩过：规则里裸写一行 `data/` 想忽略演示后端数据库目录，结果连前端的数据层 `apps/web/src/data/`（`api.tsx` / `client.ts` / `http.ts`）一起忽略，前两个提交里根本没有这一层。已改成锚定路径 `/data/` + `apps/api/data/`。

## 验证与回退

- 部署完在 Actions 的 deploy job 日志里读 `Page URL`；浏览器直接访问 `/map`、`/restaurants/R01` 这类深链接并刷新，确认能停在原页面而不是 404。
- 回退：`gh api` 或直接重新运行上一个 commit 的 workflow（Actions → 对应 run → Re-run jobs）。Pages 的 artifact 由 workflow 覆盖，历史 release 里能取回旧构建。
- 注意 Pages 有 CDN 缓存：改了 `404.html` 或 `index.html` 后强刷或等 10 分钟左右。

## 状态与已知边界

上线后仍然只是**演示**：地图底图走公共瓦片（无 Key 时的兜底样式），数据是合成测试数据，账号是预置邀请码 + 固定验证码。见 [../status.md](../status.md) 与 [../blockers.md](../blockers.md)。
