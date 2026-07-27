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
        this.baseUrl = 'https://nspd.gov.ru/api/geoportal/v2/search/geoportal';
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    
    init() {
        if (this.initialized) return this;
        
        console.log('🏛️ NSPD Integration инициализируется...');
        
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
        
        if (!checkMap()) {
            const interval = setInterval(() => {
                if (checkMap()) {
                    clearInterval(interval);
                }
            }, 500);
            
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
        // Проверяем, не добавлена ли уже панель
        if (document.querySelector('.nspd-panel')) {
            return;
        }
        
        // Ищем контейнер для панели
        const container = document.querySelector('#mapTab .flex.gap-4') || 
                          document.querySelector('#map-container')?.parentNode;
        
        if (!container) {
            console.warn('⚠️ Не найден контейнер для панели НСПД');
            return;
        }

        const panel = document.createElement('div');
        panel.className = 'nspd-panel';
        panel.id = 'nspd-panel';
        panel.style.cssText = `
            margin: 12px 0;
            padding: 12px 16px;
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 600; color: #1e293b;">🏛️ Проверка по кадастру</span>
                <span style="font-size: 9px; color: #94a3b8; background: #f1f5f9; padding: 2px 8px; border-radius: 20px;">НСПД</span>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <input type="text" 
                       id="cadSearchInput" 
                       placeholder="Введите кадастровый номер" 
                       style="
                           flex: 1;
                           padding: 8px 12px;
                           border: 1px solid #e2e8f0;
                           border-radius: 8px;
                           font-size: 13px;
                           outline: none;
                           transition: all 0.2s;
                           background: #f8fafc;
                           font-family: 'Inter', sans-serif;
                       "
                       onfocus="this.style.borderColor='#3b82f6'; this.style.background='white'; this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.15)';"
                       onblur="this.style.borderColor='#e2e8f0'; this.style.background='#f8fafc'; this.style.boxShadow='none';"
                       onkeydown="if(event.key==='Enter') { if(window.nspdApp) nspdApp.search(); }">
                <button onclick="if(window.nspdApp) nspdApp.search(); else alert('НСПД не загружена')" 
                        style="
                            padding: 8px 16px;
                            background: #3b82f6;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            font-size: 13px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s;
                            font-family: 'Inter', sans-serif;
                            white-space: nowrap;
                        "
                        onmouseover="this.style.background='#2563eb'"
                        onmouseout="this.style.background='#3b82f6'">
                    Найти
                </button>
            </div>
            
            <div id="cadResult" style="margin-top: 10px; display: none;"></div>
        `;
        
        // Вставляем панель в начало контейнера
        container.insertBefore(panel, container.firstChild);
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
    // ЗАПРОС К НСПД
    // ============================================================
    
    async makeRequest(cadNumber) {
        // Используем проверенный URL с параметрами
        const url = `${this.baseUrl}?thematicSearchId=1&query=${encodeURIComponent(cadNumber)}&limit=10&offset=0&geometry=true`;
        
        console.log(`📤 Запрос к НСПД: ${url}`);
        
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
                // Обработка 404 (объект не найден)
                if (response.status === 404) {
                    const errorData = await response.json();
                    if (errorData.code === 204) {
                        return { error: 'Объект не найден в НСПД' };
                    }
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('📥 Ответ от НСПД:', data);
            
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
    // НОРМАЛИЗАЦИЯ ОТВЕТА
    // ============================================================
    
    normalizeResponse(data) {
        // Проверяем, есть ли данные
        if (!data || !data.data || !data.data.features || data.data.features.length === 0) {
            return { error: 'Объект не найден' };
        }

        const feature = data.data.features[0];
        const props = feature.properties || {};
        const options = props.options || {};
        
        // Извлекаем координаты из геометрии
        let geometry = null;
        if (feature.geometry) {
            // Конвертируем EPSG:3857 в WGS84 (для Leaflet)
            geometry = this.convertGeometryToWGS84(feature.geometry);
        }

        return {
            cadastral_number: options.cad_number || props.externalKey || '',
            area: parseFloat(options.params_area) || 0,
            cadastral_value: parseFloat(options.cost_value) || 0,
            cadastral_index: parseFloat(options.cost_index) || 0,
            address: options.address_readable_address || '',
            object_name: options.params_name || '',
            object_type: options.object_type_value || props.categoryName || '',
            purpose: options.params_purpose || '',
            year_built: options.params_year_built || '',
            registration_date: options.registration_date || '',
            status: options.status || '',
            ownership_type: options.ownership_type || '',
            quarter_cad_number: options.quarter_cad_number || '',
            cost_determination_date: options.cost_determination_date || '',
            geometry: geometry,
            properties: options,
            raw: data
        };
    }

    // ============================================================
    // КОНВЕРТАЦИЯ ГЕОМЕТРИИ (EPSG:3857 -> WGS84)
    // ============================================================
    
    convertGeometryToWGS84(geometry) {
        if (!geometry || !geometry.coordinates) return null;

        const convertCoords = (coords) => {
            if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                // EPSG:3857 -> WGS84
                const x = coords[0];
                const y = coords[1];
                const lon = (x / 6378137) * 57.29577951308232;
                const lat = (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 57.29577951308232;
                return [lon, lat];
            }
            return coords.map(c => convertCoords(c));
        };

        try {
            const converted = {
                type: geometry.type,
                coordinates: convertCoords(geometry.coordinates)
            };
            return converted;
        } catch (error) {
            console.warn('Ошибка конвертации геометрии:', error);
            return null;
        }
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

        this.removeFromMap();

        try {
            const geoJsonLayer = L.geoJSON(geometry, {
                style: {
                    color: '#dc2626',
                    weight: 3,
                    opacity: 0.8,
                    fillColor: '#dc2626',
                    fillOpacity: 0.15,
                    dashArray: '6 4'
                },
                onEachFeature: (feature, layer) => {
                    const popupContent = this.buildGeoPopup(feature.properties, properties);
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

        const formatDate = (date) => {
            if (!date) return '—';
            const d = new Date(date);
            return d.toLocaleDateString('ru-RU');
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
                    ${data.object_name ? `<div style="grid-column: span 2;"><span style="color: #64748b;">Наименование:</span> <strong>${data.object_name}</strong></div>` : ''}
                    ${data.object_type ? `<div><span style="color: #64748b;">Тип:</span> <strong>${data.object_type}</strong></div>` : ''}
                    ${data.purpose ? `<div><span style="color: #64748b;">Назначение:</span> <strong>${data.purpose}</strong></div>` : ''}
                    ${data.area > 0 ? `<div><span style="color: #64748b;">Площадь:</span> <strong>${data.area.toFixed(1)} м²</strong></div>` : ''}
                    ${data.cadastral_value > 0 ? `<div><span style="color: #64748b;">Кад. стоимость:</span> <strong>${formatPrice(data.cadastral_value)}</strong></div>` : ''}
                    ${data.cadastral_index > 0 ? `<div><span style="color: #64748b;">УПКС:</span> <strong>${data.cadastral_index.toFixed(2)} ₽/м²</strong></div>` : ''}
                    ${data.year_built ? `<div><span style="color: #64748b;">Год постройки:</span> <strong>${data.year_built}</strong></div>` : ''}
                    ${data.status ? `<div><span style="color: #64748b;">Статус:</span> <strong>${data.status}</strong></div>` : ''}
                    ${data.address ? `<div style="grid-column: span 2;"><span style="color: #64748b;">Адрес:</span> <strong style="font-size: 11px;">${data.address}</strong></div>` : ''}
                    ${data.registration_date ? `<div style="grid-column: span 2; font-size: 10px; color: #94a3b8;">Зарегистрирован: ${formatDate(data.registration_date)}</div>` : ''}
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
                    <a href="https://nspd.gov.ru/map?text=${encodeURIComponent(data.cadastral_number)}" target="_blank" 
                       style="padding: 4px 10px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; text-decoration: none;">
                        🔗 Открыть в НСПД
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
        const cadNumber = objectProps.cadastral_number || featureProps.cad_number || '—';
        const name = objectProps.object_name || featureProps.params_name || '';
        const address = objectProps.address || featureProps.address_readable_address || 'Адрес не указан';
        const type = objectProps.object_type || featureProps.object_type_value || '';
        
        return `
            <div style="font-size: 12px; max-width: 250px;">
                <div style="font-weight: 600; color: #dc2626; margin-bottom: 4px;">
                    🏛️ ${name || 'Объект из НСПД'}
                </div>
                <div style="color: #64748b; font-size: 11px;">
                    ${address}
                </div>
                ${type ? `<div style="font-size: 10px; color: #94a3b8;">${type}</div>` : ''}
                <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                    Кад. номер: ${cadNumber}
                </div>
                ${objectProps.cadastral_value ? `
                    <div style="font-size: 10px; color: #94a3b8;">
                        Кад. стоимость: ${objectProps.cadastral_value.toLocaleString()} ₽
                    </div>
                ` : ''}
                <div style="margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
                    <a href="https://nspd.gov.ru/map?text=${encodeURIComponent(cadNumber)}" target="_blank" 
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

        const fields = {
            'Кадастровый номер': data.cadastral_number,
            'Наименование': data.object_name,
            'Тип': data.object_type,
            'Назначение': data.purpose,
            'Площадь': data.area > 0 ? data.area.toFixed(1) + ' м²' : null,
            'Кадастровая стоимость': data.cadastral_value > 0 ? data.cadastral_value.toLocaleString() + ' ₽' : null,
            'УПКС': data.cadastral_index > 0 ? data.cadastral_index.toFixed(2) + ' ₽/м²' : null,
            'Год постройки': data.year_built,
            'Статус': data.status,
            'Адрес': data.address,
            'Дата регистрации': data.registration_date
        };

        const text = Object.entries(fields)
            .filter(([_, value]) => value && value !== '—' && value !== null)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('✅ Данные скопированы в буфер обмена', 'success');
        }).catch(() => {
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

let nspdApp = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        nspdApp = new NSPDIntegration();
        nspdApp.init();
    });
} else {
    nspdApp = new NSPDIntegration();
    nspdApp.init();
}

window.nspdApp = nspdApp;
console.log('🏛️ NSPD Integration загружена');
