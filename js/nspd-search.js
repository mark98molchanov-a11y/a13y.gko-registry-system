// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ
// ============================================================
(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    const TOLERANCE = 0.2;

    // 🔥 СПИСОК ПАРАМЕТРОВ С ПРАВИЛЬНЫМИ ПРИОРИТЕТАМИ
    const SEARCH_PARAMS = {
        // 📐 ПЛОЩАДНЫЕ ПАРАМЕТРЫ → поиск по КВАРТАЛАМ
        'area': {
            label: 'Площадь (м²)',
            getValue: (opts) => {
                return parseFloat(opts.params_area) || 
                       parseFloat(opts.area) || 
                       parseFloat(opts.specified_area) || 0;
            },
            searchType: 'quarter'
        },
        'built_up_area': {
            label: 'Площадь застройки (м²)',
            getValue: (opts) => {
                return parseFloat(opts.params_built_up_area) || 
                       parseFloat(opts.built_up_area) || 
                       parseFloat(opts.area) || 0;
            },
            searchType: 'quarter'
        },
        'specified_area': {
            label: 'Площадь ЗУ (м²)',
            getValue: (opts) => {
                return parseFloat(opts.specified_area) || 
                       parseFloat(opts.params_area) || 
                       parseFloat(opts.area) || 0;
            },
            searchType: 'quarter'
        },
        
        // 📏 ОСТАЛЬНЫЕ ПАРАМЕТРЫ → поиск по АДРЕСУ
        'extension': {
            label: 'Протяженность (м)',
            getValue: (opts) => {
                return parseFloat(opts.params_extension) || 
                       parseFloat(opts.extension) || 0;
            },
            searchType: 'address'
        },
        'volume': {
            label: 'Объем (м³)',
            getValue: (opts) => {
                return parseFloat(opts.params_volume) || 
                       parseFloat(opts.volume) || 0;
            },
            searchType: 'address'
        },
        'height': {
            label: 'Высота (м)',
            getValue: (opts) => {
                return parseFloat(opts.params_height) || 
                       parseFloat(opts.height) || 0;
            },
            searchType: 'address'
        },
        'depth': {
            label: 'Глубина (м)',
            getValue: (opts) => {
                return parseFloat(opts.params_depth) || 
                       parseFloat(opts.depth) || 0;
            },
            searchType: 'address'
        },
        'occurence_depth': {
            label: 'Глубина залегания (м)',
            getValue: (opts) => {
                return parseFloat(opts.params_occurence_depth) || 
                       parseFloat(opts.occurence_depth) || 0;
            },
            searchType: 'address'
        }
    };

    // ============================================================
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ============================================================
    
    function getAddress(opts) {
        return opts.address_readable_address || opts.readable_address || '';
    }

    function extractCadastralQuarter(cadNumber) {
        if (!cadNumber) return '';
        const parts = cadNumber.split(':');
        if (parts.length >= 3) {
            return parts.slice(0, 3).join(':');
        }
        return '';
    }

    function formatPrice(num) {
        if (!num || num === 0) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    }

    function getFloorValue(floor) {
        if (!floor) return '—';
        let floorStr = floor;
        if (Array.isArray(floor)) floorStr = floor.length > 0 ? floor[0] : '—';
        if (typeof floorStr !== 'string') floorStr = String(floorStr);
        const match = floorStr.match(/^(\d+)/);
        return match ? match[1] : floorStr;
    }

    // 🔥 ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ВАЛИДНОСТИ ОБЪЕКТА
    function isValidObject(opts) {
        // 1. Должен быть кадастровый номер
        const cadNumber = opts.cad_number || '';
        if (!cadNumber || cadNumber.length < 10) return false;
        
        // 2. Должен быть регион (первая часть кадастрового номера)
        const region = cadNumber.split(':')[0];
        if (!region || region.length < 2) return false;
        
        // 3. Должен быть квартал
        const quarter = extractCadastralQuarter(cadNumber);
        if (!quarter || quarter.length < 10) return false;
        
        return true;
    }

    // 🔥 ФУНКЦИЯ ДЛЯ ПРОВЕРКИ СООТВЕТСТВИЯ РЕГИОНА
    function isSameRegion(cadNumber, targetAddress) {
        const region = cadNumber.split(':')[0];
        
        // Карта регионов
        const regionMap = {
            '89': ['Ямало-Ненецкий', 'Ямальский', 'Салехард', 'Ноябрьск', 'Надым', 'Новый Уренгой', 'Губкинский', 'Муравленко', 'Лабытнанги'],
            '34': ['Волгоград', 'Волгоградская'],
            '77': ['Москва', 'Московская'],
            '78': ['Санкт-Петербург'],
            '47': ['Ленинградская'],
            '20': ['Чеченская', 'Чечня'],
            '03': ['Бурятия']
        };
        
        const keywords = regionMap[region] || [];
        if (keywords.length === 0) return true;
        
        return keywords.some(keyword => targetAddress.includes(keyword));
    }

    // ============================================================
    // 🔥 ПОИСК ПО КВАРТАЛАМ (для площадных параметров)
    // ============================================================
    async function findQuartersByAddress(address, signal) {
        const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=200`;
        const response = await fetch(url, {
            signal: signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) return new Set();
        
        const data = await response.json();
        const features = data?.data?.features || [];
        const quarters = new Set();
        
        for (const feature of features) {
            const opts = feature.properties?.options || {};
            const cadNumber = opts.cad_number || '';
            
            // 🔥 ПРОВЕРЯЕМ ВАЛИДНОСТЬ ОБЪЕКТА
            if (!isValidObject(opts)) continue;
            
            // 🔥 ПРОВЕРЯЕМ РЕГИОН
            if (!isSameRegion(cadNumber, address)) continue;
            
            const quarter = extractCadastralQuarter(cadNumber);
            if (quarter) quarters.add(quarter);
        }
        return quarters;
    }

    async function searchInQuarter(quarter, paramKey, value, signal) {
        const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=500`;
        const response = await fetch(url, {
            signal: signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) return [];
        
        const data = await response.json();
        const features = data?.data?.features || [];
        const param = SEARCH_PARAMS[paramKey];
        
        // 🔥 ФИЛЬТРУЕМ ОБЪЕКТЫ
        const validFeatures = features.filter(f => {
            const opts = f.properties?.options || {};
            
            // 1. Проверяем наличие кадастрового номера
            if (!isValidObject(opts)) return false;
            
            // 2. Проверяем регион (квартал должен совпадать с регионом объекта)
            const cadNumber = opts.cad_number || '';
            const regionFromCad = cadNumber.split(':')[0];
            const regionFromQuarter = quarter.split(':')[0];
            if (regionFromCad !== regionFromQuarter) return false;
            
            // 3. Проверяем значение параметра
            if (value > 0) {
                const paramValue = param.getValue(opts);
                if (paramValue <= 0) return false;
                if (Math.abs(paramValue - value) > TOLERANCE) return false;
            }
            
            return true;
        });
        
        return validFeatures;
    }

    // ============================================================
    // 🔥 ПОИСК ПО АДРЕСУ (для остальных параметров)
    // ============================================================
    async function searchByAddress(address, paramKey, value, signal) {
        const param = SEARCH_PARAMS[paramKey];
        
        const variants = [
            address,
            address.split(',').slice(0, -1).join(',').trim(),
            address.split(',').slice(0, -2).join(',').trim(),
            address.split(',').slice(0, 1).join(',').trim()
        ].filter(a => a && a.length > 0);
        
        const uniqueVariants = [...new Set(variants)];
        let allFound = [];
        const seenCadNumbers = new Set();
        
        for (const variant of uniqueVariants) {
            const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(variant)}&thematicSearchId=1&limit=200`;
            const response = await fetch(url, {
                signal: signal,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const features = data?.data?.features || [];
                
                const filtered = features.filter(f => {
                    const opts = f.properties?.options || {};
                    
                    // 🔥 ПРОВЕРЯЕМ ВАЛИДНОСТЬ ОБЪЕКТА
                    if (!isValidObject(opts)) return false;
                    
                    // 🔥 ПРОВЕРЯЕМ РЕГИОН
                    const cadNumber = opts.cad_number || '';
                    if (!isSameRegion(cadNumber, address)) return false;
                    
                    const paramValue = param.getValue(opts);
                    if (value > 0) {
                        if (paramValue <= 0) return false;
                        if (Math.abs(paramValue - value) > TOLERANCE) return false;
                    }
                    
                    return true;
                });
                
                for (const f of filtered) {
                    const opts = f.properties?.options || {};
                    const cadNumber = opts.cad_number || '';
                    if (cadNumber && !seenCadNumbers.has(cadNumber)) {
                        seenCadNumbers.add(cadNumber);
                        allFound.push(f);
                    }
                }
            }
        }
        
        return allFound;
    }

    // ============================================================
    // 🔥 ФОРМАТИРОВАНИЕ КАНДИДАТА
    // ============================================================
    function formatCandidate(feature, paramKey) {
        const opts = feature.properties?.options || {};
        const param = SEARCH_PARAMS[paramKey];
        const paramValue = param ? param.getValue(opts) : 0;
        
        return {
            feature: feature,
            paramValue: paramValue,
            paramKey: paramKey,
            address: getAddress(opts),
            cadNumber: opts.cad_number || '—',
            type: opts.object_type_value || opts.type || '—',
            cadastralCost: parseFloat(opts.cost_value) || 0,
            name: opts.params_name || opts.name || '',
            determination_couse: opts.determination_couse || '',
            rawData: { opts: opts }
        };
    }

    // ============================================================
    // 🔥 ПОКАЗ РЕЗУЛЬТАТОВ
    // ============================================================
    function displayResults(container, candidates, searchMethod, searchQuery, searchValue, paramKey) {
        if (candidates.length === 0) {
            const param = SEARCH_PARAMS[paramKey];
            container.innerHTML = `
                <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                    🔍 Объекты не найдены<br>
                    <span class="text-xs">Метод: ${searchMethod}</span>
                    ${searchQuery ? `<br><span class="text-xs">Запрос: ${searchQuery}</span>` : ''}
                    ${param ? `<br><span class="text-xs">Параметр: ${param.label}</span>` : ''}
                    ${searchValue > 0 ? `<br><span class="text-xs">Значение: ${searchValue} ±${TOLERANCE}</span>` : ''}
                </div>
            `;
            return;
        }

        const param = SEARCH_PARAMS[paramKey];
        const paramLabel = param ? param.label : 'Параметр';

        const tableData = candidates.map(item => {
            const opts = item.rawData.opts || {};
            const objectType = item.type || opts.object_type_value || opts.categoryName || '';
            
            let upksValue = parseFloat(opts.cost_index) || 0;
            if (upksValue === 0) {
                const cost = parseFloat(opts.cost_value) || 0;
                const area = parseFloat(opts.params_area) || parseFloat(opts.area) || parseFloat(opts.specified_area) || 0;
                if (cost > 0 && area > 0) upksValue = cost / area;
            }

            const objectName = opts.params_name || opts.name || opts.building_name || objectType || '';
            const address = getAddress(opts);
            
            const area = parseFloat(opts.params_area) || parseFloat(opts.area) || parseFloat(opts.specified_area) || 0;
            const builtUpArea = parseFloat(opts.params_built_up_area) || parseFloat(opts.built_up_area) || 0;
            const extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
            const volume = parseFloat(opts.params_volume) || parseFloat(opts.volume) || 0;
            const height = parseFloat(opts.params_height) || parseFloat(opts.height) || 0;
            const depth = parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
            const occurenceDepth = parseFloat(opts.params_occurence_depth) || parseFloat(opts.occurence_depth) || 0;

            return {
                'Кадастровый номер': item.cadNumber || '—',
                'Наименование': objectName || '—',
                'Тип объекта': objectType || '—',
                'Адрес': address || '—',
                'Площадь (м²)': area > 0 ? area.toFixed(1) : '—',
                'Площадь застройки (м²)': builtUpArea > 0 ? builtUpArea.toFixed(1) : '—',
                'Протяженность (м)': extension > 0 ? extension.toFixed(1) : '—',
                'Объем (м³)': volume > 0 ? volume.toFixed(1) : '—',
                'Высота (м)': height > 0 ? height.toFixed(1) : '—',
                'Глубина (м)': depth > 0 ? depth.toFixed(1) : '—',
                'Глубина залегания (м)': occurenceDepth > 0 ? occurenceDepth.toFixed(1) : '—',
                'Кадастровая стоимость': opts.cost_value ? formatPrice(parseFloat(opts.cost_value)) : '—',
                'УПКС (₽/м²)': upksValue > 0 ? upksValue.toFixed(2) : '—',
                'Назначение': opts.params_purpose || opts.purpose || opts.permitted_use_established_by_document || '—',
                'Статус': opts.common_data_status || opts.status || '—',
                'Форма собственности': opts.ownership_type || '—',
                'Этаж': getFloorValue(opts.params_floors || opts.floor),
                'Год постройки': opts.params_year_built || opts.year_built || '—',
                'Основание оценки': opts.determination_couse || '—'
            };
        });

        const columnsToShow = Object.keys(tableData[0] || {});
        const firstColumn = paramLabel;
        const orderedColumns = [firstColumn, ...columnsToShow.filter(col => col !== firstColumn)];

        let tableHtml = `
            <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" style="max-height: 600px; overflow-y: auto;">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif;">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 30px;">#</th>
                                ${orderedColumns.map(col => `
                                    <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: ${col.includes('Кадастровый') ? '150px' : col.includes('Адрес') ? '200px' : '100px'}; max-width: ${col.includes('Адрес') ? '250px' : '200px'};">
                                        ${col}
                                    </th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
        `;

        tableData.forEach((row, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            
            tableHtml += `
                <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" 
                    onmouseover="this.style.background='#f0f9ff'" 
                    onmouseout="this.style.background='${bgColor}'">
                    <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                    ${orderedColumns.map(col => {
                        let value = row[col] || '—';
                        if (col === 'Основание оценки' && value.length > 100) {
                            value = value.substring(0, 100) + '...';
                        }
                        return `
                            <td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" 
                                title="${value}">
                                ${value}
                            </td>
                        `;
                    }).join('')}
                </tr>
            `;
        });

        tableHtml += `
                        </tbody>
                    </table>
                </div>
            </div>
            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; padding: 0 4px; flex-wrap: wrap; gap: 8px;">
                <span>Найдено объектов: <strong>${candidates.length}</strong></span>
                <span style="font-size: 10px; color: #94a3b8;">Метод: ${searchMethod}</span>
                <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                        style="padding: 4px 16px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.2s;"
                        onmouseover="this.style.background='#fee2e2'"
                        onmouseout="this.style.background='#fef2f2'">
                    ✕ Очистить результаты
                </button>
            </div>
        `;

        container.innerHTML = tableHtml;
    }

    // ============================================================
    // 🔥 ОСНОВНАЯ ФУНКЦИЯ ПОИСКА
    // ============================================================
    async function performSearch(addressInput, paramSelect, valueInput, resultsContainer) {
        const address = addressInput.value.trim();
        const paramKey = paramSelect.value;
        const value = parseFloat(valueInput.value) || 0;

        if (!address && value <= 0) {
            resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Введите адрес и/или значение параметра.</div>`;
            return;
        }

        if (!address) {
            resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Введите адрес.</div>`;
            return;
        }

        const param = SEARCH_PARAMS[paramKey];
        if (!param) {
            resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Неизвестный параметр.</div>`;
            return;
        }

        resultsContainer.innerHTML = `
            <div class="flex justify-center items-center py-8 text-slate-500">
                <svg class="animate-spin h-5 w-5 mr-3 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Поиск в НСПД...
            </div>
        `;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            let candidates = [];
            let searchMethod = '';

            if (param.searchType === 'quarter') {
                searchMethod = `кварталы + ${param.label}`;
                const quarters = await findQuartersByAddress(address, controller.signal);
                console.log(`🏘️ Найдено ${quarters.size} кварталов`);
                
                for (const quarter of quarters) {
                    const features = await searchInQuarter(quarter, paramKey, value, controller.signal);
                    if (features.length > 0) {
                        const formatted = features.map(f => formatCandidate(f, paramKey));
                        candidates = candidates.concat(formatted);
                        console.log(`   ✅ В квартале ${quarter} найдено ${features.length} объектов`);
                    }
                }
            } else {
                searchMethod = `адрес + ${param.label}`;
                const features = await searchByAddress(address, paramKey, value, controller.signal);
                candidates = features.map(f => formatCandidate(f, paramKey));
                console.log(`✅ Найдено ${candidates.length} объектов по адресу`);
            }

            clearTimeout(timeoutId);

            if (candidates.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                        🔍 Объекты не найдены<br>
                        <span class="text-xs">Метод: ${searchMethod}</span>
                        ${address ? `<br><span class="text-xs">Адрес: ${address}</span>` : ''}
                        ${value > 0 ? `<br><span class="text-xs">Параметр: ${param.label} = ${value} ±${TOLERANCE}</span>` : ''}
                    </div>
                `;
                return;
            }

            if (value > 0) {
                candidates.sort((a, b) => Math.abs(a.paramValue - value) - Math.abs(b.paramValue - value));
            }

            displayResults(resultsContainer, candidates, searchMethod, address, value, paramKey);

        } catch (error) {
            console.error('❌ Ошибка:', error);
            resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ ${error.message}</div>`;
        }
    }

    // ============================================================
    // 🔥 ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    window.initNSPDSearch = function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Контейнер ${containerId} не найден`);
            return;
        }

        let paramOptions = '';
        for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
            paramOptions += `<option value="${key}">${param.label}</option>`;
        }

        container.innerHTML = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">🔍 Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Адрес / Квартал</label>
                        <input type="text" id="nspd-search-address" 
                               placeholder="Введите адрес или кадастровый квартал" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Параметр поиска</label>
                        <select id="nspd-search-param" 
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition bg-white">
                            ${paramOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Значение</label>
                        <input type="number" id="nspd-search-value" 
                               placeholder="Введите значение" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                        <span class="text-xs text-slate-400 mt-1 block" id="nspd-search-unit">Допуск ±0.2</span>
                    </div>
                </div>

                <button id="nspd-search-btn" 
                        class="w-full md:w-auto px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Найти объект
                </button>

                <div id="nspd-search-results" class="mt-6">
                    <div class="text-center text-slate-400 py-8 text-sm">
                        Введите адрес, выберите параметр и значение, нажмите "Найти объект"
                    </div>
                </div>
            </div>
        `;

        const searchBtn = document.getElementById('nspd-search-btn');
        const addressInput = document.getElementById('nspd-search-address');
        const paramSelect = document.getElementById('nspd-search-param');
        const valueInput = document.getElementById('nspd-search-value');
        const unitLabel = document.getElementById('nspd-search-unit');
        const resultsContainer = document.getElementById('nspd-search-results');

        paramSelect.addEventListener('change', function() {
            const param = SEARCH_PARAMS[this.value];
            if (param) {
                const unit = param.label.split('(').pop().replace(')', '');
                unitLabel.textContent = `Допуск ±0.2 ${unit}`;
            }
        });

        const runSearch = () => performSearch(addressInput, paramSelect, valueInput, resultsContainer);
        searchBtn.addEventListener('click', runSearch);
        [addressInput, valueInput].forEach(input => {
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
        });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
