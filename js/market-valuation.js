// js/market-valuation.js - ФИНАЛЬНАЯ ВЕРСИЯ (ВРИ ввод + выбор)
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
            <div class="max-w-4xl mx-auto p-5">
                <div class="mb-5">
                    <h2 class="text-xl font-bold text-slate-900">Рыночная оценка недвижимости ЯНАО</h2>
                    <p class="text-slate-500 text-sm">CatBoost ML | 2500+ сделок | 6 моделей | 22 города</p>
                </div>
                
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- ФОРМА -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div class="px-5 py-3 bg-slate-50 border-b border-slate-200 rounded-t-xl">
                            <h3 class="font-semibold text-slate-800">📋 Параметры объекта</h3>
                        </div>
                        
                        <form id="valuationForm" class="p-5 space-y-4">
                            <!-- Тип объекта -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Тип объекта *</label>
                                <select id="objectType" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="Помещение">🚪 Помещение</option>
                                    <option value="Здание">🏢 Здание</option>
                                    <option value="Земельный участок">🌾 Земельный участок</option>
                                    <option value="Сооружение">🏗️ Сооружение</option>
                                    <option value="Машино-место">🅿️ Машино-место</option>
                                    <option value="Объект незавершённого строительства">🏚️ Объект незавершённого строительства</option>
                                </select>
                            </div>
                            
                            <!-- Площадь -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Площадь, м² *</label>
                                <input type="number" id="area" step="0.1" min="1" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Например: 100">
                            </div>
                            
                            <!-- БЛОК ДЛЯ ЗДАНИЙ И ПОМЕЩЕНИЙ -->
                            <div id="oksFields">
                                <div class="space-y-4">
                                    <div>
                                        <label class="block text-sm font-medium text-slate-700 mb-1">Наименование</label>
                                        <input type="text" id="objectName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Квартира, Магазин, Офис, Склад, Гараж...">
                                        <p class="text-xs text-slate-400 mt-1">Влияет на точность: жилое, торговое, склад и т.д.</p>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Год постройки</label>
                                            <input type="number" id="buildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015" min="1900" max="2025">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Материал стен</label>
                                            <select id="wallMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                <option value="">Не указан</option>
                                                <option value="Кирпич">Кирпич</option>
                                                <option value="Панель">Панель</option>
                                                <option value="Монолит">Монолит</option>
                                                <option value="Блок">Блок</option>
                                                <option value="Дерево">Дерево</option>
                                                <option value="Смешанный">Смешанный</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- БЛОК ДЛЯ ЗЕМЛИ -->
                            <div id="landFields" style="display: none;">
                                <div>
                                    <label class="block text-sm font-medium text-slate-700 mb-1">
                                        Вид разрешенного использования (ВРИ)
                                    </label>
                                    <!-- 🔥 ВВОД ВРУЧНУЮ -->
                                    <input type="text" id="permittedUseInput" 
                                           class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                           placeholder="Например: для индивидуального жилищного строительства">
                                    <p class="text-xs text-slate-400 mt-1">Введите ВРИ или выберите из списка ниже</p>
                                    
                                    <!-- 🔥 ИЛИ ВЫБОР ИЗ СПИСКА -->
                                    <select id="permittedUseSelect" 
                                            class="w-full px-3 py-2 border border-slate-300 rounded-lg mt-2"
                                            onchange="document.getElementById('permittedUseInput').value = this.value">
                                        <option value="">— Выбрать из списка —</option>
                                        <optgroup label="🏠 Жильё">
                                            <option value="для индивидуального жилищного строительства">ИЖС</option>
                                            <option value="для ведения личного подсобного хозяйства">ЛПХ</option>
                                            <option value="блокированная жилая застройка">Блокированная жилая застройка</option>
                                            <option value="малоэтажная жилая застройка">Малоэтажная жилая застройка</option>
                                        </optgroup>
                                        <optgroup label="🌿 Сад / Огород / Дача">
                                            <option value="для садоводства">Садоводство</option>
                                            <option value="для огородничества">Огородничество</option>
                                            <option value="для дачного строительства">Дачное строительство</option>
                                            <option value="ведение садоводства">Ведение садоводства</option>
                                        </optgroup>
                                        <optgroup label="🏪 Коммерция">
                                            <option value="для строительства магазина">Магазин</option>
                                            <option value="для размещения офиса">Офис</option>
                                            <option value="для размещения торгового центра">Торговый центр</option>
                                            <option value="для размещения кафе">Кафе</option>
                                            <option value="для размещения гостиницы">Гостиница</option>
                                        </optgroup>
                                        <optgroup label="📦 Склад">
                                            <option value="для размещения склада">Склад</option>
                                            <option value="склады">Склады</option>
                                        </optgroup>
                                        <optgroup label="🚗 Гараж / Автостоянка">
                                            <option value="для размещения гаража">Гараж</option>
                                            <option value="для размещения автостоянки">Автостоянка</option>
                                            <option value="хранение автотранспорта">Хранение автотранспорта</option>
                                        </optgroup>
                                        <optgroup label="🏭 Производство">
                                            <option value="для производственной деятельности">Производство</option>
                                            <option value="для сельскохозяйственного производства">Сельхозпроизводство</option>
                                        </optgroup>
                                        <optgroup label="🏢 Административное">
                                            <option value="для размещения административного здания">Административное</option>
                                            <option value="деловое управление">Деловое управление</option>
                                        </optgroup>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- БЛОК ДЛЯ СООРУЖЕНИЙ -->
                            <div id="structureFields" style="display: none;">
                                <div class="space-y-4">
                                    <div>
                                        <label class="block text-sm font-medium text-slate-700 mb-1">Наименование</label>
                                        <input type="text" id="structureName" class="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Трубопровод, Эстакада, Котельная...">
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Год постройки</label>
                                            <input type="number" id="structureBuildYear" class="w-full px-3 py-2 border border-slate-300 rounded-lg" value="2015" min="1900" max="2025">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-slate-700 mb-1">Материал</label>
                                            <select id="structureMaterial" class="w-full px-3 py-2 border border-slate-300 rounded-lg">
                                                <option value="">Не указан</option>
                                                <option value="Кирпич">Кирпич</option>
                                                <option value="Панель">Панель</option>
                                                <option value="Монолит">Монолит</option>
                                                <option value="Блок">Блок</option>
                                                <option value="Дерево">Дерево</option>
                                                <option value="Смешанный">Смешанный</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Город -->
                            <div>
                                <label class="block text-sm font-medium text-slate-700 mb-1">Муниципальное образование *</label>
                                <select id="city" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                    <option value="">Выберите город или район...</option>
                                    <optgroup label="Города">
                                        <option value="Салехард">Салехард</option>
                                        <option value="Ноябрьск">Ноябрьск</option>
                                        <option value="Новый Уренгой">Новый Уренгой</option>
                                        <option value="Надым">Надым</option>
                                        <option value="Губкинский">Губкинский</option>
                                        <option value="Муравленко">Муравленко</option>
                                        <option value="Лабытнанги">Лабытнанги</option>
                                    </optgroup>
                                    <optgroup label="Районы">
                                        <option value="Тарко-Сале">Пуровский район (Тарко-Сале)</option>
                                        <option value="Тазовский">Тазовский район</option>
                                        <option value="Яр-Сале">Ямальский район (Яр-Сале)</option>
                                        <option value="Красноселькуп">Красноселькупский район</option>
                                        <option value="Мужи">Шурышкарский район (Мужи)</option>
                                        <option value="Аксарка">Приуральский район (Аксарка)</option>
                                    </optgroup>
                                </select>
                            </div>
                            
                            <!-- Кнопка -->
                            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                🔍 Рассчитать стоимость
                            </button>
                        </form>
                    </div>
                    
                    <!-- РЕЗУЛЬТАТ -->
                    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div id="resultPlaceholder" class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div class="text-6xl mb-4">🏠</div>
                            <p class="text-slate-500 text-lg">Заполните форму и нажмите</p>
                            <p class="text-slate-400 text-sm">«Рассчитать стоимость»</p>
                            <div class="mt-4 text-xs text-slate-400">
                                <p>✅ 6 моделей CatBoost</p>
                                <p>✅ 22 города ЯНАО</p>
                                <p>✅ 2500+ реальных сделок</p>
                            </div>
                        </div>
                        <div id="resultContent" style="display: none;"></div>
                        <div id="resultLoading" style="display: none;" class="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                            <div class="animate-spin text-4xl mb-4">⏳</div>
                            <p class="text-slate-500">Рассчитываем...</p>
                        </div>
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
                const type = objectType.value;
                const isLand = type === 'Земельный участок';
                const isMachine = type === 'Машино-место';
                const isOns = type === 'Объект незавершённого строительства';
                const isBuilding = type === 'Здание' || type === 'Помещение';
                const isStructure = type === 'Сооружение';
                
                document.getElementById('oksFields').style.display = 'none';
                document.getElementById('landFields').style.display = 'none';
                document.getElementById('structureFields').style.display = 'none';
                
                if (isBuilding) {
                    document.getElementById('oksFields').style.display = 'block';
                } else if (isLand) {
                    document.getElementById('landFields').style.display = 'block';
                } else if (isStructure) {
                    document.getElementById('structureFields').style.display = 'block';
                }
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
        
        const objectType = document.getElementById('objectType')?.value || 'Помещение';
        const isLand = objectType === 'Земельный участок';
        const isMachine = objectType === 'Машино-место';
        const isOns = objectType === 'Объект незавершённого строительства';
        const isStructure = objectType === 'Сооружение';
        
        const area = parseFloat(document.getElementById('area')?.value || 0);
        const city = document.getElementById('city')?.value || '';
        
        if (!area || area <= 0) {
            this.showNotification('Введите площадь объекта', 'error');
            return;
        }
        if (area > 100000) {
            this.showNotification('Площадь не может превышать 100 000 м²', 'error');
            return;
        }
        if (!city) {
            this.showNotification('Выберите муниципальное образование', 'error');
            return;
        }
        
        let build_year = 2015;
        let name = '';
        let wall_material = '';
        let permitted_use = '';
        
        if (isLand) {
            // 🔥 ВРИ: сначала из поля ввода, если пусто — из select
            permitted_use = document.getElementById('permittedUseInput')?.value || 
                           document.getElementById('permittedUseSelect')?.value || '';
            build_year = 2024;
        } else if (isMachine || isOns) {
            build_year = 2024;
            name = objectType === 'Машино-место' ? 'Машино-место' : 'Объект незавершённого строительства';
        } else if (isStructure) {
            build_year = parseInt(document.getElementById('structureBuildYear')?.value || 2015);
            name = document.getElementById('structureName')?.value || 'Сооружение';
            wall_material = document.getElementById('structureMaterial')?.value || '';
        } else {
            build_year = parseInt(document.getElementById('buildYear')?.value || 2015);
            name = document.getElementById('objectName')?.value || objectType;
            wall_material = document.getElementById('wallMaterial')?.value || '';
        }
        
        if (build_year < 1900 || build_year > 2025) {
            this.showNotification('Год постройки должен быть 1900-2025', 'error');
            return;
        }
        
        const formData = {
            area: area,
            build_year: build_year,
            object_type: objectType,
            permitted_use: permitted_use,
            address: city,
            kadastr: '',
            wall_material: wall_material,
            name: name
        };
        
        this.setLoading(true);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch('https://markmolchanov98.pythonanywhere.com/api/index', {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ args: Object.values(formData) }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);
            
            const result = await response.json();
            
            if (result.predicted && result.predicted.price_per_sqm > 0) {
                this.displayResult(result, formData);
                this.showNotification('✅ Оценка выполнена успешно', 'success');
            } else {
                throw new Error('Некорректный ответ сервера');
            }
            
        } catch (error) {
            console.error('Ошибка:', error);
            if (error.name === 'AbortError') {
                this.showNotification('Превышено время ожидания. Используем резервный расчёт', 'error');
            } else {
                this.showNotification('Ошибка сервера. Используем резервный расчёт', 'error');
            }
            this.useFallbackCalculation(formData);
        } finally {
            this.setLoading(false);
        }
    }
    
    useFallbackCalculation(formData) {
        const basePrice = 45000;
        const typeFactors = { 
            "Помещение": 1.1, "Здание": 1.0, "Земельный участок": 0.5, 
            "Сооружение": 0.85, "Машино-место": 0.7, "Объект незавершённого строительства": 0.6 
        };
        const materialFactors = {
            "Кирпич": 1.0, "Монолит": 1.09, "Панель": 1.07,
            "Смешанный": 1.04, "Блок": 1.32, "Дерево": 0.86, "": 1.0
        };
        
        const typeFactor = typeFactors[formData.object_type] || 1.0;
        const materialFactor = materialFactors[formData.wall_material] || 1.0;
        const pricePerSqm = Math.round(basePrice * typeFactor * materialFactor / 100) * 100;
        
        this.displayResult({
            predicted: { price_per_sqm: pricePerSqm, price_total: pricePerSqm * formData.area },
            calculation: { ml_prediction: pricePerSqm, corrected_ml: pricePerSqm, analogs_count: 0 }
        }, formData);
    }
    
    displayResult(data, formData = null) {
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        const loading = document.getElementById('resultLoading');
        
        placeholder.style.display = 'none';
        loading.style.display = 'none';
        content.style.display = 'block';
        
        const formatPrice = (price) => {
            if (price >= 1000000000) return `${(price / 1000000000).toFixed(2)} млрд ₽`;
            if (price >= 1000000) return `${(price / 1000000).toFixed(2)} млн ₽`;
            if (price >= 1000) return `${(price / 1000).toFixed(0)} тыс. ₽`;
            return `${price} ₽`;
        };
        
        const priceSqm = data.predicted.price_per_sqm;
        const priceTotal = data.predicted.price_total;
        const analogsCount = data.calculation?.analogs_count || 0;
        
        content.innerHTML = `
            <div class="p-5">
                <div class="text-center mb-5">
                    <div class="text-sm text-slate-500 mb-1">Рыночная стоимость</div>
                    <div class="text-3xl font-bold text-slate-900">${formatPrice(priceTotal)}</div>
                    <div class="text-sm text-slate-500 mt-1">
                        ${new Intl.NumberFormat('ru-RU').format(priceSqm)} ₽/м²
                    </div>
                    ${analogsCount > 0 ? `
                        <div class="text-xs text-slate-400 mt-2">На основе ${analogsCount} аналогов</div>
                    ` : ''}
                </div>
                ${formData ? `
                <div class="bg-slate-50 rounded-lg p-3 mb-4 text-xs text-slate-500">
                    <div class="grid grid-cols-2 gap-2">
                        <div>Тип: <span class="text-slate-700">${formData.object_type}</span></div>
                        <div>Площадь: <span class="text-slate-700">${formData.area} м²</span></div>
                        ${formData.wall_material ? `<div>Материал: <span class="text-slate-700">${formData.wall_material}</span></div>` : ''}
                        ${formData.build_year ? `<div>Год: <span class="text-slate-700">${formData.build_year}</span></div>` : ''}
                        ${formData.permitted_use ? `<div class="col-span-2">ВРИ: <span class="text-slate-700">${formData.permitted_use}</span></div>` : ''}
                        <div>Город: <span class="text-slate-700">${formData.address}</span></div>
                    </div>
                </div>
                ` : ''}
                <div class="border-t pt-4 space-y-2">
                    <button onclick="window.marketValuationApp.resetResult()" class="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                        🔄 Новая оценка
                    </button>
                    <button onclick="window.marketValuationApp.exportResult()" class="w-full py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
                        📋 Копировать результат
                    </button>
                </div>
            </div>
        `;
        this.result = data;
    }
    
    resetResult() {
        document.getElementById('resultPlaceholder').style.display = 'flex';
        document.getElementById('resultContent').style.display = 'none';
        this.result = null;
    }
    
    exportResult() {
        if (!this.result) return;
        const text = `Рыночная стоимость: ${new Intl.NumberFormat('ru-RU').format(this.result.predicted.price_total)} ₽\n` +
                     `Цена за м²: ${new Intl.NumberFormat('ru-RU').format(this.result.predicted.price_per_sqm)} ₽/м²`;
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('📋 Результат скопирован!', 'success');
        });
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        const btn = document.querySelector('#valuationForm button[type="submit"]');
        const loadingDiv = document.getElementById('resultLoading');
        const placeholder = document.getElementById('resultPlaceholder');
        const content = document.getElementById('resultContent');
        
        if (btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? '⏳ Рассчитываем...' : '🔍 Рассчитать стоимость';
        }
        
        if (loading) {
            placeholder.style.display = 'none';
            content.style.display = 'none';
            loadingDiv.style.display = 'flex';
        }
    }
    
    showNotification(message, type = 'info') {
        const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6' };
        const emoji = { success: '✅', error: '❌', info: 'ℹ️' };
        const div = document.createElement('div');
        div.className = 'fixed bottom-6 right-6 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2 animate-slide-up';
        div.style.backgroundColor = colors[type];
        div.innerHTML = `${emoji[type]} ${message}<button onclick="this.parentElement.remove()" class="ml-3 text-white/80 hover:text-white">×</button>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 4000);
    }
}

window.initMarketValuation = function(containerId) {
    if (window.marketValuationApp) return;
    window.marketValuationApp = new MarketValuationApp(containerId);
};
