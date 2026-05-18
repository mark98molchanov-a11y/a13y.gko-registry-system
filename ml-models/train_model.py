# ml-models/train_model.py
import pandas as pd
from catboost import CatBoostRegressor
import pickle

def is_empty(val):
    if pd.isna(val):
        return True
    s = str(val).strip().lower()
    return s in ['', 'nan', 'none', 'null', '-', 'нет']

print("=" * 60)
print("🏋️ ОБУЧЕНИЕ CATBOOST МОДЕЛЕЙ")
print("=" * 60)

# Загружаем данные
print("\n📁 Загрузка deals.xlsx...")
df = pd.read_excel("deals.xlsx")

# Переименование колонок
df = df.rename(columns={
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
    'Material_sten': 'wall_material'
})

# Фильтрация
df = df[df['deal_type'] == 'Купля-продажа'].copy()
df = df[df['price_per_sqm'] > 100].copy()
df = df[df['area'] > 10].copy()
df['build_year'] = df['build_year'].fillna(2015)

# Коды типов объектов
type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
df['object_type_code'] = df['object_type'].map(type_map).fillna(0)

# Коды материалов стен
material_map = {'Кирпич': 1, 'Панель': 2, 'Монолит': 3, 'Дерево': 4, 'Блок': 5}
df['wall_material_code'] = df['wall_material'].map(material_map).fillna(0)

print(f"✅ Загружено {len(df)} записей")

# 1. ОБУЧЕНИЕ МОДЕЛИ ДЛЯ ЗДАНИЙ/ПОМЕЩЕНИЙ/СООРУЖЕНИЙ
buildings = df[df['object_type_code'].isin([2, 3, 4])].copy()
print(f"\n🏢 Зданий/помещений/сооружений: {len(buildings)}")

if len(buildings) > 10:
    X_buildings = buildings[['area', 'build_year', 'object_type_code', 'wall_material_code']].fillna(0)
    y_buildings = buildings['price_per_sqm']
    
    model_buildings = CatBoostRegressor(
        iterations=500, 
        learning_rate=0.1, 
        depth=6, 
        verbose=50,
        random_seed=42
    )
    model_buildings.fit(X_buildings, y_buildings)
    
    with open("model_buildings.pkl", "wb") as f:
        pickle.dump(model_buildings, f)
    print(f"✅ Модель для зданий/помещений СОХРАНЕНА в model_buildings.pkl")
else:
    print("⚠️ Недостаточно данных для обучения модели зданий")

# 2. ОБУЧЕНИЕ МОДЕЛИ ДЛЯ ЗЕМЕЛЬНЫХ УЧАСТКОВ
land = df[df['object_type_code'] == 1].copy()
land = land[~land['permitted_use'].apply(is_empty)].copy()
print(f"\n🌾 Земельных участков: {len(land)}")

if len(land) > 10:
    land['use_code'] = pd.factorize(land['permitted_use'])[0]
    X_land = land[['area', 'build_year', 'use_code']].fillna(0)
    y_land = land['price_per_sqm']
    
    model_land = CatBoostRegressor(
        iterations=500, 
        learning_rate=0.1, 
        depth=6, 
        verbose=50,
        random_seed=42
    )
    model_land.fit(X_land, y_land)
    
    with open("model_land.pkl", "wb") as f:
        pickle.dump(model_land, f)
    print(f"✅ Модель для земли СОХРАНЕНА в model_land.pkl")
else:
    print("⚠️ Недостаточно данных для обучения модели земли")

# Сохраняем обработанные данные
df.to_csv("deals_clean.csv", index=False)
print(f"\n✅ Данные сохранены в deals_clean.csv ({len(df)} записей)")

print("\n" + "=" * 60)
print("🏁 ОБУЧЕНИЕ ЗАВЕРШЕНО!")
print("=" * 60)