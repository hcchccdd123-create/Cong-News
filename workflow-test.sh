#!/bin/bash
# 简化的工作流脚本

set -e

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${PROJECT_DIR}/logs/workflow-${TIMESTAMP}.log"

cd "$PROJECT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始工作流..." | tee -a "$LOG_FILE"

# Git 状态
echo "Git 状态：" | tee -a "$LOG_FILE"
git status --short | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# PM2 状态
echo "PM2 状态：" | tee -a "$LOG_FILE"
pm2 status --json 2>/dev/null | python3 -c "import sys, json; data=json.load(sys.stdin); apps=data.get('processes', []); print([f\"{app['name']}: {app['status']}\" for app in apps if 'cong-news' in app.get('name', '')])" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 端口检查
echo "端口检查：" | tee -a "$LOG_FILE"
netstat -tlnp 2>/dev/null | grep :3000 || echo "  端口 3000: 未监听" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# API 测试
echo "API 测试：" | tee -a "$LOG_FILE"
curl -s -o /dev/null -w "  /api/old/latest: %{http_code}\n" http://127.0.0.1:3000/api/old/latest | tee -a "$LOG_FILE"
curl -s -o /dev/null -w "  /api/news/latest?limit=3: %{http_code}\n" http://127.0.0.1:3000/api/news/latest?limit=3 | tee -a "$LOG_FILE"
curl -s -o /dev/null -w "  /health: %{http_code}\n" http://127.0.0.1:3000/health | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# 外部访问测试
echo "外部访问测试：" | tee -a "$LOG_FILE"
curl -s -o /dev/null -w "  http://175.178.36.30/: %{http_code}\n" http://175.178.36.30/ | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 工作流完成！" | tee -a "$LOG_FILE"
echo "日志文件: ${LOG_FILE}" | tee -a "$LOG_FILE"
