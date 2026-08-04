// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД (ОТДЕЛЬНАЯ ВКЛАДКА) - ТАБЛИЧНЫЙ РЕЖИМ
// ============================================================
(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    // Константа для допуска по площади (в м²)
    const AREA_TOLERANCE = 0.2;

    // Функция для нормализации строк (убираем лишние пробелы, приводим к нижнему регистру)
    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    // Функция для извлечения номера дома из адреса
    function extractHouseNumber(address) {
        if (!address) return '';
        const match = address.match(/\b[дд]\.?\s*(\d+[А-Яа-я]?)/i);
        return match ? match[1] : '';
    }

    // Функция для извлечения улицы из адреса
    function extractStreetFromAddress(address) {
        if (!address) return '';
        
        const patterns = [
            /ул(?:ица)?\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /проспект\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /пер(?:еулок)?\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /бульвар\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /набережная\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /шоссе\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /площадь\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /аллея\s+([^,\d]+?)(?:\s*[,д]|$)/i,
        ];
        
        for (const pattern of patterns) {
            const match = address.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return '';
    }

    // Функция для извлечения кадастрового квартала из номера
    function extractCadastralQuarter(cadNumber) {
        if (!cadNumber) return '';
        const parts = cadNumber.split(':');
        if (parts.length >= 3) {
            return parts.slice(0, 3).join(':');
        }
        return '';
    }

    // Функция для форматирования цены
    function formatPrice(num) {
        if (!num || num === 0) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    }

    // Функция для безопасного получения строкового значения этажа
    function getFloorValue(floor) {
        if (!floor) return '—';
        
        let floorStr = floor;
        if (Array.isArray(floor)) {
            floorStr = floor.length > 0 ? floor[0] : '—';
        }
        
        if (typeof floorStr !== 'string') {
            floorStr = String(floorStr);
        }
        
        const match = floorStr.match(/^(\d+)/);
        if (match) {
            return match[1];
        }
        
        return floorStr;
    }

    // Функция для проверки соответствия площади с допуском ±0.2 м²
    function isAreaMatch(area, targetArea) {
        return Math.abs(area - targetArea) <= AREA_TOLERANCE;
    }

    // Функция для проверки соответствия протяженности с допуском ±0.2 м
    function isExtensionMatch(extension, targetExtension) {
        if (!targetExtension || targetExtension <= 0) return true;
        return Math.abs(extension - targetExtension) <= AREA_TOLERANCE;
    }

    // Функция для получения адреса из разных полей
    function getAddress(opts, props) {
        return opts.readable_address || opts.address_readable_address || props.descr || '';
    }

    // Основная функция инициализации
    window.initNSPDSearch = function(containerId) {
        console.log(`🔍 Инициализация поиска НСПД в контейнере: ${containerId}`);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Контейнер ${containerId} не найден`);
            return;
        }

        container.innerHTML = '';

        const html = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">🔍 Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Площадь (м²)</label>
                        <input type="number" id="nspd-search-area" 
                               placeholder="Введите площадь, например 45.5" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                        <span class="text-xs text-slate-400 mt-1 block">Допуск ±${AREA_TOLERANCE} м²</span>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Протяженность (м)</label>
                        <input type="number" id="nspd-search-extension" 
                               placeholder="Введите протяженность, например 11245" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                        <span class="text-xs text-slate-400 mt-1 block">Допуск ±${AREA_TOLERANCE} м</span>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Адрес / Улица</label>
                        <input type="text" id="nspd-search-address" 
                               placeholder="Введите улицу, например Ленина" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
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
                        Введите параметры и нажмите "Найти объект"
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const searchBtn = document.getElementById('nspd-search-btn');
        const areaInput = document.getElementById('nspd-search-area');
        const extensionInput = document.getElementById('nspd-search-extension');
        const addressInput = document.getElementById('nspd-search-address');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !areaInput || !extensionInput || !addressInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        // Функция для поиска подходящих объектов (общая)
        function findBestMatch(features, targetArea, targetExtension, targetAddress) {
            const normalizedTargetAddress = normalizeString(targetAddress);
            const targetHouse = extractHouseNumber(targetAddress);
            const targetStreet = normalizeString(extractStreetFromAddress(targetAddress));

            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                if (targetArea && targetArea > 0 && !isAreaMatch(area, targetArea)) continue;

                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                if (targetExtension && targetExtension > 0 && !isExtensionMatch(extension, targetExtension)) continue;

                const address = getAddress(opts, props);
                const addressLower = address.toLowerCase();
                const nspdHouse = extractHouseNumber(addressLower);
                const nspdStreet = normalizeString(extractStreetFromAddress(addressLower));

                let streetMatch = false;
                if (targetStreet && nspdStreet) {
                    streetMatch = nspdStreet.includes(targetStreet) || 
                                  targetStreet.includes(nspdStreet) ||
                                  normalizeString(targetStreet) === normalizeString(nspdStreet);
                }

                let houseMatch = false;
                if (targetHouse && nspdHouse) {
                    houseMatch = nspdHouse === targetHouse;
                }

                if (streetMatch || houseMatch) {
                    candidates.push({ 
                        feature, 
                        area, 
                        extension: extension,
                        address: address,
                        house: nspdHouse,
                        street: nspdStreet,
                        cadNumber: opts.cad_number || opts.externalKey || '—',
                        type: opts.type || opts.object_type_value || '—',
                        cadastralCost: parseFloat(opts.cost_value) || 0,
                        name: opts.params_name || opts.name || '',
                        rawData: {
                            feature: feature,
                            opts: opts,
                            props: props
                        }
                    });
                }
            }

            candidates.sort((a, b) => {
                const diffA = Math.abs(a.area - targetArea) + Math.abs(a.extension - targetExtension);
                const diffB = Math.abs(b.area - targetArea) + Math.abs(b.extension - targetExtension);
                return diffA - diffB;
            });
            return candidates;
        }

        // Функция для поиска в указанном квартале
        function findInQuarter(features, targetArea, targetExtension, targetQuarter) {
            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                const cadNumber = opts.cad_number || props.externalKey || '';
                const quarter = extractCadastralQuarter(cadNumber);
                if (quarter !== targetQuarter) continue;

                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                if (targetArea && targetArea > 0 && !isAreaMatch(area, targetArea)) continue;

                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                if (targetExtension && targetExtension > 0 && !isExtensionMatch(extension, targetExtension)) continue;

                const address = getAddress(opts, props);

                candidates.push({ 
                    feature, 
                    area, 
                    extension: extension,
                    address: address,
                    house: extractHouseNumber(address),
                    street: normalizeString(extractStreetFromAddress(address)),
                    cadNumber: cadNumber || '—',
                    type: opts.type || opts.object_type_value || '—',
                    cadastralCost: parseFloat(opts.cost_value) || 0,
                    name: opts.params_name || opts.name || '',
                    rawData: {
                        feature: feature,
                        opts: opts,
                        props: props
                    }
                });
            }

            candidates.sort((a, b) => {
                const diffA = Math.abs(a.area - targetArea) + Math.abs(a.extension - targetExtension);
                const diffB = Math.abs(b.area - targetArea) + Math.abs(b.extension - targetExtension);
                return diffA - diffB;
            });
            return candidates;
        }

        // Функция для получения всех полей объекта в виде плоского массива
        function extractAllFields(item) {
            const data = item.rawData;
            const opts = data.opts || {};
            const props = data.props || {};

            const objectType = item.type || data.props.categoryName || '';
            
            const isLand = objectType.includes('Земельный участок') || 
                          objectType.includes('Земельный') || 
                          objectType.includes('земельный участок');
            
            let upksValue = parseFloat(opts.cost_index) || 0;
            if (upksValue === 0) {
                const cost = parseFloat(opts.cost_value) || 0;
                const area = parseFloat(opts.specified_area) || item.area || parseFloat(opts.params_built_up_area) || 0;
                if (cost > 0 && area > 0) {
                    upksValue = cost / area;
                }
            }

            let objectName = opts.params_name || opts.name || opts.building_name || '';
            if (!objectName && objectType) {
                objectName = objectType;
            }

            const floorValue = getFloorValue(opts.floor);
            const extensionValue = item.extension || parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;

            const address = getAddress(opts, props);

            return {
                'Кадастровый номер': item.cadNumber || '—',
                'Наименование': objectName || '—',
                'Тип объекта': objectType || '—',
                'Адрес': address || '—',
                'Площадь (м²)': item.area > 0 ? item.area.toFixed(1) : '—',
                'Протяженность (м)': extensionValue > 0 ? extensionValue.toFixed(1) : '—',
                'Кадастровая стоимость': opts.cost_value ? formatPrice(parseFloat(opts.cost_value)) : '—',
                'УПКС (₽/м²)': upksValue > 0 ? upksValue.toFixed(2) : '—',
                'Назначение': opts.purpose || opts.params_purpose || opts.permitted_use_established_by_document || '—',
                'Статус': opts.common_data_status || opts.status || '—',
                'Форма собственности': opts.ownership_type || '—',
                'Этаж': floorValue,
                'Год постройки': opts.year_built || opts.params_year_built || '—',
                'ВРИ': isLand ? (opts.permitted_uses_name || opts.purpose || opts.params_purpose || '—') : '—',
                'Категория земель': isLand ? (opts.land_record_category_type || props.categoryName || '—') : '—',
                'Дата регистрации': opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date || '—'
            };
        }

        // ============================================================
        // 🔥 ФУНКЦИЯ ПОИСКА С ПОДДЕРЖКОЙ ПЛОЩАДИ И ПРОТЯЖЕННОСТИ
        // ============================================================
        async function performSearch() {
            const area = parseFloat(areaInput.value) || 0;
            const extension = parseFloat(extensionInput.value) || 0;
            const address = addressInput.value.trim();

            if (area <= 0 && extension <= 0) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите площадь ИЛИ протяженность.</div>`;
                return;
            }
            if (!address) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес или улицу.</div>`;
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

                // ✅ Если указана ПЛОЩАДЬ — используем старую логику (поиск по адресу → кварталы → фильтр по площади)
                if (area > 0) {
                    console.log(`🔍 Поиск по ПЛОЩАДИ: ${area} м² + адрес: ${address}`);
                    searchMethod = 'площадь';
                    
                    const searchQuery = address;
                    const nspdApiUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(searchQuery)}&thematicSearchId=1&limit=200`;
                    
                    const response = await fetch(nspdApiUrl, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Ошибка API НСПД: ${response.status}`);
                    }

                    const data = await response.json();
                    const firstFeatures = data?.data?.features || [];
                    console.log(`📥 По адресу получено ${firstFeatures.length} объектов`);

                    if (firstFeatures.length > 0) {
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
                                
                                const qCandidates = findInQuarter(qFeatures, area, extension, quarter);
                                if (qCandidates.length > 0) {
                                    candidates = candidates.concat(qCandidates);
                                    console.log(`   ✅ Найдено ${qCandidates.length} объектов в квартале ${quarter}`);
                                }
                            }
                        }
                    }
                }

                // ✅ Если указана ПРОТЯЖЕННОСТЬ и объекты не найдены по площади — ищем по протяженности напрямую
                if (extension > 0 && candidates.length === 0) {
                    console.log(`🔍 Поиск по ПРОТЯЖЕННОСТИ: ${extension} м + адрес: ${address}`);
                    searchMethod = 'протяженность';
                    
                    const extSearchUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${extension}&thematicSearchId=1&limit=500`;
                    const extResponse = await fetch(extSearchUrl, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    if (extResponse.ok) {
                        const extData = await extResponse.json();
                        const extFeatures = extData?.data?.features || [];
                        console.log(`📥 По протяженности найдено ${extFeatures.length} объектов`);
                        
                        // Фильтруем по адресу (частичное совпадение)
                        const addressLower = address.toLowerCase();
                        const filteredByAddress = extFeatures.filter(f => {
                            const opts = f.properties?.options || {};
                            const addr = (opts.address_readable_address || opts.readable_address || '').toLowerCase();
                            return addr.includes(addressLower) || addressLower.includes(addr);
                        });
                        
                        console.log(`📥 После фильтрации по адресу осталось ${filteredByAddress.length} объектов`);
                        
                        if (filteredByAddress.length > 0) {
                            candidates = filteredByAddress.map(f => {
                                const props = f.properties || {};
                                const opts = props.options || {};
                                return {
                                    feature: f,
                                    area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                                    extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                                    address: opts.address_readable_address || opts.readable_address || '',
                                    cadNumber: opts.cad_number || opts.externalKey || '—',
                                    type: opts.type || opts.object_type_value || '—',
                                    cadastralCost: parseFloat(opts.cost_value) || 0,
                                    name: opts.params_name || opts.name || '',
                                    rawData: {
                                        feature: f,
                                        opts: opts,
                                        props: props
                                    }
                                };
                            });
                            console.log(`✅ Найдено ${candidates.length} объектов по протяженности + адресу`);
                        }
                    }
                }

                clearTimeout(timeoutId);

                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены по заданным критериям.<br>
                            <span class="text-xs">Проверьте правильность адреса, площади (допуск ±${AREA_TOLERANCE} м²) и/или протяженности (допуск ±${AREA_TOLERANCE} м)</span>
                            ${address ? `<br><span class="text-xs">Адрес: ${address}</span>` : ''}
                            ${area > 0 ? `<br><span class="text-xs">Площадь: ${area} м²</span>` : ''}
                            ${extension > 0 ? `<br><span class="text-xs">Протяженность: ${extension} м</span>` : ''}
                            <br><span class="text-xs">Метод поиска: ${searchMethod || 'не определен'}</span>
                        </div>
                    `;
                    return;
                }

                // Сортируем кандидатов по близости площади и протяженности
                candidates.sort((a, b) => {
                    const diffA = Math.abs(a.area - area) + Math.abs(a.extension - extension);
                    const diffB = Math.abs(b.area - area) + Math.abs(b.extension - extension);
                    return diffA - diffB;
                });

                // Получаем все поля для каждого объекта
                const tableData = candidates.map(item => extractAllFields(item));
                const allKeys = Object.keys(tableData[0] || {});
                const columnsToShow = allKeys.filter(key => {
                    return tableData.some(row => row[key] && row[key] !== '—' && row[key] !== '');
                });

                // Строим HTML таблицы
                let tableHtml = `
                    <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" style="max-height: 600px; overflow-y: auto;">
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif;">
                                <thead style="position: sticky; top: 0; z-index: 10;">
                                    <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                        <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 30px;">#</th>
                                        ${columnsToShow.map(col => `
                                            <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: ${col.includes('Кадастровый номер') ? '150px' : col.includes('Адрес') ? '200px' : '100px'}; max-width: ${col.includes('Адрес') ? '250px' : '200px'};">
                                                ${col}
                                            </th>
                                        `).join('')}
                                        <th style="padding: 8px 10px; text-align: center; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 80px;">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                tableData.forEach((row, index) => {
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                    const isLandRow = row['Тип объекта'] && (
                        row['Тип объекта'].includes('Земельный участок') || 
                        row['Тип объекта'].includes('Земельный') ||
                        row['Тип объекта'].includes('земельный участок')
                    );
                    
                    tableHtml += `
                        <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" 
                            onmouseover="this.style.background='#f0f9ff'" 
                            onmouseout="this.style.background='${bgColor}'">
                            <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                            ${columnsToShow.map(col => {
                                let value = row[col] || '—';
                                if ((col === 'ВРИ' || col === 'Категория земель') && !isLandRow) {
                                    value = '—';
                                }
                                return `
                                    <td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" 
                                        title="${value}">
                                        ${value}
                                    </td>
                                `;
                            }).join('')}
                            <td style="padding: 6px 10px; text-align: center;">
                                <button onclick="navigator.clipboard.writeText('${row['Кадастровый номер'] || ''}').then(() => alert('Кадастровый номер скопирован!'))" 
                                        style="padding: 2px 10px; background: #e0f2fe; color: #0284c7; border: none; border-radius: 4px; cursor: pointer; font-size: 9px; transition: all 0.2s;"
                                        onmouseover="this.style.background='#bae6fd'"
                                        onmouseout="this.style.background='#e0f2fe'">
                                    📋 Копировать
                                </button>
                            </td>
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
                        <span style="font-size: 10px; color: #94a3b8;">Метод поиска: ${searchMethod}</span>
                        ${area > 0 ? `<span style="font-size: 10px; color: #94a3b8;">Допуск по площади: ±${AREA_TOLERANCE} м²</span>` : ''}
                        ${extension > 0 ? `<span style="font-size: 10px; color: #94a3b8;">Допуск по протяженности: ±${AREA_TOLERANCE} м</span>` : ''}
                        <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                                style="padding: 4px 16px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.2s;"
                                onmouseover="this.style.background='#fee2e2'"
                                onmouseout="this.style.background='#fef2f2'">
                            ✕ Очистить результаты
                        </button>
                    </div>
                `;

                resultsContainer.innerHTML = tableHtml;

            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                if (error.name === 'AbortError') {
                    resultsContainer.innerHTML = `<div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">⏰ Превышено время ожидания ответа от НСПД. Попробуйте позже.</div>`;
                } else {
                    resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Произошла ошибка при поиске: ${error.message}</div>`;
                }
            }
        }

        searchBtn.addEventListener('click', performSearch);
        areaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        extensionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
