// ============================================================
// map-tab.js — Логика карты для вкладки
// ============================================================

let mapInstance = null;
let mapData = null;
let currentLevel = 0;
let currentParentId = null;

const MAP_URL = 'https://mark98molchanov-a11y.github.io/a13y.gko-registry-system/data/yanao_hierarchical_web.geojson';

// ============================================================
// ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ============================================================
function initMapTab(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ Контейнер не найден:', containerId);
        return;
    }

    // Если карта уже есть — не создаём заново
    if (container._leaflet_id) {
        console.log('⚠️ Карта уже инициализирована');
        return;
    }

    // Создаём карту внутри контейнера
    mapInstance = L.map(container, {
        center: [66.0, 76.0],
        zoom: 5,
        zoomControl: true
    });

    // Базовый слой
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapInstance);

    // Загружаем данные
    loadMapData();
}

// ============================================================
// ЗАГРУЗКА ДАННЫХ
// ============================================================
async function loadMapData() {
    try {
        console.log('📥 Загрузка:', MAP_URL);
        const response = await fetch(MAP_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        mapData = await response.json();
        console.log('✅ Данные карты загружены:', mapData.features?.length || 0);
        
        // Показываем начальный уровень
        renderMapLevel(0);
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        showMapError(error.message);
    }
}

// ============================================================
// ОТРИСОВКА УРОВНЯ
// ============================================================
function renderMapLevel(level, parentId = null) {
    if (!mapData || !mapInstance) {
        console.warn('⚠️ mapData или mapInstance не инициализированы');
        return;
    }

    console.log(`🔍 Фильтрация: level=${level}, parentId=${parentId}`);
    console.log(`📊 Всего объектов в mapData: ${mapData.features.length}`);

    // Фильтруем объекты
    let filtered = mapData.features.filter(f => {
        const props = f.properties;
        if (props.level !== level) return false;
        
        if (level === 0) return true;
        if (level === 1) return props.parent_id === '89';
        
        if (level === 2) {
            if (parentId) {
                const belongs = String(props.parent_id) === String(parentId) || 
                               String(props.district_id) === String(parentId);
                if (!belongs) return false;
            }
            return true;
        }
        
        return false;
    });

    console.log(`📊 Отфильтровано: ${filtered.length} объектов`);
    
    if (filtered.length === 0) {
        console.warn('⚠️ Нет объектов для отображения!');
        showMapError('Нет объектов для отображения');
        return;
    }

    if (window.mapLayer) {
        mapInstance.removeLayer(window.mapLayer);
        window.mapLayer.off();
        window.mapLayer = null;
    }

    // Разделяем на обёртки и обычные кварталы
    const wrapperQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return cadNum.endsWith('0000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    const normalQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return !cadNum.endsWith('0000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });

    console.log(`📊 Кварталов-обёрток: ${wrapperQuarters.length}, обычных: ${normalQuarters.length}`);

    // Создаём слой
    window.mapLayer = L.layerGroup();

    // 1. Добавляем обёртки (снизу, полупрозрачные)
    if (wrapperQuarters.length > 0) {
        const wrapperLayer = L.geoJSON(wrapperQuarters, {
            style: function(feature) {
                const price = feature.properties?.deals_median || 0;
                return {
                    fillColor: price > 0 ? '#fbbf24' : '#e2e8f0',
                    fillOpacity: 0.3,
                    color: '#94a3b8',
                    weight: 1,
                    opacity: 0.3,
                    dashArray: '4 4',
                    interactive: false
                };
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                const cadNum = props.cadastral_number || '—';
                const dealsCount = props.deals_count || 0;
                const medianPrice = props.deals_median || 0;
                
                layer.bindPopup(`
                    <div class="popup-title"><b>${cadNum}</b> (общая территория)</div>
                    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
                    ${dealsCount > 0 ? `
                    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
                    ` : ''}
                    <div style="margin-top:6px;font-size:0.7rem;color:#94a3b8;">Остаточная территория района</div>
                `, { className: 'custom-popup', maxWidth: 300 });
                
                layer.on('click', function(e) {
                    const statObjects = document.getElementById('stat-objects');
                    const statWithDeals = document.getElementById('stat-with-deals');
                    const statTotalDeals = document.getElementById('stat-total-deals');
                    
                    if (statObjects && statWithDeals && statTotalDeals) {
                        statObjects.textContent = '1';
                        statWithDeals.textContent = dealsCount > 0 ? '1' : '0';
                        statTotalDeals.textContent = dealsCount.toLocaleString();
                    }
                    
                    layer.openPopup();
                });
            }
        });
        window.mapLayer.addLayer(wrapperLayer);
        console.log(`✅ Добавлено ${wrapperQuarters.length} кварталов-обёрток`);
    }

    // 2. Добавляем обычные кварталы (сверху, кликабельные)
    if (normalQuarters.length > 0) {
        const normalLayer = L.geoJSON(normalQuarters, {
            style: function(feature) {
                const price = feature.properties?.deals_median || 0;
                return {
                    fillColor: price > 0 ? '#60a5fa' : '#94a3b8',
                    fillOpacity: 0.7,
                    color: price > 0 ? '#0ea5e9' : '#64748b',
                    weight: 2,
                    opacity: 0.9,
                    dashArray: null
                };
            },
            onEachFeature: onMapFeatureClick
        });
        window.mapLayer.addLayer(normalLayer);
        console.log(`✅ Добавлено ${normalQuarters.length} обычных кварталов`);
    }

    window.mapLayer.addTo(mapInstance);

    // 🔥 ИСПРАВЛЕННАЯ ПОДГОНКА ГРАНИЦ
    try {
        let bounds = null;
        window.mapLayer.eachLayer(function(layer) {
            if (layer.getBounds && layer.getBounds().isValid()) {
                if (!bounds) {
                    bounds = layer.getBounds();
                } else {
                    bounds.extend(layer.getBounds());
                }
            }
        });
        
        if (bounds && bounds.isValid()) {
            mapInstance.fitBounds(bounds, { padding: [30, 30] });
        }
    } catch(e) {
        console.warn('⚠️ Не удалось подогнать границы:', e);
    }

    // Обновляем статистику (без обёрток)
    updateMapStats(normalQuarters, level, parentId);
}

// ============================================================
// СТИЛИ ДЛЯ КВАРТАЛОВ
// ============================================================
function getMapStyle(feature) {
    const props = feature.properties;
    const level = props.level;
    const price = props.deals_median || 0;
    
    // Базовый стиль
    let style = {
        fillColor: getMapColor(price),
        fillOpacity: 0.7,
        color: '#334155',
        weight: 1,
        opacity: 0.5
    };
    
    // Для кварталов делаем границы толще и ярче
    if (level === 2) {
        style = {
            fillColor: getMapColor(price),
            fillOpacity: 0.7,
            color: '#0ea5e9',        // Синий цвет для границ кварталов
            weight: 2,                // Толще границы
            opacity: 0.8,             // Более яркие
            dashArray: null
        };
    }
    
    // Для районов
    if (level === 1) {
        style = {
            fillColor: getMapColor(price),
            fillOpacity: 0.5,
            color: '#1e293b',
            weight: 2,
            opacity: 0.8
        };
    }
    
    return style;
}


function getMapColor(price) {
    if (price === 0 || !price) return '#e2e8f0';
    if (price < 10000) return '#fee2e2';
    if (price < 50000) return '#fef08a';
    if (price < 100000) return '#86efac';
    if (price < 500000) return '#60a5fa';
    return '#7c3aed';
}

// ============================================================
// ОБРАБОТКА КЛИКОВ
// ============================================================
function onMapFeatureClick(feature, layer) {
    // Проверка: если feature нет — выходим
    if (!feature || !feature.properties) {
        console.warn('⚠️ onMapFeatureClick: feature или properties отсутствуют');
        return;
    }
    
    const props = feature.properties;
    const levelName = props.level_name || 'unknown';
    const level = props.level;
    const cadNum = props.cadastral_number || '—';

    // Попап
    let popupContent = buildPopupContent(feature);
    layer.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 300 });

    // ===== 🖱️ КЛИК =====
    layer.on('click', function(e) {
        if (levelName === 'okrug') {
            renderMapLevel(1);
            updateBreadcrumb('okrug');
            // Проверяем, что mapLayer существует и у него есть метод getBounds
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
            }
        } else if (levelName === 'district') {
            const districtId = props.district_id || props.cadastral_number;
            renderMapLevel(2, districtId);
            updateBreadcrumb('district', districtId, props.district_name);
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
            }
        } else if (levelName === 'quarter') {
            console.log('🏘️ Квартал выбран:', cadNum);
            console.log('📊 Сделок:', props.deals_count || 0);
            
            if (layer.getBounds && layer.getBounds().isValid()) {
                mapInstance.fitBounds(layer.getBounds(), { padding: [20, 20] });
            } else if (layer.getLatLng) {
                mapInstance.setView(layer.getLatLng(), 15);
            }
            
            layer.openPopup();
        }
    });

    // ===== 🖱️ ХОВЕР (наведение) =====
    layer.on('mouseover', function(e) {
        // Проверяем, что слой ещё существует
        if (!this || !this.setStyle) return;
        
        this.setStyle({
            fillOpacity: 0.9,
            weight: 3,
            color: '#f59e0b',
            opacity: 1
        });
        this.bringToFront();
        if (this._container) {
            this._container.style.cursor = 'pointer';
        }
    });

    layer.on('mouseout', function(e) {
        // Проверяем, что слой и feature ещё существуют
        if (!this || !this.setStyle || !feature) return;
        
        const price = feature.properties?.deals_median || 0;
        const level = feature.properties?.level || 0;
        
        let style = {
            fillColor: getMapColor(price),
            fillOpacity: 0.7,
            color: '#334155',
            weight: 1,
            opacity: 0.5
        };
        
        if (level === 2) {
            style = {
                fillColor: getMapColor(price),
                fillOpacity: 0.7,
                color: '#0ea5e9',
                weight: 2,
                opacity: 0.8
            };
        }
        
        if (level === 1) {
            style = {
                fillColor: getMapColor(price),
                fillOpacity: 0.5,
                color: '#1e293b',
                weight: 2,
                opacity: 0.6
            };
        }
        
        this.setStyle(style);
    });
}
function buildPopupContent(feature) {
    const props = feature.properties;
    const levelName = props.level_name || 'unknown';
    
    if (levelName === 'okrug') {
        return `
            <div class="popup-title">🏛️ ${props.district_name || 'ЯНАО'}</div>
            <div class="popup-row"><span class="popup-label">Уровень</span><span class="popup-value">Округ</span></div>
            <div style="margin-top:8px;color:#0ea5e9;font-size:0.7rem;">Кликните, чтобы увидеть районы →</div>
        `;
    }
    
    if (levelName === 'district') {
        const dealsCount = props.deals_count || 0;
        const medianPrice = props.deals_median || 0;
        return `
            <div class="popup-title">📋 ${props.district_name || props.cadastral_number || 'Район'}</div>
            <div class="popup-row"><span class="popup-label">Уровень</span><span class="popup-value">Район</span></div>
            ${dealsCount > 0 ? `
            <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
            <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
            ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
            <div style="margin-top:8px;color:#0ea5e9;font-size:0.7rem;">Кликните, чтобы увидеть кварталы →</div>
        `;
    }
    
if (levelName === 'quarter') {
    const cadNum = props.cadastral_number || '—';
    const dealsCount = props.deals_count || 0;
    const medianPrice = props.deals_median || 0;
    const minPrice = props.deals_min || 0;
    const maxPrice = props.deals_max || 0;
    const uprsMedian = props.uprs_median || 0;
    return `
        <div class="popup-title">${cadNum}</div>
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
        ${dealsCount > 0 ? `
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
        ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
    `;
}
    
    return `<div>Неизвестный уровень</div>`;
}
// ============================================================
// ПОСТРОЕНИЕ ПОПАПА
// ============================================================
function updateMapStats(features, level, parentId) {
    // Получаем элементы для карточек
    const statObjects = document.getElementById('stat-objects');
    const statWithDeals = document.getElementById('stat-with-deals');
    const statTotalDeals = document.getElementById('stat-total-deals');
    
    if (!statObjects || !statWithDeals || !statTotalDeals) return;
    
    let withDeals = 0;
    let totalDeals = 0;
    let objectCount = 0;
    
    // Получаем все валидные кварталы (исключая полигоны районов)
    const allQuarters = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const cadNum = f.properties.cadastral_number || '';
        return !cadNum.endsWith('0000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    // === УРОВЕНЬ 0 (Округ) — показываем все кварталы ===
    if (level === 0) {
        objectCount = allQuarters.length;
        allQuarters.forEach(q => {
            const count = q.properties.deals_count || 0;
            if (count > 0) {
                withDeals++;
                totalDeals += count;
            }
        });
    }
    // === УРОВЕНЬ 1 (Районы) — показываем все кварталы (общая статистика по ЯНАО) ===
    else if (level === 1) {
        objectCount = allQuarters.length;
        allQuarters.forEach(q => {
            const count = q.properties.deals_count || 0;
            if (count > 0) {
                withDeals++;
                totalDeals += count;
            }
        });
    }
    // === УРОВЕНЬ 2 (Кварталы) — показываем кварталы конкретного района ===
    else if (level === 2) {
        const districtQuarters = allQuarters.filter(q => {
            const qParentId = q.properties.parent_id || q.properties.district_id;
            return qParentId === parentId;
        });
        
        objectCount = districtQuarters.length;
        districtQuarters.forEach(q => {
            const count = q.properties.deals_count || 0;
            if (count > 0) {
                withDeals++;
                totalDeals += count;
            }
        });
    }
    
    // Обновляем карточки
    statObjects.textContent = objectCount;
    statWithDeals.textContent = withDeals;
    statTotalDeals.textContent = totalDeals.toLocaleString();
}

// ============================================================
// ХЛЕБНЫЕ КРОШКИ
// ============================================================
function updateBreadcrumb(level, id, name) {
    const breadcrumb = document.getElementById('map-breadcrumb');
    if (!breadcrumb) return;
    
    // Получаем название района для кварталов
    let districtName = name || id || 'Район';
    if (level === 'quarter' && id) {
        // Пытаемся найти название района
        if (mapData && mapData.features) {
            const district = mapData.features.find(f => 
                f.properties.level === 1 && 
                (f.properties.district_id === id || f.properties.cadastral_number === id)
            );
            if (district) {
                districtName = district.properties.district_name || district.properties.cadastral_number || id;
            }
        }
    }
    
    if (level === 'okrug') {
        breadcrumb.innerHTML = '<span style="font-weight:600; font-size:0.95rem;">🏛️ ЯНАО</span>';
    } else if (level === 'district') {
        breadcrumb.innerHTML = `
            <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">🏛️ ЯНАО</span>
            <span style="color:#94a3b8; margin:0 4px;">›</span>
            <span style="font-weight:600; font-size:0.95rem;">${name || id}</span>
        `;
    } else if (level === 'quarter') {
        breadcrumb.innerHTML = `
            <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">🏛️ ЯНАО</span>
            <span style="color:#94a3b8; margin:0 4px;">›</span>
            <span onclick="renderMapLevel(1)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">${districtName}</span>
            <span style="color:#94a3b8; margin:0 4px;">›</span>
            <span style="font-weight:600; font-size:0.95rem;">Кварталы</span>
        `;
    }
}

// ============================================================
// ОШИБКИ
// ============================================================
function showMapError(message) {
    const container = document.getElementById('map-container');
    if (container) {
        container.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100%;color:#ef4444;text-align:center;">
                <div>
                    <div style="font-size:2rem;margin-bottom:8px;">❌</div>
                    <p>Ошибка загрузки карты</p>
                    <p style="font-size:0.8rem;color:#94a3b8;">${message}</p>
                </div>
            </div>
        `;
    }
}

// ============================================================
// ОЧИСТКА КАРТЫ (при переключении вкладок)
// ============================================================
function destroyMap() {
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
        window.mapLayer = null;
        console.log('🗺️ Карта уничтожена');
    }
}

// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================
window.initMapTab = initMapTab;
window.destroyMap = destroyMap;
window.renderMapLevel = renderMapLevel;

console.log('✅ map-tab.js загружен');
