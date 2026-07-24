let mapData = null;
let currentLevel = 0;
let currentParentId = null;
let currentDistrictFilter = null;
let isUpdatingFromSearch = false;
let docxLoaded = false;

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
let isHeatmapEnabled = false;
function toggleHeatmapMode() {
    isHeatmapEnabled = !isHeatmapEnabled;
    
    // ✅ НАХОДИМ КНОПКУ В ХЕДЕРЕ
    const btn = document.getElementById('heatmap-toggle-btn-header');
    if (btn) {
        if (isHeatmapEnabled) {
            // ✅ ВКЛЮЧЕНА — зеленый фон (ТОЧНО КАК У ЦЕНОВОГО ФИЛЬТРА)
            btn.innerHTML = 'Тепловая карта';
            btn.style.background = '#dcfce7';
            btn.style.color = '#166534';
            btn.style.borderColor = '#86efac';
        } else {
            // ✅ ВЫКЛЮЧЕНА — синий фон (ТОЧНО КАК У ЦЕНОВОГО ФИЛЬТРА)
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
            btnOld.innerHTML = '🌡️ Тепловая карта';
            btnOld.style.background = '#dcfce7';
            btnOld.style.color = '#166534';
        } else {
            btnOld.innerHTML = '🌡️ Тепловая карта';
            btnOld.style.background = '#e0f2fe';
            btnOld.style.color = '#0284c7';
        }
    }
    
    // ✅ ПЕРЕРИСОВЫВАЕМ КАРТУ С НОВЫМ РЕЖИМОМ
    renderMapLevel(currentLevel, currentParentId);
    
    console.log(`🌡️ Тепловая карта ${isHeatmapEnabled ? 'ВКЛЮЧЕНА' : 'ВЫКЛЮЧЕНА'}`);
}
let uprsThresholds = {}; 
let isPriceFilterEnabled = false;
let originalAllDealsFlat = []; 

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
    console.log('📊 Расчет УПРС и УПКС по городам...');
    
    // Группируем сделки по городам
    const groupedByCity = {};
    allDealsFlat.forEach(deal => {
        // Применяем все активные фильтры
        // Фильтр по типу сделки
        if (currentDealTypeFilter.length > 0 && !currentDealTypeFilter.includes(deal.deal_kind_text)) return;
        // Фильтр по городу
        if (currentCityFilter.length > 0 && !currentCityFilter.includes(deal.city)) return;
        // Фильтр по типу объекта
        if (currentObjectTypeFilter.length > 0 && !currentObjectTypeFilter.includes(deal.obj_kind_text)) return;
        // Фильтр по материалу стен
        if (currentWallMaterialFilter.length > 0 && !currentWallMaterialFilter.includes(deal.wall_material_name)) return;
        // Фильтр по кварталу сделки
        if (currentQuarterFilter.length > 0 && !currentQuarterFilter.includes(deal.quarter)) return;
        // Фильтр по году постройки
        if (currentYearBuildFilter.length > 0 && !currentYearBuildFilter.includes(deal.year_build)) return;
        // Фильтр по назначению
        if (currentPurposeFilter.length > 0 && !currentPurposeFilter.includes(deal.purpose_text)) return;
        // Фильтр по ВРИ
        if (currentVriFilter.length > 0 && !currentVriFilter.includes(deal.vri)) return;
        
        const city = deal.city || 'unknown';
        if (city === 'unknown' || city === 'nan') return;
        
        if (!groupedByCity[city]) {
            groupedByCity[city] = {
                uprs: [],
                upks: []
            };
        }
        
        if (deal.uprs > 0) groupedByCity[city].uprs.push(deal.uprs);
        if (deal.upks > 0) groupedByCity[city].upks.push(deal.upks);
    });
    
    const cityData = {};
    Object.keys(groupedByCity).forEach(city => {
        const uprs = groupedByCity[city].uprs;
        const upks = groupedByCity[city].upks;
        
        if (uprs.length === 0 && upks.length === 0) return;
        
        cityData[city] = {
            count: Math.max(uprs.length, upks.length),
            uprsMedian: uprs.length > 0 ? getMedianSync(uprs) : 0,
            upksMedian: upks.length > 0 ? getMedianSync(upks) : 0,
            uprsMin: uprs.length > 0 ? Math.min(...uprs) : 0,
            uprsMax: uprs.length > 0 ? Math.max(...uprs) : 0,
            upksMin: upks.length > 0 ? Math.min(...upks) : 0,
            upksMax: upks.length > 0 ? Math.max(...upks) : 0
        };
    });
    
    // Сортируем города по количеству сделок (от большего к меньшему)
    const sortedCities = Object.keys(cityData).sort((a, b) => {
        return cityData[b].count - cityData[a].count;
    });
    
    // Берем топ-15 городов для читаемости
    const topCities = sortedCities.slice(0, 15);
    
    const result = {
        cities: topCities,
        data: topCities.map(city => ({
            city: city,
            count: cityData[city].count,
            uprsMedian: cityData[city].uprsMedian,
            upksMedian: cityData[city].upksMedian,
            uprsMin: cityData[city].uprsMin,
            uprsMax: cityData[city].uprsMax,
            upksMin: cityData[city].upksMin,
            upksMax: cityData[city].upksMax
        })),
        allData: cityData,
        totalDeals: allDealsFlat.filter(d => d.uprs > 0 || d.upks > 0).length
    };
    
    console.log(`✅ Данные по городам: ${result.cities.length} городов`);
    if (result.data.length > 0) {
        console.log('📊 Пример:', result.data[0]);
    }
    return result;
}

function renderPriceChart() {
    const container = document.getElementById('price-chart-container');
    if (!container) {
        console.warn('⚠️ Контейнер для графика не найден');
        return;
    }
    
    // Убеждаемся, что контейнер имеет фиксированную высоту
    container.style.minHeight = '350px';
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
    
    // Сортируем по УПРС для красивого отображения
    const sortedData = [...chartData.data].sort((a, b) => a.uprsMedian - b.uprsMedian);
    const cities = sortedData.map(d => d.city);
    const uprsData = sortedData.map(d => d.uprsMedian);
    const upksData = sortedData.map(d => d.upksMedian);
    
    // Находим максимум для шкалы
    const allValues = [...uprsData, ...upksData].filter(v => v > 0);
    const maxVal = allValues.length > 0 ? Math.max(...allValues) * 1.15 : 100;
    
    // ✅ ВАЖНО: создаем canvas с ЧЕТКОЙ высотой и помещаем в wrapper
   container.innerHTML = `
    <div id="chart-wrapper" style="width:100%; height:350px; position:relative;">
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
            labels: cities,
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
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                label += context.parsed.y.toFixed(2) + ' ₽/м²';
                            }
                            return label;
                        },
                        afterBody: function(tooltipItems) {
                            const index = tooltipItems[0].dataIndex;
                            const city = sortedData[index];
                            if (city && city.count > 0) {
                                return [
                                    `Сделок: ${city.count}`,
                                    `УПРС: ${city.uprsMin > 0 ? city.uprsMin.toFixed(2) : '—'} – ${city.uprsMax > 0 ? city.uprsMax.toFixed(2) : '—'} ₽/м²`,
                                    `УПКС: ${city.upksMin > 0 ? city.upksMin.toFixed(2) : '—'} – ${city.upksMax > 0 ? city.upksMax.toFixed(2) : '—'} ₽/м²`
                                ];
                            }
                            return [];
                        }
                    }
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
                        maxRotation: 45,
                        minRotation: 30,
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
            // ✅ ПЛАГИН ДЛЯ ПОДПИСИ ЗНАЧЕНИЙ НА СТОЛБЦАХ
            afterDraw: function(chart) {
                const ctx = chart.ctx;
                chart.data.datasets.forEach(function(dataset, datasetIndex) {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta.data) return;
                    
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
    
    // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ
    const statsDiv = document.getElementById('price-chart-stats');
    if (statsDiv) {
        const totalDeals = sortedData.reduce((sum, d) => sum + d.count, 0);
        const avgUprs = sortedData.reduce((sum, d) => sum + d.uprsMedian, 0) / sortedData.length;
        const avgUpks = sortedData.reduce((sum, d) => sum + d.upksMedian, 0) / sortedData.length;
        
        statsDiv.innerHTML = `
            <span>🏙️ Городов: <strong>${chartData.cities.length}</strong></span>
            <span>📊 Сделок: <strong>${chartData.totalDeals.toLocaleString()}</strong></span>
            <span>📈 Средний УПРС: <strong>${avgUprs > 0 ? avgUprs.toFixed(0) : '—'} ₽/м²</strong></span>
            <span>📊 Средний УПКС: <strong>${avgUpks > 0 ? avgUpks.toFixed(0) : '—'} ₽/м²</strong></span>
        `;
    }
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
        const floorIndex = headers.indexOf('floor');
        const locationIndex = headers.indexOf('location');
        
        if (cadIndex === -1 || kindIndex === -1) {
            console.warn('⚠️ Не найдены колонки cad_number или deal_kind_text');
            return;
        }
        
        // ✅ ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ ДЛЯ СБОРА ДАННЫХ
        const dealsByCad = {};
        const typesCount = {};
        const citiesCount = {}; 
        const objectTypesCount = {};
        const wallMaterialTypesLocal = {};
        const quarterTypesLocal = {};
        const yearBuildTypesLocal = {};
        const purposeCountLocal = {};   
        const vriCountLocal = {};
        
        // ✅ ОЧИЩАЕМ ГЛОБАЛЬНЫЕ МАССИВЫ
        allDealsFlat = [];
        originalAllDealsFlat = [];
        
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
                area: parseFloat(values[areaIndex]) || 0,
                purpose_text: values[purposeIndex] || 'nan',
                cad_cost: parseFloat(values[cadCostIndex]) || 0,
                upks: parseFloat(values[upksIndex]) || 0,
                uprs: parseFloat(values[uprsIndex]) || 0,
                city: values[cityIndex] || 'nan',
                deal_kind_text: values[kindIndex] || 'nan',
                obj_kind_text: values[objKindIndex] || 'nan',
                vri: values[vriIndex] || 'nan',
                quarter: values[quarterIndex] || 'nan',
                year_build: values[yearBuildIndex] || 'nan',
                wall_material_name: values[wallMaterialIndex] || 'nan',
                deal_price_rub: parseFloat(values[priceIndex]) || 0,
                uprs_rub: parseFloat(values[uprsIndex]) || 0,
                floor: values[floorIndex] || 'nan',
                location: values[locationIndex] || 'nan'
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
            
            // ✅ ИСПОЛЬЗУЕМ ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ
            typesCount[kind] = (typesCount[kind] || 0) + 1;
            citiesCount[city] = (citiesCount[city] || 0) + 1;
            objectTypesCount[objKind] = (objectTypesCount[objKind] || 0) + 1;
            wallMaterialTypesLocal[wallMaterial] = (wallMaterialTypesLocal[wallMaterial] || 0) + 1;
            quarterTypesLocal[quarter] = (quarterTypesLocal[quarter] || 0) + 1;
            yearBuildTypesLocal[yearBuild] = (yearBuildTypesLocal[yearBuild] || 0) + 1; 
            purposeCountLocal[purposeText] = (purposeCountLocal[purposeText] || 0) + 1;
            vriCountLocal[vri] = (vriCountLocal[vri] || 0) + 1;
        }
        
        // ============================================================
        // 🆕 ФИЛЬТРАЦИЯ ПО 10% НИЗКИХ И 10% ВЫСОКИХ ЦЕН
        // ============================================================
        
        console.log('Всего сделок загружено:', allDealsFlat.length);
        
        // Сохраняем оригинальные данные (на случай если понадобится)
        originalAllDealsFlat = [...allDealsFlat];
        
        // Рассчитываем пороговые цены для каждого типа сделки
        priceThresholds = calculatePriceThresholds();
        console.log('Пороговые цены рассчитаны');
        
        // Применяем фильтрацию (по умолчанию включена)
        if (isPriceFilterEnabled && Object.keys(priceThresholds).length > 0) {
            const filteredDeals = filterDealsByPriceThreshold(priceThresholds);
            console.log(`После фильтрации по ценам: ${filteredDeals.length} сделок (исключено ${allDealsFlat.length - filteredDeals.length})`);
            
            // Обновляем глобальные данные
            allDealsFlat = filteredDeals;
            rebuildDealsData(filteredDeals);
        } else {
            rebuildDealsData(allDealsFlat);
        }
        
        // ============================================================
        // 🆕 КОНЕЦ КОДА ФИЛЬТРАЦИИ
        // ============================================================
        
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
        
        console.log('✅ CSV загружен:', Object.keys(dealsData).length, 'кварталов');
        console.log('Типы сделок:', dealTypes);
        
        renderDealTypeFilters();
        renderCityFilters();
        renderObjectTypeFilters();
        renderWallMaterialFilters();
        renderQuarterFilters();
        renderYearBuildFilters();
        renderDealsTable(); 
        renderPurposeFilters();
        renderVriFilters();
        
        // ✅ ПЕРЕРИСОВЫВАЕМ КАРТУ ПОСЛЕ ЗАГРУЗКИ ДАННЫХ
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
    console.log('Расчет пороговых цен по типам сделок и муниципалитетам (10% низких и 10% высоких)...');
    
    const thresholds = {};
    
    // Группируем сделки по типу и муниципалитету (городу)
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
    
    // Для каждой группы (тип + муниципалитет) вычисляем пороги для УПРС и УПКС
    Object.keys(dealsByTypeAndCity).forEach(key => {
        const group = dealsByTypeAndCity[key];
        
        // ✅ Пороги для УПРС
        const uprsPrices = group.uprsPrices.sort((a, b) => a - b);
        // ✅ Пороги для УПКС
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
        
        // ✅ Проверяем и УПРС, и УПКС
        const uprsOk = uprs >= threshold.uprsMin && uprs <= threshold.uprsMax;
        const upksOk = upks >= threshold.upksMin && upks <= threshold.upksMax;
        
        // Сделка проходит, если И УПРС, И УПКС в допустимом диапазоне
        return uprsOk && upksOk;
    });
}
function rebuildDealsData(filteredDeals) {
    // Очищаем старые данные
    dealsData = {};
    dealTypes = {};
    cityTypes = {};
    objectTypes = {};
    wallMaterialTypes = {};
    quarterTypes = {};
    yearBuildTypes = {};
    
    // Заполняем новыми данными
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
        
        // Обновляем счетчики для фильтров
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
    
    // ✅ ДОБАВЬТЕ ЭТОТ БЛОК:
    setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            console.log('📊 Обновление графика после переключения ценового фильтра');
            renderPriceChart();
        }
    }, 400);
}
function renderDealTypeFilters() {
    const container = document.getElementById('deal-type-filters');
    if (!container) return;
    
    const types = Object.keys(dealTypes)
    .map(k => k.trim())  // ← Удаляем пробелы в начале и конце
    .sort((a, b) => dealTypes[b] - dealTypes[a]);
    
    if (types.length === 0) {
        container.innerHTML = '<div style="color: #94a3b8; font-size: 10px; text-align: center; padding: 8px 0;">Нет данных</div>';
        return;
    }

    // Определяем, все ли типы выбраны
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
    // Перерисовываем все фильтры
    renderDealTypeFilters();
    renderCityFilters();
    renderObjectTypeFilters();
    renderWallMaterialFilters();
    renderQuarterFilters();
    renderYearBuildFilters();
    renderPurposeFilters();
    renderVriFilters();
    
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
    
    // ✅ Обновляем легенду (учитывает режим Heatmap)
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
    
    // ✅ ДОБАВЬТЕ ЭТОТ БЛОК - ОБНОВЛЕНИЕ ГРАФИКА
    setTimeout(function() {
        if (typeof renderPriceChart === 'function') {
            console.log('📊 Обновление графика из applyFiltersAndUpdate');
            renderPriceChart();
        }
    }, 300);
}
const originalApplyFiltersAndUpdate = window.applyFiltersAndUpdate || function() {
    // Запасная реализация, если оригинал не найден
    console.warn('⚠️ Оригинальная applyFiltersAndUpdate не найдена, используем заглушку');
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
    
    const allObjects = mapData ? mapData.features.filter(f => f.properties.level === 2) : [];
    let targetObjects = [];
    
    if (level === 0 || level === 1) {
        targetObjects = allObjects;
    } else if (level === 2) {
        targetObjects = allObjects.filter(f => {
            const fParentId = f.properties.parent_id || f.properties.district_id;
            return String(fParentId) === String(parentId);
        });
    }
    
    if (typeof updateQuartersStyle === 'function') updateQuartersStyle(targetObjects);
    if (typeof updateMapStatsFromDeals === 'function') updateMapStatsFromDeals(level, parentId);
    if (typeof updatePopupsAndTooltips === 'function') updatePopupsAndTooltips(level);
    if (typeof updateQuartersListWithFilteredObjects === 'function') updateQuartersListWithFilteredObjects(null);
    if (typeof addMapLegend === 'function') addMapLegend();
    if (typeof updateActiveFiltersDisplay === 'function') updateActiveFiltersDisplay();
    if (typeof renderDealsTable === 'function') renderDealsTable();
    
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            if (layer._updateTooltip) {
                layer._updateTooltip();
            }
        });
    }
};

// Переопределяем applyFiltersAndUpdate
window.applyFiltersAndUpdate = function() {
    console.log('🔄 applyFiltersAndUpdate вызвана (переопределенная)');
    
    // 1. Вызываем оригинальную логику
    originalApplyFiltersAndUpdate.call(this);
    
    // 2. Обновляем график с задержкой для гарантии
    if (typeof renderPriceChart === 'function') {
        // Используем setTimeout для гарантии, что DOM обновился
        setTimeout(function() {
            console.log('📊 Обновление графика после фильтров');
            renderPriceChart();
        }, 300);
    } else {
        console.warn('⚠️ renderPriceChart не определена');
    }
};

console.log('✅ applyFiltersAndUpdate переопределена с поддержкой графика');
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
    if (window.selectedQuarterCadNumber) {
        const isWrapper = window.selectedQuarterCadNumber.endsWith('000000') || 
                          window.selectedQuarterCadNumber.match(/^\d{2}:\d{2}:000000$/);
        if (isWrapper) {
            console.log('🔄 Сброс обертки при применении фильтра');
            window.selectedQuarterCadNumber = null;
        }
    }
    
    // ✅ ПЕРЕРИСОВЫВАЕМ ФИЛЬТРЫ
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
            
            // ✅ ДОБАВЛЯЕМ ОБРАБОТЧИК ЗАКРЫТИЯ ПОПАПА
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
            
            // ✅ ДОБАВЛЯЕМ ОБРАБОТЧИК ЗАКРЫТИЯ ТУЛТИПА
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
        <div class="popup-title">📋 ${districtName}</div>
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

    setTimeout(() => {
        if (mapInstance) {
            mapInstance.invalidateSize();
            console.log('📏 invalidateSize() выполнен после инициализации');
        }
    }, 100);

    // ✅ ЗАГРУЖАЕМ ДАННЫЕ ПАРАЛЛЕЛЬНО
    Promise.all([
        loadMapData(),
        loadDealsCSV()
    ]).then(() => {
        console.log('✅ Карта и данные загружены!');
        // После загрузки обоих — перерисовываем карту
        if (mapData) {
            renderMapLevel(currentLevel || 0, currentParentId);
            
            // ✅ ПРИНУДИТЕЛЬНОЕ ЦЕНТРИРОВАНИЕ ПОСЛЕ ЗАГРУЗКИ
            setTimeout(() => {
                console.log('📍 Принудительное центрирование после загрузки');
                if (mapInstance) {
                    mapInstance.invalidateSize();
                    mapInstance.setView([66.0, 76.0], 5);
                }
            }, 500);
        }
    }).catch(error => {
        console.error('❌ Ошибка загрузки:', error);
    });
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

function renderMapLevel(level, parentId = null) {
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
    
    if (!mapData || !mapInstance) {
        console.warn('⚠️ mapData или mapInstance не инициализированы');
        return;
    }

    console.log(`Фильтрация: level=${level}, parentId=${parentId}`);
    console.log(`Всего объектов в mapData: ${mapData.features.length}`);

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
            if (props.level === 1) return true;
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

    console.log(`Отфильтровано: ${filtered.length} объектов`);
    
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
        return cadNum.endsWith('000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    
    const normalQuarters = filtered.filter(f => {
        const cadNum = f.properties?.cadastral_number || '';
        return !cadNum.endsWith('000000') && !cadNum.match(/^\d{2}:\d{2}:000000$/);
    });
    console.log(`Оберток: ${wrapperQuarters.length}, кварталов: ${normalQuarters.length}`);

    // 🔥 СНАЧАЛА ДОБАВЛЯЕМ ОБЕРТКУ (БУДЕТ СНИЗУ)
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
                    
                    const medianPrice = prices.length > 0 ? getMedianSync(prices) : 0;
                    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                    const uprsMedian = uprsValues.length > 0 ? getMedianSync(uprsValues) : 0;
                    const upksMedian = upksValues.length > 0 ? getMedianSync(upksValues) : 0;
                    const cadCostMedian = cadCostValues.length > 0 ? getMedianSync(cadCostValues) : 0;
                    
                    const tooltipContent = `
                        <div style="text-align:right; margin-bottom:4px;">
                            <span onmousedown="event.stopPropagation(); event.preventDefault(); closeWrapperTooltip('${cadNum}'); return false;" 
                                  style="cursor:pointer; font-size:16px; font-weight:bold; color:#94a3b8; 
                                         background:transparent; border-radius:0; display:inline-block; 
                                         width:auto; height:auto; line-height:1; text-align:center;
                                         border:none; user-select:none; padding:0 2px;">
                                ✕
                            </span>
                        </div>
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
                        interactive: true
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

    // 🔥 ПОТОМ ДОБАВЛЯЕМ КВАРТАЛЫ (БУДУТ СВЕРХУ)
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
    if (mapInstance) {
    mapInstance.invalidateSize();
    console.log('📏 invalidateSize() выполнен после добавления слоев');
  }
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


    // ✅ КАРДИНАЛЬНОЕ РЕШЕНИЕ ДЛЯ ЦЕНТРИРОВАНИЯ С ПРИНУДИТЕЛЬНЫМИ ПОПЫТКАМИ
    function centerMap(attempt) {
        attempt = attempt || 1;
        console.log(`🔄 Попытка центрирования #${attempt}`);
        
        try {
            // ===== ДЛЯ УРОВНЯ 0 (ОКРУГ) - ВСЕГДА ЦЕНТР ЯНАО =====
            if (level === 0) {
                console.log('📍 УРОВЕНЬ ОКРУГА: центрируем на ЯНАО');
                mapInstance.setView([66.0, 76.0], 5);
                return true;
            }
            
            // ===== ДЛЯ УРОВНЯ 1 (РАЙОНЫ) =====
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
                    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
                    console.log('✅ Карта отцентрирована по районам');
                    return true;
                } else {
                    mapInstance.setView([66.0, 76.0], 6);
                    console.log('⚠️ Fallback: центрируем на ЯНАО с зумом 6');
                    return true;
                }
            }
            
            // ===== ДЛЯ УРОВНЯ 2 (КВАРТАЛЫ) =====
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
                    mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
                    console.log('✅ Карта отцентрирована по кварталам');
                    return true;
                } else {
                    // Если границы не найдены - показываем район
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
                                mapInstance.setView([lat, lng], 10);
                                console.log('📍 Центрируем на центр района');
                                return true;
                            }
                        }
                    }
                    mapInstance.setView([66.0, 76.0], 6);
                    console.log('⚠️ Fallback: центрируем на ЯНАО с зумом 6');
                    return true;
                }
            }
            
            // Fallback
            console.warn('⚠️ Неизвестный уровень, центрируем на ЯНАО');
            mapInstance.setView([66.0, 76.0], 5);
            return true;
            
        } catch(e) {
            console.warn('⚠️ Ошибка центрирования:', e);
            try {
                mapInstance.setView([66.0, 76.0], 5);
            } catch(err) {
                console.error('❌ Критическая ошибка центрирования:', err);
            }
            return true;
        }
    }

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

    if (window.wrapperLayer) {
        window.wrapperLayer.setStyle({
            fillOpacity: 0.25,
            weight: 1,
            color: '#ff0000',
            opacity: 0.4,
            dashArray: '4 4'
        });
    }
    
    // ✅ ОБНОВЛЯЕМ СТАТИСТИКУ С УЧЕТОМ ФИЛЬТРА
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

// Обновляем стили кварталов с учетом Heatmap
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
}
const originalRenderMapLevel = renderMapLevel;

renderMapLevel = function(level, parentId) {
    originalRenderMapLevel.call(this, level, parentId);
    setTimeout(() => {
        if (typeof renderPriceChart === 'function') {
            renderPriceChart();
        }
    }, 800);
};
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

    console.log(`Попап: всего кварталов для района ${districtId}: ${allQuarters.length}`);
        
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
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(weightedMedianCadCost)}</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUpks)}</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
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
    <div class="popup-row"><span class="popup-label">Кад. стоимость (медиана)</span><span class="popup-value">${formatPrice(weightedMedianCadCost)}</span></div>
    <div class="popup-row"><span class="popup-label">УПРС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUprs)}</span></div>
    <div class="popup-row"><span class="popup-label">УПКС (медиана)</span><span class="popup-value">${formatUprs(weightedMedianUpks)}</span></div>
    <div class="popup-row"><span class="popup-label">Мин / Макс</span><span class="popup-value">${formatNum(minPrice)} / ${formatNum(maxPrice)} ₽</span></div>
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
            console.log('Квартал выбран:', cadNum);
            console.log('Сделок:', dealsCount);
            window.selectedQuarterCadNumber = cadNum;
            
            // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
            renderDealsTable();
            
            // ✅ СОХРАНЯЕМ ID РАЙОНА ДЛЯ ОБНОВЛЕНИЯ ТАБЛИЦЫ ПРИ ЗАКРЫТИИ
            const districtId = props.parent_id || props.district_id;
            
            if (layer.getBounds && layer.getBounds().isValid()) {
                mapInstance.fitBounds(layer.getBounds(), { padding: [20, 20] });
            } else if (layer.getLatLng) {
                mapInstance.setView(layer.getLatLng(), 15);
            }
            layer.openPopup();
            
            // ✅ ДОБАВЛЯЕМ ОБРАБОТЧИК ЗАКРЫТИЯ ПОПАПА
            layer.off('popupclose');
            layer.on('popupclose', function(e) {
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
        // ✅ КВАРТАЛЫ — подсвечиваем
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
            // 🔥 РЕЖИМ HEATMAP: цвет по УПРС/УПКС
            if (filteredDeals.length > 0) {
                let totalUprs = 0, totalUpks = 0, count = 0;
           
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
                    
                    // 🎨 Та же шкала, что и в updateQuartersStyle
                    if (diff >= -5 && diff <= 5) {
                        fillColor = '#22c55e';      // Зеленый — УПРС ≈ УПКС
                    } else {
                        const absDiff = Math.abs(diff);
                        if (absDiff <= 20) {
                            fillColor = '#f97316';  // Оранжевый
                        } else {
                            fillColor = '#ef4444';  // Красный
                        }
                    }
                    fillOpacity = 0.5;
                    borderColor = '#60a5fa';
                    borderWeight = 2;
                    borderOpacity = 0.8;
                }
            }
        } else {
            // ❌ ОБЫЧНЫЙ РЕЖИМ: по количеству сделок
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
            return true;
        });
        
        let fillColor = '#f1f5f9';
        let fillOpacity = 0.2;
        let borderColor = '#3b82f6';
        let borderWeight = 2.5;
        let borderOpacity = 0.6;
        
        if (isHeatmapEnabled) {
            // 🔥 ВОССТАНАВЛИВАЕМ HEATMAP СТИЛЬ (ТА ЖЕ ЛОГИКА, ЧТО В updateQuartersStyle)
            if (filteredDeals.length > 0) {
                let totalUprs = 0, totalUpks = 0, count = 0;
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
                    
                    // 🎨 Та же шкала, что и в updateQuartersStyle
                    if (diff >= -5 && diff <= 5) {
                        fillColor = '#22c55e';      // Зеленый — УПРС ≈ УПКС
                    } else {
                        const absDiff = Math.abs(diff);
                        if (absDiff <= 20) {
                            fillColor = '#f97316';  // Оранжевый
                        } else {
                            fillColor = '#ef4444';  // Красный
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
            // ❌ ОБЫЧНЫЙ РЕЖИМ
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
    // Если мы на уровне кварталов (level === 2) и попап/тултип закрылся
    if (levelName === 'quarter' && districtId) {
        console.log('🔄 Закрытие попапа/тултипа квартала → обновление таблицы');
        
        // Сбрасываем выбранный квартал
        window.selectedQuarterCadNumber = null;
        
        // ✅ ТОЛЬКО ОБНОВЛЯЕМ ТАБЛИЦУ И СТАТИСТИКУ
        // НЕ МЕНЯЕМ УРОВЕНЬ КАРТЫ!
        
        // Обновляем таблицу сделок (покажет все сделки района)
        renderDealsTable();
        
        // Обновляем статистику для текущего уровня
        updateMapStatsFromDeals(currentLevel, currentParentId);
        
        // Обновляем список кварталов
        updateQuartersListWithFilteredObjects(null);
        
        // Обновляем активные фильтры
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
        return true;
    });
    
    const dealsCount = filteredDeals.length;
    const prices = filteredDeals.map(d => d.price).filter(p => p > 0);
    const uprsValues = filteredDeals.map(d => d.uprs).filter(u => u > 0);
    const upksValues = filteredDeals.map(d => d.upks).filter(u => u > 0);
    const cadCostValues = filteredDeals.map(d => d.cad_cost).filter(c => c > 0);
    
    // ✅ ВЫЧИСЛЯЕМ МЕДИАНЫ
    const medianPrice = getMedianSync(prices);
    const uprsMedian = getMedianSync(uprsValues);
    const upksMedian = getMedianSync(upksValues);
    const cadCostMedian = getMedianSync(cadCostValues);
    
    // ✅ ВЫЧИСЛЯЕМ minPrice И maxPrice ДЛЯ КВАРТАЛА
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
    if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
        window.mapLayer = null;
        console.log('🗺️ Карта уничтожена');
    }
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
    
    // ✅ ПРАВИЛЬНО: сбрасываем в пустые массивы
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
    
    // ✅ ДОБАВЬТЕ ЭТОТ БЛОК:
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
    
    // ✅ Собираем ВСЕ выбранные значения с их категориями
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
    
    // ✅ СОРТИРУЕМ ПО РАЗНИЦЕ (кадастр - цена) от самой низкой к самой высокой (по умолчанию)
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
    
    // ✅ ИСПРАВЛЕНО: увеличен шрифт до 11px, колонки адаптивные
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
            
            // ✅ ВЫЧИСЛЯЕМ РАЗНИЦУ (кадастр - цена)
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
            
            // ✅ ФОРМАТИРОВАНИЕ
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
    // Если кликнули по тому же полю — меняем направление сортировки
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
            
            // null (нет кадастра) идут в конец
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
        const numericFields = ['area', 'cad_cost', 'upks', 'deal_price_rub', 'uprs_rub', 'year_build'];
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
    
    // Перерисовываем таблицу с отсортированными данными
    // (используем ту же логику рендеринга, что и в renderDealsTable)
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
    
    // Ищем квартал по кадастровому номеру
    let found = mapData.features.find(f => {
        const cadNum = f.properties.cadastral_number || '';
        if (f.properties.level === 2) {
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
        console.log(`🔴 Найдена обертка: ${cadNum}`);
        window.selectedQuarterCadNumber = cadNum;
        
        // ✅ ПЕРЕХОДИМ НА УРОВЕНЬ РАЙОНОВ (1)
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
                foundLayer.setStyle({
                    fillOpacity: 0.4,
                    weight: 3,
                    color: '#ff0000',
                    opacity: 0.8
                });
            }
        }, 500);
        return;
    }
    
    // ✅ ОБЫЧНЫЙ КВАРТАЛ — ПРИБЛИЖАЕМ НА УРОВЕНЬ КВАРТАЛОВ (2)
    console.log(`🏘️ Обычный квартал: ${cadNum}, приближаем`);
    
    const districtId = found.properties.parent_id || found.properties.district_id;
    const districtName = found.properties.district_name || districtId || 'Район';
    
    // ✅ ПЕРЕХОДИМ НА УРОВЕНЬ 2 (КВАРТАЛЫ) С ЭТИМ РАЙОНОМ
    renderMapLevel(2, districtId);
    updateBreadcrumb('quarter', districtId, districtName, true);
    
    // ✅ СОХРАНЯЕМ ВЫБРАННЫЙ КВАРТАЛ
    window.selectedQuarterCadNumber = cadNum;
    
    // ✅ ПРИБЛИЖАЕМ К КВАРТАЛУ
    setTimeout(() => {
        if (window.mapLayer) {
            let foundLayer = null;
            window.mapLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    const layerCadNum = layer.feature.properties.cadastral_number || '';
                    if (layerCadNum === cadNum) {
                        foundLayer = layer;
                    }
                }
            });
            
            if (foundLayer) {
                console.log(`✅ Квартал ${cadNum} найден на карте, приближаем`);
                // ✅ ОТКРЫВАЕМ ПОПАП
                foundLayer.openPopup();
                // ✅ ПРИБЛИЖАЕМ К КВАРТАЛУ
                if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                    mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
                }
            } else {
                console.warn(`⚠️ Квартал ${cadNum} не найден в слоях`);
            }
        }
        // ✅ ОБНОВЛЯЕМ ТАБЛИЦУ
        renderDealsTable();
    }, 300);
}
function searchQuarterByCadNumber(cadNumber) {
    // ✅ ПРОВЕРЯЕМ ФЛАГ — ЕСЛИ УЖЕ В ПРОЦЕССЕ, ПРОПУСКАЕМ
    if (!cadNumber || isUpdatingFromSearch) {
        console.log('⏳ Пропускаем, уже в процессе обновления');
        return;
    }
    
    console.log(`🔍 Поиск квартала по номеру: ${cadNumber}`);
    isUpdatingFromSearch = true;  // ✅ УСТАНАВЛИВАЕМ ФЛАГ
    console.log('🔒 Флаг isUpdatingFromSearch = true');
    
    // 1. Ищем в mapData (level 2)
    let found = mapData.features.find(f => {
        if (f.properties.level !== 2) return false;
        return f.properties.cadastral_number === cadNumber;
    });
    
    // 2. Ищем в mapData (level 1 — обертки)
    if (!found) {
        found = mapData.features.find(f => {
            if (f.properties.level !== 1) return false;
            const cadNum = f.properties.cadastral_number || '';
            return cadNum === cadNumber;
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
        isUpdatingFromSearch = false;  // ✅ СБРАСЫВАЕМ ФЛАГ
        return;
    }
    
    console.log(`✅ Найден квартал: ${found.properties.cadastral_number}`);
    
    const cadNum = found.properties.cadastral_number || cadNumber;
    const isWrapper = cadNum.endsWith('000000') || cadNum.match(/^\d{2}:\d{2}:000000$/);
    
    // ✅ ДЛЯ ОБЕРТОК — ПОКАЗЫВАЕМ НА УРОВНЕ РАЙОНОВ (1), НО ПРИБЛИЖАЕМ К ОБЕРТКЕ
    if (isWrapper) {
        console.log(`🔴 Найдена обертка: ${cadNum}, показываем на уровне районов с приближением`);
        window.selectedQuarterCadNumber = cadNum;
        
        // ✅ Переходим на уровень районов (1)
        renderMapLevel(1);
        updateBreadcrumb('okrug');
        renderDealTypeFilters();
        renderCityFilters();
        renderObjectTypeFilters();
        renderWallMaterialFilters();
        renderQuarterFilters();
        renderYearBuildFilters();
        renderDealsTable();
        
        // ✅ Ищем и приближаем к обертке
        setTimeout(() => {
            let foundLayer = null;
            
            // Ищем в wrapperLayer
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
                console.log(`✅ Обертка ${cadNum} найдена, приближаем`);
                if (foundLayer.openTooltip) {
                    foundLayer.openTooltip();
                }
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
                console.warn(`⚠️ Обертка ${cadNum} не найдена в слоях`);
                const prefix = cadNum.substring(0, 5);
                const districtFeature = mapData.features.find(f => 
                    f.properties.level === 1 && 
                    f.properties.cadastral_number && 
                    f.properties.cadastral_number.startsWith(prefix)
                );
                if (districtFeature && districtFeature.geometry) {
                    const coords = districtFeature.geometry.coordinates[0];
                    if (coords && coords.length > 0) {
                        let lat = 0, lng = 0;
                        coords.forEach(c => { lat += c[1]; lng += c[0]; });
                        lat /= coords.length;
                        lng /= coords.length;
                        mapInstance.setView([lat, lng], 10);
                    }
                }
            }
            isUpdatingFromSearch = false;  // ✅ СБРАСЫВАЕМ ФЛАГ
            console.log('🔓 Флаг isUpdatingFromSearch = false (освобожден)');
        }, 500);
        
        return;
    }
    
    // ✅ ОБЫЧНЫЙ КВАРТАЛ — ПРИБЛИЖАЕМ НА УРОВЕНЬ 2
    console.log(`🏘️ Обычный квартал: ${cadNum}, приближаем на уровень кварталов`);
    
    const districtId = found.properties.parent_id || found.properties.district_id;
    const districtName = found.properties.district_name || districtId || 'Район';
    
    // ✅ Переходим на уровень 2 (кварталы) С ФЛАГОМ
    renderMapLevelWithFlag(2, districtId, true);
    updateBreadcrumb('quarter', districtId, districtName, true);
    
    window.selectedQuarterCadNumber = cadNum;
    
    // ✅ Приближаем к кварталу
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
                console.log(`✅ Квартал ${cadNum} найден, приближаем`);
                foundLayer.openPopup();
                if (foundLayer.getBounds && foundLayer.getBounds().isValid()) {
                    mapInstance.fitBounds(foundLayer.getBounds(), { padding: [40, 40] });
                }
            }
        }
        renderDealsTable();
        isUpdatingFromSearch = false;  // ✅ СБРАСЫВАЕМ ФЛАГ
        console.log('🔓 Флаг isUpdatingFromSearch = false (освобожден)');
    }, 300);
}
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
    
    // ✅ СБРАСЫВАЕМ ВСЕ СОСТОЯНИЯ
    window.selectedQuarterCadNumber = null;
    currentLevel = 0;
    currentParentId = null;
    currentDistrictFilter = null;
    
    // ✅ ЗАКРЫВАЕМ ВСЕ ТУЛТИПЫ В ОБЕРТКЕ
    if (window.wrapperLayer) {
        window.wrapperLayer.eachLayer(function(layer) {
            layer.closeTooltip();
        });
    }
    
    // ✅ ЗАКРЫВАЕМ ВСЕ ТУЛТИПЫ НА КАРТЕ
    if (mapInstance) {
        mapInstance.closePopup();
    }
    
    // ✅ ПЕРЕРИСОВЫВАЕМ КАРТУ НА УРОВНЕ ОКРУГА
    renderMapLevel(0);
    updateBreadcrumb('okrug');
    
    // ✅ ОБНОВЛЯЕМ ВСЕ ДАННЫЕ
    updateMapStatsFromDeals(0, null);
    updateQuartersListWithFilteredObjects(null);
    updateActiveFiltersDisplay();
    addMapLegend();
    renderDealsTable();
    
    // Центрируем карту на округе
    setTimeout(function() {
        if (window.mapLayer && typeof window.mapLayer.getBounds === 'function' && window.mapLayer.getBounds().isValid()) {
            mapInstance.fitBounds(window.mapLayer.getBounds(), { padding: [30, 30] });
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
console.log('✅ map-tab.js загружен');
(function autoCenterOnLoad() {
    // Проверяем, что mapInstance существует
    if (typeof mapInstance !== 'undefined' && mapInstance) {
        console.log('🔄 Автоматическое центрирование при загрузке');
        mapInstance.invalidateSize();
        mapInstance.setView([66.0, 76.0], 5);
        
        // Повторная проверка через 1 секунду
        setTimeout(() => {
            if (mapInstance) {
                mapInstance.invalidateSize();
                const center = mapInstance.getCenter();
                if (Math.abs(center.lat - 66.0) > 1 || Math.abs(center.lng - 76.0) > 1) {
                    console.warn('⚠️ Центр сместился, восстанавливаем...');
                    mapInstance.setView([66.0, 76.0], 5);
                }
            }
        }, 1000);
    } else {
        // Если карта еще не создана - пробуем через 500ms
        console.log('⏳ Карта еще не создана, пробуем позже...');
        setTimeout(() => {
            if (typeof mapInstance !== 'undefined' && mapInstance) {
                console.log('🔄 Автоматическое центрирование (отложенное)');
                mapInstance.invalidateSize();
                mapInstance.setView([66.0, 76.0], 5);
            }
        }, 500);
    }
})();
