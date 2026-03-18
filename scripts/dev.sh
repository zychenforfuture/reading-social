#!/bin/bash

# 本地开发混合模式脚本：启动 Docker 基础设施 + 本地 API/Worker/Web 进程

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.yml"
ENV_FILE="${ENV_FILE:-.env}"

YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

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
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${RED}✗ 未检测到 pnpm，请先执行 corepack enable 或安装 pnpm。${NC}"
  exit 1
fi

usage() {
  cat <<EOF
用法：$0 {up|infra|down|logs|status}

命令说明：
  up       启动混合模式（Docker 基础设施 + 本地 API/Worker/Web 进程）
  infra    仅启动基础设施容器（PostgreSQL + Redis + Qdrant）
  down     停止基础设施容器
  logs     查看基础设施日志（按 Ctrl+C 退出）
  status   查看基础设施容器状态

可选环境变量：
  ENV_FILE    指定环境变量文件（默认：.env）
EOF
}

ensure_env_file() {
  if [ -f "$ENV_FILE" ]; then
    return
  fi

  if [ -f ".env.example" ]; then
    echo -e "${YELLOW}未找到 $ENV_FILE，正在从 .env.example 复制模板...${NC}"
    cp .env.example "$ENV_FILE"
    echo -e "${YELLOW}已生成 $ENV_FILE，请根据实际配置修改后重新运行。${NC}"
  else
    echo -e "${RED}✗ 未找到 $ENV_FILE，且缺少 .env.example 模板。${NC}"
  fi
  exit 1
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

start_infra() {
  echo -e "${YELLOW}启动基础设施容器 (postgres + redis + qdrant)...${NC}"
  $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis qdrant
  echo -e "${GREEN}✓ 基础设施已启动${NC}"
}

stop_infra() {
  echo -e "${YELLOW}停止基础设施容器...${NC}"
  $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop postgres redis qdrant >/dev/null 2>&1 || true
  $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" rm -f postgres redis qdrant >/dev/null 2>&1 || true
  echo -e "${GREEN}✓ 基础设施已停止${NC}"
}

infra_status() {
  $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps postgres redis qdrant
}

infra_logs() {
  $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f postgres redis qdrant
}

pids=()

stop_processes() {
  if [ "${#pids[@]}" -gt 0 ]; then
    echo -e "${YELLOW}停止本地开发进程...${NC}"
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill "$pid" >/dev/null 2>&1 || true
      fi
    done
    for pid in "${pids[@]}"; do
      wait "$pid" >/dev/null 2>&1 || true
    done
  fi
  trap - INT TERM
}

run_app_processes() {
  echo -e "${YELLOW}启动本地 API / Worker / Web 进程...${NC}"
  pnpm --filter @collab/api dev &
  pids+=($!)
  pnpm --filter @collab/worker dev &
  pids+=($!)
  pnpm --filter @collab/web dev &
  pids+=($!)

  trap stop_processes INT TERM
  wait -n "${pids[@]}"
  exit_code=$?
  stop_processes
  echo -e "${YELLOW}本地进程已退出。如需停止容器，请执行 ./scripts/dev.sh down。${NC}"
  exit "$exit_code"
}

case "${1:-}" in
  up)
    ensure_env_file
    load_env
    start_infra
    run_app_processes
    ;;
  infra)
    ensure_env_file
    load_env
    start_infra
    infra_status
    ;;
  down)
    ensure_env_file
    load_env
    stop_infra
    ;;
  logs)
    ensure_env_file
    load_env
    infra_logs
    ;;
  status)
    ensure_env_file
    load_env
    infra_status
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
