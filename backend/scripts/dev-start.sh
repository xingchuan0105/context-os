#!/bin/bash

echo "🚀 Context OS v2 开发环境启动"

# 1. 检查Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 2. 启动Docker服务
echo "📦 启动Docker服务..."
docker-compose up -d

# 3. 检查环境变量
if [ ! -f .env ]; then
    echo "⚙️  创建.env文件..."
    cp .env.example .env
    echo "⚠️  请编辑.env文件配置环境变量"
fi

# 4. 创建数据目录
mkdir -p data

# 5. 安装依赖
if [ ! -d node_modules ]; then
    echo "📚 安装依赖..."
    npm install
fi

# 6. 启动开发服务器
echo "🌟 启动开发服务器..."
npm run dev
