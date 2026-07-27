// ============================================================
// ИНТЕГРАЦИЯ С НСПД - ТОЛЬКО ДАННЫЕ (БЕЗ КАРТЫ)
// ============================================================

class NSPDIntegration {
    constructor() {
        this.config = window.NSPD_CONFIG || {};
        this.cache = new Map();
        this.currentResult = null;
        this.isLoading = false;
        this.initialized = false;
        this.baseUrl = 'https://nspd.gov.ru/api/geoportal/v2/search/geoportal';
        this._initAttempts = 0;
        this._maxInitAttempts = 20;
        console.log('NSPDIntegration: конструктор вызван');
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    
    init() {
        console.log('NSPD Integration инициализируется...');
        
        if (this.initialized) {
            console.log('НСПД уже инициализирована');
            return this;
        }
        
        // ✅ ОГРАНИЧИВАЕМ КОЛИЧЕСТВО ПОПЫТОК
        this._initAttempts++;
        if (this._initAttempts > this._maxInitAttempts) {
            console.warn('⚠️ Превышено количество попыток инициализации НСПД');
            this.initialized = true;
            return this;
        }
        
        // ✅ ПРОВЕРЯЕМ, ЧТО КАРТА СОЗДАНА
        if (typeof mapInstance === 'undefined' || !mapInstance) {
            console.log(`⏳ Карта ещё не создана, ждём... (попытка ${this._initAttempts}/${this._maxInitAttempts})`);
            setTimeout(() => this.init(), 500);
            return this;
        }
        
        // ❌ НЕ СОЗДАЁМ ПАНЕЛЬ — ОНА УЖЕ ЕСТЬ В HTML
        // this.addPanel();
        
        this.setupEventListeners();
        this.initialized = true;
        console.log('НСПД Integration готова к работе (только данные)');
        return this;
    }

    // ============================================================
    // ДОБАВЛЕНИЕ ПАНЕЛИ (НЕ ИСПОЛЬЗУЕТСЯ)
    // ============================================================
    
    addPanel() {
        console.log('ℹ️ addPanel() не используется — панель уже есть в HTML');
        return;
    }

    // ============================================================
    // ПОИСК ПО КАДАСТРОВОМУ НОМЕРУ
    // ============================================================
    
    async search() {
        console.log('Поиск запущен');
        const input = document.getElementById('cadSearchInput');
        if (!input) {
            console.warn('Поле cadSearchInput не найдено в HTML');
            this.showError('Поле поиска не найдено. Обновите страницу.');
            return;
        }
        
        const cadNumber = input.value.trim();
        if (!cadNumber) {
            this.showError('Введите кадастровый номер');
            return;
        }

        const cached = this.getFromCache(cadNumber);
        if (cached) {
            this.currentResult = cached;
            this.displayResult(cached);
            return;
        }

        this.showLoading();

        try {
            const response = await this.makeRequest(cadNumber);
            
            if (response && response.error) {
                this.showError(response.error);
                return;
            }

            if (!response || !response.cadastral_number) {
                this.showError('Объект с таким номером не найден');
                return;
            }

            this.saveToCache(cadNumber, response);
            this.currentResult = response;
            this.displayResult(response);
            
            this.showNotification('Объект найден в НСПД', 'success');

        } catch (error) {
            console.error('Ошибка запроса к НСПД:', error);
            this.showError('Не удалось получить данные. Проверьте номер или попробуйте позже.');
        }
    }

    // ============================================================
    // ЗАПРОС К НСПД
    // ============================================================
    
    async makeRequest(cadNumber) {
        const url = `${this.baseUrl}?thematicSearchId=1&query=${encodeURIComponent(cadNumber)}&limit=10&offset=0&geometry=true`;
        
        console.log(`Запрос к НСПД: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    const errorData = await response.json();
                    if (errorData.code === 204) {
                        return { error: 'Объект не найден в НСПД' };
                    }
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Ответ от НСПД:', data);
            
            return this.normalizeResponse(data);

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания ответа от НСПД');
            }
            throw error;
        }
    }

    // ============================================================
    // НОРМАЛИЗАЦИЯ ОТВЕТА — ВСЕ ПОЛЯ
    // ============================================================
    
    normalizeResponse(data) {
        if (!data || !data.data || !data.data.features || data.data.features.length === 0) {
            return { error: 'Объект не найден' };
        }

        const feature = data.data.features[0];
        const props = feature.properties || {};
        const options = props.options || {};
        
        // ВСЕ ДАННЫЕ ИЗ ОТВЕТА
        return {
            // Основные
            cadastral_number: options.cad_number || props.externalKey || '',
            object_type: options.object_type_value || props.categoryName || '',
            status: options.status || '',
            ownership_type: options.ownership_type || '',
            object_name: options.params_name || '',
            purpose: options.params_purpose || '',
            
            // Адрес
            address: options.address_readable_address || '',
            quarter_cad_number: options.quarter_cad_number || '',
            
            // Стоимость
            area: parseFloat(options.params_area) || 0,
            cadastral_value: parseFloat(options.cost_value) || 0,
            cadastral_index: parseFloat(options.cost_index) || 0,
            
            // Характеристики
            year_built: options.params_year_built || '',
            cost_determination_date: options.cost_determination_date || '',
            registration_date: options.registration_date || '',
            cost_application_date: options.cost_application_date || '',
            cost_registration_date: options.cost_registration_date || '',
            
            // Параметры объекта
            params_extension: options.params_extension || 0,
            params_volume: options.params_volume || 0,
            params_height: options.params_height || 0,
            params_depth: options.params_depth || 0,
            params_floors: options.params_floors || '',
            params_built_up_area: options.params_built_up_area || 0,
            
            // Документы
            determination_couse: options.determination_couse || '',
            cultural_heritage_val: options.cultural_heritage_val || '',
            
            // Системные
            interactionId: props.interactionId || '',
            category: props.category || '',
            categoryName: props.categoryName || '',
            subcategory: props.subcategory || '',
            descr: props.descr || '',
            externalKey: props.externalKey || '',
            label: props.label || '',
            
            // Системная информация
            systemInfo: props.systemInfo || {},
            
            // Геометрия (для информации, но не отображаем)
            hasGeometry: !!feature.geometry,
            
            // Сырые данные
            raw: data
        };
    }

    // ============================================================
    // КЭШИРОВАНИЕ
    // ============================================================
    
    getFromCache(cadNumber) {
        const key = cadNumber.trim();
        const cached = this.cache.get(key);
        
        if (cached) {
            const now = Date.now();
            const ttl = (this.config.CACHE_TTL || 60) * 60 * 1000;
            
            if (now - cached.timestamp < ttl) {
                console.log(`Данные из кэша для ${key}`);
                return cached.data;
            }
            this.cache.delete(key);
        }
        
        return null;
    }

    saveToCache(cadNumber, data) {
        const key = cadNumber.trim();
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        console.log(`Данные сохранены в кэш для ${key}`);
    }

    // ============================================================
    // UI: ОТОБРАЖЕНИЕ ВСЕХ ДАННЫХ
    // ============================================================
    
    displayResult(data) {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;

        const formatPrice = (num) => {
            if (!num || num === 0) return '—';
            return num.toLocaleString('ru-RU') + ' ₽';
        };

        const formatDate = (date) => {
            if (!date) return '—';
            const d = new Date(date);
            return d.toLocaleDateString('ru-RU');
        };

        // ✅ ВСЕ ПОЛЯ, КОТОРЫЕ ЕСТЬ В ДАННЫХ
        const fields = [
            // Основные
            { label: 'Кадастровый номер', value: data.cadastral_number, important: true },
            { label: 'Тип объекта', value: data.object_type },
            { label: 'Статус', value: data.status },
            { label: 'Форма собственности', value: data.ownership_type },
            { label: 'Наименование', value: data.object_name, important: true },
            { label: 'Назначение', value: data.purpose },
            
            // Адрес
            { label: 'Адрес', value: data.address, important: true },
            { label: 'Кадастровый квартал', value: data.quarter_cad_number },
            
            // Стоимость
            { label: 'Кадастровая стоимость', value: data.cadastral_value > 0 ? formatPrice(data.cadastral_value) : null, important: true },
            { label: 'УПКС', value: data.cadastral_index > 0 ? data.cadastral_index.toFixed(2) + ' ₽/м²' : null },
            { label: 'Площадь', value: data.area > 0 ? data.area.toFixed(1) + ' м²' : null },
            
            // Характеристики
            { label: 'Год постройки', value: data.year_built },
            { label: 'Дата определения стоимости', value: data.cost_determination_date ? formatDate(data.cost_determination_date) : null },
            { label: 'Дата регистрации', value: data.registration_date ? formatDate(data.registration_date) : null },
            { label: 'Дата применения стоимости', value: data.cost_application_date ? formatDate(data.cost_application_date) : null },
            
            // Параметры
            { label: 'Протяженность', value: data.params_extension > 0 ? data.params_extension + ' м' : null },
            { label: 'Объем', value: data.params_volume > 0 ? data.params_volume + ' м³' : null },
            { label: 'Высота', value: data.params_height > 0 ? data.params_height + ' м' : null },
            { label: 'Глубина', value: data.params_depth > 0 ? data.params_depth + ' м' : null },
            { label: 'Этажность', value: data.params_floors || null },
            { label: 'Площадь застройки', value: data.params_built_up_area > 0 ? data.params_built_up_area + ' м²' : null },
            
            // Документы
            { label: 'Основание оценки', value: data.determination_couse ? data.determination_couse.replace(/\n/g, ' ').trim() : null },
            { label: 'Объект культурного наследия', value: data.cultural_heritage_val || null },
            
            // Системные
            { label: 'Категория', value: data.categoryName || data.category || null },
            { label: 'ID объекта', value: data.interactionId || null },
        ];

        // Фильтруем только поля с непустыми значениями
        const visibleFields = fields.filter(f => f.value && f.value !== '—' && f.value !== null && f.value !== '');

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 14px 16px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                max-height: 500px;
                overflow-y: auto;
                font-family: 'Inter', sans-serif;
            ">
                <!-- Заголовок -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1;">
                    <span style="font-weight: 600; font-size: 13px; color: #1e293b;">Данные из НСПД</span>
                    <span style="font-size: 10px; color: #10b981; background: #dcfce7; padding: 2px 12px; border-radius: 20px; font-weight: 500;">
                        Найден
                    </span>
                </div>
                
                <!-- Все поля в две колонки -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; font-size: 12px;">
                    ${visibleFields.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f8fafc; ${item.important ? 'background: #f8fafc; border-radius: 4px;' : ''}">
                            <span style="color: #64748b; font-weight: 500; font-size: 11px; white-space: nowrap;">${item.label}:</span>
                            <span style="color: #1e293b; text-align: right; word-break: break-word; font-size: 11px; max-width: 60%; ${item.important ? 'font-weight: 600;' : ''}">${item.value}</span>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Кнопки -->
                <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                    <button onclick="nspdApp.copyData()" 
                            style="padding: 5px 14px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s;">
                        Копировать
                    </button>
                    <button onclick="nspdApp.clear()" 
                            style="padding: 5px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.2s;">
                        Очистить
                    </button>
                    <a href="https://nspd.gov.ru/map?text=${encodeURIComponent(data.cadastral_number)}" target="_blank" 
                       style="padding: 5px 14px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11px; text-decoration: none; font-weight: 500; transition: all 0.2s;">
                        Открыть в НСПД
                    </a>
                </div>
                
                <!-- ID и дата обновления -->
                <div style="margin-top: 8px; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; display: flex; justify-content: space-between;">
                    <span>ID: ${data.interactionId || '—'}</span>
                    <span>Обновлено: ${data.systemInfo?.updated ? new Date(data.systemInfo.updated).toLocaleString('ru-RU') : '—'}</span>
                </div>
            </div>
        `;
    }

    // ============================================================
    // UI: СОСТОЯНИЯ
    // ============================================================
    
    showLoading() {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="text-align: center; padding: 12px; color: #94a3b8; font-size: 13px;">
                <span class="animate-spin" style="display:inline-block; margin-right:8px;">⏳</span>
                Поиск в НСПД...
            </div>
        `;
    }

    showError(message) {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 10px 12px;
                color: #dc2626;
                font-size: 12px;
            ">
                ${message}
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        document.querySelectorAll('.nspd-notification').forEach(el => el.remove());

        const notification = document.createElement('div');
        notification.className = 'nspd-notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 13px;
            z-index: 10000;
            max-width: 400px;
            animation: nspdSlideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================================
    
    copyData() {
        const data = this.currentResult;
        if (!data) {
            this.showNotification('Нет данных для копирования', 'warning');
            return;
        }

        const fields = {
            'Кадастровый номер': data.cadastral_number,
            'Тип объекта': data.object_type,
            'Статус': data.status,
            'Форма собственности': data.ownership_type,
            'Наименование': data.object_name,
            'Назначение': data.purpose,
            'Адрес': data.address,
            'Кадастровый квартал': data.quarter_cad_number,
            'Площадь': data.area > 0 ? data.area.toFixed(1) + ' м²' : null,
            'Кадастровая стоимость': data.cadastral_value > 0 ? data.cadastral_value.toLocaleString() + ' ₽' : null,
            'УПКС': data.cadastral_index > 0 ? data.cadastral_index.toFixed(2) + ' ₽/м²' : null,
            'Год постройки': data.year_built,
            'Дата определения стоимости': data.cost_determination_date || null,
            'Дата регистрации': data.registration_date || null,
            'Протяженность': data.params_extension > 0 ? data.params_extension + ' м' : null,
            'Объем': data.params_volume > 0 ? data.params_volume + ' м³' : null,
            'Высота': data.params_height > 0 ? data.params_height + ' м' : null,
            'Глубина': data.params_depth > 0 ? data.params_depth + ' м' : null,
            'Этажность': data.params_floors || null,
            'Площадь застройки': data.params_built_up_area > 0 ? data.params_built_up_area + ' м²' : null,
            'Основание оценки': data.determination_couse ? data.determination_couse.replace(/\n/g, ' ').trim() : null,
            'Категория': data.categoryName || null,
            'ID объекта': data.interactionId || null
        };

        const text = Object.entries(fields)
            .filter(([_, value]) => value && value !== '—' && value !== null && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Данные скопированы в буфер обмена', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            this.showNotification('Данные скопированы в буфер обмена', 'success');
        });
    }

    clear() {
        this.currentResult = null;
        const resultDiv = document.getElementById('cadResult');
        if (resultDiv) {
            resultDiv.style.display = 'none';
            resultDiv.innerHTML = '';
        }
        const input = document.getElementById('cadSearchInput');
        if (input) {
            input.value = '';
            input.focus();
        }
    }

    // ============================================================
    // НАСТРОЙКА ОБРАБОТЧИКОВ
    // ============================================================
    
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('nspd-check-btn')) {
                const cadNumber = e.target.dataset.cadNumber;
                if (cadNumber) {
                    const input = document.getElementById('cadSearchInput');
                    if (input) {
                        input.value = cadNumber;
                    }
                    this.search();
                }
            }
        });
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

console.log('NSPD Integration загружается...');

window.nspdApp = new NSPDIntegration();

// ✅ ОДИН РАЗ ПЫТАЕМСЯ ИНИЦИАЛИЗИРОВАТЬ, ДАЛЬШЕ ЧЕРЕЗ setTimeout ВНУТРИ init
setTimeout(() => {
    if (window.nspdApp) {
        window.nspdApp.init();
    }
}, 200);

console.log('NSPD Integration загружена');
