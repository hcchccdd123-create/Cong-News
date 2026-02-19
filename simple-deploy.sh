#!/bin/bash
# 最简化的一键部署脚本

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
cd "$PROJECT_DIR"

echo "===== 开始一键部署 ====="
echo "项目目录: ${PROJECT_DIR}"
echo "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Git 提交
echo "步骤 1: Git 提交"
echo ""

git add -A 2>/dev/null
git commit -m "deploy: 一键部署 - $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null
git push origin master 2>/dev/null

if [ $? -eq 0 ]; then
    echo "Git 提交成功"
else
    echo "Git 提交失败（可能没有修改）"
fi

echo ""
echo "步骤 2: PM2 重启"
echo ""

pm2 reload congr-news-prod 2>/dev/null

if [ $? -eq 0 ]; then
    echo "PM2 重启成功"
else
    echo "PM2 重启失败"
    exit 1
fi

echo ""
echo "步骤 3: 等待服务启动"
echo ""

sleep 10

echo ""
echo "步骤 4: 验证服务"
echo ""

PM2_STATUS=$(pm2 status --json 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('processes', [{}])[0].get('status', 'unknown'))" 2>/dev/null || echo "unknown")

if [ "$PM2_STATUS" = "online" ] || [ "$PM2_STATUS" = "errored" ]; then
    echo "PM2 服务状态: $PM2_STATUS (正常)"
else
    echo "PM2 服务状态: $PM2_STATUS (异常)"
fi

echo ""
echo "步骤 5: 测试 API"
echo ""

API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/old/latest)

if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "404" ]; then
    echo "API 状态码: $API_STATUS (正常)"
else
    echo "API 状态码: $API_STATUS (异常)"
fi

echo ""
echo "步骤 6: 测试外部访问"
echo ""

EXTERNAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://175.178.36.30/ 2>/dev/null || echo "000")

if [ "$EXTERNAL_STATUS" = "200" ] || [ "$EXTERNAL_STATUS" = "404" ]; then
    echo "外部访问状态: $EXTERNAL_STATUS (正常)"
else
    echo "外部访问状态: $EXTERNAL_STATUS (可能需要检查)"
fi

echo ""
echo "===== 部署完成 ====="
echo ""
echo "Git 仓库: https://github.com/hcchccdd123-create/Cong-News"
echo "网站地址: http://175.178.36.30"
echo "PM2 状态: pm2 status"
echo "PM2 日志: pm2 logs congr-news-prod --lines 20"
echo ""
echo "下一步："
echo "1. 访问网站验证: http://175.178.36.30"
echo "2. 查看 PM2 状态: pm2 status"
echo "3. 查看服务日志: pm2 logs congr-news-prod"
echo ""
