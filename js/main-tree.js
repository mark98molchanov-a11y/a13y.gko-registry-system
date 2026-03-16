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


async function initTreeInTab(containerId = 'dioTabContent') {
    console.log('🚀 ===== НАЧАЛО initTreeInTab =====');
    console.log('   containerId:', containerId);
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ Контейнер не найден!');
        return;
    }
    
    try {
        // ШАГ 1: СОЗДАЕМ DOM
        console.log('1. Создаем DOM для дерева...');
        const treeHTML = createTreeDOM();
        container.innerHTML = treeHTML;
        console.log('   ✅ DOM создан');
        
        // Проверяем, что searchInput появился в DOM
        const searchInputCheck = document.getElementById('searchInput');
        console.log('   - searchInput в DOM после создания:', !!searchInputCheck);
        
        // ШАГ 2: ИНИЦИАЛИЗИРУЕМ TREEMANAGER (ТОЛЬКО ДАННЫЕ)
        console.log('2. Инициализируем TreeManager...');
        console.log('   - window.treeApp до инициализации:', window.treeApp);
        
        if (!window.treeApp) {
            const TreeManagerClass = TreeManager || window.TreeManager;
            window.treeApp = new TreeManagerClass();
            console.log('   ✅ новый экземпляр treeApp создан');
            
            // Инициализируем ТОЛЬКО данные, без UI
            await window.treeApp.initialize();
            console.log('   ✅ данные инициализированы');
        } else {
            console.log('   ✅ treeApp уже существует');
        }
        
        console.log('   - window.treeApp после инициализации:', !!window.treeApp);
        
        // ШАГ 3: ПРИВЯЗЫВАЕМ ЭЛЕМЕНТЫ DOM
        console.log('3. Привязываем элементы DOM к treeApp...');
        if (window.treeApp && window.treeApp.bindElementsToDOM) {
            window.treeApp.bindElementsToDOM();
            console.log('   ✅ bindElementsToDOM выполнен');
            console.log('   - treeApp.elements.searchInput:', !!window.treeApp.elements?.searchInput);
            console.log('   - treeApp.elements.treeContainer:', !!window.treeApp.elements?.treeContainer);
        } else {
            console.error('❌ treeApp.bindElementsToDOM не найден!');
        }
        
        // ШАГ 4: НАСТРАИВАЕМ ПОИСК
        console.log('4. Настраиваем поиск для нового DOM...');
        if (window.treeApp && window.treeApp.setupSearch) {
            window.treeApp.setupSearch();
            console.log('   ✅ setupSearch выполнен');
        } else {
            console.error('❌ treeApp.setupSearch не найден!');
        }
        
        // ШАГ 5: ЗАГРУЖАЕМ ДАННЫЕ
        console.log('5. Загрузка данных из JSON...');
        await loadTreeDataFromCombinedJSON();
        console.log('   ✅ loadTreeDataFromCombinedJSON выполнен');
        
        console.log('6. Загрузка файлов из глобальной переменной...');
        await loadFilesFromGlobal();
        console.log('   ✅ loadFilesFromGlobal выполнен');
        
        // ШАГ 6: ОБНОВЛЯЕМ ДЕРЕВО
        console.log('7. Обновляем дерево...');
        if (window.treeApp && window.treeApp.updateTree) {
            window.treeApp.updateTree();
            console.log('   ✅ updateTree выполнен');
        } else {
            console.error('❌ treeApp.updateTree не найден!');
        }
        
        // ШАГ 7: НАСТРАИВАЕМ ОСТАЛЬНЫЕ ОБРАБОТЧИКИ
        console.log('8. Настраиваем остальные обработчики...');
        if (window.treeApp) {
            if (window.treeApp.setupEventListeners) {
                window.treeApp.setupEventListeners();
                console.log('   ✅ setupEventListeners выполнен');
            }
            if (window.treeApp.setupZoom) {
                window.treeApp.setupZoom();
                console.log('   ✅ setupZoom выполнен');
            }
            if (window.treeApp.setupClusterControls) {
                window.treeApp.setupClusterControls();
                console.log('   ✅ setupClusterControls выполнен');
            }
        }
        
        window.treeInitialized = true;
        console.log('✅ ===== initTreeInTab ЗАВЕРШЕН УСПЕШНО =====');
        
        // Скрываем индикатор загрузки, если есть
        const loader = document.getElementById('treeLoadingIndicator');
        if (loader) loader.style.display = 'none';
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА в initTreeInTab:', error);
        console.error('   - Сообщение:', error.message);
        console.error('   - Стек:', error.stack);
        
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
async function initializeTreeManagerInTab() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ TREE MANAGER (ТОЛЬКО ДАННЫЕ) ===');
    
    try {
        if (typeof TreeManager !== 'function' && typeof window.TreeManager !== 'function') {
            console.error('❌ Класс TreeManager не найден');
            throw new Error('TreeManager class not found');
        }
        
        if (window.treeApp && window.treeApp.initialized) {
            console.log('✅ TreeManager уже существует и инициализирован');
            return window.treeApp;
        }
        
        const TreeManagerClass = TreeManager || window.TreeManager;
        console.log('✅ TreeManager класс найден');
        
        // СОЗДАЕМ ЭКЗЕМПЛЯР
        window.treeApp = new TreeManagerClass();
        console.log('✅ Экземпляр treeApp создан');
        
        // СОЗДАЕМ NODEEFFECTS
        if (typeof NodeEffects === 'function' || typeof window.NodeEffects === 'function') {
            const NodeEffectsClass = NodeEffects || window.NodeEffects;
            window.nodeEffects = new NodeEffectsClass();
            console.log('✅ NodeEffects создан');
        }
        
        // !!! ВАЖНО: НЕ вызываем bindElementsToDOM здесь !!!
        // DOM еще не создан, поэтому элементы не найдутся
        
        // ИНИЦИАЛИЗИРУЕМ ТОЛЬКО ДАННЫЕ
        console.log('⏳ Инициализация данных TreeManager...');
        
        // Вызываем initialize, но он не должен трогать DOM
        if (window.treeApp.initialize && typeof window.treeApp.initialize === 'function') {
            await window.treeApp.initialize();
            console.log('✅ Данные инициализированы');
        } else if (window.treeApp.init && typeof window.treeApp.init === 'function') {
            await window.treeApp.init();
            console.log('✅ Данные инициализированы (через init)');
        } else {
            console.warn('⚠️ Метод initialize не найден, пропускаем');
        }
        
        // Загружаем изображения из глобальной переменной
        await loadImagesFromGlobal();
        console.log('✅ Изображения загружены');
        
        console.log('✅ TreeManager (данные) готов');
        return window.treeApp;
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        throw error;
    }
}

// Загрузка изображений из глобальной переменной
async function loadImagesFromGlobal() {
    try {
        console.log('🖼️ Проверка глобальной переменной pendingTreeImages...');
        
        if (window.pendingTreeImages && Object.keys(window.pendingTreeImages).length > 0) {
            console.log('📸 Найдено изображений в pendingTreeImages:', Object.keys(window.pendingTreeImages).length);
            
            if (window.treeApp) {
                window.treeApp.imagesData = window.pendingTreeImages;
                console.log('✅ Изображения загружены в treeApp.imagesData');
                window.treeApp.updateTree();
                window.pendingTreeImages = null;
                console.log('🧹 Глобальная переменная изображений очищена');
            }
        } else {
            console.log('ℹ️ Нет изображений в глобальной переменной');
            await loadImagesFromLocalStorage();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки изображений из глобальной переменной:', error);
    }
}

// НОВАЯ ФУНКЦИЯ: загрузка файлов из глобальной переменной
async function loadFilesFromGlobal() {
    try {
        console.log('📁 Проверка глобальной переменной pendingTreeFiles...');
        
        if (window.pendingTreeFiles && Object.keys(window.pendingTreeFiles).length > 0) {
            console.log('📦 Найдено файлов в pendingTreeFiles:', Object.keys(window.pendingTreeFiles).length);
            
            if (window.treeApp) {
                // Загружаем метаданные файлов в память
                window.treeApp.filesData = window.pendingTreeFiles;
                console.log('✅ Файлы загружены в treeApp.filesData');
                
                // Загружаем файлы в IndexedDB
                console.log('📁 Загрузка файлов в IndexedDB...');
                let loadedCount = 0;
                
                for (const [fileId, fileMeta] of Object.entries(window.pendingTreeFiles)) {
                    try {
                        const existingFile = await window.treeApp.db.getFile(fileId);
                        if (!existingFile) {
                            await window.treeApp.db.saveFile(fileId, fileMeta);
                            loadedCount++;
                        }
                    } catch (dbError) {
                        console.error(`❌ Ошибка загрузки файла ${fileId}:`, dbError);
                    }
                }
                
                console.log(`✅ Загружено ${loadedCount} новых файлов в IndexedDB`);
                
                // Обновляем отображение
                window.treeApp.updateTree();
                
                // Очищаем глобальную переменную
                window.pendingTreeFiles = null;
                console.log('🧹 Глобальная переменная файлов очищена');
            }
        } else {
            console.log('ℹ️ Нет файлов в глобальной переменной');
            await loadFilesFromLocalStorage();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки файлов из глобальной переменной:', error);
    }
}

// НОВАЯ ФУНКЦИЯ: загрузка файлов из localStorage
async function loadFilesFromLocalStorage() {
    try {
        const allData = localStorage.getItem('gko_all_data');
        if (allData) {
            const parsed = JSON.parse(allData);
            if (parsed.filesData && Object.keys(parsed.filesData).length > 0) {
                console.log('📁 Найдено файлов в localStorage:', Object.keys(parsed.filesData).length);
                
                if (window.treeApp) {
                    window.treeApp.filesData = parsed.filesData;
                    console.log('✅ Файлы загружены из localStorage');
                    
                    // Загружаем в IndexedDB
                    for (const [fileId, fileMeta] of Object.entries(parsed.filesData)) {
                        try {
                            const existingFile = await window.treeApp.db.getFile(fileId);
                            if (!existingFile) {
                                await window.treeApp.db.saveFile(fileId, fileMeta);
                            }
                        } catch (dbError) {
                            console.error(`❌ Ошибка загрузки файла ${fileId}:`, dbError);
                        }
                    }
                    
                    window.treeApp.updateTree();
                }
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки файлов из localStorage:', e);
    }
}

// Загрузка изображений из localStorage
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

// Создание DOM структуры дерева
function createTreeDOM() {
    return `
        <div class="tree-tab-container">
            <div class="controls" id="tree-controls" style="position: sticky; top: 0; z-index: 100; margin-bottom: 20px;">
                <input type="text" id="searchInput" placeholder="Поиск..." style="padding: 8px; border-radius: 8px; border: 1px solid var(--primary-color);">
                <span id="selectedCount" style="margin-left: 10px; font-size: 0.9em; color: var(--accent-color); display: none;">Выделено: 0</span>
                <div class="autocomplete-suggestions" id="searchSuggestions"></div>
                
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

// Загрузка данных дерева из объединенного JSON
async function loadTreeDataFromCombinedJSON() {
    try {
        // Сохраняем уже загруженные изображения и файлы
        const existingImages = window.treeApp?.imagesData || {};
        const existingFiles = window.treeApp?.filesData || {};
        const hasImages = Object.keys(existingImages).length > 0;
        const hasFiles = Object.keys(existingFiles).length > 0;
        
        if (hasImages) {
            console.log('🖼️ Сохраняем существующие изображения:', Object.keys(existingImages).length);
        }
        if (hasFiles) {
            console.log('📁 Сохраняем существующие файлы:', Object.keys(existingFiles).length);
        }
        
        // Пробуем загрузить из объединённого JSON
        const allDataStr = localStorage.getItem('gko_all_data');
        if (allDataStr && window.treeApp) {
            const allData = JSON.parse(allDataStr);
            
            if (allData.tree) {
                const treeImportData = {
                    tree: allData.tree,
                    version: allData.version || '2.8',
                    images: hasImages ? existingImages : (allData.images || {}),
                    filesData: hasFiles ? existingFiles : (allData.filesData || {}),
                    clusters: allData.clusters || [],
                    availableClusters: allData.availableClusters || [],
                    settings: allData.settings || {}
                };
                
                await window.treeApp.importData(treeImportData);
                
                // Загружаем файлы в IndexedDB
                if (allData.filesData && Object.keys(allData.filesData).length > 0 && !hasFiles) {
                    console.log('📁 Загрузка файлов в IndexedDB из объединенного JSON...');
                    for (const [fileId, fileMeta] of Object.entries(allData.filesData)) {
                        try {
                            const existingFile = await window.treeApp.db.getFile(fileId);
                            if (!existingFile) {
                                await window.treeApp.db.saveFile(fileId, fileMeta);
                            }
                        } catch (dbError) {
                            console.error(`❌ Ошибка загрузки файла ${fileId}:`, dbError);
                        }
                    }
                }
                
                console.log('✅ Данные дерева загружены с сохранением изображений и файлов');
                return true;
            }
        }
        
        // Если нет в объединённом, пробуем отдельный файл дерева
        const treeDataStr = localStorage.getItem(STORAGE_KEY_TREE);
        if (treeDataStr && window.treeApp) {
            const treeData = JSON.parse(treeDataStr);
            
            const treeImportData = {
                tree: treeData.tree,
                images: hasImages ? existingImages : (treeData.images || {}),
                filesData: hasFiles ? existingFiles : (treeData.filesData || {})
            };
            
            await window.treeApp.importData(treeImportData);
            
            // Загружаем файлы в IndexedDB
            if (treeData.filesData && Object.keys(treeData.filesData).length > 0 && !hasFiles) {
                console.log('📁 Загрузка файлов в IndexedDB из отдельного хранилища...');
                for (const [fileId, fileMeta] of Object.entries(treeData.filesData)) {
                    try {
                        const existingFile = await window.treeApp.db.getFile(fileId);
                        if (!existingFile) {
                            await window.treeApp.db.saveFile(fileId, fileMeta);
                        }
                    } catch (dbError) {
                        console.error(`❌ Ошибка загрузки файла ${fileId}:`, dbError);
                    }
                }
            }
            
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

window.initTreeInTab = initTreeInTab;

// Для отладки
console.log('✅ main-tree.js готов, функции экспортированы:', {
    initTreeInTab: typeof initTreeInTab,
    applySavedTheme: typeof applySavedTheme
});
