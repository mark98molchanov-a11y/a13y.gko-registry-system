// ============================================================
// КОНФИГУРАЦИЯ НСПД
// ============================================================

const NSPD_CONFIG = {
    // Базовый URL API НСПД
    BASE_URL: 'https://nspd.gov.ru/api/geoportal/v2/search/geoportal',
    
    // Таймаут запроса (мс)
    TIMEOUT: 15000,
    
    // Кэширование результатов (время жизни в минутах)
    CACHE_TTL: 60,
    
    // Параметры отображения на карте
    MAP_STYLE: {
        color: '#dc2626',
        weight: 3,
        opacity: 0.8,
        fillColor: '#dc2626',
        fillOpacity: 0.15,
        dashArray: '6 4'
    },
    
    // Статусы объектов
    STATUS: {
        FOUND: '✅ Найден',
        NOT_FOUND: '❌ Не найден',
        ERROR: '⚠️ Ошибка',
        LOADING: '⏳ Поиск...'
    }
};

// Экспортируем для использования в других файлах
window.NSPD_CONFIG = NSPD_CONFIG;
