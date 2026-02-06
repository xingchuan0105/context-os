#!/bin/bash

# Context OS 腾讯云服务器自动初始化脚本
# 适用于 CentOS 7/8

set -e

echo "================================"
echo "Context OS 服务器初始化脚本"
echo "================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请使用root用户运行此脚本${NC}"
  exit 1
fi

# 获取配置信息
echo -e "${YELLOW}请输入配置信息：${NC}"
read -p "域名 (如: contextos.com): " DOMAIN
read -p "Qdrant服务器内网IP (如: 10.0.0.2): " QDRANT_IP
read -p "腾讯云SecretId: " SECRET_ID
read -p "腾讯云SecretKey: " SECRET_KEY
read -p "COS存储桶名称 (如: context-os-documents-1234567890): " COS_BUCKET
read -p "OneAPI地址: " ONEAPI_URL
read -p "OneAPI密钥: " ONEAPI_KEY
read -p "TDMQ地址: " TDMQ_BROKER
read -p "TDMQ用户名: " TDMQ_USERNAME
read -p "TDMQ密码: " TDMQ_PASSWORD

# 生成JWT密钥
JWT_SECRET=$(openssl rand -base64 32)

echo ""
echo -e "${GREEN}配置信息已收集，开始安装...${NC}"
echo ""

# 1. 更新系统
echo -e "${YELLOW}[1/9] 更新系统...${NC}"
yum update -y

# 2. 安装基础工具
echo -e "${YELLOW}[2/9] 安装基础工具...${NC}"
yum install -y git curl wget vim nginx

# 3. 安装Node.js (如果未安装)
echo -e "${YELLOW}[3/9] 检查Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo "安装Node.js 20..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
else
    echo -e "${GREEN}Node.js已安装: $(node -v)${NC}"
fi

# 4. 安装PM2
echo -e "${YELLOW}[4/9] 安装PM2...${NC}"
npm install -g pm2

# 5. 克隆代码
echo -e "${YELLOW}[5/9] 克隆代码...${NC}
if [ ! -d "/var/www/context-os" ]; then
    mkdir -p /var/www
    # 这里假设代码已上传到/var/www/context-os
    # 实际部署时需要根据实际情况调整
    echo -e "${YELLOW}请手动上传代码到 /var/www/context-os${NC}"
fi

cd /var/www/context-os

# 6. 安装依赖
echo -e "${YELLOW}[6/9] 安装Node.js依赖...${NC}"
npm install

# 7. 创建.env文件
echo -e "${YELLOW}[7/9] 配置环境变量...${NC}"
cat > .env << EOF
DATABASE_URL=/var/www/context-os/data/context-os.db
JWT_SECRET=$JWT_SECRET

TENCENT_COS_SECRET_ID=$SECRET_ID
TENCENT_COS_SECRET_KEY=$SECRET_KEY
TENCENT_COS_BUCKET=$COS_BUCKET
TENCENT_COS_REGION=ap-guangzhou

QDRANT_URL=http://$QDRANT_IP:6333

ONEAPI_BASE_URL=$ONEAPI_URL
ONEAPI_KEY=$ONEAPI_KEY

EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_API_KEY=$ONEAPI_KEY
EMBEDDING_BASE_URL=$ONEAPI_URL

TDMQ_BROKER=$TDMQ_BROKER
TDMQ_USERNAME=$TDMQ_USERNAME
TDMQ_PASSWORD=$TDMQ_PASSWORD
TDMQ_TOPIC=context-doc-process

CALLBACK_BASE_URL=https://$DOMAIN
EOF

echo -e "${GREEN}✅ 环境变量配置完成${NC}"

# 8. 创建数据目录
echo -e "${YELLOW}[8/9] 创建数据目录...${NC}"
mkdir -p /var/www/context-os/data
mkdir -p /var/www/context-os/backups
mkdir -p /var/www/context-os/scripts

# 创建备份脚本
cat > /var/www/context-os/scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/www/context-os/backups
mkdir -p $BACKUP_DIR
cp /var/www/context-os/data/context-os.db $BACKUP_DIR/context-os-$DATE.db
find $BACKUP_DIR -name "context-os-*.db" -mtime +7 -delete
EOF
chmod +x /var/www/context-os/scripts/backup.sh

# 添加定时任务
(crontab -l 2>/dev/null; echo "0 2 * * * /var/www/context-os/scripts/backup.sh") | crontab -

# 9. 配置Nginx
echo -e "${YELLOW}[9/9] 配置Nginx...${NC}"
cat > /etc/nginx/conf.d/context-os.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # 临时使用自签名证书，请替换为正式证书
    ssl_certificate /etc/nginx/ssl/self-signed.crt;
    ssl_certificate_key /etc/nginx/ssl/self-signed.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 生成自签名证书（临时使用）
mkdir -p /etc/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/self-signed.key \
  -out /etc/nginx/ssl/self-signed.crt \
  -subj "/C=CN/ST=Guangdong/L=Guangzhou/O=ContextOS/CN=$DOMAIN"

# 测试Nginx配置
nginx -t

# 启动Nginx
systemctl start nginx
systemctl enable nginx

# 构建应用
echo -e "${YELLOW}构建应用...${NC}"
npm run build

# 启动应用
echo -e "${YELLOW}启动应用...${NC}"
pm2 start npm --name "context-os" -- start
pm2 save
pm2 startup

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ 初始化完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "应用信息:"
echo "  域名: https://$DOMAIN"
echo "  数据目录: /var/www/context-os/data"
echo "  日志查看: pm2 logs context-os"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 申请正式SSL证书并替换 /etc/nginx/ssl/ 下的证书文件"
echo "2. 访问 https://$DOMAIN 测试应用"
echo "3. 配置腾讯云安全组，开放80、443端口"
echo ""
