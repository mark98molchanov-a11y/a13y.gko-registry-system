# ml-models/export_weights.py
import pickle
import json
import pandas as pd
import numpy as np
import re

# Функция категории по названию (должна совпадать с train_model.py)
def get_object_category(name):
    if pd.isna(name) or not name:
        return 0
    name_lower = str(name).lower()
    
    if re.search(r'гараж|бокс', name_lower):
        return 10
    if re.search(r'магазин|торгов|павильон', name_lower):
        return 20
    if re.search(r'офис|административ|контор', name_lower):
        return 30
    if re.search(r'склад', name_lower):
        return 40
    if re.search(r'жилой дом|дом|дача|коттедж', name_lower):
        return 50
    if re.search(r'квартир|помещение', name_lower):
        return 60
    if re.search(r'производствен|цех|корпус|станция|котельная', name_lower):
        return 70
    return 0

# Функция категории ВРИ для земли
def get_land_use_category(permitted_use):
    if pd.isna(permitted_use):
        return 0
    text = str(permitted_use).lower()
    
    if re.search(r'гараж|стоянк|хранени', text):
        return 1
    if re.search(r'садоводств|огородничеств|дачн', text):
        return 2
    if re.search(r'индивидуальн.*жилищн.*строительств|жил.*застройк', text):
        return 3
    if re.search(r'магазин|торгов', text):
        return 4
    if re.search(r'склад', text):
        return 5
    if re.search(r'производствен|полезн.*ископаем|разработк', text):
        return 6
    if re.search(r'административн|офис|делов.*управлени', text):
        return 7
    return 0

# Функция категории земель
def get_land_category(category):
    if pd.isna(category):
        return 0
    text = str(category).lower()
    
    if 'населенных пунктов' in text:
        return 1
    if 'сельскохозяйственного' in text:
        return 2
    if 'промышленности' in text or 'специального назначения' in text:
        return 3
    if 'лесного фонда' in text:
        return 4
    return 0

print("=" * 60)
print("📊 ЭКСПОРТ ВЕСОВ CATBOOST МОДЕЛИ")
print("=" * 60)

# 1. ЗАГРУЖАЕМ ДАННЫЕ ИЗ EXCEL
print("\n📁 Загрузка данных из deals.xlsx...")

try:
    df_raw = pd.read_excel("deals.xlsx")
    print(f"✅ Загружено {len(df_raw)} строк")
    
    # ПЕРЕИМЕНОВАНИЕ КОЛОНОК
    df = df_raw.rename(columns={
        'Znachenie_osnovnoy_characteristici': 'area',
        'cena_zdelki': 'price_total',
        'cen_za_kv_m': 'price_per_sqm',
        'God_postroyki': 'build_year',
        'Mestopolozhenie': 'address',
        'Vid_sdelki': 'deal_type',
        'Naimenovanie': 'name',
        'Vid_obyekta_nedvizhimosti': 'object_type',
        'Vid_razreshennogo_ispolzovaniya': 'permitted_use',
        'Obyekty_t__nedvizhimosti': 'kadastr',
        'Material_sten': 'wall_material',
        'Kategoriya': 'land_category'
    })
    
    # Фильтрация
    df = df[df['deal_type'] == 'Купля-продажа'].copy()
    df = df[df['price_per_sqm'] > 100].copy()
    df = df[df['area'] > 10].copy()
    df['build_year'] = df['build_year'].fillna(2015)
    
    # Коды типов объектов
    type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
    df['object_type_code'] = df['object_type'].map(type_map).fillna(0).astype(int)
    
    # Добавляем новые поля
    df['name_category'] = df['name'].apply(get_object_category)
    df['land_use_code'] = df['permitted_use'].apply(get_land_use_category)
    df['land_category_code'] = df['land_category'].apply(get_land_category)
    
    print(f"📊 После фильтрации: {len(df)} записей")
    
    print(f"\n📊 Статистика по типам объектов:")
    for obj_type, code in type_map.items():
        count = len(df[df['object_type_code'] == code])
        if count > 0:
            print(f"   {obj_type}: {count} записей")
    
except Exception as e:
    print(f"❌ Ошибка загрузки deals.xlsx: {e}")
    import traceback
    traceback.print_exc()
    df = None

# 2. ЗАГРУЖАЕМ МОДЕЛИ
try:
    with open("model_buildings.pkl", "rb") as f:
        model_buildings = pickle.load(f)
    print("✅ Модель зданий загружена")
except:
    model_buildings = None
    print("⚠️ Модель зданий не найдена")

try:
    with open("model_land.pkl", "rb") as f:
        model_land = pickle.load(f)
    print("✅ Модель земли загружена")
except:
    model_land = None
    print("⚠️ Модель земли не найдена")

# 3. СОЗДАЕМ JSON
model_weights = {
    "version": "3.0",
    "export_date": pd.Timestamp.now().isoformat(),
    "base_price": 45000,
    "type_factors": {
        "Здание": 1.00,
        "Помещение": 1.10,
        "Сооружение": 0.85,
        "Земельный участок": 0.50
    },
    "material_factors": {
        "Кирпич": 1.12, "Монолит": 1.18, "Панель": 0.92,
        "Дерево": 0.88, "Блок": 0.95, "": 1.00
    },
    "area_factors": {"exponent": 0.85, "reference": 100},
    "year_factors": {"base_year": 2025, "rate": 0.015}
}

# 4. ДОБАВЛЯЕМ ДАННЫЕ АНАЛОГОВ (С НОВЫМИ ПОЛЯМИ)
if df is not None and len(df) > 0:
    analogs_data = []
    
    for _, row in df.iterrows():
        area = row.get('area', 0)
        price = row.get('price_per_sqm', 0)
        
        if area <= 0 or price <= 0:
            continue
        
        analog = {
            "area": float(area),
            "build_year": int(row.get('build_year', 2015)),
            "price_per_sqm": float(price),
            "price_total": float(row.get('price_total', price * area)),
            "name": str(row.get('name', 'Объект'))[:80],
            "address": str(row.get('address', ''))[:120],
            "wall_material": str(row.get('wall_material', ''))[:30],
            "kadastr": str(row.get('kadastr', ''))[:30],
            "object_type": str(row.get('object_type', ''))[:30],
            "object_type_code": int(row.get('object_type_code', 0)),
            "permitted_use": str(row.get('permitted_use', ''))[:200],
            "land_category": str(row.get('land_category', ''))[:100],
            # НОВЫЕ ПОЛЯ:
            "name_category": int(row.get('name_category', 0)),
            "land_use_code": int(row.get('land_use_code', 0)),
            "land_category_code": int(row.get('land_category_code', 0))
        }
        analogs_data.append(analog)
    
    model_weights["analogs_data"] = analogs_data
    print(f"\n✅ Добавлено {len(analogs_data)} аналогов")

# 5. ДОБАВЛЯЕМ ВАЖНОСТЬ ПРИЗНАКОВ
if model_buildings:
    try:
        model_weights["feature_importances_buildings"] = model_buildings.get_feature_importance().tolist()
        model_weights["feature_names_buildings"] = ['area', 'build_year', 'object_type_code', 'wall_material_code', 'name_category']
        print(f"\n📊 Feature importances (здания): {model_weights['feature_importances_buildings']}")
    except:
        pass

if model_land:
    try:
        model_weights["feature_importances_land"] = model_land.get_feature_importance().tolist()
        model_weights["feature_names_land"] = ['area', 'build_year', 'land_use_code', 'land_category_code']
        print(f"\n📊 Feature importances (земля): {model_weights['feature_importances_land']}")
    except:
        pass

# 6. СОХРАНЯЕМ
with open("model_weights.json", "w", encoding='utf-8') as f:
    json.dump(model_weights, f, ensure_ascii=False, indent=2)

print("\n" + "=" * 60)
print(f"✅ Модель экспортирована в model_weights.json")
print(f"📊 Количество аналогов: {len(model_weights.get('analogs_data', []))}")
print("=" * 60)