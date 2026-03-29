#!/bin/bash

# 本地测试脚本
# 自动启动测试服务 → 运行测试 → 清理服务

set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_TAG='[test.sh]'

log_info() {
  echo -e "${BLUE}${SCRIPT_TAG} [INFO] $*${NC}"
}

log_warn() {
  echo -e "${YELLOW}${SCRIPT_TAG} [WARN] $*${NC}"
}

log_ok() {
  echo -e "${GREEN}${SCRIPT_TAG} [OK] $*${NC}"
}

log_error() {
  echo -e "${RED}${SCRIPT_TAG} [ERROR] $*${NC}"
}

on_error() {
  local exit_code=$?
  log_error "执行失败，退出码=${exit_code}。"
  exit "$exit_code"
}

trap on_error ERR

log_info "共鸣阅读 - 本地测试"

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.test.yml"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  log_error "未检测到 Docker Compose，请安装 Docker Desktop 或 docker-compose 插件。"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  log_error "未检测到 Docker，请先安装并启动 Docker Desktop / Docker Engine。"
  echo -e "   参考：https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  log_error "未检测到 pnpm，请先执行 corepack enable 或安装 pnpm。"
  exit 1
fi

# 清理函数
cleanup() {
  log_info "正在清理测试环境..."
  $COMPOSE_CMD -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
  log_ok "清理完成。"
}

# 捕获错误并清理
trap cleanup EXIT

# 步骤 1: 启动测试服务
log_info "[1/4] 启动测试服务 (PostgreSQL + Redis + Qdrant)..."

if ! docker info >/dev/null 2>&1; then
  log_error "Docker 无法访问（daemon 未启动或无权限）。请确保 Docker 已启动并且当前用户有权限运行 docker。"
  exit 1
fi

$COMPOSE_CMD -f "$COMPOSE_FILE" up -d >/dev/null 2>&1 || {
  log_error "启动 docker compose 服务失败，请查看 docker-compose.test.yml 配置并手动运行。";
  exit 1;
}

# 等待服务就绪
log_info "等待服务启动..."
sleep 10

# 检查服务状态
if ! $COMPOSE_CMD -f "$COMPOSE_FILE" ps | grep -q "healthy\|Up"; then
  log_error "服务启动失败。"
  exit 1
fi
log_ok "服务已就绪。"

# 初始化测试数据库表结构
log_info "[2/4] 初始化测试数据库..."
docker exec collab-postgres-test psql -U admin -d collab_comments_test -c "
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
" >/dev/null 2>&1

# 读取并执行项目初始化 SQL
if [ -f "docker/postgres/init.sql" ]; then
  docker exec -i collab-postgres-test psql -U admin -d collab_comments_test < docker/postgres/init.sql >/dev/null 2>&1
fi
log_ok "数据库表已创建。"

# 步骤 3: 设置测试环境变量
log_info "[3/4] 配置测试环境..."
export DATABASE_URL=postgresql://admin:testpassword@localhost:5433/collab_comments_test
export REDIS_URL=redis://localhost:6380
export QDRANT_URL=http://localhost:6334
export JWT_SECRET=test-jwt-secret-for-local-testing-min-32-chars
export FRONTEND_URL=http://localhost:5173
export SMTP_HOST=smtp.example.com
export SMTP_USER=test@example.com
export SMTP_PASS=testpassword
log_ok "环境变量已配置。"

# 步骤 4: 运行测试
log_info "[4/4] 运行测试..."

# 检查是否指定了特定测试文件
if [ -n "${1:-}" ]; then
  log_info "运行指定测试：$1"
  pnpm --filter @collab/api test -- "$1"
else
  log_info "运行所有测试..."
  pnpm --filter @collab/api test
fi

TEST_EXIT_CODE=$?
# 显示结果
if [ $TEST_EXIT_CODE -eq 0 ]; then
  log_ok "测试全部通过。"
else
  log_error "部分测试失败（查看上方详情）。"
fi

log_warn "测试流程结束，准备退出。"

# 退出码传递给调用者
exit $TEST_EXIT_CODE
