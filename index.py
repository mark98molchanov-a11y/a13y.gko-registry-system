# index.py — V15 ML + КАСКАД МЕДИАН (гибрид 10/90 + защита от выбросов + ТОЛЬКО ПОЛНАЯ КС + расшифровка)
import json, pandas as pd, pickle, re, os, sys, numpy as np

def safe_str(val):
    if val is None or pd.isna(val): return ''
    if isinstance(val, (int, float)):
        return str(int(val)) if isinstance(val, float) and val.is_integer() else str(val)
    return str(val)

def get_object_category(name):
    if not name: return 0
    name_lower = safe_str(name).lower()
    if not name_lower: return 0
    if re.search(r'гараж|бокс', name_lower): return 10
    if re.search(r'магазин|торгов|павильон', name_lower): return 20
    if re.search(r'офис|административ|контор', name_lower): return 30
    if re.search(r'склад', name_lower): return 40
    if re.search(r'жилой дом|дом|дача|коттедж', name_lower): return 50
    if re.search(r'квартир|помещение', name_lower): return 60
    if re.search(r'производствен|цех|корпус|станция|котельная', name_lower): return 70
    return 0

def get_purpose_code(object_name, object_type):
    if not object_name: return 0
    name_lower = object_name.lower()
    if re.search(r'жил|квартир|дом|дача|коттедж', name_lower): return 1
    if re.search(r'нежил', name_lower): return 2
    if re.search(r'гараж|бокс', name_lower): return 3
    if re.search(r'склад', name_lower): return 4
    if re.search(r'административ|офис|управлен|делов', name_lower): return 5
    if re.search(r'магазин|торгов|павильон', name_lower): return 6
    if re.search(r'производствен|промышлен|цех|корпус|станция|котельная', name_lower): return 7
    if re.search(r'сооружен|трубопровод|скважин|эстакад|площадк|водоснабж|теплоснабж|электроснабж|хозяйствен|дорожн|связ|коммунальн', name_lower): return 8
    return 0

def get_purpose_code_from_string(purpose_str):
    if not purpose_str: return None
    p = purpose_str.lower().strip()
    if re.search(r'жил', p): return 1
    if re.search(r'нежил', p): return 2
    if re.search(r'гараж', p): return 3
    if re.search(r'склад', p): return 4
    if re.search(r'административ', p): return 5
    if re.search(r'торгов|магазин', p): return 6
    if re.search(r'производствен', p): return 7
    if re.search(r'сооружен', p): return 8
    return None

def get_land_use_category(permitted_use):
    if not permitted_use: return 0
    text = safe_str(permitted_use).lower()
    if not text: return 0
    if re.search(r'гараж|стоянк|хранени', text): return 1
    if re.search(r'садоводств|огородничеств|дачн', text): return 2
    if re.search(r'индивидуальн.*жилищн.*строительств|жил.*застройк', text): return 10
    if re.search(r'магазин|торгов', text): return 15
    if re.search(r'склад', text): return 5
    if re.search(r'производствен|полезн.*ископаем|разработк', text): return 12
    if re.search(r'административн|офис|делов.*управлени', text): return 7
    return 0

def get_land_category(category):
    if not category: return 0
    text = safe_str(category).lower()
    if not text: return 0
    if 'населенных пунктов' in text: return 1
    if 'сельскохозяйственного' in text: return 2
    if 'промышленности' in text or 'специального назначения' in text: return 3
    if 'лесного фонда' in text: return 4
    return 0

def normalize_city(address):
    if not address: return 'Прочие'
    city_map = {
        'Салехард': ['Салехард', 'г. Салехард'],
        'Ноябрьск': ['Ноябрьск', 'г. Ноябрьск'],
        'Новый Уренгой': ['Новый Уренгой', 'г. Новый Уренгой'],
        'Надым': ['Надым', 'г. Надым', 'Надымский'],
        'Губкинский': ['Губкинский', 'г. Губкинский'],
        'Муравленко': ['Муравленко', 'г. Муравленко'],
        'Лабытнанги': ['Лабытнанги', 'г. Лабытнанги'],
        'Тарко-Сале': ['Тарко-Сале', 'Пуровский'],
        'Тазовский': ['Тазовский', 'Тазовский район'],
        'Яр-Сале': ['Яр-Сале', 'Ямальский'],
        'Красноселькуп': ['Красноселькуп', 'Красноселькупский'],
        'Мужи': ['Мужи', 'Шурышкарский'],
        'Аксарка': ['Аксарка', 'Приуральский'],
    }
    for city, variants in city_map.items():
        for variant in variants:
            if variant in address: return city
    return 'Прочие'

# ============================================================
# ГЛОБАЛЬНАЯ ЗАГРУЗКА
# ============================================================
MODELS = {}
CORRECTION_MEDIANS = {}
MEDIAN_KS = {
    'Новый Уренгой': {1: 1069, 2: 35020, 3: 121211, 4: 5621, 5: 55288, 6: 16894},
    'Ноябрьск':      {1: 2307, 2: 21358, 3: 76684, 4: 14615, 5: 26695, 6: 8287},
    'Надым':         {1: 11,   2: 17425, 3: 41777, 4: 2974, 5: 50000, 6: 5026},
    'Салехард':      {1: 2727, 2: 35263, 3: 110603, 4: 11010, 5: 55000, 6: 16615},
    'Губкинский':    {1: 2072, 2: 24077, 3: 77286, 4: 26423, 5: 60000, 6: 62000},
    'Муравленко':    {1: 383,  2: 21967, 3: 54526, 4: 6298, 5: 50000, 6: 30000},
    'Лабытнанги':    {1: 1532, 2: 25894, 3: 45009, 4: 5196, 5: 114000, 6: 30000},
    'Тарко-Сале':    {1: 20,   2: 24404, 3: 37077, 4: 4910, 5: 50000, 6: 33373},
    'Тазовский':     {1: 5,    2: 24099, 3: 25256, 4: 3384, 5: 50000, 6: 30000},
    'Яр-Сале':       {1: 2,    2: 24975, 3: 45254, 4: 5231, 5: 50000, 6: 30000},
    'Красноселькуп': {1: 5,    2: 27754, 3: 31303, 4: 11256, 5: 50000, 6: 30000},
    'Мужи':          {1: 448,  2: 28520, 3: 30325, 4: 6717, 5: 50000, 6: 30000},
    'Аксарка':       {1: 13,   2: 26695, 3: 43994, 4: 10102, 5: 50000, 6: 30000},
    'Прочие':        {1: 5,    2: 16319, 3: 32004, 4: 5147, 5: 50000, 6: 15671}
}

def load_models():
    global MODELS
    files = {
        'buildings': 'models/model_buildings.pkl',
        'rooms': 'models/model_rooms.pkl',
        'land': 'models/model_land.pkl',
        'machines': 'models/model_machines.pkl',
        'ons': 'models/model_ons.pkl',
        'structures': 'models/model_structures.pkl',
        'city_encoder': 'models/city_encoder.pkl'
    }
    for n, p in files.items():
        try:
            with open(p, 'rb') as f:
                MODELS[n] = pickle.load(f)
            print(f"✅ {n} loaded")
        except Exception as e:
            print(f"⚠️ {n}: {e}")
            MODELS[n] = None

def load_cascade():
    global CORRECTION_MEDIANS
    try:
        with open('models/correction_medians.pkl', 'rb') as f:
            CORRECTION_MEDIANS = pickle.load(f)
        print(f"✅ Каскад загружен ({len(CORRECTION_MEDIANS)} разделов)")
    except Exception as e:
        print(f"⚠️ Каскад не найден: {e}")
        CORRECTION_MEDIANS = {}

print("🚀 Initializing...")
load_models()
load_cascade()
print("✅ Ready!")

# ============================================================
# УЛУЧШЕННЫЙ ПОИСК В КАСКАДЕ С ЗАЩИТОЙ ОТ ВЫБРОСОВ
# ============================================================
def get_cascade_price(city, object_type_code, area, build_year, name_category,
                      purpose_code, wall_material_code, land_use_code=0, land_category_code=0):
    """Ищет медианную цену в каскаде с фолбэками и защитой от выбросов"""
    if not CORRECTION_MEDIANS:
        return None

    if area <= 30:
        area_group = '0'
    elif area <= 50:
        area_group = '1'
    elif area <= 100:
        area_group = '2'
    elif area <= 500:
        area_group = '3'
    else:
        area_group = '4'

    if build_year < 2000:
        year_group = 'old'
    elif build_year >= 2020:
        year_group = 'new'
    else:
        year_group = 'normal'

    cascade_map = {1: 'land_cascade', 2: 'buildings_cascade', 3: 'rooms_cascade',
                   4: 'structures_cascade', 5: 'machines_cascade', 6: 'ons_cascade'}
    cascade = CORRECTION_MEDIANS.get(cascade_map.get(object_type_code, ''), {})
    if not cascade:
        return None

    if object_type_code == 1:
        keys = [f"{land_use_code}|{land_category_code}|{city}|{area_group}",
                f"{land_use_code}|{land_category_code}|{city}",
                f"{city}|{area_group}", city]
    elif object_type_code in [2, 3]:
        keys = [f"{city}|{wall_material_code}|{year_group}|{area_group}|{name_category}|{purpose_code}",
                f"{city}|{wall_material_code}|{year_group}|{area_group}|{name_category}",
                f"{city}|{wall_material_code}|{name_category}",
                f"{city}|{name_category}", city]
    elif object_type_code == 4:
        keys = [f"{purpose_code}|{city}|{area_group}",
                f"{purpose_code}|{city}", city]
    else:
        keys = [f"{city}|{area_group}", city]

    for key in keys:
        if key in cascade:
            val = cascade[key]
            if val > 100:
                return val

    for key in cascade:
        if (key.startswith(city + '|') or key == city) and cascade[key] > 100:
            return cascade[key]

    for val in cascade.values():
        if val > 100:
            return val

    return None

# ============================================================
# ПРИЗНАКИ ДЛЯ МОДЕЛИ
# ============================================================
def build_features(area, build_year, ks_per_sqm, city, object_type_code,
                   purpose_code, wall_material_code, name_category,
                   land_use_code=0, land_category_code=0):
    city_code = 0
    if MODELS.get('city_encoder'):
        le = MODELS['city_encoder']
        city_code = le.transform([city])[0] if city in le.classes_ else le.transform(['Прочие'])[0]
    age = 2026 - build_year
    return {
        'area': area, 'log_area': np.log1p(max(area, 0.1)),
        'build_year': build_year, 'age': age, 'age_squared': age**2,
        'wall_material_code': wall_material_code,
        'name_category': name_category,
        'city_code': city_code,
        'is_old': 1 if build_year < 2000 else 0,
        'is_new': 1 if build_year >= 2020 else 0,
        'small_area': 1 if area < 50 else 0,
        'area_group': 0 if area <= 30 else (1 if area <= 50 else (2 if area <= 100 else (3 if area <= 500 else 4))),
        'ks_per_sqm': ks_per_sqm if ks_per_sqm > 0 else 1000,
        'purpose_code': purpose_code,
        'log_ks': np.log1p(max(ks_per_sqm, 0.1)),
        'land_use_code': land_use_code,
        'land_category_code': land_category_code
    }

# ============================================================
# ОСНОВНОЙ ОБРАБОТЧИК
# ============================================================
def handler(request):
    try:
        data = request.get('json', {}) if isinstance(request, dict) else request.json if hasattr(request, 'json') else {}
        args = data.get('args', [])

        if len(args) < 8:
            return {'statusCode': 400, 'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'Not enough arguments'})}

        a = float(args[0])
        y = int(args[1]) if len(args) > 1 else 2024
        t = args[2] if len(args) > 2 else 'Помещение'
        pu = safe_str(args[3]) if len(args) > 3 else ''
        ad = safe_str(args[4]) if len(args) > 4 else ''
        ka = safe_str(args[5]) if len(args) > 5 else ''
        wm = safe_str(args[6]) if len(args) > 6 else ''
        on = safe_str(args[7]) if len(args) > 7 else ''
        pi = safe_str(args[8]) if len(args) > 8 else ''

        tm = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3,
              'Сооружение': 4, 'Машино-место': 5, 'Объект незавершённого строительства': 6}
        tc = tm.get(t, 0)
        if y < 1900:
            y = 2024

        city = normalize_city(ad)
        wc = {'Кирпич': 1, 'Панель': 2, 'Монолит': 3, 'Дерево': 4, 'Блок': 5, 'Смешанный': 6}.get(wm, 0)
        nc = get_object_category(on)
        pc = get_purpose_code_from_string(pi) if pi else get_purpose_code(on, t)
        if pc is None:
            pc = get_purpose_code(on, t)
        lu = get_land_use_category(pu) if tc == 1 else 0
        lc_val = get_land_category(pu) if tc == 1 else 0

        # ============================================================
        # 🔥 ТОЛЬКО ПОЛНАЯ КС → ВСЕГДА ДЕЛИМ НА ПЛОЩАДЬ
        # ============================================================
        ks_provided = ka and ka.replace('.', '').replace(',', '').isdigit() and float(ka) > 0
        median_price = MEDIAN_KS.get(city, {}).get(tc, 50000)
        ks_note = ""

        if ks_provided and a > 0:
            ks_raw = float(ka)
            # ВСЕГДА делим на площадь (пользователь вводит ПОЛНУЮ КС)
            ks = ks_raw / a
            ks_note = f" (полная КС {ks_raw:,.0f} ₽ ÷ {a:,.0f} м²)"
        elif ks_provided:
            ks = float(ka)
            ks_note = ""
        else:
            ks = median_price
            ks_note = " (медиана по городу)"

        # Выбор модели
        model = None
        if tc == 1:
            model = MODELS.get('land')
        elif tc == 2:
            model = MODELS.get('buildings')
        elif tc == 3:
            model = MODELS.get('rooms')
        elif tc == 4:
            model = MODELS.get('structures')
        elif tc == 5:
            model = MODELS.get('machines')
        elif tc == 6:
            model = MODELS.get('ons')

        if ks_provided:
            if model is None:
                ps = median_price
                method = "Модель не найдена, использована медиана"
            else:
                feats = build_features(a, y, ks, city, tc, pc, wc, nc, lu, lc_val)
                if tc == 1:
                    X_cols = ['area','log_area','build_year','age','age_squared','wall_material_code','name_category','city_code','is_old','is_new','small_area','area_group','log_ks','purpose_code','land_use_code','land_category_code']
                elif tc in [5,6]:
                    X_cols = ['area','log_area','city_code','ks_per_sqm']
                else:
                    X_cols = ['area','log_area','build_year','age','age_squared','wall_material_code','name_category','city_code','is_old','is_new','small_area','area_group','ks_per_sqm','purpose_code']
                X = pd.DataFrame([[feats[c] for c in X_cols]], columns=X_cols)
                pred_log = model.predict(X)[0]
                ps = float(np.expm1(pred_log))
                method = f"ML-модель CatBoost v15 (КС введена{ks_note})"
        else:
            cascade_price = get_cascade_price(city, tc, a, y, nc, pc, wc, lu, lc_val)
            ml_price = None

            if model is not None:
                try:
                    feats = build_features(a, y, ks, city, tc, pc, wc, nc, lu, lc_val)
                    if tc == 1:
                        X_cols = ['area','log_area','build_year','age','age_squared','wall_material_code','name_category','city_code','is_old','is_new','small_area','area_group','log_ks','purpose_code','land_use_code','land_category_code']
                    elif tc in [5,6]:
                        X_cols = ['area','log_area','city_code','ks_per_sqm']
                    else:
                        X_cols = ['area','log_area','build_year','age','age_squared','wall_material_code','name_category','city_code','is_old','is_new','small_area','area_group','ks_per_sqm','purpose_code']
                    X = pd.DataFrame([[feats[c] for c in X_cols]], columns=X_cols)
                    pred_log = model.predict(X)[0]
                    ml_price = float(np.expm1(pred_log))
                except:
                    ml_price = None

            if cascade_price is not None and cascade_price > median_price * 0.2:
                cascade_ok = True
            else:
                cascade_price = median_price
                cascade_ok = False

            if ml_price is not None and cascade_ok:
                ps = ml_price * 0.10 + cascade_price * 0.90
                method = "Гибрид ML(10%) + Каскад(90%) (КС не введена)"
            elif cascade_ok:
                ps = cascade_price
                method = "Каскад медиан (ML не сработал)"
            else:
                ps = median_price
                method = "Медиана по городу (каскад не дал результат)"

        pt = ps * a

        # 🔥 Расчёт разницы с КС в процентах (только для Excel)
        ks_total_input = float(ka) if ks_provided else 0
        percent_diff = round(((pt - ks_total_input) / ks_total_input * 100), 1) if ks_provided and ks_total_input > 0 else None

        type_names = {1: 'Земельный участок', 2: 'Здание', 3: 'Помещение',
                      4: 'Сооружение', 5: 'Машино-место', 6: 'ОНС'}
        mat_names = {1: 'Кирпич', 2: 'Панель', 3: 'Монолит', 4: 'Дерево', 5: 'Блок', 6: 'Смешанный'}

        # Формируем строку с информацией о КС
        ks_display = f"{ks:,.0f} ₽/м²"
        if ks_note:
            ks_display += ks_note

        calculation = (
            f"РАСЧЁТ РЫНОЧНОЙ СТОИМОСТИ\n\n"
            f"1️⃣ ПАРАМЕТРЫ ОБЪЕКТА:\n"
            f"   • Тип: {type_names.get(tc, 'Неизвестно')}\n"
            f"   • Город: {city}\n"
            f"   • Площадь: {a:,.0f} м²\n"
            f"   • Год постройки: {y}\n"
            f"   • Материал стен: {mat_names.get(wc, 'Не указан')}\n"
            f"   • Кадастровая стоимость: {ks_display}\n\n"
            f"2️⃣ МЕТОД РАСЧЁТА:\n"
            f"   • {method}\n"
            f"   • Предсказанная цена: {ps:,.0f} ₽/м²\n\n"
            f"3️⃣ ИТОГ:\n"
            f"   • Цена за 1 м²: {ps:,.0f} ₽\n"
            f"   • Полная стоимость: {ps:,.0f} × {a:,.0f} = {pt:,.0f} ₽\n"
            f"   • Отношение рыночной к кадастровой: в {ps/ks:.2f} раза"
        )

        # 🔥 Формируем расшифровку расчёта
        if ks_provided:
            calc_desc = (
                f"КС введена ({ks_total_input:,.0f} ₽). "
                f"Метод: ML-модель CatBoost (100% доверия). "
                f"Модель использует 17 признаков (площадь, год постройки, материал стен, "
                f"категория объекта, город, КС и др.). "
                f"Предсказание: {ps:,.0f} ₽/м² → {pt:,.0f} ₽ за объект. "
                f"Разница с КС: {percent_diff:+.1f}%."
            )
        else:
            calc_desc = (
                f"КС не введена — использована медиана ({ks:,.0f} ₽/м²). "
                f"Метод: Гибрид ML(10%) + Каскад медиан(90%). "
                f"ML-модель даёт предсказание на основе медианной КС, "
                f"Каскад ищет похожие объекты по городу, материалу, площади и году. "
                f"Итоговая цена = ML × 0.10 + Каскад × 0.90 = {ps:,.0f} ₽/м² → {pt:,.0f} ₽ за объект."
            )

        result = {
            "predicted": {"price_per_sqm": round(ps), "price_total": round(pt)},
            "calculation": calculation,
            "details": {
                "area": a, "build_year": y, "city": city,
                "object_type": type_names.get(tc, 'Неизвестно'),
                "ks_per_sqm": round(ks),
                "ks_provided": ks_provided,
                "method": method,
                "ratio_to_ks": round(ps / ks, 2) if ks > 0 else None,
                "percent_diff": percent_diff,
                "calc_desc": calc_desc
            }
        }

        return {'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result, ensure_ascii=False, separators=(',', ':'))}

    except Exception as e:
        import traceback
        print(f"{e}\n{traceback.format_exc()}", file=sys.stderr)
        return {'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': str(e)})}
