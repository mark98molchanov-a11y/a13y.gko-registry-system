// js/org-data-manager.js
class OrgDataManager {
    constructor() {
        this.orgStructure = null;
        this.isLoading = false;
        this.dbName = 'gko_registry_db';
        this.storeName = 'org_structures';
        console.log('✅ OrgDataManager инициализирован');
    }

    // Загрузка из IndexedDB (ваш основной метод)
    async loadFromIndexedDB() {
        this.isLoading = true;
        console.log('📥 Загрузка организационной структуры из IndexedDB...');
        
        this.showLoadingIndicator();
        
        try {
            const data = await this.getFromIndexedDB();
            
            if (data) {
                this.orgStructure = data;
                console.log('✅ Организационная структура загружена из IndexedDB');
                console.log('📊 Название:', this.orgStructure.name);
                console.log('📊 Количество узлов:', this.countNodes(this.orgStructure));
                return this.orgStructure;
            } else {
                console.warn('⚠️ Данных в IndexedDB нет, загружаем из GitHub...');
                return await this.loadFromGitHub();
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки из IndexedDB:', error);
            return await this.loadFromGitHub();
        } finally {
            this.isLoading = false;
            this.hideLoadingIndicator();
        }
    }

    // Получение данных из IndexedDB
    getFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => {
                reject(new Error('Не удалось открыть IndexedDB'));
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                // Проверяем существование хранилища
                if (!db.objectStoreNames.contains(this.storeName)) {
                    resolve(null);
                    db.close();
                    return;
                }
                
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const getRequest = store.get('mainStructure');
                
                getRequest.onsuccess = () => {
                    const result = getRequest.result;
                    db.close();
                    resolve(result || null);
                };
                
                getRequest.onerror = () => {
                    db.close();
                    reject(getRequest.error);
                };
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    // Сохранение в IndexedDB
    async saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => {
                reject(new Error('Не удалось открыть IndexedDB'));
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const putRequest = store.put(data, 'mainStructure');
                
                putRequest.onsuccess = () => {
                    console.log('💾 Данные сохранены в IndexedDB');
                    db.close();
                    resolve();
                };
                
                putRequest.onerror = () => {
                    db.close();
                    reject(putRequest.error);
                };
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    // Загрузка из GitHub (резервный вариант)
    async loadFromGitHub() {
        console.log('🌐 Загрузка из GitHub...');
        
        try {
            const githubUrl = 'https://raw.githubusercontent.com/mark98molchanov-a11y/a13y.gko-registry-system/main/gko_all_data.json';
            
            const response = await fetch(githubUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.orgStructure = data;
            
            // Сохраняем в IndexedDB для кэширования
            await this.saveToIndexedDB(data);
            
            console.log('✅ Данные загружены из GitHub и сохранены в IndexedDB');
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки из GitHub:', error);
            
            // Используем тестовую структуру
            this.orgStructure = this.getTestStructure();
            return this.orgStructure;
        }
    }

    // Подсчет узлов
    countNodes(node) {
        let count = 1;
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                count += this.countNodes(child);
            }
        }
        return count;
    }

    // Проверка наличия данных в IndexedDB
    async hasDataInIndexedDB() {
        const data = await this.getFromIndexedDB();
        return data !== null;
    }

    showLoadingIndicator() {
        if (document.getElementById('loadingIndicator')) return;
        
        const indicator = document.createElement('div');
        indicator.id = 'loadingIndicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 20px 30px;
                border-radius: 12px;
                z-index: 10000;
                font-size: 16px;
                font-weight: bold;
                text-align: center;
            ">
                <div>⏳ Загрузка организационной структуры...</div>
                <div style="font-size: 12px; margin-top: 8px; opacity: 0.7;">Загрузка из IndexedDB</div>
            </div>
        `;
        document.body.appendChild(indicator);
    }

    hideLoadingIndicator() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator) indicator.remove();
    }

    getTestStructure() {
        return {
            name: "Департамент имущественных отношений ЯНАО (тестовые данные)",
            type: "department",
            children: [
                {
                    name: "Отдел правового обеспечения",
                    type: "division",
                    children: [
                        { name: "Ведущий юрисконсульт", type: "position", children: [] },
                        { name: "Главный специалист", type: "position", children: [] }
                    ]
                },
                {
                    name: "Отдел земельных отношений",
                    type: "division",
                    children: [
                        { name: "Начальник отдела", type: "position", children: [] },
                        { name: "Главный специалист", type: "position", children: [] }
                    ]
                }
            ]
        };
    }

    getStructure() {
        return this.orgStructure;
    }

    isLoaded() {
        return this.orgStructure !== null;
    }
}

window.OrgDataManager = OrgDataManager;
window.orgDataManager = new OrgDataManager();

// Автоматическая загрузка из IndexedDB при старте
(async () => {
    console.log('🚀 Проверка наличия данных в IndexedDB...');
    
    const hasData = await window.orgDataManager.hasDataInIndexedDB();
    
    if (hasData) {
        console.log('📦 Загружаем данные из IndexedDB...');
        await window.orgDataManager.loadFromIndexedDB();
    } else {
        console.log('🌐 Данных в IndexedDB нет, загружаем из GitHub...');
        await window.orgDataManager.loadFromGitHub();
    }
    
    if (window.orgDataManager.getStructure()) {
        console.log('🏢 Структура готова к использованию');
        
        // Отправляем событие о загрузке данных
        window.dispatchEvent(new CustomEvent('orgDataLoaded', { 
            detail: window.orgDataManager.getStructure() 
        }));
        
        // Если есть рендерер, передаем данные
        if (window.orgChartRenderer && typeof window.orgChartRenderer.render === 'function') {
            window.orgChartRenderer.render(window.orgDataManager.getStructure());
        }
    }
})();
