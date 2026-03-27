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
        this.filterStatus = '';
        this.lastLegendsHash = '';
        this.legendTimeout = null;
        this.isRendering = false;
        this.chartsInitialized = false;
        
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
        
        // 2. Если нет сохраненного состояния, разворачиваем корневые узлы
        if (!savedExpanded || this.expandedNodes.size === 0) {
            const roots = this.dataManager.departments.filter(d => d.parentId === null);
            roots.forEach(root => this.expandedNodes.add(root.id));
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
        
        // 5. Рендерим графики в правой колонке
        setTimeout(() => {
            this.renderChartsInDetails();
        }, 100);
        
        // 6. Подписка на изменения данных
        this.dataManager.subscribe('renderer', async () => {
            console.log('🔄 Данные изменились, обновляем дерево');
            await this.render();
            setTimeout(() => {
                this.renderChartsInDetails();
            }, 50);
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
                            const deptMatches = dept.name.toLowerCase().includes(this.searchQuery);
                            const employeesMatch = dept.employees.some(emp => 
                                emp.name.toLowerCase().includes(this.searchQuery) ||
                                (this.dataManager.positions.find(p => p.id === emp.positionId)?.name || '').toLowerCase().includes(this.searchQuery) ||
                                (emp.email && emp.email.toLowerCase().includes(this.searchQuery)) ||
                                (emp.phone && emp.phone.toLowerCase().includes(this.searchQuery))
                            );
                            
                            if (deptMatches || employeesMatch) {
                                this.expandedNodes.add(dept.id);
                                if (dept.children && dept.children.length) {
                                    expandMatchingNodes(dept.children);
                                }
                            } else {
                                const hasMatchingChild = dept.children.some(child => 
                                    this.hasMatchingDescendant(child)
                                );
                                if (hasMatchingChild) {
                                    this.expandedNodes.add(dept.id);
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
                this.filterStatus = '';
                this.render();
            });
            this.updateDepartmentFilter();
        }
        
        // Фильтр по должностям
        const filterPos = document.getElementById('org-filter-position');
        if (filterPos) {
            filterPos.addEventListener('change', (e) => {
                this.filterPosition = e.target.value;
                this.filterStatus = '';
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
                this.filterStatus = '';
                if (searchInput) searchInput.value = '';
                if (filterDept) filterDept.value = '';
                if (filterPos) filterPos.value = '';
                
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
        
        const exportJsonBtn = document.getElementById('org-export-json');
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => this.exportData());
        
        const exportExcelBtn = document.getElementById('org-export-excel');
        if (exportExcelBtn) exportExcelBtn.addEventListener('click', () => this.exportToExcel());
        
        const importJsonBtn = document.getElementById('org-import-json');
        if (importJsonBtn) importJsonBtn.addEventListener('click', () => this.importData());
        
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
            const query = this.searchQuery.toLowerCase();
            
            result = result.filter(dept => {
                const deptMatches = dept.name.toLowerCase().includes(query);
                if (deptMatches) return true;
                
                const employeesMatches = dept.employees.some(emp => 
                    emp.name.toLowerCase().includes(query) ||
                    (this.dataManager.positions.find(p => p.id === emp.positionId)?.name || '').toLowerCase().includes(query) ||
                    (emp.email && emp.email.toLowerCase().includes(query)) ||
                    (emp.phone && emp.phone.toLowerCase().includes(query))
                );
                
                const childrenMatches = this.filterTree(dept.children).length > 0;
                return employeesMatches || childrenMatches;
            }).map(dept => {
                const deptMatches = dept.name.toLowerCase().includes(query);
                if (deptMatches) {
                    return {
                        ...dept,
                        employees: dept.employees,
                        children: this.filterTree(dept.children)
                    };
                }
                return {
                    ...dept,
                    employees: dept.employees.filter(emp => 
                        emp.name.toLowerCase().includes(query) ||
                        (this.dataManager.positions.find(p => p.id === emp.positionId)?.name || '').toLowerCase().includes(query) ||
                        (emp.email && emp.email.toLowerCase().includes(query)) ||
                        (emp.phone && emp.phone.toLowerCase().includes(query))
                    ),
                    children: this.filterTree(dept.children)
                };
            });
        }
        
        // Фильтр по статусу (активные/уволенные)
        if (this.filterStatus) {
            result = result.map(dept => ({
                ...dept,
                employees: dept.employees.filter(emp => 
                    this.filterStatus === 'active' ? emp.isActive : !emp.isActive
                ),
                children: this.filterTreeByStatus(dept.children)
            })).filter(dept => dept.employees.length > 0 || dept.children.length > 0);
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
    
    filterTreeByStatus(departments) {
        return departments.map(dept => ({
            ...dept,
            employees: dept.employees.filter(emp => 
                this.filterStatus === 'active' ? emp.isActive : !emp.isActive
            ),
            children: this.filterTreeByStatus(dept.children)
        })).filter(dept => dept.employees.length > 0 || dept.children.length > 0);
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
        
        // Для уволенных сотрудников
        if (!employee.isActive) {
            let avatarHtml = '';
            if (photoUrl && photoUrl.startsWith('data:image')) {
                avatarHtml = `<img src="${photoUrl}" class="org-employee-photo" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; filter: grayscale(0.5); opacity: 0.7;">`;
            } else {
                avatarHtml = `<div class="org-employee-avatar" style="background: #f1f5f9; filter: grayscale(0.3);">🚪</div>`;
            }
            
            return `
                <div class="org-employee-card ${isSelected ? 'selected' : ''}" 
                     data-id="${employee.id}" 
                     data-type="employee"
                     onclick="orgApp.selectItem('employee', ${employee.id})"
                     style="border-left: 3px solid #ef4444; background: #fef2f2;">
                    ${avatarHtml}
                    <div class="org-employee-info">
                        <div class="org-employee-name" style="color: #991b1b;">
                            ${this.escapeHtml(employee.name)}
                            <span class="org-badge-vacancy" style="font-size: 0.65rem; padding: 2px 8px; background: #ef4444; color: white; border-radius: 20px; font-weight: 500; margin-left: 8px;">Вакансия</span>
                        </div>
                        <div class="org-employee-position" style="color: #b91c1c;">
                            <s>${position ? this.escapeHtml(position.name) : ''}</s>
                            <span style="color: #dc2626; font-size: 0.7rem; margin-left: 6px;">Уволен: ${employee.fireDate || '—'}</span>
                        </div>
                        ${employee.fireReason ? `
                            <div class="org-employee-fire-reason" style="font-size: 0.65rem; color: #b91c1c; margin-top: 2px;">
                                📋 Причина: ${this.escapeHtml(employee.fireReason)}
                            </div>
                        ` : ''}
                        ${employee.email ? `<div class="org-employee-contact" style="color: #9ca3af;">✉️ ${this.escapeHtml(employee.email)}</div>` : ''}
                        ${employee.phone ? `<div class="org-employee-contact" style="color: #9ca3af;">📞 ${this.escapeHtml(employee.phone)}</div>` : ''}
                    </div>
                    <div class="org-employee-actions">
                        <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.rehireEmployee(${employee.id})" title="Восстановить" style="color: #10b981;">🔄</button>
                        <button class="org-btn-icon" onclick="event.stopPropagation(); orgApp.editEmployee(${employee.id})" title="Редактировать">✏️</button>
                    </div>
                </div>
            `;
        }
        
        // Активный сотрудник
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
    
    // Подсчет активных и уволенных сотрудников
    const totalEmployees = this.dataManager.employees.filter(e => e.isActive).length;
    const totalFired = this.dataManager.employees.filter(e => !e.isActive).length;
    
    const html = await this.renderTreeAsync(filteredTree);
    
    // Добавляем счетчик вверху
    this.container.innerHTML = `
        <div style="position: relative;">
            <div style="position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end; padding: 8px 16px; background: white; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px;">
                <div style="display: flex; gap: 12px; background: #f8fafc; padding: 6px 12px; border-radius: 30px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1rem;">👥</span>
                        <div>
                            <div style="font-size: 0.6rem; color: #64748b;">Всего</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #1e293b;">${totalEmployees}</div>
                        </div>
                    </div>
                    <div style="width: 1px; background: #e2e8f0;"></div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span style="font-size: 1rem;">🚪</span>
                        <div>
                            <div style="font-size: 0.6rem; color: #64748b;">Вакансии</div>
                            <div style="font-size: 1rem; font-weight: 700; color: #dc2626;">${totalFired}</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="org-chart">${html}</div>
        </div>
    `;
}
drawDepartmentsChartMini(stats) {
    const canvas = document.getElementById('org-departments-chart-details');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const allDepts = stats.deptStats.filter(d => d.count > 0);
    
    if (allDepts.length === 0) {
        if (this.deptsChartDetails) {
            this.deptsChartDetails.destroy();
            this.deptsChartDetails = null;
        }
        return;
    }
    
    const labels = allDepts.map((_, index) => `${index + 1}`);
    const data = allDepts.map(d => d.count);
    const colors = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec489a', '#14b8a6'];
    
    // Если график уже существует - обновляем данные, иначе создаем новый
    if (this.deptsChartDetails) {
        this.deptsChartDetails.data.datasets[0].data = data;
        this.deptsChartDetails.update();
    } else {
        this.deptsChartDetails = new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: data, 
                    backgroundColor: colors.slice(0, allDepts.length), 
                    borderWidth: 0,
                    hoverOffset: 6
                }] 
            },
            options: {
                responsive: true, 
                maintainAspectRatio: true, 
                cutout: '60%',
                animation: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

drawPositionsChartMini(stats) {
    const canvas = document.getElementById('org-positions-chart-details');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const allPositions = stats.positionStats.filter(p => p.count > 0);
    
    if (allPositions.length === 0) {
        if (this.positionsChartDetails) {
            this.positionsChartDetails.destroy();
            this.positionsChartDetails = null;
        }
        return;
    }
    
    const labels = allPositions.map((_, index) => `${index + 1}`);
    const data = allPositions.map(p => p.count);
    const colors = ['#8b5cf6', '#a855f7', '#d946ef', '#ec489a', '#f43f5e', '#fb7185', '#f97316', '#f59e0b', '#eab308', '#84cc16'];
    
    // Если график уже существует - обновляем данные, иначе создаем новый
    if (this.positionsChartDetails) {
        this.positionsChartDetails.data.datasets[0].data = data;
        this.positionsChartDetails.update();
    } else {
        this.positionsChartDetails = new Chart(ctx, {
            type: 'doughnut',
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: data, 
                    backgroundColor: colors.slice(0, allPositions.length), 
                    borderWidth: 0,
                    hoverOffset: 6
                }] 
            },
            options: {
                responsive: true, 
                maintainAspectRatio: true, 
                cutout: '60%',
                animation: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

async filterByDepartment(deptId, deptName) {
    // Сбрасываем другие фильтры
    this.filterDepartment = deptId.toString();
    this.filterPosition = '';
    this.searchQuery = '';
    this.filterStatus = '';
    
    // Очищаем поля поиска
    const searchInput = document.getElementById('org-search');
    if (searchInput) searchInput.value = '';
    
    const filterDept = document.getElementById('org-filter-department');
    if (filterDept) filterDept.value = deptId.toString();
    
    const filterPos = document.getElementById('org-filter-position');
    if (filterPos) filterPos.value = '';
    
    // Сохраняем состояние развернутых узлов
    const savedExpanded = localStorage.getItem('org_expanded_nodes');
    if (savedExpanded) {
        try {
            const expandedArray = JSON.parse(savedExpanded);
            this.expandedNodes = new Set(expandedArray);
        } catch(e) {}
    }
    
    // Перерисовываем дерево (async)
    await this.render();
    
    // Обновляем статистику и графики
    this.renderChartsInDetails();
    
    // Показываем уведомление
    this.showNotification(`🔍 Фильтр по отделу: ${deptName}`, 'info');
    
    // Прокручиваем к отделу
    setTimeout(() => {
        const selectedDept = document.querySelector(`.org-department-node[data-id="${deptId}"]`);
        if (selectedDept) {
            selectedDept.scrollIntoView({ behavior: 'smooth', block: 'center' });
            selectedDept.style.backgroundColor = '#fef3c7';
            setTimeout(() => {
                selectedDept.style.backgroundColor = '';
            }, 2000);
        }
    }, 100);
}
async filterByPosition(posId, posName) {
    // Сбрасываем другие фильтры
    this.filterPosition = posId.toString();
    this.filterDepartment = '';
    this.searchQuery = '';
    this.filterStatus = '';
    
    // Очищаем поля
    const searchInput = document.getElementById('org-search');
    if (searchInput) searchInput.value = '';
    
    const filterDept = document.getElementById('org-filter-department');
    if (filterDept) filterDept.value = '';
    
    const filterPos = document.getElementById('org-filter-position');
    if (filterPos) filterPos.value = posId.toString();
    
    // Сохраняем состояние развернутых узлов
    const savedExpanded = localStorage.getItem('org_expanded_nodes');
    if (savedExpanded) {
        try {
            const expandedArray = JSON.parse(savedExpanded);
            this.expandedNodes = new Set(expandedArray);
        } catch(e) {}
    }
    
    // Перерисовываем дерево (async)
    await this.render();
    
    // Обновляем статистику и графики
    this.renderChartsInDetails();
    
    // Показываем уведомление
    this.showNotification(`🔍 Фильтр по должности: ${posName}`, 'info');
}
renderLegends(stats) {
    // Легенда для отделов
    const deptsLegend = document.getElementById('org-departments-legend');
    if (deptsLegend) {
        const allDepts = stats.deptStats.filter(d => d.count > 0);
        const colors = ['#4f46e5', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec489a', '#14b8a6'];
        
        if (allDepts.length === 0) {
            deptsLegend.innerHTML = '<div style="text-align: center; padding: 12px; color: #94a3b8;">Нет данных</div>';
            return;
        }
        
        deptsLegend.style.height = '140px';
        deptsLegend.style.overflowY = 'auto';
        deptsLegend.style.paddingRight = '4px';
        
        deptsLegend.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${allDepts.map((dept, index) => `
                    <div style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 8px; border-radius: 6px;"
                         onclick="orgApp.filterByDepartment(${dept.id}, '${dept.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
                        <span style="width: 10px; height: 10px; background: ${colors[index % colors.length]}; border-radius: 2px; flex-shrink: 0;"></span>
                        <span style="flex: 1; font-size: 0.7rem; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(dept.name)}</span>
                        <span style="font-size: 0.65rem; font-weight: 500; color: #64748b;">${dept.count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Легенда для должностей
    const positionsLegend = document.getElementById('org-positions-legend');
    if (positionsLegend) {
        const allPositions = stats.positionStats.filter(p => p.count > 0);
        const colors = ['#8b5cf6', '#a855f7', '#d946ef', '#ec489a', '#f43f5e', '#fb7185', '#f97316', '#f59e0b', '#eab308', '#84cc16'];
        
        if (allPositions.length === 0) {
            positionsLegend.innerHTML = '<div style="text-align: center; padding: 12px; color: #94a3b8;">Нет данных</div>';
            return;
        }
        
        positionsLegend.style.height = '140px';
        positionsLegend.style.overflowY = 'auto';
        positionsLegend.style.paddingRight = '4px';
        
        positionsLegend.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${allPositions.map((pos, index) => `
                    <div style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 8px; border-radius: 6px;"
                         onclick="orgApp.filterByPosition(${pos.id}, '${pos.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
                        <span style="width: 10px; height: 10px; background: ${colors[index % colors.length]}; border-radius: 2px; flex-shrink: 0;"></span>
                        <span style="flex: 1; font-size: 0.7rem; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(pos.name)}</span>
                        <span style="font-size: 0.65rem; font-weight: 500; color: #64748b;">${pos.count}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}
async filterByStatus(status) {
    // Сбрасываем другие фильтры
    this.filterDepartment = '';
    this.filterPosition = '';
    this.searchQuery = '';
    
    // Устанавливаем или снимаем фильтр
    if (this.filterStatus === status) {
        this.filterStatus = '';
    } else {
        this.filterStatus = status;
    }
    
    // Очищаем поля
    const searchInput = document.getElementById('org-search');
    if (searchInput) searchInput.value = '';
    
    const filterDept = document.getElementById('org-filter-department');
    if (filterDept) filterDept.value = '';
    
    const filterPos = document.getElementById('org-filter-position');
    if (filterPos) filterPos.value = '';
    
    // Сохраняем состояние развернутых узлов
    const savedExpanded = localStorage.getItem('org_expanded_nodes');
    if (savedExpanded) {
        try {
            const expandedArray = JSON.parse(savedExpanded);
            this.expandedNodes = new Set(expandedArray);
        } catch(e) {}
    }
    
    // Перерисовываем дерево (async)
    await this.render();
    
    // Обновляем статистику и графики
    this.renderChartsInDetails();
    
    // Уведомление
    if (this.filterStatus === 'active') {
        this.showNotification('👥 Показаны только активные сотрудники', 'info');
    } else if (this.filterStatus === 'fired') {
        this.showNotification('🚪 Показаны только вакансии', 'info');
    } else {
        this.showNotification('✅ Показаны все сотрудники', 'success');
    }
}
    
async clearFilters() {
    this.filterDepartment = '';
    this.filterPosition = '';
    this.searchQuery = '';
    this.filterStatus = '';
    
    const searchInput = document.getElementById('org-search');
    if (searchInput) searchInput.value = '';
    
    const filterDept = document.getElementById('org-filter-department');
    if (filterDept) filterDept.value = '';
    
    const filterPos = document.getElementById('org-filter-position');
    if (filterPos) filterPos.value = '';
    
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
    
    // Перерисовываем дерево (async)
    await this.render();
    
    // Обновляем графики
    this.renderChartsInDetails();
    
    this.showNotification('✅ Все фильтры сброшены', 'success');
}
    
   renderStatistics() {
    const snapshot = this.dataManager.getSnapshot();
    const employees = snapshot.employees;
    const departments = snapshot.departments;
    
    // Получаем ВСЕ отделы (включая подотделы)
    const allDepartments = departments.filter(d => d.id !== 1);
    
    // Статистика по отделам - ВСЕ отделы
    const deptStats = allDepartments
        .map(dept => ({
            id: dept.id,
            name: dept.name,
            count: employees.filter(e => e.departmentId === dept.id && e.isActive).length,
            total: employees.filter(e => e.departmentId === dept.id).length,
            fired: employees.filter(e => e.departmentId === dept.id && !e.isActive).length
        }))
        .filter(d => d.count > 0 || d.fired > 0)
        .sort((a, b) => b.count - a.count);
    
    // Статистика по статусам
    const activeCount = employees.filter(e => e.isActive).length;
    const firedCount = employees.filter(e => !e.isActive).length;
    
    // Статистика по должностям
    const positions = snapshot.positions;
    const positionStats = positions
        .map(pos => ({
            id: pos.id,
            name: pos.name,
            count: employees.filter(e => e.positionId === pos.id && e.isActive).length
        }))
        .filter(p => p.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
    
    return {
        deptStats,
        activeCount,
        firedCount,
        positionStats,
        totalEmployees: employees.length
    };
}
    
    selectItem(type, id) {
        this.selectedType = type;
        this.selectedItem = id;
        this.render();
        this.showDetails(type, id);
        setTimeout(() => {
            this.renderChartsInDetails();
        }, 50);
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
                            <select id="employee-status-select" class="org-status-select" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; background: white; font-size: 0.85rem; cursor: pointer;">
                                <option value="true" ${emp.isActive ? 'selected' : ''}>✅ Активен</option>
                                <option value="false" ${!emp.isActive ? 'selected' : ''}>❌ Уволен</option>
                            </select>
                        </div>
                        ${!emp.isActive ? `
                            <div class="org-details-row">
                                <span class="org-details-label">Дата увольнения:</span>
                                <span>${emp.fireDate || '—'}</span>
                            </div>
                            <div class="org-details-row">
                                <span class="org-details-label">Причина увольнения:</span>
                                <input type="text" id="employee-fire-reason" value="${this.escapeHtml(emp.fireReason || '')}" 
                                       style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.85rem;" 
                                       placeholder="Введите причину увольнения">
                            </div>
                        ` : ''}
                        ${emp.isActive ? `
                            <div class="org-details-row">
                                <span class="org-details-label">Дата увольнения:</span>
                                <span>—</span>
                            </div>
                            <div class="org-details-row">
                                <span class="org-details-label">Причина увольнения:</span>
                                <input type="text" id="employee-fire-reason" value="" 
                                       style="width: 100%; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 0.85rem;" 
                                       placeholder="Причина (заполнится при увольнении)">
                            </div>
                        ` : ''}
                    </div>
                    <div class="org-details-actions">
                        <button class="btn-secondary" onclick="orgApp.editEmployee(${emp.id})">✏️ Редактировать</button>
                        <button class="btn-primary" onclick="orgApp.updateEmployeeStatus(${emp.id})">💾 Сохранить статус</button>
                        ${emp.isActive ? 
                            `<button class="btn-danger" onclick="orgApp.fireEmployeeWithReason(${emp.id})">🚪 Уволить</button>` :
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
    
    // Очищаем таймаут легенды
    if (this.legendTimeout) {
        clearTimeout(this.legendTimeout);
        this.legendTimeout = null;
    }
    
    const detailsContainer = document.getElementById('org-details-content');
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div class="org-details-empty">
                <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                    <p>Выберите отдел или сотрудника</p>
                    <p style="font-size: 0.75rem; margin-top: 8px;">Нажмите на элемент в структуре слева</p>
                </div>
            </div>
        `;
    }
    
    setTimeout(() => {
        this.renderChartsInDetails();
    }, 50);
    
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
        
        const lowerQuery = query.toLowerCase();
        
        if (node.name.toLowerCase().includes(lowerQuery)) return true;
        
        for (const child of node.children) {
            if (this.hasMatchingDescendant(child, query)) return true;
        }
        
        if (node.employees && node.employees.length) {
            for (const emp of node.employees) {
                const position = this.dataManager.positions.find(p => p.id === emp.positionId);
                if (emp.name.toLowerCase().includes(lowerQuery) ||
                    (position && position.name.toLowerCase().includes(lowerQuery)) ||
                    (emp.email && emp.email.toLowerCase().includes(lowerQuery)) ||
                    (emp.phone && emp.phone.toLowerCase().includes(lowerQuery))) {
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
                if (emp.phone && emp.phone.toLowerCase().includes(lowerQuery)) return true;
            }
        }
        
        return false;
    }
    
    async updateEmployeeStatus(id) {
        const statusSelect = document.getElementById('employee-status-select');
        const fireReasonInput = document.getElementById('employee-fire-reason');
        
        if (!statusSelect) return;
        
        const newStatus = statusSelect.value === 'true';
        const fireReason = fireReasonInput ? fireReasonInput.value.trim() : '';
        
        const employee = this.dataManager.employees.find(e => e.id === id);
        if (!employee) return;
        
        if (newStatus === employee.isActive) {
            if (!newStatus && fireReason !== employee.fireReason) {
                this.dataManager.updateEmployee(id, { fireReason: fireReason });
                this.showNotification(`📝 Причина увольнения обновлена`, 'info');
                await this.render();
                this.showDetails('employee', id);
                await this.saveToGitHubAfterChange();
            }
            return;
        }
        
        if (newStatus && !employee.isActive) {
            this.dataManager.rehireEmployee(id);
            this.showNotification(`✅ Сотрудник "${employee.name}" восстановлен`, 'success');
        } else if (!newStatus && employee.isActive) {
            const reason = fireReason || prompt('Причина увольнения:', '');
            this.dataManager.fireEmployee(id, reason);
            this.showNotification(`❌ Сотрудник "${employee.name}" уволен`, 'info');
        }
        
        await this.render();
        this.showDetails('employee', id);
        await this.saveToGitHubAfterChange();
    }
    
async saveToGitHubAfterChange() {
    const savedToken = localStorage.getItem('github_token');
    if (!savedToken) {
        this.showNotification('💾 Данные сохранены локально. Для синхронизации с GitHub нажмите "Сохранить в GitHub"', 'info');
        return;
    }
    
    try {
        const snapshot = this.dataManager.getSnapshot();
        
        // ===== ВАЖНО: ЗАГРУЖАЕМ ФОТО ИЗ INDEXEDDB И ВСТРАИВАЕМ В JSON =====
        const employeesWithPhotos = [];
        let photoCount = 0;
        
        console.log(`📸 Загрузка фото для ${snapshot.employees.length} сотрудников...`);
        
        for (const emp of snapshot.employees) {
            const empCopy = { ...emp };
            
            // Загружаем фото из IndexedDB
            if (emp.photo && emp.photo.startsWith('__INDEXEDDB__')) {
                try {
                    const photoData = await this.dataManager.loadEmployeePhotoFromIndexedDB(emp.id);
                    if (photoData && photoData.startsWith('data:image')) {
                        empCopy.photo = photoData; // ВСТРАИВАЕМ фото в JSON
                        photoCount++;
                        console.log(`📸 Фото для ${emp.name} встроено (${Math.round(photoData.length / 1024)} KB)`);
                    } else {
                        console.warn(`⚠️ Не удалось загрузить фото для ${emp.name}`);
                        empCopy.photo = null;
                    }
                } catch (err) {
                    console.error(`❌ Ошибка загрузки фото для ${emp.name}:`, err);
                    empCopy.photo = null;
                }
            } else if (emp.photo && emp.photo.startsWith('data:image')) {
                // Фото уже в base64
                empCopy.photo = emp.photo;
                photoCount++;
            }
            
            employeesWithPhotos.push(empCopy);
        }
        
        console.log(`📸 Встроено ${photoCount} фото в JSON для GitHub`);
        
        const calculatorData = JSON.parse(localStorage.getItem('gko_calculator_data_v1') || '{}');
        
        const allData = {
            version: "3.0",
            exportDate: new Date().toISOString(),
            npas: window.appData || [],
            dashboards: window.dashboardsData || [],
            orgStructure: {
                departments: snapshot.departments,
                employees: employeesWithPhotos, // С ВСТРОЕННЫМИ фото!
                positions: snapshot.positions,
                version: "3.0"
            },
            calculator: calculatorData,
            metadata: {
                npaCount: window.appData?.length || 0,
                dashboardsCount: window.dashboardsData?.length || 0,
                departmentsCount: snapshot.departments.length,
                employeesCount: snapshot.employees.length,
                photosEmbedded: photoCount,
                lastUpdated: new Date().toISOString()
            }
        };
        
        const content = JSON.stringify(allData, null, 2);
        const contentSize = Math.round(content.length / 1024);
        console.log(`📤 Размер JSON: ${contentSize} KB, фото: ${photoCount}`);
        
        const owner = 'mark98molchanov-a11y';
        const repo = 'a13y.gko-registry-system';
        const path = 'gko_all_data.json';
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        
        let sha = null;
        try {
            const res = await fetch(apiUrl, {
                headers: { 'Authorization': `token ${savedToken}` }
            });
            if (res.ok) {
                const data = await res.json();
                sha = data.sha;
                console.log('📁 Существующий файл найден, sha:', sha);
            }
        } catch (e) {
            console.log('📁 Файл не существует, будет создан новый');
        }
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${savedToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Автосохранение: ${photoCount} фото, ${new Date().toLocaleString('ru-RU')}`,
                content: btoa(unescape(encodeURIComponent(content))),
                sha: sha
            })
        });
        
        if (response.ok) {
            this.showNotification(`💾 Изменения сохранены в GitHub (${photoCount} фото)`, 'success');
        } else {
            const error = await response.json();
            console.error('❌ Ошибка GitHub:', error);
            this.showNotification(`⚠️ Ошибка сохранения: ${error.message}`, 'error');
        }
        
    } catch (error) {
        console.error('❌ Ошибка:', error);
        this.showNotification('⚠️ Не удалось сохранить в GitHub, данные сохранены локально', 'warning');
    }
}
    
    async fireEmployeeWithReason(id) {
        const emp = this.dataManager.employees.find(e => e.id === id);
        if (!emp) return;
        
        const reason = prompt('Причина увольнения:', '');
        if (confirm(`Уволить сотрудника "${emp.name}"?`)) {
            this.dataManager.fireEmployee(id, reason);
            await this.render();
            this.showDetails('employee', id);
            this.showNotification(`❌ Сотрудник "${emp.name}" уволен`, 'info');
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
        } else {
            this.expandedNodes.add(id);
        }
        
        localStorage.setItem('org_expanded_nodes', JSON.stringify(Array.from(this.expandedNodes)));
        this.render();
    }
    
    expandAll() {
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
        this.expandedNodes.clear();
        localStorage.setItem('org_expanded_nodes', JSON.stringify(Array.from(this.expandedNodes)));
        this.render();
        this.showNotification('✅ Все отделы свернуты', 'success');
    }
    
    toggleDepartmentExpand(id) {
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
            
            const parentId = document.getElementById('dept-parent').value;
            const description = document.getElementById('dept-description').value;
            
            this.dataManager.addDepartment(name, parentId ? parseInt(parentId) : null, description);
            this.closeModal();
            this.render();
            this.showNotification(`✅ Отдел "${name}" добавлен`, 'success');
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
        
        let newPhotoBase64 = null;
        
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
        const previewImg = photoPreview?.querySelector('img');
        
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
                    };
                    reader.readAsDataURL(file);
                } else {
                    photoPreview.style.display = 'none';
                    newPhotoBase64 = null;
                }
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
            
            const departmentId = parseInt(document.getElementById('emp-department').value);
            const positionId = parseInt(document.getElementById('emp-position').value);
            const email = document.getElementById('emp-email').value;
            const phone = document.getElementById('emp-phone').value;
            const isHead = document.getElementById('emp-is-head').checked;
            
            const newEmployee = this.dataManager.addEmployee({
                name,
                departmentId,
                positionId,
                email,
                phone,
                photo: null,
                isHead,
                startDate: new Date().toISOString().split('T')[0]
            });
            
            if (newPhotoBase64 && this.dataManager.saveEmployeePhotoToIndexedDB) {
                await this.dataManager.saveEmployeePhotoToIndexedDB(newEmployee.id, newPhotoBase64);
                this.dataManager.updateEmployee(newEmployee.id, { photo: `__INDEXEDDB__${newEmployee.id}` });
            }
            
            this.closeModal();
            await this.render();
            this.showNotification(`✅ Сотрудник "${name}" добавлен`, 'success');
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
                if (window.photoDB) {
                    await window.photoDB.deletePhoto(id);
                }
            } else if (newPhotoBase64) {
                finalPhoto = newPhotoBase64;
                if (this.dataManager.saveEmployeePhotoToIndexedDB) {
                    await this.dataManager.saveEmployeePhotoToIndexedDB(id, finalPhoto);
                    finalPhoto = `__INDEXEDDB__${id}`;
                }
            } else {
                finalPhoto = originalPhoto;
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
            
            this.dataManager.updateEmployee(id, updates);
            this.closeModal();
            await this.render();
            this.showNotification('✅ Сотрудник сохранен' + (finalPhoto ? ' с фото' : ''), 'success');
        };
        
        const closeHandler = () => this.closeModal();
        
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
    
 async exportData() {
    this.showNotification('📦 Экспорт данных с фото...', 'info');
    
    const snapshot = this.dataManager.getSnapshot();
    
    // Создаем копию сотрудников и загружаем их фото
    const employeesWithPhotos = [];
    let photoCount = 0;
    
    for (const emp of snapshot.employees) {
        const empCopy = { ...emp };
        
        // Загружаем фото из IndexedDB и встраиваем в JSON
        if (emp.photo && emp.photo.startsWith('__INDEXEDDB__')) {
            const photoData = await this.dataManager.loadEmployeePhotoFromIndexedDB(emp.id);
            if (photoData) {
                empCopy.photo = photoData; // ВСТРАИВАЕМ фото в JSON
                photoCount++;
                console.log(`📸 Фото для ${emp.name} встроено в JSON (${Math.round(photoData.length / 1024)} KB)`);
            }
        }
        
        employeesWithPhotos.push(empCopy);
    }
    
    const exportData = {
        version: '3.0',
        exportDate: new Date().toISOString(),
        departments: snapshot.departments,
        employees: employeesWithPhotos, // Здесь фото уже встроены
        positions: snapshot.positions,
        metadata: {
            photoCount: photoCount,
            totalEmployees: snapshot.employees.length,
            exportFormat: 'v3_with_embedded_photos'
        }
    };
    
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org_structure_with_photos_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showNotification(`✅ Экспортировано: ${snapshot.departments.length} отделов, ${snapshot.employees.length} сотрудников, ${photoCount} фото встроено в JSON`, 'success');
}
   async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        this.showNotification('⏳ Импорт данных с фото...', 'info');
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                console.log('📦 Импорт данных, фото в файле:', data.metadata?.photoCount || 0);
                
                // Загружаем отделы и должности
                if (data.departments) this.dataManager.departments = data.departments;
                if (data.positions) this.dataManager.positions = data.positions;
                
                // Восстанавливаем сотрудников и сохраняем фото в IndexedDB
                let restoredPhotoCount = 0;
                
                if (data.employees) {
                    for (const emp of data.employees) {
                        // Если в JSON есть фото (base64), сохраняем в IndexedDB
                        if (emp.photo && emp.photo.startsWith('data:image')) {
                            console.log(`📸 Сохранение фото для ${emp.name} в IndexedDB...`);
                            
                            // Сохраняем фото в IndexedDB
                            if (this.dataManager.saveEmployeePhotoToIndexedDB) {
                                await this.dataManager.saveEmployeePhotoToIndexedDB(emp.id, emp.photo);
                                emp.photo = `__INDEXEDDB__${emp.id}`; // Меняем на ссылку
                                restoredPhotoCount++;
                            }
                        }
                    }
                    this.dataManager.employees = data.employees;
                }
                
                // Сохраняем данные
                await this.dataManager.saveData();
                await this.render();
                
                this.showNotification(
                    `✅ Импорт завершен!\n` +
                    `📁 Отделов: ${data.departments?.length || 0}\n` +
                    `👥 Сотрудников: ${data.employees?.length || 0}\n` +
                    `📸 Фото восстановлено: ${restoredPhotoCount}`,
                    'success'
                );
                
            } catch (error) {
                console.error('❌ Ошибка импорта:', error);
                alert('Ошибка при импорте: ' + error.message);
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
    
    async exportToExcel() {
        this.showNotification('📦 Подготовка данных для экспорта...', 'info');
        
        const snapshot = this.dataManager.getSnapshot();
        const employees = snapshot.employees;
        const departments = snapshot.departments;
        const positions = snapshot.positions;
        
        const zip = new JSZip();
        
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
        
        const empData = [];
        let photoCount = 0;
        
        for (const emp of employees) {
            let photoUrl = null;
            let hasPhoto = false;
            
            if (emp.photo) {
                if (emp.photo.startsWith('__INDEXEDDB__')) {
                    if (this.dataManager.loadEmployeePhotoFromIndexedDB) {
                        photoUrl = await this.dataManager.loadEmployeePhotoFromIndexedDB(emp.id);
                        hasPhoto = !!photoUrl;
                    }
                } else if (emp.photo.startsWith('data:image')) {
                    photoUrl = emp.photo;
                    hasPhoto = true;
                }
            }
            
            const department = departments.find(d => d.id === emp.departmentId);
            const position = positions.find(p => p.id === emp.positionId);
            
            empData.push({
                'ID': emp.id,
                'ФИО': emp.name,
                'Отдел': department ? department.name : '',
                'ID отдела': emp.departmentId || '',
                'Должность': position ? position.name : '',
                'Email': emp.email || '',
                'Телефон': emp.phone || '',
                'Руководитель': emp.isHead ? 'Да' : 'Нет',
                'Статус': emp.isActive ? 'Активен' : 'Уволен',
                'Дата начала': emp.startDate || '',
                'Дата увольнения': emp.fireDate || '',
                'Причина увольнения': emp.fireReason || '',
                'Есть фото': hasPhoto ? 'Да' : 'Нет',
                'Дата создания': new Date(emp.createdAt).toLocaleDateString('ru-RU')
            });
            
            if (photoUrl && photoUrl.startsWith('data:image')) {
                const base64Data = photoUrl.split(',')[1];
                if (base64Data) {
                    const filename = `${emp.id}_${this.sanitizeFilename(emp.name)}.jpg`;
                    zip.file(`photos/${filename}`, base64Data, { base64: true });
                    photoCount++;
                }
            }
        }
        
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
            { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 10 },
            { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
            { wch: 8 }, { wch: 12 }
        ];
        XLSX.utils.book_append_sheet(wb, empSheet, 'Сотрудники');
        
        const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
        zip.file('org_structure.xlsx', excelBuffer);
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `org_structure_${new Date().toISOString().split('T')[0]}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification(`✅ Экспортировано: ${departments.length} отделов, ${employees.length} сотрудников, ${photoCount} фото`, 'success');
    }
    
    sanitizeFilename(name) {
        if (!name) return 'unknown';
        return name
            .replace(/[^а-яА-Яa-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 50);
    }
    
    importFromExcel() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls, .zip';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            this.showNotification('📦 Обработка файла...', 'info');
            
            try {
                const isZip = file.name.toLowerCase().endsWith('.zip');
                let deptData = [];
                let empData = [];
                let photoMap = new Map();
                
                if (isZip) {
                    const zip = await JSZip.loadAsync(file);
                    
                    const excelFile = zip.file('org_structure.xlsx');
                    if (!excelFile) {
                        throw new Error('Файл org_structure.xlsx не найден в архиве');
                    }
                    
                    const excelBuffer = await excelFile.async('arraybuffer');
                    const workbook = XLSX.read(excelBuffer, { type: 'array' });
                    
                    const deptSheet = workbook.Sheets['Отделы'];
                    if (deptSheet) {
                        deptData = XLSX.utils.sheet_to_json(deptSheet);
                    } else {
                        throw new Error('Лист "Отделы" не найден в файле');
                    }
                    
                    const empSheet = workbook.Sheets['Сотрудники'];
                    if (empSheet) {
                        empData = XLSX.utils.sheet_to_json(empSheet);
                    } else {
                        throw new Error('Лист "Сотрудники" не найден в файле');
                    }
                    
                    const photoFiles = Object.keys(zip.files).filter(name => 
                        name.startsWith('photos/') && !name.endsWith('/')
                    );
                    
                    for (const photoPath of photoFiles) {
                        try {
                            const photoFile = zip.file(photoPath);
                            if (photoFile) {
                                const base64 = await photoFile.async('base64');
                                const filename = photoPath.replace('photos/', '');
                                const match = filename.match(/^(\d+)_/);
                                if (match) {
                                    const employeeId = parseInt(match[1]);
                                    photoMap.set(employeeId, `data:image/jpeg;base64,${base64}`);
                                }
                            }
                        } catch (err) {
                            console.warn(`Не удалось загрузить фото: ${photoPath}`, err);
                        }
                    }
                } else {
                    const data = new Uint8Array(await file.arrayBuffer());
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const deptSheet = workbook.Sheets['Отделы'];
                    const empSheet = workbook.Sheets['Сотрудники'];
                    
                    deptData = deptSheet ? XLSX.utils.sheet_to_json(deptSheet) : [];
                    empData = empSheet ? XLSX.utils.sheet_to_json(empSheet) : [];
                }
                
                if (deptData.length === 0 && empData.length === 0) {
                    alert('Файл не содержит данных. Убедитесь, что есть листы "Отделы" и "Сотрудники"');
                    return;
                }
                
                const currentEmployees = this.dataManager.employees;
                const existingPhotoMap = new Map();
                currentEmployees.forEach(emp => {
                    if (emp.photo) {
                        existingPhotoMap.set(emp.name, emp.photo);
                    }
                });
                
                if (confirm(`Найдено:\n- ${deptData.length} отделов\n- ${empData.length} сотрудников\n- ${photoMap.size} фото\n\nИмпортировать?`)) {
                    await this.processImportData(deptData, empData, existingPhotoMap, photoMap);
                }
                
            } catch (error) {
                console.error('Ошибка импорта:', error);
                alert('Ошибка при обработке файла: ' + error.message);
            }
        };
        
        input.click();
    }
    
    async processImportData(deptData, empData, existingPhotoMap = new Map(), zipPhotoMap = new Map()) {
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
        }
        
        for (const dept of newDepartments) {
            const originalRow = deptData.find(r => {
                const rowId = r['ID'];
                const rowName = r['Название отдела'] || r['Название'];
                return (rowId && parseInt(rowId) === dept.id) || rowName === dept.name;
            });
            
            if (originalRow) {
                const parentName = originalRow['Родительский отдел (название)'] || originalRow['Родительский отдел'];
                if (parentName && typeof parentName === 'string' && isNaN(parseInt(parentName)) && parentName !== '') {
                    if (nameToIdMap.has(parentName)) {
                        dept.parentId = nameToIdMap.get(parentName);
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
            
            if (zipPhotoMap.has(id)) {
                photo = zipPhotoMap.get(id);
            } else if (row['Фото'] && row['Фото'].startsWith('data:image')) {
                photo = row['Фото'];
            } else if (existingPhotoMap.has(name)) {
                photo = existingPhotoMap.get(name);
            }
            
            if (photo && photo.startsWith('data:image')) {
                if (this.dataManager.saveEmployeePhotoToIndexedDB) {
                    await this.dataManager.saveEmployeePhotoToIndexedDB(id, photo);
                    photo = `__INDEXEDDB__${id}`;
                }
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
        
        this.showNotification(`✅ Импортировано ${newDepartments.length} отделов и ${newEmployees.length} сотрудников`, 'success');
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
    
 renderChartsInDetails() {
    const stats = this.renderStatistics();
    const detailsPanel = document.getElementById('org-details-panel');
    if (!detailsPanel) return;
    
    let chartsContainer = document.getElementById('org-charts-in-details');
    
    if (!chartsContainer) {
        chartsContainer = document.createElement('div');
        chartsContainer.id = 'org-charts-in-details';
        chartsContainer.style.cssText = `
            margin-top: 8px;
            padding: 12px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        `;
        detailsPanel.appendChild(chartsContainer);
        
        chartsContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 0.75rem; font-weight: 600; color: #1e293b;">📊 Статистика сотрудников</span>
                <button id="clear-filters-btn" style="font-size: 0.65rem; color: #3b82f6; background: #eff6ff; border: none; cursor: pointer; padding: 4px 12px; border-radius: 6px;">Сбросить все</button>
            </div>
            
            <div style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 0.7rem; color: #475569;">Активные сотрудники</span>
                    <span id="active-count-label" style="font-size: 0.7rem; font-weight: 500; color: #10b981;">0 из 0</span>
                </div>
                <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                    <div id="progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #34d399); border-radius: 4px;"></div>
                </div>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button id="filter-active-btn" style="flex: 1; padding: 8px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 500; cursor: pointer; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    👥 Активные <span id="active-count">0</span>
                </button>
                <button id="filter-fired-btn" style="flex: 1; padding: 8px 12px; border-radius: 8px; font-size: 0.7rem; font-weight: 500; cursor: pointer; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">
                    🚪 Вакансии <span id="fired-count">0</span>
                </button>
            </div>
            
            <div style="display: flex; gap: 16px;">
                <div style="flex: 1;">
                    <div style="text-align: center; margin-bottom: 8px;">
                        <span style="font-size: 0.7rem; font-weight: 500; color: #475569;">📁 Отделы</span>
                    </div>
                    <div style="position: relative; height: 120px;">
                        <canvas id="org-departments-chart-details" style="height: 120px; width: 100%;"></canvas>
                    </div>
                    <div id="org-departments-legend" style="margin-top: 8px; max-height: 140px; overflow-y: auto;"></div>
                </div>
                <div style="flex: 1;">
                    <div style="text-align: center; margin-bottom: 8px;">
                        <span style="font-size: 0.7rem; font-weight: 500; color: #475569;">💼 Должности</span>
                    </div>
                    <div style="position: relative; height: 120px;">
                        <canvas id="org-positions-chart-details" style="height: 120px; width: 100%;"></canvas>
                    </div>
                    <div id="org-positions-legend" style="margin-top: 8px; max-height: 140px; overflow-y: auto;"></div>
                </div>
            </div>
        `;
        
        document.getElementById('clear-filters-btn')?.addEventListener('click', () => this.clearFilters());
        document.getElementById('filter-active-btn')?.addEventListener('click', () => this.filterByStatus('active'));
        document.getElementById('filter-fired-btn')?.addEventListener('click', () => this.filterByStatus('fired'));
        
        // Добавляем обработчики клика на графики ТОЛЬКО ОДИН РАЗ при создании
        const deptsCanvas = document.getElementById('org-departments-chart-details');
        const positionsCanvas = document.getElementById('org-positions-chart-details');
        
        if (deptsCanvas && !deptsCanvas.hasClickListener) {
            deptsCanvas.style.cursor = 'pointer';
            deptsCanvas.addEventListener('click', (e) => {
                if (this.deptsChartDetails && this.deptsChartDetails.getElementsAtEvent) {
                    const activePoints = this.deptsChartDetails.getElementsAtEvent(e);
                    if (activePoints && activePoints.length > 0) {
                        const index = activePoints[0].index;
                        const dept = stats.deptStats.filter(d => d.count > 0)[index];
                        if (dept) {
                            this.filterByDepartment(dept.id, dept.name);
                        }
                    }
                }
            });
            deptsCanvas.hasClickListener = true;
        }
        
        if (positionsCanvas && !positionsCanvas.hasClickListener) {
            positionsCanvas.style.cursor = 'pointer';
            positionsCanvas.addEventListener('click', (e) => {
                if (this.positionsChartDetails && this.positionsChartDetails.getElementsAtEvent) {
                    const activePoints = this.positionsChartDetails.getElementsAtEvent(e);
                    if (activePoints && activePoints.length > 0) {
                        const index = activePoints[0].index;
                        const position = stats.positionStats.filter(p => p.count > 0)[index];
                        if (position) {
                            this.filterByPosition(position.id, position.name);
                        }
                    }
                }
            });
            positionsCanvas.hasClickListener = true;
        }
        
        this.chartsInitialized = true;
    }
    
    const total = stats.activeCount + stats.firedCount;
    const activePercent = total > 0 ? (stats.activeCount / total) * 100 : 0;
    
    const progressFill = document.getElementById('progress-fill');
    if (progressFill) progressFill.style.width = `${activePercent}%`;
    
    const activeCountLabel = document.getElementById('active-count-label');
    if (activeCountLabel) activeCountLabel.textContent = `${stats.activeCount} из ${total}`;
    
    const activeCountSpan = document.getElementById('active-count');
    if (activeCountSpan) activeCountSpan.textContent = stats.activeCount;
    
    const firedCountSpan = document.getElementById('fired-count');
    if (firedCountSpan) firedCountSpan.textContent = stats.firedCount;
    
    const activeBtn = document.getElementById('filter-active-btn');
    const firedBtn = document.getElementById('filter-fired-btn');
    
    if (activeBtn) {
        if (this.filterStatus === 'active') {
            activeBtn.style.background = '#10b981';
            activeBtn.style.color = 'white';
            activeBtn.style.border = 'none';
        } else {
            activeBtn.style.background = '#f1f5f9';
            activeBtn.style.color = '#475569';
            activeBtn.style.border = '1px solid #e2e8f0';
        }
    }
    
    if (firedBtn) {
        if (this.filterStatus === 'fired') {
            firedBtn.style.background = '#ef4444';
            firedBtn.style.color = 'white';
            firedBtn.style.border = 'none';
        } else {
            firedBtn.style.background = '#f1f5f9';
            firedBtn.style.color = '#475569';
            firedBtn.style.border = '1px solid #e2e8f0';
        }
    }
    
    this.drawDepartmentsChartMini(stats);
    this.drawPositionsChartMini(stats);
    this.renderLegends(stats);
}
    
} // ← ЗАКРЫВАЮЩАЯ СКОБКА КЛАССА

window.OrgChartRenderer = OrgChartRenderer;
