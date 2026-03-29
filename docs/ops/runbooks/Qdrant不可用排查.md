# Runbook：Qdrant 不可用排查

## 1. 背景
- 适用场景：向量检索失败、Worker 写入向量报错、Qdrant 接口不可达
- 影响范围：语义检索、跨文档相似片段能力

## 2. 前置条件
- 可访问 Qdrant 容器与 API
- 已获取当前环境 QDRANT_URL

## 3. 排查步骤
1. 检查容器状态

```bash
./scripts/dev.sh status
# 或
./scripts/deploy.sh status
```

2. 检查服务连通性

```bash
curl -s "$QDRANT_URL/collections"
```

3. 检查日志

```bash
./scripts/dev.sh logs
# 生产
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f qdrant
```

4. 检查集合是否存在
- 确认目标 collection 已创建
- 确认向量维度与模型输出一致

## 4. 快速修复
- 重启 qdrant 服务
- 若集合损坏，按备份重建集合后触发向量补偿任务
- 临时降级：关闭语义检索入口，仅保留基础阅读评论功能

## 5. 验证步骤

```bash
curl -s "$QDRANT_URL/collections" | head
```

预期：可返回 collections 列表，Worker 不再出现连接报错。

## 6. 回滚方案
- 回滚到上一版本 Qdrant 镜像
- 使用最近的向量快照恢复集合
- 恢复后执行抽样检索校验（命中率和响应时间）
