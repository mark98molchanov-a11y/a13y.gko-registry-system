// ============================================================
// 🆕 МОДУЛЬ ПОИСКА НСПД (ОТДЕЛЬНАЯ ВКЛАДКА)
// ============================================================
(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    // Функция для нормализации строк (убираем лишние пробеги, приводим к нижнему регистру)
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
                        name: opts.params_name || opts.name || ''
                    });
                }
            }

            // Сортируем по близости площади
            candidates.sort((a, b) => Math.abs(a.area - targetArea) - Math.abs(b.area - targetArea));
            return candidates;
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

                // Отображаем результаты
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
                                <div class="flex gap-2 flex-shrink-0">
                                    <button onclick="alert('Показать на карте для ${item.cadNumber}')" 
                                            class="text-xs bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg border border-brand-200 transition">
                                        🗺️ На карте
                                    </button>
                                    <button onclick="navigator.clipboard.writeText('${item.cadNumber}').then(() => alert('Кадастровый номер скопирован!'))" 
                                            class="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 transition">
                                        📋 Копировать
                                    </button>
                                </div>
                            </div>
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
