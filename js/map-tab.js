let mapData = null;
let currentLevel = 0;
let currentParentId = null;
let currentDistrictFilter = null;

const MAP_URL = 'https://mark98molchanov-a11y.github.io/a13y.gko-registry-system/data/yanao_hierarchical_web.geojson';
let dealsData = {};
let dealTypes = {};
let cityTypes = {};
let objectTypes = {};
let wallMaterialTypes = {}; 
let quarterTypes = {}; 
let yearBuildTypes = {};
let purposeCount = {};   
let vriCount = {};   
let currentDealTypeFilter = [];  
let currentCityFilter = [];  
let currentObjectTypeFilter = [];
let currentWallMaterialFilter = []; 
let currentQuarterFilter = [];
let currentYearBuildFilter = [];
let currentPurposeFilter = [];   
let currentVriFilter = [];    
let allDealsFlat = []; 
let uprsThresholds = {}; 
let isPriceFilterEnabled = false;
let originalAllDealsFlat = []; 

const DEALS_CSV_URL = 'https://mark98molchanov-a11y.github.io/a13y.gko-registry-system/data/deals_clean.csv';
async function loadDealsCSV() {
    try {
        console.log('📥 Загрузка CSV с данными о сделках...');
        const response = await fetch(DEALS_CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        
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
        const floorIndex = headers.indexOf('floor');
const locationIndex = headers.indexOf('location');
        
        if (cadIndex === -1 || kindIndex === -1) {
            console.warn('⚠️ Не найдены колонки cad_number или deal_kind_text');
            return;
        }
        
        const dealsByCad = {};
        const typesCount = {};
        const citiesCount = {}; 
        const objectTypesCount = {};
        const purposeCount = {};   
const vriCount = {}; 
        
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
            const purposeText = values[purposeIndex] || 'nan';
            const vri = values[vriIndex] || 'nan';  
            const floor = values[floorIndex] || 'nan';
const location = values[locationIndex] || 'nan';
            
            
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
    upks: upks,
    uprs: uprs,
    city: city,
    deal_kind_text: kind,
    obj_kind_text: objKind,
    vri: vri,
    quarter: quarter,
    year_build: yearBuild,
    wall_material_name: wallMaterial,
    deal_price_rub: price,
    uprs_rub: uprs,
    floor: floor,
    location: location
});
            
            if (!dealsByCad[cadNum]) dealsByCad[cadNum] = [];
           dealsByCad[cadNum].push({
    kind: kind,
    price: price,
    uprs: uprs,
    upks: upks,
    cad_cost: cadCost,
    area: area,
    city: city,
    obj_kind: objKind,
    wall_material: wallMaterial,
    quarter: quarter,
    year_build: yearBuild,
    purpose_text: purposeText,
    vri: vri,
    floor: floor,
    location: location
});
            
            typesCount[kind] = (typesCount[kind] || 0) + 1;
            citiesCount[city] = (citiesCount[city] || 0) + 1;
            objectTypesCount[objKind] = (objectTypesCount[objKind] || 0) + 1;
            wallMaterialTypes[wallMaterial] = (wallMaterialTypes[wallMaterial] || 0) + 1;
            quarterTypes[quarter] = (quarterTypes[quarter] || 0) + 1;
            yearBuildTypes[yearBuild] = (yearBuildTypes[yearBuild] || 0) + 1; 
            purposeCount[purposeText] = (purposeCount[purposeText] || 0) + 1;
vriCount[vri] = (vriCount[vri] || 0) + 1;
        }
        
console.log('📊 Всего сделок загружено:', allDealsFlat.length);
        
originalAllDealsFlat = [...allDealsFlat];
        
priceThresholds = calculatePriceThresholds();
console.log('📊 Пороговые цены рассчитаны');
        
if (isPriceFilterEnabled && Object.keys(priceThresholds).length > 0) {
    const filteredDeals = filterDealsByPriceThreshold(priceThresholds);
    console.log(`📊 После фильтрации по ценам: ${filteredDeals.length} сделок (исключено ${allDealsFlat.length - filteredDeals.length})`);
            
    allDealsFlat = filteredDeals;
    rebuildDealsData(filteredDeals);
} else {
    rebuildDealsData(allDealsFlat);
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
        renderPurposeFilters();
        renderVriFilters();
        
        if (mapData) {
            console.log('🔄 Перерисовка карты после загрузки CSV...');
            renderMapLevel(currentLevel || 0, currentParentId);
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки CSV:', error);
        document.getElementById('deal-type-filters').innerHTML = '<div style="color: #ef4444; font-size: 12px; text-align: center; padding: 8px 0;">Ошибка загрузки данных</div>';
    }
}
function calculatePriceThresholds() {
    console.log('📊 Расчет пороговых цен по типам сделок и муниципалитетам (10% низких и 10% высоких)...');
    
    const thresholds = {};
    
    const dealsByTypeAndCity = {};
    allDealsFlat.forEach(deal => {
        const kind = deal.deal_kind_text || 'unknown';
        const city = deal.city || 'unknown';
        const key = `${kind}|${city}`;
        
        if (!dealsByTypeAndCity[key]) {
            dealsByTypeAndCity[key] = {
                kind: kind,
                city: city,
                uprsPrices: [],
                upksPrices: []
            };
        }
        if (deal.uprs_rub > 0) {
            dealsByTypeAndCity[key].uprsPrices.push(deal.uprs_rub);
        }
        if (deal.upks > 0) {
            dealsByTypeAndCity[key].upksPrices.push(deal.upks);
        }
    });
    
    Object.keys(dealsByTypeAndCity).forEach(key => {
        const group = dealsByTypeAndCity[key];
        
        const uprsPrices = group.uprsPrices.sort((a, b) => a - b);
        const upksPrices = group.upksPrices.sort((a, b) => a - b);
        
        const lowerPercent = 0.10;
        const upperPercent = 0.90;
        
        let uprsMin = 0, uprsMax = Infinity;
        if (uprsPrices.length > 0) {
            const lowerIndex = Math.floor(uprsPrices.length * lowerPercent);
            const upperIndex = Math.ceil(uprsPrices.length * upperPercent) - 1;
            uprsMin = uprsPrices[lowerIndex] || 0;
            uprsMax = uprsPrices[upperIndex] || uprsPrices[uprsPrices.length - 1];
        }
        
        let upksMin = 0, upksMax = Infinity;
        if (upksPrices.length > 0) {
            const lowerIndex = Math.floor(upksPrices.length * lowerPercent);
            const upperIndex = Math.ceil(upksPrices.length * upperPercent) - 1;
            upksMin = upksPrices[lowerIndex] || 0;
            upksMax = upksPrices[upperIndex] || upksPrices[upksPrices.length - 1];
        }
        
        thresholds[key] = { 
            uprsMin: uprsMin,
            uprsMax: uprsMax,
            upksMin: upksMin,
            upksMax: upksMax,
            kind: group.kind,
            city: group.city,
            count: uprsPrices.length
        };
        
        console.log(`   ${group.kind} | ${group.city}: ${uprsPrices.length} сделок, УПРС = ${uprsMin.toFixed(2)} - ${uprsMax.toFixed(2)} ₽/м², УПКС = ${upksMin.toFixed(2)} - ${upksMax.toFixed(2)} ₽/м²`);
    });
    
    console.log('✅ Пороговые цены рассчитаны (по типам сделок и муниципалитетам)');
    return thresholds;
}
function filterDealsByPriceThreshold(thresholds) {
    if (!thresholds || Object.keys(thresholds).length === 0) {
        console.warn('⚠️ Пороговые цены не рассчитаны');
        return allDealsFlat;
    }
    
    return allDealsFlat.filter(deal => {
        const kind = deal.deal_kind_text || 'unknown';
        const city = deal.city || 'unknown';
        const key = `${kind}|${city}`;
        const threshold = thresholds[key];
        
        if (!threshold) return true;
        
        const uprs = deal.uprs_rub;
        const upks = deal.upks;
        
        const uprsOk = uprs >= threshold.uprsMin && uprs <= threshold.uprsMax;
        const upksOk = upks >= threshold.upksMin && upks <= threshold.upksMax;
        
        return uprsOk && upksOk;
    });
}
function rebuildDealsData(filteredDeals) {
    dealsData = {};
    dealTypes = {};
    cityTypes = {};
    objectTypes = {};
    wallMaterialTypes = {};
    quarterTypes = {};
    yearBuildTypes = {};
    
    filteredDeals.forEach(deal => {
        const cadNum = deal.cad_number;
        if (!cadNum) return;
        
        if (!dealsData[cadNum]) dealsData[cadNum] = [];
        dealsData[cadNum].push({
    kind: deal.deal_kind_text,
    price: deal.deal_price_rub,
    uprs: deal.uprs_rub,
    upks: deal.upks,
    cad_cost: deal.cad_cost,
    area: deal.area,
    city: deal.city,
    obj_kind: deal.obj_kind_text,
    wall_material: deal.wall_material_name,
    quarter: deal.quarter,
    year_build: deal.year_build,
    purpose_text: deal.purpose_text,
    vri: deal.vri,
    floor: deal.floor,
    location: deal.location
});
        
        dealTypes[deal.deal_kind_text] = (dealTypes[deal.deal_kind_text] || 0) + 1;
        cityTypes[deal.city] = (cityTypes[deal.city] || 0) + 1;
        objectTypes[deal.obj_kind_text] = (objectTypes[deal.obj_kind_text] || 0) + 1;
        wallMaterialTypes[deal.wall_material_name] = (wallMaterialTypes[deal.wall_material_name] || 0) + 1;
        quarterTypes[deal.quarter] = (quarterTypes[deal.quarter] || 0) + 1;
        yearBuildTypes[deal.year_build] = (yearBuildTypes[deal.year_build] || 0) + 1;
         purposeCount[deal.purpose_text] = (purposeCount[deal.purpose_text] || 0) + 1; 
    vriCount[deal.vri] = (vriCount[deal.vri] || 0) + 1;    
    });
    
    console.log('✅ Данные перестроены после фильтрации по ценам');
}
function togglePriceFilter() {
    isPriceFilterEnabled = !isPriceFilterEnabled;
    
    const btn = document.getElementById('priceFilterToggle');
    if (btn) {
        if (isPriceFilterEnabled) {
            btn.innerHTML = 'Ценовой фильтр';
            btn.style.background = '#dcfce7';
            btn.style.color = '#166534';
            btn.style.borderColor = '#86efac';
        } else {
            btn.innerHTML = 'Ценовой фильтр';
            btn.style.background = '#e0f2fe';
            btn.style.color = '#0284c7';
            btn.style.borderColor = '#bae6fd';
        }
    }
    
    console.log(`🔄 Фильтр по ценам ${isPriceFilterEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    
    if (!isPriceFilterEnabled) {
        allDealsFlat = [...originalAllDealsFlat];
        rebuildDealsData(allDealsFlat);
    } else {
        const filteredDeals = filterDealsByPriceThreshold(priceThresholds);
        allDealsFlat = filteredDeals;
        rebuildDealsData(filteredDeals);
    }
    
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderDealsTable();
    
    if (mapData) {
        renderMapLevel(currentLevel, currentParentId);
    }
}
function renderDealTypeFilters() {
    const container = document.getElementById('deal-type-filters');
    if (!container) return;
    
    const types = Object.keys(dealTypes)
    .map(k => k.trim())
    .sort((a, b) => dealTypes[b] - dealTypes[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(kind => currentDealTypeFilter.includes(kind));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Типы сделок</span>
            <button onclick="toggleAllDealTypes(${JSON.stringify(types).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(kind => {
        const count = dealTypes[kind];
        const isActive = currentDealTypeFilter.includes(kind);
        const shortName = kind.length > 15 ? kind.substring(0, 14) + '…' : kind;
        
        html += `
            <tr onclick="applyDealTypeFilter('${kind.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${kind}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
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
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = cities.every(city => currentCityFilter.includes(city));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Районы</span>
            <button onclick="toggleAllCities(${JSON.stringify(cities).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    cities.forEach(city => {
        const count = cityTypes[city];
        const isActive = currentCityFilter.includes(city);
        const shortName = city.length > 15 ? city.substring(0, 14) + '…' : city;
        
        html += `
            <tr onclick="applyCityFilter('${city.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${city}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
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
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentObjectTypeFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Типы объектов</span>
            <button onclick="toggleAllObjectTypes(${JSON.stringify(types).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = objectTypes[type];
        const isActive = currentObjectTypeFilter.includes(type);
        const shortName = type.length > 15 ? type.substring(0, 14) + '…' : type;
        
        html += `
            <tr onclick="applyObjectTypeFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${type}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
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
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentWallMaterialFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Материал стен</span>
           <button onclick="toggleAllWallMaterials(${JSON.stringify(types).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = wallMaterialTypes[type];
        const isActive = currentWallMaterialFilter.includes(type);
        const shortName = type.length > 12 ? type.substring(0, 11) + '…' : type;
        
        html += `
            <tr onclick="applyWallMaterialFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${type}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
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
    
    const types = Object.keys(yearBuildTypes).sort((a, b) => {
        if (a === 'nan') return 1;
        if (b === 'nan') return -1;
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return bNum - aNum;
    });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentYearBuildFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Год постройки</span>
            <button onclick="toggleAllYearBuilds(${JSON.stringify(types).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = yearBuildTypes[type];
        const isActive = currentYearBuildFilter.includes(type);
        
        html += `
            <tr onclick="applyYearBuildFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap;">${type}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
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
    
    const types = Object.keys(quarterTypes).sort((a, b) => {
        if (a === 'nan') return 1;
        if (b === 'nan') return -1;
        const aParsed = parseQuarter(a);
        const bParsed = parseQuarter(b);
        return bParsed.sortKey - aParsed.sortKey;
    });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentQuarterFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Квартал</span>
            <button onclick="toggleAllQuarters(${JSON.stringify(types).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = quarterTypes[type];
        const isActive = currentQuarterFilter.includes(type);
        const shortName = type.length > 10 ? type.substring(0, 9) + '…' : type;
        
        html += `
            <tr onclick="applyQuarterFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap;" title="${type}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function renderVriFilters() {
    const container = document.getElementById('vri-filters');
    if (!container) return;
    
    const types = Object.keys(vriCount).sort((a, b) => vriCount[b] - vriCount[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentVriFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">ВРИ</span>
            <button onclick="toggleAllVri(${JSON.stringify(types).replace(/"/g, '&quot;')})" 
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = vriCount[type];
        const isActive = currentVriFilter.includes(type);
        const shortName = type.length > 15 ? type.substring(0, 14) + '…' : type;
        
        html += `
            <tr onclick="applyVriFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${type}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function renderPurposeFilters() {
    const container = document.getElementById('purpose-filters');
    if (!container) return;
    
    const types = Object.keys(purposeCount).sort((a, b) => purposeCount[b] - purposeCount[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentPurposeFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Назначение</span>
            <button onclick="toggleAllPurposes(${JSON.stringify(types).replace(/"/g, '&quot;')})"
                    style="
                        font-size: 8px; 
                        padding: 1px 8px; 
                        border-radius: 4px; 
                        border: 1px solid ${allSelected ? '#fecaca' : '#bae6fd'};
                        background: ${allSelected ? '#fef2f2' : '#e0f2fe'};
                        color: ${allSelected ? '#dc2626' : '#0284c7'};
                        cursor: pointer; 
                        font-weight: 600;
                        transition: all 0.2s;
                        font-family: 'Inter', sans-serif;
                        white-space: nowrap;
                    "
                    onmouseover="this.style.opacity='0.8'"
                    onmouseout="this.style.opacity='1'">
                ${allSelected ? 'Сбросить' : 'Выделить все'}
            </button>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
            <tbody>
    `;
    
    types.forEach(type => {
        const count = purposeCount[type];
        const isActive = currentPurposeFilter.includes(type);
        const shortName = type.length > 15 ? type.substring(0, 14) + '…' : type;
        
        html += `
            <tr onclick="applyPurposeFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${type}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}
function toggleAllDealTypes(types) {
    const allSelected = types.every(kind => currentDealTypeFilter.includes(kind));
    if (allSelected) {
        currentDealTypeFilter = [];
    } else {
        currentDealTypeFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function toggleAllCities(cities) {
    const allSelected = cities.every(city => currentCityFilter.includes(city));
    if (allSelected) {
        currentCityFilter = [];
    } else {
        currentCityFilter = [...cities];
    }
    applyFiltersAndUpdate();
}

function toggleAllObjectTypes(types) {
    const allSelected = types.every(type => currentObjectTypeFilter.includes(type));
    if (allSelected) {
        currentObjectTypeFilter = [];
    } else {
        currentObjectTypeFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function toggleAllWallMaterials(types) {
    const allSelected = types.every(type => currentWallMaterialFilter.includes(type));
    if (allSelected) {
        currentWallMaterialFilter = [];
    } else {
        currentWallMaterialFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function toggleAllQuarters(types) {
    const allSelected = types.every(type => currentQuarterFilter.includes(type));
    if (allSelected) {
        currentQuarterFilter = [];
    } else {
        currentQuarterFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function toggleAllYearBuilds(types) {
    const allSelected = types.every(type => currentYearBuildFilter.includes(type));
    if (allSelected) {
        currentYearBuildFilter = [];
    } else {
        currentYearBuildFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function toggleAllPurposes(types) {
    const allSelected = types.every(type => currentPurposeFilter.includes(type));
    if (allSelected) {
        currentPurposeFilter = [];
    } else {
        currentPurposeFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function toggleAllVri(types) {
    const allSelected = types.every(type => currentVriFilter.includes(type));
    if (allSelected) {
        currentVriFilter = [];
    } else {
        currentVriFilter = [...types];
    }
    applyFiltersAndUpdate();
}

function applyFiltersAndUpdate() {
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderPurposeFilters();
    renderVriFilters();
    
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
function applyDealTypeFilter(kind) {
    const index = currentDealTypeFilter.indexOf(kind);
    if (index === -1) {
        currentDealTypeFilter.push(kind);
    } else {
        currentDealTypeFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра');
            window.selectedQuarterCadNumber = null;
        }
    }
    
    renderDealTypeFilters();
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    console.log(`🔍 applyDealTypeFilter: level=${level}, parentId=${parentId}, filter=${currentDealTypeFilter}`);
    
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
function applyCityFilter(city) {
    const index = currentCityFilter.indexOf(city);
    if (index === -1) {
        currentCityFilter.push(city);
    } else {
        currentCityFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра города');
            window.selectedQuarterCadNumber = null;
        }
    }
    
    renderCityFilters();
    
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
function applyObjectTypeFilter(type) {
    const index = currentObjectTypeFilter.indexOf(type);
    if (index === -1) {
        currentObjectTypeFilter.push(type);
    } else {
        currentObjectTypeFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра типа объекта');
            window.selectedQuarterCadNumber = null;
        }
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
    const index = currentWallMaterialFilter.indexOf(type);
    if (index === -1) {
        currentWallMaterialFilter.push(type);
    } else {
        currentWallMaterialFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра материала стен');
            window.selectedQuarterCadNumber = null;
        }
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
    const index = currentQuarterFilter.indexOf(type);
    if (index === -1) {
        currentQuarterFilter.push(type);
    } else {
        currentQuarterFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра квартала сделки');
            window.selectedQuarterCadNumber = null;
        }
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
    const index = currentYearBuildFilter.indexOf(type);
    if (index === -1) {
        currentYearBuildFilter.push(type);
    } else {
        currentYearBuildFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра года постройки');
            window.selectedQuarterCadNumber = null;
        }
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
function applyPurposeFilter(type) {
    const index = currentPurposeFilter.indexOf(type);
    if (index === -1) {
        currentPurposeFilter.push(type);
    } else {
        currentPurposeFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра назначения');
            window.selectedQuarterCadNumber = null;
        }
    }
    
    renderPurposeFilters();
    
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
function applyVriFilter(type) {
    const index = currentVriFilter.indexOf(type);
    if (index === -1) {
        currentVriFilter.push(type);
    } else {
        currentVriFilter.splice(index, 1);
    }
    
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра ВРИ');
            window.selectedQuarterCadNumber = null;
        }
    }
    
    renderVriFilters();
    
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
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
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
    
    let objectsWithFilteredDeals = [];
    
    if (level === 2 && parentId) {
        targetObjects.forEach(f => {
            const cadNum = f.properties.cadastral_number;
            if (!cadNum) return;
            
          const deals = dealsData[cadNum] || [];
const filteredDeals = deals.filter(deal => {
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
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
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
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
        updateQuartersListWithFilteredObjects(null);
        return;
    }
    
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

const medianPrice = prices.length > 0 ? getMedian(prices) : 0;
const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
const medianUprs = uprsValues.length > 0 ? getMedian(uprsValues) : 0;
    
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
    
    updateQuartersListWithFilteredObjects(null);
}

function updateMapStatsFromDeals(level, parentId) {
    const statUpks = document.getElementById('stat-upks');
const statCadCost = document.getElementById('stat-cadcost');
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
    
    const allQuartersFromDeals = allCadNumbers
        .filter(cad => cad.startsWith(prefix))
        .map(cad => ({
            properties: { 
                cadastral_number: cad,
                level: 2,
                district_id: parentId
            }
        }));
    
    const allObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(parentId);
    });
    
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
    
    // ✅ ПРАВИЛЬНО: медиана ВСЕХ сделок (без взвешивания по кварталам)
    let allPrices = [];
    let allUprs = [];
    let allUpks = [];
    let allCadCosts = [];
    let totalDeals = 0;
    let quartersWithDeals = [];

    allQuarters.forEach(f => {
        const cadNum = f.properties?.cadastral_number;
        if (!cadNum) return;
        
        const deals = dealsData[cadNum] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            quartersWithDeals.push(cadNum);
            filteredDeals.forEach(d => {
                if (d.price > 0) allPrices.push(d.price);
                if (d.uprs > 0) allUprs.push(d.uprs);
                if (d.upks > 0) allUpks.push(d.upks);
                if (d.cad_cost > 0) allCadCosts.push(d.cad_cost);
            });
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

    const medianPrice = allPrices.length > 0 ? getMedian(allPrices) : 0;
    const medianUprs = allUprs.length > 0 ? getMedian(allUprs) : 0;
    const medianUpks = allUpks.length > 0 ? getMedian(allUpks) : 0;
    const medianCadCost = allCadCosts.length > 0 ? getMedian(allCadCosts) : 0;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;

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
    statTotalDeals.textContent = totalDeals.toLocaleString();
    if (statUpks) statUpks.textContent = formatUprs(medianUpks);
    if (statCadCost) statCadCost.textContent = formatPrice(medianCadCost);
    
    if (statObjects) statObjects.textContent = allQuarters.length;
    if (statWithDeals) statWithDeals.textContent = quartersWithDeals.length;
    
  const quartersList = document.getElementById('quarters-list');
if (quartersList) {
    // Функция для подсчета сделок напрямую (без вызова getDealsCountForObject)
    function getFilteredDealsCount(feature) {
        const cadNum = feature.properties?.cadastral_number;
        if (!cadNum) return 0;
        const deals = dealsData[cadNum] || [];
        return deals.filter(d => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(d.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(d.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(d.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(d.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(d.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(d.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(d.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(d.vri)) return false;
            return true;
        }).length;
    }

    const sortedQuarters = allQuarters.filter(f => {
        const cadNum = f.properties?.cadastral_number;
        if (!cadNum) return false;
        const deals = dealsData[cadNum] || [];
        const filtered = deals.filter(d => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(d.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(d.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(d.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(d.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(d.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(d.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(d.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(d.vri)) return false;
            return true;
        });
        return filtered.length > 0;
    }).sort((a, b) => {
        const countA = getFilteredDealsCount(a);
        const countB = getFilteredDealsCount(b);
        return countB - countA;
    });
    
    if (sortedQuarters.length === 0) {
        quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
    } else {
        let html = '';
        sortedQuarters.forEach(f => {
            const cadNum = f.properties?.cadastral_number || '—';
            const count = getFilteredDealsCount(f);
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

function updatePopupsAndTooltips(level) {
    if (!window.mapLayer) return;
    
    console.log(`🔄 updatePopupsAndTooltips: level=${level}, filter=${currentDealTypeFilter}`);
    
    window.mapLayer.eachLayer(function(layer) {
        if (!layer.feature || !layer.feature.properties) return;
        
        const props = layer.feature.properties;
        const levelName = props.level_name || 'unknown';
        
        if (levelName === 'district') {
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
                console.log(`✅ Тултип обновлен для: ${props.district_name}`);
            }
        }
        
        if (levelName === 'quarter') {
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

    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });

    const allQuarters = [...allQuartersFromDeals];
    districtObjects.forEach(f => {
        const cadNumObj = f.properties.cadastral_number;
        if (cadNumObj && !allQuarters.some(q => q.properties.cadastral_number === cadNumObj)) {
            allQuarters.push(f);
        }
    });

    // ✅ ПРАВИЛЬНО: медиана ВСЕХ сделок
    let allPrices = [];
    let allUprs = [];
    let allUpks = [];
    let allCadCosts = [];
    let totalDeals = 0;
    
    allQuarters.forEach(f => {
        const cadNumObj = f.properties?.cadastral_number;
        if (!cadNumObj) return;
        
        const deals = dealsData[cadNumObj] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            filteredDeals.forEach(d => {
                if (d.price > 0) allPrices.push(d.price);
                if (d.uprs > 0) allUprs.push(d.uprs);
                if (d.upks > 0) allUpks.push(d.upks);
                if (d.cad_cost > 0) allCadCosts.push(d.cad_cost);
            });
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
    
    const medianPrice = allPrices.length > 0 ? getMedian(allPrices) : 0;
    const medianUprs = allUprs.length > 0 ? getMedian(allUprs) : 0;
    const medianUpks = allUpks.length > 0 ? getMedian(allUpks) : 0;
    const medianCadCost = allCadCosts.length > 0 ? getMedian(allCadCosts) : 0;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    
    const formatNum = (num) => num.toLocaleString();
    const formatPrice = (num) => num.toLocaleString() + ' ₽';
    const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
    
return `
    <div class="popup-title">📋 ${districtName}</div>
    <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
    ${totalDeals > 0 ? `
    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(medianPrice)}</span></div>
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(medianCadCost)}</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(medianUprs)}</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(medianUpks)}</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
    ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
`;
}
function updateQuartersListWithFilteredObjects(objectsWithDeals) {
    const quartersList = document.getElementById('quarters-list');
    if (!quartersList) return;
    
    const level = currentLevel;
    const parentId = currentParentId;
    
    let allQuarters = [];
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    
    if (level === 0 || level === 1) {
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
        allQuarters = allObjects.filter(f => {
            if (f.properties.level !== 2) return false;
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
        
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
    
const withDeals = allQuarters.filter(f => {
    const cadNum = f.properties?.cadastral_number;
    if (!cadNum) return false;
    
    const deals = dealsData[cadNum] || [];
const filtered = deals.filter(d => {
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(d.kind)) return false;
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(d.city)) return false;
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(d.obj_kind)) return false;
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(d.wall_material)) return false;
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(d.quarter)) return false;
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(d.year_build)) return false;
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(d.purpose_text)) return false;
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(d.vri)) return false;
    return true;
});
    return filtered.length > 0;
});
    
    if (withDeals.length === 0) {
        quartersList.innerHTML = '<div style="color: #94a3b8; font-size: 12px; text-align: center; padding: 8px 0;">Нет сделок</div>';
        return;
    }
    
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
} 
function updateQuartersStyle(targetObjects) {
    if (!window.mapLayer) return;
    
    console.log(`🎨 Обновление стилей кварталов с фильтрами:`, {
        dealType: currentDealTypeFilter,
        city: currentCityFilter,
        objectType: currentObjectTypeFilter,
        wallMaterial: currentWallMaterialFilter,
        quarter: currentQuarterFilter,
        yearBuild: currentYearBuildFilter,
        purpose: currentPurposeFilter,
        vri: currentVriFilter
    });
    
    window.mapLayer.eachLayer(function(layer) {
        if (layer.feature && layer.feature.properties) {
            const props = layer.feature.properties;
            const cadNum = props.cadastral_number;
            
            if (!cadNum) return;
            
            const deals = dealsData[cadNum] || [];
            const filteredDeals = deals.filter(deal => {
                if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
                    return false;
                }
                if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
                    return false;
                }
                if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
                    return false;
                }
                if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
                    return false;
                }
                if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
                    return false;
                }
                if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
                    return false;
                }
                if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
                    return false;
                }
                if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
                    return false;
                }
                return true;
            });
            
            const dealsCount = filteredDeals.length;
            
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
    
    console.log('✅ Стили кварталов обновлены с учетом всех фильтров');
}

function initMapTab(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ Контейнер не найден:', containerId);
        return;
    }

    if (container._leaflet_id) {
        console.log('⚠️ Карта уже инициализирована');
        return;
    }

    mapInstance = L.map(container, {
        center: [66.0, 76.0],
        zoom: 5,
        zoomControl: true,
        boxZoom: false 
    });

    mapInstance.attributionControl.remove();

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(mapInstance);

    Promise.all([
        loadMapData(),
        loadDealsCSV()
    ]).then(() => {
        console.log('✅ Карта и данные загружены!');
        if (mapData) {
            renderMapLevel(currentLevel || 0, currentParentId);
        }
    }).catch(error => {
        console.error('❌ Ошибка загрузки:', error);
    });
}

async function loadMapData() {
    try {
        console.log('📥 Загрузка:', MAP_URL);
        const response = await fetch(MAP_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        mapData = await response.json();
        console.log('✅ Данные карты загружены:', mapData.features?.length || 0);
        
        if (Object.keys(dealsData).length > 0) {
            renderMapLevel(0);
        } else {
            console.log('⏳ Ожидаем загрузку данных о сделках...');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        showMapError(error.message);
    }
}

function renderMapLevel(level, parentId = null) {
    if (level === 2 && parentId) {
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при переходе на район:', parentId);
            window.selectedQuarterCadNumber = null;
        }
    }
}

if (level === 0) {
    window.selectedQuarterCadNumber = null;
    currentDistrictFilter = null;
}
    
    currentLevel = level;
    currentParentId = parentId;
     if (level === 2 && parentId) {
        currentDistrictFilter = parentId;
    } else {
        currentDistrictFilter = null;
    }
    
    if (!mapData || !mapInstance) {
        console.warn('⚠️ mapData или mapInstance не инициализированы');
        return;
    }

    console.log(`🔍 Фильтрация: level=${level}, parentId=${parentId}`);
    console.log(`📊 Всего объектов в mapData: ${mapData.features.length}`);

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

let filtered = mapData.features.filter(f => {
    const props = f.properties;
    const cadNum = props.cadastral_number || '';
    const isWrapper = cadNum.endsWith('000000') || cadNum.endsWith('0000000');
    
    if (level === 0) {
        return props.level === 0;
    }
    
    if (level === 1) {
        if (props.level === 1) return true;
        if (props.level === 2 && isWrapper) return true;
        return false;
    }
    
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

    const wrapperQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return cadNum.endsWith('000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    const normalQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return !cadNum.endsWith('000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    console.log(`📊 Оберток: ${wrapperQuarters.length}, кварталов: ${normalQuarters.length}`);

if (wrapperQuarters.length > 0) {
window.wrapperLayer = L.geoJSON(wrapperQuarters, {
    style: function(feature) {
        return {
            fillColor: 'transparent',
            fillOpacity: 0,
            color: '#dc2626',
            weight: 2.5,
            opacity: 0.8,
            dashArray: '6 4'
        };
    },
onEachFeature: function(feature, layer) {
    const cadNum = feature.properties.cadastral_number || '—';
    
function updateTooltip() {
const deals = dealsData[cadNum] || [];
const filteredDeals = deals.filter(deal => {
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
        return false;
        }
    return true;
});
        
        const dealsCount = filteredDeals.length;
        const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
        const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
    const upksValues = filteredDeals.map(d => d.upks).filter(u => u > 0);
const cadCostValues = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
        
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
    const upksMedian = upksValues.length > 0 ? getMedian(upksValues) : 0;
const cadCostMedian = cadCostValues.length > 0 ? getMedian(cadCostValues) : 0;
        
        const tooltipContent = `
            <div class="popup-title">${cadNum}</div>
            <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
            ${dealsCount > 0 ? `
            <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
            <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
            <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
            <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${upksMedian.toFixed(2)} ₽/м²</span></div>
<div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${cadCostMedian.toLocaleString()} ₽</span></div>
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
    
    layer._updateTooltip = updateTooltip;
    
    updateTooltip();
    
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
    
   layer.on('click', function(e) {
    updateTooltip();
    this.openTooltip();
    if (this.getBounds && this.getBounds().isValid()) {
        mapInstance.fitBounds(this.getBounds(), { padding: [40, 40] });
    }
});
}
}).addTo(mapInstance);
    
    console.log(`✅ Добавлена обертка (${wrapperQuarters.length} шт.) СНИЗУ`);
}

if (normalQuarters.length > 0) {
    const normalLayer = L.geoJSON(normalQuarters, {
        style: function(feature) {
            const props = feature.properties;
            const levelName = props.level_name || 'unknown';
            const cadNum = props.cadastral_number;
            
    const deals = dealsData[cadNum] || [];
const filteredDeals = deals.filter(deal => {
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
        return false;
        }
    return true;
});
            const filteredCount = filteredDeals.length;
            const hasDeals = filteredCount > 0;
            
        if (levelName === 'district') {
    return {
        fillColor: '#e2e8f0',
        fillOpacity: 0.1,
        color: '#2563eb',
        weight: 2.5,
        opacity: 0.5,
        dashArray: null
    };
}
            
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
    

    if (window.wrapperLayer) {
        window.wrapperLayer.setStyle({
            fillOpacity: 0.25,
            weight: 1,
            color: '#ff0000',
            opacity: 0.4,
            dashArray: '4 4'
        });
    }
    
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
    
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level); 
    addMapLegend();
    
    if (level === 1 && window.mapLayer) {
        addLabelsToPolygons(window.mapLayer, filtered, level);
    }

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
    
    if (level === 1 && window.mapLayer) {
        addLabelsToPolygons(window.mapLayer, filtered, level);
    }
    updateActiveFiltersDisplay();
     renderDealsTable(); 
}

function getMapColor(dealsCount) {
    if (!dealsCount || dealsCount === 0) return '#f1f5f9';
    
    if (dealsCount <= 100) return '#ef4444';
    if (dealsCount <= 500) return '#f59e0b';
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

    const districtObjects = mapData.features.filter(f => {
        if (f.properties.level !== 2) return false;
        const fParentId = f.properties.parent_id || f.properties.district_id;
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });

    const allQuarters = [...allQuartersFromDeals];

    districtObjects.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (cadNumFeature && !allQuarters.some(q => q.properties.cadastral_number === cadNumFeature)) {
            allQuarters.push(f);
        }
    });

    console.log(`📊 Попап: всего кварталов для района ${districtId}: ${allQuarters.length}`);
        
    // ✅ ПРАВИЛЬНО: медиана ВСЕХ сделок
    let allPrices = [];
    let allUprs = [];
    let allUpks = [];
    let allCadCosts = [];
    let totalDeals = 0;
    
    allQuarters.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (!cadNumFeature) return;
        
        const deals = dealsData[cadNum] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            filteredDeals.forEach(d => {
                if (d.price > 0) allPrices.push(d.price);
                if (d.uprs > 0) allUprs.push(d.uprs);
                if (d.upks > 0) allUpks.push(d.upks);
                if (d.cad_cost > 0) allCadCosts.push(d.cad_cost);
            });
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
    
    const medianPrice = allPrices.length > 0 ? getMedian(allPrices) : 0;
    const medianUprs = allUprs.length > 0 ? getMedian(allUprs) : 0;
    const medianUpks = allUpks.length > 0 ? getMedian(allUpks) : 0;
    const medianCadCost = allCadCosts.length > 0 ? getMedian(allCadCosts) : 0;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    
    const formatNum = (num) => num.toLocaleString();
    const formatPrice = (num) => num.toLocaleString() + ' ₽';
    const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
    
        const popupContent = `
       <div class="popup-title">📋 ${districtName}</div>
    <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
    ${totalDeals > 0 ? `
    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(medianPrice)}</span></div>
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(medianCadCost)}</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(medianUprs)}</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(medianUpks)}</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
    ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
`;
        
        layer.bindPopup(popupContent, { 
            className: 'custom-popup', 
            maxWidth: 300,
            closeButton: true
        });
        
        const tooltipContent = `
          <div class="popup-title">📋 ${districtName}</div>
    <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
    ${totalDeals > 0 ? `
    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(medianPrice)}</span></div>
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(medianCadCost)}</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(medianUprs)}</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(medianUpks)}</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
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
    
    layer.on('click', function(e) {
        if (levelName === 'okrug') {
            renderMapLevel(1);
            updateBreadcrumb('okrug');
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
            }
        } else if (levelName === 'district') {
            if (layer && layer.setStyle) {
                layer.setStyle({
                    weight: 2.5,
                    color: '#2563eb',
                    opacity: 0.7,
                    fillOpacity: 0.3
                });
            }
            
            if (window.wrapperLayer) {
                window.wrapperLayer.setStyle({
                    fillOpacity: 0.25,
                    weight: 1,
                    color: '#ff0000',
                    opacity: 0.4,
                    dashArray: '4 4'
                });
            }
            
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
            const cadNum = props.cadastral_number;
            const dealsCount = cadNum ? (dealsData[cadNum] || []).length : 0;
            console.log('🏘️ Квартал выбран:', cadNum);
            console.log('📊 Сделок:', dealsCount);
               window.selectedQuarterCadNumber = cadNum;
    
    renderDealsTable();
            
            if (layer.getBounds && layer.getBounds().isValid()) {
                mapInstance.fitBounds(layer.getBounds(), { padding: [20, 20] });
            } else if (layer.getLatLng) {
                mapInstance.setView(layer.getLatLng(), 15);
            }
            layer.openPopup();
        }
    });

layer.on('mouseover', function(e) {
    if (!this || !this.setStyle) return;
    
    const lvl = feature?.properties?.level || 0;
    
    if (lvl === 2) {
        const cadNum = feature?.properties?.cadastral_number;
        const deals = cadNum ? (dealsData[cadNum] || []) : [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
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
    }
    
    this.bringToFront();
    if (this._container) {
        this._container.style.cursor = 'pointer';
    }
});

layer.on('mouseout', function(e) {
    if (!this || !this.setStyle || !feature) return;
    
    const level = feature.properties?.level || 0;
    const cadNum = feature.properties?.cadastral_number;
    
    if (level === 2) {
        const deals = cadNum ? (dealsData[cadNum] || []) : [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
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
        return String(fParentId) === String(districtId) || 
               String(f.properties.district_id) === String(districtId);
    });
    
    const prefix = String(districtId).substring(0, 5);
    const allCadNumbers = Object.keys(dealsData);
    const wrapperQuarters = allCadNumbers.filter(cad => {
        if (!cad.endsWith('000000') && !cad.match(/^\d{2}:\d{2}:000000$/)) return false;
        return String(cad).startsWith(prefix);
    });
    
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
    
    // ✅ ПРАВИЛЬНО: медиана ВСЕХ сделок
    let allPrices = [];
    let allUprs = [];
    let allUpks = [];
    let allCadCosts = [];
    let totalDeals = 0;
    
    allQuarters.forEach(f => {
        const cadNumFeature = f.properties.cadastral_number;
        if (!cadNumFeature) return;
        
        const deals = dealsData[cadNum] || [];
        const filteredDeals = deals.filter(deal => {
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            filteredDeals.forEach(d => {
                if (d.price > 0) allPrices.push(d.price);
                if (d.uprs > 0) allUprs.push(d.uprs);
                if (d.upks > 0) allUpks.push(d.upks);
                if (d.cad_cost > 0) allCadCosts.push(d.cad_cost);
            });
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
    
    const medianPrice = allPrices.length > 0 ? getMedian(allPrices) : 0;
    const medianUprs = allUprs.length > 0 ? getMedian(allUprs) : 0;
    const medianUpks = allUpks.length > 0 ? getMedian(allUpks) : 0;
    const medianCadCost = allCadCosts.length > 0 ? getMedian(allCadCosts) : 0;
    const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    
    return `
    <div class="popup-title">📋 ${districtName}</div>
    <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
    ${totalDeals > 0 ? `
    <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${totalDeals.toLocaleString()}</span></div>
    <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${medianCadCost.toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${medianUprs.toFixed(2)} ₽/м²</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${medianUpks.toFixed(2)} ₽/м²</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
    ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
`;
}
if (levelName === 'quarter') {
    const cadNum = props.cadastral_number || '—';
    
    const deals = dealsData[cadNum] || [];
    const filteredDeals = deals.filter(deal => {
        if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
        if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
        if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
        if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
        if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
        if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
        if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
        if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
        return true;
    });
    
    const dealsCount = filteredDeals.length;
    const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
    const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
    const upksValues = filteredDeals.map(d => d.upks).filter(u => u > 0);
    const cadCostValues = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
    
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
    const upksMedian = getMedian(upksValues);
    const cadCostMedian = getMedian(cadCostValues);
    
    return `
      <div class="popup-title">${cadNum}</div>
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${dealsCount}</span></div>
        ${dealsCount > 0 ? `
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${medianPrice.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${cadCostMedian.toLocaleString()} ₽</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${uprsMedian.toFixed(2)} ₽/м²</span></div>
        <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${upksMedian.toFixed(2)} ₽/м²</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${minPrice.toLocaleString()} / ${maxPrice.toLocaleString()} ₽</span></div>
        ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
    `;
}
    
    return `<div>Неизвестный уровень</div>`;
}

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
    
    if (level === 'okrug') {
        breadcrumb.innerHTML = `
            <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:600; font-size:0.95rem;">ЯНАО</span>
        `;
    } else if (level === 'district') {
        breadcrumb.innerHTML = `
            <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">ЯНАО</span>
            <span style="color:#94a3b8; margin:0 4px;">›</span>
            <span style="font-weight:600; font-size:0.95rem;">${name || id}</span>
        `;
    } else if (level === 'quarter') {
        if (isSearch) {
            breadcrumb.innerHTML = `
                <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">ЯНАО</span>
                <span style="color:#94a3b8; margin:0 4px;">›</span>
                <span style="font-weight:600; font-size:0.95rem;">${districtName}</span>
            `;
        } else {
            breadcrumb.innerHTML = `
                <span onclick="renderMapLevel(0)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">ЯНАО</span>
                <span style="color:#94a3b8; margin:0 4px;">›</span>
                <span onclick="renderMapLevel(1)" style="cursor:pointer;color:#0ea5e9; font-weight:500;">${districtName}</span>
                <span style="color:#94a3b8; margin:0 4px;">›</span>
                <span style="font-weight:600; font-size:0.95rem;">Кварталы</span>
            `;
        }
    }
}

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
    
    currentDealTypeFilter = [];
    currentCityFilter = [];
    currentObjectTypeFilter = [];
    currentWallMaterialFilter = [];
    currentQuarterFilter = [];
    currentYearBuildFilter = []; 
    currentPurposeFilter = [];   
    currentVriFilter = [];   
    
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters(); 
    renderYearBuildFilters();
      renderPurposeFilters();     
    renderVriFilters();      
    
    renderMapLevel(currentLevel, currentParentId);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    console.log('✅ Все фильтры сброшены');
}

function updateActiveFiltersDisplay() {
    const container = document.getElementById('active-filters-list');
    if (!container) return;
    
    const activeFilters = [];
    
    if (currentCityFilter.length > 0) {
        activeFilters.push('Город');
    }
    if (currentObjectTypeFilter.length > 0) {
        activeFilters.push('Тип объекта');
    }
    if (currentDealTypeFilter.length > 0) {
        activeFilters.push('Тип сделки');
    }
    if (currentQuarterFilter.length > 0) {
        activeFilters.push('Квартал');
    }
    if (currentWallMaterialFilter.length > 0) {
        activeFilters.push('Материал стен');
    }
    if (currentYearBuildFilter.length > 0) {
        activeFilters.push('Год постройки');
    }
    if (currentPurposeFilter.length > 0) {
    activeFilters.push('Назначение');
}
if (currentVriFilter.length > 0) {
    activeFilters.push('ВРИ');
}
    if (activeFilters.length === 0) {
        container.textContent = '—';
        container.style.color = '#94a3b8';
    } else {
        container.innerHTML = activeFilters.map(f => 
            `<span style="
                background: #e0f2fe; 
                color: #0284c7; 
                padding: 1px 10px; 
                border-radius: 12px; 
                font-weight: 500;
                font-size: 10px;
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
    
    const selectedQuarter = window.selectedQuarterCadNumber || null;
    
    let filteredDeals = allDealsFlat.filter(deal => {
        const isWrapperSelected = selectedQuarter ? (
            selectedQuarter.endsWith('000000') || selectedQuarter.match(/^\d{2}:\d{2}:000000$/)
        ) : false;
        
        if (selectedQuarter) {
            if (isWrapperSelected) {
                if (deal.cad_number !== selectedQuarter) return false;
            } else {
                if (deal.cad_number !== selectedQuarter) return false;
            }
        } else if (currentDistrictFilter) {
            const prefix = String(currentDistrictFilter).substring(0, 5);
            if (!deal.cad_number.startsWith(prefix)) return false;
        }
        
        if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return false;
        if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
        if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return false;
        if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return false;
        if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
        if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
        if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
        if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
        return true;
    });
    
    filteredDeals.sort((a, b) => {
        const cadCostA = a.cad_cost || 0;
        const priceA = a.deal_price_rub || 0;
        const diffA = cadCostA > 0 ? cadCostA - priceA : null;
        
        const cadCostB = b.cad_cost || 0;
        const priceB = b.deal_price_rub || 0;
        const diffB = cadCostB > 0 ? cadCostB - priceB : null;
        
        if (diffA === null && diffB === null) return 0;
        if (diffA === null) return 1;
        if (diffB === null) return -1;
        return diffA - diffB;
    });
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif; table-layout: fixed;">
            <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('cad_number')">Кад. квартал ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('area')">Площадь ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('purpose_text')">Назначение ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('cad_cost')">Кад. стоимость ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('upks')">УПКС ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('city')">Город ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('deal_kind_text')">Тип сделки ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('obj_kind_text')">Тип объекта ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('vri')">ВРИ ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('quarter')">Квартал ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('year_build')">Год постр. ↕</th>
<th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 4%; cursor: pointer;" onclick="sortDealsTable('floor')">Этаж ↕</th>
<th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('location')">Локация ↕</th>
<th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('wall_material_name')">Материал стен ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('deal_price_rub')">Цена сделки ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('uprs_rub')">УПРС ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('diff_abs')">Разница (абс.) ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('diff_percent')">Разница (%) ↕</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (filteredDeals.length === 0) {
        html += `
                <tr>
                    <td colspan="18" style="text-align: center; padding: 30px 0; color: #94a3b8; font-size: 14px;">
                        Нет данных для отображения
                    </td>
                </tr>
        `;
    } else {
        const displayDeals = filteredDeals.slice(0, 100);
        
        displayDeals.forEach((deal, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            
            const cadCost = deal.cad_cost || 0;
            const price = deal.deal_price_rub || 0;
            const hasCadCost = cadCost > 0;
            
            let diffAbs = null;
            let diffPercent = null;
            let diffColor = '#64748b';
            let diffPercentColor = '#64748b';
            
            if (hasCadCost) {
                diffAbs = cadCost - price;
                diffPercent = (diffAbs / cadCost) * 100;
                
                if (diffAbs > 0) {
                    diffColor = '#22c55e';
                    diffPercentColor = '#22c55e';
                } else if (diffAbs < 0) {
                    diffColor = '#ef4444';
                    diffPercentColor = '#ef4444';
                }
            }
            
            const diffAbsFormatted = (hasCadCost && diffAbs !== 0) ? diffAbs.toLocaleString('ru-RU') + ' ₽' : '—';
            const diffPercentFormatted = (hasCadCost && diffPercent !== null && diffPercent !== 0) 
                ? (diffPercent > 0 ? '+' : '') + diffPercent.toFixed(1) + '%' 
                : '—';
            
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${bgColor};">
                    <td style="text-align: center; padding: 6px 6px; font-family: monospace; font-size: 10px; color: #1e293b; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.cad_number || 'nan'}">${deal.cad_number || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.area ? deal.area.toFixed(1) : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.purpose_text || 'nan'}">${deal.purpose_text || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.cad_cost ? deal.cad_cost.toLocaleString('ru-RU') : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.upks ? deal.upks.toFixed(2) : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.city || 'nan'}">${deal.city || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.deal_kind_text || 'nan'}">${deal.deal_kind_text || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.obj_kind_text || 'nan'}">${deal.obj_kind_text || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.vri || 'nan'}">${deal.vri || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.quarter || 'nan'}">${deal.quarter || 'nan'}</td>
                   <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.year_build || 'nan'}</td>
<td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.floor || 'nan'}</td>
<td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px;" title="${deal.location || 'nan'}">${deal.location || 'nan'}</td>
<td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.wall_material_name || 'nan'}">${deal.wall_material_name || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.deal_price_rub ? deal.deal_price_rub.toLocaleString('ru-RU') : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.uprs_rub ? deal.uprs_rub.toFixed(2) : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: ${diffColor}; font-weight: 600; font-size: 10px;">${diffAbsFormatted}</td>
                    <td style="text-align: center; padding: 6px 6px; color: ${diffPercentColor}; font-weight: 600; font-size: 10px;">${diffPercentFormatted}</td>
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
let dealsSortField = 'diff_abs';
let dealsSortAsc = true;

function sortDealsTable(field) {
    if (dealsSortField === field) {
        dealsSortAsc = !dealsSortAsc;
    } else {
        dealsSortField = field;
        dealsSortAsc = true;
    }
    
    const selectedQuarter = window.selectedQuarterCadNumber || null;
    
    let filteredDeals = allDealsFlat.filter(deal => {
        const isWrapperSelected = selectedQuarter ? (
            selectedQuarter.endsWith('000000') || selectedQuarter.match(/^\d{2}:\d{2}:000000$/)
        ) : false;
        
        if (selectedQuarter) {
            if (isWrapperSelected) {
                if (deal.cad_number !== selectedQuarter) return false;
            } else {
                if (deal.cad_number !== selectedQuarter) return false;
            }
        } else if (currentDistrictFilter) {
            const prefix = String(currentDistrictFilter).substring(0, 5);
            if (!deal.cad_number.startsWith(prefix)) return false;
        }
        
        if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return false;
        if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
        if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return false;
        if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return false;
        if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
        if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
        if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
        if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
        return true;
    });
    
    filteredDeals.sort((a, b) => {
        let valA, valB;
        
        if (field === 'diff_abs') {
            const cadCostA = a.cad_cost || 0;
            const priceA = a.deal_price_rub || 0;
            valA = cadCostA > 0 ? cadCostA - priceA : null;
            
            const cadCostB = b.cad_cost || 0;
            const priceB = b.deal_price_rub || 0;
            valB = cadCostB > 0 ? cadCostB - priceB : null;
            
            if (valA === null && valB === null) return 0;
            if (valA === null) return 1;
            if (valB === null) return -1;
            
            return dealsSortAsc ? valA - valB : valB - valA;
        }
        
        if (field === 'diff_percent') {
            const cadCostA = a.cad_cost || 0;
            const priceA = a.deal_price_rub || 0;
            valA = cadCostA > 0 ? ((cadCostA - priceA) / cadCostA) * 100 : null;
            
            const cadCostB = b.cad_cost || 0;
            const priceB = b.deal_price_rub || 0;
            valB = cadCostB > 0 ? ((cadCostB - priceB) / cadCostB) * 100 : null;
            
            if (valA === null && valB === null) return 0;
            if (valA === null) return 1;
            if (valB === null) return -1;
            
            return dealsSortAsc ? valA - valB : valB - valA;
        }
        
        const numericFields = ['area', 'cad_cost', 'upks', 'deal_price_rub', 'uprs_rub', 'year_build'];
        if (numericFields.includes(field)) {
            valA = a[field] || 0;
            valB = b[field] || 0;
            return dealsSortAsc ? valA - valB : valB - valA;
        }
        
        valA = (a[field] || 'nan').toString().toLowerCase();
        valB = (b[field] || 'nan').toString().toLowerCase();
        
        if (dealsSortAsc) {
            return valA.localeCompare(valB);
        } else {
            return valB.localeCompare(valA);
        }
    });
    
    const container = document.getElementById('deals-table-container');
    if (!container) return;
    
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif; table-layout: fixed;">
            <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('cad_number')">Кад. квартал ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('area')">Площадь ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('purpose_text')">Назначение ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('cad_cost')">Кад. стоимость ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('upks')">УПКС ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('city')">Город ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('deal_kind_text')">Тип сделки ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('obj_kind_text')">Тип объекта ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('vri')">ВРИ ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('quarter')">Квартал ↕</th>
                   <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 5%; cursor: pointer;" onclick="sortDealsTable('year_build')">Год постр. ↕</th>
<th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 4%; cursor: pointer;" onclick="sortDealsTable('floor')">Этаж ↕</th>
<th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('location')">Локация ↕</th>
<th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('wall_material_name')">Материал стен ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('deal_price_rub')">Цена сделки ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('uprs_rub')">УПРС ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('diff_abs')">Разница (абс.) ↕</th>
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 6%; cursor: pointer;" onclick="sortDealsTable('diff_percent')">Разница (%) ↕</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (filteredDeals.length === 0) {
        html += `
                <tr>
                    <td colspan="18" style="text-align: center; padding: 30px 0; color: #94a3b8; font-size: 14px;">
                        Нет данных для отображения
                    </td>
                </tr>
        `;
    } else {
        const displayDeals = filteredDeals.slice(0, 100);
        
        displayDeals.forEach((deal, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            
            const cadCost = deal.cad_cost || 0;
            const price = deal.deal_price_rub || 0;
            const hasCadCost = cadCost > 0;
            
            let diffAbs = null;
            let diffPercent = null;
            let diffColor = '#64748b';
            let diffPercentColor = '#64748b';
            
            if (hasCadCost) {
                diffAbs = cadCost - price;
                diffPercent = (diffAbs / cadCost) * 100;
                
                if (diffAbs > 0) {
                    diffColor = '#22c55e';
                    diffPercentColor = '#22c55e';
                } else if (diffAbs < 0) {
                    diffColor = '#ef4444';
                    diffPercentColor = '#ef4444';
                }
            }
            
            const diffAbsFormatted = (hasCadCost && diffAbs !== 0) ? diffAbs.toLocaleString('ru-RU') + ' ₽' : '—';
            const diffPercentFormatted = (hasCadCost && diffPercent !== null && diffPercent !== 0) 
                ? (diffPercent > 0 ? '+' : '') + diffPercent.toFixed(1) + '%' 
                : '—';
            
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${bgColor};">
                    <td style="text-align: center; padding: 6px 6px; font-family: monospace; font-size: 10px; color: #1e293b; font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.cad_number || 'nan'}">${deal.cad_number || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.area ? deal.area.toFixed(1) : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.purpose_text || 'nan'}">${deal.purpose_text || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.cad_cost ? deal.cad_cost.toLocaleString('ru-RU') : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.upks ? deal.upks.toFixed(2) : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.city || 'nan'}">${deal.city || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.deal_kind_text || 'nan'}">${deal.deal_kind_text || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.obj_kind_text || 'nan'}">${deal.obj_kind_text || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.vri || 'nan'}">${deal.vri || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.quarter || 'nan'}">${deal.quarter || 'nan'}</td>
                   <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.year_build || 'nan'}</td>
<td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.floor || 'nan'}</td>
<td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px;" title="${deal.location || 'nan'}">${deal.location || 'nan'}</td>
<td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${deal.wall_material_name || 'nan'}">${deal.wall_material_name || 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.deal_price_rub ? deal.deal_price_rub.toLocaleString('ru-RU') : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px;">${deal.uprs_rub ? deal.uprs_rub.toFixed(2) : 'nan'}</td>
                    <td style="text-align: center; padding: 6px 6px; color: ${diffColor}; font-weight: 600; font-size: 10px;">${diffAbsFormatted}</td>
                    <td style="text-align: center; padding: 6px 6px; color: ${diffPercentColor}; font-weight: 600; font-size: 10px;">${diffPercentFormatted}</td>
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
    if (window.selectedQuarterCadNumber) {
        return window.selectedQuarterCadNumber;
    }
    return null;
}
function addLabelsToPolygons(layer, features, level) {
    if (!layer || !features) return;
    
    if (level !== 1) return;
    
    if (window.districtLabels) {
        window.districtLabels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.districtLabels = [];
    }
    
    const districtFeatures = features.filter(f => f.properties.level === 1);
    
    const labels = [];
    
    districtFeatures.forEach(feature => {
        const props = feature.properties;
        const cadNum = props.district_id || props.cadastral_number || '';
        
        if (!cadNum) return;
        
        const coords = feature.geometry.coordinates[0];
        if (!coords || coords.length === 0) return;
        
        let lat = 0, lng = 0;
        coords.forEach(coord => {
            lat += coord[1];
            lng += coord[0];
        });
        lat /= coords.length;
        lng /= coords.length;
        
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
    
    window.districtLabels = labels;
}
function clearAllLabels() {
    if (window.districtLabels) {
        window.districtLabels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.districtLabels = [];
    }
    
    if (window.quarterLabels) {
        window.quarterLabels.forEach(label => {
            if (mapInstance) mapInstance.removeLayer(label);
        });
        window.quarterLabels = [];
    }
    
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
    
const found = mapData.features.find(f => {
    const cadNum = f.properties.cadastral_number || '';
    if (f.properties.level === 2) {
        return cadNum.toLowerCase().includes(query.toLowerCase());
    }
    if (f.properties.level === 1 && cadNum.endsWith('000000')) {
        return cadNum.toLowerCase().includes(query.toLowerCase());
    }
    return false;
});

if (!found) {
    const allCadNumbers = Object.keys(dealsData);
    const matchingCad = allCadNumbers.find(cad => 
        cad.toLowerCase().includes(query.toLowerCase())
    );
    if (matchingCad) {
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
    
    const cadNum = found.properties.cadastral_number || '';
    const isWrapper = cadNum.endsWith('000000') || cadNum.endsWith('0000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    
if (isWrapper) {
    console.log(`🔴 Найдена обертка: ${cadNum}, показываем на уровне районов`);
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
    
    setTimeout(() => {
        let foundLayer = null;
        
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
            
            if (foundLayer.openTooltip) {
                foundLayer.openTooltip();
            }
            
            if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
            }
            
            foundLayer.off('click');
            foundLayer.off('dblclick');
            
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
    
console.log(`🏘️ Обычный квартал: ${cadNum}, показываем разбиение`);

const districtId = found.properties.parent_id || found.properties.district_id;
const districtName = found.properties.district_name || districtId || 'Район';

renderMapLevel(2, districtId);
updateBreadcrumb('quarter', districtId, districtName, true);

window.selectedQuarterCadNumber = cadNum;

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
    renderDealsTable();
}, 300);
}
function searchQuarterByCadNumber(cadNumber) {
    if (!cadNumber) return;
    
    console.log(`🔍 Поиск квартала по номеру: ${cadNumber}`);
    
let found = mapData.features.find(f => {
    if (f.properties.level !== 2) return false;
    return f.properties.cadastral_number === cadNumber;
});

if (!found) {
    found = mapData.features.find(f => {
        if (f.properties.level !== 1) return false;
        const cadNum = f.properties.cadastral_number || '';
        return cadNum === cadNumber && cadNum.endsWith('000000');
    });
}

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
    
    const isWrapper = cadNumber.endsWith('000000') || cadNumber.match(/^\d{2}:\d{2}:000000$/);
    
  if (isWrapper) {
    console.log(`🔴 Найдена обертка: ${cadNumber}, показываем на уровне районов`);
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
    
 console.log(`🏘️ Обычный квартал: ${cadNumber}, показываем разбиение`);

const districtId = found.properties.parent_id || found.properties.district_id;
const districtName = found.properties.district_name || districtId || 'Район';

renderMapLevel(2, districtId);
updateBreadcrumb('quarter', districtId, districtName, true);

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
    renderDealsTable();
}, 300);
}
function exportDealsTableToExcel() {
    const container = document.getElementById('deals-table-container');
    if (!container) {
        console.warn('⚠️ Контейнер таблицы не найден');
        return;
    }
    
    const selectedQuarter = window.selectedQuarterCadNumber || null;
    
    let filteredDeals = allDealsFlat.filter(deal => {
        const isWrapperSelected = selectedQuarter ? (
            selectedQuarter.endsWith('000000') || selectedQuarter.match(/^\d{2}:\d{2}:000000$/)
        ) : false;
        
        if (selectedQuarter) {
            if (isWrapperSelected) {
                if (deal.cad_number !== selectedQuarter) return false;
            } else {
                if (deal.cad_number !== selectedQuarter) return false;
            }
        } else if (currentDistrictFilter) {
            const prefix = String(currentDistrictFilter).substring(0, 5);
            if (!deal.cad_number.startsWith(prefix)) return false;
        }
        
        if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return false;
        if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
        if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return false;
        if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return false;
        if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
        if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
        if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
        if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
        return true;
    });
    
    filteredDeals.sort((a, b) => {
        const cadCostA = a.cad_cost || 0;
        const priceA = a.deal_price_rub || 0;
        const diffA = cadCostA > 0 ? cadCostA - priceA : null;
        
        const cadCostB = b.cad_cost || 0;
        const priceB = b.deal_price_rub || 0;
        const diffB = cadCostB > 0 ? cadCostB - priceB : null;
        
        if (diffA === null && diffB === null) return 0;
        if (diffA === null) return 1;
        if (diffB === null) return -1;
        return diffA - diffB;
    });
    
    if (filteredDeals.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    const data = filteredDeals.map(deal => {
        const cadCost = deal.cad_cost || 0;
        const price = deal.deal_price_rub || 0;
        const hasCadCost = cadCost > 0;
        
        let diffAbs = '—';
        let diffPercent = '—';
        
        if (hasCadCost) {
            const diff = cadCost - price;
            diffAbs = diff !== 0 ? diff.toLocaleString('ru-RU') + ' ₽' : '0 ₽';
            diffPercent = (diff !== 0) ? ((diff / cadCost) * 100).toFixed(1) + '%' : '0%';
        }
        
       return {
    'Кад. квартал': deal.cad_number || 'nan',
    'Площадь': deal.area ? deal.area.toFixed(1) : 'nan',
    'Назначение': deal.purpose_text || 'nan',
    'Кад. стоимость': deal.cad_cost ? deal.cad_cost.toLocaleString('ru-RU') : 'nan',
    'УПКС': deal.upks ? deal.upks.toFixed(2) : 'nan',
    'Город': deal.city || 'nan',
    'Тип сделки': deal.deal_kind_text || 'nan',
    'Тип объекта': deal.obj_kind_text || 'nan',
    'ВРИ': deal.vri || 'nan',
    'Квартал': deal.quarter || 'nan',
    'Год постройки': deal.year_build || 'nan',
    'Этаж': deal.floor || 'nan',
    'Локация': deal.location || 'nan',
    'Материал стен': deal.wall_material_name || 'nan',
    'Цена сделки': deal.deal_price_rub ? deal.deal_price_rub.toLocaleString('ru-RU') : 'nan',
    'УПРС': deal.uprs_rub ? deal.uprs_rub.toFixed(2) : 'nan',
    'Разница (абс.)': diffAbs,
    'Разница (%)': diffPercent
};
    });
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Сделки");
    
    const colWidths = [];
    data.forEach(row => {
        Object.values(row).forEach((cell, idx) => {
            const len = String(cell).length;
            if (!colWidths[idx] || len > colWidths[idx]) {
                colWidths[idx] = Math.min(len + 2, 30);
            }
        });
    });
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    
    const fileName = `Сделки_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    console.log(`📊 Экспортировано ${filteredDeals.length} сделок в Excel`);
}

window.initMapTab = initMapTab;
window.destroyMap = destroyMap;
window.renderMapLevel = renderMapLevel;
window.searchQuarter = searchQuarter;
window.searchQuarterByCadNumber = searchQuarterByCadNumber; 
window.exportDealsTableToExcel = exportDealsTableToExcel;
console.log('✅ map-tab.js загружен');
