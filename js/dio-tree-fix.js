// dio-tree-fix.js - Исправление для инициализации дерева ДИО

// Сохраняем оригинальный метод importData
const originalImportData = TreeManager.prototype.importData;

// Переопределяем метод importData с защитой от ошибок
TreeManager.prototype.importData = function(data) {
    console.log('⚡ importData (исправленная версия):', data);
    
    // Проверяем, что DOM готов
    if (!this.container || !this.container.current) {
        console.warn('⚠️ Контейнер ещё не готов, сохраняем данные для последующей загрузки');
        this._pendingData = data;
        return;
    }
    
    try {
        // Вызываем оригинальный метод
        originalImportData.call(this, data);
        console.log('✅ Данные успешно импортированы');
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

// Добавляем метод для проверки готовности
TreeManager.prototype.isReady = function() {
    return this.container && this.container.current && this.container.current.children.length > 0;
};

// Функция для безопасной инициализации дерева
window.safeInitDIOTree = function(containerId) {
    console.log('🔧 Безопасная инициализация дерева ДИО');
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ Контейнер не найден:', containerId);
        return null;
    }
    
    try {
        const tree = new TreeManager(containerId);
        
        // Проверяем, есть ли сохранённые данные
        if (tree._pendingData) {
            console.log('📦 Найдены ожидающие данные, загружаем...');
            setTimeout(() => {
                tree.importData(tree._pendingData);
                delete tree._pendingData;
            }, 300);
        } else {
            // Создаём корневой узел напрямую, минуя importData
            setTimeout(() => {
                if (tree.addNode) {
                    const rootId = tree.addNode('root', 'База ДИО', 400, 50);
                    console.log('🌳 Корневой узел создан, ID:', rootId);
                } else {
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
            }, 200);
        }
        
        return tree;
    } catch (e) {
        console.error('❌ Ошибка инициализации:', e);
        return null;
    }
};

console.log('✅ dio-tree-fix.js загружен');
