// ==================== components/TreeTab.jsx ====================

const { useEffect, useRef } = React;

function TreeTab() {
  const treeContainerRef = useRef(null);
  const treeAppRef = useRef(null);

  useEffect(() => {
    // Функция для инициализации дерева
    const initTree = async () => {
      if (!window.TreeAppWrapper) {
        console.error('TreeAppWrapper не загружен!');
        return;
      }

      // Создаем экземпляр приложения дерева, передавая ID контейнера
      const treeApp = new window.TreeAppWrapper('tree-canvas-container');
      await treeApp.init();
      treeAppRef.current = treeApp;
    };

    initTree();

    // Функция очистки при размонтировании компонента
    return () => {
      if (treeAppRef.current) {
        treeAppRef.current.destroy();
        treeAppRef.current = null;
      }
    };
  }, []); // Пустой массив зависимостей означает, что эффект выполнится один раз при монтировании

  return (
    <div className="flex-grow w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Панель управления для дерева (можно сделать свою или использовать ту, что встроена в TreeManager) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          id="treeSearchInput"
          placeholder="Поиск..."
          className="pl-10 pr-4 py-2 border border-slate-200 bg-slate-50 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none"
        />
        <button id="treeSaveBtn" className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow">
          💾 Сохранить
        </button>
        <button id="treeCollapseAllBtn" className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm">
          Свернуть все
        </button>
        {/* Можно добавить и другие кнопки управления, но они уже есть в самом дереве */}
      </div>

      {/* Основной контейнер для дерева. TreeManager будет искать внутри него элементы по ID */}
      <div
        id="tree-canvas-container"
        ref={treeContainerRef}
        className="tree-container bg-white rounded-xl border border-slate-200 shadow-sm p-4"
        style={{ minHeight: '70vh', overflow: 'auto', position: 'relative' }}
      >
        {/* Сам TreeManager отрендерит сюда дерево */}
      </div>
    </div>
  );
}

// Не забываем сделать компонент доступным глобально, если он не в модульной системе
window.TreeTab = TreeTab;
