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
        this.db = null;
        this.isInitialized = false;
        
        this.init();
    }
    
    async init() {
        await this.openDB();
        await this.loadData();
        this.isInitialized = true;
    }
    
    async openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('org_data_db', 2);
            
            request.onerror = () => {
                console.error('❌ Ошибка открытия IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB открыта');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                console.log(`🔄 Обновление базы данных с версии ${oldVersion} до ${db.version}`);
                
                // Хранилище для отделов
                if (!db.objectStoreNames.contains('departments')) {
                    const deptStore = db.createObjectStore('departments', { keyPath: 'id' });
                    deptStore.createIndex('parentId', 'parentId');
                    console.log('📁 Создано хранилище departments');
                }
                
                // Хранилище для сотрудников
                if (!db.objectStoreNames.contains('employees')) {
                    const empStore = db.createObjectStore('employees', { keyPath: 'id' });
                    empStore.createIndex('departmentId', 'departmentId');
                    empStore.createIndex('isActive', 'isActive');
                    console.log('👥 Создано хранилище employees');
                }
                
                // Хранилище для должностей
                if (!db.objectStoreNames.contains('positions')) {
                    db.createObjectStore('positions', { keyPath: 'id' });
                    console.log('💼 Создано хранилище positions');
                }
                
                // Хранилище для истории изменений
                if (!db.objectStoreNames.contains('history')) {
                    db.createObjectStore('history', { keyPath: 'id' });
                    console.log('📜 Создано хранилище history');
                }
                
                // Хранилище для метаданных
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    console.log('📊 Создано хранилище metadata');
                }
            };
        });
    }
    
    async loadData() {
        if (!this.db) await this.openDB();
        
        // Загружаем отделы
        this.departments = await this.getAllFromStore('departments');
        console.log(`📁 Загружено ${this.departments.length} отделов`);
        
        // Загружаем сотрудников
        this.employees = await this.getAllFromStore('employees');
        console.log(`👥 Загружено ${this.employees.length} сотрудников`);
        
        // Загружаем должности
        this.positions = await this.getAllFromStore('positions');
        if (this.positions.length === 0) {
            this.setDefaultData();
            await this.saveData();
        }
        console.log(`💼 Загружено ${this.positions.length} должностей`);
        
        // Загружаем метаданные
        const metadata = await this.getFromStore('metadata', 'nextId');
        if (metadata) {
            this.nextId = metadata.value;
        }
        
        // Загружаем историю
        this.changeHistory = await this.getAllFromStore('history');
    }
    
    async getAllFromStore(storeName) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => resolve([]);
        });
    }
    
    async getFromStore(storeName, key) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(null);
                return;
            }
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    }
    
    async saveToStore(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('База данных не открыта'));
                return;
            }
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            if (Array.isArray(data)) {
                // Очищаем и сохраняем все
                store.clear();
                data.forEach(item => store.put(item));
            } else {
                store.put(data);
            }
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    async deleteFromStore(storeName, key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('База данных не открыта'));
                return;
            }
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async saveData() {
        if (!this.db) await this.openDB();
        
        try {
            // Сохраняем отделы
            await this.saveToStore('departments', this.departments);
            
            // Сохраняем сотрудников
            await this.saveToStore('employees', this.employees);
            
            // Сохраняем должности
            await this.saveToStore('positions', this.positions);
            
            // Сохраняем метаданные
            await this.saveToStore('metadata', { key: 'nextId', value: this.nextId });
            
            // Сохраняем историю (ограничиваем до 100 записей)
            if (this.changeHistory.length > 100) {
                this.changeHistory = this.changeHistory.slice(0, 100);
            }
            await this.saveToStore('history', this.changeHistory);
            
            console.log('✅ Все данные сохранены в IndexedDB');
            this.notifyListeners();
        } catch (error) {
            console.error('❌ Ошибка сохранения в IndexedDB:', error);
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
            { id: 1, name: 'Департамент имущественных отношений ЯНАО', parentId: null, level: 0, order: 0, description: 'Главный департамент', headId: null, createdAt: Date.now(), updatedAt: Date.now() }
        ];
        
        // Сотрудники (начальные, без фото)
        this.employees = [];
        
        console.log('📦 Установлены начальные данные');
    }
    
    async syncPhotosFromIndexedDB() {
        if (!window.photoDB) return;
        
        const photos = await window.photoDB.loadAllPhotos();
        let updatedCount = 0;
        
        this.employees.forEach(employee => {
            if (photos[employee.id] && employee.photo !== `__INDEXEDDB__${employee.id}`) {
                employee.photo = `__INDEXEDDB__${employee.id}`;
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            console.log(`🔄 Синхронизировано ${updatedCount} фото из IndexedDB`);
            await this.saveData();
            this.notifyListeners();
        }
    }
    
    async saveEmployeePhotoToIndexedDB(employeeId, base64Photo) {
        if (!window.photoDB) return false;
        
        try {
            await window.photoDB.savePhoto(employeeId, base64Photo);
            
            const employee = this.employees.find(e => e.id === employeeId);
            if (employee) {
                employee.photo = `__INDEXEDDB__${employeeId}`;
                await this.saveData();
            }
            
            return true;
        } catch (error) {
            console.error('Ошибка сохранения фото:', error);
            return false;
        }
    }
    
    async loadEmployeePhotoFromIndexedDB(employeeId) {
        if (!window.photoDB) return null;
        return await window.photoDB.loadPhoto(employeeId);
    }
    
    async getEmployeePhotoForDisplay(employee) {
        if (employee.photo && !employee.photo.startsWith('__INDEXEDDB__')) {
            return employee.photo;
        }
        
        if (employee.photo && employee.photo.startsWith('__INDEXEDDB__')) {
            return await this.loadEmployeePhotoFromIndexedDB(employee.id);
        }
        
        return null;
    }
    
    // ========== ОСТАЛЬНЫЕ МЕТОДЫ (синхронные, но с вызовом saveData) ==========
    
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
    
    getOrCreatePosition(name) {
        if (!name) return null;
        
        let position = this.positions.find(p => p.name === name);
        if (!position) {
            position = this.addPosition(name);
        }
        return position;
    }
    
    getDepartmentByName(name) {
        return this.departments.find(d => d.name === name);
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
    
    addDepartment(name, parentId = null, description = '') {
        const parent = this.departments.find(d => d.id === parentId);
        const newId = this.nextId.department++;
        
        const newDepartment = {
            id: newId,
            name: name.trim(),
            parentId: parentId,
            level: parent ? parent.level + 1 : 0,
            order: this.getNextOrder(parentId),
            description: description,
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
        
        const hasChildren = this.departments.some(d => d.parentId === id);
        if (hasChildren) {
            throw new Error('Нельзя удалить отдел, у которого есть подотделы');
        }
        
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
    // Показываем ВСЕХ сотрудников (и активных, и уволенных)
    let employees = this.employees
        .filter(e => e.departmentId === departmentId)
        .sort((a, b) => {
            const posA = this.positions.find(p => p.id === a.positionId)?.level || 0;
            const posB = this.positions.find(p => p.id === b.positionId)?.level || 0;
            // Активные сотрудники выше уволенных
            if (a.isActive !== b.isActive) {
                return a.isActive ? -1 : 1;
            }
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
    
    addEmployee(data) {
        const newId = this.nextId.employee++;
        
        const newEmployee = {
            id: newId,
            name: data.name.trim(),
            departmentId: data.departmentId,
            positionId: data.positionId,
            email: data.email || '',
            phone: data.phone || '',
            photo: data.photo || null,
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
        
        if (updates.photo !== undefined && updates.photo !== oldEmployee.photo) {
            console.log(`📸 Обновление фото для ${oldEmployee.name}`);
        }
        
        this.employees[index] = {
            ...this.employees[index],
            ...updates,
            updatedAt: Date.now()
        };
        
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
