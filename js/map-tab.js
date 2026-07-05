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
    zoomControl: true,
    boxZoom: false 
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

    // ✅ СБРАСЫВАЕМ ВЫДЕЛЕНИЕ ПРИ ПЕРЕХОДЕ НА КВАРТАЛЫ
    if (level === 2) {
        mapInstance.eachLayer(function(layer) {
            if (layer.setStyle && layer.options && layer.options.weight) {
                layer.setStyle({
                    weight: 1,
                    color: '#ff0000',
                    opacity: 0.4,
                    fillOpacity: 0.25
                });
            }
        });
    }

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
                    fillOpacity: 0.25,
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
                    weight: 2.5,
                    opacity: 0.6,
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

    // Сбрасываем выделение при переходе
    if (window.wrapperLayer) {
        window.wrapperLayer.setStyle({
            fillOpacity: 0.25,
            weight: 1,
            color: '#ff0000',
            opacity: 0.4,
            dashArray: '4 4'
        });
    }
    
    // Обновляем статистику (без оберток)
    updateMapStats(normalQuarters, level, parentId);
    
    // ============================================================
    // ✅ ДОБАВЛЯЕМ ПОДПИСИ ЗДЕСЬ (ПОСЛЕ updateMapStats)
    // ============================================================
    
    // Подписи для районов (уровень 1)
    if (level === 1) {
        addDistrictLabels();
    }
    
    // Подписи для кварталов (уровень 2)
    if (level === 2 && window.mapLayer) {
        // Удаляем старые подписи кварталов
        if (window.mapLayer._labels) {
            window.mapLayer._labels.forEach(label => {
                if (mapInstance) mapInstance.removeLayer(label);
            });
            window.mapLayer._labels = [];
        }
        addLabelsToLayer(window.mapLayer, normalQuarters, level);
    }
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
    
 if (levelName === 'district') {
    const cadNum = props.cadastral_number || props.district_id || '—';
    const districtName = props.district_name || cadNum;
    const displayCad = cadNum !== '—' ? cadNum : props.district_id || '—';
    const districtId = props.district_id || cadNum;
    
    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return fParentId === districtId || f.properties.district_id === districtId;
    });
    
    let totalDeals = 0;
    let allPrices = [];
    let allMins = [];
    let allMaxs = [];
    let allUprs = [];
    
    districtObjects.forEach(f => {
        const count = f.properties.deals_count || 0;
        const median = f.properties.deals_median || 0;
        const min = f.properties.deals_min || 0;
        const max = f.properties.deals_max || 0;
        const uprs = f.properties.uprs_median || 0;
        
        if (count > 0 && median > 0) {
            totalDeals += count;
            allPrices.push({ value: median, weight: count });
            allMins.push(min);
            allMaxs.push(max);
            allUprs.push({ value: uprs, weight: count });
        }
    });
    
    function getWeightedMedian(arr, totalWeight) {
        if (arr.length === 0 || totalWeight === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a.value - b.value);
        let cumulative = 0;
        const halfWeight = totalWeight / 2;
        for (let i = 0; i < sorted.length; i++) {
            cumulative += sorted[i].weight;
            if (cumulative >= halfWeight) {
                return sorted[i].value;
            }
        }
        return sorted[sorted.length - 1].value;
    }
    
    const totalPriceWeight = allPrices.reduce((sum, p) => sum + p.weight, 0);
    const totalUprsWeight = allUprs.reduce((sum, p) => sum + p.weight, 0);
    
    const medianPrice = getWeightedMedian(allPrices, totalPriceWeight);
    const minPrice = allMins.length > 0 ? Math.min(...allMins) : 0;
    const maxPrice = allMaxs.length > 0 ? Math.max(...allMaxs) : 0;
    const uprsMedian = getWeightedMedian(allUprs, totalUprsWeight);
    
    const formatNum = (num) => num.toLocaleString();
    const formatPrice = (num) => num.toLocaleString() + ' ₽';
    const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
    
    const tooltipContent = `
        <div class="popup-title">📋 ${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(medianPrice)}</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(uprsMedian)}</span></div>
        ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
    `;
    
    layer.bindTooltip(tooltipContent, {
        className: 'custom-popup',
        permanent: false,
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
        sticky: true,
        interactive: false
    });
}

    // ===== 🖱️ КЛИК =====
    layer.on('click', function(e) {
        if (levelName === 'okrug') {
            renderMapLevel(1);
            updateBreadcrumb('okrug');
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
            }
       }  else if (levelName === 'district') {
    // ✅ СНАЧАЛА СБРАСЫВАЕМ ВЫДЕЛЕНИЕ
    // Сбрасываем стиль текущего слоя (района)
    if (layer && layer.setStyle) {
        layer.setStyle({
            weight: 2.5,
            color: '#2563eb',
            opacity: 0.7,
            fillOpacity: 0.3
        });
    }
    
    // Сбрасываем обертку
    if (window.wrapperLayer) {
        window.wrapperLayer.setStyle({
            fillOpacity: 0.25,
            weight: 1,
            color: '#ff0000',
            opacity: 0.4,
            dashArray: '4 4'
        });
    }
    
    // Сбрасываем все слои на карте
    mapInstance.eachLayer(function(layer) {
        if (layer.setStyle && layer.options && layer.options.weight) {
            layer.setStyle({
                weight: 1,
                color: '#ff0000',
                opacity: 0.4,
                fillOpacity: 0.25
            });
        }
    });
    
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
                weight: 2.5,
                color: '#60a5fa',
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
                weight: 2.5,
                opacity: 0.4
            };
        } else if (level === 1) {
            style = {
                fillColor: getMapColor(price),
                fillOpacity: 0.3,
                color: '#2563eb',
                weight: 2.5,
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
    const cadNum = props.cadastral_number || props.district_id || '—';
    const districtName = props.district_name || cadNum;
    const displayCad = cadNum !== '—' ? cadNum : props.district_id || '—';
    const districtId = props.district_id || cadNum;
    
    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return fParentId === districtId || f.properties.district_id === districtId;
    });
    
    let totalDeals = 0;
    let allMedians = [];
    let allMins = [];
    let allMaxs = [];
    let allUprs = [];
    
    districtObjects.forEach(f => {
        const count = f.properties.deals_count || 0;
        if (count > 0) {
            totalDeals += count;
            if (f.properties.deals_median > 0) allMedians.push(f.properties.deals_median);
            if (f.properties.deals_min > 0) allMins.push(f.properties.deals_min);
            if (f.properties.deals_max > 0) allMaxs.push(f.properties.deals_max);
            if (f.properties.uprs_median > 0) allUprs.push(f.properties.uprs_median);
        }
    });
    
    const medianPrice = allMedians.length > 0 ? allMedians.reduce((a,b) => a + b, 0) / allMedians.length : 0;
    const minPrice = allMins.length > 0 ? Math.min(...allMins) : 0;
    const maxPrice = allMaxs.length > 0 ? Math.max(...allMaxs) : 0;
    const uprsMedian = allUprs.length > 0 ? allUprs.reduce((a,b) => a + b, 0) / allUprs.length : 0;
    
    return `
        <div class="popup-title">📋 ${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${totalDeals.toLocaleString()}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
        ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
    `;
}

    
if (levelName === 'quarter') {
    const cadNum = props.cadastral_number || '—';
    const dealsCount = props.deals_count || 0;
    
    // ✅ Пересчитываем взвешенную медиану для квартала
    let allPrices = [];
    let allMins = [];
    let allMaxs = [];
    let allUprs = [];
    
    if (dealsCount > 0) {
        const median = props.deals_median || 0;
        const min = props.deals_min || 0;
        const max = props.deals_max || 0;
        const uprs = props.uprs_median || 0;
        
        if (median > 0) {
            // Добавляем с весом = количество сделок
            allPrices.push({ value: median, weight: dealsCount });
            allMins.push(min);
            allMaxs.push(max);
            allUprs.push({ value: uprs, weight: dealsCount });
        }
    }
    
    function getWeightedMedian(arr, totalWeight) {
        if (arr.length === 0 || totalWeight === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a.value - b.value);
        let cumulative = 0;
        const halfWeight = totalWeight / 2;
        for (let i = 0; i < sorted.length; i++) {
            cumulative += sorted[i].weight;
            if (cumulative >= halfWeight) {
                return sorted[i].value;
            }
        }
        return sorted[sorted.length - 1].value;
    }
    
    const totalPriceWeight = allPrices.reduce((sum, p) => sum + p.weight, 0);
    const totalUprsWeight = allUprs.reduce((sum, p) => sum + p.weight, 0);
    
    const medianPrice = getWeightedMedian(allPrices, totalPriceWeight);
    const minPrice = allMins.length > 0 ? Math.min(...allMins) : 0;
    const maxPrice = allMaxs.length > 0 ? Math.max(...allMaxs) : 0;
    const uprsMedian = getWeightedMedian(allUprs, totalUprsWeight);
    
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
    
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return fParentId === parentId;
        });
    }
    
    const objectsWithDeals = targetObjects.filter(f => (f.properties.deals_count || 0) > 0);
    
    if (objectsWithDeals.length > 0) {
        totalDeals = objectsWithDeals.reduce((sum, f) => sum + (f.properties.deals_count || 0), 0);
        
        // ✅ Оптимизированный расчет истинной медианы (без раздувания массива)
        let allPrices = [];
        let allMins = [];
        let allMaxs = [];
        let allUprs = [];
        
        objectsWithDeals.forEach(f => {
            const count = f.properties.deals_count || 0;
            const median = f.properties.deals_median || 0;
            const min = f.properties.deals_min || 0;
            const max = f.properties.deals_max || 0;
            const uprs = f.properties.uprs_median || 0;
            
            if (count > 0 && median > 0) {
                // ✅ Добавляем только медиану (по 1 разу на объект) + вес = количество сделок
                allPrices.push({ value: median, weight: count });
                allMins.push(min);
                allMaxs.push(max);
                allUprs.push({ value: uprs, weight: count });
            }
        });
        
        // ✅ Функция для вычисления взвешенной медианы
        function getWeightedMedian(arr, totalWeight) {
            if (arr.length === 0 || totalWeight === 0) return 0;
            const sorted = arr.slice().sort((a, b) => a.value - b.value);
            let cumulative = 0;
            const halfWeight = totalWeight / 2;
            for (let i = 0; i < sorted.length; i++) {
                cumulative += sorted[i].weight;
                if (cumulative >= halfWeight) {
                    return sorted[i].value;
                }
            }
            return sorted[sorted.length - 1].value;
        }
        
        const totalPriceWeight = allPrices.reduce((sum, p) => sum + p.weight, 0);
        const totalUprsWeight = allUprs.reduce((sum, p) => sum + p.weight, 0);
        
        medianPrice = getWeightedMedian(allPrices, totalPriceWeight);
        minPrice = allMins.length > 0 ? Math.min(...allMins) : 0;
        maxPrice = allMaxs.length > 0 ? Math.max(...allMaxs) : 0;
        uprsMedian = getWeightedMedian(allUprs, totalUprsWeight);
    }
    
    const formatPrice = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        if (Number.isInteger(num)) {
            return num.toLocaleString('ru-RU') + ' ₽';
        }
        return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
    };

    const formatNumber = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        if (Number.isInteger(num)) {
            return num.toLocaleString('ru-RU');
        }
        return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatUprs = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toFixed(2) + ' ₽/м²';
    };
    
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
        min-width: 160px;
    `;
    
    legend.innerHTML = `
        <div style="font-weight:600; font-size:11px; color:#475569; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
            📊 Сделки в квартале
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#22c55e;"></span>
            <span style="color:#475569;">> 500 сделок</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#f59e0b;"></span>
            <span style="color:#475569;">101 – 500</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#ef4444;"></span>
            <span style="color:#475569;">1 – 100</span>
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
function addLabelsToLayer(layer, features, level) {
    if (!layer) return;
    
    // Удаляем старые подписи
    if (layer._labels) {
        layer._labels.forEach(label => {
            if (mapInstance && label) {
                mapInstance.removeLayer(label);
            }
        });
        layer._labels = [];
    }
    
    // Определяем, какие объекты подписывать
    let labelFeatures = features;
    
    // Для уровня кварталов - подписываем кварталы
    if (level === 2) {
        labelFeatures = features.filter(f => f.properties.level === 2);
    }
    
    // Добавляем подписи
    labelFeatures.forEach(feature => {
        const props = feature.properties;
        const cadNum = props.cadastral_number || props.district_id || '';
        
        // Показываем только если есть номер
        if (!cadNum) return;
        
        // Находим центр полигона
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length === 0) return;
        
        // Вычисляем центр (среднее по координатам)
        let lat = 0, lng = 0;
        coords.forEach(coord => {
            lat += coord[1];
            lng += coord[0];
        });
        lat /= coords.length;
        lng /= coords.length;
        
        // Создаем маркер с текстом
        const label = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'map-label',
                html: `<div style="
                    background: rgba(255,255,255,0.85);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: 500;
                    color: #475569;
                    border: 1px solid #cbd5e1;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    white-space: nowrap;
                    pointer-events: none;
                    text-shadow: 0 1px 2px rgba(255,255,255,0.8);
                ">${cadNum}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            }),
            interactive: false
        }).addTo(mapInstance);
        
        // Сохраняем ссылку для удаления
        if (!layer._labels) layer._labels = [];
        layer._labels.push(label);
    });
}

// ============================================================
// ДОБАВЛЕНИЕ ПОДПИСЕЙ ДЛЯ РАЙОНОВ
// ============================================================

function addDistrictLabels() {
    // Удаляем старые подписи районов
    if (window.districtLabels) {
        mapInstance.removeLayer(window.districtLabels);
        window.districtLabels = null;
    }
    
    // Находим все районы (level === 1)
    const districts = mapData.features.filter(f => f.properties.level === 1);
    if (districts.length === 0) return;
    
    const labelGroup = L.layerGroup().addTo(mapInstance);
    window.districtLabels = labelGroup;
    
    districts.forEach(feature => {
        const props = feature.properties;
        const districtName = props.district_name || props.cadastral_number || '';
        if (!districtName) return;
        
        // Находим центр полигона
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length === 0) return;
        
        let lat = 0, lng = 0;
        coords.forEach(coord => {
            lat += coord[1];
            lng += coord[0];
        });
        lat /= coords.length;
        lng /= coords.length;
        
        // Создаем подпись района
        const label = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'district-label',
                html: `<div style="
                    background: rgba(255,255,255,0.9);
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 700;
                    color: #0f172a;
                    border: 2px solid #334155;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    white-space: nowrap;
                    pointer-events: none;
                    text-shadow: 0 1px 2px rgba(255,255,255,0.9);
                ">${districtName}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            }),
            interactive: false
        }).addTo(labelGroup);
    });
}
// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================
window.initMapTab = initMapTab;
window.destroyMap = destroyMap;
window.renderMapLevel = renderMapLevel;

console.log('✅ map-tab.js загружен');