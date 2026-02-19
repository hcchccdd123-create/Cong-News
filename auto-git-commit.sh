#!/bin/bash
# 自动 Git 提交脚本
# 使用方法：./auto-commit.sh "提交信息"

set -e

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${PROJECT_DIR}/logs/auto-git-${TIMESTAMP}.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

# 创建日志目录
mkdir -p "${PROJECT_DIR}/logs"

log_info "====== 开始自动 Git 提交流程 ======"
log_info "项目目录: ${PROJECT_DIR}"

cd "$PROJECT_DIR"

# 检查 Git 状态
if [ ! -d ".git" ]; then
    log_error "Git 仓库未初始化！"
    exit 1
fi

# 检查是否有修改
CHANGED=$(git status --porcelain | grep -v "^??")
if [ -z "$CHANGED" ]; then
    log_warn "没有文件需要提交！"
    exit 0
fi

# 显示修改的文件
log_info "修改的文件："
git status --short | tee -a "$LOG_FILE"

# 预提交检查
log_info "预提交检查："
if [ -n "$(git diff --cached)" ]; then
    log_warn "已暂存的文件将被包含："
    git diff --cached --name-only | head -10 | tee -a "$LOG_FILE"
fi

# 添加所有修改的文件
log_info "添加所有修改文件到 Git..."
git add -A 2>&1 | tee -a "$LOG_FILE"

# 提交信息
COMMIT_MSG="auto: ${1:-自动化代码更新 - $(date '+%Y-%m-%d %H:%M:%S')}"

log_info "提交信息: ${COMMIT_MSG}"

# 提交代码
log_info "提交代码到 Git 仓库..."
git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"

if [ $? -eq 0 ]; then
    log_info "✅ Git 提交成功！"
    
    # 获取提交 ID
    COMMIT_HASH=$(git rev-parse --short HEAD)
    log_info "提交 ID: ${COMMIT_HASH}"
    
    # 显示提交详情
    log_info "提交详情："
    git log -1 --stat | tee -a "$LOG_FILE"
    
else
    log_error "❌ Git 提交失败！"
    exit 1
fi

# 推送到远程仓库
log_info "推送到远程仓库..."
git push origin master 2>&1 | tee -a "$LOG_FILE"

if [ $? -eq 0 ]; then
    log_info "✅ Git 推送成功！"
    log_info "远程仓库: $(git remote get-url origin)"
else
    log_error "❌ Git 推送失败！"
    exit 1
fi

log_info "====== Git 自动提交完成 ======"
log_info "日志文件: ${LOG_FILE}"

# 显示日志文件位置
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ 自动 Git 提交流程完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 提交信息:"
echo "  提交 ID: $(git rev-parse --short HEAD)"
echo "  提交信息: ${COMMIT_MSG}"
echo "  远程仓库: $(git remote get-url origin)"
echo "  提交时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "📊 GitHub 仓库:"
echo "  https://github.com/hcchccdd123-create/Cong-News"
echo ""
echo "📝 日志文件:"
echo "  ${LOG_FILE}"
echo ""
echo "💡 下一步:"
echo "  查看提交: https://github.com/hcchccdd123-create/Cong-News/commits/master"
echo "  访问网站: http://175.178.36.30"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
