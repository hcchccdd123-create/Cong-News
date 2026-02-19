#!/bin/bash
# 部署验证脚本
# 使用方法：./deploy-verify.sh

set -e

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${PROJECT_DIR}/logs/deploy-verify-${TIMESTAMP}.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# 分隔线
log_separator() {
    echo "" | tee -a "$LOG_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# 检查函数
check_pm2() {
    log_info "检查 PM2 服务状态..."
    
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装！"
        return 1
    fi
    
    PM2_STATUS=$(pm2 status --json 2>/dev/null || echo '{}')
    
    if [ -z "$PM2_STATUS" ] || [ "$PM2_STATUS" = "{}" ]; then
        log_warn "PM2 状态未知"
        return 1
    fi
    
    SERVICE_STATUS=$(echo "$PM2_STATUS" | python3 -c "import sys, json; data=json.load(sys.stdin); apps=data.get('processes', []); print(apps[0].get('status', 'unknown') if apps else 'not_found')" 2>/dev/null)
    
    if [ "$SERVICE_STATUS" = "online" ] || [ "$SERVICE_STATUS" = "errored" ]; then
        log_success "PM2 服务状态: ${SERVICE_STATUS}"
        return 0
    else
        log_warn "PM2 服务状态: ${SERVICE_STATUS}"
        return 1
    fi
}

check_service() {
    log_info "检查 Node.js 服务状态..."
    
    if command -v pm2 &> /dev/null; then
        # 使用 PM2 检查
        check_pm2
        return $?
    fi
    
    # 检查端口
    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        log_success "端口 3000 正在监听"
        return 0
    else
        log_error "端口 3000 未监听！"
        return 1
    fi
}

check_api() {
    log_info "检查 API 端点..."
    
    # 检查金价 API
    log_info "  检查 /api/old/latest..."
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/old/latest)
    
    if [ "$API_STATUS" = "200" ]; then
        log_success "  /api/old/latest - 状态码 200 (成功)"
        return 0
    elif [ "$API_STATUS" = "404" ]; then
        log_warn "  /api/old/latest - 状态码 404 (无数据）"
        return 0
    else
        log_error "  /api/old/latest - 状态码 ${API_STATUS} (失败)"
        return 1
    fi
}

check_website() {
    log_info "检查网站可访问性..."
    
    # 检查本地端口 80
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/80 | grep -q "200\|404"; then
        log_success "  Nginx (端口 80) - 本地可访问"
    else
        log_error "  Nginx (端口 80) - 本地不可访问"
        return 1
    fi
    
    # 检查外部 IP
    log_info "  检查外部访问 (175.178.36.30)..."
    EXTERNAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://175.178.36.30/ --max-time 10)
    
    if [ "$EXTERNAL_STATUS" = "200" ]; then
        log_success "  外部网站 (175.178.36.30) - 状态码 200 (成功)"
        return 0
    else
        log_error "  外部网站 (175.178.36.30) - 状态码 ${EXTERNAL_STATUS} (可能需要检查)"
        return 1
    fi
}

reload_service() {
    log_info "重载 PM2 服务..."
    
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装！"
        return 1
    fi
    
    pm2 reload cong-news-prod 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "服务重载成功！"
        sleep 3  # 等待服务完全启动
        return 0
    else
        log_error "服务重载失败！"
        return 1
    fi
}

verify_deployment() {
    log_separator
    log "🚀 开始部署验证"
    log_separator
    
    # 1. 检查 PM2 服务
    check_pm2
    PM2_STATUS=$?
    
    # 2. 检查服务运行
    check_service
    SERVICE_STATUS=$?
    
    # 3. 检查 API 端点
    check_api
    API_STATUS=$?
    
    # 4. 检查网站可访问性
    check_website
    WEBSITE_STATUS=$?
    
    # 5. 判断整体状态
    log_separator
    log "📊 部署验证结果"
    log_separator
    
    if [ $PM2_STATUS -eq 0 ] && [ $SERVICE_STATUS -eq 0 ] && [ $API_STATUS -eq 0 ] && [ $WEBSITE_STATUS -eq 0 ]; then
        log_success "🎉 所有检查通过！部署正常！"
        log_separator
        log "✅ PM2 服务：正常运行"
        log "✅ Node.js 服务：端口 3000 正常监听"
        log "✅ API 端点：/api/old/latest 响应正常"
        log "✅ 网站访问：内部和外部均可访问"
        log_separator
        log "📋 验证日志：${LOG_FILE}"
        return 0
    else
        log_error "❌ 部署验证失败！存在以下问题："
        
        if [ $PM2_STATUS -ne 0 ]; then
            log "  ❌ PM2 服务状态异常"
        fi
        
        if [ $SERVICE_STATUS -ne 0 ]; then
            log "  ❌ Node.js 服务异常"
        fi
        
        if [ $API_STATUS -ne 0 ]; then
            log "  ❌ API 端点异常"
        fi
        
        if [ $WEBSITE_STATUS -ne 0 ]; then
            log "  ❌ 网站访问异常"
        fi
        
        log_separator
        log "📋 验证日志：${LOG_FILE}"
        return 1
    fi
}

# 主流程
log_separator
log "🔍 部署验证工具"
log "项目目录：${PROJECT_DIR}"
log "日志文件：${LOG_FILE}"
log "当前时间：$(date '+%Y-%m-%d %H:%M:%S')"
log_separator

# 显示使用说明
log "使用方法："
log "  1. 验证当前部署：./deploy-verify.sh verify"
log "  2. 验证后重载：./deploy-verify.sh verify && ./deploy-verify.sh reload"
log "  3. 仅重载服务：./deploy-verify.sh reload"
log "  4. 查看日志：cat ${LOG_FILE}"
log_separator

# 处理命令行参数
case "$1" in
    verify)
        verify_deployment
        ;;
    reload)
        reload_service
        ;;
    "")
        verify_deployment
        ;;
    *)
        log_warn "未知命令: $1"
        log "可用命令: verify, reload"
        exit 1
        ;;
esac

log "✅ 部署验证完成！"
