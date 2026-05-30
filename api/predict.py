# api/predict.py - Vercel Serverless Function
import pickle
import pandas as pd
import re
import json
import os

def get_object_category(name):
    if not name: return 0
    name_lower = name.lower()
    if re.search(r'гараж|бокс', name_lower): return 10
    if re.search(r'магазин|торгов|павильон', name_lower): return 20
    if re.search(r'офис|административ|контор', name_lower): return 30
    if re.search(r'склад', name_lower): return 40
    if re.search(r'жилой дом|дом|дача|коттедж', name_lower): return 50
    if re.search(r'квартир|помещение', name_lower): return 60
    if re.search(r'производствен|цех|корпус|станция|котельная', name_lower): return 70
    return 0

def get_land_use_category(permitted_use):
    if not permitted_use: return 0
    text = permitted_use.lower()
    if re.search(r'гараж|стоянк|хранени', text): return 1
    if re.search(r'садоводств|огородничеств|дачн', text): return 2
    if re.search(r'индивидуальн.*жилищн.*строительств|жил.*застройк', text): return 3
    if re.search(r'магазин|торгов', text): return 4
    if re.search(r'склад', text): return 5
    if re.search(r'производствен|полезн.*ископаем|разработк', text): return 6
    if re.search(r'административн|офис|делов.*управлени', text): return 7
    return 0

def get_land_category(category):
    if not category: return 0
    text = category.lower()
    if 'населенных пунктов' in text: return 1
    if 'сельскохозяйственного' in text: return 2
    if 'промышленности' in text or 'специального назначения' in text: return 3
    if 'лесного фонда' in text: return 4
    return 0

def clean_val(val, max_len=80):
    if not val: return ''
    return str(val).strip()[:max_len]

def find_analogs(df, object_type_code, area, build_year, object_name, is_land):
    if df is None or df.empty:
        return []
    
    filtered = df[df['object_type_code'] == object_type_code].copy()
    if filtered.empty:
        return []
    
    area_min, area_max = area * 0.3, area * 3.0
    filtered = filtered[(filtered['area'] >= area_min) & (filtered['area'] <= area_max)]
    
    if len(filtered) < 3:
        area_min, area_max = area * 0.2, area * 5.0
        filtered = filtered[(filtered['area'] >= area_min) & (filtered['area'] <= area_max)]
    
    scored = []
    search_name = (object_name or '').lower()
    
    for _, row in filtered.iterrows():
        score = 50
        analog_name = (row.get('name', '') or '').lower()
        if search_name and analog_name:
            if search_name in analog_name or analog_name in search_name:
                score += 40
            else:
                keywords = search_name.split()
                for kw in keywords:
                    if kw and kw in analog_name:
                        score += 15
        
        area_ratio = min(area, row['area']) / max(area, row['area'])
        score += area_ratio * 20
        
        if not is_land:
            year_diff = abs(build_year - row['build_year'])
            if year_diff <= 5:
                score += 10
            elif year_diff <= 10:
                score += 5
            elif year_diff > 20:
                score -= 5
        
        scored.append((score, row))
    
    scored.sort(key=lambda x: x[0], reverse=True)
    return [row for _, row in scored[:5]]

def handler(request):
    try:
        data = request.json or {}
        args = data.get('args', [])
        
        if len(args) < 8:
            return {'statusCode': 400, 'body': json.dumps({'error': 'Not enough arguments'})}
        
        area = float(args[0])
        build_year = int(args[1]) if len(args) > 1 else 2024
        object_type = args[2] if len(args) > 2 else 'Помещение'
        permitted_use = args[3] if len(args) > 3 else ''
        address = args[4] if len(args) > 4 else ''
        kadastr = args[5] if len(args) > 5 else ''
        wall_material = args[6] if len(args) > 6 else ''
        object_name = args[7] if len(args) > 7 else ''
        
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_buildings_path = os.path.join(base_dir, 'ml-models', 'model_buildings.pkl')
        model_land_path = os.path.join(base_dir, 'ml-models', 'model_land.pkl')
        data_path = os.path.join(base_dir, 'ml-models', 'deals_clean.csv')
        
        model_buildings = None
        model_land = None
        df = None
        
        try:
            with open(model_buildings_path, 'rb') as f:
                model_buildings = pickle.load(f)
        except: pass
        
        try:
            with open(model_land_path, 'rb') as f:
                model_land = pickle.load(f)
        except: pass
        
        try:
            df = pd.read_csv(data_path)
        except: pass
        
        type_map = {'Земельный участок': 1, 'Здание': 2, 'Помещение': 3, 'Сооружение': 4}
        type_code = type_map.get(object_type, 0)
        is_land = (type_code == 1)
        
        if is_land and build_year < 2000:
            build_year = 2024
        
        if not is_land:
            material_map = {'Кирпич': 1, 'Панель': 2, 'Монолит': 3, 'Дерево': 4, 'Блок': 5}
            wall_code = material_map.get(wall_material, 0)
            name_category = get_object_category(object_name)
        else:
            wall_code = 0
            name_category = 0
        
        land_use_code = get_land_use_category(permitted_use) if is_land else 0
        land_category_code = get_land_category(permitted_use) if is_land else 0
        
        if is_land and model_land and df is not None:
            try:
                price_sqm = model_land.predict([[area, build_year, land_use_code, land_category_code]])[0]
            except:
                price_sqm = df['price_per_sqm'].median() if df is not None else 45000
        elif not is_land and model_buildings and df is not None:
            try:
                price_sqm = model_buildings.predict([[area, build_year, type_code, wall_code, name_category]])[0]
            except:
                price_sqm = df['price_per_sqm'].median() if df is not None else 45000
        else:
            price_sqm = 45000
        
        analogs = find_analogs(df, type_code, area, build_year, object_name, is_land)
        
        if analogs:
            total_weight = 0
            weighted_price = 0
            for row in analogs:
                weight = 1.0
                area_ratio = min(area, row['area']) / max(area, row['area'])
                weight += area_ratio * 2
                if not is_land:
                    year_diff = abs(build_year - row['build_year'])
                    if year_diff <= 5:
                        weight += 0.3
                    elif year_diff > 20:
                        weight -= 0.2
                weighted_price += row['price_per_sqm'] * weight
                total_weight += weight
            final_price_sqm = weighted_price / total_weight if total_weight > 0 else price_sqm
        else:
            final_price_sqm = price_sqm
        
        final_price_total = final_price_sqm * area
        
        result = {
            "object": {
                "kadastr": clean_val(kadastr, 20),
                "area": area,
                "build_year": build_year if not is_land else None,
                "object_type": object_type,
                "name": clean_val(object_name, 80),
                "address": clean_val(address, 120)
            },
            "predicted": {
                "price_per_sqm": round(final_price_sqm),
                "price_total": round(final_price_total)
            },
            "calculation": {
                "ml_prediction": round(price_sqm),
                "analogs_count": len(analogs)
            },
            "analogs": []
        }
        
        for i, row in enumerate(analogs, 1):
            result["analogs"].append({
                "num": i,
                "name": clean_val(row.get('name', ''), 80),
                "area": round(float(row['area']), 1),
                "price_per_sqm": round(float(row['price_per_sqm'])),
                "build_year": int(row.get('build_year', 0)),
                "address": clean_val(row.get('address', ''), 120)
            })
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps(result, ensure_ascii=False)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
