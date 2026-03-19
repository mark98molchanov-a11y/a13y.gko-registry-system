
class DocumentParser {
    constructor() {
        // Здесь будут храниться данные после парсинга
        this.parsedData = {
            employees: [],      // Найденные сотрудники
            authorities: [],    // Найденные полномочия
            documentMeta: {}    // Метаданные документа (номер, дата)
        };
        this.employeesFromTree = []; // Будет заполняться из дерева
    }

    /**
     * Загружает список всех сотрудников из дерева (tree-manager-core)
     */
    loadEmployeesFromTree() {
        if (!window.treeApp || !window.treeApp.treeData) {
            console.warn('Дерево не инициализировано');
            return [];
        }

        const employees = [];
        const findEmployees = (node) => {
            // Критерий: узел является сотрудником (например, содержит ФИО или имеет подчиненные полномочия)
            // В вашем примере узел сотрудника - это "Дорошенко Анастасия Игоревна", у которого есть дети-полномочия.
            if (node.children && node.children.length > 0 && 
                node.content && typeof node.content.text === 'string' && 
                node.content.text.match(/^[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/)) { // Простая проверка на ФИО
                
                employees.push({
                    id: node.id,
                    name: node.content.text,
                    node: node // Сохраняем ссылку на узел
                });
            }
            node.children.forEach(findEmployees);
        };
        findEmployees(window.treeApp.treeData);
        this.employeesFromTree = employees;
        return employees;
    }

    /**
     * Главная функция для запуска парсинга из файла
     */
    async parseDocument(file) {
        this.parsedData = { employees: [], authorities: [], documentMeta: {} };
        let fullText = '';

        try {
            // 1. Извлечение текста
            if (file.name.endsWith('.docx')) {
                fullText = await this.extractTextFromDocx(file);
            } else if (file.name.endsWith('.pdf')) {
                fullText = await this.extractTextFromPdf(file);
            } else {
                throw new Error('Неподдерживаемый формат файла. Используйте DOCX или PDF.');
            }

            // 2. Извлечение метаданных (номер и дата приказа)
            this.parsedData.documentMeta = this.extractDocumentMeta(fullText, file.name);

            // 3. Извлечение сотрудников (поиск всех ФИО в тексте)
            const foundEmployeeNames = this.extractEmployeeNames(fullText);
            
            // 4. Сопоставление с сотрудниками из дерева
            this.parsedData.employees = this.matchEmployeesWithTree(foundEmployeeNames);

            // 5. Извлечение полномочий
            this.parsedData.authorities = this.extractAuthorities(fullText, this.parsedData.documentMeta.docNumber);

            // 6. Связывание полномочий с сотрудниками (по контексту)
            this.linkAuthoritiesToEmployees();

            return this.parsedData;

        } catch (error) {
            console.error('Ошибка при парсинге документа:', error);
            throw error; // Пробрасываем ошибку дальше для отображения в UI
        }
    }

    // --- Методы для извлечения текста (заглушки, требуют библиотек) ---

    async extractTextFromDocx(file) {
        // TODO: Требует подключения библиотеки (например, 'mammoth' или 'jszip')
        // Пример с mammoth:
        // const arrayBuffer = await file.arrayBuffer();
        // const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        // return result.value;
        console.warn('extractTextFromDocx: требуется библиотека mammoth.js');
        return "Заглушка текста DOCX. Нужно подключить mammoth.js";
    }

    async extractTextFromPdf(file) {
        // TODO: Требует подключения библиотеки (например, 'pdfjs-dist')
        console.warn('extractTextFromPdf: требуется библиотека pdfjs-dist');
        return "Заглушка текста PDF. Нужно подключить pdf.js";
    }

    // --- Методы для NLP (упрощенная логика на регулярных выражениях) ---

    extractDocumentMeta(text, filename) {
        // Ищем номер приказа: "Приказ № П/0336" или "приказ от 24.01.2025 № 17"
        const docNumberMatch = text.match(/приказ.*?[№#]?\s*([А-Я0-9\/\.\-]+)/i) || 
                               filename.match(/[\\/]([^\\/]+?)\./); // Из имени файла как запасной вариант
        const docNumber = docNumberMatch ? docNumberMatch[1] : filename;

        // Ищем дату: "24.01.2025" или "24 января 2025 года"
        const dateMatch = text.match(/(\d{2}[\.\/]\d{2}[\.\/]\d{4})/);
        const docDate = dateMatch ? dateMatch[1] : '';

        return { docNumber, docDate };
    }

    extractEmployeeNames(text) {
        // Ищем ФИО в формате: "Иванов Иван Иванович" (с большой буквы)
        // Упрощенная версия, не идеальна, но для начала сойдет.
        const regex = /\b([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)\b/g;
        const matches = text.match(regex);
        return matches ? [...new Set(matches)] : []; // Убираем дубликаты
    }

    matchEmployeesWithTree(foundNames) {
        if (!this.employeesFromTree.length) this.loadEmployeesFromTree();

        const matchedEmployees = [];
        foundNames.forEach(name => {
            const found = this.employeesFromTree.find(emp => emp.name === name);
            if (found) {
                matchedEmployees.push(found);
            }
        });
        return matchedEmployees;
    }

    extractAuthorities(text, docNumber) {
        // Очень сложная задача. Упрощаем: ищем абзацы, которые выглядят как пункты полномочий.
        // Они часто начинаются с цифры, дефиса или содержат ключевые слова.
        const lines = text.split('\n');
        const authorities = [];

        lines.forEach((line, index) => {
            line = line.trim();
            // Критерий: строка не пустая, не слишком короткая, содержит глагол или ключевые слова
            if (line.length > 30 && (line.includes('осуществляет') || line.includes('ведет') || 
                line.includes('обеспечивает') || line.includes('назначает') || /^\d+\.\d+/.test(line))) {
                
                authorities.push({
                    text: line,
                    sourceDoc: docNumber,
                    employeeId: null // Пока не привязано
                });
            }
        });
        return authorities;
    }

    linkAuthoritiesToEmployees() {
        // Упрощенная логика: если имя сотрудника встречается рядом с текстом полномочия, связываем их.
        this.parsedData.authorities = this.parsedData.authorities.map(auth => {
            let linkedEmployeeId = null;
            for (const emp of this.parsedData.employees) {
                // Проверяем, есть ли фамилия сотрудника в тексте полномочия
                const lastName = emp.name.split(' ')[0];
                if (auth.text.includes(lastName)) {
                    linkedEmployeeId = emp.id;
                    break;
                }
            }
            return { ...auth, employeeId: linkedEmployeeId };
        });
    }

    /**
     * Создает полномочие как дочерний узел для указанного сотрудника в дереве.
     */
    addAuthorityToEmployee(employeeNode, authorityText, sourceDoc) {
        if (!employeeNode) return false;

        // Создаем новый узел полномочия в формате, аналогичном вашему примеру
        const newAuthorityNode = {
            id: Date.now() + Math.floor(Math.random() * 1000), // Генерируем ID
            content: {
                text: authorityText,
                img: null,
                hideIcon: false,
                isTextOnly: true, // Полномочия обычно только текст
                subBlocks: [`Основание: ${sourceDoc}`], // Добавляем ссылку на документ
                isHorizontal: false,
                metricBlocks: [],
                isAuthority: true, // Помечаем как полномочие
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

// Делаем класс доступным глобально
window.DocumentParser = DocumentParser;
