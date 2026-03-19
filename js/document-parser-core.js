// js/document-parser-core.js

console.log('📄 Загрузка DocumentParser...');

// Проверяем, не объявлен ли уже класс
if (typeof window.DocumentParser === 'undefined') {
    
    class DocumentParser {
        constructor() {
            this.parsedData = {
                employees: [],      // Найденные сотрудники
                authorities: [],    // Найденные полномочия
                documentMeta: {}    // Метаданные документа (номер, дата)
            };
            this.employeesFromTree = [];
            this.positionMap = new Map();
            this.orderMap = new Map(); 
        }

      loadEmployeesFromTree() {
    if (!window.treeApp || !window.treeApp.treeData) {
        console.warn('Дерево не инициализировано');
        return [];
    }

    const employees = [];
    this.positionMap.clear();
    this.orderMap.clear(); // Очищаем карту приказов
    
    const findEmployees = (node) => {
        // Проверяем, является ли узел сотрудником (содержит ФИО)
        if (node.content && typeof node.content.text === 'string') {
            const text = node.content.text;
            const isFullName = /^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/.test(text);
            
            if (isFullName) {
                // Извлекаем должности из subBlocks
                const positions = [];
                const orders = []; // Номера приказов
                
                if (node.content.subBlocks && Array.isArray(node.content.subBlocks)) {
                    node.content.subBlocks.forEach(block => {
                        if (typeof block === 'string') {
                            positions.push(block);
                            
                            // Ищем номера приказов в subBlocks
                            const orderMatch = block.match(/приказ[а-я]*\s*[№#]?\s*(\d+)/i) || 
                                              block.match(/(\d+)\s*[-\/]?[А-Я]/);
                            if (orderMatch && orderMatch[1]) {
                                orders.push(orderMatch[1]);
                            }
                            
                            // Индексируем по должности
                            const lowerBlock = block.toLowerCase();
                            this.indexByPosition(lowerBlock, {
                                id: node.id,
                                name: text,
                                node: node,
                                positions: positions
                            });
                        }
                    });
                }
                
                // Также ищем в дочерних узлах (полномочиях)
                if (node.children) {
                    node.children.forEach(child => {
                        if (child.content && child.content.subBlocks) {
                            child.content.subBlocks.forEach(block => {
                                if (typeof block === 'string') {
                                    // Ищем номера приказов в полномочиях
                                    const orderMatch = block.match(/приказ[а-я]*\s*[№#]?\s*(\d+)/i) || 
                                                      block.match(/(\d+)\s*[-\/]?[А-Я]/);
                                    if (orderMatch && orderMatch[1]) {
                                        orders.push(orderMatch[1]);
                                    }
                                }
                            });
                        }
                    });
                }
                
                // Индексируем по номерам приказов
                orders.forEach(orderNum => {
                    if (!this.orderMap.has(orderNum)) {
                        this.orderMap.set(orderNum, []);
                    }
                    this.orderMap.get(orderNum).push({
                        id: node.id,
                        name: text,
                        node: node,
                        positions: positions
                    });
                });
                
                // Также индексируем по названию отдела/родительским узлам
                const parentNames = this.getParentNames(node);
                parentNames.forEach(parentName => {
                    this.indexByPosition(parentName.toLowerCase(), {
                        id: node.id,
                        name: text,
                        node: node,
                        positions: positions
                    });
                });
                
                employees.push({
                    id: node.id,
                    name: text,
                    shortName: this.getShortName(text),
                    lastName: text.split(' ')[0],
                    initials: this.getInitials(text),
                    positions: positions,
                    orders: orders, // Добавляем найденные приказы
                    parentNames: parentNames,
                    node: node
                });
            }
        }
        
        // Рекурсивно обходим детей
        if (node.children) {
            node.children.forEach(child => findEmployees(child));
        }
    };
    
    findEmployees(window.treeApp.treeData);
    this.employeesFromTree = employees;
    
    console.log('✅ Загружено сотрудников из дерева:', employees.length);
    console.log('📊 Индекс должностей:', Array.from(this.positionMap.keys()));
    console.log('📋 Индекс приказов:', Array.from(this.orderMap.keys()));
    
    return employees;
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
         * Находит родителя узла (вспомогательная функция)
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
         * Индексирует сотрудника по ключевым словам из должности
         */
        indexByPosition(text, employee) {
            if (!text) return;
            
            // Разбиваем на слова и индексируем
            const words = text.split(/[\s,.-]+/).filter(w => w && w.length > 2);
            
            words.forEach(word => {
                if (!this.positionMap.has(word)) {
                    this.positionMap.set(word, []);
                }
                this.positionMap.get(word).push(employee);
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
                'аналитик'
            ];
            
            phrases.forEach(phrase => {
                if (text.includes(phrase)) {
                    if (!this.positionMap.has(phrase)) {
                        this.positionMap.set(phrase, []);
                    }
                    this.positionMap.get(phrase).push(employee);
                }
            });
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

        /**
         * Извлекает должности из текста
         */
        extractPositionsFromText(text) {
            const positions = [];
            const positionPatterns = [
                /заместитель\s+директора/i,
                /начальник\s+управления/i,
                /начальник\s+отдела/i,
                /главный\s+специалист/i,
                /ведущий\s+консультант/i,
                /заведующий\s+сектором/i,
                /эксперт/i,
                /аналитик/i,
                /руководитель/i,
                /директор\s+департамента/i
            ];
            
            positionPatterns.forEach(pattern => {
                const match = text.match(pattern);
                if (match) {
                    positions.push(match[0].toLowerCase());
                }
            });
            
            return positions;
        }

        /**
         * Проверяет, совпадает ли имя сотрудника с фрагментом текста
         */
        matchesEmployeeName(employee, text) {
            if (!text || !employee) return false;
            
            const textLower = text.toLowerCase();
            
            // Проверяем по полному имени
            if (employee.name && textLower.includes(employee.name.toLowerCase())) {
                return true;
            }
            
            // Проверяем по фамилии
            if (employee.lastName && textLower.includes(employee.lastName.toLowerCase())) {
                return true;
            }
            
            // Проверяем по короткому имени (Фамилия И.О.)
            if (employee.shortName) {
                const shortWithSpaces = employee.shortName.replace(/\./g, '.?').toLowerCase();
                const shortWithoutSpaces = employee.shortName.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();
                
                if (textLower.includes(shortWithSpaces) || textLower.includes(shortWithoutSpaces)) {
                    return true;
                }
            }
            
            // Проверяем по инициалам
            if (employee.initials) {
                const initialsFirst = employee.initials.split(' ').reverse().join(' ').toLowerCase();
                if (textLower.includes(initialsFirst)) {
                    return true;
                }
            }
            
            return false;
        }

        /**
         * Проверяет, совпадает ли должность сотрудника с текстом
         */
        matchesEmployeePosition(employee, text) {
            if (!text || !employee || !employee.positions) return false;
            
            const textLower = text.toLowerCase();
            
            // Проверяем по сохраненным должностям сотрудника
            for (const position of employee.positions) {
                if (position && typeof position === 'string' && textLower.includes(position.toLowerCase())) {
                    return true;
                }
            }
            
            // Проверяем по названиям отделов
            if (employee.parentNames) {
                for (const parentName of employee.parentNames) {
                    if (parentName && textLower.includes(parentName.toLowerCase())) {
                        return true;
                    }
                }
            }
            
            return false;
        }

        /**
         * Ищет сотрудников по должности, упомянутой в тексте
         */
        findEmployeesByPosition(text) {
            const matchedEmployees = [];
            const matchedIds = new Set();
            const textLower = text.toLowerCase();
            
            // Ищем по индексу должностей
            this.positionMap.forEach((employees, positionKey) => {
                if (textLower.includes(positionKey)) {
                    employees.forEach(emp => {
                        if (emp && emp.id && !matchedIds.has(emp.id)) {
                            matchedEmployees.push(emp);
                            matchedIds.add(emp.id);
                        }
                    });
                }
            });
            
            // Также ищем по прямым упоминаниям в должностях сотрудников
            this.employeesFromTree.forEach(employee => {
                if (employee && this.matchesEmployeePosition(employee, text)) {
                    if (!matchedIds.has(employee.id)) {
                        matchedEmployees.push(employee);
                        matchedIds.add(employee.id);
                    }
                }
            });
            
            return matchedEmployees;
        }
findEmployeesByOrder(text) {
    const matchedEmployees = [];
    const matchedIds = new Set();
    
    // Ищем номера приказов в тексте (например: "№ 874", "№874", "№874/1")
    const orderMatches = text.match(/№\s*(\d+)/g) || [];
    
    orderMatches.forEach(match => {
        const orderNum = match.replace('№', '').trim();
        
        if (this.orderMap.has(orderNum)) {
            this.orderMap.get(orderNum).forEach(emp => {
                if (emp && emp.id && !matchedIds.has(emp.id)) {
                    matchedEmployees.push(emp);
                    matchedIds.add(emp.id);
                }
            });
        }
    });
    
    return matchedEmployees;
}
      
/**
 * Главная функция для запуска парсинга из файла
 */
async parseDocument(file) {
    this.parsedData = { employees: [], authorities: [], documentMeta: {} };
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

        // 3. Загружаем сотрудников из дерева
        this.loadEmployeesFromTree();

        // 4. Поиск сотрудников по ФИО
        const nameMatches = this.matchEmployeesByName(fullText);
        
        // 5. Поиск сотрудников по должности
        const positionMatches = this.findEmployeesByPosition(fullText);
        
        // 👇 НОВОЕ: Поиск сотрудников по номеру приказа
        const orderMatches = this.findEmployeesByOrder(fullText);
        
        // 6. Объединяем результаты (убираем дубликаты)
        const allMatches = new Map();
        [...nameMatches, ...positionMatches, ...orderMatches].forEach(emp => {
            if (emp && emp.id && !allMatches.has(emp.id)) {
                allMatches.set(emp.id, emp);
            }
        });
        
        this.parsedData.employees = Array.from(allMatches.values());

        // 7. Извлечение полномочий
        this.parsedData.authorities = this.extractAuthorities(fullText, this.parsedData.documentMeta.docNumber);

        // 8. Связывание полномочий с сотрудниками
        this.linkAuthoritiesToEmployees();

        console.log('✅ Парсинг завершен. Найдено сотрудников (по имени+должности+приказам):', this.parsedData.employees.length);
        console.log('✅ Найдено полномочий:', this.parsedData.authorities.length);
        console.log('📋 Найдено по приказам:', orderMatches.length);
        
        // Логируем найденных сотрудников для отладки
        this.parsedData.employees.forEach(emp => {
            console.log(`   👤 ${emp.name} (должности: ${emp.positions ? emp.positions.join(', ') : 'не указаны'}, приказы: ${emp.orders ? emp.orders.join(', ') : 'нет'})`);
        });

        return this.parsedData;

    } catch (error) {
        console.error('❌ Ошибка при парсинге документа:', error);
        throw error;
    }
}
        /**
         * Поиск сотрудников по имени (старый метод)
         */
        matchEmployeesByName(text) {
            if (!this.employeesFromTree.length) this.loadEmployeesFromTree();

            const matchedEmployees = [];
            const matchedIds = new Set();

            this.employeesFromTree.forEach(employee => {
                if (employee && this.matchesEmployeeName(employee, text)) {
                    if (!matchedIds.has(employee.id)) {
                        matchedEmployees.push(employee);
                        matchedIds.add(employee.id);
                    }
                }
            });

            return matchedEmployees;
        }

        // --- Методы для извлечения текста ---

        async extractTextFromDocx(file) {
            if (typeof mammoth === 'undefined') {
                throw new Error('Библиотека mammoth не загружена. Невозможно прочитать DOCX файл.');
            }
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                return result.value;
            } catch (error) {
                console.error('Ошибка при чтении DOCX:', error);
                throw new Error('Не удалось извлечь текст из DOCX файла. Проверьте формат файла.');
            }
        }

        async extractTextFromPdf(file) {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('Библиотека pdf.js не загружена. Невозможно прочитать PDF файл.');
            }
            
            try {
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;
                
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                return fullText;
            } catch (error) {
                console.error('Ошибка при чтении PDF:', error);
                throw new Error('Не удалось извлечь текст из PDF файла. Возможно, файл защищен или поврежден.');
            }
        }

        // --- Методы для извлечения метаданных ---

        extractDocumentMeta(text, filename) {
            let docNumber = filename;
            const numberPatterns = [
                /приказ\s+от\s+\d{1,2}\.\d{1,2}\.\d{4}\s+№\s*([А-Я0-9\/\.\-]+)/i,
                /приказ\s+№\s*([А-Я0-9\/\.\-]+)/i,
                /№\s*([А-Я0-9\/\.\-]+)/i
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

        // --- Методы для извлечения полномочий ---

        extractAuthorities(text, docNumber) {
            const authorities = [];
            
            const startIndex = text.toLowerCase().indexOf('п р и к а з ы в а ю');
            if (startIndex > -1) {
                const relevantText = text.substring(startIndex);
                const lines = relevantText.split('\n');
                
                lines.forEach((line) => {
                    line = line.trim();
                    if (line.length > 30 && 
                        (line.includes('осуществляет') || 
                         line.includes('ведет') || 
                         line.includes('обеспечивает') ||
                         line.includes('назначает') ||
                         /^\d+\.\d+/.test(line) ||
                         /^\d+\./.test(line))) {
                        
                        authorities.push({
                            text: line,
                            sourceDoc: docNumber || 'не указан',
                            employeeId: null,
                            employee: null
                        });
                    }
                });
            }
            
            if (authorities.length === 0) {
                const lines = text.split('\n');
                lines.forEach(line => {
                    line = line.trim();
                    if (line.length > 50 && line.includes('.')) {
                        authorities.push({
                            text: line,
                            sourceDoc: docNumber || 'не указан',
                            employeeId: null,
                            employee: null
                        });
                    }
                });
            }

            return authorities;
        }

        /**
         * Связывает полномочия с сотрудниками
         */
        linkAuthoritiesToEmployees() {
            this.parsedData.authorities = this.parsedData.authorities.map(auth => {
                let linkedEmployeeId = null;
                let linkedEmployee = null;
                
                // Сначала ищем по имени
                for (const emp of this.parsedData.employees) {
                    if (emp && this.matchesEmployeeName(emp, auth.text)) {
                        linkedEmployeeId = emp.id;
                        linkedEmployee = emp;
                        break;
                    }
                }
                
                // Если не нашли по имени, ищем по должности
                if (!linkedEmployee) {
                    for (const emp of this.parsedData.employees) {
                        if (emp && this.matchesEmployeePosition(emp, auth.text)) {
                            linkedEmployeeId = emp.id;
                            linkedEmployee = emp;
                            break;
                        }
                    }
                }
                
                return { 
                    ...auth, 
                    employeeId: linkedEmployeeId,
                    employee: linkedEmployee
                };
            });
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
