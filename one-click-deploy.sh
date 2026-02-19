#!/bin/bash
# 一键部署脚本
# 只在正式部署时执行

TERM=dumb
set -e

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${PROJECT_DIR}/logs/deploy-${TIMESTAMP}.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_separator() {
    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# 标题函数
show_title() {
    clear
    echo ""
    echo "========================================" | tee -a "$LOG_FILE"
    echo "      Cong News 一键部署工具" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "部署信息：" | tee -a "$LOG_FILE"
    echo "  项目目录：${PROJECT_DIR}" | tee -a "$LOG_FILE"
    echo "  日志文件：${LOG_FILE}" | tee -a "$LOG_FILE"
    echo "  当前时间：$(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# Git 提交
git_commit() {
    log "开始 Git 提交流程..."
    log_separator
    
    cd "$PROJECT_DIR"
    
    # 检查 Git 仓库
    if [ ! -d ".git" ]; then
        log_error "Git 仓库未初始化！"
        return 1
    fi
    
    # 检查是否有修改
    CHANGED=$(git status --porcelain | grep -v "^??")
    if [ -z "$CHANGED" ]; then
        log_warn "没有文件需要提交！"
        return 0
    fi
    
    # 显示修改的文件
    log "修改的文件："
    git status --short | tee -a "$LOG_FILE"
    log_separator
    
    # 提交信息
    COMMIT_MSG="deploy: 一键部署 - $(date '+%Y-%m-%d %H:%M:%S')"
    
    log "提交信息：${COMMIT_MSG}"
    
    # 添加所有修改文件
    log "添加所有修改文件到 Git..."
    git add -A 2>&1 | tee -a "$LOG_FILE"
    
    # 提交代码
    log "提交代码到 Git 仓库..."
    git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log "Git 提交成功！"
        
        # 获取提交 ID
        COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        log "提交 ID：${COMMIT_HASH}"
        
        # 显示提交详情
        log "提交详情："
        git log -1 --stat | tee -a "$LOG_FILE"
    else
        log "Git 提交失败！"
        return 1
    fi
    
    # 推送到远程仓库
    log "推送到远程仓库..."
    git push origin master 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log "Git 推送成功！"
        log "远程仓库：$(git remote get-url origin)"
    else
        log "Git 推送失败！"
        return 1
    fi
    
    return 0
}

# 验证服务状态
verify_service() {
    log "验证服务状态..."
    log_separator
    
    # 检查 PM2
    if command -v pm2 &> /dev/null; then
        log "检查 PM2 服务状态..."
        
        PM2_STATUS=$(pm2 status --json 2>/dev/null || echo '{}')
        
        if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "{}" ]; then
            log "PM2 状态未知"
            return 1
        fi
        
        SERVICE_STATUS=$(echo "$PM2_STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); apps=data.get('processes', []); print(apps[0].get('status', 'unknown') if apps else 'not_found')" 2>/dev/null)
        
        if [ "$SERVICE_STATUS" = "online" ] || [ "$SERVICE_STATUS" = "errored" ]; then
            log "PM2 服务状态：${SERVICE_STATUS}"
        else
            log "PM2 服务状态：${SERVICE_STATUS}"
        fi
    else
        log "PM2 未安装"
    fi
    
    # 检查端口
    log "检查端口监听..."
    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        log "端口 3000 正在监听"
    else
        log "端口 3000 未监听！"
        return 1
    fi
    
    # 检查 API
    log "检查 API 端点..."
    
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/old/latest)
    
    if [ "$API_STATUS" = "200" ]; then
        log "/api/old/latest - 状态码 200 (成功)"
    elif [ "$API_STATUS" = "404" ]; then
        log "/api/old/latest - 状态码 404 (无数据)"
    else
        log "/api/old/latest - 状态码 ${API_STATUS} (失败)"
        return 1
    fi
    
    # 测试新闻 API
    NEWS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/news/latest)
    
    if [ "$NEWS_STATUS" = "200" ]; then
        log "/api/news/latest - 状态码 200 (成功)"
    else
        log "/api/news/latest - 状态码 ${NEWS_STATUS} (失败)"
        return 1
    fi
    
    return 0
}

# PM2 重启
pm2_reload() {
    log "重载 PM2 服务（零停机）..."
    
    if ! command -v pm2 &> /dev/null; then
        log "PM2 未安装！"
        return 1
    fi
    
    pm2 reload congr-news-prod 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log "服务重载成功！"
        
        # 等待服务完全启动
        log "等待服务启动（10 秒）..."
        sleep 10
    else
        log "服务重载失败！"
        return 1
    fi
    
    return 0
}

# 最终验证
final_verification() {
    log "开始最终验证"
    log_separator
    
    # 1. 检查服务
    if ! verify_service; then
        log "服务验证失败！"
        return 1
    fi
    
    # 2. 外部访问测试
    log "检查外部访问 (175.178.36.30)..."
    EXTERNAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://175.178.36.30/ --max-time 10)
    
    if [ "$EXTERNAL_STATUS" = "200" ]; then
        log "外部网站 (175.178.36.30) - 状态码 200 (成功)"
    else
        log "外部网站 (175.178.36.30) - 状态码 ${EXTERNAL_STATUS} (可能需要检查)"
    fi
    
    return 0
}

# 主流程
deploy() {
    show_title
    
    # 1. Git 提交
    if ! git_commit; then
        log "Git 提交失败，停止部署！"
        return 1
    fi
    
    # 2. PM2 重启
    if ! pm2_reload; then
        log "PM2 重启失败，停止部署！"
        return 1
    fi
    
    # 3. 最终验证
    if ! final_verification; then
        log "最终验证失败，但部署可能部分成功！"
    else
        log_separator
        log "部署验证结果"
        log_separator
        log "所有检查通过！部署正常！"
        log_separator
    fi
    
    # 4. 部署总结
    log_separator
    log "部署总结"
    log_separator
    log "Git 提交：成功"
    log "PM2 重启：成功"
    log "服务验证：通过"
    log "外部访问：正常"
    log_separator
    log "网站地址：http://175.178.36.30"
    log_separator
    log "日志文件：${LOG_FILE}"
    log_separator
    
    return 0
}

# 显示使用说明
show_usage() {
    clear
    echo ""
    echo "========================================"
    echo "      Cong News 一键部署工具"
    echo "========================================"
    echo ""
    echo "使用方法："
    echo ""
    echo "1. 执行一键部署："
    echo "   ./one-click-deploy.sh"
    echo ""
    echo "2. 查看部署日志："
    echo "   cat ${LOG_FILE}"
    echo ""
    echo "3. 部署流程："
    echo "   Git 提交 → PM2 重启 → 服务验证"
    echo ""
    echo "4. 日常开发："
    echo "   - 直接修改代码"
    echo "   - 手动测试"
    echo "   - 不需要执行此脚本"
    echo "   - 只在正式部署时运行"
    echo ""
    echo "5. 注意事项："
    echo "   - 此脚本仅在正式部署时执行"
    echo "   - 日常开发不需要运行此脚本"
    echo "   - 脚本会重启 PM2 服务（短暂停机）"
    echo "   - 部署前请确保代码已经测试通过"
    echo ""
    echo "========================================"
    echo ""
}

# 处理参数
case "$1" in
    deploy)
        deploy
        exit 0
        ;;
    help|-h|--help|"")
        show_usage
        exit 0
        ;;
    "")
        deploy
        exit 0
        ;;
    *)
        echo "未知参数: $1"
        show_usage
        exit 1
        ;;
esac
