#!/bin/bash
# ==============================================
# Context-OS 环境变量配置向导
# 用途：交互式生成.env配置文件
# ==============================================

echo "=========================================="
echo "Context-OS 环境变量配置向导"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 生成随机JWT密钥
JWT_SECRET=$(openssl rand -base64 32)

echo "请输入以下配置信息："
echo ""

# 数据库配置
echo "=== ���据库配置 ==="
DATABASE_URL="/var/www/context-os/data/context-os.db"
echo -e "数据库路径: ${GREEN}$DATABASE_URL${NC}"
echo ""

# JWT密钥
echo "=== JWT认证密钥 ==="
echo -e "已自动生成: ${GREEN}$JWT_SECRET${NC}"
echo ""

# 腾讯云COS
echo "=== 腾讯云COS配置 ==="
read -p "COS SecretId: " COS_SECRET_ID
read -p "COS SecretKey: " COS_SECRET_KEY
read -p "COS Bucket名称 (如: context-os-documents-1234567890): " COS_BUCKET
COS_REGION="ap-guangzhou"
echo -e "地域: ${GREEN}$COS_REGION${NC}"
echo ""

# Qdrant
echo "=== Qdrant向量数据库配置 ==="
read -p "Qdrant服务器内网IP (如: 10.0.4.5): " QDRANT_IP
QDRANT_URL="http://$QDRANT_IP:6333"
echo -e "Qdrant URL: ${GREEN}$QDRANT_URL${NC}"
echo ""

# OneAPI/LLM
echo "=== OneAPI/LLM配置 ==="
read -p "OneAPI Base URL (如: https://api.oneapi.com): " ONEAPI_BASE_URL
read -p "OneAPI Key (sk-xxx): " ONEAPI_KEY
EMBEDDING_MODEL="BAAI/bge-m3"
read -p "Embedding Base URL (如: https://api.siliconflow.cn/v1): " EMBEDDING_BASE_URL
EMBEDDING_API_KEY="$ONEAPI_KEY"
echo -e "Embedding模型: ${GREEN}$EMBEDDING_MODEL${NC}"
echo ""

# TDMQ
echo "=== 腾讯云TDMQ配置 ==="
read -p "TDMQ Broker地址 (如: pulsar://xxx.tdmq.ap-guangzhou.tencenttdmq.com:6650): " TDMQ_BROKER
read -p "TDMQ 用户名: " TDMQ_USERNAME
read -sp "TDMQ 密码: " TDMQ_PASSWORD
echo ""
TDMQ_TOPIC="context-doc-process"
echo -e "Topic: ${GREEN}$TDMQ_TOPIC${NC}"
echo ""

# 回调URL
echo "=== 回调URL配置 ==="
read -p "你的域名 (如: contextos.com): " DOMAIN
CALLBACK_BASE_URL="https://$DOMAIN"
echo -e "回调URL: ${GREEN}$CALLBACK_BASE_URL${NC}"
echo ""

# 生成.env文件
ENV_FILE="/var/www/context-os/.env"

echo ""
echo "生成.env文件..."
cat > "$ENV_FILE" << EOF
# Context-OS 环境变量配置
# 生成时间: $(date)

# ==================== 数据库配置 ====================
DATABASE_URL=$DATABASE_URL

# ==================== JWT 认证 ====================
JWT_SECRET=$JWT_SECRET

# ==================== 腾讯云 COS ====================
TENCENT_COS_SECRET_ID=$COS_SECRET_ID
TENCENT_COS_SECRET_KEY=$COS_SECRET_KEY
TENCENT_COS_BUCKET=$COS_BUCKET
TENCENT_COS_REGION=$COS_REGION

# ==================== Qdrant 向量数据库 ====================
QDRANT_URL=$QDRANT_URL

# ==================== OneAPI / LLM ====================
ONEAPI_BASE_URL=$ONEAPI_BASE_URL
ONEAPI_KEY=$ONEAPI_KEY

# ==================== Embedding ====================
EMBEDDING_MODEL=$EMBEDDING_MODEL
EMBEDDING_API_KEY=$EMBEDDING_API_KEY
EMBEDDING_BASE_URL=$EMBEDDING_BASE_URL
EMBEDDING_TIMEOUT_MS=120000

# ==================== 腾讯云 TDMQ ====================
TDMQ_BROKER=$TDMQ_BROKER
TDMQ_USERNAME=$TDMQ_USERNAME
TDMQ_PASSWORD=$TDMQ_PASSWORD
TDMQ_TOPIC=$TDMQ_TOPIC

# ==================== SCF 回调 ====================
CALLBACK_BASE_URL=$CALLBACK_BASE_URL
EOF

# 设置文件权限
chmod 600 "$ENV_FILE"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "配置文件已保存到: $ENV_FILE"
echo ""
echo "配置摘要："
echo "  数据库: $DATABASE_URL"
echo "  COS存储: $COS_BUCKET"
echo "  Qdrant: $QDRANT_URL"
echo "  OneAPI: $ONEAPI_BASE_URL"
echo "  回调URL: $CALLBACK_BASE_URL"
echo ""
echo -e "${YELLOW}重要提示：${NC}"
echo "1. 请妥善保管.env文件，不要提交到Git"
echo "2. JWT密钥已自动生成，无需修改"
echo "3. 可以使用 'vi /var/www/context-os/.env' 手动编辑配置"
echo ""
