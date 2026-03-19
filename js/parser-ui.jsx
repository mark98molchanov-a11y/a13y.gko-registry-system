// js/parser-ui.jsx

const { useState, useEffect } = React;

function ParserApp() {
    const [file, setFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parseResult, setParseResult] = useState(null);
    const [error, setError] = useState(null);
    const [parser] = useState(new window.DocumentParser());
    const [employeeCount, setEmployeeCount] = useState(0);

    // Загружаем количество сотрудников при монтировании
    useEffect(() => {
        if (window.treeApp) {
            const count = countEmployees(window.treeApp.treeData);
            setEmployeeCount(count);
        }
    }, []);

    const countEmployees = (node) => {
        let count = 0;
        const traverse = (n) => {
            if (n.children && n.children.length > 0 && 
                n.content && n.content.text && 
                n.content.text.match(/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/)) {
                count++;
            }
            n.children.forEach(traverse);
        };
        traverse(node);
        return count;
    };

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
            if (window.treeApp) {
                window.treeApp.updateTree();
                window.treeApp.saveData();
            }
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

    const handleAddAll = () => {
        let addedCount = 0;
        parseResult.authorities.forEach(auth => {
            if (auth.employeeId && !auth.isAdded) {
                const employee = parseResult.employees.find(e => e.id === auth.employeeId);
                if (employee && parser.addAuthorityToEmployee(employee.node, auth.text, auth.sourceDoc)) {
                    addedCount++;
                }
            }
        });

        if (addedCount > 0 && window.treeApp) {
            window.treeApp.updateTree();
            window.treeApp.saveData();
            
            setParseResult(prev => ({
                ...prev,
                authorities: prev.authorities.map(a => 
                    a.employeeId ? { ...a, isAdded: true } : a
                )
            }));
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-2 md:p-6">
            {/* Шапка */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Парсер приказов ДИО</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Загрузите приказ в формате DOCX или PDF для автоматического извлечения полномочий
                    </p>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-lg">
                    <span className="text-sm font-medium text-slate-600">Сотрудников в базе: </span>
                    <span className="text-xl font-bold text-brand-600">{employeeCount}</span>
                </div>
            </div>

            {/* Область загрузки */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 w-full">
                        <input 
                            type="file" 
                            accept=".docx,.pdf" 
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2.5 file:px-4
                                file:rounded-lg file:border-0
                                file:text-sm file:font-semibold
                                file:bg-brand-50 file:text-brand-700
                                hover:file:bg-brand-100
                                cursor-pointer"
                        />
                    </div>
                    <button 
                        onClick={handleParse}
                        disabled={!file || isParsing}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition shadow flex items-center gap-2 whitespace-nowrap ${
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
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Запустить парсинг
                            </>
                        )}
                    </button>
                </div>
                {error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm flex items-center gap-2">
                            <span>❌</span> {error}
                        </p>
                    </div>
                )}
                {file && !isParsing && !parseResult && (
                    <p className="text-xs text-slate-400 mt-2">
                        Выбран файл: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                )}
            </div>

            {/* Результаты парсинга */}
            {parseResult && (
                <div className="space-y-6">
                    {/* Метаданные документа */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Документ</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">📄</span>
                                <span className="font-medium">Номер:</span>
                                <span className="text-sm">{parseResult.documentMeta.docNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400">📅</span>
                                <span className="font-medium">Дата:</span>
                                <span className="text-sm">{parseResult.documentMeta.docDate || 'не указана'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Найденные сотрудники */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">Найденные сотрудники в Базе ДИО</h2>
                        <div className="flex flex-wrap gap-2">
                            {parseResult.employees.length > 0 ? (
                                parseResult.employees.map(emp => (
                                    <span key={emp.id} className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium border border-emerald-200 flex items-center gap-1">
                                        <span>✅</span> {emp.name}
                                    </span>
                                ))
                            ) : (
                                <p className="text-slate-400 text-sm py-2">Совпадений не найдено. Возможно, сотрудники еще не добавлены в структуру.</p>
                            )}
                        </div>
                    </div>

                    {/* Найденные полномочия */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-bold text-slate-500 uppercase">
                                Найденные полномочия ({parseResult.authorities.length})
                            </h2>
                            {parseResult.authorities.some(a => a.employeeId && !a.isAdded) && (
                                <button 
                                    onClick={handleAddAll}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                                >
                                    <span>➕</span> Добавить все найденные
                                </button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {parseResult.authorities.length > 0 ? (
                                parseResult.authorities.map((auth, index) => {
                                    const employee = parseResult.employees.find(e => e.id === auth.employeeId);
                                    return (
                                        <div key={index} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                                <div className="flex-1">
                                                    <p className="text-sm text-slate-800 mb-2">{auth.text}</p>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                                        {employee ? (
                                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                                                                <span>👤</span> {employee.name}
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                                                                <span>⚠️</span> Сотрудник не определен
                                                            </span>
                                                        )}
                                                        <span className="text-slate-400 flex items-center gap-1">
                                                            <span>📄</span> {auth.sourceDoc}
                                                        </span>
                                                    </div>
                                                </div>
                                                {employee && !auth.isAdded && (
                                                    <button 
                                                        onClick={() => handleAddToTree(auth, employee.node)}
                                                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition flex items-center gap-1 whitespace-nowrap"
                                                    >
                                                        <span>➕</span> Добавить в ДИО
                                                    </button>
                                                )}
                                                {auth.isAdded && (
                                                    <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-medium rounded-lg flex items-center gap-1">
                                                        <span>✓</span> Добавлено
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-center py-8 text-slate-400">
                                    Полномочий не найдено. Попробуйте другой файл.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Функция инициализации
function initParserTab(containerId) {
    console.log('🚀 Инициализация парсера в контейнере:', containerId);
    const container = document.getElementById(containerId);
    if (container) {
        const root = ReactDOM.createRoot(container);
        root.render(<ParserApp />);
    }
}

window.initParserTab = initParserTab;
