#!/bin/bash
# PM2 零停机重启脚本
# 使用方法：pm2-reload.sh

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"

cd "$PROJECT_DIR"

# 检查 PM2 是否安装
if ! command -v pm2 &> /dev/null; then
    echo "PM2 未安装！"
    exit 1
fi

# 重载 PM2 服务（零停机）
pm2 reload congr-news-prod

if [ $? -eq 0 ]; then
    echo "✅ PM2 服务重载成功！（零停机）"
else
    echo "❌ PM2 服务重载失败！"
    exit 1
fi
