// ==================== tree/tree-main-export.js ====================

(function(global) {
  /**
   * Класс-обертка для приложения дерева
   * Позволяет инициализировать дерево внутри указанного контейнера
   */
  class TreeAppWrapper {
    constructor(containerId) {
      this.containerId = containerId;
      this.treeManager = null;
      this.nodeEffects = null;
      this.initialized = false;
      this.appContainer = null;
      
      // Сохраняем ссылку на глобальный экземпляр для внешнего доступа
      global.treeAppWrapperInstance = this;
    }

    /**
     * Инициализация приложения дерева
     */
    async init() {
      if (this.initialized) {
        console.warn('TreeApp уже инициализирован');
        return this.treeManager;
      }

      this.appContainer = document.getElementById(this.containerId);
      if (!this.appContainer) {
        console.error(`Контейнер с id "${this.containerId}" не найден`);
        return null;
      }

      console.log('🚀 Инициализация дерева внутри вкладки...');

      // --- ЗАЩИТА ОТ ОШИБОК (из оригинального main.js) ---
      this._setupErrorProtection();

      try {
        // Создаем и инициализируем TreeManager
        await this._initializeTreeManager();
        
        // Создаем NodeEffects
        this._initializeNodeEffects();
        
        // Перенастраиваем привязку элементов к DOM внутри нашего контейнера
        this._rebindElements();
        
        // Запускаем TreeManager
        await this._startTreeManager();
        
        this.initialized = true;
        console.log('✅ TreeAppWrapper успешно инициализирован');
        
        return this.treeManager;
      } catch (error) {
        console.error('❌ Критическая ошибка инициализации дерева:', error);
        this._createFallbackInterface();
        throw error;
      }
    }

    /**
     * Настройка защиты от ошибок (из оригинального main.js)
     */
    _setupErrorProtection() {
      // Глобальная защита от ошибок bind
      if (!Function.prototype._bind) {
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
      }

      // Обработчик ошибок для Three.js
      const threeJSErrorHandler = (e) => {
        if (e.message.includes('THREE') || e.message.includes('WebGL')) {
          console.warn('Three.js ошибка, отключаем эффекты:', e.message);
          e.preventDefault();
        }
      };
      global.addEventListener('error', threeJSErrorHandler);
      
      // Сохраняем ссылку для возможного удаления
      this._threeJSErrorHandler = threeJSErrorHandler;
    }

    /**
     * Инициализация TreeManager (адаптировано из initializeTreeManager)
     */
    async _initializeTreeManager() {
      console.log('=== ИНИЦИАЛИЗАЦИЯ TREE MANAGER ===');
      
      // Проверяем наличие класса TreeManager
      const TreeManagerClass = global.TreeManager || global.window?.TreeManager;
      if (typeof TreeManagerClass !== 'function') {
        throw new Error('TreeManager class not found');
      }
      
      console.log('TreeManager класс найден');
      
      // Патчим прототип TreeManager (как в оригинале)
      this._patchTreeManagerPrototype(TreeManagerClass);
      
      // Создаем экземпляр
      this.treeManager = new TreeManagerClass();
      global.treeManager = this.treeManager; // Для обратной совместимости
      console.log('✅ Экземпляр treeManager создан');
      
      // Патчим отсутствующие методы в экземпляре
      this._patchTreeManagerInstance();
    }

    /**
     * Патчинг прототипа TreeManager (из оригинального main.js)
     */
    _patchTreeManagerPrototype(TreeManagerClass) {
      if (!TreeManagerClass.prototype) return;
      
      // handleDragOver
      if (!TreeManagerClass.prototype.handleDragOver) {
        TreeManagerClass.prototype.handleDragOver = function(e) {
          e.preventDefault();
          if (this.dropIndicator && e.dataTransfer?.types?.includes('application/x-tree-node')) {
            this.dropIndicator.style.display = 'block';
            this.dropIndicator.style.left = e.clientX + 'px';
            this.dropIndicator.style.top = e.clientY + 'px';
            this.dropIndicator.style.width = '100px';
            this.dropIndicator.style.height = '100px';
          }
        };
      }
      
      // handleDrop
      if (!TreeManagerClass.prototype.handleDrop) {
        TreeManagerClass.prototype.handleDrop = function(e) {
          e.preventDefault();
          if (this.dropIndicator) {
            this.dropIndicator.style.display = 'none';
          }
          console.log('handleDrop заглушка');
        };
      }
      
      // handleDragEnd
      if (!TreeManagerClass.prototype.handleDragEnd) {
        TreeManagerClass.prototype.handleDragEnd = function(e) {
          if (this.dropIndicator) {
            this.dropIndicator.style.display = 'none';
          }
          console.log('handleDragEnd заглушка');
        };
      }
      
      // restoreTree
      if (!TreeManagerClass.prototype.restoreTree) {
        TreeManagerClass.prototype.restoreTree = function(treeData) {
          return treeData || { id: 'root', content: {}, children: [] };
        };
      }
      
      // Патчим setupDragAndDrop
      if (TreeManagerClass.prototype.setupDragAndDrop) {
        const originalSetupDragAndDrop = TreeManagerClass.prototype.setupDragAndDrop;
        TreeManagerClass.prototype.setupDragAndDrop = function() {
          try {
            return originalSetupDragAndDrop.call(this);
          } catch (error) {
            console.warn('Ошибка в setupDragAndDrop перехвачена:', error.message);
            return null;
          }
        };
      }
      
      // Патчим importData
      if (TreeManagerClass.prototype.importData) {
        const originalImportData = TreeManagerClass.prototype.importData;
        TreeManagerClass.prototype.importData = function(data) {
          try {
            return originalImportData.call(this, data);
          } catch (error) {
            console.warn('Ошибка в importData перехвачена:', error.message);
            if (data?.tree) {
              this.treeData = data.tree;
            }
            return false;
          }
        };
      }
      
      // Добавляем showNotification
      if (!TreeManagerClass.prototype.showNotification) {
        TreeManagerClass.prototype.showNotification = function(message, type = 'info') {
          console.log(`TreeManager notification [${type}]:`, message);
          if (global.showNotification) {
            global.showNotification(message, type);
          }
        };
      }
    }

    /**
     * Патчинг методов экземпляра TreeManager
     */
    _patchTreeManagerInstance() {
      if (!this.treeManager) return;
      
      // processOperationQueue
      if (!this.treeManager.processOperationQueue) {
        this.treeManager.processOperationQueue = () => {
          console.log('processOperationQueue заглушка');
        };
      }
      
      // loadFromLocalStorageFallback
      if (!this.treeManager.loadFromLocalStorageFallback) {
        this.treeManager.loadFromLocalStorageFallback = async () => {
          try {
            const savedData = localStorage.getItem('treeData');
            if (savedData && this.treeManager.importData) {
              const data = JSON.parse(savedData);
              await this.treeManager.importData(data);
            }
          } catch (error) {
            console.error('Ошибка загрузки из localStorage:', error);
          }
        };
      }
      
      // saveToHistory
      if (!this.treeManager.saveToHistory) {
        this.treeManager.saveToHistory = (isInitialState = false) => {
          console.log('saveToHistory заглушка', { isInitialState });
        };
      }
    }

    /**
     * Инициализация NodeEffects
     */
    _initializeNodeEffects() {
      const NodeEffectsClass = global.NodeEffects || global.window?.NodeEffects;
      
      if (typeof NodeEffectsClass !== 'function') {
        console.warn('NodeEffects не найден, создаем заглушку');
        global.NodeEffects = class NodeEffectsStub {
          constructor() { 
            console.log('NodeEffects заглушка создана'); 
            this.effects = new Set();
          }
          addEffect(element, type) {
            if (element && !this.effects.has(element)) {
              this.effects.add(element);
            }
          }
          removeEffect(element, type) {
            if (this.effects.has(element)) {
              this.effects.delete(element);
            }
          }
        };
        this.nodeEffects = new global.NodeEffects();
      } else {
        this.nodeEffects = new NodeEffectsClass();
      }
      
      global.nodeEffects = this.nodeEffects;
      console.log('✅ NodeEffects создан');
    }

    /**
     * Перенастройка привязки элементов к DOM внутри нашего контейнера
     */
    _rebindElements() {
      if (!this.treeManager || !this.treeManager.bindElements) {
        console.warn('treeManager.bindElements не найден, создаем свою привязку');
        this._createCustomElementBinding();
        return;
      }
      
      // Сохраняем оригинальный метод
      const originalBindElements = this.treeManager.bindElements;
      
      // Переопределяем
      this.treeManager.bindElements = () => {
        // Ищем элементы внутри нашего контейнера
        const container = this.appContainer;
        
        this.treeManager.elements = {
          jsonExportBtn: container.querySelector('#treeJsonExportBtn'),
          searchInput: container.querySelector('#treeSearchInput'),
          jsonImportBtn: container.querySelector('#treeJsonImportBtn'),
          collapseAllBtn: container.querySelector('#treeCollapseAllBtn'),
          saveBtn: container.querySelector('#treeSaveBtn'),
          themeSwitch: container.querySelector('#treeThemeSwitch'),
          dropZone: container.querySelector('#treeDropZone'),
          treeContainer: container.querySelector('#treeCanvas'),
          previewContainer: container.querySelector('#treePreviewContainer'),
          fullPreview: container.querySelector('#treeFullPreview'),
          toggleControls: container.querySelector('#treeToggleControls'),
          zoomResetBtn: container.querySelector('#treeZoomResetBtn'),
          zoomInBtn: container.querySelector('#treeZoomInBtn'),
          zoomOutBtn: container.querySelector('#treeZoomOutBtn'),
          controls: container.querySelector('#treeControls'),
          clusterSelect: container.querySelector('#treeClusterSelect'),
          addToClusterBtn: container.querySelector('#treeAddToClusterBtn')
        };
        
        console.log('TreeManager элементы перепривязаны к контейнеру вкладки', this.treeManager.elements);
      };
      
      // Вызываем привязку
      this.treeManager.bindElements();
    }

    /**
     * Создание кастомной привязки элементов, если bindElements не существует
     */
    _createCustomElementBinding() {
      if (!this.treeManager) return;
      
      const container = this.appContainer;
      
      this.treeManager.elements = {
        jsonExportBtn: container.querySelector('#treeJsonExportBtn'),
        searchInput: container.querySelector('#treeSearchInput'),
        jsonImportBtn: container.querySelector('#treeJsonImportBtn'),
        collapseAllBtn: container.querySelector('#treeCollapseAllBtn'),
        saveBtn: container.querySelector('#treeSaveBtn'),
        themeSwitch: container.querySelector('#treeThemeSwitch'),
        dropZone: container.querySelector('#treeDropZone'),
        treeContainer: container.querySelector('#treeCanvas'),
        previewContainer: container.querySelector('#treePreviewContainer'),
        fullPreview: container.querySelector('#treeFullPreview'),
        toggleControls: container.querySelector('#treeToggleControls'),
        zoomResetBtn: container.querySelector('#treeZoomResetBtn'),
        zoomInBtn: container.querySelector('#treeZoomInBtn'),
        zoomOutBtn: container.querySelector('#treeZoomOutBtn'),
        controls: container.querySelector('#treeControls'),
        clusterSelect: container.querySelector('#treeClusterSelect'),
        addToClusterBtn: container.querySelector('#treeAddToClusterBtn')
      };
      
      console.log('Создана кастомная привязка элементов', this.treeManager.elements);
    }

    /**
     * Запуск TreeManager
     */
    async _startTreeManager() {
      if (!this.treeManager) return;
      
      // Инициализация
      if (this.treeManager.initialize && typeof this.treeManager.initialize === 'function') {
        await this.treeManager.initialize();
      } else if (this.treeManager.init && typeof this.treeManager.init === 'function') {
        await this.treeManager.init();
      } else if (this.treeManager.asyncInit && typeof this.treeManager.asyncInit === 'function') {
        await this.treeManager.asyncInit();
      } else {
        console.warn('TreeManager не имеет методов инициализации');
      }
      
      // Обновляем дерево
      if (this.treeManager.updateTree) {
        this.treeManager.updateTree();
      }
      
      console.log('✅ TreeManager запущен');
    }

    /**
     * Создание fallback интерфейса при ошибке
     */
    _createFallbackInterface() {
      if (!this.appContainer) return;
      
      this.appContainer.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #2F4F4F;">
          <h2>Tree Manager</h2>
          <p>Приложение загружено в упрощенном режиме.</p>
          <div id="fallback-tree" style="margin-top: 20px;"></div>
        </div>
      `;
    }

    /**
     * Экспорт данных дерева для интеграции с общим JSON
     */
    exportData() {
      if (!this.treeManager) return null;
      
      try {
        // Пробуем использовать встроенный метод сериализации
        if (this.treeManager.serializeTree && this.treeManager.treeData) {
          return {
            tree: this.treeManager.serializeTree(this.treeManager.treeData),
            clusters: this.treeManager.clusters ? Array.from(this.treeManager.clusters.entries()) : [],
            availableClusters: this.treeManager.availableClusters ? Array.from(this.treeManager.availableClusters) : [],
            nodeCounter: this.treeManager.nodeCounter,
            version: '2.8'
          };
        }
        
        // Запасной вариант: читаем из localStorage
        const savedData = localStorage.getItem('treeData');
        if (savedData) {
          return JSON.parse(savedData);
        }
        
        return null;
      } catch (error) {
        console.error('Ошибка экспорта данных дерева:', error);
        return null;
      }
    }

    /**
     * Импорт данных дерева из общего JSON
     */
    importData(treeData) {
      if (!this.treeManager) return false;
      
      try {
        // Подготавливаем данные в формате, понятном TreeManager
        const importData = {
          tree: treeData.tree || treeData,
          clusters: treeData.clusters || [],
          availableClusters: treeData.availableClusters || [],
          settings: {
            nodeCounter: treeData.nodeCounter || 1
          }
        };
        
        // Используем метод импорта TreeManager
        if (this.treeManager.importData && typeof this.treeManager.importData === 'function') {
          const result = this.treeManager.importData(importData);
          
          // Сохраняем в localStorage для постоянства
          this._saveToLocalStorage(treeData);
          
          return result !== false;
        } else {
          // Прямое присвоение данных
          if (this.treeManager.treeData) {
            this.treeManager.treeData = treeData.tree || treeData;
            
            if (treeData.clusters && this.treeManager.clusters) {
              this.treeManager.clusters = new Map(treeData.clusters);
            }
            
            if (treeData.availableClusters && this.treeManager.availableClusters) {
              this.treeManager.availableClusters = new Set(treeData.availableClusters);
            }
            
            if (treeData.nodeCounter && this.treeManager.nodeCounter) {
              this.treeManager.nodeCounter = treeData.nodeCounter;
            }
            
            this._saveToLocalStorage(treeData);
            
            if (this.treeManager.updateTree) {
              this.treeManager.updateTree();
            }
            
            return true;
          }
        }
        
        return false;
      } catch (error) {
        console.error('Ошибка импорта данных дерева:', error);
        return false;
      }
    }

    /**
     * Сохранение данных в localStorage
     */
    _saveToLocalStorage(treeData) {
      try {
        const dataToSave = {
          tree: treeData.tree || treeData,
          clusters: treeData.clusters || [],
          availableClusters: treeData.availableClusters || [],
          settings: {
            nodeCounter: treeData.nodeCounter || 1
          },
          timestamp: Date.now()
        };
        
        localStorage.setItem('treeData', JSON.stringify(dataToSave));
      } catch (error) {
        console.warn('Не удалось сохранить в localStorage:', error);
      }
    }

    /**
     * Очистка ресурсов при уничтожении компонента
     */
    destroy() {
      // Удаляем глобальные ссылки
      if (global.treeManager === this.treeManager) {
        global.treeManager = null;
      }
      
      if (global.nodeEffects === this.nodeEffects) {
        global.nodeEffects = null;
      }
      
      if (global.treeAppWrapperInstance === this) {
        global.treeAppWrapperInstance = null;
      }
      
      // Удаляем обработчик ошибок Three.js
      if (this._threeJSErrorHandler) {
        global.removeEventListener('error', this._threeJSErrorHandler);
      }
      
      // Очищаем контейнер
      if (this.appContainer) {
        this.appContainer.innerHTML = '';
      }
      
      this.treeManager = null;
      this.nodeEffects = null;
      this.initialized = false;
      
      console.log('TreeAppWrapper уничтожен');
    }
  }

  // Экспортируем класс в глобальную область видимости
  global.TreeAppWrapper = TreeAppWrapper;
  
  console.log('✅ TreeAppWrapper загружен и готов к использованию');

})(window);
