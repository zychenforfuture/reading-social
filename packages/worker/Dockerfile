FROM node:20 AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/worker/package.json ./packages/worker/package.json
RUN pnpm install --frozen-lockfile

COPY packages/worker ./packages/worker
RUN pnpm --filter @collab/worker build

# 生产阶段
FROM node:20

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/worker/package.json ./packages/worker/package.json
RUN pnpm install --filter @collab/worker --prod

COPY --from=builder /app/packages/worker/dist ./packages/worker/dist

CMD ["node", "packages/worker/dist/index.js"]
