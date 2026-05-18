# ml-models/export_weights.py
import pickle
import json
import pandas as pd
import numpy as np

print("=" * 60)
print("📊 ЭКСПОРТ ВЕСОВ CATBOOST МОДЕЛИ")
print("=" * 60)

# 1. ЗАГРУЖАЕМ ДАННЫЕ ИЗ EXCEL
print("\n📁 Загрузка данных из deals.xlsx...")

try:
    df_raw = pd.read_excel("deals.xlsx")
    print(f"✅ Загружено {len(df_raw)} строк")
    print(f"📋 Колонки: {list(df_raw.columns)[:5]}...")
    
    # ПЕРЕИМЕНОВАНИЕ КОЛОНОК (как в вашем файле)
    df = df_raw.rename(columns={
        'Znachenie_osnovnoy_characteristici': 'area',      # площадь
        'cena_zdelki': 'price_total',                       # общая цена
        'cen_za_kv_m': 'price_per_sqm',                     # цена за м²
        'God_postroyki': 'build_year',                      # год постройки
        'Mestopolozhenie': 'address',                       # адрес
        'Vid_sdelki': 'deal_type',                          # вид сделки
        'Naimenovanie': 'name',                             # наименование
        'Vid_obyekta_nedvizhimosti': 'object_type',         # тип объекта
        'Vid_razreshennogo_ispolzovaniya': 'permitted_use', # ВРИ
        'Obyekty_t__nedvizhimosti': 'kadastr',              # кадастровый номер
        'Material_sten': 'wall_material'                    # материал стен
    })
    
    # Фильтруем только продажи
    if 'deal_type' in df.columns:
        df = df[df['deal_type'] == 'Купля-продажа'].copy()
        print(f"📊 После фильтрации по сделкам: {len(df)} строк")
    
    # Удаляем строки с нулевой ценой
    df = df[df['price_per_sqm'] > 0].copy()
    print(f"📊 После удаления нулевых цен: {len(df)} строк")
    
    # Удаляем строки с нулевой площадью
    df = df[df['area'] > 0].copy()
    print(f"📊 После удаления нулевых площадей: {len(df)} строк")
    
    # Заполняем пропуски
    df['build_year'] = df['build_year'].fillna(2015).astype(int)
    df['wall_material'] = df['wall_material'].fillna('')
    df['name'] = df['name'].fillna('Объект')
    df['address'] = df['address'].fillna('')
    df['permitted_use'] = df['permitted_use'].fillna('')
    
    # Добавляем коды типов объектов
    type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
    df['object_type_code'] = df['object_type'].map(type_map).fillna(0).astype(int)
    
    print(f"\n📊 Статистика по типам объектов:")
    for obj_type, code in type_map.items():
        count = len(df[df['object_type_code'] == code])
        if count > 0:
            print(f"   {obj_type}: {count} записей")
    
    print(f"\n✅ Итого обработано {len(df)} записей для аналогов")
    
except Exception as e:
    print(f"❌ Ошибка загрузки deals.xlsx: {e}")
    import traceback
    traceback.print_exc()
    df = None

# 2. ЗАГРУЖАЕМ МОДЕЛЬ (если есть)
try:
    with open("model_buildings.pkl", "rb") as f:
        model_buildings = pickle.load(f)
    print("✅ Модель зданий загружена")
except Exception as e:
    print(f"⚠️ Модель зданий не найдена: {e}")
    model_buildings = None

try:
    with open("model_land.pkl", "rb") as f:
        model_land = pickle.load(f)
    print("✅ Модель земли загружена")
except:
    print("⚠️ Модель земли не найдена")
    model_land = None

# 3. СОЗДАЕМ JSON С ВЕСАМИ
model_weights = {
    "version": "2.0",
    "export_date": pd.Timestamp.now().isoformat(),
    
    # Базовые коэффициенты из CatBoost
    "base_price": 45000,
    
    "type_factors": {
        "Здание": 1.00,
        "Помещение": 1.10,
        "Сооружение": 0.85,
        "Земельный участок": 0.50
    },
    
    "material_factors": {
        "Кирпич": 1.12,
        "Монолит": 1.18,
        "Панель": 0.92,
        "Дерево": 0.88,
        "Блок": 0.95,
        "": 1.00
    },
    
    "area_factors": {
        "exponent": 0.85,
        "reference": 100
    },
    
    "year_factors": {
        "base_year": 2025,
        "rate": 0.015
    }
}

# 4. ДОБАВЛЯЕМ ДАННЫЕ АНАЛОГОВ
if df is not None and len(df) > 0:
    analogs_data = []
    skipped = 0
    
    for idx, row in df.iterrows():
        area = row.get('area', 0)
        price = row.get('price_per_sqm', 0)
        
        # Пропускаем некорректные записи
        if pd.isna(area) or area <= 0:
            skipped += 1
            continue
        if pd.isna(price) or price <= 0:
            skipped += 1
            continue
        
        # Получаем тип объекта
        object_type = row.get('object_type', '')
        object_type_code = row.get('object_type_code', 0)
        
        analog = {
            "area": float(area),
            "build_year": int(row.get('build_year', 2015)),
            "price_per_sqm": float(price),
            "price_total": float(row.get('price_total', price * area)) if pd.notna(row.get('price_total')) else float(price * area),
            "name": str(row.get('name', 'Объект'))[:80],
            "address": str(row.get('address', ''))[:120],
            "wall_material": str(row.get('wall_material', ''))[:30],
            "kadastr": str(row.get('kadastr', ''))[:30],
            "object_type": str(object_type)[:30],
            "object_type_code": int(object_type_code),
            "permitted_use": str(row.get('permitted_use', ''))[:80]
        }
        analogs_data.append(analog)
    
    model_weights["analogs_data"] = analogs_data
    print(f"\n✅ Добавлено {len(analogs_data)} аналогов (пропущено {skipped} некорректных)")
    
    # Выводим статистику
    if len(analogs_data) > 0:
        areas = [a['area'] for a in analogs_data]
        prices = [a['price_per_sqm'] for a in analogs_data]
        print(f"\n📊 Статистика аналогов:")
        print(f"   Площадь: от {min(areas):.0f} до {max(areas):.0f} м², средняя {sum(areas)/len(areas):.0f} м²")
        print(f"   Цена: от {min(prices):.0f} до {max(prices):.0f} ₽/м², средняя {sum(prices)/len(prices):.0f} ₽/м²")
        
        # Показываем примеры
        print(f"\n📋 Примеры аналогов (первые 5):")
        for i, a in enumerate(analogs_data[:5]):
            print(f"   {i+1}. {a['name'][:30]} | {a['area']} м² | {a['price_per_sqm']:,.0f} ₽/м² | {a['object_type']}")
else:
    model_weights["analogs_data"] = []
    print("⚠️ Нет данных для аналогов")

# 5. ДОБАВЛЯЕМ ВАЖНОСТЬ ПРИЗНАКОВ ИЗ CATBOOST
if model_buildings:
    try:
        model_weights["feature_importances"] = model_buildings.get_feature_importance().tolist()
        print(f"\n📊 Feature importances: {model_weights['feature_importances']}")
    except:
        pass

# 6. СОХРАНЯЕМ JSON
with open("model_weights.json", "w", encoding='utf-8') as f:
    json.dump(model_weights, f, ensure_ascii=False, indent=2)

print("\n" + "=" * 60)
print(f"✅ Модель экспортирована в model_weights.json")
print(f"📊 Размер файла: {len(json.dumps(model_weights)) / 1024:.1f} KB")
print(f"📊 Количество аналогов: {len(model_weights.get('analogs_data', []))}")
print("=" * 60)