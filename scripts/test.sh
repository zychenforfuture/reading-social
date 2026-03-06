#!/bin/bash

# 本地测试脚本
# 自动启动测试服务 → 运行测试 → 清理服务

set -e

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

# 清理函数
cleanup() {
  echo ""
  echo -e "${YELLOW}正在清理测试环境...${NC}"
  docker compose -f docker-compose.test.yml down > /dev/null 2>&1
  echo -e "${GREEN}✓ 清理完成${NC}"
}

# 捕获错误并清理
trap cleanup EXIT

# 步骤 1: 启动测试服务
echo -e "${YELLOW}[1/4] 启动测试服务 (PostgreSQL + Redis + Qdrant)...${NC}"
docker compose -f docker-compose.test.yml up -d > /dev/null 2>&1

# 等待服务就绪
echo -e "${YELLOW}      等待服务启动...${NC}"
sleep 8

# 检查服务状态
if ! docker compose -f docker-compose.test.yml ps | grep -q "healthy\|Up"; then
  echo -e "${RED}✗ 服务启动失败${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 服务已就绪${NC}"
echo ""

# 步骤 2: 设置测试环境变量
echo -e "${YELLOW}[2/4] 配置测试环境...${NC}"
export NODE_ENV=test
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

# 步骤 3: 运行测试
echo -e "${YELLOW}[3/4] 运行测试...${NC}"
echo ""

# 检查是否指定了特定测试文件
if [ -n "$1" ]; then
  echo -e "${YELLOW}      运行指定测试：$1${NC}"
  pnpm --filter @collab/api test -- "$1"
else
  echo -e "${YELLOW}      运行所有测试...${NC}"
  pnpm --filter @collab/api test
fi

TEST_EXIT_CODE=$?
echo ""

# 步骤 4: 显示结果
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}========================================"
  echo "  ✓ 测试全部通过！"
  echo -e "========================================${NC}"
else
  echo -e "${RED}========================================"
  echo "  ✗ 测试失败"
  echo -e "========================================${NC}"
fi

echo ""
echo -e "${YELLOW}[4/4] 测试完成，自动清理环境...${NC}"

# 退出码传递给调用者
exit $TEST_EXIT_CODE
