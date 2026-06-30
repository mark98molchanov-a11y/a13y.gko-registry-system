class MarketValuationApp {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.result = null;
        this.massResults = null;
        this.singleResult = null;
        this.isLoading = false;
        this.init();
    }
    
    init() {
        this.render();
        this.attachEventListeners();
    }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="max-w-4xl mx-auto p-5">
                <div class="mb-5">
                    <h2 class="text-xl font-bold text-slate-900">Рыночная оценка недвижимости ЯНАО</h2>
                    <p class="text-slate-500 text-sm">CatBoost ML + умный каскад + коррекция</p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl flex justify-between items-center">
                            <h3 class="font-semibold text-slate-800">📋 Параметры объекта</h3>
                            <div class="flex gap-2">
                                <button onclick="window.marketValuationApp.downloadTemplate()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg transition-colors">📥 Шаблон</button>
                                <label class="cursor-pointer bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                                    📤 Импорт Excel
                                    <input type="file" id="massFileInput" accept=".xlsx,.csv" class="hidden" onchange="window.marketValuationApp.handleFileImport(event)">
                                </label>
                            </div>
                        </div>
                        
                        <form id="valuationForm" class="p-5 space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Тип объекта *</label>
                                <select id="objectType" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                    <option value="Помещение">🚪 Помещение</option>
                                    <option value="Здание">🏢 Здание</option>
                                    <option value="Земельный участок">🌾 Земельный участок</option>
                                    <option value="Сооружение">🏗️ Сооружение</option>
                                    <option value="Машино-место">🅿️ Машино-место</option>
                                    <option value="Объект незавершённого строительства">🏚️ Объект незавершенного строительства</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Площадь, м² *</label>
                                <input type="number" id="area" step="0.1" min="1" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="100">
                            </div>
                            
                            <div id="oksFields">
                                <div class="space-y-3">
                                    <div><label class="block text-sm font-medium text-slate-700 mb-1">Наименование</label><input type="text" id="objectName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Квартира, Магазин, Офис..."></div>
                                    <div><label class="block text-sm font-medium text-slate-700 mb-1">Назначение</label><input type="text" id="purposeInput" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Жилое, Нежилое, Гараж, Склад, Торговое..."><p class="text-xs text-slate-400 mt-1">Оставьте пустым — определится автоматически</p></div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div><label class="block text-sm font-medium text-slate-700 mb-1">Год</label><input type="number" id="buildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015"></div>
                                        <div><label class="block text-sm font-medium text-slate-700 mb-1">Материал</label><select id="wallMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg"><option value="">Не указан</option><option value="Кирпич">Кирпич</option><option value="Панель">Панель</option><option value="Монолит">Монолит</option><option value="Блок">Блок</option><option value="Дерево">Дерево</option><option value="Смешанный">Смешанный</option></select></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="landFields" style="display: none;">
                                <div class="space-y-3">
                                    <div><label class="block text-sm font-medium text-slate-700 mb-1">ВРИ</label><input type="text" id="permittedUseInput" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Например: Индивидуальное жилищное строительство"></div>
                                    <div><label class="block text-sm font-medium text-slate-700 mb-1">Категория земель</label><input type="text" id="landCategoryInput" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Например: Земли населенных пунктов"></div>
                                </div>
                            </div>
                            
                            <div id="structureFields" style="display: none;">
                                <div class="space-y-3">
                                    <input type="text" id="structureName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Трубопровод, Эстакада...">
                                    <div class="grid grid-cols-2 gap-3">
                                        <input type="number" id="structureBuildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015" placeholder="Год">
                                        <select id="structureMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg"><option value="">Материал</option><option value="Кирпич">Кирпич</option><option value="Монолит">Монолит</option><option value="Блок">Блок</option><option value="Смешанный">Смешанный</option></select>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Муниципальное образование *</label>
                                <select id="city" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                    <option value="">Выберите...</option>
                                    <option value="Салехард">Салехард</option>
                                    <option value="Ноябрьск">Ноябрьск</option>
                                    <option value="Новый Уренгой">Новый Уренгой</option>
                                    <option value="Надым">Надым</option>
                                    <option value="Губкинский">Губкинский</option>
                                    <option value="Муравленко">Муравленко</option>
                                    <option value="Лабытнанги">Лабытнанги</option>
                                    <option value="Тарко-Сале">Пуровский район</option>
                                    <option value="Тазовский">Тазовский район</option>
                                    <option value="Яр-Сале">Ямальский район</option>
                                    <option value="Красноселькуп">Красноселькупский район</option>
                                    <option value="Мужи">Шурышкарский район</option>
                                    <option value="Аксарка">Приуральский район</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Кадастровый номер</label>
                                <input type="text" id="cadastralNumber" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="86:00:0000000:123">
                                <p class="text-xs text-slate-400 mt-1">Необязательное поле</p>
                            </div>
                            
                            <!-- 🔥 НОВОЕ ПОЛЕ: КАДАСТРОВАЯ СТОИМОСТЬ -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Кадастровая стоимость (полная), ₽</label>
<input type="number" id="cadastralPrice" step="0.01" min="0" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Например: 16982962">
<p class="text-xs text-slate-400 mt-1">Введите полную кадастровую стоимость объекта. Если не заполнено — будет использована медиана по городу + каскад</p>
                            </div>

                            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50">🔍 Рассчитать стоимость</button>
                        </form>
                    </div>
                    
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div id="resultPlaceholder" class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]"><div class="text-6xl mb-4">🏠</div><p class="text-slate-500">Заполните форму и нажмите «Рассчитать»</p></div>
                        <div id="resultContent" style="display: none;"></div>
                        <div id="resultLoading" style="display: none;" class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]"><div class="animate-spin text-4xl mb-4">⏳</div><p class="text-slate-500" id="loadingText">Рассчитываем...</p></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    downloadTemplate() {
        const XLSX = window.XLSX;
       const template = [
            {'Тип объекта':'Помещение','Площадь (м²)':60,'Город (МО)':'Ноябрьск','Материал стен':'Кирпич','Наименование':'Квартира','Назначение':'Жилое','Год постройки':2015,'ВРИ (для земли)':'','Категория земель':'','Кадастровый номер':'','КС (полная, ₽)':''},
            {'Тип объекта':'Здание','Площадь (м²)':100,'Город (МО)':'г. Салехард','Материал стен':'Монолит','Наименование':'Магазин','Назначение':'Торговое','Год постройки':2020,'ВРИ (для земли)':'','Категория земель':'','Кадастровый номер':'','КС (полная, ₽)':''},
            {'Тип объекта':'Земельный участок','Площадь (м²)':600,'Город (МО)':'Ноябрьск','Материал стен':'','Наименование':'','Назначение':'','Год постройки':2024,'ВРИ (для земли)':'Индивидуальное жилищное строительство','Категория земель':'Земли населенных пунктов','Кадастровый номер':'','КС (полная, ₽)':''},
            {'Тип объекта':'Земельный участок','Площадь (м²)':1000,'Город (МО)':'Надым','Материал стен':'','Наименование':'','Назначение':'','Год постройки':2024,'ВРИ (для земли)':'для садоводства','Категория земель':'Земли сельхозназначения','Кадастровый номер':'','КС (полная, ₽)':''}
        ];
        if (XLSX) {
            const ws = XLSX.utils.json_to_sheet(template); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Шаблон'); XLSX.writeFile(wb, 'шаблон_массовой_оценки.xlsx');
        } else {
            const csv = 'Тип объекта;Площадь (м²);Город (МО);Материал стен;Наименование;Назначение;Год постройки;ВРИ;Категория земель;Кадастровый номер;КС (полная, ₽)\nПомещение;60;Ноябрьск;Кирпич;Квартира;Жилое;2015;;;;\nЗдание;100;г. Салехард;Монолит;Магазин;Торговое;2020;;;;\nЗемельный участок;600;Ноябрьск;;;;2024;для ИЖС;Земли населенных пунктов;;\nЗемельный участок;1000;Надым;;;;2024;для садоводства;Земли сельхозназначения;;\n';
            const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'шаблон_массовой_оценки.csv'; a.click();
        }
        this.showNotification('📥 Шаблон скачан!','success');
    }
    
    attachEventListeners() {
        const form = document.getElementById('valuationForm');
        const objectType = document.getElementById('objectType');
        if (objectType) {
            objectType.addEventListener('change', () => {
                const t = objectType.value;
                document.getElementById('oksFields').style.display = 'none';
                document.getElementById('landFields').style.display = 'none';
                document.getElementById('structureFields').style.display = 'none';
                if (t==='Здание'||t==='Помещение') document.getElementById('oksFields').style.display='block';
                else if (t==='Земельный участок') document.getElementById('landFields').style.display='block';
                else if (t==='Сооружение') document.getElementById('structureFields').style.display='block';
            });
            objectType.dispatchEvent(new Event('change'));
        }
        if (form) form.addEventListener('submit', async (e) => { e.preventDefault(); await this.submitForm(); });
    }
    
    mapColumns(row) {
        return {
            area: parseFloat(row['Площадь (м²)']||row['area'])||0,
            build_year: parseInt(row['Год постройки']||row['build_year'])||2024,
            object_type: row['Тип объекта']||row['object_type']||'Помещение',
            permitted_use: row['ВРИ (для земли)']||row['ВРИ']||row['permitted_use']||'',
            land_category: row['Категория земель']||row['land_category']||'',
            address: row['Город (МО)']||row['address']||'',
            kadastr: row['Кадастровый номер']||row['kadastr']||'',
            // 🔥 ДОБАВЛЯЕМ КС В МАППИНГ
            kadastr_price: parseFloat(row['КС (полная, ₽)']||row['ks']||0) || '',
            wall_material: row['Материал стен']||row['wall_material']||'',
            object_name: row['Наименование']||row['object_name']||'',
            purpose: row['Назначение']||row['purpose']||''
        };
    }
    
    async handleFileImport(event) {
        const file = event.target.files[0]; if (!file) return;
        this.showNotification(`📤 Загружен: ${file.name}`,'info');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await this.loadSheetJS();
                const workbook = XLSX.read(e.target.result,{type:'array'});
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet);
                if (data.length===0){this.showNotification('Файл пуст','error');return;}
                if (data.length>100){this.showNotification('Максимум 100 объектов','error');return;}
                
                document.getElementById('resultPlaceholder').style.display='none';
                document.getElementById('resultLoading').style.display='flex';
                document.getElementById('loadingText').textContent=`Оценка ${data.length} объектов...`;
                
                const results=[]; let success=0, errors=0;
                
                for (let i=0; i<data.length; i++) {
                    const row=this.mapColumns(data[i]);
                    // 🔥 args: [area, year, type, permitted_use, address, cadastral_price, wall_material, object_name, purpose]
                    const args=[row.area, row.build_year, row.object_type, row.permitted_use, row.address, row.kadastr_price, row.wall_material, row.object_name, row.purpose];
                    try {
                        const resp=await fetch('https://markmolchanov98.pythonanywhere.com/api/index',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({args})});
                        if (resp.ok) {
                            const result=await resp.json();
                            const analogsKadastrs = (result.analogs||[]).map(a=>a.kadastr).filter(k=>k).join('; ');
                            const analogsPrices = (result.analogs||[]).map(a=>a.price_per_sqm).filter(p=>p);
                            const avgAnalogPrice = analogsPrices.length > 0 ? Math.round(analogsPrices.reduce((a,b)=>a+b,0)/analogsPrices.length) : 0;
                            
                            let calcInfo = '';
                            if (result.calculation_details && result.calculation_details.calculation) {
                                calcInfo = result.calculation_details.calculation;
                            }
                            
                            const ksUsed = result.details?.ks_per_sqm || '—';
                            const ksProvided = result.details?.ks_provided ? 'Да' : 'Нет (медиана)';
                            
                            results.push({
                                '№':i+1,
                                'Тип объекта':row.object_type,
                                'Площадь (м²)':row.area,
                                'Город (МО)':row.address,
                                'Материал стен':row.wall_material,
                                'Наименование':row.object_name,
                                'Назначение':row.purpose,
                                'Год постройки':row.build_year,
                                'ВРИ':row.permitted_use,
                                'Категория земель':row.land_category,
                                'Кадастровый номер':row.kadastr,
                                'КС введена (полная, ₽)': row.kadastr_price || '—',
                                'КС использована (₽/м²)':ksUsed,
                                'КС введена?':ksProvided,
                                'Метод расчёта':result.details?.method || '—',
                                'Цена за м² (₽)':result.predicted.price_per_sqm,
                                'Стоимость всего (₽)':result.predicted.price_total,
                                'Аналогов':result.calculation.analogs_count,
                                'Ср. цена аналогов (₽/м²)':avgAnalogPrice,
                                'Кадастры аналогов':analogsKadastrs,
                                'Как считали':calcInfo,
                                'Статус':'✅ Успешно'
                            });
                            success++;
                        } else { results.push({...data[i],'Статус':'❌ Ошибка'}); errors++; }
                    } catch (err) { results.push({...data[i],'Статус':'❌ Ошибка'}); errors++; }
                    document.getElementById('loadingText').textContent=`Оценка ${i+1}/${data.length} (✅${success} ❌${errors})`;
                }
                
                this.massResults=results;
                document.getElementById('resultLoading').style.display='none';
                document.getElementById('resultContent').style.display='block';
                document.getElementById('resultContent').innerHTML=`
                    <div class="p-5 text-center">
                        <div class="text-2xl font-bold text-green-600 mb-2">✅ Оценка завершена!</div>
                        <p class="text-slate-600">✅ ${success} успешно | ❌ ${errors} с ошибками | Всего: ${data.length}</p>
                        <button onclick="window.marketValuationApp.downloadExcel()" class="mt-4 w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">📥 Скачать результат Excel</button>
                        <button onclick="window.marketValuationApp.resetResult()" class="mt-2 w-full py-2 border border-slate-300 rounded-lg text-sm">🔄 Новая оценка</button>
                    </div>`;
            } catch (err) { this.showNotification('Ошибка чтения файла','error'); }
        };
        reader.readAsArrayBuffer(file);
    }
    
    async submitForm() {
        if (this.isLoading) return;
        const objectType=document.getElementById('objectType')?.value||'Помещение';
        const isLand=objectType==='Земельный участок';
        const isStructure=objectType==='Сооружение';
        const isMachine=objectType==='Машино-место';
        const isOns=objectType==='Объект незавершённого строительства';
        const area=parseFloat(document.getElementById('area')?.value||0);
        const city=document.getElementById('city')?.value||'';
        const cadastralNumber = document.getElementById('cadastralNumber')?.value?.trim() || '';
        // 🔥 ЧИТАЕМ КАДАСТРОВУЮ СТОИМОСТЬ
        const cadastralPrice = document.getElementById('cadastralPrice')?.value?.trim() || '';
        
        if (!area||area<=0){this.showNotification('Введите площадь','error');return;}
        if (!city){this.showNotification('Выберите город','error');return;}
        
        let build_year=2015, name='', wall_material='', permitted_use='', purpose='', land_category='';
        if (isLand){permitted_use=document.getElementById('permittedUseInput')?.value||''; land_category=document.getElementById('landCategoryInput')?.value||''; build_year=2024;}
        else if (isMachine||isOns){
            build_year=2024;
            name=isMachine?'Машино-место':'Объект незавершённого строительства';
            purpose=name;  
        }
        else if (isStructure){build_year=parseInt(document.getElementById('structureBuildYear')?.value||2015);name=document.getElementById('structureName')?.value||'Сооружение';wall_material=document.getElementById('structureMaterial')?.value||'';}
        else {build_year=parseInt(document.getElementById('buildYear')?.value||2015);name=document.getElementById('objectName')?.value||objectType;wall_material=document.getElementById('wallMaterial')?.value||'';purpose=document.getElementById('purposeInput')?.value||'';}
        
        // 🔥 args: [area, year, type, permitted_use, address, cadastral_price, wall_material, object_name, purpose]
        //      cadastral_price — это args[5] (индекс 5)
        const args=[area, build_year, objectType, permitted_use, city, cadastralPrice, wall_material, name, purpose];
        this.setLoading(true);
        try {
            const resp=await fetch('https://markmolchanov98.pythonanywhere.com/api/index',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({args})});
            if (!resp.ok) throw new Error(`Ошибка ${resp.status}`);
            const result=await resp.json();
            
            const analogsKadastrs = (result.analogs||[]).map(a=>a.kadastr).filter(k=>k).join('; ');
            const analogsPrices = (result.analogs||[]).map(a=>a.price_per_sqm).filter(p=>p);
            const avgAnalogPrice = analogsPrices.length > 0 ? Math.round(analogsPrices.reduce((a,b)=>a+b,0)/analogsPrices.length) : 0;
            
            let calcInfo = '';
            if (result.calculation_details && result.calculation_details.calculation) {
                calcInfo = result.calculation_details.calculation;
            }
            
            const ksUsed = result.details?.ks_per_sqm || '—';
            const ksProvided = result.details?.ks_provided ? 'Да' : 'Нет (медиана)';
            
            this.singleResult={
                'Тип объекта':objectType,
                'Площадь (м²)':area,
                'Город (МО)':city,
                'Кадастровый номер':cadastralNumber,
                'КС введена (полная, ₽)': cadastralPrice || '—',
                'КС использована (₽/м²)':ksUsed,
                'КС введена?':ksProvided,
                'Метод расчёта':result.details?.method || '—',
                'Материал стен':wall_material,
                'Наименование':name,
                'Назначение':purpose||'(авто)',
                'Год постройки':build_year,
                'ВРИ':permitted_use,
                'Категория земель':land_category,
                'Цена за м² (₽)':result.predicted.price_per_sqm,
                'Стоимость всего (₽)':result.predicted.price_total,
                'Аналогов':result.calculation.analogs_count,
                'Ср. цена аналогов (₽/м²)':avgAnalogPrice,
                'Кадастры аналогов':analogsKadastrs,
                'Как считали':calcInfo
            };
            this.displayResult(result);
            this.showNotification('✅ Оценка выполнена','success');
        } catch (error) { this.showNotification('Ошибка сервера','error'); }
        finally { this.setLoading(false); }
    }
    
    displayResult(data) {
        document.getElementById('resultPlaceholder').style.display='none';
        document.getElementById('resultLoading').style.display='none';
        document.getElementById('resultContent').style.display='block';
        const fp=(p)=>{if(p>=1000000)return `${(p/1000000).toFixed(2)} млн ₽`;if(p>=1000)return `${(p/1000).toFixed(0)} тыс. ₽`;return `${p} ₽`;};
        const method = data.details?.method || 'ML-модель';
        const ksInfo = data.details?.ks_provided ? '✅ КС введена' : '📊 КС не введена (медиана + каскад)';
        const ksValue = data.details?.ks_per_sqm ? `${new Intl.NumberFormat('ru-RU').format(data.details.ks_per_sqm)} ₽/м²` : '—';
        
        document.getElementById('resultContent').innerHTML=`
            <div class="p-5 text-center">
                <div class="text-sm text-slate-500 mb-1">Рыночная стоимость</div>
                <div class="text-3xl font-bold text-slate-900">${fp(data.predicted.price_total)}</div>
                <div class="text-sm text-slate-500 mt-1">${new Intl.NumberFormat('ru-RU').format(data.predicted.price_per_sqm)} ₽/м²</div>
                <div class="text-xs text-slate-400 mt-2">${method}</div>
                <div class="text-xs text-slate-400">${ksInfo} (КС: ${ksValue})</div>
                <div class="border-t pt-4 mt-4 space-y-2">
                    <button onclick="window.marketValuationApp.downloadSingleExcel()" class="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">📥 Скачать Excel</button>
                    <button onclick="window.marketValuationApp.resetResult()" class="w-full py-2 border border-slate-300 rounded-lg text-sm">🔄 Новая оценка</button>
                </div>
            </div>`;
        this.result=data;
    }
    
    downloadSingleExcel() {
        if (!this.singleResult) return;
        const XLSX=window.XLSX;
        if (XLSX) { const ws=XLSX.utils.json_to_sheet([this.singleResult]); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Результат'); XLSX.writeFile(wb,'результат_оценки.xlsx'); }
        else { const csv=Object.keys(this.singleResult).join(';')+'\n'+Object.values(this.singleResult).join(';'); const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='результат_оценки.csv'; a.click(); }
    }
    
    downloadExcel() {
        if (!this.massResults) return;
        const XLSX=window.XLSX;
        if (XLSX) { const ws=XLSX.utils.json_to_sheet(this.massResults); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Результаты'); XLSX.writeFile(wb,'результаты_массовой_оценки.xlsx'); }
        else { const csv=Object.keys(this.massResults[0]).join(';')+'\n'+this.massResults.map(r=>Object.values(r).join(';')).join('\n'); const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='результаты_массовой_оценки.csv'; a.click(); }
    }
    
    async loadSheetJS() {
        if (window.XLSX) return window.XLSX;
        return new Promise((resolve)=>{const s=document.createElement('script');s.src='https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';s.onload=()=>resolve(window.XLSX);document.head.appendChild(s);});
    }
    
    resetResult() { 
        document.getElementById('resultPlaceholder').style.display='flex'; 
        document.getElementById('resultContent').style.display='none'; 
        this.result = null; 
        this.massResults = null; 
        this.singleResult = null;
        const fileInput = document.getElementById('massFileInput');
        if (fileInput) { fileInput.value = ''; }
        const form = document.getElementById('valuationForm');
        if (form) { form.reset(); }
    }
    
    setLoading(loading) {
        this.isLoading=loading;
        const btn=document.querySelector('#valuationForm button[type="submit"]');
        if (btn){btn.disabled=loading;btn.innerHTML=loading?'⏳...':'🔍 Рассчитать стоимость';}
        document.getElementById('resultLoading').style.display=loading?'flex':'none';
        if (loading){document.getElementById('resultPlaceholder').style.display='none';document.getElementById('resultContent').style.display='none';}
    }
    
    showNotification(message,type='info') {
        const colors={success:'#10b981',error:'#ef4444',info:'#3b82f6'};
        const div=document.createElement('div');
        div.className='fixed bottom-6 right-6 text-white px-4 py-3 rounded-lg shadow-lg z-50';
        div.style.backgroundColor=colors[type];
        div.innerHTML=`${message}<button onclick="this.parentElement.remove()" class="ml-3">×</button>`;
        document.body.appendChild(div); setTimeout(()=>div.remove(),4000);
    }
}

window.initMarketValuation = function(containerId) {
    if (window.marketValuationApp) return;
    window.marketValuationApp = new MarketValuationApp(containerId);
};
