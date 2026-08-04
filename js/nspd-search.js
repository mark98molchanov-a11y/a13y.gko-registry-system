// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД (ОТДЕЛЬНАЯ ВКЛАДКА) - ТАБЛИЧНЫЙ РЕЖИМ
// ============================================================
(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

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

    // Функция для форматирования цены
    function formatPrice(num) {
        if (!num || num === 0) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    }

    // Функция для определения, является ли объект земельным участком
    function isLandObject(objectType) {
        if (!objectType) return false;
        const type = objectType.toLowerCase();
        return type.includes('земельный участок') || 
               type.includes('земельного участка') ||
               type.includes('земля') ||
               type.includes('земельный') ||
               (type.includes('участок') && !type.includes('строительства'));
    }

    // Функция для извлечения ключевых слов из адреса
    function extractSearchKeywords(address) {
        if (!address) return [];
        
        const stopWords = ['автономный', 'округ', 'район', 'город', 'поселок', 'деревня', 'село', 
                          'улица', 'проспект', 'переулок', 'бульвар', 'набережная', 'шоссе', 
                          'площадь', 'аллея', 'область', 'край', 'республика', 'муниципальный'];
        
        const words = address.toLowerCase().split(/[\s,]+/).filter(w => w.length > 2);
        const keywords = [...new Set(words.filter(w => !stopWords.includes(w)))];
        
        return keywords;
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

        // --- Рендерим HTML интерфейс ---
        const html = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">🔍 Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Параметр поиска</label>
                        <select id="nspd-search-type" 
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition bg-white">
                            <option value="area">Площадь (м²)</option>
                            <option value="extension">Протяженность (м)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Значение</label>
                        <input type="number" id="nspd-search-value" 
                               placeholder="Введите значение, например 45.5" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Адрес / Улица / Месторождение</label>
                        <input type="text" id="nspd-search-address" 
                               placeholder="Введите адрес, улицу или месторождение" 
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

        // --- Логика поиска ---
        const searchBtn = document.getElementById('nspd-search-btn');
        const searchType = document.getElementById('nspd-search-type');
        const searchValue = document.getElementById('nspd-search-value');
        const addressInput = document.getElementById('nspd-search-address');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !searchType || !searchValue || !addressInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        // 🔥 ГЛАВНАЯ ФУНКЦИЯ ПОИСКА
        async function performSearch() {
            const searchTypeParam = searchType.value;
            const value = parseFloat(searchValue.value);
            const address = addressInput.value.trim();

            const hasValue = !isNaN(value) && value > 0;

            if (!hasValue) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите значение для поиска.</div>`;
                return;
            }
            if (!address) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес или месторождение.</div>`;
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
                // 🔥 ИЗВЛЕКАЕМ КЛЮЧЕВЫЕ СЛОВА ИЗ АДРЕСА
                const keywords = extractSearchKeywords(address);
                
                if (keywords.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            ⚠️ Не удалось извлечь ключевые слова из адреса.<br>
                            <span class="text-xs">Попробуйте ввести название месторождения (например, "Тарасовское")</span>
                        </div>
                    `;
                    return;
                }

                // 🔥 ФОРМИРУЕМ ЗАПРОС ДЛЯ ПОИСКА
                // Берем последнее ключевое слово (обычно это месторождение или улица)
                const mainKeyword = keywords[keywords.length - 1];
                
                // 🔥 СТРАТЕГИЯ 1: Поиск по ключевому слову
                let allFeatures = [];
                let usedStrategy = '';

                const url1 = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(mainKeyword)}&thematicSearchId=1&limit=100`;
                
                const controller1 = new AbortController();
                const timeoutId1 = setTimeout(() => controller1.abort(), 15000);
                
                const response1 = await fetch(url1, {
                    signal: controller1.signal,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                clearTimeout(timeoutId1);

                if (response1.ok) {
                    const data1 = await response1.json();
                    allFeatures = data1?.data?.features || [];
                    usedStrategy = `ключевое слово "${mainKeyword}"`;
                }

                // 🔥 СТРАТЕГИЯ 2: Если ничего не найдено - пробуем поискать по полному адресу
                if (allFeatures.length === 0) {
                    const url2 = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=100`;
                    
                    const controller2 = new AbortController();
                    const timeoutId2 = setTimeout(() => controller2.abort(), 15000);
                    
                    const response2 = await fetch(url2, {
                        signal: controller2.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    clearTimeout(timeoutId2);

                    if (response2.ok) {
                        const data2 = await response2.json();
                        allFeatures = data2?.data?.features || [];
                        usedStrategy = `полный адрес`;
                    }
                }

                // 🔥 СТРАТЕГИЯ 3: Если ничего не найдено - пробуем поискать по первому ключевому слову
                if (allFeatures.length === 0 && keywords.length > 1) {
                    const firstKeyword = keywords[0];
                    const url3 = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(firstKeyword)}&thematicSearchId=1&limit=100`;
                    
                    const controller3 = new AbortController();
                    const timeoutId3 = setTimeout(() => controller3.abort(), 15000);
                    
                    const response3 = await fetch(url3, {
                        signal: controller3.signal,
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    clearTimeout(timeoutId3);

                    if (response3.ok) {
                        const data3 = await response3.json();
                        allFeatures = data3?.data?.features || [];
                        usedStrategy = `первое ключевое слово "${firstKeyword}"`;
                    }
                }

                if (allFeatures.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 По запросу ничего не найдено.<br>
                            <span class="text-xs">Попробуйте ввести название месторождения (например, "Тарасовское")</span>
                        </div>
                    `;
                    return;
                }

                // 🔥 ФИЛЬТРУЕМ СНАЧАЛА ПО ПЛОЩАДИ/ПРОТЯЖЕННОСТИ, ПОТОМ ПО АДРЕСУ
                function findBestMatch(features, targetValue, searchTypeParam, targetAddress) {
                    const hasValue = targetValue !== null && !isNaN(targetValue) && targetValue > 0;
                    if (!hasValue) return [];

                    const keywords = extractSearchKeywords(targetAddress);
                    const hasKeywords = keywords.length > 0;
                    let candidates = [];
                    
                    for (const feature of features) {
                        const obj = feature || {};
                        const props = obj.properties || {};
                        const opts = props.options || {};
                        
                        // Извлекаем данные
                        const cadNumber = obj.cadastral_number || opts.cad_number || props.cadastral_number || '—';
                        const address = obj.address || opts.readable_address || props.readable_address || opts.address_readable_address || props.descr || '';
                        const objectType = obj.object_type || obj.categoryName || opts.type || opts.object_type_value || props.categoryName || '';
                        
                        let area = parseFloat(obj.area) || parseFloat(opts.area) || parseFloat(opts.params_area) || parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                        let extension = parseFloat(obj.params_extension) || parseFloat(opts.params_extension) || parseFloat(opts.extension) || parseFloat(props.params_extension) || 0;
                        const name = obj.object_name || opts.params_name || opts.name || opts.building_name || '';
                        const cadastralCost = parseFloat(obj.cadastral_value) || parseFloat(opts.cost_value) || 0;
                        let upksValue = parseFloat(obj.cadastral_index) || parseFloat(opts.cost_index) || 0;
                        if (upksValue === 0 && cadastralCost > 0 && area > 0) {
                            upksValue = cadastralCost / area;
                        }

                        // 🔥 ПЕРВАЯ ПРОВЕРКА: ПО ПЛОЩАДИ/ПРОТЯЖЕННОСТИ (ГЛАВНЫЙ ПАРАМЕТР)
                        let valueMatch = false;
                        let matchedValue = 0;
                        if (searchTypeParam === 'area') {
                            valueMatch = Math.abs(area - targetValue) < 0.01;
                            matchedValue = area;
                        } else if (searchTypeParam === 'extension') {
                            valueMatch = Math.abs(extension - targetValue) < 0.01;
                            matchedValue = extension;
                        }
                        if (!valueMatch) continue;

                        // 🔥 ВТОРАЯ ПРОВЕРКА: ПО АДРЕСУ (ВТОРИЧНЫЙ ПАРАМЕТР)
                        let addressMatch = false;
                        const combinedText = (address + ' ' + name).toLowerCase();
                        
                        if (!targetAddress || targetAddress.trim() === '') {
                            addressMatch = true;
                        } else if (hasKeywords) {
                            let matchCount = 0;
                            for (const keyword of keywords) {
                                if (combinedText.includes(keyword)) {
                                    matchCount++;
                                }
                            }
                            if (matchCount >= Math.ceil(keywords.length / 2)) {
                                addressMatch = true;
                            }
                        } else {
                            const normalizedTarget = normalizeString(targetAddress);
                            const normalizedFull = normalizeString(address);
                            addressMatch = normalizedFull.includes(normalizedTarget) || normalizedTarget.includes(normalizedFull);
                        }

                        if (!addressMatch) continue;

                        candidates.push({ 
                            feature: feature,
                            area, extension, matchedValue,
                            address, cadNumber, type: objectType,
                            cadastralCost, upksValue, name,
                            rawData: { feature, opts, props, obj }
                        });
                    }

                    // Сортируем по близости значения (площади/протяженности)
                    candidates.sort((a, b) => Math.abs(a.matchedValue - targetValue) - Math.abs(b.matchedValue - targetValue));
                    return candidates;
                }

                const candidates = findBestMatch(allFeatures, value, searchTypeParam, address);

                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены по заданным критериям.<br>
                            <span class="text-xs">Проверьте правильность значения (${searchTypeParam}: ${value})</span>
                            <br><span class="text-xs">Попробуйте ввести название месторождения (например, "Тарасовское")</span>
                        </div>
                    `;
                    return;
                }

                // Отображаем результаты
                const tableData = candidates.map(item => extractAllFields(item));
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
                                        <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px;">#</th>
                                        ${columnsToShow.map(col => `
                                            <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 100px; max-width: 200px;">${col}</th>
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
                            ${columnsToShow.map(col => `
                                <td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${row[col] || '—'}">
                                    ${row[col] || '—'}
                                </td>
                            `).join('')}
                        </tr>
                    `;
                });

                tableHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; padding: 0 4px;">
                        <span>Найдено объектов: <strong>${candidates.length}</strong></span>
                        <span>Всего в ответе: ${allFeatures.length}</span>
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

        // Вешаем обработчики событий
        searchBtn.addEventListener('click', performSearch);
        searchValue.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
