// ==================== components/TreeTab.jsx ====================

(function(global) {
  // Проверяем, что React доступен
  if (!global.React || !global.ReactDOM) {
    console.error('❌ React или ReactDOM не загружены!');
    return;
  }

  const { useEffect, useRef } = global.React;

  function TreeTab() {
    const containerRef = useRef(null);
    const treeAppRef = useRef(null);

    useEffect(() => {
      console.log('🌳 TreeTab монтируется...');
      console.log('window.TreeAppWrapper:', global.TreeAppWrapper);

      // Функция инициализации дерева
      const initTree = async () => {
        // Проверяем наличие контейнера
        if (!containerRef.current) {
          console.error('❌ Контейнер дерева не найден');
          return;
        }

        // Проверяем наличие TreeAppWrapper
        if (!global.TreeAppWrapper) {
          console.error('❌ TreeAppWrapper не загружен!');
          containerRef.current.innerHTML = `
            <div style="padding: 40px; text-align: center; background: white; border-radius: 8px; border: 2px solid red;">
              <h3 style="color: red;">❌ TreeAppWrapper не загружен</h3>
              <p>Проверьте подключение скриптов в index.html</p>
              <p style="font-family: monospace; background: #f0f0f0; padding: 10px; margin-top: 10px;">
                Должны быть подключены:<br>
                - tree/tree-manager-core.js<br>
                - tree/indexed-db-manager.js<br>
                - tree/node-effects.js<br>
                - tree/tree-main-export.js
              </p>
            </div>
          `;
          return;
        }

        try {
          console.log('🚀 Создаем экземпляр TreeAppWrapper...');
          
          // Очищаем контейнер
          containerRef.current.innerHTML = '';

          // Создаем HTML структуру для дерева
          const treeContainer = document.createElement('div');
          treeContainer.id = 'tree-canvas-container';
          treeContainer.style.width = '100%';
          treeContainer.style.minHeight = '70vh';
          treeContainer.style.position = 'relative';
          treeContainer.style.background = '#ffffff';
          treeContainer.style.border = '1px solid #e2e8f0';
          treeContainer.style.borderRadius = '8px';
          treeContainer.style.padding = '10px';
          
          containerRef.current.appendChild(treeContainer);

          // Создаем экземпляр приложения
          const treeApp = new global.TreeAppWrapper('tree-canvas-container');
          
          // Сохраняем ссылку для доступа из других частей приложения
          global.treeAppWrapperInstance = treeApp;
          treeAppRef.current = treeApp;

          // Инициализируем
          await treeApp.init();
          console.log('✅ TreeAppWrapper успешно инициализирован');

        } catch (error) {
          console.error('❌ Ошибка инициализации дерева:', error);
          if (containerRef.current) {
            containerRef.current.innerHTML = `
              <div style="padding: 40px; text-align: center; background: white; border-radius: 8px; border: 2px solid red;">
                <h3 style="color: red;">❌ Ошибка загрузки дерева</h3>
                <p style="color: #666;">${error.message}</p>
                <button onclick="window.location.reload()" style="
                  padding: 10px 20px;
                  background: #0284c7;
                  color: white;
                  border: none;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 14px;
                  margin-top: 10px;
                ">
                  Перезагрузить
                </button>
              </div>
            `;
          }
        }
      };

      initTree();

      // Очистка при размонтировании
      return () => {
        console.log('🧹 Очистка TreeTab...');
        if (treeAppRef.current && treeAppRef.current.destroy) {
          treeAppRef.current.destroy();
        }
        if (global.treeAppWrapperInstance === treeAppRef.current) {
          global.treeAppWrapperInstance = null;
        }
        treeAppRef.current = null;
      };
    }, []);

    return React.createElement('div', {
      ref: containerRef,
      style: {
        width: '100%',
        minHeight: '70vh',
        position: 'relative'
      }
    });
  }

  // Экспортируем компонент в глобальную область
  global.TreeTab = TreeTab;
  
  console.log('✅ TreeTab компонент загружен');

})(window);
