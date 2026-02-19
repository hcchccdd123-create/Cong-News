#!/bin/bash
# 自动部署脚本（修复版本）

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
cd "$PROJECT_DIR"

echo "===== 开始自动部署 ====="
echo "项目目录：${PROJECT_DIR}"
echo "当前时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 1. Git 状态检查
echo "步骤 1: Git 状态检查"
echo ""

git status --short
echo ""

# 2. PM2 零停机重启
echo "步骤 2: PM2 零停机重启"
echo ""

pm2 reload cong-news-prod

if [ $? -eq 0 ]; then
    echo "PM2 重启成功"
else
    echo "PM2 重启失败"
    exit 1
fi

echo ""
echo "===== 部署完成 ====="
echo ""
echo "Git 仓库：https://github.com/hcchccdd123-create/Cong-News"
echo "网站地址：http://175.178.36.30"
echo "PM2 状态：pm2 status"
echo "PM2 日志：pm2 logs congr-news-prod --lines 20"
echo ""
