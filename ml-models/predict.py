# ml-models/predict.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
import pickle
import sys
import json
import pandas as pd
import numpy as np
import re

def is_empty(val):
    if pd.isna(val): return True
    s = str(val).strip().lower()
    return s in ['', 'nan', 'none', 'null', '-', 'нет']

def clean_val(val, max_len=80):
    if pd.isna(val) or str(val).strip().lower() in ['nan', 'none', '']: return ''
    return str(val).strip()[:max_len]

def get_object_category(name):
    if pd.isna(name) or not name: return 0
    name_lower = str(name).lower()
    if re.search(r'гараж|бокс', name_lower): return 10
    if re.search(r'магазин|торгов|павильон', name_lower): return 20
    if re.search(r'офис|административ|контор', name_lower): return 30
    if re.search(r'склад', name_lower): return 40
    if re.search(r'жилой дом|дом|дача|коттедж', name_lower): return 50
    if re.search(r'квартир|помещение', name_lower): return 60
    if re.search(r'производствен|цех|корпус|станция|котельная', name_lower): return 70
    return 0

def get_land_use_category(permitted_use):
    if pd.isna(permitted_use): return 0
    text = str(permitted_use).lower()
    if re.search(r'гараж|стоянк|хранени', text): return 1
    if re.search(r'садоводств|огородничеств|дачн', text): return 2
    if re.search(r'индивидуальн.*жилищн.*строительств|жил.*застройк', text): return 3
    if re.search(r'магазин|торгов', text): return 4
    if re.search(r'склад', text): return 5
    if re.search(r'производствен|полезн.*ископаем|разработк', text): return 6
    if re.search(r'административн|офис|делов.*управлени', text): return 7
    return 0

def get_land_category(category):
    if pd.isna(category): return 0
    text = str(category).lower()
    if 'населенных пунктов' in text: return 1
    if 'сельскохозяйственного' in text: return 2
    if 'промышленности' in text or 'специального назначения' in text: return 3
    if 'лесного фонда' in text: return 4
    return 0

# ========== Загрузка моделей и данных ==========
try:
    with open("model_buildings.pkl", "rb") as f: 
        model_buildings = pickle.load(f)
    print("✅ model_buildings.pkl loaded", file=sys.stderr)
except Exception as e:
    print(f"⚠️ model_buildings.pkl not loaded: {e}", file=sys.stderr)
    model_buildings = None

try:
    with open("model_land.pkl", "rb") as f: 
        model_land = pickle.load(f)
    print("✅ model_land.pkl loaded", file=sys.stderr)
except Exception as e:
    print(f"⚠️ model_land.pkl not loaded: {e}", file=sys.stderr)
    model_land = None

try:
    df = pd.read_csv("deals_clean.csv")
    print(f"✅ Data loaded: {len(df)} records", file=sys.stderr)
except Exception as e:
    print(f"❌ Failed to load deals_clean.csv: {e}", file=sys.stderr)
    df = pd.DataFrame()

# ========== Входные параметры ==========
area = float(sys.argv[1])
build_year = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
object_type = sys.argv[3] if len(sys.argv) > 3 else 'Помещение'
permitted_use = sys.argv[4] if len(sys.argv) > 4 else ''
address = sys.argv[5] if len(sys.argv) > 5 else ''
kadastr = sys.argv[6] if len(sys.argv) > 6 else ''
wall_material = sys.argv[7] if len(sys.argv) > 7 else ''
object_name = sys.argv[8] if len(sys.argv) > 8 else ''

# Определяем тип
type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
type_code = type_map.get(object_type, 0)
is_land = (type_code == 1)

# Подготовка признаков
if not is_land:
    material_map = {'Кирпич': 1, 'Панель': 2, 'Монолит': 3, 'Дерево': 4, 'Блок': 5}
    wall_code = material_map.get(wall_material, 0)
    name_category = get_object_category(object_name)
else:
    wall_code = 0
    name_category = 0
    # для земли год не важен
    if build_year < 2000:
        build_year = 2024

land_use_code = get_land_use_category(permitted_use)
land_category_code = get_land_category(permitted_use)

# Город
city = ''
if address:
    for part in address.replace(',', ' ').split():
        if len(part) > 3 and part[0].isupper():
            city = part
            break

# ========== ML-прогноз (только для справки) ==========
if is_land and model_land and not df.empty:
    try:
        price_sqm = model_land.predict([[area, build_year, land_use_code, land_category_code]])[0]
        print(f"🌾 ML Land prediction: {price_sqm:.0f} RUB/sqm", file=sys.stderr)
    except:
        price_sqm = df['price_per_sqm'].median() if not df.empty else 45000
elif not is_land and model_buildings and not df.empty:
    try:
        price_sqm = model_buildings.predict([[area, build_year, type_code, wall_code, name_category]])[0]
        print(f"🏢 ML Building prediction: {price_sqm:.0f} RUB/sqm", file=sys.stderr)
    except:
        price_sqm = df['price_per_sqm'].median() if not df.empty else 45000
else:
    price_sqm = df['price_per_sqm'].median() if not df.empty else 45000
    print(f"⚠️ Using median: {price_sqm:.0f} RUB/sqm", file=sys.stderr)

# ========== ПОДБОР АНАЛОГОВ ПО ПРАВИЛАМ ==========
def find_analogs_by_rules(df, object_type_code, area, build_year, permitted_use, object_name, wall_material, city, is_land):
    if df.empty:
        return []
    
    # Базовая фильтрация по типу
    filtered = df[df['object_type_code'] == object_type_code].copy()
    if filtered.empty:
        return []
    
    # Фильтрация по площади (±50% для начала, потом расширим)
    area_min, area_max = area * 0.5, area * 1.5
    filtered = filtered[(filtered['area'] >= area_min) & (filtered['area'] <= area_max)]
    
    if len(filtered) < 5:
        area_min, area_max = area * 0.3, area * 3.0
        filtered = filtered[(filtered['area'] >= area_min) & (filtered['area'] <= area_max)]
    
    scored = []
    for idx, row in filtered.iterrows():
        score = 0
        
        # 1. Совпадение по назначению (самый важный фактор)
        if is_land:
            # Для земли: совпадение категории земель обязательно
            if row.get('land_category_code', 0) != land_category_code:
                continue
            # Совпадение по ВРИ (текстовое) - большой бонус
            if permitted_use and row.get('permitted_use'):
                if permitted_use.lower() in row['permitted_use'].lower() or row['permitted_use'].lower() in permitted_use.lower():
                    score += 15
                else:
                    score += 5
        else:
            # Для ОКС: совпадение по наименованию (ключевые слова)
            if object_name and row.get('name'):
                obj_words = set(object_name.lower().split())
                row_words = set(row['name'].lower().split())
                common = obj_words.intersection(row_words)
                score += len(common) * 7
            
            # Совпадение по материалу стен
            if wall_material and row.get('wall_material'):
                if wall_material.lower() in row['wall_material'].lower():
                    score += 5
        
        # 2. Близость площади
        area_ratio = min(area, row['area']) / max(area, row['area'])
        score += area_ratio * 15
        
        # 3. Близость года постройки (только для ОКС)
        if not is_land:
            year_diff = abs(build_year - row['build_year'])
            if year_diff <= 5:
                score += 8
            elif year_diff <= 10:
                score += 4
            elif year_diff <= 20:
                score += 1
            elif year_diff > 30:
                score -= 10
        
        # 4. Бонус за город
        if city and row.get('address') and city.lower() in row['address'].lower():
            score += 3
        
        if score > 0:
            scored.append((score, idx, row))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:5]

# Поиск аналогов
analogs_scored = []
if not df.empty:
    analogs_scored = find_analogs_by_rules(df, type_code, area, build_year, permitted_use, 
                                           object_name, wall_material, city, is_land)
    
    if not analogs_scored:
        analogs_scored = find_analogs_by_rules(df, type_code, area*10, build_year, permitted_use, 
                                               object_name, wall_material, city, is_land)

print(f"🔍 Found {len(analogs_scored)} analogs", file=sys.stderr)

# ========== РАСЧЕТ ИТОГОВОЙ ЦЕНЫ ПО АНАЛОГАМ ==========
if analogs_scored:
    total_weight = 0
    weighted_price = 0
    for score, _, row in analogs_scored:
        weight = max(1, score)
        weighted_price += row['price_per_sqm'] * weight
        total_weight += weight
    final_price_sqm = weighted_price / total_weight if total_weight > 0 else price_sqm
    deviation = (price_sqm - final_price_sqm) / final_price_sqm * 100
else:
    final_price_sqm = price_sqm
    deviation = 0
    print("⚠️ No analogs found, using ML prediction", file=sys.stderr)

final_price_total = final_price_sqm * area

# ========== ФОРМИРОВАНИЕ ОТВЕТА ==========
result = {
    "object": {
        "kadastr": clean_val(kadastr, 20),
        "area": area,
        "build_year": build_year if not is_land else None,
        "object_type": object_type,
        "permitted_use": clean_val(permitted_use, 50),
        "name": clean_val(object_name, 80),
        "wall_material": clean_val(wall_material, 30),
        "city": clean_val(city, 30),
        "address": clean_val(address, 120)
    },
    "predicted": {
        "price_per_sqm": round(final_price_sqm),
        "price_total": round(final_price_total)
    },
    "calculation": {
        "ml_prediction": round(price_sqm),
        "final_price_per_sqm": round(final_price_sqm),
        "deviation_from_ml_pct": round(deviation, 1),
        "analogs_count": len(analogs_scored)
    },
    "justification": "Расчет выполнен на основе средневзвешенной цены аналогов. ML-прогноз использован для проверки.",
    "analogs": []
}

# Добавляем аналоги в результат
for i, (score, _, row) in enumerate(analogs_scored[:5]):
    result["analogs"].append({
        "num": i+1,
        "kadastr": clean_val(row.get('kadastr', ''), 20),
        "name": clean_val(row.get('name', ''), 80),
        "area": round(float(row['area']), 1),
        "price_per_sqm": round(float(row['price_per_sqm'])),
        "price_total": round(float(row.get('price_total', 0))),
        "build_year": int(row.get('build_year', 0)),
        "object_type": clean_val(row.get('object_type', ''), 30),
        "permitted_use": clean_val(row.get('permitted_use', ''), 50),
        "wall_material": clean_val(row.get('wall_material', ''), 30),
        "address": clean_val(row.get('address', ''), 120),
        "similarity_score": score
    })

print(json.dumps(result, ensure_ascii=False, indent=2))
