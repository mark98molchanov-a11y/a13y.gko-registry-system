// js/indexeddb-manager.js
class IndexedDBManager {
    constructor() {
        this.dbName = 'org_photos_db';
        this.dbVersion = 1;
        this.db = null;
        this.isInitialized = false;
        this.pendingOperations = [];
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('❌ Ошибка открытия IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('✅ IndexedDB инициализирована');
                
                // Выполняем отложенные операции
                this.pendingOperations.forEach(op => op());
                this.pendingOperations = [];
                
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилище для фото
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
                    photoStore.createIndex('employeeId', 'employeeId', { unique: true });
                    console.log('📸 Создано хранилище photos');
                }
                
                // Создаем хранилище для метаданных
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                    console.log('📊 Создано хранилище metadata');
                }
            };
        });
    }

    async ensureInitialized() {
        if (this.isInitialized && this.db) {
            return this.db;
        }
        
        return new Promise((resolve) => {
            if (this.isInitialized && this.db) {
                resolve(this.db);
            } else {
                this.pendingOperations.push(() => resolve(this.db));
                if (!this.isInitialized) {
                    this.init().catch(console.error);
                }
            }
        });
    }

    async savePhoto(employeeId, base64Photo) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            
            const data = {
                id: `emp_${employeeId}`,
                employeeId: employeeId,
                photo: base64Photo,
                updatedAt: Date.now()
            };
            
            const request = store.put(data);
            
            request.onsuccess = () => {
                console.log(`📸 Фото сохранено в IndexedDB для сотрудника ${employeeId}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error('❌ Ошибка сохранения фото:', request.error);
                reject(request.error);
            };
        });
    }

    async loadPhoto(employeeId) {
        await this.ensureInitialized();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const request = store.get(`emp_${employeeId}`);
            
            request.onsuccess = () => {
                const result = request.result;
                if (result && result.photo) {
                    console.log(`📸 Фото загружено из IndexedDB для сотрудника ${employeeId}`);
                    resolve(result.photo);
                } else {
                    resolve(null);
                }
            };
            
            request.onerror = () => {
                console.error('❌ Ошибка загрузки фото:', request.error);
                resolve(null);
            };
        });
    }

    async deletePhoto(employeeId) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.delete(`emp_${employeeId}`);
            
            request.onsuccess = () => {
                console.log(`🗑️ Фото удалено из IndexedDB для сотрудника ${employeeId}`);
                resolve();
            };
            
            request.onerror = () => {
                console.error('❌ Ошибка удаления фото:', request.error);
                reject(request.error);
            };
        });
    }

    async loadAllPhotos() {
        await this.ensureInitialized();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const photos = {};
                request.result.forEach(item => {
                    if (item.photo) {
                        photos[item.employeeId] = item.photo;
                    }
                });
                console.log(`📸 Загружено ${Object.keys(photos).length} фото из IndexedDB`);
                resolve(photos);
            };
            
            request.onerror = () => {
                console.error('❌ Ошибка загрузки всех фото:', request.error);
                resolve({});
            };
        });
    }

    async clearAllPhotos() {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('🗑️ Все фото очищены из IndexedDB');
                resolve();
            };
            
            request.onerror = () => {
                console.error('❌ Ошибка очистки фото:', request.error);
                reject(request.error);
            };
        });
    }

    async getStorageInfo() {
        await this.ensureInitialized();
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const request = store.getAll();
            
            request.onsuccess = () => {
                let totalSize = 0;
                request.result.forEach(item => {
                    if (item.photo) {
                        totalSize += item.photo.length;
                    }
                });
                
                resolve({
                    count: request.result.length,
                    totalSizeBytes: totalSize,
                    totalSizeKB: Math.round(totalSize / 1024),
                    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
                });
            };
            
            request.onerror = () => {
                resolve({ count: 0, totalSizeBytes: 0, totalSizeKB: 0, totalSizeMB: 0 });
            };
        });
    }
}

// Создаем глобальный экземпляр
window.photoDB = new IndexedDBManager();
window.photoDB.init().catch(console.error);
