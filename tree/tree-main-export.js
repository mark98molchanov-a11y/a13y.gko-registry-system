(function(global) {
  console.log('📦 Загрузка TreeAppWrapper...');

  // Проверяем наличие всех необходимых классов
  if (!global.TreeManager) {
    console.error('❌ TreeManager не загружен! Проверьте tree-manager-core.js');
  } else {
    console.log('✅ TreeManager найден');
  }

  class TreeAppWrapper {
    constructor(containerId) {
      console.log('🔄 TreeAppWrapper конструктор, containerId:', containerId);
      this.containerId = containerId;
      this.treeManager = null;
      this.nodeEffects = null;
      this.initialized = false;
      this.appContainer = null;
      
      // Сохраняем ссылку на глобальный экземпляр
      global.treeAppWrapperInstance = this;
    }

    async init() {
      console.log('🚀 TreeAppWrapper.init() вызван');
      
      this.appContainer = document.getElementById(this.containerId);
      if (!this.appContainer) {
        console.error(`❌ Контейнер с id "${this.containerId}" не найден`);
        this.appContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; color: #ef4444;">
            <h3>❌ Контейнер не найден</h3>
            <p>ID: ${this.containerId}</p>
          </div>
        `;
        return null;
      }

      console.log('📦 appContainer:', this.appContainer);

      // Проверяем наличие TreeManager
      if (!global.TreeManager) {
        console.error('❌ TreeManager не найден в глобальной области');
        this.appContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; background: white; border-radius: 8px; border: 2px solid #ef4444;">
            <h3 style="color: #ef4444; margin-bottom: 20px;">❌ TreeManager не загружен</h3>
            <p style="color: #666; margin-bottom: 20px;">Проверьте подключение tree-manager-core.js</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; text-align: left; font-family: monospace; font-size: 12px;">
              <p><strong>Проверка:</strong></p>
              <p>window.TreeManager: ${!!global.TreeManager}</p>
              <p>window.IndexedDBManager: ${!!global.IndexedDBManager}</p>
              <p>window.NodeEffects: ${!!global.NodeEffects}</p>
            </div>
          </div>
        `;
        throw new Error('TreeManager class not found');
      }

      try {
        // Создаем экземпляр TreeManager
        console.log('🔄 Создаем экземпляр TreeManager...');
        this.treeManager = new global.TreeManager();
        global.treeManager = this.treeManager;
        console.log('✅ Экземпляр treeManager создан');

        // Создаем NodeEffects
        if (global.NodeEffects) {
          this.nodeEffects = new global.NodeEffects();
          global.nodeEffects = this.nodeEffects;
          console.log('✅ NodeEffects создан');
        } else {
          console.warn('⚠️ NodeEffects не найден, создаем заглушку');
          global.NodeEffects = class NodeEffectsStub {
            constructor() { this.effects = new Set(); }
            addEffect() {}
            removeEffect() {}
          };
          this.nodeEffects = new global.NodeEffects();
        }

        // Инициализируем TreeManager
        if (this.treeManager.initialize) {
          console.log('🔄 Вызываем treeManager.initialize()');
          await this.treeManager.initialize();
        }

        // Показываем сообщение об успехе
        this.appContainer.innerHTML = `
          <div style="padding: 20px; background: #10b98120; border: 2px solid #10b981; border-radius: 8px;">
            <h3 style="color: #10b981;">✅ TreeManager успешно инициализирован!</h3>
            <p>Дерево готово к работе.</p>
          </div>
        `;

        this.initialized = true;
        console.log('✅ TreeAppWrapper успешно инициализирован');
        
        return this.treeManager;
      } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        this.appContainer.innerHTML = `
          <div style="padding: 40px; text-align: center; background: white; border-radius: 8px; border: 2px solid #ef4444;">
            <h3 style="color: #ef4444; margin-bottom: 20px;">❌ Ошибка: ${error.message}</h3>
            <p style="color: #666; margin-bottom: 20px;">Проверьте консоль для деталей</p>
            <button onclick="location.reload()" style="
              padding: 10px 20px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
            ">
              Перезагрузить
            </button>
          </div>
        `;
        throw error;
      }
    }

    exportData() {
      if (!this.treeManager) return null;
      try {
        if (this.treeManager.serializeTree && this.treeManager.treeData) {
          return {
            tree: this.treeManager.serializeTree(this.treeManager.treeData),
            clusters: this.treeManager.clusters ? Array.from(this.treeManager.clusters.entries()) : [],
            availableClusters: this.treeManager.availableClusters ? Array.from(this.treeManager.availableClusters) : [],
            nodeCounter: this.treeManager.nodeCounter,
            version: '2.8'
          };
        }
        const savedData = localStorage.getItem('treeData');
        return savedData ? JSON.parse(savedData) : null;
      } catch (error) {
        console.error('Ошибка экспорта:', error);
        return null;
      }
    }

    importData(treeData) {
      if (!this.treeManager) return false;
      try {
        if (this.treeManager.importData) {
          return this.treeManager.importData(treeData);
        }
        return false;
      } catch (error) {
        console.error('Ошибка импорта:', error);
        return false;
      }
    }

    destroy() {
      if (global.treeManager === this.treeManager) global.treeManager = null;
      if (global.treeAppWrapperInstance === this) global.treeAppWrapperInstance = null;
      this.treeManager = null;
      this.nodeEffects = null;
      this.initialized = false;
      console.log('TreeAppWrapper уничтожен');
    }
  }

  // Экспортируем класс
  global.TreeAppWrapper = TreeAppWrapper;
  console.log('✅ TreeAppWrapper загружен и готов к использованию');

})(window);
