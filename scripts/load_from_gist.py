#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Загрузка связей из Gist для GitHub Action
Загружает row_id → cadastrovy_nomer и cadastral_value
"""

import os
import json
import time
import requests
from pathlib import Path

GIST_ID = os.environ.get('GIST_ID', '9f6e65a18e94b61a6b7a96389e9109c5')
GIST_URL = f'https://api.github.com/gists/{GIST_ID}'
CACHE_FILE = Path('data/nspd_cache.json')

def load_nspd_from_gist():
    """Загружает связи row_id → {cadastrovy_nomer, cadastral_value} из Gist"""
    print(f"📥 Загрузка связей из Gist: {GIST_ID}")
    
    try:
        response = requests.get(GIST_URL, headers={'Accept': 'application/json'})
        if response.status_code != 200:
            print(f"⚠️ Ошибка: {response.status_code}")
            return {}
        
        data = response.json()
        file = data.get('files', {}).get('deals_clean.csv')
        
        if not file:
            print("⚠️ Файл не найден в Gist")
            return {}
        
        # ✅ ЧИТАЕМ ЧЕРЕЗ raw_url, ЕСЛИ ФАЙЛ ОБРЕЗАН ИЛИ БОЛЬШОЙ
        file_size = file.get('size', 0)
        is_truncated = file.get('truncated', False)
        
        if is_truncated or file_size > 500000:
            print(f"📥 Файл большой ({file_size} байт, truncated={is_truncated}), читаем через raw_url...")
            
            raw_url = file.get('raw_url')
            if not raw_url:
                print("❌ raw_url отсутствует, используем content (может быть обрезан)")
                content = file.get('content', '')
            else:
                # ✅ ?t= для обхода кэша CDN GitHub
                separator = '&' if '?' in raw_url else '?'
                raw_url_cache = f"{raw_url}{separator}t={int(time.time())}"
                
                raw_response = requests.get(raw_url_cache, headers={'Accept': 'text/plain'})
                if raw_response.status_code != 200:
                    print(f"❌ Ошибка raw_url: {raw_response.status_code}, используем content")
                    content = file.get('content', '')
                else:
                    content = raw_response.text
                    print(f"✅ Получено через raw_url: {len(content)} символов")
        else:
            content = file.get('content', '')
            print(f"✅ Получено через API: {len(content)} символов")
        
        if not content:
            print("⚠️ Содержимое файла пустое")
            return {}
        
        lines = content.split('\n')
        
        if len(lines) < 2:
            return {}
        
        headers = lines[0].split(',')
        row_id_idx = headers.index('row_id') if 'row_id' in headers else -1
        nspd_idx = headers.index('cad_nspd') if 'cad_nspd' in headers else -1
        cadastral_value_idx = headers.index('cadastral_value') if 'cadastral_value' in headers else -1
        
        if row_id_idx == -1:
            print("⚠️ Колонка 'row_id' не найдена")
            return {}
        
        if nspd_idx == -1:
            print("⚠️ Колонка 'cad_nspd' не найдена")
            return {}
        
        if cadastral_value_idx == -1:
            print("⚠️ Колонка 'cadastral_value' не найдена (будет сохранена только cad_nspd)")
        
        nspd_map = {}
        for line in lines[1:]:
            if not line.strip():
                continue
            values = line.split(',')
            if len(values) > max(row_id_idx, nspd_idx, cadastral_value_idx if cadastral_value_idx != -1 else 0):
                row_id = values[row_id_idx].strip() if row_id_idx < len(values) else ''
                nspd = values[nspd_idx].strip() if nspd_idx < len(values) else ''
                
                # Извлекаем cadastral_value
                cadastral_value = ''
                if cadastral_value_idx != -1 and cadastral_value_idx < len(values):
                    cadastral_value = values[cadastral_value_idx].strip()
                
                if row_id and nspd:
                    nspd_map[row_id] = {
                        'cadastrovy_nomer': nspd,
                        'cadastral_value': cadastral_value
                    }
                    # ⚠️ Закомментировано, чтобы не засорять логи
                    # print(f"   Загружено: row_id={row_id}, cad_nspd={nspd}, cadastral_value={cadastral_value}")
        
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
    print(f"✅ Загружено {len(nspd_map)} связей для обновления")

if __name__ == "__main__":
    main()
