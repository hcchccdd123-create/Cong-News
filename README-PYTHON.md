# Cong News - Python API 服务

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-green?style=flat-square)
![SQLite](https://img.shields.io/badge/SQLite-3.45.0-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

</div>

一个现代化的 Python API 服务，使用 FastAPI 框架，提供完整的金价数据查询、新闻聚合和提示词管理功能。

## ✨ 特性

- 🐍 **现代化框架**：FastAPI + Pydantic，自动生成 API 文档
- 🚀 **高性能**：异步支持，自动 API 文档（Swagger/OpenAPI）
- 📊 **完整 API**：金价查询、历史数据、新闻搜索、提示词管理
- 💾 **数据持久化**：SQLite 数据库，完整的历史记录
- 🤖 **AI 分析**：自动生成新闻分析总结
- 🔄 **动态提示词**：支持在线修改，无需重启服务
- 📈 **智能预测**：30分钟金价走势预测算法
- 🎯 **数据过滤**：自动过滤负面新闻，专注正能量内容
- 🐳 **Docker 支持**：完整的 Docker Compose 配置
- 📱 **类型提示**：Pydantic 模型，完整的类型检查

## 🆚 Python 版本 vs Node.js 版本对比

| 特性 | Node.js 版本 | Python 版本 | 说明 |
|------|-------------|-------------|------|
| 框架 | Express.js | FastAPI | Python 版本更现代化 |
| 性能 | 高 | **高** | 两个版本性能相近 |
| 类型提示 | 弱类型 | **强类型** | Pydantic 提供完整类型检查 |
| API 文档 | 需要手动生成 | **自动生成** | Python 版本自动生成 OpenAPI 文档 |
| 数据库 | SQLite3 | SQLite3 | 两个版本使用相同数据库 |
| AI 分析 | JavaScript | **Python** | 更适合数据分析和 AI 集成 |
| 部署难度 | 中等 | 简单 | Python 版本部署更简单 |
| 开发体验 | 热重载慢 | **热重载快** | Python 版本开发体验更好 |

## 📋 需求分析

基于你的需求，Python 版本实现了：

### 1. ✅ 新闻查询存储到数据库
- 新闻数据持久化存储在 SQLite 中
- 支持完整的历史查询和搜索
- 不实时查询，从数据库读取（性能更好）

### 2. ✅ 提示词动态更新
- 提示词存储在数据库中
- 支持通过 API 动态更新
- 每次修改都会保存历史版本
- 无需重启服务即可生效

### 3. ✅ AI 分析总结
- 每条新闻自动生成 AI 分析总结
- 智能分类（金融、科技、宏观等）
- 情感分析（中性、正面、负面）
- 展示在新闻卡片上

### 4. ✅ 完整的项目文件
- 所有代码都已准备好上传 GitHub
- 包含完整的文档和部署指南

## 🚀 快速开始

### 方法 1: 本地开发（Python）

```bash
# 1. 安装 Python 依赖
cd /root/.openclaw/workspace/old-news-site
pip install -r requirements.txt

# 2. 启动 Python API 服务
uvicorn api:app --host 0.0.0.0 --port 8000

# 3. 访问 API 文档
open http://localhost:8000/docs
```

### 方法 2: 使用 Docker（推荐）

```bash
# 1. 启动所有服务（包括 Python API）
cd /root/.openclaw/workspace/old-news-site
docker-compose up -d

# 2. 查看服务状态
docker-compose ps

# 3. 查看日志
docker-compose logs -f python-backend

# 4. 停止所有服务
docker-compose down
```

## 📊 项目结构（Python API）

```
old-news-site/
├── api.py                  # Python FastAPI 主服务
├── requirements.txt          # Python 依赖
├── Dockerfile-python        # Python Docker 镜像
├── docker-compose.yml        # 完整的服务编排配置
├── README-PYTHON.md        # 本文档（Python API 说明）
├── docs/                   # 文档目录
│   ├── API-PYTHON.md        # Python API 详细文档
│   └── DEPLOYMENT-PYTHON.md # Python 版本部署指南
└── data.db                 # SQLite 数据库（共享）
```

## 🔌 配置

### 环境变量

Python API 使用以下环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_PATH` | 数据库文件路径 | `./data.db` |
| `PROMPTS_FILE` | 提示词配置文件路径 | `./prompts.txt` |
| `TAVILY_API_KEY` | Tavily API 密钥 | - |
| `TAVILY_API_BASE` | Tavily API 地址 | `https://api.tavily.com` |

### 提示词配置

Python API 与 Node.js 版本使用相同的提示词文件 `prompts.txt`，包含三个部分：

1. **金价搜索提示词**：控制如何搜索黄金价格数据
2. **新闻搜索提示词**：控制新闻搜索策略和过滤规则
3. **预测分析提示词**：控制 AI 如何生成价格预测

## 📡 Python API 接口

### 基础接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 服务状态和端点列表 |
| `/docs` | GET | 自动生成的 Swagger/OpenAPI 文档 |
| `/api/health` | GET | 健康检查端点 |

### 金价相关接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/gold/latest` | GET | 获取最新金价和预测数据 |
| `/api/gold/history` | GET | 获取最近 30 天历史金价 |

### 新闻相关接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/news/latest` | GET | 获取最新 10 条新闻（含 AI 分析） |
| `/api/news/search` | GET | 搜索新闻（支持标题、摘要、AI 分析） |

### 提示词管理接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/prompts` | GET | 获取当前提示词配置（从数据库） |
| `/api/prompts` | POST | 更新提示词配置（同时写入数据库） |
| `/api/prompts/history` | GET | 获取提示词历史记录 |

### 系统接口

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/update` | POST | 手动触发数据更新 |

### API 文档

启动服务后，访问 `http://localhost:8000/docs` 查看**完整的交互式 API 文档**（Swagger UI）。

## 🎯 核心功能实现

### 1. 数据库类设计

```python
class Database:
    def get_latest_gold_price()      # 获取最新金价
    def get_gold_price_history()     # 获取历史金价
    def get_latest_news()           # 获取最新新闻
    def search_news()              # 搜索新闻
    def get_current_prompts()       # 获取当前提示词
    def update_prompts()            # 更新提示词
    def get_prompts_history()       # 获取提示词历史
```

### 2. Pydantic 数据模型

```python
class NewsItem(BaseModel):        # 新闻项模型
class GoldPrice(BaseModel):     # 金价模型
class PromptHistory(BaseModel):    # 提示词历史模型
class PromptUpdate(BaseModel):    # 提示词更新模型
class ApiResponse(BaseModel):      # API 响应模型
```

### 3. AI 分析生成

```python
def generate_ai_summary(news_item: dict) -> dict:
    # 分析新闻类型（金融、科技、宏观等）
    # 时间分析（是否交易时段）
    # 影响判断（市场关注度）
    # 生成分析总结
```

### 4. 预测数据生成

```python
def generate_forecast_data(current_price: float) -> dict:
    # 生成 30 分钟预测数据
    # 每 10 分钟一个数据点
    # 计算趋势、波动幅度、关键价格点
    # 生成预测分析总结
```

### 5. 新闻过滤

```python
def filter_news(news_items: List[dict]) -> List[dict]:
    # 过滤负面关键词
    # 禁止对中国产生负面影响的新闻
    # 返回过滤后的新闻列表
```

## 🐳 Docker 部署

### 完整的服务架构

`docker-compose.yml` 定义了以下服务：

1. **python-backend**: Python FastAPI 服务（端口 8000）
2. **node-backend**: Node.js Express 服务（端口 3000）
3. **database**: Alpine 数据库服务（仅数据持久化）
4. **nginx**: Nginx 反向代理（端口 80/443）

### 启动所有服务

```bash
# 启动 Python API + Node.js 前端 + 数据库 + Nginx
docker-compose up -d

# 查看所有服务状态
docker-compose ps

# 查看 Python 服务日志
docker-compose logs -f python-backend
```

### 仅启动 Python API

```bash
# 仅启动 Python 服务
docker-compose up -d python-backend

# 查看 Python 服务日志
docker-compose logs -f python-backend
```

### 扩展服务（多实例）

```bash
# 启动 3 个 Python 实例（负载均衡）
docker-compose up -d --scale python-backend=3
```

## 📊 数据更新机制

### 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 金价 + 新闻完整更新 | 每 2 小时 | 搜索最新数据，更新数据库 |
| 新闻单独更新 | 每 1 小时 | 仅更新新闻数据 |
| 系统监控 | 每 10 分钟 | 检查服务健康状态 |

### 手动更新

```bash
# 前端刷新：点击右上角"刷新数据"按钮
# API 调用：POST /api/update
# 服务器日志：查看 `server.log` 文件
```

## 📋 GitHub 上传准备

### ✅ 已创建的文件

**核心服务文件：**
1. ✅ `api.py` - Python FastAPI 主服务（28 KB）
2. ✅ `requirements.txt` - Python 依赖
3. ✅ `Dockerfile-python` - Python Docker 镜像
4. ✅ `docker-compose.yml` - 完整服务编排（包含 Python 版本）
5. ✅ `.env.example` - 环境变量模板

**前端文件（共享）：**
- ✅ `server.js` - Node.js Express 服务
- ✅ `package.json` - Node.js 依赖
- ✅ `public/index.html` - 前端页面
- ✅ `prompts.txt` - 提示词配置文件（Python 和 Node.js 共享）

**数据库文件（不提交到 Git）：**
- ⚠️ `data.db` - SQLite 数据库（需要在 `.gitignore` 中）

**文档文件：**
- ✅ `README.md` - 项目主文档
- ✅ `README-PYTHON.md` - Python 版本文档（本文件）
- ✅ `LICENSE` - MIT 开源许可
- ✅ `.gitignore` - Git 忽略配置

### 📦 需要上传到 GitHub 的文件清单

```
old-news-site/
├── api.py                  # Python FastAPI 服务
├── server.js               # Node.js Express 服务
├── requirements.txt          # Python 依赖
├── package.json             # Node.js 依赖
├── public/
│   └── index.html          # 前端页面
├── prompts.txt              # 提示词配置（重要）
├── Dockerfile-python        # Python Docker 镜像
├── docker-compose.yml        # Docker Compose 配置
├── Dockerfile               # Node.js Docker 镜像（可选）
├── README.md               # 主 README
├── README-PYTHON.md       # Python 版本说明
├── LICENSE                 # MIT 许可证
├── .gitignore              # Git 忽略配置
├── .env.example             # 环境变量示例
└── docs/                   # 文档目录
    ├── API.md                # API 文档
    ├── API-PYTHON.md         # Python API 详细文档
    ├── DEPLOYMENT.md         # 通用部署指南
    └── DEPLOYMENT-PYTHON.md  # Python 部署指南
```

## 🎯 下一步：上传到 GitHub

### 步骤 1：创建 GitHub 仓库

```bash
# 1. 在 GitHub 上创建新仓库
# 仓库名：old-news-site
# 描述：热点新闻 & 金价追踪网站（Python + Node.js 双版本）
# 许可：MIT
# 选择：Public（开源）
# 不要初始化 README 或 .gitignore
```

### 步骤 2：初始化 Git 仓库

```bash
# 进入项目目录
cd /root/.openclaw/workspace/old-news-site

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 检查状态
git status
```

### 步骤 3：提交代码

```bash
# 创建初始提交
git commit -m "feat: 完整的双版本实现 (Python + Node.js)

- Python API: FastAPI + SQLite + 完整类型提示
- Node.js 后端: Express + SQLite
- 前端: 现代化 UI + ECharts 图表 + 响应式设计
- 功能: 金价追踪、新闻聚合、AI 分析、提示词管理
- 部署: Docker Compose 完整配置
- 文档: 完整的 API 文档和部署指南"
```

### 步骤 4：连接到 GitHub

```bash
# 添加远程仓库
git remote add origin https://github.com/yourusername/old-news-site.git

# 或使用 SSH（推荐）
git remote add origin git@github.com:yourusername/old-news-site.git
```

### 步骤 5：推送到 GitHub

```bash
# 推送到主分支
git push -u origin main

# 如果远程分支名称不同
git push -u origin master
```

### 步骤 6：验证上传

访问你的 GitHub 仓库，确认：
- ✅ 所有文件都已上传
- ✅ README.md 正确显示
- ✅ LICENSE 文件存在
- ✅ API 文档已包含

## 🔧 使用两种 API 服务

### Python API (推荐用于后端查询）

```bash
# 启动 Python API
uvicorn api:app --host 0.0.0.0 --port 8000

# 查看自动生成的 API 文档
open http://localhost:8000/docs

# 获取最新金价
curl http://localhost:8000/api/gold/latest

# 获取最新新闻
curl http://localhost:8000/api/news/latest

# 搜索新闻
curl http://localhost:8000/api/news/search?q=黄金

# 获取提示词
curl http://localhost:8000/api/prompts

# 更新提示词
curl -X POST http://localhost:8000/api/prompts \\
  -H "Content-Type: application/json" \\
  -d '{"news": "新的新闻搜索提示词"}'
```

### Node.js API (前端使用）

```bash
# 启动 Node.js 服务
node server.js

# 获取最新金价
curl http://localhost:3000/api/gold/latest

# 获取最新新闻
curl http://localhost:3000/api/news/latest
```

### 使用 Docker Compose（推荐）

```bash
# 启动所有服务（Python + Node.js + 数据库 + Nginx）
docker-compose up -d

# 查看所有服务
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启特定服务
docker-compose restart python-backend
docker-compose restart node-backend
docker-compose restart nginx

# 停止所有服务
docker-compose down
```

## 📝 提示词管理（Python 和 Node.js 共享）

### 查看当前提示词

两种 API 服务的 `/api/prompts` 接口都会从 `prompts.txt` 文件读取提示词。

### 更新提示词

通过 Python API 的 `POST /api/prompts` 接口更新：

```bash
curl -X POST http://localhost:8000/api/prompts \\
  -H "Content-Type: application/json" \\
  -d '{
    "gold_price": "新的金价搜索提示词内容",
    "news": "新的新闻搜索提示词内容",
    "forecast": "新的预测分析提示词内容"
  }'
```

更新后：
1. 提示词保存到数据库（Python）
2. 提示词保存到文件（Python 和 Node.js 共享）
3. 两种 API 服务都会重新读取新提示词
4. 前端刷新后可以看到更新后的提示词

## 📊 数据库设计（完整）

### 金价表 (gold_prices)

```sql
CREATE TABLE gold_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    price_usd REAL NOT NULL,
    price_cny REAL,
    change_1d REAL,
    forecast TEXT,
    forecast_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 新闻表 (news_items)

```sql
CREATE TABLE news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    summary TEXT,
    ai_summary TEXT,
    category TEXT,
    sentiment TEXT,
    source TEXT,
    published_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 提示词历史表 (prompts_history)

```sql
CREATE TABLE prompts_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_type TEXT NOT NULL,
    prompt_content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 当前提示词表 (current_prompts)

```sql
CREATE TABLE current_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_type TEXT PRIMARY KEY,
    prompt_content TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🧪 测试

### 测试 Python API

```bash
# 安装依赖
pip install -r requirements.txt

# 启动测试服务器
uvicorn api:app --reload --host 0.0.0.0 --port 8000

# 自动化测试（Python pytest）
# pytest tests/

# 手动测试
curl http://localhost:8000/api/health
curl http://localhost:8000/api/gold/latest
curl http://localhost:8000/api/news/latest
```

### 测试 Docker 部署

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 健康检查
curl http://localhost/8000/api/health

# 查看日志
docker-compose logs -f
```

## 📖 完整文档目录

- [README.md](README.md) - 项目主文档
- [docs/API.md](docs/API.md) - 通用 API 文档
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - 通用部署指南

## 🤝 贡献

欢迎贡献代码、报告 Bug 或提出新功能！

### 开发流程

1. Fork 本仓库
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源。

---

<div align="center">
  <b>Cong News</b> - Python + Node.js 双版本
</div>
