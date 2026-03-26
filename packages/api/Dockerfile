FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY packages/api/package.json ./packages/api/package.json
# Allow un-frozen install to pick up db-migrate changes
RUN pnpm install

COPY packages/types ./packages/types
COPY packages/api ./packages/api

RUN pnpm --filter @collab/types build
RUN pnpm --filter @collab/api build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/types/package.json ./packages/types/package.json
COPY packages/api/package.json ./packages/api/package.json
RUN pnpm install --filter @collab/api... --prod

COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/migrations ./packages/api/migrations
COPY --from=builder /app/packages/api/database.json ./packages/api/database.json
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json

EXPOSE 3000

CMD ["sh", "-c", "cd packages/api && pnpm run db:migrate && cd ../.. && node packages/api/dist/index.js"]
