import os
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
import calendar
import twstock

app = Flask(__name__)
CORS(app)

# Build mapping from twstock
code_to_name = {}
name_to_code = {}

for code, info in twstock.codes.items():
    if info.type == '股票': # Only stocks
        code_to_name[code] = info.name
        name_to_code[info.name] = code

def get_yahoo_symbol(code):
    info = twstock.codes.get(code)
    if info and info.market == '上櫃':
        return f"{code}.TWO"
    return f"{code}.TW"

def resolve_symbol(input_str):
    input_str = input_str.strip()
    if not input_str:
        return None, None, None
        
    # Check if input is a known name
    if input_str in name_to_code:
        code = name_to_code[input_str]
        return get_yahoo_symbol(code), input_str, "name" # user input name
        
    # Check if input is a code
    if input_str.isdigit():
        name = code_to_name.get(input_str, input_str)
        return get_yahoo_symbol(input_str), name, "code" # user input code
        
    # Fallback for arbitrary symbols (like AAPL)
    return input_str, input_str, "unknown"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/stocks', methods=['POST'])
def get_stocks():
    data = request.json
    raw_symbols = data.get('symbols', [])
    mode = data.get('mode', 'last_30') # 'last_30' or 'specific_month'
    month_str = data.get('month', '') # e.g. '2023-10'

    # Deduplicate and limit to 5
    unique_raw = []
    for s in raw_symbols:
        if s.strip() and s.strip() not in unique_raw:
            unique_raw.append(s.strip())
    unique_raw = unique_raw[:5]

    if not unique_raw:
        return jsonify({"error": "No symbols provided"}), 400

    results = []
    today = datetime.now()

    for raw_input in unique_raw:
        symbol, company_name, input_type = resolve_symbol(raw_input)
        if not symbol:
            continue

        try:
            import requests
            session = requests.Session()
            session.headers['User-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            
            ticker = yf.Ticker(symbol, session=session)
            # If it's a foreign stock or not in twstock, fallback to yfinance info
            if company_name == symbol:
                info = ticker.info
                company_name = info.get('longName') or info.get('shortName') or symbol

            print(f"DEBUG: Fetching {symbol} for {company_name}")

            if mode == 'last_30':
                hist = ticker.history(period="3mo") 
                print(f"DEBUG: {symbol} hist empty? {hist.empty}")
                if hist.empty:
                    results.append({
                        'symbol': symbol.replace('.TW', ''),
                        'name': company_name,
                        'display_title': f"{company_name} / {symbol.replace('.TW', '')}",
                        'error': '無法取得股價資料 (雲端伺服器 IP 可能暫時被阻擋，或代號無效)',
                        'data': []
                    })
                    continue
                hist = hist.tail(31)
            elif mode == 'specific_month':
                if not month_str:
                    continue
                year, month = map(int, month_str.split('-'))
                start_date = datetime(year, month, 1)
                last_day = calendar.monthrange(year, month)[1]
                end_date = datetime(year, month, last_day) + timedelta(days=1)
                buffer_start = start_date - timedelta(days=15)
                hist = ticker.history(start=buffer_start.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
                if hist.empty:
                    continue
            else:
                continue
            
            hist = hist.reset_index()
            hist['DateStr'] = hist['Date'].dt.strftime('%Y-%m-%d')
            
            stock_data = []
            for i in range(1, len(hist)):
                current_row = hist.iloc[i]
                prev_row = hist.iloc[i-1]
                date_str = current_row['DateStr']
                
                if mode == 'specific_month':
                    if not date_str.startswith(month_str):
                        continue
                
                stock_data.append({
                    'date': date_str,
                    'prev_close': round(prev_row['Close'], 2),
                    'open': round(current_row['Open'], 2),
                    'high': round(current_row['High'], 2),
                    'low': round(current_row['Low'], 2),
                    'close': round(current_row['Close'], 2)
                })
            
            if mode == 'last_30':
                stock_data = stock_data[-30:]
                
            stock_data.reverse()

            # Always format as "公司名稱 / 代號"
            clean_symbol = symbol.split('.')[0]
            display_title = f"{company_name} / {clean_symbol}"

            results.append({
                'symbol': clean_symbol,
                'name': company_name,
                'display_title': display_title,
                'data': stock_data
            })

        except Exception as e:
            print(f"Error fetching {symbol} via yfinance: {e}. Trying FinMind fallback.")
            clean_symbol = symbol.split('.')[0]
            try:
                end_date = datetime.now()
                if mode == 'last_30':
                    start_date = end_date - timedelta(days=45)
                else:
                    if month_str:
                        year, month = map(int, month_str.split('-'))
                        start_date = datetime(year, month, 1)
                        if month == 12:
                            end_date = datetime(year+1, 1, 1) - timedelta(days=1)
                        else:
                            end_date = datetime(year, month+1, 1) - timedelta(days=1)
                
                fm_url = f"https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id={clean_symbol}&start_date={start_date.strftime('%Y-%m-%d')}&end_date={end_date.strftime('%Y-%m-%d')}"
                import requests
                fm_res = requests.get(fm_url, timeout=5).json()
                
                if fm_res.get('msg') == 'success' and fm_res.get('data') and len(fm_res['data']) > 0:
                    stock_data = []
                    for row in fm_res['data']:
                        stock_data.append({
                            'date': row['date'],
                            'prev_close': round(row['close'] - row['spread'], 2),
                            'open': row['open'],
                            'high': row['max'],
                            'low': row['min'],
                            'close': row['close']
                        })
                    if mode == 'last_30':
                        stock_data = stock_data[-30:]
                    stock_data.reverse()
                    
                    display_title = f"{company_name} / {clean_symbol}"
                    results.append({
                        'symbol': clean_symbol,
                        'name': company_name,
                        'display_title': display_title,
                        'data': stock_data
                    })
                    continue
            except Exception as fm_e:
                print(f"FinMind fallback failed for {symbol}: {fm_e}")

            print(f"Trying twstock fallback for {symbol}...")
            try:
                stock = twstock.Stock(clean_symbol)
                stock_data = []
                
                if mode == 'last_30':
                    dates = stock.date
                    if len(dates) > 0:
                        for i in range(1, len(dates)):
                            stock_data.append({
                                'date': dates[i].strftime('%Y-%m-%d'),
                                'prev_close': stock.price[i-1],
                                'open': stock.open[i],
                                'high': stock.high[i],
                                'low': stock.low[i],
                                'close': stock.price[i]
                            })
                        stock_data = stock_data[-30:]
                        stock_data.reverse()
                elif mode == 'specific_month':
                    if month_str:
                        year, month = map(int, month_str.split('-'))
                        fetch_data = stock.fetch(year, month)
                        if fetch_data:
                            for row in fetch_data:
                                stock_data.append({
                                    'date': row.date.strftime('%Y-%m-%d'),
                                    'prev_close': round(row.close - row.change, 2),
                                    'open': row.open,
                                    'high': row.high,
                                    'low': row.low,
                                    'close': row.close
                                })
                            stock_data.reverse()
                
                if stock_data:
                    display_title = f"{company_name} / {clean_symbol}"
                    results.append({
                        'symbol': clean_symbol,
                        'name': company_name,
                        'display_title': display_title,
                        'data': stock_data
                    })
                    continue # Successfully used fallback, skip error append
            except Exception as tw_e:
                print(f"twstock fallback also failed for {symbol}: {tw_e}")
            
            # If all else fails
            clean_sym = symbol.split('.')[0] if '.' in symbol else symbol
            results.append({
                'symbol': clean_sym,
                'name': company_name,
                'display_title': f"{company_name} / {clean_sym}",
                'error': str(e),
                'data': []
            })

    return jsonify({"results": results})

@app.route('/api/chart', methods=['POST'])
def get_chart_data():
    data = request.json
    raw_symbol = data.get('symbol', '')
    range_str = data.get('range', '1M')
    
    symbol, company_name, _ = resolve_symbol(raw_symbol)
    if not symbol:
        return jsonify({"error": "Invalid symbol"}), 400

    # Map frontend ranges to yfinance params
    # yfinance valid periods: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max
    # yfinance valid intervals: 1m,2m,5m,15m,30m,60m,90m,1h,1d,5d,1wk,1mo,3mo
    
    range_mapping = {
        '1D': {'period': '1d', 'interval': '1m'},
        '5D': {'period': '5d', 'interval': '5m'},
        '1M': {'period': '1mo', 'interval': '1d'},
        '6M': {'period': '6mo', 'interval': '1d'},
        'YTD': {'period': 'ytd', 'interval': '1d'},
        '1Y': {'period': '1y', 'interval': '1d'},
        '5Y': {'period': '5y', 'interval': '1wk'},
        'Max': {'period': 'max', 'interval': '1mo'}
    }
    
    params = range_mapping.get(range_str, {'period': '1mo', 'interval': '1d'})
    
    try:
        import requests
        session = requests.Session()
        session.headers['User-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        
        ticker = yf.Ticker(symbol, session=session)
        hist = ticker.history(period=params['period'], interval=params['interval'])
        
        if hist.empty:
            return jsonify({"error": "No data found", "data": [], "labels": []})
            
        hist = hist.reset_index()
        
        # Datetime column might be named 'Datetime' or 'Date' depending on interval
        time_col = 'Datetime' if 'Datetime' in hist.columns else 'Date'
        
        labels = []
        prices = []
        
        for i in range(len(hist)):
            row = hist.iloc[i]
            # Format time label based on interval
            if params['interval'] in ['1m', '5m', '15m']:
                labels.append(row[time_col].strftime('%Y-%m-%d %H:%M'))
            else:
                labels.append(row[time_col].strftime('%Y-%m-%d'))
                
            prices.append(round(row['Close'], 2))
            
        clean_symbol = symbol.split('.')[0]
        return jsonify({
            "symbol": clean_symbol,
            "name": company_name,
            "display_title": f"{company_name} / {clean_symbol}",
            "labels": labels,
            "prices": prices,
            "range": range_str
        })
        
    except Exception as e:
        print(f"Chart Error fetching {symbol} via yfinance: {e}. Trying FinMind fallback.")
        clean_symbol = symbol.split('.')[0]
        try:
            # 抓取過去一年的資料作為線圖備用
            start_date = datetime.now() - timedelta(days=365)
            fm_url = f"https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id={clean_symbol}&start_date={start_date.strftime('%Y-%m-%d')}"
            import requests
            fm_res = requests.get(fm_url, timeout=5).json()
            if fm_res.get('msg') == 'success' and fm_res.get('data') and len(fm_res['data']) > 0:
                labels = [row['date'] for row in fm_res['data']]
                prices = [row['close'] for row in fm_res['data']]
                return jsonify({
                    "symbol": clean_symbol,
                    "name": company_name,
                    "display_title": f"{company_name} / {clean_symbol} (備用線圖)",
                    "labels": labels,
                    "prices": prices,
                    "range": "1Y" # FinMind 返回過去一年的資料
                })
        except Exception as fm_e:
            print(f"Chart FinMind fallback failed: {fm_e}")

        print(f"Trying twstock chart fallback for {symbol}...")
        try:
            stock = twstock.Stock(clean_symbol)
            dates = stock.date
            if len(dates) > 0:
                labels = [d.strftime('%Y-%m-%d') for d in dates]
                prices = stock.price
                return jsonify({
                    "symbol": clean_symbol,
                    "name": company_name,
                    "display_title": f"{company_name} / {clean_symbol} (備用線圖)",
                    "labels": labels,
                    "prices": prices,
                    "range": "1M" # Force 1M for fallback as it only has 31 days easily
                })
        except Exception as tw_e:
            print(f"Chart twstock fallback failed: {tw_e}")
            
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)
