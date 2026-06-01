// js/market-valuation.js - МИНИМАЛИСТИЧНАЯ ВЕРСИЯ (Импорт/Экспорт Excel + Шаблон)
class MarketValuationApp {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.result = null;
        this.massResults = null;
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
                    <p class="text-slate-500 text-sm">CatBoost ML | 2500+ сделок | 6 моделей | 22 города</p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- ФОРМА -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl flex justify-between items-center">
                            <h3 class="font-semibold text-slate-800">📋 Параметры объекта</h3>
                            <div class="flex gap-2">
                                <!-- 🔥 КНОПКА ШАБЛОНА -->
                                <button onclick="window.marketValuationApp.downloadTemplate()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs px-3 py-1.5 rounded-lg transition-colors" title="Скачать шаблон Excel">
                                    📥 Шаблон
                                </button>
                                <!-- 🔥 КНОПКА ИМПОРТА EXCEL -->
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
                                    <option value="Объект незавершённого строительства">🏚️ ОНС</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Площадь, м² *</label>
                                <input type="number" id="area" step="0.1" min="1" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="100">
                            </div>
                            
                            <div id="oksFields">
                                <div class="space-y-4">
                                    <div>
                                        <label class="block text-sm font-medium text-slate-700 mb-1">Наименование</label>
                                        <input type="text" id="objectName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Квартира, Магазин, Офис...">
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div><label class="block text-sm font-medium text-slate-700 mb-1">Год</label><input type="number" id="buildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015"></div>
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Материал</label>
                                            <select id="wallMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                <option value="">Не указан</option>
                                                <option value="Кирпич">Кирпич</option><option value="Панель">Панель</option>
                                                <option value="Монолит">Монолит</option><option value="Блок">Блок</option>
                                                <option value="Дерево">Дерево</option><option value="Смешанный">Смешанный</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="landFields" style="display: none;">
                                <label class="block text-sm font-medium text-slate-700 mb-1">ВРИ</label>
                                <input type="text" id="permittedUseInput" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Например: для ИЖС">
                            </div>
                            
                            <div id="structureFields" style="display: none;">
                                <div class="space-y-3">
                                    <input type="text" id="structureName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Трубопровод, Эстакада...">
                                    <div class="grid grid-cols-2 gap-3">
                                        <input type="number" id="structureBuildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015" placeholder="Год">
                                        <select id="structureMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                            <option value="">Материал</option>
                                            <option value="Кирпич">Кирпич</option><option value="Монолит">Монолит</option>
                                            <option value="Блок">Блок</option><option value="Смешанный">Смешанный</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Муниципальное образование *</label>
                                <select id="city" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                    <option value="">Выберите...</option>
                                    <option value="Салехард">Салехард</option><option value="Ноябрьск">Ноябрьск</option>
                                    <option value="Новый Уренгой">Новый Уренгой</option><option value="Надым">Надым</option>
                                    <option value="Губкинский">Губкинский</option><option value="Муравленко">Муравленко</option>
                                    <option value="Лабытнанги">Лабытнанги</option>
                                    <option value="Тарко-Сале">Пуровский район</option><option value="Тазовский">Тазовский район</option>
                                    <option value="Яр-Сале">Ямальский район</option><option value="Красноселькуп">Красноселькупский район</option>
                                    <option value="Мужи">Шурышкарский район</option><option value="Аксарка">Приуральский район</option>
                                </select>
                            </div>
                            
                            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg disabled:opacity-50">
                                🔍 Рассчитать стоимость
                            </button>
                        </form>
                    </div>
                    
                    <!-- РЕЗУЛЬТАТ -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div id="resultPlaceholder" class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div class="text-6xl mb-4">🏠</div>
                            <p class="text-slate-500">Заполните форму и нажмите «Рассчитать»</p>
                        </div>
                        <div id="resultContent" style="display: none;"></div>
                        <div id="resultLoading" style="display: none;" class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div class="animate-spin text-4xl mb-4">⏳</div>
                            <p class="text-slate-500" id="loadingText">Рассчитываем...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 🔥 СКАЧАТЬ ШАБЛОН EXCEL
    downloadTemplate() {
        const XLSX = window.XLSX;
        
        // Заголовки на русском
        const template = [
            {
                'Тип объекта': 'Помещение',
                'Площадь (м²)': 60,
                'Город (МО)': 'Ноябрьск',
                'Материал стен': 'Кирпич',
                'Наименование': 'Квартира',
                'Год постройки': 2015,
                'ВРИ (для земли)': '',
                'Кадастровый номер': ''
            },
            {
                'Тип объекта': 'Здание',
                'Площадь (м²)': 100,
                'Город (МО)': 'г. Салехард',
                'Материал стен': 'Монолит',
                'Наименование': 'Магазин',
                'Год постройки': 2020,
                'ВРИ (для земли)': '',
                'Кадастровый номер': ''
            },
            {
                'Тип объекта': 'Земельный участок',
                'Площадь (м²)': 600,
                'Город (МО)': 'Ноябрьск',
                'Материал стен': '',
                'Наименование': '',
                'Год постройки': 2024,
                'ВРИ (для земли)': 'для индивидуального жилищного строительства',
                'Кадастровый номер': ''
            }
        ];
        
        if (XLSX) {
            const ws = XLSX.utils.json_to_sheet(template);
            // Настраиваем ширину столбцов
            ws['!cols'] = [
                {wch: 20}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 25}, {wch: 15}, {wch: 40}, {wch: 25}
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
            XLSX.writeFile(wb, 'шаблон_массовой_оценки.xlsx');
        } else {
            // CSV fallback
            const csv = 'Тип объекта;Площадь (м²);Город (МО);Материал стен;Наименование;Год постройки;ВРИ (для земли);Кадастровый номер\n' +
                       'Помещение;60;Ноябрьск;Кирпич;Квартира;2015;;\n' +
                       'Здание;100;г. Салехард;Монолит;Магазин;2020;;\n' +
                       'Земельный участок;600;Ноябрьск;;;2024;для ИЖС;\n';
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'шаблон_массовой_оценки.csv'; a.click();
        }
        
        this.showNotification('📥 Шаблон скачан!', 'success');
    }
    
    attachEventListeners() {
        const form = document.getElementById('valuationForm');
        const objectType = document.getElementById('objectType');
        
        if (objectType) {
            objectType.addEventListener('change', () => {
                const type = objectType.value;
                document.getElementById('oksFields').style.display = 'none';
                document.getElementById('landFields').style.display = 'none';
                document.getElementById('structureFields').style.display = 'none';
                if (type === 'Здание' || type === 'Помещение') document.getElementById('oksFields').style.display = 'block';
                else if (type === 'Земельный участок') document.getElementById('landFields').style.display = 'block';
                else if (type === 'Сооружение') document.getElementById('structureFields').style.display = 'block';
            });
            objectType.dispatchEvent(new Event('change'));
        }
        
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm();
            });
        }
    }
    
    // 🔥 МАППИНГ РУССКИХ СТОЛБЦОВ В АНГЛИЙСКИЕ
    mapColumns(row) {
        return {
            area: parseFloat(row['Площадь (м²)'] || row['area']) || 0,
            build_year: parseInt(row['Год постройки'] || row['build_year']) || 2024,
            object_type: row['Тип объекта'] || row['object_type'] || 'Помещение',
            permitted_use: row['ВРИ (для земли)'] || row['permitted_use'] || '',
            address: row['Город (МО)'] || row['address'] || '',
            kadastr: row['Кадастровый номер'] || row['kadastr'] || '',
            wall_material: row['Материал стен'] || row['wall_material'] || '',
            object_name: row['Наименование'] || row['object_name'] || ''
        };
    }
    
    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.showNotification(`📤 Загружен: ${file.name}. Начинаем оценку...`, 'info');
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await this.loadSheetJS();
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet);
                
                if (data.length === 0) { this.showNotification('Файл пуст', 'error'); return; }
                if (data.length > 100) { this.showNotification('Максимум 100 объектов', 'error'); return; }
                
                document.getElementById('resultPlaceholder').style.display = 'none';
                document.getElementById('resultLoading').style.display = 'flex';
                document.getElementById('loadingText').textContent = `Оценка ${data.length} объектов...`;
                
                const results = [];
                let success = 0, errors = 0;
                
                for (let i = 0; i < data.length; i++) {
                    const row = this.mapColumns(data[i]);
                    const formData = {
                        area: row.area,
                        build_year: row.build_year,
                        object_type: row.object_type,
                        permitted_use: row.permitted_use,
                        address: row.address,
                        kadastr: row.kadastr,
                        wall_material: row.wall_material,
                        name: row.object_name
                    };
                    
                    try {
                        const response = await fetch('https://markmolchanov98.pythonanywhere.com/api/index', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ args: Object.values(formData) })
                        });
                        if (response.ok) {
                            const result = await response.json();
                            // 🔥 Русские названия в результате
                            results.push({
                                '№': i + 1,
                                'Тип объекта': formData.object_type,
                                'Площадь (м²)': formData.area,
                                'Город (МО)': formData.address,
                                'Материал стен': formData.wall_material,
                                'Наименование': formData.name,
                                'Год постройки': formData.build_year,
                                'ВРИ': formData.permitted_use,
                                'Кадастровый номер': formData.kadastr,
                                'Цена за м² (₽)': result.predicted.price_per_sqm,
                                'Стоимость всего (₽)': result.predicted.price_total,
                                'ML-прогноз': result.calculation.ml_prediction,
                                'После коррекции': result.calculation.corrected_ml,
                                'Аналогов': result.calculation.analogs_count,
                                'Статус': '✅ Успешно'
                            });
                            success++;
                        } else {
                            results.push({ ...data[i], 'Статус': '❌ Ошибка' }); errors++;
                        }
                    } catch (err) {
                        results.push({ ...data[i], 'Статус': '❌ Ошибка' }); errors++;
                    }
                    
                    document.getElementById('loadingText').textContent = `Оценка ${i + 1}/${data.length} (✅${success} ❌${errors})`;
                }
                
                this.massResults = results;
                document.getElementById('resultLoading').style.display = 'none';
                document.getElementById('resultContent').style.display = 'block';
                document.getElementById('resultContent').innerHTML = `
                    <div class="p-5 text-center">
                        <div class="text-2xl font-bold text-green-600 mb-2">✅ Оценка завершена!</div>
                        <p class="text-slate-600">✅ ${success} успешно | ❌ ${errors} с ошибками | Всего: ${data.length}</p>
                        <button onclick="window.marketValuationApp.downloadExcel()" class="mt-4 w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                            📥 Скачать результат Excel
                        </button>
                        <button onclick="window.marketValuationApp.resetResult()" class="mt-2 w-full py-2 border border-slate-300 rounded-lg text-sm">
                            🔄 Новая оценка
                        </button>
                    </div>
                `;
                
            } catch (err) {
                this.showNotification('Ошибка чтения файла', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }
    
    async submitForm() {
        if (this.isLoading) return;
        
        const objectType = document.getElementById('objectType')?.value || 'Помещение';
        const isLand = objectType === 'Земельный участок';
        const isStructure = objectType === 'Сооружение';
        const isMachine = objectType === 'Машино-место';
        const isOns = objectType === 'Объект незавершённого строительства';
        
        const area = parseFloat(document.getElementById('area')?.value || 0);
        const city = document.getElementById('city')?.value || '';
        
        if (!area || area <= 0) { this.showNotification('Введите площадь', 'error'); return; }
        if (!city) { this.showNotification('Выберите город', 'error'); return; }
        
        let build_year = 2015, name = '', wall_material = '', permitted_use = '';
        
        if (isLand) {
            permitted_use = document.getElementById('permittedUseInput')?.value || '';
            build_year = 2024;
        } else if (isMachine || isOns) {
            build_year = 2024;
            name = isMachine ? 'Машино-место' : 'Объект незавершённого строительства';
        } else if (isStructure) {
            build_year = parseInt(document.getElementById('structureBuildYear')?.value || 2015);
            name = document.getElementById('structureName')?.value || 'Сооружение';
            wall_material = document.getElementById('structureMaterial')?.value || '';
        } else {
            build_year = parseInt(document.getElementById('buildYear')?.value || 2015);
            name = document.getElementById('objectName')?.value || objectType;
            wall_material = document.getElementById('wallMaterial')?.value || '';
        }
        
        const formData = { area, build_year, object_type: objectType, permitted_use, address: city, kadastr: '', wall_material, name };
        
        this.setLoading(true);
        
        try {
            const response = await fetch('https://markmolchanov98.pythonanywhere.com/api/index', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args: Object.values(formData) })
            });
            
            if (!response.ok) throw new Error(`Ошибка ${response.status}`);
            const result = await response.json();
            
            this.singleResult = {
                'Тип объекта': formData.object_type,
                'Площадь (м²)': formData.area,
                'Город (МО)': formData.address,
                'Материал стен': formData.wall_material,
                'Наименование': formData.name,
                'Год постройки': formData.build_year,
                'ВРИ': formData.permitted_use,
                'Цена за м² (₽)': result.predicted.price_per_sqm,
                'Стоимость всего (₽)': result.predicted.price_total,
                'ML-прогноз': result.calculation.ml_prediction,
                'После коррекции': result.calculation.corrected_ml,
                'Аналогов': result.calculation.analogs_count
            };
            
            this.displayResult(result, formData);
            this.showNotification('✅ Оценка выполнена', 'success');
        } catch (error) {
            this.showNotification('Ошибка сервера', 'error');
            this.useFallbackCalculation(formData);
        } finally {
            this.setLoading(false);
        }
    }
    
    displayResult(data, formData = null) {
        document.getElementById('resultPlaceholder').style.display = 'none';
        document.getElementById('resultLoading').style.display = 'none';
        document.getElementById('resultContent').style.display = 'block';
        
        const formatPrice = (p) => {
            if (p >= 1000000) return `${(p/1000000).toFixed(2)} млн ₽`;
            if (p >= 1000) return `${(p/1000).toFixed(0)} тыс. ₽`;
            return `${p} ₽`;
        };
        
        document.getElementById('resultContent').innerHTML = `
            <div class="p-5 text-center">
                <div class="text-sm text-slate-500 mb-1">Рыночная стоимость</div>
                <div class="text-3xl font-bold text-slate-900">${formatPrice(data.predicted.price_total)}</div>
                <div class="text-sm text-slate-500 mt-1">${new Intl.NumberFormat('ru-RU').format(data.predicted.price_per_sqm)} ₽/м²</div>
                <div class="border-t pt-4 mt-4 space-y-2">
                    <button onclick="window.marketValuationApp.downloadSingleExcel()" class="w-full py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
                        📥 Скачать Excel
                    </button>
                    <button onclick="window.marketValuationApp.resetResult()" class="w-full py-2 border border-slate-300 rounded-lg text-sm">
                        🔄 Новая оценка
                    </button>
                </div>
            </div>
        `;
        this.result = data;
    }
    
    downloadSingleExcel() {
        if (!this.singleResult) return;
        const XLSX = window.XLSX;
        const data = [this.singleResult];
        
        if (XLSX) {
            const ws = XLSX.utils.json_to_sheet(data);
            ws['!cols'] = [{wch:20},{wch:15},{wch:20},{wch:15},{wch:25},{wch:15},{wch:40},{wch:18},{wch:22},{wch:15},{wch:15},{wch:12}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Результат');
            XLSX.writeFile(wb, 'результат_оценки.xlsx');
        } else {
            const csv = Object.keys(data[0]).join(';') + '\n' + data.map(r => Object.values(r).join(';')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'результат_оценки.csv'; a.click();
        }
    }
    
    downloadExcel() {
        if (!this.massResults) return;
        const XLSX = window.XLSX;
        if (XLSX) {
            const ws = XLSX.utils.json_to_sheet(this.massResults);
            ws['!cols'] = [{wch:8},{wch:20},{wch:15},{wch:20},{wch:15},{wch:25},{wch:15},{wch:40},{wch:25},{wch:18},{wch:22},{wch:15},{wch:15},{wch:12},{wch:15}];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Результаты');
            XLSX.writeFile(wb, 'результаты_массовой_оценки.xlsx');
        } else {
            const csv = Object.keys(this.massResults[0]).join(';') + '\n' + this.massResults.map(r => Object.values(r).join(';')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'результаты_массовой_оценки.csv'; a.click();
        }
    }
    
    async loadSheetJS() {
        if (window.XLSX) return window.XLSX;
        return new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            s.onload = () => resolve(window.XLSX);
            document.head.appendChild(s);
        });
    }
    
    resetResult() {
        document.getElementById('resultPlaceholder').style.display = 'flex';
        document.getElementById('resultContent').style.display = 'none';
        this.result = null; this.massResults = null; this.singleResult = null;
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        const btn = document.querySelector('#valuationForm button[type="submit"]');
        if (btn) { btn.disabled = loading; btn.innerHTML = loading ? '⏳...' : '🔍 Рассчитать стоимость'; }
        document.getElementById('resultLoading').style.display = loading ? 'flex' : 'none';
        if (loading) {
            document.getElementById('resultPlaceholder').style.display = 'none';
            document.getElementById('resultContent').style.display = 'none';
        }
    }
    
    useFallbackCalculation(formData) {
        const basePrice = 45000;
        const typeFactors = { "Помещение": 1.1, "Здание": 1.0, "Земельный участок": 0.5, "Сооружение": 0.85, "Машино-место": 0.7, "Объект незавершённого строительства": 0.6 };
        const materialFactors = { "Кирпич": 1.0, "Монолит": 1.09, "Панель": 1.07, "Смешанный": 1.04, "Блок": 1.32, "Дерево": 0.86, "": 1.0 };
        const pricePerSqm = Math.round(basePrice * (typeFactors[formData.object_type]||1) * (materialFactors[formData.wall_material]||1) / 100) * 100;
        this.singleResult = { ...formData, 'Цена за м² (₽)': pricePerSqm, 'Стоимость всего (₽)': pricePerSqm * formData.area };
        this.displayResult({ predicted: { price_per_sqm: pricePerSqm, price_total: pricePerSqm * formData.area } }, formData);
    }
    
    showNotification(message, type = 'info') {
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
        const div = document.createElement('div');
        div.className = 'fixed bottom-6 right-6 text-white px-4 py-3 rounded-lg shadow-lg z-50';
        div.style.backgroundColor = colors[type];
        div.innerHTML = `${message}<button onclick="this.parentElement.remove()" class="ml-3">×</button>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }
}

window.initMarketValuation = function(containerId) {
    if (window.marketValuationApp) return;
    window.marketValuationApp = new MarketValuationApp(containerId);
};
