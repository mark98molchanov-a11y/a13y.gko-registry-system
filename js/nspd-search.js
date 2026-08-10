(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    const AREA_TOLERANCE = 0.2;
    const GIST_CONFIG = {
        // 🔥 ЗАМЕНИ НА СВОИ ДАННЫЕ!
        token: '',  // Твой GitHub токен
        gistId: '',       // ID существующего Gist или оставь пустым для создания нового
        filename: 'nspd_search_history.sql'
    };
    function getLocalHistory() {
        try {
            return JSON.parse(localStorage.getItem('nspd_search_history') || '[]');
        } catch (e) {
            return [];
        }
    }

       function saveLocalHistory(data) {
        try {
            const history = getLocalHistory();
            const timestamp = new Date().toISOString();
            let addedCount = 0;
            
            data.forEach(row => {
                // 🔥 ПРОВЕРКА НА ДУБЛИКАТЫ
                const isDuplicate = history.some(existing => {
                    // Проверяем по ключевым полям
                    const sameAddress = existing.address === row.address;
                    const sameParam = existing.paramName === row.paramName;
                    const sameValue = Math.abs(existing.paramValue - row.paramValue) < 0.01;
                    const sameCadNumber = existing.cadNumber === row.cadNumber;
                    
                    // Если кадастровый номер определен, проверяем по нему
                    if (row.cadNumber && row.cadNumber !== 'Не определено') {
                        return sameCadNumber;
                    }
                    
                    // Если адрес совпадает, параметр и значение - считаем дубликатом
                    return sameAddress && sameParam && sameValue;
                });
                
                if (!isDuplicate) {
                    history.push({
                        ...row,
                        saved_at: timestamp
                    });
                    addedCount++;
                }
            });
            
            // Ограничиваем размер (последние 1000 записей)
            if (history.length > 1000) {
                history.splice(0, history.length - 1000);
            }
            
            localStorage.setItem('nspd_search_history', JSON.stringify(history));
            console.log(`✅ История сохранена локально: +${addedCount} новых записей, всего: ${history.length}`);
            return true;
        } catch (e) {
            console.warn('⚠️ Ошибка сохранения локальной истории:', e);
            return false;
        }
    }

    // 🔥 ПОЛУЧЕНИЕ ПОСЛЕДНИХ ЗАПИСЕЙ ИЗ GIST
    async function getGistHistory() {
        if (!GIST_CONFIG.token || !GIST_CONFIG.gistId) {
            console.warn('⚠️ Токен или Gist ID не настроены');
            return null;
        }
        
        try {
            const url = `https://api.github.com/gists/${GIST_CONFIG.gistId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${GIST_CONFIG.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const content = data.files?.[GIST_CONFIG.filename]?.content || '';
            
            // Парсим SQL в массив объектов
            const history = parseSQLToArray(content);
            console.log(`📥 Загружено ${history.length} записей из Gist`);
            return history;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки из Gist:', error);
            return null;
        }
    }

    // 🔥 ПАРСИНГ SQL В МАССИВ ОБЪЕКТОВ
    function parseSQLToArray(sqlContent) {
        const history = [];
        const lines = sqlContent.split('\n');
        let inInsert = false;
        let values = [];
        
        for (const line of lines) {
            if (line.includes('INSERT INTO nspd_search_history')) {
                inInsert = true;
                values = [];
                continue;
            }
            
            if (inInsert && line.includes(');')) {
                inInsert = false;
                if (values.length >= 8) {
                    history.push({
                        searchType: values[1]?.replace(/'/g, '') || 'single',
                        address: values[2]?.replace(/'/g, '') || '',
                        paramName: values[3]?.replace(/'/g, '') || '',
                        paramValue: parseFloat(values[4]) || 0,
                        cadNumber: values[5]?.replace(/'/g, '') || 'Не определено',
                        objectView: values[6]?.replace(/'/g, '') || '—',
                        found: parseInt(values[7]) || 0,
                        saved_at: values[0]?.replace(/'/g, '') || new Date().toISOString()
                    });
                }
                continue;
            }
            
            if (inInsert) {
                const matches = line.match(/'([^']*)'|(\d+\.?\d*)/g);
                if (matches) {
                    matches.forEach(m => {
                        values.push(m);
                    });
                }
            }
        }
        
        return history;
    }

    // 🔥 СИНХРОНИЗАЦИЯ ЛОКАЛЬНЫХ ЛОГОВ С GIST
    async function syncLocalToGist() {
        const syncBtn = document.getElementById('nspd-sync-gist');
        const originalText = syncBtn?.innerHTML || 'Обновить SQL в Gist';
        
        try {
            // Меняем состояние кнопки
            if (syncBtn) {
                syncBtn.innerHTML = `
                    <svg class="animate-spin h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Синхронизация...
                `;
                syncBtn.disabled = true;
            }
            
            // 1. Получаем локальную историю
            const localHistory = getLocalHistory();
            if (localHistory.length === 0) {
                alert('📭 Нет локальных записей для синхронизации');
                return;
            }
            
            console.log(`📊 Локальных записей: ${localHistory.length}`);
            
            // 2. Проверяем токен
            if (!GIST_CONFIG.token) {
                const token = prompt('Введите GitHub токен (права на Gist):');
                if (!token) return;
                GIST_CONFIG.token = token;
                localStorage.setItem('github_token', token);
            }
            
            // 3. Проверяем Gist ID
            if (!GIST_CONFIG.gistId) {
                // Создаем новый Gist
                const result = await saveToGist(localHistory);
                if (result && result.id) {
                    GIST_CONFIG.gistId = result.id;
                    localStorage.setItem('gist_id', result.id);
                    alert(`✅ Gist создан! ID: ${result.id}`);
                } else {
                    alert('❌ Не удалось создать Gist');
                    return;
                }
            } else {
               
                const gistHistory = await getGistHistory();
                
    
                const existingKeys = new Set();
                if (gistHistory) {
                    gistHistory.forEach(row => {
                        if (row.cadNumber && row.cadNumber !== 'Не определено') {
                            // Ключ: кадастровый номер + адрес + параметр + значение
                            existingKeys.add(row.cadNumber + row.address + row.paramName + row.paramValue);
                        } else {
                            // Если нет кадастрового номера, используем адрес + параметр + значение
                            existingKeys.add(row.address + row.paramName + row.paramValue);
                        }
                    });
                }
                
                const newRecords = localHistory.filter(row => {
                    let key;
                    if (row.cadNumber && row.cadNumber !== 'Не определено') {
                        key = row.cadNumber + row.address + row.paramName + row.paramValue;
                    } else {
                        key = row.address + row.paramName + row.paramValue;
                    }
                    return !existingKeys.has(key);
                });

                
                if (newRecords.length === 0) {
                    alert('✅ Все записи уже синхронизированы с Gist');
                    return;
                }
                
                console.log(`📤 Новых записей для отправки: ${newRecords.length}`);
                
                // 6. Отправляем новые записи в Gist
                const result = await saveToGist(newRecords);
                if (result) {
                    alert(`✅ Синхронизация завершена! Отправлено ${newRecords.length} записей`);
                    console.log('✅ Синхронизация завершена:', result.html_url);
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            alert('❌ Ошибка синхронизации: ' + error.message);
        } finally {
            // Восстанавливаем кнопку
            if (syncBtn) {
                syncBtn.innerHTML = originalText;
                syncBtn.disabled = false;
            }
        }
    }
    // 🔥 ФУНКЦИЯ СОХРАНЕНИЯ В GIST
    // 🔥 ФУНКЦИЯ СОХРАНЕНИЯ В GIST (С ПРОВЕРКОЙ ДУБЛИКАТОВ)
    async function saveToGist(data) {
        try {
            const timestamp = new Date().toISOString();
            const dateStr = new Date().toISOString().split('T')[0];
            const timeStr = new Date().toISOString().split('T')[1].split('.')[0];
            
            // Формируем SQL-запрос
            let sql = `-- ===========================================\n`;
            sql += `-- НСПД: ИСТОРИЯ ЗАПРОСОВ\n`;
            sql += `-- Дата: ${timestamp}\n`;
            sql += `-- ===========================================\n\n`;
            
            // Создаем таблицу, если её нет
            sql += `CREATE TABLE IF NOT EXISTS nspd_search_history (\n`;
            sql += `    id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
            sql += `    search_date TEXT NOT NULL,\n`;
            sql += `    search_type TEXT NOT NULL,  -- 'single' или 'mass'\n`;
            sql += `    address TEXT NOT NULL,\n`;
            sql += `    param_name TEXT,\n`;
            sql += `    param_value REAL,\n`;
            sql += `    cad_number TEXT,\n`;
            sql += `    object_type TEXT,\n`;
            sql += `    found INTEGER DEFAULT 0,  -- 1 - найден, 0 - не найден\n`;
            sql += `    raw_data TEXT,  -- JSON с полными данными\n`;
            sql += `    UNIQUE(cad_number, address, param_name, param_value)  -- 🔥 УНИКАЛЬНОСТЬ\n`;
            sql += `);\n\n`;
            
            // Вставляем данные с проверкой на дубликаты
            for (const row of data) {
                const found = row.cadNumber && row.cadNumber !== 'Не определено' ? 1 : 0;
                const cadNumber = row.cadNumber || 'Не определено';
                const objectType = row.objectView || '—';
                const rawData = JSON.stringify(row).replace(/'/g, "''");
                
                // 🔥 ИСПОЛЬЗУЕМ INSERT OR IGNORE ДЛЯ ПРОПУСКА ДУБЛИКАТОВ
                sql += `INSERT OR IGNORE INTO nspd_search_history (\n`;
                sql += `    search_date, search_type, address, param_name, param_value,\n`;
                sql += `    cad_number, object_type, found, raw_data\n`;
                sql += `) VALUES (\n`;
                sql += `    '${timestamp}',\n`;
                sql += `    '${row.searchType || 'single'}',\n`;
                sql += `    '${(row.address || '').replace(/'/g, "''")}',\n`;
                sql += `    '${row.paramName || ''}',\n`;
                sql += `    ${row.paramValue || 0},\n`;
                sql += `    '${cadNumber.replace(/'/g, "''")}',\n`;
                sql += `    '${objectType.replace(/'/g, "''")}',\n`;
                sql += `    ${found},\n`;
                sql += `    '${rawData}'\n`;
                sql += `);\n\n`;
            }
            
            // Добавляем статистику
            const totalFound = data.filter(r => r.cadNumber && r.cadNumber !== 'Не определено').length;
            const totalNotFound = data.length - totalFound;
            
            sql += `-- ===========================================\n`;
            sql += `-- СТАТИСТИКА:\n`;
            sql += `-- Всего запросов: ${data.length}\n`;
            sql += `-- Найдено: ${totalFound}\n`;
            sql += `-- Не найдено: ${totalNotFound}\n`;
            sql += `-- ===========================================\n`;
            
            // Отправляем в Gist
            const url = GIST_CONFIG.gistId 
                ? `https://api.github.com/gists/${GIST_CONFIG.gistId}`
                : 'https://api.github.com/gists';
            
            const method = GIST_CONFIG.gistId ? 'PATCH' : 'POST';
            
            // Получаем текущее содержимое, если gistId указан
            let currentContent = '';
            if (GIST_CONFIG.gistId) {
                try {
                    const getResponse = await fetch(url, {
                        headers: {
                            'Authorization': `token ${GIST_CONFIG.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (getResponse.ok) {
                        const gistData = await getResponse.json();
                        currentContent = gistData.files?.[GIST_CONFIG.filename]?.content || '';
                    }
                } catch (e) {
                    console.warn('Не удалось получить текущее содержимое Gist:', e);
                }
            }
            
            // Добавляем новый SQL к существующему
            const newContent = currentContent + '\n' + sql;
            
            const body = {
                description: `НСПД история запросов ${dateStr} ${timeStr}`,
                public: false,
                files: {
                    [GIST_CONFIG.filename]: {
                        content: newContent
                    }
                }
            };
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `token ${GIST_CONFIG.token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify(body)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('✅ История сохранена в Gist:', result.html_url);
            return result;
            
        } catch (error) {
            console.error('❌ Ошибка сохранения в Gist:', error);
            return null;
        }
    }

    // 🔥 ПАРАМЕТРЫ ДЛЯ ПОИСКА (ПЕРЕКЛЮЧАТЕЛЬ)
    const SEARCH_PARAMS = {
        'area': {
            label: 'Площадь',
            unit: 'м²',
            getValue: (opts) => parseFloat(opts.area) || parseFloat(opts.params_area) || parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0,
            searchType: 'quarter'
        },
        'built_up_area': {
            label: 'Площадь застройки',
            unit: 'м²',
            getValue: (opts) => parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
            searchType: 'address'
        },
        'volume': {
            label: 'Объем',
            unit: 'м³',
            getValue: (opts) => parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
            searchType: 'address'
        },
        'extension': {
            label: 'Протяженность',
            unit: 'м',
            getValue: (opts) => parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
            searchType: 'address'
        },
        'land_area': {
            label: 'Площадь ЗУ',
            unit: 'м²',
            getValue: (opts) => parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
            searchType: 'address'
        },
        'depth': {
            label: 'Глубина',
            unit: 'м',
            getValue: (opts) => parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
            searchType: 'address'
        }
    };
    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function extractHouseNumber(address) {
        if (!address) return '';
        const match = address.match(/\b(?:дом|д|д\.)\s*(\d+[А-Яа-я]?)/i);
        return match ? match[1] : '';
    }

    function extractPlotNumber(address) {
        if (!address) return '';
        const match = address.match(/\b(?:участок|уч\.?)\s*(\d+[А-Яа-я]?)/i);
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

    function isAreaMatch(area, targetArea) {
        return Math.abs(area - targetArea) <= AREA_TOLERANCE;
    }

    function isExtensionMatch(extension, targetExtension) {
        if (!targetExtension || targetExtension <= 0) return true;
        return Math.abs(extension - targetExtension) <= AREA_TOLERANCE;
    }

    function isBuiltUpAreaMatch(builtUpArea, targetBuiltUpArea) {
        if (!targetBuiltUpArea || targetBuiltUpArea <= 0) return true;
        return Math.abs(builtUpArea - targetBuiltUpArea) <= AREA_TOLERANCE;
    }

    function isVolumeMatch(volume, targetVolume) {
        if (!targetVolume || targetVolume <= 0) return true;
        return Math.abs(volume - targetVolume) <= AREA_TOLERANCE;
    }

    function isLandAreaMatch(landArea, targetLandArea) {
        if (!targetLandArea || targetLandArea <= 0) return true;
        return Math.abs(landArea - targetLandArea) <= AREA_TOLERANCE;
    }

    function isDepthMatch(depth, targetDepth) {
        if (!targetDepth || targetDepth <= 0) return true;
        return Math.abs(depth - targetDepth) <= AREA_TOLERANCE;
    }

    function getAddress(opts, props) {
        return opts.readable_address || opts.address_readable_address || props.descr || '';
    }

    function getCadNumber(opts, props) {
        return opts.cad_number || 
               opts.cad_num || 
               props.externalKey || 
               opts.externalKey || 
               props.label || 
               opts.label || 
               props.descr || 
               opts.descr || 
               '';
    }

    // ============================================================
    // ФУНКЦИЯ ПОИСКА ПО АДРЕСУ (ДЛЯ КАСКАДНОГО ПОИСКА)
    // ============================================================

async function searchByAddress(address, param, value) {
    console.log(`📌 Исходный адрес: "${address}"`);
    
    function cleanAddress(addr) {
        return addr
            .replace(/\s+/g, ' ')
            .replace(/,\s*,/g, ',')
            .replace(/,\s+/g, ', ')
            .replace(/\s+,/g, ',')
            .replace(/,\s*$/, '')
            .replace(/^\s*,\s*/, '')
            .replace(/["']/g, '')
            .trim();
    }
    
    const cleaned = cleanAddress(address);
    console.log(`🧹 Очищенный адрес: "${cleaned}"`);
    
   function extractParts(addr) {
    let city = '';
    let street = '';
    let number = '';
    
    // 1. ИЗВЛЕКАЕМ ГОРОД
    const cityPatterns = [
        /г\.о\.\s*город\s+([А-Яа-яЁё\s-]+?)(?:\s*[,.]|$)/i,
        /город\s+([А-Яа-яЁё\s-]+?)(?:\s*[,.]|$)/i,
        /г\s+([А-Яа-яЁё\s-]+?)(?:\s*[,.]|$)/i,
    ];
    
    for (const pattern of cityPatterns) {
        const match = addr.match(pattern);
        if (match) {
            city = match[1].trim();
            break;
        }
    }
    
    if (!city) {
        const cities = ['Новый Уренгой', 'Ноябрьск', 'Салехард', 'Муравленко', 'Надым', 'Губкинский', 'Тарко-Сале', 'Лабытнанги'];
        for (const c of cities) {
            if (addr.includes(c)) {
                city = c;
                break;
            }
        }
    }
    
    // 🔥 2. ИЗВЛЕКАЕМ УЛИЦУ (ищем конкретно "проезд Южный", "ул Ленина" и т.д.)
    const streetPatterns = [
        /(ул(?:ица)?\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(проспект\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(проезд\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(пер(?:еулок)?\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(бульвар\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(наб(?:ережная)?\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(шоссе\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(пл(?:ощадь)?\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i,
        /(аллея\.?\s+[А-Яа-яЁё\s-]+?)(?:\s*[,.]|$|д|уч)/i
    ];
    
    for (const pattern of streetPatterns) {
        const match = addr.match(pattern);
        if (match) {
            street = match[1].trim();
            break;
        }
    }
    
    // 3. ИЗВЛЕКАЕМ НОМЕР
    const numberMatch = addr.match(/(?:д(?:ом)?|уч(?:асток)?|дом|участок)\.?\s*([\d]+[А-Яа-я]?)/i);
    if (numberMatch) {
        number = numberMatch[1].trim();
    } else {
        const simpleMatch = addr.match(/(\d+[А-Яа-я]?)$/);
        if (simpleMatch) {
            number = simpleMatch[1].trim();
        }
    }
    
    return { city, street, number };
}
    
    const parts = extractParts(cleaned);
    console.log(`🔑 Извлечено: город="${parts.city}", улица="${parts.street}", номер="${parts.number}"`);
    
    // 🔥 ГЕНЕРИРУЕМ ВСЕ ВОЗМОЖНЫЕ ВАРИАНТЫ
    const variants = [];
    
    // 1. Основные варианты (город + улица + номер)
    if (parts.city && parts.street && parts.number) {
        variants.push(`${parts.city}, ${parts.street}, ${parts.number}`);
        variants.push(`г ${parts.city}, ${parts.street}, ${parts.number}`);
        variants.push(`г. ${parts.city}, ${parts.street}, ${parts.number}`);
    }
    
    // 2. Город + улица
    if (parts.city && parts.street) {
        variants.push(`${parts.city}, ${parts.street}`);
        variants.push(`г ${parts.city}, ${parts.street}`);
        variants.push(`г. ${parts.city}, ${parts.street}`);
    }
    
    // 3. Улица + номер
    if (parts.street && parts.number) {
        variants.push(`${parts.street}, ${parts.number}`);
        variants.push(`${parts.street}, д.${parts.number}`);
        variants.push(`${parts.street}, уч.${parts.number}`);
    }
    
    // 4. Только улица (если есть)
    if (parts.street) {
        variants.push(parts.street);
    }
    
    // 5. Варианты без ДНТ/СНТ/ТСН/ДПК
    let withoutCoop = cleaned
        .replace(/ДНТ\s*["']?[^"',]*["']?\s*,?\s*/gi, '')
        .replace(/СНТ\s*["']?[^"',]*["']?\s*,?\s*/gi, '')
        .replace(/ТСН\s*["']?[^"',]*["']?\s*,?\s*/gi, '')
        .replace(/ДПК\s*["']?[^"',]*["']?\s*,?\s*/gi, '')
        .replace(/территория\s*["']?[^"',]*["']?\s*,?\s*/gi, '')
        .trim()
        .replace(/,\s*,/g, ',')
        .replace(/^,\s*/, '')
        .replace(/,\s*$/, '');
    
    if (withoutCoop.length > 5 && withoutCoop !== cleaned) {
        variants.push(withoutCoop);
        // Также добавляем вариант "город + улица + номер" из очищенного
        if (parts.city && parts.street && parts.number) {
            const short = `${parts.city}, ${parts.street}, ${parts.number}`;
            if (!variants.includes(short)) {
                variants.push(short);
            }
        }
    }
    
    // 6. Полный очищенный адрес
    variants.push(cleaned);
    
    // 7. Дополнительные варианты: "город + номер"
    if (parts.city && parts.number) {
        variants.push(`${parts.city}, ${parts.number}`);
        variants.push(`г ${parts.city}, ${parts.number}`);
    }
    
    // Удаляем дубликаты и пустые
    const allVariants = [...new Set(variants)].filter(a => a && a.length > 5);
    
    console.log(`🔍 Вариантов для поиска: ${allVariants.length}`);
    allVariants.forEach((v, i) => console.log(`  ${i+1}. "${v}"`));
    
    let allFound = [];
    const seenCadNumbers = new Set();
    
    // 🔥 ПРОБУЕМ ВСЕ ВАРИАНТЫ
    for (const variant of allVariants) {
        const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(variant)}&thematicSearchId=1&limit=200`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`ℹ️ По запросу "${variant.substring(0, 50)}..." ничего не найдено (404)`);
                    continue;
                }
                console.warn(`⚠️ Ошибка ${response.status}`);
                continue;
            }
            
            const data = await response.json();
            const features = data?.data?.features || [];
            
            const filtered = features.filter(f => {
                const opts = f.properties?.options || {};
                const paramValue = param.getValue(opts);
                const cadNumber = getCadNumber(opts, {});
                return paramValue > 0 && Math.abs(paramValue - value) <= AREA_TOLERANCE && cadNumber;
            });
            
            for (const f of filtered) {
                const opts = f.properties?.options || {};
                const cadNumber = getCadNumber(opts, {});
                if (cadNumber && !seenCadNumbers.has(cadNumber)) {
                    seenCadNumbers.add(cadNumber);
                    allFound.push(f);
                }
            }
            
            if (allFound.length > 0) {
                console.log(`✅ Найдено ${allFound.length} объектов по варианту: "${variant}"`);
                break;
            }
        } catch (e) {
            console.warn(`Ошибка:`, e.message);
        }
    }
    return allFound;
}
    // ============================================================
    // 🔥 ФУНКЦИИ ДЛЯ МАССОВОГО ПОИСКА
    // ============================================================

function extractAllFields(item) {
    const data = item.rawData;
    const opts = data.opts || {};
    const props = data.props || {};

    // ✅ ТИП ОБЪЕКТА (приоритет: props.categoryName → opts → item)
    const objectType = props.categoryName || 
                       opts.categoryName || 
                       opts.object_type_value || 
                       opts.type || 
                       item.object_type || 
                       item.type || 
                       '';
    
    // ✅ ПРОВЕРКА НА ЗЕМЕЛЬНЫЙ УЧАСТОК
    const isLand = objectType.includes('Земельный участок') || 
                   objectType.includes('Земельный') || 
                   objectType.includes('земельный участок') ||
                   (item.categoryName && item.categoryName.includes('Земельные участки')) ||
                   (opts.categoryName && opts.categoryName.includes('Земельные участки')) ||
                   (props.categoryName && props.categoryName.includes('Земельные участки')) ||
                   (opts.land_record_type && opts.land_record_type.includes('Земельный участок'));
    
    // УПКС
    let upksValue = parseFloat(opts.cost_index) || item.cadastral_index || 0;
    if (upksValue === 0) {
        const cost = parseFloat(opts.cost_value) || item.cadastral_value || 0;
        const area = parseFloat(opts.specified_area) || item.specified_area || item.area || 0;
        if (cost > 0 && area > 0) {
            upksValue = cost / area;
        }
    }

    // ✅ НАИМЕНОВАНИЕ
    let objectName = opts.building_name || 
                     opts.params_name || 
                     opts.name || 
                     item.object_name || 
                     opts.params_type || 
                     objectType || 
                     '';

    // ✅ ВИД ОБЪЕКТА (приоритет: props.categoryName → opts.land_record_type → остальное)
    let objectView = props.categoryName ||   // 🔥 ПЕРВЫЙ ПРИОРИТЕТ для зданий!
                     opts.categoryName || 
                     opts.land_record_type || 
                     opts.object_type_value || 
                     opts.type || 
                     item.object_type || 
                     item.type || 
                     '—';
    if (isLand && (objectView === '—' || objectView === '')) {
        objectView = 'Земельный участок';
    }

    const floorValue = getFloorValue(opts.floor || item.floor);
    const extensionValue = item.params_extension || opts.params_extension || opts.extension || 0;
    const builtUpAreaValue = item.params_built_up_area || opts.params_built_up_area || opts.built_up_area || 0;
    const volumeValue = item.params_volume || opts.params_volume || opts.volume || 0;
    const landAreaValue = item.specified_area || opts.land_record_area || opts.specified_area || 0;
    const depthValue = item.params_depth || opts.params_depth || opts.depth || 0;
    const address = opts.readable_address || opts.address_readable_address || props.descr || item.address || '';
    
    const determinationCouse = opts.determination_couse || item.determination_couse || props.determination_couse || '';

    let displayArea = item.specified_area || item.area || 0;
    if (!displayArea || displayArea === 0) {
        displayArea = parseFloat(opts.area) || 
                      parseFloat(opts.params_area) || 
                      parseFloat(opts.specified_area) || 
                      parseFloat(opts.build_record_area) || 0;
    }

    // 🔥 ВРИ (только для земельных участков)
    let vri = '—';
    if (isLand) {
        vri = opts.permitted_use_established_by_document || 
              item.permitted_use_established_by_document ||
              opts.permitted_uses_name || 
              item.permitted_uses_name || 
              opts.purpose || 
              item.purpose || 
              opts.params_purpose || 
              '—';
    }

    // 🔥 НАЗНАЧЕНИЕ (для всех объектов)
     let purpose = '—';
    if (isLand) {
        // Для земельных участков берем land_record_subtype
        purpose = opts.land_record_subtype || 
                  item.land_record_subtype || 
                  opts.purpose || 
                  item.purpose || 
                  opts.params_purpose || 
                  '—';
    } else {
        // Для всех остальных объектов
        purpose = opts.purpose || 
                  item.purpose || 
                  opts.params_purpose || 
                  opts.permitted_use_established_by_document || 
                  item.permitted_use_established_by_document ||
                  '—';
    }

    // 🔥 КАТЕГОРИЯ ЗЕМЕЛЬ (только для земельных участков)
    let landCategory = '—';
    if (isLand) {
        landCategory = opts.land_record_category_type || 
                       props.land_record_category_type || 
                       item.land_record_category_type || 
                       opts.categoryName || 
                       props.categoryName || 
                       item.categoryName || 
                       '—';
    }

    // 🔥 РОДИТЕЛЬСКИЙ ОБЪЕКТ (parent_cad_number)
    const parentCadNumber = opts.parent_cad_number || 
                            props.parent_cad_number || 
                            item.parent_cad_number || 
                            '—';

    // 🔥 СТАТУС (приоритет: status → common_data_status)
    const status = opts.status || 
                   opts.common_data_status || 
                   item.status || 
                   '—';

    // 🔥 ФОРМА СОБСТВЕННОСТИ (обрабатываем null)
    const ownershipType = (opts.ownership_type !== null && opts.ownership_type !== undefined) 
                          ? opts.ownership_type 
                          : (item.ownership_type || '—');
    
    const yearBuilt = opts.year_built || opts.params_year_built || item.year_built || '—';
    const registrationDate = opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date || item.registration_date || '—';
    const materials = opts.materials || opts.wall_material || props.materials || '—';

    // 🔥 СОБИРАЕМ ВСЕ ПАРАМЕТРЫ В ОДНУ СТРОКУ
    const params = [];
    if (displayArea > 0) params.push(`Площадь (м²): ${displayArea.toFixed(1)}`);
    if (builtUpAreaValue > 0) params.push(`Площадь застройки (м²): ${builtUpAreaValue.toFixed(1)}`);
    if (volumeValue > 0) params.push(`Объем (м³): ${volumeValue.toFixed(1)}`);
    if (extensionValue > 0) params.push(`Протяженность (м): ${extensionValue.toFixed(1)}`);
    if (depthValue > 0) params.push(`Глубина (м): ${depthValue.toFixed(1)}`);
    if (landAreaValue > 0) params.push(`Площадь ЗУ (м²): ${landAreaValue.toFixed(1)}`);
    
    const paramsStr = params.length > 0 ? params.join('; ') : '—';

    // 🔥 КАДАСТРОВЫЙ НОМЕР
    const cadNumber = item.cadastral_number || 
                      item.cadNumber || 
                      opts.cad_number || 
                      opts.cad_num || 
                      props.externalKey || 
                      props.label || 
                      props.descr || 
                      '—';

    return {
        'Кадастровый номер': cadNumber,
        'Вид объекта': objectView,
        'Наименование': objectName || '—',
        'Материал стен': materials || '—',
        'Адрес': address || '—',
        'Параметры': paramsStr,
        'Кадастровая стоимость': (opts.cost_value || item.cadastral_value) > 0 ? formatPrice(parseFloat(opts.cost_value || item.cadastral_value)) : '—',
        'УПКС (₽/м²)': upksValue > 0 ? upksValue.toFixed(2) : '—',
        'ВРИ': vri,
        'Назначение': purpose,
        'Родительский объект': parentCadNumber,
        'Статус': status,
        'Форма собственности': ownershipType,
        'Этаж': floorValue,
        'Год постройки': yearBuilt,
        'Категория земель': landCategory,
        'Дата регистрации': registrationDate,
        'Основание оценки': determinationCouse || '—'
    };
}
    function exportResults() {
        const table = document.querySelector('#nspd-search-results table');
        if (!table) {
            alert('Нет данных для экспорта');
            return;
        }
        
        const rows = [];
        const headers = [];
        const ths = table.querySelectorAll('thead th');
        ths.forEach(th => headers.push(th.textContent.trim()));
        rows.push(headers);
        
        const trs = table.querySelectorAll('tbody tr');
        trs.forEach(tr => {
            const row = [];
            const tds = tr.querySelectorAll('td');
            tds.forEach(td => row.push(td.textContent.trim()));
            rows.push(row);
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 1.5, 15) }));
        XLSX.utils.book_append_sheet(wb, ws, 'Результаты');
        XLSX.writeFile(wb, 'nspd_search_results.xlsx');
    }

    function downloadTemplate() {
        if (typeof XLSX === 'undefined') {
            const headers = ['Адрес', 'Параметр', 'Значение'];
            const example = [
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, жилрайон Коротчаево', 'Протяженность', '113'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, мкр Мирный, д 1, корп 7, кв 84', 'Площадь', '66.8'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, улица Шоссейная, земельный участок 55', 'Площадь ЗУ', '1465'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Геологоразведчиков, д 12', 'Площадь застройки', '450'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул 26 Съезда КПСС, д 8', 'Объем', '1250'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Строителей, д 5', 'Глубина', '4555']
            ];
            
            let csv = '\uFEFF' + headers.join(';') + '\n';
            example.forEach(row => {
                csv += row.join(';') + '\n';
            });
            
            csv += '\n# Доступные параметры (пишите как в списке):\n';
            for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
                csv += `# ${param.label}\n`;
            }
            csv += '# Допуск: ±0.2\n';
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'nspd_search_template.csv';
            link.click();
            URL.revokeObjectURL(link.href);
            return;
        }

        const data = [
            ['Адрес', 'Параметр', 'Значение'],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, жилрайон Коротчаево', 'Протяженность', 113],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, мкр Мирный, д 1, корп 7, кв 84', 'Площадь', 66.8],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, улица Шоссейная, земельный участок 55', 'Площадь ЗУ', 1465],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Геологоразведчиков, д 12', 'Площадь застройки', 450],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул 26 Съезда КПСС, д 8', 'Объем', 1250],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Строителей, д 5', 'Глубина', 4555]
        ];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 70 }, { wch: 25 }, { wch: 15 }];
        
        const paramLabels = Object.values(SEARCH_PARAMS).map(p => p.label);
        const validation = {
            type: 'list',
            operator: 'between',
            formula1: '"' + paramLabels.join(',') + '"',
            showErrorMessage: true,
            errorTitle: 'Ошибка ввода',
            error: 'Выберите значение из списка: ' + paramLabels.join(', ')
        };
        
        ws['!validations'] = [];
        for (let i = 2; i <= 100; i++) {
            ws['!validations'].push({
                ref: 'B' + i,
                validation: validation
            });
        }
        
        XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
        XLSX.writeFile(wb, 'nspd_search_template.xlsx');
    }

function displayMassResults(candidates, notFoundItems, container, searchParamLabel) {
    let tableData = [];
    
    // 🔥 ДОБАВЛЯЕМ НАЙДЕННЫЕ ОБЪЕКТЫ
    candidates.forEach(item => {
        const fields = extractAllFields(item);
        fields['Параметр поиска'] = searchParamLabel || '—';
        tableData.push(fields);
    });
    
    // 🔥 ДОБАВЛЯЕМ НЕНАЙДЕННЫЕ ОБЪЕКТЫ С ИНФОРМАЦИЕЙ
    notFoundItems.forEach(item => {
        const paramDisplay = item.paramLabel + (item.paramUnit ? ` (${item.paramUnit})` : '');
        const valueDisplay = item.paramValue > 0 ? item.paramValue : '—';
        
        const emptyRow = {
            'Параметр поиска': paramDisplay,
            'Кадастровый номер': 'Не определено',
            'Вид объекта': '—',
            'Наименование': '—',
            'Материал стен': '—',
            'Адрес': item.address || '—',  // 🔥 СОХРАНЯЕМ АДРЕС
            'Параметры': `Искомое значение: ${valueDisplay}`,
            'Кадастровая стоимость': '—',
            'УПКС (₽/м²)': '—',
            'ВРИ': '—',
            'Назначение': '—',
            'Родительский объект': '—',
            'Статус': '—',
            'Форма собственности': '—',
            'Этаж': '—',
            'Год постройки': '—',
            'Категория земель': '—',
            'Дата регистрации': '—',
            'Основание оценки': '—'
        };
        tableData.push(emptyRow);
    });
    
    const orderedColumns = [
        'Параметр поиска',
        'Кадастровый номер',
        'Вид объекта',
        'Наименование',
        'Материал стен',
        'Адрес',
        'Параметры',
        'Кадастровая стоимость',
        'УПКС (₽/м²)',
        'ВРИ',
        'Назначение',
        'Родительский объект',
        'Статус',
        'Форма собственности',
        'Этаж',
        'Год постройки',
        'Категория земель',
        'Дата регистрации',
        'Основание оценки'
    ];

    let html = '';
    const notFoundCount = notFoundItems.length;
    if (notFoundCount > 0) {
        html += `
            <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-sm mb-3">
                ✅ Найдено: <strong>${candidates.length}</strong> объектов | 
                ❌ Не найдено: <strong>${notFoundCount}</strong>
            </div>
        `;
    } else {
        html += `
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-3">
                ✅ Найдено: <strong>${candidates.length}</strong> объектов
            </div>
        `;
    }

    html += `
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

    if (tableData.length === 0) {
        html += `
            <tr>
                <td colspan="${orderedColumns.length + 1}" style="padding: 20px; text-align: center; color: #94a3b8;">
                    Объекты не найдены
                </td>
            </tr>
        `;
    } else {
        tableData.forEach((row, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            const isNotFound = row['Кадастровый номер'] === 'Не определено';
            const rowStyle = isNotFound ? 'background: #fef2f2; border-left: 3px solid #ef4444;' : '';
            
            html += `
                <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9; ${rowStyle}">
                    <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                    ${orderedColumns.map(col => {
                        let val = row[col] || '—';
                        if (col === 'Кадастровый номер' && val === 'Не определено') {
                            return `<td style="padding: 6px 10px; color: #dc2626; font-weight: 600; font-size: 10px;">${val}</td>`;
                        }
                        // 🔥 ДЛЯ АДРЕСА ДЕЛАЕМ ПЕРЕНЕС, ЧТОБЫ БЫЛО ВИДНО
                        if (col === 'Адрес' && val !== '—' && val.length > 50) {
                            return `<td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px;" title="${val}">${val}</td>`;
                        }
                        return `<td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${val}">${val}</td>`;
                    }).join('')}
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; padding: 0 4px; flex-wrap: wrap; gap: 8px;">
            <span>Всего объектов: <strong>${tableData.length}</strong> (найдено: ${candidates.length}, не найдено: ${notFoundCount})</span>
            <div style="display: flex; gap: 8px;">
                <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                        style="padding: 4px 16px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 11px;">
                    ✕ Очистить
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    const exportBtn = document.getElementById('nspd-export-results');
    if (exportBtn && candidates.length > 0) {
        exportBtn.style.display = 'inline-flex';
    }
}
   async function uploadData(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        
        if (!isExcel) {
            const container = document.getElementById('nspd-search-results');
            if (container) container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Поддерживаются только файлы Excel (.xlsx, .xls)</div>`;
            return;
        }
        
        if (typeof XLSX === 'undefined') {
            const container = document.getElementById('nspd-search-results');
            if (container) container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Библиотека XLSX не загружена</div>`;
            return;
        }
        
        function getParamKeyByLabel(label) {
            for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
                if (param.label === label.trim()) {
                    return key;
                }
            }
            return null;
        }
        
function processRows(rows) {
    let attempts = 0;
    const maxAttempts = 100;
    
    function waitForContainer() {
        const container = document.getElementById('nspd-search-results');
        
        if (container) {
            if (rows.length === 0) {
                container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Нет данных для обработки. Проверьте названия параметров.</div>`;
                return;
            }
            
            const progressContainer = document.getElementById('nspd-progress-container');
            const progressBar = document.getElementById('nspd-progress-bar');
            const progressText = document.getElementById('nspd-progress-text');
            if (progressContainer) progressContainer.style.display = 'block';
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = '0%';
            
            let allResults = [];
            let notFoundItems = [];
            let total = rows.length;
            
            (async function() {
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const percent = Math.round(((i + 1) / total) * 100);
                    if (progressBar) progressBar.style.width = percent + '%';
                    if (progressText) progressText.textContent = `${percent}% (${i + 1}/${total})`;
                    
                    const param = SEARCH_PARAMS[row.param];
                    if (!param) {
                        notFoundItems.push({
                            address: row.address,
                            paramLabel: row.param,
                            paramValue: row.value
                        });
                        continue;
                    }
                    
                    try {
                        const features = await searchByAddress(row.address, param, row.value);
                        if (features.length > 0) {
                            let candidates = features.map(f => {
                                const props = f.properties || {};
                                const opts = props.options || {};
                                return {
                                    feature: f,
                                    area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                                    builtUpArea: parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
                                    volume: parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
                                    extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                                    landArea: parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
                                    depth: parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
                                    address: opts.address_readable_address || opts.readable_address || '',
                                    cadNumber: getCadNumber(opts, props),
                                    type: opts.type || opts.object_type_value || '—',
                                    cadastralCost: parseFloat(opts.cost_value) || 0,
                                    name: opts.params_name || opts.name || '',
                                    determination_couse: opts.determination_couse || '',
                                    rawData: { feature: f, opts: opts, props: props }
                                };
                            });
                            
                            if (candidates.length > 1) {
                                function getAddressScore(candidateAddress, targetAddress) {
                                    if (!candidateAddress || !targetAddress) return 0;
                                    const normalizedTarget = normalizeString(targetAddress);
                                    const normalizedCandidate = normalizeString(candidateAddress);
                                    
                                    let score = 0;
                                    if (normalizedCandidate === normalizedTarget) return 100;
                                    if (normalizedCandidate.includes(normalizedTarget)) score += 50;
                                    if (normalizedTarget.includes(normalizedCandidate)) score += 30;
                                    
                                    const targetHouse = extractHouseNumber(targetAddress);
                                    const candidateHouse = extractHouseNumber(candidateAddress);
                                    if (targetHouse && candidateHouse && targetHouse === candidateHouse) score += 20;
                                    
                                    const targetPlot = extractPlotNumber(targetAddress);
                                    const candidatePlot = extractPlotNumber(candidateAddress);
                                    if (targetPlot && candidatePlot && targetPlot === candidatePlot) score += 20;
                                    
                                    score += normalizedCandidate.length / 10;
                                    return score;
                                }
                                
                                candidates.sort((a, b) => {
                                    const scoreA = getAddressScore(a.address, row.address);
                                    const scoreB = getAddressScore(b.address, row.address);
                                    return scoreB - scoreA;
                                });
                                
                                candidates = candidates.slice(0, 1);
                            }
                            
                            allResults = allResults.concat(candidates);
                        } else {
                            const paramLabel = SEARCH_PARAMS[row.param]?.label || row.param;
                            notFoundItems.push({
                                address: row.address,
                                paramLabel: paramLabel,
                                paramValue: row.value,
                                paramUnit: SEARCH_PARAMS[row.param]?.unit || ''
                            });
                        }
                    } catch (e) {
                        console.warn('Ошибка при поиске для строки', i + 1, ':', e.message);
                        const paramLabel = SEARCH_PARAMS[row.param]?.label || row.param;
                        notFoundItems.push({
                            address: row.address,
                            paramLabel: paramLabel,
                            paramValue: row.value,
                            paramUnit: SEARCH_PARAMS[row.param]?.unit || ''
                        });
                    }
                }
                
                if (progressContainer) progressContainer.style.display = 'none';
                
                const searchParamLabel = rows.length > 0 ? SEARCH_PARAMS[rows[0].param]?.label || '—' : '—';
                displayMassResults(allResults, notFoundItems, container, searchParamLabel);

                // 🔥 СОХРАНЯЕМ В ИСТОРИЮ (массовый запрос)
                (async function() {
                    try {
                        const historyData = [];
                        
                        allResults.forEach(item => {
                            const fields = extractAllFields(item);
                            historyData.push({
                                searchType: 'mass',
                                address: fields['Адрес'] || '—',
                                paramName: searchParamLabel || '—',
                                paramValue: 0,
                                cadNumber: fields['Кадастровый номер'] || 'Не определено',
                                objectView: fields['Вид объекта'] || '—',
                                found: 1
                            });
                        });
                        
                        notFoundItems.forEach(item => {
                            historyData.push({
                                searchType: 'mass',
                                address: item.address || '—',
                                paramName: item.paramLabel || '—',
                                paramValue: item.paramValue || 0,
                                cadNumber: 'Не определено',
                                objectView: '—',
                                found: 0
                            });
                        });
                        
                                             saveLocalHistory(historyData);
                        
                        // Если есть токен и Gist ID, пробуем сохранить в Gist
                        if (GIST_CONFIG.token && GIST_CONFIG.gistId && historyData.length > 0) {
                            try {
                                await saveToGist(historyData);
                            } catch (e) {
                                console.debug('⚠️ Не удалось сохранить в Gist:', e.message);
                            }
                        }
                    } catch (e) {
                        console.debug('⚠️ Не удалось сохранить историю:', e.message);
                    }
                })();
                
            })();  // 🔥 ВОТ ЭТУ СКОБКУ ТЫ ПОТЕРЯЛ!
            
        } else {
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(waitForContainer, 100);
            } else {
                console.error('❌ resultsContainer не появился после ожидания');
                const container = document.getElementById('nspd-search-results');
                if (container) {
                    container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Ошибка: контейнер результатов не найден. Попробуйте обновить страницу.</div>`;
                }
            }
        }
    }
    
    waitForContainer();
}
        
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        const nonEmptyRows = jsonData.filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
        const headerRow = nonEmptyRows[0] || [];
        const dataRows = nonEmptyRows.slice(1);
        
        const headers = headerRow.map(h => String(h || '').trim().toLowerCase());
        
        let addressIdx = headers.findIndex(h => 
            h.includes('адрес') || h.includes('address') || h.includes('объект') || 
            h.includes('местоположение') || h.includes('location')
        );
        
        let paramIdx = headers.findIndex(h => 
            h.includes('параметр') || h.includes('param') || h.includes('тип') || 
            h.includes('характеристика') || h.includes('показатель')
        );
        
        let valueIdx = headers.findIndex(h => 
            h.includes('значение') || h.includes('value') || h.includes('число') ||
            h.includes('площадь') || h.includes('протяженность') || h.includes('глубина')
        );
        
        if (addressIdx === -1 || paramIdx === -1 || valueIdx === -1) {
            addressIdx = 0;
            paramIdx = 1;
            valueIdx = 2;
        }
        
        console.log(`📋 Заголовки:`, headers);
        console.log(`📍 Используем колонки: Адрес=${addressIdx}, Параметр=${paramIdx}, Значение=${valueIdx}`);
        
        const rows = [];
        for (const row of dataRows) {
            if (row.length > Math.max(addressIdx, paramIdx, valueIdx)) {
                const paramValue = String(row[paramIdx] || '').trim();
                let paramKey = getParamKeyByLabel(paramValue);
                if (!paramKey && SEARCH_PARAMS[paramValue]) {
                    paramKey = paramValue;
                }
                if (!paramKey) {
                    for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
                        if (paramValue.toLowerCase().includes(param.label.toLowerCase()) || 
                            param.label.toLowerCase().includes(paramValue.toLowerCase())) {
                            paramKey = key;
                            break;
                        }
                    }
                }
                if (paramKey) {
                    rows.push({
                        address: String(row[addressIdx] || '').trim(),
                        param: paramKey,
                        value: parseFloat(row[valueIdx]) || 0
                    });
                }
            }
        }
        
        console.log(`✅ Распаршено ${rows.length} строк`);
        processRows(rows);
    };
    
    reader.readAsArrayBuffer(file);
}

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================

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
            paramOptions += `<option value="${key}">${param.label} (${param.unit})</option>`;
        }

        const html = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
    <div class="flex items-center gap-1.5 mb-1">
        <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-xs text-slate-500">Вводите точный адрес: <span class="font-medium text-slate-600">Город, улица, номер</span></span>
    </div>
    <input type="text" id="nspd-search-address" 
           placeholder="Например: Новый Уренгой, ул. Ленина, д. 10" 
           class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
</div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Параметр</label>
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
                        <span class="text-xs text-slate-400 mt-1 block" id="nspd-search-unit">Допуск ±${AREA_TOLERANCE}</span>
                    </div>
                </div>

                               <div class="flex flex-wrap gap-3 mb-4">
                    <button id="nspd-search-btn" 
                            class="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Найти объект
                    </button>

                    <button id="nspd-download-template" 
                            class="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Скачать шаблон
                    </button>

                    <label id="nspd-upload-btn" 
                           class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                        </svg>
                        Загрузить данные
                        <input type="file" id="nspd-file-input" accept=".xlsx,.xls,.csv" style="display:none">
                    </label>

                    <button id="nspd-export-results" 
                            class="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2" style="display:none;">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Экспорт в Excel
                    </button>

                    <button id="nspd-sync-gist" 
        class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Обновить SQL в Gist
                    </button>
                </div>

                <div id="nspd-progress-container" style="display:none;" class="mb-4">
                    <div class="flex justify-between text-sm text-slate-600 mb-1">
                        <span>Обработка...</span>
                        <span id="nspd-progress-text">0%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2.5">
                        <div id="nspd-progress-bar" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                </div>

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
                unitLabel.textContent = `Допуск ±${AREA_TOLERANCE} ${param.unit}`;
            }
        });

        // ============================================================
        // 🔥 ОБНОВЛЕННАЯ ФУНКЦИЯ findBestMatch С ПРОВЕРКОЙ ПО НОМЕРУ УЧАСТКА И ГЛУБИНЕ
        // ============================================================

        function findBestMatch(features, targetArea, targetBuiltUpArea, targetVolume, targetExtension, targetLandArea, targetDepth, targetAddress) {
            const normalizedTargetAddress = normalizeString(targetAddress);
            const targetHouse = extractHouseNumber(targetAddress);
            const targetStreet = normalizeString(extractStreetFromAddress(targetAddress));
            const targetPlot = extractPlotNumber(targetAddress);

            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                if (targetArea && targetArea > 0 && !isAreaMatch(area, targetArea)) continue;

                let builtUpArea = parseFloat(opts.built_up_area) || 
                                  parseFloat(opts.params_built_up_area) || 
                                  parseFloat(opts.area) || 0;
                if (targetBuiltUpArea && targetBuiltUpArea > 0 && !isBuiltUpAreaMatch(builtUpArea, targetBuiltUpArea)) continue;

                let volume = parseFloat(opts.volume) || 
                             parseFloat(opts.params_volume) || 0;
                if (targetVolume && targetVolume > 0 && !isVolumeMatch(volume, targetVolume)) continue;

                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                if (targetExtension && targetExtension > 0 && !isExtensionMatch(extension, targetExtension)) continue;

                let landArea = parseFloat(opts.land_record_area) || 
                               parseFloat(opts.specified_area) || 0;
                if (targetLandArea && targetLandArea > 0 && !isLandAreaMatch(landArea, targetLandArea)) continue;

                let depth = parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
                if (targetDepth && targetDepth > 0 && !isDepthMatch(depth, targetDepth)) continue;

                const address = getAddress(opts, props);
                const addressLower = address.toLowerCase();
                const nspdHouse = extractHouseNumber(addressLower);
                const nspdStreet = normalizeString(extractStreetFromAddress(addressLower));
                const nspdPlot = extractPlotNumber(address);

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

                let plotMatch = false;
                if (targetPlot && nspdPlot) {
                    plotMatch = nspdPlot === targetPlot;
                }

                let fullAddressMatch = false;
                if (targetAddress && address) {
                    const normalizedAddress = normalizeString(address);
                    const normalizedTarget = normalizeString(targetAddress);
                    fullAddressMatch = normalizedAddress.includes(normalizedTarget) || 
                                       normalizedTarget.includes(normalizedAddress);
                }

                if (streetMatch || houseMatch || plotMatch || fullAddressMatch) {
                    candidates.push({ 
                        feature, 
                        area, 
                        builtUpArea: builtUpArea,
                        volume: volume,
                        extension: extension,
                        landArea: landArea,
                        depth: depth,
                        address: address,
                        house: nspdHouse,
                        street: nspdStreet,
                        cadNumber: getCadNumber(opts, props),
                        type: opts.type || opts.object_type_value || '—',
                        cadastralCost: parseFloat(opts.cost_value) || 0,
                        name: opts.params_name || opts.name || '',
                        determination_couse: opts.determination_couse || '',
                        rawData: {
                            feature: feature,
                            opts: opts,
                            props: props
                        }
                    });
                }
            }

            candidates.sort((a, b) => {
                const diffA = Math.abs(a.area - targetArea) + Math.abs(a.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(a.volume - targetVolume) + Math.abs(a.extension - targetExtension) +
                              Math.abs(a.landArea - targetLandArea) + Math.abs(a.depth - targetDepth);
                const diffB = Math.abs(b.area - targetArea) + Math.abs(b.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(b.volume - targetVolume) + Math.abs(b.extension - targetExtension) +
                              Math.abs(b.landArea - targetLandArea) + Math.abs(b.depth - targetDepth);
                return diffA - diffB;
            });
            return candidates;
        }

        // ============================================================
        // ФУНКЦИЯ findInQuarter
        // ============================================================

        function findInQuarter(features, targetArea, targetBuiltUpArea, targetVolume, targetExtension, targetLandArea, targetDepth, targetQuarter) {
            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                const cadNumber = getCadNumber(opts, props);
                const quarter = extractCadastralQuarter(cadNumber);
                if (quarter !== targetQuarter) continue;

                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                if (targetArea && targetArea > 0 && !isAreaMatch(area, targetArea)) continue;

                let builtUpArea = parseFloat(opts.built_up_area) || 
                                  parseFloat(opts.params_built_up_area) || 
                                  parseFloat(opts.area) || 0;
                if (targetBuiltUpArea && targetBuiltUpArea > 0 && !isBuiltUpAreaMatch(builtUpArea, targetBuiltUpArea)) continue;

                let volume = parseFloat(opts.volume) || 
                             parseFloat(opts.params_volume) || 0;
                if (targetVolume && targetVolume > 0 && !isVolumeMatch(volume, targetVolume)) continue;

                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                if (targetExtension && targetExtension > 0 && !isExtensionMatch(extension, targetExtension)) continue;

                let landArea = parseFloat(opts.land_record_area) || 
                               parseFloat(opts.specified_area) || 0;
                if (targetLandArea && targetLandArea > 0 && !isLandAreaMatch(landArea, targetLandArea)) continue;

                let depth = parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
                if (targetDepth && targetDepth > 0 && !isDepthMatch(depth, targetDepth)) continue;

                const address = getAddress(opts, props);

                candidates.push({ 
                    feature, 
                    area, 
                    builtUpArea: builtUpArea,
                    volume: volume,
                    extension: extension,
                    landArea: landArea,
                    depth: depth,
                    address: address,
                    house: extractHouseNumber(address),
                    street: normalizeString(extractStreetFromAddress(address)),
                    cadNumber: cadNumber || '—',
                    type: opts.type || opts.object_type_value || '—',
                    cadastralCost: parseFloat(opts.cost_value) || 0,
                    name: opts.params_name || opts.name || '',
                    determination_couse: opts.determination_couse || '',
                    rawData: {
                        feature: feature,
                        opts: opts,
                        props: props
                    }
                });
            }

            candidates.sort((a, b) => {
                const diffA = Math.abs(a.area - targetArea) + Math.abs(a.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(a.volume - targetVolume) + Math.abs(a.extension - targetExtension) +
                              Math.abs(a.landArea - targetLandArea) + Math.abs(a.depth - targetDepth);
                const diffB = Math.abs(b.area - targetArea) + Math.abs(b.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(b.volume - targetVolume) + Math.abs(b.extension - targetExtension) +
                              Math.abs(b.landArea - targetLandArea) + Math.abs(b.depth - targetDepth);
                return diffA - diffB;
            });
            return candidates;
        }


        async function performSearch(container) {
            const address = addressInput.value.trim();
            const paramKey = paramSelect.value;
            const value = parseFloat(valueInput.value) || 0;

            // Используем переданный container или ищем по id
            const resultsContainer = container || document.getElementById('nspd-search-results');
            
            if (!resultsContainer) {
                console.error('❌ resultsContainer не найден');
                return;
            }

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
                let candidates = [];
                let searchMethod = '';

                console.log(`🔍 Поиск по адресу: ${address}`);
                console.log(`🔍 Параметр: ${param.label} = ${value} ${param.unit}`);

                // ШАГ 1: ПОИСК ПО АДРЕСУ
                console.log(`📡 ШАГ 1: Поиск по адресу (как для extension)`);
                const addressFeatures = await searchByAddress(address, param, value);
                
                if (addressFeatures.length > 0) {
                    candidates = addressFeatures.map(f => {
                        const props = f.properties || {};
                        const opts = props.options || {};
                        return {
                            feature: f,
                            area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                            builtUpArea: parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
                            volume: parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
                            extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                            landArea: parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
                            depth: parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
                            address: opts.address_readable_address || opts.readable_address || '',
                            cadNumber: getCadNumber(opts, props),
                            type: opts.type || opts.object_type_value || '—',
                            cadastralCost: parseFloat(opts.cost_value) || 0,
                            name: opts.params_name || opts.name || '',
                            determination_couse: opts.determination_couse || '',
                            rawData: {
                                feature: f,
                                opts: opts,
                                props: props
                            }
                        };
                    });
                    searchMethod = `адрес + ${param.label}`;
                    console.log(`✅ Найдено ${candidates.length} объектов по адресу`);
                }

                // ШАГ 2: ЕСЛИ НЕ НАШЛИ — ПОИСК ПО КВАРТАЛАМ (ТОЛЬКО ДЛЯ area)
                if (candidates.length === 0 && paramKey === 'area') {
                    console.log(`📡 ШАГ 2: Поиск по кварталам (fallback для площади)`);
                    searchMethod = `кварталы + ${param.label}`;
                    
                    const firstUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=200`;
                    const firstResponse = await fetch(firstUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (firstResponse.ok) {
                        const firstData = await firstResponse.json();
                        const firstFeatures = firstData?.data?.features || [];
                        
                        const quarters = new Set();
                        for (const feature of firstFeatures) {
                            const opts = feature.properties?.options || {};
                            const cadNumber = getCadNumber(opts, {});
                            if (cadNumber) {
                                const quarter = extractCadastralQuarter(cadNumber);
                                if (quarter) {
                                    quarters.add(quarter);
                                }
                            }
                        }
                        console.log(`🏘️ Найдено ${quarters.size} уникальных кварталов`);

                        for (const quarter of quarters) {
                            console.log(`🔍 Поиск по кварталу ${quarter}`);
                            const quarterUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=500`;
                            const quarterResponse = await fetch(quarterUrl, {
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            });

                            if (quarterResponse.ok) {
                                const quarterData = await quarterResponse.json();
                                const qFeatures = quarterData?.data?.features || [];
                                console.log(`   В квартале ${quarter} найдено ${qFeatures.length} объектов`);
                                
                                const qCandidates = findInQuarter(qFeatures, value, 0, 0, 0, 0, 0, quarter);
                                if (qCandidates.length > 0) {
                                    candidates = candidates.concat(qCandidates);
                                    console.log(`   ✅ Найдено ${qCandidates.length} объектов в квартале ${quarter}`);
                                }
                            }
                        }
                    }
                }

                // ШАГ 3: ЕСЛИ ВСЕ ЕЩЕ НЕ НАШЛИ — ПОИСК ПО КВАРТАЛАМ ДЛЯ ВСЕХ
                if (candidates.length === 0) {
                    console.log(`📡 ШАГ 3: Поиск по кварталам (финальный fallback)`);
                    
                    const firstUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=200`;
                    const firstResponse = await fetch(firstUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (firstResponse.ok) {
                        const firstData = await firstResponse.json();
                        const firstFeatures = firstData?.data?.features || [];
                        
                        const quarters = new Set();
                        for (const feature of firstFeatures) {
                            const opts = feature.properties?.options || {};
                            const cadNumber = getCadNumber(opts, {});
                            if (cadNumber) {
                                const quarter = extractCadastralQuarter(cadNumber);
                                if (quarter) {
                                    quarters.add(quarter);
                                }
                            }
                        }
                        console.log(`🏘️ Найдено ${quarters.size} уникальных кварталов`);

                        for (const quarter of quarters) {
                            console.log(`🔍 Поиск по кварталу ${quarter}`);
                            const quarterUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=500`;
                            const quarterResponse = await fetch(quarterUrl, {
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            });

                            if (quarterResponse.ok) {
                                const quarterData = await quarterResponse.json();
                                const qFeatures = quarterData?.data?.features || [];
                                console.log(`   В квартале ${quarter} найдено ${qFeatures.length} объектов`);
                                
                                const filtered = qFeatures.filter(f => {
                                    const opts = f.properties?.options || {};
                                    const paramValue = param.getValue(opts);
                                    const cadNumber = getCadNumber(opts, {});
                                    return paramValue > 0 && Math.abs(paramValue - value) <= AREA_TOLERANCE && cadNumber;
                                });
                                
                                if (filtered.length > 0) {
                                    const formatted = filtered.map(f => {
                                        const props = f.properties || {};
                                        const opts = props.options || {};
                                        return {
                                            feature: f,
                                            area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                                            builtUpArea: parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
                                            volume: parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
                                            extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                                            landArea: parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
                                            depth: parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
                                            address: opts.address_readable_address || opts.readable_address || '',
                                            cadNumber: getCadNumber(opts, props),
                                            type: opts.type || opts.object_type_value || '—',
                                            cadastralCost: parseFloat(opts.cost_value) || 0,
                                            name: opts.params_name || opts.name || '',
                                            determination_couse: opts.determination_couse || '',
                                            rawData: {
                                                feature: f,
                                                opts: opts,
                                                props: props
                                            }
                                        };
                                    });
                                    candidates = candidates.concat(formatted);
                                    console.log(`   ✅ Найдено ${formatted.length} объектов в квартале ${quarter}`);
                                }
                            }
                        }
                    }
                }

                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены<br>
                            <span class="text-xs">Метод: ${searchMethod || 'все методы'}</span>
                            ${address ? `<br><span class="text-xs">Адрес: ${address}</span>` : ''}
                            ${value > 0 ? `<br><span class="text-xs">Параметр: ${param.label} = ${value} ${param.unit} ±${AREA_TOLERANCE}</span>` : ''}
                            <br><span class="text-xs text-slate-500 mt-2 block">💡 Попробуйте уточнить адрес или значение</span>
                        </div>
                    `;
                    return;
                }

                // Сортируем по близости значения параметра
                candidates.sort((a, b) => {
                    const valA = param.getValue(a.rawData.opts || {});
                    const valB = param.getValue(b.rawData.opts || {});
                    return Math.abs(valA - value) - Math.abs(valB - value);
                });

                const tableData = candidates.map(item => extractAllFields(item));
                const allKeys = Object.keys(tableData[0] || {});
                const columnsToShow = allKeys.filter(key => {
                    return tableData.some(row => row[key] && row[key] !== '—' && row[key] !== '');
                });

                const paramLabel = param.label + ' (' + param.unit + ')';
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
                    const isMatch = paramValue !== '—' && value > 0 && 
                                   Math.abs(parseFloat(paramValue) - value) <= AREA_TOLERANCE;
                    
                    const highlightStyle = isMatch ? 'background: #dbeafe; border-left: 3px solid #3b82f6;' : '';
                    
                    tableHtml += `
                        <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; ${highlightStyle}" 
                            onmouseover="this.style.background='#f0f9ff'" 
                            onmouseout="this.style.background='${isMatch ? '#dbeafe' : bgColor}'">
                            <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                            ${orderedColumns.map(col => {
                                let val = row[col] || '—';
                                if (col === 'Основание оценки' && val.length > 100) {
                                    val = val.substring(0, 100) + '...';
                                }
                                
                                if (col === firstColumn && val !== '—' && value > 0) {
                                    const numVal = parseFloat(val);
                                    if (Math.abs(numVal - value) <= AREA_TOLERANCE) {
                                        return `<td style="padding: 6px 10px; font-weight: 700; color: #2563eb; font-size: 10px;">${val}</td>`;
                                    }
                                }
                                return `
                                    <td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" 
                                        title="${val}">
                                        ${val}
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

displayMassResults(candidates, [], resultsContainer, param.label);
                  (async function() {
                    try {
                        const historyData = [];
                        
                        if (candidates.length > 0) {
                            // Добавляем найденные объекты
                            candidates.forEach(item => {
                                const fields = extractAllFields(item);
                                historyData.push({
                                    searchType: 'single',
                                    address: address,
                                    paramName: param.label,
                                    paramValue: value,
                                    cadNumber: fields['Кадастровый номер'] || 'Не определено',
                                    objectView: fields['Вид объекта'] || '—',
                                    found: 1
                                });
                            });
                        } else {
                            // Если ничего не найдено, добавляем запись с "Не определено"
                            historyData.push({
                                searchType: 'single',
                                address: address,
                                paramName: param.label,
                                paramValue: value,
                                cadNumber: 'Не определено',
                                objectView: '—',
                                found: 0
                            });
                        }
                        
                        // Сохраняем в Gist (асинхронно, не блокируя UI)
                               saveLocalHistory(historyData);
                        
                        // Если есть токен и Gist ID, пробуем сохранить в Gist
                        if (GIST_CONFIG.token && GIST_CONFIG.gistId) {
                            try {
                                await saveToGist(historyData);
                            } catch (e) {
                                console.debug('⚠️ Не удалось сохранить в Gist:', e.message);
                            }
                        }
                    } catch (e) {
                        // Тихо логируем ошибку, не мешая пользователю
                        console.debug('⚠️ Не удалось сохранить историю:', e.message);
                    }
                })();
            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Ошибка: ${error.message}</div>`;
            }
        }

        searchBtn.addEventListener('click', function() { performSearch(resultsContainer); });
        addressInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') performSearch(resultsContainer); });
        valueInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') performSearch(resultsContainer); });

               const downloadBtn = document.getElementById('nspd-download-template');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadTemplate);
        }

        const fileInput = document.getElementById('nspd-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                if (this.files && this.files.length > 0) {
                    uploadData(this.files[0]);
                    this.value = '';
                }
            });
        }

        // 🔥 Обработчик для кнопки экспорта
        const exportBtn = document.getElementById('nspd-export-results');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportResults);
        }

        // 🔥 КНОПКА СИНХРОНИЗАЦИИ
        const syncBtn = document.getElementById('nspd-sync-gist');
        if (syncBtn) {
            syncBtn.addEventListener('click', syncLocalToGist);
        }
        
        // Показываем кнопку синхронизации только если есть локальная история
              const localHistory = getLocalHistory();
        console.log('📊 Локальная история:', localHistory.length, 'записей');
        
        if (syncBtn) {
            if (localHistory.length > 0) {
                syncBtn.style.display = 'inline-flex';
                console.log('✅ Кнопка синхронизации ПОКАЗАНА (есть данные)');
            } else {
                console.log('ℹ️ Кнопка синхронизации СКРЫТА (нет данных)');
                console.log('💡 Сделайте поиск, чтобы добавить данные в историю');
            }
        } else {
            console.log('❌ Кнопка синхронизации не найдена в DOM');
        }

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
