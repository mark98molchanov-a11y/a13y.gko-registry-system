// js/market-valuation.js - КЛИЕНТСКАЯ ВЕРСИЯ (не требует сервера)

class MarketValuationApp {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.result = null;
        this.init();
    }
    
    init() {
        this.render();
        this.attachEventListeners();
    }
    
    getObjectCategory(name) {
        if (!name) return 0;
        const nameLower = name.toLowerCase();
        if (/гараж|бокс/.test(nameLower)) return 10;
        if (/магазин|торгов|павильон/.test(nameLower)) return 20;
        if (/офис|административ|контор/.test(nameLower)) return 30;
        if (/склад/.test(nameLower)) return 40;
        if (/жилой дом|дом|дача|коттедж/.test(nameLower)) return 50;
        if (/квартир|помещение/.test(nameLower)) return 60;
        if (/производствен|цех|корпус|станция|котельная/.test(nameLower)) return 70;
        return 0;
    }
    
    getCategoryFactor(categoryCode) {
        const factors = {10: 1.15, 20: 1.20, 30: 1.10, 40: 0.90, 50: 0.95, 60: 1.00, 70: 0.85, 0: 1.00};
        return factors[categoryCode] || 1.00;
    }
    
    calculatePrice(formData) {
        const basePrice = 45000;
        const typeFactors = { "Здание": 1.0, "Помещение": 1.1, "Сооружение": 0.85, "Земельный участок": 0.5 };
        const typeFactor = typeFactors[formData.object_type] || 1.0;
        
        const materialFactors = { "Кирпич": 1.12, "Панель": 0.92, "Монолит": 1.18, "Дерево": 0.88, "Блок": 0.95, "": 1.0 };
        const materialFactor = materialFactors[formData.wall_material] || 1.0;
        
        const categoryCode = this.getObjectCategory(formData.name);
        const categoryFactor = this.getCategoryFactor(categoryCode);
        
        // Фактор площади (большая площадь → дешевле за м²)
        let areaFactor = 1.0;
        if (formData.area > 100) {
            areaFactor = Math.pow(100 / formData.area, 0.15);
        } else if (formData.area < 50) {
            areaFactor = Math.pow(50 / formData.area, 0.1);
        }
        
        // Фактор года (только для зданий)
        let yearFactor = 1.0;
        const isLand = formData.object_type === 'Земельный участок';
        if (!isLand && formData.build_year) {
            const yearDiff = 2025 - formData.build_year;
            if (yearDiff > 0 && yearDiff <= 50) {
                yearFactor = Math.max(0.7, 1 - yearDiff * 0.008);
            }
        }
        
        let pricePerSqm = basePrice * typeFactor * materialFactor * categoryFactor * areaFactor * yearFactor;
        pricePerSqm = Math.round(pricePerSqm / 100) * 100;
        
        return { price_per_sqm: pricePerSqm, price_total: Math.round(pricePerSqm * formData.area) };
    }
    
    findAnalogs(formData) {
        const demoAnalogs = [
            { name: "Гараж", area: 25, price_per_sqm: 25000, build_year: 2010, address: "Ноябрьск", wall_material: "Кирпич" },
            { name: "Магазин", area: 120, price_per_sqm: 38000, build_year: 2015, address: "Салехард", wall_material: "Панель" },
            { name: "Склад", area: 450, price_per_sqm: 22000, build_year: 2008, address: "Новый Уренгой", wall_material: "Блок" },
            { name: "Офис", area: 85, price_per_sqm: 42000, build_year: 2018, address: "Надым", wall_material: "Монолит" },
            { name: "Производство", area: 800, price_per_sqm: 18000, build_year: 2005, address: "Губкинский", wall_material: "Панель" },
        ];
        
        const isLand = formData.object_type === 'Земельный участок';
        
        if (isLand) {
            return [
                { num: 1, name: "Земельный участок (ИЖС)", area: 600, price_per_sqm: 8500, build_year: '—', address: "Ноябрьск", similarity: 95 },
                { num: 2, name: "Земельный участок (гараж)", area: 25, price_per_sqm: 15000, build_year: '—', address: "Салехард", similarity: 85 },
                { num: 3, name: "Земельный участок (торговля)", area: 300, price_per_sqm: 12000, build_year: '—', address: "Новый Уренгой", similarity: 80 }
            ];
        }
        
        let filtered = demoAnalogs.filter(a => {
            const searchName = (formData.name || '').toLowerCase();
            if (!searchName) return true;
            return a.name.toLowerCase().includes(searchName) || searchName.includes(a.name.toLowerCase());
        });
        
        filtered.sort((a, b) => Math.abs(a.area - formData.area) - Math.abs(b.area - formData.area));
        
        return filtered.slice(0, 5).map((a, i) => ({
            num: i + 1,
            name: a.name,
            area: a.area,
            price_per_sqm: a.price_per_sqm,
            build_year: a.build_year,
            address: a.address,
            similarity: Math.round(85 - Math.abs(a.area - formData.area) / formData.area * 30)
        }));
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
                            <p class="text-slate-500 text-sm">Расчёт на основе рыночных коэффициентов | Поиск аналогов</p>
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
                                    <input type="number" id="area" step="0.1" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="100">
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div id="yearGroup">
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Год постройки</label>
                                    <input type="number" id="buildYear" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" value="2015">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Кадастровый номер</label>
                                    <input type="text" id="kadastr" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="89:00:000000:0000">
                                </div>
                            </div>
                            
                            <div id="landFields" style="display: none;">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Вид разрешенного использования (ВРИ)</label>
                                    <input type="text" id="permittedUse" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="Для индивидуального жилищного строительства">
                                </div>
                            </div>
                            
                            <div id="buildingFields">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1.5">Наименование объекта</label>
                                    <input type="text" id="objectName" class="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="Гараж, Магазин, Склад, Жилой дом...">
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
                                <label class="block text-sm font-medium text-slate-700 mb-1.5">Адрес (город)</label>
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
        
        if (objectType) {
            objectType.addEventListener('change', () => {
                const isLand = objectType.value === 'Земельный участок';
                const landFields = document.getElementById('landFields');
                const buildingFields = document.getElementById('buildingFields');
                const yearGroup = document.getElementById('yearGroup');
                
                if (landFields) landFields.style.display = isLand ? 'block' : 'none';
                if (buildingFields) buildingFields.style.display = isLand ? 'none' : 'block';
                if (yearGroup) yearGroup.style.opacity = isLand ? '0.5' : '1';
            });
            objectType.dispatchEvent(new Event('change'));
        }
        
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.submitForm();
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (form) form.reset();
                if (objectType) objectType.dispatchEvent(new Event('change'));
                const yearInput = document.getElementById('buildYear');
                if (yearInput) yearInput.value = '2015';
                this.resetResult();
                this.showNotification('Форма очищена', 'info');
            });
        }
    }
    
    async submitForm() {
        const objectType = document.getElementById('objectType')?.value || 'Здание';
        
        const formData = {
            area: parseFloat(document.getElementById('area')?.value || 0),
            build_year: parseInt(document.getElementById('buildYear')?.value || 2015),
            object_type: objectType,
            permitted_use: document.getElementById('permittedUse')?.value || '',
            address: document.getElementById('address')?.value || '',
            kadastr: document.getElementById('kadastr')?.value || '',
            wall_material: document.getElementById('wallMaterial')?.value || '',
            name: document.getElementById('objectName')?.value || ''
        };
        
        if (!formData.area || formData.area <= 0) {
            this.showNotification('Введите корректную площадь', 'error');
            return;
        }
        
        this.showNotification('🧮 Выполняется расчёт...', 'info');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const prediction = this.calculatePrice(formData);
        const analogs = this.findAnalogs(formData);
        const avgAnalogPrice = analogs.length > 0 ? analogs.reduce((s, a) => s + a.price_per_sqm, 0) / analogs.length : prediction.price_per_sqm;
        const deviation = ((prediction.price_per_sqm - avgAnalogPrice) / avgAnalogPrice * 100).toFixed(1);
        
        const result = {
            object: formData,
            predicted: prediction,
            calculation: { ml_prediction: prediction.price_per_sqm, avg_analogs: Math.round(avgAnalogPrice), deviation_pct: parseFloat(deviation), analogs_count: analogs.length },
            justification: this.generateJustification(formData, prediction, analogs, avgAnalogPrice, deviation),
            analogs: analogs
        };
        
        this.displayResult(result);
        this.showNotification('✅ Оценка выполнена!', 'success');
    }
    
    generateJustification(formData, prediction, analogs, avgAnalogPrice, deviation) {
        const categoryCode = this.getObjectCategory(formData.name);
        const categoryName = {10: 'Гараж',20: 'Магазин',30: 'Офис',40: 'Склад',50: 'Жилой дом',60: 'Квартира',70: 'Производство',0: 'Стандартный'}[categoryCode] || 'Стандартный';
        const isLand = formData.object_type === 'Земельный участок';
        
        return `ОЦЕНКА ОБЪЕКТА${formData.kadastr ? ` с КН ${formData.kadastr}` : ''}:
Тип: ${formData.object_type} | Категория: ${categoryName}
Площадь: ${formData.area} м²${!isLand ? ` | Год постройки: ${formData.build_year}` : ''}
${formData.name ? `Наименование: ${formData.name}` : ''}

ЭТАП 1: РАСЧЁТ СТОИМОСТИ
Базовая цена: 45 000 ₽/м²
Корректировка на тип "${formData.object_type}": ${formData.object_type === 'Земельный участок' ? '0.50' : '1.00'}
Корректировка на категорию "${categoryName}": ${this.getCategoryFactor(categoryCode).toFixed(2)}
Итоговая цена: ${prediction.price_per_sqm.toLocaleString()} ₽/м²

ЭТАП 2: ПОДБОР АНАЛОГОВ (${analogs.length} объектов)
${analogs.map(a => `Аналог ${a.num}: ${a.name} | ${a.area} м² | ${a.price_per_sqm.toLocaleString()} ₽/м²`).join('\n')}

ЭТАП 3: ИТОГОВАЯ СТОИМОСТЬ
Рыночная стоимость: ${prediction.price_total.toLocaleString()} ₽
Стоимость за м²: ${prediction.price_per_sqm.toLocaleString()} ₽/м²
Отклонение от аналогов: ${deviation}%

Отчёт сформирован ${new Date().toLocaleDateString('ru-RU')}`;
    }
    
    displayResult(data) {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        if (placeholder) placeholder.style.display = 'none';
        if (content) content.style.display = 'block';
        
        content.innerHTML = `
            <div class="p-6">
                <div class="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-6 mb-6 text-center">
                    <div class="text-sm text-slate-500 mb-1">Рыночная стоимость</div>
                    <div class="text-4xl font-bold text-slate-900 mb-1">${new Intl.NumberFormat('ru-RU').format(data.predicted.price_total)} ₽</div>
                    <div class="text-sm text-slate-500">${new Intl.NumberFormat('ru-RU').format(data.predicted.price_per_sqm)} ₽/м²</div>
                </div>
                
                ${data.analogs && data.analogs.length > 0 ? `
                    <div class="mb-6">
                        <h4 class="font-medium text-slate-700 mb-3">📊 Аналоги (${data.analogs.length})</h4>
                        <div class="space-y-2">
                            ${data.analogs.map(analog => `
                                <div class="p-3 bg-slate-50 rounded-xl">
                                    <div class="flex justify-between items-start">
                                        <div><div class="font-medium">${analog.name}</div><div class="text-xs text-slate-500">${analog.area} м² | ${analog.build_year}</div></div>
                                        <div class="font-bold text-emerald-600">${new Intl.NumberFormat('ru-RU').format(analog.price_per_sqm)} ₽/м²</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
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
        const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Отчет об оценке</title></head><body style="margin:2cm"><h1>Отчет об оценке недвижимости</h1><p>Дата: ${new Date().toLocaleDateString()}</p><h2>Стоимость: ${new Intl.NumberFormat('ru-RU').format(this.result.predicted.price_total)} ₽</h2><p>Цена за м²: ${new Intl.NumberFormat('ru-RU').format(this.result.predicted.price_per_sqm)} ₽</p></body></html>`;
        const blob = new Blob([content], { type: 'application/msword' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Отчет_${new Date().toISOString().split('T')[0]}.doc`;
        link.click();
    }
    
    resetResult() {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        if (placeholder) placeholder.style.display = 'flex';
        if (content) content.style.display = 'none';
        this.result = null;
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
