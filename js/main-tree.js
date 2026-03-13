// main-tree.js - Только функции для дерева (без дублирования основного кода)

console.log('=== НАЧАЛО main-tree.js ===');
console.log('1. Проверка зависимостей:');
console.log('   - LZString:', typeof LZString);
console.log('   - Sortable:', typeof Sortable);
console.log('   - THREE:', typeof THREE);

console.log('2. Проверка классов дерева:');
console.log('   - TreeManager (глобально):', typeof TreeManager);
console.log('   - window.TreeManager:', typeof window.TreeManager);
console.log('   - NodeEffects:', typeof NodeEffects);
console.log('=== КОНЕЦ main-tree.js ===');

// Константы только для дерева
const STORAGE_KEY_TREE = 'treeData';

// ============================================
// ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ ДЕРЕВА ВО ВКЛАДКУ ДИО
// ============================================

// Функция инициализации дерева в указанном контейнере
async function initTreeInTab(containerId = 'dioTabContent') {
    console.log('🚀 initTreeInTab ВЫЗВАНА с containerId:', containerId);
    console.log('   - container существует:', !!document.getElementById(containerId));
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ Контейнер не найден!');
        return;
    }
    
    try {
        console.log('4. Попытка создать DOM для дерева...');
        const treeHTML = createTreeDOM();
        container.innerHTML = treeHTML;
        console.log('   ✅ DOM создан');
        
        console.log('5. Попытка инициализировать TreeManager...');
        console.log('   - window.treeApp до инициализации:', window.treeApp);
        
        await initializeTreeManagerInTab();
        
        console.log('   - window.treeApp после инициализации:', window.treeApp);
        
        // ❌ GitHub интеграция удалена
        
        console.log('7. Загрузка данных из JSON...');
        await loadTreeDataFromCombinedJSON();
        
        window.treeInitialized = true;
        console.log('✅ Дерево успешно инициализировано');
        
        const loader = document.getElementById('treeLoadingIndicator');
        if (loader) loader.style.display = 'none';
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error);
        console.error('   - Сообщение:', error.message);
        console.error('   - Стек:', error.stack);
        
        // Показываем ошибку пользователю
        if (container) {
            container.innerHTML = `
                <div class="text-center text-red-500 py-12">
                    <p class="text-lg font-bold mb-2">Ошибка загрузки дерева</p>
                    <p class="text-sm">${error.message}</p>
                    <button onclick="window.initTreeInTab('dioTabContent')" class="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg">
                        Повторить попытку
                    </button>
                </div>
            `;
        }
    }
}

// ✅ ИСПРАВЛЕННАЯ ФУНКЦИЯ С ЗАГРУЗКОЙ ИЗОБРАЖЕНИЙ ИЗ ГЛОБАЛЬНОЙ ПЕРЕМЕННОЙ
async function initializeTreeManagerInTab() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ TREE MANAGER ВО ВКЛАДКЕ ===');
    
    try {
        if (typeof TreeManager !== 'function' && typeof window.TreeManager !== 'function') {
            console.error('❌ Класс TreeManager не найден');
            throw new Error('TreeManager class not found');
        }
        
        if (window.treeApp && window.treeApp.initialized) {
            console.warn('TreeManager уже создан');
            return window.treeApp;
        }
        
        const TreeManagerClass = TreeManager || window.TreeManager;
        console.log('✅ TreeManager класс найден');
        
        // Создаем экземпляр (без привязки к DOM)
        window.treeApp = new TreeManagerClass();
        console.log('✅ Экземпляр treeApp создан');
        
        // ПРИНУДИТЕЛЬНО отключаем bindElements если он был вызван
        if (window.treeApp.bindElements && typeof window.treeApp.bindElements === 'function') {
            // Переопределяем, если нужно
        }
        
        // Создаем NodeEffects
        if (typeof NodeEffects === 'function' || typeof window.NodeEffects === 'function') {
            const NodeEffectsClass = NodeEffects || window.NodeEffects;
            window.nodeEffects = new NodeEffectsClass();
            console.log('✅ NodeEffects создан');
        }
        
        // Теперь привязываем к DOM (элементы уже должны существовать)
        if (window.treeApp.bindElementsToDOM && typeof window.treeApp.bindElementsToDOM === 'function') {
            window.treeApp.bindElementsToDOM();
            console.log('✅ Элементы привязаны к DOM');
        } else {
            // Если нет нового метода, создаем элементы вручную
            window.treeApp.elements = {
                treeContainer: document.getElementById('tree')
            };
            console.log('⚠️ Создан минимальный набор элементов');
        }
        
        // Инициализируем
        if (window.treeApp.initialize && typeof window.treeApp.initialize === 'function') {
            await window.treeApp.initialize();
        } else if (window.treeApp.init && typeof window.treeApp.init === 'function') {
            await window.treeApp.init();
        }
        
        console.log('✅ TreeManager инициализирован');
        
        // ✅ ЗАГРУЖАЕМ ИЗОБРАЖЕНИЯ ИЗ ГЛОБАЛЬНОЙ ПЕРЕМЕННОЙ
        await loadImagesFromGlobal();
        
        return window.treeApp;
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        throw error;
    }
}

// ✅ НОВАЯ ФУНКЦИЯ: загрузка изображений из глобальной переменной
async function loadImagesFromGlobal() {
    try {
        console.log('🖼️ Проверка глобальной переменной pendingTreeImages...');
        
        if (window.pendingTreeImages && Object.keys(window.pendingTreeImages).length > 0) {
            console.log('📸 Найдено изображений в pendingTreeImages:', Object.keys(window.pendingTreeImages).length);
            
            if (window.treeApp) {
                // Загружаем изображения в дерево
                window.treeApp.imagesData = window.pendingTreeImages;
                console.log('✅ Изображения загружены в treeApp.imagesData');
                
                // Обновляем отображение
                window.treeApp.updateTree();
                
                // Очищаем глобальную переменную
                window.pendingTreeImages = null;
                console.log('🧹 Глобальная переменная очищена');
            }
        } else {
            console.log('ℹ️ Нет изображений в глобальной переменной');
            
            // Пробуем загрузить из localStorage как запасной вариант
            await loadImagesFromLocalStorage();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки изображений из глобальной переменной:', error);
    }
}

// ✅ ЗАПАСНАЯ ФУНКЦИЯ: загрузка из localStorage
async function loadImagesFromLocalStorage() {
    try {
        const allData = localStorage.getItem('gko_all_data');
        if (allData) {
            const parsed = JSON.parse(allData);
            if (parsed.images && Object.keys(parsed.images).length > 0) {
                console.log('📸 Найдено изображений в localStorage:', Object.keys(parsed.images).length);
                
                if (window.treeApp) {
                    window.treeApp.imagesData = parsed.images;
                    console.log('✅ Изображения загружены из localStorage');
                    window.treeApp.updateTree();
                }
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки из localStorage:', e);
    }
}

// Создание DOM структуры дерева (без GitHub кнопок)
function createTreeDOM() {
    return `
        <div class="tree-tab-container">
            <div class="controls" id="tree-controls" style="position: sticky; top: 0; z-index: 100; margin-bottom: 20px;">
                <input type="text" id="searchInput" placeholder="Поиск..." style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary-color);">
                <span id="selectedCount" style="margin-left: 10px; font-size: 0.9em; color: var(--accent-color); display: none;">Выделено: 0</span>
                <div class="autocomplete-suggestions" id="searchSuggestions"></div>
                
                <!-- ❌ GitHub и JSON кнопки удалены -->
                
                <button type="button" id="saveBtn">Сохранить</button>
                <button type="button" id="collapseAllBtn">Свернуть все</button>
                <button type="button" id="collapseParentBtn" class="collapse-parent-btn">Свернуть родителя</button>
                
                <button type="button" id="addSuperordinateAboveBtn">Добавить сверху</button>
                <button type="button" id="uploadFileBtn">Загрузить файл</button>
                
                <button type="button" id="mark269Btn">Отсутствует в 269-П</button>
                <button type="button" id="power269Btn">Полномочие из 269-П</button>
                <button type="button" id="subordinateBtn">Должностные регламенты</button>
                <button type="button" id="forAllBtn">Все сотрудники</button>
                <button type="button" id="authorityBtn">Идентичное полномочие</button>
                <button type="button" id="okrBtn">OKR</button>
                <button type="button" id="indicatorBtn">Гос. программа</button>
                
                <div class="cluster-controls" style="display: flex; gap: 5px; align-items: center;">
                    <select id="clusterSelect" style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary-color); background: var(--controls-bg); color: var(--text-color);">
                        <option value="">Вся структура</option>
                    </select>
                    <button id="addToClusterBtn" title="Добавить в кластер">🏷️</button>
                </div>
                
                <button type="button" id="zoomInBtn">+</button>
                <button type="button" id="zoomResetBtn" class="reset-zoom-btn" title="Сбросить масштаб">⭕</button>
                <button type="button" id="zoomOutBtn">-</button>
                
                <div class="theme-switch" id="themeSwitch">
                    <span class="theme-icon sun-icon">☀️</span>
                    <span class="theme-icon moon-icon">🌙</span>
                    <div class="theme-switch-handle"></div>
                    <div class="theme-transition-overlay" id="themeTransitionOverlay"></div>
                </div>
            </div>
            
            <div class="drop-zone" id="dropZone">Перетащите файл сюда</div>
            <div id="tree" class="tree"></div>
            
            <div class="image-preview-container" id="previewContainer">
                <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=" class="image-preview" id="fullPreview">
            </div>
            
            <div class="watermark">Interactive Tree</div>
            <div class="history-log-icon" id="historyLogIcon" title="История изменений">🕒</div>
            <div class="history-dialog-backdrop" id="historyDialogBackdrop">
                <div class="history-dialog">
                    <h3>История последних изменений</h3>
                    <ul class="history-list" id="historyList"></ul>
                    <button class="history-dialog-close" id="historyDialogClose">Закрыть</button>
                </div>
            </div>
            <div class="department-management" id="departmentManagement">
                <div class="department-header">
                    <h2>Управление отделами</h2>
                    <button id="closeDepartmentManagement">× Закрыть</button>
                </div>
                <div class="department-container" id="departmentContainer"></div>
            </div>
            <div id="tooltip-container" class="tooltip" style="display: none;"></div>
        </div>
    `;
}

// ❌ Функция setupTreeGitHubIntegration УДАЛЕНА

// ❌ Функция loadTreeFromGitHub УДАЛЕНА

// ❌ Функция saveTreeToGitHub УДАЛЕНА

async function loadTreeDataFromCombinedJSON() {
    try {
        // ✅ СОХРАНЯЕМ УЖЕ ЗАГРУЖЕННЫЕ ИЗОБРАЖЕНИЯ
        const existingImages = window.treeApp?.imagesData || {};
        const hasImages = Object.keys(existingImages).length > 0;
        
        if (hasImages) {
            console.log('🖼️ Сохраняем существующие изображения:', Object.keys(existingImages).length);
        }
        
        // Пробуем загрузить из объединённого JSON
        const allDataStr = localStorage.getItem('gko_all_data');
        if (allDataStr && window.treeApp) {
            const allData = JSON.parse(allDataStr);
            
            if (allData.tree) {
                const treeImportData = {
                    tree: allData.tree,
                    version: allData.version || '2.8',
                    // ✅ ВАЖНО: используем существующие изображения, если они есть
                    images: hasImages ? existingImages : (allData.tree?.images || {}),
                    filesData: allData.tree?.filesData || {},
                    clusters: allData.tree?.clusters || [],
                    availableClusters: allData.tree?.availableClusters || [],
                    settings: allData.tree?.settings || {}
                };
                
                await window.treeApp.importData(treeImportData);
                console.log('✅ Данные дерева загружены с сохранением изображений');
                return true;
            }
        }
        
        // Если нет в объединённом, пробуем отдельный файл дерева
        const treeDataStr = localStorage.getItem(STORAGE_KEY_TREE);
        if (treeDataStr && window.treeApp) {
            const treeData = JSON.parse(treeDataStr);
            
            const treeImportData = {
                tree: treeData.tree,
                // ✅ ВАЖНО: тоже сохраняем изображения
                images: hasImages ? existingImages : (treeData.images || {})
            };
            
            await window.treeApp.importData(treeImportData);
            console.log('✅ Данные дерева загружены из отдельного хранилища');
            return true;
        }
        
        console.log('ℹ️ Нет сохраненных данных дерева');
        return false;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных дерева:', error);
        return false;
    }
}

// Функция обновления объединённого JSON (только для дерева)
function updateTreeCombinedJSON(treeData) {
    try {
        // Пробуем получить существующие данные
        let currentData = {};
        const saved = localStorage.getItem('gko_all_data');
        if (saved) {
            currentData = JSON.parse(saved);
        }
        
        if (treeData) {
            currentData.tree = treeData.tree || treeData;
        }
        
        localStorage.setItem('gko_all_data', JSON.stringify(currentData));
    } catch (error) {
        console.error('❌ Ошибка обновления объединённого JSON:', error);
    }
}

// ============================================
// ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

// Экспортируем только функции дерева (без GitHub)
window.initTreeInTab = initTreeInTab;

// Для отладки
console.log('✅ main-tree.js готов, функции экспортированы:', {
    initTreeInTab: typeof initTreeInTab
});
