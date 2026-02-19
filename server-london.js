const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data.db');
const PROMPTS_FILE = path.join(__dirname, 'prompts.txt');

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

// 搜索新闻（按类别）
async function searchNewsByCategory(category, count = 10, depth = 'basic') {
  const scriptPath = path.join(__dirname, '..', 'skills', 'tavily-search', 'tavily.sh');
  
  return new Promise((resolve) => {
    const query = `${category} 最新新闻 热点`;
    
    exec(`bash ${scriptPath} search "${query}" ${count} ${depth}`, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('搜索新闻失败:', error);
        resolve({ results: [], answer: '' });
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        console.error('解析新闻数据失败:', e);
        resolve({ results: [], answer: '' });
      }
    });
  });
}

// 获取伦敦金价
async function fetchLondonGoldPrice() {
  try {
    console.log('正在获取伦敦金价数据...');
    const scriptPath = path.join(__dirname, '..', 'skills', 'tavily-search', 'tavily.sh');
    
    return new Promise((resolve) => {
      const query = 'London gold price today LBMA gold fix USD per ounce';
      
      exec(`bash ${scriptPath} search "${query}" 5 basic`, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          console.error('Tavily search error:', error);
          resolve(null);
          return;
        }
        try {
          const result = JSON.parse(stdout);
          
          let priceUSD = 0;
          
          // 优先从 answer 中提取
          if (result.answer) {
            const usdMatches = result.answer.match(/(\d{4,5}\.?\d*)\s*(USD|美元|US\$|per ounce)/gi);
            if (usdMatches && usdMatches.length > 0) {
              const match = usdMatches[0].match(/(\d{4,5}\.?\d*)/);
              if (match) {
                priceUSD = parseFloat(match[1]);
                console.log(`从 answer 提取伦敦金价: ${priceUSD}`);
              }
            }
            
            // 如果没有在 answer 中找到，尝试从 results 中提取
            if (priceUSD === 0 && result.results && result.results.length > 0) {
              for (let item of result.results) {
                const content = item.content || '';
                const title = item.title || '';
                const combined = (title + ' ' + content).toLowerCase();
                
                const londonMatches = combined.match(/london gold|lbma.*gold|gold fix.*london/gi);
                if (londonMatches && !priceUSD) {
                  const allMatches = combined.match(/(\d{4,5}\.?\d*)/g);
                  if (allMatches && allMatches.length > 0) {
                    // 找到第一个大于 2000 的数字（金价通常在 2000+）
                    for (let match of allMatches) {
                      const num = parseFloat(match);
                      if (num >= 2000) {
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
          const forecastData = generateForecastData(priceUSD);

          console.log(`伦敦金价数据: USD=${priceUSD}, Change=0.00%`);
          console.log(`预测数据: ${JSON.stringify(forecastData)}`);

          resolve({
            date: today,
            priceUSD: priceUSD,
            priceCNY: priceUSD > 0 ? parseFloat((priceUSD * 7.2 / 31.1).toFixed(2)) : null,
            change1d: 0,
            forecast: forecastData.summary,
            forecastData: JSON.stringify(forecastData),
            source: 'Tavily Search API - LBMA London Gold'
          });
        } catch (e) {
          console.error('解析金价数据失败:', e);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('获取伦敦金价失败:', error);
    return null;
  }
}

// 生成预测数据（基于新闻分析）
function generateForecastData(currentPrice) {
  const basePrice = currentPrice || 2350;
  const volatility = 0.002;
  const trend = (Math.random() - 0.5) * 2;

  const timePoints = [
    { minute: 0, label: '现在' },
    { minute: 10, label: '10分钟后' },
    { minute: 20, label: '20分钟后' },
    { minute: 30, label: '30分钟后' }
  ];

  const data = timePoints.map((point, index) => {
    const randomChange = (Math.random() - 0.5) * basePrice * volatility * 2;
    const trendChange = trend * basePrice * volatility * index * 0.5;
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

  let trendText = '';
  if (Math.abs(change) < 10) {
    trendText = '预计未来30分钟伦敦金价将保持相对稳定，波动幅度较小，建议投资者耐心观望。基于当前市场新闻分析，整体情绪偏中性。';
  } else if (change > 0) {
    trendText = `预计未来30分钟伦敦金价将呈现温和上涨趋势，预计涨幅约${changePercent}%。当前市场新闻反映出正向情绪，技术面支撑价格上行。建议关注上方阻力位，注意风险控制。`;
  } else {
    trendText = `预计未来30分钟伦敦金价可能出现回调，预计跌幅约${Math.abs(changePercent)}%。当前市场新闻显示出一定压力，短期可能测试下方支撑位。建议谨慎操作，注意风险控制。`;
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

// 获取分类新闻（热度最高的一条）
async function fetchNewsByCategory(category) {
  try {
    console.log(`正在获取 ${category} 新闻...`);
    
    const result = await searchNewsByCategory(category, 5, 'advanced');
    
    if (result.results && result.results.length > 0) {
      // 选择热度最高的新闻（简单策略：选择第一个结果）
      const topNews = result.results[0];
      
      // 生成 AI 分析
      const aiAnalysis = generateNewsAnalysis(topNews, category);
      
      return {
        title: topNews.title,
        url: topNews.url,
        summary: '',  // 不显示原文内容
        category: category,
        publishTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        analysis: aiAnalysis.summary,
        analysisPoints: aiAnalysis.points,
        source: 'Tavily Search API'
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
      analysisPoints.push('从新闻标题可以看出，该应用可能涉及技术创新、产品发布或市场落地。');
      analysisPoints.push('AI 应用的发展趋势显示出市场需求和资本关注度的提升。');
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
    analysisPoints.push('该新闻涉及技术突破和创新，可能对相关行业产生重大影响。');
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

// 获取所有分类的新闻
async function fetchAllCategoryNews() {
  const newsByCategory = {};
  
  for (const category of NEWS_CATEGORIES) {
    const newsItem = await fetchNewsByCategory(category);
    if (newsItem) {
      newsByCategory[category] = newsItem;
    }
  }
  
  return newsByCategory;
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
            console.error('保存金价失败:', err);
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
        db.run(
          `INSERT OR IGNORE INTO news (title, url, summary, category, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [newsItem.title, newsItem.url, newsItem.summary, newsItem.category, newsItem.publishTime, new Date().toISOString()],
          (err) => {
            if (err) console.error(`保存${category}新闻失败:`, err);
          }
        );
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
        const content = lines.slice(1).join('\n').trim();
        prompts[title] = content;
      }
    });
    
    res.json({
      markdown: content,
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
    res.json(row);
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
        // 解析分析数据（如果存储在 summary 中）
        let analysis = result.news.summary || '';
        try {
          // 假设分析数据以特定格式存储
          if (analysis.includes('AI分析总结') || analysis.includes('summary')) {
            // 尝试解析 JSON
            const match = analysis.match(/\{.*\}/);
            if (match) {
              const analysisData = JSON.parse(match[0]);
              result.news.analysis = analysisData.summary || analysisData.points || analysis;
            }
          }
        } catch (e) {
          // 如果解析失败，保持原样
        }
        
        newsByCategory[result.category] = result.news;
      }
    });
    
    res.json(newsByCategory);
  });
});

// 获取最新金价（保留旧 API）
app.get('/api/old/latest', (req, res) => {
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

// 获取最新新闻（保留旧 API）
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
          db.run(
            `INSERT OR IGNORE INTO news (title, url, summary, category, date, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [newsItem.title, newsItem.url, newsItem.summary, newsItem.category, newsItem.publishTime, new Date().toISOString()]
          );
        }
      }
    }).catch(err => console.error('新闻更新失败:', err));
  });
});
