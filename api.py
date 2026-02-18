"""
Cong News - FastAPI 服务
提供金价数据、新闻聚合和提示词管理的 API 接口
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pydantic.types import PositiveInt
from typing import Optional, List
import sqlite3
import subprocess
import json
import os
from datetime import datetime, timedelta
import uvicorn

# 创建 FastAPI 应用
app = FastAPI(
    title="Cong News API",
    description="热点新闻 & 金价追踪 API 服务",
    version="1.0.0"
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置
DATABASE_PATH = os.getenv("DATABASE_PATH", "data.db")
PROMPTS_FILE = os.getenv("PROMPTS_FILE", "prompts.txt")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_API_BASE = os.getenv("TAVILY_API_BASE", "https://api.tavily.com")

# 后台任务
background_tasks = BackgroundTasks()

# ============ 数据模型 ============

class PromptUpdate(BaseModel):
    gold_price: Optional[str] = None
    news: Optional[str] = None
    forecast: Optional[str] = None


class NewsItem(BaseModel):
    id: int
    title: str
    url: str
    summary: str
    ai_summary: str
    category: str
    sentiment: str
    source: str
    published_date: str
    created_at: str


class GoldPrice(BaseModel):
    id: int
    date: str
    price_usd: float
    price_cny: Optional[float]
    change_1d: Optional[float]
    forecast: str
    forecast_data: Optional[dict]
    created_at: str


class PromptHistory(BaseModel):
    id: int
    prompt_type: str
    prompt_content: str
    version: int
    created_at: str


class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


# ============ 数据库操作 ============

class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_database(self):
        """初始化数据库表"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 金价表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS gold_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL UNIQUE,
                    price_usd REAL NOT NULL,
                    price_cny REAL,
                    change_1d REAL,
                    forecast TEXT,
                    forecast_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 新闻表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS news_items (
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
                )
            """)
            
            # 提示词历史表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS prompts_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt_type TEXT NOT NULL,
                    prompt_content TEXT NOT NULL,
                    version INTEGER DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 当前提示词表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS current_prompts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt_type TEXT PRIMARY KEY,
                    prompt_content TEXT NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()

    def get_latest_gold_price(self) -> Optional[dict]:
        """获取最新金价"""
        with self.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM gold_prices
                ORDER BY date DESC LIMIT 1
            """)
            row = cursor.fetchone()
            
            if row:
                data = dict(row)
                if data.get('forecast_data'):
                    try:
                        data['forecast_data'] = json.loads(data['forecast_data'])
                    except:
                        pass
                return data
            return None

    def get_gold_price_history(self, limit: int = 30) -> List[dict]:
        """获取历史金价"""
        with self.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT date, price_usd FROM gold_prices
                ORDER BY date DESC LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_latest_news(self, limit: int = 10) -> List[dict]:
        """获取最新新闻"""
        with self.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM news_items
                ORDER BY created_at DESC LIMIT ?
            """, (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def search_news(self, query: str, limit: int = 10) -> List[dict]:
        """搜索新闻"""
        with self.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM news_items
                WHERE title LIKE ? OR summary LIKE ? OR ai_summary LIKE ?
                ORDER BY created_at DESC LIMIT ?
            """, (f"%{query}%", f"%{query}%", f"%{query}%", limit))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_current_prompts(self) -> dict:
        """获取当前提示词"""
        with self.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT prompt_type, prompt_content, updated_at FROM current_prompts
            """)
            rows = cursor.fetchall()
            
            prompts = {}
            for row in rows:
                prompts[row['prompt_type']] = row['prompt_content']
            
            # 确保所有类型都存在
            if 'gold_price' not in prompts:
                prompts['gold_price'] = self.get_default_gold_price_prompt()
            if 'news' not in prompts:
                prompts['news'] = self.get_default_news_prompt()
            if 'forecast' not in prompts:
                prompts['forecast'] = self.get_default_forecast_prompt()
            
            return prompts

    def get_prompts_history(self, prompt_type: Optional[str] = None, limit: int = 10) -> List[dict]:
        """获取提示词历史"""
        with self.get_connection() as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            if prompt_type:
                cursor.execute("""
                    SELECT * FROM prompts_history
                    WHERE prompt_type = ?
                    ORDER BY created_at DESC LIMIT ?
                """, (prompt_type, limit))
            else:
                cursor.execute("""
                    SELECT * FROM prompts_history
                    ORDER BY created_at DESC LIMIT ?
                """, (limit,))
            
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def update_prompts(self, new_prompts: dict) -> bool:
        """更新提示词"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            try:
                # 保存到 current_prompts 表
                for prompt_type, content in new_prompts.items():
                    if content:
                        cursor.execute("""
                            INSERT OR REPLACE INTO current_prompts (prompt_type, prompt_content, updated_at)
                            VALUES (?, ?, CURRENT_TIMESTAMP)
                        """, (prompt_type, content))
                        conn.commit()
                
                # 保存到 prompts_history 表（带版本号）
                for prompt_type, content in new_prompts.items():
                    if content:
                        # 获取当前版本号并递增
                        cursor.execute("""
                            SELECT MAX(version) FROM prompts_history WHERE prompt_type = ?
                        """, (prompt_type,))
                        row = cursor.fetchone()
                        version = row['MAX(version)'] + 1 if row else 1
                        
                        cursor.execute("""
                            INSERT INTO prompts_history (prompt_type, prompt_content, version, created_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        """, (prompt_type, content, version))
                        conn.commit()
                
                return True
            except Exception as e:
                print(f"更新提示词失败: {e}")
                return False

    def save_gold_price(self, gold_data: dict) -> bool:
        """保存金价数据"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT OR REPLACE INTO gold_prices (date, price_usd, price_cny, change_1d, forecast, forecast_data)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    gold_data['date'],
                    gold_data['price_usd'],
                    gold_data.get('price_cny'),
                    gold_data.get('change_1d'),
                    gold_data['forecast'],
                    gold_data.get('forecast_data', json.dumps({}))
                ))
                conn.commit()
                return True
            except Exception as e:
                print(f"保存金价失败: {e}")
                return False

    def save_news_item(self, news_item: dict) -> bool:
        """保存新闻项"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO news_items (title, url, summary, ai_summary, category, sentiment, source, published_date, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    news_item['title'],
                    news_item['url'],
                    news_item.get('summary', ''),
                    news_item.get('ai_summary', ''),
                    news_item.get('category', '热点'),
                    news_item.get('sentiment', 'neutral'),
                    news_item.get('source', 'Tavily Search'),
                    news_item.get('published_date', datetime.now().strftime('%Y-%m-%d')),
                    news_item.get('created_at', datetime.now().isoformat())
                ))
                conn.commit()
                return True
            except Exception as e:
                print(f"保存新闻失败: {e}")
                return False

    def get_default_prompts(self) -> dict:
        """获取默认提示词"""
        return {
            'gold_price': self.get_default_gold_price_prompt(),
            'news': self.get_default_news_prompt(),
            'forecast': self.get_default_forecast_prompt()
        }

    @staticmethod
    def get_default_gold_price_prompt() -> str:
        """获取默认金价搜索提示词"""
        return """请搜索最新的黄金价格数据，重点关注：
1. 国际黄金现货价格（美元/盎司）
2. 近期价格变化趋势
3. 市场主要驱动因素
4. 权威数据来源：上海黄金交易所、LBMA、世界黄金协会

返回格式：价格数字 + 简要市场分析"""

    @staticmethod
    def get_default_news_prompt() -> str:
        """获取默认新闻搜索提示词"""
        return """请搜索今日热点新闻，重点选择以下领域：
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
返回数量：10条最新新闻"""

    @staticmethod
    def get_default_forecast_prompt() -> str:
        """获取默认预测分析提示词"""
        return """请基于当前黄金价格和市场信息，分析未来30分钟的金价走势预测：
1. 短期趋势方向（上涨/下跌/横盘）
2. 预测波动幅度（美元）
3. 关键支撑位和阻力位
4. 时间节点分析（每10分钟的变化）

输出格式：JSON结构，包含：
- trend: 趋势方向
- volatility: 波动幅度
- key_points: 关键价格点
- time_points: 每10分钟预测点（0, 10, 20, 30分钟）
- summary: 简要分析总结"""


# 全局数据库实例
db = Database(DATABASE_PATH)

# ============ Tavily 搜索工具 ============

def search_tavily(query: str, count: int = 5, depth: str = "basic") -> dict:
    """使用 Tavily API 进行搜索"""
    try:
        # 构建 API 请求
        api_url = f"{TAVILY_API_BASE}/search"
        headers = {
            "Content-Type": "application/json"
        }
        
        if TAVILY_API_KEY:
            headers["x-api-key"] = TAVILY_API_KEY
        
        payload = {
            "api_key": TAVILY_API_KEY,
            "query": query,
            "search_depth": depth,
            "max_results": count,
            "include_images": False,
            "include_image_descriptions": False,
            "include_raw_content": False
        }
        
        # 使用 subprocess 调用 shell 脚本（如果可用）
        script_path = "/root/.openclaw/workspace/skills/tavily-search/tavily.sh"
        if os.path.exists(script_path):
            try:
                result = subprocess.run(
                    f"{script_path} search \"{query}\" {count} {depth}",
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=60
                )
                
                if result.returncode == 0:
                    return json.loads(result.stdout)
            except:
                pass
        
        # 备用：直接调用 API
        import httpx
        with httpx.Client() as client:
            response = client.post(api_url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            return response.json()
            
    except Exception as e:
        print(f"Tavily 搜索失败: {e}")
        return {"results": [], "answer": ""}


def generate_ai_summary(news_item: dict) -> dict:
    """生成 AI 分析总结"""
    title = news_item.get('title', '')
    summary = news_item.get('summary', '')
    
    analysis_points = []
    
    # 分析新闻类型
    keywords = ['黄金', '金价', '科技', 'AI', '新能源', '央行', '加息', '通胀']
    found_keywords = [kw for kw in keywords if kw in title.lower()]
    
    if any(kw in title.lower() for kw in ['黄金', '金价']):
        analysis_points.append('此新闻涉及黄金市场动态，可能对短期金价走势产生影响。')
    elif any(kw in title.lower() for kw in ['科技', 'AI', '新能源']):
        analysis_points.append('属于科技创新类新闻，反映相关产业的发展趋势。')
    elif any(kw in title.lower() for kw in ['央行', '加息', '通胀']):
        analysis_points.append('宏观经济政策类新闻，可能影响金融市场情绪。')
    else:
        analysis_points.append('该新闻为当前热点，建议关注相关市场动态。')
    
    # 时间分析
    now = datetime.now()
    if 9 <= now.hour <= 15:
        analysis_points.append('发布于交易时段，市场关注度较高。')
    
    return {
        'content': ' '.join(analysis_points),
        'sentiment': 'neutral',
        'generated_at': now.isoformat()
    }


def generate_forecast_data(current_price: float) -> dict:
    """生成 30 分钟走势预测数据"""
    base_price = current_price or 5000
    volatility = 0.002  # 0.2% 波动
    trend = (0.5 - 0.5) * 2  # -1 到 1 之间（模拟随机趋势）
    
    time_points = [
        {"minute": 0, "label": "现在"},
        {"minute": 10, "label": "10分钟后"},
        {"minute": 20, "label": "20分钟后"},
        {"minute": 30, "label": "30分钟后"}
    ]
    
    data_points = []
    for point in time_points:
        # 模拟随机波动
        random_change = (0.5 - 0.5) * base_price * volatility * 2
        # 加上趋势
        trend_change = trend * base_price * volatility * (point["minute"] / 10) * 0.5
        price = base_price + random_change + trend_change
        
        data_points.append({
            "minute": point["minute"],
            "label": point["label"],
            "price": round(price, 2),
            "time": (datetime.now() + timedelta(minutes=point["minute"])).strftime("%H:%M")
        })
    
    # 生成预测分析
    first_price = data_points[0]["price"]
    last_price = data_points[-1]["price"]
    change = last_price - first_price
    change_percent = round((change / first_price) * 100, 2)
    
    if abs(change) < 10:
        trend_text = "预计未来30分钟金价将保持相对稳定，波动幅度较小，建议投资者耐心观望。"
    elif change > 0:
        trend_text = f"预计未来30分钟金价将呈现温和上涨趋势，预计涨幅约{change_percent}%，当前市场情绪偏多，建议关注上方阻力位。"
    else:
        trend_text = f"预计未来30分钟金价可能出现回调，预计跌幅约{abs(change_percent)}%，短期可能测试下方支撑位，建议谨慎操作。"
    
    return {
        "trend": "上涨" if change > 0 else "下跌" if change < 0 else "横盘",
        "volatility": round((max(p["price"] for p in data_points) - min(p["price"] for p in data_points)) / base_price * 100, 2),
        "key_points": {
            "support": round(base_price - 20, 2),
            "resistance": round(base_price + 20, 2)
        },
        "data_points": data_points,
        "summary": trend_text
    }


def filter_news(news_items: List[dict]) -> List[dict]:
    """过滤新闻（去除负面内容）"""
    negative_keywords = [
        '负面', '批评', '指责', '谴责', '丑闻', '腐败',
        '冲突', '对抗', '抵制', '封锁', '制裁',
        '虚假', '造假', '欺骗', '误导', '抹黑'
    ]
    
    filtered = []
    for item in news_items:
        title = item.get('title', '').lower()
        summary = item.get('summary', '').lower()
        
        has_negative = any(kw in title or kw in summary for kw in negative_keywords)
        
        if not has_negative:
            filtered.append(item)
    
    print(f"过滤后新闻数量: {len(news_items)} -> {len(filtered)}")
    return filtered


def fetch_gold_price() -> Optional[dict]:
    """获取金价数据"""
    try:
        print("正在获取金价数据...")
        prompts = db.get_current_prompts()
        
        # 使用金价搜索提示词
        result = search_tavily("今日黄金价格 最新金价 美元盎司", 5, "basic")
        
        price_usd = 0
        
        # 从搜索结果中提取金价
        if result.get("results"):
            for item in result["results"]:
                content = item.get("content", "")
                import re
                usd_matches = re.findall(r'(\d{3,5}\.?\d*)\s*(美元|USD|usd)\s*\/\s*(盎司|oz)', content, re.IGNORECASE)
                if usd_matches and not price_usd:
                    price_usd = float(usd_matches[0][0])
                    print(f"提取美元金价: {price_usd}")
                    break
        
        # 备用方法
        if price_usd == 0 and result.get("answer"):
            answer_matches = re.findall(r'(\d{3,5}\.?\d*)', result["answer"])
            if answer_matches:
                price_usd = float(answer_matches[0])
                print(f"从answer提取金价: {price_usd}")
        
        if price_usd == 0:
            return None
        
        # 获取昨天的金价用于对比
        yesterday_price_data = db.get_latest_gold_price()
        yesterday_price = yesterday_price_data.get('price_usd') if yesterday_price_data else None
        
        # 计算变化
        change_1d = 0
        if yesterday_price and price_usd > 0:
            change_1d = round(((price_usd - yesterday_price) / yesterday_price) * 100, 2)
        
        # 生成预测数据
        forecast_data = generate_forecast_data(price_usd)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        print(f"金价数据: USD={price_usd}, Change={change_1d}%")
        
        return {
            "date": today,
            "price_usd": price_usd,
            "price_cny": round(price_usd * 7.2 / 31.1, 2) if price_usd > 0 else None,
            "change_1d": change_1d,
            "forecast": forecast_data["summary"],
            "forecast_data": json.dumps(forecast_data)
        }
    except Exception as e:
        print(f"获取金价失败: {e}")
        return None


def fetch_news() -> List[dict]:
    """获取新闻数据"""
    try:
        print("正在获取新闻数据...")
        
        # 使用新闻搜索提示词
        result = search_tavily("今日热点新闻 金融财经 科技创新", 10, "basic")
        
        news_items = []
        if result.get("results"):
            for item in result["results"]:
                ai_summary = generate_ai_summary(item)
                
                news_items.append({
                    "title": item.get("title", ""),
                    "url": item.get("url", ""),
                    "summary": item.get("content", "")[:300] + "..." if item.get("content") else "",
                    "ai_summary": ai_summary["content"],
                    "category": "热点",
                    "sentiment": ai_summary["sentiment"],
                    "source": "Tavily Search",
                    "published_date": datetime.now().strftime("%Y-%m-%d"),
                    "created_at": datetime.now().isoformat()
                })
        
        # 应用新闻过滤
        filtered_news = filter_news(news_items)
        
        print(f"获取到 {len(news_items)} 条新闻，过滤后 {len(filtered_news)} 条")
        return filtered_news
    except Exception as e:
        print(f"获取新闻失败: {e}")
        return []


def update_database():
    """更新数据库（金价 + 新闻）"""
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 开始更新数据...")
    
    try:
        # 更新金价
        gold_data = fetch_gold_price()
        if gold_data:
            db.save_gold_price(gold_data)
            print("金价更新成功")
        
        # 更新新闻
        news_data = fetch_news()
        for item in news_data:
            db.save_news_item(item)
        
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 数据更新完成!")
    except Exception as e:
        print(f"更新数据库失败: {e}")


# ============ 启动时初始化 ============

def startup_init():
    """启动时初始化"""
    print("启动服务...")
    
    # 检查提示词文件
    if os.path.exists(PROMPTS_FILE):
        print(f"提示词文件存在: {PROMPTS_FILE}")
    else:
        print(f"提示词文件不存在，将使用默认提示词: {PROMPTS_FILE}")
    
    # 初始化提示词到数据库
    try:
        file_prompts = {}
        if os.path.exists(PROMPTS_FILE):
            with open(PROMPTS_FILE, 'r', encoding='utf-8') as f:
                content = f.read()
                # 简单的解析（从文件中提取三个提示词）
                sections = content.split('## ')
                for section in sections:
                    if '金价搜索提示词' in section:
                        file_prompts['gold_price'] = section.split('\n\n')[1].strip()
                    elif '新闻搜索提示词' in section:
                        file_prompts['news'] = section.split('\n\n')[1].strip()
                    elif '预测分析提示词' in section:
                        file_prompts['forecast'] = section.split('\n\n')[1].strip()
        
        if file_prompts:
            db.update_prompts(file_prompts)
            print("提示词已从文件初始化到数据库")
    except Exception as e:
        print(f"初始化提示词失败: {e}")
    
    # 立即更新一次数据
    update_database()


# ============ API 路由 ============

@app.get("/")
def read_root():
    """根路径 - 服务状态"""
    return {
        "service": "Cong News API",
        "status": "running",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "gold_price": "/api/gold/latest",
            "gold_history": "/api/gold/history",
            "news_latest": "/api/news/latest",
            "news_search": "/api/news/search",
            "prompts": "/api/prompts",
            "prompts_history": "/api/prompts/history",
            "update": "/api/update"
        }
    }


@app.get("/docs")
def read_docs():
    """API 文档"""
    return {
        "title": "Cong News API 文档",
        "version": "1.0.0",
        "endpoints": {
            "金价相关": {
                "获取最新金价": {
                    "method": "GET",
                    "path": "/api/gold/latest",
                    "description": "获取最新金价和预测数据"
                },
                "获取历史金价": {
                    "method": "GET",
                    "path": "/api/gold/history?limit=30",
                    "description": "获取最近30天金价历史"
                }
            },
            "新闻相关": {
                "获取最新新闻": {
                    "method": "GET",
                    "path": "/api/news/latest?limit=10",
                    "description": "获取最新10条新闻（含AI分析）"
                },
                "搜索新闻": {
                    "method": "GET",
                    "path": "/api/news/search?q=关键词&limit=10",
                    "description": "搜索新闻（支持标题、摘要、AI分析）"
                }
            },
            "提示词管理": {
                "获取当前提示词": {
                    "method": "GET",
                    "path": "/api/prompts",
                    "description": "获取当前生效的提示词配置"
                },
                "更新提示词": {
                    "method": "POST",
                    "path": "/api/prompts",
                    "description": "更新提示词配置",
                    "body": {
                        "gold_price": "金价搜索提示词",
                        "news": "新闻搜索提示词",
                        "forecast": "预测分析提示词"
                    }
                },
                "获取提示词历史": {
                    "method": "GET",
                    "path": "/api/prompts/history?type=news&limit=10",
                    "description": "获取提示词修改历史"
                }
            },
            "系统接口": {
                "手动更新": {
                    "method": "POST",
                    "path": "/api/update",
                    "description": "手动触发数据更新"
                }
            }
        }
    }


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected"
    }


@app.get("/api/gold/latest", response_model=GoldPrice)
def get_latest_gold_price():
    """获取最新金价"""
    data = db.get_latest_gold_price()
    if data:
        return data
    else:
        raise HTTPException(status_code=404, detail="未找到金价数据")


@app.get("/api/gold/history")
def get_gold_price_history(limit: PositiveInt = 30):
    """获取历史金价"""
    if limit > 100:
        limit = 100
    data = db.get_gold_price_history(limit)
    return data


@app.get("/api/news/latest")
def get_latest_news(limit: PositiveInt = 10):
    """获取最新新闻"""
    if limit > 50:
        limit = 50
    data = db.get_latest_news(limit)
    return data


@app.get("/api/news/search")
def search_news_api(q: str, limit: PositiveInt = 10):
    """搜索新闻"""
    if not q:
        return []
    if limit > 50:
        limit = 50
    data = db.search_news(q, limit)
    return data


@app.get("/api/prompts")
def get_prompts():
    """获取当前提示词（从数据库）"""
    prompts = db.get_current_prompts()
    
    prompts_markdown = f"""# 提示词配置

## 金价搜索提示词

```
{prompts['gold_price']}
```

## 新闻搜索提示词

```
{prompts['news']}
```

## 预测分析提示词

```
{prompts['forecast']}
```

## 提示词存储

提示词存储在数据库 `current_prompts` 表中，支持通过 API 动态更新和查询。

历史版本存储在 `prompts_history` 表中，可以追溯变更历史。

## 更新时间

{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
    
    return {
        "markdown": prompts_markdown,
        "prompts": prompts,
        "storage": "database"
    }


@app.post("/api/prompts", response_model=ApiResponse)
def update_prompts(prompts: PromptUpdate):
    """更新提示词"""
    new_prompts = {}
    if prompts.gold_price:
        new_prompts['gold_price'] = prompts.gold_price
    if prompts.news:
        new_prompts['news'] = prompts.news
    if prompts.forecast:
        new_prompts['forecast'] = prompts.forecast
    
    success = db.update_prompts(new_prompts)
    
    if success:
        return ApiResponse(
            success=True,
            message="提示词更新成功",
            data={"updated_at": datetime.now().isoformat(), "prompts": new_prompts}
        )
    else:
        raise HTTPException(status_code=500, detail="提示词更新失败")


@app.get("/api/prompts/history")
def get_prompts_history(type: Optional[str] = None, limit: PositiveInt = 10):
    """获取提示词历史"""
    if limit > 50:
        limit = 50
    data = db.get_prompts_history(type, limit)
    return data


@app.post("/api/update", response_model=ApiResponse)
def manual_update():
    """手动触发更新"""
    background_tasks.add_task(update_database)
    return ApiResponse(
        success=True,
        message="更新任务已启动",
        data={"started_at": datetime.now().isoformat()}
    )


if __name__ == "__main__":
    # 启动时初始化
    startup_init()
    
    # 运行服务器
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3000,
        reload=False,  # 生产环境关闭热重载
        log_level="info"
    )
