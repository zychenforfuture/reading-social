#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-.env.production}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_TAG='[deploy.sh]'

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

log_info "跨文档协同评论系统 - Docker 部署脚本"

# 确定 compose 命令
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  log_error "未检测到 Docker Compose，请安装 Docker Desktop 或 docker-compose 插件。"
  exit 1
fi

usage() {
  cat <<EOF
用法：$0 {up|down|restart|rebuild|logs|status|db-backup}

环境变量：
  ENV_FILE        指定生产环境变量文件路径（默认：.env.production）

命令说明：
  up         构建并启动全量 Docker 服务
  down       停止并移除服务容器（不移除数据卷）
  restart    重启服务
  rebuild    强制重新构建镜像后启动
  logs       查看服务日志（跟随）
  status     查看服务状态
  db-backup  备份数据库到 backup-YYYYmmdd-HHMMSS.sql
EOF
}

require_env() {
  if [ ! -f "$ENV_FILE" ]; then
    log_error "未找到生产环境配置文件 $ENV_FILE"
    if [ -f ".env.production.example" ]; then
      log_warn "可执行 cp .env.production.example $ENV_FILE 并按需修改。"
    fi
    exit 1
  fi
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

check_required_env() {
  local missing=()
  for key in DB_PASSWORD REDIS_PASSWORD JWT_SECRET FRONTEND_URL; do
    if [ -z "${!key:-}" ]; then
      missing+=("$key")
    fi
  done

  if [ "${#missing[@]}" -ne 0 ]; then
    log_error "以下环境变量未设置：${missing[*]}"
    exit 1
  fi
}

ensure_env_ready() {
  require_env
  load_env
  check_required_env
}

postgres_container_id() {
  $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q postgres
}

case "${1:-}" in
  up)
    ensure_env_ready
    log_info "构建并启动全量 Docker 服务..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    log_ok "服务已启动，可用 status/logs 查看详情。"
    ;;
  down)
    ensure_env_ready
    log_info "停止并移除服务容器（保留数据卷）..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans
    log_ok "服务已停止。"
    ;;
  restart)
    ensure_env_ready
    log_info "重启服务..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    log_ok "服务已重启。"
    ;;
  rebuild)
    ensure_env_ready
    log_info "重新构建镜像..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
    log_info "启动服务..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    log_ok "镜像重建并启动完成。"
    ;;
  logs)
    ensure_env_ready
    log_info "查看服务日志（按 Ctrl+C 退出）..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    ;;
  status)
    ensure_env_ready
    log_info "当前服务状态："
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    ;;
  db-backup)
    ensure_env_ready
    PG_CONTAINER="$(postgres_container_id)"
    if [ -z "$PG_CONTAINER" ]; then
      log_error "PostgreSQL 容器未运行，无法备份。请先执行 ./scripts/deploy.sh up"
      exit 1
    fi
    BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
    log_info "备份数据库到 $BACKUP_FILE ..."
    docker exec "$PG_CONTAINER" pg_dump -U admin collab_comments > "$BACKUP_FILE"
    log_ok "备份完成：$BACKUP_FILE"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

log_ok "命令执行完成。"
