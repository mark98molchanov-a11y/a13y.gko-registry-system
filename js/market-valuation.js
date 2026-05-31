// js/market-valuation.js - МИНИМАЛИСТИЧНАЯ ВЕРСИЯ
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
            <div class="max-w-4xl mx-auto p-6">
                <div class="mb-6">
                    <h2 class="text-xl font-bold text-slate-900">Рыночная оценка недвижимости</h2>
                    <p class="text-slate-500 text-sm">CatBoost ML-модель</p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Форма -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200">
                            <h3 class="font-semibold text-slate-800">Параметры объекта</h3>
                        </div>
                        
                        <form id="valuationForm" class="p-5 space-y-4">
                            <!-- Тип объекта -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Тип объекта *</label>
                                <select id="objectType" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                    <option value="Здание">🏢 Здание</option>
                                    <option value="Помещение">🚪 Помещение</option>
                                    <option value="Земельный участок">🌾 Земельный участок</option>
                                </select>
                            </div>
                            
                            <!-- Площадь -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Площадь, м² *</label>
                                <input type="number" id="area" step="0.1" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                            </div>
                            
                            <!-- Блок для ОКС (здания/помещения) -->
                            <div id="oksFields">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">Год постройки</label>
                                    <input type="number" id="buildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">Тип объекта (наименование)</label>
                                    <input type="text" id="objectName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Гараж, Магазин, Склад, Квартира...">
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">Материал стен</label>
                                    <select id="wallMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                        <option value="">Не указан</option>
                                        <option value="Кирпич">Кирпич</option>
                                        <option value="Панель">Панель</option>
                                        <option value="Монолит">Монолит</option>
                                        <option value="Дерево">Дерево</option>
                                        <option value="Блок">Блок</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Блок для земли -->
                            <div id="landFields" style="display: none;">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">Вид разрешенного использования (ВРИ)</label>
                                    <input type="text" id="permittedUse" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="ИЖС, гараж, садоводство...">
                                </div>
                            </div>
                            
                            <!-- Город (обязателен) -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Город *</label>
                                <input type="text" id="address" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ноябрьск, Салехард, Новый Уренгой...">
                            </div>
                            
                            <button type="submit" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-medium py-2.5 px-4 rounded-lg transition">
                                Рассчитать стоимость
                            </button>
                        </form>
                    </div>
                    
                    <!-- Результат -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div id="resultPlaceholder" class="p-8 text-center">
                            <div class="text-4xl mb-2">🏠</div>
                            <p class="text-slate-500">Заполните форму и нажмите "Рассчитать"</p>
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
        
        if (objectType) {
            objectType.addEventListener('change', () => {
                const isLand = objectType.value === 'Земельный участок';
                const oksFields = document.getElementById('oksFields');
                const landFields = document.getElementById('landFields');
                
                if (oksFields) oksFields.style.display = isLand ? 'none' : 'block';
                if (landFields) landFields.style.display = isLand ? 'block' : 'none';
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
    
    async submitForm() {
        if (this.isLoading) return;
        
        const objectType = document.getElementById('objectType')?.value || 'Здание';
        const isLand = objectType === 'Земельный участок';
        const area = parseFloat(document.getElementById('area')?.value || 0);
        const address = document.getElementById('address')?.value || '';
        
        if (!area || area <= 0) {
            this.showNotification('Введите площадь', 'error');
            return;
        }
        
        if (!address) {
            this.showNotification('Введите город', 'error');
            return;
        }
        
        const formData = {
            area: area,
            build_year: parseInt(document.getElementById('buildYear')?.value || 2015),
            object_type: objectType,
            permitted_use: document.getElementById('permittedUse')?.value || '',
            address: address,
            kadastr: '',
            wall_material: document.getElementById('wallMaterial')?.value || '',
            name: document.getElementById('objectName')?.value || ''
        };
        
        this.setLoading(true);
        
        try {
            const response = await fetch('https://markmolchanov98.pythonanywhere.com/api/index', {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
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
            
            if (!response.ok) throw new Error(`Ошибка ${response.status}`);
            
            const result = await response.json();
            this.displayResult(result);
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка сервера', 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    displayResult(data) {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        
        if (placeholder) placeholder.style.display = 'none';
        if (content) content.style.display = 'block';
        
        const formatPrice = (price) => {
            if (price >= 1000000) return `${(price / 1000000).toFixed(2)} млн ₽`;
            if (price >= 1000) return `${(price / 1000).toFixed(0)} тыс. ₽`;
            return `${price} ₽`;
        };
        
        content.innerHTML = `
            <div class="p-5">
                <div class="text-center mb-5">
                    <div class="text-sm text-slate-500">Рыночная стоимость</div>
                    <div class="text-3xl font-bold text-slate-900">${formatPrice(data.predicted.price_total)}</div>
                    <div class="text-sm text-slate-500 mt-1">${new Intl.NumberFormat('ru-RU').format(data.predicted.price_per_sqm)} ₽/м²</div>
                </div>
                
                <div class="border-t pt-4 mt-2">
                    <button onclick="window.marketValuationApp.resetResult()" class="w-full py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                        Новая оценка
                    </button>
                </div>
            </div>
        `;
        
        this.result = data;
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
            btn.innerHTML = loading ? 'Расчет...' : 'Рассчитать стоимость';
        }
    }
    
    showNotification(message, type = 'info') {
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
        const div = document.createElement('div');
        div.className = `fixed bottom-6 right-6 text-white px-4 py-2 rounded-lg shadow-lg z-50`;
        div.style.backgroundColor = colors[type];
        div.innerHTML = `${message}<button onclick="this.parentElement.remove()" class="ml-3">×</button>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

window.initMarketValuation = function(containerId) {
    if (window.marketValuationApp) return;
    window.marketValuationApp = new MarketValuationApp(containerId);
};
