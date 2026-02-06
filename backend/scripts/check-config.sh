#!/bin/bash

# Context OS 环境配置检查脚本

echo "================================"
echo "Context OS 环境配置检查"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERROR_COUNT=0
WARN_COUNT=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ERROR_COUNT=$((ERROR_COUNT + 1))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARN_COUNT=$((WARN_COUNT + 1))
}

# 检查.env文件
echo "=== 1. 检查环境变量文件 ==="
if [ -f ".env" ]; then
    check_pass ".env文件存在"

    # 加载环境变量
    export $(cat .env | grep -v '^#' | xargs)

    # 检查必需变量
    [ -n "$DATABASE_URL" ] && check_pass "DATABASE_URL已设置" || check_fail "DATABASE_URL未设置"
    [ -n "$JWT_SECRET" ] && check_pass "JWT_SECRET已设置" || check_fail "JWT_SECRET未设置"

    # 检查腾讯云配置
    [ -n "$TENCENT_COS_SECRET_ID" ] && check_pass "COS SecretId已设置" || check_fail "COS SecretId未设置"
    [ -n "$TENCENT_COS_SECRET_KEY" ] && check_pass "COS SecretKey已设置" || check_fail "COS SecretKey未设置"
    [ -n "$TENCENT_COS_BUCKET" ] && check_pass "COS Bucket已设置" || check_fail "COS Bucket未设置"
    [ -n "$TENCENT_COS_REGION" ] && check_pass "COS Region已设置" || check_fail "COS Region未设置"

    # 检查Qdrant配置
    [ -n "$QDRANT_URL" ] && check_pass "QDRANT_URL已设置" || check_fail "QDRANT_URL未设置"

    # 检查OneAPI配置
    [ -n "$ONEAPI_BASE_URL" ] && check_pass "ONEAPI_BASE_URL已设置" || check_fail "ONEAPI_BASE_URL未设置"
    [ -n "$ONEAPI_KEY" ] && check_pass "ONEAPI_KEY已设置" || check_fail "ONEAPI_KEY未设置"

    # 检查TDMQ配置
    [ -n "$TDMQ_BROKER" ] && check_pass "TDMQ_BROKER已设置" || check_warn "TDMQ_BROKER未设置（可选）"
    [ -n "$TDMQ_USERNAME" ] && check_pass "TDMQ_USERNAME已设置" || check_warn "TDMQ_USERNAME未设置（可选）"
    [ -n "$TDMQ_PASSWORD" ] && check_pass "TDMQ_PASSWORD已设置" || check_warn "TDMQ_PASSWORD未设置（可选）"

    # 检查CALLBACK_BASE_URL
    [ -n "$CALLBACK_BASE_URL" ] && check_pass "CALLBACK_BASE_URL已设置" || check_warn "CALLBACK_BASE_URL未设置（可选）"
else
    check_fail ".env文件不存在，请先创建"
    exit 1
fi

echo ""
echo "=== 2. 检查Node.js环境 ==="
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check_pass "Node.js已安装: $NODE_VERSION"

    # 检查版本是否符合要求（>=18）
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        check_pass "Node.js版本符合要求 (>=18)"
    else
        check_fail "Node.js版本过低，需要 >=18"
    fi
else
    check_fail "Node.js未安装"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check_pass "npm已安装: $NPM_VERSION"
else
    check_fail "npm未安装"
fi

echo ""
echo "=== 3. 检查依赖安装 ==="
if [ -d "node_modules" ]; then
    check_pass "node_modules目录存在"

    # 检查关键依赖
    [ -d "node_modules/next" ] && check_pass "Next.js已安装" || check_fail "Next.js未安装"
    [ -d "node_modules/better-sqlite3" ] && check_pass "better-sqlite3已安装" || check_fail "better-sqlite3未安装"
    [ -d "node_modules/@qdrant" ] && check_pass "Qdrant客户端已安装" || check_fail "Qdrant客户端未安装"
    [ -d "node_modules/jose" ] && check_pass "Jose已安装" || check_fail "Jose未安装"
    [ -d "node_modules/cos-nodejs-sdk-v5" ] && check_pass "COS SDK已安装" || check_fail "COS SDK未安装"
else
    check_fail "node_modules目录不存在，请运行 npm install"
fi

echo ""
echo "=== 4. 检查数据目录 ==="
if [ -d "data" ]; then
    check_pass "data目录存在"
    if [ -f "data/context-os.db" ]; then
        check_pass "SQLite数据库文件存在"

        # 检查数据库文件大小
        DB_SIZE=$(du -h data/context-os.db | cut -f1)
        echo "  数据库大小: $DB_SIZE"
    else
        check_warn "SQLite数据库文件不存在（将在首次运行时创建）"
    fi
else
    check_warn "data目录不存在（将在首次运行时创建）"
fi

echo ""
echo "=== 5. 网络连通性检查 ==="

# 检查Qdrant连接
if [ -n "$QDRANT_URL" ]; then
    # 提取主机名
    QDRANT_HOST=$(echo $QDRANT_URL | sed -e 's|^[^/]*//||' -e 's|/.*$||' -e 's|:.*$||')
    if curl -s --connect-timeout 3 "http://$QDRANT_HOST/" > /dev/null 2>&1; then
        check_pass "Qdrant服务可访问: $QDRANT_URL"
    else
        check_fail "Qdrant服务无法访问: $QDRANT_URL"
    fi
fi

# 检查OneAPI连接
if [ -n "$ONEAPI_BASE_URL" ]; then
    if curl -s --connect-timeout 3 "$ONEAPI_BASE_URL" > /dev/null 2>&1; then
        check_pass "OneAPI服务可访问: $ONEAPI_BASE_URL"
    else
        check_fail "OneAPI服务无法访问: $ONEAPI_BASE_URL"
    fi
fi

# 检查COS连接
if [ -n "$TENCENT_COS_BUCKET" ] && [ -n "$TENCENT_COS_REGION" ]; then
    COS_URL="https://${TENCENT_COS_BUCKET}.cos.${TENCENT_COS_REGION}.myqcloud.com"
    if curl -s --connect-timeout 3 "$COS_URL" > /dev/null 2>&1; then
        check_pass "COS存储桶可访问: $COS_URL"
    else
        check_warn "COS存储桶可能无法访问（可能需要配置密钥）"
    fi
fi

echo ""
echo "=== 6. 构建检查 ==="
if [ -d ".next" ]; then
    check_pass "Next.js构建目录存在"
else
    check_warn "Next.js构建目录不存在，请运行 npm run build"
fi

echo ""
echo "=== 7. 进程检查 ==="
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "context-os"; then
        check_pass "PM2进程存在: context-os"
    else
        check_warn "PM2进程不存在: context-os（运行 pm2 start npm -- start）"
    fi
else
    check_warn "PM2未安装（生产环境推荐安装）"
fi

echo ""
echo "================================"
echo "检查结果汇总"
echo "================================"
echo -e "错误: ${RED}$ERROR_COUNT${NC}"
echo -e "警告: ${YELLOW}$WARN_COUNT${NC}"

if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 所有关键检查通过！${NC}"
    echo ""
    echo "下一步操作:"
    echo "1. 如果尚未构建，运行: npm run build"
    echo "2. 启动应用: npm run dev (开发) 或 pm2 start npm -- start (生产)"
    echo "3. 访问应用: http://localhost:3000"
else
    echo -e "${RED}✗ 发现 $ERROR_COUNT 个错误，请修复后重试${NC}"
    exit 1
fi
