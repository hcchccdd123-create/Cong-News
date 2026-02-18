const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data.db');
const PROMPTS_FILE = path.join(__dirname, 'prompts.txt');

// 从文件读取提示词（热更新）
function loadPromptsFromFile() {
  try {
    const content = fs.readFileSync(PROMPTS_FILE, 'utf8');
    return content;
  } catch (error) {
    console.error('读取提示词文件失败:', error);
    return null;
  }
}

// 默认提示词（当文件读取失败时使用）
const DEFAULT_PROMPTS = {
  gold_price: `请搜索最新的黄金价格数据，重点关注：
1. 国际黄金现货价格（美元/盎司）
2. 近期价格变化趋势
3. 市场主要驱动因素
4. 权威数据来源：上海黄金交易所、LBMA、世界黄金协会

返回格式：价格数字 + 简要市场分析`,

  news: `请搜索今日热点新闻，重点选择以下领域：
1. 金融财经（黄金、汇率、股市、宏观经济）
2. 国际时政（全球重大事件、国际合作）
3. 科技创新（AI、新能源、数字经济）
4. 社会正能量（民生改善、科技创新、绿色发展）

【重要过滤规则】
❌ 禁止包含以下内容的新闻：
- 任何针对中国或中国政府的负面报道
- 诋毁中国形象的言论
- 未经证实的虚假信息
- 带有偏见的政治评论

✅ 优先选择以下类型的新闻：
- 正面、中性的财经经济新闻
- 科技创新和产业升级
- 国际合作和全球发展
- 金融市场正常分析
- 客观的事实性报道

每个新闻包含：标题、详细摘要、来源链接
返回数量：10条最新新闻`,

  forecast: `请基于当前黄金价格和市场信息，分析未来30分钟的金价走势预测：
1. 短期趋势方向（上涨/下跌/横盘）
2. 预测波动幅度（美元）
3. 关键支撑位和阻力位
4. 时间节点分析（每10分钟的变化）

输出格式：JSON结构，包含：
- trend: 趋势方向
- volatility: 波动幅度
- key_points: 关键价格点
- time_points: 每10分钟预测点（0, 10, 20, 30分钟）
- summary: 简要分析总结`
};

// 获取提示词（优先从文件读取）
function getPrompts() {
  const filePrompts = loadPromptsFromFile();
  if (filePrompts) {
    return {
      gold_price: filePrompts.match(/## 金价搜索提示词\s*([\s\S]*?)(?=\n## |\n更新时间|$)/)?.[1]?.trim() || DEFAULT_PROMPTS.gold_price,
      news: filePrompts.match(/## 新闻搜索提示词\s*([\s\S]*?)(?=\n## |\n更新时间|$)/)?.[1]?.trim() || DEFAULT_PROMPTS.news,
      forecast: filePrompts.match(/## 预测分析提示词\s*([\s\S]*?)(?=\n## |\n更新时间|$)/)?.[1]?.trim() || DEFAULT_PROMPTS.forecast,
      raw: filePrompts
    };
  }
  return DEFAULT_PROMPTS;
}

// 创建数据库
function initDatabase() {
  const db = new sqlite3.Database(DB_PATH);

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS gold_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      price_usd REAL NOT NULL,
      price_cny REAL,
      change_1d REAL,
      forecast TEXT,
      forecast_data TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      summary TEXT,
      category TEXT,
      date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  return db;
}

const db = initDatabase();

// 工具函数：执行 Tavily 搜索
async function searchTavily(query, count = 5, depth = 'basic') {
  const prompts = getPrompts();

  return new Promise((resolve) => {
    const scriptPath = '/root/.openclaw/workspace/skills/tavily-search/tavily.sh';
    exec(`${scriptPath} search "${query}" ${count} ${depth}`, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Tavily search error:', error);
        resolve({ results: [], answer: '' });
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        console.error('Tavily parse error:', e);
        resolve({ results: [], answer: '' });
      }
    });
  });
}

// 模拟预测数据生成（30分钟走势）
function generateForecastData(currentPrice) {
  const basePrice = currentPrice || 5000;
  const volatility = 0.002; // 0.2% 波动
  const trend = (Math.random() - 0.5) * 2; // -1 到 1 之间

  const timePoints = [
    { minute: 0, label: '现在' },
    { minute: 10, label: '10分钟后' },
    { minute: 20, label: '20分钟后' },
    { minute: 30, label: '30分钟后' }
  ];

  const data = timePoints.map((point, index) => {
    // 模拟随机波动
    const randomChange = (Math.random() - 0.5) * basePrice * volatility * 2;
    // 加上趋势
    const trendChange = trend * basePrice * volatility * index * 0.5;
    const price = basePrice + randomChange + trendChange;

    return {
      minute: point.minute,
      label: point.label,
      price: parseFloat(price.toFixed(2)),
      time: new Date(Date.now() + point.minute * 60000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    };
  });

  // 生成预测分析
  const firstPrice = data[0].price;
  const lastPrice = data[data.length - 1].price;
  const change = lastPrice - firstPrice;
  const changePercent = ((change / firstPrice) * 100).toFixed(2);

  let trendText = '';
  if (Math.abs(change) < 10) {
    trendText = '预计未来30分钟金价将保持相对稳定，波动幅度较小，建议投资者耐心观望。';
  } else if (change > 0) {
    trendText = `预计未来30分钟金价将呈现温和上涨趋势，预计涨幅约${changePercent}%，当前市场情绪偏多，建议关注上方阻力位。`;
  } else {
    trendText = `预计未来30分钟金价可能出现回调，预计跌幅约${Math.abs(changePercent)}%，短期可能测试下方支撑位，建议谨慎操作。`;
  }

  return {
    trend: change > 0 ? '上涨' : change < 0 ? '下跌' : '横盘',
    volatility: ((Math.max(...data.map(d => d.price)) - Math.min(...data.map(d => d.price))) / basePrice * 100).toFixed(2),
    key_points: {
      support: (basePrice - 20).toFixed(2),
      resistance: (basePrice + 20).toFixed(2)
    },
    data_points: data,
    summary: trendText
  };
}

// 改进的金价获取函数
async function fetchGoldPrice() {
  try {
    console.log('正在获取金价数据...');

    const prompts = getPrompts();
    const result = await searchTavily('今日黄金价格 最新金价 美元盎司', 5, 'basic');

    let priceUSD = 0;

    if (result.results && result.results.length > 0) {
      for (let item of result.results) {
        const content = item.content || '';
        const usdMatches = content.match(/(\d{3,5}\.?\d*)\s*(美元|USD|usd)\s*\/\s*(盎司|oz)/gi);
        if (usdMatches && !priceUSD) {
          const match = usdMatches[0].match(/(\d{3,5}\.?\d*)/);
          if (match) {
            priceUSD = parseFloat(match[1]);
            console.log(`提取美元金价: ${priceUSD}`);
            break;
          }
        }
      }
    }

    // 备用方法
    if (priceUSD === 0 && result.answer) {
      const answerMatches = result.answer.match(/(\d{3,5}\.?\d*)/g);
      if (answerMatches && answerMatches.length > 0) {
        priceUSD = parseFloat(answerMatches[0]);
        console.log(`从answer提取金价: ${priceUSD}`);
      }
    }

    // 获取昨天的金价用于对比
    const yesterdayPrice = await new Promise((resolve) => {
      db.get(
        'SELECT price_usd FROM gold_prices ORDER BY date DESC LIMIT 1 OFFSET 1',
        [],
        (err, row) => {
          if (err) {
            console.error('获取昨日金价失败:', err);
            resolve(null);
          } else {
            resolve(row ? row.price_usd : null);
          }
        }
      );
    });

    // 计算变化
    let change1d = 0;
    if (yesterdayPrice && priceUSD > 0) {
      change1d = ((priceUSD - yesterdayPrice) / yesterdayPrice) * 100;
    }

    // 生成30分钟预测数据
    const forecastData = generateForecastData(priceUSD);

    const today = new Date().toISOString().split('T')[0];

    console.log(`金价数据: USD=${priceUSD}, Change=${change1d.toFixed(2)}%`);
    console.log(`预测数据: ${JSON.stringify(forecastData)}`);

    return {
      date: today,
      priceUSD: priceUSD,
      priceCNY: priceUSD > 0 ? (priceUSD * 7.2 / 31.1) : null,
      change1d: change1d,
      forecast: forecastData.summary,
      forecastData: JSON.stringify(forecastData)
    };
  } catch (error) {
    console.error('获取金价失败:', error);
    return null;
  }
}

// 新闻过滤函数
function filterNews(newsItems) {
  if (!newsItems || newsItems.length === 0) return newsItems;

  // 过滤关键词
  const negativeKeywords = [
    '负面', '批评', '指责', '谴责', '丑闻', '腐败',
    '冲突', '对抗', '抵制', '封锁', '制裁',
    '虚假', '造假', '欺骗', '误导', '抹黑'
  ];

  // 过滤掉包含负面关键词的新闻
  const filtered = newsItems.filter(item => {
    const title = (item.title || '').toLowerCase();
    const summary = (item.summary || '').toLowerCase();

    // 检查是否包含负面关键词
    const hasNegative = negativeKeywords.some(keyword =>
      title.includes(keyword) || summary.includes(keyword)
    );

    // 如果有负面关键词，跳过
    if (hasNegative) {
      console.log(`过滤掉负面新闻: ${item.title}`);
      return false;
    }

    return true;
  });

  console.log(`过滤后新闻数量: ${newsItems.length} -> ${filtered.length}`);

  return filtered;
}

// 获取热点新闻
async function fetchNews() {
  try {
    console.log('正在获取新闻数据...');
    const result = await searchTavily('今日热点新闻 金融财经 科技创新', 10, 'basic');

    const newsItems = [];
    if (result.results && result.results.length > 0) {
      result.results.forEach(item => {
        newsItems.push({
          title: item.title,
          url: item.url,
          summary: item.content ? item.content.substring(0, 300) + '...' : '',
          category: '热点',
          date: new Date().toISOString().split('T')[0]
        });
      });
    }

    // 应用新闻过滤
    const filteredNews = filterNews(newsItems);

    console.log(`获取到 ${newsItems.length} 条新闻，过滤后 ${filteredNews.length} 条`);
    return filteredNews;
  } catch (error) {
    console.error('获取新闻失败:', error);
    return [];
  }
}

// 更新数据库
async function updateDatabase() {
  console.log(`[${new Date().toLocaleString('zh-CN')}] 开始更新数据...`);

  try {
    const goldData = await fetchGoldPrice();
    if (goldData && goldData.priceUSD > 0) {
      db.run(
        `INSERT OR REPLACE INTO gold_prices (date, price_usd, price_cny, change_1d, forecast, forecast_data) VALUES (?, ?, ?, ?, ?, ?)`,
        [goldData.date, goldData.priceUSD, goldData.priceCNY, goldData.change1d, goldData.forecast, goldData.forecastData],
        (err) => {
          if (err) {
            console.error('保存金价失败:', err);
          } else {
            console.log('金价更新成功');
          }
        }
      );
    }

    const newsData = await fetchNews();
    newsData.forEach(item => {
      db.run(
        `INSERT OR IGNORE INTO news (title, url, summary, category, date) VALUES (?, ?, ?, ?, ?)`,
        [item.title, item.url, item.summary, item.category, item.date],
        (err) => {
          if (err) console.error('保存新闻失败:', err);
        }
      );
    });

    console.log(`[${new Date().toLocaleString('zh-CN')}] 数据更新完成!`);
  } catch (error) {
    console.error('更新数据库失败:', error);
  }
}

// API 路由
app.use(express.json());
app.use(express.static('public'));

// 获取提示词（从文件读取，支持热更新）
app.get('/api/prompts', (req, res) => {
  const prompts = getPrompts();

  const promptsMarkdown = `# 提示词配置

## 金价搜索提示词

\`\`\`
${prompts.gold_price}
\`\`\`

## 新闻搜索提示词

\`\`\`
${prompts.news}
\`\`\`

## 预测分析提示词

\`\`\`
${prompts.forecast}
\`\`\`

## 提示词文件位置

\`\`\`
${PROMPTS_FILE}
\`\`\`

## 更新方式

修改文件后刷新页面即可看到更新，无需重启服务器！

## 更新时间

${new Date().toLocaleString('zh-CN')}
`;

  res.json({
    markdown: promptsMarkdown,
    prompts: prompts,
    filePath: PROMPTS_FILE
  });
});

// 获取最新金价
app.get('/api/gold/latest', (req, res) => {
  db.get(
    'SELECT * FROM gold_prices ORDER BY date DESC LIMIT 1',
    [],
    (err, row) => {
      if (err) {
        console.error('查询最新金价失败:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.json({});
        return;
      }
      // 解析预测数据
      try {
        if (row.forecast_data) {
          row.forecastData = JSON.parse(row.forecast_data);
        }
      } catch (e) {
        console.error('解析预测数据失败:', e);
      }
      res.json(row);
    }
  );
});

// 获取历史金价
app.get('/api/gold/history', (req, res) => {
  db.all(
    'SELECT date, price_usd FROM gold_prices ORDER BY date DESC LIMIT 30',
    [],
    (err, rows) => {
      if (err) {
        console.error('查询历史金价失败:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows || []);
    }
  );
});

// 获取最新新闻
app.get('/api/news/latest', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  db.all(
    'SELECT * FROM news ORDER BY created_at DESC LIMIT ?',
    [limit],
    (err, rows) => {
      if (err) {
        console.error('查询新闻失败:', err);
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows || []);
    }
  );
});

// 手动触发更新
app.post('/api/update', async (req, res) => {
  await updateDatabase();
  res.json({ success: true, message: '更新完成' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);

  // 启动时立即更新一次数据
  updateDatabase();

  // 每 2 小时自动更新
  cron.schedule('0 */2 * * *', () => {
    console.log('定时任务：每 2 小时更新数据');
    updateDatabase();
  });

  // 每小时更新一次新闻
  cron.schedule('0 * * * *', () => {
    console.log('定时任务：每小时更新新闻');
    fetchNews().then(news => {
      news.forEach(item => {
        db.run(
          `INSERT OR IGNORE INTO news (title, url, summary, category, date) VALUES (?, ?, ?, ?, ?)`,
          [item.title, item.url, item.summary, item.category, item.date]
        );
      });
      console.log('新闻更新完成');
    }).catch(err => console.error('新闻更新失败:', err));
  });
});
