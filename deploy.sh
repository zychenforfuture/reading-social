#!/bin/bash
set -e

echo "=========================================="
echo "  跨文档协同评论系统 - Docker 部署脚本"
echo "=========================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误：Docker 未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "错误：Docker Compose 未安装"
    exit 1
fi

# 确定使用 docker-compose 还是 docker compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# 创建 .env 文件
if [ ! -f .env.production ]; then
    echo "创建生产环境配置文件 .env.production..."
    cat > .env.production << EOF
# 数据库密码 (请修改为强密码)
DB_PASSWORD=YourSecurePassword2026!

# Redis 密码 (请修改为强密码)
REDIS_PASSWORD=YourSecurePassword2026!

# JWT 密钥 (请修改为随机字符串)
JWT_SECRET=YourSuperSecretJWTKey2026!ChangeMe!

# 前端域名
FRONTEND_URL=http://your-domain.com
EOF
    echo "警告：请编辑 .env.production 文件修改默认密码！"
fi

# 读取环境变量
set -a
source .env.production
set +a

case "${1:-}" in
    up)
        echo "启动所有服务..."
        $COMPOSE_CMD -f docker-compose.prod.yml up -d
        echo "等待服务启动..."
        sleep 10
        echo "访问 http://localhost 查看应用"
        ;;
    down)
        echo "停止所有服务..."
        $COMPOSE_CMD -f docker-compose.prod.yml down
        ;;
    restart)
        echo "重启所有服务..."
        $COMPOSE_CMD -f docker-compose.prod.yml down
        $COMPOSE_CMD -f docker-compose.prod.yml up -d
        ;;
    rebuild)
        echo "重新构建并启动..."
        $COMPOSE_CMD -f docker-compose.prod.yml build --no-cache
        $COMPOSE_CMD -f docker-compose.prod.yml up -d
        ;;
    logs)
        echo "查看日志..."
        $COMPOSE_CMD -f docker-compose.prod.yml logs -f
        ;;
    status)
        echo "服务状态:"
        $COMPOSE_CMD -f docker-compose.prod.yml ps
        ;;
    db-backup)
        echo "备份数据库..."
        docker exec collab-postgres pg_dump -U admin collab_comments > backup-$(date +%Y%m%d-%H%M%S).sql
        echo "备份完成"
        ;;
    *)
        echo "用法：$0 {up|down|restart|rebuild|logs|status|db-backup}"
        echo ""
        echo "命令说明:"
        echo "  up       - 启动所有服务"
        echo "  down     - 停止所有服务"
        echo "  restart  - 重启所有服务"
        echo "  rebuild  - 重新构建并启动"
        echo "  logs     - 查看日志"
        echo "  status   - 查看服务状态"
        echo "  db-backup - 备份数据库"
        exit 1
        ;;
esac

echo "完成!"
