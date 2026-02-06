#!/bin/bash

echo "======================================"
echo "Context-OS 功能测试"
echo "======================================"
echo ""

API_BASE="http://localhost:3000/api"

# 测试 1: 注册新用户
echo "📝 测试 1: 注册新用户"
REGISTER_RESPONSE=$(curl -s -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser-'$(date +%s)'@example.com",
    "password": "test123",
    "name": "Test User"
  }')
echo "$REGISTER_RESPONSE" | head -c 200
echo ""
echo ""

# 测试 2: 登录
echo "🔑 测试 2: 用户登录"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "test123"
  }')
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."
echo ""
echo ""

# 测试 3: 获取用户信息
echo "👤 测试 3: 获取用户信息"
curl -s -X GET "$API_BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 300
echo ""
echo ""

# 测试 4: 创建知识库
echo "📚 测试 4: 创建知识库"
KB_RESPONSE=$(curl -s -X POST "$API_BASE/knowledge-bases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试知识库",
    "description": "这是一个测试知识库"
  }')
KB_ID=$(echo "$KB_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "知识库 ID: $KB_ID"
echo ""
echo ""

# 测试 5: 获取知识库列表
echo "📋 测试 5: 获取知识库列表"
curl -s -X GET "$API_BASE/knowledge-bases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 500
echo ""
echo ""

# 测试 6: 检查 LiteLLM Embedding 模型
echo "🤖 测试 6: 测试 Embedding 模型"
EMBEDDING_RESPONSE=$(curl -s -X POST "http://localhost:4000/v1/embeddings" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-embedding-4b",
    "input": "测试文本"
  }')
echo "$EMBEDDING_RESPONSE" | head -c 300
echo ""
echo ""

# 测试 7: 检查 LiteLLM Chat 模型
echo "💬 测试 7: 测试 Chat 模型"
CHAT_RESPONSE=$(curl -s -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-flash",
    "messages": [{"role": "user", "content": "你好"}]
  }')
echo "$CHAT_RESPONSE" | head -c 300
echo ""
echo ""

echo "======================================"
echo "✅ 测试完成"
echo "======================================"
