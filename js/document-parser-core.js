// js/document-parser-core.js

console.log('📄 Загрузка DocumentParser...');

if (typeof window.DocumentParser === 'undefined') {
    
    class DocumentParser {
        constructor() {
            this.parsedData = {
                tables: [],              // Найденные таблицы
                employees: new Set(),     // Упомянутые сотрудники
                documentMeta: {}          // Метаданные документа (номер, дата)
            };
            this.employeesFromTree = [];
            
            // Индексы для поиска
            this.fullNameIndex = new Map();     // Полное ФИО -> массив сотрудников
            this.lastNameIndex = new Map();     // Фамилия -> массив сотрудников
            this.shortNameIndex = new Map();    // "Иванов И.И." -> массив сотрудников
            this.initialsIndex = new Map();     // "Иванов И. И." -> массив сотрудников
            this.positionIndex = new Map();     // Должность (ключевые слова) -> массив сотрудников
        }

        /**
         * Загружает список ВСЕХ сотрудников из дерева и создает индексы
         */
        loadEmployeesFromTree() {
            if (!window.treeApp || !window.treeApp.treeData) {
                console.warn('Дерево не инициализировано');
                return [];
            }

            const employees = [];
            
            // Очищаем все индексы
            this.fullNameIndex.clear();
            this.lastNameIndex.clear();
            this.shortNameIndex.clear();
            this.initialsIndex.clear();
            this.positionIndex.clear();
            
            const findEmployees = (node) => {
                if (node.content && typeof node.content.text === 'string') {
                    const text = node.content.text;
                    
                    // Проверяем, является ли узел сотрудником (содержит ФИО)
                    const isFullName = /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/.test(text);
                    
                    if (isFullName) {
                        // Извлекаем должности из subBlocks
                        const positions = [];
                        if (node.content.subBlocks && Array.isArray(node.content.subBlocks)) {
                            node.content.subBlocks.forEach(block => {
                                if (typeof block === 'string') {
                                    positions.push(block);
                                }
                            });
                        }
                        
                        // Создаем объект сотрудника
                        const employee = {
                            id: node.id,
                            name: text,
                            shortName: this.getShortName(text),
                            lastName: text.split(' ')[0],
                            initials: this.getInitials(text),
                            positions: positions,
                            parentNames: this.getParentNames(node),
                            node: node
                        };
                        
                        employees.push(employee);
                        
                        // 1. Индексируем по полному ФИО
                        if (!this.fullNameIndex.has(text)) {
                            this.fullNameIndex.set(text, []);
                        }
                        this.fullNameIndex.get(text).push(employee);
                        
                        // 2. Индексируем по фамилии
                        const lastName = text.split(' ')[0];
                        if (!this.lastNameIndex.has(lastName)) {
                            this.lastNameIndex.set(lastName, []);
                        }
                        this.lastNameIndex.get(lastName).push(employee);
                        
                        // 3. Индексируем по короткому имени (Иванов И.И.)
                        const shortName = this.getShortName(text);
                        if (!this.shortNameIndex.has(shortName)) {
                            this.shortNameIndex.set(shortName, []);
                        }
                        this.shortNameIndex.get(shortName).push(employee);
                        
                        // 4. Индексируем по инициалам с пробелами (Иванов И. И.)
                        const initials = this.getInitials(text);
                        if (!this.initialsIndex.has(initials)) {
                            this.initialsIndex.set(initials, []);
                        }
                        this.initialsIndex.get(initials).push(employee);
                        
                        // 5. Индексируем по должностям
                        positions.forEach(position => {
                            // Разбиваем должность на ключевые слова
                            const words = position.toLowerCase().split(/[\s,.-]+/).filter(w => w && w.length > 2);
                            
                            words.forEach(word => {
                                if (!this.positionIndex.has(word)) {
                                    this.positionIndex.set(word, []);
                                }
                                this.positionIndex.get(word).push(employee);
                            });
                            
                            // Индексируем целые фразы
                            const phrases = [
                                'заместитель директора',
                                'начальник управления',
                                'начальник отдела',
                                'главный специалист',
                                'ведущий консультант',
                                'заведующий сектором',
                                'эксперт',
                                'аналитик',
                                'руководитель'
                            ];
                            
                            phrases.forEach(phrase => {
                                if (position.toLowerCase().includes(phrase)) {
                                    if (!this.positionIndex.has(phrase)) {
                                        this.positionIndex.set(phrase, []);
                                    }
                                    this.positionIndex.get(phrase).push(employee);
                                }
                            });
                        });
                    }
                }
                
                if (node.children) {
                    node.children.forEach(child => findEmployees(child));
                }
            };
            
            findEmployees(window.treeApp.treeData);
            this.employeesFromTree = employees;
            
            console.log('✅ Загружено сотрудников из дерева:', employees.length);
            console.log('📊 Индекс фамилий:', Array.from(this.lastNameIndex.keys()));
            console.log('📊 Индекс должностей:', Array.from(this.positionIndex.keys()));
            
            return employees;
        }

        /**
         * Находит ВСЕХ сотрудников, соответствующих тексту
         */
        findAllEmployeesByText(text) {
            if (!text) return [];
            
            const matchedEmployees = new Map(); // Используем Map для избежания дубликатов
            const textLower = text.toLowerCase();
            
            // 1. Поиск по фамилии (самый надежный)
            for (const [lastName, employees] of this.lastNameIndex) {
                if (textLower.includes(lastName.toLowerCase())) {
                    employees.forEach(emp => {
                        matchedEmployees.set(emp.id, emp);
                    });
                }
            }
            
            // 2. Поиск по полному ФИО
            for (const [fullName, employees] of this.fullNameIndex) {
                if (textLower.includes(fullName.toLowerCase())) {
                    employees.forEach(emp => {
                        matchedEmployees.set(emp.id, emp);
                    });
                }
            }
            
            // 3. Поиск по короткому имени (Иванов И.И.)
            for (const [shortName, employees] of this.shortNameIndex) {
                if (shortName && textLower.includes(shortName.toLowerCase())) {
                    employees.forEach(emp => {
                        matchedEmployees.set(emp.id, emp);
                    });
                }
            }
            
            // 4. Поиск по инициалам с пробелами (Иванов И. И.)
            for (const [initials, employees] of this.initialsIndex) {
                if (initials && textLower.includes(initials.toLowerCase())) {
                    employees.forEach(emp => {
                        matchedEmployees.set(emp.id, emp);
                    });
                }
            }
            
            // 5. Поиск по должности
            for (const [position, employees] of this.positionIndex) {
                if (textLower.includes(position)) {
                    employees.forEach(emp => {
                        matchedEmployees.set(emp.id, emp);
                    });
                }
            }
            
            return Array.from(matchedEmployees.values());
        }

        /**
         * Главная функция для запуска парсинга из файла - ЭТАП 1: извлечение таблиц
         */
        async parseDocument(file) {
            this.parsedData = { 
                tables: [], 
                employees: new Set(),
                documentMeta: {} 
            };
            let fullText = '';

            try {
                console.log('📄 Начинаем парсинг файла:', file.name);
                
                // 1. Извлечение текста
                if (file.name.endsWith('.docx')) {
                    fullText = await this.extractTextFromDocx(file);
                } else if (file.name.endsWith('.pdf')) {
                    fullText = await this.extractTextFromPdf(file);
                } else {
                    throw new Error('Неподдерживаемый формат файла. Используйте DOCX или PDF.');
                }

                console.log('📝 Извлечен текст (первые 500 символов):', fullText.substring(0, 500));

                // 2. Извлечение метаданных
                this.parsedData.documentMeta = this.extractDocumentMeta(fullText, file.name);

                // 3. Поиск табличных структур в тексте
                this.parsedData.tables = this.extractTables(fullText);

                // 4. Извлечение всех ФИО из таблиц
                this.extractEmployeesFromTables();

                console.log('✅ Парсинг завершен');
                console.log('📊 Найдено таблиц:', this.parsedData.tables.length);
                console.log('👥 Найдено сотрудников в таблицах:', this.parsedData.employees.size);

                return this.parsedData;

            } catch (error) {
                console.error('❌ Ошибка при парсинге документа:', error);
                throw error;
            }
        }

        /**
         * ЭТАП 2: Привязка табличных данных к сотрудникам из дерева
         */
        async bindTablesToEmployees(tables) {
            // Загружаем сотрудников из дерева, если еще не загружены
            if (this.employeesFromTree.length === 0) {
                this.loadEmployeesFromTree();
            }

            const boundTables = [];

            for (const table of tables) {
                const boundTable = {
                    ...table,
                    assignments: [] // Привязки для каждой строки
                };

                // Анализируем структуру таблицы, если еще не сделано
                if (!table.structure) {
                    table.structure = this.analyzeTableStructure(table);
                }

                // Для каждой строки таблицы ищем подходящих сотрудников
                table.rows.forEach((row, rowIndex) => {
                    const rowText = row.join(' ').toLowerCase();
                    const matchedEmployees = this.findAllEmployeesByText(rowText);
                    
                    boundTable.assignments.push({
                        rowIndex,
                        rowData: row,
                        matchedEmployees: matchedEmployees.map(emp => ({
                            id: emp.id,
                            name: emp.name,
                            confidence: this.calculateConfidence(emp, rowText)
                        })),
                        selectedEmployeeId: matchedEmployees.length > 0 ? matchedEmployees[0].id : null
                    });
                });

                boundTables.push(boundTable);
            }

            return boundTables;
        }

        /**
         * Анализирует структуру таблицы (определяет колонки)
         */
        analyzeTableStructure(table) {
            const structure = {
                hasNumber: false,      // Есть ли колонка с номером
                hasSystem: false,      // Есть ли колонка с системой
                hasDepartment: false,  // Есть ли колонка с отделом
                hasEmployee: false,    // Есть ли колонка с сотрудником
                columns: []
            };
            
            // Анализируем заголовки
            if (table.headers && table.headers.length > 0) {
                table.headers.forEach(header => {
                    const headerLower = header.toLowerCase();
                    
                    if (headerLower.includes('п/п') || headerLower.includes('№')) {
                        structure.hasNumber = true;
                        structure.columns.push('number');
                    }
                    if (headerLower.includes('систем') || headerLower.includes('подсистем')) {
                        structure.hasSystem = true;
                        structure.columns.push('system');
                    }
                    if (headerLower.includes('структурн') || headerLower.includes('подраздел')) {
                        structure.hasDepartment = true;
                        structure.columns.push('department');
                    }
                    if (headerLower.includes('ответствен') || headerLower.includes('исполнител')) {
                        structure.hasEmployee = true;
                        structure.columns.push('employee');
                    }
                });
            }
            
            return structure;
        }

        /**
         * Рассчитывает уверенность привязки
         */
        calculateConfidence(employee, text) {
            let confidence = 0;
            const textLower = text.toLowerCase();
            
            if (textLower.includes(employee.name.toLowerCase())) {
                confidence = 1.0; // Полное совпадение ФИО
            } else if (textLower.includes(employee.lastName.toLowerCase())) {
                confidence = 0.8; // Совпадение по фамилии
            } else if (employee.shortName && textLower.includes(employee.shortName.toLowerCase())) {
                confidence = 0.9; // Совпадение по короткому имени
            } else {
                // Проверяем по должностям
                employee.positions.forEach(position => {
                    if (textLower.includes(position.toLowerCase())) {
                        confidence = Math.max(confidence, 0.7);
                    }
                });
            }
            
            return confidence;
        }

        /**
         * Извлекает табличные структуры из текста
         */
        extractTables(text) {
            const tables = [];
            const lines = text.split('\n');
            
            let currentTable = null;
            let inTable = false;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Проверяем, похоже ли это на строку таблицы
                const isTableRow = line.includes('|') || line.includes('+---') || line.includes('+===');
                const isTableHeader = line.includes('п/п') || 
                                      line.includes('Системы') || 
                                      line.includes('Ответственное') ||
                                      line.includes('Ответственный');
                
                if (isTableRow || isTableHeader) {
                    if (!inTable) {
                        inTable = true;
                        currentTable = {
                            headers: [],
                            rows: [],
                            raw: []
                        };
                    }
                    currentTable.raw.push(line);
                    
                    // Пытаемся распарсить строку таблицы
                    if (line.includes('|')) {
                        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                        
                        if (currentTable.headers.length === 0 && 
                            (line.includes('п/п') || line.includes('№'))) {
                            currentTable.headers = cells;
                        } else {
                            currentTable.rows.push(cells);
                        }
                    }
                } else {
                    if (inTable && line === '') {
                        // Конец таблицы
                        if (currentTable && currentTable.rows.length > 0) {
                            // Анализируем структуру
                            currentTable.structure = this.analyzeTableStructure(currentTable);
                            tables.push(currentTable);
                        }
                        inTable = false;
                        currentTable = null;
                    }
                }
            }
            
            // Добавляем последнюю таблицу
            if (inTable && currentTable && currentTable.rows.length > 0) {
                currentTable.structure = this.analyzeTableStructure(currentTable);
                tables.push(currentTable);
            }
            
            return tables;
        }

        /**
         * Извлекает ФИО из таблиц
         */
        extractEmployeesFromTables() {
            const namePattern = /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/;
            
            this.parsedData.tables.forEach(table => {
                table.rows.forEach(row => {
                    row.forEach(cell => {
                        // Ищем ФИО в ячейках
                        const possibleNames = cell.split(/[,\n]/).map(part => part.trim());
                        possibleNames.forEach(name => {
                            if (namePattern.test(name)) {
                                this.parsedData.employees.add(name);
                            }
                        });
                        
                        // Ищем ФИО в скобках (замещающие)
                        const parenMatch = cell.match(/\(([^)]+)\)/g);
                        if (parenMatch) {
                            parenMatch.forEach(match => {
                                const innerText = match.replace(/[()]/g, '');
                                const names = innerText.split(/[,\n]/).map(n => n.trim());
                                names.forEach(name => {
                                    if (namePattern.test(name)) {
                                        this.parsedData.employees.add(name);
                                    }
                                });
                            });
                        }
                    });
                });
            });
        }

        /**
         * Получает названия родительских узлов (отделы)
         */
        getParentNames(node) {
            const names = [];
            let parent = this.findParent(window.treeApp.treeData, node.id);
            
            while (parent) {
                if (parent.content && parent.content.text) {
                    names.push(parent.content.text);
                }
                parent = this.findParent(window.treeApp.treeData, parent.id);
            }
            
            return names;
        }

        /**
         * Находит родителя узла
         */
        findParent(root, nodeId, parent = null) {
            if (root.id === nodeId) return parent;
            
            if (root.children) {
                for (const child of root.children) {
                    if (child.id === nodeId) return root;
                    const found = this.findParent(child, nodeId, root);
                    if (found) return found;
                }
            }
            return null;
        }

        /**
         * Преобразует полное ФИО в формат "Фамилия И.О."
         */
        getShortName(fullName) {
            if (!fullName) return '';
            const parts = fullName.split(' ');
            if (parts.length >= 3) {
                return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
            }
            return fullName;
        }

        /**
         * Преобразует полное ФИО в формат "Фамилия И.О." (с пробелами)
         */
        getInitials(fullName) {
            if (!fullName) return '';
            const parts = fullName.split(' ');
            if (parts.length >= 3) {
                return `${parts[0]} ${parts[1][0]}. ${parts[2][0]}.`;
            }
            return fullName;
        }

        // --- Методы для извлечения текста ---

        async extractTextFromDocx(file) {
            if (typeof mammoth === 'undefined') {
                throw new Error('Библиотека mammoth не загружена');
            }
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }

        async extractTextFromPdf(file) {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('Библиотека pdf.js не загружена');
            }
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }
            return fullText;
        }

        extractDocumentMeta(text, filename) {
            let docNumber = filename;
            const numberPatterns = [
                /приказ\s+от\s+\d{1,2}\.\d{1,2}\.\d{4}\s+№\s*(\d+)/i,
                /приказ\s+№\s*(\d+)/i,
                /№\s*(\d+)/i
            ];
            
            for (const pattern of numberPatterns) {
                const match = text.match(pattern);
                if (match && match[1]) {
                    docNumber = match[1];
                    break;
                }
            }

            let docDate = '';
            const datePatterns = [
                /(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})/,
                /от\s+(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i
            ];
            
            for (const pattern of datePatterns) {
                const match = text.match(pattern);
                if (match) {
                    if (match[2] && isNaN(match[2])) {
                        const months = {
                            'января': '01', 'февраля': '02', 'марта': '03', 'апреля': '04',
                            'мая': '05', 'июня': '06', 'июля': '07', 'августа': '08',
                            'сентября': '09', 'октября': '10', 'ноября': '11', 'декабря': '12'
                        };
                        docDate = `${match[1]}.${months[match[2].toLowerCase()]}.${match[3]}`;
                    } else {
                        docDate = match[0];
                    }
                    break;
                }
            }

            return { docNumber, docDate };
        }

        /**
         * Создает полномочие как дочерний узел для указанного сотрудника
         */
        addAuthorityToEmployee(employeeNode, authorityText, sourceDoc) {
            if (!employeeNode) return false;

            const newAuthorityNode = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                content: {
                    text: authorityText,
                    img: null,
                    hideIcon: false,
                    isTextOnly: true,
                    subBlocks: [`Основание: ${sourceDoc || 'не указано'}`],
                    isHorizontal: false,
                    metricBlocks: [],
                    isAuthority: true,
                    absent269: false,
                    isPower269: false,
                    isOKR: false,
                    isSubordinate: false,
                    isForAll: false,
                    isIndicator: false,
                    isOrganizationalEvent: false,
                    indicators: null,
                    files: [],
                    position: null
                },
                children: [],
                isExpanded: true
            };

            if (!employeeNode.children) {
                employeeNode.children = [];
            }
            employeeNode.children.push(newAuthorityNode);
            return true;
        }
    }

    window.DocumentParser = DocumentParser;
    console.log('✅ DocumentParser зарегистрирован');
    
} else {
    console.log('ℹ️ DocumentParser уже существует, используем существующий');
}
