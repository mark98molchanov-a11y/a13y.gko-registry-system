# ml-models/server.py
import os
import sys
import json
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get('PORT', 5000))

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'CatBoost ML сервер работает'})

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        print(f"📊 Получен запрос: {data}")
        
        # Запускаем ваш predict.py
        result = subprocess.run([
            sys.executable, 'predict.py',
            str(data['area']),
            str(data.get('build_year', 2015)),
            data.get('object_type', 'Здание'),
            data.get('permitted_use', ''),
            data.get('address', ''),
            data.get('kadastr', ''),
            data.get('wall_material', ''),
            data.get('name', '')
        ], capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)))
        
        if result.returncode == 0:
            prediction = json.loads(result.stdout)
            print("✅ Оценка выполнена успешно")
            return jsonify(prediction)
        else:
            print(f"❌ Ошибка: {result.stderr}")
            return jsonify({'error': result.stderr}), 500
            
    except Exception as e:
        print(f"❌ Исключение: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 CatBoost ML Сервер запущен")
    print(f"📊 Порт: {PORT}")
    print("🔮 Endpoint: /predict")
    print("=" * 50)
    app.run(host='0.0.0.0', port=PORT)
