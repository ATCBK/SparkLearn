#!/bin/bash

# SparkLearn 小程序启动脚本

echo "==================================="
echo "  SparkLearn 小程序启动脚本"
echo "==================================="
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 npm"
    exit 1
fi

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"
echo ""

# 进入项目目录
cd "$(dirname "$0")/.."

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        exit 1
    fi
    echo "依赖安装完成"
    echo ""
fi

# 检查图标文件
if [ ! -f "src/assets/icons/home.png" ]; then
    echo "警告: 未找到图标文件"
    echo "请运行 node scripts/download-icons.js 下载图标"
    echo "或手动下载图标到 src/assets/icons/ 目录"
    echo ""
fi

echo "启动开发服务器..."
echo "请使用微信开发者工具打开 dist 目录"
echo ""

# 启动开发服务器
npm run dev:weapp
