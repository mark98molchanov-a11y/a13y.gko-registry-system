// js/document-parser-core.js

console.log('📄 Загрузка DocumentParser...');

if (typeof window.DocumentParser === 'undefined') {
    
    class DocumentParser {
        constructor() {
            this.parsedData = {
                employees: [],           // Все найденные сотрудники
                authorities: [],         // Найденные полномочия с привязкой ко всем совпадающим сотрудникам
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
         * Главная функция для запуска парсинга из файла
         */
        async parseDocument(file) {
            this.parsedData = { 
                employees: [], 
                authorities: [], 
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

                // 3. Загружаем всех сотрудников из дерева
                this.loadEmployeesFromTree();

                // 4. Извлекаем полномочия из текста приказа
                const extractedAuthorities = this.extractAuthorities(fullText, this.parsedData.documentMeta.docNumber);
                
                // 5. Для КАЖДОГО полномочия ищем ВСЕХ подходящих сотрудников
                extractedAuthorities.forEach(auth => {
                    const matchingEmployees = this.findAllEmployeesByText(auth.text);
                    
                    if (matchingEmployees.length > 0) {
                        // Привязываем полномочие ко ВСЕМ найденным сотрудникам
                        matchingEmployees.forEach(emp => {
                            this.parsedData.authorities.push({
                                ...auth,
                                employeeId: emp.id,
                                employeeName: emp.name,
                                allMatches: matchingEmployees.map(e => e.name) // Для отладки
                            });
                            
                            // Добавляем сотрудника в общий список (если еще нет)
                            if (!this.parsedData.employees.some(e => e.id === emp.id)) {
                                this.parsedData.employees.push(emp);
                            }
                        });
                    } else {
                        // Если не нашли ни одного сотрудника, добавляем как непривязанное
                        this.parsedData.authorities.push({
                            ...auth,
                            employeeId: null,
                            employeeName: null,
                            allMatches: []
                        });
                    }
                });

                console.log('✅ Парсинг завершен');
                console.log('👥 Найдено уникальных сотрудников:', this.parsedData.employees.length);
                console.log('📝 Найдено полномочий:', this.parsedData.authorities.length);
                
                // Логируем статистику по привязкам
                const boundCount = this.parsedData.authorities.filter(a => a.employeeId).length;
                const unboundCount = this.parsedData.authorities.filter(a => !a.employeeId).length;
                console.log('🔗 Привязано полномочий:', boundCount);
                console.log('❌ Не привязано полномочий:', unboundCount);
                
                // Логируем найденных сотрудников
                this.parsedData.employees.forEach(emp => {
                    console.log(`   👤 ${emp.name}`);
                });
                
                // Логируем полномочия с привязкой
                this.parsedData.authorities.forEach((auth, index) => {
                    if (auth.employeeName) {
                        console.log(`   📋 [${index}] "${auth.text.substring(0, 50)}..." → ${auth.employeeName} (и еще ${auth.allMatches.length - 1} совпадений)`);
                    } else {
                        console.log(`   📋 [${index}] "${auth.text.substring(0, 50)}..." → ❌ не привязано`);
                    }
                });

                return this.parsedData;

            } catch (error) {
                console.error('❌ Ошибка при парсинге документа:', error);
                throw error;
            }
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

        extractAuthorities(text, docNumber) {
            const authorities = [];
            const lines = text.split('\n');
            
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
                            sourceDoc: docNumber || 'не указан'
                        });
                    }
                });
            }
            
            if (authorities.length === 0) {
                lines.forEach(line => {
                    line = line.trim();
                    if (line.length > 50 && line.includes('.')) {
                        authorities.push({
                            text: line,
                            sourceDoc: docNumber || 'не указан'
                        });
                    }
                });
            }

            return authorities;
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
