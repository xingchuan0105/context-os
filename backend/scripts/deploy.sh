#!/bin/bash

# Context-OS 部署脚本
# 用于腾讯云轻量应用服务器或 CVM

set -e

echo "======================================"
echo "Context-OS 部署脚本"
echo "======================================"

# 配置变量
APP_DIR="/var/www/context-os"
APP_USER="www-data"
NGINX_CONF="/etc/nginx/conf.d/context-os.conf"
SYSTEMD_SERVICE="/etc/systemd/system/context-os.service"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户或 sudo 运行此脚本${NC}"
    exit 1
fi

# 步骤 1: 检查依赖
echo -e "\n${YELLOW}[1/7] 检查系统依赖...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js 未安装${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}npm 未安装${NC}"; exit 1; }
command -v git >/dev/null 2>&1 || { echo -e "${RED}git 未安装${NC}"; exit 1; }
echo -e "${GREEN}✓ 依赖检查通过${NC}"

# 步骤 2: 创建应用目录
echo -e "\n${YELLOW}[2/7] 创建应用目录...${NC}"
mkdir -p $APP_DIR
mkdir -p /var/log/context-os
mkdir -p /data/context-os
echo -e "${GREEN}✓ 目录创建完成${NC}"

# 步骤 3: 安装依赖
echo -e "\n${YELLOW}[3/7] 安装 Node.js 依赖...${NC}"
cd $APP_DIR
npm install
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 步骤 4: 构建应用
echo -e "\n${YELLOW}[4/7] 构建 Next.js 应用...${NC}"
npm run build
echo -e "${GREEN}✓ 构建完成${NC}"

# 步骤 5: 配置环境变量
echo -e "\n${YELLOW}[5/7] 配置环境变量...${NC}"
if [ ! -f "$APP_DIR/.env.production" ]; then
    echo -e "${RED}未找到 .env.production 文件${NC}"
    echo "请从 .env.production.example 复制并配置："
    echo "cp .env.production.example .env.production"
    exit 1
fi
echo -e "${GREEN}✓ 环境变量配置完成${NC}"

# 步骤 6: 配置 Nginx
echo -e "\n${YELLOW}[6/7] 配置 Nginx...${NC}"
if [ -f "$APP_DIR/nginx.conf" ]; then
    cp $APP_DIR/nginx.conf $NGINX_CONF
    nginx -t
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx 配置完成${NC}"
else
    echo -e "${YELLOW}⚠ 未找到 nginx.conf，请手动配置 Nginx${NC}"
fi

# 步骤 7: 启动应用
echo -e "\n${YELLOW}[7/7] 启动应用...${NC}"
if command -v pm2 >/dev/null 2>&1; then
    # 使用 PM2
    pm2 delete context-os 2>/dev/null || true
    pm2 start $APP_DIR/ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✓ 应用已通过 PM2 启动${NC}"
else
    # 使用 systemd
    cat > $SYSTEMD_SERVICE <<EOF
[Unit]
Description=Context-OS Application
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable context-os
    systemctl restart context-os
    echo -e "${GREEN}✓ 应用已通过 systemd 启动${NC}"
fi

# 完成
echo -e "\n${GREEN}======================================"
echo "部署完成！"
echo "======================================${NC}"
echo ""
echo "应用信息："
echo "  应用目录: $APP_DIR"
echo "  日志目录: /var/log/context-os"
echo "  数据目录: /data/context-os"
echo ""
echo "管理命令："
if command -v pm2 >/dev/null 2>&1; then
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs context-os"
    echo "  重启应用: pm2 restart context-os"
else
    echo "  查看状态: systemctl status context-os"
    echo "  查看日志: journalctl -u context-os -f"
    echo "  重启应用: systemctl restart context-os"
fi
echo ""
echo "下一步："
echo "  1. 配置 SSL 证书（推荐使用 Cloudflare Origin）"
echo "  2. 更新 nginx.conf 中的域名"
echo "  3. 配置 .env.production 中的实际值"
echo ""
