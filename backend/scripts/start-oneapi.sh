#!/bin/bash
# OneAPI 快速启动脚本 (Linux / macOS)
#
# 使用方法:
#   1. 确保 Docker 已安装并运行
#   2. 运行: chmod +x scripts/start-oneapi.sh && ./scripts/start-oneapi.sh

set -e

echo "========================================"
echo "  Context OS - OneAPI 快速部署"
echo "========================================"
echo ""

# 检查 Docker 是否运行
echo "检查 Docker 状态..."
if ! docker info > /dev/null 2>&1; then
    echo "✗ Docker 未运行，请先启动 Docker"
    exit 1
fi
echo "✓ Docker 运行正常"

# 创建数据目录
echo ""
echo "创建数据目录..."
mkdir -p data/oneapi data/redis
echo "✓ 数据目录创建成功"

# 启动服务
echo ""
echo "启动 OneAPI 和 Redis 服务..."
docker-compose -f docker-compose.oneapi.yml up -d

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "OneAPI 管理界面: http://localhost:3000"
echo "默认用户名: root"
echo "默认密码: 123456"
echo ""
echo "Redis: localhost:6379"
echo ""
echo "查看日志: docker-compose -f docker-compose.oneapi.yml logs -f"
echo "停止服务: docker-compose -f docker-compose.oneapi.yml down"
echo ""
