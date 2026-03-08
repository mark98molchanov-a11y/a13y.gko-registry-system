// main.js - Интегрированная версия для сайта Отдела ГКО
// Объединяет функциональность дерева и основного сайта

// ============================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================

// Переменные для дерева
window._initializationInProgress = false;
window._treeManagerInitialized = false;
window._treeManager = null;
window._nodeEffects = null;
window._appInitialized = false;

// Переменные для основного сайта
let appData = [];
let currentDocFilter = null;
let currentTypeFilter = null;
let currentTargetFilter = null;
let selectedIds = new Set();
let editId = null;
let chartInstance = null;

let dashboardsData = [];
let currentStatusFilterDashboards = null;
let currentTypeFilterDashboards = null;
let currentTagFilterDashboards = null;
let selectedIdsDashboards = new Set();
let editIdDashboards = null;
let chartInstanceDashboards = null;

let currentTab = 'npas';
let currentGitHubToken = null;

// Константы
const STORAGE_KEY_NPA = 'rosreestr_npa_viz_v5';
const STORAGE_KEY_DASHBOARDS = 'gko_dashboards_v2';
const STORAGE_KEY_CALCULATOR = 'gko_calculator_data_v1';
const STORAGE_KEY_ALL = 'gko_all_data';
const STORAGE_KEY_TREE = 'treeData';

const GITHUB_CONFIG = {
    OWNER: 'mark98molchanov-a11y',
    REPO: 'mark98molchanov-a12y.gko-registry-system',
    FILE_PATH: 'gko_all_data.json'
};

// ============================================
// ЗАЩИТА ОТ ОШИБОК (из оригинального main.js)
// ============================================

// Глобальная защита от ошибок bind
Function.prototype._bind = Function.prototype.bind;
Function.prototype.bind = function(context) {
    if (this === undefined || this === null) {
        console.warn('Попытка вызвать bind на undefined/null, возвращаем заглушку');
        return function() {};
    }
    try {
        return this._bind(context);
    } catch (error) {
        console.warn('Ошибка в bind, возвращаем заглушку:', error.message);
        return function() {};
    }
};

window.addEventListener('error', function(e) {
    if (e.message.includes('bind') || e.message.includes('setupDragAndDrop')) {
        console.warn('Перехвачена ошибка:', e.message);
        e.preventDefault();
    }
});

// Обработчик ошибок для Three.js
window.addEventListener('error', function(e) {
    if (e.message.includes('THREE') || e.message.includes('WebGL')) {
        console.warn('Three.js ошибка, отключаем эффекты:', e.message);
        if (!window.NodeEffects) {
            window.NodeEffects = class NodeEffectsStub {
                constructor() { 
                    console.log('NodeEffects заглушка создана'); 
                    this.effects = new Set();
                }
                addEffect(element, type) {
                    if (element && !this.effects.has(element)) {
                        this.effects.add(element);
                        console.log(`Добавлен эффект ${type} к элементу`);
                    }
                }
                removeEffect(element, type) {
                    if (this.effects.has(element)) {
                        this.effects.delete(element);
                    }
                }
            };
        }
    }
});

// ============================================
// ФУНКЦИИ ДЛЯ ДЕРЕВА (из оригинального main.js)
// ============================================

// Функция для безопасного создания TreeManager
async function initializeTreeManager() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ TREE MANAGER ===');
    
    try {
        if (typeof TreeManager !== 'function' && typeof window.TreeManager !== 'function') {
            console.error('Класс TreeManager не найден');
            throw new Error('TreeManager class not found');
        }
        
        if (window.treeManager && window.treeManager.initialized) {
            console.warn('TreeManager уже создан и инициализирован ранее');
            return window.treeManager;
        }
        
        const TreeManagerClass = TreeManager || window.TreeManager;
        console.log('TreeManager класс найден:', TreeManagerClass.name);
        
        // ПАТЧИМ ПРОТОТИП TreeManager перед созданием экземпляра
        if (TreeManagerClass.prototype) {
            if (!TreeManagerClass.prototype.handleDragOver) {
                TreeManagerClass.prototype.handleDragOver = function(e) {
                    e.preventDefault();
                    if (this.dropIndicator && e.dataTransfer && e.dataTransfer.types && 
                        e.dataTransfer.types.includes('application/x-tree-node')) {
                        this.dropIndicator.style.display = 'block';
                        this.dropIndicator.style.left = e.clientX + 'px';
                        this.dropIndicator.style.top = e.clientY + 'px';
                        this.dropIndicator.style.width = '100px';
                        this.dropIndicator.style.height = '100px';
                    }
                };
                console.log('Добавлен handleDragOver в прототип TreeManager');
            }
            
            if (!TreeManagerClass.prototype.handleDrop) {
                TreeManagerClass.prototype.handleDrop = function(e) {
                    e.preventDefault();
                    if (this.dropIndicator) {
                        this.dropIndicator.style.display = 'none';
                    }
                    console.log('handleDrop заглушка');
                };
                console.log('Добавлен handleDrop в прототип TreeManager');
            }
            
            if (!TreeManagerClass.prototype.handleDragEnd) {
                TreeManagerClass.prototype.handleDragEnd = function(e) {
                    if (this.dropIndicator) {
                        this.dropIndicator.style.display = 'none';
                    }
                    console.log('handleDragEnd заглушка');
                };
                console.log('Добавлен handleDragEnd в прототип TreeManager');
            }
            
            if (!TreeManagerClass.prototype.restoreTree) {
                TreeManagerClass.prototype.restoreTree = function(treeData) {
                    console.log('restoreTree заглушка, возвращаем данные как есть');
                    return treeData || { id: 'root', content: {}, children: [] };
                };
                console.log('Добавлен restoreTree в прототип TreeManager');
            }
            
            // Патчим setupDragAndDrop для избежания ошибки bind
            if (TreeManagerClass.prototype.setupDragAndDrop) {
                const originalSetupDragAndDrop = TreeManagerClass.prototype.setupDragAndDrop;
                TreeManagerClass.prototype.setupDragAndDrop = function() {
                    console.log('Патченный setupDragAndDrop вызван');
                    try {
                        return originalSetupDragAndDrop.call(this);
                    } catch (error) {
                        console.warn('Ошибка в setupDragAndDrop перехвачена:', error.message);
                        return null;
                    }
                };
                console.log('Патч setupDragAndDrop применен');
            }
            
            // Патчим importData для лучшей обработки ошибок
            if (TreeManagerClass.prototype.importData) {
                const originalImportData = TreeManagerClass.prototype.importData;
                TreeManagerClass.prototype.importData = function(data) {
                    console.log('Патченный importData вызван');
                    try {
                        return originalImportData.call(this, data);
                    } catch (error) {
                        console.warn('Ошибка в importData перехвачена:', error.message);
                        // Пробуем восстановить данные хотя бы частично
                        if (data && data.tree) {
                            this.treeData = data.tree;
                            console.log('Данные сохранены в treeData через fallback');
                        }
                        return false;
                    }
                };
                console.log('Патч importData применен');
            }
            
            // Добавляем метод showNotification если его нет
            if (!TreeManagerClass.prototype.showNotification) {
                TreeManagerClass.prototype.showNotification = function(message, type = 'info') {
                    console.log(`TreeManager notification [${type}]:`, message);
                    if (window.showNotification) {
                        window.showNotification(message, type);
                    }
                };
                console.log('Добавлен showNotification в прототип TreeManager');
            }
        }
        
        window.treeManager = new TreeManagerClass();
        console.log('✅ Экземпляр treeManager создан');
        
        // Патчим отсутствующие методы в экземпляре
        if (!window.treeManager.processOperationQueue) {
            window.treeManager.processOperationQueue = () => {
                console.log('processOperationQueue заглушка вызвана');
            };
        }
        
        if (!window.treeManager.loadFromLocalStorageFallback) {
            window.treeManager.loadFromLocalStorageFallback = async () => {
                console.log('loadFromLocalStorageFallback заглушка вызвана');
                try {
                    const savedData = localStorage.getItem(STORAGE_KEY_TREE);
                    if (savedData) {
                        const data = JSON.parse(savedData);
                        if (window.treeManager.importData) {
                            await window.treeManager.importData(data);
                            console.log('Данные загружены из localStorage');
                        }
                    }
                } catch (error) {
                    console.error('Ошибка загрузки из localStorage:', error);
                }
            };
        }
        
        if (!window.treeManager.saveToHistory) {
            window.treeManager.saveToHistory = (isInitialState = false) => {
                console.log('saveToHistory заглушка вызвана', { isInitialState });
            };
        }
        
        // Создаем NodeEffects если его нет
        if (typeof NodeEffects !== 'function' && typeof window.NodeEffects !== 'function') {
            console.warn('NodeEffects не найден, создаем заглушку');
            window.NodeEffects = class NodeEffectsStub {
                constructor() { 
                    console.log('NodeEffects заглушка создана'); 
                    this.effects = new Set();
                }
                addEffect(element, type) {
                    if (element && !this.effects.has(element)) {
                        this.effects.add(element);
                        console.log(`Добавлен эффект ${type} к элементу`);
                    }
                }
                removeEffect(element, type) {
                    if (this.effects.has(element)) {
                        this.effects.delete(element);
                    }
                }
            };
        }
        
        const NodeEffectsClass = NodeEffects || window.NodeEffects;
        window.nodeEffects = new NodeEffectsClass();
        console.log('✅ NodeEffects создан');
        
        // Инициализируем treeManager
        if (window.treeManager.initialize && typeof window.treeManager.initialize === 'function') {
            await window.treeManager.initialize();
        } else if (window.treeManager.init && typeof window.treeManager.init === 'function') {
            await window.treeManager.init();
        } else {
            console.warn('TreeManager не имеет методов initialize или init');
            if (window.treeManager.asyncInit && typeof window.treeManager.asyncInit === 'function') {
                await window.treeManager.asyncInit();
            }
        }
        
        console.log('✅ TreeManager инициализирован');
        return window.treeManager;
        
    } catch (error) {
        console.error('Ошибка инициализации TreeManager:', error);
        throw error;
    }
}

// Главная функция инициализации дерева
async function initializeApp() {
    if (window._appInitialized) {
        console.log('Приложение уже инициализировано ранее');
        return;
    }
    
    if (window._initializationInProgress) {
        console.log('Инициализация уже в процессе...');
        return;
    }
    
    window._initializationInProgress = true;
    
    try {
        console.log('🚀 Запуск инициализации приложения...');
        
        if (document.readyState !== 'complete') {
            await new Promise(resolve => {
                if (document.readyState === 'complete') {
                    resolve();
                } else {
                    window.addEventListener('load', resolve);
                    setTimeout(resolve, 5000);
                }
            });
        }
        
        console.log('✅ DOM загружен');
        
        console.log('Проверяем загруженные скрипты:');
        console.log('- TreeManager:', typeof TreeManager !== 'undefined' ? 'загружен' : 'не найден');
        console.log('- NodeEffects:', typeof NodeEffects !== 'undefined' ? 'загружен' : 'не найден');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const treeManager = await initializeTreeManager();
        
        if (!treeManager) {
            throw new Error('Не удалось создать TreeManager');
        }
        
        window._treeManagerInitialized = true;
        console.log('✅ TreeManager инициализирован');
        
        // Добавляем кнопку GitHub
        addGitHubLoadButton();
        
        window._appInitialized = true;
        console.log('✅ Приложение полностью инициализировано');
        
    } catch (error) {
        console.error('❌ Критическая ошибка инициализации:', error);
        showNotification('Ошибка загрузки приложения. Проверьте консоль.', 'error');
        createFallbackInterface();
    } finally {
        window._initializationInProgress = false;
    }
}

// Создание fallback интерфейса
function createFallbackInterface() {
    console.log('Создаем fallback интерфейс...');
    
    const container = document.getElementById('tree') || document.body;
    const fallbackHTML = `
        <div style="text-align: center; padding: 50px; color: var(--text-color);">
            <h2>Tree Manager</h2>
            <p>Приложение загружено в упрощенном режиме.</p>
            <div style="margin: 20px 0;">
                <button onclick="window.loadDataFromGitHub()" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Загрузить из GitHub
                </button>
            </div>
            <div id="fallback-tree" style="margin-top: 20px;"></div>
        </div>
    `;
    
    container.innerHTML = fallbackHTML;
}

// ============================================
// ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ ДЕРЕВА ВО ВКЛАДКУ ДИО
// ============================================

// Функция инициализации дерева в указанном контейнере
async function initTreeInTab(containerId = 'dioTabContent') {
    console.log('=== ИНИЦИАЛИЗАЦИЯ ДЕРЕВА ВО ВКЛАДКЕ ДИО ===');
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('❌ Контейнер для дерева не найден:', containerId);
        return;
    }
    
    // Показываем индикатор загрузки
    container.innerHTML = `
        <div class="text-center text-slate-400 py-12" id="treeLoadingIndicator">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
            <p>Загрузка интерактивного дерева...</p>
        </div>
    `;
    
    try {
        // Создаем структуру DOM для дерева
        const treeHTML = createTreeDOM();
        container.innerHTML = treeHTML;
        
        // Инициализируем TreeManager если ещё не инициализирован
        if (!window.treeManager) {
            await initializeApp();
        }
        
        // Настраиваем интеграцию с общим GitHub API
        setupTreeGitHubIntegration();
        
        // Загружаем данные из объединённого JSON
        await loadTreeDataFromCombinedJSON();
        
        console.log('✅ Дерево успешно инициализировано во вкладке');
        
        // Скрываем индикатор загрузки
        const loader = document.getElementById('treeLoadingIndicator');
        if (loader) loader.style.display = 'none';
        
    } catch (error) {
        console.error('❌ Ошибка инициализации дерева во вкладке:', error);
        container.innerHTML = `
            <div class="text-center text-red-500 py-12">
                <p>Ошибка загрузки дерева: ${error.message}</p>
                <button onclick="window.initTreeInTab('${containerId}')" class="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg">
                    Повторить попытку
                </button>
            </div>
        `;
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
                
                <button type="button" id="jsonExportBtn">JSON Экспорт</button>
                <button type="button" id="jsonImportBtn">JSON Импорт</button>
                <button type="button" id="githubLoadBtn" class="github-load-btn" style="background: linear-gradient(145deg, #24292e, #0366d6);">Загрузить из GitHub</button>
                <button type="button" id="saveToGitHubBtn" style="background: linear-gradient(145deg, #24292e, #2c974b);">💾 Сохранить в GitHub</button>
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

// Функция для интеграции с GitHub API
function setupTreeGitHubIntegration() {
    if (!window.treeManager) return;
    
    // Перехватываем кнопку загрузки из GitHub
    const githubLoadBtn = document.getElementById('githubLoadBtn');
    if (githubLoadBtn) {
        const newBtn = githubLoadBtn.cloneNode(true);
        githubLoadBtn.parentNode.replaceChild(newBtn, githubLoadBtn);
        
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await loadTreeFromGitHub();
        });
    }
    
    // Настраиваем кнопку сохранения в GitHub
    const saveGitHubBtn = document.getElementById('saveToGitHubBtn');
    if (saveGitHubBtn) {
        saveGitHubBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await saveTreeToGitHub();
        });
    }
}

// Функция загрузки дерева из GitHub
async function loadTreeFromGitHub() {
    if (!window.treeManager) {
        showNotification('❌ Дерево не инициализировано', 'error');
        return;
    }
    
    showLoadingIndicator('Загрузка из GitHub...');
    
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/main/${GITHUB_CONFIG.FILE_PATH}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            signal: controller.signal,
            mode: 'cors',
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ошибка: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.tree) {
            const importData = {
                tree: data.tree,
                version: data.version || '2.8',
                images: data.tree?.images || {},
                filesData: data.tree?.filesData || {},
                clusters: data.tree?.clusters || [],
                availableClusters: data.tree?.availableClusters || [],
                settings: data.tree?.settings || {}
            };
            
            await window.treeManager.importData(importData);
            
            // Обновляем объединённый JSON
            updateCombinedJSON({ tree: data.tree });
            
            showNotification('✅ Дерево загружено из GitHub', 'success');
        } else {
            throw new Error('Нет данных дерева в загруженном файле');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки из GitHub:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        hideLoadingIndicator();
    }
}

// Функция сохранения дерева в GitHub
async function saveTreeToGitHub() {
    if (!window.treeManager) {
        showNotification('❌ Дерево не инициализировано', 'error');
        return;
    }
    
    try {
        const treeData = window.treeManager.serializeTree(window.treeManager.treeData);
        const allData = getCurrentCombinedJSON();
        
        allData.tree = treeData;
        allData.version = "1.0";
        allData.exportDate = new Date().toISOString();
        
        localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(allData));
        localStorage.setItem(STORAGE_KEY_TREE, JSON.stringify({ tree: treeData }));
        
        showNotification('✅ Данные сохранены локально', 'success');
        
        // Открываем модалку GitHub
        showGitHubTokenModal();
        
    } catch (error) {
        console.error('❌ Ошибка сохранения:', error);
        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    }
}

// Функция загрузки данных дерева из объединённого JSON
async function loadTreeDataFromCombinedJSON() {
    try {
        const allDataStr = localStorage.getItem(STORAGE_KEY_ALL);
        if (allDataStr && window.treeManager) {
            const allData = JSON.parse(allDataStr);
            
            if (allData.tree) {
                const treeImportData = {
                    tree: allData.tree,
                    version: allData.version || '2.8',
                    images: allData.tree?.images || {},
                    filesData: allData.tree?.filesData || {},
                    clusters: allData.tree?.clusters || [],
                    availableClusters: allData.tree?.availableClusters || [],
                    settings: allData.tree?.settings || {}
                };
                
                await window.treeManager.importData(treeImportData);
                console.log('✅ Данные дерева загружены из объединённого JSON');
                return true;
            }
        }
        
        const treeDataStr = localStorage.getItem(STORAGE_KEY_TREE);
        if (treeDataStr && window.treeManager) {
            const treeData = JSON.parse(treeDataStr);
            await window.treeManager.importData(treeData);
            console.log('✅ Данные дерева загружены из отдельного хранилища');
            
            updateCombinedJSON({ tree: treeData.tree });
            return true;
        }
        
        console.log('ℹ️ Нет сохраненных данных дерева');
        return false;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных дерева:', error);
        return false;
    }
}

// Функция обновления объединённого JSON
function updateCombinedJSON(treeData) {
    try {
        const currentData = getCurrentCombinedJSON();
        if (treeData) {
            currentData.tree = treeData.tree || treeData;
        }
        localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(currentData));
    } catch (error) {
        console.error('❌ Ошибка обновления объединённого JSON:', error);
    }
}

// Функция получения текущего объединённого JSON
function getCurrentCombinedJSON() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_ALL);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('❌ Ошибка парсинга объединённого JSON:', e);
    }
    
    return {
        version: "1.0",
        exportDate: new Date().toISOString(),
        npas: appData || [],
        dashboards: dashboardsData || [],
        tree: null,
        calculator: {}
    };
}

// ============================================
// ФУНКЦИИ ДЛЯ GITHUB (адаптированные из сайта)
// ============================================

function showGitHubTokenModal() {
    const modal = document.getElementById('githubTokenModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('githubTokenInput').focus();
    } else {
        // Создаем модалку если её нет
        createGitHubModal();
    }
}

function closeGitHubModal() {
    const modal = document.getElementById('githubTokenModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('githubTokenInput').value = '';
    }
}

function createGitHubModal() {
    const modalHTML = `
        <div id="githubTokenModal" class="fixed inset-0 z-50 hidden">
            <div class="absolute inset-0 bg-black/50" onclick="closeGitHubModal()"></div>
            <div class="relative bg-white w-96 mx-auto mt-32 rounded-xl shadow-xl p-6">
                <h3 class="text-lg font-bold mb-4">🔑 GitHub Token</h3>
                <input type="password" id="githubTokenInput" placeholder="github_pat_..." class="w-full border p-3 rounded-lg mb-3 text-sm font-mono" autocomplete="off">
                <p class="text-xs text-gray-500 mb-4">Введите Personal Access Token с правами <code>repo</code></p>
                <div class="flex gap-2">
                    <button onclick="closeGitHubModal()" class="flex-1 py-2 border rounded-lg">Отмена</button>
                    <button onclick="saveToGitHub()" class="flex-1 py-2 bg-emerald-500 text-white rounded-lg">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

async function saveToGitHub() {
    const token = document.getElementById('githubTokenInput').value.trim();
    
    if (!token) {
        alert('Введите GitHub Token');
        return;
    }
    
    const allData = getCurrentCombinedJSON();
    const content = JSON.stringify(allData, null, 2);
    const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${GITHUB_CONFIG.FILE_PATH}`;
    
    try {
        let sha = null;
        try {
            const res = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (res.ok) {
                const data = await res.json();
                sha = data.sha;
            }
        } catch (e) { /* Файл не существует */ }
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Обновление данных: ${new Date().toLocaleString('ru-RU')}`,
                content: btoa(unescape(encodeURIComponent(content))),
                sha: sha
            })
        });
        
        if (response.ok) {
            closeGitHubModal();
            showNotification('✅ Данные сохранены в GitHub', 'success');
        } else {
            const error = await response.json();
            alert(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
        }
        
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

async function loadFromGitHub() {
    try {
        console.log('Загрузка данных из GitHub...');
        
        const url = `https://raw.githubusercontent.com/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/main/${GITHUB_CONFIG.FILE_PATH}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Файл не найден (${response.status})`);
        }
        
        const json = await response.json();
        
        if (json.npas && Array.isArray(json.npas)) {
            appData = [...json.npas];
            localStorage.setItem(STORAGE_KEY_NPA, JSON.stringify(appData));
            renderGrid();
        }
        
        if (json.dashboards && Array.isArray(json.dashboards)) {
            dashboardsData = [...json.dashboards];
            localStorage.setItem(STORAGE_KEY_DASHBOARDS, JSON.stringify(dashboardsData));
            if (currentTab === 'dashboards') {
                renderDashboardsGrid();
            }
        }
        
        if (json.tree && window.treeManager) {
            const treeImportData = {
                tree: json.tree,
                version: json.version || '2.8'
            };
            await window.treeManager.importData(treeImportData);
        }
        
        if (json.calculator) {
            localStorage.setItem(STORAGE_KEY_CALCULATOR, JSON.stringify(json.calculator));
        }
        
        localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(json));
        
        showNotification('✅ Все данные загружены из GitHub', 'success');
        
    } catch (error) {
        console.warn('Не удалось загрузить из GitHub:', error.message);
        loadData();
        loadDashboardsData();
    }
}

// ============================================
// ФУНКЦИИ ДЛЯ НПА (из сайта)
// ============================================

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY_NPA);
    if (saved) {
        try {
            appData = JSON.parse(saved);
        } catch (e) { 
            appData = [];
        }
    } else {
        appData = [];
    }
    renderGrid();
}

function saveData() {
    localStorage.setItem(STORAGE_KEY_NPA, JSON.stringify(appData));
    renderGrid();
    updateCombinedJSON({ npas: appData });
}

function renderGrid() {
    const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const sortMode = document.getElementById('sortSelect')?.value || 'lastUpdated';
    
    let filtered = appData.filter(item => {
        const matchesDoc = !currentDocFilter || item.doc === currentDocFilter;
        const matchesType = !currentTypeFilter || item.type === currentTypeFilter;
        const matchesTarget = !currentTargetFilter || (item.target && item.target.includes(currentTargetFilter));
        const matchesSearch = 
            (item.human && item.human.toLowerCase().includes(search)) || 
            (item.norm && item.norm.toLowerCase().includes(search)) || 
            (item.doc && item.doc.toLowerCase().includes(search));
        return matchesDoc && matchesType && matchesTarget && matchesSearch;
    });

    filtered.sort((a, b) => {
        if (sortMode === 'dateDesc') return parseDate(b.date) - parseDate(a.date);
        if (sortMode === 'dateAsc') return parseDate(a.date) - parseDate(b.date);
        if (sortMode === 'lastUpdated') return (b.updated || 0) - (a.updated || 0);
        return a.id - b.id;
    });

    renderDocFilters();
    renderTypeFilters();
    renderTags();
    updateActiveBar();
    updateDashboard(filtered);

    const container = document.getElementById('cardsGrid');
    if (!container) return;

    document.getElementById('filteredCount').innerText = filtered.length;

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-400">Ничего не найдено</div>`;
        return;
    }

    // Здесь код рендеринга карточек (сокращен для краткости)
    // Полный код из вашего сайта нужно вставить сюда
}

function updateDashboard(dataSource) {
    const data = dataSource || appData;
    const total = data.length;
    document.getElementById('statTotal').innerText = total;

    const countFZ = data.filter(i => i.doc.includes('237')).length;
    const countOrder = data.filter(i => i.doc.includes('0336')).length;
    const countNK = data.filter(i => i.doc.includes('378') || i.doc.includes('NK')).length;

    document.getElementById('countFZ').innerText = countFZ;
    document.getElementById('countOrder').innerText = countOrder;
    document.getElementById('countNK').innerText = countNK;

    document.getElementById('barFZ').style.width = (total ? (countFZ/total*100) : 0) + '%';
    document.getElementById('barOrder').style.width = (total ? (countOrder/total*100) : 0) + '%';
    document.getElementById('barNK').style.width = (total ? (countNK/total*100) : 0) + '%';
    
    const typeCounts = {};
    data.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
    const sortedKeys = Object.keys(typeCounts).sort((a,b) => typeCounts[b] - typeCounts[a]);
    
    const ctx = document.getElementById('typeChart')?.getContext('2d');
    if (ctx) {
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedKeys,
                datasets: [{
                    label: 'Записей',
                    data: sortedKeys.map(k => typeCounts[k]),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

function renderDocFilters() {
    const container = document.getElementById('docFilterContainer');
    if (!container) return;
    const docs = [...new Set(appData.map(item => item.doc))];
    container.innerHTML = docs.map(doc => {
        const isActive = currentDocFilter === doc;
        return `<button onclick="setDocFilter('${doc}')" class="filter-chip px-3 py-1.5 rounded-lg text-xs font-bold border ${isActive ? 'active' : 'bg-white border-slate-200 text-slate-500'}">${doc}</button>`;
    }).join('');
}

function renderTypeFilters() {
    const container = document.getElementById('typeFilterContainer');
    if (!container) return;
    const types = [...new Set(appData.map(item => item.type))];
    container.innerHTML = types.map(t => {
        const isActive = currentTypeFilter === t;
        return `<button onclick="setTypeFilter('${t}')" class="filter-chip px-3 py-1.5 rounded-lg text-xs font-bold border ${isActive ? 'active' : 'bg-white border-slate-200 text-slate-500'}">${t}</button>`;
    }).join('');
}

function renderTags() {
    const container = document.getElementById('targetContainer');
    if (!container) return;
    const counts = {}; 
    appData.forEach(i => (i.target||'').split(',').forEach(t => { const k=t.trim(); if(k) counts[k]=(counts[k]||0)+1; }));
    container.innerHTML = Object.keys(counts).map(k => {
        const isActive = currentTargetFilter === k;
        return `<button onclick="setTargetFilter('${k}')" class="filter-chip px-3 py-1 border rounded-full text-xs ${isActive ? 'active' : 'bg-white text-slate-500 border-slate-200'}">${k} <span class="opacity-60 ml-1">${counts[k]}</span></button>`;
    }).join('');
}

function setDocFilter(val) { currentDocFilter = currentDocFilter === val ? null : val; renderGrid(); }
function setTypeFilter(val) { currentTypeFilter = currentTypeFilter === val ? null : val; renderGrid(); }
function setTargetFilter(val) { currentTargetFilter = currentTargetFilter === val ? null : val; renderGrid(); }
function resetAllFilters() { currentDocFilter = null; currentTypeFilter = null; currentTargetFilter = null; document.getElementById('searchInput').value=''; renderGrid(); }

function updateActiveBar() {
    const bar = document.getElementById('activeFiltersBar');
    if (!bar) return;
    if(currentDocFilter || currentTypeFilter || currentTargetFilter) bar.classList.remove('hidden'); else bar.classList.add('hidden');
}

function parseDate(d) { if (!d) return 0; const p = d.split('.'); return p.length === 3 ? new Date(p[2], p[1]-1, p[0]).getTime() : 0; }

// ============================================
// ФУНКЦИИ ДЛЯ ДАШБОРДОВ (из сайта)
// ============================================

function loadDashboardsData() {
    const saved = localStorage.getItem(STORAGE_KEY_DASHBOARDS);
    if (saved) {
        try {
            dashboardsData = JSON.parse(saved);
        } catch (e) { 
            dashboardsData = [];
        }
    } else {
        dashboardsData = [];
    }
    
    if (currentTab === 'dashboards') {
        renderDashboardsGrid();
    }
}

function saveDashboardsData() {
    localStorage.setItem(STORAGE_KEY_DASHBOARDS, JSON.stringify(dashboardsData));
    renderDashboardsGrid();
    updateCombinedJSON({ dashboards: dashboardsData });
}

function renderDashboardsGrid() {
    const search = document.getElementById('searchInputDashboards')?.value.toLowerCase() || '';
    const sortMode = document.getElementById('sortSelectDashboards')?.value || 'createdDesc';
    
    let filtered = dashboardsData.filter(item => {
        const matchesStatus = !currentStatusFilterDashboards || item.status === currentStatusFilterDashboards;
        const matchesType = !currentTypeFilterDashboards || item.analysisType === currentTypeFilterDashboards;
        const matchesTag = !currentTagFilterDashboards || (item.tags && item.tags.some(tag => tag.toLowerCase() === currentTagFilterDashboards.toLowerCase()));
        const matchesSearch = 
            (item.title && item.title.toLowerCase().includes(search)) || 
            (item.description && item.description.toLowerCase().includes(search)) ||
            (item.owner && item.owner.toLowerCase().includes(search)) ||
            (item.tags && item.tags.some(tag => tag.toLowerCase().includes(search)));
        
        return matchesStatus && matchesType && matchesTag && matchesSearch;
    });

    filtered.sort((a, b) => {
        switch(sortMode) {
            case 'nameAsc': return a.title.localeCompare(b.title);
            case 'nameDesc': return b.title.localeCompare(a.title);
            case 'createdDesc': return (b.createdDate || 0) - (a.createdDate || 0);
            case 'createdAsc': return (a.createdDate || 0) - (b.createdDate || 0);
            default: return (b.createdDate || 0) - (a.createdDate || 0);
        }
    });

    const container = document.getElementById('cardsGridDashboards');
    if (!container) return;
    
    document.getElementById('filteredCountDashboards').innerText = filtered.length;

    // Здесь код рендеринга карточек дашбордов (сокращен для краткости)
    // Полный код из вашего сайта нужно вставить сюда
}

function setStatusFilterDashboards(val) { currentStatusFilterDashboards = currentStatusFilterDashboards === val ? null : val; renderDashboardsGrid(); }
function setTypeFilterDashboards(val) { currentTypeFilterDashboards = currentTypeFilterDashboards === val ? null : val; renderDashboardsGrid(); }
function setTagFilterDashboards(val) { currentTagFilterDashboards = currentTagFilterDashboards === val ? null : val; renderDashboardsGrid(); }
function resetAllDashboardsFilters() { currentStatusFilterDashboards = null; currentTypeFilterDashboards = null; currentTagFilterDashboards = null; document.getElementById('searchInputDashboards').value=''; renderDashboardsGrid(); }

// ============================================
// ФУНКЦИИ ДЛЯ ПЕРЕКЛЮЧЕНИЯ ВКЛАДОК
// ============================================

function switchTab(tabName) {
    document.querySelectorAll('.book-section.main, .book-subsection, .book-subsubsection').forEach(el => {
        el.classList.remove('active');
    });
    
    const navIdMap = {
        'npas': 'navNPA',
        'dashboards': 'navDashboards', 
        'calculator': 'navCalculator',
        'dio': null
    };
    
    const navId = navIdMap[tabName];
    if (navId) {
        const activeNavItem = document.getElementById(navId);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
    }
    
    if (tabName === 'dio') {
        const dioSection = Array.from(document.querySelectorAll('.book-section.main'))
            .find(el => el.textContent.includes('База ДИО'));
        if (dioSection) {
            dioSection.classList.add('active');
        }
    }
    
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    if (tabName === 'dio') {
        document.getElementById('npaImportButtons')?.classList.add('hidden');
        document.getElementById('dashboardsImportButtons')?.classList.add('hidden');
        document.getElementById('addButtonText').textContent = 'Добавить в ДИО';
        document.getElementById('resetBtnText').textContent = 'Сброс ДИО';
        currentTab = 'dio';
        
        document.getElementById('bulkToolbar')?.classList.add('hidden');
        document.getElementById('bulkToolbarDashboards')?.classList.add('hidden');
        
        // Инициализируем дерево
        if (!window.treeManager) {
            setTimeout(() => {
                initTreeInTab('dioTabContent');
            }, 100);
        } else {
            initTreeInTab('dioTabContent');
        }
    } else if (tabName === 'npas') {
        document.getElementById('npaImportButtons')?.classList.remove('hidden');
        document.getElementById('dashboardsImportButtons')?.classList.add('hidden');
        document.getElementById('addButtonText').textContent = 'Добавить запись';
        document.getElementById('resetBtnText').textContent = 'Сброс НПА';
        currentTab = 'npas';
        renderGrid();
    } else if (tabName === 'dashboards') {
        document.getElementById('npaImportButtons')?.classList.add('hidden');
        document.getElementById('dashboardsImportButtons')?.classList.remove('hidden');
        document.getElementById('addButtonText').textContent = 'Новый дашборд';
        document.getElementById('resetBtnText').textContent = 'Сброс дашбордов';
        currentTab = 'dashboards';
        renderDashboardsGrid();
    } else if (tabName === 'calculator') {
        document.getElementById('npaImportButtons')?.classList.add('hidden');
        document.getElementById('dashboardsImportButtons')?.classList.add('hidden');
        document.getElementById('addButtonText').textContent = 'Новый расчет';
        document.getElementById('resetBtnText').textContent = 'Сброс калькулятора';
        currentTab = 'calculator';
        
        if (typeof initCalculator === 'function') {
            initCalculator();
        }
    }
    
    window.dispatchEvent(new CustomEvent('tabChanged', { detail: { tab: tabName } }));
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function showNotification(text, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
        type === 'success' ? 'bg-emerald-500 text-white' :
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'warning' ? 'bg-amber-500 text-white' :
        'bg-brand-600 text-white'
    }`;
    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="font-medium">${text}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-white/80">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function showLoadingIndicator(message) {
    hideLoadingIndicator();
    
    const indicator = document.createElement('div');
    indicator.id = 'github-loading-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.85);
        padding: 25px 35px;
        border-radius: 15px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 20px;
        border: 2px solid #0366d6;
        color: white;
        font-size: 16px;
        backdrop-filter: blur(10px);
    `;
    
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255,255,255,0.3);
        border-top: 4px solid #0366d6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    `;
    
    const text = document.createElement('span');
    text.textContent = message;
    text.style.color = 'white';
    text.style.fontWeight = '500';
    
    indicator.appendChild(spinner);
    indicator.appendChild(text);
    document.body.appendChild(indicator);
}

function hideLoadingIndicator() {
    const indicator = document.getElementById('github-loading-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function addGitHubLoadButton() {
    const controls = document.getElementById('controls');
    if (!controls) {
        setTimeout(addGitHubLoadButton, 500);
        return;
    }
    
    if (document.getElementById('githubLoadBtn')) {
        return;
    }
    
    const githubBtn = document.createElement('button');
    githubBtn.type = 'button';
    githubBtn.id = 'githubLoadBtn';
    githubBtn.textContent = 'Загрузить из GitHub';
    githubBtn.style.cssText = `
        margin-left: 10px;
        background: linear-gradient(145deg, #24292e, #0366d6);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: 500;
    `;
    
    githubBtn.addEventListener('click', async () => {
        await loadTreeFromGitHub();
    });
    
    const jsonImportBtn = document.getElementById('jsonImportBtn');
    if (jsonImportBtn) {
        jsonImportBtn.parentNode.insertBefore(githubBtn, jsonImportBtn.nextSibling);
    } else {
        controls.appendChild(githubBtn);
    }
    
    console.log('Кнопка GitHub добавлена');
}

// ============================================
// ЭКСПОРТ/ИМПОРТ JSON
// ============================================

function exportJson() {
    const allData = getCurrentCombinedJSON();
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `gko_all_data_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const json = JSON.parse(e.target.result);
                
                let confirmMessage = "Импортировать данные из файла?\n\n";
                
                if (json.npas && Array.isArray(json.npas)) {
                    confirmMessage += `✅ НПА: ${json.npas.length} записей\n`;
                }
                if (json.dashboards && Array.isArray(json.dashboards)) {
                    confirmMessage += `✅ Дашборды: ${json.dashboards.length} записей\n`;
                }
                if (json.tree) {
                    confirmMessage += `✅ Дерево: данные присутствуют\n`;
                }
                if (json.calculator) {
                    confirmMessage += `✅ Калькулятор: данные настроек\n`;
                }
                
                if (confirm(confirmMessage + "\nИмпортировать все данные?")) {
                    if (json.npas) {
                        appData = [...json.npas];
                        saveData();
                    }
                    
                    if (json.dashboards) {
                        dashboardsData = [...json.dashboards];
                        saveDashboardsData();
                    }
                    
                    if (json.tree && window.treeManager) {
                        await window.treeManager.importData({ tree: json.tree });
                    }
                    
                    if (json.calculator) {
                        localStorage.setItem(STORAGE_KEY_CALCULATOR, JSON.stringify(json.calculator));
                    }
                    
                    localStorage.setItem(STORAGE_KEY_ALL, JSON.stringify(json));
                    
                    alert("✅ Все данные успешно импортированы!");
                }
            } catch(e) {
                alert("Ошибка чтения JSON файла: " + e.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function hardResetCurrent() {
    if (currentTab === 'npas') {
        if(confirm("Восстановить начальные данные НПА? Все текущие записи будут удалены.")) { 
            localStorage.removeItem(STORAGE_KEY_NPA); 
            loadData();
        } 
    } else if (currentTab === 'dashboards') {
        if (confirm("Восстановить начальные данные дашбордов? Все текущие дашборды будут удалены.")) {
            localStorage.removeItem(STORAGE_KEY_DASHBOARDS);
            loadDashboardsData();
        }
    } else if (currentTab === 'calculator') {
        if (confirm("Очистить все данные калькулятора?")) {
            localStorage.removeItem(STORAGE_KEY_CALCULATOR);
            if (typeof initCalculator === 'function') {
                initCalculator();
            }
            showNotification('Данные калькулятора очищены', 'success');
        }
    } else if (currentTab === 'dio') {
        if (confirm("Очистить все данные дерева?")) {
            localStorage.removeItem(STORAGE_KEY_TREE);
            if (window.treeManager) {
                const emptyTree = {
                    id: 'root',
                    content: { text: 'Главный узел', isHorizontal: false },
                    children: [],
                    isExpanded: true
                };
                window.treeManager.treeData = emptyTree;
                window.treeManager.updateTree();
                window.treeManager.saveData();
            }
            showNotification('Данные дерева очищены', 'success');
        }
    }
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ main.js загружен, инициализация приложения...');
    
    // Создаем модалку GitHub
    createGitHubModal();
    
    // Загружаем данные
    loadData();
    loadDashboardsData();
    
    // Определяем вкладку из URL hash
    const urlHash = window.location.hash;
    if (urlHash === '#calculator') {
        setTimeout(() => switchTab('calculator'), 100);
    } else if (urlHash === '#dashboards') {
        setTimeout(() => switchTab('dashboards'), 100);
    } else if (urlHash === '#dio') {
        setTimeout(() => switchTab('dio'), 100);
    } else {
        setTimeout(() => switchTab('npas'), 100);
    }
    
    // Обработчик изменения hash
    window.addEventListener('hashchange', function() {
        const hash = window.location.hash.replace('#', '');
        if (['npas', 'dashboards', 'calculator', 'dio'].includes(hash)) {
            switchTab(hash);
        }
    });
});

// ============================================
// ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
// ============================================

// Функции дерева
window.initTreeInTab = initTreeInTab;
window.loadTreeFromGitHub = loadTreeFromGitHub;
window.saveTreeToGitHub = saveTreeToGitHub;

// Функции GitHub
window.showGitHubTokenModal = showGitHubTokenModal;
window.closeGitHubModal = closeGitHubModal;
window.saveToGitHub = saveToGitHub;
window.loadFromGitHub = loadFromGitHub;

// Функции переключения вкладок
window.switchTab = switchTab;
window.hardResetCurrent = hardResetCurrent;

// Функции экспорта/импорта
window.exportJson = exportJson;
window.importJson = importJson;

// Функции НПА
window.setDocFilter = setDocFilter;
window.setTypeFilter = setTypeFilter;
window.setTargetFilter = setTargetFilter;
window.resetAllFilters = resetAllFilters;
window.renderGrid = renderGrid;

// Функции дашбордов
window.setStatusFilterDashboards = setStatusFilterDashboards;
window.setTypeFilterDashboards = setTypeFilterDashboards;
window.setTagFilterDashboards = setTagFilterDashboards;
window.resetAllDashboardsFilters = resetAllDashboardsFilters;
window.renderDashboardsGrid = renderDashboardsGrid;

// Вспомогательные функции
window.showNotification = showNotification;
