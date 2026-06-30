#!/usr/bin/env python3
"""
Скрипт для обработки данных о сделках ЯНАО
Сохраняет ВСЕ поля для будущей таблицы с фильтрами
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

def safe_float(val):
    """Безопасное преобразование в float"""
    if not val or val == '':
        return None
    try:
        return float(val)
    except:
        return None

def safe_str(val):
    """Безопасное преобразование в строку"""
    if val is None:
        return ''
    return str(val).strip()

def main():
    csv_path = 'data/all_deals_itog.csv'
    json_path = 'data/deals_by_quarter.json'
    
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
        # 🔥 НОВОЕ: для таблицы сохраняем ВСЕ сделки с полными данными
        'all_deals': []  # Теперь храним ВСЕ сделки, а не только 10
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
            price = safe_float(row.get('deal_price', 0))
            
            # Парсим кадастровую стоимость
            cad_cost = safe_float(row.get('cad_cost', 0))
            
            # Парсим УПКС
            upks = safe_float(row.get('upks', 0))
            
            # Парсим УПРС
            uprs = safe_float(row.get('uprs', 0))
            
            # Парсим год постройки
            year_build = None
            try:
                year_build = int(row.get('year_build', 0)) if row.get('year_build', '').strip() else None
            except:
                year_build = None
            
            # Парсим этаж
            floor = None
            try:
                floor = int(row.get('floor', 0)) if row.get('floor', '').strip() else None
            except:
                floor = None
            
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
            if price and price > 0:
                stats['total_price'] += price
                if price < stats['min_price']:
                    stats['min_price'] = price
                if price > stats['max_price']:
                    stats['max_price'] = price
            if year:
                stats['years'][year] += 1
            if quarter_name:
                stats['quarters'][quarter_name] += 1
                
            deal_type = row.get('deal_kind_text', '')
            if deal_type:
                stats['deal_types'][deal_type] += 1
                
            obj_type = row.get('obj_kind_text', '')
            if obj_type:
                stats['object_types'][obj_type] += 1
                
            city = row.get('city', '')
            if city:
                stats['cities'][city] += 1
            
            # 🔥 СОХРАНЯЕМ ВСЕ ДАННЫЕ О СДЕЛКЕ (для таблицы)
            deal_record = {
                'cad_number': cad_number,
                'area': safe_float(row.get('area', 0)),
                'reg_date': date_str,
                'purpose_text': safe_str(row.get('purpose_text', '')),
                'cad_cost': cad_cost,
                'upks': upks,
                'deal_price': price,
                'deal_currency': safe_str(row.get('deal_currency', '')),
                'city': safe_str(city),
                'locality': safe_str(row.get('locality', '')),
                'street': safe_str(row.get('street', '')),
                'deal_kind_text': safe_str(deal_type),
                'obj_kind_text': safe_str(obj_type),
                'vri': safe_str(row.get('vri', '')),
                'uprs': uprs,
                'quarter': row.get('Квартал сделки', ''),
                'year_build': year_build,
                'floor': floor,
                'wall_material_name': safe_str(row.get('wall_material_name', ''))
            }
            
            stats['all_deals'].append(deal_record)
            valid_rows += 1
            
            # Прогресс каждые 1000 строк
            if total_rows % 1000 == 0:
                print(f"  Обработано {total_rows} строк... (сохранено сделок: {valid_rows})")
    
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
            'version': '2.0',
            'processed_at': datetime.now().isoformat(),
            'total_rows': total_rows,
            'valid_rows': valid_rows,
            'quarters_count': len(quarter_stats),
            'source_file': 'all_deals_itog.csv',
            'fields': [
                'cad_number', 'area', 'reg_date', 'purpose_text', 'cad_cost',
                'upks', 'deal_price', 'deal_currency', 'city', 'locality',
                'street', 'deal_kind_text', 'obj_kind_text', 'vri', 'uprs',
                'quarter', 'year_build', 'floor', 'wall_material_name'
            ]
        },
        'quarters': dict(quarter_stats)
    }
    
    # Сохраняем JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # Выводим статистику
    total_size_mb = os.path.getsize(json_path) / (1024 * 1024)
    print(f"\n✅ Обработка завершена!")
    print(f"📊 Всего строк: {total_rows}")
    print(f"✅ Валидных строк: {valid_rows}")
    print(f"🏘️ Уникальных кварталов: {len(quarter_stats)}")
    print(f"💾 Результат сохранен в: {json_path}")
    print(f"📦 Размер JSON: {total_size_mb:.2f} MB")

if __name__ == '__main__':
    main()
