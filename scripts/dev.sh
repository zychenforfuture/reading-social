#!/bin/bash

# 开发环境启动脚本
# 一键启动 Docker 基础设施 + API + Web 开发服务

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 启动开发环境..."

# 检查 Docker 是否运行
if ! docker info &>/dev/null; then
    echo "❌ Docker 未运行，请先启动 Docker"
    exit 1
fi

# 检查 pnpm 是否安装
if ! command -v pnpm &>/dev/null; then
    echo "❌ pnpm 未安装，请先安装 pnpm: npm install -g pnpm"
    exit 1
fi

# 启动基础设施 (PostgreSQL + Redis + Qdrant)
echo "🐳 启动 Docker 基础设施..."
docker compose -f docker-compose.test.yml up -d

# 等待服务就绪
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务健康状态
echo "🔍 检查服务健康状态..."
docker compose -f docker-compose.test.yml ps

# 加载开发环境变量
if [ -f ".env.development" ]; then
    echo "📋 加载开发环境变量..."
    export $(cat .env.development | grep -v '^#' | xargs)
else
    echo "⚠️  .env.development 不存在，使用默认配置"
fi

# 启动 API 服务 (后台运行)
echo "🔌 启动 API 服务..."
cd packages/api
pnpm dev > ../../logs/api.log 2>&1 &
API_PID=$!
cd ..

# 启动 Web 服务 (后台运行)
echo "📱 启动 Web 服务..."
cd packages/web
pnpm dev > ../../logs/web.log 2>&1 &
WEB_PID=$!
cd ..

# 创建 logs 目录
mkdir -p logs

echo ""
echo "✅ 开发环境就绪！"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Web:  http://localhost:5173"
echo "🔌 API:  http://localhost:3000"
echo "📊 API Swagger: http://localhost:3000/api/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 日志文件:"
echo "   API: $PROJECT_ROOT/logs/api.log"
echo "   Web: $PROJECT_ROOT/logs/web.log"
echo ""
echo "🛑 停止开发环境：./scripts/dev-stop.sh"
echo ""
echo "进程 ID:"
echo "   API PID: $API_PID"
echo "   Web PID: $WEB_PID"
echo ""

# 保存进程 ID 以便停止脚本使用
echo "$API_PID" > /tmp/reading-social-api.pid
echo "$WEB_PID" > /tmp/reading-social-web.pid

# 监听日志 (可选，按 Ctrl+C 停止监听但保持服务运行)
echo "📖 实时日志输出 (Ctrl+C 停止监听，服务继续运行)..."
echo ""
tail -f logs/api.log logs/web.log 2>/dev/null || true
