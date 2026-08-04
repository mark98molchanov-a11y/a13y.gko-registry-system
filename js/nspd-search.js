// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД (ОТДЕЛЬНАЯ ВКЛАДКА)
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

    // Основная функция инициализации
    window.initNSPDSearch = function(containerId) {
        console.log(`🔍 Инициализация поиска НСПД в контейнере: ${containerId}`);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Контейнер ${containerId} не найден`);
            return;
        }

        // Очищаем контейнер перед рендерингом
        container.innerHTML = '';

        // --- Рендерим HTML интерфейс ---
        const html = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">🔍 Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Точная площадь (м²)</label>
                        <input type="number" id="nspd-search-area" 
                               placeholder="Введите площадь, например 45.5" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
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

        // --- Логика поиска ---
        const searchBtn = document.getElementById('nspd-search-btn');
        const areaInput = document.getElementById('nspd-search-area');
        const addressInput = document.getElementById('nspd-search-address');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !areaInput || !addressInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        // Функция для поиска подходящих объектов
        function findBestMatch(features, targetArea, targetAddress) {
            const normalizedTargetAddress = normalizeString(targetAddress);
            const targetHouse = extractHouseNumber(targetAddress);
            const targetStreet = normalizeString(extractStreetFromAddress(targetAddress));

            let candidates = [];
            for (const feature of features) {
                // 1. Извлечение площади (с проверкой по разным полям)
                const props = feature.properties || {};
                const opts = props.options || {};
                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;

                // 2. Проверка площади с допуском ±1 м²
                if (Math.abs(area - targetArea) > 1) continue;

                // 3. Извлечение адреса
                const address = (opts.readable_address || props.descr || '').toLowerCase();
                const nspdHouse = extractHouseNumber(address);
                const nspdStreet = normalizeString(extractStreetFromAddress(address));

                // 4. Проверка улицы
                let streetMatch = false;
                if (targetStreet && nspdStreet) {
                    streetMatch = nspdStreet.includes(targetStreet) || 
                                  targetStreet.includes(nspdStreet) ||
                                  normalizeString(targetStreet) === normalizeString(nspdStreet);
                }

                // 5. Проверка номера дома (если есть в запросе и в НСПД)
                let houseMatch = false;
                if (targetHouse && nspdHouse) {
                    houseMatch = nspdHouse === targetHouse;
                }

                // 6. Объект считается подходящим, если совпадает площадь И (улица ИЛИ дом)
                if (streetMatch || houseMatch) {
                    candidates.push({ 
                        feature, 
                        area, 
                        address: opts.readable_address || props.descr || '',
                        house: nspdHouse,
                        street: nspdStreet,
                        // Дополнительные данные для отображения
                        cadNumber: opts.cad_number || opts.externalKey || '—',
                        type: opts.type || opts.object_type_value || '—',
                        cadastralCost: parseFloat(opts.cost_value) || 0,
                        name: opts.params_name || opts.name || '',
                        // Сохраняем сырые данные для детального отображения
                        rawData: {
                            feature: feature,
                            opts: opts,
                            props: props
                        }
                    });
                }
            }

            // Сортируем по близости площади
            candidates.sort((a, b) => Math.abs(a.area - targetArea) - Math.abs(b.area - targetArea));
            return candidates;
        }

        // Функция для форматирования цены
        function formatPrice(num) {
            if (!num || num === 0) return '—';
            return num.toLocaleString('ru-RU') + ' ₽';
        }

        // Функция для форматирования даты
        function formatDate(date) {
            if (!date) return '—';
            return new Date(date).toLocaleDateString('ru-RU');
        }

        // Функция для отображения детальной информации об объекте (как в NSPDIntegration)
        function displayObjectDetails(item) {
            const data = item.rawData;
            const opts = data.opts || {};
            const props = data.props || {};

            // Определяем тип объекта
            const objectType = item.type || data.props.categoryName || '';
            const isBuilding = objectType.includes('Здание') || objectType.includes('Здания');
            const isPremises = objectType.includes('Помещение') || objectType.includes('Помещения');
            const isStructure = objectType.includes('Сооружение') || objectType.includes('Сооружения');
            const isConstruction = objectType.includes('Объект незавершенного строительства');
            const isComplex = objectType.includes('Единый недвижимый комплекс') || objectType.includes('Единые недвижимые комплексы');
            const isLand = objectType.includes('Земельный участок');
            const isParking = objectType.includes('Машино-место') || objectType.includes('Паркинг') || objectType.includes('машиноместо');

            // Вычисляем УПКС
            let upksValue = parseFloat(opts.cost_index) || 0;
            if (upksValue === 0) {
                const cost = parseFloat(opts.cost_value) || 0;
                const area = parseFloat(opts.specified_area) || item.area || parseFloat(opts.params_built_up_area) || 0;
                if (cost > 0 && area > 0) {
                    upksValue = cost / area;
                }
            }

            // Базовые поля
            const fields = [
                { label: 'Кадастровый номер', value: item.cadNumber || '—', important: true },
                { label: 'Кадастровый квартал', value: item.cadNumber ? item.cadNumber.split(':').slice(0, 3).join(':') : '—' },
                { label: 'Тип объекта', value: objectType || '—', important: true },
                { label: 'Статус', value: opts.common_data_status || opts.status || '—' },
                { label: 'Форма собственности', value: opts.ownership_type || '—' },
                { label: 'Адрес', value: item.address || '—', important: true },
                { label: 'Кадастровая стоимость', value: opts.cost_value ? formatPrice(parseFloat(opts.cost_value)) : '—', important: true },
                { label: 'УПКС', value: upksValue > 0 ? upksValue.toFixed(2) + ' ₽/м²' : '—', important: true },
                { label: 'Назначение', value: opts.purpose || opts.params_purpose || opts.permitted_use_established_by_document || '—' },
            ];

            // Добавляем специфичные поля в зависимости от типа
            if (isParking) {
                fields.push(
                    { label: 'Площадь', value: item.area > 0 ? item.area.toFixed(1) + ' м²' : '—', important: true },
                    { label: 'Этаж', value: opts.floor || '—' },
                    { label: 'Родительский объект', value: opts.parent_cad_number || '—' },
                    { label: 'Год постройки', value: opts.year_built || opts.params_year_built || '—' },
                    { label: 'Год ввода в эксплуатацию', value: opts.year_commisioning || opts.params_year_commisioning || '—' },
                );
            } else if (isPremises) {
                fields.push(
                    { label: 'Тип помещения', value: opts.params_type || opts.params_name || opts.name || '—' },
                    { label: 'Площадь', value: item.area > 0 ? item.area.toFixed(1) + ' м²' : '—', important: true },
                    { label: 'Этаж', value: opts.floor || '—' },
                    { label: 'Родительский объект', value: opts.parent_cad_number || '—' },
                    { label: 'Год постройки', value: opts.year_built || opts.params_year_built || '—' },
                    { label: 'Год ввода в эксплуатацию', value: opts.year_commisioning || opts.params_year_commisioning || '—' },
                );
            } else if (isBuilding) {
                fields.push(
                    { label: 'Наименование', value: opts.params_name || opts.name || opts.building_name || '—' },
                    { label: 'Площадь', value: item.area > 0 ? item.area.toFixed(1) + ' м²' : '—', important: true },
                    { label: 'Этажность', value: opts.params_floors || opts.floors || '—' },
                    { label: 'Год постройки', value: opts.year_built || opts.params_year_built || '—' },
                    { label: 'Год ввода в эксплуатацию', value: opts.year_commisioning || opts.params_year_commisioning || '—' },
                    { label: 'Материал стен', value: opts.materials || '—' },
                    { label: 'Основание оценки', value: opts.determination_couse ? opts.determination_couse.replace(/\n/g, ' ').trim() : '—' },
                );
            } else if (isStructure) {
                fields.push(
                    { label: 'Наименование', value: opts.params_name || opts.name || '—' },
                    { label: 'Площадь', value: item.area > 0 ? item.area.toFixed(1) + ' м²' : '—', important: true },
                    { label: 'Протяженность', value: opts.params_extension ? opts.params_extension + ' м' : '—' },
                    { label: 'Объем', value: opts.params_volume ? opts.params_volume + ' м³' : '—' },
                    { label: 'Высота', value: opts.params_height ? opts.params_height + ' м' : '—' },
                    { label: 'Глубина', value: opts.params_depth ? opts.params_depth + ' м' : '—' },
                    { label: 'Год постройки', value: opts.year_built || opts.params_year_built || '—' },
                    { label: 'Основание оценки', value: opts.determination_couse ? opts.determination_couse.replace(/\n/g, ' ').trim() : '—' },
                );
            } else if (isConstruction) {
                let buildArea = item.area > 0 ? item.area : parseFloat(opts.params_built_up_area);
                fields.push(
                    { label: 'Наименование', value: opts.params_name || opts.name || '—' },
                    { label: 'Площадь застройки', value: buildArea > 0 ? buildArea.toFixed(1) + ' м²' : '—', important: true },
                    { label: 'Степень готовности', value: opts.degree_readiness ? opts.degree_readiness + '%' : '—' },
                    { label: 'Тип права', value: opts.right_type || '—' },
                    { label: 'Объем', value: opts.params_volume ? opts.params_volume + ' м³' : '—' },
                    { label: 'Год постройки', value: opts.year_built || opts.params_year_built || '—' },
                    { label: 'Основание оценки', value: opts.determination_couse ? opts.determination_couse.replace(/\n/g, ' ').trim() : '—' },
                );
            } else if (isComplex) {
                fields.push(
                    { label: 'Наименование', value: opts.params_name || opts.name || '—', important: true },
                    { label: 'Назначение', value: opts.purpose || opts.params_purpose || '—' },
                    { label: 'Год постройки', value: opts.year_built || opts.params_year_built || '—' },
                    { label: 'Год ввода в эксплуатацию', value: opts.year_commisioning || opts.params_year_commisioning || '—' },
                    { label: 'Основание оценки', value: opts.determination_couse ? opts.determination_couse.replace(/\n/g, ' ').trim() : '—' },
                );
            } else if (isLand) {
                const areaValue = parseFloat(opts.specified_area) > 0 
                    ? parseFloat(opts.specified_area).toFixed(1) + ' м²' 
                    : (item.area > 0 ? item.area.toFixed(1) + ' м²' : '—');
                fields.push(
                    { label: 'Площадь', value: areaValue, important: true },
                    { label: 'Категория земель', value: opts.land_record_category_type || props.categoryName || '—' },
                    { label: 'ВРИ', value: opts.permitted_uses_name || opts.purpose || opts.params_purpose || '—' },
                    { label: 'Назначение', value: opts.land_record_subtype || '—' },
                    { label: 'Основание оценки', value: opts.determination_couse ? opts.determination_couse.replace(/\n/g, ' ').trim() : '—' },
                );
            }

            if (opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date) {
                const regDate = opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date;
                fields.push({ label: 'Дата регистрации', value: formatDate(regDate) });
            }

            const visibleFields = fields.filter(f => f.value && f.value !== '—' && f.value !== '');

            // Проверяем наличие геометрии
            const hasGeometry = data.feature?.geometry && data.feature.geometry.coordinates;
            const geometryType = data.feature?.geometry?.type || '';

            // Формируем HTML для отображения деталей
            let detailsHtml = `
                <div style="
                    background: white;
                    border-radius: 8px;
                    padding: 14px 16px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    max-height: 500px;
                    overflow-y: auto;
                    font-family: 'Inter', sans-serif;
                    margin-top: 12px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1; flex-wrap: wrap; gap: 8px;">
                        <span style="font-size: 13px; color: #1e293b;">📋 Данные из НСПД</span>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <span style="font-size: 9px; color: #10b981; background: #dcfce7; padding: 2px 10px; border-radius: 20px;">Найден</span>
                            <span style="font-size: 9px; color: #64748b; background: #f1f5f9; padding: 2px 10px; border-radius: 20px;">
                                ${objectType || 'Объект'}
                            </span>
                            ${hasGeometry ? '<span style="font-size: 9px; color: #0ea5e9; background: #e0f2fe; padding: 2px 10px; border-radius: 20px;">Есть геометрия</span>' : ''}
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; font-size: 12px;">
                        ${visibleFields.map(f => `
                            <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f8fafc; ${f.important ? 'background: #f8fafc; border-radius: 4px; padding-left: 4px; padding-right: 4px;' : ''}">
                                <span style="color: #64748b; font-size: 10px; white-space: nowrap; min-width: 40%;">${f.label}:</span>
                                <span style="color: #1e293b; text-align: right; word-break: break-word; font-size: 10px; max-width: 60%;">${f.value}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                        <button onclick="navigator.clipboard.writeText('${item.cadNumber}').then(() => alert('Кадастровый номер скопирован!'))" 
                                style="padding: 5px 14px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; cursor: pointer; font-size: 10px;">
                            📋 Копировать номер
                        </button>
                        <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                                style="padding: 5px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 10px;">
                            ✕ Очистить
                        </button>
                    </div>
                    
                    <div style="margin-top: 8px; font-size: 8px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                        ${hasGeometry ? `Тип геометрии: ${geometryType}` : 'Геометрия отсутствует'}
                    </div>
                </div>
            `;

            return detailsHtml;
        }

        // Функция для выполнения поиска
        async function performSearch() {
            const area = parseFloat(areaInput.value);
            const address = addressInput.value.trim();

            // Валидация
            if (isNaN(area) || area <= 0) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите корректную площадь.</div>`;
                return;
            }
            if (!address) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Пожалуйста, введите адрес или улицу.</div>`;
                return;
            }

            // Показываем индикатор загрузки
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
                // --- РЕАЛЬНЫЙ ЗАПРОС К API НСПД ---
                const nspdApiUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=100`;
                
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
                console.log(`📥 Получено ${features.length} объектов из НСПД`);

                // Фильтруем объекты
                const candidates = findBestMatch(features, area, address);
                console.log(`🎯 Найдено ${candidates.length} подходящих объектов`);

                // Если ничего не найдено
                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены по заданным критериям.<br>
                            <span class="text-xs">Проверьте правильность адреса и площади (допуск ±1 м²)</span>
                        </div>
                    `;
                    return;
                }

                // Отображаем результаты с детальной информацией
                let resultsHtml = `
                    <div class="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="font-semibold text-slate-700">Найдено объектов: ${candidates.length}</h3>
                            <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                                    class="text-xs text-slate-400 hover:text-slate-600">✕ Очистить</button>
                        </div>
                        <div class="space-y-3 max-h-[600px] overflow-y-auto">
                `;

                candidates.forEach((item, index) => {
                    const cost = item.cadastralCost > 0 ? item.cadastralCost.toLocaleString() + ' ₽' : '—';
                    
                    resultsHtml += `
                        <div class="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition">
                            <div class="flex flex-wrap justify-between items-start gap-2">
                                <div class="flex-1 min-w-0">
                                    <div class="font-mono text-sm font-bold text-slate-800">${item.cadNumber}</div>
                                    <div class="text-sm text-slate-600 truncate" title="${item.address}">${item.address || '—'}</div>
                                    <div class="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                                        <span>Площадь: <strong>${item.area.toFixed(1)} м²</strong></span>
                                        <span>Тип: ${item.type}</span>
                                        ${item.name ? `<span>${item.name}</span>` : ''}
                                        <span>Кад. стоимость: ${cost}</span>
                                        ${item.street ? `<span>Улица: ${item.street}</span>` : ''}
                                        ${item.house ? `<span>Дом: ${item.house}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            ${displayObjectDetails(item)}
                        </div>
                    `;
                });

                resultsHtml += `
                        </div>
                        <div class="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-400">
                            Всего объектов в ответе: ${features.length}, отфильтровано по площади и адресу: ${candidates.length}
                        </div>
                    </div>
                `;
                resultsContainer.innerHTML = resultsHtml;

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
        addressInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') performSearch(); });

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
