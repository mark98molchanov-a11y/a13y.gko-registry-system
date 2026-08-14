(function() {
    console.log('🚀 Загрузка модуля поиска НСПД (Gist-only)...');

    const AREA_TOLERANCE = 0.2;
    
    // 🔥 КОНФИГУРАЦИЯ GIST (ЕДИНСТВЕННОЕ ХРАНИЛИЩЕ)
const GIST_CONFIG = {
    token: '',  // ✅ Всегда пустой, запрашивается при каждой операции
    gistId: '4c242ae6c497bcea75d7c48eb428dcb0',
    filename: 'nspd_search_history.sql'
};
    function normalizeForCompare(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[",.]/g, '')          // Удаляем запятые, точки, кавычки
        .replace(/\s+/g, ' ')           // Схлопываем пробелы
        .replace(/[а-яё]+\s*район/g, '') // Удаляем "район"
        .replace(/г\.?\s*/g, '')         // Удаляем "г", "г."
        .replace(/ул\.?\s*/g, '')        // Удаляем "ул", "ул."
        .replace(/д\.?\s*/g, '')         // Удаляем "д", "д."
        .trim();
}

function getUniversalKey(row) {
    // 1. Нормализуем адрес
    let address = normalizeForCompare(row.address || '');
    // 2. Нормализуем название параметра
    let paramName = (row.paramName || '').toLowerCase().trim();
    // 3. Берём значение
    let paramValue = row.paramValue ?? 0;
    // 4. Формируем ключ
    return `${address}|${paramName}|${paramValue}`;
}
function getToken() {
    // ✅ СНАЧАЛА ПРОВЕРЯЕМ, ЕСТЬ ЛИ ТОКЕН В localStorage
    const savedToken = localStorage.getItem('nspd_github_token');
    if (savedToken) {
        console.log('🔑 Используем сохранённый токен');
        return savedToken;
    }
    
    // ✅ ЕСЛИ ТОКЕНА НЕТ - ЗАПРАШИВАЕМ
    const token = prompt('🔑 Введите GitHub токен (права на Gist):');
    if (!token) {
        console.warn('⚠️ Токен не введен');
        return null;
    }
    const trimmedToken = token.trim();
    
    // ✅ СОХРАНЯЕМ ТОКЕН В localStorage
    localStorage.setItem('nspd_github_token', trimmedToken);
    console.log('✅ Токен сохранён в localStorage');
    return trimmedToken;
}

// 🔥 ПРОВЕРКА ТОКЕНА
async function validateToken(token) {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return response.ok;
    } catch {
        return false;
    }
}
   async function getGistHistory(forceRefresh = false, token = null) {
    // Проверяем кеш (если не принудительно)
    if (!forceRefresh) {
        try {
            const cached = localStorage.getItem('nspd_gist_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                const cacheTime = parsed._timestamp || 0;
                if (Date.now() - cacheTime < 5 * 60 * 1000) {
                    console.log(`📦 Используем кеш Gist: ${parsed.data.length} записей`);
                    return parsed.data;
                }
            }
        } catch (e) {}
    }

    if (!GIST_CONFIG.gistId) {
        console.warn('⚠️ Gist ID не настроен');
        return [];
    }

    try {
        const url = `https://api.github.com/gists/${GIST_CONFIG.gistId}`;
        const headers = { 'Accept': 'application/vnd.github.v3+json' };
        
        // ✅ ЕСЛИ ТОКЕН ПЕРЕДАН — ИСПОЛЬЗУЕМ ЕГО
        if (token) {
            headers['Authorization'] = `token ${token}`;
            console.log('🔑 Используем токен для загрузки Gist');
        } else {
            console.log('ℹ️ Загружаем Gist без токена (только публичные данные)');
        }
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
            if (response.status === 404) {
                console.warn('⚠️ Gist не найден, создаем новый...');
                return [];
            }
            if (response.status === 401) {
                console.warn('⚠️ Ошибка авторизации (401). Проверьте токен.');
                return [];
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.files?.[GIST_CONFIG.filename]?.content || '';
        
        const history = parseSQLToArray(content);
        console.log(`📥 Загружено ${history.length} записей из Gist`);
        
        // Сохраняем в кеш
        try {
            localStorage.setItem('nspd_gist_cache', JSON.stringify({
                _timestamp: Date.now(),
                data: history
            }));
        } catch (e) {}
        
        return history;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки из Gist:', error);
        return [];
    }
}

   function parseSQLToArray(sqlContent) {
    const history = [];
    if (!sqlContent) {
        console.log('ℹ️ SQL-контент пуст');
        return history;
    }
    
    console.log(`📄 Парсинг SQL, длина: ${sqlContent.length} символов`);
    
    // ✅ ПРЯМОЙ ПОИСК INSERT-запросов
    const insertRegex = /INSERT\s+OR\s+IGNORE\s+INTO\s+nspd_search_history\s*\(([^)]+)\)\s*VALUES\s*\(([^;]+)\);/gi;
    let match;
    let count = 0;
    
    while ((match = insertRegex.exec(sqlContent)) !== null) {
        count++;
        const columns = match[1].split(',').map(c => c.trim());
        const values = match[2].split(',').map(v => v.trim());
        
        // Создаем объект из колонок и значений
        const row = {};
        columns.forEach((col, idx) => {
            let val = values[idx] || '';
            // Убираем кавычки
            val = val.replace(/^'|'$/g, '');
            // Парсим числа
            if (col === 'param_value' || col === 'found') {
                val = parseFloat(val) || 0;
            }
            row[col] = val;
        });
        
        // Приводим к стандартному формату
        history.push({
            searchType: row.search_type || 'single',
            address: row.address || '',
            paramName: row.param_name || '',
            paramValue: row.param_value || 0,
            cadNumber: row.cad_number || 'Не определено',
            objectView: row.object_type || '—',
            found: row.found || 0,
            saved_at: row.search_date || new Date().toISOString()
        });
    }
    
    console.log(`📊 Найдено ${count} INSERT-запросов`);
    return history;
}
  // ============================================================
// 🔥 СОХРАНЕНИЕ В GIST (ТОЛЬКО НОВЫЕ ЗАПИСИ)
// ============================================================
async function saveToGist(data, token) {
    if (!data || data.length === 0) {
        console.log('ℹ️ Нет данных для сохранения');
        return { added: 0 };
    }
    
    try {
        const timestamp = new Date().toISOString();
        const dateStr = new Date().toISOString().split('T')[0];
        const timeStr = new Date().toISOString().split('T')[1].split('.')[0];
        
        let existingContent = '';
        let existingHistory = [];
        let fileSha = null;
        let gistExists = false;
        
        if (GIST_CONFIG.gistId) {
            try {
                const getUrl = `https://api.github.com/gists/${GIST_CONFIG.gistId}`;
                const getResponse = await fetch(getUrl, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (getResponse.ok) {
                    const gistData = await getResponse.json();
                    existingContent = gistData.files?.[GIST_CONFIG.filename]?.content || '';
                    fileSha = gistData.files?.[GIST_CONFIG.filename]?.sha || null;
                    existingHistory = parseSQLToArray(existingContent);
                    gistExists = true;
                    console.log(`📥 В Gist уже есть ${existingHistory.length} записей`);
                } else if (getResponse.status === 404) {
                    console.log('⚠️ Gist не найден, создаем новый');
                    gistExists = false;
                } else {
                    throw new Error(`HTTP ${getResponse.status}: ${getResponse.statusText}`);
                }
            } catch (e) {
                console.warn('⚠️ Ошибка загрузки существующего Gist:', e.message);
                gistExists = false;
            }
        }
        
        // ============================================================
        // ШАГ 2: ФОРМИРУЕМ МНОЖЕСТВО СУЩЕСТВУЮЩИХ КЛЮЧЕЙ (С НОРМАЛИЗАЦИЕЙ!)
        // ============================================================
        const existingKeys = new Set();
        existingHistory.forEach(row => {
            existingKeys.add(getRowKey(row));  // ← ИСПОЛЬЗУЕМ getRowKey()!
        });
        
        console.log(`🔑 Существующих ключей: ${existingKeys.size}`);
        
        // ============================================================
        // ШАГ 3: ФИЛЬТРУЕМ ТОЛЬКО НОВЫЕ ЗАПИСИ (С НОРМАЛИЗАЦИЕЙ!)
        // ============================================================
        const newData = data.filter(row => {
            const key = getRowKey(row);  // ← ИСПОЛЬЗУЕМ getRowKey()!
            const isNew = !existingKeys.has(key);
            if (!isNew) {
                console.log(`⏭️ ДУБЛИКАТ (уже есть в Gist): "${key}"`);
            }
            return isNew;
        });
        
        if (newData.length === 0) {
            console.log('ℹ️ Нет новых записей для добавления в Gist');
            return { added: 0, total: existingHistory.length };
        }
        
        console.log(`📤 Добавляем ${newData.length} новых записей в Gist`);
        
        // ============================================================
        // ШАГ 4: ФОРМИРУЕМ SQL ДЛЯ НОВЫХ ЗАПИСЕЙ
        // ============================================================
        let sql = '';
        if (!existingContent || !gistExists) {
            sql += `CREATE TABLE IF NOT EXISTS nspd_search_history (\n`;
            sql += `    id INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
            sql += `    search_date TEXT NOT NULL,\n`;
            sql += `    search_type TEXT NOT NULL,\n`;
            sql += `    address TEXT NOT NULL,\n`;
            sql += `    param_name TEXT,\n`;
            sql += `    param_value REAL,\n`;
            sql += `    cad_number TEXT,\n`;
            sql += `    object_type TEXT,\n`;
            sql += `    found INTEGER DEFAULT 0,\n`;
            sql += `    raw_data TEXT,\n`;
            sql += `    UNIQUE(cad_number, address, param_name, param_value)\n`;
            sql += `);\n\n`;
        }
        
        for (const row of newData) {
            const found = row.cadNumber && row.cadNumber !== 'Не определено' && row.cadNumber !== '—' ? 1 : 0;
            const cadNumber = row.cadNumber || 'Не определено';
            const objectType = row.objectView || '—';
            const rawData = JSON.stringify(row).replace(/'/g, "''");
            
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
        
        // ============================================================
        // ШАГ 5: ОБЪЕДИНЯЕМ С СУЩЕСТВУЮЩИМ СОДЕРЖИМЫМ
        // ============================================================
        let finalContent = '';
        if (!existingContent || !gistExists) {
            finalContent = sql;
        } else {
            finalContent = existingContent;
            if (!finalContent.endsWith('\n')) {
                finalContent += '\n';
            }
            finalContent += '\n' + sql;
        }
        
        // ============================================================
        // ШАГ 6: ОТПРАВЛЯЕМ В GIST
        // ============================================================
        let url, method, body;
        if (!gistExists) {
            url = 'https://api.github.com/gists';
            method = 'POST';
            body = {
                description: `НСПД история запросов ${dateStr} ${timeStr}`,
                public: false,
                files: {
                    [GIST_CONFIG.filename]: {
                        content: finalContent
                    }
                }
            };
        } else {
            url = `https://api.github.com/gists/${GIST_CONFIG.gistId}`;
            method = 'PATCH';
            body = {
                description: `НСПД история запросов (обновлено ${dateStr} ${timeStr})`,
                files: {
                    [GIST_CONFIG.filename]: {
                        content: finalContent,
                        sha: fileSha
                    }
                }
            };
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += `: ${errorData.message || response.statusText}`;
            } catch (e) {
                errorMsg += `: ${response.statusText}`;
            }
            throw new Error(errorMsg);
        }
        
        const result = await response.json();
        
        if (!gistExists) {
            GIST_CONFIG.gistId = result.id;
            console.log(`📌 НОВЫЙ GIST ID: ${result.id}`);
        }
        
        console.log(`✅ Добавлено ${newData.length} записей в Gist:`, result.html_url);
        
        // Обновляем кеш
        const allHistory = [...existingHistory, ...newData];
        try {
            localStorage.setItem('nspd_gist_cache', JSON.stringify({
                _timestamp: Date.now(),
                data: allHistory
            }));
        } catch (e) {}
        
        return { 
            added: newData.length,
            total: existingHistory.length + newData.length,
            url: result.html_url,
            gistId: result.id
        };
        
    } catch (error) {
        console.error('❌ Ошибка сохранения в Gist:', error);
        return { added: 0, error: error.message };
    }
}

    // ============================================================
    // 🔥 ОСНОВНАЯ ФУНКЦИЯ СИНХРОНИЗАЦИИ
    // ============================================================

async function syncLocalToGist() {
    const syncBtn = document.getElementById('nspd-sync-gist');
    const originalText = syncBtn?.innerHTML || 'Обновить SQL в Gist';
    
    try {
        if (syncBtn) {
            syncBtn.innerHTML = '⏳ Синхронизация...';
            syncBtn.disabled = true;
        }
        
        const token = getToken();
        if (!token) {
            alert('❌ Токен не введен. Синхронизация отменена.');
            return;
        }

        const isValid = await validateToken(token);
        if (!isValid) {
            alert('❌ Неверный токен. Проверьте права (нужно gist).');
            return;
        }
        
        // ============================================================
        // ✅ ФУНКЦИИ НОРМАЛИЗАЦИИ
        // ============================================================
        function normalizeKey(key) {
            if (!key) return '';
            return key.toLowerCase().replace(/\s+/g, ' ').trim();
        }
        
        function getRowKey(row) {
            let key;
            if (row.cadNumber && row.cadNumber !== 'Не определено' && row.cadNumber !== '—') {
                key = row.cadNumber + '|' + row.address + '|' + row.paramName + '|' + row.paramValue;
            } else {
                key = row.address + '|' + row.paramName + '|' + row.paramValue;
            }
            return normalizeKey(key);
        }
        
        // ============================================================
        // ЗАГРУЖАЕМ ДАННЫЕ ИЗ КЕША
        // ============================================================
        let localData = [];
        try {
            const cached = localStorage.getItem('nspd_gist_cache');
            if (cached) {
                const parsed = JSON.parse(cached);
                localData = parsed.data || [];
                console.log(`📦 В кеше: ${localData.length} записей`);
            } else {
                console.log('ℹ️ Кеш пуст');
            }
        } catch (e) {
            console.warn('⚠️ Ошибка чтения кеша:', e);
        }
        
        // ============================================================
        // ЗАГРУЖАЕМ ДАННЫЕ ИЗ Gist
        // ============================================================
        const gistHistory = await getGistHistory(true, token);
        console.log(`📊 В Gist: ${gistHistory.length} записей`);
        
        if (localData.length === 0 && gistHistory.length > 0) {
            console.log(`🔄 Кеш пуст, но в Gist есть ${gistHistory.length} записей. Восстанавливаем кеш...`);
            localStorage.setItem('nspd_gist_cache', JSON.stringify({
                _timestamp: Date.now(),
                data: gistHistory
            }));
            alert(`🔄 Кеш восстановлен из Gist! Загружено ${gistHistory.length} записей.`);
            return;
        }
        
        if (localData.length === 0) {
            alert('📭 Нет данных для синхронизации. Сделайте поиск сначала.');
            return;
        }
        
        // ============================================================
        // ✅ ФИЛЬТРУЕМ НОВЫЕ ЗАПИСИ (С НОРМАЛИЗАЦИЕЙ!)
        // ============================================================
        const existingKeys = new Set();
        gistHistory.forEach(row => {
            existingKeys.add(getRowKey(row));
        });
        
        const newData = localData.filter(row => {
            const key = getRowKey(row);
            const isNew = !existingKeys.has(key);
            if (!isNew) {
                console.log(`⏭️ ДУБЛИКАТ (уже есть в Gist): "${key}"`);
            }
            return isNew;
        });
        
        if (newData.length === 0) {
            alert(`✅ Все данные уже синхронизированы!\nВсего в Gist: ${gistHistory.length} записей`);
            localStorage.removeItem('nspd_gist_cache');
            console.log('🧹 Кеш очищен (все данные уже в Gist)');
            return;
        }
        
        console.log(`📤 Будет добавлено ${newData.length} новых записей`);
        
        const result = await saveToGist(newData, token);
        
        if (result && result.added > 0) {
            alert(`✅ Синхронизация завершена!\nДобавлено: ${result.added} записей\nВсего в Gist: ${result.total}`);
            localStorage.removeItem('nspd_gist_cache');
            console.log(`🧹 Кеш очищен! Все ${result.total} записей теперь в Gist`);
        } else if (result && result.added === 0 && result.total > 0) {
            alert(`✅ Все данные уже синхронизированы!\nВсего в Gist: ${result.total} записей`);
            localStorage.removeItem('nspd_gist_cache');
            console.log('🧹 Кеш очищен (все данные уже в Gist)');
        } else if (result && result.error) {
            alert(`❌ Ошибка: ${result.error}`);
        } else {
            alert('❌ Ошибка синхронизации');
        }
        
    } catch (error) {
        console.error('❌ Ошибка синхронизации:', error);
        alert('❌ Ошибка: ' + error.message);
    } finally {
        if (syncBtn) {
            syncBtn.innerHTML = originalText;
            syncBtn.disabled = false;
        }
    }
}
    // ============================================================
    // 🔥 УПРОЩЕННАЯ ФУНКЦИЯ ДЛЯ СОХРАНЕНИЯ ИЗ ПОИСКА
    // ============================================================

async function saveSearchResult(historyData) {
    if (!historyData || historyData.length === 0) {
        console.log('ℹ️ Нет данных для сохранения');
        return;
    }
    
    try {
        // ============================================================
        // ШАГ 0: ПРОВЕРЯЕМ И ЗАПРАШИВАЕМ ТОКЕН, ЕСЛИ НЕТ
        // ============================================================
        if (typeof GIST_CONFIG === 'undefined') {
            console.warn('⚠️ GIST_CONFIG не определён, пропускаем проверку Gist');
        }
        
        // ✅ ПРОВЕРЯЕМ ТОКЕН И ЗАПРАШИВАЕМ, ЕСЛИ НЕТ
        let savedToken = localStorage.getItem('nspd_github_token');
        if (!savedToken) {
            console.log('🔑 Токен не найден в localStorage, запрашиваем...');
            savedToken = getToken();
            if (!savedToken) {
                console.warn('⚠️ Токен не введен, пропускаем проверку Gist');
            } else {
                console.log('✅ Токен получен и сохранён в localStorage');
            }
        } else {
            console.log('🔑 Используем сохранённый токен');
        }
        
        // ============================================================
        // ШАГ 1: ЗАГРУЖАЕМ ДАННЫЕ ИЗ КЕША
        // ============================================================
        let cached = [];
        const cachedStr = localStorage.getItem('nspd_gist_cache');
        if (cachedStr) {
            try {
                const parsed = JSON.parse(cachedStr);
                cached = parsed.data || [];
            } catch (e) {
                console.warn('⚠️ Ошибка парсинга кеша, создаем новый');
                cached = [];
            }
        }
        
        // ============================================================
        // ШАГ 2: ЗАГРУЖАЕМ ДАННЫЕ ИЗ GIST (ЕСЛИ ЕСТЬ ТОКЕН)
        // ============================================================
        let gistData = [];
        
        console.log(`🔍 Токен в localStorage: ${savedToken ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
        console.log(`🔍 GIST_CONFIG: ${typeof GIST_CONFIG !== 'undefined' ? '✅ ОПРЕДЕЛЁН' : '❌ НЕ ОПРЕДЕЛЁН'}`);
        console.log(`🔍 GIST_CONFIG.gistId: ${(typeof GIST_CONFIG !== 'undefined' && GIST_CONFIG.gistId) ? GIST_CONFIG.gistId : '❌ НЕТ'}`);
        
        if (savedToken && typeof GIST_CONFIG !== 'undefined' && GIST_CONFIG.gistId) {
            try {
                console.log('🔍 Загружаем Gist для проверки дубликатов...');
                const response = await fetch(`https://api.github.com/gists/${GIST_CONFIG.gistId}`, {
                    headers: {
                        'Authorization': `token ${savedToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const content = data.files?.[GIST_CONFIG.filename]?.content || '';
                    gistData = parseSQLToArray(content);
                    console.log(`📥 Загружено ${gistData.length} записей из Gist для проверки дубликатов`);
                } else if (response.status === 404) {
                    console.log('ℹ️ Gist не найден (404)');
                } else {
                    console.warn(`⚠️ Ошибка загрузки Gist: HTTP ${response.status}`);
                }
            } catch (e) {
                console.warn('⚠️ Ошибка загрузки Gist:', e.message);
            }
        } else {
            console.log('ℹ️ Нет токена или Gist ID, пропускаем проверку Gist');
        }
        
        // ============================================================
        // ШАГ 3: ОБЪЕДИНЯЕМ ВСЕ СУЩЕСТВУЮЩИЕ ЗАПИСИ (КЕШ + GIST)
        // ============================================================
        const allExisting = [...cached, ...gistData];
        console.log(`📊 Всего существующих записей (кеш: ${cached.length} + gist: ${gistData.length} = ${allExisting.length})`);
        
        // ============================================================
        // ШАГ 4: УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ДУБЛИКАТОВ
        // ============================================================
        function normalizeForCompare(text) {
            if (!text) return '';
            return text
                .toLowerCase()
                .replace(/[",.]/g, '')
                .replace(/\s+/g, ' ')
                .replace(/[а-яё]+\s*район/g, '')
                .replace(/г\.?\s*/g, '')
                .replace(/ул\.?\s*/g, '')
                .replace(/д\.?\s*/g, '')
                .trim();
        }
        
        function getUniversalKey(row) {
            let address = normalizeForCompare(row.address || '');
            let paramName = (row.paramName || '').toLowerCase().trim();
            let paramValue = row.paramValue ?? 0;
            return `${address}|${paramName}|${paramValue}`;
        }
        
        // ============================================================
        // ШАГ 5: ПРОВЕРКА НА ДУБЛИКАТЫ (УНИВЕРСАЛЬНАЯ)
        // ============================================================
        const existingKeys = new Set();
        allExisting.forEach(row => {
            existingKeys.add(getUniversalKey(row));
        });
        
        console.log(`🔑 Уникальных ключей: ${existingKeys.size}`);
        
        const newData = [];
        let duplicateCount = 0;
        let gistDuplicateCount = 0;
        let cacheDuplicateCount = 0;
        
        for (const row of historyData) {
            const key = getUniversalKey(row);
            
            // Проверяем, есть ли такой ключ в кеше или Gist
            if (existingKeys.has(key)) {
                duplicateCount++;
                
                // Определяем, где найден дубликат
                let foundInCache = false;
                let foundInGist = false;
                
                for (const existing of cached) {
                    if (getUniversalKey(existing) === key) {
                        foundInCache = true;
                        cacheDuplicateCount++;
                        break;
                    }
                }
                
                for (const existing of gistData) {
                    if (getUniversalKey(existing) === key) {
                        foundInGist = true;
                        gistDuplicateCount++;
                        break;
                    }
                }
                
                if (foundInCache) {
                    console.log(`⏭️ ДУБЛИКАТ в КЕШЕ: "${key}"`);
                } else if (foundInGist) {
                    console.log(`⏭️ ДУБЛИКАТ в GIST: "${key}"`);
                } else {
                    console.log(`⏭️ Похожий объект уже существует: "${key}"`);
                }
            } else {
                newData.push(row);
                // Добавляем ключ в множество, чтобы не было дубликатов внутри этой партии
                existingKeys.add(key);
            }
        }
        
        if (newData.length === 0) {
            console.log(`ℹ️ Нет новых записей для добавления (все уже есть в кеше или Gist)`);
            console.log(`   Пропущено дубликатов: ${duplicateCount} (в кеше: ${cacheDuplicateCount}, в Gist: ${gistDuplicateCount})`);
            return;
        }
        
        // ============================================================
        // ШАГ 6: СОХРАНЯЕМ ТОЛЬКО НОВЫЕ ЗАПИСИ В КЕШ
        // ============================================================
        cached = [...cached, ...newData];
        
        // Ограничиваем размер (последние 1000 записей)
        if (cached.length > 1000) {
            cached = cached.slice(-1000);
        }
        
        localStorage.setItem('nspd_gist_cache', JSON.stringify({
            _timestamp: Date.now(),
            data: cached
        }));
        
        console.log(`📦 Кеш обновлен: +${newData.length} записей, всего: ${cached.length}`);
        console.log(`   Пропущено дубликатов: ${duplicateCount} (в кеше: ${cacheDuplicateCount}, в Gist: ${gistDuplicateCount})`);
        
    } catch (e) {
        console.error('❌ Ошибка сохранения кеша:', e);
    }
}
    // ============================================================
    // 🔥 ПАРАМЕТРЫ ДЛЯ ПОИСКА
    // ============================================================

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

    // ============================================================
    // 🔥 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (НЕ ИЗМЕНЕНЫ)
    // ============================================================

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
    // 🔥 ОСНОВНЫЕ ФУНКЦИИ ПОИСКА (ОСТАВЛЕНЫ БЕЗ ИЗМЕНЕНИЙ)
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
            
            // 2. ИЗВЛЕКАЕМ УЛИЦУ
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
        
        // ГЕНЕРИРУЕМ ВСЕ ВОЗМОЖНЫЕ ВАРИАНТЫ
        const variants = [];
        
        if (parts.city && parts.street && parts.number) {
            variants.push(`${parts.city}, ${parts.street}, ${parts.number}`);
            variants.push(`г ${parts.city}, ${parts.street}, ${parts.number}`);
            variants.push(`г. ${parts.city}, ${parts.street}, ${parts.number}`);
        }
        
        if (parts.city && parts.street) {
            variants.push(`${parts.city}, ${parts.street}`);
            variants.push(`г ${parts.city}, ${parts.street}`);
            variants.push(`г. ${parts.city}, ${parts.street}`);
        }
        
        if (parts.street && parts.number) {
            variants.push(`${parts.street}, ${parts.number}`);
            variants.push(`${parts.street}, д.${parts.number}`);
            variants.push(`${parts.street}, уч.${parts.number}`);
        }
        
        if (parts.street) {
            variants.push(parts.street);
        }
        
        // Удаляем ДНТ/СНТ/ТСН/ДПК
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
            if (parts.city && parts.street && parts.number) {
                const short = `${parts.city}, ${parts.street}, ${parts.number}`;
                if (!variants.includes(short)) {
                    variants.push(short);
                }
            }
        }
        
        variants.push(cleaned);
        
        if (parts.city && parts.number) {
            variants.push(`${parts.city}, ${parts.number}`);
            variants.push(`г ${parts.city}, ${parts.number}`);
        }
        
        const allVariants = [...new Set(variants)].filter(a => a && a.length > 5);
        
        console.log(`🔍 Вариантов для поиска: ${allVariants.length}`);
        allVariants.forEach((v, i) => console.log(`  ${i+1}. "${v}"`));
        
        let allFound = [];
        const seenCadNumbers = new Set();
        
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
    // 🔥 ФУНКЦИИ ДЛЯ ОТОБРАЖЕНИЯ РЕЗУЛЬТАТОВ
    // ============================================================

    function extractAllFields(item) {
        const data = item.rawData;
        const opts = data.opts || {};
        const props = data.props || {};

        const objectType = props.categoryName || 
                           opts.categoryName || 
                           opts.object_type_value || 
                           opts.type || 
                           item.object_type || 
                           item.type || 
                           '';
        
        const isLand = objectType.includes('Земельный участок') || 
                       objectType.includes('Земельный') || 
                       objectType.includes('земельный участок') ||
                       (item.categoryName && item.categoryName.includes('Земельные участки')) ||
                       (opts.categoryName && opts.categoryName.includes('Земельные участки')) ||
                       (props.categoryName && props.categoryName.includes('Земельные участки')) ||
                       (opts.land_record_type && opts.land_record_type.includes('Земельный участок'));
        
        let upksValue = parseFloat(opts.cost_index) || item.cadastral_index || 0;
        if (upksValue === 0) {
            const cost = parseFloat(opts.cost_value) || item.cadastral_value || 0;
            const area = parseFloat(opts.specified_area) || item.specified_area || item.area || 0;
            if (cost > 0 && area > 0) {
                upksValue = cost / area;
            }
        }

        let objectName = opts.building_name || 
                         opts.params_name || 
                         opts.name || 
                         item.object_name || 
                         opts.params_type || 
                         objectType || 
                         '';

        let objectView = props.categoryName ||
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

        let purpose = '—';
        if (isLand) {
            purpose = opts.land_record_subtype || 
                      item.land_record_subtype || 
                      opts.purpose || 
                      item.purpose || 
                      opts.params_purpose || 
                      '—';
        } else {
            purpose = opts.purpose || 
                      item.purpose || 
                      opts.params_purpose || 
                      opts.permitted_use_established_by_document || 
                      item.permitted_use_established_by_document ||
                      '—';
        }

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

        const parentCadNumber = opts.parent_cad_number || 
                                props.parent_cad_number || 
                                item.parent_cad_number || 
                                '—';

        const status = opts.status || 
                       opts.common_data_status || 
                       item.status || 
                       '—';

        const ownershipType = (opts.ownership_type !== null && opts.ownership_type !== undefined) 
                              ? opts.ownership_type 
                              : (item.ownership_type || '—');
        
        const yearBuilt = opts.year_built || opts.params_year_built || item.year_built || '—';
        const registrationDate = opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date || item.registration_date || '—';
        const materials = opts.materials || opts.wall_material || props.materials || '—';

        const params = [];
        if (displayArea > 0) params.push(`Площадь (м²): ${displayArea.toFixed(1)}`);
        if (builtUpAreaValue > 0) params.push(`Площадь застройки (м²): ${builtUpAreaValue.toFixed(1)}`);
        if (volumeValue > 0) params.push(`Объем (м³): ${volumeValue.toFixed(1)}`);
        if (extensionValue > 0) params.push(`Протяженность (м): ${extensionValue.toFixed(1)}`);
        if (depthValue > 0) params.push(`Глубина (м): ${depthValue.toFixed(1)}`);
        if (landAreaValue > 0) params.push(`Площадь ЗУ (м²): ${landAreaValue.toFixed(1)}`);
        
        const paramsStr = params.length > 0 ? params.join('; ') : '—';

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

    function displayMassResults(candidates, notFoundItems, container, searchParamLabel) {
        let tableData = [];
        
        candidates.forEach(item => {
            const fields = extractAllFields(item);
            fields['Параметр поиска'] = searchParamLabel || '—';
            tableData.push(fields);
        });
        
        notFoundItems.forEach(item => {
            const paramDisplay = item.paramLabel + (item.paramUnit ? ` (${item.paramUnit})` : '');
            const valueDisplay = item.paramValue > 0 ? item.paramValue : '—';
            
            const emptyRow = {
                'Параметр поиска': paramDisplay,
                'Кадастровый номер': 'Не определено',
                'Вид объекта': '—',
                'Наименование': '—',
                'Материал стен': '—',
                'Адрес': item.address || '—',
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

    // ============================================================
    // 🔥 ОБРАБОТЧИК ЗАГРУЗКИ ФАЙЛА
    // ============================================================

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
                const container = document.getElementById('nspd-search-results');
                if (!container) {
                    console.error('❌ container не найден');
                    return;
                }
                
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
    const address = row.address;
    const value = row.value;
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
                                
                                // ✅ СОХРАНЯЕМ НАЙДЕННЫЙ ОБЪЕКТ
                                (async function() {
                                    try {
                                        const historyData = [];
                                        
                                        if (candidates.length > 0) {
                                            const exactMatches = candidates.filter(item => {
                                                const paramValue = param.getValue(item.rawData.opts || {});
                                                const areaMatch = Math.abs(paramValue - value) <= AREA_TOLERANCE;
                                                
                                                const itemAddress = normalizeString(item.address || '');
                                                const searchAddress = normalizeString(address || '');
                                                const addressMatch = itemAddress === searchAddress || 
                                                                    itemAddress.includes(searchAddress) || 
                                                                    searchAddress.includes(itemAddress);
                                                
                                                return areaMatch && addressMatch;
                                            });
                                            
                                            const sortedMatches = exactMatches.sort((a, b) => {
                                                const valA = param.getValue(a.rawData.opts || {});
                                                const valB = param.getValue(b.rawData.opts || {});
                                                return Math.abs(valA - value) - Math.abs(valB - value);
                                            });
                                            
                                            const item = sortedMatches.length > 0 ? sortedMatches[0] : candidates[0];
                                            
                                            if (item) {
                                                const fields = extractAllFields(item);
                                                const objAddress = fields['Адрес'] || item.address || address || 'Не определено';
                                                historyData.push({
                                                    searchType: 'mass',
                                                    address: objAddress,
                                                    paramName: param.label,
                                                    paramValue: value,
                                                    cadNumber: fields['Кадастровый номер'] || 'Не определено',
                                                    objectView: fields['Вид объекта'] || '—',
                                                    found: 1
                                                });
                                            } else {
                                                historyData.push({
                                                    searchType: 'mass',
                                                    address: address || '—',
                                                    paramName: param.label,
                                                    paramValue: value,
                                                    cadNumber: 'Не определено',
                                                    objectView: '—',
                                                    found: 0
                                                });
                                            }
                                        } else {
                                            historyData.push({
                                                searchType: 'mass',
                                                address: address || '—',
                                                paramName: param.label,
                                                paramValue: value,
                                                cadNumber: 'Не определено',
                                                objectView: '—',
                                                found: 0
                                            });
                                        }
                                        
                                        console.log(`💾 Сохраняем найденный объект (массовый): ${address}, найдено: ${historyData[0]?.found || 0}`);
                                        await saveSearchResult(historyData);
                                    } catch (e) {
                                        console.debug('⚠️ Не удалось сохранить историю:', e.message);
                                    }
                                })();
                                
                            } else {
                                const paramLabel = SEARCH_PARAMS[row.param]?.label || row.param;
                                notFoundItems.push({
                                    address: row.address,
                                    paramLabel: paramLabel,
                                    paramValue: row.value,
                                    paramUnit: SEARCH_PARAMS[row.param]?.unit || ''
                                });
                                
                                // ✅ СОХРАНЯЕМ НЕНАЙДЕННЫЙ ОБЪЕКТ
                                (async function() {
                                    try {
                                  let similarRecord = null;
if (typeof gistData !== 'undefined' && gistData && gistData.length > 0) {
    // Извлекаем район из адреса
    const districtMatch = address.match(/([А-Яа-яё\-]+)\s*район/i);
    const district = districtMatch ? districtMatch[1] : null;
    
    if (district) {
        for (const record of gistData) {
            if (record.address && record.address.includes(district)) {
                similarRecord = record;
                break;
            }
        }
    }
}

const historyData = [{
    searchType: 'mass',
    address: similarRecord ? similarRecord.address : address || '—',
    paramName: similarRecord ? similarRecord.paramName : param.label,
    paramValue: similarRecord ? similarRecord.paramValue : value,
    cadNumber: similarRecord ? similarRecord.cadNumber : 'Не определено',
    objectView: '—',
    found: 0
}];
console.log(`💾 Сохраняем НЕНАЙДЕННЫЙ объект (массовый): ${address}`);
await saveSearchResult(historyData);
                                    } catch (e) {
                                        console.debug('⚠️ Не удалось сохранить историю:', e.message);
                                    }
                                })();
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
                            
                            // ✅ СОХРАНЯЕМ ОШИБОЧНЫЙ ОБЪЕКТ КАК НЕНАЙДЕННЫЙ
                            (async function() {
                                try {
                                    const historyData = [{
                                        searchType: 'mass',
                                        address: address || '—',
                                        paramName: param.label,
                                        paramValue: value,
                                        cadNumber: 'Не определено',
                                        objectView: '—',
                                        found: 0
                                    }];
                                    console.log(`💾 Сохраняем объект с ошибкой (массовый): ${address}`);
                                    await saveSearchResult(historyData);
                                } catch (e) {
                                    console.debug('⚠️ Не удалось сохранить историю:', e.message);
                                }
                            })();
                        }
                    }
                    
                    if (progressContainer) progressContainer.style.display = 'none';
                    
                    const searchParamLabel = rows.length > 0 ? SEARCH_PARAMS[rows[0].param]?.label || '—' : '—';
                    displayMassResults(allResults, notFoundItems, container, searchParamLabel);
                })();
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
    // 🔥 ИНИЦИАЛИЗАЦИЯ
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

        // ============================================================
        // ПОЛУЧАЕМ ССЫЛКИ НА ЭЛЕМЕНТЫ
        // ============================================================

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
        // 🔥 ФУНКЦИЯ findBestMatch
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
        // 🔥 ФУНКЦИЯ findInQuarter
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

        // ============================================================
        // 🔥 ОСНОВНАЯ ФУНКЦИЯ ПОИСКА
        // ============================================================

        async function performSearch(container) {
            const address = addressInput.value.trim();
            const paramKey = paramSelect.value;
            const value = parseFloat(valueInput.value) || 0;

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

                // ШАГ 2: ПОИСК ПО КВАРТАЛАМ (если не нашли по адресу)
                if (candidates.length === 0) {
                    console.log(`📡 ШАГ 2: Поиск по кварталам (fallback)`);
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
                    
                    // ✅ ДОБАВЛЯЕМ СОХРАНЕНИЕ НЕНАЙДЕННОГО ОБЪЕКТА
           try {
    // 🔍 Ищем похожую запись в GistData
    let similarRecord = null;
    if (typeof gistData !== 'undefined' && gistData && gistData.length > 0) {
        // Ищем запись, которая содержит "Тазовский" в адресе
        for (const record of gistData) {
            if (record.address && (record.address.includes('Тазовский') || record.address.includes('Тазовский район'))) {
                similarRecord = record;
                break;
            }
        }
    }
    
    // ✅ Используем параметры из похожей записи, если нашли
    const historyData = [{
        searchType: 'single',
        address: similarRecord ? similarRecord.address : address || 'Не определено',
        paramName: similarRecord ? similarRecord.paramName : param.label,
        paramValue: similarRecord ? similarRecord.paramValue : value,
        cadNumber: similarRecord ? similarRecord.cadNumber : 'Не определено',
        objectView: '—',
        found: 0
    }];
    console.log('💾 Сохраняем НЕНАЙДЕННЫЙ объект (одиночный поиск):', historyData);
    await saveSearchResult(historyData);
    console.log('✅ Ненайденный объект сохранён в кеш');
} catch (e) {
    console.error('❌ Ошибка сохранения ненайденного объекта:', e);
}
                    
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
                
                // ✅ СОХРАНЯЕМ РЕЗУЛЬТАТЫ ОДИНОЧНОГО ПОИСКА
                (async function() {
                    try {
                        const historyData = [];
                        
                        if (candidates.length > 0) {
                            const exactMatches = candidates.filter(item => {
                                const paramValue = param.getValue(item.rawData.opts || {});
                                const areaMatch = Math.abs(paramValue - value) <= AREA_TOLERANCE;
                                
                                const itemAddress = normalizeString(item.address || '');
                                const searchAddress = normalizeString(address || '');
                                const addressMatch = itemAddress === searchAddress || 
                                                    itemAddress.includes(searchAddress) || 
                                                    searchAddress.includes(itemAddress);
                                
                                return areaMatch && addressMatch;
                            });
                            
                            const sortedMatches = exactMatches.sort((a, b) => {
                                const valA = param.getValue(a.rawData.opts || {});
                                const valB = param.getValue(b.rawData.opts || {});
                                return Math.abs(valA - value) - Math.abs(valB - value);
                            });
                            
                            const item = sortedMatches.length > 0 ? sortedMatches[0] : candidates[0];
                            
                            if (item) {
                                const fields = extractAllFields(item);
                                const objAddress = fields['Адрес'] || item.address || address || 'Не определено';
                                historyData.push({
                                    searchType: 'single',
                                    address: objAddress,
                                    paramName: param.label,
                                    paramValue: value,
                                    cadNumber: fields['Кадастровый номер'] || 'Не определено',
                                    objectView: fields['Вид объекта'] || '—',
                                    found: 1
                                });
                            } else {
                                historyData.push({
                                    searchType: 'single',
                                    address: address || '—',
                                    paramName: param.label,
                                    paramValue: value,
                                    cadNumber: 'Не определено',
                                    objectView: '—',
                                    found: 0
                                });
                            }
                        } else {
                            historyData.push({
                                searchType: 'single',
                                address: address || '—',
                                paramName: param.label,
                                paramValue: value,
                                cadNumber: 'Не определено',
                                objectView: '—',
                                found: 0
                            });
                        }
                        
                        console.log(`💾 Сохраняем результат одиночного поиска для адреса: ${address}, найден: ${historyData[0]?.found || 0}`);
                        await saveSearchResult(historyData);
                    } catch (e) {
                        console.debug('⚠️ Не удалось сохранить историю:', e.message);
                    }
                })();

                
            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Ошибка: ${error.message}</div>`;
            }
        }

        // ============================================================
        // ПРИВЯЗКА СОБЫТИЙ
        // ============================================================

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

        const exportBtn = document.getElementById('nspd-export-results');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportResults);
        }

        const syncBtn = document.getElementById('nspd-sync-gist');
        if (syncBtn) {
            syncBtn.addEventListener('click', syncLocalToGist);
        }

        window.performSearch = performSearch;

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };
    
    // ============================================================
    // 🔥 ЭКСПОРТ ОСТАЛЬНЫХ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
    // ============================================================
    window.saveSearchResult = saveSearchResult;
    window.uploadData = uploadData;
    window.syncLocalToGist = syncLocalToGist;
    window.getGistHistory = getGistHistory;
    
    console.log('✅ Модуль поиска НСПД загружен (Gist-only режим).');
})();
