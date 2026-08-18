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
        result = handler({"json": data})
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    print(f"🔥 Запуск на порту {port}", flush=True)
    app.run(host='0.0.0.0', port=port)
