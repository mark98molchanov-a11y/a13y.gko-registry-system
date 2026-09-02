#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Автоматическое обновление deals_clean.csv из Gist
Добавляет/обновляет столбцы:
- cadastrovy_nomer
- cadastral_value
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
    """Обновляет столбцы cadastrovy_nomer и cadastral_value в CSV"""
    print(f"📊 Обновление CSV: {CSV_PATH}")
    
    if not CSV_PATH.exists():
        print(f"❌ Файл не найден: {CSV_PATH}")
        return False
    
    rows = []
    headers = []
    updated_nspd_count = 0
    updated_value_count = 0
    
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Проверяем, есть ли столбец cadastrovy_nomer
        if 'cadastrovy_nomer' not in headers:
            headers.append('cadastrovy_nomer')
            print("➕ Добавлен столбец cadastrovy_nomer")
        
        # Проверяем, есть ли столбец cadastral_value
        if 'cadastral_value' not in headers:
            headers.append('cadastral_value')
            print("➕ Добавлен столбец cadastral_value")
        
        cadastrovy_idx = headers.index('cadastrovy_nomer')
        cadastral_value_idx = headers.index('cadastral_value')
        row_id_idx = headers.index('#') if '#' in headers else -1
        
        if row_id_idx == -1:
            try:
                row_id_idx = headers.index('row_id')
            except ValueError:
                print("❌ Колонка 'row_id' не найдена!")
                return False
        
        print(f"📌 row_id в колонке: {headers[row_id_idx]}")
        print(f"📌 cadastrovy_nomer в колонке: {headers[cadastrovy_idx]}")
        print(f"📌 cadastral_value в колонке: {headers[cadastral_value_idx]}")
        
        for row in reader:
            # Дополняем недостающими колонками
            while len(row) < len(headers):
                row.append('')
            
            row_id = row[row_id_idx].strip() if row_id_idx < len(row) else ''
            
            # Проверяем, есть ли связь для этого row_id
            if row_id in nspd_map:
                nspd_data = nspd_map[row_id]
                
                # ✅ Обновляем cadastrovy_nomer (только если пусто)
                current_nspd = row[cadastrovy_idx].strip() if cadastrovy_idx < len(row) else ''
                if not current_nspd:
                    row[cadastrovy_idx] = nspd_data.get('cadastrovy_nomer', 'не определено')
                    updated_nspd_count += 1
                
                # ✅ Обновляем cadastral_value (только если пусто)
                current_value = row[cadastral_value_idx].strip() if cadastral_value_idx < len(row) else ''
                if not current_value:
                    row[cadastral_value_idx] = nspd_data.get('cadastral_value', 'не определено')
                    updated_value_count += 1
            
            rows.append(row)
    
    # Сохраняем обновленный CSV
    with open(CSV_PATH, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    
    print(f"✅ Обновлено cadastrovy_nomer: {updated_nspd_count} записей")
    print(f"✅ Обновлено cadastral_value: {updated_value_count} записей")
    print(f"ℹ️ Всего строк: {len(rows)}")
    
    if updated_nspd_count == 0 and updated_value_count == 0:
        print("ℹ️ Нет новых данных для обновления")
    else:
        print(f"📊 Итого обновлено: {max(updated_nspd_count, updated_value_count)} записей")
    
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
