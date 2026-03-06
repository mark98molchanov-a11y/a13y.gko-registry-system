// ==================== tree/tree-main-export.js (УПРОЩЕННАЯ ТЕСТОВАЯ ВЕРСИЯ) ====================

(function(global) {
  console.log('📦 Загрузка TreeAppWrapper (упрощенная тестовая версия)...');

  class TreeAppWrapper {
    constructor(containerId) {
      console.log('🔄 TreeAppWrapper конструктор, containerId:', containerId);
      this.containerId = containerId;
      this.initialized = false;
      
      // Сохраняем ссылку на глобальный экземпляр
      global.treeAppWrapperInstance = this;
    }

    async init() {
      console.log('🚀 TreeAppWrapper.init() вызван');
      
      const container = document.getElementById(this.containerId);
      if (!container) {
        console.error(`❌ Контейнер #${this.containerId} не найден`);
        throw new Error(`Контейнер #${this.containerId} не найден`);
      }

      console.log('✅ Контейнер найден:', container);

      // Показываем, что дерево загружено
      container.innerHTML = `
        <div style="
          padding: 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          color: white;
          font-family: 'Inter', sans-serif;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          animation: fadeIn 0.5s ease-out;
        ">
          <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
            <div style="
              width: 60px;
              height: 60px;
              background: rgba(255,255,255,0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 30px;
              backdrop-filter: blur(5px);
            ">
              🌳
            </div>
            <div>
              <h2 style="margin: 0; font-size: 24px; font-weight: bold;">
                TreeAppWrapper загружен!
              </h2>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">
                Тестовая версия работает успешно
              </p>
            </div>
          </div>
          
          <div style="
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(5px);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            font-family: monospace;
          ">
            <p><strong>Container ID:</strong> ${this.containerId}</p>
            <p><strong>Время загрузки:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>React:</strong> ${!!global.React ? '✅' : '❌'}</p>
            <p><strong>ReactDOM:</strong> ${!!global.ReactDOM ? '✅' : '❌'}</p>
            <p><strong>THREE:</strong> ${!!global.THREE ? '✅' : '❌'}</p>
          </div>
          
          <div style="display: flex; gap: 10px;">
            <button onclick="window.treeAppWrapperInstance.testExport()" style="
              padding: 12px 24px;
              background: white;
              color: #667eea;
              border: none;
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
              transition: transform 0.2s;
            ">
              Тест exportData()
            </button>
            <button onclick="console.log(window.treeAppWrapperInstance)" style="
              padding: 12px 24px;
              background: rgba(255,255,255,0.2);
              color: white;
              border: 2px solid rgba(255,255,255,0.3);
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
              transition: transform 0.2s;
            ">
              Показать экземпляр
            </button>
          </div>
        </div>
        
        <style>
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          button:hover {
            transform: translateY(-2px);
          }
          button:active {
            transform: translateY(0);
          }
        </style>
      `;

      this.initialized = true;
      console.log('✅ TreeAppWrapper инициализирован (тестовая версия)');
      
      return this;
    }

    testExport() {
      console.log('📤 testExport() вызван');
      const testData = {
        version: '1.0',
        timestamp: Date.now(),
        message: 'Тестовые данные от TreeAppWrapper',
        containerId: this.containerId
      };
      console.log('📄 Данные для экспорта:', testData);
      alert('✅ exportData() работает!\n\n' + JSON.stringify(testData, null, 2));
      return testData;
    }

    exportData() {
      return this.testExport();
    }

    importData(data) {
      console.log('📥 importData() вызван с данными:', data);
      alert('✅ importData() работает!\n\n' + JSON.stringify(data, null, 2));
      return true;
    }

    destroy() {
      console.log('🧹 destroy() вызван');
      
      // Очищаем контейнер
      if (this.appContainer) {
        this.appContainer.innerHTML = '';
      }
      
      // Удаляем глобальные ссылки
      if (global.treeAppWrapperInstance === this) {
        global.treeAppWrapperInstance = null;
      }
      
      this.initialized = false;
      console.log('✅ TreeAppWrapper уничтожен');
    }
  }

  // Экспортируем класс
  global.TreeAppWrapper = TreeAppWrapper;
  
  console.log('✅ TreeAppWrapper загружен (тестовая версия)');
  
  // Проверяем глобальные объекты
  console.log('📊 Проверка зависимостей:');
  console.log('  - React:', !!global.React);
  console.log('  - ReactDOM:', !!global.ReactDOM);
  console.log('  - THREE:', !!global.THREE);

})(window);
