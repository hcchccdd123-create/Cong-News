# Cong News - 热点新闻 & 金价追踪

<div align="center">

![Cong News](https://img.shields.io/badge/Version-1.0.0-brightgreen?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-22.22.0-brightgreen?style=flat-square)
![Express](https://img.shields.io/badge/Express-4.18-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)

</div>

一个现代化的热点新闻追踪网站，提供实时金价数据、市场预测和热点新闻聚合功能。

## ✨ 特性

- 📊 **实时金价追踪**：国际金价（美元/盎司）+ 市场预测
- 📈 **30分钟走势预测**：基于 AI 的黄金价格趋势预测
- 📰 **热点新闻聚合**：智能过滤，专注正能量新闻
- 🤖 **AI 智能分析**：每条新闻附带 AI 分析总结
- 🔄 **自动更新**：每 2 小时自动更新数据
- 💾 **数据持久化**：SQLite 数据库存储历史数据
- 🎨 **现代 UI 设计**：基于 ui-ux-pro-max 设计理念
- 📱 **响应式设计**：完美适配手机、平板、桌面
- ⚙️ **动态提示词**：支持在线修改提示词配置

## 🚀 快速开始

### 前置要求

- Node.js >= 22.x
- npm >= 9.x
- Linux/macOS/Windows

### 安装

```bash
# 克隆项目
git clone https://github.com/yourusername/old-news-site.git
cd old-news-site

# 安装依赖
npm install

# 启动服务器
npm start

# 开发模式（支持热重载）
npm run dev
```

服务器将在 http://localhost:3000 启动

## 📁 项目结构

```
old-news-site/
├── server.js              # Express 服务器主文件
├── package.json           # 项目配置和依赖
├── prompts.txt             # 提示词配置文件（可在线编辑）
├── data.db                 # SQLite 数据库（自动创建）
├── public/                 # 静态资源目录
│   ├── index.html         # 前端页面（单页应用）
│   ├── assets/            # 静态资源（图片、图标等）
└── docs/                   # 文档目录
    ├── API.md             # API 接口文档
    └── DEPLOYMENT.md      # 部署指南
```

## 🔌 配置

### 环境变量

创建 `.env` 文件（可选）：

```env
# 服务器端口
PORT=3000

# Tavily API 配置
TAVILY_API_KEY=tvly-dev-your-api-key
TAVILY_API_BASE=https://api.tavily.com
```

### 提示词配置

提示词存储在 `prompts.txt` 文件中，包含三个部分：

1. **金价搜索提示词**：控制如何搜索黄金价格数据
2. **新闻搜索提示词**：控制新闻搜索策略和过滤规则
3. **预测分析提示词**：控制 AI 如何生成价格预测

**在线修改提示词**：
1. 访问网站
2. 点击左上角"提示词"按钮
3. 查看当前提示词配置
4. 通过 API 更新提示词

**提示词历史**：
- 所有提示词变更都会记录到数据库
- 可以查询历史版本
- 支持版本回滚

## 📡 API 接口

### 金价相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/gold/latest` | GET | 获取最新金价和预测数据 |
| `/api/gold/history` | GET | 获取最近 30 天历史金价 |
| `/api/news/latest` | GET | 获取最新 10 条新闻（含 AI 分析） |
| `/api/news/search` | GET | 搜索新闻（支持标题、摘要、AI 分析） |
| `/api/prompts` | GET | 获取当前提示词配置 |
| `/api/prompts/history` | GET | 获取提示词历史记录 |
| `/api/prompts` | POST | 更新提示词配置 |
| `/api/update` | POST | 手动触发数据更新 |

**详细 API 文档**：请查看 [docs/API.md](docs/API.md)

## 🎯 核心功能

### 1. 金价追踪

**数据来源**：
- Tavily Search API
- 上海黄金交易所
- 国际金价市场数据

**预测算法**：
- 基于历史价格波动模式
- 模拟 30 分钟内的时间点预测
- 每 10 分钟一个数据点

**更新频率**：
- 金价数据：每 2 小时自动更新
- 新闻数据：每 1 小时自动更新
- 手动刷新：点击右上角"刷新数据"按钮

### 2. 新闻聚合

**数据来源**：
- Tavily Search API
- 多个权威新闻源

**过滤策略**：
- 自动过滤对中国产生负面影响的新闻
- 关键词过滤：负面、批评、冲突等
- 优先展示：财经、科技、国际合作等正面新闻

**AI 分析功能**：
- 自动分析新闻类型（金融、科技、宏观经济等）
- 生成简短的分析总结
- 标记情感倾向（正面/中性）

### 3. 提示词系统

**动态配置**：
- 支持通过 API 实时修改
- 修改后无需重启服务器
- 自动保存历史版本

**三个提示词类型**：

1. **金价搜索提示词**
   - 控制搜索策略
   - 指定数据源优先级
   - 设置分析重点

2. **新闻搜索提示词**
   - 定义新闻领域（金融、科技等）
   - 设置过滤规则
   - 优先级排序

3. **预测分析提示词**
   - 控制预测算法参数
   - 设置时间间隔
   - 指定输出格式

## 📱 前端特性

### UI 设计

- **现代 SaaS 风格**：参考 Stripe、Linear 等顶级产品设计
- **配色方案**：专业蓝色主色调 + 浅色背景
- **排版优化**：Inter 字体 + 完美间距
- **响应式布局**：手机/平板/桌面自适应

### 交互体验

- **平滑动画**：fade-in、stagger 效果
- **悬停反馈**：卡片上浮 + 阴影增强
- **加载状态**：优雅的 spinner 动画
- **模态弹窗**：提示词查看窗口

### ECharts 图表

- **30 分钟预测曲线**：平滑的折线图 + 区域填充
- **交互式提示框**：鼠标悬停显示详细信息
- **响应式图表**：自动适配屏幕尺寸
- **渐变配色**：蓝色渐变填充

## 🗄️ 数据库设计

### 金价表 (gold_prices)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 ID |
| date | TEXT | 日期（唯一索引） |
| price_usd | REAL | 国际金价（美元/盎司） |
| price_cny | REAL | 国内金价（人民币/克） |
| change_1d | REAL | 相比昨日变化百分比 |
| forecast | TEXT | 预测分析总结 |
| forecast_data | TEXT | 预测数据（JSON 格式） |
| created_at | TIMESTAMP | 创建时间 |

### 新闻表 (news_items)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 ID |
| title | TEXT | 新闻标题 |
| url | TEXT | 新闻链接（唯一索引） |
| summary | TEXT | 新闻摘要 |
| ai_summary | TEXT | AI 分析总结 |
| category | TEXT | 分类 |
| sentiment | TEXT | 情感倾向 |
| source | TEXT | 数据源 |
| published_date | TEXT | 发布日期 |
| created_at | TIMESTAMP | 创建时间 |

### 提示词历史表 (prompts_history)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 ID |
| prompt_type | TEXT | 提示词类型 |
| prompt_content | TEXT | 提示词内容 |
| version | INTEGER | 版本号 |
| created_at | TIMESTAMP | 创建时间 |

### 当前提示词表 (current_prompts)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 ID |
| prompt_type | TEXT | 提示词类型（主键） |
| prompt_content | TEXT | 提示词内容 |
| updated_at | TIMESTAMP | 更新时间 |

## 🔧 开发

### 启动开发服务器

```bash
# 安装依赖
npm install

# 启动开发服务器（支持热重载）
npm run dev
```

### 项目依赖

- **express**: Web 框架
- **sqlite3**: SQLite 数据库
- **node-cron**: 定时任务
- **cors**: 跨域支持

### 测试

```bash
# 运行测试
npm test

# 手动触发更新
curl -X POST http://localhost:3000/api/update

# 获取最新金价
curl http://localhost:3000/api/gold/latest

# 获取最新新闻
curl http://localhost:3000/api/news/latest?limit=10
```

## 📦 部署

详细部署指南请查看 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

### 快速部署（Linux）

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/old-news-site.git
cd old-news-site

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的配置

# 4. 启动服务
npm start

# 5. 使用 PM2 管理（推荐）
npm install -g pm2
pm2 start server.js --name "old-news-site"
pm2 save
pm2 startup
```

### 使用 Docker 部署

```bash
# 构建镜像
docker build -t old-news-site .

# 运行容器
docker run -p 3000:3000 old-news-site

# 使用 docker-compose
docker-compose up -d
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## 📊 数据更新机制

### 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 金价 + 新闻完整更新 | 每 2 小时 | 搜索最新数据，更新数据库 |
| 新闻单独更新 | 每小时 | 仅更新新闻数据 |
| 系统监控 | 每 10 分钟 | 检查服务健康状态 |

### 手动更新

- **前端刷新**：点击右上角"刷新数据"按钮
- **API 调用**：`POST /api/update`
- **服务器日志**：查看 `server.log` 文件

## 🤝 贡献

欢迎贡献代码、报告 Bug 或提出新功能！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 代码规范

- 使用 2 空格缩进
- 遵循 ESLint 配置
- 添加适当的注释
- 编写清晰的提交消息

## 📄 许可证

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Tavily Search API](https://tavily.com/) - 提供强大的搜索服务
- [ECharts](https://echarts.apache.org/) - 优秀的数据可视化库
- [Tailwind CSS](https://tailwindcss.com/) - 实用的 CSS 框架
- [ui-ux-pro-max](https://github.com/yourusername/ui-ux-pro-max) - 设计理念参考

## 📧 常见问题

### 数据不准确怎么办？

- 检查 Tavily API Key 是否有效
- 查看服务器日志了解数据获取过程
- 可以通过 API 更新提示词来优化搜索策略

### 如何增加新闻源？

- 编辑 `prompts.txt` 文件中的新闻搜索提示词
- 添加新的数据源或搜索关键词
- 刷新网站即可看到效果

### 数据库文件在哪里？

- 默认位置：`./data.db`（项目根目录）
- 备份建议：定期备份数据库文件
- 清空数据：删除 `data.db` 文件后重启服务器

### 如何修改更新频率？

- 编辑 `server.js` 文件中的 cron 任务配置
- `0 */2 * * *` - 每 2 小时
- `0 * * * *` - 每小时
- 重启服务器使配置生效

## 📧 联系方式

- **问题反馈**：[GitHub Issues](https://github.com/yourusername/old-news-site/issues)
- **功能建议**：[GitHub Discussions](https://github.com/yourusername/old-news-site/discussions)
- **安全问题**：通过私有渠道报告

## 📄 许可证

[MIT License](LICENSE)

Copyright (c) 2026 Cong News

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

<div align="center">
  <b>Cong News</b> - 让信息更清晰
</div>
