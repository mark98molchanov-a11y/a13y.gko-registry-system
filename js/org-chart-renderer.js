// js/org-chart-renderer.js
class OrgChartRenderer {
    constructor(containerId, dataManager) {
        this.container = document.getElementById(containerId);
        this.dataManager = dataManager;
        this.expandedNodes = new Set();
        this.selectedItem = null;
        this.selectedType = null;
        this.searchQuery = '';
        this.filterDepartment = '';
        this.filterPosition = '';
        
        this.init();
    }
   async init() {
    this.setupEventListeners();
    
    // 1. Сначала загружаем сохраненное состояние развернутых узлов
    const savedExpanded = localStorage.getItem('org_expanded_nodes');
    if (savedExpanded) {
        try {
            const expandedArray = JSON.parse(savedExpanded);
            this.expandedNodes = new Set(expandedArray);
            console.log('📂 Загружено состояние развернутых узлов:', this.expandedNodes.size);
        } catch(e) {
            console.error('Ошибка загрузки состояния:', e);
        }
    }
    
    // 2. Если нет сохраненного состояния, разворачиваем корневые узлы ДО синхронизации фото
    if (!savedExpanded || this.expandedNodes.size === 0) {
        const roots = this.dataManager.departments.filter(d => d.parentId === null);
        roots.forEach(root => this.expandedNodes.add(root.id));
        // Сразу сохраняем состояние, чтобы при следующей загрузке оно было
        localStorage.setItem('org_expanded_nodes', JSON.stringify(Array.from(this.expandedNodes)));
        console.log('📂 Развернуты корневые узлы:', roots.length);
    }
    
    // 3. Синхронизируем фото из IndexedDB
    if (this.dataManager.syncPhotosFromIndexedDB) {
        await this.dataManager.syncPhotosFromIndexedDB();
        console.log('📸 Фото синхронизированы');
    }
    
    // 4. Рендерим дерево
    await this.render();
    console.log('🎨 Дерево отрисовано');
    
    // 5. Подписка на изменения данных (после рендера)
    this.dataManager.subscribe('renderer', async () => {
        console.log('🔄 Данные изменились, обновляем дерево');
        await this.render();
    });
}
    
    setupEventListeners() {
        // Поиск
        const searchInput = document.getElementById('org-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase().trim();
                
                if (this.searchQuery) {
                    const expandMatchingNodes = (depts) => {
                        depts.forEach(dept => {
                            if (this.hasMatchingDescendant(dept)) {
                                this.expandedNodes.add(dept.id);
                                if (dept.children && dept.children.length) {
                                    expandMatchingNodes(dept.children);
                                }
                            }
                        });
                    };
                    const tree = this.dataManager.getDepartmentTree();
                    expandMatchingNodes(tree);
                }
                
                this.render();
            });
        }
        
        // Фильтр по отделам
        const filterDept = document.getElementById('org-filter-department');
        if (filterDept) {
            filterDept.addEventListener('change', (e) => {
                this.filterDepartment = e.target.value;
                this.render();
            });
            this.updateDepartmentFilter();
        }
        
        // Фильтр по должностям
        const filterPos = document.getElementById('org-filter-position');
        if (filterPos) {
            filterPos.addEventListener('change', (e) => {
                this.filterPosition = e.target.value;
                this.render();
            });
            this.updatePositionFilter();
        }
        
        // Сброс фильтров
        const clearBtn = document.getElementById('org-filter-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.filterDepartment = '';
                this.filterPosition = '';
                if (searchInput) searchInput.value = '';
                if (filterDept) filterDept.value = '';
                if (filterPos) filterPos.value = '';
                
                // Восстанавливаем сохраненное состояние развернутых узлов
                const savedExpanded = localStorage.getItem('org_expanded_nodes');
                if (savedExpanded) {
                    try {
                        const expandedArray = JSON.parse(savedExpanded);
                        this.expandedNodes = new Set(expandedArray);
                    } catch(e) {}
                } else {
                    const roots = this.dataManager.departments.filter(d => d.parentId === null);
                    roots.forEach(root => this.expandedNodes.add(root.id));
                }
                
                this.render();
            });
        }
        
        // Кнопки управления
        const expandAll = document.getElementById('org-expand-all');
        if (expandAll) expandAll.addEventListener('click', () => this.expandAll());
        
        const collapseAll = document.getElementById('org-collapse-all');
        if (collapseAll) collapseAll.addEventListener('click', () => this.collapseAll());
        
        const addDept = document.getElementById('org-add-department');
        if (addDept) addDept.addEventListener('click', () => this.showAddDepartmentModal());
        
        const addEmployee = document.getElementById('org-add-employee');
        if (addEmployee) addEmployee.addEventListener('click', () => this.showAddEmployeeModal());
        
        // Экспорт JSON
        const exportJsonBtn = document.getElementById('org-export-json');
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => this.exportData());
        
        // Экспорт Excel
        const exportExcelBtn = document.getElementById('org-export-excel');
        if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        
        // Импорт JSON
        const importJsonBtn = document.getElementById('org-import-json');
        if (importJsonBtn) importJsonBtn.addEventListener('click', () => this.importData());
        
        // Импорт Excel
        const importExcelBtn = document.getElementById('org-import-excel');
        if (importExcelBtn) importExcelBtn.addEventListener('click', () => this.importFromExcel());
    }
    
    updateDepartmentFilter() {
        const select = document.getElementById('org-filter-department');
        if (!select) return;
        
        const departments = this.dataManager.getAllDepartmentsFlat();
        select.innerHTML = '<option value="">Все отделы</option>' + 
            departments.map(d => `<option value="${d.id}">${this.escapeHtml(d.fullPath)}</option>`).join('');
    }
    
    updatePositionFilter() {
        const select = document.getElementById('org-filter-position');
        if (!select) return;
        
        select.innerHTML = '<option value="">Все должности</option>' + 
            this.dataManager.positions.map(p => `<option value="${p.id}">${this.escapeHtml(p.name)}</option>`).join('');
    }
    
    filterTree(departments) {
        let result = [...departments];
        
        // Фильтр по поиску
        if (this.searchQuery) {
            result = result.filter(dept => {
                const deptMatches = dept.name.toLowerCase().includes(this.searchQuery);
                const employeesMatches = dept.employees.some(emp => 
                    emp.name.toLowerCase().includes(this.searchQuery) ||
                    (this.dataManager.positions.find(p => p.id === emp.positionId)?.name || '').toLowerCase().includes(this.searchQuery) ||
                    (emp.email && emp.email.toLowerCase().includes(this.searchQuery))
                );
                const childrenMatches = this.filterTree(dept.children).length > 0;
                
                if (deptMatches) return true;
                return employeesMatches || childrenMatches;
            }).map(dept => ({
                ...dept,
                employees: dept.employees.filter(emp => 
                    emp.name.toLowerCase().includes(this.searchQuery) ||
                    (this.dataManager.positions.find(p => p.id === emp.positionId)?.name || '').toLowerCase().includes(this.searchQuery) ||
                    (emp.email && emp.email.toLowerCase().includes(this.searchQuery))
                ),
                children: this.filterTree(dept.children)
            }));
        }
        
        // Фильтр по отделу
        if (this.filterDepartment) {
            const filterId = parseInt(this.filterDepartment);
            result = result.filter(dept => {
                if (dept.id === filterId) return true;
                if (this.hasDepartment(dept, filterId)) return true;
                return false;
            }).map(dept => ({
                ...dept,
                children: this.filterTreeByDepartment(dept.children, filterId)
            }));
        }
        
        // Фильтр по должности
        if (this.filterPosition) {
            const filterPosId = parseInt(this.filterPosition);
            result = result.map(dept => ({
                ...dept,
                employees: dept.employees.filter(emp => emp.positionId === filterPosId),
                children: this.filterTreeByPosition(dept.children, filterPosId)
            })).filter(dept => dept.employees.length > 0 || this.hasEmployeesWithPosition(dept, filterPosId));
        }
        
        return result;
    }
    
    hasDepartment(dept, targetId) {
        if (dept.id === targetId) return true;
        return dept.children.some(child => this.hasDepartment(child, targetId));
    }
    
    filterTreeByDepartment(departments, targetId) {
        return departments.filter(dept => {
            if (dept.id === targetId) return true;
            if (this.hasDepartment(dept, targetId)) return true;
            return false;
        }).map(dept => ({
            ...dept,
            children: this.filterTreeByDepartment(dept.children, targetId)
        }));
    }
    
    hasEmployeesWithPosition(dept, positionId) {
        if (dept.employees.some(emp => emp.positionId === positionId)) return true;
        return dept.children.some(child => this.hasEmployeesWithPosition(child, positionId));
    }
    
    filterTreeByPosition(departments, positionId) {
        return departments.map(dept => ({
            ...dept,
            employees: dept.employees.filter(emp => emp.positionId === positionId),
            children: this.filterTreeByPosition(dept.children, positionId)
        })).filter(dept => dept.employees.length > 0 || this.hasEmployeesWithPosition(dept, positionId));
    }
    
    async renderEmployeeAsync(employee) {
        const position = this.dataManager.positions.find(p => p.id === employee.positionId);
        const isSelected = this.selectedType === 'employee' && this.selectedItem === employee.id;
        
        let photoUrl = null;
        if (employee.photo) {
            if (employee.photo.startsWith('__INDEXEDDB__')) {
                if (this.dataManager.loadEmployeePhotoFromIndexedDB) {
                    photoUrl = await this.dataManager.loadEmployeePhotoFromIndexedDB(employee.id);
                }
            } else {
                photoUrl = employee.photo;
            }
        }
        
        let avatarHtml = '';
        if (photoUrl && photoUrl.startsWith('data:image')) {
            avatarHtml = `<img src="${photoUrl}" class="org-employee-photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;">`;
        } else {
            avatarHtml = `<div class="org-employee-avatar">${employee.isHead ? '👔' : '👤'}</div>`;
        }
        
        return `
            <div class="org-employee-card ${isSelected ? 'selected' : ''}" 
                 data-id="${employee.id}" 
                 data-type="employee"
                 onclick="orgApp.selectItem('employee', ${employee.id})">
                ${avatarHtml}
                <div class="org-employee-info">
                    <div class="org-employee-name">
                        ${this.escapeHtml(employee.name)}
                        ${employee.isHead ? '<span class="org-badge-head">Руководитель</span>' : ''}
                    </div>
                    <div class="org-employee-position">${position ? this.escapeHtml(position.name) : ''}</div>
                    ${employee.email ? `<div class="org-employee-contact">✉️ ${this.escapeHtml(employee.email)}</div>` : ''}
                    ${employee.phone ? `<div class="org-employee-contact">📞 ${this.escapeHtml(employee.phone)}</div>` : ''}
                </div>
                <div class="org-employee-actions">
                    <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.uploadEmployeePhoto(${employee.id})" title="Загрузить фото">🖼️</button>
                    <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.editEmployee(${employee.id})" title="Редактировать">✏️</button>
                    <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.fireEmployee(${employee.id})" title="Уволить">🚪</button>
                </div>
            </div>
        `;
    }
    
    async renderTreeAsync(departments, level = 0) {
        if (!departments.length) return '';
        
        const html = [];
        for (const dept of departments) {
            const isExpanded = this.shouldShowChildren(dept);
            const hasChildren = dept.children.length > 0;
            const employees = dept.employees || [];
            const isSelected = this.selectedType === 'department' && this.selectedItem === dept.id;
            
            const iconHtml = `<div class="org-node-icon">${hasChildren ? (isExpanded ? '📂' : '📁') : '📄'}</div>`;
            
            const employeeHtml = [];
            for (const emp of employees) {
                employeeHtml.push(await this.renderEmployeeAsync(emp));
            }
            
            html.push(`
                <div class="org-node org-department-node" data-id="${dept.id}" data-type="department">
                    <div class="org-node-header ${isSelected ? 'selected' : ''}" 
                         onclick="orgApp.toggleDepartmentExpand(${dept.id})">
                        ${iconHtml}
                        <div class="org-node-content">
                            <div class="org-node-title">${this.escapeHtml(dept.name)}</div>
                            <div class="org-node-meta">
                                ${employees.length} сотрудник${this.plural(employees.length)}
                                ${hasChildren ? ` • ${dept.children.length} подотдел${this.plural(dept.children.length)}` : ''}
                            </div>
                        </div>
                        <div class="org-node-actions">
                            <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.editDepartment(${dept.id})" title="Редактировать">✏️</button>
                            <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.deleteDepartment(${dept.id})" title="Удалить">🗑️</button>
                            ${hasChildren ? `
                                <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.toggleExpand(${dept.id})" title="${isExpanded ? 'Свернуть' : 'Развернуть'}">
                                    ${isExpanded ? '▲' : '▼'}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${isExpanded ? `
                        <div class="org-node-children">
                            ${employees.length ? `
                                <div class="org-employees-section">
                                    <div class="org-section-title">👥 Сотрудники</div>
                                    <div class="org-employees-list">
                                        ${employeeHtml.join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${hasChildren ? `
                                <div class="org-subdepartments-section">
                                    ${await this.renderTreeAsync(dept.children, level + 1)}
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `);
        }
        
        return html.join('');
    }
    
    async render() {
        if (!this.container) return;
        
        const tree = this.dataManager.getDepartmentTree();
        const filteredTree = this.filterTree(tree);
        
        const html = await this.renderTreeAsync(filteredTree);
        this.container.innerHTML = `<div class="org-chart">${html}</div>`;
    }
    
    selectItem(type, id) {
        this.selectedType = type;
        this.selectedItem = id;
        this.render();
        this.showDetails(type, id);
    }
    
    showDetails(type, id) {
        const detailsContainer = document.getElementById('org-details-content');
        if (!detailsContainer) return;
        
        if (type === 'department') {
            const dept = this.dataManager.departments.find(d => d.id === id);
            if (!dept) return;
            
            const parent = this.dataManager.departments.find(d => d.id === dept.parentId);
            const head = this.dataManager.getDepartmentHead(id);
            const employees = this.dataManager.getDepartmentEmployees(id);
            const children = this.dataManager.departments.filter(d => d.parentId === id);
            
            detailsContainer.innerHTML = `
                <div class="org-details">
                    <div class="org-details-header">
                        <h3>🏢 ${this.escapeHtml(dept.name)}</h3>
                        <button class="org-btn-icon" onclick="orgApp.closeDetails()">✕</button>
                    </div>
                    <div class="org-details-body">
                        <div class="org-details-row">
                            <span class="org-details-label">Родительский отдел:</span>
                            <span>${parent ? this.escapeHtml(parent.name) : '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Руководитель:</span>
                            <span>${head ? this.escapeHtml(head.name) : '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Сотрудников:</span>
                            <span>${employees.length}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Подотделов:</span>
                            <span>${children.length}</span>
                        </div>
                        ${dept.description ? `
                            <div class="org-details-row">
                                <span class="org-details-label">Описание:</span>
                                <span>${this.escapeHtml(dept.description)}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="org-details-actions">
                        <button class="btn-secondary" onclick="orgApp.editDepartment(${dept.id})">✏️ Редактировать</button>
                        <button class="btn-danger" onclick="orgApp.deleteDepartment(${dept.id})">🗑️ Удалить</button>
                        <button class="btn-primary" onclick="orgApp.showAddEmployeeModal(${dept.id})">➕ Добавить сотрудника</button>
                    </div>
                </div>
            `;
        } else if (type === 'employee') {
            const emp = this.dataManager.employees.find(e => e.id === id);
            if (!emp) return;
            
            const department = this.dataManager.departments.find(d => d.id === emp.departmentId);
            const position = this.dataManager.positions.find(p => p.id === emp.positionId);
            
            detailsContainer.innerHTML = `
                <div class="org-details">
                    <div class="org-details-header">
                        <h3>👤 ${this.escapeHtml(emp.name)}</h3>
                        <button class="org-btn-icon" onclick="orgApp.closeDetails()">✕</button>
                    </div>
                    <div class="org-details-body">
                        <div class="org-details-row">
                            <span class="org-details-label">Должность:</span>
                            <span>${position ? this.escapeHtml(position.name) : '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Отдел:</span>
                            <span>${department ? this.escapeHtml(department.name) : '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Email:</span>
                            <span>${emp.email || '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Телефон:</span>
                            <span>${emp.phone || '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Дата начала:</span>
                            <span>${emp.startDate || '—'}</span>
                        </div>
                        <div class="org-details-row">
                            <span class="org-details-label">Статус:</span>
                            <span class="org-status ${emp.isActive ? 'active' : 'inactive'}">
                                ${emp.isActive ? 'Активен' : 'Уволен'}
                            </span>
                        </div>
                        ${emp.fireDate ? `
                            <div class="org-details-row">
                                <span class="org-details-label">Дата увольнения:</span>
                                <span>${emp.fireDate}</span>
                            </div>
                        ` : ''}
                        ${emp.fireReason ? `
                            <div class="org-details-row">
                                <span class="org-details-label">Причина:</span>
                                <span>${this.escapeHtml(emp.fireReason)}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="org-details-actions">
                        <button class="btn-secondary" onclick="orgApp.editEmployee(${emp.id})">✏️ Редактировать</button>
                        ${emp.isActive ? 
                            `<button class="btn-danger" onclick="orgApp.fireEmployee(${emp.id})">🚪 Уволить</button>` :
                            `<button class="btn-success" onclick="orgApp.rehireEmployee(${emp.id})">🔄 Восстановить</button>`
                        }
                    </div>
                </div>
            `;
        }
    }
    
    closeDetails() {
        this.selectedType = null;
        this.selectedItem = null;
        
        const detailsContainer = document.getElementById('org-details-content');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="org-details-empty">
                    <div class="org-details-icon">📋</div>
                    <p>Выберите отдел или сотрудника</p>
                    <p class="org-details-hint">Нажмите на элемент в структуре слева</p>
                </div>
            `;
        }
        
        this.render();
    }
    
    shouldShowChildren(dept) {
        if (this.searchQuery) {
            if (this.hasMatchingDescendant(dept)) return true;
            if (this.nodeMatchesSearch(dept, this.searchQuery)) return true;
            return false;
        }
        return this.expandedNodes.has(dept.id);
    }
    
    hasMatchingDescendant(node, query = this.searchQuery) {
        if (!query) return false;
        
        if (this.nodeMatchesSearch(node, query)) return true;
        
        for (const child of node.children) {
            if (this.hasMatchingDescendant(child, query)) return true;
        }
        
        if (node.employees && node.employees.length) {
            for (const emp of node.employees) {
                const position = this.dataManager.positions.find(p => p.id === emp.positionId);
                if (emp.name.toLowerCase().includes(query) ||
                    (position && position.name.toLowerCase().includes(query)) ||
                    (emp.email && emp.email.toLowerCase().includes(query))) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    nodeMatchesSearch(node, query = this.searchQuery) {
        if (!query) return false;
        
        const lowerQuery = query.toLowerCase();
        
        if (node.name.toLowerCase().includes(lowerQuery)) return true;
        if (node.description && node.description.toLowerCase().includes(lowerQuery)) return true;
        
        if (node.employees && node.employees.length) {
            for (const emp of node.employees) {
                if (emp.name.toLowerCase().includes(lowerQuery)) return true;
                const position = this.dataManager.positions.find(p => p.id === emp.positionId);
                if (position && position.name.toLowerCase().includes(lowerQuery)) return true;
                if (emp.email && emp.email.toLowerCase().includes(lowerQuery)) return true;
            }
        }
        
        return false;
    }
    
    uploadEmployeePhoto(employeeId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg, image/png, image/gif, image/webp';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > 2 * 1024 * 1024) {
                alert('Файл слишком большой. Максимальный размер 2MB');
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                alert('Пожалуйста, выберите изображение');
                return;
            }
            
            try {
                this.showNotification('⏳ Загрузка фото...', 'info');
                
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Image = event.target.result;
                    
                    if (this.dataManager.saveEmployeePhotoToIndexedDB) {
                        const saved = await this.dataManager.saveEmployeePhotoToIndexedDB(employeeId, base64Image);
                        if (saved) {
                            this.showNotification('✅ Фото сотрудника сохранено', 'success');
                            await this.render();
                        } else {
                            this.showNotification('❌ Ошибка сохранения фото', 'error');
                        }
                    } else {
                        this.dataManager.updateEmployee(employeeId, { photo: base64Image });
                        this.showNotification('✅ Фото сотрудника сохранено', 'success');
                        await this.render();
                    }
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Ошибка загрузки фото:', error);
                alert('Ошибка при загрузке фото');
            }
        };
        
        input.click();
    }
    
    toggleExpand(id) {
        console.log('🔄 Переключение узла:', id);
        
        if (this.searchQuery) {
            const node = this.dataManager.departments.find(d => d.id === id);
            if (node && this.hasMatchingDescendant(node)) {
                if (!this.expandedNodes.has(id)) {
                    this.expandedNodes.add(id);
                    this.render();
                }
                return;
            }
        }
        
        if (this.expandedNodes.has(id)) {
            this.expandedNodes.delete(id);
            console.log('📁 Узел свернут');
        } else {
            this.expandedNodes.add(id);
            console.log('📂 Узел развернут');
        }
        
        localStorage.setItem('org_expanded_nodes', JSON.stringify(Array.from(this.expandedNodes)));
        this.render();
    }
    
    expandAll() {
        console.log('📂 Разворачиваем все узлы...');
        
        const addAllIds = (depts) => {
            depts.forEach(dept => {
                this.expandedNodes.add(dept.id);
                if (dept.children && dept.children.length) {
                    addAllIds(dept.children);
                }
            });
        };
        
        const tree = this.dataManager.getDepartmentTree();
        addAllIds(tree);
        
        localStorage.setItem('org_expanded_nodes', JSON.stringify(Array.from(this.expandedNodes)));
        this.render();
        this.showNotification('✅ Все отделы развернуты', 'success');
    }
    
    collapseAll() {
        console.log('📁 Сворачиваем все узлы...');
        
        this.expandedNodes.clear();
        
        localStorage.setItem('org_expanded_nodes', JSON.stringify(Array.from(this.expandedNodes)));
        this.render();
        this.showNotification('✅ Все отделы свернуты', 'success');
    }
    
    toggleDepartmentExpand(id) {
        console.log('🔄 Клик по заголовку отдела:', id);
        this.toggleExpand(id);
    }
    
    showAddDepartmentModal(parentId = null) {
        const departments = this.dataManager.departments.filter(d => d.id !== 1);
        
        const modal = document.getElementById('org-modal');
        const modalBody = document.getElementById('org-modal-body');
        const modalTitle = document.getElementById('org-modal-title');
        
        modalTitle.textContent = '➕ Добавление отдела';
        
        modalBody.innerHTML = `
            <div class="form-group">
                <label>Название отдела *</label>
                <input type="text" id="dept-name" placeholder="Введите название отдела" autocomplete="off">
            </div>
            <div class="form-group">
                <label>Родительский отдел</label>
                <select id="dept-parent">
                    <option value="">— Корневой отдел —</option>
                    ${departments.map(d => `
                        <option value="${d.id}" ${parentId === d.id ? 'selected' : ''}>
                            ${this.escapeHtml(this.dataManager.getDepartmentPath(d.id))}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="dept-description" rows="3" placeholder="Описание отдела"></textarea>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        const saveBtn = document.getElementById('org-modal-save');
        const cancelBtn = document.getElementById('org-modal-cancel');
        const closeBtn = modal.querySelector('.org-modal-close');
        
        const saveHandler = () => {
            const name = document.getElementById('dept-name').value.trim();
            if (!name) {
                alert('Введите название отдела');
                return;
            }
            
            const parent = document.getElementById('dept-parent').value;
            const description = document.getElementById('dept-description').value;
            
            this.dataManager.addDepartment(name, parent ? parseInt(parent) : null, description);
            this.closeModal();
        };
        
        const closeHandler = () => this.closeModal();
        
        saveBtn.onclick = saveHandler;
        cancelBtn.onclick = closeHandler;
        if (closeBtn) closeBtn.onclick = closeHandler;
        
        document.getElementById('dept-name')?.focus();
    }
    
    showAddEmployeeModal(departmentId = null) {
        const departments = this.dataManager.departments.filter(d => d.id !== 1);
        const positions = this.dataManager.positions;
        
        const modal = document.getElementById('org-modal');
        const modalBody = document.getElementById('org-modal-body');
        const modalTitle = document.getElementById('org-modal-title');
        
        modalTitle.textContent = '👤 Добавление сотрудника';
        
        modalBody.innerHTML = `
            <div class="form-group">
                <label>ФИО сотрудника *</label>
                <input type="text" id="emp-name" placeholder="Иванов Иван Иванович" autocomplete="off">
            </div>
            <div class="form-group">
                <label>Отдел *</label>
                <select id="emp-department">
                    ${departments.map(d => `
                        <option value="${d.id}" ${departmentId === d.id ? 'selected' : ''}>
                            ${this.escapeHtml(this.dataManager.getDepartmentPath(d.id))}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Должность *</label>
                <select id="emp-position">
                    ${positions.map(p => `
                        <option value="${p.id}">${this.escapeHtml(p.name)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="emp-email" placeholder="example@domain.ru">
            </div>
            <div class="form-group">
                <label>Телефон</label>
                <input type="tel" id="emp-phone" placeholder="+7 (495) 123-45-67">
            </div>
            <div class="form-group">
                <label>Фото сотрудника</label>
                <input type="file" id="emp-photo" accept="image/jpeg,image/png,image/gif,image/webp">
                <div id="emp-photo-preview" style="margin-top: 10px; display: none;">
                    <img style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;">
                </div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="emp-is-head"> Назначить руководителем отдела
                </label>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        const photoInput = document.getElementById('emp-photo');
        const photoPreview = document.getElementById('emp-photo-preview');
        const previewImg = photoPreview.querySelector('img');
        
        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        previewImg.src = event.target.result;
                        photoPreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                } else {
                    photoPreview.style.display = 'none';
                }
            });
        }
        
        const saveBtn = document.getElementById('org-modal-save');
        const cancelBtn = document.getElementById('org-modal-cancel');
        const closeBtn = modal.querySelector('.org-modal-close');
        
        const saveHandler = () => {
            const name = document.getElementById('emp-name').value.trim();
            if (!name) {
                alert('Введите ФИО сотрудника');
                return;
            }
            
            let photo = null;
            if (photoInput.files && photoInput.files[0]) {
                photo = previewImg.src;
            }
            
            this.dataManager.addEmployee({
                name,
                departmentId: parseInt(document.getElementById('emp-department').value),
                positionId: parseInt(document.getElementById('emp-position').value),
                email: document.getElementById('emp-email').value,
                phone: document.getElementById('emp-phone').value,
                photo: photo,
                isHead: document.getElementById('emp-is-head').checked
            });
            
            this.closeModal();
        };
        
        const closeHandler = () => this.closeModal();
        
        saveBtn.onclick = saveHandler;
        cancelBtn.onclick = closeHandler;
        if (closeBtn) closeBtn.onclick = closeHandler;
        
        document.getElementById('emp-name')?.focus();
    }
    
    editDepartment(id) {
        const dept = this.dataManager.departments.find(d => d.id === id);
        if (!dept) return;
        
        const departments = this.dataManager.departments.filter(d => d.id !== 1 && d.id !== id);
        
        const modal = document.getElementById('org-modal');
        const modalBody = document.getElementById('org-modal-body');
        const modalTitle = document.getElementById('org-modal-title');
        
        modalTitle.textContent = '✏️ Редактирование отдела';
        
        modalBody.innerHTML = `
            <div class="form-group">
                <label>Название отдела *</label>
                <input type="text" id="dept-name" value="${this.escapeHtml(dept.name)}">
            </div>
            <div class="form-group">
                <label>Родительский отдел</label>
                <select id="dept-parent">
                    <option value="">— Корневой отдел —</option>
                    ${departments.map(d => `
                        <option value="${d.id}" ${dept.parentId === d.id ? 'selected' : ''}>
                            ${this.escapeHtml(this.dataManager.getDepartmentPath(d.id))}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Описание</label>
                <textarea id="dept-description" rows="3">${dept.description || ''}</textarea>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        const saveBtn = document.getElementById('org-modal-save');
        const cancelBtn = document.getElementById('org-modal-cancel');
        const closeBtn = modal.querySelector('.org-modal-close');
        
        const saveHandler = () => {
            const name = document.getElementById('dept-name').value.trim();
            if (!name) {
                alert('Введите название отдела');
                return;
            }
            
            const parent = document.getElementById('dept-parent').value;
            const description = document.getElementById('dept-description').value;
            
            this.dataManager.updateDepartment(id, {
                name,
                parentId: parent ? parseInt(parent) : null,
                description
            });
            
            this.closeModal();
            this.render();
        };
        
        const closeHandler = () => this.closeModal();
        
        saveBtn.onclick = saveHandler;
        cancelBtn.onclick = closeHandler;
        if (closeBtn) closeBtn.onclick = closeHandler;
        
        document.getElementById('dept-name')?.focus();
    }
    
    async editEmployee(id) {
        const emp = this.dataManager.employees.find(e => e.id === id);
        if (!emp) return;
        
        const departments = this.dataManager.departments.filter(d => d.id !== 1);
        const positions = this.dataManager.positions;
        
        const modal = document.getElementById('org-modal');
        const modalBody = document.getElementById('org-modal-body');
        const modalTitle = document.getElementById('org-modal-title');
        
        modalTitle.textContent = '✏️ Редактирование сотрудника';
        
        let newPhotoBase64 = null;
        let removePhoto = false;
        const originalPhoto = emp.photo;
        
        // Загружаем фото для предпросмотра
        let displayPhoto = originalPhoto;
        if (originalPhoto && originalPhoto.startsWith('__INDEXEDDB__')) {
            if (this.dataManager.loadEmployeePhotoFromIndexedDB) {
                displayPhoto = await this.dataManager.loadEmployeePhotoFromIndexedDB(emp.id);
            }
        }
        
        modalBody.innerHTML = `
            <div class="form-group">
                <label>ФИО сотрудника *</label>
                <input type="text" id="emp-name" value="${this.escapeHtml(emp.name)}">
            </div>
            <div class="form-group">
                <label>Отдел *</label>
                <select id="emp-department">
                    ${departments.map(d => `
                        <option value="${d.id}" ${emp.departmentId === d.id ? 'selected' : ''}>
                            ${this.escapeHtml(this.dataManager.getDepartmentPath(d.id))}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Должность *</label>
                <select id="emp-position">
                    ${positions.map(p => `
                        <option value="${p.id}" ${emp.positionId === p.id ? 'selected' : ''}>
                            ${this.escapeHtml(p.name)}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="emp-email" value="${emp.email || ''}">
            </div>
            <div class="form-group">
                <label>Телефон</label>
                <input type="tel" id="emp-phone" value="${emp.phone || ''}">
            </div>
            <div class="form-group">
                <label>Фото сотрудника</label>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <input type="file" id="emp-photo" accept="image/jpeg,image/png,image/gif,image/webp">
                    <button type="button" id="remove-emp-photo" style="background: #fee2e2; color: #dc2626; padding: 4px 12px; border-radius: 6px; border: none; cursor: pointer;">🗑️ Удалить фото</button>
                </div>
                <div id="emp-photo-preview" style="margin-top: 10px; ${!displayPhoto ? 'display: none;' : ''}">
                    <img src="${displayPhoto || ''}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;">
                </div>
                <div id="photo-status" style="margin-top: 8px; font-size: 12px; color: #64748b;"></div>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="emp-is-head" ${emp.isHead ? 'checked' : ''}> 
                    Назначить руководителем отдела
                </label>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        const photoInput = document.getElementById('emp-photo');
        const photoPreview = document.getElementById('emp-photo-preview');
        const previewImg = photoPreview?.querySelector('img');
        const photoStatus = document.getElementById('photo-status');
        
        if (photoInput) {
            photoInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        alert('Файл слишком большой. Максимум 2MB');
                        photoInput.value = '';
                        return;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        newPhotoBase64 = event.target.result;
                        if (previewImg) {
                            previewImg.src = newPhotoBase64;
                            photoPreview.style.display = 'block';
                        }
                        removePhoto = false;
                        if (photoStatus) {
                            photoStatus.textContent = '✅ Новое фото выбрано';
                            photoStatus.style.color = '#10b981';
                        }
                        console.log('📸 Новое фото загружено, длина:', newPhotoBase64.length);
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        const removeBtn = document.getElementById('remove-emp-photo');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                newPhotoBase64 = null;
                removePhoto = true;
                if (previewImg) {
                    previewImg.src = '';
                    photoPreview.style.display = 'none';
                }
                if (photoInput) photoInput.value = '';
                if (photoStatus) {
                    photoStatus.textContent = '🗑️ Фото будет удалено';
                    photoStatus.style.color = '#dc2626';
                }
                console.log('🗑️ Фото будет удалено');
            });
        }
        
        const saveBtn = document.getElementById('org-modal-save');
        const cancelBtn = document.getElementById('org-modal-cancel');
        const closeBtn = modal.querySelector('.org-modal-close');
        
        const saveHandler = async () => {
            const name = document.getElementById('emp-name').value.trim();
            if (!name) {
                alert('Введите ФИО сотрудника');
                return;
            }
            
            let finalPhoto = null;
            
            if (removePhoto) {
                finalPhoto = null;
                console.log('📸 Результат: фото удалено');
                if (window.photoDB) {
                    await window.photoDB.deletePhoto(id);
                }
            } else if (newPhotoBase64) {
                finalPhoto = newPhotoBase64;
                console.log('📸 Результат: новое фото, длина:', finalPhoto.length);
                if (this.dataManager.saveEmployeePhotoToIndexedDB) {
                    await this.dataManager.saveEmployeePhotoToIndexedDB(id, finalPhoto);
                    finalPhoto = `__INDEXEDDB__${id}`;
                }
            } else {
                finalPhoto = originalPhoto;
                console.log('📸 Результат: фото без изменений');
            }
            
            const updates = {
                name: name,
                departmentId: parseInt(document.getElementById('emp-department').value),
                positionId: parseInt(document.getElementById('emp-position').value),
                email: document.getElementById('emp-email').value,
                phone: document.getElementById('emp-phone').value,
                photo: finalPhoto,
                isHead: document.getElementById('emp-is-head').checked
            };
            
            console.log('💾 Сохраняем сотрудника:', { id, updates });
            console.log('📸 Сохраняемое фото:', updates.photo ? (updates.photo.startsWith('__INDEXEDDB__') ? 'в IndexedDB' : 'base64') : 'нет');
            
            this.dataManager.updateEmployee(id, updates);
            
            this.closeModal();
            await this.render();
            
            this.showNotification('✅ Сотрудник сохранен' + (finalPhoto ? ' с фото' : ''), 'success');
        };
        
        const closeHandler = () => {
            this.closeModal();
        };
        
        saveBtn.onclick = saveHandler;
        cancelBtn.onclick = closeHandler;
        if (closeBtn) closeBtn.onclick = closeHandler;
        
        document.getElementById('emp-name')?.focus();
    }
    
    deleteDepartment(id) {
        const dept = this.dataManager.departments.find(d => d.id === id);
        if (!dept) return;
        
        if (confirm(`Вы уверены, что хотите удалить отдел "${dept.name}"?`)) {
            try {
                this.dataManager.deleteDepartment(id);
                if (this.selectedType === 'department' && this.selectedItem === id) {
                    this.closeDetails();
                }
                this.render();
            } catch (error) {
                alert(error.message);
            }
        }
    }
    
    fireEmployee(id) {
        const emp = this.dataManager.employees.find(e => e.id === id);
        if (!emp) return;
        
        const reason = prompt('Причина увольнения (необязательно):', '');
        if (confirm(`Уволить сотрудника "${emp.name}"?`)) {
            this.dataManager.fireEmployee(id, reason);
            if (this.selectedType === 'employee' && this.selectedItem === id) {
                this.showDetails('employee', id);
            }
            this.render();
        }
    }
    
    rehireEmployee(id) {
        const emp = this.dataManager.employees.find(e => e.id === id);
        if (!emp) return;
        
        if (confirm(`Восстановить сотрудника "${emp.name}"?`)) {
            this.dataManager.rehireEmployee(id);
            if (this.selectedType === 'employee' && this.selectedItem === id) {
                this.showDetails('employee', id);
            }
            this.render();
        }
    }
    
    exportData() {
        const data = this.dataManager.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `org_structure_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.dataManager.importData(data);
                    this.render();
                    alert('Данные успешно импортированы');
                } catch (error) {
                    alert('Ошибка импорта: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    closeModal() {
        const modal = document.getElementById('org-modal');
        modal.style.display = 'none';
        
        const saveBtn = document.getElementById('org-modal-save');
        const cancelBtn = document.getElementById('org-modal-cancel');
        const closeBtn = modal?.querySelector('.org-modal-close');
        
        if (saveBtn) saveBtn.onclick = null;
        if (cancelBtn) cancelBtn.onclick = null;
        if (closeBtn) closeBtn.onclick = null;
    }
    
    plural(n) {
        if (n % 10 === 1 && n % 100 !== 11) return '';
        if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'а';
        return 'ов';
    }
    
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    exportToExcel() {
        const snapshot = this.dataManager.getSnapshot();
        const departments = snapshot.departments;
        const employees = snapshot.employees;
        const positions = snapshot.positions;
        
        const deptData = departments.map(dept => {
            let parentName = '';
            if (dept.parentId) {
                const parent = departments.find(d => d.id === dept.parentId);
                if (parent) parentName = parent.name;
            }
            
            return {
                'ID': dept.id,
                'Название отдела': dept.name,
                'Родительский отдел (ID)': dept.parentId || '',
                'Родительский отдел (название)': parentName,
                'Уровень': dept.level,
                'Порядок': dept.order,
                'Описание': dept.description || '',
                'Дата создания': new Date(dept.createdAt).toLocaleDateString('ru-RU'),
                'Дата обновления': new Date(dept.updatedAt).toLocaleDateString('ru-RU')
            };
        });
        
        const empData = employees.map(emp => {
            const department = departments.find(d => d.id === emp.departmentId);
            const position = positions.find(p => p.id === emp.positionId);
            return {
                'ID': emp.id,
                'ФИО': emp.name,
                'Отдел': department ? department.name : '',
                'ID отдела': emp.departmentId || '',
                'Должность': position ? position.name : '',
                'Email': emp.email || '',
                'Телефон': emp.phone || '',
                'Фото': emp.photo || '',
                'Руководитель': emp.isHead ? 'Да' : 'Нет',
                'Статус': emp.isActive ? 'Активен' : 'Уволен',
                'Дата начала': emp.startDate || '',
                'Дата увольнения': emp.fireDate || '',
                'Причина увольнения': emp.fireReason || '',
                'Дата создания': new Date(emp.createdAt).toLocaleDateString('ru-RU')
            };
        });
        
        const wb = XLSX.utils.book_new();
        
        const deptSheet = XLSX.utils.json_to_sheet(deptData);
        deptSheet['!cols'] = [
            { wch: 8 }, { wch: 35 }, { wch: 15 }, { wch: 30 },
            { wch: 8 }, { wch: 8 }, { wch: 40 }, { wch: 12 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(wb, deptSheet, 'Отделы');
        
        const empSheet = XLSX.utils.json_to_sheet(empData);
        empSheet['!cols'] = [
            { wch: 8 }, { wch: 30 }, { wch: 35 }, { wch: 10 },
            { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
            { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
            { wch: 30 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(wb, empSheet, 'Сотрудники');
        
        const fileName = `org_structure_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        this.showNotification(`✅ Экспортировано ${departments.length} отделов и ${employees.length} сотрудников`, 'success');
    }
    
    importFromExcel() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const deptSheet = workbook.Sheets['Отделы'];
                    const empSheet = workbook.Sheets['Сотрудники'];
                    
                    const deptData = deptSheet ? XLSX.utils.sheet_to_json(deptSheet) : [];
                    const empData = empSheet ? XLSX.utils.sheet_to_json(empSheet) : [];
                    
                    if (deptData.length === 0 && empData.length === 0) {
                        alert('Файл не содержит данных. Убедитесь, что есть листы "Отделы" и "Сотрудники"');
                        return;
                    }
                    
                    const currentEmployees = this.dataManager.employees;
                    const photoMap = new Map();
                    currentEmployees.forEach(emp => {
                        if (emp.photo) {
                            photoMap.set(emp.name, emp.photo);
                        }
                    });
                    
                    if (confirm(`Найдено:\n- ${deptData.length} отделов\n- ${empData.length} сотрудников\n\nИмпортировать? Текущие данные будут заменены, но фото сотрудников сохранятся.`)) {
                        await this.processImportData(deptData, empData, photoMap);
                    }
                    
                } catch (error) {
                    console.error('Ошибка импорта:', error);
                    alert('Ошибка при обработке файла: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        };
        
        input.click();
    }
    
    async processImportData(deptData, empData, existingPhotoMap = new Map()) {
        console.log('📥 Начинаем импорт данных...');
        console.log('Отделов для импорта:', deptData.length);
        console.log('Сотрудников для импорта:', empData.length);
        
        const currentPositions = this.dataManager.positions;
        const nameToIdMap = new Map();
        const newDepartments = [];
        let nextId = Math.max(0, ...this.dataManager.departments.map(d => d.id), 100) + 1;
        
        for (const row of deptData) {
            let id = row['ID'];
            const name = row['Название отдела'] || row['Название'] || row['name'];
            if (!name) continue;
            
            if (!id || isNaN(parseInt(id))) {
                id = nextId++;
            } else {
                id = parseInt(id);
                if (id >= nextId) nextId = id + 1;
            }
            
            const parentIdRaw = row['Родительский отдел (ID)'] || row['Родительский отдел'] || row['parent'];
            let parentId = null;
            
            if (parentIdRaw && parentIdRaw !== '' && !isNaN(parseInt(parentIdRaw))) {
                parentId = parseInt(parentIdRaw);
            }
            
            const newDept = {
                id: id,
                name: name,
                parentId: parentId,
                level: row['Уровень'] || 0,
                order: row['Порядок'] || 0,
                description: row['Описание'] || '',
                headId: null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            nameToIdMap.set(name, id);
            newDepartments.push(newDept);
            console.log(`📁 Отдел: ${name} (ID: ${id}, parentId: ${parentId})`);
        }
        
        for (const dept of newDepartments) {
            const originalRow = deptData.find(r => {
                const rowId = r['ID'];
                const rowName = r['Название отдела'] || r['Название'];
                return (rowId && parseInt(rowId) === dept.id) || rowName === dept.name;
            });
            
            if (originalRow) {
                const parentName = originalRow['Родительский отдел (ID)'] || originalRow['Родительский отдел'];
                if (parentName && typeof parentName === 'string' && isNaN(parseInt(parentName)) && parentName !== '') {
                    if (nameToIdMap.has(parentName)) {
                        dept.parentId = nameToIdMap.get(parentName);
                        console.log(`🔗 Привязан отдел "${dept.name}" к родителю "${parentName}" (ID: ${dept.parentId})`);
                    }
                }
            }
        }
        
        const newEmployees = [];
        const positionMap = new Map();
        currentPositions.forEach(pos => positionMap.set(pos.name, pos.id));
        
        for (const row of empData) {
            const name = row['ФИО'] || row['name'];
            if (!name) continue;
            
            let id = row['ID'];
            if (!id || isNaN(parseInt(id))) {
                id = nextId++;
            } else {
                id = parseInt(id);
                if (id >= nextId) nextId = id + 1;
            }
            
            const deptName = row['Отдел'] || row['department'];
            let departmentId = null;
            
            if (deptName && nameToIdMap.has(deptName)) {
                departmentId = nameToIdMap.get(deptName);
            } else if (deptName) {
                const existingDept = this.dataManager.departments.find(d => d.name === deptName);
                if (existingDept) departmentId = existingDept.id;
            }
            
            const positionName = row['Должность'] || row['position'];
            let positionId = positionMap.get(positionName);
            
            if (positionName && !positionId) {
                const newPosition = this.dataManager.addPosition(positionName);
                positionId = newPosition.id;
                positionMap.set(positionName, positionId);
            }
            
            const isHead = row['Руководитель'] === 'Да' || row['Руководитель'] === true;
            const isActive = row['Статус'] !== 'Уволен';
            const startDate = this.parseExcelDateString(row['Дата начала'] || row['startDate']);
            
            let photo = null;
            const importedPhoto = row['Фото'] || row['photo'];
            if (importedPhoto && importedPhoto.startsWith('data:image')) {
                photo = importedPhoto;
                console.log(`📸 Загружено фото из импорта для: ${name}`);
                if (this.dataManager.saveEmployeePhotoToIndexedDB) {
                    await this.dataManager.saveEmployeePhotoToIndexedDB(id, photo);
                    photo = `__INDEXEDDB__${id}`;
                }
            } else if (existingPhotoMap.has(name)) {
                photo = existingPhotoMap.get(name);
                console.log(`📸 Сохранено существующее фото для: ${name}`);
            }
            
            newEmployees.push({
                id: id,
                name: name,
                departmentId: departmentId,
                positionId: positionId || 8,
                email: row['Email'] || '',
                phone: row['Телефон'] || '',
                photo: photo,
                isHead: isHead,
                isActive: isActive,
                startDate: startDate,
                fireDate: row['Дата увольнения'] || null,
                fireReason: row['Причина увольнения'] || null,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            
            console.log(`👤 Сотрудник: ${name} -> отдел: ${deptName} (ID: ${departmentId}) ${photo ? '📸 с фото' : ''}`);
        }
        
        this.dataManager.departments = newDepartments;
        this.dataManager.employees = newEmployees;
        
        newEmployees.forEach(emp => {
            if (emp.isHead && emp.departmentId) {
                const dept = this.dataManager.departments.find(d => d.id === emp.departmentId);
                if (dept) dept.headId = emp.id;
            }
        });
        
        this.dataManager.saveData();
        await this.render();
        
        console.log('✅ Импорт завершен!');
        console.log(`📊 Итог: ${newDepartments.length} отделов, ${newEmployees.length} сотрудников`);
        
        this.showNotification(`✅ Импортировано ${newDepartments.length} отделов и ${newEmployees.length} сотрудников (фото сохранены)`, 'success');
    }
    
    parseExcelDateString(dateValue) {
        if (!dateValue) return new Date().toISOString().split('T')[0];
        
        if (typeof dateValue === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            const jsDate = new Date(excelEpoch.getTime() + dateValue * 86400000);
            return jsDate.toISOString().split('T')[0];
        }
        
        if (typeof dateValue === 'string') {
            const parts = dateValue.split('.');
            if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                if (year && year.length === 4) {
                    return `${year}-${month}-${day}`;
                }
            }
            
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        }
        
        return new Date().toISOString().split('T')[0];
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${
            type === 'success' ? 'bg-emerald-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="font-medium">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-white/80">&times;</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }
}

window.OrgChartRenderer = OrgChartRenderer;
