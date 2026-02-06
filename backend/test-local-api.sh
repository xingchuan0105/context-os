#!/bin/bash

# Context-OS 本地功能测试脚本
# 测试所有主要 API 端点

BASE_URL="http://localhost:3000"
RESULTS=()
TOTAL=0
PASSED=0
FAILED=0

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_code="$5"

    TOTAL=$((TOTAL + 1))
    echo -e "\n${YELLOW}测试 $TOTAL: $name${NC}"
    echo "请求: $method $endpoint"

    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data")
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)

    if [ "$http_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ 通过${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        RESULTS+=("✓ $name")
    else
        echo -e "${RED}✗ 失败${NC} (HTTP $http_code, 期望 $expected_code)"
        echo "响应: $body"
        FAILED=$((FAILED + 1))
        RESULTS+=("✗ $name")
    fi
}

echo "========================================"
echo "Context-OS 本地 API 功能测试"
echo "========================================"
echo "服务器: $BASE_URL"
echo ""

# 1. 测试认证端点
echo -e "\n${YELLOW}===== 1. 认证系统 =====${NC}"
test_api "用户登录" "POST" "/api/auth/login" '{"email":"testuser@example.com","password":"test123"}' 200

# 提取 token（使用 cookie-based auth，但提取用户 ID）
USER_INFO=$(curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"email":"testuser@example.com","password":"test123"}')
echo "用户信息: ${USER_INFO}"

# 保存 cookie 用于后续请求
COOKIE_FILE="test-cookies.txt"
curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"test123"}' > /dev/null

if [ -f "$COOKIE_FILE" ]; then
    echo -e "${GREEN}✓ 已保存认证 cookie${NC}"

    # 2. 测试知识库管理
    echo -e "\n${YELLOW}===== 2. 知识库管理 =====${NC}"

    # 获取知识库列表（使用 cookie）
    KB_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$BASE_URL/api/knowledge-bases")
    echo "知识库列表响应: ${KB_RESPONSE}"

    KB_COUNT=$(echo "$KB_RESPONSE" | grep -o '"id"' | wc -l)
    echo "知识库数量: $KB_COUNT"

    # 创建新知识库
    echo -e "\n创建新知识库..."
    KB_CREATE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/knowledge-bases" \
      -H "Content-Type: application/json" \
      -d '{"title":"API测试知识库","description":"通过API创建的测试知识库"}')
    echo "创建响应: $KB_CREATE_RESPONSE"

    NEW_KB_ID=$(echo "$KB_CREATE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "新创建的知识库ID: ${NEW_KB_ID:0:50}..."

    if [ -n "$NEW_KB_ID" ]; then
        echo -e "${GREEN}✓ 知识库创建成功${NC}"

        # 3. 测试用户设置
        echo -e "\n${YELLOW}===== 3. 用户设置 =====${NC}"
        USER_UPDATE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X PUT "$BASE_URL/api/user/profile" \
          -H "Content-Type: application/json" \
          -d '{"full_name":"测试用户更新"}')
        echo "用户资料更新响应: $USER_UPDATE_RESPONSE"

        # 4. 测试存储统计
        echo -e "\n${YELLOW}===== 4. 存储管理 =====${NC}"
        STORAGE_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$BASE_URL/api/storage/stats")
        echo "存储统计响应: $STORAGE_RESPONSE"

        # 5. 测试指标端点
        echo -e "\n${YELLOW}===== 5. 系统指标 =====${NC}"
        METRICS_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X GET "$BASE_URL/api/metrics")
        echo "系统指标响应: $METRICS_RESPONSE"
    else
        echo -e "${RED}✗ 知识库创建失败${NC}"
    fi
else
    echo -e "${RED}无法获取认证 cookie，跳过需要认证的测试${NC}"
fi

# 9. 测试公开端点（不需要认证）
echo -e "\n${YELLOW}===== 9. 公开端点 =====${NC}"
test_api "登录页面" "GET" "/login" "" 200
test_api "搜索页面" "GET" "/search" "" 200
test_api "设置页面" "GET" "/settings" "" 200

# 测试结果汇总
echo -e "\n========================================"
echo "测试结果汇总"
echo "========================================"
echo -e "总测试数: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo -e "成功率: $(( PASSED * 100 / TOTAL ))%"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}⚠️  部分测试失败，请检查日志${NC}"
    exit 1
fi
