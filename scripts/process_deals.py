#!/usr/bin/env python3
"""
Скрипт для обработки данных о сделках ЯНАО
Оптимизирован для большого объема данных
"""

import csv
import json
import os
from collections import defaultdict
from datetime import datetime

def extract_quarter(cad_number):
    if not cad_number or len(cad_number) < 9:
        return None
    return cad_number[:9]

def safe_float(val):
    if not val or val == '':
        return None
    try:
        return float(val)
    except:
        return None

def safe_str(val):
    if val is None:
        return ''
    return str(val).strip()

def main():
    csv_path = 'data/all_deals_itog.csv'
    json_path = 'data/deals_by_quarter.json'
    
    if not os.path.exists(csv_path):
        print(f"❌ Файл {csv_path} не найден")
        return
    
    # Используем обычный dict для экономии памяти
    quarter_stats = {}
    
    total_rows = 0
    valid_rows = 0
    
    print("📊 Начинаем обработку CSV файла...")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            total_rows += 1
            
            cad_number = row.get('cad_number', '')
            quarter = extract_quarter(cad_number)
            if not quarter:
                continue
            
            # Инициализируем квартал, если его нет
            if quarter not in quarter_stats:
                quarter_stats[quarter] = {
                    'count': 0,
                    'total_price': 0,
                    'avg_price': 0,
                    'min_price': float('inf'),
                    'max_price': 0,
                    'years': {},
                    'quarters': {},
                    'deal_types': {},
                    'object_types': {},
                    'cities': {},
                    'all_deals': []  # Все сделки
                }
            
            stats = quarter_stats[quarter]
            
            # Парсим данные
            price = safe_float(row.get('deal_price', 0))
            cad_cost = safe_float(row.get('cad_cost', 0))
            upks = safe_float(row.get('upks', 0))
            uprs = safe_float(row.get('uprs', 0))
            
            year_build = None
            try:
                val = row.get('year_build', '').strip()
                if val:
                    year_build = int(float(val))
            except:
                year_build = None
            
            floor = None
            try:
                val = row.get('floor', '').strip()
                if val:
                    floor = int(float(val))
            except:
                floor = None
            
            # Дата и квартал
            date_str = row.get('reg_date', '')
            year = None
            quarter_name = None
            if date_str:
                try:
                    dt = datetime.strptime(date_str, '%Y-%m-%d')
                    year = dt.year
                    month = dt.month
                    if month <= 3:
                        quarter_name = 'Q1'
                    elif month <= 6:
                        quarter_name = 'Q2'
                    elif month <= 9:
                        quarter_name = 'Q3'
                    else:
                        quarter_name = 'Q4'
                except:
                    pass
            
            # Обновляем статистику
            stats['count'] += 1
            if price and price > 0:
                stats['total_price'] += price
                if price < stats['min_price']:
                    stats['min_price'] = price
                if price > stats['max_price']:
                    stats['max_price'] = price
            
            if year:
                stats['years'][year] = stats['years'].get(year, 0) + 1
            if quarter_name:
                stats['quarters'][quarter_name] = stats['quarters'].get(quarter_name, 0) + 1
            
            deal_type = row.get('deal_kind_text', '')
            if deal_type:
                stats['deal_types'][deal_type] = stats['deal_types'].get(deal_type, 0) + 1
            
            obj_type = row.get('obj_kind_text', '')
            if obj_type:
                stats['object_types'][obj_type] = stats['object_types'].get(obj_type, 0) + 1
            
            city = row.get('city', '')
            if city:
                stats['cities'][city] = stats['cities'].get(city, 0) + 1
            
            # Сохраняем сделку (все поля)
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
            
            # Прогресс каждые 5000 строк
            if total_rows % 5000 == 0:
                print(f"  Обработано {total_rows} строк... (сохранено сделок: {valid_rows})")
    
    # Вычисляем средние значения
    for quarter, stats in quarter_stats.items():
        if stats['count'] > 0 and stats['total_price'] > 0:
            stats['avg_price'] = round(stats['total_price'] / stats['count'], 2)
    
    # Подготавливаем финальный результат
    result = {
        'metadata': {
            'version': '2.0',
            'processed_at': datetime.now().isoformat(),
            'total_rows': total_rows,
            'valid_rows': valid_rows,
            'quarters_count': len(quarter_stats),
            'source_file': 'all_deals_itog.csv'
        },
        'quarters': quarter_stats
    }
    
    # Сохраняем JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    total_size_mb = os.path.getsize(json_path) / (1024 * 1024)
    print(f"\n✅ Обработка завершена!")
    print(f"📊 Всего строк: {total_rows}")
    print(f"✅ Валидных строк: {valid_rows}")
    print(f"🏘️ Уникальных кварталов: {len(quarter_stats)}")
    print(f"💾 Результат сохранен в: {json_path}")
    print(f"📦 Размер JSON: {total_size_mb:.2f} MB")

if __name__ == '__main__':
    main()
