#!/bin/bash
# 通知系统测试脚本

API_URL="http://localhost:3001/api"

echo "=== 共鸣阅读通知系统测试 ==="
echo ""

# 1. 登录获取 token
echo "1️⃣  登录获取 token..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@admin.com","password":"ch19964716"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ 登录失败：$LOGIN_RESPONSE"
  exit 1
fi

echo "✅ 登录成功，token 获取成功"
echo ""

# 2. 获取未读通知数量
echo "2️⃣  获取未读通知数量..."
UNREAD_COUNT=$(curl -s "${API_URL}/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN")

echo "📬 未读通知：$UNREAD_COUNT"
echo ""

# 3. 获取通知列表
echo "3️⃣  获取通知列表..."
NOTIFICATIONS=$(curl -s "${API_URL}/notifications" \
  -H "Authorization: Bearer $TOKEN")

echo "📋 通知列表："
echo "$NOTIFICATIONS" | head -20
echo ""

# 4. 创建测试通知
echo "4️⃣  创建测试通知..."
CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/notifications" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userId": "'$(echo $LOGIN_RESPONSE | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)'",
    "type": "system",
    "title": "🎉 通知系统测试",
    "content": "恭喜！通知系统已成功部署并运行！",
    "data": {"test": true}
  }')

echo "✅ 创建成功：$CREATE_RESPONSE"
echo ""

# 5. 再次获取通知列表
echo "5️⃣  验证通知已添加..."
NOTIFICATIONS=$(curl -s "${API_URL}/notifications?limit=5" \
  -H "Authorization: Bearer $TOKEN")

echo "$NOTIFICATIONS" | head -30
echo ""

echo "=== 测试完成 ==="
