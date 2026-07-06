let mapInstance = null;
let mapData = null;
let currentLevel = 0;
let currentParentId = null;

const MAP_URL = 'https://mark98molchanov-a11y.github.io/a13y.gko-registry-system/data/yanao_hierarchical_web.geojson';
let dealsData = {};
let dealTypes = {};
let currentDealTypeFilter = null;

const DEALS_CSV_URL = 'https://mark98molchanov-a11y.github.io/a13y.gko-registry-system/data/deals_clean.csv';
async function loadDealsCSV() {
    try {
        console.log('📥 Загрузка CSV с данными о сделках...');
        const response = await fetch(DEALS_CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        
        // Функция для правильного парсинга CSV с кавычками
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        }
        
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            console.warn('⚠️ CSV пустой');
            return;
        }
        
        const headers = parseCSVLine(lines[0]);
        const cadIndex = headers.indexOf('cad_number');
        const kindIndex = headers.indexOf('deal_kind_text');
        const priceIndex = headers.indexOf('deal_price_rub');
        const uprsIndex = headers.indexOf('uprs_rub');
        const areaIndex = headers.indexOf('area');
        
        if (cadIndex === -1 || kindIndex === -1) {
            console.warn('⚠️ Не найдены колонки cad_number или deal_kind_text');
            return;
        }
        
        const dealsByCad = {};
        const typesCount = {};
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < Math.max(cadIndex, kindIndex) + 1) continue;
            
            const cadNum = values[cadIndex] || '';
            const kind = values[kindIndex] || 'nan';  // ← ДОБАВЛЯЕМ 'nan' ДЛЯ ПУСТЫХ
            
            if (!cadNum) continue;
            
            const price = parseFloat(values[priceIndex]) || 0;
            const uprs = parseFloat(values[uprsIndex]) || 0;
            const area = parseFloat(values[areaIndex]) || 0;
            
            if (!dealsByCad[cadNum]) dealsByCad[cadNum] = [];
            dealsByCad[cadNum].push({
                kind: kind,
                price: price,
                uprs: uprs,
                area: area
            });
            
            typesCount[kind] = (typesCount[kind] || 0) + 1;
        }
        
        dealsData = dealsByCad;
        dealTypes = typesCount;
        
        console.log('✅ CSV загружен:', Object.keys(dealsData).length, 'кварталов');
        console.log('📊 Типы сделок:', dealTypes);
        
        renderDealTypeFilters();
        
    } catch (error) {
        console.error('❌ Ошибка загрузки CSV:', error);
        document.getElementById('deal-type-filters').innerHTML = '<div style="color: #ef4444; font-size: 12px; text-align: center; padding: 8px 0;">Ошибка загрузки данных</div>';
    }
}
function renderDealTypeFilters() {
    const container = document.getElementById('deal-type-filters');
    if (!container) return;
    
    const types = Object.keys(dealTypes).sort((a, b) => dealTypes[b] - dealTypes[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px 0;">Нет данных о сделках</div>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
    `;
    
    types.forEach(kind => {
        const count = dealTypes[kind];
        const isActive = currentDealTypeFilter === kind;
        
        html += `
            <tr onclick="applyDealTypeFilter('${kind.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '3px solid #0ea5e9' : '3px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">${kind}</td>
                <td style="padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    // Кнопка "Сбросить фильтр"
    if (currentDealTypeFilter) {
        html += `
            <div onclick="applyDealTypeFilter(null)" 
                 style="
                     text-align: center;
                     padding: 8px;
                     margin-top: 10px;
                     border-top: 1px solid #e2e8f0;
                     font-size: 11px;
                     color: #ef4444;
                     cursor: pointer;
                     font-weight: 500;
                     border-radius: 6px;
                 "
                 onmouseover="this.style.background='#fef2f2'"
                 onmouseout="this.style.background='transparent'">
                ✕ Сбросить фильтр
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function applyDealTypeFilter(kind) {
    currentDealTypeFilter = currentDealTypeFilter === kind ? null : kind;
    renderDealTypeFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    console.log(`🔍 applyDealTypeFilter: level=${level}, parentId=${parentId}, filter=${currentDealTypeFilter}`);
    
    // Получаем объекты для текущего уровня
    let targetObjects = [];
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return fParentId === parentId;
        });
    }
    
    console.log(`📊 targetObjects: ${targetObjects.length} объектов`);
    
    // ✅ ЕСЛИ ФИЛЬТР ВЫКЛЮЧЕН (null)
    if (currentDealTypeFilter === null) {
        if (level === 1) {
            const filtered = mapData.features.filter(f => {
                const props = f.properties;
                if (props.level !== 2) return false;
                if (level === 1) return props.parent_id === '89';
                return false;
            });
            
            const normalQuarters = filtered.filter(f => {
                const cadNum = f.properties?.cadastral_number || '';
                return !cadNum.endsWith('0000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
            });
            
            updateMapStatsFromDeals(level, parentId);
            updateQuartersStyle(targetObjects);
        } else if (level === 2) {
            const filtered = mapData.features.filter(f => {
                const props = f.properties;
                if (props.level !== 2) return false;
                if (parentId) {
                    const belongs = String(props.parent_id) === String(parentId) || 
                                   String(props.district_id) === String(parentId);
                    return belongs;
                }
                return false;
            });
            
            const normalQuarters = filtered.filter(f => {
                const cadNum = f.properties?.cadastral_number || '';
                return !cadNum.endsWith('0000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
            });
            
           updateMapStatsFromDeals(level, parentId);
            updateQuartersStyle(targetObjects);
        }
    } 
    // ✅ ЕСЛИ ФИЛЬТР АКТИВЕН
    else {
        updateMapStatsWithDealFilter(targetObjects, level, parentId);
        updateQuartersStyle(targetObjects);
    }
    
    // ✅ ОБНОВЛЯЕМ ПОПАПЫ И ТУЛТИПЫ ДЛЯ ВСЕХ УРОВНЕЙ
    if (window.mapLayer) {
        window.mapLayer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                const levelName = props.level_name || 'unknown';
                
                if (levelName === 'district') {
                    updateDistrictTooltip(layer, props);
                }
                
                if (levelName === 'quarter') {
                    const newPopupContent = buildPopupContent(layer.feature);
                    layer.bindPopup(newPopupContent, { className: 'custom-popup', maxWidth: 300 });
                }
            }
        });
    }
    
    // ✅ ОБНОВЛЯЕМ ОБЕРТКИ
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const props = layer.feature.properties;
                const cadNum = props.cadastral_number || '—';
                const deals = dealsData[cadNum] || [];
                const filteredDeals = deals.filter(deal => {
                    if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                        return false;
                    }
                    return true;
                });
                
                const dealsCount = filteredDeals.length;
                const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
                const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
                
                function getMedian(arr) {
                    if (arr.length === 0) return 0;
                    const sorted = arr.slice().sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    if (sorted.length % 2 === 0) {
                        return (sorted[mid - 1] + sorted[mid]) / 2;
                    }
                    return sorted[mid];
                }
                
                const medianPrice = getMedian(prices);
                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                const uprsMedian = getMedian(uprsValues);
                
                const popupContent = `
                    <div class="popup-title">${cadNum}</div>
                    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
                    ${dealsCount > 0 ? `
                    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
                    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
                    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
                    ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
                `;
                layer.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 300 });
            }
        });
    }
}


function updateDistrictTooltip(layer, props) {
    const cadNum = props.cadastral_number || props.district_id || '—';
    const districtName = props.district_name || cadNum;
    const displayCad = cadNum !== '—' ? cadNum : props.district_id || '—';
    const districtId = props.district_id || cadNum;
    
    // ✅ 1. Берем кварталы из GeoJSON
    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });
    
    // ✅ 2. ДОБАВЛЯЕМ ОБЕРТКИ ИЗ CSV, КОТОРЫХ НЕТ В GEOJSON
    const prefix = String(districtId).substring(0, 5);
    const allCadNumbers = Object.keys(dealsData);
    const wrapperQuarters = allCadNumbers.filter(cad => {
        // Проверяем, что это обертка (заканчивается на 000000)
        if (!cad.endsWith('000000') && !cad.match(/^\d{2}:\d{2}:000000$/)) return false;
        // Проверяем, что обертка принадлежит этому району
        return String(cad).startsWith(prefix);
    });
    
    // ✅ 3. Объединяем
    const allQuarters = [...districtObjects];
    wrapperQuarters.forEach(cad => {
        allQuarters.push({
            properties: { 
                cadastral_number: cad,
                level: 2,
                district_id: districtId
            }
        });
    });
    
    console.log(`🔄 Район ${districtId}: GeoJSON=${districtObjects.length}, оберток=${wrapperQuarters.length}, всего=${allQuarters.length}`);
    
    // ✅ 4. РАСЧЕТ СТАТИСТИКИ ПО allQuarters
    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    
    allQuarters.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (!cadNumFeature) return;
        
        const deals = dealsData[cadNumFeature] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                return false;
            }
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
            
            if (prices.length > 0) {
                const medianPrice = getMedian(prices);
                const medianUprs = getMedian(uprs);
                
                quarterStats.push({
                    count: filteredDeals.length,
                    medianPrice: medianPrice,
                    medianUprs: medianUprs,
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                });
                
                allMins.push(Math.min(...prices));
                allMaxs.push(Math.max(...prices));
            }
        }
    });
    
    function getMedian(arr) {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    let weightedMedianPrice = 0;
    let weightedMedianUprs = 0;
    let minPrice = 0;
    let maxPrice = 0;
    
    if (quarterStats.length > 0) {
        const sortedByPrice = quarterStats.slice().sort((a, b) => a.medianPrice - b.medianPrice);
        const totalWeight = sortedByPrice.reduce((sum, q) => sum + q.count, 0);
        let cumsum = 0;
        for (const q of sortedByPrice) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianPrice = q.medianPrice;
                break;
            }
        }
        
        const sortedByUprs = quarterStats.slice().sort((a, b) => a.medianUprs - b.medianUprs);
        cumsum = 0;
        for (const q of sortedByUprs) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianUprs = q.medianUprs;
                break;
            }
        }
        
        minPrice = Math.min(...allMins);
        maxPrice = Math.max(...allMaxs);
    }
    
    const formatNum = (num) => num.toLocaleString();
    const formatPrice = (num) => num.toLocaleString() + ' ₽';
    const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
    
    const tooltipContent = `
        <div class="popup-title">📋 ${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
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

function updateMapStatsWithDealFilter(targetObjects, level, parentId) {
    const statMedian = document.getElementById('stat-median');
    const statMinMax = document.getElementById('stat-minmax');
    const statUprs = document.getElementById('stat-uprs');
    const statTotalDeals = document.getElementById('stat-total-deals');
    const statObjects = document.getElementById('stat-objects');
    const statWithDeals = document.getElementById('stat-with-deals');
    
    if (!statMedian || !statMinMax || !statUprs || !statTotalDeals) return;
    
    let allDeals = [];
    
    console.log(`📊 updateMapStatsWithDealFilter: level=${level}, parentId=${parentId}, targetObjects=${targetObjects.length}`);
    
    // ✅ СОБИРАЕМ ТОЛЬКО ТЕ ОБЪЕКТЫ, У КОТОРЫХ ЕСТЬ СДЕЛКИ ПОСЛЕ ФИЛЬТРАЦИИ
    let objectsWithFilteredDeals = [];
    
    if (level === 2 && parentId) {
        // На уровне кварталов - проходим по targetObjects
        targetObjects.forEach(f => {
            const cadNum = f.properties.cadastral_number;
            if (!cadNum) return;
            
            const deals = dealsData[cadNum] || [];
            const filteredDeals = deals.filter(deal => {
                if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                    return false;
                }
                return true;
            });
            
            if (filteredDeals.length > 0) {
                allDeals = allDeals.concat(filteredDeals);
                objectsWithFilteredDeals.push(f);
            }
        });
        console.log(`📊 Кварталы с фильтром в районе: ${objectsWithFilteredDeals.length}, сделок: ${allDeals.length}`);
    } else {
        // На уровне округа или районов - берем все сделки
        Object.keys(dealsData).forEach(cadNum => {
            const deals = dealsData[cadNum] || [];
            const filteredDeals = deals.filter(deal => {
                if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                    return false;
                }
                return true;
            });
            allDeals = allDeals.concat(filteredDeals);
        });
        // Для уровня округа/районов используем все объекты
        objectsWithFilteredDeals = targetObjects;
        console.log(`📊 Все сделки с фильтром: ${allDeals.length}`);
    }
    
    if (allDeals.length === 0) {
        statMedian.textContent = '—';
        statMinMax.textContent = '—';
        statUprs.textContent = '—';
        statTotalDeals.textContent = '0';
        if (statObjects) statObjects.textContent = targetObjects.length;
        if (statWithDeals) statWithDeals.textContent = '0';
        // ✅ ОБНОВЛЯЕМ СПИСОК КВАРТАЛОВ - ПОКАЗЫВАЕМ "Нет сделок"
        updateQuartersListWithFilteredObjects([]);
        return;
    }
    
    // ✅ ВЫЧИСЛЯЕМ СТАТИСТИКУ
    const prices = allDeals.map(d => d.price).filter(p => p > 0).sort((a, b) => a - b);
    const uprsValues = allDeals.map(d => d.uprs).filter(u => u > 0).sort((a, b) => a - b);
    
    function getMedian(arr) {
        if (arr.length === 0) return 0;
        const mid = Math.floor(arr.length / 2);
        if (arr.length % 2 === 0) {
            return (arr[mid - 1] + arr[mid]) / 2;
        }
        return arr[mid];
    }
    
    const medianPrice = getMedian(prices);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const medianUprs = getMedian(uprsValues);
    
    const formatPrice = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    };
    
    const formatNumber = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toLocaleString('ru-RU');
    };
    
    const formatUprs = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toFixed(2) + ' ₽/м²';
    };
    
    statMedian.textContent = formatPrice(medianPrice);
    statMinMax.textContent = (minPrice > 0 && maxPrice > 0) 
        ? `${formatNumber(minPrice)} / ${formatNumber(maxPrice)} ₽` 
        : '—';
    statUprs.textContent = formatUprs(medianUprs);
    statTotalDeals.textContent = allDeals.length.toLocaleString();
    
    if (statObjects) statObjects.textContent = targetObjects.length;
    if (statWithDeals) statWithDeals.textContent = objectsWithFilteredDeals.length;
    
    // ✅ ОБНОВЛЯЕМ СПИСОК КВАРТАЛОВ - ПЕРЕДАЕМ ТОЛЬКО ТЕ, У КОТОРЫХ ЕСТЬ СДЕЛКИ
    updateQuartersListWithFilteredObjects(objectsWithFilteredDeals);
}
function updateMapStatsFromDeals(level, parentId) {
    const statMedian = document.getElementById('stat-median');
    const statMinMax = document.getElementById('stat-minmax');
    const statUprs = document.getElementById('stat-uprs');
    const statTotalDeals = document.getElementById('stat-total-deals');
    const statObjects = document.getElementById('stat-objects');
    const statWithDeals = document.getElementById('stat-with-deals');
    
    if (!statMedian || !statMinMax || !statUprs || !statTotalDeals) return;
    
    // Получаем кварталы для текущего уровня
    let targetObjects = [];
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    // СЧИТАЕМ СТАТИСТИКУ ИЗ dealsData (ЕДИНСТВЕННЫЙ ИСТОЧНИК)
    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    
    targetObjects.forEach(f => {
        const cadNum = f.properties.cadastral_number;
        if (!cadNum) return;
        
        const deals = dealsData[cadNum] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                return false;
            }
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
            
            if (prices.length > 0) {
                quarterStats.push({
                    count: filteredDeals.length,
                    medianPrice: getMedian(prices),
                    medianUprs: getMedian(uprs),
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                });
                allMins.push(Math.min(...prices));
                allMaxs.push(Math.max(...prices));
            }
        }
    });
    
    function getMedian(arr) {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    // ВЗВЕШЕННАЯ МЕДИАНА
    let weightedMedianPrice = 0;
    let weightedMedianUprs = 0;
    let minPrice = 0;
    let maxPrice = 0;
    
    if (quarterStats.length > 0) {
        const sortedByPrice = quarterStats.slice().sort((a, b) => a.medianPrice - b.medianPrice);
        const totalWeight = sortedByPrice.reduce((sum, q) => sum + q.count, 0);
        let cumsum = 0;
        for (const q of sortedByPrice) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianPrice = q.medianPrice;
                break;
            }
        }
        
        const sortedByUprs = quarterStats.slice().sort((a, b) => a.medianUprs - b.medianUprs);
        cumsum = 0;
        for (const q of sortedByUprs) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianUprs = q.medianUprs;
                break;
            }
        }
        
        minPrice = Math.min(...allMins);
        maxPrice = Math.max(...allMaxs);
    }
    
    const formatPrice = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    };
    
    const formatNumber = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toLocaleString('ru-RU');
    };
    
    const formatUprs = (num) => {
        if (num === 0 || isNaN(num)) return '—';
        return num.toFixed(2) + ' ₽/м²';
    };
    
    statMedian.textContent = formatPrice(weightedMedianPrice);
    statMinMax.textContent = (minPrice > 0 && maxPrice > 0) 
        ? `${formatNumber(minPrice)} / ${formatNumber(maxPrice)} ₽` 
        : '—';
    statUprs.textContent = formatUprs(weightedMedianUprs);
    statTotalDeals.textContent = totalDeals.toLocaleString();
    
    if (statObjects) statObjects.textContent = targetObjects.length;
    if (statWithDeals) statWithDeals.textContent = quarterStats.length;
    
    // СПИСОК КВАРТАЛОВ
    const quartersList = document.getElementById('quarters-list');
    if (quartersList) {
        if (quarterStats.length === 0) {
            quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
        } else {
            const sorted = quarterStats.slice().sort((a, b) => b.count - a.count);
            let html = '';
            sorted.forEach(q => {
                const feature = targetObjects.find(f => f.properties.cadastral_number === q.quarter);
                const cadNum = feature ? feature.properties.cadastral_number : '—';
                html += `
                    <div style="padding: 5px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s;" 
                         onclick="window.searchQuarterByCadNumber('${cadNum}')"
                         onmouseover="this.style.background='#f1f5f9'"
                         onmouseout="this.style.background='transparent'">
                        <div style="font-weight: 500; font-size: 12px; color: #1e293b;">${cadNum}</div>
                        <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${q.count.toLocaleString('ru-RU')} сделок</div>
                    </div>
                `;
            });
            quartersList.innerHTML = html;
        }
    }
}
function updateQuartersListWithFilteredObjects(objectsWithDeals) {
    const quartersList = document.getElementById('quarters-list');
    if (!quartersList) return;
    
    if (!objectsWithDeals || objectsWithDeals.length === 0) {
        quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
        return;
    }
    
    // Сортируем по количеству сделок (по убыванию)
    const sorted = objectsWithDeals.slice().sort((a, b) => {
        const countA = getDealsCountForObject(a);
        const countB = getDealsCountForObject(b);
        return countB - countA;
    });
    
    let html = '';
    sorted.forEach(f => {
        const cadNum = f.properties.cadastral_number || '—';
        const count = getDealsCountForObject(f);
        
        html += `
            <div style="padding: 5px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s;" 
                 onclick="window.searchQuarterByCadNumber('${cadNum}')"
                 onmouseover="this.style.background='#f1f5f9'"
                 onmouseout="this.style.background='transparent'">
                <div style="font-weight: 500; font-size: 12px; color: #1e293b;">${cadNum}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${count.toLocaleString('ru-RU')} сделок</div>
            </div>
        `;
    });
    quartersList.innerHTML = html;
}

// ✅ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОДСЧЕТА СДЕЛОК В ОБЪЕКТЕ
function getDealsCountForObject(feature) {
    const cadNum = feature.properties?.cadastral_number;
    if (!cadNum) return 0;
    
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
            return false;
        }
        return true;
    });
    
    return filteredDeals.length;
}

function updateQuartersListWithDealFilter(targetObjects) {
    const quartersList = document.getElementById('quarters-list');
    if (!quartersList) return;
    
    // Собираем кварталы с фильтром
    const quarterStats = [];
    
    targetObjects.forEach(f => {
        const cadNum = f.properties.cadastral_number;
        if (!cadNum) return;
        
        const deals = dealsData[cadNum] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                return false;
            }
            return true;
        });
        
        // ✅ ДОБАВЛЯЕМ ТОЛЬКО ЕСЛИ ЕСТЬ СДЕЛКИ ПОСЛЕ ФИЛЬТРАЦИИ
        if (filteredDeals.length > 0) {
            quarterStats.push({
                cadastral_number: cadNum,
                count: filteredDeals.length
            });
        }
    });
    
    // ✅ ЕСЛИ НЕТ КВАРТАЛОВ С ФИЛЬТРОМ - ПОКАЗЫВАЕМ "Нет сделок"
    if (quarterStats.length === 0) {
        quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
        return;
    }
    
    quarterStats.sort((a, b) => b.count - a.count);
    
    let html = '';
    quarterStats.forEach(q => {
        html += `
            <div style="padding: 5px 0; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s;" 
                 onclick="window.searchQuarterByCadNumber('${q.cadastral_number}')"
                 onmouseover="this.style.background='#f1f5f9'"
                 onmouseout="this.style.background='transparent'">
                <div style="font-weight: 500; font-size: 12px; color: #1e293b;">${q.cadastral_number}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 1px;">${q.count.toLocaleString('ru-RU')} сделок</div>
            </div>
        `;
    });
    quartersList.innerHTML = html;
}



function updateQuartersStyle(targetObjects) {
    if (!window.mapLayer) return;
    
    console.log(`🎨 Обновление стилей кварталов с фильтром: ${currentDealTypeFilter}`);
    
    window.mapLayer.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties) {
            const props = layer.feature.properties;
            const cadNum = props.cadastral_number;
            
            if (!cadNum) return;
            
            // Получаем сделки для этого квартала с учетом фильтра
            const deals = dealsData[cadNum] || [];
            const filteredDeals = deals.filter(deal => {
                if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                    return false;
                }
                return true;
            });
            
            const dealsCount = filteredDeals.length;
            
            // Применяем стиль в зависимости от количества сделок
            const hasDeals = dealsCount > 0;
            const fillColor = hasDeals ? getMapColor(dealsCount) : '#f1f5f9';
            
            layer.setStyle({
                fillColor: fillColor,
                fillOpacity: 0.2,
                color: '#3b82f6',
                weight: 2.5,
                opacity: 0.6,
                dashArray: null
            });
        }
    });
}
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
loadDealsCSV();
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
    // ✅ СОХРАНЯЕМ ТЕКУЩИЙ УРОВЕНЬ ДЛЯ ФИЛЬТРА
    currentLevel = level;
    currentParentId = parentId;
    
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
    clearAllLabels();

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
    const cadNum = feature.properties.cadastral_number || '—';
    
    // ✅ БЕРЕМ ДАННЫЕ ТОЛЬКО ИЗ CSV
    const deals = dealsData[cadNum] || [];
    const dealsCount = deals.length;
    const prices = deals.map(d => d.price).filter(p => p > 0);
    const uprsValues = deals.map(d => d.uprs).filter(u => u > 0);
    
    const medianPrice = prices.length > 0 ? getMedian(prices) : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const uprsMedian = uprsValues.length > 0 ? getMedian(uprsValues) : 0;

layer.bindPopup(`
    <div class="popup-title">${cadNum}</div>
    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
    ${dealsCount > 0 ? `
    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
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
    const cadNum = feature.properties?.cadastral_number;
    const deals = dealsData[cadNum] || [];
    const dealsCount = deals.length;
    const hasDeals = dealsCount > 0;
    return {
        fillColor: hasDeals ? getMapColor(dealsCount) : '#f1f5f9',
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
    
    // ============================================================
    // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ С УЧЕТОМ ФИЛЬТРА
    // ============================================================
    
    // Получаем объекты для текущего уровня
    let targetObjects = [];
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return fParentId === parentId;
        });
    }
    
    // ✅ ЕСЛИ ЕСТЬ ФИЛЬТР - ИСПОЛЬЗУЕМ updateMapStatsWithDealFilter
   updateMapStatsFromDeals(level, parentId);
    
    // ============================================================
    // ✅ ПРИМЕНЯЕМ ФИЛЬТР К ТУЛТИПАМ РАЙОНОВ (ЕСЛИ МЫ НА УРОВНЕ РАЙОНОВ)
    // ============================================================
if (level === 1 && window.mapLayer) {
    window.mapLayer.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties) {
            const props = layer.feature.properties;
            const levelName = props.level_name || 'unknown';
            if (levelName === 'district') {
                updateDistrictTooltip(layer, props);
            }
        }
    });
}

// ============================================================
// ✅ ОБНОВЛЯЕМ ПОПАПЫ КВАРТАЛОВ (ЕСЛИ МЫ НА УРОВНЕ КВАРТАЛОВ)
// ============================================================
if (level === 2 && window.mapLayer) {
    window.mapLayer.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties) {
            const props = layer.feature.properties;
            const levelName = props.level_name || 'unknown';
            if (levelName === 'quarter') {
                const newPopupContent = buildPopupContent(layer.feature);
                layer.bindPopup(newPopupContent, { className: 'custom-popup', maxWidth: 300 });
            }
        }
    });
}
    
    // ============================================================
    // ✅ ДОБАВЛЯЕМ ПОДПИСИ НА ПОЛИГОНЫ (ЗДЕСЬ!)
    // ============================================================
    
    // Для районов (уровень 1)
    if (level === 1 && window.mapLayer) {
        addLabelsToPolygons(window.mapLayer, filtered, level);
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
    
    // ✅ 1. Берем кварталы из GeoJSON
    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });
    
    // ✅ 2. ДОБАВЛЯЕМ ОБЕРТКИ ИЗ CSV
    const prefix = String(districtId).substring(0, 5);
    const allCadNumbers = Object.keys(dealsData);
    const wrapperQuarters = allCadNumbers.filter(cad => {
        if (!cad.endsWith('000000') && !cad.match(/^\d{2}:\d{2}:000000$/)) return false;
        return String(cad).startsWith(prefix);
    });
    
    // ✅ 3. Объединяем
    const allQuarters = [...districtObjects];
    wrapperQuarters.forEach(cad => {
        allQuarters.push({
            properties: { 
                cadastral_number: cad,
                level: 2,
                district_id: districtId
            }
        });
    });
    
    // ✅ 4. РАСЧЕТ СТАТИСТИКИ ПО allQuarters
    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    let allPrices = [];
    let allUprs = [];
    
    allQuarters.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (!cadNumFeature) return;
        
        const deals = dealsData[cadNumFeature] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                return false;
            }
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
            
            allPrices = allPrices.concat(prices);
            allUprs = allUprs.concat(uprs);
            
            if (prices.length > 0) {
                const medianPrice = getMedian(prices);
                const medianUprs = getMedian(uprs);
                
                quarterStats.push({
                    count: filteredDeals.length,
                    medianPrice: medianPrice,
                    medianUprs: medianUprs,
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                });
                
                allMins.push(Math.min(...prices));
                allMaxs.push(Math.max(...prices));
            }
        }
    });
    
    function getMedian(arr) {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    let weightedMedianPrice = 0;
    let weightedMedianUprs = 0;
    let minPrice = 0;
    let maxPrice = 0;
    
    if (quarterStats.length > 0) {
        const sortedByPrice = quarterStats.slice().sort((a, b) => a.medianPrice - b.medianPrice);
        const totalWeight = sortedByPrice.reduce((sum, q) => sum + q.count, 0);
        let cumsum = 0;
        for (const q of sortedByPrice) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianPrice = q.medianPrice;
                break;
            }
        }
        
        const sortedByUprs = quarterStats.slice().sort((a, b) => a.medianUprs - b.medianUprs);
        cumsum = 0;
        for (const q of sortedByUprs) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianUprs = q.medianUprs;
                break;
            }
        }
        
        minPrice = Math.min(...allMins);
        maxPrice = Math.max(...allMaxs);
    }
    
    const formatNum = (num) => num.toLocaleString();
    const formatPrice = (num) => num.toLocaleString() + ' ₽';
    const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
    
    const tooltipContent = `
        <div class="popup-title">📋 ${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
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
    
    // ✅ 1. Берем кварталы из GeoJSON
    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });
    
    // ✅ 2. ДОБАВЛЯЕМ ОБЕРТКИ ИЗ CSV
    const prefix = String(districtId).substring(0, 5);
    const allCadNumbers = Object.keys(dealsData);
    const wrapperQuarters = allCadNumbers.filter(cad => {
        if (!cad.endsWith('000000') && !cad.match(/^\d{2}:\d{2}:000000$/)) return false;
        return String(cad).startsWith(prefix);
    });
    
    // ✅ 3. Объединяем
    const allQuarters = [...districtObjects];
    wrapperQuarters.forEach(cad => {
        allQuarters.push({
            properties: { 
                cadastral_number: cad,
                level: 2,
                district_id: districtId
            }
        });
    });
    
    // ✅ 4. РАСЧЕТ СТАТИСТИКИ ПО allQuarters
    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    
    allQuarters.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (!cadNumFeature) return;
        
        const deals = dealsData[cadNumFeature] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                return false;
            }
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
            
            if (prices.length > 0) {
                const medianPrice = getMedian(prices);
                const medianUprs = getMedian(uprs);
                
                quarterStats.push({
                    count: filteredDeals.length,
                    medianPrice: medianPrice,
                    medianUprs: medianUprs,
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                });
                
                allMins.push(Math.min(...prices));
                allMaxs.push(Math.max(...prices));
            }
        }
    });
    
    function getMedian(arr) {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }
        return sorted[mid];
    }
    
    let weightedMedianPrice = 0;
    let weightedMedianUprs = 0;
    let minPrice = 0;
    let maxPrice = 0;
    
    if (quarterStats.length > 0) {
        const sortedByPrice = quarterStats.slice().sort((a, b) => a.medianPrice - b.medianPrice);
        const totalWeight = sortedByPrice.reduce((sum, q) => sum + q.count, 0);
        let cumsum = 0;
        for (const q of sortedByPrice) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianPrice = q.medianPrice;
                break;
            }
        }
        
        const sortedByUprs = quarterStats.slice().sort((a, b) => a.medianUprs - b.medianUprs);
        cumsum = 0;
        for (const q of sortedByUprs) {
            cumsum += q.count;
            if (cumsum >= totalWeight / 2) {
                weightedMedianUprs = q.medianUprs;
                break;
            }
        }
        
        minPrice = Math.min(...allMins);
        maxPrice = Math.max(...allMaxs);
    }
    
    return `
        <div class="popup-title">📋 ${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${totalDeals.toLocaleString()}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${weightedMedianPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${weightedMedianUprs.toFixed(2)} ₽/м²</span></div>
        ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
    `;
}
    if (levelName === 'quarter') {
        const cadNum = props.cadastral_number || '—';
        
        // ✅ БЕРЕМ СДЕЛКИ ИЗ dealsData (С УЧЕТОМ ФИЛЬТРА)
        const deals = dealsData[cadNum] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                return false;
            }
            return true;
        });
        
        const dealsCount = filteredDeals.length;
        const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
        const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
        
        function getMedian(arr) {
            if (arr.length === 0) return 0;
            const sorted = arr.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            if (sorted.length % 2 === 0) {
                return (sorted[mid - 1] + sorted[mid]) / 2;
            }
            return sorted[mid];
        }
        
        const medianPrice = getMedian(prices);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const uprsMedian = getMedian(uprsValues);
        
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
// ============================================================
function updateBreadcrumb(level, id, name, isSearch = false) {
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
        // ✅ ЕСЛИ ЭТО ПОИСК - НЕ ПОКАЗЫВАЕМ "Кварталы"
        if (isSearch) {
            breadcrumb.innerHTML = `
                <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">🏛️ ЯНАО</span>
                <span style="color:#94a3b8; margin:0 4px;">›</span>
                <span style="font-weight:600; font-size:0.95rem;">${districtName}</span>
            `;
        } else {
            breadcrumb.innerHTML = `
                <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">🏛️ ЯНАО</span>
                <span style="color:#94a3b8; margin:0 4px;">›</span>
                <span onclick="renderMapLevel(1)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">${districtName}</span>
                <span style="color:#94a3b8; margin:0 4px;">›</span>
                <span style="font-weight:600; font-size:0.95rem;">Кварталы</span>
            `;
        }
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
function addLabelsToPolygons(layer, features, level) {
    if (!layer || !features) return;
    
    // ✅ ТОЛЬКО ДЛЯ РАЙОНОВ (уровень 1)
    if (level !== 1) return;
    
    // Удаляем старые подписи районов
    if (window.districtLabels) {
        window.districtLabels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.districtLabels = [];
    }
    
    // Берем только районы
    const districtFeatures = features.filter(f => f.properties.level === 1);
    
    // Массив для хранения подписей
    const labels = [];
    
    // Добавляем подписи
    districtFeatures.forEach(feature => {
        const props = feature.properties;
        const cadNum = props.district_id || props.cadastral_number || '';
        
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
        
        // ✅ ТОЛЬКО ТЕКСТ, БЕЗ ФОНА И РАМКИ
        const label = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'map-polygon-label',
                html: `<div style="
                    font-size: 13px;
                    font-weight: 700;
                    color: #1e293b;
                    text-shadow: 0 0 8px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.8);
                    white-space: nowrap;
                    pointer-events: none;
                    user-select: none;
                    letter-spacing: 0.5px;
                    background: none;
                    padding: 0;
                    border: none;
                    backdrop-filter: none;
                ">${cadNum}</div>`,
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            }),
            interactive: false
        }).addTo(mapInstance);
        
        labels.push(label);
    });
    
    // Сохраняем подписи в глобальную переменную
    window.districtLabels = labels;
}
function clearAllLabels() {
    // Очищаем подписи районов
    if (window.districtLabels) {
        window.districtLabels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.districtLabels = [];
    }
    
    // Очищаем подписи кварталов
    if (window.quarterLabels) {
        window.quarterLabels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.quarterLabels = [];
    }
    
    // Очищаем подписи в слоях
    if (window.mapLayer && window.mapLayer._labels) {
        window.mapLayer._labels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.mapLayer._labels = [];
    }
    
    if (window.wrapperLayer && window.wrapperLayer._labels) {
        window.wrapperLayer._labels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.wrapperLayer._labels = [];
    }
}
function searchQuarter() {
    const input = document.getElementById('quarter-search-input');
    if (!input) return;
    
    const query = input.value.trim();
    if (!query) {
        input.style.borderColor = '#ef4444';
        input.style.background = '#fef2f2';
        setTimeout(() => {
            input.style.borderColor = '#e2e8f0';
            input.style.background = '#f8fafc';
        }, 1500);
        return;
    }
    
    console.log(`🔍 Поиск квартала: ${query}`);
    
    // Ищем квартал по кадастровому номеру (level === 2)
    const found = mapData.features.find(f => {
        if (f.properties.level !== 2) return false;
        const cadNum = f.properties.cadastral_number || '';
        return cadNum.toLowerCase().includes(query.toLowerCase());
    });
    
   if (!found) {
        console.log(`❌ Квартал "${query}" не найден`);
        input.style.borderColor = '#ef4444';
        input.style.background = '#fef2f2';
        setTimeout(() => {
            input.style.borderColor = '#e2e8f0';
            input.style.background = '#f8fafc';
        }, 2000);
        // ✅ НИЧЕГО НЕ ДЕЛАЕМ, КАРТА ОСТАЕТСЯ КАК БЫЛА
        return;
    }
    
    console.log(`✅ Найден квартал: ${found.properties.cadastral_number}`);
    input.style.borderColor = '#22c55e';
    input.style.background = '#f0fdf4';
    setTimeout(() => {
        input.style.borderColor = '#e2e8f0';
        input.style.background = '#f8fafc';
    }, 1500);
    
    // Определяем район (parent_id)
    const districtId = found.properties.parent_id || found.properties.district_id;
    const districtName = found.properties.district_name || districtId || 'Район';
    
    // Переходим на уровень кварталов с этим районом
    renderMapLevel(2, districtId);
    updateBreadcrumb('quarter', districtId, districtName, true);
    
    // Подсвечиваем найденный квартал
    setTimeout(() => {
        if (window.mapLayer) {
            window.mapLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    const cadNum = layer.feature.properties.cadastral_number || '';
                    if (cadNum === found.properties.cadastral_number) {
                        // ✅ ТОЛЬКО ПОПАП И ЦЕНТРИРОВКА, БЕЗ ЗЕЛЕНОГО ВЫДЕЛЕНИЯ
                        layer.openPopup();
                        if (layer.getBounds && layer.getBounds().isValid()) {
                            mapInstance.fitBounds(layer.getBounds(), { padding: [40, 40] });
                        }
                    }
                }
            });
        }
    }, 300);
}
function searchQuarterByCadNumber(cadNumber) {
    if (!cadNumber) return;
    
    console.log(`🔍 Поиск квартала по номеру: ${cadNumber}`);
    
    // Ищем квартал по точному кадастровому номеру
    const found = mapData.features.find(f => {
        if (f.properties.level !== 2) return false;
        return f.properties.cadastral_number === cadNumber;
    });
    
    if (!found) {
        console.log(`❌ Квартал "${cadNumber}" не найден`);
        return;
    }
    
    console.log(`✅ Найден квартал: ${found.properties.cadastral_number}`);
    
    // Определяем район (parent_id)
    const districtId = found.properties.parent_id || found.properties.district_id;
    const districtName = found.properties.district_name || districtId || 'Район';
    
    // Переходим на уровень кварталов с этим районом
    renderMapLevel(2, districtId);
    updateBreadcrumb('quarter', districtId, districtName, true);
    
    // Показываем попап и центрируем на квартале
    setTimeout(() => {
        if (window.mapLayer) {
            window.mapLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    if (layer.feature.properties.cadastral_number === cadNumber) {
                        layer.openPopup();
                        if (layer.getBounds && layer.getBounds().isValid()) {
                            mapInstance.fitBounds(layer.getBounds(), { padding: [40, 40] });
                        }
                    }
                }
            });
        }
    }, 300);
}
// ============================================================
// ЭКСПОРТ ФУНКЦИЙ
// ============================================================
window.initMapTab = initMapTab;
window.destroyMap = destroyMap;
window.renderMapLevel = renderMapLevel;
window.searchQuarter = searchQuarter;
window.searchQuarterByCadNumber = searchQuarterByCadNumber; 
console.log('✅ map-tab.js загружен');