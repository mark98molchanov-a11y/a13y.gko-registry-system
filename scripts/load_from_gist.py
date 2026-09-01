#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Загрузка связей из Gist для GitHub Action
"""

import os
import json
import requests
from pathlib import Path

GIST_ID = os.environ.get('GIST_ID', '9f6e65a18e94b61a6b7a96389e9109c5')
GIST_URL = f'https://api.github.com/gists/{GIST_ID}'
CACHE_FILE = Path('data/nspd_cache.json')

def load_nspd_from_gist():
    """Загружает связи row_id → cad_nspd из Gist"""
    print(f"📥 Загрузка связей из Gist: {GIST_ID}")
    
    try:
        response = requests.get(GIST_URL, headers={'Accept': 'application/json'})
        if response.status_code != 200:
            print(f"⚠️ Ошибка: {response.status_code}")
            return {}
        
        data = response.json()
        file = data.get('files', {}).get('deals_clean.csv')
        
        if not file or not file.get('content'):
            print("⚠️ Файл не найден в Gist")
            return {}
        
        content = file['content']
        lines = content.split('\n')
        
        if len(lines) < 2:
            return {}
        
        headers = lines[0].split(',')
        row_id_idx = headers.index('row_id') if 'row_id' in headers else -1
        nspd_idx = headers.index('cad_nspd') if 'cad_nspd' in headers else -1
        
        if row_id_idx == -1 or nspd_idx == -1:
            print("⚠️ Не найдены колонки row_id или cad_nspd")
            return {}
        
        nspd_map = {}
        for line in lines[1:]:
            if not line.strip():
                continue
            values = line.split(',')
            if len(values) > max(row_id_idx, nspd_idx):
                row_id = values[row_id_idx].strip()
                nspd = values[nspd_idx].strip()
                if row_id and nspd and nspd != 'не определено':
                    nspd_map[row_id] = nspd
        
        print(f"✅ Загружено {len(nspd_map)} связей")
        
        # Сохраняем кэш
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(nspd_map, f, ensure_ascii=False, indent=2)
        print(f"💾 Кэш сохранен в {CACHE_FILE}")
        
        return nspd_map
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return {}

def main():
    nspd_map = load_nspd_from_gist()
    if not nspd_map:
        print("⚠️ Нет связей для обновления")
        return

if __name__ == "__main__":
    main()
