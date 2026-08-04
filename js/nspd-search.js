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
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Площадь (м²)</label>
                        <input type="number" id="nspd-search-area" 
                               placeholder="Введите площадь, например 45.5" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Протяженность (м)</label>
                        <input type="number" id="nspd-search-extension" 
                               placeholder="Введите протяженность, например 324" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                    </div>
                </div>

                <div class="mb-6">
                    <label class="block text-sm font-medium text-slate-700 mb-1">Адрес / Улица / Месторождение</label>
                    <input type="text" id="nspd-search-address" 
                           placeholder="Введите адрес, улицу или месторождение" 
                           class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
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
        const areaInput = document.getElementById('nspd-search-area');
        const extensionInput = document.getElementById('nspd-search-extension');
        const addressInput = document.getElementById('nspd-search-address');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !areaInput || !extensionInput || !addressInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        // Функция для поиска подходящих объектов
        function findBestMatch(features, targetArea, targetExtension, targetAddress) {
            const normalizedTargetAddress = normalizeString(targetAddress);
            const targetHouse = extractHouseNumber(targetAddress);
            const targetStreet = normalizeString(extractStreetFromAddress(targetAddress));

            // Проверяем, что введено хотя бы одно значение (площадь или протяженность)
            const hasArea = targetArea !== null && !isNaN(targetArea) && targetArea > 0;
            const hasExtension = targetExtension !== null && !isNaN(targetExtension) && targetExtension > 0;

            if (!hasArea && !hasExtension) {
                return [];
            }

            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                // Извлекаем площадь
                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                
                // Извлекаем протяженность
                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;

                // Проверяем условия поиска
                let areaMatch = false;
                let extensionMatch = false;

                if (hasArea) {
                    areaMatch = Math.abs(area - targetArea) < 1;
                }

                if (hasExtension) {
                    extensionMatch = Math.abs(extension - targetExtension) < 1;
                }

                // Объект подходит, если совпадает площадь ИЛИ протяженность
                const sizeMatch = (hasArea && areaMatch) || (hasExtension && extensionMatch);
                
                if (!sizeMatch) continue;

                // Проверка адреса
                const address = (opts.readable_address || props.descr || '').toLowerCase();
                const nspdHouse = extractHouseNumber(address);
                const nspdStreet = normalizeString(extractStreetFromAddress(address));

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

                // Если адрес указан, проверяем совпадение
                if (targetAddress && targetAddress.trim() !== '') {
                    if (!streetMatch && !houseMatch) continue;
                }

                candidates.push({ 
                    feature, 
                    area, 
                    extension,
                    address: opts.readable_address || props.descr || '',
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

            return candidates;
        }

        // Функция для получения всех полей объекта в виде плоского массива
        function extractAllFields(item) {
            const data = item.rawData;
            const opts = data.opts || {};
            const props = data.props || {};

            const objectType = item.type || data.props.categoryName || '';
            const isLand = isLandObject(objectType);
            
            // Вычисляем УПКС
            let upksValue = parseFloat(opts.cost_index) || 0;
            if (upksValue === 0) {
                const cost = parseFloat(opts.cost_value) || 0;
                const area = parseFloat(opts.specified_area) || item.area || parseFloat(opts.params_built_up_area) || 0;
                if (cost > 0 && area > 0) {
                    upksValue = cost / area;
                }
            }

            // Определяем значение для поля "Площадь/Протяженность"
            let sizeValue = '—';
            if (item.area > 0) {
                sizeValue = item.area.toFixed(1) + ' м²';
                if (item.extension > 0) {
                    sizeValue += ' / ' + item.extension.toFixed(1) + ' м (прот.)';
                }
            } else if (item.extension > 0) {
                sizeValue = item.extension.toFixed(1) + ' м (протяженность)';
            }

            // Определяем значение для "Категория земель" (только для земельных участков)
            let landCategory = '—';
            if (isLand) {
                landCategory = opts.land_record_category_type || props.categoryName || '—';
            }

            // Определяем значение для "ВРИ" (только для земельных участков)
            let vri = '—';
            if (isLand) {
                vri = opts.permitted_uses_name || opts.purpose || opts.params_purpose || '—';
            }

            // Определяем значение для "Назначение" (для всех, кроме земельных участков)
            let purpose = opts.purpose || opts.params_purpose || opts.permitted_use_established_by_document || '—';
            if (isLand) {
                purpose = '—';
            }

            // Собираем все поля в плоский объект
            return {
                'Кадастровый номер': item.cadNumber || '—',
                'Кадастровый квартал': item.cadNumber ? item.cadNumber.split(':').slice(0, 3).join(':') : '—',
                'Тип объекта': objectType || '—',
                'Наименование': opts.params_name || opts.name || opts.building_name || '—',
                'Адрес': item.address || '—',
                'Площадь/Протяженность': sizeValue,
                'Кадастровая стоимость': opts.cost_value ? formatPrice(parseFloat(opts.cost_value)) : '—',
                'УПКС (₽/м²)': upksValue > 0 ? upksValue.toFixed(2) : '—',
                'Назначение': purpose,
                'Статус': opts.common_data_status || opts.status || '—',
                'Форма собственности': opts.ownership_type || '—',
                'Этаж': opts.floor || '—',
                'Родительский объект': opts.parent_cad_number || '—',
                'Год постройки': opts.year_built || opts.params_year_built || '—',
                'Год ввода в эксплуатацию': opts.year_commisioning || opts.params_year_commisioning || '—',
                'Этажность': opts.params_floors || opts.floors || '—',
                'Материал стен': opts.materials || '—',
                'Категория земель': landCategory,
                'ВРИ': vri,
                'Основание оценки': opts.determination_couse ? opts.determination_couse.replace(/\n/g, ' ').trim() : '—',
                'Дата регистрации': opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date || '—'
            };
        }

        // Функция для выполнения поиска
        async function performSearch() {
            const area = parseFloat(areaInput.value);
            const extension = parseFloat(extensionInput.value);
            const address = addressInput.value.trim();

            // Проверяем, что введено хотя бы одно значение
            const hasArea = !isNaN(area) && area > 0;
            const hasExtension = !isNaN(extension) && extension > 0;

            if (!hasArea && !hasExtension) {
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
                // Извлекаем ключевые слова из адреса для поиска
                const keywords = extractSearchKeywords(address);
                const searchQuery = keywords.length > 0 ? keywords[keywords.length - 1] : address;
                
                const nspdApiUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(searchQuery)}&thematicSearchId=1&limit=100`;
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(nspdApiUrl, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Ошибка API НСПД: ${response.status}`);
                }

                const data = await response.json();
                const features = data?.data?.features || [];

                // Фильтруем объекты
                const candidates = findBestMatch(features, area, extension, address);

                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены по заданным критериям.<br>
                            <span class="text-xs">Проверьте правильность адреса и значения (допуск ±1 м²)</span>
                            <br><span class="text-xs">Попробуйте ввести только название месторождения или района</span>
                        </div>
                    `;
                    return;
                }

                // Получаем все поля для каждого объекта
                const tableData = candidates.map(item => extractAllFields(item));
                
                // Получаем список всех ключей (заголовков колонок)
                const allKeys = Object.keys(tableData[0] || {});
                
                // Определяем, какие колонки показывать (все, кроме пустых)
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
                        <span>Всего в ответе: ${features.length}</span>
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
        areaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        extensionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });
        addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
