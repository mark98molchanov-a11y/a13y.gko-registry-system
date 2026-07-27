// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

let nspdApp = null;

function initNSPDApp() {
    console.log('🏛️ Попытка инициализации НСПД...');
    
    // Проверяем, что карта уже создана
    if (typeof mapInstance === 'undefined' || !mapInstance) {
        console.log('⏳ Карта ещё не создана, ждём...');
        // Пробуем через 500мс
        setTimeout(initNSPDApp, 500);
        return;
    }
    
    // Проверяем, что класс NSPDIntegration доступен
    if (typeof NSPDIntegration === 'undefined') {
        console.error('❌ Класс NSPDIntegration не найден');
        return;
    }
    
    // Проверяем, что уже не инициализирован
    if (window.nspdApp && window.nspdApp.initialized) {
        console.log('✅ НСПД уже инициализирована');
        return;
    }
    
    try {
        window.nspdApp = new NSPDIntegration();
        window.nspdApp.init();
        console.log('✅ НСПД успешно инициализирована');
    } catch (error) {
        console.error('❌ Ошибка инициализации НСПД:', error);
        // Пробуем ещё раз через 1 секунду
        setTimeout(initNSPDApp, 1000);
    }
}

// ============================================================
// ЗАПУСК ИНИЦИАЛИЗАЦИИ
// ============================================================

// 1. Если документ уже загружен
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initNSPDApp, 100);
} else {
    // 2. Если документ ещё загружается
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initNSPDApp, 200);
    });
}

// 3. Дополнительная проверка через 2 секунды (на всякий случай)
setTimeout(function() {
    if (!window.nspdApp || !window.nspdApp.initialized) {
        console.log('🔄 Повторная попытка инициализации НСПД...');
        initNSPDApp();
    }
}, 2000);

console.log('🏛️ NSPD Integration загружена, ожидает инициализации');
