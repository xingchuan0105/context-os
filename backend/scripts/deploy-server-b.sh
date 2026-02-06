#!/bin/bash
# ==============================================
# Context-OS 服务器B部署脚本
# 用途：部署Qdrant向量数据库
# ==============================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "Context-OS 服务器B部署脚本（Qdrant）"
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
echo -e "${GREEN}[1/5] 更新系统...${NC}"
yum update -y

# ==============================================
# 2. 安装Docker
# ==============================================
echo -e "${GREEN}[2/5] 安装Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "安装Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker安装完成${NC}"
else
    echo -e "${GREEN}Docker已安装: $(docker --version)${NC}"
fi

# ==============================================
# 3. 创建数据目录
# ==============================================
echo -e "${GREEN}[3/5] 创建Qdrant数据目录...${NC}"
mkdir -p /data/qdrant
chmod -R 755 /data/qdrant

# ==============================================
# 4. 部署Qdrant容器
# ==============================================
echo -e "${GREEN}[4/5] 部署Qdrant容器...${NC}"

# 停止并删除旧容器（如果存在）
docker stop qdrant 2>/dev/null || true
docker rm qdrant 2>/dev/null || true

# 运行Qdrant容器
docker run -d \
  --name qdrant \
  --restart unless-stopped \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /data/qdrant:/qdrant/storage:z \
  -e QDRANT__SERVICE__GRPC_PORT=6334 \
  qdrant/qdrant:latest

# 等待容器启动
echo "等待Qdrant启动..."
sleep 10

# ==============================================
# 5. 验证Qdrant运行
# ==============================================
echo -e "${GREEN}[5/5] 验证Qdrant服务...${NC}"

if curl -s http://localhost:6333/ > /dev/null; then
    echo -e "${GREEN}Qdrant运行正常！${NC}"
    echo ""
    curl -s http://localhost:6333/ | head -20
    echo ""
else
    echo -e "${RED}Qdrant启动失败，请检查日志${NC}"
    echo "查看日志: docker logs qdrant"
    exit 1
fi

# ==============================================
# 6. 配置防火墙
# ==============================================
echo -e "${GREEN}配置防火墙...${NC}"
echo -e "${YELLOW}请确保腾讯云安全组已开放以下端口：${NC}"
echo "  - 6333 (HTTP API)"
echo "  - 6334 (gRPC API)"
echo ""
echo -e "${YELLOW}如果只允许服务器A访问，请配置防火墙规则：${NC}"
echo ""
echo "  # 查看服务器A的内网IP"
echo "  firewall-cmd --permanent --add-rich-rule='rule family=\"ipv4\" source address=\"10.0.0.0/8\" port port=\"6333\" protocol=\"tcp\" accept'"
echo "  firewall-cmd --reload"
echo ""

# ==============================================
# 完成
# ==============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}服务器B部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Qdrant信息："
echo "  HTTP API: http://<本机IP>:6333"
echo "  gRPC API: http://<本机IP>:6334"
echo "  数据目录: /data/qdrant"
echo ""
echo "内网IP地址："
echo "  请记录本机的内网IP，用于配置服务器A的QDRANT_URL"
echo "  查看命令: ip addr show eth0"
echo ""
echo "测试命令："
echo "  curl http://localhost:6333/"
echo "  docker logs qdrant"
echo ""
