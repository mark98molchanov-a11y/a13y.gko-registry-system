#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Автоматическое обновление deals_clean.csv из Gist
Добавляет/обновляет столбец cadastrovy_nomer
"""

import csv
import json
from pathlib import Path

CSV_PATH = Path('data/deals_clean.csv')
CACHE_FILE = Path('data/nspd_cache.json')

def load_nspd_from_cache():
    """Загружает связи из кэша"""
    if not CACHE_FILE.exists():
        print(f"⚠️ Кэш не найден: {CACHE_FILE}")
        return {}
    
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки кэша: {e}")
        return {}

def update_csv(nspd_map):
    """Обновляет столбец cadastrovy_nomer в CSV"""
    print(f"📊 Обновление CSV: {CSV_PATH}")
    
    if not CSV_PATH.exists():
        print(f"❌ Файл не найден: {CSV_PATH}")
        return False
    
    rows = []
    headers = []
    updated_count = 0
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Проверяем, есть ли столбец cadastrovy_nomer
        if 'cadastrovy_nomer' not in headers:
            headers.append('cadastrovy_nomer')
            print("➕ Добавлен столбец cadastrovy_nomer")
        
        cadastrovy_idx = headers.index('cadastrovy_nomer')
        row_id_idx = headers.index('#') if '#' in headers else -1
        
        if row_id_idx == -1:
            try:
                row_id_idx = headers.index('row_id')
            except ValueError:
                print("❌ Колонка 'row_id' не найдена!")
                return False
        
        print(f"📌 row_id в колонке: {headers[row_id_idx]}")
        print(f"📌 cadastrovy_nomer в колонке: {headers[cadastrovy_idx]}")
        
        for row in reader:
            # Дополняем недостающими колонками
            while len(row) < len(headers):
                row.append('')
            
            row_id = row[row_id_idx].strip() if row_id_idx < len(row) else ''
            
            # Получаем текущее значение
            current_value = row[cadastrovy_idx].strip() if cadastrovy_idx < len(row) else ''
            
            # Если значение пустое или 'не определено' - обновляем
            if not current_value or current_value == 'не определено':
                if row_id in nspd_map:
                    row[cadastrovy_idx] = nspd_map[row_id]
                    updated_count += 1
                # Если нет в мапе - оставляем 'не определено'
            
            rows.append(row)
    
    # Сохраняем обновленный CSV
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    
    print(f"✅ Обновлено {updated_count} записей в cadastrovy_nomer")
    print(f"ℹ️ Пропущено (уже заполнены): {len(rows) - updated_count} записей")
    return True

def main():
    print("🔄 Запуск автоматического обновления CSV...")
    
    # Загружаем связи из кэша
    nspd_map = load_nspd_from_cache()
    if not nspd_map:
        print("⚠️ Нет связей для обновления")
        return
    
    print(f"📊 Загружено {len(nspd_map)} связей")
    
    # Обновляем CSV
    success = update_csv(nspd_map)
    
    if success:
        print("✅ Обновление завершено успешно!")
    else:
        print("❌ Обновление не удалось")

if __name__ == "__main__":
    main()
