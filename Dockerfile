# 京城黔味地图 demo 后端镜像。
#
# 这是演示镜像，不是生产镜像：NODE_ENV 保持 development，因为 Store 在 production
# 下会拒绝装载合成测试种子（无真实核验数据源时启动必然失败，见 docs/runbooks/deploy-api.md）。
# 运行时无构建步骤：后端只用 node:http + 内置 node:sqlite + tsx 直跑 TS 源码。

FROM node:24-slim AS install
WORKDIR /repo

# 只拷贝 manifest，依赖不变时这一层可被缓存复用
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# --omit=dev：运行只需要 tsx（apps/api 的 dependencies），typescript/vitest 属于 devDeps
RUN npm ci --omit=dev && npm cache clean --force


FROM node:24-slim
WORKDIR /repo

ENV PORT=8080 \
    HOST=0.0.0.0 \
    SQLITE_PATH=/data/demo.sqlite

COPY --from=install /repo/node_modules ./node_modules
COPY package.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
COPY database/migrations ./database/migrations

# 非 root 运行；SQLite 目录必须可写（WAL 需要同目录写权限）
RUN mkdir -p /data && chown -R node:node /data /repo
USER node

EXPOSE 8080
VOLUME ["/data"]

# slim 镜像没有 curl，用 Node 自带的 fetch 做探针
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'8080')+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 直接走 tsx 的 CLI，避免 npm 包装层吞掉 SIGTERM（index.ts 注册了优雅关闭）
CMD ["node", "node_modules/tsx/dist/cli.mjs", "apps/api/src/index.ts"]
