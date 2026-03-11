// dio-tree-fix.js - Исправление для инициализации дерева ДИО

// Сохраняем оригинальный метод importData
const originalImportData = TreeManager.prototype.importData;

// Переопределяем метод importData с защитой от ошибок
TreeManager.prototype.importData = function(data) {
    console.log('⚡ importData (исправленная версия):', data);
    
    // Проверяем, что DOM готов и контейнер существует
    if (!this.container || !this.container.current) {
        console.warn('⚠️ Контейнер ещё не готов, сохраняем данные для последующей загрузки');
        this._pendingData = data;
        
        // Запускаем проверку готовности
        this._waitForContainer();
        return;
    }
    
    try {
        // Вызываем оригинальный метод
        originalImportData.call(this, data);
        console.log('✅ Данные успешно импортированы');
        
        // Очищаем сохранённые данные
        this._pendingData = null;
    } catch (e) {
        console.error('❌ Ошибка при импорте:', e);
        
        // Если ошибка связана с updateTree, пробуем обновить вручную позже
        if (e.message && e.message.includes('scrollLeft')) {
            console.log('⚠️ Ошибка скролла, пробуем восстановить...');
            setTimeout(() => {
                if (this.updateTree) {
                    try {
                        this.updateTree();
                        console.log('✅ Дерево обновлено после задержки');
                    } catch (updateError) {
                        console.error('❌ Ошибка при повторном обновлении:', updateError);
                    }
                }
            }, 500);
        }
    }
};

// Добавляем метод ожидания контейнера
TreeManager.prototype._waitForContainer = function() {
    if (this._waiting) return;
    this._waiting = true;
    
    console.log('⏳ Ожидание готовности контейнера...');
    
    const checkInterval = setInterval(() => {
        if (this.container && this.container.current) {
            clearInterval(checkInterval);
            console.log('✅ Контейнер готов, загружаем сохранённые данные');
            
            if (this._pendingData) {
                this.importData(this._pendingData);
            }
            
            this._waiting = false;
        }
    }, 100);
    
    // Останавливаем проверку через 5 секунд, чтобы избежать бесконечного цикла
    setTimeout(() => {
        clearInterval(checkInterval);
        if (this._pendingData) {
            console.error('❌ Таймаут ожидания контейнера');
            this._waiting = false;
        }
    }, 5000);
};

// Добавляем метод для проверки готовности
TreeManager.prototype.isReady = function() {
    return this.container && this.container.current && this.container.current.children.length > 0;
};

// Функция для безопасной инициализации дерева
window.safeInitDIOTree = function(containerId) {
    console.log('🔧 Безопасная инициализация дерева ДИО');
    
    const containerElement = document.getElementById(containerId);
    if (!containerElement) {
        console.error('❌ Контейнер не найден:', containerId);
        return null;
    }
    
    try {
        const tree = new TreeManager(containerId);
        
        // Проверяем, есть ли сохранённые данные
        if (tree._pendingData) {
            console.log('📦 Найдены ожидающие данные, загружаем...');
            // Данные загрузятся автоматически через _waitForContainer
        } else {
            // Создаём корневой узел напрямую
            setTimeout(() => {
                if (tree.container && tree.container.current) {
                    console.log('🌳 Контейнер готов, создаём дерево');
                    
                    // Пробуем добавить узел напрямую
                    if (tree.addNode) {
                        const rootId = tree.addNode('root', 'База ДИО', 400, 50);
                        console.log('✅ Корневой узел создан через addNode, ID:', rootId);
                    } else {
                        // Или через importData
                        console.log('🌳 Создаём через importData');
                        tree.importData({
                            nodes: [{
                                id: 'root',
                                label: 'База ДИО',
                                type: 'root',
                                x: 400,
                                y: 50
                            }],
                            edges: []
                        });
                    }
                } else {
                    console.log('🌳 Контейнер ещё не готов, сохраняем данные');
                    tree._pendingData = {
                        nodes: [{
                            id: 'root',
                            label: 'База ДИО',
                            type: 'root',
                            x: 400,
                            y: 50
                        }],
                        edges: []
                    };
                    tree._waitForContainer();
                }
            }, 300);
        }
        
        return tree;
    } catch (e) {
        console.error('❌ Ошибка инициализации:', e);
        return null;
    }
};

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔌 dio-tree-fix: проверка наличия сохранённых данных');
    
    // Проверяем, есть ли уже созданное дерево с ожидающими данными
    setTimeout(() => {
        if (window.dioTreeApp && window.dioTreeApp._pendingData) {
            console.log('📦 Найдены ожидающие данные в dioTreeApp, запускаем загрузку');
            window.dioTreeApp._waitForContainer();
        }
    }, 1000);
});

console.log('✅ dio-tree-fix.js загружен');
