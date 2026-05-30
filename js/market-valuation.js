// js/market-valuation.js - СЕРВЕРНАЯ ВЕРСИЯ (вызывает /api/predict)

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
                            <p class="text-slate-500 text-sm">CatBoost ML-модель | Поиск аналогов из базы сделок</p>
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
                                    <p class="text-xs text-slate-400 mt-1">Для земельных участков игнорируется</p>
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
        if (this.isLoading) return;
        
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
        
        this.setLoading(true);
        this.showNotification('🧠 Выполняется оценка на CatBoost...', 'info');
        
      try {
    const response = await fetch('https://markmolchanov98.pythonanywhere.com/api/index', {
        method: 'POST',
        mode: 'cors',
        headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            args: [
                formData.area,
                formData.build_year,
                formData.object_type,
                formData.permitted_use,
                formData.address,
                formData.kadastr,
                formData.wall_material,
                formData.name
            ]
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('API ответ:', result);
    this.displayResult(result);
    this.showNotification('✅ Оценка выполнена!', 'success');
    
} catch (error) {
    console.error('Ошибка:', error);
    this.showNotification(`Ошибка: ${error.message}`, 'error');
    this.useFallbackCalculation(formData);
} finally {
    this.setLoading(false);
}
    
    useFallbackCalculation(formData) {
        const basePrice = 45000;
        const typeFactors = { "Здание": 1.0, "Помещение": 1.1, "Сооружение": 0.85, "Земельный участок": 0.5 };
        const pricePerSqm = Math.round(basePrice * (typeFactors[formData.object_type] || 1.0) / 100) * 100;
        
        this.displayResult({
            predicted: { price_per_sqm: pricePerSqm, price_total: pricePerSqm * formData.area },
            calculation: { analogs_count: 0 },
            justification: "⚠️ Резервный расчет (сервер недоступен). Использованы базовые коэффициенты.",
            analogs: []
        });
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
                    <div class="text-4xl font-bold text-slate-900 mb-1">
                        ${new Intl.NumberFormat('ru-RU').format(data.predicted.price_total)} ₽
                    </div>
                    <div class="text-sm text-slate-500">
                        ${new Intl.NumberFormat('ru-RU').format(data.predicted.price_per_sqm)} ₽/м²
                    </div>
                    <div class="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-white/50 rounded-full text-xs text-slate-500">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        ${data.calculation.analogs_count || 0} аналогов
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
                                            <div class="font-medium">${analog.name || 'Объект'}</div>
                                            <div class="text-xs text-slate-500">${analog.area} м² | ${analog.build_year || '—'}</div>
                                        </div>
                                        <div class="text-right">
                                            <div class="font-bold text-emerald-600">${new Intl.NumberFormat('ru-RU').format(analog.price_per_sqm)} ₽/м²</div>
                                        </div>
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
