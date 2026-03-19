// js/parser-ui.jsx

const { useState } = React;

function ParserApp() {
    const [file, setFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parseResult, setParseResult] = useState(null);
    const [error, setError] = useState(null);
    const [parser] = useState(new window.DocumentParser()); // Создаем экземпляр парсера

    const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setParseResult(null);
        }
    };

    const handleParse = async () => {
        if (!file) {
            setError('Пожалуйста, выберите файл.');
            return;
        }

        setIsParsing(true);
        setError(null);

        try {
            // Загружаем сотрудников из дерева перед парсингом
            parser.loadEmployeesFromTree();
            const result = await parser.parseDocument(file);
            setParseResult(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsParsing(false);
        }
    };

    const handleAddToTree = (authority, employeeNode) => {
        if (parser.addAuthorityToEmployee(employeeNode, authority.text, authority.sourceDoc)) {
            // Обновляем дерево и сохраняем
            if (window.treeApp) {
                window.treeApp.updateTree();
                window.treeApp.saveData();
            }
            // Меняем состояние, чтобы кнопка "Добавить" исчезла или задизейблилась
            setParseResult(prev => ({
                ...prev,
                authorities: prev.authorities.map(a => 
                    a.text === authority.text && a.employeeId === authority.employeeId 
                    ? { ...a, isAdded: true } 
                    : a
                )
            }));
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-2 md:p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Парсер приказов ДИО</h1>
            
            {/* Область загрузки */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="flex items-center gap-4">
                    <input 
                        type="file" 
                        accept=".docx,.pdf" 
                        onChange={handleFileChange}
                        className="block w-full text-sm text-slate-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-semibold
                            file:bg-brand-50 file:text-brand-700
                            hover:file:bg-brand-100"
                    />
                    <button 
                        onClick={handleParse}
                        disabled={!file || isParsing}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition shadow flex items-center gap-2 ${
                            !file || isParsing 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-brand-600 hover:bg-brand-700 text-white'
                        }`}
                    >
                        {isParsing ? (
                            <>
                                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                                Парсинг...
                            </>
                        ) : (
                            'Запустить парсинг'
                        )}
                    </button>
                </div>
                {error && <p className="text-red-500 text-sm mt-2">❌ {error}</p>}
            </div>

            {/* Результаты парсинга */}
            {parseResult && (
                <div className="space-y-6">
                    {/* Метаданные документа */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h2 className="text-sm font-bold text-slate-500 uppercase mb-2">Документ</h2>
                        <p><span className="font-medium">Номер:</span> {parseResult.documentMeta.docNumber}</p>
                        <p><span className="font-medium">Дата:</span> {parseResult.documentMeta.docDate || 'не указана'}</p>
                    </div>

                    {/* Найденные сотрудники */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-3">Найденные сотрудники в Базе ДИО</h2>
                        <div className="flex flex-wrap gap-2">
                            {parseResult.employees.length > 0 ? parseResult.employees.map(emp => (
                                <span key={emp.id} className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium border border-emerald-200">
                                    ✅ {emp.name}
                                </span>
                            )) : <p className="text-slate-400">Совпадений не найдено.</p>}
                        </div>
                    </div>

                    {/* Найденные полномочия */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 mb-3">Найденные полномочия ({parseResult.authorities.length})</h2>
                        <div className="grid grid-cols-1 gap-4">
                            {parseResult.authorities.map((auth, index) => {
                                const employee = parseResult.employees.find(e => e.id === auth.employeeId);
                                return (
                                    <div key={index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm text-slate-800 mb-1">{auth.text}</p>
                                            <div className="flex items-center gap-2 text-xs">
                                                {employee ? (
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                                        👤 {employee.name}
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                                                        ⚠️ Сотрудник не определен
                                                    </span>
                                                )}
                                                <span className="text-slate-400">📄 {auth.sourceDoc}</span>
                                            </div>
                                        </div>
                                        {employee && !auth.isAdded && (
                                            <button 
                                                onClick={() => handleAddToTree(auth, employee.node)}
                                                className="px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition flex items-center gap-1"
                                            >
                                                ➕ Добавить в ДИО
                                            </button>
                                        )}
                                        {auth.isAdded && (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-lg">
                                                ✓ Добавлено
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Функция для инициализации
function initParserTab(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        const root = ReactDOM.createRoot(container);
        root.render(<ParserApp />);
    }
}

window.initParserTab = initParserTab;
