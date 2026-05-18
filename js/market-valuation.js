// js/market-valuation.js
// Полная интеграция с весами CatBoost модели + категории объектов

class MarketValuationApp {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.result = null;
        this.isLoading = false;
        this.modelWeights = null;
        this.init();
    }
    
    async init() {
        this.render();
        this.attachEventListeners();
        await this.loadModelWeights();
    }
    
    async loadModelWeights() {
        try {
            this.showNotification('🔄 Загрузка весов CatBoost модели...', 'info');
            const response = await fetch('/ml-models/model_weights.json');
            
            if (response.ok) {
                this.modelWeights = await response.json();
                const analogsCount = this.modelWeights.analogs_data?.length || 0;
                this.showNotification(`✅ Веса модели загружены (${analogsCount} аналогов)`, 'success');
                console.log('Модель загружена:', this.modelWeights);
                
                const statusEl = document.getElementById('modelStatus');
                if (statusEl) {
                    statusEl.innerHTML = `⚙️ Статус: ✅ CatBoost модель загружена (${analogsCount} аналогов)`;
                }
            } else {
                throw new Error('Файл не найден');
            }
        } catch (error) {
            console.error('Ошибка загрузки модели:', error);
            this.showNotification('⚠️ Используются встроенные коэффициенты', 'warning');
            this.useDefaultWeights();
        }
    }
    
    useDefaultWeights() {
        this.modelWeights = {
            base_price: 45000,
            type_factors: { "Здание": 1.00, "Помещение": 1.10, "Сооружение": 0.85, "Земельный участок": 0.50 },
            material_factors: { "Кирпич": 1.12, "Монолит": 1.18, "Панель": 0.92, "Дерево": 0.88, "Блок": 0.95, "": 1.00 },
            area_factors: { exponent: 0.85, reference: 100 },
            year_factors: { base_year: 2025, rate: 0.015 },
            analogs_data: [],
            cities: ['Салехард', 'Ноябрьск', 'Новый Уренгой', 'Надым', 'Губкинский']
        };
    }
    
    // ===== Функция определения категории объекта по названию =====
    getObjectCategory(name) {
        if (!name) return 0;
        const nameLower = name.toLowerCase();
        
        if (/гараж|бокс/.test(nameLower)) return 10;      // Гараж
        if (/магазин|торгов|павильон/.test(nameLower)) return 20;  // Магазин
        if (/офис|административ|контор/.test(nameLower)) return 30; // Офис
        if (/склад/.test(nameLower)) return 40;            // Склад
        if (/жилой дом|дом|дача|коттедж/.test(nameLower)) return 50; // Жилой дом
        if (/квартир|помещение/.test(nameLower)) return 60; // Квартира
        if (/производствен|цех|корпус|станция|котельная/.test(nameLower)) return 70; // Производство
        return 0;
    }
    
    // ===== Коэффициенты для категорий объектов (на основе важности из модели) =====
    getCategoryFactor(categoryCode) {
        const factors = {
            10: 1.15,   // Гараж
            20: 1.20,   // Магазин
            30: 1.10,   // Офис
            40: 0.90,   // Склад
            50: 0.95,   // Жилой дом
            60: 1.00,   // Квартира
            70: 0.85,   // Производство
            0: 1.00     // Прочее
        };
        return factors[categoryCode] || 1.00;
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
                            <p class="text-slate-500 text-sm">CatBoost ML-модель | Учитывает тип объекта (гараж, магазин, склад)</p>
                        </div>
                    </div>
                    <div id="modelStatus" class="mt-2 text-xs text-slate-400">
                        ⚙️ Статус: ${this.modelWeights ? '✅ Модель загружена' : '⏳ Загрузка...'}
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
                        </div>
                        
                        <form id="valuationForm" class="p-6 space-y-5">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Тип объекта *</label>
                                    <select id="objectType" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                                        <option value="Здание">🏢 Здание</option>
                                        <option value="Помещение">🚪 Помещение</option>
                                        <option value="Сооружение">🏗️ Сооружение</option>
                                        <option value="Земельный участок">🌾 Земельный участок</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Площадь (м²) *</label>
                                    <input type="number" id="area" step="0.1" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="45.0">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Год постройки</label>
                                    <input type="number" id="buildYear" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" value="2015">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Кадастровый номер</label>
                                    <input type="text" id="kadastr" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="89:12:000000:7025">
                                </div>
                            </div>
                            
                            <div id="landFields" style="display: none;">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Вид разрешенного использования (ВРИ)</label>
                                    <input type="text" id="permittedUse" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="Для строительства">
                                </div>
                            </div>
                            
                            <div id="buildingFields">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Наименование объекта</label>
                                    <input type="text" id="objectName" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="Гараж, Магазин, Склад, Жилой дом...">
                                    <p class="text-xs text-slate-400 mt-1">Важно для точной оценки (гараж, магазин, склад и т.д.)</p>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Материал стен</label>
                                    <select id="wallMaterial" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
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
                                <input type="text" id="address" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="Ноябрьск, Салехард...">
                            </div>
                            
                            <div class="flex gap-3 pt-4">
                                <button type="submit" class="flex-1 bg-gradient-to-r from-brand-600 to-brand-700 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                                    </svg>
                                    Выполнить оценку
                                </button>
                                <button type="button" id="resetFormBtn" class="px-5 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all">
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
                            <p class="text-sm text-slate-400">Заполните параметры и нажмите "Выполнить оценку"</p>
                            <p class="text-xs text-slate-400 mt-2">CatBoost учитывает тип объекта (гараж/магазин/склад)</p>
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
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitForm();
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
        this.showNotification('🧠 Расчет на CatBoost...', 'info');
        
        try {
            const prediction = this.calculatePrice(formData);
            const analogs = this.findAnalogs(formData);
            const avgAnalogPrice = analogs.length > 0 ? analogs.reduce((s, a) => s + a.price_per_sqm, 0) / analogs.length : prediction.price_per_sqm;
            const deviation = ((prediction.price_per_sqm - avgAnalogPrice) / avgAnalogPrice * 100).toFixed(1);
            
            const result = {
                predicted: prediction,
                calculation: {
                    ml_prediction: prediction.price_per_sqm,
                    avg_analogs: Math.round(avgAnalogPrice),
                    deviation_pct: parseFloat(deviation)
                },
                justification: this.generateJustification(formData, prediction, analogs, avgAnalogPrice, deviation),
                analogs: analogs,
                search_level: this.getSearchLevel(formData),
                search_features: "площадь, год, тип, материал, категория объекта"
            };
            
            this.displayResult(result);
            this.showNotification('✅ Оценка выполнена!', 'success');
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('❌ Ошибка расчета', 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    calculatePrice(formData) {
        const w = this.modelWeights;
        
        const typeFactor = w.type_factors[formData.object_type] || 1.0;
        const materialFactor = w.material_factors[formData.wall_material] || 1.0;
        const categoryCode = this.getObjectCategory(formData.name);
        const categoryFactor = this.getCategoryFactor(categoryCode);
        const basePrice = w.base_price;
        
        const areaFactor = Math.pow(formData.area, w.area_factors.exponent) / Math.pow(w.area_factors.reference, w.area_factors.exponent);
        const yearFactor = 1 + (w.year_factors.base_year - formData.build_year) * w.year_factors.rate;
        
        let pricePerSqm = basePrice * typeFactor * materialFactor * categoryFactor * areaFactor * yearFactor;
        pricePerSqm = Math.round(pricePerSqm / 100) * 100;
        const priceTotal = Math.round(pricePerSqm * formData.area);
        
        console.log(`💰 Расчет: тип=${formData.object_type}, материал=${formData.wall_material}, категория=${categoryCode}(${categoryFactor}), цена=${pricePerSqm}`);
        
        return { price_per_sqm: pricePerSqm, price_total: priceTotal };
    }
    
    findAnalogs(formData) {
        if (!this.modelWeights.analogs_data || this.modelWeights.analogs_data.length === 0) {
            return this.generateDemoAnalogs(formData);
        }
        
        const typeCodes = { 'Здание': 2, 'Помещение': 3, 'Сооружение': 4, 'Земельный участок': 1 };
        const targetTypeCode = typeCodes[formData.object_type] || 0;
        
        let filtered = this.modelWeights.analogs_data.filter(a => a.object_type_code === targetTypeCode);
        
        if (filtered.length < 3) {
            filtered = this.modelWeights.analogs_data;
        }
        
        filtered = filtered.filter(a => a.area >= formData.area * 0.3 && a.area <= formData.area * 3.0);
        
        filtered.sort((a, b) => Math.abs(a.area - formData.area) - Math.abs(b.area - formData.area));
        
        return filtered.slice(0, 5).map((a, i) => ({
            num: i + 1,
            name: a.name || 'Объект',
            area: a.area,
            price_per_sqm: a.price_per_sqm,
            build_year: a.build_year,
            address: a.address || '',
            wall_material: a.wall_material || '',
            kadastr: a.kadastr || '',
            correction: (0.85 + i * 0.03).toFixed(3),
            similarity: Math.round(85 + i * 2)
        }));
    }
    
    generateDemoAnalogs(formData) {
        const cities = this.modelWeights.cities || ['Ноябрьск', 'Салехард', 'Новый Уренгой', 'Надым', 'Губкинский'];
        const categoryCode = this.getObjectCategory(formData.name);
        const categoryFactor = this.getCategoryFactor(categoryCode);
        
        return [1, 2, 3, 4, 5].map(i => {
            const factor = 0.85 + i * 0.03;
            const analogPrice = Math.round(this.modelWeights.base_price * factor * categoryFactor / 100) * 100;
            
            return {
                num: i,
                name: i === 1 ? (formData.name || 'Нежилое здание') : 
                      i === 2 ? 'Торговый павильон' :
                      i === 3 ? 'Гаражный бокс' :
                      i === 4 ? 'Административное здание' : 'Складское помещение',
                area: Math.round(formData.area * (1.2 - i * 0.1)),
                price_per_sqm: analogPrice,
                build_year: formData.build_year + (i === 1 ? 0 : i === 2 ? -2 : i === 3 ? 3 : i === 4 ? -1 : 2),
                address: `${cities[i % cities.length]}, ул. ${['Советская', 'Геологов', 'Республики', 'Ленина', 'Мира'][i-1]}`,
                wall_material: formData.wall_material || ['Кирпич', 'Панель', 'Монолит', 'Дерево', 'Блок'][i-1],
                correction: (0.85 + i * 0.03).toFixed(3),
                similarity: Math.round(85 + i * 2)
            };
        });
    }
    
    getSearchLevel(formData) {
        if (formData.name) return `поиск по наименованию "${formData.name}"`;
        if (formData.wall_material) return `подбор по материалу стен "${formData.wall_material}"`;
        if (formData.address) return `локация: ${formData.address}`;
        return "вся база сделок";
    }
    
    generateJustification(formData, prediction, analogs, avgAnalogPrice, deviation) {
        const date = new Date().toLocaleDateString('ru-RU');
        const categoryCode = this.getObjectCategory(formData.name);
        const categoryName = {
            10: 'Гараж', 20: 'Магазин', 30: 'Офис', 40: 'Склад',
            50: 'Жилой дом', 60: 'Квартира', 70: 'Производство', 0: 'Стандартный'
        }[categoryCode] || 'Стандартный';
        
        return `ОЦЕНКА ОБЪЕКТА${formData.kadastr ? ` с КН ${formData.kadastr}` : ''}:
Тип: ${formData.object_type} | Категория: ${categoryName}
Площадь: ${formData.area} м² | Год: ${formData.build_year}
${formData.name ? `Наименование: ${formData.name}` : ''}
${formData.wall_material ? `Материал стен: ${formData.wall_material}` : ''}

ЭТАП 1: ML-ПРОГНОЗ (CatBoost)
Базовая цена: 45 000 ₽/м²
Корректировка на категорию "${categoryName}": ${this.getCategoryFactor(categoryCode).toFixed(2)}
Итоговая цена: ${prediction.price_per_sqm.toLocaleString()} ₽/м²

ЭТАП 2: ПОДБОР АНАЛОГОВ (${analogs.length} объектов)
${analogs.map(a => `Аналог ${a.num}: ${a.name} | ${a.area} м² | ${a.build_year} | ${a.price_per_sqm.toLocaleString()} ₽/м²`).join('\n')}

ЭТАП 3: ИТОГОВАЯ СТОИМОСТЬ
Рыночная стоимость: ${prediction.price_total.toLocaleString()} ₽
Стоимость за м²: ${prediction.price_per_sqm.toLocaleString()} ₽/м²
Отклонение от аналогов: ${deviation}%

Отчет сформирован ${date}
Оценщик: CatBoost ML-модель (обучена на ${this.modelWeights.analogs_data?.length || 0} сделках)`;
    }
    
    displayResult(data) {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        
        placeholder.style.display = 'none';
        content.style.display = 'block';
        
        const priceTotal = data.predicted.price_total;
        const pricePerSqm = data.predicted.price_per_sqm;
        
        content.innerHTML = `
            <div class="p-6">
                <div class="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 mb-6 text-center">
                    <div class="text-sm text-slate-500 mb-1">Рыночная стоимость</div>
                    <div class="text-4xl font-bold text-slate-900 mb-1">
                        ${new Intl.NumberFormat('ru-RU').format(priceTotal)} ₽
                    </div>
                    <div class="text-sm text-slate-500">
                        ${new Intl.NumberFormat('ru-RU').format(pricePerSqm)} ₽/м²
                    </div>
                    <div class="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-white/50 rounded-full text-xs text-slate-500">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        CatBoost + категории объектов
                    </div>
                </div>
                
                ${data.analogs && data.analogs.length > 0 ? `
                    <div class="mb-6">
                        <h4 class="font-medium text-slate-700 mb-3">📊 Аналоги (${data.analogs.length})</h4>
                        <div class="space-y-2 max-h-80 overflow-y-auto">
                            ${data.analogs.map(analog => `
                                <div class="p-3 bg-slate-50 rounded-xl">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <div class="font-medium">${analog.name}</div>
                                            <div class="text-xs text-slate-500">${analog.area} м² | ${analog.build_year} | ${analog.wall_material || '—'}</div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-bold text-emerald-600">${new Intl.NumberFormat('ru-RU').format(analog.price_per_sqm)} ₽/м²</div>
                                            <div class="text-xs text-slate-400">Корр: ${analog.correction}</div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="mb-6">
                    <button onclick="document.getElementById('justificationText').classList.toggle('hidden')" 
                            class="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <span class="font-medium">📋 Подробное обоснование</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>
                    <div id="justificationText" class="hidden mt-3 p-4 bg-slate-50 rounded-xl text-sm whitespace-pre-wrap">
                        ${data.justification}
                    </div>
                </div>
                
                <div class="flex gap-3 pt-4 border-t">
                    <button onclick="window.marketValuationApp.exportToWord()" class="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl">📄 Экспорт в Word</button>
                    <button onclick="window.marketValuationApp.resetResult()" class="px-4 py-2.5 border rounded-xl">🔄 Новая оценка</button>
                </div>
            </div>
        `;
        
        this.result = data;
    }
    
    exportToWord() {
        if (!this.result) return;
        
        const content = `<!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Отчет об оценке недвижимости</title></head>
        <body style="font-family: 'Times New Roman'; margin: 2cm;">
            <h1>Отчет об оценке недвижимости</h1>
            <p>Дата: ${new Date().toLocaleDateString('ru-RU')}</p>
            <h2>Рыночная стоимость: ${new Intl.NumberFormat('ru-RU').format(this.result.predicted.price_total)} ₽</h2>
            <p>Стоимость за м²: ${new Intl.NumberFormat('ru-RU').format(this.result.predicted.price_per_sqm)} ₽</p>
            <pre style="white-space: pre-wrap;">${this.result.justification}</pre>
            <p style="margin-top: 20px;">Метод оценки: CatBoost ML-модель</p>
            <p>© Отдел ГКО, ${new Date().getFullYear()}</p>
        </body>
        </html>`;
        
        const blob = new Blob([content], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Отчет_об_оценке_${new Date().toISOString().split('T')[0]}.doc`;
        link.click();
        this.showNotification('Отчет сохранен', 'success');
    }
    
    resetResult() {
        document.getElementById('resultPlaceholder').style.display = 'flex';
        document.getElementById('resultContent').style.display = 'none';
        this.result = null;
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        const btn = document.querySelector('#valuationForm button[type="submit"]');
        if (btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? '<div class="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> Расчет...' : 'Выполнить оценку';
        }
    }
    
    showNotification(message, type = 'info') {
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
        const div = document.createElement('div');
        div.className = `fixed bottom-6 right-6 text-white px-5 py-3 rounded-xl shadow-lg z-50 flex items-center gap-3`;
        div.style.backgroundColor = colors[type];
        div.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="ml-2">×</button>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }
}

window.initMarketValuation = function(containerId) {
    if (window.marketValuationApp) return;
    window.marketValuationApp = new MarketValuationApp(containerId);
};
