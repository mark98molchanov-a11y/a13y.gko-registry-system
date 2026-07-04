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

// ✅ УБИРАЕМ АТРИБУЦИЮ (Leaflet | © OpenStreetMap)
mapInstance.attributionControl.remove();

// Базовый слой
L.tileLayer('http://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '© Google'
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

    // Удаляем старые слои
    if (window.mapLayer) {
        mapInstance.removeLayer(window.mapLayer);
        window.mapLayer.off();
        window.mapLayer = null;
    }
    if (window.wrapperLayer) {
        mapInstance.removeLayer(window.wrapperLayer);
        window.wrapperLayer = null;
    }

    // 🔥 РАЗДЕЛЯЕМ НА ОБЕРТКИ И КВАРТАЛЫ
    const wrapperQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return cadNum.endsWith('0000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    const normalQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return !cadNum.endsWith('0000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });

    console.log(`📊 Оберток: ${wrapperQuarters.length}, кварталов: ${normalQuarters.length}`);

    // 🔥 СНАЧАЛА ДОБАВЛЯЕМ ОБЕРТКУ (БУДЕТ СНИЗУ)
    if (wrapperQuarters.length > 0) {
        window.wrapperLayer = L.geoJSON(wrapperQuarters, {
            style: function(feature) {
                const price = feature.properties?.deals_median || 0;
                return {
                    fillColor: '#ff6b6b',
                    fillOpacity: 0.25,  // 🔥 ЕЩЁ ПРОЗРАЧНЕЕ
                    color: '#ff0000',
                    weight: 1,
                    opacity: 0.4,
                    dashArray: '4 4'
                };
            },
            onEachFeature: function(feature, layer) {
                const props = feature.properties;
                const cadNum = props.cadastral_number || '—';
                const dealsCount = props.deals_count || 0;
                const medianPrice = props.deals_median || 0;
                
               layer.bindPopup(`
    <div class="popup-title">${cadNum}</div>
    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
    ${dealsCount > 0 ? `
    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${(props.deals_min || 0).toLocaleString()} / ${(props.deals_max || 0).toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${(props.uprs_median || 0).toFixed(2)} ₽/м²</span></div>
    ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
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
                
                layer.on('mouseover', function() {
                    this.setStyle({
                        fillOpacity: 0.5,
                        weight: 2,
                        color: '#ff0000',
                        opacity: 0.7
                    });
                });
                
                layer.on('mouseout', function() {
                    this.setStyle({
                        fillOpacity: 0.25,
                        weight: 1,
                        color: '#ff0000',
                        opacity: 0.4
                    });
                });
            }
        }).addTo(mapInstance);
        
        console.log(`✅ Добавлена обертка (${wrapperQuarters.length} шт.) СНИЗУ`);
    }

    // 🔥 ПОТОМ ДОБАВЛЯЕМ КВАРТАЛЫ (БУДУТ СВЕРХУ)
if (normalQuarters.length > 0) {
    const normalLayer = L.geoJSON(normalQuarters, {
        style: function(feature) {
            const deals = feature.properties?.deals_count || 0;
            const hasDeals = deals > 0;
            return {
                fillColor: hasDeals ? getMapColor(deals) : '#f1f5f9',
                fillOpacity: 0.2,  
                color: '#3b82f6',
                weight: 2.5,       // 🔥 УВЕЛИЧЕНА
                opacity: 0.6,      // 🔥 ЧУТЬ ЯРЧЕ
                dashArray: null
            };
        },
        onEachFeature: onMapFeatureClick
    });
    window.mapLayer = normalLayer;
    window.mapLayer.addTo(mapInstance);
}
    // 🔥 НЕ ПОДНИМАЕМ ОБЕРТКУ — ОНА ДОЛЖНА БЫТЬ СНИЗУ!

    // Подгоняем границы
    try {
        let bounds = null;
        
        if (window.wrapperLayer && window.wrapperLayer.getBounds && window.wrapperLayer.getBounds().isValid()) {
            bounds = window.wrapperLayer.getBounds();
        }
        
        if (window.mapLayer && window.mapLayer.getBounds && window.mapLayer.getBounds().isValid()) {
            if (!bounds) {
                bounds = window.mapLayer.getBounds();
            } else {
                bounds.extend(window.mapLayer.getBounds());
            }
        }
        
        if (bounds && bounds.isValid()) {
            mapInstance.fitBounds(bounds, { padding: [30, 30] });
        }
    } catch(e) {
        console.warn('⚠️ Не удалось подогнать границы:', e);
    }
addMapLegend();
    // Обновляем статистику (без оберток)
    updateMapStats(normalQuarters, level, parentId);
}



function getMapColor(dealsCount) {
    if (!dealsCount || dealsCount === 0) return '#f1f5f9';  // нет сделок
    
    // МАЛО (1-100) — красный
    if (dealsCount <= 100) return '#ef4444';
    
    // СРЕДНЕ (101-500) — оранжевый/желтый
    if (dealsCount <= 500) return '#f59e0b';
    
    // МНОГО (>500) — зеленый
    return '#22c55e';
}

function onMapFeatureClick(feature, layer) {
    if (!feature || !feature.properties) {
        console.warn('⚠️ onMapFeatureClick: feature или properties отсутствуют');
        return;
    }
    
    const props = feature.properties;
    const levelName = props.level_name || 'unknown';
    const level = props.level;
    const cadNum = props.cadastral_number || '—';

    let popupContent = buildPopupContent(feature);
    layer.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 300 });

    // ===== 🖱️ КЛИК =====
    layer.on('click', function(e) {
        if (levelName === 'okrug') {
            renderMapLevel(1);
            updateBreadcrumb('okrug');
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
        if (!this || !this.setStyle) return;
        
        const lvl = feature?.properties?.level || 0;
        
        if (lvl === 2) {
            this.setStyle({
                fillOpacity: 0.2,
                weight: 2,
                color: '#60a5fa',
                opacity: 0.8
            });
        } else {
            this.setStyle({
                fillOpacity: 0.7,
                weight: 2,
                color: '#3b82f6',
                opacity: 0.9
            });
        }
        
        this.bringToFront();
        if (this._container) {
            this._container.style.cursor = 'pointer';
        }
    });

    // ===== 🖱️ УХОД МЫШИ =====
    layer.on('mouseout', function(e) {
        if (!this || !this.setStyle || !feature) return;
        
        const level = feature.properties?.level || 0;
        const deals = feature.properties?.deals_count || 0;
        const price = feature.properties?.deals_median || 0;
        
        let style = {};
        
        if (level === 2) {
            style = {
                fillColor: deals > 0 ? getMapColor(deals) : '#f1f5f9',
                fillOpacity: 0.2,
                color: '#3b82f6',
                weight: 1,
                opacity: 0.4
            };
        } else if (level === 1) {
    style = {
        fillColor: getMapColor(price),
        fillOpacity: 0.3,
        color: '#2563eb',      // 🔥 БОЛЕЕ НАСЫЩЕННЫЙ СИНИЙ
        weight: 2.5,           // 🔥 УВЕЛИЧЕНА
        opacity: 0.7
    };
} else {
            style = {
                fillColor: getMapColor(price),
                fillOpacity: 0.7,
                color: '#334155',
                weight: 1,
                opacity: 0.5
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
    const statMedian = document.getElementById('stat-median');
    const statMinMax = document.getElementById('stat-minmax');
    const statUprs = document.getElementById('stat-uprs');
    const statTotalDeals = document.getElementById('stat-total-deals');
    
    if (!statMedian || !statMinMax || !statUprs || !statTotalDeals) return;
    
    let totalDeals = 0;
    let medianPrice = 0;
    let minPrice = 0;
    let maxPrice = 0;
    let uprsMedian = 0;
    
    // Все объекты level=2 (кварталы + обертки)
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    let targetObjects = [];
    
    // === УРОВЕНЬ 0 (Округ) или 1 (Районы) — показываем все объекты ===
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    }
    // === УРОВЕНЬ 2 (Кварталы) — показываем объекты конкретного района ===
    else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return fParentId === parentId;
        });
    }
    
    // Собираем данные по объектам со сделками
    const objectsWithDeals = targetObjects.filter(f => (f.properties.deals_count || 0) > 0);
    
    if (objectsWithDeals.length > 0) {
        // Суммируем сделки
        totalDeals = objectsWithDeals.reduce((sum, f) => sum + (f.properties.deals_count || 0), 0);
        
        // Собираем цены
        let weightedSum = 0;
        let totalWeight = 0;
        let allMin = Infinity;
        let allMax = -Infinity;
        let weightedUprsSum = 0;
        let uprsTotalWeight = 0;
        
        objectsWithDeals.forEach(f => {
            const count = f.properties.deals_count || 0;
            const median = f.properties.deals_median || 0;
            const min = f.properties.deals_min || 0;
            const max = f.properties.deals_max || 0;
            const uprs = f.properties.uprs_median || 0;
            
            if (count > 0 && median > 0) {
                weightedSum += median * count;
                totalWeight += count;
            }
            
            if (min > 0 && min < allMin) allMin = min;
            if (max > 0 && max > allMax) allMax = max;
            
            if (count > 0 && uprs > 0) {
                weightedUprsSum += uprs * count;
                uprsTotalWeight += count;
            }
        });
        
        medianPrice = totalWeight > 0 ? weightedSum / totalWeight : 0;
        minPrice = allMin !== Infinity ? allMin : 0;
        maxPrice = allMax !== -Infinity ? allMax : 0;
        uprsMedian = uprsTotalWeight > 0 ? weightedUprsSum / uprsTotalWeight : 0;
    }
    
    // Форматирование
const formatPrice = (num) => {
    if (num === 0 || isNaN(num)) return '—';
    // Если число целое (например, 800000) — показываем без копеек
    if (Number.isInteger(num)) {
        return num.toLocaleString('ru-RU') + ' ₽';
    }
    // Если есть копейки — показываем с 2 знаками
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
};

const formatNumber = (num) => {
    if (num === 0 || isNaN(num)) return '—';
    // Если число целое — без копеек
    if (Number.isInteger(num)) {
        return num.toLocaleString('ru-RU');
    }
    // Если есть дробная часть — с 2 знаками
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUprs = (num) => {
    if (num === 0 || isNaN(num)) return '—';
    // УПРС всегда показываем с 2 знаками
    return num.toFixed(2) + ' ₽/м²';
};
    
    // Обновляем карточки
    statMedian.textContent = formatPrice(medianPrice);
    statMinMax.textContent = (minPrice > 0 && maxPrice > 0) 
        ? `${formatNumber(minPrice)} / ${formatNumber(maxPrice)} ₽` 
        : '—';
    statUprs.textContent = formatUprs(uprsMedian);
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
function addMapLegend() {
    const oldLegend = document.querySelector('.map-legend');
    if (oldLegend) oldLegend.remove();
    
    const legend = document.createElement('div');
    legend.className = 'map-legend';
    legend.style.cssText = `
        position: absolute;
        bottom: 30px;
        left: 30px;
        background: white;
        padding: 12px 16px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        font-size: 12px;
        font-family: 'Inter', sans-serif;
        z-index: 1000;
        border: 1px solid #e2e8f0;
        min-width: 140px;
    `;
    
    legend.innerHTML = `
        <div style="font-weight:600; font-size:11px; color:#475569; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
            📊 Сделки в квартале
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#22c55e;"></span>
            <span style="color:#475569;">много</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#f59e0b;"></span>
            <span style="color:#475569;">средне</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#ef4444;"></span>
            <span style="color:#475569;">мало</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#f1f5f9; border:1px solid #e2e8f0;"></span>
            <span style="color:#475569;">нет сделок</span>
        </div>
    `;
    
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(legend);
    }
}
// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================
window.initMapTab = initMapTab;
window.destroyMap = destroyMap;
window.renderMapLevel = renderMapLevel;

console.log('✅ map-tab.js загружен');