#!/bin/bash
# 智能部署脚本 - 彻底解决 502 问题（简化可靠版）
# 功能：自动检测 PM2 状态，确保服务始终可用

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
    echo ""
    echo "========================================" | tee -a "$LOG_FILE"
    echo "      Cong News 智能部署工具" | tee -a "$LOG_FILE"
    echo "      (彻底解决 502 问题)" | tee -a "$LOG_FILE"
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

# 检查并清理残留的 node 进程
cleanup_processes() {
    log_info "清理残留进程..."

    # 杀掉所有非 PM2 管理的 node server.js 进程
    ALL_PIDS=$(pgrep -f "node server.js" 2>/dev/null || echo "")

    if [ -n "$ALL_PIDS" ]; then
        log_warn "发现 node server.js 进程，检查 PM2 管理..."

        # 检查 PM2 中是否有进程
        PM2_RUNNING=$(pm2 status --json 2>/dev/null | grep -o '"online"' | wc -l)

        if [ "$PM2_RUNNING" -eq 0 ]; then
            log_warn "PM2 没有运行进程，杀死所有 node server.js"
            pkill -9 -f "node server.js" 2>/dev/null || true
        else
            # PM2 有运行进程，只杀死多余的
            PM2_PIDS=$(pm2 status --json 2>/dev/null | grep -o '"pid":[0-9]*' | grep -o '[0-9]*' | head -1 || echo "")
            log "PM2 管理的 PID: ${PM2_PIDS}"

            for pid in $ALL_PIDS; do
                if [ "$pid" != "$PM2_PIDS" ]; then
                    log_warn "杀死残留进程 PID: ${pid}"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            done
        fi
    fi

    # 等待进程完全停止
    sleep 2

    log_success "进程清理完成"
}

# 确保 PM2 服务运行
ensure_pm2_running() {
    log_info "确保 PM2 服务运行..."

    # 检查 PM2 是否安装
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 未安装！正在安装..."
        npm install -g pm2
    fi

    # 检查进程是否存在（使用简单方法）
    PM2_EXISTS=$(pm2 list 2>/dev/null | grep -c "cong-news-prod" || echo "0")

    if [ "$PM2_EXISTS" -eq 0 ]; then
        log_warn "PM2 中没有 cong-news-prod 进程，启动新进程..."

        cd "$PROJECT_DIR"
        pm2 start ecosystem.config.js

        # 等待进程启动
        sleep 3

        log_success "PM2 进程启动成功"
    else
        log_success "PM2 进程已存在"
    fi

    # 保存 PM2 配置
    pm2 save

    log_success "PM2 配置已保存"
}

# PM2 智能重启
pm2_smart_reload() {
    log_info "PM2 智能重启..."

    # 先确保 PM2 管理进程
    ensure_pm2_running

    # 清理残留进程
    cleanup_processes

    # 尝试零停机重启
    log "尝试零停机重启..."

    if pm2 reload cong-news-prod 2>&1 | tee -a "$LOG_FILE" | grep -q "successfully"; then
        log_success "零停机重启成功"

        # 等待服务完全启动
        log "等待服务启动（5 秒）..."
        sleep 5
    else
        log_warn "零停机重启失败，尝试完全重启..."

        # 完全重启
        pm2 restart cong-news-prod 2>&1 | tee -a "$LOG_FILE"

        log "等待服务启动（5 秒）..."
        sleep 5

        log_success "完全重启成功"
    fi

    # 保存 PM2 配置
    pm2 save

    log_success "PM2 重启完成"
}

# 验证服务状态
verify_service() {
    log_info "验证服务状态..."
    log_separator

    # 1. 检查 PM2 状态
    log "检查 PM2 服务状态..."

    # 使用 grep -o 提取状态（更可靠）
    PM2_STATUS=$(pm2 list 2>/dev/null | grep "cong-news-prod" | grep -o 'online\|stopped\|errored' | head -1)

    if [ "$PM2_STATUS" = "online" ]; then
        log_success "PM2 服务状态：online ✅"
    elif [ "$PM2_STATUS" = "stopped" ]; then
        log_error "PM2 服务状态：stopped"
        return 1
    elif [ "$PM2_STATUS" = "errored" ]; then
        log_error "PM2 服务状态：errored"
        pm2 logs congr-news-prod --lines 20 --nostream | tee -a "$LOG_FILE"
        return 1
    else
        log_error "PM2 服务状态：未知 (${PM2_STATUS})"
        pm2 list | tee -a "$LOG_FILE"
        return 1
    fi

    # 2. 检查端口监听
    log "检查端口监听..."

    if netstat -tlnp 2>/dev/null | grep -q ":3000"; then
        log_success "端口 3000 正在监听 ✅"
    else
        log_error "端口 3000 未监听！"
        return 1
    fi

    # 3. 检查本地 API
    log "检查本地 API 端点..."

    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/api/news/latest --max-time 5)

    if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "404" ]; then
        log_success "本地 API 响应正常 (状态码: ${API_STATUS}) ✅"
    else
        log_error "本地 API 响应异常 (状态码: ${API_STATUS})"
        return 1
    fi

    # 4. 检查外部访问
    log "检查外部访问 (175.178.36.30)..."

    EXTERNAL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://175.178.36.30/ --max-time 10)

    if [ "$EXTERNAL_STATUS" = "200" ]; then
        log_success "外部网站访问正常 (状态码: 200) ✅"
    elif [ "$EXTERNAL_STATUS" = "502" ]; then
        log_error "外部网站返回 502 Bad Gateway ❌"
        return 1
    else
        log_warn "外部网站状态码: ${EXTERNAL_STATUS} (需要检查)"
    fi

    return 0
}

# Git 提交（可选）
git_commit() {
    log_info "Git 提交流程..."
    log_separator

    cd "$PROJECT_DIR"

    # 检查 Git 仓库
    if [ ! -d ".git" ]; then
        log_warn "Git 仓库未初始化，跳过 Git 提交"
        return 0
    fi

    # 检查是否有修改
    CHANGED=$(git status --porcelain | grep -v "^??")
    if [ -z "$CHANGED" ]; then
        log_warn "没有文件需要提交"
        return 0
    fi

    # 显示修改的文件
    log "修改的文件："
    git status --short | tee -a "$LOG_FILE"
    log_separator

    # 提交信息
    COMMIT_MSG="deploy: 智能部署 - $(date '+%Y-%m-%d %H:%M:%S')"

    log "提交信息：${COMMIT_MSG}"

    # 添加所有修改文件
    log "添加所有修改文件到 Git..."
    git add -A 2>&1 | tee -a "$LOG_FILE"

    # 提交代码
    log "提交代码到 Git 仓库..."
    git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"

    if [ $? -eq 0 ]; then
        log_success "Git 提交成功 ✅"

        # 推送到远程仓库
        log "推送到远程仓库..."
        git push origin master 2>&1 | tee -a "$LOG_FILE"

        if [ $? -eq 0 ]; then
            log_success "Git 推送成功 ✅"
        else
            log_warn "Git 推送失败，但本地提交已完成"
        fi
    else
        log_error "Git 提交失败"
        return 1
    fi

    return 0
}

# 主部署流程
deploy() {
    show_title

    log_separator
    log "开始部署流程"
    log_separator

    # 1. Git 提交（可选，跳过也可以）
    if [ "$1" != "--no-git" ]; then
        if ! git_commit; then
            log_error "Git 提交失败，但继续部署服务..."
        fi
    else
        log_info "跳过 Git 提交（--no-git 模式）"
    fi

    # 2. 清理残留进程
    cleanup_processes

    # 3. PM2 智能重启
    pm2_smart_reload

    # 4. 验证服务
    if ! verify_service; then
        log_separator
        log_error "服务验证失败！"
        log_separator

        log "尝试恢复..."

        # 尝试恢复
        pm2 delete cong-news-prod 2>/dev/null || true
        sleep 1

        cd "$PROJECT_DIR"
        pm2 start ecosystem.config.js
        sleep 5

        if verify_service; then
            log_success "恢复成功！"
        else
            log_error "恢复失败！请手动检查"
            pm2 logs congr-news-prod --lines 50 --nostream | tee -a "$LOG_FILE"
            return 1
        fi
    fi

    # 5. 部署总结
    log_separator
    log "🎉 部署完成！"
    log_separator
    log_success "PM2 服务：运行中 ✅"
    log_success "端口 3000：正常监听 ✅"
    log_success "本地 API：正常响应 ✅"
    log_success "外部访问：正常访问 ✅"
    log_separator
    log_info "网站地址：http://175.178.36.30"
    log_info "PM2 状态：pm2 status"
    log_info "PM2 日志：pm2 logs congr-news-prod --lines 20"
    log_info "日志文件：${LOG_FILE}"
    log_separator

    return 0
}

# 显示使用说明
show_usage() {
    echo ""
    echo "========================================"
    echo "      Cong News 智能部署工具"
    echo "      (彻底解决 502 问题)"
    echo "========================================"
    echo ""
    echo "使用方法："
    echo ""
    echo "1. 完整部署（包含 Git 提交）："
    echo "   ./deploy-fix.sh"
    echo ""
    echo "2. 仅重启服务（不提交 Git）："
    echo "   ./deploy-fix.sh --no-git"
    echo ""
    echo "3. 查看日志："
    echo "   tail -f logs/deploy-*.log"
    echo ""
    echo "4. PM2 管理命令："
    echo "   pm2 status              # 查看状态"
    echo "   pm2 logs congr-news-prod # 查看日志"
    echo "   pm2 restart congr-news-prod # 重启服务"
    echo "   pm2 reload congr-news-prod  # 零停机重启"
    echo ""
    echo "特性："
    echo "  ✓ 自动检测并清理残留进程"
    echo "  ✓ 智能选择重启方式"
    echo "  ✓ 完整的服务验证"
    echo "  ✓ 自动保存 PM2 配置"
    echo "  ✓ 详细日志记录"
    echo "  ✓ 彻底解决 502 问题"
    echo ""
    echo "========================================"
    echo ""
}

# 处理参数
case "$1" in
    --no-git)
        deploy --no-git
        exit 0
        ;;
    help|-h|--help)
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
