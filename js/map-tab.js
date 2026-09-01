window.mapInstance = null;
let mapData = null;
let currentLevel = 0;
let currentParentId = null;
let currentDistrictFilter = null;
let isUpdatingFromSearch = false;
let docxLoaded = false;

const MAP_URL = 'https://raw.githubusercontent.com/mark98molchanov-a11y/a13y.gko-registry-system/main/data/yanao_hierarchical_web.geojson';
let dealsData = {};
let dealTypes = {};
let cityTypes = {};
let objectTypes = {};
let wallMaterialTypes = {}; 
let quarterTypes = {}; 
let yearBuildTypes = {};
let purposeCount = {};   
let vriCount = {};   
let numberCount = {};
let ratioCategoryCount = {};
let currentDealTypeFilter = [];  
let currentCityFilter = [];  
let currentObjectTypeFilter = [];
let currentWallMaterialFilter = []; 
let currentQuarterFilter = [];
let currentYearBuildFilter = [];
let currentPurposeFilter = [];   
let currentVriFilter = [];
let currentNumberFilter = [];
let currentRatioCategoryFilter = []; 
let allDealsFlat = [];
let isHeatmapEnabled = false;
let isCadCostFilterEnabled = false;
let originalAllDealsFlatForCad = [];
window._isNSPDSearch = false;
window._isPopupOpening = false;
window._popupOpenCadNum = null; 
window._isWrapperTooltipForced = false;
window._wrapperTooltipLayer = null;
window._wrapperTooltipCadNum = null;
let currentChartGroupBy = 'city';
let syncAbortController = null;
let isSyncRunning = false;

function normalizeStreet(street) {
    if (!street) return '';
    return street
        .toLowerCase()
        // Убираем приставки
        .replace(/^(ул(?:ица)?|проспект|пер(?:еулок)?|бульвар|набережная|шоссе|площадь|аллея|тупик|проезд|переулок)\s*/i, '')
        // Убираем "имени"
        .replace(/^имени\s*/i, '')
        // Убираем сокращения типа "ул.", "пр-кт" и т.д.
        .replace(/^[а-яА-Я]{1,3}\.\s*/g, '')
        // Убираем кавычки и скобки
        .replace(/["']/g, '')
        // Убираем лишние пробелы
        .replace(/\s+/g, ' ')
        .trim();
}
function getStreetRoot(street) {
    if (!street) return '';
    return street
        .replace(/(?:ая|ый|ой|ое|ие|ых|их|ов|ев|ин|ский|ская|ское|ские)$/, '')
        .trim();
}
function extractHouseNumber(address) {
    if (!address) return '';
    // Ищем "д 117", "д.117", "дом 117", "д. 117"
    const match = address.match(/\b[дд]\.?\s*(\d+[А-Яа-я]?)/i);
    return match ? match[1] : '';
}
function extractStreetFromAddress(address) {
    if (!address) return '';
    
    // Паттерны для разных типов улиц
    const patterns = [
        /ул(?:ица)?\s+([^,\d]+?)(?:\s*[,д]|$)/i,           // "ул Совхозная"
        /проспект\s+([^,\d]+?)(?:\s*[,д]|$)/i,             // "проспект Мира"
        /пер(?:еулок)?\s+([^,\d]+?)(?:\s*[,д]|$)/i,        // "пер. Школьный"
        /бульвар\s+([^,\d]+?)(?:\s*[,д]|$)/i,              // "бульвар Строителей"
        /набережная\s+([^,\d]+?)(?:\s*[,д]|$)/i,           // "набережная Речная"
        /шоссе\s+([^,\d]+?)(?:\s*[,д]|$)/i,                // "шоссе Космонавтов"
        /площадь\s+([^,\d]+?)(?:\s*[,д]|$)/i,              // "площадь Ленина"
        /аллея\s+([^,\d]+?)(?:\s*[,д]|$)/i,                // "аллея Славы"
        /тупик\s+([^,\d]+?)(?:\s*[,д]|$)/i,                // "тупик Глухой"
        /проезд\s+([^,\d]+?)(?:\s*[,д]|$)/i,               // "проезд Школьный"
        /переулок\s+([^,\d]+?)(?:\s*[,д]|$)/i,             // "переулок Тихий"
        /(?:^|,\s*)([^,\d]+?)(?:\s*[,д]|$)/                // любое название без цифр
    ];
    
    for (const pattern of patterns) {
        const match = address.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }
    
    return '';
}
function toggleHeatmapMode() {
    isHeatmapEnabled = !isHeatmapEnabled;
    
    const btn = document.getElementById('heatmap-toggle-btn-header');
    if (btn) {
        if (isHeatmapEnabled) {
            btn.innerHTML = '✅ Тепловая карта';
            btn.style.background = '#dcfce7';
            btn.style.color = '#166534';
            btn.style.borderColor = '#86efac';
        } else {
            btn.innerHTML = 'Тепловая карта';
            btn.style.background = '#e0f2fe';
            btn.style.color = '#0284c7';
            btn.style.borderColor = '#bae6fd';
        }
    }
    
    // ✅ ОБНОВЛЯЕМ СТАРУЮ КНОПКУ (если осталась)
    const btnOld = document.getElementById('heatmap-toggle-btn');
    if (btnOld) {
        if (isHeatmapEnabled) {
            btnOld.innerHTML = '✅ Тепловая карта';
            btnOld.style.background = '#dcfce7';
            btnOld.style.color = '#166534';
        } else {
            btnOld.innerHTML = 'Тепловая карта';
            btnOld.style.background = '#e0f2fe';
            btnOld.style.color = '#0284c7';
        }
    }
    
    // ✅ ПЕРЕРИСОВЫВАЕМ КАРТУ
    renderMapLevel(currentLevel, currentParentId);
    
    console.log(`🌡️ Тепловая карта ${isHeatmapEnabled ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
}
let uprsThresholds = {}; 
let isPriceFilterEnabled = false;
let originalAllDealsFlat = []; 
let priceThresholds = {}; 

// Синхронная версия (для быстрых расчетов)
function getMedianSync(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
}
let priceChartInstance = null;
let chartDataCache = null;


function calculateCityPrices() {
    // ✅ ЗАЩИТА ОТ РЕКУРСИИ
if (!window._calcDepth) {
    window._calcDepth = 0;
}

if (window._calcDepth > 10) {
    console.warn('⚠️ Обнаружена рекурсия, прерываем выполнение');
    window._calcDepth = 0;
    return { groups: [], data: [], totalDeals: 0 };
}

window._calcDepth = window._calcDepth + 1;
console.log(`📊 Глубина рекурсии: ${window._calcDepth}`);
    
    console.log(`📊 Расчет УПРС и УПКС по группам (${currentChartGroupBy})...`);
    
    let districtPrefix = null;
    if (currentDistrictFilter) {
        districtPrefix = String(currentDistrictFilter).substring(0, 5);
    }
    
    const groupedData = {};
    
    // ✅ ПРОХОДИМ ПО СДЕЛКАМ
    allDealsFlat.forEach(deal => {
        // Применяем фильтры
        if (districtPrefix && !deal.cad_number.startsWith(districtPrefix)) return;
        if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return;
        if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return;
        if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return;
        if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return;
        if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return;
        if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return;
        if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return;
        if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return;
        if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return;
        if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return;
        
        // ✅ ПОЛУЧАЕМ ЗНАЧЕНИЕ ДЛЯ ГРУППИРОВКИ
         let groupValue;
        try {
            switch(currentChartGroupBy) {
                case 'city': groupValue = String(deal.city || 'unknown'); break;
                case 'obj_kind': groupValue = String(deal.obj_kind_text || 'unknown'); break;
                case 'deal_kind': groupValue = String(deal.deal_kind_text || 'unknown'); break;
                case 'purpose': groupValue = String(deal.purpose_text || 'unknown'); break;
                case 'quarter': groupValue = String(deal.quarter || 'unknown'); break;
                case 'wall_material': groupValue = String(deal.wall_material_name || 'unknown'); break;
                case 'vri': groupValue = String(deal.vri || 'unknown'); break;
                case 'year_build': groupValue = String(deal.year_build || 'unknown'); break;
                case 'number': groupValue = String(deal.number || 'unknown'); break;
                case 'ratio_category': groupValue = String(deal.ratio_category || 'unknown'); break;
                default: groupValue = String(deal.city || 'unknown');
            }
        } catch(e) {
            console.warn('Ошибка получения groupValue:', e);
            return;
        }
        
        // Проверяем, что groupValue — это строка
        if (typeof groupValue !== 'string') {
            console.warn('groupValue не строка:', groupValue);
            return;
        }
        
        // Пропускаем пустые значения
        if (!groupValue || groupValue === 'unknown' || groupValue === 'nan' || groupValue === 'undefined') {
            return;
        }
        
        // Инициализируем группу
        if (!groupedData[groupValue]) {
            groupedData[groupValue] = {
                uprs: [],
                upks: [],
                allDeals: []
            };
        }
        
        // Добавляем данные
        try {
            groupedData[groupValue].allDeals.push(deal);
            if (deal.uprs > 0) groupedData[groupValue].uprs.push(deal.uprs);
            if (deal.upks > 0) groupedData[groupValue].upks.push(deal.upks);
        } catch(e) {
            console.warn('Ошибка добавления данных в группу:', e);
        }
    });
    
    // ✅ ВЫЧИСЛЯЕМ МЕДИАНЫ ДЛЯ КАЖДОЙ ГРУППЫ
  const groupData = {};
const groupKeys = Object.keys(groupedData);

for (let i = 0; i < groupKeys.length; i++) {
    const group = groupKeys[i];
    const data = groupedData[group];
    const uprs = data.uprs || [];
    const upks = data.upks || [];
    const allDeals = data.allDeals || [];
    
    if (allDeals.length === 0) continue;
    
    // Вычисляем медианы
    let uprsMedian = 0;
    if (uprs.length > 0) {
        try {
            const sorted = uprs.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            uprsMedian = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        } catch(e) {
            console.warn('Ошибка вычисления uprsMedian для группы', group, e);
        }
    }
    
    let upksMedian = 0;
    if (upks.length > 0) {
        try {
            const sorted = upks.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            upksMedian = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        } catch(e) {
            console.warn('Ошибка вычисления upksMedian для группы', group, e);
        }
    }
    
    // ✅ ВЫЧИСЛЯЕМ MIN И MAX ЧЕРЕЗ ЦИКЛ (БЕЗ SPREAD ОПЕРАТОРА)
    let uprsMin = 0, uprsMax = 0;
    if (uprs.length > 0) {
        let min = Infinity, max = -Infinity;
        for (let j = 0; j < uprs.length; j++) {
            const v = uprs[j];
            if (v > 0 && isFinite(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        if (isFinite(min)) uprsMin = min;
        if (isFinite(max)) uprsMax = max;
    }
    
    let upksMin = 0, upksMax = 0;
    if (upks.length > 0) {
        let min = Infinity, max = -Infinity;
        for (let j = 0; j < upks.length; j++) {
            const v = upks[j];
            if (v > 0 && isFinite(v)) {
                if (v < min) min = v;
                if (v > max) max = v;
            }
        }
        if (isFinite(min)) upksMin = min;
        if (isFinite(max)) upksMax = max;
    }
    
    groupData[group] = {
        count: allDeals.length,
        uprsMedian: uprsMedian,
        upksMedian: upksMedian,
        uprsMin: uprsMin,
        uprsMax: uprsMax,
        upksMin: upksMin,
        upksMax: upksMax
    };
}

    
    // Сортируем группы по количеству сделок
const sortedGroups = Object.keys(groupData).sort((a, b) => {
    return groupData[b].count - groupData[a].count;
});

// ✅ ОГРАНИЧЕНИЕ ТОЛЬКО ДЛЯ ГРУППИРОВОК "КВАРТАЛ" И "ГОД ПОСТРОЙКИ"
let topGroups;
if (currentChartGroupBy === 'quarter') {
    // Для кварталов: берем последние 15 (самые новые), сортируем от старого к новому
    const quarterGroups = Object.keys(groupData).filter(g => g !== 'unknown' && g !== 'nan');
    
    // Сортируем по убыванию (новые сверху)
    const sortedQuarters = quarterGroups.sort((a, b) => {
        const parseQuarter = (q) => {
            const parts = q.split('/');
            if (parts.length === 2) {
                const year = parseInt(parts[0]);
                const quarter = parseInt(parts[1].replace('Q', ''));
                if (!isNaN(year) && !isNaN(quarter)) {
                    return year * 10 + quarter;
                }
            }
            return 0;
        };
        return parseQuarter(b) - parseQuarter(a);
    });
    
    // Берем первые 15 (самые новые)
    const top15 = sortedQuarters.slice(0, 15);
    // Сортируем от старого к новому (возрастание)
    topGroups = top15.sort((a, b) => {
        const parseQuarter = (q) => {
            const parts = q.split('/');
            if (parts.length === 2) {
                const year = parseInt(parts[0]);
                const quarter = parseInt(parts[1].replace('Q', ''));
                if (!isNaN(year) && !isNaN(quarter)) {
                    return year * 10 + quarter;
                }
            }
            return 0;
        };
        return parseQuarter(a) - parseQuarter(b);
    });
    
    console.log(`📅 Кварталы: выбрано ${topGroups.length} из ${Object.keys(groupData).length}`);
    
} else if (currentChartGroupBy === 'year_build') {
    // ✅ Для годов постройки: берем последние 15 лет (самые новые), сортируем от старых к новым
    const yearGroups = Object.keys(groupData).filter(g => g !== 'unknown' && g !== 'nan' && g !== '');
    
    // Сортируем по убыванию (новые сверху)
    const sortedYears = yearGroups.sort((a, b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (isNaN(aNum) && isNaN(bNum)) return 0;
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return bNum - aNum;  // ← УБЫВАНИЕ (новые сверху)
    });
    
    // Берем первые 15 (самые новые)
    const top15Years = sortedYears.slice(0, 15);
    
    // Сортируем от старых к новым (возрастание) для хронологического порядка на графике
    topGroups = top15Years.sort((a, b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (isNaN(aNum) && isNaN(bNum)) return 0;
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return aNum - bNum;  // ← ВОЗРАСТАНИЕ (от старых к новым)
    });
    
    console.log(`📅 Годы постройки: выбрано ${topGroups.length} из ${Object.keys(groupData).length} (от ${topGroups[0] || '?'} до ${topGroups[topGroups.length-1] || '?'})`);
    
} else {
    // Для всех остальных группировок — все группы
    topGroups = sortedGroups;
}

const result = {
    groups: topGroups,
    data: topGroups.map(group => ({
        group: group,
        count: groupData[group].count,
        uprsMedian: groupData[group].uprsMedian,
        upksMedian: groupData[group].upksMedian,
        uprsMin: groupData[group].uprsMin,
        uprsMax: groupData[group].uprsMax,
        upksMin: groupData[group].upksMin,
        upksMax: groupData[group].upksMax
    })),
    allData: groupData,
    totalDeals: topGroups.reduce((sum, group) => sum + groupData[group].count, 0),
    groupBy: currentChartGroupBy
};
    
    console.log(`✅ Данные по группам (${currentChartGroupBy}): ${result.groups.length} групп`);
    if (result.data.length > 0) {
        console.log('📊 Пример:', result.data[0]);
    }
    
    // ✅ СБРАСЫВАЕМ ГЛУБИНУ РЕКУРСИИ
    window._calcDepth = 0;
    
    return result;
}
function renderPriceChart() {
    const container = document.getElementById('price-chart-container');
    if (!container) {
        console.warn('⚠️ Контейнер для графика не найден');
        return;
    }
    
    // Убеждаемся, что контейнер имеет фиксированную высоту
    container.style.minHeight = '450px';
    container.style.height = 'auto';
    container.style.position = 'relative';
    container.style.overflow = 'visible';
    
    // Показываем загрузку
    container.innerHTML = `
        <div style="display:flex;justify-content:center;align-items:center;height:250px;color:#94a3b8;">
            <span>⏳ Загрузка данных...</span>
        </div>
    `;
    
    const chartData = calculateCityPrices();
    if (!chartData || chartData.data.length === 0) {
        container.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:250px;color:#94a3b8;flex-direction:column;gap:8px;">
                <span style="font-size:32px;">📊</span>
                <span>Нет данных для отображения</span>
                <span style="font-size:12px;">Попробуйте изменить фильтры</span>
            </div>
        `;
        return;
    }
    
chartDataCache = chartData;
    
if (typeof window._uprsVisible === 'undefined') {
    window._uprsVisible = true; // по умолчанию УПРС виден
}

// ✅ СОРТИРОВКА: для кварталов и годов — сохраняем хронологический порядок
let sortedData;
if (currentChartGroupBy === 'quarter' || currentChartGroupBy === 'year_build') {
    sortedData = chartData.data;
    console.log(`📅 Хронологический порядок для ${currentChartGroupBy}:`, sortedData.map(d => d.group));
} else if (currentChartGroupBy === 'number' || currentChartGroupBy === 'ratio_category') {
    if (window._uprsVisible) {
        sortedData = [...chartData.data].sort((a, b) => a.uprsMedian - b.uprsMedian);
    } else {
        sortedData = [...chartData.data].sort((a, b) => a.upksMedian - b.upksMedian);
    }
} else if (window._uprsVisible) {
    sortedData = [...chartData.data].sort((a, b) => a.uprsMedian - b.uprsMedian);
} else {
    sortedData = [...chartData.data].sort((a, b) => a.upksMedian - b.upksMedian);
}


const groups = sortedData.map(d => d.group);
const uprsData = sortedData.map(d => d.uprsMedian);
const upksData = sortedData.map(d => d.upksMedian);
    
    // Находим максимум для шкалы
    const allValues = [...uprsData, ...upksData].filter(v => v > 0);
    const maxVal = allValues.length > 0 ? Math.max(...allValues) * 1.15 : 100;
    
    // ✅ ВАЖНО: создаем canvas с ЧЕТКОЙ высотой и помещаем в wrapper
   container.innerHTML = `
    <div id="chart-wrapper" style="width:100%; height:450px; position:relative;">
        <canvas id="price-chart-canvas" style="width:100%; height:100%;"></canvas>
    </div>
        <div id="price-chart-stats" style="display:flex; justify-content:space-around; margin-top:12px; padding:8px 12px; background:#f8fafc; border-radius:8px; font-size:11px; color:#475569; flex-wrap:wrap; gap:6px;"></div>
    `;
    
    const canvas = document.getElementById('price-chart-canvas');
    if (!canvas) {
        console.error('❌ Canvas не найден');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    if (priceChartInstance) {
        priceChartInstance.destroy();
        priceChartInstance = null;
    }
    
    // ✅ СОЗДАЕМ ГРУППИРОВАННУЮ СТОЛБЧАТУЮ ДИАГРАММУ
priceChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: groups,  // ✅ ИСПРАВЛЕНО: было cities
        datasets: [
            {
                label: 'УПРС (медиана)',
                data: uprsData,
                backgroundColor: 'rgba(14, 165, 233, 0.8)',
                borderColor: '#0ea5e9',
                borderWidth: 2,
                borderRadius: 4,
                barPercentage: 0.35,
                categoryPercentage: 0.7,
            },
            {
                label: 'УПКС (медиана)',
                data: upksData,
                backgroundColor: 'rgba(251, 146, 60, 0.8)',
                borderColor: '#f97316',
                borderWidth: 2,
                borderRadius: 4,
                barPercentage: 0.35,
                categoryPercentage: 0.7,
            }
        ]
    },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
plugins: {
    legend: {
        display: true,
        position: 'top',
        labels: {
            usePointStyle: true,
            padding: 20,
            font: {
                size: 11,
                family: 'Inter, sans-serif',
                weight: '500'
            },
            color: '#475569',
            boxWidth: 12,
        },
onClick: function(e, legendItem, legend) {
    const datasetIndex = legendItem.datasetIndex;
    const ci = legend.chart;
    const meta = ci.getDatasetMeta(datasetIndex);
    
    // Переключаем видимость набора данных
    meta.hidden = !meta.hidden;
    
    // ✅ ОБНОВЛЯЕМ СОСТОЯНИЕ ВИДИМОСТИ УПРС
    if (datasetIndex === 0) {
        window._uprsVisible = !meta.hidden;
    }
    
    // ✅ ПЕРЕСОРТИРОВКА ПОСЛЕ ИЗМЕНЕНИЯ ВИДИМОСТИ
    // Сохраняем текущие данные
    const currentData = chartDataCache;
    if (currentData) {
        let newSortedData;
        if (window._uprsVisible) {
            newSortedData = [...currentData.data].sort((a, b) => a.uprsMedian - b.uprsMedian);
        } else {
            newSortedData = [...currentData.data].sort((a, b) => a.upksMedian - b.upksMedian);
        }
        
        // Обновляем данные графика
        ci.data.labels = newSortedData.map(d => d.group); 
        ci.data.datasets[0].data = newSortedData.map(d => d.uprsMedian);
        ci.data.datasets[1].data = newSortedData.map(d => d.upksMedian);
    }
    
    ci.update();
}
    },
    tooltip: {
        enabled: false  
    }
},
            scales: {
                y: {
                    beginAtZero: true,
                    max: maxVal,
                    grid: {
                        color: 'rgba(0,0,0,0.05)',
                        drawBorder: false,
                    },
                    ticks: {
                        font: {
                            size: 10,
                            family: 'Inter, sans-serif'
                        },
                        color: '#94a3b8',
                        callback: function(value) {
                            if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                            return value.toFixed(0);
                        }
                    },
                    title: {
                        display: true,
                        text: '₽/м²',
                        color: '#94a3b8',
                        font: {
                            size: 10,
                            family: 'Inter, sans-serif',
                            weight: '500'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 10,
                            family: 'Inter, sans-serif'
                        },
                        color: '#94a3b8',
                        maxRotation: 90, 
                        minRotation: 60,
                    }
                }
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart',
            },
            hover: {
                mode: 'index',
                intersect: false,
                animationDuration: 200,
            },
        },
plugins: [{
    afterDraw: function(chart) {
        const ctx = chart.ctx;
        chart.data.datasets.forEach(function(dataset, datasetIndex) {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta.data) return;
            
            // ✅ ПРОВЕРЯЕМ, ВИДЕН ЛИ НАБОР ДАННЫХ
            if (meta.hidden) return;
            
            meta.data.forEach(function(bar, index) {
                const dataValue = dataset.data[index];
                if (dataValue > 0) {
                    ctx.save();
                    ctx.font = '500 9px Inter, sans-serif';
                    ctx.fillStyle = '#475569';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    
                    const yPos = bar.y - 4;
                    ctx.fillText(dataValue.toFixed(0), bar.x, yPos);
                    ctx.restore();
                }
            });
        });
    }
}]
    });
    
const statsDiv = document.getElementById('price-chart-stats');
if (statsDiv) {
    // ✅ СОБИРАЕМ ВСЕ СДЕЛКИ ИЗ ВСЕХ ГРУПП
    let allChartDeals = [];
    Object.keys(chartData.allData).forEach(group => {
        const groupData = chartData.allData[group];
        if (groupData && groupData.allDeals) {
            allChartDeals = allChartDeals.concat(groupData.allDeals);
        }
    });
    
    // ✅ Если нет данных из groupedData, используем allDealsFlat с фильтрами
    if (allChartDeals.length === 0) {
        allChartDeals = allDealsFlat.filter(deal => {
            // Применяем все активные фильтры
            if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return false;
            if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return false;
            if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return false;
            if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
            if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;  
             if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
            return true;
        });
    }
    
    // ✅ ВЫЧИСЛЯЕМ МЕДИАНУ ПО ВСЕМ СДЕЛКАМ (как на карточках)
    const allUprsValues = allChartDeals.map(d => d.uprs_rub || d.uprs).filter(v => v > 0);
    const allUpksValues = allChartDeals.map(d => d.upks).filter(v => v > 0);
    
    const medianOfUprs = allUprsValues.length > 0 ? getMedianSync(allUprsValues) : 0;
    const medianOfUpks = allUpksValues.length > 0 ? getMedianSync(allUpksValues) : 0;
    
    statsDiv.innerHTML = `
        <span>Групп: <strong>${chartData.groups.length}</strong></span>
        <span>Сделок: <strong>${allChartDeals.length.toLocaleString()}</strong></span>
        <span>Медиана УПРС: <strong>${medianOfUprs > 0 ? medianOfUprs.toFixed(0) : '—'} ₽/м²</strong></span>
        <span>Медиана УПКС: <strong>${medianOfUpks > 0 ? medianOfUpks.toFixed(0) : '—'} ₽/м²</strong></span>
    `;
}
}
function getGroupValue(deal, groupBy) {
    // ✅ ПРОВЕРКА НА РЕКУРСИЮ
    if (!deal || typeof deal !== 'object') {
        return 'unknown';
    }
    
    // ✅ ЛОГИРУЕМ ТОЛЬКО ДЛЯ obj_kind (ДЛЯ ОТЛАДКИ)
    if (groupBy === 'obj_kind') {
        console.log('🔍 obj_kind:', deal.obj_kind_text);
    }
    
    switch(groupBy) {
        case 'city': return deal.city || 'unknown';
        case 'obj_kind': return deal.obj_kind_text || 'unknown';
        case 'deal_kind': return deal.deal_kind_text || 'unknown';
        case 'purpose': return deal.purpose_text || 'unknown';
        case 'quarter': return deal.quarter || 'unknown';
        case 'wall_material': return deal.wall_material_name || 'unknown';
        case 'vri': return deal.vri || 'unknown';
        case 'year_build': return deal.year_build || 'unknown';
        case 'number': return deal.number || 'unknown';
        case 'ratio_category': return deal.ratio_category || 'unknown';
        default: return deal.city || 'unknown';
    }
}

// Функция для получения значения поля для группировки
function setChartGroupBy(group) {
    if (currentChartGroupBy === group) return;
    
    // ✅ ПРИНУДИТЕЛЬНЫЙ СБРОС ПЕРЕД ПЕРЕКЛЮЧЕНИЕМ
    window._calcDepth = 0;
    
    currentChartGroupBy = group;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.chart-group-btn').forEach(btn => {
        const isActive = btn.dataset.group === group;
        if (isActive) {
            btn.style.background = '#0ea5e9';
            btn.style.color = 'white';
            btn.classList.add('active');
        } else {
            btn.style.background = '#e2e8f0';
            btn.style.color = '#475569';
            btn.classList.remove('active');
        }
    });
    
    // Обновляем график
    renderPriceChart();
}
function refreshPriceChart() {
    renderPriceChart();
}

// ===== ДЛЯ СОВМЕСТИМОСТИ С ОСТАЛЬНЫМ КОДОМ =====
function formatPriceShort(num) {
    if (!num || num === 0) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M ₽';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K ₽';
    return num.toFixed(0) + ' ₽';
}
const DEALS_CSV_URL = 'https://raw.githubusercontent.com/mark98molchanov-a11y/a13y.gko-registry-system/main/data/deals_clean.csv';
async function loadDealsCSV() {
    try {
        console.log('📥 Загрузка CSV с данными о сделках...');
        
        // ✅ 1. Загружаем основные данные из репозитория (ВСЕ поля)
        const response = await fetch(DEALS_CSV_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let csvText = await response.text();
        
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
        const numberIndex = headers.indexOf('number'); 
        const ratioCategoryIndex = headers.indexOf('ratio_category'); 
        const cadCostIndex = headers.indexOf('cad_cost'); 
        const floorIndex = headers.indexOf('floor');
        const locationIndex = headers.indexOf('location');
        const streetIndex = headers.indexOf('street');
        const rowIdIndex = headers.indexOf('#');  // row_id
        // ✅ НОВЫЙ СТОЛБЕЦ - cadastrovy_nomer
        const cadastrovyNomerIndex = headers.indexOf('cadastrovy_nomer');
        
        if (cadIndex === -1 || kindIndex === -1) {
            console.warn('⚠️ Не найдены колонки cad_number или deal_kind_text');
            return;
        }
        
        // ✅ ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ
        const dealsByCad = {};
        const typesCount = {};
        const citiesCount = {}; 
        const objectTypesCount = {};
        const wallMaterialTypesLocal = {};
        const quarterTypesLocal = {};
        const yearBuildTypesLocal = {};
        const purposeCountLocal = {};   
        const vriCountLocal = {};
        const numberCountLocal = {};
        const ratioCategoryCountLocal = {};
        
        // ✅ ОЧИЩАЕМ ГЛОБАЛЬНЫЕ МАССИВЫ
        allDealsFlat = [];
        originalAllDealsFlat = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length < Math.max(cadIndex, kindIndex) + 1) continue;
            
            // ✅ Берем row_id ПО ИНДЕКСУ (НЕ ИЗ ПЕРВОЙ КОЛОНКИ!)
            const rowId = rowIdIndex !== -1 && values[rowIdIndex] ? values[rowIdIndex].trim() : '';
            
            const cadNum = values[cadIndex] || '';
            const kind = values[kindIndex] || 'nan';
            const city = values[cityIndex] || 'nan'; 
            const objKind = values[objKindIndex] || 'nan';
            const wallMaterial = values[wallMaterialIndex] || 'nan';
            const quarter = values[quarterIndex] || 'nan'; 
            const yearBuild = values[yearBuildIndex] || 'nan';  
            const purposeText = values[purposeIndex] || 'nan';
            const vri = values[vriIndex] || 'nan'; 
            const numberValue = values[numberIndex] || cadNum || 'nan';
            const ratioCategory = values[ratioCategoryIndex] || 'nan'; 
            const floor = values[floorIndex] || 'nan';
            const location = values[locationIndex] || 'nan';
            const street = values[streetIndex] || 'nan';
            const area = parseFloat(values[areaIndex]) || 0;
            
            if (!cadNum) continue;
            
            // ✅ БЕРЕМ cad_nspd ИЗ СТОЛБЦА cadastrovy_nomer (ЕСЛИ ЕСТЬ)
            let cadNspd = null;
            if (cadastrovyNomerIndex !== -1 && values[cadastrovyNomerIndex]) {
                const val = values[cadastrovyNomerIndex].trim();
                if (val && val !== 'не определено') {
                    cadNspd = val;
                }
            }
            
            const price = parseFloat(values[priceIndex]) || 0;
            const uprs = parseFloat(values[uprsIndex]) || 0;
            const upks = parseFloat(values[upksIndex]) || 0;  
            const cadCost = parseFloat(values[cadCostIndex]) || 0;
              
            // ✅ ВСЕ остальные данные из основного CSV
            allDealsFlat.push({
                row_id: rowId,
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
                location: location,
                street: street,
                cad_nspd: cadNspd,  // ← ИЗ СТОЛБЦА cadastrovy_nomer!
                number: numberValue, 
                ratio_category: ratioCategory 
            });
            
            if (!dealsByCad[cadNum]) dealsByCad[cadNum] = [];
            dealsByCad[cadNum].push({
                row_id: rowId,
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
                location: location,
                street: street,
                cad_nspd: cadNspd, 
                number: numberValue,
                ratio_category: ratioCategory
            });
            
            typesCount[kind] = (typesCount[kind] || 0) + 1;
            citiesCount[city] = (citiesCount[city] || 0) + 1;
            objectTypesCount[objKind] = (objectTypesCount[objKind] || 0) + 1;
            wallMaterialTypesLocal[wallMaterial] = (wallMaterialTypesLocal[wallMaterial] || 0) + 1;
            quarterTypesLocal[quarter] = (quarterTypesLocal[quarter] || 0) + 1;
            yearBuildTypesLocal[yearBuild] = (yearBuildTypesLocal[yearBuild] || 0) + 1; 
            purposeCountLocal[purposeText] = (purposeCountLocal[purposeText] || 0) + 1;
            vriCountLocal[vri] = (vriCountLocal[vri] || 0) + 1;
            numberCountLocal[numberValue] = (numberCountLocal[numberValue] || 0) + 1;
            ratioCategoryCountLocal[ratioCategory] = (ratioCategoryCountLocal[ratioCategory] || 0) + 1; 
        }
        
        // ✅ ПЕРЕЗАПИСЫВАЕМ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
        dealsData = dealsByCad;
        dealTypes = typesCount;
        cityTypes = citiesCount; 
        objectTypes = objectTypesCount;
        wallMaterialTypes = wallMaterialTypesLocal;
        quarterTypes = quarterTypesLocal;
        yearBuildTypes = yearBuildTypesLocal;
        purposeCount = purposeCountLocal;
        vriCount = vriCountLocal;
        numberCount = numberCountLocal;
        ratioCategoryCount = ratioCategoryCountLocal;
        
        console.log('✅ CSV загружен:', Object.keys(dealsData).length, 'кварталов');
        console.log('📊 Сделок с cad_nspd:', allDealsFlat.filter(d => d.cad_nspd).length);
        
        window.allDealsFlat = allDealsFlat;
        originalAllDealsFlat = [...allDealsFlat];
        window.originalAllDealsFlat = originalAllDealsFlat;
        originalAllDealsFlatForCad = [...allDealsFlat];
        
        priceThresholds = calculatePriceThresholds();
        window.priceThresholds = priceThresholds;
        
        renderDealTypeFilters();
        renderCityFilters();
        renderObjectTypeFilters();
        renderWallMaterialFilters();
        renderQuarterFilters();
        renderYearBuildFilters();
        renderPurposeFilters();
        renderVriFilters();
        renderNumberFilters();
        renderRatioCategoryFilters(); 
        
        if (typeof updateTableFull === 'function') {
            updateTableFull();
        } else {
            renderDealsTable();
        }
        
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
    console.log('Расчет пороговых цен по: квартал + тип сделки + тип объекта (5% низких и 5% высоких)...');
    
    const thresholds = {};
    
    // ✅ ГРУППИРУЕМ ПО: квартал + тип сделки + тип объекта
    const dealsByGroup = {};
    allDealsFlat.forEach(deal => {
        const quarter = deal.cad_number || 'unknown';
        const kind = deal.deal_kind_text || 'unknown';
        const objKind = deal.obj_kind_text || 'unknown';
        const key = `${quarter}|${kind}|${objKind}`;  // ← ТРОЙНОЙ КЛЮЧ
        
        if (!dealsByGroup[key]) {
            dealsByGroup[key] = {
                quarter: quarter,
                kind: kind,
                objKind: objKind,
                uprsPrices: [],
                upksPrices: []
            };
        }
        if (deal.uprs_rub > 0) {
            dealsByGroup[key].uprsPrices.push(deal.uprs_rub);
        }
        if (deal.upks > 0) {
            dealsByGroup[key].upksPrices.push(deal.upks);
        }
    });
    
    // ✅ ДЛЯ КАЖДОЙ ГРУППЫ ВЫЧИСЛЯЕМ ПОРОГИ (5%)
    Object.keys(dealsByGroup).forEach(key => {
        const group = dealsByGroup[key];
        
        const uprsPrices = group.uprsPrices.sort((a, b) => a - b);
        const upksPrices = group.upksPrices.sort((a, b) => a - b);
        
        const lowerPercent = 0.10;
const upperPercent = 0.90;
        
        // УПРС
        let uprsMin = 0, uprsMax = Infinity;
        if (uprsPrices.length > 0) {
            const lowerIndex = Math.floor(uprsPrices.length * lowerPercent);
            const upperIndex = Math.ceil(uprsPrices.length * upperPercent) - 1;
            uprsMin = uprsPrices[lowerIndex] || 0;
            uprsMax = uprsPrices[upperIndex] || uprsPrices[uprsPrices.length - 1];
        }
        
        // УПКС
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
            quarter: group.quarter,
            kind: group.kind,
            objKind: group.objKind,
            count: uprsPrices.length
        };
        
        console.log(`   ${group.quarter} | ${group.kind} | ${group.objKind}: ${uprsPrices.length} сделок, УПРС = ${uprsMin.toFixed(2)} - ${uprsMax.toFixed(2)} ₽/м², УПКС = ${upksMin.toFixed(2)} - ${upksMax.toFixed(2)} ₽/м²`);
    });
    
    console.log(`✅ Рассчитано ${Object.keys(thresholds).length} групп (квартал + тип сделки + тип объекта), 5%`);
    return thresholds;
}

function filterDealsByPriceThreshold(thresholds) {
    if (!thresholds || Object.keys(thresholds).length === 0) {
        console.warn('⚠️ Пороговые цены не рассчитаны');
        return allDealsFlat;
    }
    
    return allDealsFlat.filter(deal => {
        // ✅ ТРОЙНАЯ ГРУППИРОВКА: квартал + тип сделки + тип объекта
        const quarter = deal.cad_number || 'unknown';
        const kind = deal.deal_kind_text || 'unknown';
        const objKind = deal.obj_kind_text || 'unknown';
        const key = `${quarter}|${kind}|${objKind}`;
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
    // Очищаем старые данные ТОЛЬКО ДЛЯ ПЕРЕСТРОЙКИ
    // Но НЕ ОЧИЩАЕМ dealsData полностью, а пересоздаём
    const newDealsData = {};
    const newDealTypes = {};
    const newCityTypes = {};
    const newObjectTypes = {};
    const newWallMaterialTypes = {};
    const newQuarterTypes = {};
    const newYearBuildTypes = {};
    const newPurposeCount = {};
    const newVriCount = {};
    const newNumberCount = {};   
    const newRatioCategoryCount = {}; 
    
    // Заполняем новыми данными
    filteredDeals.forEach(deal => {
        const cadNum = deal.cad_number;
        if (!cadNum) return;
        
        if (!newDealsData[cadNum]) newDealsData[cadNum] = [];
        newDealsData[cadNum].push({
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
            location: deal.location,
            street: deal.street,
            number: deal.number,  
            ratio_category: deal.ratio_category 
        });
        
        // Обновляем счетчики для фильтров
        newDealTypes[deal.deal_kind_text] = (newDealTypes[deal.deal_kind_text] || 0) + 1;
        newCityTypes[deal.city] = (newCityTypes[deal.city] || 0) + 1;
        newObjectTypes[deal.obj_kind_text] = (newObjectTypes[deal.obj_kind_text] || 0) + 1;
        newWallMaterialTypes[deal.wall_material_name] = (newWallMaterialTypes[deal.wall_material_name] || 0) + 1;
        newQuarterTypes[deal.quarter] = (newQuarterTypes[deal.quarter] || 0) + 1;
        newYearBuildTypes[deal.year_build] = (newYearBuildTypes[deal.year_build] || 0) + 1;
        newPurposeCount[deal.purpose_text] = (newPurposeCount[deal.purpose_text] || 0) + 1;
        newVriCount[deal.vri] = (newVriCount[deal.vri] || 0) + 1;
        newNumberCount[deal.number] = (newNumberCount[deal.number] || 0) + 1; 
        newRatioCategoryCount[deal.ratio_category] = (newRatioCategoryCount[deal.ratio_category] || 0) + 1;
    });
    
    // ✅ ПЕРЕЗАПИСЫВАЕМ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (а не очищаем)
    dealsData = newDealsData;
    dealTypes = newDealTypes;
    cityTypes = newCityTypes;
    objectTypes = newObjectTypes;
    wallMaterialTypes = newWallMaterialTypes;
    quarterTypes = newQuarterTypes;
    yearBuildTypes = newYearBuildTypes;
    purposeCount = newPurposeCount;
    vriCount = newVriCount;
    numberCount = newNumberCount; 
    ratioCategoryCount = newRatioCategoryCount; 
    
    console.log('✅ Данные перестроены после фильтрации по ценам');
    console.log(`📊 Сделок: ${filteredDeals.length}, кварталов: ${Object.keys(newDealsData).length}`);
}
function togglePriceFilter() {
    isPriceFilterEnabled = !isPriceFilterEnabled;
    
    const btn = document.getElementById('priceFilterToggle');
    if (btn) {
        if (isPriceFilterEnabled) {
            btn.innerHTML = '✅ Ценовой фильтр';
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
    
    // ✅ ВАЖНО: если originalAllDealsFlat пуст — заполняем его
    if (originalAllDealsFlat.length === 0 && allDealsFlat.length > 0) {
        console.log('📦 Сохраняем исходные данные в originalAllDealsFlat');
        originalAllDealsFlat = [...allDealsFlat];
        window.originalAllDealsFlat = originalAllDealsFlat;
    }
    
    if (!isPriceFilterEnabled) {
        // ✅ ВОССТАНАВЛИВАЕМ ИЗ originalAllDealsFlat
        if (originalAllDealsFlat.length > 0) {
            allDealsFlat = [...originalAllDealsFlat];
        } else {
            // Если originalAllDealsFlat пуст — используем window.allDealsFlat
            allDealsFlat = [...window.allDealsFlat];
            originalAllDealsFlat = [...allDealsFlat];
        }
        rebuildDealsData(allDealsFlat);
    } else {
        // ✅ РАССЧИТЫВАЕМ ПОРОГИ ЕСЛИ НЕТ
        if (Object.keys(priceThresholds).length === 0) {
            priceThresholds = calculatePriceThresholds();
            window.priceThresholds = priceThresholds;
        }
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
    renderPurposeFilters();   
    renderVriFilters();  
    renderNumberFilters();
    renderRatioCategoryFilters(); 
    
    if (mapData) {
        renderMapLevel(currentLevel, currentParentId);
    }
    
    setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            console.log('📊 Обновление графика после переключения ценового фильтра');
            renderPriceChart();
        }
    }, 400);
}
function toggleCadCostFilter() {
    isCadCostFilterEnabled = !isCadCostFilterEnabled;
    
    const btn = document.getElementById('cadCostFilterToggle');
    if (btn) {
        // ✅ ОЧИЩАЕМ ОТ ВСЕХ ЭМОДЗИ
        const cleanText = btn.textContent.replace(/[✅❌✔️✓]/g, '').trim() || 'Только с КС';
        
        if (isCadCostFilterEnabled) {
            btn.textContent = '✅ ' + cleanText;  // ← textContent, галочка СЛЕВА
            btn.style.background = '#dcfce7';
            btn.style.color = '#166534';
            btn.style.borderColor = '#86efac';
        } else {
            btn.textContent = cleanText;          // ← textContent, без галочки
            btn.style.background = '#e0f2fe';
            btn.style.color = '#0284c7';
            btn.style.borderColor = '#bae6fd';
        }
    }
    
    console.log(`🔄 Фильтр по кадастровой стоимости ${isCadCostFilterEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);
    
    if (originalAllDealsFlatForCad.length === 0 && allDealsFlat.length > 0) {
        console.log('📦 Сохраняем исходные данные для фильтра КС');
        originalAllDealsFlatForCad = [...allDealsFlat];
    }
    
    if (!isCadCostFilterEnabled) {
        if (originalAllDealsFlatForCad.length > 0) {
            allDealsFlat = [...originalAllDealsFlatForCad];
        } else {
            allDealsFlat = [...window.allDealsFlat];
            originalAllDealsFlatForCad = [...allDealsFlat];
        }
    } else {
        allDealsFlat = allDealsFlat.filter(deal => {
            const hasCadCost = deal.cad_cost > 0;
            return hasCadCost;
        });
    }
    
    rebuildDealsData(allDealsFlat);
    
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderPurposeFilters();
    renderVriFilters();
    renderDealsTable();
    renderNumberFilters();
    renderRatioCategoryFilters(); 
    
    if (mapData) {
        renderMapLevel(currentLevel, currentParentId);
    }
    
    setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            console.log('📊 Обновление графика после фильтра КС');
            renderPriceChart();
        }
    }, 400);
    
    console.log(`✅ Фильтр КС ${isCadCostFilterEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}, сделок: ${allDealsFlat.length}`);
}
function renderDealTypeFilters() {
    const container = document.getElementById('deal-type-filters');
    if (!container) return;
    
    // ✅ СОРТИРОВКА: nan всегда внизу
    const types = Object.keys(dealTypes)
        .map(k => k.trim())
        .sort((a, b) => {
            // nan всегда внизу
            if (a === 'nan' || a === 'NaN' || a === '') return 1;
            if (b === 'nan' || b === 'NaN' || b === '') return -1;
            return dealTypes[b] - dealTypes[a];
        });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(kind => currentDealTypeFilter.includes(kind));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Типы_сделок</span>
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
        const isNan = kind === 'nan' || kind === 'NaN' || kind === '';
        
        html += `
            <tr onclick="applyDealTypeFilter('${kind.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
    
    const cities = Object.keys(cityTypes)
        .sort((a, b) => {
            // nan всегда внизу
            if (a === 'nan' || a === 'NaN' || a === '') return 1;
            if (b === 'nan' || b === 'NaN' || b === '') return -1;
            return cityTypes[b] - cityTypes[a];
        });
    
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
        const isNan = city === 'nan' || city === 'NaN' || city === '';
        
        html += `
            <tr onclick="applyCityFilter('${city.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
    
    const types = Object.keys(objectTypes)
        .sort((a, b) => {
            if (a === 'nan' || a === 'NaN' || a === '') return 1;
            if (b === 'nan' || b === 'NaN' || b === '') return -1;
            return objectTypes[b] - objectTypes[a];
        });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentObjectTypeFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Типы_объектов</span>
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
        const isNan = type === 'nan' || type === 'NaN' || type === '';
        
        html += `
            <tr onclick="applyObjectTypeFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
    
    const types = Object.keys(wallMaterialTypes)
        .sort((a, b) => {
            if (a === 'nan' || a === 'NaN' || a === '') return 1;
            if (b === 'nan' || b === 'NaN' || b === '') return -1;
            return wallMaterialTypes[b] - wallMaterialTypes[a];
        });
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = types.every(type => currentWallMaterialFilter.includes(type));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Материал_стен</span>
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
        const isNan = type === 'nan' || type === 'NaN' || type === '';
        
        html += `
            <tr onclick="applyWallMaterialFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
        // nan всегда внизу
        if (a === 'nan' || a === 'NaN' || a === '') return 1;
        if (b === 'nan' || b === 'NaN' || b === '') return -1;
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
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Год_постройки</span>
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
        const isNan = type === 'nan' || type === 'NaN' || type === '';
        
        html += `
            <tr onclick="applyYearBuildFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
        if (quarter === 'nan' || quarter === 'NaN' || quarter === '') return { year: 0, q: 0, sortKey: 0 };
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
        // nan всегда внизу
        if (a === 'nan' || a === 'NaN' || a === '') return 1;
        if (b === 'nan' || b === 'NaN' || b === '') return -1;
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
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Квартал_год_сделки</span>
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
        const isNan = type === 'nan' || type === 'NaN' || type === '';
        
        html += `
            <tr onclick="applyQuarterFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
    
    const types = Object.keys(vriCount).sort((a, b) => {
        // nan всегда внизу
        if (a === 'nan' || a === 'NaN' || a === '') return 1;
        if (b === 'nan' || b === 'NaN' || b === '') return -1;
        return vriCount[b] - vriCount[a];
    });
    
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
        const isNan = type === 'nan' || type === 'NaN' || type === '';
        
        html += `
            <tr onclick="applyVriFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
function renderNumberFilters() {
    const container = document.getElementById('number-filters');
    if (!container) return;
    
    const numbers = Object.keys(numberCount)
        .sort((a, b) => {
            if (a === 'nan' || a === 'NaN' || a === '') return 1;
            if (b === 'nan' || b === 'NaN' || b === '') return -1;
            return numberCount[b] - numberCount[a];
        });
    
    if (numbers.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    const allSelected = numbers.every(num => currentNumberFilter.includes(num));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Кол-во_объектов</span>
            <button onclick="toggleAllNumbers(${JSON.stringify(numbers).replace(/"/g, '&quot;')})"
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
    
    numbers.forEach(num => {
        const count = numberCount[num];
        const isActive = currentNumberFilter.includes(num);
        const shortName = num.length > 15 ? num.substring(0, 14) + '…' : num;
        const isNan = num === 'nan' || num === 'NaN' || num === '';
        
        html += `
            <tr onclick="applyNumberFilter('${num.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${num}">${shortName}</td>
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
function renderRatioCategoryFilters() {
    const container = document.getElementById('ratio-category-filters');
    if (!container) return;
    
    const categories = Object.keys(ratioCategoryCount)
        .sort((a, b) => {
            if (a === 'nan' || a === 'NaN' || a === '') return 1;
            if (b === 'nan' || b === 'NaN' || b === '') return -1;
            return ratioCategoryCount[b] - ratioCategoryCount[a];
        });
    
    if (categories.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 4px 0;">Нет данных</div>';
        return;
    }

    const allSelected = categories.every(cat => currentRatioCategoryFilter.includes(cat));
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
            <div style="display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 8px; color: #94a3b8; font-weight: 500; text-transform: uppercase;">Ratio</span>
                <span style="color: #ef4444; font-size: 11px; line-height: 1;">*</span>
                
                <span id="ratio-question-icon" style="
                    color: #94a3b8;
                    font-size: 10px;
                    border: 1px solid #cbd5e1;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    cursor: pointer;
                    font-family: 'Inter', sans-serif;
                    background: #f8fafc;
                    user-select: none;
                    transition: all 0.2s;
                ">?</span>
            </div>
            <button onclick="toggleAllRatioCategories(${JSON.stringify(categories).replace(/"/g, '&quot;')})"
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
    
    categories.forEach(cat => {
        const count = ratioCategoryCount[cat];
        const isActive = currentRatioCategoryFilter.includes(cat);
        const shortName = cat.length > 15 ? cat.substring(0, 14) + '…' : cat;
        const isNan = cat === 'nan' || cat === 'NaN' || cat === '';
        
        html += `
            <tr onclick="applyRatioCategoryFilter('${cat.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
                "
                onmouseover="this.style.background='${isActive ? '#e0f2fe' : '#f1f5f9'}'"
                onmouseout="this.style.background='${isActive ? '#e0f2fe' : 'transparent'}'">
                <td style="padding: 2px 4px; border-bottom: 1px solid #f1f5f9; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px;" title="${cat}">${shortName}</td>
                <td style="padding: 2px 4px; text-align: right; border-bottom: 1px solid #f1f5f9; font-weight: 500; font-size: 9px;">${count.toLocaleString('ru-RU')}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
    
    // ✅ СОЗДАЕМ ТУЛТИП ПОСЛЕ ОТРИСОВКИ
    setTimeout(() => {
        // Удаляем старый тултип если есть
        const oldTooltip = document.getElementById('ratioTooltip');
        if (oldTooltip) oldTooltip.remove();
        
        // Находим иконку
        const icon = document.getElementById('ratio-question-icon');
        if (!icon) return;
        
        // Создаем тултип с НОВЫМ НЕЙТРАЛЬНЫМ ДИЗАЙНОМ
        const tooltip = document.createElement('div');
        tooltip.id = 'ratioTooltip';
        tooltip.style.cssText = `
            display: none;
            position: fixed;
            z-index: 999999;
            pointer-events: none;
            background: #ffffff;
            color: #1e293b;
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 11px;
            max-width: 220px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            font-family: 'Inter', sans-serif;
            border: 1px solid #e2e8f0;
        `;
        tooltip.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px; color: #0ea5e9;">ratio = deal_price_rub / cad_cost</div>
            <div style="font-size: 10px; opacity: 0.8; line-height: 1.4; color: #475569;">Отношение цены сделки к кадастровой стоимости</div>
            <div style="position: absolute; top: 50%; left: -6px; transform: translateY(-50%) rotate(45deg); width: 10px; height: 10px; background: #ffffff; border-left: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;"></div>
        `;
        document.body.appendChild(tooltip);
        
        // Добавляем события
        icon.addEventListener('mouseenter', function(e) {
            const rect = icon.getBoundingClientRect();
            const tooltipWidth = 220;
            let left = rect.right + 10;
            
            // Если тултип выходит за правый край экрана - показываем слева
            if (left + tooltipWidth > window.innerWidth - 10) {
                left = rect.left - tooltipWidth - 10;
            }
            
            tooltip.style.display = 'block';
            tooltip.style.left = left + 'px';
            tooltip.style.top = (rect.top - 10) + 'px';
            icon.style.background = '#e0f2fe';
            icon.style.borderColor = '#0ea5e9';
        });
        
        icon.addEventListener('mouseleave', function() {
            tooltip.style.display = 'none';
            icon.style.background = '#f8fafc';
            icon.style.borderColor = '#cbd5e1';
        });
        
        console.log('✅ Тултип создан!');
    }, 100);
}
function renderPurposeFilters() {
    const container = document.getElementById('purpose-filters');
    if (!container) return;
    
    const types = Object.keys(purposeCount).sort((a, b) => {
        // nan всегда внизу
        if (a === 'nan' || a === 'NaN' || a === '') return 1;
        if (b === 'nan' || b === 'NaN' || b === '') return -1;
        return purposeCount[b] - purposeCount[a];
    });
    
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
        const isNan = type === 'nan' || type === 'NaN' || type === '';
        
        html += `
            <tr onclick="applyPurposeFilter('${type.replace(/'/g, "\\'")}')" 
                style="
                    cursor: pointer;
                    transition: all 0.15s;
                    background: ${isActive ? '#e0f2fe' : 'transparent'};
                    border-left: ${isActive ? '2px solid #0ea5e9' : '2px solid transparent'};
                    font-weight: ${isActive ? '600' : '400'};
                    color: ${isActive ? '#0284c7' : '#1e293b'};
                    ${isNan ? 'opacity: 0.5;' : ''}
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
    recalcAllFilters();
    applyFiltersAndUpdate();
}

function toggleAllCities(cities) {
    const allSelected = cities.every(city => currentCityFilter.includes(city));
    if (allSelected) {
        currentCityFilter = [];
    } else {
        currentCityFilter = [...cities];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}
function toggleAllObjectTypes(types) {
    const allSelected = types.every(type => currentObjectTypeFilter.includes(type));
    if (allSelected) {
        currentObjectTypeFilter = [];
    } else {
        currentObjectTypeFilter = [...types];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}

function toggleAllWallMaterials(types) {
    const allSelected = types.every(type => currentWallMaterialFilter.includes(type));
    if (allSelected) {
        currentWallMaterialFilter = [];
    } else {
        currentWallMaterialFilter = [...types];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}

function toggleAllQuarters(types) {
    const allSelected = types.every(type => currentQuarterFilter.includes(type));
    if (allSelected) {
        currentQuarterFilter = [];
    } else {
        currentQuarterFilter = [...types];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}

function toggleAllYearBuilds(types) {
    const allSelected = types.every(type => currentYearBuildFilter.includes(type));
    if (allSelected) {
        currentYearBuildFilter = [];
    } else {
        currentYearBuildFilter = [...types];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}
function toggleAllPurposes(types) {
    const allSelected = types.every(type => currentPurposeFilter.includes(type));
    if (allSelected) {
        currentPurposeFilter = [];
    } else {
        currentPurposeFilter = [...types];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}

function toggleAllVri(types) {
    const allSelected = types.every(type => currentVriFilter.includes(type));
    if (allSelected) {
        currentVriFilter = [];
    } else {
        currentVriFilter = [...types];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}
function toggleAllNumbers(numbers) {
    const allSelected = numbers.every(num => currentNumberFilter.includes(num));
    if (allSelected) {
        currentNumberFilter = [];
    } else {
        currentNumberFilter = [...numbers];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}
function toggleAllRatioCategories(categories) {
    const allSelected = categories.every(cat => currentRatioCategoryFilter.includes(cat));
    if (allSelected) {
        currentRatioCategoryFilter = [];
    } else {
        currentRatioCategoryFilter = [...categories];
    }
    recalcAllFilters();
    applyFiltersAndUpdate();
}
function applyFiltersAndUpdate() {
    // Перерисовываем все фильтры
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderPurposeFilters();
    renderVriFilters();
    renderNumberFilters();
    renderRatioCategoryFilters(); 
    
    // Обновляем карту и таблицу
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
    
    // ✅ ДОБАВЬТЕ ЭТУ СТРОКУ:
    recalcAllFilters();
    
    // ✅ ДОБАВЬТЕ ЭТУ СТРОКУ ДЛЯ ГРАФИКА:
    setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            console.log('📊 Обновление графика из applyFiltersAndUpdate');
            renderPriceChart();
        }
    }, 300);
}
function applyDealTypeFilter(kind) {
    // ✅ МНОЖЕСТВЕННЫЙ ВЫБОР: добавляем или удаляем значение
    const index = currentDealTypeFilter.indexOf(kind);
    if (index === -1) {
        currentDealTypeFilter.push(kind);
    } else {
        currentDealTypeFilter.splice(index, 1);
    }
    
    // ============================================================
    // СБРОС ОБЕРТКИ ПРИ ПРИМЕНЕНИИ ФИЛЬТРА
    // ============================================================
    // ✅ ЕСЛИ ЭТО ПОИСК ИЗ НСПД — НЕ СБРАСЫВАЕМ ВЫБРАННЫЙ КВАРТАЛ
    if (!window._isNSPDSearch) {
        if (window.selectedQuarterCadNumber) {
            const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                              window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
            if (isWrapper) {
                console.log('🔄 Сброс обертки при применении фильтра');
                window.selectedQuarterCadNumber = null;
            }
        }
    } else {
        console.log('⏳ Поиск из НСПД, сохраняем выбранный квартал:', window.selectedQuarterCadNumber);
    }
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ОБНОВЛЯЕМ ПОПАПЫ И ТУЛТИПЫ
    updatePopupsAndTooltips(level);
    
    // ✅ ОБНОВЛЯЕМ СПИСОК КВАРТАЛОВ
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    // ✅ ОБНОВЛЯЕМ ТУЛТИП ОБЕРТКИ
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
    
    // ✅ ЕСЛИ ЭТО ПОИСК ИЗ НСПД — НЕ СБРАСЫВАЕМ ВЫБРАННЫЙ КВАРТАЛ
    if (!window._isNSPDSearch) {
        if (window.selectedQuarterCadNumber) {
            const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                              window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
            if (isWrapper) {
                console.log('🔄 Сброс обертки при применении фильтра города');
                window.selectedQuarterCadNumber = null;
            }
        }
    } else {
        console.log('⏳ Поиск из НСПД, сохраняем выбранный квартал:', window.selectedQuarterCadNumber);
    }
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ЕСЛИ ЭТО ПОИСК ИЗ НСПД — НЕ СБРАСЫВАЕМ ВЫБРАННЫЙ КВАРТАЛ
    if (!window._isNSPDSearch) {
        if (window.selectedQuarterCadNumber) {
            const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                              window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
            if (isWrapper) {
                console.log('🔄 Сброс обертки при применении фильтра типа объекта');
                window.selectedQuarterCadNumber = null;
            }
        }
    } else {
        console.log('⏳ Поиск из НСПД, сохраняем выбранный квартал:', window.selectedQuarterCadNumber);
    }
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
function applyNumberFilter(num) {
    const index = currentNumberFilter.indexOf(num);
    if (index === -1) {
        currentNumberFilter.push(num);
    } else {
        currentNumberFilter.splice(index, 1);
    }
    
    // ✅ ПЕРЕСЧИТЫВАЕМ ВСЕ ФИЛЬТРЫ
    recalcAllFilters();
    
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
    
    // ✅ ОБНОВЛЯЕМ ВСЁ
    updateQuartersStyle(targetObjects);
    updateMapStatsFromDeals(level, parentId);
    updatePopupsAndTooltips(level);
    updateQuartersListWithFilteredObjects(null);  // ← ЭТО ОБНОВЛЯЕТ КВАРТАЛЫ СО СДЕЛКАМИ
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();  // ← ЭТО ОБНОВЛЯЕТ ТАБЛИЦУ СДЕЛОК
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
}
function applyRatioCategoryFilter(cat) {
    const index = currentRatioCategoryFilter.indexOf(cat);
    if (index === -1) {
        currentRatioCategoryFilter.push(cat);
    } else {
        currentRatioCategoryFilter.splice(index, 1);
    }
    
    recalcAllFilters();
    
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
function recalcAllFilters() {
    console.log('🔄 Пересчет всех фильтров...');
    
    // ✅ 1. Получаем ВСЕ сделки с учетом ВСЕХ активных фильтров (КРОМЕ текущего фильтра)
    function getFilteredDeals(excludeFilterType = null) {
        return allDealsFlat.filter(deal => {
            // Исключаем проверку для фильтра, который сейчас пересчитываем
            if (excludeFilterType !== 'deal_kind') {
                if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return false;
            }
            if (excludeFilterType !== 'city') {
                if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
            }
            if (excludeFilterType !== 'obj_kind') {
                if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return false;
            }
            if (excludeFilterType !== 'wall_material') {
                if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return false;
            }
            if (excludeFilterType !== 'quarter') {
                if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
            }
            if (excludeFilterType !== 'year_build') {
                if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
            }
            if (excludeFilterType !== 'purpose') {
                if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
            }
            if (excludeFilterType !== 'vri') {
                if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
            }
            if (excludeFilterType !== 'number') {
            if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
        }
            if (excludeFilterType !== 'ratio_category') { 
    if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false;
}
            return true;
        });
    }
    
    // ✅ 2. Пересчитываем КАЖДЫЙ фильтр отдельно
    // Типы сделок
    const dealTypesNew = {};
    const filteredDealsForDealTypes = getFilteredDeals('deal_kind');
    filteredDealsForDealTypes.forEach(deal => {
        const key = deal.deal_kind_text || 'nan';
        dealTypesNew[key] = (dealTypesNew[key] || 0) + 1;
    });
    
    // Города
    const citiesNew = {};
    const filteredDealsForCities = getFilteredDeals('city');
    filteredDealsForCities.forEach(deal => {
        const key = deal.city || 'nan';
        citiesNew[key] = (citiesNew[key] || 0) + 1;
    });
    
    // Типы объектов
    const objTypesNew = {};
    const filteredDealsForObjTypes = getFilteredDeals('obj_kind');
    filteredDealsForObjTypes.forEach(deal => {
        const key = deal.obj_kind_text || 'nan';
        objTypesNew[key] = (objTypesNew[key] || 0) + 1;
    });
    
    // Материал стен
    const wallMaterialsNew = {};
    const filteredDealsForWall = getFilteredDeals('wall_material');
    filteredDealsForWall.forEach(deal => {
        const key = deal.wall_material_name || 'nan';
        wallMaterialsNew[key] = (wallMaterialsNew[key] || 0) + 1;
    });
    
    // Кварталы
    const quartersNew = {};
    const filteredDealsForQuarter = getFilteredDeals('quarter');
    filteredDealsForQuarter.forEach(deal => {
        const key = deal.quarter || 'nan';
        quartersNew[key] = (quartersNew[key] || 0) + 1;
    });
    
    // Годы постройки
    const yearBuildsNew = {};
    const filteredDealsForYear = getFilteredDeals('year_build');
    filteredDealsForYear.forEach(deal => {
        const key = deal.year_build || 'nan';
        yearBuildsNew[key] = (yearBuildsNew[key] || 0) + 1;
    });
    
    // Назначение
    const purposesNew = {};
    const filteredDealsForPurpose = getFilteredDeals('purpose');
    filteredDealsForPurpose.forEach(deal => {
        const key = deal.purpose_text || 'nan';
        purposesNew[key] = (purposesNew[key] || 0) + 1;
    });
    
    // ВРИ
    const vrisNew = {};
    const filteredDealsForVri = getFilteredDeals('vri');
    filteredDealsForVri.forEach(deal => {
        const key = deal.vri || 'nan';
        vrisNew[key] = (vrisNew[key] || 0) + 1;
    });
        const numbersNew = {};
    const filteredDealsForNumber = getFilteredDeals('number');
    filteredDealsForNumber.forEach(deal => {
        const key = deal.number || 'nan';
        numbersNew[key] = (numbersNew[key] || 0) + 1;
    });
    const ratioCategoriesNew = {};
const filteredDealsForRatio = getFilteredDeals('ratio_category');
filteredDealsForRatio.forEach(deal => {
    const key = deal.ratio_category || 'nan';
    ratioCategoriesNew[key] = (ratioCategoriesNew[key] || 0) + 1;
});
    // ✅ 3. Обновляем глобальные переменные
    dealTypes = dealTypesNew;
    cityTypes = citiesNew;
    objectTypes = objTypesNew;
    wallMaterialTypes = wallMaterialsNew;
    quarterTypes = quartersNew;
    yearBuildTypes = yearBuildsNew;
    purposeCount = purposesNew;
    vriCount = vrisNew;
     numberCount = numbersNew;
    ratioCategoryCount = ratioCategoriesNew; 
    
    // ✅ 4. Перерисовываем ВСЕ фильтры
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderPurposeFilters();
    renderVriFilters();
    renderNumberFilters();
    renderRatioCategoryFilters();
    
    console.log('✅ Все фильтры пересчитаны');
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
    // ✅ ФИЛЬТР ПО ТИПУ СДЕЛКИ
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ГОРОДУ
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ТИПУ ОБЪЕКТА
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО МАТЕРИАЛУ СТЕН
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО КВАРТАЛУ СДЕЛКИ
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ГОДУ ПОСТРОЙКИ
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
        return false;
        }
    if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) {
        return false;
         }
        if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) {
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
    
    console.log(`updateMapStatsWithDealFilter: level=${level}, parentId=${parentId}, targetObjects=${targetObjects.length}`);
    
    // ✅ СОБИРАЕМ ТОЛЬКО ТЕ ОБЪЕКТЫ, У КОТОРЫХ ЕСТЬ СДЕЛКИ ПОСЛЕ ФИЛЬТРАЦИИ
    let objectsWithFilteredDeals = [];
    
    if (level === 2 && parentId) {
        targetObjects.forEach(f => {
            const cadNum = f.properties.cadastral_number;
            if (!cadNum) return;
            
          const deals = dealsData[cadNum] || [];
const filteredDeals = deals.filter(deal => {
    // ✅ ФИЛЬТР ПО ТИПУ СДЕЛКИ
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ГОРОДУ
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ТИПУ ОБЪЕКТА
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО МАТЕРИАЛУ СТЕН
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО КВАРТАЛУ СДЕЛКИ
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ГОДУ ПОСТРОЙКИ
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
        return false;
        }
    if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) {
        return false;
        }
   if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) {
        return false;
         }
    return true;
});
            
            if (filteredDeals.length > 0) {
                allDeals = allDeals.concat(filteredDeals);
                objectsWithFilteredDeals.push(f);
            }
        });
        console.log(`Кварталы с фильтром в районе: ${objectsWithFilteredDeals.length}, сделок: ${allDeals.length}`);
    } else {
        Object.keys(dealsData).forEach(cadNum => {
     const deals = dealsData[cadNum] || [];
const filteredDeals = deals.filter(deal => {
    // ✅ ФИЛЬТР ПО ТИПУ СДЕЛКИ
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ГОРОДУ
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ТИПУ ОБЪЕКТА
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО МАТЕРИАЛУ СТЕН
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО КВАРТАЛУ СДЕЛКИ
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) {
        return false;
    }
    // ✅ ФИЛЬТР ПО ГОДУ ПОСТРОЙКИ
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) {
        return false;
    }
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) {
        return false;
    }
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) {
        return false;
        }
        if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) {
        return false;
        }
     if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) { 
         return false;
     }
    return true;
});
            allDeals = allDeals.concat(filteredDeals);
        });
        objectsWithFilteredDeals = targetObjects;
        console.log(`Все сделки с фильтром: ${allDeals.length}`);
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


// ✅ ПРОВЕРЯЕМ, ЧТО МАССИВ НЕ ПУСТОЙ
const medianPrice = prices.length > 0 ? getMedianSync(prices) : 0;
const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
const medianUprs = uprsValues.length > 0 ? getMedianSync(uprsValues) : 0;
    
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
    const statUpks = document.getElementById('stat-upks');
    const statCadCost = document.getElementById('stat-cadcost');
    const statMedian = document.getElementById('stat-median');
    const statMinMax = document.getElementById('stat-minmax');
    const statUprs = document.getElementById('stat-uprs');
    const statTotalDeals = document.getElementById('stat-total-deals');
    const statObjects = document.getElementById('stat-objects');
    const statWithDeals = document.getElementById('stat-with-deals');
    
    if (!statMedian || !statMinMax || !statUprs || !statTotalDeals) return;
    
    // ✅ ПОКАЗЫВАЕМ ЗАГРУЗКУ
    statMedian.textContent = '⏳';
    statMinMax.textContent = '⏳';
    statUprs.textContent = '⏳';
    if (statUpks) statUpks.textContent = '⏳';
    if (statCadCost) statCadCost.textContent = '⏳';
    
    // ✅ СОБИРАЕМ ВСЕ КВАРТАЛЫ ДЛЯ ТЕКУЩЕГО УРОВНЯ
    const allObjects = mapData.features.filter(f => f.properties.level === 2);
    let allQuarters = [];
    
    if (level === 0 || level === 1) {
        // Для округа и района — все кварталы
        allQuarters = [...allObjects];
        
        // Добавляем обертки из dealsData
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
        // Для конкретного района — только его кварталы
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
        
        const allObjectsLocal = mapData.features.filter(f => {
            if (f.properties.level !== 2) return false;
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
        
        allQuarters = [...allQuartersFromDeals];
        allObjectsLocal.forEach(f => {
            const cadNum = f.properties.cadastral_number;
            if (cadNum && !allQuarters.some(q => q.properties.cadastral_number === cadNum)) {
                allQuarters.push(f);
            }
        });
    }
    
    console.log(`Уровень ${level}, всего кварталов: ${allQuarters.length}`);
    
    // ✅ СОБИРАЕМ ВСЕ ЦЕНЫ ИЗ ВСЕХ СДЕЛОК (НЕ ПО КВАРТАЛАМ!)
    let allPrices = [];
    let allUprs = [];
    let allUpks = [];
    let allCadCosts = [];
    let totalDealsCount = 0;
    let quartersWithDealsCount = 0;
    let allMinPrices = [];
    let allMaxPrices = [];
    
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
            if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
            if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDealsCount += filteredDeals.length;
            quartersWithDealsCount++;
            
            filteredDeals.forEach(d => {
                if (d.price > 0) allPrices.push(d.price);
                if (d.uprs > 0) allUprs.push(d.uprs);
                if (d.upks > 0) allUpks.push(d.upks);
                if (d.cad_cost > 0) allCadCosts.push(d.cad_cost);
            });
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            if (prices.length > 0) {
                allMinPrices.push(Math.min(...prices));
                allMaxPrices.push(Math.max(...prices));
            }
        }
    });
    
    console.log(`Всего сделок: ${totalDealsCount}, цен: ${allPrices.length}`);
    
    // ✅ ВЫЧИСЛЯЕМ МЕДИАНЫ АСИНХРОННО
    function calculateAndUpdateStats() {
        console.log('calculateAndUpdateStats начат');
        console.log('allPrices.length:', allPrices.length);
        console.log('allUprs.length:', allUprs.length);
        
        // Вычисляем медианы
        const medianPrice = getMedianSync(allPrices);
        const medianUprs = getMedianSync(allUprs);
        const medianUpks = getMedianSync(allUpks);
        const medianCadCost = getMedianSync(allCadCosts);
        
        const minPrice = allMinPrices.length > 0 ? Math.min(...allMinPrices) : 0;
        const maxPrice = allMaxPrices.length > 0 ? Math.max(...allMaxPrices) : 0;
        
        console.log('✅ medianPrice:', medianPrice);
        console.log('✅ medianUprs:', medianUprs);
        console.log('✅ medianUpks:', medianUpks);
        console.log('✅ medianCadCost:', medianCadCost);
        
        // ✅ ОБНОВЛЯЕМ UI
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
        statTotalDeals.textContent = totalDealsCount.toLocaleString();
        if (statUpks) statUpks.textContent = formatUprs(medianUpks);
        if (statCadCost) statCadCost.textContent = formatPrice(medianCadCost);
        
        if (statObjects) statObjects.textContent = allQuarters.length;
        if (statWithDeals) statWithDeals.textContent = quartersWithDealsCount;
        
        console.log('✅ UI обновлен');
        
        // ✅ ОБНОВЛЯЕМ ОСТАЛЬНЫЕ UI
        updateQuartersListWithFilteredObjects(null);
        updatePopupsAndTooltips(level);
    }
    
    // ✅ ЗАПУСКАЕМ В ФОНЕ
    if (window.requestIdleCallback) {
        console.log('⏳ Запуск requestIdleCallback');
        requestIdleCallback(calculateAndUpdateStats, { timeout: 4000 });
    } else {
        console.log('⏳ Запуск setTimeout (fallback)');
        setTimeout(calculateAndUpdateStats, 200);
    }
}
function updatePopupsAndTooltips(level) {
    // ✅ ЕСЛИ ФЛАГ ПРИНУДИТЕЛЬНОГО ОТКРЫТИЯ УСТАНОВЛЕН - НЕ ОБНОВЛЯЕМ ТУЛТИПЫ ОБЕРТОК
    if (window._isWrapperTooltipForced) {
        console.log('⏳ Пропускаем обновление тултипов (принудительное открытие)');
        // Обновляем только районы, не трогая обертки
        if (window.mapLayer) {
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
                    }
                }
            });
        }
        return;
    }
    
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
            
            layer.off('popupclose');
            layer.on('popupclose', function(e) {
                if (currentLevel === 2) {
                    const districtId = layer.feature.properties.parent_id || 
                                      layer.feature.properties.district_id;
                    console.log('🔄 Попап закрыт → обновление таблицы');
                    setTimeout(() => {
                        if (currentLevel === 2) {
                            onPopupClose('quarter', districtId);
                        }
                    }, 300);
                }
            });
            
            layer.off('tooltipclose');
            layer.on('tooltipclose', function(e) {
                if (currentLevel === 2) {
                    const districtId = layer.feature.properties.parent_id || 
                                      layer.feature.properties.district_id;
                    console.log('🔄 Тултип закрыт → обновление таблицы');
                    setTimeout(() => {
                        if (currentLevel === 2) {
                            onPopupClose('quarter', districtId);
                        }
                    }, 300);
                }
            });
        }
    });
    
    // ✅ ОБНОВЛЯЕМ ОБЕРТКИ ТОЛЬКО ЕСЛИ НЕ ПРИНУДИТЕЛЬНОЕ ОТКРЫТИЕ
    if (window.wrapperLayer && !window._isWrapperTooltipForced) {
        window.wrapperLayer.eachLayer(function(layer) {
            // ✅ ПРОВЕРЯЕМ, ЧТО ЭТО НЕ ПРИНУДИТЕЛЬНО ОТКРЫТАЯ ОБЕРТКА
            if (window._wrapperTooltipCadNum && layer.feature && layer.feature.properties) {
                const layerCadNum = layer.feature.properties.cadastral_number || '';
                if (layerCadNum === window._wrapperTooltipCadNum) {
                    console.log(`⏳ Пропускаем обновление принудительно открытой обертки: ${layerCadNum}`);
                    return;
                }
            }
            
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

    const quarterStats = [];
    let totalDeals = 0;
    let allMins = [];
    let allMaxs = [];
    
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
            if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
            if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false;
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
            const upks = filteredDeals.map(d => d.upks).filter(u => u > 0);
            const cadCosts = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
            
            if (prices.length > 0) {
                const medianPrice = getMedianSync(prices);
                const medianUprs = getMedianSync(uprs);
                const medianUpks = getMedianSync(upks);
                const medianCadCost = getMedianSync(cadCosts);
                
                quarterStats.push({
                    count: filteredDeals.length,
                    medianPrice: medianPrice,
                    medianUprs: medianUprs,
                    medianUpks: medianUpks,
                    medianCadCost: medianCadCost,
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                });
                
                allMins.push(Math.min(...prices));
                allMaxs.push(Math.max(...prices));
            }
        }
    });
    
    let weightedMedianPrice = 0;
    let weightedMedianUprs = 0;
    let weightedMedianUpks = 0;
    let weightedMedianCadCost = 0;
    let minPrice = 0;
    let maxPrice = 0;
    
    if (quarterStats.length > 0) {
        const priceValues = quarterStats.map(q => q.medianPrice).filter(p => p > 0);
        const uprsValues = quarterStats.map(q => q.medianUprs).filter(u => u > 0);
        const upksValues = quarterStats.map(q => q.medianUpks).filter(u => u > 0);
        const cadCostValues = quarterStats.map(q => q.medianCadCost).filter(c => c > 0);
        
        // ✅ ВЫЧИСЛЯЕМ МЕДИАНЫ СИНХРОННО (здесь мало данных, быстро)
        if (priceValues.length > 0) {
            const sorted = priceValues.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            weightedMedianPrice = sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid];
        }
        if (uprsValues.length > 0) {
            const sorted = uprsValues.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            weightedMedianUprs = sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid];
        }
        if (upksValues.length > 0) {
            const sorted = upksValues.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            weightedMedianUpks = sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid];
        }
        if (cadCostValues.length > 0) {
            const sorted = cadCostValues.slice().sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            weightedMedianCadCost = sorted.length % 2 === 0 
                ? (sorted[mid - 1] + sorted[mid]) / 2 
                : sorted[mid];
        }
        
        minPrice = Math.min(...allMins);
        maxPrice = Math.max(...allMaxs);
    }
    
    const formatNum = (num) => num.toLocaleString();
    const formatPrice = (num) => num.toLocaleString() + ' ₽';
    const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
    
    return `
        <div class="popup-title">${districtName}</div>
        <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
        ${totalDeals > 0 ? `
        <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
        <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
        <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(weightedMedianCadCost)}</span></div>
        <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
        <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUpks)}</span></div>
        <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
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
    if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(d.kind)) return false;
    if (currentCityFilter.length > 0 && !currentCityFilter.includes(d.city)) return false;
    if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(d.obj_kind)) return false;
    if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(d.wall_material)) return false;
    if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(d.quarter)) return false;
    if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(d.year_build)) return false;
    if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(d.purpose_text)) return false;
    if (currentVriFilter.length > 0 && !currentVriFilter.includes(d.vri)) return false;
    if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(d.number)) return false;
    if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(d.ratio_category)) return false; 
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
                if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.kind)) return false;
                if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return false;
                if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind)) return false;
                if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material)) return false;
                if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return false;
                if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return false;
                if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return false;
                if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return false;
                if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
                if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
                return true;
            });
            
            const dealsCount = filteredDeals.length;
            
            let fillColor = '#f1f5f9';
            let fillOpacity = 0.2;
            let borderColor = '#3b82f6';
            let borderWeight = 2.5;
            let borderOpacity = 0.6;
            
         if (isHeatmapEnabled) {
    if (filteredDeals.length > 0) {
        const uprsValues = [];
        const upksValues = [];
        
        filteredDeals.forEach(deal => {
            const uprsValue = deal.uprs || 0;
            const upksValue = deal.upks || 0;
            if (uprsValue > 0 && upksValue > 0) {
                uprsValues.push(uprsValue);
                upksValues.push(upksValue);
            }
        });
        
        if (uprsValues.length > 0 && upksValues.length > 0) {
            const medianUprs = getMedianSync(uprsValues);
            const medianUpks = getMedianSync(upksValues);
            const diffPercent = ((medianUprs - medianUpks) / medianUpks) * 100;
                        
                        // 🎨 НОВАЯ ПРОСТАЯ ШКАЛА
                        if (diffPercent >= -5 && diffPercent <= 5) {
                            fillColor = '#22c55e';      // Зеленый — УПРС ≈ УПКС
                        } else {
                            // Все остальные — от светло-красного до темно-красного
                            const absDiff = Math.abs(diffPercent);
                            if (absDiff <= 20) {
                                fillColor = '#f97316';  // Светло-красный (оранжевый)
                            } else {
                                fillColor = '#ef4444';  // Красный
                            }
                        }
                        
                        fillOpacity = 0.35;
                        borderColor = '#475569';
                        borderWeight = 2;
                        borderOpacity = 0.7;
                    } else {
                        fillColor = '#f1f5f9';
                        fillOpacity = 0.15;
                        borderColor = '#94a3b8';
                        borderWeight = 1.5;
                        borderOpacity = 0.4;
                    }
                } else {
                    fillColor = '#f1f5f9';
                    fillOpacity = 0.15;
                    borderColor = '#94a3b8';
                    borderWeight = 1.5;
                    borderOpacity = 0.4;
                }
            } else {
                const hasDeals = dealsCount > 0;
                fillColor = hasDeals ? getMapColor(dealsCount) : '#f1f5f9';
                fillOpacity = 0.2;
                borderColor = '#3b82f6';
                borderWeight = 2.5;
                borderOpacity = 0.6;
            }
            
            layer.setStyle({
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                color: borderColor,
                weight: borderWeight,
                opacity: borderOpacity,
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

    window.mapInstance = L.map(container, {
        center: [66.0, 76.0],
        zoom: 5,
        zoomControl: true,
        boxZoom: false 
    });

    window.mapInstance.attributionControl.remove();

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(window.mapInstance);

    setTimeout(() => {
        if (window.mapInstance) {
            window.mapInstance.invalidateSize();
            console.log('📏 invalidateSize() выполнен после инициализации');
        }
    }, 100);

    Promise.all([
        loadMapData(),
        loadDealsCSV()
    ]).then(() => {
        console.log('✅ Карта и данные загружены!');
        if (mapData) {
            renderMapLevel(currentLevel || 0, currentParentId);
            
            setTimeout(() => {
                console.log('📍 Принудительное центрирование после загрузки');
                if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                    window.mapInstance.invalidateSize();
                    window.mapInstance.setView([66.0, 76.0], 5);
                }
            }, 500);
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
        
        // ✅ ПРОВЕРЯЕМ, ЕСТЬ ЛИ УЖЕ ДАННЫЕ О СДЕЛКАХ
        if (Object.keys(dealsData).length > 0) {
            // Если данные уже есть — сразу рисуем карту
            renderMapLevel(0);
        } else {
            // Если данных нет — показываем заглушку
            console.log('⏳ Ожидаем загрузку данных о сделках...');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        showMapError(error.message);
    }
}

function renderMapLevel(level, parentId = null, skipAutoCenter = false) {
    // ✅ СБРАСЫВАЕМ ВЫБРАННЫЙ КВАРТАЛ ПРИ ПЕРЕХОДЕ НА УРОВЕНЬ ОКРУГА
    if (level === 0) {
        window.selectedQuarterCadNumber = null;
        currentDistrictFilter = null;
    }
    
    // ✅ СБРАСЫВАЕМ ОБЕРТКУ ПРИ ПЕРЕХОДЕ НА РАЙОН
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
    
    // ✅ СОХРАНЯЕМ ТЕКУЩИЙ УРОВЕНЬ ДЛЯ ФИЛЬТРА
    currentLevel = level;
    currentParentId = parentId;
    if (level === 2 && parentId) {
        currentDistrictFilter = parentId;
    } else {
        currentDistrictFilter = null;
    }
    
    if (!mapData || !window.mapInstance) {
        console.warn('⚠️ mapData или window.mapInstance не инициализированы');
        return;
    }

    console.log(`Фильтрация: level=${level}, parentId=${parentId}`);
    console.log(`Всего объектов в mapData: ${mapData.features.length}`);

    // ✅ СБРАСЫВАЕМ ВЫДЕЛЕНИЕ ПРИ ПЕРЕХОДЕ НА КВАРТАЛЫ
    if (level === 2) {
        if (window.mapInstance) {
            window.mapInstance.eachLayer(function(layer) {
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
    }

    // Фильтруем объекты
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

    console.log(`Отфильтровано: ${filtered.length} объектов`);
    
    if (filtered.length === 0) {
        console.warn('⚠️ Нет объектов для отображения!');
        showMapError('Нет объектов для отображения');
        return;
    }

    // Удаляем старые слои
    if (window.mapLayer) {
        if (window.mapInstance) {
            window.mapInstance.removeLayer(window.mapLayer);
        }
        window.mapLayer.off();
        window.mapLayer = null;
    }
    if (window.wrapperLayer) {
        if (window.mapInstance) {
            window.mapInstance.removeLayer(window.wrapperLayer);
        }
        window.wrapperLayer = null;
    }
    clearAllLabels();

    // 🔥 РАЗДЕЛЯЕМ НА ОБЕРТКИ И КВАРТАЛЫ
    const wrapperQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return cadNum.endsWith('000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    const normalQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return !cadNum.endsWith('000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    console.log(`Оберток: ${wrapperQuarters.length}, кварталов: ${normalQuarters.length}`);

    // 🔥 ДОБАВЛЯЕМ ОБЕРТКИ
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
                
                function buildWrapperPopupContent() {
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
                        if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
                        if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
                        return true;
                    });
                    
                    const dealsCount = filteredDeals.length;
                    const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
                    const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
                    const upksValues = filteredDeals.map(d => d.upks).filter(u => u > 0);
                    const cadCostValues = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
                    
                    const medianPrice = prices.length > 0 ? getMedianSync(prices) : 0;
                    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                    const uprsMedian = uprsValues.length > 0 ? getMedianSync(uprsValues) : 0;
                    const upksMedian = upksValues.length > 0 ? getMedianSync(upksValues) : 0;
                    const cadCostMedian = cadCostValues.length > 0 ? getMedianSync(cadCostValues) : 0;
                    
                    return `
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
                }
                
                layer.bindPopup(buildWrapperPopupContent(), {
                    className: 'custom-popup',
                    maxWidth: 300,
                    closeButton: true
                });
                
                layer.on('click', function(e) {
                    this.bindPopup(buildWrapperPopupContent(), {
                        className: 'custom-popup',
                        maxWidth: 300,
                        closeButton: true
                    });
                    
                    window.selectedQuarterCadNumber = cadNum;
                    this.openPopup();
                    
                    if (this.getBounds && this.getBounds().isValid()) {
                        if (window.mapInstance) {
                            window.mapInstance.fitBounds(this.getBounds(), { padding: [40, 40] });
                        }
                    }
                    
                    renderDealsTable();
                    console.log(`🔄 Обертка ${cadNum} выбрана, попап открыт`);
                    L.DomEvent.stopPropagation(e);
                });
                
                layer.on('mouseover', function() {
                    this.setStyle({
                        fillOpacity: 0.3,
                        weight: 3,
                        color: '#ff0000',
                        opacity: 0.9
                    });
                });
                
                layer.on('mouseout', function() {
                    this.setStyle({
                        fillOpacity: 0.25,
                        weight: 2.5,
                        color: '#dc2626',
                        opacity: 0.8
                    });
                });
                
                layer.on('popupclose', function(e) {
                    if (window.selectedQuarterCadNumber === cadNum) {
                        setTimeout(() => {
                            window.selectedQuarterCadNumber = null;
                            renderDealsTable();
                            console.log(`🔄 Попап обертки ${cadNum} закрыт, таблица обновлена`);
                        }, 200);
                    }
                });
            }
        });
        
        if (window.mapInstance) {
            window.wrapperLayer.addTo(window.mapInstance);
        }
        console.log(`✅ Добавлена обертка (${wrapperQuarters.length} шт.) СНИЗУ`);
    }

    // 🔥 ДОБАВЛЯЕМ КВАРТАЛЫ
    if (normalQuarters.length > 0) {
        const normalLayer = L.geoJSON(normalQuarters, {
            style: function(feature) {
                const props = feature.properties;
                const levelName = props.level_name || 'unknown';
                const cadNum = props.cadastral_number;
                
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
                    if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
                    if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
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
        if (window.mapInstance) {
            window.mapLayer.addTo(window.mapInstance);
        }
    }
    
    // ✅ invalidateSize() с проверкой
    if (window.mapInstance) {
        window.mapInstance.invalidateSize();
        console.log('📏 invalidateSize() выполнен после добавления слоев');
    }

    if (window.mapLayer) {
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
        updateQuartersStyle(targetObjects);
        console.log('🔥 Стили обновлены сразу после добавления слоев, isHeatmapEnabled =', isHeatmapEnabled);
    }

    // ✅ ФУНКЦИЯ ЦЕНТРИРОВАНИЯ С ПРОВЕРКОЙ skipAutoCenter
    function centerMap(attempt) {
        if (skipAutoCenter) {
            console.log(`⏳ Пропускаем центрирование (skipAutoCenter=true), attempt=${attempt}`);
            return true;
        }
        
        attempt = attempt || 1;
        console.log(`🔄 Попытка центрирования #${attempt}`);
        
        try {
            if (level === 0) {
                console.log('📍 УРОВЕНЬ ОКРУГА: центрируем на ЯНАО');
                if (window.mapInstance) {
                    window.mapInstance.setView([66.0, 76.0], 5);
                }
                return true;
            }
            
            if (level === 1) {
                console.log('📍 УРОВЕНЬ РАЙОНОВ: центрируем по границам');
                let bounds = null;
                
                if (window.mapLayer && window.mapLayer.getBounds) {
                    const b = window.mapLayer.getBounds();
                    if (b && b.isValid()) {
                        const sw = b._southWest;
                        const ne = b._northEast;
                        if (sw && ne && (ne.lat - sw.lat) > 0.001 && (ne.lng - sw.lng) > 0.001) {
                            bounds = b;
                            console.log('✅ Границы районов найдены');
                        }
                    }
                }
                
                if (bounds && bounds.isValid()) {
                    if (window.mapInstance) {
                        window.mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
                    }
                    console.log('✅ Карта отцентрирована по районам');
                    return true;
                } else {
                    if (window.mapInstance) {
                        window.mapInstance.setView([66.0, 76.0], 6);
                    }
                    console.log('⚠️ Fallback: центрируем на ЯНАО с зумом 6');
                    return true;
                }
            }
            
            if (level === 2) {
                console.log('📍 УРОВЕНЬ КВАРТАЛОВ: центрируем по границам');
                let bounds = null;
                
                if (window.mapLayer && window.mapLayer.getBounds) {
                    const b = window.mapLayer.getBounds();
                    if (b && b.isValid()) {
                        const sw = b._southWest;
                        const ne = b._northEast;
                        if (sw && ne && (ne.lat - sw.lat) > 0.001 && (ne.lng - sw.lng) > 0.001) {
                            bounds = b;
                            console.log('✅ Границы кварталов найдены');
                        }
                    }
                }
                
                if (bounds && bounds.isValid()) {
                    if (window.mapInstance) {
                        window.mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
                    }
                    console.log('✅ Карта отцентрирована по кварталам');
                    return true;
                } else {
                    const districtId = parentId || currentDistrictFilter;
                    if (districtId) {
                        const districtFeature = mapData.features.find(f => 
                            f.properties.level === 1 && 
                            (f.properties.district_id === districtId || f.properties.cadastral_number === districtId)
                        );
                        if (districtFeature && districtFeature.geometry) {
                            const coords = districtFeature.geometry.coordinates[0];
                            if (coords && coords.length > 0) {
                                let lat = 0, lng = 0;
                                coords.forEach(c => { lat += c[1]; lng += c[0]; });
                                lat /= coords.length;
                                lng /= coords.length;
                                if (window.mapInstance) {
                                    window.mapInstance.setView([lat, lng], 10);
                                }
                                console.log('📍 Центрируем на центр района');
                                return true;
                            }
                        }
                    }
                    if (window.mapInstance) {
                        window.mapInstance.setView([66.0, 76.0], 6);
                    }
                    console.log('⚠️ Fallback: центрируем на ЯНАО с зумом 6');
                    return true;
                }
            }
            
            console.warn('⚠️ Неизвестный уровень, центрируем на ЯНАО');
            if (window.mapInstance) {
                window.mapInstance.setView([66.0, 76.0], 5);
            }
            return true;
            
        } catch(e) {
            console.warn('⚠️ Ошибка центрирования:', e);
            try {
                if (window.mapInstance) {
                    window.mapInstance.setView([66.0, 76.0], 5);
                }
            } catch(err) {
                console.error('❌ Критическая ошибка центрирования:', err);
            }
            return true;
        }
    }

    // ✅ ЗАПУСКАЕМ ЦЕНТРИРОВАНИЕ ТОЛЬКО ЕСЛИ НЕ ОТКЛЮЧЕНО
    if (!skipAutoCenter) {
        setTimeout(() => {
            console.log('⏳ 1-я попытка центрирования через 100ms');
            centerMap(1);
        }, 100);
        
        setTimeout(() => {
            console.log('⏳ 2-я попытка центрирования через 400ms');
            centerMap(2);
        }, 400);
        
        setTimeout(() => {
            console.log('⏳ 3-я (гарантированная) попытка центрирования через 900ms');
            centerMap(3);
        }, 900);
    } else {
        console.log('⏳ Автоматическое центрирование ОТКЛЮЧЕНО (поиск)');
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
    
    // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ
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
    updateQuartersListWithFilteredObjects(null);
    addMapLegend();

    if (window.mapLayer) {
        let targetObjectsLocal = [];
        const allObjectsLocal = mapData.features.filter(f => f.properties.level === 2);
        
        if (level === 0 || level === 1) {
            targetObjectsLocal = allObjectsLocal;
        } else if (level === 2) {
            targetObjectsLocal = allObjectsLocal.filter(f => {
                const fParentId = f.properties.parent_id || f.properties.district_id;
                return fParentId === parentId;
            });
        }
        updateQuartersStyle(targetObjectsLocal);
    }
    
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
   setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            renderPriceChart();
        }
    }, 800);
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

        console.log(`Попап: всего кварталов для района ${districtId}: ${allQuarters.length}`);
        
        const quarterStats = [];
        let totalDeals = 0;
        let allMins = [];
        let allMaxs = [];
        let allPrices = [];
        let allUprs = [];
        
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
                
                const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
                const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
                const upks = filteredDeals.map(d => d.upks).filter(u => u > 0);
                const cadCosts = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
                
                allPrices = allPrices.concat(prices);
                allUprs = allUprs.concat(uprs);
                
                if (prices.length > 0) {
                    const medianPrice = getMedianSync(prices);
                    const medianUprs = getMedianSync(uprs);
                    const medianUpks = getMedianSync(upks);
                    const medianCadCost = getMedianSync(cadCosts);
                    
                    quarterStats.push({
                        count: filteredDeals.length,
                        medianPrice: medianPrice,
                        medianUprs: medianUprs,
                        medianUpks: medianUpks,
                        medianCadCost: medianCadCost,
                        min: Math.min(...prices),
                        max: Math.max(...prices)
                    });
                    
                    allMins.push(Math.min(...prices));
                    allMaxs.push(Math.max(...prices));
                }
            }
        });
        
        let weightedMedianPrice = 0;
        let weightedMedianUprs = 0;
        let weightedMedianUpks = 0;      
        let weightedMedianCadCost = 0;
        let minPrice = 0;
        let maxPrice = 0;
        
        if (quarterStats.length > 0) {
            const priceValues = quarterStats
                .map(q => q.medianPrice)
                .filter(p => p > 0)
                .sort((a, b) => a - b);
            if (priceValues.length > 0) {
                const mid = Math.floor(priceValues.length / 2);
                if (priceValues.length % 2 === 0) {
                    weightedMedianPrice = (priceValues[mid - 1] + priceValues[mid]) / 2;
                } else {
                    weightedMedianPrice = priceValues[mid];
                }
            }

            const uprsValues = quarterStats
                .map(q => q.medianUprs)
                .filter(u => u > 0)
                .sort((a, b) => a - b);
            if (uprsValues.length > 0) {
                const mid = Math.floor(uprsValues.length / 2);
                if (uprsValues.length % 2 === 0) {
                    weightedMedianUprs = (uprsValues[mid - 1] + uprsValues[mid]) / 2;
                } else {
                    weightedMedianUprs = uprsValues[mid];
                }
            }
            
            const upksValues = quarterStats
                .map(q => q.medianUpks)
                .filter(u => u > 0)
                .sort((a, b) => a - b);
            if (upksValues.length > 0) {
                const mid = Math.floor(upksValues.length / 2);
                if (upksValues.length % 2 === 0) {
                    weightedMedianUpks = (upksValues[mid - 1] + upksValues[mid]) / 2;
                } else {
                    weightedMedianUpks = upksValues[mid];
                }
            }
            
            const cadCostValues = quarterStats
                .map(q => q.medianCadCost)
                .filter(c => c > 0)
                .sort((a, b) => a - b);
            if (cadCostValues.length > 0) {
                const mid = Math.floor(cadCostValues.length / 2);
                if (cadCostValues.length % 2 === 0) {
                    weightedMedianCadCost = (cadCostValues[mid - 1] + cadCostValues[mid]) / 2;
                } else {
                    weightedMedianCadCost = cadCostValues[mid];
                }
            }
            
            minPrice = Math.min(...allMins);
            maxPrice = Math.max(...allMaxs);
        }

        const formatNum = (num) => num.toLocaleString();
        const formatPrice = (num) => num.toLocaleString() + ' ₽';
        const formatUprs = (num) => num.toFixed(2) + ' ₽/м²';
        
        const popupContent = `
            <div class="popup-title">${districtName}</div>
            <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
            ${totalDeals > 0 ? `
            <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
            <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
            <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(weightedMedianCadCost)}</span></div>
            <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
            <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUpks)}</span></div>
            <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
            ` : `<div class="popup-row"><span class="popup-label" style="color:#94a3b8;">Нет сделок</span></div>`}
        `;
        
        layer.bindPopup(popupContent, { 
            className: 'custom-popup', 
            maxWidth: 300,
            closeButton: true
        });
        
        const tooltipContent = `
            <div class="popup-title">${districtName}</div>
            <div class="popup-row"><span class="popup-label">${displayCad}</span></div>
            ${totalDeals > 0 ? `
            <div class="popup-row"><span class="popup-label">Сделок</span><span class="popup-value">${formatNum(totalDeals)}</span></div>
            <div class="popup-row"><span class="popup-label">Медианная цена</span><span class="popup-value">${formatPrice(weightedMedianPrice)}</span></div>
            <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(weightedMedianCadCost)}</span></div>
            <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
            <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUpks)}</span></div>
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
    
    // ===== 🖱️ КЛИК =====
    layer.on('click', function(e) {
        if (levelName === 'okrug') {
            renderMapLevel(1);
            updateBreadcrumb('okrug');
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                    window.mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
                }
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
            
            if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                window.mapInstance.eachLayer(function(layer) {
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
            
            const districtId = props.district_id || props.cadastral_number;
            renderMapLevel(2, districtId);
            updateBreadcrumb('district', districtId, props.district_name);
            if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
                if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                    window.mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
                }
            }
        } else if (levelName === 'quarter') {
            const cadNum = props.cadastral_number;
            const dealsCount = cadNum ? (dealsData[cadNum] || []).length : 0;
            console.log('Квартал выбран:', cadNum);
            console.log('Сделок:', dealsCount);
            
            window._isPopupOpening = true;
            window._popupOpenCadNum = cadNum;
            console.log('🔒 Флаг _isPopupOpening = true, cadNum =', cadNum);
            
            window.selectedQuarterCadNumber = cadNum;
            
            renderDealsTable();
            
            const districtId = props.parent_id || props.district_id;
            
            if (layer.getBounds && layer.getBounds().isValid()) {
                if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                    window.mapInstance.fitBounds(layer.getBounds(), { padding: [20, 20] });
                }
            } else if (layer.getLatLng) {
                if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                    window.mapInstance.setView(layer.getLatLng(), 15);
                }
            }
            
            layer.openPopup();
            
            setTimeout(() => {
                window._isPopupOpening = false;
                console.log('🔓 Флаг _isPopupOpening = false');
            }, 1500);
            
            layer.off('popupclose');
            layer.on('popupclose', function(e) {
                if (window._isPopupOpening) {
                    console.log('⏳ Пропускаем close, идет открытие');
                    return;
                }
                
                if (currentLevel === 2) {
                    console.log('🔄 Попап закрыт (из onMapFeatureClick) → обновление таблицы');
                    setTimeout(() => {
                        if (currentLevel === 2) {
                            onPopupClose('quarter', districtId);
                        }
                    }, 300);
                }
            });
        }
    });

    // ===== 🖱️ ХОВЕР (наведение) =====
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
            
            let fillColor = '#f1f5f9';
            let fillOpacity = 0.35;
            let borderColor = '#60a5fa';
            let borderWeight = 2;
            let borderOpacity = 0.8;
            
            if (isHeatmapEnabled) {
                if (filteredDeals.length > 0) {
                    const uprsValues = [];
                    const upksValues = [];
                    filteredDeals.forEach(deal => {
                        const uprsValue = deal.uprs || 0;
                        const upksValue = deal.upks || 0;
                        if (uprsValue > 0 && upksValue > 0) {
                            uprsValues.push(uprsValue);
                            upksValues.push(upksValue);
                        }
                    });
                    if (uprsValues.length > 0 && upksValues.length > 0) {
                        const medianUprs = getMedianSync(uprsValues);
                        const medianUpks = getMedianSync(upksValues);
                        const diff = ((medianUprs - medianUpks) / medianUpks) * 100;
                        
                        if (diff >= -5 && diff <= 5) {
                            fillColor = '#22c55e';
                        } else {
                            const absDiff = Math.abs(diff);
                            if (absDiff <= 20) {
                                fillColor = '#f97316';
                            } else {
                                fillColor = '#ef4444';
                            }
                        }
                        fillOpacity = 0.5;
                        borderColor = '#60a5fa';
                        borderWeight = 2;
                        borderOpacity = 0.8;
                    }
                }
            } else {
                const count = filteredDeals.length;
                fillColor = count > 0 ? getMapColor(count) : '#f1f5f9';
                fillOpacity = 0.35;
                borderColor = '#60a5fa';
                borderWeight = 2;
                borderOpacity = 0.8;
            }
            
            this.setStyle({
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                weight: borderWeight,
                color: borderColor,
                opacity: borderOpacity
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
                if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
                return true;
            });
            
            let fillColor = '#f1f5f9';
            let fillOpacity = 0.2;
            let borderColor = '#3b82f6';
            let borderWeight = 2.5;
            let borderOpacity = 0.6;
            
            if (isHeatmapEnabled) {
                if (filteredDeals.length > 0) {
                    const uprsValues = [];
                    const upksValues = [];
                    filteredDeals.forEach(deal => {
                        const uprsValue = deal.uprs || 0;
                        const upksValue = deal.upks || 0;
                        if (uprsValue > 0 && upksValue > 0) {
                            uprsValues.push(uprsValue);
                            upksValues.push(upksValue);
                        }
                    });
                    if (uprsValues.length > 0 && upksValues.length > 0) {
                        const medianUprs = getMedianSync(uprsValues);
                        const medianUpks = getMedianSync(upksValues);
                        const diff = ((medianUprs - medianUpks) / medianUpks) * 100;
                        
                        if (diff >= -5 && diff <= 5) {
                            fillColor = '#22c55e';
                        } else {
                            const absDiff = Math.abs(diff);
                            if (absDiff <= 20) {
                                fillColor = '#f97316';
                            } else {
                                fillColor = '#ef4444';
                            }
                        }
                        fillOpacity = 0.35;
                        borderColor = '#475569';
                        borderWeight = 2;
                        borderOpacity = 0.7;
                    }
                } else {
                    fillColor = '#f1f5f9';
                    fillOpacity = 0.15;
                    borderColor = '#94a3b8';
                    borderWeight = 1.5;
                    borderOpacity = 0.4;
                }
            } else {
                const hasDeals = filteredDeals.length > 0;
                fillColor = hasDeals ? getMapColor(filteredDeals.length) : '#f1f5f9';
                fillOpacity = 0.2;
                borderColor = '#3b82f6';
                borderWeight = 2.5;
                borderOpacity = 0.6;
            }
            
            this.setStyle({
                fillColor: fillColor,
                fillOpacity: fillOpacity,
                color: borderColor,
                weight: borderWeight,
                opacity: borderOpacity
            });
        }
    });
}
function onPopupClose(levelName, districtId) {
    if (levelName === 'quarter' && districtId) {
        console.log('🔄 Закрытие попапа/тултипа квартала → обновление таблицы');
        
        // ✅ ПРОВЕРЯЕМ ФЛАГ ОТКРЫТИЯ
        if (window._isPopupOpening) {
            console.log('⏳ Идет процесс открытия попапа, НЕ сбрасываем');
            return;
        }
        
        // ✅ ПРОВЕРЯЕМ, НЕ БЫЛ ЛИ ЭТОТ КВАРТАЛ ТОЛЬКО ЧТО ОТКРЫТ
        if (window._popupOpenCadNum && window._popupOpenCadNum === districtId) {
            console.log('⏳ Этот квартал только что открыт, НЕ сбрасываем');
            renderDealsTable();
            updateMapStatsFromDeals(currentLevel, currentParentId);
            updateQuartersListWithFilteredObjects(null);
            updateActiveFiltersDisplay();
            return;
        }
        
        // ✅ ПРОВЕРЯЕМ, НЕ БЫЛ ЛИ КВАРТАЛ ВЫБРАН ЧЕРЕЗ НСПД
        const selectedCad = window.selectedQuarterCadNumber;
        const isFromNSPD = selectedCad && (selectedCad === districtId || window._isNSPDSearch);
        
        if (isFromNSPD) {
            console.log('⏳ Квартал выбран через НСПД, НЕ сбрасываем');
            renderDealsTable();
            updateMapStatsFromDeals(currentLevel, currentParentId);
            updateQuartersListWithFilteredObjects(null);
            updateActiveFiltersDisplay();
            return;
        }
        
        // ✅ Сбрасываем выбранный квартал (УДАЛИЛИ ВСЕ ПРОВЕРКИ!)
        window.selectedQuarterCadNumber = null;
        window._popupOpenCadNum = null;
        
        // Обновляем таблицу сделок (покажет все сделки района)
        renderDealsTable();
        updateMapStatsFromDeals(currentLevel, currentParentId);
        updateQuartersListWithFilteredObjects(null);
        updateActiveFiltersDisplay();
    }
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
            if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
            if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false;
            return true;
        });
        
        if (filteredDeals.length > 0) {
            totalDeals += filteredDeals.length;
            
            const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
            const uprs = filteredDeals.map(d => d.uprs).filter(u => u > 0);
            const upks = filteredDeals.map(d => d.upks).filter(u => u > 0);      
            const cadCosts = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
            
            if (prices.length > 0) {
               const medianPrice = getMedianSync(prices);
const medianUprs = getMedianSync(uprs);
const medianUpks = getMedianSync(upks);
const medianCadCost = getMedianSync(cadCosts);
                
                quarterStats.push({
                    count: filteredDeals.length,
                    medianPrice: medianPrice,
                    medianUprs: medianUprs,
                    medianUpks: medianUpks,       
                    medianCadCost: medianCadCost, 
                    min: Math.min(...prices),
                    max: Math.max(...prices)
                });
                
                allMins.push(Math.min(...prices));
                allMaxs.push(Math.max(...prices));
            }
        }
    });
    
    
   if (quarterStats.length > 0) {
    // ✅ Медианная цена — ОБЫЧНАЯ МЕДИАНА
    const priceValues = quarterStats
        .map(q => q.medianPrice)
        .filter(p => p > 0)
        .sort((a, b) => a - b);
    if (priceValues.length > 0) {
        const mid = Math.floor(priceValues.length / 2);
        if (priceValues.length % 2 === 0) {
            weightedMedianPrice = (priceValues[mid - 1] + priceValues[mid]) / 2;
        } else {
            weightedMedianPrice = priceValues[mid];
        }
    }

    // ✅ Медианная УПРС — ОБЫЧНАЯ МЕДИАНА
    const uprsValues = quarterStats
        .map(q => q.medianUprs)
        .filter(u => u > 0)
        .sort((a, b) => a - b);
    if (uprsValues.length > 0) {
        const mid = Math.floor(uprsValues.length / 2);
        if (uprsValues.length % 2 === 0) {
            weightedMedianUprs = (uprsValues[mid - 1] + uprsValues[mid]) / 2;
        } else {
            weightedMedianUprs = uprsValues[mid];
        }
    }
    
    // ✅ Медианная УПКС — ОБЫЧНАЯ МЕДИАНА
    const upksValues = quarterStats
        .map(q => q.medianUpks)
        .filter(u => u > 0)
        .sort((a, b) => a - b);
    if (upksValues.length > 0) {
        const mid = Math.floor(upksValues.length / 2);
        if (upksValues.length % 2 === 0) {
            weightedMedianUpks = (upksValues[mid - 1] + upksValues[mid]) / 2;
        } else {
            weightedMedianUpks = upksValues[mid];
        }
    }
    
    // ✅ Кадастровая стоимость — ОБЫЧНАЯ МЕДИАНА
    const cadCostValues = quarterStats
        .map(q => q.medianCadCost)
        .filter(c => c > 0)
        .sort((a, b) => a - b);
    if (cadCostValues.length > 0) {
        const mid = Math.floor(cadCostValues.length / 2);
        if (cadCostValues.length % 2 === 0) {
            weightedMedianCadCost = (cadCostValues[mid - 1] + cadCostValues[mid]) / 2;
        } else {
            weightedMedianCadCost = cadCostValues[mid];
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
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${weightedMedianCadCost.toLocaleString()} ₽</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${weightedMedianUprs.toFixed(2)} ₽/м²</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${weightedMedianUpks.toFixed(2)} ₽/м²</span></div>
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
         if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
        if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
        return true;
    });
    
    const dealsCount = filteredDeals.length;
    const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
    const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
    const upksValues = filteredDeals.map(d => d.upks).filter(u => u > 0);
    const cadCostValues = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
    
    const medianPrice = getMedianSync(prices);
    const uprsMedian = getMedianSync(uprsValues);
    const upksMedian = getMedianSync(upksValues);
    const cadCostMedian = getMedianSync(cadCostValues);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    
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
    if (window.mapInstance) {
        window.mapInstance.remove();
        window.mapInstance = null;
    }
    window.mapLayer = null;
    window.wrapperLayer = null;
    console.log('🗺️ Карта уничтожена');
}
function addMapLegend() {
    // Удаляем старые легенды
    const oldHeatmapLegend = document.querySelector('.heatmap-legend');
    if (oldHeatmapLegend) oldHeatmapLegend.remove();
    
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
    
    // ✅ Если включен Heatmap — показываем легенду УПРС vs УПКС
    if (isHeatmapEnabled) {
        legend.innerHTML = `
            <div style="font-weight:600; font-size:11px; color:#475569; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
                УПРС vs УПКС
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#22c55e;"></span>
                <span style="color:#475569;">УПРС ≈ УПКС (≤5%)</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#f97316;"></span>
                <span style="color:#475569;">Отклонение 5-20%</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:20px; height:14px; border-radius:4px; background:#ef4444;"></span>
                <span style="color:#475569;">Отклонение &gt;20%</span>
            </div>
        `;
    } else {
        // ❌ Обычный режим: легенда по количеству сделок
        legend.innerHTML = `
            <div style="font-weight:600; font-size:11px; color:#475569; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
                Сделки в квартале
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
    }
    
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
    currentNumberFilter = [];
    currentCityFilter = [];
    currentObjectTypeFilter = [];
    currentWallMaterialFilter = [];
    currentQuarterFilter = [];
    currentYearBuildFilter = []; 
    currentPurposeFilter = [];   
    currentVriFilter = [];   
    currentRatioCategoryFilter = []; 
    
    if (isCadCostFilterEnabled) {
        isCadCostFilterEnabled = false;
        const btn = document.getElementById('cadCostFilterToggle');
        if (btn) {
            // ⚠️ ГЛАВНОЕ ИЗМЕНЕНИЕ: btn.textContent ВМЕСТО btn.innerHTML
            btn.textContent = 'Только с КС';
            btn.style.background = '#e0f2fe';
            btn.style.color = '#0284c7';
            btn.style.borderColor = '#bae6fd';
        }
        if (originalAllDealsFlatForCad.length > 0) {
            allDealsFlat = [...originalAllDealsFlatForCad];
        }
        rebuildDealsData(allDealsFlat);
    }
    
    // ✅ ВЫЗЫВАЕМ ОДНУ ФУНКЦИЮ ДЛЯ ПЕРЕСЧЁТА ВСЕХ ФИЛЬТРОВ
    recalcAllFilters();
    
    renderMapLevel(currentLevel, currentParentId);
    addMapLegend();
    updateActiveFiltersDisplay();
    renderDealsTable();
    
    setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            console.log('📊 Обновление графика после сброса фильтров');
            renderPriceChart();
        }
    }, 400);
    
    console.log('✅ Все фильтры сброшены');
}
function updateActiveFiltersDisplay() {
    const container = document.getElementById('active-filters-list');
    if (!container) return;
    
    const activeFilters = [];
    
    if (currentCityFilter.length > 0) {
        const values = currentCityFilter.join(', ');
        activeFilters.push(`Районы: ${values}`);
    }
    if (currentObjectTypeFilter.length > 0) {
        const values = currentObjectTypeFilter.join(', ');
        activeFilters.push(`Тип объекта: ${values}`);
    }
    if (currentDealTypeFilter.length > 0) {
        const values = currentDealTypeFilter.join(', ');
        activeFilters.push(`Тип сделки: ${values}`);
    }
    if (currentQuarterFilter.length > 0) {
        const values = currentQuarterFilter.join(', ');
        activeFilters.push(`Квартал: ${values}`);
    }
    if (currentWallMaterialFilter.length > 0) {
        const values = currentWallMaterialFilter.join(', ');
        activeFilters.push(`Материал стен: ${values}`);
    }
    if (currentYearBuildFilter.length > 0) {
        const values = currentYearBuildFilter.join(', ');
        activeFilters.push(`Год постройки: ${values}`);
    }
    if (currentPurposeFilter.length > 0) {
        const values = currentPurposeFilter.join(', ');
        activeFilters.push(`Назначение: ${values}`);
    }
    if (currentVriFilter.length > 0) {
        const values = currentVriFilter.join(', ');
        activeFilters.push(`ВРИ: ${values}`);
    }
    if (currentNumberFilter.length > 0) {
    const values = currentNumberFilter.join(', ');
    activeFilters.push(`Количество объектов: ${values}`);
}
if (currentRatioCategoryFilter.length > 0) {  //
    const values = currentRatioCategoryFilter.join(', ');
    activeFilters.push(`Категория: ${values}`);
}
    if (activeFilters.length === 0) {
        container.textContent = '—';
        container.style.color = '#94a3b8';
    } else {
        container.innerHTML = activeFilters.map(f => 
            `<span style="
                background: #e0f2fe; 
                color: #0284c7; 
                padding: 2px 10px; 
                border-radius: 12px; 
                font-weight: 500;
                font-size: 10px;
                border: 1px solid #bae6fd;
                white-space: nowrap;
                display: inline-block;
                margin: 1px 2px;
            ">${f}</span>`
        ).join(' ');
        container.style.color = '#1e293b';
    }
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
        if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
        if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
        return true;
    });
    
    // ✅ СОРТИРОВКА
    filteredDeals.sort((a, b) => {
        let valA, valB;
        
        // Для специальных полей
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
        
        // Для числовых полей
        const numericFields = ['area', 'cad_cost', 'upks', 'deal_price_rub', 'uprs_rub', 'year_build', 'number'];
        if (numericFields.includes(field)) {
            valA = a[field] || 0;
            valB = b[field] || 0;
            return dealsSortAsc ? valA - valB : valB - valA;
        }
        
        // Для строковых полей
        valA = (a[field] || 'nan').toString().toLowerCase();
        valB = (b[field] || 'nan').toString().toLowerCase();
        
        if (dealsSortAsc) {
            return valA.localeCompare(valB);
        } else {
            return valB.localeCompare(valA);
        }
    });
    
    // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
    const container = document.getElementById('deals-table-container');
    if (!container) return;
    
    // ✅ ИСПРАВЛЕННАЯ ТАБЛИЦА С ДОБАВЛЕННЫМ СТОЛБЦОМ cad_nspd
    let html = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif; table-layout: fixed;">
            <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('cad_number')">Кад. квартал ↕</th>
                    
                    <!-- ✅ ДОБАВЛЯЕМ СТОЛБЕЦ cad_nspd -->
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('cad_nspd')">Кад. номер НСПД ↕</th>
                    
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
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('street')">Улица ↕</th>
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
                    <td colspan="20" style="text-align: center; padding: 30px 0; color: #94a3b8; font-size: 14px;">
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
                    
                    <!-- ✅ ДОБАВЛЯЕМ ЯЧЕЙКУ cad_nspd -->
                    <td style="text-align: center; padding: 6px 6px; font-family: monospace; font-size: 10px; color: #1e293b; font-weight: 400;">${deal.cad_nspd || 'nan'}</td>
                    
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
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px;" title="${deal.street || 'nan'}">${deal.street || 'nan'}</td>
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
    // Проверяем, есть ли выбранный квартал на карте
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
            if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                window.mapInstance.removeLayer(label);
            }
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
        });
        
        if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
            label.addTo(window.mapInstance);
        }
        
        labels.push(label);
    });
    
    window.districtLabels = labels;
}
function clearAllLabels() {
    if (window.districtLabels) {
        window.districtLabels.forEach(label => {
            if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                window.mapInstance.removeLayer(label);
            }
        });
        window.districtLabels = [];
    }
    
    if (window.quarterLabels) {
        window.quarterLabels.forEach(label => {
            if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                window.mapInstance.removeLayer(label);
            }
        });
        window.quarterLabels = [];
    }
    
    if (window.mapLayer && window.mapLayer._labels) {
        window.mapLayer._labels.forEach(label => {
            if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                window.mapInstance.removeLayer(label);
            }
        });
        window.mapLayer._labels = [];
    }
    
    if (window.wrapperLayer && window.wrapperLayer._labels) {
        window.wrapperLayer._labels.forEach(label => {
            if (window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                window.mapInstance.removeLayer(label);
            }
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
    
    let found = mapData.features.find(f => {
        const cadNum = f.properties.cadastral_number || '';
        if (f.properties.level === 2) {
            return cadNum.toLowerCase().includes(query.toLowerCase());
        }
        return false;
    });
    
    if (!found) {
        found = mapData.features.find(f => {
            const cadNum = f.properties.cadastral_number || '';
            if (f.properties.level === 1) {
                return cadNum.toLowerCase().includes(query.toLowerCase());
            }
            return false;
        });
    }
    
    if (!found) {
        const allCadNumbers = Object.keys(dealsData);
        const matchingCad = allCadNumbers.find(cad => 
            cad.toLowerCase().includes(query.toLowerCase())
        );
        if (matchingCad) {
            const isWrapper = matchingCad.endsWith('000000') || matchingCad.match(/^\d{2}:\d{2}:000000$/);
            found = {
                properties: {
                    cadastral_number: matchingCad,
                    level: isWrapper ? 1 : 2,
                    district_id: matchingCad.substring(0, 5),
                    parent_id: matchingCad.substring(0, 5),
                    isWrapper: isWrapper
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
        console.log(`🔴 Найдена обертка: ${cadNum}`);
        window.selectedQuarterCadNumber = cadNum;
        
        renderMapLevel(1, null, true);
        updateBreadcrumb('okrug');
        renderDealTypeFilters();
        renderCityFilters();
        renderObjectTypeFilters();
        renderWallMaterialFilters();
        renderQuarterFilters();
        renderYearBuildFilters();
        renderDealsTable();
        
        let attempts = 0;
        const maxAttempts = 20;
        
        function findAndOpenPopup() {
            attempts++;
            console.log(`🔍 Попытка #${attempts} найти обертку ${cadNum} для открытия попапа`);
            
            let foundLayer = null;
            
            if (window.wrapperLayer) {
                window.wrapperLayer.eachLayer(function(layer) {
                    if (layer.feature && layer.feature.properties) {
                        if (layer.feature.properties.cadastral_number === cadNum) {
                            foundLayer = layer;
                        }
                    }
                });
            }
            
            if (!foundLayer && window.mapLayer) {
                window.mapLayer.eachLayer(function(layer) {
                    if (layer.feature && layer.feature.properties) {
                        if (layer.feature.properties.cadastral_number === cadNum) {
                            foundLayer = layer;
                        }
                    }
                });
            }
            
            if (foundLayer) {
                console.log(`✅ Обертка ${cadNum} найдена на попытке #${attempts}`);
                foundLayer.openPopup();
                if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                    if (window.mapInstance) {
                        window.mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
                    }
                }
                return true;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(findAndOpenPopup, 300);
                return false;
            }
            
            console.warn(`⚠️ Обертка ${cadNum} не найдена после ${maxAttempts} попыток`);
            return false;
        }
        
        setTimeout(findAndOpenPopup, 500);
        return;
    }
    
    console.log(`🏘️ Обычный квартал: ${cadNum}`);
    
    const districtId = found.properties.parent_id || found.properties.district_id;
    const districtName = found.properties.district_name || districtId || 'Район';
    
    renderMapLevel(2, districtId, true);
    updateBreadcrumb('quarter', districtId, districtName, true);
    
    window.selectedQuarterCadNumber = cadNum;
    
    setTimeout(() => {
        if (window.mapLayer) {
            let foundLayer = null;
            window.mapLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    if (layer.feature.properties.cadastral_number === cadNum) {
                        foundLayer = layer;
                    }
                }
            });
            
            if (foundLayer) {
                console.log(`✅ Квартал ${cadNum} найден`);
                try {
                    const bounds = foundLayer.getBounds();
                    if (bounds && bounds.isValid && bounds.isValid()) {
                        if (window.mapInstance) {
                            window.mapInstance.fitBounds(bounds, { padding: [40, 40] });
                        }
                    }
                    setTimeout(() => {
                        foundLayer.openPopup();
                    }, 500);
                } catch(e) {
                    console.warn('⚠️ Ошибка:', e);
                }
            }
        }
        renderDealsTable();
    }, 1000);
}
function searchQuarterByCadNumber(cadNumber) {
    if (!cadNumber || isUpdatingFromSearch) {
        console.log('⏳ Пропускаем');
        return;
    }
    
    window._isPopupOpening = true;
    window._popupOpenCadNum = cadNumber;
    console.log(`🔍 Поиск по номеру: ${cadNumber}`);
    isUpdatingFromSearch = true;
    
    let found = mapData.features.find(f => {
        if (f.properties.level !== 2) return false;
        return f.properties.cadastral_number === cadNumber;
    });
    
    if (!found) {
        found = mapData.features.find(f => {
            if (f.properties.level !== 1) return false;
            return f.properties.cadastral_number === cadNumber;
        });
    }
    
    if (!found) {
        const deals = dealsData[cadNumber] || [];
        const isWrapper = cadNumber.endsWith('000000') || cadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (deals.length > 0 || isWrapper) {
            found = {
                properties: {
                    cadastral_number: cadNumber,
                    level: isWrapper ? 1 : 2,
                    district_id: cadNumber.substring(0, 5),
                    parent_id: cadNumber.substring(0, 5),
                    isWrapper: isWrapper
                }
            };
        }
    }
    
    if (!found) {
        console.log(`❌ Квартал "${cadNumber}" не найден`);
        isUpdatingFromSearch = false;
        window._isPopupOpening = false;
        return;
    }
    
    const cadNum = found.properties.cadastral_number || cadNumber;
    const isWrapper = cadNum.endsWith('000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    
    if (isWrapper) {
        console.log(`🔴 Обертка: ${cadNum}`);
        window.selectedQuarterCadNumber = cadNum;
        
        renderMapLevel(1, null, true);
        updateBreadcrumb('okrug');
        renderDealTypeFilters();
        renderCityFilters();
        renderObjectTypeFilters();
        renderWallMaterialFilters();
        renderQuarterFilters();
        renderYearBuildFilters();
        renderDealsTable();
        
        let attempts = 0;
        const maxAttempts = 20;
        
        function findAndOpenPopup() {
            attempts++;
            let foundLayer = null;
            
            if (window.wrapperLayer) {
                window.wrapperLayer.eachLayer(function(layer) {
                    if (layer.feature && layer.feature.properties) {
                        if (layer.feature.properties.cadastral_number === cadNum) {
                            foundLayer = layer;
                        }
                    }
                });
            }
            
            if (!foundLayer && window.mapLayer) {
                window.mapLayer.eachLayer(function(layer) {
                    if (layer.feature && layer.feature.properties) {
                        if (layer.feature.properties.cadastral_number === cadNum) {
                            foundLayer = layer;
                        }
                    }
                });
            }
            
            if (foundLayer) {
                console.log(`✅ Обертка ${cadNum} найдена`);
                foundLayer.openPopup();
                if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                    if (window.mapInstance) {
                        window.mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
                    }
                }
                isUpdatingFromSearch = false;
                window._isPopupOpening = false;
                return true;
            }
            
            if (attempts < maxAttempts) {
                setTimeout(findAndOpenPopup, 300);
                return false;
            }
            
            isUpdatingFromSearch = false;
            window._isPopupOpening = false;
            return false;
        }
        
        setTimeout(findAndOpenPopup, 500);
        return;
    }
    
    console.log(`🏘️ Квартал: ${cadNum}`);
    
    const districtId = found.properties.parent_id || found.properties.district_id;
    const districtName = found.properties.district_name || districtId || 'Район';
    
    renderMapLevelWithFlag(2, districtId, true);
    updateBreadcrumb('quarter', districtId, districtName, true);
    
    window.selectedQuarterCadNumber = cadNum;
    
    setTimeout(() => {
        if (window.mapLayer) {
            let foundLayer = null;
            window.mapLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    if (layer.feature.properties.cadastral_number === cadNum) {
                        foundLayer = layer;
                    }
                }
            });
            if (foundLayer) {
                try {
                    const bounds = foundLayer.getBounds();
                    if (bounds && bounds.isValid && bounds.isValid()) {
                        if (window.mapInstance) {
                            window.mapInstance.fitBounds(bounds, { padding: [40, 40] });
                        }
                    }
                    setTimeout(() => {
                        foundLayer.openPopup();
                    }, 500);
                } catch(e) {
                    console.warn('⚠️ Ошибка:', e);
                }
            }
        }
        renderDealsTable();
        isUpdatingFromSearch = false;
        window._isPopupOpening = false;
        window._isNSPDSearch = false;
    }, 1000);
}
function searchCadastralByNumber(cadNumber) {
    if (!cadNumber) return;
    
    // Находим поле поиска НСПД
    const input = document.getElementById('cadSearchInput');
    if (input) {
        input.value = cadNumber;
        // Вызываем поиск через глобальный объект nspdApp
        if (window.nspdApp && typeof window.nspdApp.search === 'function') {
            window.nspdApp.search();
        } else {
            console.warn('⚠️ nspdApp не инициализирован');
            showNotification('НСПД не загружена, обновите страницу', 'warning');
        }
    } else {
        console.warn('⚠️ Поле cadSearchInput не найдено');
    }
}
window.searchCadastralByNumber = searchCadastralByNumber;
function renderMapLevelWithFlag(level, parentId, fromSearch = false) {
    console.log(`🔄 renderMapLevelWithFlag: level=${level}, fromSearch=${fromSearch}`);
    
    // Если это поиск и уровень 2 — пропускаем центрирование
    if (fromSearch && level === 2) {
        console.log('⏳ Пропускаем автоматическое центрирование (поиск)');
        
        // Сохраняем оригинальные setTimeout
        const originalSetTimeout = window.setTimeout;
        
        // Перехватываем вызовы centerMap через setTimeout
        window.setTimeout = function(fn, delay) {
            const fnStr = fn.toString();
            // Блокируем только вызовы centerMap
            if (fnStr.includes('centerMap') || fnStr.includes('Попытка центрирования')) {
                console.log(`⏳ Блокируем setTimeout centerMap (delay=${delay}ms)`);
                return 0; // Возвращаем таймаут, но не выполняем
            }
            // Для всех остальных вызовов — выполняем как обычно
            return originalSetTimeout.call(this, fn, delay);
        };
        
        // Вызываем renderMapLevel
        renderMapLevel(level, parentId);
        
        // Восстанавливаем setTimeout
        setTimeout(() => {
            window.setTimeout = originalSetTimeout;
            console.log('✅ setTimeout восстановлен');
        }, 100);
        
    } else {
        // Обычный вызов
        renderMapLevel(level, parentId);
    }
}
function exportDealsTableToExcel() {
    const container = document.getElementById('deals-table-container');
    if (!container) {
        console.warn('⚠️ Контейнер таблицы не найден');
        return;
    }
    
    // ✅ БЕРЁМ ВСЕ СДЕЛКИ С ФИЛЬТРАМИ, А НЕ ТОЛЬКО 100
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
        if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
        return true;
    });
    
    // ✅ СОРТИРУЕМ ПО РАЗНИЦЕ (кадастр - цена) от самой низкой к самой высокой
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
    
    // ✅ ФОРМИРУЕМ ДАННЫЕ ДЛЯ ЭКСПОРТА (ВСЕ СДЕЛКИ)
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
           'Кад. номер НСПД': deal.cad_nspd || 'nan', 
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
           'Улица': deal.street || 'nan', 
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
    
    // Автоширина колонок
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
    
    console.log(`Экспортировано ${filteredDeals.length} сделок в Excel`);
}
function closeWrapperTooltip(cadNum) {
    console.log(`🔄 Закрытие тултипа обертки: ${cadNum}`);
    
    window.selectedQuarterCadNumber = null;
    currentLevel = 0;
    currentParentId = null;
    currentDistrictFilter = null;
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            layer.closeTooltip();
        });
    }
    
    if (window.mapInstance) {
        window.mapInstance.closePopup();
    }
    
    renderMapLevel(0);
    updateBreadcrumb('okrug');
    
    updateMapStatsFromDeals(0, null);
    updateQuartersListWithFilteredObjects(null);
    updateActiveFiltersDisplay();
    addMapLegend();
    renderDealsTable();
    
    setTimeout(function() {
        if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
            if (window.mapInstance) {
                window.mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
            }
        }
    }, 100);
    
    console.log('✅ Тултип обертки закрыт, возврат на уровень округа');
}
window.initMapTab = initMapTab;
window.destroyMap = destroyMap;
window.renderMapLevel = renderMapLevel;
window.renderMapLevelWithFlag = renderMapLevelWithFlag;
window.searchQuarter = searchQuarter;
window.searchQuarterByCadNumber = searchQuarterByCadNumber; 
window.exportDealsTableToExcel = exportDealsTableToExcel;
window.onPopupClose = onPopupClose;
window.closeWrapperTooltip = closeWrapperTooltip; 
window.toggleHeatmapMode = toggleHeatmapMode;  // ✅ ДОБАВЬТЕ ЭТО
window.togglePriceFilter = togglePriceFilter; 
window.toggleCadCostFilter = toggleCadCostFilter;
window.isCadCostFilterEnabled = isCadCostFilterEnabled;
function addHeatmapLegend() {
    // Удаляем старую легенду если есть
    const oldLegend = document.querySelector('.heatmap-legend');
    if (oldLegend) oldLegend.remove();
    
    const legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.style.cssText = `
        position: absolute;
        bottom: 30px;
        left: 220px;
        background: white;
        padding: 10px 14px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        font-size: 10px;
        font-family: 'Inter', sans-serif;
        z-index: 1000;
        border: 1px solid #e2e8f0;
        min-width: 140px;
    `;
    
legend.innerHTML = `
    <div style="font-weight:600; font-size:10px; color:#475569; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.5px;">
        🌡️ УПРС vs УПКС
    </div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
        <span style="display:inline-block; width:18px; height:12px; border-radius:3px; background:#22c55e;"></span>
        <span style="color:#475569; font-size:9px;">УПРС &gt; УПКС (+20%)</span>
    </div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
        <span style="display:inline-block; width:18px; height:12px; border-radius:3px; background:#84cc16;"></span>
        <span style="color:#475569; font-size:9px;">УПРС &gt; УПКС (+5-20%)</span>
    </div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
        <span style="display:inline-block; width:18px; height:12px; border-radius:3px; background:#eab308;"></span>
        <span style="color:#475569; font-size:9px;">УПРС ≈ УПКС (±5%)</span>
    </div>
    <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
        <span style="display:inline-block; width:18px; height:12px; border-radius:3px; background:#f97316;"></span>
        <span style="color:#475569; font-size:9px;">УПРС &lt; УПКС (5-30%)</span>
    </div>
    <div style="display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:18px; height:12px; border-radius:3px; background:#ef4444;"></span>
        <span style="color:#475569; font-size:9px;">УПРС &lt; УПКС (&gt;30%)</span>
    </div>
`;
    
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(legend);
    }
}
function loadScript(src) {
    return new Promise((resolve, reject) => {
        // Проверяем, загружен ли уже скрипт
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            console.log(`✅ Скрипт уже загружен: ${src}`);
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            console.log(`✅ Скрипт загружен: ${src}`);
            resolve();
        };
        script.onerror = () => {
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.head.appendChild(script);
    });
}
async function generateReport() {
    console.log('📄 Генерация отчета...');

    try {
        let docxModule = null;
        try {
            docxModule = await import('https://cdn.jsdelivr.net/npm/docx@8.2.2/build/index.js');
        } catch(e) {
            try {
                docxModule = await import('https://unpkg.com/docx@8.2.2/build/index.js');
            } catch(e2) {
                showNotification('❌ Не удалось загрузить библиотеку', 'error');
                return;
            }
        }
        
        const { 
            Document, Packer, Paragraph, TextRun, AlignmentType, 
            Table, TableRow, TableCell, BorderStyle, WidthType, 
            ImageRun, Header, Footer, PageNumber
        } = docxModule;

        // ============================================================
        // ДАННЫЕ
        // ============================================================
        const levelNames = { 0: 'Округ', 1: 'Район', 2: 'Кварталы' };
        const currentLevelName = levelNames[currentLevel] || '—';
        const statMedian = document.getElementById('stat-median')?.textContent || '—';
        const statMinMax = document.getElementById('stat-minmax')?.textContent || '—';
        const statUprs = document.getElementById('stat-uprs')?.textContent || '—';
        const statUpks = document.getElementById('stat-upks')?.textContent || '—';
        const statTotalDeals = document.getElementById('stat-total-deals')?.textContent || '0';
        const statCadCost = document.getElementById('stat-cadcost')?.textContent || '—';
        const statObjects = document.getElementById('stat-objects')?.textContent || '0';
        const statWithDeals = document.getElementById('stat-with-deals')?.textContent || '0';
        const filtersText = document.getElementById('active-filters-list')?.textContent || 'все';
        const filterDetails = filtersText !== '—' ? filtersText : 'нет';
        
        // ✅ ПОЛУЧАЕМ НАЗВАНИЕ РАЙОНА
        let districtName = '—';
        const breadcrumb = document.getElementById('map-breadcrumb');
        if (breadcrumb) {
            const spans = breadcrumb.querySelectorAll('span');
            if (spans.length >= 2) {
                districtName = spans[spans.length - 1].textContent.trim();
            }
        }

        // ✅ ВЫЧИСЛЯЕМ РАЗНИЦУ МЕЖДУ УПРС И УПКС
        let uprsNum = parseFloat(String(statUprs).replace(/[^\d.,-]/g, '').replace(',', '.'));
        let upksNum = parseFloat(String(statUpks).replace(/[^\d.,-]/g, '').replace(',', '.'));
        
        let diffAbs = '—';
        let diffPercent = '—';
        
        if (!isNaN(uprsNum) && !isNaN(upksNum) && uprsNum > 0 && upksNum > 0) {
            const diff = uprsNum - upksNum;
            diffAbs = diff.toFixed(2) + ' ₽/м²';
            diffPercent = ((diff / upksNum) * 100).toFixed(1) + '%';
        }

        // ============================================================
        // ЗАГРУЗКА ИЗОБРАЖЕНИЯ
        // ============================================================
        async function loadImageAsArrayBuffer(url) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = this.width;
                        canvas.height = this.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(this, 0, 0);
                        canvas.toBlob(function(blob) {
                            if (blob) {
                                blob.arrayBuffer().then(resolve).catch(reject);
                            } else {
                                reject(new Error('Failed to create blob'));
                            }
                        }, 'image/webp', 0.95);
                    } catch(e) {
                        reject(e);
                    }
                };
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = url;
            });
        }

        const logoUrl = './images/logo-mfc.webp';
        let logoImageData = null;
        try {
            logoImageData = await loadImageAsArrayBuffer(logoUrl);
        } catch(e) {}

        // ============================================================
        // ФУНКЦИЯ ДЛЯ ЯЧЕЕК (ЧЁРНЫЙ ЦВЕТ)
        // ============================================================
        function makeCell(text, size = 14, bold = false, color = '1e293b', align = AlignmentType.CENTER, width = 25) {
            const p = new Paragraph({
                children: [new TextRun({ 
                    text: String(text), 
                    size: size, 
                    bold: bold, 
                    color: color,
                    font: 'Arial' 
                })],
                alignment: align,
                spacing: { after: 0 }
            });
            const cell = new TableCell({
                children: [p],
                width: { size: width, type: WidthType.PERCENTAGE },
                verticalAlign: 'center',
            });
            cell.borders = {
                top: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
                left: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
                right: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
            };
            return cell;
        }

        // ============================================================
        // ДОКУМЕНТ
        // ============================================================
        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
                    }
                },
                headers: {
                    default: new Header({
                        children: [
                            new Paragraph({
                                children: [
                                    ...(logoImageData ? [
                                        new ImageRun({ 
                                            data: logoImageData, 
                                            transformation: { width: 100, height: 75 },
                                            type: 'image/webp' 
                                        })
                                    ] : []),
                                    new TextRun({ 
                                        text: '   Отдел ГКО • База знаний', 
                                        size: 16, 
                                        color: '94a3b8', 
                                        font: 'Arial' 
                                    }),
                                ],
                                alignment: AlignmentType.RIGHT,
                                spacing: { after: 60 },
                                border: { 
                                    bottom: { 
                                        style: BorderStyle.SINGLE, 
                                        size: 1, 
                                        color: 'e2e8f0' 
                                    } 
                                }
                            })
                        ]
                    })
                },
                footers: {
                    default: new Footer({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'Страница ', size: 12, color: '94a3b8', font: 'Arial' }),
                                    new TextRun({ children: [PageNumber.CURRENT], size: 12, color: '94a3b8', font: 'Arial' }),
                                    new TextRun({ text: ` • ${new Date().toLocaleDateString('ru-RU')}`, size: 12, color: '94a3b8', font: 'Arial' })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { before: 60 },
                                border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' } }
                            })
                        ]
                    })
                },
                children: [
                    // ==========================================================
                    // ЗАГОЛОВОК
                    // ==========================================================
                    new Paragraph({
                        children: [new TextRun({ text: 'АНАЛИТИЧЕСКАЯ ЗАПИСКА', size: 32, bold: true, color: '1e293b', font: 'Arial' })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 250 }
                    }),

                    // ==========================================================
                    // 1. ИНФОРМАЦИЯ ОБ ОТЧЕТЕ
                    // ==========================================================
                    new Paragraph({
                        children: [new TextRun({ text: '1. Информация об отчете', size: 20, bold: true, color: '1e293b', font: 'Arial' })],
                        spacing: { after: 150 }
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    makeCell('Уровень', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(currentLevelName, 20, true, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell('Фильтры', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(filterDetails, 18, true, '1e293b', AlignmentType.CENTER, 25),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    makeCell('Район', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(districtName, 20, true, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell('Дата', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(new Date().toLocaleDateString('ru-RU'), 20, true, '1e293b', AlignmentType.CENTER, 25),
                                ]
                            }),
                        ]
                    }),

                    new Paragraph({ spacing: { after: 300 } }),

                    // ==========================================================
                    // 2. СТАТИСТИКА СДЕЛОК
                    // ==========================================================
                    new Paragraph({
                        children: [new TextRun({ text: '2. Статистика сделок', size: 20, bold: true, color: '1e293b', font: 'Arial' })],
                        spacing: { after: 150 }
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        rows: [
                            new TableRow({
                                children: [
                                    makeCell('Медианная цена', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(statMedian, 22, true, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell('УПРС (медиана)', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(statUprs, 22, true, '1e293b', AlignmentType.CENTER, 25),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    makeCell('Кад. стоимость (медиана)', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(statCadCost, 22, true, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell('УПКС (медиана)', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(statUpks, 22, true, '1e293b', AlignmentType.CENTER, 25),
                                ]
                            }),
                            new TableRow({
                                children: [
                                    makeCell('Всего сделок', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(statTotalDeals, 22, true, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell('Мин / Макс', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(statMinMax, 20, true, '1e293b', AlignmentType.CENTER, 25),
                                ]
                            }),
                            // ✅ НОВАЯ СТРОКА: РАЗНИЦА МЕЖДУ УПРС И УПКС
                            new TableRow({
                                children: [
                                    makeCell('Разница УПРС - УПКС', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(diffAbs, 20, true, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell('Разница (%)', 14, false, '1e293b', AlignmentType.CENTER, 25),
                                    makeCell(diffPercent, 20, true, '1e293b', AlignmentType.CENTER, 25),
                                ]
                            }),
                        ]
                    }),

                    new Paragraph({ spacing: { after: 350 } }),

                    // ==========================================================
                    // РЕЗУЛЬТАТ
                    // ==========================================================
                    new Paragraph({
                        children: [new TextRun({ text: 'РЕЗУЛЬТАТ', size: 24, bold: true, color: '1e293b', font: 'Arial' })],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 80 }
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({ text: '• ', size: 20, bold: false, color: '1e293b', font: 'Arial' }),
                            new TextRun({ text: `УПРС = ${statUprs}`, size: 20, bold: true, color: '1e293b', font: 'Arial' })
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 20 }
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({ text: '• ', size: 20, bold: false, color: '1e293b', font: 'Arial' }),
                            new TextRun({ text: `УПКС = ${statUpks}`, size: 20, bold: true, color: '1e293b', font: 'Arial' })
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 20 }
                    }),

                    // ✅ НОВАЯ СТРОКА: РАЗНИЦА В РЕЗУЛЬТАТЕ
                    new Paragraph({
                        children: [
                            new TextRun({ text: '• ', size: 20, bold: false, color: '1e293b', font: 'Arial' }),
                            new TextRun({ text: `Разница = ${diffAbs} (${diffPercent})`, size: 20, bold: true, color: '1e293b', font: 'Arial' })
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 200 }
                    }),
                ]
            }]
        });

        // ============================================================
        // СОХРАНЕНИЕ
        // ============================================================
        showNotification('📄 Формирование...', 'info');
        const blob = await Packer.toBlob(doc);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Отчет_${new Date().toISOString().split('T')[0]}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showNotification('✅ Готово!', 'success');

    } catch (error) {
        console.error('❌ Ошибка:', error);
        showNotification('❌ Ошибка: ' + error.message, 'error');
    }
}
window.generateReport = generateReport;
window.loadScript = loadScript;
window.generateDocxReport = generateReport;
// ✅ ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ КВАРТАЛА ИЗ КАДАСТРОВОГО НОМЕРА
function getQuarter(cadNumber) {
    if (!cadNumber) return '';
    
    cadNumber = cadNumber.trim();
    const parts = cadNumber.split(':');
    
    // Если 3 части — это уже квартал
    if (parts.length === 3) {
        // Проверяем, что все части не пустые
        if (parts.every(p => p.length > 0)) {
            return cadNumber;
        }
    }
    
    // Если 4+ части — берем первые 3
    if (parts.length >= 4) {
        const quarter = parts.slice(0, 3).join(':');
        // Проверяем, что получился валидный квартал
        if (quarter.length >= 10) {
            return quarter;
        }
    }
    
    // Если ничего не подошло — пытаемся взять первые 11 символов
    // (но только если это похоже на кадастровый номер)
    const first11 = cadNumber.slice(0, 11);
    if (first11.match(/^\d{2}:\d{2}:\d{6}$/)) {
        return first11;
    }
    
    return cadNumber;
}
async function searchNSPD(quarter, targetArea, targetType, locationKeywords = [], tolerance = 0.1, signal = null) {
    console.log(`🔍 Поиск в НСПД: ${quarter}, площадь ${targetArea} ±${tolerance} м², тип ${targetType}`);
    if (locationKeywords && locationKeywords.length > 0) {
        console.log(`📍 Локация: ${locationKeywords}`);
        console.log(`📍 Улица: ${locationKeywords[1] || 'не указана'}`);
    }
    console.log('-'.repeat(60));
    
    const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=1000`;
    
    const headers = {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        let abortHandler = null;
        if (signal) {
            abortHandler = function() {
                console.log('⛔ Отмена запроса к НСПД');
                controller.abort();
            };
            signal.addEventListener('abort', abortHandler);
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        if (abortHandler && signal) {
            signal.removeEventListener('abort', abortHandler);
        }
        
        if (!response.ok) {
            console.warn(`⚠️ Ошибка запроса к НСПД: ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const features = data?.data?.features || [];
        
        console.log(`📥 Найдено объектов в квартале: ${features.length}`);
        console.log('-'.repeat(60));
        
        if (features.length === 0) {
            console.warn(`⚠️ Нет объектов в квартале ${quarter}`);
            return null;
        }
        
        // ✅ НОРМАЛИЗУЕМ УЛИЦУ ИЗ СДЕЛКИ
        const dealStreet = locationKeywords && locationKeywords.length > 1 ? locationKeywords[1] : '';
        const normalizedDealStreet = normalizeStreet(dealStreet);
        const dealCity = locationKeywords && locationKeywords.length > 0 ? locationKeywords[0] : '';
        const hasStreet = normalizedDealStreet && 
                  normalizedDealStreet !== '' && 
                  normalizedDealStreet !== 'nan' &&
                  !/^\d+$/.test(normalizedDealStreet) &&
                  !/^\d+\s/.test(normalizedDealStreet);
        
        console.log(`🏠 Улица из сделки: "${normalizedDealStreet}" ${hasStreet ? '(есть)' : '(пустая)'}`);
        
        // ✅ СОБИРАЕМ ВСЕ ОБЪЕКТЫ С МЕТАДАННЫМИ
        let allObjects = [];
        
        for (const f of features) {
            const props = f.properties || {};
            const opts = props.options || {};
            
            const cad = opts.cad_number || props.externalKey || '';
            const cadQuarter = getQuarter(cad);
            
            // Проверяем квартал
            if (cadQuarter !== quarter) {
                continue;
            }
            
            const objType = opts.type || opts.object_type_value || opts.land_record_type || props.categoryName || '';
            
            // ✅ ИЗВЛЕКАЕМ ПЛОЩАДЬ (из разных полей)
            let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                       parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
            
            // ✅ ИЗВЛЕКАЕМ ПРОТЯЖЕННОСТЬ (для сооружений)
            let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
            
            // ✅ ЕСЛИ ПЛОЩАДЬ = 0, НО ЕСТЬ ПРОТЯЖЕННОСТЬ - ИСПОЛЬЗУЕМ ПРОТЯЖЕННОСТЬ
            if (area === 0 && extension > 0) {
                area = extension;
                console.log(`🔧 Объект ${cad}: площадь заменена на протяженность ${extension} м`);
            }
            
            const name = opts.params_name || opts.name || opts.building_name || '';
            const address = opts.readable_address || opts.address_readable_address || '';
            
            // ✅ ИЗВЛЕКАЕМ И НОРМАЛИЗУЕМ УЛИЦУ ИЗ АДРЕСА НСПД
            const nspdStreet = normalizeStreet(extractStreetFromAddress(address));
            
            // Проверяем совпадения
            function getTypeAliases(type) {
                const map = {
                    'помещение': ['помещение', 'квартира', 'нежилое', 'жилое'],
                    'квартира': ['квартира', 'помещение', 'жилое'],
                    'здание': ['здание', 'строение', 'сооружение'],
                    'сооружение': ['сооружение', 'здание', 'строение']
                };
                const key = type.toLowerCase().slice(0, 5);
                const aliases = map[key] || [type.toLowerCase()];
                const exact = type.toLowerCase();
                if (!aliases.includes(exact)) {
                    aliases.unshift(exact);
                }
                return aliases.concat(aliases.map(a => a.slice(0, 5)));
            }

            const typeAliases = getTypeAliases(targetType);
            const typeMatch = typeAliases.some(alias => 
                objType.toLowerCase().includes(alias)
            );
            
            // ✅ ПРОВЕРКА ПЛОЩАДИ / ПРОТЯЖЕННОСТИ (допуск ±0.1 м²)
            let areaMatch = false;
            let areaDiff = 0;
            
            // Если это сооружение и есть протяженность - проверяем по протяженности
            const isStructure = objType.toLowerCase().includes('сооружение');
            if (isStructure && extension > 0) {
                areaDiff = Math.abs(extension - targetArea);
                areaMatch = areaDiff <= tolerance;
                if (areaMatch) {
                    console.log(`🔧 Объект ${cad}: совпадение по протяженности ${extension} м (цель ${targetArea} м, разница ${areaDiff.toFixed(2)})`);
                }
            } else {
                // Обычная проверка по площади
                areaDiff = Math.abs(area - targetArea);
                areaMatch = areaDiff <= tolerance;
                if (areaMatch) {
                    console.log(`📐 Объект ${cad}: совпадение по площади ${area} м² (цель ${targetArea} м², разница ${areaDiff.toFixed(2)})`);
                }
            }
            
            // ✅ СТРИТМЭТЧ - нормализованное сравнение (только если улица есть)
            let streetMatch = false;
            if (hasStreet && nspdStreet) {
                // 1. Точное совпадение
                streetMatch = normalizedDealStreet === nspdStreet;
                
                // 2. Частичное совпадение (минимум 3 символа)
                if (!streetMatch) {
                    const minLen = Math.min(normalizedDealStreet.length, nspdStreet.length);
                    if (minLen >= 3) {
                        streetMatch = normalizedDealStreet.includes(nspdStreet) || 
                                      nspdStreet.includes(normalizedDealStreet);
                    }
                }
                
                // 3. Совпадение по корню слова
                if (!streetMatch) {
                    const dealRoot = getStreetRoot(normalizedDealStreet);
                    const nspdRoot = getStreetRoot(nspdStreet);
                    if (dealRoot && nspdRoot) {
                        streetMatch = dealRoot === nspdRoot || 
                                      dealRoot.includes(nspdRoot) || 
                                      nspdRoot.includes(dealRoot);
                    }
                }
            }
            
            // ✅ ЛОКАЦИЯ (город)
            let locMatch = false;
            if (dealCity) {
                const text = `${name} ${address}`.toLowerCase();
                locMatch = text.includes(dealCity.toLowerCase());
            }
            
            allObjects.push({
                cad: cad,
                type: objType,
                area: area,
                extension: extension,
                areaDiff: areaDiff,
                isStructure: isStructure,
                name: name,
                address: address,
                nspdStreet: nspdStreet,
                typeMatch: typeMatch,
                areaMatch: areaMatch,
                locMatch: locMatch,
                streetMatch: streetMatch
            });
        }
        
        // ✅ ФИЛЬТРУЕМ ТОЛЬКО ОБЪЕКТЫ С ПОДХОДЯЩЕЙ ПЛОЩАДЬЮ (допуск ±0.1 м²)
        const matchedObjects = allObjects.filter(obj => obj.areaMatch === true);
        console.log(`📊 Объектов с подходящей площадью (допуск ±${tolerance} м²): ${matchedObjects.length}`);
        
        if (matchedObjects.length === 0) {
            console.log(`❌ Нет объектов с площадью ${targetArea} ±${tolerance} м²`);
            return null;
        }
        
        // Сортируем по минимальной разнице площади
        matchedObjects.sort((a, b) => a.areaDiff - b.areaDiff);
        
        console.log(`📊 Всего объектов с подходящей площадью: ${matchedObjects.length}`);
        console.log(`   Лучшая разница: ${matchedObjects[0].areaDiff.toFixed(2)} м²`);
        
        // ============================================================
        // ✅ КАСКАДНЫЙ ПОИСК (среди объектов с подходящей площадью!)
        // ============================================================
        
        // 1️⃣ квартал + тип + площадь + улица
        let candidates = matchedObjects.filter(obj => 
            obj.typeMatch && obj.streetMatch
        );
        
        if (candidates.length > 0) {
            // Сортируем по минимальной разнице площади
            candidates.sort((a, b) => a.areaDiff - b.areaDiff);
            const best = candidates[0];
            console.log(`\n✅ 1️⃣ (квартал+тип+площадь+улица): ${best.cad} (${best.area} м², разница ${best.areaDiff.toFixed(2)})`);
            console.log(`   Улица НСПД: "${best.nspdStreet}"`);
            console.log(`   Адрес: ${best.address.slice(0, 60)}...`);
            return best.cad;
        }
        
        // ============================================================
        // 🔥 ГЛАВНОЕ ПРАВИЛО: ЕСЛИ УЛИЦА ЕСТЬ В СДЕЛКЕ - НЕ ПЕРЕХОДИМ ДАЛЬШЕ!
        // ============================================================
        if (hasStreet) {
            console.log(`\n⛔ Улица "${normalizedDealStreet}" есть в сделке, но не совпала с объектами НСПД`);
            console.log(`🔍 Пробуем найти по кварталу + площади + городу + улице (без типа)...`);
            
            // ДОПОЛНИТЕЛЬНЫЙ ПОИСК: квартал + площадь + город + улица (БЕЗ ТИПА)
            let candidatesNoType = matchedObjects.filter(obj => 
                obj.locMatch && obj.streetMatch
            );
            
            if (candidatesNoType.length > 0) {
                candidatesNoType.sort((a, b) => a.areaDiff - b.areaDiff);
                const best = candidatesNoType[0];
                console.log(`\n✅ (квартал+площадь+город+улица, без типа): ${best.cad} (${best.area} м², разница ${best.areaDiff.toFixed(2)})`);
                console.log(`   Улица НСПД: "${best.nspdStreet}"`);
                console.log(`   Адрес: ${best.address.slice(0, 60)}...`);
                console.log(`   ⚠️ ВНИМАНИЕ: Поиск без проверки типа!`);
                return best.cad;
            }
            
            console.log(`❌ Объект НЕ НАЙДЕН — пропускаем (не подменяем улицу!)`);
            return null;
        }
        
        // ✅ ТОЛЬКО ЕСЛИ УЛИЦА В СДЕЛКЕ ПУСТАЯ (nan) — ИЩЕМ ПО ГОРОДУ
        console.log(`\n📍 Улица в сделке пустая (nan), ищем по городу...`);
        
        // 2️⃣ квартал + тип + площадь + город
        candidates = matchedObjects.filter(obj => 
            obj.typeMatch && obj.locMatch
        );
        
        if (candidates.length > 0) {
            candidates.sort((a, b) => a.areaDiff - b.areaDiff);
            const best = candidates[0];
            console.log(`\n✅ 2️⃣ (квартал+тип+площадь+город): ${best.cad} (${best.area} м², разница ${best.areaDiff.toFixed(2)})`);
            console.log(`   Улица НСПД: "${best.nspdStreet}"`);
            console.log(`   Адрес: ${best.address.slice(0, 60)}...`);
            console.log(`   ℹ️ Улица в сделке была пустая, ищем по городу`);
            return best.cad;
        }
        
        // 3️⃣ квартал + тип + площадь
        candidates = matchedObjects.filter(obj => 
            obj.typeMatch
        );
        
        if (candidates.length > 0) {
            candidates.sort((a, b) => a.areaDiff - b.areaDiff);
            const best = candidates[0];
            console.log(`\n✅ 3️⃣ (квартал+тип+площадь): ${best.cad} (${best.area} м², разница ${best.areaDiff.toFixed(2)})`);
            console.log(`   Улица НСПД: "${best.nspdStreet}"`);
            console.log(`   Адрес: ${best.address.slice(0, 60)}...`);
            console.log(`   ⚠️ ВНИМАНИЕ: Без проверки локации!`);
            return best.cad;
        }
        
        // 4️⃣ квартал + площадь
        candidates = matchedObjects;
        
        if (candidates.length > 0) {
            candidates.sort((a, b) => a.areaDiff - b.areaDiff);
            const best = candidates[0];
            console.log(`\n✅ 4️⃣ (квартал+площадь): ${best.cad} (${best.area} м², разница ${best.areaDiff.toFixed(2)})`);
            console.log(`   Улица НСПД: "${best.nspdStreet}"`);
            console.log(`   Адрес: ${best.address.slice(0, 60)}...`);
            console.log(`   ⚠️ ВНИМАНИЕ: Без проверки типа и локации!`);
            return best.cad;
        }
        
        // 5️⃣ поиск по номеру дома
        const dealHouse = extractHouseNumber(locationKeywords.join(' '));
        if (dealHouse) {
            const houseCandidates = matchedObjects.filter(obj => {
                const nspdHouse = extractHouseNumber(obj.address);
                return nspdHouse && nspdHouse === dealHouse;
            });
            
            if (houseCandidates.length > 0) {
                houseCandidates.sort((a, b) => a.areaDiff - b.areaDiff);
                const best = houseCandidates[0];
                console.log(`\n✅ 5️⃣ (квартал+площадь+дом): ${best.cad} (${best.area} м², разница ${best.areaDiff.toFixed(2)}, дом ${dealHouse})`);
                console.log(`   Улица НСПД: "${best.nspdStreet}"`);
                console.log(`   Адрес: ${best.address.slice(0, 60)}...`);
                console.log(`   ⚠️ ВНИМАНИЕ: Поиск по номеру дома (без проверки улицы)!`);
                return best.cad;
            }
        }
        
        console.log('\n❌ НЕТ ПОДХОДЯЩИХ ОБЪЕКТОВ');
        return null;
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`⏰ Запрос прерван для ${quarter}`);
            return null;
        }
        console.error(`❌ Ошибка запроса к НСПД:`, error);
        return null;
    }
}
async function loadDealsFromRelease() {
    const HARDCODED_GIST_ID = '9f6e65a18e94b61a6b7a96389e9109c5';
    
    console.log(`📥 Загрузка CSV из Gist: ${HARDCODED_GIST_ID}`);
    try {
        const response = await fetch(`https://api.github.com/gists/${HARDCODED_GIST_ID}`, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            const file = data.files?.['deals_clean.csv'];
            if (file && file.content) {
                localStorage.setItem('deals_csv_gist_url', file.raw_url);
                localStorage.setItem('deals_csv_gist_id', HARDCODED_GIST_ID);
                console.log(`✅ CSV загружен из Gist: ${HARDCODED_GIST_ID}`);
                return file.content;
            }
        } else if (response.status === 404) {
            console.warn(`⚠️ Gist ${HARDCODED_GIST_ID} не найден (404)`);
        }
    } catch(e) {
        console.warn('⚠️ Ошибка загрузки Gist:', e.message);
    }
    
    return null;
}
function refreshCSVFromGist() {
    const token = prompt('Введите GitHub Token для обновления CSV из Gist:');
    if (!token || !token.trim()) {
        showNotification('⚠️ Токен не введен', 'warning');
        return;
    }
    
    const gistId = localStorage.getItem('deals_csv_gist_id');
    if (!gistId) {
        showNotification('⚠️ Нет сохраненного Gist ID', 'warning');
        return;
    }
    
    showNotification('🔄 Загрузка номеров НСПД из Gist...', 'info');
    
    fetch(`https://api.github.com/gists/${gistId}`, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    })
    .then(data => {
        const file = data.files?.['deals_clean.csv'];
        if (file && file.content) {
            console.log('📥 Загрузка номеров НСПД из Gist...');
            
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
            
            const csvContent = file.content;
            const lines = csvContent.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                showNotification('❌ CSV пустой', 'error');
                return;
            }
            
            const headers = parseCSVLine(lines[0]);
            // ✅ Ищем row_id вместо cad_number
            const rowIdIndex = headers.indexOf('row_id');
            const nspdIndex = headers.indexOf('cad_nspd');
            
            if (rowIdIndex === -1 || nspdIndex === -1) {
                showNotification('❌ В CSV нет столбцов row_id или cad_nspd', 'error');
                return;
            }
            
            // ✅ Собираем номера НСПД по row_id
            const nspdMap = {};
            let foundCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length < Math.max(rowIdIndex, nspdIndex) + 1) continue;
                
                const rowId = values[rowIdIndex] || '';
                const cadNspd = values[nspdIndex] && values[nspdIndex].trim() !== '' 
                    ? values[nspdIndex].trim() 
                    : null;
                
                if (rowId && cadNspd) {
                    nspdMap[rowId] = cadNspd;
                    foundCount++;
                }
            }
            
            console.log(`📊 Найдено ${foundCount} связей row_id → cad_nspd в Gist`);
            
            // ✅ Обновляем ТОЛЬКО cad_nspd по row_id
            let updatedCount = 0;
            for (const deal of allDealsFlat) {
                if (deal.row_id && nspdMap[deal.row_id]) {
                    deal.cad_nspd = nspdMap[deal.row_id];
                    updatedCount++;
                }
            }
            
            console.log(`✅ Обновлено ${updatedCount} сделок номерами НСПД из Gist`);
            console.log(`✅ Все остальные данные (quarter, prices, etc.) остались без изменений`);
            
            // ✅ Обновляем таблицу
            if (typeof renderDealsTable === 'function') {
                renderDealsTable();
            }
            
            if (typeof updateTableFull === 'function') {
                updateTableFull();
            }
            
            showNotification(`✅ Загружено ${foundCount} связей, обновлено ${updatedCount} сделок`, 'success');
            
        } else {
            showNotification('❌ Файл не найден в Gist', 'error');
        }
    })
    .catch(error => {
        console.error('❌ Ошибка:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    });
}
async function createCSVFromData() {
const headers = [
    'cad_number', 'area', 'purpose_text', 'cad_cost', 'upks', 'uprs',
    'city', 'deal_kind_text', 'obj_kind_text', 'vri', 'quarter',
    'year_build', 'wall_material_name', 'deal_price_rub', 'uprs_rub',
    'floor', 'location', 'street', 'cad_nspd', 'number'
];
    
    const rows = [headers.join(',')];
    for (const deal of allDealsFlat) {
        const row = headers.map(h => {
            let val = deal[h] !== undefined && deal[h] !== null && deal[h] !== '' ? deal[h] : 'nan';
            if (typeof val === 'number') val = String(val);
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        rows.push(row.join(','));
    }
    return rows.join('\n');
}
window.abortSyncWithNSPD = function() {
    if (syncAbortController) {
        console.log('🛑 Прерывание синхронизации...');
        syncAbortController.abort();
        syncAbortController = null;
        
        const btn = document.querySelector('button[onclick="syncWithNSPD()"]');
        if (btn) {
            btn.innerHTML = '🔄 Синхронизация прервана';
            btn.style.background = '#ef4444';
            btn.style.color = 'white';
            setTimeout(() => {
                btn.innerHTML = 'Синхронизация с НСПД';
                btn.style.background = '#2563eb';
                btn.style.color = 'white';
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }, 2000);
        }
        
        showNotification('⛔ Синхронизация прервана', 'warning');
        isSyncRunning = false;
    }
};

async function syncWithNSPD() {
    // ✅ ЕСЛИ СИНХРОНИЗАЦИЯ УЖЕ ЗАПУЩЕНА - НЕ ЗАПУСКАЕМ НОВУЮ
    if (isSyncRunning) {
        showNotification('⚠️ Синхронизация уже выполняется', 'warning');
        return;
    }
    
    console.log('🔄 НАЧАЛО СИНХРОНИЗАЦИИ С НСПД');
    isSyncRunning = true;
    
    // Проверяем, есть ли данные
    if (typeof allDealsFlat === 'undefined' || allDealsFlat.length === 0) {
        showNotification('⚠️ Нет данных для синхронизации', 'warning');
        isSyncRunning = false;
        return;
    }
    
   let clearedCount = 0;
for (const deal of allDealsFlat) {
    if (!deal.cad_nspd) continue;
    
    // ✅ ПРОПУСКАЕМ "не определено" - НЕ ОЧИЩАЕМ!
    if (deal.cad_nspd === 'не определено') continue;
    
    const dealQuarter = getQuarter(deal.cad_number);
    const nspdQuarter = getQuarter(deal.cad_nspd);
    
    // Если кварталы НЕ совпадают — очищаем (это чужой объект)
    if (dealQuarter && nspdQuarter && dealQuarter !== nspdQuarter) {
        deal.cad_nspd = null;
        clearedCount++;
        console.log(`🧹 Очищен: ${deal.cad_number} (было ${deal.cad_nspd} из ${nspdQuarter}, нужно ${dealQuarter})`);
    }
}
console.log(`🧹 Очищено ${clearedCount} неправильных cad_nspd`);
    
    // Показываем индикатор загрузки
    const btn = document.querySelector('button[onclick="syncWithNSPD()"]');
    const originalHTML = btn?.innerHTML || 'Синхронизация с НСПД';
    
    // ✅ СОЗДАЕМ КНОПКУ ПРЕРЫВАНИЯ
    const syncContainer = btn?.parentElement;
    let abortBtn = document.getElementById('abort-sync-btn');
    
    if (btn) {
        btn.innerHTML = '⏳ Синхронизация... 0%';
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'wait';
        btn.style.background = '#2563eb';
        
        if (!abortBtn && syncContainer) {
            abortBtn = document.createElement('button');
            abortBtn.id = 'abort-sync-btn';
            abortBtn.innerHTML = '⛔ Остановить';
            abortBtn.style.cssText = `
                padding: 4px 14px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Inter', sans-serif;
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: 8px;
            `;
            abortBtn.onmouseover = function() { this.style.background = '#dc2626'; };
            abortBtn.onmouseout = function() { this.style.background = '#ef4444'; };
            abortBtn.onclick = function() {
                if (confirm('Остановить синхронизацию? Будет сохранен текущий прогресс.')) {
                    window.abortSyncWithNSPD();
                }
            };
            syncContainer.appendChild(abortBtn);
        }
    }
    
    // ✅ СЧИТАЕМ СКОЛЬКО УЖЕ ЕСТЬ ЗАПОЛНЕННЫХ (ПРАВИЛЬНЫХ)
    let alreadyFilled = 0;
    for (const deal of allDealsFlat) {
        if (deal.cad_nspd) alreadyFilled++;
    }
    console.log(`📊 Уже заполнено (правильных): ${alreadyFilled} объектов`);
    
    // ================================================================
    // ✅ ТЕПЕРЬ СОБИРАЕМ УНИКАЛЬНЫЕ ОБЪЕКТЫ (только с пустым cad_nspd)
    // ================================================================
    const uniqueObjects = [];

for (const deal of allDealsFlat) {
    if (deal.cad_nspd && deal.cad_nspd !== 'не определено') continue;

    if (deal.cad_nspd === 'не определено') continue;
    
    const quarter = getQuarter(deal.cad_number);
    if (!quarter || quarter === 'nan' || quarter === 'NaN') continue;
    
    const area = deal.area || 0;
    if (area <= 0) continue;
    
    const objType = deal.obj_kind_text || 'Здание';
    const location = deal.city || '';
    
    // ✅ ИЗВЛЕКАЕМ УЛИЦУ ИЗ СДЕЛКИ
    const street = deal.street || extractStreetFromAddress(deal.location || '');
    
    // ✅ ДОБАВЛЯЕМ КАЖДЫЙ ОБЪЕКТ (БЕЗ ГРУППИРОВКИ!)
    uniqueObjects.push({
        row_id: deal.row_id,           // ← СОХРАНЯЕМ row_id
        quarter: quarter,
        area: area,
        type: objType,
        location: location,
        locationKeywords: [location, street].filter(Boolean)
    });
}
    
    console.log(`📊 Уникальных объектов для поиска: ${uniqueObjects.length}`);
    console.log(`📊 Всего объектов в базе: ${allDealsFlat.length}`);
    
    if (uniqueObjects.length === 0) {
        showNotification('✅ Все объекты уже синхронизированы', 'success');
        if (btn) {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.background = '#2563eb';
        }
        if (abortBtn) abortBtn.remove();
        isSyncRunning = false;
        return;
    }
    
    let foundCount = 0;
    let totalProcessed = 0;
    let wasAborted = false;
    
    // ✅ СОЗДАЕМ AbortController ДЛЯ ПРЕРЫВАНИЯ
    syncAbortController = new AbortController();
    
    // Обрабатываем с задержкой, чтобы не перегружать API
     const concurrencyLimit = 3;
    const chunks = [];
    
    // Разбиваем на чанки по 3 объекта
    for (let i = 0; i < uniqueObjects.length; i += concurrencyLimit) {
        chunks.push(uniqueObjects.slice(i, i + concurrencyLimit));
    }
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        if (syncAbortController === null) {
            console.log('⛔ Синхронизация прервана пользователем (controller = null)');
            wasAborted = true;
            break;
        }
        
        if (syncAbortController.signal.aborted) {
            console.log('⛔ Синхронизация прервана пользователем (signal.aborted)');
            wasAborted = true;
            break;
        }
        
const promises = chunk.map(async (obj) => {
    if (syncAbortController === null || syncAbortController.signal.aborted) {
        return null;
    }
    
    const controllerSignal = syncAbortController ? syncAbortController.signal : null;
    
    console.log(`[${totalProcessed + 1}/${uniqueObjects.length}] Поиск: ${obj.quarter}, ${obj.area} м², ${obj.type}`);
    
    // ✅ ИЗМЕНЕНО: допуск 0.1 м² (было 1)
    const cadNspd = await searchNSPD(
        obj.quarter,
        obj.area,
        obj.type,
        obj.locationKeywords,
        0.1,  // ← ДОПУСК 10 СМ
        controllerSignal
    );
    
    if (syncAbortController === null || syncAbortController.signal.aborted) {
        return null;
    }
    
    // ✅ СОХРАНЯЕМ РЕЗУЛЬТАТ (найден или нет)
    let saved = false;
    for (const deal of allDealsFlat) {
        if (deal.row_id === obj.row_id) {
            if (cadNspd) {
                deal.cad_nspd = cadNspd;
                console.log(`✅ Сохранен номер ${cadNspd} для row_id ${obj.row_id}`);
            } else {
                deal.cad_nspd = 'не определено';
                console.log(`❌ Номер НСПД НЕ НАЙДЕН для row_id ${obj.row_id} → помечено как "не определено"`);
            }
            saved = true;
            return { success: !!cadNspd, row_id: obj.row_id };
        }
    }
    if (!saved) {
        console.log(`❌ Не найдена сделка с row_id ${obj.row_id}`);
    }
    return null;
});
        
        // Ждем завершения всех запросов в чанке
        const results = await Promise.all(promises);
        
        // Подсчитываем найденные
     for (const result of results) {
    if (result) {
        if (result.success) {
            foundCount++;
        }
        totalProcessed++;
    }
}
        
        // Небольшая задержка между чанками
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (btn) {
            const percent = Math.round((totalProcessed / uniqueObjects.length) * 100);
            btn.innerHTML = `⏳ Синхронизация... ${percent}% (найдено ${foundCount})`;
        }
    }
    
    // ✅ ОЧИЩАЕМ AbortController
    syncAbortController = null;
    
    // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
    if (typeof renderDealsTable === 'function') {
        renderDealsTable();
    }
    
    // ✅ ПОКАЗЫВАЕМ РЕЗУЛЬТАТ
    const processedCount = wasAborted ? totalProcessed : uniqueObjects.length;
    const resultMessage = wasAborted 
        ? `⛔ Синхронизация прервана! Найдено ${foundCount} из ${processedCount} обработанных объектов`
        : `✅ Синхронизация завершена! Найдено ${foundCount} из ${uniqueObjects.length} объектов`;
    showNotification(resultMessage, wasAborted ? 'warning' : 'success');
    console.log(resultMessage);
    

// ════════════════════════════════════════════════════════════════
// 🔥 ИЗМЕНЕННАЯ ЧАСТЬ: СОХРАНЯЕМ ТОЛЬКО row_id И cad_nspd
// ════════════════════════════════════════════════════════════════
if (true) {
    console.log('📊 Формирование CSV с номерами НСПД...');
    
    // ✅ ОБЪЯВЛЯЕМ GIST ID ПЕРЕД ИСПОЛЬЗОВАНИЕМ
    const HARDCODED_GIST_ID = '9f6e65a18e94b61a6b7a96389e9109c5';
    
    // ✅ Используем row_id как уникальный ключ
    let existingNspdMap = {};
    try {
        const gistCheck = await fetch(`https://api.github.com/gists/${HARDCODED_GIST_ID}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (gistCheck.ok) {
            const gistData = await gistCheck.json();
            const file = gistData.files?.['deals_clean.csv'];
            if (file && file.content) {
                const lines = file.content.split('\n').filter(line => line.trim());
                if (lines.length > 1) {
                    const headers = lines[0].split(',');
                    const rowIdIdx = headers.indexOf('row_id');
                    const nspdIdx = headers.indexOf('cad_nspd');
                    if (rowIdIdx !== -1 && nspdIdx !== -1) {
                        for (let i = 1; i < lines.length; i++) {
                            const values = lines[i].split(',');
                            if (values.length > Math.max(rowIdIdx, nspdIdx)) {
                                const rowId = values[rowIdIdx]?.trim() || '';
                                const nspd = values[nspdIdx]?.trim() || '';
                                if (rowId && nspd) {
                                    existingNspdMap[rowId] = nspd;
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch(e) {
        console.warn('⚠️ Не удалось загрузить старые связи из Gist:', e.message);
    }
    console.log(`📊 Загружено ${Object.keys(existingNspdMap).length} старых связей из Gist`);
    
    // ✅ Используем row_id как уникальный ключ
    const uniquePairs = {};
    
    // ✅ СНАЧАЛА ДОБАВЛЯЕМ ВСЕ СТАРЫЕ СВЯЗИ
    for (const [rowId, nspd] of Object.entries(existingNspdMap)) {
        uniquePairs[rowId] = {
            row_id: rowId,
            cad_nspd: nspd
        };
    }
    
    // ✅ ПОТОМ ОБНОВЛЯЕМ/ДОБАВЛЯЕМ НОВЫЕ (перезаписываем старые, если есть)
let allPairsCount = 0;
for (const deal of allDealsFlat) {
    if (deal.cad_nspd && deal.row_id) {
        // ✅ ДАЖЕ ЕСЛИ УЖЕ ЕСТЬ В uniquePairs - ПЕРЕЗАПИСЫВАЕМ
        uniquePairs[deal.row_id] = {
            row_id: deal.row_id,
            cad_nspd: deal.cad_nspd
        };
        allPairsCount++;
    }
}
console.log(`📊 Добавлено ${allPairsCount} связей из allDealsFlat (включая "не определено")`);
    
    // ✅ CSV с 2 полями: row_id и cad_nspd
    let csv = 'row_id,cad_nspd\n';
    let exportedCount = 0;
    
    for (const [rowId, obj] of Object.entries(uniquePairs)) {
        const nspd = obj.cad_nspd.includes('"') ? `"${obj.cad_nspd.replace(/"/g, '""')}"` : obj.cad_nspd;
        csv += `${rowId},${nspd}\n`;
        exportedCount++;
    }
    
    console.log(`📊 Экспортировано ${exportedCount} уникальных связей row_id → cad_nspd (${Object.keys(existingNspdMap).length} старых + ${foundCount} новых)`);
    console.log(`📏 Размер CSV: ${(csv.length / 1024).toFixed(2)} КБ`);
    console.log(`📋 Поля: row_id, cad_nspd`);
    
    const token = prompt('Введите GitHub Token для обновления CSV (нужны права gist):');
    if (!token || !token.trim()) {
        showNotification('⚠️ Токен не введен, CSV не обновлен', 'warning');
    } else {
        try {
            // ✅ 1. ПРОВЕРКА ТОКЕНА
            console.log('🔑 Проверка токена...');
            const testResponse = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': `token ${token}` }
            });
            
            if (!testResponse.ok) {
                throw new Error(`Невалидный токен: ${testResponse.status} - ${testResponse.statusText}`);
            }
            
            const userData = await testResponse.json();
            console.log(`✅ Токен валидный, пользователь: ${userData.login}`);
            
            // ✅ 2. ИСПОЛЬЗУЕМ ЖЕСТКО ЗАКОДИРОВАННЫЙ GIST ID
            // HARDCODED_GIST_ID уже объявлен выше
            
            let gistData;
            
            if (HARDCODED_GIST_ID) {
                // ✅ ОБНОВЛЯЕМ СУЩЕСТВУЮЩИЙ GIST
                console.log(`🔄 Обновление существующего Gist: ${HARDCODED_GIST_ID}`);
                showNotification('🔄 Обновление существующего Gist...', 'info');
                
                try {
                    // ✅ ПРОВЕРЯЕМ, СУЩЕСТВУЕТ ЛИ GIST
                    const getGistResponse = await fetch(`https://api.github.com/gists/${HARDCODED_GIST_ID}`, {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/json'
                        }
                    });
                    
                    // ✅ ЕСЛИ GIST НЕ СУЩЕСТВУЕТ (404) — СОЗДАЕМ НОВЫЙ
                    if (getGistResponse.status === 404) {
                        console.warn(`⚠️ Gist ${HARDCODED_GIST_ID} не найден (404), создаем новый...`);
                    } else if (!getGistResponse.ok) {
                        throw new Error(`Не удалось получить Gist: ${getGistResponse.status}`);
                    } else {
                        // ✅ Gist существует — обновляем
                        const currentGist = await getGistResponse.json();
                        const fileSha = currentGist.files?.['deals_clean.csv']?.sha || null;
                        
                        const updateResponse = await fetch(`https://api.github.com/gists/${HARDCODED_GIST_ID}`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `token ${token}`,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                description: `Связи row_id → cad_nspd ${new Date().toISOString().slice(0,10)}`,
                                files: {
                                    'deals_clean.csv': {
                                        content: csv,
                                        sha: fileSha || undefined
                                    }
                                }
                            })
                        });
                        
                        if (!updateResponse.ok) {
                            const errorData = await updateResponse.json().catch(() => ({}));
                            throw new Error(`Ошибка обновления Gist (${updateResponse.status}): ${errorData.message || 'Неизвестная ошибка'}`);
                        }
                        
                        gistData = await updateResponse.json();
                        console.log(`✅ Gist обновлен: ${gistData.html_url}`);
                    }
                } catch (error) {
                    // ✅ Если ошибка связана с 404 — создаем новый Gist
                    if (error.message === 'GIST_NOT_FOUND' || error.message.includes('404')) {
                        console.log('📝 Создание нового Gist (после 404)...');
                        showNotification('📝 Создание нового Gist...', 'info');
                        
                        const createResponse = await fetch('https://api.github.com/gists', {
                            method: 'POST',
                            headers: {
                                'Authorization': `token ${token}`,
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                description: `Связи row_id → cad_nspd ${new Date().toISOString().slice(0,10)}`,
                                public: false,
                                files: {
                                    'deals_clean.csv': {
                                        content: csv
                                    }
                                }
                            })
                        });
                        
                        if (!createResponse.ok) {
                            const errorData = await createResponse.json().catch(() => ({}));
                            throw new Error(`Ошибка создания Gist (${createResponse.status}): ${errorData.message || 'Неизвестная ошибка'}`);
                        }
                        
                        gistData = await createResponse.json();
                        console.log(`✅ Создан новый Gist: ${gistData.html_url}`);
                    } else {
                        throw error;
                    }
                }
            }
            
            // ✅ Если gistData еще не определен (т.е. не было HARDCODED_GIST_ID)
            if (!gistData) {
                console.log('📝 Создание нового Gist...');
                showNotification('📝 Создание нового Gist...', 'info');

                const createResponse = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        description: `Связи row_id → cad_nspd ${new Date().toISOString().slice(0,10)}`,
                        public: false,
                        files: {
                            'deals_clean.csv': {
                                content: csv
                            }
                        }
                    })
                });

                if (!createResponse.ok) {
                    const errorData = await createResponse.json().catch(() => ({}));
                    throw new Error(`Ошибка создания Gist (${createResponse.status}): ${errorData.message || 'Неизвестная ошибка'}`);
                }

                gistData = await createResponse.json();
                console.log(`✅ Создан новый Gist: ${gistData.html_url}`);

                const newGistId = gistData.id;
                console.log(`📋 НОВЫЙ GIST ID: ${newGistId}`);

                showNotification(`✅ Создан Gist! ID: ${newGistId}`, 'success');

                localStorage.setItem('deals_csv_gist_id', newGistId);
                localStorage.setItem('deals_csv_gist_url', gistData.files['deals_clean.csv'].raw_url);

                try {
                    await navigator.clipboard.writeText(newGistId);
                    console.log('📋 ID скопирован в буфер обмена!');
                } catch(e) {
                    console.log('📋 ID: ' + newGistId);
                }
            }

            // ✅ 3. СОХРАНЯЕМ URL И ID
            const rawUrl = gistData.files['deals_clean.csv'].raw_url;
            localStorage.setItem('deals_csv_gist_url', rawUrl);
            localStorage.setItem('deals_csv_gist_id', gistData.id);

            console.log(`✅ CSV с связями row_id → cad_nspd сохранен в Gist: ${rawUrl}`);
            console.log(`📋 Gist ID: ${gistData.id}`);

            showNotification(`✅ Связи row_id → cad_nspd сохранены в Gist! (${exportedCount} связей, ${(csv.length / 1024).toFixed(2)} КБ)`, 'success');

        } catch (error) {
            console.error('❌ Ошибка:', error);
            showNotification(`❌ Ошибка: ${error.message}`, 'error');
        }
    }
} else {
    console.log('ℹ️ Нет новых номеров для обновления CSV');
    showNotification('ℹ️ Новых номеров НСПД не найдено', 'info');
}

    // Восстанавливаем кнопку
    if (btn) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.style.background = '#2563eb';
    }

    isSyncRunning = false;
}

async function updateGitHubCSVWithNSPD(token) {
    console.log('📤 Обновление CSV через прокси-сервер...');
    
    const owner = 'mark98molchanov-a11y';
    const repo = 'a13y.gko-registry-system';
    const releaseTag = 'v1.0.0';
    const fileName = 'deals_clean.csv';
    
    try {
        // ✅ 1. Получаем информацию о релизе ЧЕРЕЗ ПРОКСИ
        const releaseResponse = await fetch(
            `/api/release/${owner}/${repo}/${releaseTag}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/json'
                }
            }
        );
        
        if (!releaseResponse.ok) {
            const errorData = await releaseResponse.json().catch(() => ({}));
            throw new Error(`Ошибка получения релиза: ${releaseResponse.status} - ${errorData.error || ''}`);
        }
        
        const releaseData = await releaseResponse.json();
        const releaseId = releaseData.id;
        console.log(`✅ Релиз найден: ${releaseData.tag_name}, ID: ${releaseId}`);
        
        // ✅ 2. Ищем существующий asset
        let assetId = null;
        if (releaseData.assets && Array.isArray(releaseData.assets)) {
            for (const asset of releaseData.assets) {
                if (asset.name === fileName) {
                    assetId = asset.id;
                    console.log(`✅ Найден существующий asset: ${fileName}, ID: ${assetId}`);
                    break;
                }
            }
        }
        
        // ✅ 3. Создаём новый CSV
        console.log('📊 Создание нового CSV...');
        const newCSV = await createCSVFromData();
        const contentLength = newCSV.length;
        console.log(`📏 Размер CSV: ${(contentLength / 1024 / 1024).toFixed(2)} МБ`);
        
        // ✅ 4. Удаляем старый asset (если есть) ЧЕРЕЗ ПРОКСИ
        if (assetId) {
            console.log('🗑️ Удаление старого asset...');
            const deleteResponse = await fetch(
                `/api/asset/${owner}/${repo}/${assetId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            if (!deleteResponse.ok && deleteResponse.status !== 204) {
                const errorData = await deleteResponse.json().catch(() => ({}));
                console.warn(`⚠️ Не удалось удалить старый asset: ${deleteResponse.status} - ${errorData.error || ''}`);
            } else {
                console.log('✅ Старый asset удален');
            }
        }
        
        // ✅ 5. Загружаем новый файл ЧЕРЕЗ ПРОКСИ
        console.log('📤 Загрузка нового CSV в релиз через прокси...');
        const uploadUrl = `/api/upload/${owner}/${repo}/${releaseId}?name=${fileName}`;
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/octet-stream',
                'Accept': 'application/json'
            },
            body: newCSV
        });
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({}));
            throw new Error(`Ошибка загрузки: ${uploadResponse.status} - ${errorData.error || errorData.details || ''}`);
        }
        
        const uploadedAsset = await uploadResponse.json();
        console.log(`✅ CSV обновлен!`);
        console.log(`🔗 ${uploadedAsset.browser_download_url}`);
        
        // ✅ 6. Сохраняем в localStorage
        const nspdData = {};
        for (const deal of allDealsFlat) {
            if (deal.cad_nspd) {
                nspdData[deal.cad_number] = deal.cad_nspd;
            }
        }
        localStorage.setItem('nspd_data', JSON.stringify(nspdData));
        console.log(`✅ Сохранено ${Object.keys(nspdData).length} номеров в localStorage`);
        
        return { 
            success: true, 
            updated: Object.keys(nspdData).length,
            downloadUrl: uploadedAsset.browser_download_url
        };
        
    } catch (error) {
        console.error('❌ Ошибка обновления через прокси:', error);
        return { success: false, error: error.message };
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
        if (currentNumberFilter.length > 0 && !currentNumberFilter.includes(deal.number)) return false;
        if (currentRatioCategoryFilter.length > 0 && !currentRatioCategoryFilter.includes(deal.ratio_category)) return false; 
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
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 8%; cursor: pointer;" onclick="sortDealsTable('cad_nspd')">Кад. номер НСПД ↕</th>
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
                    <th style="text-align: center; padding: 6px 6px; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; width: 7%; cursor: pointer;" onclick="sortDealsTable('street')">Улица ↕</th>
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
                    <td colspan="20" style="text-align: center; padding: 30px 0; color: #94a3b8; font-size: 14px;">
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
                    <td style="text-align: center; padding: 6px 6px; font-family: monospace; font-size: 10px; color: #1e293b; font-weight: 400;">${deal.cad_nspd || 'nan'}</td>
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
                    <td style="text-align: center; padding: 6px 6px; color: #1e293b; font-weight: 400; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80px;" title="${deal.street || 'nan'}">${deal.street || 'nan'}</td>
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

window.renderDealsTable = renderDealsTable;
window.syncWithNSPD = syncWithNSPD;
window.abortSyncWithNSPD = abortSyncWithNSPD;
window.updateGitHubCSVWithNSPD = updateGitHubCSVWithNSPD;
window.searchNSPD = searchNSPD;
window.loadDealsFromRelease = loadDealsFromRelease;
window.refreshCSVFromGist = refreshCSVFromGist;
window.createCSVFromData = createCSVFromData;
window.generateReport = generateReport;
window.loadScript = loadScript;
window.generateDocxReport = generateReport;
window.searchCadastralByNumber = searchCadastralByNumber;
window.sortDealsTable = sortDealsTable;
window.resetAllFiltersMap = resetAllFiltersMap;

// ✅ ДОБАВЬТЕ ФУНКЦИИ ФИЛЬТРОВ:
window.applyDealTypeFilter = applyDealTypeFilter;
window.applyCityFilter = applyCityFilter;
window.applyObjectTypeFilter = applyObjectTypeFilter;
window.applyWallMaterialFilter = applyWallMaterialFilter;
window.applyQuarterFilter = applyQuarterFilter;
window.applyYearBuildFilter = applyYearBuildFilter;
window.applyPurposeFilter = applyPurposeFilter;
window.applyVriFilter = applyVriFilter;
window.applyFiltersAndUpdate = applyFiltersAndUpdate;
window.applyNumberFilter = applyNumberFilter; 
window.applyRatioCategoryFilter = applyRatioCategoryFilter; 


// ✅ ФУНКЦИИ "ВЫДЕЛИТЬ ВСЕ" / "СБРОСИТЬ":
window.toggleAllDealTypes = toggleAllDealTypes;
window.toggleAllCities = toggleAllCities;
window.toggleAllObjectTypes = toggleAllObjectTypes;
window.toggleAllWallMaterials = toggleAllWallMaterials;
window.toggleAllQuarters = toggleAllQuarters;
window.toggleAllYearBuilds = toggleAllYearBuilds;
window.toggleAllPurposes = toggleAllPurposes;
window.toggleAllVri = toggleAllVri;
window.toggleAllNumbers = toggleAllNumbers; 
window.toggleAllRatioCategories = toggleAllRatioCategories; 
window.setChartGroupBy = setChartGroupBy; 
window.refreshPriceChart = refreshPriceChart;
window.getMedianSync = getMedianSync;
window.formatPriceShort = formatPriceShort;
window.allDealsFlat = allDealsFlat;
window.getQuarter = getQuarter;
window.dealsData = dealsData;
window.mapData = mapData;
window.loadDealsCSV = loadDealsCSV;
window.showNSPDObject = showNSPDObject;
window.fetchNSPDObject = fetchNSPDObject;
window.drawNSPDPolygon = drawNSPDPolygon;
window.closeNSPDObject = closeNSPDObject;
window.convertEPSG3857toWGS84 = convertEPSG3857toWGS84;
window.convertCoordinates = convertCoordinates;
window.showNSPDObjectByNspd = showNSPDObjectByNspd;
console.log('✅ Функции синхронизации с НСПД загружены');
console.log('✅ map-tab.js загружен');
function autoCenterOnLoad() {
    if (typeof window.mapInstance !== 'undefined' && window.mapInstance) {
        console.log('🔄 Автоматическое центрирование при загрузке');
        window.mapInstance.invalidateSize();
        window.mapInstance.setView([66.0, 76.0], 5);
        
        setTimeout(() => {
            if (window.mapInstance) {
                window.mapInstance.invalidateSize();
                const center = window.mapInstance.getCenter();
                if (Math.abs(center.lat - 66.0) > 1 || Math.abs(center.lng - 76.0) > 1) {
                    window.mapInstance.setView([66.0, 76.0], 5);
                }
            }
        }, 1000);
    } else {
        console.log('⏳ Карта еще не создана, пробуем позже...');
        setTimeout(() => {
            if (typeof window.mapInstance !== 'undefined' && window.mapInstance) {  // ✅ ИСПРАВЛЕНО
                console.log('🔄 Автоматическое центрирование (отложенное)');
                window.mapInstance.invalidateSize();
                window.mapInstance.setView([66.0, 76.0], 5);
            }
        }, 500);
    }
}

autoCenterOnLoad();
let nspdObjectLayer = null;
let nspdObjectInfo = null;

// Функция для преобразования координат EPSG:3857 → WGS84
function convertEPSG3857toWGS84(x, y) {
    const R = 6378137;
    const lon = (x / R) * 180 / Math.PI;
    const lat = (Math.atan(Math.exp(y / R)) * 2 - Math.PI / 2) * 180 / Math.PI;
    return { lat, lon };
}

function convertCoordinates(coords) {
    if (Array.isArray(coords[0]) && typeof coords[0] === 'number' && coords.length === 2) {
        const { lat, lon } = convertEPSG3857toWGS84(coords[0], coords[1]);
        return [lon, lat];
    }
    
    if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        return coords.map(ring => 
            ring.map(([x, y]) => {
                const { lat, lon } = convertEPSG3857toWGS84(x, y);
                return [lon, lat];
            })
        );
    }
    
    if (Array.isArray(coords[0]) && coords[0].length === 2) {
        return coords.map(([x, y]) => {
            const { lat, lon } = convertEPSG3857toWGS84(x, y);
            return [lon, lat];
        });
    }
    
    return coords;
}

function showNSPDObject(cadNumber) {
    console.log('🔴 showNSPDObject вызван для:', cadNumber);
    
    // Очищаем предыдущий слой
    if (nspdObjectLayer) {
        if (window.mapInstance) {
            window.mapInstance.removeLayer(nspdObjectLayer);
        }
        nspdObjectLayer = null;
    }
    const oldPanel = document.getElementById('nspd-object-info');
    if (oldPanel) oldPanel.remove();
    
    if (!cadNumber) {
        console.warn('⚠️ cadNumber не передан');
        return;
    }
    
    // Находим объект в dealsData по cad_number
    const deals = dealsData[cadNumber] || [];
    if (deals.length === 0) {
        console.warn(`⚠️ Нет данных для кадастрового номера: ${cadNumber}`);
        showNotification('Объект не найден в сделках', 'warning');
        return;
    }
    
    const deal = deals[0];
    if (!deal.cad_nspd) {
        console.warn(`⚠️ Нет номера НСПД для: ${cadNumber}`);
        showNotification('Нет номера НСПД для этого объекта', 'warning');
        return;
    }
    
    // Загружаем данные из НСПД по cad_nspd
    fetchNSPDObject(deal.cad_nspd).then(nspdData => {
        if (!nspdData) {
            showNotification('❌ Объект не найден в НСПД', 'error');
            return;
        }
        drawNSPDPolygon(nspdData, deal);
    });
}

async function fetchNSPDObject(cadNspd) {
    try {
        const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(cadNspd)}&thematicSearchId=1&limit=10`;
        console.log('📤 Запрос геометрии:', url);
        
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const features = data?.data?.features || [];
        
        for (const f of features) {
            const props = f.properties || {};
            const opts = props.options || {};
            
            const cad = opts.cad_number || props.externalKey || '';
            if (cad === cadNspd) {
                if (f.geometry && f.geometry.coordinates) {
                    console.log('✅ Геометрия найдена:', f.geometry.type);
                    return {
                        geometry: f.geometry,
                        properties: props,
                        options: opts
                    };
                }
            }
        }
        
        console.warn(`⚠️ Объект ${cadNspd} не найден или нет геометрии`);
        return null;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки объекта НСПД:', error);
        return null;
    }
}

function drawNSPDPolygon(nspdData, deal) {
    const geometry = nspdData.geometry;
    const opts = nspdData.options || {};
    
    if (!geometry || !geometry.coordinates) {
        console.warn('⚠️ Нет геометрии для отображения');
        return;
    }
    
    let coordinates;
    let isPolygon = false;
    
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        coordinates = geometry.coordinates;
        isPolygon = true;
    } else if (geometry.type === 'Point') {
        const [x, y] = geometry.coordinates;
        const { lat, lon } = convertEPSG3857toWGS84(x, y);
        
        const marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'nspd-marker',
                html: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        });
        
        const popupContent = buildNSPDPopupContent(nspdData, deal);
        marker.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 350 });
        marker.addTo(window.mapInstance);
        nspdObjectLayer = marker;
        window.mapInstance.setView([lat, lon], 16);
        showNSPDInfoPanel(nspdData, deal);
        return;
    } else {
        console.warn(`⚠️ Неподдерживаемый тип геометрии: ${geometry.type}`);
        return;
    }
    
    if (!isPolygon) {
        console.warn('⚠️ Неподдерживаемая геометрия');
        return;
    }
    
    let convertedCoords;
    if (geometry.type === 'Polygon') {
        convertedCoords = convertCoordinates(coordinates);
    } else if (geometry.type === 'MultiPolygon') {
        convertedCoords = coordinates.map(polygon => convertCoordinates(polygon));
    }
    
    const geojson = {
        type: 'Feature',
        geometry: {
            type: geometry.type,
            coordinates: convertedCoords
        },
        properties: {
            cadastral_number: deal.cad_nspd,
            name: opts.params_name || opts.name || 'Объект НСПД',
            address: opts.readable_address || opts.address_readable_address || ''
        }
    };
    
    nspdObjectLayer = L.geoJSON(geojson, {
        style: {
            fillColor: '#ef4444',
            fillOpacity: 0.25,
            color: '#dc2626',
            weight: 4,
            opacity: 0.9,
            dashArray: '6 4'
        },
        onEachFeature: function(feature, layer) {
            const popupContent = buildNSPDPopupContent(nspdData, deal);
            layer.bindPopup(popupContent, { className: 'custom-popup', maxWidth: 350 });
            
            layer.on('mouseover', function() {
                this.setStyle({ fillOpacity: 0.4, weight: 5, color: '#ef4444', opacity: 1 });
            });
            layer.on('mouseout', function() {
                this.setStyle({ fillOpacity: 0.25, weight: 4, color: '#dc2626', opacity: 0.9 });
            });
        }
    });
    
    if (window.mapInstance) {
        nspdObjectLayer.addTo(window.mapInstance);
        const bounds = nspdObjectLayer.getBounds();
        if (bounds && bounds.isValid()) {
            window.mapInstance.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    showNSPDInfoPanel(nspdData, deal);
}

function buildNSPDPopupContent(nspdData, deal) {
    const opts = nspdData.options || {};
    const name = opts.params_name || opts.name || opts.building_name || '—';
    const address = opts.readable_address || opts.address_readable_address || '—';
    const area = opts.area || opts.params_area || opts.specified_area || '—';
    const type = opts.type || opts.object_type_value || opts.land_record_type || '—';
    const cadNspd = deal.cad_nspd || '—';
    
    return `
        <div class="popup-title" style="color:#dc2626;border-bottom:2px solid #dc2626;padding-bottom:6px;">
            🏠 ${name}
        </div>
        <div class="popup-row"><span class="popup-label">Кад. номер НСПД</span><span class="popup-value" style="font-family:monospace;">${cadNspd}</span></div>
        <div class="popup-row"><span class="popup-label">Тип</span><span class="popup-value">${type}</span></div>
        <div class="popup-row"><span class="popup-label">Площадь</span><span class="popup-value">${typeof area === 'number' ? area.toFixed(1) : area} м²</span></div>
        <div class="popup-row"><span class="popup-label">Адрес</span><span class="popup-value" style="font-size:11px;">${address}</span></div>
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;">
            🔴 Выделенный объект из НСПД
        </div>
    `;
}

function showNSPDInfoPanel(nspdData, deal) {
    const oldPanel = document.getElementById('nspd-object-info');
    if (oldPanel) oldPanel.remove();
    
    const opts = nspdData.options || {};
    const name = opts.params_name || opts.name || opts.building_name || 'Объект НСПД';
    const address = opts.readable_address || opts.address_readable_address || '—';
    const cadNspd = deal.cad_nspd || '—';
    
    const panel = document.createElement('div');
    panel.id = 'nspd-object-info';
    panel.style.cssText = `
        position: absolute;
        bottom: 100px;
        right: 30px;
        background: white;
        padding: 14px 18px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        z-index: 1000;
        border-left: 4px solid #dc2626;
        max-width: 280px;
        min-width: 200px;
    `;
    
    panel.innerHTML = `
        <div style="font-weight:600;color:#dc2626;margin-bottom:4px;font-size:14px;">🔴 ${name}</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${address}</div>
        <div style="font-size:11px;color:#64748b;font-family:monospace;">${cadNspd}</div>
        <button onclick="closeNSPDObject()" style="
            margin-top:8px;
            padding:3px 12px;
            background:#f1f5f9;
            border:1px solid #e2e8f0;
            border-radius:6px;
            font-size:11px;
            cursor:pointer;
            color:#475569;
            font-family:'Inter',sans-serif;
        " onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
            ✕ Закрыть
        </button>
    `;
    
    const mapContainer = document.getElementById('map-container');
    if (mapContainer) {
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(panel);
    }
}

function closeNSPDObject() {
    if (nspdObjectLayer) {
        if (window.mapInstance) {
            window.mapInstance.removeLayer(nspdObjectLayer);
        }
        nspdObjectLayer = null;
    }
    const panel = document.getElementById('nspd-object-info');
    if (panel) panel.remove();
    console.log('🗑️ Объект НСПД скрыт');
}
function showNSPDObjectByNspd(cadNspd) {
    console.log('🔴 showNSPDObjectByNspd вызван для:', cadNspd);
    
    // Очищаем предыдущий слой
    if (nspdObjectLayer) {
        if (window.mapInstance) {
            window.mapInstance.removeLayer(nspdObjectLayer);
        }
        nspdObjectLayer = null;
    }
    const oldPanel = document.getElementById('nspd-object-info');
    if (oldPanel) oldPanel.remove();
    
    if (!cadNspd) {
        console.warn('⚠️ cadNspd не передан');
        return;
    }
    
    // Загружаем данные из НСПД по cad_nspd
    fetchNSPDObject(cadNspd).then(nspdData => {
        if (!nspdData) {
            showNotification('❌ Объект не найден в НСПД', 'error');
            return;
        }
        
        // Создаем фейковый deal для отображения
        const deal = {
            cad_nspd: cadNspd,
            cad_number: cadNspd
        };
        
        drawNSPDPolygon(nspdData, deal);
    });
}
