#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="${ENV_FILE:-.env.production}"

echo "=========================================="
echo "  跨文档协同评论系统 - Docker 部署脚本"
echo "=========================================="

# 确定 compose 命令
if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  echo "错误：未检测到 Docker Compose，请安装 Docker Desktop 或 docker-compose 插件。"
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
    echo "错误：未找到生产环境配置文件 $ENV_FILE"
    if [ -f ".env.production.example" ]; then
      echo "提示：可执行 cp .env.production.example $ENV_FILE 并按需修改。"
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
    echo "错误：以下环境变量未设置：${missing[*]}"
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
    echo "构建并启动全量 Docker 服务..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    echo "服务启动中，可用以下命令查看状态或日志："
    echo "  ./scripts/deploy.sh status"
    echo "  ./scripts/deploy.sh logs"
    ;;
  down)
    ensure_env_ready
    echo "停止并移除服务容器（保留数据卷）..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans
    ;;
  restart)
    ensure_env_ready
    echo "重启服务..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    ;;
  rebuild)
    ensure_env_ready
    echo "重新构建镜像..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
    echo "启动服务..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    ;;
  logs)
    ensure_env_ready
    echo "查看服务日志（按 Ctrl+C 退出）..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs -f
    ;;
  status)
    ensure_env_ready
    $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    ;;
  db-backup)
    ensure_env_ready
    PG_CONTAINER="$(postgres_container_id)"
    if [ -z "$PG_CONTAINER" ]; then
      echo "错误：PostgreSQL 容器未运行，无法备份。请先执行 ./scripts/deploy.sh up"
      exit 1
    fi
    BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
    echo "备份数据库到 $BACKUP_FILE ..."
    docker exec "$PG_CONTAINER" pg_dump -U admin collab_comments > "$BACKUP_FILE"
    echo "备份完成：$BACKUP_FILE"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

echo "完成！"
