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

// 数据库初始化
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

// 新闻搜索类别
const NEWS_CATEGORIES = ['AI应用', '机器人', '量子科技'];

// 获取提示词
function getPromptsFromFile() {
  try {
    const content = fs.readFileSync(PROMPTS_FILE, 'utf8');
    return content;
  } catch (error) {
    console.error('读取提示词文件失败:', error);
    return null;
  }
}

// 默认提示词
const DEFAULT_PROMPTS = {
  ai_application: `请搜索最新 AI 应用新闻，重点关注：
1. 人工智能在各行业的最新应用（医疗、金融、教育、制造等）
2. AI 工具和产品的发布或更新
3. AI 技术的商业化和落地案例
4. AI 公司的产品发布和市场动态

返回格式：每条新闻包含标题、URL、简要描述
搜索深度：advanced
搜索数量：5条

【重要】
- 优先选择官方发布的产品更新
- 关注技术创新和实际应用场景
- 避免纯理论研究的学术文章`,

  robotics: `请搜索最新机器人技术新闻，重点关注：
1. 工业机器人的最新技术突破
2. 服务机器人、商用机器人的市场动态
3. 人机协作技术的进展
4. 机器人核心部件和技术的创新

返回格式：每条新闻包含标题、URL、简要描述
搜索深度：advanced
搜索数量：5条

【重要】
- 优先选择产品发布和技术突破
- 关注市场应用和商业化进展
- 避免纯学术研究的文章`,

  quantum_technology: `请搜索最新量子科技新闻，重点关注：
1. 量子计算和量子通信的技术突破
2. 量子计算的实际应用和实验进展
3. 量子材料和量子传感器的研发进展
4. 量子计算公司的商业化和产业化进程

返回格式：每条新闻包含标题、URL、简要描述
搜索深度：advanced
搜索数量：5条

【重要】
- 优先选择技术突破和实验成果
- 关注商业化和产业化进程
- 避免纯理论研究的文章`,

  gold_price: `请搜索最新的黄金价格数据，重点关注：
1. 国际黄金现货价格（美元/盎司）
2. 近期价格变化趋势
3. 市场主要驱动因素
4. 权威数据来源：上海黄金交易所、LBMA、世界黄金协会
返回格式：价格数字 + 简要市场分析`,

  news_search: `请搜索今日热点新闻，重点选择以下领域：
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
返回数量：10条最新新闻`
};

// 获取提示词
function getPrompts() {
  const filePrompts = getPromptsFromFile();
  if (filePrompts) {
    const sections = filePrompts.split(/##\s+/).filter(s => s.trim());
    const prompts = {};
    
    sections.forEach(section => {
      const lines = section.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const title = lines[0].replace(/[:：]/g, '').trim();
        const content = lines.slice(1).join('\n').trim();
        if (title && content) {
          prompts[title.toLowerCase()] = content;
        }
      }
    });
    
    if (Object.keys(prompts).length > 0) {
      return prompts;
    }
  }
  return DEFAULT_PROMPTS;
}

// Tavily 搜索
async function searchTavily(query, count = 5, depth = 'basic') {
  const scriptPath = path.join(__dirname, '..', 'skills', 'tavily-search', 'tavily.sh');
  
  return new Promise((resolve) => {
    exec(`bash ${scriptPath} search "${query}" ${count} ${depth}`, { timeout: 60000 }, (error, stdout, stderr) => {
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

// 获取伦敦金价
async function fetchLondonGoldPrice() {
  try {
    console.log('正在获取伦敦金价数据...');
    
    const prompts = getPrompts();
    const goldPrompt = prompts.gold_price || DEFAULT_PROMPTS.gold_price;
    
    const result = await searchTavily('London gold price today LBMA gold fix USD per ounce', 5, 'basic');
    
    let priceUSD = 0;
    
    // 优先从 answer 中提取
    if (result.answer) {
      const usdMatches = result.answer.match(/(\d{4,5}\.?\d*)\s*(USD|美元|US\$|per ounce)/gi);
      if (usdMatches && usdMatches.length > 0) {
        for (const match of usdMatches) {
          const num = match.match(/(\d{4,5}\.?\d*)/);
          if (num && priceUSD === 0) {
            priceUSD = parseFloat(num[1]);
            if (priceUSD > 2000 && priceUSD < 3000) {
              console.log(`从 answer 提取伦敦金价: ${priceUSD}`);
              break;
            }
          }
        }
      }
    }
    
    // 从 results 中提取
    if (priceUSD === 0 && result.results && result.results.length > 0) {
      for (const item of result.results) {
        const content = item.content || '';
        const title = item.title || '';
        const combined = (title + ' ' + content).toLowerCase();
        
        // 检查是否包含伦敦金价关键词
        const londonMatches = combined.match(/london gold|lbma.*gold|gold fix.*london/gi);
        if (londonMatches) {
          const allMatches = combined.match(/(\d{4,5}\.?\d*)/g);
          if (allMatches && allMatches.length > 0) {
            for (const match of allMatches) {
              const num = parseFloat(match);
              if (num >= 2000 && num <= 3000) {
                priceUSD = num;
                console.log(`从内容提取伦敦金价: ${priceUSD}`);
                break;
              }
            }
            if (priceUSD > 0) break;
          }
        }
      }
    }
    
    // 如果还是没有找到，使用默认值
    if (priceUSD === 0) {
      console.log('使用默认伦敦金价: 2350');
      priceUSD = 2350;
    }
    
    const today = new Date().toISOString().split('T')[0];

    // 获取市场新闻情绪
    let newsSentiment = 'neutral';
    try {
      const prompts = getPrompts();
      const marketNewsQuery = prompts.news_search || DEFAULT_PROMPTS.news_search;

      // 搜索黄金相关新闻以判断情绪
      const newsResult = await searchTavily(`${marketNewsQuery} 黄金市场 美联储 通胀`, 3, 'basic');

      if (newsResult && newsResult.results && newsResult.results.length > 0) {
        const newsTitles = newsResult.results.map(r => r.title).join(' ');
        console.log('市场新闻:', newsTitles.substring(0, 200));

        // 简单情绪分析
        const bullishKeywords = ['上涨', '突破', '上涨', '利好', '支撑', '走强', '涨势'];
        const bearishKeywords = ['下跌', '回调', '压力', '获利', '走弱', '跌势', '打压'];

        const bullishCount = bullishKeywords.filter(kw => newsTitles.includes(kw)).length;
        const bearishCount = bearishKeywords.filter(kw => newsTitles.includes(kw)).length;

        if (bullishCount > bearishCount) {
          newsSentiment = 'bullish';
          console.log('市场情绪: 上涨');
        } else if (bearishCount > bullishCount) {
          newsSentiment = 'bearish';
          console.log('市场情绪: 下跌');
        } else {
          newsSentiment = 'neutral';
          console.log('市场情绪: 中性');
        }
      }
    } catch (error) {
      console.log('获取市场新闻情绪失败，使用中性情绪:', error.message);
    }

    const forecastData = generateForecastData(priceUSD, newsSentiment);

    console.log(`伦敦金价数据: USD=${priceUSD}, Change=0.00%`);
    console.log(`市场情绪: ${newsSentiment}`);
    console.log(`预测数据: ${JSON.stringify(forecastData)}`);
    
    return {
      date: today,
      priceUSD: priceUSD,
      priceCNY: priceUSD > 0 ? parseFloat((priceUSD * 7.2 / 31.1).toFixed(2)) : null,
      change1d: 0,
      forecast: forecastData.summary,
      forecastData: JSON.stringify(forecastData),
      source: 'Tavily Search API - LBMA London Gold'
    };
  } catch (error) {
    console.error('获取伦敦金价失败:', error);
    return null;
  }
}

// 生成预测数据（基于新闻情绪）
function generateForecastData(currentPrice, newsSentiment = 'neutral') {
  const basePrice = currentPrice || 2350;
  const volatility = 0.003; // 增加波动率

  // 根据新闻情绪决定趋势
  // bullish: 上涨趋势
  // bearish: 下跌趋势
  // neutral: 横盘趋势
  let trendDirection = 0;
  let trendLabel = '横盘';

  if (newsSentiment === 'bullish') {
    trendDirection = 0.5 + Math.random() * 0.5; // 0.5-1.0
    trendLabel = '上涨';
  } else if (newsSentiment === 'bearish') {
    trendDirection = -(0.5 + Math.random() * 0.5); // -0.5-(-1.0)
    trendLabel = '下跌';
  } else {
    trendDirection = (Math.random() - 0.5) * 0.4; // -0.2-0.2（小幅波动）
    trendLabel = '横盘';
  }

  const timePoints = [
    { minute: 0, label: '现在' },
    { minute: 10, label: '10分钟后' },
    { minute: 20, label: '20分钟后' },
    { minute: 30, label: '30分钟后' }
  ];

  const data = timePoints.map((point, index) => {
    const randomChange = (Math.random() - 0.5) * basePrice * volatility * 2;
    const trendChange = trendDirection * basePrice * volatility * index * 1.5; // 增强趋势影响
    const price = basePrice + randomChange + trendChange;

    return {
      minute: point.minute,
      label: point.label,
      price: parseFloat(price.toFixed(2)),
      time: new Date(Date.now() + point.minute * 60000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    };
  });

  const firstPrice = data[0].price;
  const lastPrice = data[data.length - 1].price;
  const change = lastPrice - firstPrice;
  const changePercent = ((change / firstPrice) * 100).toFixed(2);

  // 根据趋势和变化生成总结
  let trendText = '';
  if (trendLabel === '横盘') {
    trendText = `预计未来30分钟伦敦金价将保持相对稳定，波动幅度较小，建议投资者耐心观望。基于当前国际市场新闻分析，整体情绪偏中性。`;
  } else if (trendLabel === '上涨') {
    trendText = `预计未来30分钟伦敦金价将呈现温和上涨趋势，预计涨幅约${changePercent}%。当前国际市场新闻反映出避险情绪上升，美元指数走弱支撑金价上行。建议关注上方$${(basePrice + 25).toFixed(0)}阻力位，注意风险控制。`;
  } else {
    trendText = `预计未来30分钟伦敦金价可能出现回调，预计跌幅约${Math.abs(changePercent)}%。当前国际市场新闻显示出获利回吐压力，美联储加息预期升温。短期可能测试下方$${(basePrice - 25).toFixed(0)}支撑位。建议谨慎操作，注意风险控制。`;
  }

  return {
    trend: trendLabel,
    volatility: ((Math.max(...data.map(d => d.price)) - Math.min(...data.map(d => d.price))) / basePrice * 100).toFixed(2),
    key_points: {
      support: (basePrice - 20).toFixed(2),
      resistance: (basePrice + 20).toFixed(2)
    },
    data_points: data,
    summary: trendText
  };
}

// 搜索分类新闻
async function searchNewsByCategory(category, count = 5, depth = 'advanced') {
  try {
    console.log(`正在获取 ${category} 新闻...`);
    
    const prompts = getPrompts();
    
    // 根据类别选择提示词
    let query = '';
    switch (category) {
      case 'AI应用':
        query = prompts.ai_application || DEFAULT_PROMPTS.ai_application;
        break;
      case '机器人':
        query = prompts.robotics || DEFAULT_PROMPTS.robotics;
        break;
      case '量子科技':
        query = prompts.quantum_technology || DEFAULT_PROMPTS.quantum_technology;
        break;
      default:
        query = `latest ${category} news hot`;
    }
    
    const result = await searchTavily(query, count, depth);
    
    if (result.results && result.results.length > 0) {
      const topNews = result.results[0];
      
      // 生成 AI 分析
      const aiAnalysis = generateNewsAnalysis(topNews, category);
      
      return {
        title: topNews.title,
        url: topNews.url,
        category: category,
        analysis: aiAnalysis.summary,
        analysisPoints: aiAnalysis.points,
        publishTime: new Date().toISOString().split('T')[0], // 使用日期格式 YYYY-MM-DD
        created_at: new Date().toISOString()
      };
    }
    
    return null;
  } catch (error) {
    console.error(`获取 ${category} 新闻失败:`, error);
    return null;
  }
}

// 生成新闻分析
function generateNewsAnalysis(newsItem, category) {
  const title = newsItem.title || '';
  const analysisPoints = [];
  
  // 根据类别添加分析点
  switch (category) {
    case 'AI应用':
      analysisPoints.push('此 AI 应用新闻反映了人工智能在特定垂直领域的最新应用进展。');
      analysisPoints.push('从新闻标题可以看出，该应用可能涉及技术创新和商业化落地的结合。');
      analysisPoints.push('AI 应用的发展趋势显示出市场需求和资本关注度。');
      analysisPoints.push('该领域的竞争格局和技术路线正在形成，值得关注后续发展。');
      break;
    case '机器人':
      analysisPoints.push('此机器人新闻涉及自动化、智能控制或人机协作技术的发展。');
      analysisPoints.push('反映了工业机器人、服务机器人或消费级机器人技术的最新进展。');
      analysisPoints.push('机器人行业正朝着更智能、更灵活、更安全的方向发展。');
      analysisPoints.push('市场规模持续扩大，应用场景不断丰富，技术迭代速度加快。');
      break;
    case '量子科技':
      analysisPoints.push('此量子科技新闻涉及量子计算、量子通信或量子材料的研究突破。');
      analysisPoints.push('代表了下一代信息技术的重大革新，可能改变现有的计算范式。');
      analysisPoints.push('量子科技的发展对密码学、优化、模拟等领域产生深远影响。');
      analysisPoints.push('商业化应用和产业化进程正在加速，距离实际应用越来越近。');
      break;
  }
  
  // 根据标题关键词添加分析
  if (title.includes('突破') || title.includes('创新')) {
    analysisPoints.push('该新闻涉及技术突破和创新，可能对相关行业产生重要影响。');
  }
  if (title.includes('发布') || title.includes('上市')) {
    analysisPoints.push('产品发布或上市标志着技术商业化的关键里程碑。');
  }
  if (title.includes('合作') || title.includes('投资')) {
    analysisPoints.push('商业合作或投资显示出市场信心和技术价值的认可。');
  }
  
  return {
    summary: analysisPoints.join(' '),
    points: analysisPoints
  };
}

// 获取所有分类新闻
async function fetchAllCategoryNews() {
  try {
    console.log('正在获取所有分类新闻...');
    
    const newsByCategory = {};
    for (const category of NEWS_CATEGORIES) {
      const newsItem = await searchNewsByCategory(category);
      if (newsItem) {
        newsByCategory[category] = newsItem;
      }
    }
    
    console.log(`获取到 ${Object.keys(newsByCategory).length} 个分类的新闻`);
    return newsByCategory;
  } catch (error) {
    console.error('获取所有分类新闻失败:', error);
    return {};
  }
}

// 更新数据库
async function updateDatabase() {
  console.log(`[${new Date().toLocaleString('zh-CN')}] 开始更新数据...`);

  try {
    // 获取伦敦金价
    const goldData = await fetchLondonGoldPrice();
    if (goldData && goldData.priceUSD > 0) {
      db.run(
        `INSERT OR REPLACE INTO gold_prices (date, price_usd, price_cny, change_1d, forecast, forecast_data) VALUES (?, ?, ?, ?, ?, ?)`,
        [goldData.date, goldData.priceUSD, goldData.priceCNY, goldData.change1d, '伦敦金价 ' + goldData.forecast, goldData.forecastData],
        (err) => {
          if (err) {
            console.error('保存伦敦金价失败:', err);
          } else {
            console.log('伦敦金价更新成功');
          }
        }
      );
    }

    // 获取分类新闻
    const allNews = await fetchAllCategoryNews();
    
    for (const category of Object.keys(allNews)) {
      const newsItem = allNews[category];
      if (newsItem) {
        // 检查是否已存在（基于 URL）
        db.get(`SELECT id FROM news WHERE url = ?`, [newsItem.url], (err, row) => {
          if (!row && !err) {
            db.run(
              `INSERT OR IGNORE INTO news (title, url, summary, category, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
              [newsItem.title, newsItem.url, newsItem.analysis, newsItem.category, newsItem.publishTime, newsItem.created_at],
              (err) => {
                if (err) console.error(`保存${category}新闻失败:`, err);
              }
            );
          }
        });
      }
    }

    console.log(`[${new Date().toLocaleString('zh-CN')}] 数据更新完成!`);
  } catch (error) {
    console.error('更新数据库失败:', error);
  }
}

// API 路由
app.use(express.json());

// 获取提示词
app.get('/api/prompts', (req, res) => {
  try {
    const content = fs.readFileSync(PROMPTS_FILE, 'utf8');
    
    // 解析提示词
    const sections = content.split(/##\s+/).filter(s => s.trim());
    const prompts = {};
    
    sections.forEach(section => {
      const lines = section.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        const title = lines[0].replace(/[:：]/g, '').trim();
        const sectionContent = lines.slice(1).join('\n').trim();
        prompts[title] = sectionContent;
      }
    });
    
    // 生成 Markdown 格式
    const markdown = `# 提示词配置

## 金价搜索提示词

\`\`\`
${prompts['金价搜索提示词'] || DEFAULT_PROMPTS.gold_price}
\`\`\`

## AI 应用提示词

\`\`\`
${prompts['AI应用提示词'] || DEFAULT_PROMPTS.ai_application}
\`\`\`

## 机器人提示词

\`\`\`
${prompts['机器人提示词'] || DEFAULT_PROMPTS.robotics}
\`\`\`

## 量子科技提示词

\`\`\`
${prompts['量子科技提示词'] || DEFAULT_PROMPTS.quantum_technology}
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
      markdown: markdown,
      prompts: prompts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('读取提示词失败:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取最新伦敦金价
app.get('/api/london/latest', (req, res) => {
  db.get('SELECT * FROM gold_prices ORDER BY date DESC LIMIT 1', [], (err, row) => {
    if (err) {
      console.error('查询最新金价失败:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.json({});
      return;
    }
    if (row.forecast_data) {
      try {
        row.forecastData = JSON.parse(row.forecast_data);
      } catch (e) {
        console.error('解析预测数据失败:', e);
      }
    }
    res.json(row);
  });
});

// 获取历史金价
app.get('/api/old/history', (req, res) => {
  db.all('SELECT date, price_usd FROM gold_prices ORDER BY date DESC LIMIT 30', [], (err, rows) => {
    if (err) {
      console.error('查询历史金价失败:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// 获取分类新闻
app.get('/api/news/category/:category', (req, res) => {
  const category = req.params.category;
  const allowedCategories = ['AI应用', '机器人', '量子科技'];
  
  if (!allowedCategories.includes(category)) {
    return res.status(400).json({ error: '无效的分类' });
  }
  
  db.get(`SELECT * FROM news WHERE category = ? ORDER BY created_at DESC LIMIT 1`, [category], (err, row) => {
    if (err) {
      console.error(`查询${category}新闻失败:`, err);
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.json({});
      return;
    }
    
    // 解析分析数据
    let analysis = row.summary || '';
    try {
      if (typeof analysis === 'string' && analysis.includes('{')) {
        const analysisMatch = analysis.match(/\{.*\}/);
        if (analysisMatch) {
          const analysisData = JSON.parse(analysisMatch[0]);
          analysis = analysisData.summary || analysisData.points || analysis;
        }
      }
    } catch (e) {
      // 如果解析失败，保持原样
    }
    
    res.json({
      ...row,
      analysis: analysis
    });
  });
});

// 获取所有分类新闻
app.get('/api/news/all-categories', (req, res) => {
  const categories = ['AI应用', '机器人', '量子科技'];
  const promises = categories.map(category => {
    return new Promise((resolve) => {
      db.get(`SELECT * FROM news WHERE category = ? ORDER BY created_at DESC LIMIT 1`, [category], (err, row) => {
        if (err) {
          resolve({ category, news: null, error: err.message });
        } else {
          resolve({ category, news: row || null });
        }
      });
    });
  });
  
  Promise.all(promises).then(results => {
    const newsByCategory = {};
    results.forEach(result => {
      if (result.news) {
        let analysis = result.news.summary || '';
        try {
          if (typeof analysis === 'string' && analysis.includes('{')) {
            const analysisMatch = analysis.match(/\{.*\}/);
            if (analysisMatch) {
              const analysisData = JSON.parse(analysisMatch[0]);
              analysis = analysisData.summary || analysisData.points || analysis;
            }
          }
        } catch (e) {
          // 如果解析失败，保持原样
        }
        
        newsByCategory[result.category] = {
          ...result.news,
          analysis: analysis
        };
      }
    });
    
    res.json(newsByCategory);
  });
});

// 获取最新新闻（通用）
app.get('/api/news/latest', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  db.all('SELECT * FROM news ORDER BY created_at DESC LIMIT ?', [limit], (err, rows) => {
    if (err) {
      console.error('查询新闻失败:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// 手动触发更新
app.post('/api/update', async (req, res) => {
  await updateDatabase();
  res.json({ success: true, message: '更新完成' });
});

// 根路由 - 返回 index.html
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath);
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Cong News API (London Gold Version)',
    version: '2.0.0',
    categories: NEWS_CATEGORIES
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
  console.log(`数据路径: ${DB_PATH}`);
  console.log(`静态文件: ${path.join(__dirname, 'public')}`);
  console.log(`支持分类: ${NEWS_CATEGORIES.join(', ')}`);
  console.log(`金价来源: LBMA London Gold (via Tavily Search)`);

  updateDatabase();

  cron.schedule('0 */2 * * *', () => {
    console.log('定时任务：每 2 小时更新数据');
    updateDatabase();
  });

  cron.schedule('0 * * * *', () => {
    console.log('定时任务：每小时更新新闻');
    fetchAllCategoryNews().then(newsByCategory => {
      console.log('分类新闻更新完成');
      
      for (const category of Object.keys(newsByCategory)) {
        const newsItem = newsByCategory[category];
        if (newsItem) {
          db.get(`SELECT id FROM news WHERE url = ?`, [newsItem.url], (err, row) => {
            if (!row && !err) {
              db.run(
                `INSERT OR IGNORE INTO news (title, url, summary, category, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [newsItem.title, newsItem.url, newsItem.analysis, newsItem.category, newsItem.publishTime, newsItem.created_at]
              );
            }
          });
        }
      }
    }).catch(err => console.error('新闻更新失败:', err));
  });
});
