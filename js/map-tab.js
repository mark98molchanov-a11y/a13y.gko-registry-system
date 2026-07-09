 let mapData = null;
let currentLevel = 0;
let currentParentId = null;

const MAP_URL = 'https://mark98molchanov-a11y.github.io/a13y.gko-registry-system/data/yanao_hierarchical_web.geojson';
let dealsData = {};
let dealTypes = {};
let cityTypes = {};
let objectTypes = {};
let wallMaterialTypes = {}; 
let quarterTypes = {}; 
let yearBuildTypes = {};
let currentDealTypeFilter = null;
let currentCityFilter = null;  
let currentObjectTypeFilter = null;
let currentWallMaterialFilter = null; 
let currentQuarterFilter = null;
let currentYearBuildFilter = null;
let allDealsFlat = []; 

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
        const cityIndex = headers.indexOf('city');
        const priceIndex = headers.indexOf('deal_price_rub');
        const uprsIndex = headers.indexOf('uprs_rub');
        const upksIndex = headers.indexOf('upks'); 
        const areaIndex = headers.indexOf('area');
        const objKindIndex = headers.indexOf('obj_kind_text');
        const wallMaterialIndex = headers.indexOf('wall_material_name');
        const quarterIndex = headers.indexOf('Квартал сделки');
        const yearBuildIndex = headers.indexOf('year_build');  
        const purposeIndex = headers.indexOf('purpose_text'); 
const vriIndex = headers.indexOf('vri');  
const cadCostIndex = headers.indexOf('cad_cost'); 
        
        if (cadIndex === -1 || kindIndex === -1) {
            console.warn('⚠️ Не найдены колонки cad_number или deal_kind_text');
            return;
        }
        
        const dealsByCad = {};
        const typesCount = {};
        const citiesCount = {}; 
        const objectTypesCount = {};
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < Math.max(cadIndex, kindIndex) + 1) continue;
            
            const cadNum = values[cadIndex] || '';
            const kind = values[kindIndex] || 'nan';
            const city = values[cityIndex] || 'nan'; 
            const objKind = values[objKindIndex] || 'nan';
            const wallMaterial = values[wallMaterialIndex] || 'nan';
            const quarter = values[quarterIndex] || 'nan'; 
            const yearBuild = values[yearBuildIndex] || 'nan';  
            const purposeText = values[purposeIndex] || 'nan';   // ✅ ДОБАВИТЬ
    const vri = values[vriIndex] || 'nan';       
            
            if (!cadNum) continue;
            
            const price = parseFloat(values[priceIndex]) || 0;
            const uprs = parseFloat(values[uprsIndex]) || 0;
            const upks = parseFloat(values[upksIndex]) || 0;  
            const area = parseFloat(values[areaIndex]) || 0;
            const cadCost = parseFloat(values[cadCostIndex]) || 0;
              
     allDealsFlat.push({
    cad_number: cadNum,
    area: area,
    purpose_text: purposeText,
    cad_cost: cadCost,
    upks: upks,           // ✅ Теперь это УПКС (из колонки upks)
    uprs: uprs,           // ✅ Добавляем УПРС отдельно
    city: city,
    deal_kind_text: kind,
    obj_kind_text: objKind,
    vri: vri,
    quarter: quarter,
    year_build: yearBuild,
    wall_material_name: wallMaterial,
    deal_price_rub: price,
    uprs_rub: uprs
});
            
            if (!dealsByCad[cadNum]) dealsByCad[cadNum] = [];
            dealsByCad[cadNum].push({
                kind: kind,
                price: price,
                uprs: uprs,
                area: area,
                city: city,
                obj_kind: objKind,
                wall_material: wallMaterial,
                quarter: quarter,
                year_build: yearBuild
            });
            
            typesCount[kind] = (typesCount[kind] || 0) + 1;
citiesCount[city] = (citiesCount[city] || 0) + 1;
objectTypesCount[objKind] = (objectTypesCount[objKind] || 0) + 1;
wallMaterialTypes[wallMaterial] = (wallMaterialTypes[wallMaterial] || 0) + 1;
quarterTypes[quarter] = (quarterTypes[quarter] || 0) + 1;
yearBuildTypes[yearBuild] = (yearBuildTypes[yearBuild] || 0) + 1; 
        }
        
        dealsData = dealsByCad;
        dealTypes = typesCount;
        cityTypes = citiesCount; 
        objectTypes = objectTypesCount;
        console.log('✅ CSV загружен:', Object.keys(dealsData).length, 'кварталов');
        console.log('📊 Типы сделок:', dealTypes);
        
        renderDealTypeFilters();
        renderCityFilters();
        renderObjectTypeFilters();
        renderWallMaterialFilters();
        renderQuarterFilters();
        renderYearBuildFilters();
         renderDealsTable(); 
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
    


    
    container.innerHTML = html;
}
function renderCityFilters() {
    const container = document.getElementById('city-filters');
    if (!container) return;
    
    const cities = Object.keys(cityTypes).sort((a, b) => cityTypes[b] - cityTypes[a]);
    
    if (cities.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px 0;">Нет данных о городах</div>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
    `;
    
    cities.forEach(city => {
        const count = cityTypes[city];
        const isActive = currentCityFilter === city;
        
        html += `
            <tr onclick="applyCityFilter('${city.replace(/'/g, "\\'")}')" 
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
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">${city}</td>
                <td style="padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    
    container.innerHTML = html;
}
function renderObjectTypeFilters() {
    const container = document.getElementById('object-type-filters');
    if (!container) return;
    
    const types = Object.keys(objectTypes).sort((a, b) => objectTypes[b] - objectTypes[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px 0;">Нет данных о типах объектов</div>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = objectTypes[type];
        const isActive = currentObjectTypeFilter === type;
        
        html += `
            <tr onclick="applyObjectTypeFilter('${type.replace(/'/g, "\\'")}')" 
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
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">${type}</td>
                <td style="padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function renderWallMaterialFilters() {
    const container = document.getElementById('wall-material-filters');
    if (!container) return;
    
    const types = Object.keys(wallMaterialTypes).sort((a, b) => wallMaterialTypes[b] - wallMaterialTypes[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px 0;">Нет данных о материалах стен</div>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = wallMaterialTypes[type];
        const isActive = currentWallMaterialFilter === type;
        
        html += `
            <tr onclick="applyWallMaterialFilter('${type.replace(/'/g, "\\'")}')" 
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
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">${type}</td>
                <td style="padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function renderQuarterFilters() {
    const container = document.getElementById('quarter-filters');
    if (!container) return;
    
    // Функция для парсинга квартала
    function parseQuarter(quarter) {
        if (quarter === 'nan') return { year: 0, q: 0, sortKey: 0 };
        const parts = quarter.split('/');
        if (parts.length === 2) {
            const year = parseInt(parts[0]);
            const q = parseInt(parts[1].replace('Q', ''));
            if (!isNaN(year) && !isNaN(q)) {
                return { year, q, sortKey: year * 10 + q };
            }
        }
        return { year: 0, q: 0, sortKey: 0 };
    }
    
    // ✅ СОРТИРОВКА ОТ НОВЫХ К СТАРЫМ
    const types = Object.keys(quarterTypes).sort((a, b) => {
        if (a === 'nan') return 1;
        if (b === 'nan') return -1;
        
        const aParsed = parseQuarter(a);
        const bParsed = parseQuarter(b);
        return bParsed.sortKey - aParsed.sortKey;  // от новых к старым
    });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px 0;">Нет данных о кварталах сделок</div>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = quarterTypes[type];
        const isActive = currentQuarterFilter === type;
        
        html += `
            <tr onclick="applyQuarterFilter('${type.replace(/'/g, "\\'")}')" 
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
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">${type}</td>
                <td style="padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function renderYearBuildFilters() {
    const container = document.getElementById('year-build-filters');
    if (!container) return;
    
    // Сортировка от новых к старым (по убыванию года)
    const types = Object.keys(yearBuildTypes).sort((a, b) => {
        if (a === 'nan') return 1;
        if (b === 'nan') return -1;
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return bNum - aNum;  // от новых к старым
    });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 12px 0;">Нет данных о годе постройки</div>';
        return;
    }
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = yearBuildTypes[type];
        const isActive = currentYearBuildFilter === type;
        
        html += `
            <tr onclick="applyYearBuildFilter('${type.replace(/'/g, "\\'")}')" 
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
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9;">${type}</td>
                <td style="padding: 5px 8px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function applyDealTypeFilter(kind) {
    // Если кликнули на тот же тип - сбрасываем фильтр
    if (currentDealTypeFilter === kind) {
        currentDealTypeFilter = null;
    } else {
        currentDealTypeFilter = kind;
    }
    
    // ✅ ВСЕГДА ПЕРЕРИСОВЫВАЕМ ФИЛЬТРЫ
    renderDealTypeFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    console.log(`🔍 applyDealTypeFilter: level=${level}, parentId=${parentId}, filter=${currentDealTypeFilter}`);
    
    // ✅ ОБНОВЛЯЕМ СТИЛИ КВАРТАЛОВ
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    updateQuartersStyle(targetObjects);
    
    // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ С УЧЕТОМ ФИЛЬТРА
    updateMapStatsFromDeals(level, parentId);
    
    // ✅ ВСЕГДА ОБНОВЛЯЕМ ПОПАПЫ И ТУЛТИПЫ
    updatePopupsAndTooltips(level);
    
    // ✅ ВСЕГДА ОБНОВЛЯЕМ СПИСОК КВАРТАЛОВ
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    // ✅ ОБНОВЛЯЕМ ТУЛТИП ОБЕРТКИ ПРИ СМЕНЕ ФИЛЬТРА
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function applyCityFilter(city) {
    // Если кликнули на тот же город - сбрасываем фильтр
    if (currentCityFilter === city) {
        currentCityFilter = null;
    } else {
        currentCityFilter = city;
    }
    
    // Перерисовываем фильтры
    renderCityFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    console.log(`🔍 applyCityFilter: level=${level}, parentId=${parentId}, filter=${currentCityFilter}`);
    
    // Обновляем стили кварталов
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    updateQuartersStyle(targetObjects);
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level);
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    // Обновляем тултипы оберток
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function applyObjectTypeFilter(type) {
    if (currentObjectTypeFilter === type) {
        currentObjectTypeFilter = null;
    } else {
        currentObjectTypeFilter = type;
    }
    
    renderObjectTypeFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    updateQuartersStyle(targetObjects);
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level);
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function applyWallMaterialFilter(type) {
    if (currentWallMaterialFilter === type) {
        currentWallMaterialFilter = null;
    } else {
        currentWallMaterialFilter = type;
    }
    
    renderWallMaterialFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    updateQuartersStyle(targetObjects);
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level);
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function applyQuarterFilter(type) {
    if (currentQuarterFilter === type) {
        currentQuarterFilter = null;
    } else {
        currentQuarterFilter = type;
    }
    
    renderQuarterFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    updateQuartersStyle(targetObjects);
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level);
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function applyYearBuildFilter(type) {
    if (currentYearBuildFilter === type) {
        currentYearBuildFilter = null;
    } else {
        currentYearBuildFilter = type;
    }
    
    renderYearBuildFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    updateQuartersStyle(targetObjects);
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level);
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function updateDistrictTooltip(layer, props) {
    // ✅ ПРОСТО ПЕРЕСОЗДАЕМ ТУЛТИП ЧЕРЕЗ buildDistrictTooltipContent
    const tooltipContent = buildDistrictTooltipContent(layer);
    if (tooltipContent) {
        layer.unbindTooltip();
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
}
function getDealsCountForObject(feature) {
    const cadNum = feature.properties?.cadastral_number;
    if (!cadNum) return 0;
    
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
            return false;
        }
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
            return false;
        }
        // ✅ НОВЫЙ ФИЛЬТР
        if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
            return false;
        }
        if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
                if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
            return false;
        }
        return true;
    });
    
    return filteredDeals.length;
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
        targetObjects.forEach(f => {
            const cadNum = f.properties.cadastral_number;
            if (!cadNum) return;
            
            const deals = dealsData[cadNum] || [];
const filteredDeals = deals.filter(deal => {
    if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
        return false;
    }
    // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
    if (currentCityFilter && deal.city !== currentCityFilter) {
        return false;
    }
    if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
    return false;
}
  if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
                    return false;
                }
    if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
        return false;
    }
        if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
        Object.keys(dealsData).forEach(cadNum => {
            const deals = dealsData[cadNum] || [];
            const filteredDeals = deals.filter(deal => {
                if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                    return false;
                }
                    if (currentCityFilter && deal.city !== currentCityFilter) {
        return false;
    }
    if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
    return false;
}
                if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
                    return false;
                }
                    if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
        return false;
    }
        if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
        return false;
    }
                return true;
            });
            allDeals = allDeals.concat(filteredDeals);
        });
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
        // ✅ ПЕРЕДАЕМ null, ЧТОБЫ ФУНКЦИЯ САМА СОБРАЛА ВСЕ КВАРТАЛЫ
        updateQuartersListWithFilteredObjects(null);
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
    
    // ✅ ПЕРЕДАЕМ null, ЧТОБЫ ФУНКЦИЯ САМА СОБРАЛА ВСЕ КВАРТАЛЫ
    updateQuartersListWithFilteredObjects(null);
}

function updateMapStatsFromDeals(level, parentId) {
    const statMedian = document.getElementById('stat-median');
    const statMinMax = document.getElementById('stat-minmax');
    const statUprs = document.getElementById('stat-uprs');
    const statTotalDeals = document.getElementById('stat-total-deals');
    const statObjects = document.getElementById('stat-objects');
    const statWithDeals = document.getElementById('stat-with-deals');
    
    if (!statMedian || !statMinMax || !statUprs || !statTotalDeals) return;
    
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let allQuarters = [];
    
    if (level === 0) {
        allQuarters = [...allObjects];
        const allCadNumbers = Object.keys(dealsData);
        const wrapperQuarters = allCadNumbers.filter(cad => {
            return cad.endsWith('000000') || cad.match(/^\d{2}:\d{2}:000000$/);
        });
        wrapperQuarters.forEach(cad => {
            if (!allQuarters.some(f => f.properties?.cadastral_number === cad)) {
                allQuarters.push({
                    properties: { 
                        cadastral_number: cad,
                        level: 2
                    }
                });
            }
        });
    } else if (level === 1) {
        allQuarters = [...allObjects];
        const allCadNumbers = Object.keys(dealsData);
        const wrapperQuarters = allCadNumbers.filter(cad => {
            return cad.endsWith('000000') || cad.match(/^\d{2}:\d{2}:000000$/);
        });
        wrapperQuarters.forEach(cad => {
            if (!allQuarters.some(f => f.properties?.cadastral_number === cad)) {
                allQuarters.push({
                    properties: { 
                        cadastral_number: cad,
                        level: 2
                    }
                });
            }
        });
  
} else if (level === 2 && parentId) {
    const prefix = String(parentId).substring(0, 5);
    const allCadNumbers = Object.keys(dealsData);
    
    // ✅ 1. Берем ВСЕ кварталы из dealsData для этого района
    const allQuartersFromDeals = allCadNumbers
        .filter(cad => cad.startsWith(prefix))
        .map(cad => ({
            properties: { 
                cadastral_number: cad,
                level: 2,
                district_id: parentId
            }
        }));
    
    // ✅ 2. Берем кварталы из GeoJSON (на случай, если есть без сделок)
    const allObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(parentId);
    });
    
    // ✅ 3. Объединяем: сначала все из dealsData, потом добавляем недостающие из GeoJSON
    allQuarters = [...allQuartersFromDeals];
    
    allObjects.forEach(f => {
        const cadNum = f.properties.cadastral_number;
        if (cadNum && !allQuarters.some(q => q.properties.cadastral_number === cadNum)) {
            allQuarters.push(f);
        }
    });
    
    console.log(`📊 Всего кварталов для района ${parentId}: ${allQuarters.length}`);
    console.log(`   Из dealsData: ${allQuartersFromDeals.length}`);
    console.log(`   Дополнительно из GeoJSON: ${allQuarters.length - allQuartersFromDeals.length}`);
}
    
    console.log(`📊 Уровень ${level}, всего кварталов: ${allQuarters.length}`);
    
    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    let quartersWithDeals = [];
    
allQuarters.forEach(f => {
    const cadNum = f.properties?.cadastral_number;
    if (!cadNum) return;
    
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
            return false;
        }
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
            return false;
        }
        // ✅ НОВЫЙ ФИЛЬТР
        if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
            return false;
        }
          if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
        return false;
    }
        return true;
    });
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            quartersWithDeals.push(cadNum);
            
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
    
    if (statObjects) statObjects.textContent = allQuarters.length;
    if (statWithDeals) statWithDeals.textContent = quartersWithDeals.length;
    
    const quartersList = document.getElementById('quarters-list');
    if (quartersList) {
        if (quarterStats.length === 0) {
            quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
        } else {
 const sortedQuarters = allQuarters.filter(f => {
    const cadNum = f.properties?.cadastral_number;
    if (!cadNum) return false;
    const deals = dealsData[cadNum] || [];
    const filtered = deals.filter(d => {
        if (currentDealTypeFilter && d.kind !== currentDealTypeFilter) return false;
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
        if (currentCityFilter && d.city !== currentCityFilter) return false;
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ТИПУ ОБЪЕКТА
        if (currentObjectTypeFilter && d.obj_kind !== currentObjectTypeFilter) return false;
         if (currentWallMaterialFilter && d.wall_material !== currentWallMaterialFilter) return false;
         if (currentQuarterFilter && d.quarter !== currentQuarterFilter) return false;
         if (currentYearBuildFilter && d.year_build !== currentYearBuildFilter) return false;
        return true;
    });
    return filtered.length > 0;
}).sort((a, b) => {
    const countA = getDealsCountForObject(a);
    const countB = getDealsCountForObject(b);
    return countB - countA;
});
            
            let html = '';
            sortedQuarters.forEach(f => {
                const cadNum = f.properties?.cadastral_number || '—';
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
    }   
    updatePopupsAndTooltips(level);
}

function updatePopupsAndTooltips(level) {
    if (!window.mapLayer) return;
    
    console.log(`🔄 updatePopupsAndTooltips: level=${level}, filter=${currentDealTypeFilter}`);
    
    window.mapLayer.eachLayer(function(layer) {
        if (!layer.feature || !layer.feature.properties) return;
        
        const props = layer.feature.properties;
        const levelName = props.level_name || 'unknown';
        
        if (levelName === 'district') {
            // ✅ ПЕРЕСОЗДАЕМ ТУЛТИП
            const tooltipContent = buildDistrictTooltipContent(layer);
            if (tooltipContent) {
                // Удаляем старый тултип
                layer.unbindTooltip();
                // Привязываем новый
                layer.bindTooltip(tooltipContent, {
                    className: 'custom-popup',
                    permanent: false,
                    direction: 'top',
                    offset: [0, -10],
                    opacity: 0.95,
                    sticky: true,
                    interactive: false
                });
                console.log(`✅ Тултип обновлен для: ${props.district_name}`);
            }
        }
        
        if (levelName === 'quarter') {
            // ✅ ПЕРЕСОЗДАЕМ ПОПАП
            const newPopupContent = buildPopupContent(layer.feature);
            layer.unbindPopup();
            layer.bindPopup(newPopupContent, { 
                className: 'custom-popup', 
                maxWidth: 300,
                closeButton: true
            });
        }
    });
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
                console.log(`✅ Тултип обертки обновлен`);
            }
        });
    }
}
function buildDistrictTooltipContent(layer) {
    const feature = layer.feature;
    if (!feature || !feature.properties) return null;
    
    const props = feature.properties;
    const cadNum = props.cadastral_number || props.district_id || '—';
    const districtName = props.district_name || cadNum;
    const displayCad = cadNum !== '—' ? cadNum : props.district_id || '—';
    const districtId = props.district_id || cadNum;
    
    // ✅ Берем кварталы из GeoJSON
 const prefix = String(districtId).substring(0, 5);
const allCadNumbers = Object.keys(dealsData);
const allQuartersFromDeals = allCadNumbers
    .filter(cad => cad.startsWith(prefix))
    .map(cad => ({
        properties: { 
            cadastral_number: cad,
            level: 2,
            district_id: districtId
        }
    }));

// ✅ Берем кварталы из GeoJSON (на случай, если есть без сделок)
const districtObjects = mapData.features.filter(f => {
    if (f.properties.level !== 2) return false;
    const fParentId = f.properties.parent_id || f.properties.district_id;
    return String(fParentId) === String(districtId) || 
           String(f.properties.district_id) === String(districtId);
});

// ✅ Объединяем: сначала все из dealsData, потом добавляем недостающие из GeoJSON
const allQuarters = [...allQuartersFromDeals];

districtObjects.forEach(f => {
    const cadNum = f.properties.cadastral_number;
    if (cadNum && !allQuarters.some(q => q.properties.cadastral_number === cadNum)) {
        allQuarters.push(f);
    }
});

console.log(`📊 Тултип: всего кварталов для района ${districtId}: ${allQuarters.length}`);
    
    // ✅ РАСЧЕТ СТАТИСТИКИ
    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    
  allQuarters.forEach(f => {
    const cadNum = f.properties?.cadastral_number;
    if (!cadNum) return;
    
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
            return false;
        }
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
    return false;
}
if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
        return false;
    }
      if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
    
    return `
        <div class="popup-title">📋 ${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
        ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
    `;
}
function updateQuartersListWithFilteredObjects(objectsWithDeals) {
    const quartersList = document.getElementById('quarters-list');
    if (!quartersList) return;
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    // ✅ Собираем ВСЕ кварталы для текущего уровня
    let allQuarters = [];
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    if (level === 0 || level === 1) {
        // Для округа и района - все кварталы + все обертки
        allQuarters = [...allObjects];
        
        const allCadNumbers = Object.keys(dealsData);
        const wrapperQuarters = allCadNumbers.filter(cad => {
            return cad.endsWith('000000') || cad.match(/^\d{2}:\d{2}:000000$/);
        });
        wrapperQuarters.forEach(cad => {
            if (!allQuarters.some(f => f.properties?.cadastral_number === cad)) {
                allQuarters.push({
                    properties: { 
                        cadastral_number: cad,
                        level: 2
                    }
                });
            }
        });
    } else if (level === 2 && parentId) {
        // Для конкретного района - только кварталы этого района
        allQuarters = allObjects.filter(f => {
            if (f.properties.level !== 2) return false;
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
        
        // Добавляем обертки для этого района
        const prefix = String(parentId).substring(0, 5);
        const allCadNumbers = Object.keys(dealsData);
        const wrapperQuarters = allCadNumbers.filter(cad => {
            if (!cad.endsWith('000000') && !cad.match(/^\d{2}:\d{2}:000000$/)) return false;
            return String(cad).startsWith(prefix);
        });
        wrapperQuarters.forEach(cad => {
            if (!allQuarters.some(f => f.properties?.cadastral_number === cad)) {
                allQuarters.push({
                    properties: { 
                        cadastral_number: cad,
                        level: 2
                    }
                });
            }
        });
    }
    
    // ✅ ФИЛЬТРУЕМ ПО НАЛИЧИЮ СДЕЛОК С УЧЕТОМ ФИЛЬТРА
    // ❗ ИСКЛЮЧАЕМ ОБЕРТКУ 89:00:000000 ИЗ СПИСКА
const withDeals = allQuarters.filter(f => {
    const cadNum = f.properties?.cadastral_number;
    if (!cadNum) return false;
    
    const deals = dealsData[cadNum] || [];
    const filtered = deals.filter(d => {
        if (currentDealTypeFilter && d.kind !== currentDealTypeFilter) return false;
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
        if (currentCityFilter && d.city !== currentCityFilter) return false;
        if (currentObjectTypeFilter && d.obj_kind !== currentObjectTypeFilter) return false;
        if (currentWallMaterialFilter && d.wall_material !== currentWallMaterialFilter) return false;
        if (currentQuarterFilter && d.quarter !== currentQuarterFilter) return false;
        if (currentYearBuildFilter && d.year_build !== currentYearBuildFilter) return false;
        return true;
    });
    return filtered.length > 0;
});
    
    if (withDeals.length === 0) {
        quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
        return;
    }
    
    // ✅ СОРТИРУЕМ ПО КОЛИЧЕСТВУ СДЕЛОК
    const sorted = withDeals.sort((a, b) => {
        const countA = getDealsCountForObject(a);
        const countB = getDealsCountForObject(b);
        return countB - countA;
    });
    
    let html = '';
    sorted.forEach(f => {
        const cadNum = f.properties?.cadastral_number || '—';
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
    // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
    if (currentCityFilter && deal.city !== currentCityFilter) {
        return false;
    }
    // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ТИПУ ОБЪЕКТА
    if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
        return false;
    }
        if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
        return false;
    }
      if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
    // ✅ СБРАСЫВАЕМ ВЫБРАННЫЙ КВАРТАЛ ТОЛЬКО ПРИ ПЕРЕХОДЕ НА УРОВЕНЬ КВАРТАЛОВ
    if (level === 2 && parentId === null) {  // ✅ НОВЫЙ КОД!
        window.selectedQuarterCadNumber = null;
    }
    
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
    const cadNum = props.cadastral_number || '';
    const isWrapper = cadNum.endsWith('000000') || cadNum.endsWith('0000000');
    
    // Уровень 0: только округ (level: 0)
    if (level === 0) {
        return props.level === 0;
    }
    
    // Уровень 1: районы (level: 1) + обертки (level: 2 с 000000)
    if (level === 1) {
        // Районы: level === 1
        if (props.level === 1) return true;
        // Обертки: level === 2 и заканчиваются на 000000
        if (props.level === 2 && isWrapper) return true;
        return false;
    }
    
    // Уровень 2: кварталы (level: 2) в конкретном районе
    if (level === 2) {
        if (props.level !== 2) return false;
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
    // ✅ ПРАВИЛЬНОЕ ОПРЕДЕЛЕНИЕ ОБЕРТОК
    const wrapperQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        // Обертка — это когда кадастровый номер заканчивается на 6 нулей (000000)
        // или имеет формат 89:00:000000
        return cadNum.endsWith('000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    const normalQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return !cadNum.endsWith('000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    console.log(`📊 Оберток: ${wrapperQuarters.length}, кварталов: ${normalQuarters.length}`);

    // 🔥 СНАЧАЛА ДОБАВЛЯЕМ ОБЕРТКУ (БУДЕТ СНИЗУ)
if (wrapperQuarters.length > 0) {
window.wrapperLayer = L.geoJSON(wrapperQuarters, {
    style: function(feature) {
        return {
            fillColor: 'transparent',  // НЕТ ЗАЛИВКИ
            fillOpacity: 0,
            color: '#dc2626',          // ЯРКО-КРАСНАЯ ГРАНИЦА
            weight: 2.5,               // ТОЛСТАЯ
            opacity: 0.8,              // НАСЫЩЕННАЯ
            dashArray: '6 4'           // ПУНКТИР
        };
    },
onEachFeature: function(feature, layer) {
    // ✅ КАДАСТРОВЫЙ НОМЕР УЖЕ НОРМАЛИЗОВАН В GEOJSON
    const cadNum = feature.properties.cadastral_number || '—';
    
    // ✅ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ТУЛТИПА
function updateTooltip() {
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
            return false;
        }
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ТИПУ ОБЪЕКТА
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
            return false;
        }
          if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
        return false;
    }
      if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
        
        const medianPrice = prices.length > 0 ? getMedian(prices) : 0;
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
        const uprsMedian = uprsValues.length > 0 ? getMedian(uprsValues) : 0;
        
        const tooltipContent = `
            <div class="popup-title">${cadNum}</div>
            <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
            ${dealsCount > 0 ? `
            <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
            <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
            <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
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
    
    // ✅ СОХРАНЯЕМ ССЫЛКУ НА ФУНКЦИЮ
    layer._updateTooltip = updateTooltip;
    
    // ✅ ПЕРВОНАЧАЛЬНОЕ СОЗДАНИЕ ТУЛТИПА
    updateTooltip();
    
    // ✅ ПРИ НАВЕДЕНИИ — ОБНОВЛЯЕМ ТУЛТИП
    layer.on('mouseover', function() {
        updateTooltip();
        this.setStyle({
            fillOpacity: 0.5,
            weight: 2,
            color: '#ff0000',
            opacity: 0.7
        });
        this.openTooltip();
    });
    
    layer.on('mouseout', function() {
        this.setStyle({
            fillOpacity: 0.25,
            weight: 1,
            color: '#ff0000',
            opacity: 0.4
        });
        this.closeTooltip();
    });
    
    // ✅ ПРИ КЛИКЕ — ПОКАЗЫВАЕМ ТУЛТИП И ЦЕНТРИРУЕМ
   layer.on('click', function(e) {
    updateTooltip();
    this.openTooltip();
    if (this.getBounds && this.getBounds().isValid()) {
        mapInstance.fitBounds(this.getBounds(), { padding: [40, 40] });
    }
});  // ← ИЗМЕНИТЕ }; на });
}
}).addTo(mapInstance);
    
    console.log(`✅ Добавлена обертка (${wrapperQuarters.length} шт.) СНИЗУ`);
}

    // 🔥 ПОТОМ ДОБАВЛЯЕМ КВАРТАЛЫ (БУДУТ СВЕРХУ)
if (normalQuarters.length > 0) {
    const normalLayer = L.geoJSON(normalQuarters, {
        style: function(feature) {
            const props = feature.properties;
            const levelName = props.level_name || 'unknown';
            const cadNum = props.cadastral_number;
            
            // ✅ ИСПОЛЬЗУЕМ ФИЛЬТРЫ ДЛЯ ПОДСЧЕТА СДЕЛОК
            const deals = dealsData[cadNum] || [];
            const filteredDeals = deals.filter(deal => {
                if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
                    return false;
                }
                if (currentCityFilter && deal.city !== currentCityFilter) {
                    return false;
                }
                if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
    return false;
}
 if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
        return false;
    }
      if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
        return false;
    }
                return true;
            });
            const filteredCount = filteredDeals.length;
            const hasDeals = filteredCount > 0;
            
            // ✅ ДЛЯ РАЙОНОВ (level: 1) — ПОЛУПРОЗРАЧНЫЙ СТИЛЬ
        if (levelName === 'district') {
    return {
        fillColor: '#e2e8f0',
        fillOpacity: 0.1,       // было 0.3, стало 0.1
        color: '#2563eb',
        weight: 2.5,
        opacity: 0.5,           // было 0.7, стало 0.5
        dashArray: null
    };
}
            
            // ✅ ДЛЯ КВАРТАЛОВ (level: 2) — ЦВЕТ В ЗАВИСИМОСТИ ОТ ФИЛЬТРОВАННЫХ СДЕЛОК
            return {
                fillColor: hasDeals ? getMapColor(filteredCount) : '#f1f5f9',
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
    
    // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ
    updateMapStatsFromDeals(level, parentId);
    
    // ✅ ОБНОВЛЯЕМ ПОПАПЫ И ТУЛТИПЫ
    updatePopupsAndTooltips(level);
    
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    // ============================================================
    // ✅ ДОБАВЛЯЕМ ПОДПИСИ НА ПОЛИГОНЫ (ЗДЕСЬ!)
    // ============================================================
    
    // Для районов (уровень 1)
    if (level === 1 && window.mapLayer) {
        addLabelsToPolygons(window.mapLayer, filtered, level);
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
    updateActiveFiltersDisplay();
     renderDealsTable(); 
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

    let popupContent = buildPopupContent(feature);
    layer.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 300 });
    
if (levelName === 'district') {
    const cadNum = props.cadastral_number || props.district_id || '—';
    const districtName = props.district_name || cadNum;
    const displayCad = cadNum !== '—' ? cadNum : props.district_id || '—';
    const districtId = props.district_id || cadNum;
    
    // ✅ 1. Берем ВСЕ кварталы из dealsData для этого района
    const prefix = String(districtId).substring(0, 5);
    const allCadNumbers = Object.keys(dealsData);
    const allQuartersFromDeals = allCadNumbers
        .filter(cad => cad.startsWith(prefix))
        .map(cad => ({
            properties: { 
                cadastral_number: cad,
                level: 2,
                district_id: districtId
            }
        }));

    // ✅ 2. Берем кварталы из GeoJSON (на случай, если есть без сделок)
    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });

    // ✅ 3. Объединяем: сначала все из dealsData, потом добавляем недостающие из GeoJSON
    const allQuarters = [...allQuartersFromDeals];

    districtObjects.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (cadNumFeature && !allQuarters.some(q => q.properties.cadastral_number === cadNumFeature)) {
            allQuarters.push(f);
        }
    });

    console.log(`📊 Попап: всего кварталов для района ${districtId}: ${allQuarters.length}`);
        
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
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
            return false;
        }
        if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
            return false;
        }
          if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
        
        // ✅ КОНТЕНТ ДЛЯ ПОПАПА (клик)
        const popupContent = `
            <div class="popup-title">📋 ${districtName}</div>
            <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
            ${totalDeals > 0 ? `
            <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
            <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
            <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
            <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
            ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
        `;
        
        // ✅ ПРИВЯЗЫВАЕМ ПОПАП (клик)
        layer.bindPopup(popupContent, { 
            className: 'custom-popup', 
            maxWidth: 300,
            closeButton: true
        });
        
        // ✅ КОНТЕНТ ДЛЯ ТУЛТИПА (наведение)
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
        
        // ✅ ПРИВЯЗЫВАЕМ ТУЛТИП (наведение)
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
            // Переход на уровень районов
            renderMapLevel(1);
            updateBreadcrumb('okrug');
            // Центрируем карту на районах
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
            }
        } else if (levelName === 'district') {
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
            // ✅ ИСПРАВЛЕНО: убрано дублирование cadNum
            const cadNum = props.cadastral_number;
            const dealsCount = cadNum ? (dealsData[cadNum] || []).length : 0;
            console.log('🏘️ Квартал выбран:', cadNum);
            console.log('📊 Сделок:', dealsCount);
               window.selectedQuarterCadNumber = cadNum;
    
    // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
    renderDealsTable();
            
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
        // ✅ КВАРТАЛЫ — оставляем изменение
        const cadNum = feature?.properties?.cadastral_number;
        const deals = cadNum ? (dealsData[cadNum] || []) : [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) return false;
            if (currentCityFilter && deal.city !== currentCityFilter) return false;
            if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) return false;
            if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) return false;
            if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) return false;
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) return false;
            return true;
        });
        const count = filteredDeals.length;
        const fillColor = count > 0 ? getMapColor(count) : '#f1f5f9';
        
        this.setStyle({
            fillColor: fillColor,
            fillOpacity: 0.2,
            weight: 2,
            color: '#60a5fa',
            opacity: 0.8
        });
    } else {
        // ✅ РАЙОНЫ И ОКРУГ — НЕ МЕНЯЕМ СТИЛЬ (убираем выделение)
        // Просто меняем курсор, без изменения цвета
    }
    
    this.bringToFront();
    if (this._container) {
        this._container.style.cursor = 'pointer';
    }
});

    // ===== 🖱️ УХОД МЫШИ =====
  // ===== 🖱️ УХОД МЫШИ =====
layer.on('mouseout', function(e) {
    if (!this || !this.setStyle || !feature) return;
    
    const level = feature.properties?.level || 0;
    const cadNum = feature.properties?.cadastral_number;
    
    // ✅ ТОЛЬКО ДЛЯ КВАРТАЛОВ (level === 2) — восстанавливаем стиль
    if (level === 2) {
        const deals = cadNum ? (dealsData[cadNum] || []) : [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) return false;
            if (currentCityFilter && deal.city !== currentCityFilter) return false;
            if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) return false;
            if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) return false;
            if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) return false;
            if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) return false;
            return true;
        });
        const filteredCount = filteredDeals.length;
        
        this.setStyle({
            fillColor: filteredCount > 0 ? getMapColor(filteredCount) : '#f1f5f9',
            fillOpacity: 0.2,
            color: '#3b82f6',
            weight: 2.5,
            opacity: 0.4
        });
    }
    // ✅ РАЙОНЫ И ОКРУГ — НИЧЕГО НЕ МЕНЯЕМ
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
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
    return false;
}
if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
    return false;
}
    if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
          if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
    
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter && deal.kind !== currentDealTypeFilter) {
            return false;
        }
        // ✅ ДОБАВЛЯЕМ ФИЛЬТР ПО ГОРОДУ
        if (currentCityFilter && deal.city !== currentCityFilter) {
            return false;
        }
        if (currentObjectTypeFilter && deal.obj_kind !== currentObjectTypeFilter) {
    return false;
}
   if (currentWallMaterialFilter && deal.wall_material !== currentWallMaterialFilter) {
            return false;
        }
            if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) {
            return false;
        }
          if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) {
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
function updateBreadcrumb(level, id, name, isSearch = false) {
    const breadcrumb = document.getElementById('map-breadcrumb');
    if (!breadcrumb) return;
    
    let districtName = name || id || 'Район';
    if (level === 'quarter' && id) {
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
    
    // ✅ КЛИК НА ЯНАО → ПЕРЕХОД НА УРОВЕНЬ ОКРУГА (level 0)
    if (level === 'okrug') {
        breadcrumb.innerHTML = `
            <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:600; font-size:0.95rem;">🏛️ ЯНАО</span>
        `;
    } else if (level === 'district') {
        breadcrumb.innerHTML = `
            <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">🏛️ ЯНАО</span>
            <span style="color:#94a3b8; margin:0 4px;">›</span>
            <span style="font-weight:600; font-size:0.95rem;">${name || id}</span>
        `;
    } else if (level === 'quarter') {
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
function resetAllFiltersMap() {
    console.log('🔄 Сброс всех фильтров карты');
    window.selectedQuarterCadNumber = null;
    
    // Сбрасываем фильтры
    currentDealTypeFilter = null;
    currentCityFilter = null;
    currentObjectTypeFilter = null;
    currentWallMaterialFilter = null;
    currentQuarterFilter = null;
    currentYearBuildFilter = null; 
    
    // Перерисовываем фильтры в UI
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters(); 
    renderYearBuildFilters();
    
    // Перерисовываем карту с текущим уровнем
    renderMapLevel(currentLevel, currentParentId);
    
    // Обновляем легенду
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    console.log('✅ Все фильтры сброшены');
}
function updateActiveFiltersDisplay() {
    const container = document.getElementById('active-filters-list');
    if (!container) return;
    
    const activeFilters = [];
    
    if (currentCityFilter) activeFilters.push(`🏙️ ${currentCityFilter}`);
    if (currentObjectTypeFilter) activeFilters.push(`🏷️ ${currentObjectTypeFilter}`);
    if (currentDealTypeFilter) activeFilters.push(`📋 ${currentDealTypeFilter}`);
    if (currentQuarterFilter) activeFilters.push(`📅 ${currentQuarterFilter}`);
    if (currentWallMaterialFilter) activeFilters.push(`🧱 ${currentWallMaterialFilter}`);
    if (currentYearBuildFilter) activeFilters.push(`🏗️ ${currentYearBuildFilter}`);
    
    if (activeFilters.length === 0) {
        container.textContent = '—';
        container.style.color = '#94a3b8';
    } else {
        container.innerHTML = activeFilters.map(f => 
            `<span style="
                background: #e0f2fe; 
                color: #0284c7; 
                padding: 1px 8px; 
                border-radius: 12px; 
                font-weight: 500;
                font-size: 9px;
                border: 1px solid #bae6fd;
                white-space: nowrap;
            ">${f}</span>`
        ).join(' ');
        container.style.color = '#1e293b';
    }
}
function renderDealsTable() {
    const container = document.getElementById('deals-table-container');
    if (!container) return;
    
    // ✅ Получаем выбранный квартал (если есть)
    const selectedQuarter = window.selectedQuarterCadNumber || null;
    
    // Получаем все сделки с учетом фильтров
    let filteredDeals = allDealsFlat.filter(deal => {
        // ✅ Фильтр по выбранному кварталу (из карты)
        if (selectedQuarter && deal.cad_number !== selectedQuarter) return false;
        
        if (currentDealTypeFilter && deal.deal_kind_text !== currentDealTypeFilter) return false;
        if (currentCityFilter && deal.city !== currentCityFilter) return false;
        if (currentObjectTypeFilter && deal.obj_kind_text !== currentObjectTypeFilter) return false;
        if (currentWallMaterialFilter && deal.wall_material_name !== currentWallMaterialFilter) return false;
        if (currentQuarterFilter && deal.quarter !== currentQuarterFilter) return false;
        if (currentYearBuildFilter && deal.year_build !== currentYearBuildFilter) return false;
        return true;
    });
    
    // ✅ СОРТИРОВКА ПО ЦЕНЕ (от дорогих к дешевым)
    filteredDeals.sort((a, b) => {
        const priceA = a.deal_price_rub || 0;
        const priceB = b.deal_price_rub || 0;
        return priceB - priceA; // по убыванию
    });
    
    // ✅ ШАПКА ТАБЛИЦЫ ВСЕГДА ВИДНА
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif;">
            <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Кад. номер</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Площадь</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Назначение</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Кад. стоимость</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">УПКС</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Город</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Тип сделки</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Тип объекта</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">ВРИ</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Квартал</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Год постр.</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Материал стен</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">Цена сделки</th>
                    <th style="text-align: center; padding: 6px 8px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px;">УПРС</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Если нет сделок
    if (filteredDeals.length === 0) {
        html += `
                <tr>
                    <td colspan="14" style="text-align: center; padding: 30px 0; color: #94a3b8; font-size: 12px;">
                        Нет данных для отображения
                    </td>
                </tr>
        `;
    } else {
        // Берем первые 100 сделок
        const displayDeals = filteredDeals.slice(0, 100);
        
        displayDeals.forEach((deal, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${bgColor};">
                    <td style="text-align: center; padding: 5px 8px; font-family: monospace; font-size: 10px; color: #1e293b; font-weight: 400; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.cad_number || 'nan'}">${deal.cad_number || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400;">${deal.area ? deal.area.toFixed(1) : 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.purpose_text || 'nan'}">${deal.purpose_text || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400;">${deal.cad_cost ? deal.cad_cost.toLocaleString('ru-RU') : 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400;">${deal.upks ? deal.upks.toFixed(2) : 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.city || 'nan'}">${deal.city || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.deal_kind_text || 'nan'}">${deal.deal_kind_text || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.obj_kind_text || 'nan'}">${deal.obj_kind_text || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.vri || 'nan'}">${deal.vri || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.quarter || 'nan'}">${deal.quarter || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400;">${deal.year_build || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.wall_material_name || 'nan'}">${deal.wall_material_name || 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400;">${deal.deal_price_rub ? deal.deal_price_rub.toLocaleString('ru-RU') : 'nan'}</td>
                    <td style="text-align: center; padding: 5px 8px; color: #1e293b; font-weight: 400;">${deal.uprs_rub ? deal.uprs_rub.toFixed(2) : 'nan'}</td>
                </tr>
            `;
        });
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function getSelectedQuarter() {
    // Проверяем, есть ли выбранный квартал на карте
    if (window.selectedQuarterCadNumber) {
        return window.selectedQuarterCadNumber;
    }
    return null;
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
    const cadNum = f.properties.cadastral_number || '';
    // Ищем как в обычных кварталах (level === 2), так и в обертках
    if (f.properties.level === 2) {
        return cadNum.toLowerCase().includes(query.toLowerCase());
    }
    // Также ищем в обертках на уровне 1 (если они там есть)
    if (f.properties.level === 1 && cadNum.endsWith('000000')) {
        return cadNum.toLowerCase().includes(query.toLowerCase());
    }
    return false;
});

// Если не нашли в mapData, ищем в dealsData (обертки)
if (!found) {
    const allCadNumbers = Object.keys(dealsData);
    const matchingCad = allCadNumbers.find(cad => 
        cad.toLowerCase().includes(query.toLowerCase())
    );
    if (matchingCad) {
        // Создаем искусственный объект для обертки
        found = {
            properties: {
                cadastral_number: matchingCad,
                level: 2,
                district_id: matchingCad.substring(0, 5),
                parent_id: matchingCad.substring(0, 5),
                isWrapper: matchingCad.endsWith('000000') || matchingCad.match(/^\d{2}:\d{2}:000000$/)
            }
        };
        console.log(`   Найдено в dealsData: ${matchingCad}`);
    }
}
    
    if (!found) {
        console.log(`❌ Квартал "${query}" не найден`);
        input.style.borderColor = '#ef4444';
        input.style.background = '#fef2f2';
        setTimeout(() => {
            input.style.borderColor = '#e2e8f0';
            input.style.background = '#f8fafc';
        }, 2000);
        return;
    }
    
    console.log(`✅ Найден квартал: ${found.properties.cadastral_number}`);
    input.style.borderColor = '#22c55e';
    input.style.background = '#f0fdf4';
    setTimeout(() => {
        input.style.borderColor = '#e2e8f0';
        input.style.background = '#f8fafc';
    }, 1500);
    
    // ✅ ПРОВЕРЯЕМ, ОБЕРТКА ЛИ ЭТО
    const cadNum = found.properties.cadastral_number || '';
    const isWrapper = cadNum.endsWith('000000') || cadNum.endsWith('0000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    
if (isWrapper) {
    console.log(`🔴 Найдена обертка: ${cadNum}, показываем на уровне районов`);
    // ✅ СОХРАНЯЕМ ОБЕРТКУ
    window.selectedQuarterCadNumber = cadNum;
    
    renderMapLevel(1);
    updateBreadcrumb('okrug');
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderDealsTable();
    
    // Находим и подсвечиваем обертку
    setTimeout(() => {
        let foundLayer = null;
        
        // Ищем в wrapperLayer (на уровне 1 обертки должны быть)
        if (window.wrapperLayer) {
            window.wrapperLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    const layerCadNum = layer.feature.properties.cadastral_number || '';
                    if (layerCadNum === cadNum) {
                        foundLayer = layer;
                    }
                }
            });
        }
        
        // Если не нашли в wrapperLayer, ищем в mapLayer
        if (!foundLayer && window.mapLayer) {
            window.mapLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    const layerCadNum = layer.feature.properties.cadastral_number || '';
                    if (layerCadNum === cadNum) {
                        foundLayer = layer;
                    }
                }
            });
        }
        
        if (foundLayer) {
            console.log(`✅ Обертка ${cadNum} найдена в слоях`);
            
            // ✅ Открываем тултип
            if (foundLayer.openTooltip) {
                foundLayer.openTooltip();
            }
            
            // ✅ Центрируем на обертке
            if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
            }
            
            // ❗ ОТКЛЮЧАЕМ КЛИК
            foundLayer.off('click');
            foundLayer.off('dblclick');
            
            // ✅ Делаем обертку более заметной
            foundLayer.setStyle({
                fillOpacity: 0.4,
                weight: 3,
                color: '#ff0000',
                opacity: 0.8
            });
        } else {
            console.warn(`⚠️ Обертка ${cadNum} не найдена в слоях после renderMapLevel(1)`);
        }
    }, 500);
    
    return;
}
    
    // ✅ ЭТО ОБЫЧНЫЙ КВАРТАЛ — ПОКАЗЫВАЕМ РАЗБИЕНИЕ НА КВАРТАЛЫ
console.log(`🏘️ Обычный квартал: ${cadNum}, показываем разбиение`);

// Определяем район (parent_id)
const districtId = found.properties.parent_id || found.properties.district_id;
const districtName = found.properties.district_name || districtId || 'Район';

// Переходим на уровень кварталов с этим районом
renderMapLevel(2, districtId);
updateBreadcrumb('quarter', districtId, districtName, true);

// ✅ СОХРАНЯЕМ ВЫБРАННЫЙ КВАРТАЛ
window.selectedQuarterCadNumber = cadNum;

// Подсвечиваем найденный квартал
setTimeout(() => {
    if (window.mapLayer) {
        window.mapLayer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                const layerCadNum = layer.feature.properties.cadastral_number || '';
                if (layerCadNum === cadNum) {
                    layer.openPopup();
                    if (layer.getBounds && layer.getBounds().isValid()) {
                        mapInstance.fitBounds(layer.getBounds(), { padding: [40, 40] });
                    }
                }
            }
        });
    }
    // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
    renderDealsTable();
}, 300);
}
function searchQuarterByCadNumber(cadNumber) {
    if (!cadNumber) return;
    
    console.log(`🔍 Поиск квартала по номеру: ${cadNumber}`);
    
    // 1. Ищем в mapData
let found = mapData.features.find(f => {
    if (f.properties.level !== 2) return false;
    return f.properties.cadastral_number === cadNumber;
});

// 2. Если не нашли, ищем в обертках на уровне 1
if (!found) {
    found = mapData.features.find(f => {
        if (f.properties.level !== 1) return false;
        const cadNum = f.properties.cadastral_number || '';
        return cadNum === cadNumber && cadNum.endsWith('000000');
    });
}

// 3. Если не нашли, проверяем dealsData
if (!found) {
    const deals = dealsData[cadNumber] || [];
    const isWrapper = cadNumber.endsWith('000000') || cadNumber.match(/^\d{2}:\d{2}:000000$/);
    if (deals.length > 0 || isWrapper) {
        found = {
            properties: {
                cadastral_number: cadNumber,
                level: 2,
                district_id: cadNumber.substring(0, 5),
                parent_id: cadNumber.substring(0, 5),
                isWrapper: isWrapper
            }
        };
        console.log(`   Найдено в dealsData: ${cadNumber}`);
    }
}
    
    if (!found) {
        console.log(`❌ Квартал "${cadNumber}" не найден`);
        return;
    }
    
    console.log(`✅ Найден квартал: ${found.properties.cadastral_number}`);
    
    // 3. Проверяем, обертка ли это
    const isWrapper = cadNumber.endsWith('000000') || cadNumber.match(/^\d{2}:\d{2}:000000$/);
    
  if (isWrapper) {
    console.log(`🔴 Найдена обертка: ${cadNumber}, показываем на уровне районов`);
    // ✅ СОХРАНЯЕМ ОБЕРТКУ
    window.selectedQuarterCadNumber = cadNumber;
    
    renderMapLevel(1);
    updateBreadcrumb('okrug');
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderDealsTable();
        
        // Находим и подсвечиваем обертку
        setTimeout(() => {
            let foundLayer = null;
            
            if (window.wrapperLayer) {
                window.wrapperLayer.eachLayer(function(layer) {
                    if (layer.feature && layer.feature.properties) {
                        const layerCadNum = layer.feature.properties.cadastral_number || '';
                        if (layerCadNum === cadNumber) {
                            foundLayer = layer;
                        }
                    }
                });
            }
            
            if (foundLayer) {
                console.log(`✅ Обертка ${cadNumber} найдена в слоях`);
                foundLayer.openTooltip();
                if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                    mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
                }
                foundLayer.setStyle({
                    fillOpacity: 0.4,
                    weight: 3,
                    color: '#ff0000',
                    opacity: 0.8
                });
            } else {
                console.warn(`⚠️ Обертка ${cadNumber} не найдена в слоях`);
            }
        }, 500);
        
        return;
    }
    
    // 4. Обычный квартал
 console.log(`🏘️ Обычный квартал: ${cadNumber}, показываем разбиение`);

const districtId = found.properties.parent_id || found.properties.district_id;
const districtName = found.properties.district_name || districtId || 'Район';

renderMapLevel(2, districtId);
updateBreadcrumb('quarter', districtId, districtName, true);

// ✅ СОХРАНЯЕМ ВЫБРАННЫЙ КВАРТАЛ
window.selectedQuarterCadNumber = cadNumber;

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
    // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
    renderDealsTable();
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