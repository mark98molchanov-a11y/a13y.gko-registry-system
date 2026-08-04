// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД - СМЕШАННАЯ ЛОГИКА ПОИСКА
// ============================================================
(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    const TOLERANCE = 0.2;

    // 🔥 СПИСОК ДОСТУПНЫХ ПАРАМЕТРОВ ДЛЯ ПОИСКА
    const SEARCH_PARAMS = {
        'area': {
            label: 'Площадь (area)',
            getValue: (opts) => parseFloat(opts.area) || parseFloat(opts.params_area) || parseFloat(opts.specified_area) || 0,
            unit: 'м²',
            searchType: 'quarter' // 🔥 Ищем через кварталы
        },
        'built_up_area': {
            label: 'Площадь застройки (built_up_area)',
            getValue: (opts) => parseFloat(opts.params_built_up_area) || parseFloat(opts.built_up_area) || parseFloat(opts.area) || 0,
            unit: 'м²',
            searchType: 'quarter' // 🔥 Ищем через кварталы
        },
        'extension': {
            label: 'Протяженность (extension)',
            getValue: (opts) => parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
            unit: 'м',
            searchType: 'address' // 🔥 Ищем через адрес
        },
        'volume': {
            label: 'Объем (volume)',
            getValue: (opts) => parseFloat(opts.params_volume) || parseFloat(opts.volume) || 0,
            unit: 'м³',
            searchType: 'address' // 🔥 Ищем через адрес
        },
        'height': {
            label: 'Высота (height)',
            getValue: (opts) => parseFloat(opts.params_height) || parseFloat(opts.height) || 0,
            unit: 'м',
            searchType: 'address' // 🔥 Ищем через адрес
        },
        'depth': {
            label: 'Глубина (depth)',
            getValue: (opts) => parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
            unit: 'м',
            searchType: 'address' // 🔥 Ищем через адрес
        }
    };

    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function extractQuarterFromAddress(address) {
        if (!address) return null;
        const match = address.match(/\b(\d{2}:\d{2}:\d{6}(?::\d+)?)\b/);
        if (match) {
            const parts = match[1].split(':');
            if (parts.length >= 3) {
                return parts.slice(0, 3).join(':');
            }
        }
        return null;
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

    function getAddress(opts, props) {
        return opts.readable_address || opts.address_readable_address || props.descr || '';
    }

    window.initNSPDSearch = function(containerId) {
        console.log(`🔍 Инициализация поиска НСПД в контейнере: ${containerId}`);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Контейнер ${containerId} не найден`);
            return;
        }

        container.innerHTML = '';

        let paramOptions = '';
        for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
            paramOptions += `<option value="${key}">${param.label}</option>`;
        }

        const html = `
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
        container.innerHTML = html;

        const searchBtn = document.getElementById('nspd-search-btn');
        const addressInput = document.getElementById('nspd-search-address');
        const paramSelect = document.getElementById('nspd-search-param');
        const valueInput = document.getElementById('nspd-search-value');
        const unitLabel = document.getElementById('nspd-search-unit');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !addressInput || !paramSelect || !valueInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        paramSelect.addEventListener('change', function() {
            const paramKey = this.value;
            const param = SEARCH_PARAMS[paramKey];
            if (param) {
                unitLabel.textContent = `Допуск ±0.2 ${param.unit}`;
            }
        });

        function formatCandidate(feature, paramKey) {
            const props = feature.properties || {};
            const opts = props.options || {};
            const param = SEARCH_PARAMS[paramKey];
            
            const paramValue = param ? param.getValue(opts) : 0;
            
            return {
                feature: feature,
                paramValue: paramValue,
                paramKey: paramKey,
                address: opts.address_readable_address || opts.readable_address || '',
                cadNumber: opts.cad_number || opts.externalKey || '—',
                type: opts.type || opts.object_type_value || '—',
                cadastralCost: parseFloat(opts.cost_value) || 0,
                name: opts.params_name || opts.name || '',
                determination_couse: opts.determination_couse || '',
                rawData: { feature, opts, props }
            };
        }

        function displayResults(candidates, searchMethod, searchQuery, searchValue, paramKey) {
            if (candidates.length === 0) {
                const param = SEARCH_PARAMS[paramKey];
                resultsContainer.innerHTML = `
                    <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                        🔍 Объекты не найдены<br>
                        <span class="text-xs">Метод: ${searchMethod}</span>
                        ${searchQuery ? `<br><span class="text-xs">Запрос: ${searchQuery}</span>` : ''}
                        ${param ? `<br><span class="text-xs">Параметр: ${param.label}</span>` : ''}
                        ${searchValue > 0 ? `<br><span class="text-xs">Значение: ${searchValue} ${param ? param.unit : ''}</span>` : ''}
                    </div>
                `;
                return;
            }

            const param = SEARCH_PARAMS[paramKey];
            const paramLabel = param ? param.label : 'Параметр';

            const tableData = candidates.map(item => {
                const opts = item.rawData.opts || {};
                const objectType = item.type || opts.categoryName || '';
                const isLand = objectType.includes('Земельный участок') || 
                              objectType.includes('Земельный') || 
                              objectType.includes('земельный участок');
                
                let upksValue = parseFloat(opts.cost_index) || 0;
                if (upksValue === 0) {
                    const cost = parseFloat(opts.cost_value) || 0;
                    const area = parseFloat(opts.specified_area) || parseFloat(opts.area) || 0;
                    if (cost > 0 && area > 0) upksValue = cost / area;
                }

                let objectName = opts.params_name || opts.name || opts.building_name || '';
                if (!objectName && objectType) objectName = objectType;

                const floorValue = getFloorValue(opts.floor);
                const extensionValue = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                const address = getAddress(opts, opts);
                const determinationCouse = opts.determination_couse || '';
                const builtUpArea = parseFloat(opts.params_built_up_area) || parseFloat(opts.built_up_area) || 0;
                const volume = parseFloat(opts.params_volume) || parseFloat(opts.volume) || 0;
                const height = parseFloat(opts.params_height) || parseFloat(opts.height) || 0;
                const depth = parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
                const area = parseFloat(opts.area) || parseFloat(opts.params_area) || parseFloat(opts.specified_area) || 0;

                return {
                    'Кадастровый номер': item.cadNumber || '—',
                    'Наименование': objectName || '—',
                    'Тип объекта': objectType || '—',
                    'Адрес': address || '—',
                    'Площадь (м²)': area > 0 ? area.toFixed(1) : '—',
                    'Площадь застройки (м²)': builtUpArea > 0 ? builtUpArea.toFixed(1) : '—',
                    'Протяженность (м)': extensionValue > 0 ? extensionValue.toFixed(1) : '—',
                    'Объем (м³)': volume > 0 ? volume.toFixed(1) : '—',
                    'Высота (м)': height > 0 ? height.toFixed(1) : '—',
                    'Глубина (м)': depth > 0 ? depth.toFixed(1) : '—',
                    'Кадастровая стоимость': opts.cost_value ? formatPrice(parseFloat(opts.cost_value)) : '—',
                    'УПКС (₽/м²)': upksValue > 0 ? upksValue.toFixed(2) : '—',
                    'Назначение': opts.purpose || opts.params_purpose || opts.permitted_use_established_by_document || '—',
                    'Статус': opts.common_data_status || opts.status || '—',
                    'Форма собственности': opts.ownership_type || '—',
                    'Этаж': floorValue,
                    'Год постройки': opts.year_built || opts.params_year_built || '—',
                    'Основание оценки': determinationCouse || '—'
                };
            });

            const columnsToShow = Object.keys(tableData[0] || {});
            const firstColumn = paramLabel;
            const restColumns = columnsToShow.filter(col => col !== firstColumn);
            const orderedColumns = [firstColumn, ...restColumns];

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
                
                const paramValue = row[firstColumn];
                const isMatch = paramValue !== '—' && 
                               searchValue > 0 && 
                               Math.abs(parseFloat(paramValue) - searchValue) <= TOLERANCE;
                
                const highlightStyle = isMatch ? 'background: #dbeafe; border-left: 3px solid #3b82f6;' : '';
                
                tableHtml += `
                    <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; ${highlightStyle}" 
                        onmouseover="this.style.background='#f0f9ff'" 
                        onmouseout="this.style.background='${isMatch ? '#dbeafe' : bgColor}'">
                        <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                        ${orderedColumns.map(col => {
                            let value = row[col] || '—';
                            if (col === 'Основание оценки' && value.length > 100) value = value.substring(0, 100) + '...';
                            
                            if (col === firstColumn && value !== '—' && searchValue > 0) {
                                const numVal = parseFloat(value);
                                if (Math.abs(numVal - searchValue) <= TOLERANCE) {
                                    return `<td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; font-weight: 700; color: #2563eb;">${value}</td>`;
                                }
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

            resultsContainer.innerHTML = tableHtml;
        }

        async function performSearch() {
            const address = addressInput.value.trim();
            const paramKey = paramSelect.value;
            const value = parseFloat(valueInput.value) || 0;

            if (!address && value <= 0) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес и/или значение параметра.</div>`;
                return;
            }

            if (!address) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес.</div>`;
                return;
            }

            const param = SEARCH_PARAMS[paramKey];
            if (!param) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Неизвестный параметр: ${paramKey}</div>`;
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

                // ============================================================
                // 🔥 ВЫБОР ЛОГИКИ ПОИСКА В ЗАВИСИМОСТИ ОТ ПАРАМЕТРА
                // ============================================================
                if (param.searchType === 'quarter') {
                    // ============================================================
                    // 🔥 ЛОГИКА ДЛЯ area И built_up_area — ПОИСК ПО КВАРТАЛАМ
                    // ============================================================
                    console.log(`🔍 Поиск по КВАРТАЛАМ для параметра: ${paramKey}, значение: ${value}`);
                    
                    // ШАГ 1: Находим кварталы по адресу
                    const firstUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=200`;
                    const firstResponse = await fetch(firstUrl, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    if (!firstResponse.ok) {
                        throw new Error(`Ошибка API НСПД: ${firstResponse.status}`);
                    }

                    const firstData = await firstResponse.json();
                    const firstFeatures = firstData?.data?.features || [];
                    console.log(`📥 По адресу получено ${firstFeatures.length} объектов`);

                    if (firstFeatures.length === 0) {
                        clearTimeout(timeoutId);
                        resultsContainer.innerHTML = `
                            <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                                🔍 Объекты не найдены по адресу: ${address}
                            </div>
                        `;
                        return;
                    }

                    // ШАГ 2: Собираем все кварталы
                    const quarters = new Set();
                    for (const feature of firstFeatures) {
                        const props = feature.properties || {};
                        const opts = props.options || {};
                        const cadNumber = opts.cad_number || props.externalKey || '';
                        if (cadNumber) {
                            const quarter = extractCadastralQuarter(cadNumber);
                            if (quarter) {
                                quarters.add(quarter);
                            }
                        }
                    }
                    console.log(`🏘️ Найдено ${quarters.size} уникальных кварталов`);

                    // ШАГ 3: Ищем по каждому кварталу с фильтрацией по параметру
                    for (const quarter of quarters) {
                        console.log(`🔍 Поиск по кварталу ${quarter} с лимитом 500`);
                        const quarterUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=500`;
                        
                        const quarterResponse = await fetch(quarterUrl, {
                            signal: controller.signal,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });

                        if (quarterResponse.ok) {
                            const quarterData = await quarterResponse.json();
                            const qFeatures = quarterData?.data?.features || [];
                            console.log(`   В квартале ${quarter} найдено ${qFeatures.length} объектов`);
                            
                            // Фильтруем по параметру
                            let filtered = qFeatures;
                            if (value > 0) {
                                filtered = qFeatures.filter(f => {
                                    const opts = f.properties?.options || {};
                                    const paramValue = param.getValue(opts);
                                    if (!paramValue || paramValue <= 0) return false;
                                    return Math.abs(paramValue - value) <= TOLERANCE;
                                });
                                console.log(`   После фильтрации по ${paramKey}: ${filtered.length} объектов`);
                            }
                            
                            if (filtered.length > 0) {
                                const formatted = filtered.map(f => formatCandidate(f, paramKey));
                                candidates = candidates.concat(formatted);
                                console.log(`   ✅ Найдено ${filtered.length} объектов в квартале ${quarter}`);
                            }
                        }
                    }

                    searchMethod = value > 0 ? `кварталы + ${param.label}` : 'кварталы';

                } else {
                    // ============================================================
                    // 🔥 ЛОГИКА ДЛЯ extension, volume, height, depth — ПОИСК ПО АДРЕСУ
                    // ============================================================
                    console.log(`🔍 Поиск по АДРЕСУ для параметра: ${paramKey}, значение: ${value}`);
                    
                    // Пробуем разные варианты адреса
                    const addressVariants = [
                        address,
                        address.split(',').slice(0, -1).join(',').trim(),
                        address.split(',').slice(0, -2).join(',').trim(),
                        address.split(',').slice(0, 1).join(',').trim()
                    ].filter(a => a && a.length > 0);
                    
                    const uniqueVariants = [...new Set(addressVariants)];
                    console.log(`🔍 Варианты адреса для поиска:`, uniqueVariants);
                    
                    let allFound = [];
                    
                    for (const addrVariant of uniqueVariants) {
                        console.log(`   Пробуем: "${addrVariant}"`);
                        const addrUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(addrVariant)}&thematicSearchId=1&limit=200`;
                        
                        const addrResponse = await fetch(addrUrl, {
                            signal: controller.signal,
                            headers: {
                                'Accept': 'application/json',
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        });
                        
                        if (addrResponse.ok) {
                            const addrData = await addrResponse.json();
                            const addrFeatures = addrData?.data?.features || [];
                            console.log(`      Найдено ${addrFeatures.length} объектов`);
                            
                            // Фильтруем по параметру
                            const filtered = addrFeatures.filter(f => {
                                const opts = f.properties?.options || {};
                                const paramValue = param.getValue(opts);
                                if (!paramValue || paramValue <= 0) return false;
                                return Math.abs(paramValue - value) <= TOLERANCE;
                            });
                            
                            if (filtered.length > 0) {
                                console.log(`      ✅ Найдено ${filtered.length} объектов с ${paramKey} = ${value}`);
                                allFound = allFound.concat(filtered);
                            }
                        }
                    }
                    
                    // Убираем дубликаты по кадастровому номеру
                    const uniqueFound = [];
                    const seenCadNumbers = new Set();
                    for (const item of allFound) {
                        const opts = item.properties?.options || {};
                        const cadNumber = opts.cad_number || '';
                        if (cadNumber && !seenCadNumbers.has(cadNumber)) {
                            seenCadNumbers.add(cadNumber);
                            uniqueFound.push(item);
                        }
                    }
                    
                    console.log(`📥 Всего найдено уникальных объектов: ${uniqueFound.length}`);
                    
                    if (uniqueFound.length > 0) {
                        candidates = uniqueFound.map(f => formatCandidate(f, paramKey));
                        console.log(`✅ Найдено ${candidates.length} объектов по адресу + ${paramKey}`);
                    }

                    searchMethod = value > 0 ? `адрес + ${param.label}` : 'адрес';
                }

                clearTimeout(timeoutId);

                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены<br>
                            <span class="text-xs">Метод: ${searchMethod}</span>
                            ${address ? `<br><span class="text-xs">Адрес: ${address}</span>` : ''}
                            ${value > 0 ? `<br><span class="text-xs">Параметр: ${param.label} = ${value} ${param.unit} ±${TOLERANCE}</span>` : ''}
                            <br><span class="text-xs text-slate-500 mt-2 block">💡 Попробуйте изменить адрес, параметр или значение</span>
                        </div>
                    `;
                    return;
                }

                if (value > 0) {
                    candidates.sort((a, b) => {
                        return Math.abs(a.paramValue - value) - Math.abs(b.paramValue - value);
                    });
                }

                displayResults(candidates, searchMethod, address, value, paramKey);

            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                if (error.name === 'AbortError') {
                    resultsContainer.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">⏰ Превышено время ожидания ответа от НСПД.</div>`;
                } else {
                    resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Произошла ошибка: ${error.message}</div>`;
                }
            }
        }

        searchBtn.addEventListener('click', performSearch);
        addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        valueInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
