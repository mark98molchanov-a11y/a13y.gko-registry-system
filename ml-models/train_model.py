# ml-models/train_model.py
import pandas as pd
from catboost import CatBoostRegressor
import pickle
import re

def is_empty(val):
    if pd.isna(val):
        return True
    s = str(val).strip().lower()
    return s in ['', 'nan', 'none', 'null', '-', 'нет']

# Функция определения категории объекта по названию
def get_object_category(name):
    if pd.isna(name):
        return 0
    name_lower = str(name).lower()
    
    if re.search(r'гараж|бокс', name_lower):
        return 10  # Гараж
    if re.search(r'магазин|торгов|павильон', name_lower):
        return 20  # Магазин/Торговля
    if re.search(r'офис|административ|контор', name_lower):
        return 30  # Офис/Администрация
    if re.search(r'склад', name_lower):
        return 40  # Склад
    if re.search(r'жилой дом|дом|дача|коттедж', name_lower):
        return 50  # Жилой дом
    if re.search(r'квартир|помещение', name_lower):
        return 60  # Квартира/Помещение
    if re.search(r'производствен|цех|корпус|станция|котельная', name_lower):
        return 70  # Производство
    return 0

# Функция определения категории ВРИ для земли (исправленная)
def get_land_use_category(permitted_use):
    if pd.isna(permitted_use):
        return 0
    text = str(permitted_use).lower()
    
    if re.search(r'гараж|стоянк|хранени', text):
        return 1  # Гаражи/стоянки
    if re.search(r'садоводств|огородничеств|дачн', text):
        return 2  # Садоводство/огородничество
    if re.search(r'индивидуальн.*жилищн.*строительств|жил.*застройк', text):
        return 3  # ИЖС/жилая застройка
    if re.search(r'магазин|торгов', text):
        return 4  # Торговля
    if re.search(r'склад', text):
        return 5  # Склады
    if re.search(r'производствен|полезн.*ископаем|разработк', text):
        return 6  # Производство/недра
    if re.search(r'административн|офис|делов.*управлени', text):
        return 7  # Администрация/офис
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
    'Material_sten': 'wall_material',
    'Kategoriya': 'land_category'
})

# Фильтрация
df = df[df['deal_type'] == 'Купля-продажа'].copy()
df = df[df['price_per_sqm'] > 100].copy()
df = df[df['area'] > 10].copy()
df['build_year'] = df['build_year'].fillna(2015)

# Коды типов объектов (основные)
type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
df['object_type_code'] = df['object_type'].map(type_map).fillna(0)

# Коды материалов стен
material_map = {'Кирпич': 1, 'Панель': 2, 'Монолит': 3, 'Дерево': 4, 'Блок': 5,
                'Кирпичные': 1, 'Крупнопанельные': 2, 'Монолитные': 3, 'Деревянные': 4,
                'Железобетонные': 5, 'Бетонные': 5, 'Смешанные': 6, 'Металлические': 7}
df['wall_material_code'] = df['wall_material'].map(material_map).fillna(0)

# Категория по названию
df['name_category'] = df['name'].apply(get_object_category)

# Для земли: ВРИ и категория (только для земельных участков)
df['land_use_code'] = df['permitted_use'].apply(get_land_use_category)
df['land_category_code'] = df['land_category'].apply(get_land_category)

print(f"✅ Загружено {len(df)} записей")

# Статистика по категориям объектов
print("\n📊 Статистика по категориям объектов:")
cat_names = {10: 'Гараж', 20: 'Магазин', 30: 'Офис', 40: 'Склад', 
             50: 'Жилой дом', 60: 'Квартира', 70: 'Производство', 0: 'Прочее'}
for code, name in cat_names.items():
    count = len(df[df['name_category'] == code])
    if count > 0:
        print(f"   {name}: {count} записей")

# 1. МОДЕЛЬ ДЛЯ ЗДАНИЙ/ПОМЕЩЕНИЙ/СООРУЖЕНИЙ
buildings = df[df['object_type_code'].isin([2, 3, 4])].copy()
print(f"\n🏢 Зданий/помещений/сооружений: {len(buildings)}")

if len(buildings) > 10:
    X_buildings = buildings[['area', 'build_year', 'object_type_code', 'wall_material_code', 'name_category']].fillna(0)
    y_buildings = buildings['price_per_sqm']
    
    model_buildings = CatBoostRegressor(iterations=500, learning_rate=0.1, depth=6, verbose=50, random_seed=42)
    model_buildings.fit(X_buildings, y_buildings)
    
    with open("model_buildings.pkl", "wb") as f:
        pickle.dump(model_buildings, f)
    print(f"✅ Модель для зданий СОХРАНЕНА в model_buildings.pkl")
    
    # Выводим важность признаков
    print("\n📊 Важность признаков (здания):")
    features = ['area', 'build_year', 'object_type_code', 'wall_material_code', 'name_category']
    for f, imp in zip(features, model_buildings.get_feature_importance()):
        print(f"   {f}: {imp:.2f}")

# 2. МОДЕЛЬ ДЛЯ ЗЕМЛИ
land = df[df['object_type_code'] == 1].copy()
print(f"\n🌾 Земельных участков: {len(land)}")

if len(land) > 10:
    X_land = land[['area', 'build_year', 'land_use_code', 'land_category_code']].fillna(0)
    y_land = land['price_per_sqm']
    
    model_land = CatBoostRegressor(iterations=500, learning_rate=0.1, depth=6, verbose=50, random_seed=42)
    model_land.fit(X_land, y_land)
    
    with open("model_land.pkl", "wb") as f:
        pickle.dump(model_land, f)
    print(f"✅ Модель для земли СОХРАНЕНА в model_land.pkl")
    
    # Выводим важность признаков
    print("\n📊 Важность признаков (земля):")
    features = ['area', 'build_year', 'land_use_code', 'land_category_code']
    for f, imp in zip(features, model_land.get_feature_importance()):
        print(f"   {f}: {imp:.2f}")

# Сохраняем данные
df.to_csv("deals_clean.csv", index=False)
print(f"\n✅ Данные сохранены в deals_clean.csv ({len(df)} записей)")

print("\n" + "=" * 60)
print("🏁 ОБУЧЕНИЕ ЗАВЕРШЕНО!")
print("=" * 60)