// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД - ПРОСТОЙ И ПОНЯТНЫЙ
// ============================================================
(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    const TOLERANCE = 0.2;

    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function extractHouseNumber(address) {
        if (!address) return '';
        const match = address.match(/\b[дд]\.?\s*(\d+[А-Яа-я]?)/i);
        return match ? match[1] : '';
    }

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
            if (match) return match[1].trim();
        }
        return '';
    }

    function extractCadastralQuarter(cadNumber) {
        if (!cadNumber) return '';
        const parts = cadNumber.split(':');
        if (parts.length >= 3) return parts.slice(0, 3).join(':');
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

    function isMatch(value, target) {
        if (!target || target <= 0) return true;
        return Math.abs(value - target) <= TOLERANCE;
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

        // ===== ПРОСТОЙ ИНТЕРФЕЙС - ТОЛЬКО 2 ПОЛЯ =====
        const html = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">🔍 Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Адрес</label>
                        <input type="text" id="nspd-search-address" 
                               placeholder="Введите адрес, улицу или часть адреса" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                        <span class="text-xs text-slate-400 mt-1 block">Частичное совпадение</span>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Характеристика</label>
                        <input type="number" id="nspd-search-value" 
                               placeholder="Площадь, протяженность, объем, высота, глубина..." 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                        <span class="text-xs text-slate-400 mt-1 block">Допуск ±0.2 (м², м, м³)</span>
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
                        Введите адрес и характеристику, нажмите "Найти объект"
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const searchBtn = document.getElementById('nspd-search-btn');
        const addressInput = document.getElementById('nspd-search-address');
        const valueInput = document.getElementById('nspd-search-value');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !addressInput || !valueInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        function formatCandidate(feature) {
            const props = feature.properties || {};
            const opts = props.options || {};
            return {
                feature: feature,
                area: parseFloat(opts.area) || parseFloat(opts.params_area) || 
                      parseFloat(opts.specified_area) || parseFloat(opts.params_built_up_area) || 0,
                extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                volume: parseFloat(opts.params_volume) || 0,
                height: parseFloat(opts.params_height) || 0,
                depth: parseFloat(opts.params_depth) || 0,
                floors: opts.params_floors || opts.floors || '',
                underground: opts.params_underground_floors || opts.underground_floors || '',
                address: opts.address_readable_address || opts.readable_address || '',
                cadNumber: opts.cad_number || opts.externalKey || '—',
                type: opts.type || opts.object_type_value || '—',
                cadastralCost: parseFloat(opts.cost_value) || 0,
                name: opts.params_name || opts.name || '',
                determination_couse: opts.determination_couse || '',
                rawData: { feature, opts, props }
            };
        }

        function displayResults(candidates, searchMethod) {
            if (candidates.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                        🔍 Объекты не найдены<br>
                        <span class="text-xs">Метод: ${searchMethod}</span>
                    </div>
                `;
                return;
            }

            const tableData = candidates.map(item => {
                const opts = item.rawData.opts || {};
                const objectType = item.type || opts.categoryName || '';
                const isLand = objectType.includes('Земельный участок') || 
                              objectType.includes('Земельный') || 
                              objectType.includes('земельный участок');
                
                let upksValue = parseFloat(opts.cost_index) || 0;
                if (upksValue === 0) {
                    const cost = parseFloat(opts.cost_value) || 0;
                    const area = parseFloat(opts.specified_area) || item.area || parseFloat(opts.params_built_up_area) || 0;
                    if (cost > 0 && area > 0) upksValue = cost / area;
                }

                let objectName = opts.params_name || opts.name || opts.building_name || '';
                if (!objectName && objectType) objectName = objectType;

                const floorValue = getFloorValue(opts.floor);
                const extensionValue = item.extension || parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                const address = getAddress(opts, opts);
                const determinationCouse = opts.determination_couse || '';

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
                    'Категория земель': isLand ? (opts.land_record_category_type || opts.categoryName || '—') : '—',
                    'Дата регистрации': opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date || '—',
                    'Основание оценки': determinationCouse || '—'
                };
            });

            const allKeys = Object.keys(tableData[0] || {});
            const columnsToShow = allKeys.filter(key => {
                return tableData.some(row => row[key] && row[key] !== '—' && row[key] !== '');
            });

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
                            if ((col === 'ВРИ' || col === 'Категория земель') && !isLandRow) value = '—';
                            if (col === 'Основание оценки' && value.length > 100) value = value.substring(0, 100) + '...';
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
            const value = parseFloat(valueInput.value) || 0;

            if (!address && value <= 0) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес и/или характеристику.</div>`;
                return;
            }

            if (!address) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес.</div>`;
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

                // Пробуем разные варианты адреса
                const addressVariants = [
                    address,
                    address.split(',').slice(0, -1).join(',').trim(),
                    address.split(',').slice(0, -2).join(',').trim(),
                    address.split(',').slice(0, 1).join(',').trim()
                ].filter(a => a && a.length > 0);

                const uniqueVariants = [...new Set(addressVariants)];
                console.log(`🔍 Варианты адреса:`, uniqueVariants);

                let allFeatures = [];

                for (const addrVariant of uniqueVariants) {
                    console.log(`   Пробуем: "${addrVariant}"`);
                    const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(addrVariant)}&thematicSearchId=1&limit=200`;
                    const response = await fetch(url, {
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const features = data?.data?.features || [];
                        console.log(`      Найдено ${features.length} объектов`);
                        allFeatures = allFeatures.concat(features);
                    }
                }

                // Убираем дубликаты
                const uniqueFeatures = [];
                const seen = new Set();
                for (const f of allFeatures) {
                    const opts = f.properties?.options || {};
                    const cadNumber = opts.cad_number || '';
                    if (cadNumber && !seen.has(cadNumber)) {
                        seen.add(cadNumber);
                        uniqueFeatures.push(f);
                    }
                }

                console.log(`📥 Всего уникальных объектов: ${uniqueFeatures.length}`);
                searchMethod = 'адрес';

                // Фильтруем по характеристике (если указана)
                let filtered = uniqueFeatures;
                if (value > 0) {
                    filtered = uniqueFeatures.filter(f => {
                        const opts = f.properties?.options || {};
                        
                        // Проверяем ВСЕ возможные параметры
                        const areaVal = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                                       parseFloat(opts.specified_area) || parseFloat(opts.params_built_up_area) || 0;
                        const extVal = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                        const volVal = parseFloat(opts.params_volume) || 0;
                        const heightVal = parseFloat(opts.params_height) || 0;
                        const depthVal = parseFloat(opts.params_depth) || 0;
                        
                        // Хотя бы один параметр должен совпасть
                        return isMatch(areaVal, value) || 
                               isMatch(extVal, value) || 
                               isMatch(volVal, value) || 
                               isMatch(heightVal, value) || 
                               isMatch(depthVal, value);
                    });
                    
                    if (filtered.length > 0) {
                        searchMethod = 'адрес + характеристика';
                        console.log(`✅ После фильтрации по характеристике: ${filtered.length} объектов`);
                    } else {
                        searchMethod = 'адрес (характеристика не найдена)';
                        console.log(`⚠️ По характеристике ничего не найдено, показываем все объекты по адресу`);
                        filtered = uniqueFeatures;
                    }
                }

                clearTimeout(timeoutId);

                if (filtered.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены по адресу: ${address}<br>
                            <span class="text-xs">Попробуйте уточнить адрес</span>
                        </div>
                    `;
                    return;
                }

                // Форматируем кандидатов
                candidates = filtered.map(f => formatCandidate(f));

                // Сортируем по релевантности (если есть характеристика)
                if (value > 0) {
                    candidates.sort((a, b) => {
                        const scoreA = Math.abs(a.area - value) + Math.abs(a.extension - value) + 
                                      Math.abs(a.volume - value) + Math.abs(a.height - value) + Math.abs(a.depth - value);
                        const scoreB = Math.abs(b.area - value) + Math.abs(b.extension - value) + 
                                      Math.abs(b.volume - value) + Math.abs(b.height - value) + Math.abs(b.depth - value);
                        return scoreA - scoreB;
                    });
                }

                displayResults(candidates, searchMethod);

            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Произошла ошибка: ${error.message}</div>`;
            }
        }

        searchBtn.addEventListener('click', performSearch);
        addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        valueInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
