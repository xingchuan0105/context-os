#!/bin/bash
# ==============================================
# Context-OS 服务器A部署脚本
# 用途：部署Next.js前端应用 + SQLite
# ==============================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "Context-OS 服务器A部署脚本"
echo "=========================================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用root用户运行此脚本${NC}"
    exit 1
fi

# ==============================================
# 1. 系统更新
# ==============================================
echo -e "${GREEN}[1/9] 更新系统...${NC}"
yum update -y

# ==============================================
# 2. 检查Node.js版本
# ==============================================
echo -e "${GREEN}[2/9] 检查Node.js版本...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js未安装，正在安装Node.js 20...${NC}"
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js已安装: $NODE_VERSION${NC}"
fi

# ==============================================
# 3. 安装PM2进程管理器
# ==============================================
echo -e "${GREEN}[3/9] 安装PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo -e "${GREEN}PM2已安装: $(pm2 --version)${NC}"
fi

# ==============================================
# 4. 安装Nginx
# ==============================================
echo -e "${GREEN}[4/9] 安装Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    yum install -y nginx
    systemctl start nginx
    systemctl enable nginx
else
    echo -e "${GREEN}Nginx已安装${NC}"
fi

# ==============================================
# 5. 创建应用目录
# ==============================================
echo -e "${GREEN}[5/9] 创建应用目录...${NC}"
mkdir -p /var/www/context-os
mkdir -p /var/www/context-os/data
mkdir -p /var/www/context-os/backups
mkdir -p /etc/nginx/ssl

# ==============================================
# 6. 部署应用代码
# ==============================================
echo -e "${GREEN}[6/9] 部署应用代码...${NC}"
echo -e "${YELLOW}请将代码上传到服务器...${NC}"
echo ""
echo "方式1: Git克隆（推荐）"
echo "  cd /var/www"
echo "  git clone <你的仓库地址> context-os"
echo ""
echo "方式2: SCP上传（从本地执行）"
echo "  scp -r context-os root@<服务器IP>:/var/www/"
echo ""
read -p "代码已上传完成？(y/n): " uploaded
if [ "$uploaded" != "y" ]; then
    echo -e "${RED}请先上传代码，然后重新运行此脚本${NC}"
    exit 1
fi

cd /var/www/context-os

# ==============================================
# 7. 安装依赖
# ==============================================
echo -e "${GREEN}[7/9] 安装Node.js依赖...${NC}"
npm install

# ==============================================
# 8. 配置环境变量
# ==============================================
echo -e "${GREEN}[8/9] 配置环境变量...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}创建.env文件...${NC}"
    cat > .env << 'EOF'
# ==================== 数据库配置 ====================
DATABASE_URL=/var/www/context-os/data/context-os.db

# ==================== JWT 认证 ====================
JWT_SECRET=CHANGE_THIS_RANDOM_SECRET_KEY

# ==================== 腾讯云 COS ====================
TENCENT_COS_SECRET_ID=your-secret-id
TENCENT_COS_SECRET_KEY=your-secret-key
TENCENT_COS_BUCKET=context-os-documents
TENCENT_COS_REGION=ap-guangzhou

# ==================== Qdrant 向量数据库 ====================
# 使用服务器B的内网IP
QDRANT_URL=http://10.0.x.x:6333

# ==================== OneAPI / LLM ====================
ONEAPI_BASE_URL=http://your-oneapi
ONEAPI_KEY=sk-xxx

# ==================== Embedding ====================
EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_TIMEOUT_MS=120000

# ==================== 腾讯云 TDMQ ====================
TDMQ_BROKER=your-tdmq-broker
TDMQ_USERNAME=your-username
TDMQ_PASSWORD=your-password
TDMQ_TOPIC=context-doc-process

# ==================== SCF 回调 ====================
CALLBACK_BASE_URL=https://your-domain.com
EOF

    echo -e "${YELLOW}请编辑 .env 文件，填写实际的配置信息${NC}"
    echo "vi /var/www/context-os/.env"
    read -p "配置完成后按回车继续..."
fi

# ==============================================
# 9. 构建应用
# ==============================================
echo -e "${GREEN}[9/9] 构建Next.js应用...${NC}"
npm run build

# ==============================================
# 10. 启动应用
# ==============================================
echo -e "${GREEN}启动应用...${NC}"
pm2 delete context-os 2>/dev/null || true
pm2 start npm --name "context-os" -- start

# 保存PM2配置
pm2 save
pm2 startup

# ==============================================
# 完成
# ==============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}服务器A部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "下一步操作："
echo ""
echo "1. 配置Nginx："
echo "   vi /etc/nginx/conf.d/context-os.conf"
echo "   复制 nginx-content-os.conf 的内容"
echo ""
echo "2. 配置SSL证书："
echo "   将证书文件上传到 /etc/nginx/ssl/"
echo "   - 1_yourdomain.com_bundle.crt"
echo "   - 2_yourdomain.com.key"
echo ""
echo "3. 测试Nginx配置："
echo "   nginx -t"
echo ""
echo "4. 启动Nginx："
echo "   systemctl restart nginx"
echo ""
echo "5. 查看应用日志："
echo "   pm2 logs context-os"
echo ""
echo -e "${YELLOW}重要提示：${NC}"
echo "- 请确保修改 .env 中的配置"
echo "- 请确保配置好 QDRANT_URL（服务器B的内网IP）"
echo "- 请确保配置好Nginx和SSL证书"
echo ""
