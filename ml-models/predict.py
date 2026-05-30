# ml-models/predict.py
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

# Загружаем модели
try:
    with open("model_buildings.pkl", "rb") as f: 
        model_buildings = pickle.load(f)
    print("✅ model_buildings.pkl загружена", file=sys.stderr)
except Exception as e:
    print(f"⚠️ model_buildings.pkl не загружена: {e}", file=sys.stderr)
    model_buildings = None

try:
    with open("model_land.pkl", "rb") as f: 
        model_land = pickle.load(f)
    print("✅ model_land.pkl загружена", file=sys.stderr)
except Exception as e:
    print(f"⚠️ model_land.pkl не загружена: {e}", file=sys.stderr)
    model_land = None

df = pd.read_csv("deals_clean.csv")

# Параметры
area = float(sys.argv[1])
build_year = int(sys.argv[2]) if len(sys.argv) > 2 else 2015
object_type = sys.argv[3] if len(sys.argv) > 3 else 'Помещение'
permitted_use = sys.argv[4] if len(sys.argv) > 4 else ''
address = sys.argv[5] if len(sys.argv) > 5 else ''
kadastr = sys.argv[6] if len(sys.argv) > 6 else ''
wall_material = sys.argv[7] if len(sys.argv) > 7 else ''
object_name = sys.argv[8] if len(sys.argv) > 8 else ''

type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
type_code = type_map.get(object_type, 0)
is_land = (type_code == 1)

material_map = {'Кирпич': 1, 'Панель': 2, 'Монолит': 3, 'Дерево': 4, 'Блок': 5}
wall_code = material_map.get(wall_material, 0)

name_category = get_object_category(object_name)
print(f"📊 name_category: {name_category} для '{object_name}'", file=sys.stderr)

land_use_code = get_land_use_category(permitted_use)
land_category_code = 0

# Город
city = ''
if address:
    all_cities = set()
    for addr in df['address'].dropna():
        for word in addr.replace(',', ' ').replace('.', ' ').split():
            if word[0].isupper() and len(word) > 3: 
                all_cities.add(word)
    for part in address.replace(',', ' ').split():
        if part in all_cities: 
            city = part
            break
    if not city:
        for c in ['Салехард','Новый','Ноябрьск','Тарко-Сале','Надым','Губкинский','Муравленко','Лабытнанги','Красноселькуп']:
            if c in address: 
                city = c
                break

# ============================================================
# ML-прогноз
# ============================================================
if is_land and model_land:
    price_sqm = model_land.predict([[area, build_year, land_use_code, land_category_code]])[0]
    print(f"🌾 Прогноз для земли: {price_sqm:.0f} руб/м²", file=sys.stderr)
elif not is_land and model_buildings:
    price_sqm = model_buildings.predict([[area, build_year, type_code, wall_code, name_category]])[0]
    print(f"🏢 Прогноз для зданий: {price_sqm:.0f} руб/м²", file=sys.stderr)
else:
    price_sqm = df['price_per_sqm'].median()
    print(f"⚠️ Используем медиану: {price_sqm:.0f} руб/м²", file=sys.stderr)

price_total = price_sqm * area

# ============================================================
# Подбор аналогов
# ============================================================

similar = pd.DataFrame()
search_level = "вся база"

# 1. Поиск по наименованию (ключевые слова)
if object_name:
    keywords = object_name.lower().split()
    for kw in keywords:
        kw_matches = df[df['name'].str.contains(kw, na=False, case=False)]
        similar = pd.concat([similar, kw_matches])
    
    if not similar.empty:
        similar = similar.drop_duplicates(subset=['kadastr'])
        search_level = f"поиск по ключевому слову «{object_name}»"
        print(f"🔍 Поиск по названию: найдено {len(similar)} объектов", file=sys.stderr)

# 2. Если мало результатов - добавляем фильтрацию по типу
if len(similar) < 3:
    type_similar = df[df['object_type_code'] == type_code].copy()
    similar = pd.concat([similar, type_similar]).drop_duplicates(subset=['kadastr'])
    search_level = f"поиск по типу + названию"
    print(f"🔍 Добавлено по типу: теперь {len(similar)} объектов", file=sys.stderr)

# 3. Фильтрация по площади
if not similar.empty:
    similar = similar[similar['area'].between(area * 0.3, area * 3.0)]
    print(f"🔍 После фильтрации по площади: {len(similar)} объектов", file=sys.stderr)
else:
    similar = df[df['object_type_code'] == type_code].copy()
    similar = similar[similar['area'].between(area * 0.3, area * 3.0)]
    search_level = "тип объекта + площадь"

# 4. Если всё ещё пусто - расширяем
if len(similar) < 3:
    similar = df.copy()
    search_level = "вся база (расширенный поиск)"
    print(f"🔍 Расширенный поиск: {len(similar)} объектов", file=sys.stderr)

print(f"📊 Итоговое количество аналогов: {len(similar)}", file=sys.stderr)

# ============================================================
# Поиск 5 ближайших
# ============================================================
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

n_neighbors = min(5, len(similar))
nn = NearestNeighbors(n_neighbors=n_neighbors)
scaler = StandardScaler()

if is_land:
    similar['use_code'] = pd.factorize(similar['permitted_use'])[0]
    similar['city_code'] = pd.factorize(similar['address'].fillna(''))[0]
    feats = ['area', 'build_year', 'use_code', 'city_code']
    fs = scaler.fit_transform(similar[feats].fillna(0))
    nn.fit(fs)
    
    uc = pd.factorize(df['permitted_use'])[0][df['permitted_use'] == permitted_use]
    uc = uc[0] if len(uc) > 0 else 0
    cc = pd.factorize(df['address'].fillna(''))[0][df['address'].fillna('').str.contains(city[:10], na=False)]
    cc = cc[0] if len(cc) > 0 else 0
    os_ = scaler.transform([[area, build_year, uc, cc]])
    distances, indices = nn.kneighbors(os_)
    search_desc = "ВРИ, площадь, год, адрес (равнозначно)"
else:
    similar['name_code'] = pd.factorize(similar['name'])[0]
    similar['material_code'] = pd.factorize(similar['wall_material'])[0]
    similar['city_code'] = pd.factorize(similar['address'].fillna(''))[0]
    feats = ['area', 'build_year', 'name_code', 'material_code', 'city_code']
    fs = scaler.fit_transform(similar[feats].fillna(0))
    nn.fit(fs)
    
    nc = 0
    for code, name in enumerate(pd.factorize(similar['name'])[1]):
        if object_name[:10].lower() in str(name).lower():
            nc = code
            break
    mc = 0
    for code, mat in enumerate(pd.factorize(similar['wall_material'])[1]):
        if wall_material[:10].lower() in str(mat).lower():
            mc = code
            break
    cc = 0
    for code, addr in enumerate(pd.factorize(similar['address'].fillna(''))[1]):
        if city[:10].lower() in str(addr).lower():
            cc = code
            break
    os_ = scaler.transform([[area, build_year, nc, mc, cc]])
    distances, indices = nn.kneighbors(os_)
    search_desc = "наименование, материал, площадь, год, адрес (равнозначно)"

analogs = similar.iloc[indices[0]]

# Корректировки
corrections = []
for _, a in analogs.iterrows():
    c = 1.0
    if area > 100 and a['area'] < 100:
        c *= 0.95
    elif area < 50 and a['area'] > 50:
        c *= 1.05
    yd = build_year - a['build_year']
    if abs(yd) > 5:
        c *= 1 + (yd * 0.005)
    if city and city not in str(a.get('address', '')):
        c *= 0.90
    corrections.append(round(c, 3))

# Средневзвешенная
tw, ws = 0, 0
for i, (_, a) in enumerate(analogs.iterrows()):
    w = 1/(distances[0][i]+0.01)
    ws += a['price_per_sqm'] * corrections[i] * w
    tw += w
wap = ws/tw if tw > 0 else price_sqm
aa = analogs['price_per_sqm'].mean()
dp = (price_sqm - aa)/aa * 100

# Обоснование
j = f"""ОЦЕНКА ОБЪЕКТА{' с КН '+kadastr if kadastr else ''}:
Тип: {object_type} | Площадь: {area:.0f} м² | Год: {build_year} | Город: {city if city else 'не определён'}"""
if is_land and permitted_use:
    j += f"\nВРИ: {permitted_use}"
if not is_land:
    if object_name:
        j += f"\nНаименование: {object_name}"
    if wall_material:
        j += f"\nМатериал стен: {wall_material}"
j += f"""

ЭТАП 1: ПРЕДВАРИТЕЛЬНЫЙ ОТБОР ({search_level})
Из базы {len(df)} сделок отобраны: тип={object_type}, площадь={area*0.3:.0f}-{area*3.0:.0f} м²"""
if city:
    j += f", город={city}"
j += f"\nОтобрано: {len(similar)} объектов\n\nЭТАП 2: ФИНАЛЬНЫЙ ОТБОР 5 АНАЛОГОВ ({search_desc})\n"

for i, (_, a) in enumerate(analogs.iterrows(), 1):
    yr = int(a.get('build_year',0)) if not pd.isna(a.get('build_year')) else 0
    j += f"Аналог {i}: {clean_val(a.get('name',''),50)} | КН: {clean_val(a.get('kadastr',''),20)} | Площадь: {int(a['area'])} м² | Год: {yr} | Цена: {int(a['price_per_sqm'])} руб/м²"
    if clean_val(a.get('wall_material',''),15):
        j += f" | Материал: {clean_val(a.get('wall_material',''),15)}"
    if clean_val(a.get('permitted_use',''),30):
        j += f" | ВРИ: {clean_val(a.get('permitted_use',''),30)}"
    j += f" | Корр: {corrections[i-1]:.3f}\n"

j += f"""
ЭТАП 3: РАСЧЁТ
ML-прогноз: {price_sqm:.0f} руб/м² | Среднее аналогов: {aa:.0f} руб/м² | Средневзвешенное: {wap:.0f} руб/м²
Финальная цена: {price_sqm:.0f} руб/м² | Общая стоимость: {price_total:.0f} руб.

ЭТАП 4: ЗАКЛЮЧЕНИЕ
Рыночная стоимость: {price_total:.0f} руб. ({price_sqm:.0f} руб/м²). Отклонение от аналогов: {dp:+.1f}%."""

# JSON
result = {
    "object": {"kadastr":clean_val(kadastr,20),"area":area,"build_year":build_year,"object_type":object_type,
               "permitted_use":clean_val(permitted_use,50),"name":clean_val(object_name,80),
               "wall_material":clean_val(wall_material,30),"city":clean_val(city,30),"address":clean_val(address,120)},
    "predicted": {"price_per_sqm":round(price_sqm),"price_total":round(price_total)},
    "calculation": {"ml_prediction":round(price_sqm),"avg_analogs":round(aa),"weighted_avg":round(wap),"deviation_pct":round(dp,1)},
    "justification": j, "analogs": [], "search_level": search_level, "search_features": search_desc
}

for i, (_, a) in enumerate(analogs.iterrows()):
    yr = int(a.get('build_year',0)) if not pd.isna(a.get('build_year')) else 0
    result["analogs"].append({
        "num":i+1,
        "kadastr":clean_val(a.get('kadastr',''),20),
        "name":clean_val(a.get('name',''),80),
        "area":round(float(a['area']),1),
        "price_per_sqm":round(float(a['price_per_sqm'])),
        "price_total":round(float(a.get('price_total',0))),
        "build_year":yr,
        "object_type":clean_val(a.get('object_type',''),30),
        "permitted_use":clean_val(a.get('permitted_use',''),50),
        "wall_material":clean_val(a.get('wall_material',''),30),
        "address":clean_val(a.get('address',''),120),
        "correction":corrections[i],
        "similarity":round(100-distances[0][i]*15,1)
    })

print(json.dumps(result, ensure_ascii=False, indent=2))
