#!/usr/bin/env python3
"""
Скрипт для обработки данных о сделках ЯНАО
Читает CSV и создает data/deals_by_quarter.json
"""

import csv
import json
import os
from collections import defaultdict
from datetime import datetime

def extract_quarter(cad_number):
    """Извлекает код квартала из кадастрового номера (первые 9 символов)"""
    if not cad_number or len(cad_number) < 9:
        return None
    return cad_number[:9]

def parse_date(date_str):
    """Парсит дату в формате YYYY-MM-DD"""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except:
        return None

def parse_quarter(date_str):
    """Определяет квартал по дате"""
    dt = parse_date(date_str)
    if not dt:
        return None
    month = dt.month
    if month <= 3:
        return 'Q1'
    elif month <= 6:
        return 'Q2'
    elif month <= 9:
        return 'Q3'
    else:
        return 'Q4'

def main():
    csv_path = 'data/all_deals_itog.csv'
    json_path = 'data/deals_by_quarter.json'
    
    # Проверяем существование файла
    if not os.path.exists(csv_path):
        print(f"❌ Файл {csv_path} не найден")
        return
    
    # Структуры для данных
    quarter_stats = defaultdict(lambda: {
        'count': 0,
        'total_price': 0,
        'avg_price': 0,
        'min_price': float('inf'),
        'max_price': 0,
        'years': defaultdict(int),
        'quarters': defaultdict(int),
        'deal_types': defaultdict(int),
        'object_types': defaultdict(int),
        'cities': defaultdict(int),
        'deals': []
    })
    
    total_rows = 0
    valid_rows = 0
    
    print("📊 Начинаем обработку CSV файла...")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            total_rows += 1
            
            # Извлекаем квартал
            cad_number = row.get('cad_number', '')
            quarter = extract_quarter(cad_number)
            if not quarter:
                continue
                
            # Парсим цену
            try:
                price = float(row.get('deal_price', 0) or 0)
            except:
                price = 0
                
            # Парсим дату
            date_str = row.get('reg_date', '')
            year = None
            quarter_name = None
            if date_str:
                dt = parse_date(date_str)
                if dt:
                    year = dt.year
                    quarter_name = parse_quarter(date_str)
            
            # Собираем статистику
            stats = quarter_stats[quarter]
            stats['count'] += 1
            if price > 0:
                stats['total_price'] += price
                if price < stats['min_price']:
                    stats['min_price'] = price
                if price > stats['max_price']:
                    stats['max_price'] = price
            if year:
                stats['years'][year] += 1
            if quarter_name:
                stats['quarters'][quarter_name] += 1
                
            deal_type = row.get('deal_kind_text', 'Неизвестно')
            if deal_type:
                stats['deal_types'][deal_type] += 1
                
            obj_type = row.get('obj_kind_text', 'Неизвестно')
            if obj_type:
                stats['object_types'][obj_type] += 1
                
            city = row.get('city', 'Неизвестно')
            if city:
                stats['cities'][city] += 1
                
            # Сохраняем последние 10 сделок для примера
            if len(stats['deals']) < 10:
                stats['deals'].append({
                    'price': price,
                    'area': row.get('area', ''),
                    'date': date_str,
                    'type': deal_type,
                    'obj_type': obj_type,
                    'city': city
                })
            
            valid_rows += 1
            
            # Прогресс каждые 1000 строк
            if total_rows % 1000 == 0:
                print(f"  Обработано {total_rows} строк...")
    
    # Вычисляем средние значения
    for quarter, stats in quarter_stats.items():
        if stats['count'] > 0:
            stats['avg_price'] = round(stats['total_price'] / stats['count'], 2)
        
        # Преобразуем defaultdict в обычный dict для JSON
        stats['years'] = dict(stats['years'])
        stats['quarters'] = dict(stats['quarters'])
        stats['deal_types'] = dict(stats['deal_types'])
        stats['object_types'] = dict(stats['object_types'])
        stats['cities'] = dict(stats['cities'])
    
    # Подготавливаем финальный результат
    result = {
        'metadata': {
            'version': '1.0',
            'processed_at': datetime.now().isoformat(),
            'total_rows': total_rows,
            'valid_rows': valid_rows,
            'quarters_count': len(quarter_stats),
            'source_file': 'all_deals_itog.csv'
        },
        'quarters': dict(quarter_stats)
    }
    
    # Сохраняем JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Обработка завершена!")
    print(f"📊 Всего строк: {total_rows}")
    print(f"✅ Валидных строк: {valid_rows}")
    print(f"🏘️ Уникальных кварталов: {len(quarter_stats)}")
    print(f"💾 Результат сохранен в: {json_path}")

if __name__ == '__main__':
    main()
