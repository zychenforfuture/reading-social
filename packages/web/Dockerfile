# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 声明构建参数 (生产 Docker 部署时 API 通过 nginx 代理 /api/ 路径)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# 复制 package.json
COPY package.json ./

# 安装所有依赖（包括 devDependencies）
RUN pnpm install

# 复制源代码
COPY . .

# 构建
RUN pnpm build

# 生产阶段
FROM nginx:alpine

# 复制构建好的静态文件
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 启动 nginx（使用默认配置，前端通过 VITE_API_URL 代理到 API）
CMD ["nginx", "-g", "daemon off;"]
