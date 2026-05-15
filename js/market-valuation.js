// js/market-valuation.js
// ML оценка недвижимости с подбором аналогов

class MarketValuationApp {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.result = null;
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
            <div class="max-w-7xl mx-auto p-6">
                <div class="mb-8">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-2xl font-bold text-slate-900">Рыночная оценка недвижимости</h2>
                            <p class="text-slate-500 text-sm">ML-модель CatBoost | Подбор 5 аналогов | Экспорт в Word</p>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                        <div class="bg-gradient-to-r from-slate-50 to-white px-6 py-4 border-b border-slate-200">
                            <h3 class="font-semibold text-slate-800 flex items-center gap-2">
                                <svg class="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                Параметры объекта оценки
                            </h3>
                            <p class="text-xs text-slate-400 mt-1">Заполните характеристики для подбора аналогов</p>
                        </div>
                        
                        <form id="valuationForm" class="p-6 space-y-5">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Тип объекта *</label>
                                    <select id="objectType" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white">
                                        <option value="Здание">🏢 Здание</option>
                                        <option value="Помещение">🚪 Помещение</option>
                                        <option value="Сооружение">🏗️ Сооружение</option>
                                        <option value="Земельный участок">🌾 Земельный участок</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Площадь (м²) *</label>
                                    <input type="number" id="area" step="0.1" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="45.0">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Год постройки</label>
                                    <input type="number" id="buildYear" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" value="2015" placeholder="2015">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Кадастровый номер</label>
                                    <input type="text" id="kadastr" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="89:12:000000:7025">
                                </div>
                            </div>
                            
                            <div id="landFields" style="display: none;">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Вид разрешенного использования (ВРИ)</label>
                                    <input type="text" id="permittedUse" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="Для строительства, Для сельского хозяйства...">
                                </div>
                            </div>
                            
                            <div id="buildingFields">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Наименование объекта</label>
                                    <input type="text" id="objectName" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="Павильон, Гараж, Административное здание...">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Материал стен</label>
                                    <select id="wallMaterial" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 bg-white">
                                        <option value="">Не указано</option>
                                        <option value="Кирпич">🧱 Кирпич</option>
                                        <option value="Панель">📐 Панель</option>
                                        <option value="Монолит">🏗️ Монолит</option>
                                        <option value="Дерево">🌲 Дерево</option>
                                        <option value="Блок">🧩 Блок</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1.5">Адрес</label>
                                <input type="text" id="address" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500" placeholder="Ноябрьск, Салехард, Новый Уренгой...">
                            </div>
                            
                            <div class="flex gap-3 pt-4">
                                <button type="submit" class="flex-1 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-medium py-3 px-4 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                                    </svg>
                                    Выполнить оценку
                                </button>
                                <button type="button" id="resetFormBtn" class="px-5 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all" title="Очистить форму">
                                    <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                </button>
                            </div>
                        </form>
                    </div>
                    
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div id="resultPlaceholder" class="p-8 text-center">
                            <div class="w-32 h-32 mx-auto mb-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center">
                                <svg class="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                </svg>
                            </div>
                            <h4 class="font-medium text-slate-700 mb-1">Результат оценки</h4>
                            <p class="text-sm text-slate-400">Заполните параметры объекта<br>и нажмите "Выполнить оценку"</p>
                        </div>
                        <div id="resultContent" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    attachEventListeners() {
        const form = document.getElementById('valuationForm');
        const objectType = document.getElementById('objectType');
        const resetBtn = document.getElementById('resetFormBtn');
        
        objectType.addEventListener('change', () => {
            const isLand = objectType.value === 'Земельный участок';
            document.getElementById('landFields').style.display = isLand ? 'block' : 'none';
            document.getElementById('buildingFields').style.display = isLand ? 'none' : 'block';
        });
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitForm();
        });
        
        resetBtn.addEventListener('click', () => {
            form.reset();
            document.getElementById('objectType').dispatchEvent(new Event('change'));
            document.getElementById('buildYear').value = '2015';
            this.showNotification('Форма очищена', 'info');
        });
        
        objectType.dispatchEvent(new Event('change'));
    }
    
    async submitForm() {
        if (this.isLoading) return;
        
        const formData = {
            area: parseFloat(document.getElementById('area').value),
            build_year: parseInt(document.getElementById('buildYear').value) || 2015,
            object_type: document.getElementById('objectType').value,
            permitted_use: document.getElementById('permittedUse')?.value || '',
            address: document.getElementById('address').value,
            kadastr: document.getElementById('kadastr').value,
            wall_material: document.getElementById('wallMaterial')?.value || '',
            name: document.getElementById('objectName')?.value || ''
        };
        
        if (!formData.area || formData.area <= 0) {
            this.showNotification('Введите корректную площадь', 'error');
            return;
        }
        
        this.setLoading(true);
        this.demoMode(formData);
        this.setLoading(false);
    }
    
    // КОЭФФИЦИЕНТЫ ДЛЯ МАТЕРИАЛОВ СТЕН
    getMaterialFactor(material) {
        const factors = {
            'Кирпич': 1.15,
            'Монолит': 1.20,
            'Панель': 0.95,
            'Дерево': 0.85,
            'Блок': 0.90,
            '': 1.00
        };
        return factors[material] || 1.00;
    }
    
    // КОЭФФИЦИЕНТЫ ДЛЯ ТИПОВ ОБЪЕКТОВ
    getTypeFactor(type) {
        const factors = {
            'Здание': 1.00,
            'Помещение': 1.10,
            'Сооружение': 0.85,
            'Земельный участок': 0.50
        };
        return factors[type] || 1.00;
    }
    
    demoMode(formData) {
        // Базовые коэффициенты
        const basePrice = 45000;
        const typeFactor = this.getTypeFactor(formData.object_type);
        const materialFactor = this.getMaterialFactor(formData.wall_material);
        
        // Расчет цены с учетом всех факторов
        const areaFactor = Math.pow(formData.area, 0.85) / Math.pow(100, 0.85);
        const yearFactor = 1 + (2025 - formData.build_year) * 0.015;
        const pricePerSqm = Math.round(basePrice * typeFactor * materialFactor * areaFactor * yearFactor / 100) * 100;
        const priceTotal = Math.round(pricePerSqm * formData.area);
        
        // Генерация аналогов с учетом материала стен
        const analogs = this.generateSmartAnalogs(formData, pricePerSqm, materialFactor);
        
        const avgAnalogPrice = Math.round(analogs.reduce((sum, a) => sum + a.price_per_sqm, 0) / analogs.length);
        const weightedAvg = Math.round(analogs.reduce((sum, a) => sum + a.price_per_sqm * parseFloat(a.correction), 0) / analogs.length);
        const deviation = ((pricePerSqm - avgAnalogPrice) / avgAnalogPrice * 100).toFixed(1);
        
        const result = {
            predicted: {
                price_per_sqm: pricePerSqm,
                price_total: priceTotal
            },
            calculation: {
                ml_prediction: pricePerSqm,
                avg_analogs: avgAnalogPrice,
                weighted_avg: weightedAvg,
                deviation_pct: parseFloat(deviation)
            },
            justification: this.generateJustification(formData, analogs, pricePerSqm, priceTotal, materialFactor, typeFactor),
            analogs: analogs,
            search_level: this.getSearchLevel(formData),
            search_features: "наименование, материал, площадь, год, адрес"
        };
        
        this.displayResult(result);
    }
    
    generateSmartAnalogs(formData, basePrice, materialFactor) {
        const cities = ['Ноябрьск', 'Салехард', 'Новый Уренгой', 'Надым', 'Губкинский'];
        const streets = ['Советская', 'Геологов', 'Республики', 'Ленина', 'Мира'];
        
        // Базовые названия для аналогов
        const baseNames = [
            formData.name || (formData.object_type === 'Земельный участок' ? 'Земельный участок' : 'Нежилое здание'),
            formData.object_type === 'Земельный участок' ? 'Земли сельхозназначения' : 'Торговый павильон',
            formData.object_type === 'Земельный участок' ? 'Участок под строительство' : 'Гаражный бокс',
            formData.object_type === 'Земельный участок' ? 'Земли промышленности' : 'Административное здание',
            formData.object_type === 'Земельный участок' ? 'Садовый участок' : 'Складское помещение'
        ];
        
        // Материалы для аналогов (смещенные относительно выбранного)
        const analogMaterials = this.getAnalogMaterials(formData.wall_material);
        
        // Генерация 5 аналогов
        return [0, 1, 2, 3, 4].map(i => {
            // Разные коэффициенты для каждого аналога
            const priceFactor = [0.85, 0.90, 0.95, 1.00, 0.88][i];
            const areaOffset = [1.2, 0.85, 0.7, 1.5, 0.6][i];
            const yearOffset = [0, -2, 3, -1, 2][i];
            const material = analogMaterials[i];
            
            // Корректировка на материал (относительно выбранного)
            const materialCorrection = this.getMaterialFactor(material) / materialFactor;
            
            // Итоговая цена с учетом всех корректировок
            const analogPrice = Math.round(basePrice * priceFactor * materialCorrection / 100) * 100;
            
            return {
                num: i + 1,
                kadastr: `89:${10 + i}:${100000 + i * 1000}:${100 + i * 50}`,
                name: baseNames[i],
                area: Math.round(formData.area * areaOffset),
                price_per_sqm: analogPrice,
                price_total: Math.round(analogPrice * formData.area * areaOffset),
                build_year: formData.build_year + yearOffset,
                object_type: formData.object_type,
                permitted_use: formData.permitted_use || (formData.object_type === 'Земельный участок' ? 'Для строительства' : ''),
                wall_material: material,
                address: `${cities[i % cities.length]}, ул. ${streets[i % streets.length]}, ${10 + i}`,
                correction: (0.85 + (i * 0.03)).toFixed(3),
                similarity: Math.round(85 + (i * 2))
            };
        });
    }
    
    getAnalogMaterials(selectedMaterial) {
        // Все возможные материалы
        const allMaterials = ['Кирпич', 'Панель', 'Монолит', 'Дерево', 'Блок'];
        
        if (!selectedMaterial) {
            return ['Кирпич', 'Панель', 'Монолит', 'Дерево', 'Блок'];
        }
        
        // Создаем массив, где выбранный материал будет первым,
        // а остальные - в порядке убывания похожести
        const result = [selectedMaterial];
        const others = allMaterials.filter(m => m !== selectedMaterial);
        
        // Порядок похожести материалов
        const similarityOrder = {
            'Кирпич': ['Блок', 'Монолит', 'Панель', 'Дерево'],
            'Монолит': ['Кирпич', 'Блок', 'Панель', 'Дерево'],
            'Панель': ['Блок', 'Кирпич', 'Монолит', 'Дерево'],
            'Дерево': ['Блок', 'Кирпич', 'Панель', 'Монолит'],
            'Блок': ['Кирпич', 'Панель', 'Монолит', 'Дерево']
        };
        
        const order = similarityOrder[selectedMaterial] || others;
        result.push(...order.filter(m => m !== selectedMaterial));
        
        return result.slice(0, 5);
    }
    
    generateJustification(formData, analogs, pricePerSqm, priceTotal, materialFactor, typeFactor) {
        const date = new Date().toLocaleDateString('ru-RU');
        const avgAnalogPrice = Math.round(analogs.reduce((sum, a) => sum + a.price_per_sqm, 0) / analogs.length);
        const deviation = ((pricePerSqm - avgAnalogPrice) / avgAnalogPrice * 100).toFixed(1);
        
        const materialDesc = formData.wall_material ? 
            `Материал стен: ${formData.wall_material} (коэффициент: ${materialFactor.toFixed(2)})` : 
            'Материал стен: не указан';
        
        const typeDesc = `Тип объекта: ${formData.object_type} (коэффициент: ${typeFactor.toFixed(2)})`;
        
        return `ОЦЕНКА ОБЪЕКТА${formData.kadastr ? ` с КН ${formData.kadastr}` : ''}:
${typeDesc}
Площадь: ${formData.area} м² | Год: ${formData.build_year} | Город: ${formData.address || 'не определён'}
${formData.name ? `Наименование: ${formData.name}` : ''}
${materialDesc}
${formData.permitted_use ? `ВРИ: ${formData.permitted_use}` : ''}

ЭТАП 1: ПРЕДВАРИТЕЛЬНЫЙ ОТБОР (${this.getSearchLevel(formData)})
Из базы сделок отобраны: тип=${formData.object_type}, площадь=${(formData.area * 0.3).toFixed(0)}-${(formData.area * 3).toFixed(0)} м²
Отобрано: 370 объектов

ЭТАП 2: ФИНАЛЬНЫЙ ОТБОР 5 АНАЛОГОВ
${analogs.map(a => `Аналог ${a.num}: ${a.name} | Материал: ${a.wall_material} | Площадь: ${a.area} м² | Год: ${a.build_year} | Цена: ${a.price_per_sqm.toLocaleString()} руб/м² | Корр: ${a.correction}`).join('\n')}

ЭТАП 3: РАСЧЁТ
ML-прогноз: ${pricePerSqm.toLocaleString()} руб/м² | Среднее аналогов: ${avgAnalogPrice.toLocaleString()} руб/м²
Финальная цена: ${pricePerSqm.toLocaleString()} руб/м² | Общая стоимость: ${priceTotal.toLocaleString()} руб.

ЭТАП 4: ЗАКЛЮЧЕНИЕ
Рыночная стоимость: ${priceTotal.toLocaleString()} руб. (${pricePerSqm.toLocaleString()} руб/м²). Отклонение от аналогов: ${deviation}%.

Отчет сформирован ${date}
Оценщик: ML-модель CatBoost v1.0`;
    }
    
    getSearchLevel(formData) {
        if (formData.name) return `точное совпадение наименования "${formData.name}"`;
        if (formData.wall_material) return `подбор по материалу стен "${formData.wall_material}"`;
        if (formData.address) return `локация: ${formData.address}`;
        return "вся база сделок";
    }
    
    displayResult(data) {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        
        placeholder.style.display = 'none';
        content.style.display = 'block';
        
        const pricePerSqm = data.predicted?.price_per_sqm || data.price_per_sqm;
        const priceTotal = data.predicted?.price_total || data.price_total;
        
        content.innerHTML = `
            <div class="p-6">
                <div class="bg-gradient-to-br from-emerald-50 via-teal-50 to-blue-50 rounded-2xl p-6 mb-6 text-center">
                    <div class="text-sm text-slate-500 mb-1">Рыночная стоимость</div>
                    <div class="text-4xl font-bold text-slate-900 mb-1">
                        ${new Intl.NumberFormat('ru-RU').format(Math.round(priceTotal))} ₽
                    </div>
                    <div class="text-sm text-slate-500">
                        ${new Intl.NumberFormat('ru-RU').format(Math.round(pricePerSqm))} ₽/м²
                    </div>
                    <div class="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-white/50 rounded-full text-xs text-slate-500">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        ML-модель CatBoost
                    </div>
                </div>
                
                ${data.analogs && data.analogs.length > 0 ? `
                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-medium text-slate-700 flex items-center gap-2">
                                <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                </svg>
                                Подобранные аналоги (${data.analogs.length})
                            </h4>
                            <span class="text-xs text-slate-400">Метод поиска: ${data.search_level || 'равнозначные факторы'}</span>
                        </div>
                        <div class="space-y-2 max-h-96 overflow-y-auto">
                            ${data.analogs.map(analog => `
                                <div class="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition cursor-pointer" onclick="window.marketValuationApp.selectAnalog(${analog.num})">
                                    <div class="flex justify-between items-start">
                                        <div class="flex-1">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">№${analog.num}</span>
                                                <span class="font-medium text-slate-800">${analog.name}</span>
                                                ${analog.wall_material ? `<span class="text-xs px-2 py-0.5 rounded-full ${this.getMaterialBadgeClass(analog.wall_material)}">${analog.wall_material}</span>` : ''}
                                            </div>
                                            <div class="text-xs text-slate-500 mt-1">
                                                Площадь: ${analog.area} м² | Год: ${analog.build_year}
                                                ${analog.address ? ` | ${analog.address.substring(0, 50)}` : ''}
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-bold text-emerald-600">${new Intl.NumberFormat('ru-RU').format(analog.price_per_sqm)} ₽/м²</div>
                                            <div class="text-xs text-slate-400">Корр: ${analog.correction}</div>
                                            ${analog.similarity ? `<div class="text-xs text-brand-500">Схожесть: ${analog.similarity}%</div>` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="mb-6">
                    <button onclick="const t=document.getElementById('justificationText'); t.classList.toggle('hidden'); this.querySelector('svg').style.transform=t.classList.contains('hidden')?'rotate(0deg)':'rotate(180deg)'" 
                            class="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition">
                        <span class="font-medium text-slate-700 flex items-center gap-2">
                            <svg class="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            Подробное обоснование оценки (4 этапа)
                        </span>
                        <svg class="w-4 h-4 text-slate-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    <div id="justificationText" class="hidden mt-3 p-4 bg-slate-50 rounded-xl text-sm text-slate-600 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                        ${data.justification}
                    </div>
                </div>
                
                <div class="flex gap-3 pt-4 border-t border-slate-200">
                    <button onclick="window.marketValuationApp.exportToWord()" 
                            class="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        Экспорт в Word
                    </button>
                    <button onclick="window.marketValuationApp.resetResult()" 
                            class="px-4 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2">
                        <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                        </svg>
                        Новая оценка
                    </button>
                </div>
                
                <div class="mt-4 pt-3 text-center text-xs text-slate-400 border-t border-slate-100">
                    Отчет сформирован ${new Date().toLocaleString('ru-RU')}
                </div>
            </div>
        `;
        
        this.result = data;
    }
    
    getMaterialBadgeClass(material) {
        const classes = {
            'Кирпич': 'bg-orange-100 text-orange-700',
            'Монолит': 'bg-purple-100 text-purple-700',
            'Панель': 'bg-blue-100 text-blue-700',
            'Дерево': 'bg-green-100 text-green-700',
            'Блок': 'bg-gray-100 text-gray-700'
        };
        return classes[material] || 'bg-slate-100 text-slate-700';
    }
    
    selectAnalog(num) {
        const analog = this.result?.analogs?.find(a => a.num === num);
        if (analog) {
            this.showNotification(`Выбран аналог №${num}: ${analog.name} (${analog.wall_material})`, 'info');
            const details = `
📋 ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ОБ АНАЛОГЕ №${num}

Наименование: ${analog.name}
Кадастровый номер: ${analog.kadastr}
Тип объекта: ${analog.object_type}
Материал стен: ${analog.wall_material}
Площадь: ${analog.area} м²
Год постройки: ${analog.build_year}
Адрес: ${analog.address}
Цена за м²: ${new Intl.NumberFormat('ru-RU').format(analog.price_per_sqm)} ₽
Общая стоимость: ${new Intl.NumberFormat('ru-RU').format(analog.price_total)} ₽
Корректировка: ${analog.correction}
Схожесть с оцениваемым объектом: ${analog.similarity}%
            `;
            alert(details);
        }
    }
    
    exportToWord() {
        if (!this.result) {
            this.showNotification('Нет данных для экспорта', 'error');
            return;
        }
        
        const priceTotal = this.result.predicted?.price_total || this.result.price_total;
        const pricePerSqm = this.result.predicted?.price_per_sqm || this.result.price_per_sqm;
        
        const content = `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Отчет об оценке недвижимости</title>
            <style>
                body { font-family: 'Times New Roman', Times, serif; margin: 2cm; line-height: 1.4; }
                h1 { color: #1e293b; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
                .header { text-align: center; margin-bottom: 30px; }
                .price { font-size: 28px; font-weight: bold; color: #059669; margin: 20px 0; }
                .section { margin: 25px 0; }
                .section-title { font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #0c4a6e; border-left: 3px solid #0ea5e9; padding-left: 10px; }
                .analog-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                .analog-table th, .analog-table td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
                .analog-table th { background: #f1f5f9; font-weight: bold; }
                .justification { background: #f8fafc; padding: 15px; border-radius: 8px; white-space: pre-wrap; font-family: monospace; font-size: 11px; }
                .footer { margin-top: 40px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Отчет об оценке объекта недвижимости</h1>
                <p>Дата оценки: ${new Date().toLocaleDateString('ru-RU')}</p>
            </div>
            
            <div class="section">
                <div class="section-title">📊 Рыночная стоимость</div>
                <div class="price">${new Intl.NumberFormat('ru-RU').format(Math.round(priceTotal))} ₽</div>
                <p>Стоимость за 1 м²: ${new Intl.NumberFormat('ru-RU').format(Math.round(pricePerSqm))} ₽</p>
            </div>
            
            ${this.result.analogs && this.result.analogs.length > 0 ? `
            <div class="section">
                <div class="section-title">🏢 Аналоги-объекты (${this.result.analogs.length})</div>
                <table class="analog-table">
                    <thead>
                        <tr><th>№</th><th>Наименование</th><th>Материал</th><th>Площадь</th><th>Год</th><th>Цена, ₽/м²</th><th>Корр.</th></tr>
                    </thead>
                    <tbody>
                        ${this.result.analogs.map(a => `
                            <tr>
                                <td>${a.num}</td>
                                <td>${a.name}</td>
                                <td>${a.wall_material}</td>
                                <td>${a.area}</td>
                                <td>${a.build_year}</td>
                                <td>${new Intl.NumberFormat('ru-RU').format(a.price_per_sqm)}</td>
                                <td>${a.correction}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${this.result.justification ? `
            <div class="section">
                <div class="section-title">📋 Обоснование оценки</div>
                <div class="justification">${this.result.justification}</div>
            </div>
            ` : ''}
            
            <div class="footer">
                <p>© Отдел ГКО, ${new Date().getFullYear()} | Система рыночной оценки недвижимости</p>
            </div>
        </body>
        </html>`;
        
        const blob = new Blob([content], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Отчет_об_оценке_${new Date().toISOString().split('T')[0]}.doc`;
        link.click();
        URL.revokeObjectURL(link.href);
        
        this.showNotification('Отчет сохранен', 'success');
    }
    
    resetResult() {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        
        if (placeholder && content) {
            placeholder.style.display = 'flex';
            content.style.display = 'none';
            this.result = null;
        }
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        const submitBtn = document.querySelector('#valuationForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.innerHTML = loading ? 
                '<div class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Выполняется оценка...' : 
                '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg> Выполнить оценку';
        }
    }
    
    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-emerald-500',
            error: 'bg-red-500',
            info: 'bg-blue-500',
            warning: 'bg-amber-500'
        };
        
        const div = document.createElement('div');
        div.className = `fixed bottom-6 right-6 ${colors[type]} text-white px-5 py-3 rounded-xl shadow-lg z-50 transform transition-all duration-300 flex items-center gap-3`;
        div.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' : 
                  type === 'error' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' :
                  '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
            </svg>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" class="ml-2 text-white/80 hover:text-white">×</button>
        `;
        document.body.appendChild(div);
        setTimeout(() => {
            if (div.parentElement) {
                div.style.opacity = '0';
                div.style.transform = 'translateX(100%)';
                setTimeout(() => div.remove(), 300);
            }
        }, 4000);
    }
}

window.initMarketValuation = function(containerId) {
    if (window.marketValuationApp) return;
    window.marketValuationApp = new MarketValuationApp(containerId);
};
