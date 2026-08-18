import sys
import os

# 🔥 ПРИНУДИТЕЛЬНЫЙ ВЫВОД В ЛОГИ
print("=" * 60, flush=True)
print("🔥🔥🔥 APP.PY ЗАПУЩЕН!", flush=True)
print("=" * 60, flush=True)
sys.stdout.flush()
sys.stderr.flush()

from flask import Flask, request, jsonify
from flask_cors import CORS

print("✅ Flask импортирован", flush=True)
sys.stdout.flush()

# 🔥 ДОБАВЛЕНО: ИМПОРТЫ ДЛЯ БАЗЫ ДАННЫХ
from db import SessionLocal, ValuationRequest, init_db, save_request
import json
from datetime import datetime

# Устанавливаем рабочую директорию
os.chdir('/app')
print(f"📁 Рабочая директория: {os.getcwd()}", flush=True)

# Список файлов в директории
print("📁 Файлы в /app:", os.listdir('.'), flush=True)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
print("✅ sys.path настроен", flush=True)

# ПРИНУДИТЕЛЬНЫЙ ИМПОРТ
print("🔄 Импортирую index.py...", flush=True)
from index import handler, MODELS, load_models
print("✅ index.py импортирован!", flush=True)

# СОЗДАЁМ APP
app = Flask(__name__)
CORS(app)
print("✅ Flask app создан", flush=True)

# 🔥 ДОБАВЛЕНО: ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ
init_db()
print("✅ База данных инициализирована", flush=True)

# 🔥 ПРИНУДИТЕЛЬНАЯ ЗАГРУЗКА МОДЕЛЕЙ
print("=" * 60, flush=True)
print("🚀 НАЧИНАЮ ЗАГРУЗКУ МОДЕЛЕЙ!", flush=True)
print("=" * 60, flush=True)
sys.stdout.flush()

load_models()

print("=" * 60, flush=True)
print("✅ ВСЕ МОДЕЛИ ЗАГРУЖЕНЫ!", flush=True)
print("=" * 60, flush=True)
sys.stdout.flush()

@app.route('/api/index', methods=['POST'])
def api_handler():
    try:
        data = request.get_json()
        
        # Получаем аргументы (для сохранения в БД)
        args = data.get('args', [])
        
        # 🔥 Вызываем handler из index.py (основной расчёт)
        result = handler({"json": data})
        
        # 🔥🔥🔥 СОХРАНЯЕМ В БД
        try:
            # Парсим аргументы
            area = float(args[0]) if len(args) > 0 and args[0] else None
            build_year = int(args[1]) if len(args) > 1 and args[1] else None
            object_type = args[2] if len(args) > 2 else None
            permitted_use = args[3] if len(args) > 3 else None
            city = args[4] if len(args) > 4 else None
            cadastral_price = float(args[5]) if len(args) > 5 and args[5] else None
            wall_material = args[6] if len(args) > 6 else None
            object_name = args[7] if len(args) > 7 else None
            purpose = args[8] if len(args) > 8 else None
            
            # Получаем результат
            predicted = result.get('body', {})
            if isinstance(predicted, str):
                predicted = json.loads(predicted)
            
            details = predicted.get('details', {})
            price_per_sqm = predicted.get('predicted', {}).get('price_per_sqm')
            price_total = predicted.get('predicted', {}).get('price_total')
            
            # 🔥 Подготовка данных для сохранения
            request_data = {
                'ip': request.remote_addr,
                'area': area,
                'build_year': build_year,
                'object_type': object_type,
                'city': city,
                'cadastral_price': cadastral_price,
                'wall_material': wall_material,
                'object_name': object_name,
                'purpose': purpose,
                'permitted_use': permitted_use,
                'result_price_per_sqm': price_per_sqm,
                'result_price_total': price_total,
                'method': details.get('method'),
                'analogs': json.dumps(details.get('analogs', [])),
                'percent_diff': details.get('percent_diff'),
                'ratio_to_ks': details.get('ratio_to_ks'),
                'ks_used': details.get('ks_per_sqm'),
                'ks_provided': 'Да' if details.get('ks_provided') else 'Нет'
            }
            
            # 🔥 Сохраняем через безопасную функцию
            request_id = save_request(request_data)
            if request_id:
                print(f"✅ Запрос сохранён в БД (ID: {request_id})", flush=True)
            else:
                print("⚠️ Не удалось сохранить запрос в БД", flush=True)
                
        except Exception as e:
            print(f"⚠️ Ошибка сохранения в БД: {e}", flush=True)
            import traceback
            traceback.print_exc()
        
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

# 🔥 ДОБАВЛЕНО: ЭНДПОИНТ ДЛЯ СТАТИСТИКИ
@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Возвращает статистику по запросам"""
    try:
        db = SessionLocal()
        from sqlalchemy import func
        
        # Общее количество
        total = db.query(ValuationRequest).count()
        
        # За сегодня
        today = db.query(ValuationRequest).filter(
            ValuationRequest.timestamp >= datetime.utcnow().date()
        ).count()
        
        # Топ 5 городов
        top_cities = db.query(
            ValuationRequest.city,
            func.count(ValuationRequest.id)
        ).group_by(ValuationRequest.city).order_by(func.count().desc()).limit(5).all()
        
        # Топ 5 типов объектов
        top_types = db.query(
            ValuationRequest.object_type,
            func.count(ValuationRequest.id)
        ).group_by(ValuationRequest.object_type).order_by(func.count().desc()).limit(5).all()
        
        # Последние 10 запросов
        recent = db.query(ValuationRequest).order_by(
            ValuationRequest.timestamp.desc()
        ).limit(10).all()
        
        recent_data = [{
            'id': r.id,
            'timestamp': r.timestamp.isoformat(),
            'city': r.city,
            'object_type': r.object_type,
            'area': r.area,
            'price_per_sqm': r.result_price_per_sqm,
            'price_total': r.result_price_total
        } for r in recent]
        
        db.close()
        
        return jsonify({
            'total_requests': total,
            'today_requests': today,
            'top_cities': [{'city': c[0] or 'Не указан', 'count': c[1]} for c in top_cities],
            'top_object_types': [{'type': t[0] or 'Не указан', 'count': t[1]} for t in top_types],
            'recent_requests': recent_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    print(f"🔥 Запуск на порту {port}", flush=True)
    app.run(host='0.0.0.0', port=port)
