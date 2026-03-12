#!/bin/bash

# 开发环境停止脚本
# 停止所有开发进程和 Docker 服务

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🛑 停止开发环境..."

# 停止 Node.js 开发进程
echo "⏹️  停止 API 服务..."
if [ -f "/tmp/reading-social-api.pid" ]; then
    API_PID=$(cat /tmp/reading-social-api.pid)
    if kill -0 "$API_PID" 2>/dev/null; then
        kill "$API_PID" 2>/dev/null || true
        echo "   ✅ API 进程已停止 (PID: $API_PID)"
    else
        echo "   ⚠️  API 进程未运行"
    fi
    rm -f /tmp/reading-social-api.pid
else
    # 尝试通过进程名停止
    pkill -f "packages/api" 2>/dev/null && echo "   ✅ API 进程已停止" || echo "   ⚠️  未找到 API 进程"
fi

echo "⏹️  停止 Web 服务..."
if [ -f "/tmp/reading-social-web.pid" ]; then
    WEB_PID=$(cat /tmp/reading-social-web.pid)
    if kill -0 "$WEB_PID" 2>/dev/null; then
        kill "$WEB_PID" 2>/dev/null || true
        echo "   ✅ Web 进程已停止 (PID: $WEB_PID)"
    else
        echo "   ⚠️  Web 进程未运行"
    fi
    rm -f /tmp/reading-social-web.pid
else
    # 尝试通过进程名停止
    pkill -f "packages/web" 2>/dev/null && echo "   ✅ Web 进程已停止" || echo "   ⚠️  未找到 Web 进程"
fi

# 停止 Docker 服务
echo "🐳 停止 Docker 基础设施..."
docker compose -f docker-compose.test.yml down
echo "   ✅ Docker 服务已停止"

# 清理临时文件
echo "🧹 清理临时文件..."
rm -f /tmp/reading-social-*.pid

echo ""
echo "✅ 开发环境已完全停止"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 提示:"
echo "   - 查看残留进程：ps aux | grep -E 'api|web|vite|tsx'"
echo "   - 查看 Docker 容器：docker ps -a"
echo "   - 重新启动：./scripts/dev.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
