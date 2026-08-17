from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from index import handler, MODELS, load_models

app = Flask(__name__)
CORS(app)

load_models()

@app.route('/api/index', methods=['POST'])
def api_handler():
    try:
        # 🔥 ПРАВИЛЬНО: передаём словарь с ключом 'json'
        data = request.get_json()
        result = handler({"json": data})  # ← ОБЕРТЫВАЕМ В {"json": ...}
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
