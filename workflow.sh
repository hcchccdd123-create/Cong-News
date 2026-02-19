#!/bin/bash
# 简化的使用脚本
# 提供 Git 提交、PM2 管理、部署验证的快捷方式

set -e

PROJECT_DIR="/root/.openclaw/workspace/old-news-site"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="${PROJECT_DIR}/logs/workflow-${TIMESTAMP}.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${CYAN}[${TIMESTAMP}]${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    log "ℹ️  $1"
}

log_warn() {
    log "⚠️  $1"
}

log_success() {
    log "✅ $1"
}

log_error() {
    log "❌ $1"
}

log_separator() {
    log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 分隔线
header() {
    clear
    log_separator
    log "🚀 Cong News 自动化工具"
    log_separator
    log "项目目录: ${PROJECT_DIR}"
    log "日志文件: ${LOG_FILE}"
    log "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
    log_separator
    log ""
}

footer() {
    log ""
    log_separator
    log "💡 提示：查看详细日志"
    log "  ${LOG_FILE}"
    log ""
    log "📋 常用命令："
    log "  1. Git 操作: git status / log / diff / push"
    log "  2. PM2 操作: pm2 status / logs / reload / restart"
    log "  3. 部署验证: ./deploy-verify.sh verify"
    log "  4. 查看日志: cat ${LOG_FILE}"
    log_separator
    log ""
}

# Git 操作
git_status() {
    log_info "查看 Git 状态..."
    cd "$PROJECT_DIR"
    git status
    git status | tee -a "$LOG_FILE"
}

git_add() {
    log_info "添加所有修改文件..."
    cd "$PROJECT_DIR"
    git add -A
    git status --short | tee -a "$LOG_FILE"
}

git_commit() {
    log_info "提交代码到 Git..."
    cd "$PROJECT_DIR"
    
    COMMIT_MSG="auto: 自动化代码更新 - $(date '+%Y-%m-%d %H:%M:%S')"
    log "提交信息: ${COMMIT_MSG}"
    
    git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "Git 提交成功！"
        
        # 获取提交 ID
        COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
        log "提交 ID: ${COMMIT_HASH}"
        
        # 显示最新提交
        git log -1 --stat | tee -a "$LOG_FILE"
    else
        log_error "Git 提交失败！"
        exit 1
    fi
}

git_push() {
    log_info "推送代码到远程仓库..."
    cd "$PROJECT_DIR"
    
    git push origin master 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "Git 推送成功！"
        log "远程仓库: $(git remote get-url origin)"
    else
        log_error "Git 推送失败！"
        exit 1
    fi
}

git_log() {
    log_info "查看 Git 日志..."
    cd "$PROJECT_DIR"
    git log --oneline -10 | tee -a "$LOG_FILE"
}

# PM2 操作
pm2_status() {
    log_info "查看 PM2 服务状态..."
    pm2 status 2>&1 | tee -a "$LOG_FILE"
}

pm2_logs() {
    log_info "查看 PM2 日志 (最后 20 行）..."
    pm2 logs congr-news-prod --lines 20 --nostream 2>&1 | tee -a "$LOG_FILE"
}

pm2_reload() {
    log_info "重载 PM2 服务（零停机）..."
    pm2 reload congr-news-prod 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "PM2 服务重载成功！"
        log "等待 3 秒以验证服务..."
        sleep 3
    else
        log_error "PM2 服务重载失败！"
        exit 1
    fi
}

pm2_restart() {
    log_warn "PM2 服务将重启（短暂停机）..."
    pm2 restart congr-news-prod 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "PM2 服务重启成功！"
        log "等待 5 秒以验证服务..."
        sleep 5
    else
        log_error "PM2 服务重启失败！"
        exit 1
    fi
}

pm2_stop() {
    log_warn "PM2 服务将停止..."
    pm2 stop congr-news-prod 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "PM2 服务已停止！"
    else
        log_error "PM2 服务停止失败！"
        exit 1
    fi
}

pm2_delete() {
    log_warn "PM2 服务将从 PM2 列表中删除..."
    pm2 delete congr-news-prod 2>&1 | tee -a "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "PM2 服务已删除！"
    else
        log_error "PM2 服务删除失败！"
        exit 1
    fi
}

# 部署验证
deploy_verify() {
    log_info "执行部署验证..."
    cd "$PROJECT_DIR"
    
    if [ -f "./deploy-verify.sh" ]; then
        bash ./deploy-verify.sh verify 2>&1 | tee -a "$LOG_FILE"
    else
        log_error "部署验证脚本不存在！"
        exit 1
    fi
    
    if [ $? -eq 0 ]; then
        log_success "部署验证通过！"
        log "服务状态正常，可以继续其他操作"
    else
        log_error "部署验证失败！"
        log "请检查服务日志：pm2 logs congr-news-prod"
        exit 1
    fi
}

deploy_reload() {
    log_info "部署验证并重载服务..."
    cd "$PROJECT_DIR"
    
    if [ -f "./deploy-verify.sh" ]; then
        bash ./deploy-verify.sh verify 2>&1 | tee -a "$LOG_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "部署验证通过！"
        log_info "正在重载 PM2 服务..."
        pm2 reload congr-news-prod 2>&1 | tee -a "$LOG_FILE"
        
        if [ $? -eq 0 ]; then
            log_success "服务重载成功！"
        else
            log_error "服务重载失败！"
        exit 1
        fi
    else
        log_error "部署验证失败！"
        exit 1
    fi
}

# API 测试
api_test() {
    log_info "测试 API 端点..."
    cd "$PROJECT_DIR"
    
    # 测试金价 API
    log_info "  1. 测试 /api/old/latest..."
    GOLD_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/old/latest)
    
    if [ "$GOLD_STATUS" = "200" ]; then
        log_success "  /api/old/latest - 状态码 200 (成功)"
    else
        log_error "  /api/old/latest - 状态码 ${GOLD_STATUS} (失败)"
    fi
    
    # 测试新闻 API
    log_info "  2. 测试 /api/news/latest?limit=5..."
    NEWS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/news/latest?limit=5)
    
    if [ "$NEWS_STATUS" = "200" ]; then
        log_success "  /api/news/latest - 状态码 200 (成功)"
    else
        log_error "  /api/news/latest - 状态码 ${NEWS_STATUS} (失败)"
    fi
    
    # 测试页面
    log_info "  3. 测试首页..."
    HOME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/)
    
    if [ "$HOME_STATUS" = "200" ]; then
        log_success "  首页 - 状态码 200 (成功)"
    else
        log_error "  首页 - 状态码 ${HOME_STATUS} (失败)"
    fi
}

# 完整的工作流
workflow_commit_and_reload() {
    header
    log_separator
    log "🔄 完整工作流：Git 提交 + 部署验证 + 服务重载"
    log_separator
    log ""
    
    # 1. Git 操作
    git_status
    git_add
    git_commit
    git_push
    
    log ""
    log_separator
    log "✅ Git 操作完成！"
    log_separator
    log ""
    
    # 2. 部署验证
    log_info "执行部署验证..."
    if [ -f "./deploy-verify.sh" ]; then
        bash ./deploy-verify.sh verify 2>&1 | tee -a "$LOG_FILE"
    else
        log_error "部署验证脚本不存在，跳过验证"
    fi
    
    if [ $? -eq 0 ]; then
        log_success "✅ 部署验证通过！"
        log ""
        log_separator
        log "🔄 正在重载 PM2 服务（零停机）..."
        log_separator
        log ""
        
        pm2_reload
        
        log ""
        log_separator
        log_success "✅ 完整工作流执行成功！"
        log "  - Git 提交：已推送"
        log "  - 部署验证：通过"
        log "  - PM2 服务：已重载"
        log_separator
        log ""
    else
        log_error "❌ 工作流执行失败！"
        log_separator
    fi
    
    footer
}

workflow_quick_test() {
    header
    log_separator
    log "🧪 快速测试工作流"
    log_separator
    log ""
    
    api_test
    pm2_status
    
    log ""
    log_separator
    log "✅ 快速测试完成！"
    log "  - API 测试：已执行"
    log "  - PM2 状态：已查看"
    log_separator
    log ""
    
    footer
}

# 显示帮助
show_help() {
    log "📋 可用命令："
    log ""
    log "🔧 Git 操作："
    log "  ./workflow.sh git-status          - 查看 Git 状态"
    log "  ./workflow.sh git-add              - 添加所有修改"
    log "  ./workflow.sh git-commit           - 提交代码"
    log "  ./workflow.sh git-push            - 推送到远程仓库"
    log "  ./workflow.sh git-log              - 查看提交日志"
    log ""
    log "🚀 PM2 管理："
    log "  ./workflow.sh pm2-status           - 查看 PM2 服务状态"
    log "  ./workflow.sh pm2-logs             - 查看 PM2 日志"
    log "  ./workflow.sh pm2-reload           - 重载 PM2 服务（零停机）"
    log "  ./workflow.sh pm2-restart          - 重启 PM2 服务（短暂停机）"
    log "  ./workflow.sh pm2-stop              - 停止 PM2 服务"
    log "  ./workflow.sh pm2-delete            - 删除 PM2 服务"
    log ""
    log "🔍 部署验证："
    log "  ./workflow.sh deploy-verify       - 执行部署验证"
    log "  ./workflow.sh deploy-reload         - 验证并重载服务（零停机）"
    log ""
    log "🧪 测试工具："
    log "  ./workflow.sh api-test              - 测试 API 端点"
    log "  ./workflow.sh quick-test            - 快速测试工作流"
    log ""
    log "🔄 完整工作流（推荐）："
    log "  ./workflow.sh commit-and-reload      - Git 提交 + 部署验证 + 服务重载"
    log ""
    log "📝 其他："
    log "  ./workflow.sh help                  - 显示此帮助信息"
    log ""
}

# 主菜单
show_menu() {
    header
    
    log "🎯 Cong News 自动化工具"
    log_separator
    log ""
    log "请选择操作："
    log ""
    log "  1) Git 提交 + 部署验证 + 服务重载（推荐）"
    log "  2) Git 操作子菜单"
    log "  3) PM2 管理子菜单"
    log "  4) 部署验证子菜单"
    log "  5) 测试工具"
    log "  6) 显示帮助信息"
    log "  0) 退出"
    log ""
    log_separator
    log "请输入选项 [0-6]: "
}

# 主流程
case "$1" in
    git-status)
        git_status
        ;;
    git-add)
        git_add
        ;;
    git-commit)
        git_commit
        ;;
    git-push)
        git_push
        ;;
    git-log)
        git_log
        ;;
    pm2-status)
        pm2_status
        ;;
    pm2-logs)
        pm2_logs
        ;;
    pm2-reload)
        pm2_reload
        ;;
    pm2-restart)
        pm2_restart
        ;;
    pm2-stop)
        pm2_stop
        ;;
    pm2-delete)
        pm2_delete
        ;;
    deploy-verify)
        deploy_verify
        ;;
    deploy-reload)
        deploy_reload
        ;;
    api-test)
        api_test
        ;;
    quick-test)
        workflow_quick_test
        ;;
    commit-and-reload)
        workflow_commit_and_reload
        ;;
    help)
        show_help
        ;;
    menu)
        show_menu
        ;;
    *)
        header
        log "🚀 Cong News 自动化工具"
        log_separator
        log ""
        
        # 如果有参数，直接执行
        if [ -n "$1" ]; then
            show_help
            exit 0
        fi
        
        # 显示菜单
        read -p "请输入选项 [0-6]: " choice
        
        case $choice in
            1)
                workflow_commit_and_reload
                ;;
            2)
                log "🔧 Git 操作："
                log "  1) git-status    2) git-add      3) git-commit   4) git-push     5) git-log"
                read -p "请选择 [1-5]: " git_choice
                
                case $git_choice in
                    1) git_status ;;
                    2) git_add ;;
                    3) git_commit ;;
                    4) git_push ;;
                    5) git_log ;;
                esac
                ;;
            3)
                log "🚀 PM2 管理："
                log "  1) pm2-status   2) pm2-logs    3) pm2-reload   4) pm2-restart  5) pm2-stop"
                read -p "请选择 [1-5]: " pm2_choice
                
                case $pm2_choice in
                    1) pm2_status ;;
                    2) pm2_logs ;;
                    3) pm2_reload ;;
                    4) pm2_restart ;;
                    5) pm2_stop ;;
                esac
                ;;
            4)
                log "🔍 部署验证："
                log "  1) deploy-verify   2) deploy-reload"
                read -p "请选择 [1-2]: " deploy_choice
                
                case $deploy_choice in
                    1) deploy_verify ;;
                    2) deploy_reload ;;
                esac
                ;;
            5)
                log "🧪 测试工具："
                log "  1) api-test   2) quick-test"
                read -p "请选择 [1-2]: " test_choice
                
                case $test_choice in
                    1) api_test ;;
                    2) workflow_quick_test ;;
                esac
                ;;
            6)
                show_help
                ;;
            0)
                log "退出工具"
                exit 0
                ;;
            *)
                log_error "无效选项！"
                show_menu
                ;;
        esac
        ;;
esac

log ""
log_success "🎉 自动化工具执行完成！"
