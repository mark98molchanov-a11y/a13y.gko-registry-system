// js/data-manager.js
class OrgDataManager {
    constructor() {
        this.departments = [];
        this.employees = [];
        this.positions = [];
        this.changeHistory = [];
        this.listeners = new Map();
        this.nextId = {
            department: 100,
            employee: 1000,
            position: 10
        };
        
        this.initData();
    }
    
    initData() {
        const saved = localStorage.getItem('org_data_v3');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.departments = data.departments || [];
                this.employees = data.employees || [];
                this.positions = data.positions || [];
                this.nextId = data.nextId || this.nextId;
                this.changeHistory = data.changeHistory || [];
            } catch(e) {
                this.setDefaultData();
            }
        } else {
            this.setDefaultData();
        }
    }
    
    setDefaultData() {
        // Должности
        this.positions = [
            { id: 1, name: 'Директор', level: 10, order: 0 },
            { id: 2, name: 'Заместитель директора', level: 9, order: 1 },
            { id: 3, name: 'Начальник отдела', level: 8, order: 2 },
            { id: 4, name: 'Заместитель начальника отдела', level: 7, order: 3 },
            { id: 5, name: 'Главный специалист', level: 6, order: 4 },
            { id: 6, name: 'Ведущий специалист', level: 5, order: 5 },
            { id: 7, name: 'Специалист 1 категории', level: 4, order: 6 },
            { id: 8, name: 'Специалист', level: 3, order: 7 }
        ];
        
        // Отделы
        this.departments = [
            { id: 1, name: 'Отдел ГКО', parentId: null, level: 0, order: 0, description: 'Главный отдел', headId: null, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 2, name: 'Отдел кадастровой оценки', parentId: 1, level: 1, order: 0, description: 'Кадастровая оценка недвижимости', headId: null, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 3, name: 'Сектор анализа', parentId: 2, level: 2, order: 0, description: 'Анализ кадастровой стоимости', headId: null, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 4, name: 'Сектор методологии', parentId: 2, level: 2, order: 1, description: 'Методология оценки', headId: null, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 5, name: 'Отдел земельного контроля', parentId: 1, level: 1, order: 1, description: 'Контроль за земельными участками', headId: null, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 6, name: 'Сектор проверок', parentId: 5, level: 2, order: 0, description: 'Проведение проверок', headId: null, createdAt: Date.now(), updatedAt: Date.now() },
            { id: 7, name: 'Сектор аналитики', parentId: 5, level: 2, order: 1, description: 'Аналитика нарушений', headId: null, createdAt: Date.now(), updatedAt: Date.now() }
        ];
        
        // Сотрудники
        this.employees = [
            { id: 1, name: 'Иванов Иван Иванович', departmentId: 1, positionId: 1, email: 'i.ivanov@gko.ru', phone: '+7 (495) 123-45-67', isHead: true, isActive: true, startDate: '2020-01-15', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 2, name: 'Петров Петр Петрович', departmentId: 2, positionId: 3, email: 'p.petrov@gko.ru', phone: '+7 (495) 234-56-78', isHead: true, isActive: true, startDate: '2020-03-20', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 3, name: 'Сидоров Сидор Сидорович', departmentId: 3, positionId: 5, email: 's.sidorov@gko.ru', phone: '+7 (495) 345-67-89', isHead: true, isActive: true, startDate: '2021-02-10', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 4, name: 'Кузнецова Анна Сергеевна', departmentId: 3, positionId: 6, email: 'a.kuznetsova@gko.ru', phone: '+7 (495) 456-78-90', isHead: false, isActive: true, startDate: '2021-05-15', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 5, name: 'Смирнова Ольга Владимировна', departmentId: 4, positionId: 5, email: 'o.smirnova@gko.ru', phone: '+7 (495) 567-89-01', isHead: true, isActive: true, startDate: '2021-03-01', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 6, name: 'Козлов Константин Константинович', departmentId: 5, positionId: 3, email: 'k.kozlov@gko.ru', phone: '+7 (495) 678-90-12', isHead: true, isActive: true, startDate: '2020-06-10', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 7, name: 'Лебедева Людмила Петровна', departmentId: 6, positionId: 5, email: 'l.lebedeva@gko.ru', phone: '+7 (495) 789-01-23', isHead: true, isActive: true, startDate: '2021-07-20', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 8, name: 'Соколов Сергей Сергеевич', departmentId: 6, positionId: 6, email: 's.sokolov@gko.ru', phone: '+7 (495) 890-12-34', isHead: false, isActive: true, startDate: '2022-01-15', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 9, name: 'Павлов Павел Павлович', departmentId: 7, positionId: 5, email: 'p.pavlov@gko.ru', phone: '+7 (495) 901-23-45', isHead: true, isActive: true, startDate: '2021-09-01', createdAt: Date.now(), updatedAt: Date.now() },
            { id: 10, name: 'Романова Римма Романовна', departmentId: 7, positionId: 6, email: 'r.romanova@gko.ru', phone: '+7 (495) 012-34-56', isHead: false, isActive: true, startDate: '2022-03-10', createdAt: Date.now(), updatedAt: Date.now() }
        ];
        
        // Устанавливаем руководителей
        this.employees.forEach(emp => {
            if (emp.isHead) {
                const dept = this.departments.find(d => d.id === emp.departmentId);
                if (dept) dept.headId = emp.id;
            }
        });
        
        this.saveData();
    }
    
    saveData() {
        const data = {
            departments: this.departments,
            employees: this.employees,
            positions: this.positions,
            nextId: this.nextId,
            changeHistory: this.changeHistory,
            version: '3.0',
            lastUpdated: Date.now()
        };
        
        localStorage.setItem('org_data_v3', JSON.stringify(data));
        this.notifyListeners();
    }
    
    subscribe(id, callback) {
        this.listeners.set(id, callback);
        return () => this.listeners.delete(id);
    }
    
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.getSnapshot()));
    }
    
    getSnapshot() {
        return {
            departments: [...this.departments],
            employees: [...this.employees],
            positions: [...this.positions]
        };
    }
    addPosition(name, level = 0) {
    const newId = Math.max(0, ...this.positions.map(p => p.id), 10) + 1;
    
    const newPosition = {
        id: newId,
        name: name.trim(),
        level: level,
        order: this.positions.length,
        createdAt: Date.now()
    };
    
    this.positions.push(newPosition);
    this.saveData();
    this.addToHistory('add_position', { name: name });
    
    return newPosition;
}

/**
 * Получение должности по имени (создает если нет)
 */
getOrCreatePosition(name) {
    if (!name) return null;
    
    let position = this.positions.find(p => p.name === name);
    if (!position) {
        position = this.addPosition(name);
    }
    return position;
}

/**
 * Получение отдела по имени
 */
getDepartmentByName(name) {
    return this.departments.find(d => d.name === name);
}

/**
 * Получение всех отделов плоским списком с путями
 */
getAllDepartmentsFlat() {
    const result = [];
    const addWithPath = (id, path = '') => {
        const dept = this.departments.find(d => d.id === id);
        if (dept) {
            const fullPath = path ? `${path} / ${dept.name}` : dept.name;
            result.push({ ...dept, fullPath });
            const children = this.departments.filter(d => d.parentId === id);
            children.forEach(child => addWithPath(child.id, fullPath));
        }
    };
    
    const roots = this.departments.filter(d => d.parentId === null);
    roots.forEach(root => addWithPath(root.id));
    
    return result;
}
    addToHistory(action, details = {}) {
        this.changeHistory.unshift({
            id: Date.now(),
            action,
            details,
            timestamp: Date.now(),
            date: new Date().toLocaleString('ru-RU')
        });
        
        if (this.changeHistory.length > 100) {
            this.changeHistory.pop();
        }
        
        this.saveData();
    }
    
    getHistory() {
        return this.changeHistory;
    }
    
  addDepartment(name, parentId = null, description = '', image = null) {
    const parent = this.departments.find(d => d.id === parentId);
    const newId = this.nextId.department++;
    
    const newDepartment = {
        id: newId,
        name: name.trim(),
        parentId: parentId,
        level: parent ? parent.level + 1 : 0,
        order: this.getNextOrder(parentId),
        description: description,
        image: image, // 👈 ДОБАВЛЕНО
        headId: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    this.departments.push(newDepartment);
    this.saveData();
    this.addToHistory('add_department', { name, parentId });
    
    return newDepartment;
}
    
updateDepartment(id, updates) {
    const index = this.departments.findIndex(d => d.id === id);
    if (index === -1) return false;
    
    const oldName = this.departments[index].name;
    this.departments[index] = {
        ...this.departments[index],
        ...updates,
        updatedAt: Date.now()
    };
    
    this.saveData();
    if (updates.name && updates.name !== oldName) {
        this.addToHistory('rename_department', { oldName, newName: updates.name });
    }
    
    return true;
}
    
    deleteDepartment(id) {
        const department = this.departments.find(d => d.id === id);
        if (!department) return false;
        
        // Проверяем наличие подотделов
        const hasChildren = this.departments.some(d => d.parentId === id);
        if (hasChildren) {
            throw new Error('Нельзя удалить отдел, у которого есть подотделы');
        }
        
        // Проверяем наличие сотрудников
        const hasEmployees = this.employees.some(e => e.departmentId === id && e.isActive);
        if (hasEmployees) {
            throw new Error('Нельзя удалить отдел, в котором есть сотрудники');
        }
        
        this.departments = this.departments.filter(d => d.id !== id);
        this.saveData();
        this.addToHistory('delete_department', { name: department.name });
        
        return true;
    }
    
    getNextOrder(parentId) {
        const siblings = this.departments.filter(d => d.parentId === parentId);
        return siblings.length;
    }
    
getDepartmentTree(parentId = null) {
    const children = this.departments
        .filter(d => d.parentId === parentId)
        .sort((a, b) => a.order - b.order);
    
    return children.map(dept => ({
        ...dept,
        children: this.getDepartmentTree(dept.id),
        employees: this.getDepartmentEmployees(dept.id),
        head: this.getDepartmentHead(dept.id)
    }));
}
    
    getDepartmentEmployees(departmentId, includeSub = false) {
        let employees = this.employees
            .filter(e => e.departmentId === departmentId && e.isActive)
            .sort((a, b) => {
                const posA = this.positions.find(p => p.id === a.positionId)?.level || 0;
                const posB = this.positions.find(p => p.id === b.positionId)?.level || 0;
                return posB - posA;
            });
        
        if (includeSub) {
            const subDepts = this.departments.filter(d => d.parentId === departmentId);
            subDepts.forEach(sub => {
                employees = [...employees, ...this.getDepartmentEmployees(sub.id, true)];
            });
        }
        
        return employees;
    }
    
    getDepartmentHead(departmentId) {
        const head = this.employees.find(e => e.departmentId === departmentId && e.isHead && e.isActive);
        if (head) return head;
        
        const department = this.departments.find(d => d.id === departmentId);
        if (department && department.parentId) {
            return this.getDepartmentHead(department.parentId);
        }
        
        return null;
    }
    
    getDepartmentPath(departmentId) {
        const department = this.departments.find(d => d.id === departmentId);
        if (!department) return '';
        
        if (department.parentId) {
            const parentPath = this.getDepartmentPath(department.parentId);
            return parentPath ? `${parentPath} / ${department.name}` : department.name;
        }
        
        return department.name;
    }
    
    getAllDepartmentsFlat() {
        const result = [];
        const addWithPath = (id, path = '') => {
            const dept = this.departments.find(d => d.id === id);
            if (dept) {
                const fullPath = path ? `${path} / ${dept.name}` : dept.name;
                result.push({ ...dept, fullPath });
                const children = this.departments.filter(d => d.parentId === id);
                children.forEach(child => addWithPath(child.id, fullPath));
            }
        };
        
        const roots = this.departments.filter(d => d.parentId === null);
        roots.forEach(root => addWithPath(root.id));
        
        return result;
    }
    
    subscribe(id, callback) {
    this.listeners.set(id, callback);
    return () => this.listeners.delete(id);
}

/**
 * Уведомление подписчиков об изменениях
 */
notifyListeners() {
    this.listeners.forEach(callback => callback(this.getSnapshot()));
}

/**
 * Получение снимка данных
 */
getSnapshot() {
    return {
        departments: [...this.departments],
        employees: [...this.employees],
        positions: [...this.positions]
    };
}
    
addEmployee(data) {
    const newId = this.nextId.employee++;
    
    const newEmployee = {
        id: newId,
        name: data.name.trim(),
        departmentId: data.departmentId,
        positionId: data.positionId,
        email: data.email || '',
        phone: data.phone || '',
        photo: data.photo || null,  // 👈 ДОБАВЛЕНО
        isHead: data.isHead || false,
        isActive: true,
        startDate: data.startDate || new Date().toISOString().split('T')[0],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    this.employees.push(newEmployee);
    
    if (newEmployee.isHead) {
        const department = this.departments.find(d => d.id === data.departmentId);
        if (department) {
            department.headId = newId;
            department.updatedAt = Date.now();
        }
    }
    
    this.saveData();
    this.addToHistory('add_employee', { name: data.name, departmentId: data.departmentId });
    
    return newEmployee;
}
    
updateEmployee(id, updates) {
    const index = this.employees.findIndex(e => e.id === id);
    if (index === -1) return false;
    
    const oldEmployee = { ...this.employees[index] };
    this.employees[index] = {
        ...this.employees[index],
        ...updates,
        updatedAt: Date.now()
    };
    
    // Если меняется отдел
    if (updates.departmentId && updates.departmentId !== oldEmployee.departmentId) {
        const oldDept = this.departments.find(d => d.id === oldEmployee.departmentId);
        const newDept = this.departments.find(d => d.id === updates.departmentId);
        
        if (oldDept && oldDept.headId === id) {
            oldDept.headId = null;
        }
        
        if (updates.isHead && newDept) {
            newDept.headId = id;
        }
        
        this.addToHistory('move_employee', {
            name: oldEmployee.name,
            fromDepartment: oldDept?.name,
            toDepartment: newDept?.name
        });
    }
    
    // Если меняется статус руководителя
    if (updates.isHead !== undefined && updates.isHead !== oldEmployee.isHead) {
        const department = this.departments.find(d => d.id === this.employees[index].departmentId);
        if (department) {
            if (updates.isHead) {
                department.headId = id;
                this.addToHistory('promote_employee', { name: oldEmployee.name, department: department.name });
            } else if (department.headId === id) {
                department.headId = null;
                this.addToHistory('demote_employee', { name: oldEmployee.name, department: department.name });
            }
        }
    }
    
    this.saveData();
    return true;
}

    
    fireEmployee(id, reason = '') {
        const employee = this.employees.find(e => e.id === id);
        if (!employee) return false;
        
        employee.isActive = false;
        employee.fireDate = new Date().toISOString().split('T')[0];
        employee.fireReason = reason;
        employee.updatedAt = Date.now();
        
        if (employee.isHead) {
            const department = this.departments.find(d => d.id === employee.departmentId);
            if (department) {
                department.headId = null;
                department.updatedAt = Date.now();
            }
            employee.isHead = false;
        }
        
        this.saveData();
        this.addToHistory('fire_employee', { name: employee.name, reason });
        
        return true;
    }
    
    rehireEmployee(id) {
        const employee = this.employees.find(e => e.id === id);
        if (!employee) return false;
        
        employee.isActive = true;
        employee.fireDate = null;
        employee.fireReason = null;
        employee.updatedAt = Date.now();
        
        this.saveData();
        this.addToHistory('rehire_employee', { name: employee.name });
        
        return true;
    }
    
    // ========== ПОИСК ==========
    
    search(query) {
        const lowerQuery = query.toLowerCase();
        
        const departments = this.departments.filter(d => 
            d.name.toLowerCase().includes(lowerQuery) ||
            (d.description && d.description.toLowerCase().includes(lowerQuery))
        );
        
        const employees = this.employees.filter(e => {
            if (!e.isActive) return false;
            const position = this.positions.find(p => p.id === e.positionId);
            return e.name.toLowerCase().includes(lowerQuery) ||
                   (e.email && e.email.toLowerCase().includes(lowerQuery)) ||
                   (position && position.name.toLowerCase().includes(lowerQuery));
        });
        
        return { departments, employees };
    }
    
    // ========== СТАТИСТИКА ==========
    
    getStats() {
        const activeEmployees = this.employees.filter(e => e.isActive);
        const departments = this.departments.filter(d => d.id !== 1);
        
        const byPosition = this.positions.map(pos => ({
            id: pos.id,
            name: pos.name,
            count: activeEmployees.filter(e => e.positionId === pos.id).length
        })).filter(p => p.count > 0);
        
        const byDepartment = this.departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            count: activeEmployees.filter(e => e.departmentId === dept.id).length
        })).filter(d => d.count > 0);
        
        return {
            totalEmployees: activeEmployees.length,
            totalDepartments: departments.length,
            headsCount: activeEmployees.filter(e => e.isHead).length,
            byPosition,
            byDepartment,
            averagePerDepartment: departments.length ? Math.round(activeEmployees.length / departments.length) : 0
        };
    }
    
    // ========== ЭКСПОРТ/ИМПОРТ ==========
    
    exportData() {
        return {
            version: '3.0',
            exportDate: new Date().toISOString(),
            departments: this.departments,
            employees: this.employees,
            positions: this.positions,
            stats: this.getStats()
        };
    }
    
    importData(data) {
        if (data.version !== '3.0') {
            throw new Error('Неверная версия данных');
        }
        
        this.departments = data.departments;
        this.employees = data.employees;
        this.positions = data.positions;
        this.saveData();
        this.addToHistory('import_data', { count: this.departments.length });
        
        return true;
    }
}

window.OrgDataManager = OrgDataManager;
