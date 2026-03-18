#!/bin/bash

# 本地测试脚本
# 自动启动测试服务 → 运行测试 → 清理服务

set -euo pipefail

echo "========================================"
echo "  共鸣阅读 - 本地测试"
echo "========================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.test.yml"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo -e "${RED}✗ 未检测到 Docker Compose，请安装 Docker Desktop 或 docker-compose 插件。${NC}"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo -e "${RED}✗ 未检测到 Docker，请先安装并启动 Docker Desktop / Docker Engine。${NC}"
  echo -e "   参考：https://docs.docker.com/get-docker/"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${RED}✗ 未检测到 pnpm，请先执行 corepack enable 或安装 pnpm。${NC}"
  exit 1
fi

# 清理函数
cleanup() {
  echo ""
  echo -e "${YELLOW}正在清理测试环境...${NC}"
  $COMPOSE_CMD -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
  echo -e "${GREEN}✓ 清理完成${NC}"
}

# 捕获错误并清理
trap cleanup EXIT

# 步骤 1: 启动测试服务
echo -e "${YELLOW}[1/4] 启动测试服务 (PostgreSQL + Redis + Qdrant)...${NC}"

if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}✗ Docker 无法访问（daemon 未启动或无权限）。请确保 Docker 已启动并且当前用户有权限运行 docker。${NC}"
  exit 1
fi

$COMPOSE_CMD -f "$COMPOSE_FILE" up -d >/dev/null 2>&1 || {
  echo -e "${RED}✗ 启动 docker compose 服务失败，请查看 docker-compose.test.yml 配置并手动运行。${NC}";
  exit 1;
}

# 等待服务就绪
echo -e "${YELLOW}      等待服务启动...${NC}"
sleep 10

# 检查服务状态
if ! $COMPOSE_CMD -f "$COMPOSE_FILE" ps | grep -q "healthy\|Up"; then
  echo -e "${RED}✗ 服务启动失败${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 服务已就绪${NC}"
echo ""

# 初始化测试数据库表结构
echo -e "${YELLOW}[2/4] 初始化测试数据库...${NC}"
docker exec collab-postgres-test psql -U admin -d collab_comments_test -c "
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
" >/dev/null 2>&1

# 读取并执行项目初始化 SQL
if [ -f "docker/postgres/init.sql" ]; then
  docker exec -i collab-postgres-test psql -U admin -d collab_comments_test < docker/postgres/init.sql >/dev/null 2>&1
fi
echo -e "${GREEN}✓ 数据库表已创建${NC}"
echo ""

# 步骤 3: 设置测试环境变量
echo -e "${YELLOW}[3/4] 配置测试环境...${NC}"
export DATABASE_URL=postgresql://admin:testpassword@localhost:5433/collab_comments_test
export REDIS_URL=redis://localhost:6380
export QDRANT_URL=http://localhost:6334
export JWT_SECRET=test-jwt-secret-for-local-testing-min-32-chars
export FRONTEND_URL=http://localhost:5173
export SMTP_HOST=smtp.example.com
export SMTP_USER=test@example.com
export SMTP_PASS=testpassword
echo -e "${GREEN}✓ 环境变量已配置${NC}"
echo ""

# 步骤 4: 运行测试
echo -e "${YELLOW}[4/4] 运行测试...${NC}"
echo ""

# 检查是否指定了特定测试文件
if [ -n "${1:-}" ]; then
  echo -e "${YELLOW}      运行指定测试：$1${NC}"
  pnpm --filter @collab/api test -- "$1"
else
  echo -e "${YELLOW}      运行所有测试...${NC}"
  pnpm --filter @collab/api test
fi

TEST_EXIT_CODE=$?
echo ""

# 显示结果
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}========================================"
  echo "  ✓ 测试全部通过！"
  echo -e "========================================${NC}"
else
  echo -e "${RED}========================================"
  echo "  ✗ 部分测试失败（查看上方详情）"
  echo -e "========================================${NC}"
fi

echo ""
echo -e "${YELLOW}正在清理测试环境...${NC}"

# 退出码传递给调用者
exit $TEST_EXIT_CODE
