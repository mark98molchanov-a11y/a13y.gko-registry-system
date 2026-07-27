// ============================================================
// ИНТЕГРАЦИЯ С НСПД - ОСНОВНАЯ ЛОГИКА
// ============================================================

class NSPDIntegration {
    constructor() {
        this.config = window.NSPD_CONFIG || {};
        this.cache = new Map();
        this.currentResult = null;
        this.cadastralLayer = null;
        this.isLoading = false;
        this.initialized = false;
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    
    init() {
        if (this.initialized) return this;
        
        console.log('🏛️ NSPD Integration инициализируется...');
        
        // Ждем загрузки карты
        const checkMap = () => {
            if (typeof mapInstance !== 'undefined' && mapInstance) {
                this.addPanel();
                this.setupEventListeners();
                this.initialized = true;
                console.log('✅ NSPD Integration готова к работе');
                return true;
            }
            return false;
        };
        
        // Пробуем сразу
        if (!checkMap()) {
            // Ждем с интервалом
            const interval = setInterval(() => {
                if (checkMap()) {
                    clearInterval(interval);
                }
            }, 500);
            
            // Таймаут
            setTimeout(() => {
                clearInterval(interval);
                if (!this.initialized) {
                    console.warn('⚠️ Карта не загружена, панель НСПД не добавлена');
                }
            }, 10000);
        }
        
        return this;
    }

    // ============================================================
    // ДОБАВЛЕНИЕ ПАНЕЛИ В ИНТЕРФЕЙС
    // ============================================================
    
    addPanel() {
        // Ищем контейнер для панели
        const sidebar = document.querySelector('.sidebar-content') || 
                        document.querySelector('#filters-container') ||
                        document.querySelector('.leaflet-control-container');
        
        if (!sidebar) {
            console.warn('⚠️ Не найден контейнер для панели НСПД');
            return;
        }

        // Проверяем, не добавлена ли уже панель
        if (document.querySelector('.nspd-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'nspd-panel';
        panel.id = 'nspd-panel';
        panel.style.cssText = `
            margin: 12px;
            padding: 12px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 600; color: #475569;">🏛️ Проверка по кадастру</span>
                <span style="font-size: 9px; color: #94a3b8;">НСПД</span>
            </div>
            
            <div style="display: flex; gap: 6px;">
                <input type="text" 
                       id="cadSearchInput" 
                       placeholder="Введите кад. номер" 
                       style="
                           flex: 1; 
                           padding: 6px 10px; 
                           border: 1px solid #e2e8f0; 
                           border-radius: 6px; 
                           font-size: 12px;
                           outline: none;
                           transition: border-color 0.2s;
                           background: white;
                       "
                       onfocus="this.style.borderColor='#3b82f6'"
                       onblur="this.style.borderColor='#e2e8f0'"
                       onkeydown="if(event.key === 'Enter') nspdApp.search()">
                <button onclick="nspdApp.search()" 
                        style="
                            padding: 6px 14px; 
                            background: #3b82f6; 
                            color: white; 
                            border: none; 
                            border-radius: 6px; 
                            cursor: pointer; 
                            font-size: 12px;
                            font-weight: 500;
                            transition: background 0.2s;
                            white-space: nowrap;
                        "
                        onmouseover="this.style.background='#2563eb'"
                        onmouseout="this.style.background='#3b82f6'">
                    Найти
                </button>
            </div>
            
            <div id="cadResult" style="margin-top: 10px; display: none;"></div>
        `;
        
        // Вставляем панель в подходящее место
        const breadcrumb = document.querySelector('#map-breadcrumb');
        if (breadcrumb && breadcrumb.parentNode) {
            breadcrumb.parentNode.insertBefore(panel, breadcrumb);
        } else {
            // Вставляем в начало контейнера
            const firstChild = sidebar.firstChild;
            if (firstChild) {
                sidebar.insertBefore(panel, firstChild);
            } else {
                sidebar.appendChild(panel);
            }
        }
        
        console.log('✅ Панель НСПД добавлена');
    }

    // ============================================================
    // ПОИСК ПО КАДАСТРОВОМУ НОМЕРУ
    // ============================================================
    
    async search() {
        const input = document.getElementById('cadSearchInput');
        if (!input) return;
        
        const cadNumber = input.value.trim();
        if (!cadNumber) {
            this.showError('Введите кадастровый номер');
            return;
        }

        // Проверяем кэш
        const cached = this.getFromCache(cadNumber);
        if (cached) {
            this.currentResult = cached;
            this.displayResult(cached);
            return;
        }

        // Показываем загрузку
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

            // Сохраняем в кэш
            this.saveToCache(cadNumber, response);
            this.currentResult = response;
            
            // Отображаем результат
            this.displayResult(response);
            
            // Если есть геометрия — показываем на карте
            if (response.geometry) {
                this.displayOnMap(response.geometry, response.properties);
            }
            
            this.showNotification('✅ Объект найден в НСПД', 'success');

        } catch (error) {
            console.error('Ошибка запроса к НСПД:', error);
            this.showError('Не удалось получить данные. Проверьте номер или попробуйте позже.');
        }
    }

    // ============================================================
    // ЗАПРОС К MCP-СЕРВЕРУ
    // ============================================================
    
    async makeRequest(cadNumber) {
        const url = this.config.MCP_SERVER_URL || 'https://your-mcp-server.ru/api/rosreestr';
        
        // Пробуем разные эндпоинты
        const endpoints = [
            '/get_cadastral_coordinates',
            '/search',
            '/object'
        ];

        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.TIMEOUT || 10000);

                const response = await fetch(`${url}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        cadastral_number: cadNumber.trim(),
                        area_type: 1
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return this.normalizeResponse(data);
                }
            } catch (error) {
                lastError = error;
                console.warn(`Ошибка при запросе к ${endpoint}:`, error);
                continue;
            }
        }

        // Если все эндпоинты не работают, пробуем прямой запрос к НСПД
        try {
            const directResponse = await this.directNSPDRequest(cadNumber);
            if (directResponse) {
                return directResponse;
            }
        } catch (error) {
            console.warn('Прямой запрос к НСПД также не удался:', error);
        }

        throw new Error(lastError || 'Все эндпоинты недоступны');
    }

    // Прямой запрос к НСПД (как fallback)
    async directNSPDRequest(cadNumber) {
        const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?text=${encodeURIComponent(cadNumber)}`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        return this.normalizeResponse(data);
    }

    // ============================================================
    // НОРМАЛИЗАЦИЯ ОТВЕТА
    // ============================================================
    
    normalizeResponse(data) {
        // Приводим ответ к единому формату
        const result = data.result || data.data || data;
        
        // Если ответ пустой или содержит ошибку
        if (!result || result.error) {
            return { error: result?.error || 'Объект не найден' };
        }
        
        // Извлекаем данные из разных форматов
        const firstResult = Array.isArray(result) ? result[0] : result;
        const props = firstResult?.properties || firstResult || {};
        
        return {
            cadastral_number: props.cadastral_number || props.cad_num || result.cadastral_number || '',
            area: parseFloat(props.area || props.square || result.area || 0),
            cadastral_value: parseFloat(props.cadastral_value || props.cad_cost || result.cadastral_value || 0),
            address: props.address || props.full_address || result.address || '',
            category: props.category || props.land_category || result.category || '',
            permitted_use: props.permitted_use || props.vri || result.permitted_use || '',
            geometry: props.geometry || props.geo_json || result.geometry || null,
            properties: props,
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
                console.log(`📦 Данные из кэша для ${key}`);
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
        console.log(`💾 Данные сохранены в кэш для ${key}`);
    }

    // ============================================================
    // ОТОБРАЖЕНИЕ НА КАРТЕ
    // ============================================================
    
    displayOnMap(geometry, properties = {}) {
        if (!geometry || typeof mapInstance === 'undefined' || !mapInstance) return;

        // Удаляем старый слой
        this.removeFromMap();

        try {
            // Создаем слой из GeoJSON
            const geoJsonLayer = L.geoJSON(geometry, {
                style: this.config.MAP_STYLE || {
                    color: '#dc2626',
                    weight: 3,
                    opacity: 0.8,
                    fillColor: '#dc2626',
                    fillOpacity: 0.15,
                    dashArray: '6 4'
                },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};
                    const popupContent = this.buildGeoPopup(props, properties);
                    layer.bindPopup(popupContent);
                    
                    layer.on('mouseover', function() {
                        this.setStyle({
                            fillOpacity: 0.3,
                            weight: 4,
                            color: '#ef4444'
                        });
                        this.bringToFront();
                    });
                    layer.on('mouseout', function() {
                        this.setStyle({
                            fillOpacity: 0.15,
                            weight: 3,
                            color: '#dc2626'
                        });
                    });
                }
            });

            this.cadastralLayer = geoJsonLayer;
            geoJsonLayer.addTo(mapInstance);

            // Приближаем к объекту
            const bounds = geoJsonLayer.getBounds();
            if (bounds && bounds.isValid()) {
                mapInstance.fitBounds(bounds, { padding: [30, 30] });
            }

            this.showNotification('📍 Границы объекта отображены на карте', 'success');
        } catch (error) {
            console.error('Ошибка отображения геометрии:', error);
            this.showNotification('⚠️ Не удалось отобразить границы объекта', 'warning');
        }
    }

    removeFromMap() {
        if (this.cadastralLayer && typeof mapInstance !== 'undefined' && mapInstance) {
            mapInstance.removeLayer(this.cadastralLayer);
            this.cadastralLayer = null;
        }
    }

    showOnMap() {
        const data = this.currentResult;
        if (!data || !data.geometry) {
            this.showNotification('❌ Нет геометрии для отображения', 'error');
            return;
        }
        this.displayOnMap(data.geometry, data.properties);
    }

    // ============================================================
    // UI: ОТОБРАЖЕНИЕ РЕЗУЛЬТАТА
    // ============================================================
    
    displayResult(data) {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;

        const formatPrice = (num) => {
            if (!num || num === 0) return '—';
            return num.toLocaleString('ru-RU') + ' ₽';
        };

        const formatArea = (num) => {
            if (!num || num === 0) return '—';
            return num.toFixed(1) + ' м²';
        };

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="
                background: white;
                border-radius: 8px;
                padding: 12px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                animation: nspdSlideIn 0.3s ease;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600; font-size: 12px; color: #1e293b; word-break: break-all;">📋 ${data.cadastral_number}</span>
                    <span style="font-size: 10px; color: #10b981; background: #dcfce7; padding: 2px 8px; border-radius: 20px; white-space: nowrap;">
                        ✅ Найден
                    </span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px;">
                    <div><span style="color: #64748b;">Площадь:</span> <strong>${formatArea(data.area)}</strong></div>
                    <div><span style="color: #64748b;">Кад. стоимость:</span> <strong>${formatPrice(data.cadastral_value)}</strong></div>
                    <div><span style="color: #64748b;">Категория:</span> <strong>${data.category || '—'}</strong></div>
                    <div><span style="color: #64748b;">ВРИ:</span> <strong>${data.permitted_use || '—'}</strong></div>
                    <div style="grid-column: span 2;">
                        <span style="color: #64748b;">Адрес:</span> 
                        <strong style="font-size: 11px;">${data.address || '—'}</strong>
                    </div>
                </div>
                
                <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 8px;">
                    ${data.geometry ? `
                        <button onclick="nspdApp.showOnMap()" 
                                style="padding: 4px 10px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 4px; cursor: pointer; font-size: 10px;">
                            🗺️ Показать на карте
                        </button>
                    ` : ''}
                    <button onclick="nspdApp.copyData()" 
                            style="padding: 4px 10px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; cursor: pointer; font-size: 10px;">
                        📋 Копировать
                    </button>
                    <a href="https://nspd.gov.ru" target="_blank" 
                       style="padding: 4px 10px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; text-decoration: none;">
                        🔗 НСПД
                    </a>
                    <button onclick="nspdApp.clear()" 
                            style="padding: 4px 10px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; font-size: 10px;">
                        ✕ Очистить
                    </button>
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
                ⏳ Поиск в НСПД...
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
                ❌ ${message}
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

        // Удаляем старые уведомления
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
    
    buildGeoPopup(featureProps, objectProps) {
        const cadNumber = objectProps.cadastral_number || featureProps.cadastral_number || '—';
        const address = objectProps.address || featureProps.address || 'Адрес не указан';
        const area = objectProps.area || featureProps.area || null;
        
        return `
            <div style="font-size: 12px; max-width: 250px;">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">
                    🏛️ Объект из НСПД
                </div>
                <div style="color: #64748b; font-size: 11px;">
                    ${address}
                </div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                    Кад. номер: ${cadNumber}
                </div>
                ${area ? `
                    <div style="font-size: 10px; color: #94a3b8;">
                        Площадь: ${typeof area === 'number' ? area.toFixed(1) : area} м²
                    </div>
                ` : ''}
                <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                    <a href="https://nspd.gov.ru" target="_blank" 
                       style="color: #3b82f6; text-decoration: none; font-size: 10px;">
                        📍 Открыть в НСПД →
                    </a>
                </div>
            </div>
        `;
    }

    copyData() {
        const data = this.currentResult;
        if (!data) {
            this.showNotification('Нет данных для копирования', 'warning');
            return;
        }

        const text = Object.entries(data)
            .filter(([key]) => !['geometry', 'raw', 'properties'].includes(key))
            .map(([key, value]) => {
                const label = {
                    cadastral_number: 'Кадастровый номер',
                    area: 'Площадь',
                    cadastral_value: 'Кадастровая стоимость',
                    address: 'Адрес',
                    category: 'Категория земель',
                    permitted_use: 'ВРИ'
                }[key] || key;
                return `${label}: ${value}`;
            })
            .join('\n');

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('✅ Данные скопированы в буфер обмена', 'success');
        }).catch(() => {
            // fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            this.showNotification('✅ Данные скопированы в буфер обмена', 'success');
        });
    }

    clear() {
        this.removeFromMap();
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
        // Обработчик для кнопок "Проверить по кадастру" в попапах
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

// Создаем глобальный экземпляр
let nspdApp = null;

// Инициализация после загрузки страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        nspdApp = new NSPDIntegration();
        nspdApp.init();
    });
} else {
    nspdApp = new NSPDIntegration();
    nspdApp.init();
}

// Экспортируем для доступа из HTML
window.nspdApp = nspdApp;

console.log('🏛️ NSPD Integration загружена');
