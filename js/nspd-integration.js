// ============================================================
// ИНТЕГРАЦИЯ С НСПД - ТОЛЬКО ДАННЫЕ (БЕЗ КЭША)
// ============================================================

class NSPDIntegration {
    constructor() {
        this.config = window.NSPD_CONFIG || {};
        this.currentResult = null;
        this.isLoading = false;
        this.initialized = false;
        this.baseUrl = 'https://nspd.gov.ru/api/geoportal/v2/search/geoportal';
        this._initAttempts = 0;
        this._maxInitAttempts = 20;
        console.log('NSPDIntegration: конструктор вызван');
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================
    
    init() {
        console.log('NSPD Integration инициализируется...');
        
        if (this.initialized) {
            console.log('НСПД уже инициализирована');
            return this;
        }
        
        this._initAttempts++;
        if (this._initAttempts > this._maxInitAttempts) {
            console.warn('⚠️ Превышено количество попыток инициализации НСПД');
            this.initialized = true;
            return this;
        }
        
        if (typeof mapInstance === 'undefined' || !mapInstance) {
            console.log(`⏳ Карта ещё не создана, ждём... (попытка ${this._initAttempts}/${this._maxInitAttempts})`);
            setTimeout(() => this.init(), 500);
            return this;
        }
        
        this.setupEventListeners();
        this.initialized = true;
        console.log('НСПД Integration готова к работе (только данные, без кэша)');
        return this;
    }

    // ============================================================
    // ПОИСК ПО КАДАСТРОВОМУ НОМЕРУ
    // ============================================================
    
    async search() {
        console.log('🔍 Поиск запущен');
        const input = document.getElementById('cadSearchInput');
        if (!input) {
            console.warn('⚠️ Поле cadSearchInput не найдено в HTML');
            this.showError('Поле поиска не найдено. Обновите страницу.');
            return;
        }
        
        const cadNumber = input.value.trim();
        if (!cadNumber) {
            this.showError('Введите кадастровый номер');
            return;
        }

        console.log(`📤 Ищем кадастровый номер: ${cadNumber}`);
        this.showLoading();

        try {
            const response = await this.makeRequest(cadNumber);
            console.log('📥 Ответ от НСПД получен:', response);
            
            if (response && response.error) {
                console.warn('⚠️ Ошибка в ответе:', response.error);
                this.showError(response.error);
                return;
            }

            if (!response || !response.cadastral_number) {
                console.warn('⚠️ Объект не найден');
                this.showError('Объект с таким номером не найден');
                return;
            }

            console.log('✅ Объект найден:', response.cadastral_number);
            this.currentResult = response;
            this.displayResult(response);
            this.showNotification('Объект найден в НСПД', 'success');

        } catch (error) {
            console.error('❌ Ошибка запроса к НСПД:', error);
            this.showError('Не удалось получить данные. Проверьте номер или попробуйте позже.');
        }
    }

    // ============================================================
    // ЗАПРОС К НСПД
    // ============================================================
    
    async makeRequest(cadNumber) {
        const url = `${this.baseUrl}?thematicSearchId=1&query=${encodeURIComponent(cadNumber)}&limit=10&offset=0&geometry=true`;
        
        console.log(`📤 Запрос к НСПД: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 404) {
                    const errorData = await response.json();
                    if (errorData.code === 204) {
                        return { error: 'Объект не найден в НСПД' };
                    }
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('📥 Ответ от НСПД (сырой):', data);
            
            const normalized = this.normalizeResponse(data);
            console.log('📦 Нормализованные данные:', normalized);
            return normalized;

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Превышено время ожидания ответа от НСПД');
            }
            throw error;
        }
    }

    // ============================================================
    // НОРМАЛИЗАЦИЯ ОТВЕТА — ВСЕ ПОЛЯ
    // ============================================================
    
 normalizeResponse(data) {
    console.log('🔄 Нормализация ответа...');
    
    if (!data || !data.data || !data.data.features || data.data.features.length === 0) {
        console.warn('⚠️ Нет данных в ответе');
        return { error: 'Объект не найден' };
    }

    const feature = data.data.features[0];
    const props = feature.properties || {};
    const options = props.options || {};
    const systemInfo = props.systemInfo || {};
    
    return {
        // Из properties
        interactionId: props.interactionId || '',
        category: props.category || '',
        categoryName: props.categoryName || '',
        subcategory: props.subcategory || '',
        descr: props.descr || '',
        externalKey: props.externalKey || '',
        label: props.label || '',
        cadastralDistrictsCode: props.cadastralDistrictsCode || '',
        
        // Из options (все поля)
        // ✅ ИСПРАВЛЕНО: если cad_number пустой, берем из externalKey или label или descr
        cadastral_number: options.cad_number || props.externalKey || props.label || props.descr || '',
        object_type: options.object_type_value || options.type || props.categoryName || '',
        status: options.status || options.common_data_status || '',
        ownership_type: options.ownership_type || '',
        object_name: options.params_name || options.name || options.building_name || '',
        purpose: options.params_purpose || options.purpose || '',
        address: options.address_readable_address || options.readable_address || '',
        quarter_cad_number: options.quarter_cad_number || '',
        area: parseFloat(options.params_area) || parseFloat(options.area) || parseFloat(options.build_record_area) || 0,
        year_built: options.params_year_built || options.year_built || '',
        year_commisioning: options.params_year_commisioning || options.year_commisioning || '',
        params_extension: parseFloat(options.params_extension) || parseFloat(options.extension) || 0,
        params_volume: parseFloat(options.params_volume) || parseFloat(options.volume) || 0,
        params_height: parseFloat(options.params_height) || parseFloat(options.height) || 0,
        params_depth: parseFloat(options.params_depth) || parseFloat(options.depth) || 0,
        params_floors: options.params_floors || options.floors || '',
        params_built_up_area: parseFloat(options.params_built_up_area) || parseFloat(options.built_up_area) || 0,
        params_occurence_depth: parseFloat(options.params_occurence_depth) || parseFloat(options.occurence_depth) || 0,
        params_underground_floors: options.params_underground_floors || options.underground_floors || '',
        cadastral_value: parseFloat(options.cost_value) || 0,
        cadastral_index: parseFloat(options.cost_index) || 0,
        cost_determination_date: options.cost_determination_date || '',
        cost_application_date: options.cost_application_date || '',
        cost_registration_date: options.cost_registration_date || '',
        cost_approvement_date: options.cost_approvement_date || '',
        determination_couse: options.determination_couse || '',
        registration_date: options.registration_date || options.build_record_registration_date || '',
        cultural_heritage_val: options.cultural_heritage_val || options.cultural_heritage_object || '',
        facility_cad_number: options.facility_cad_number || '',
        united_cad_number: options.united_cad_number || options.united_cad_numbers || '',
        permitted_uses_name: options.permitted_uses_name || options.permitted_use_name || '',
        degree_readiness: options.degree_readiness || '',
        right_type: options.right_type || '',
        built_up_area: parseFloat(options.built_up_area) || 0,
        materials: options.materials || '',
        floors: options.floors || '',
        underground_floors: options.underground_floors || '',
        building_name: options.building_name || '',
        build_record_area: parseFloat(options.build_record_area) || 0,
        name: options.name || '',
        
        // Системная информация
        systemInfo: {
            inserted: systemInfo.inserted || '',
            insertedBy: systemInfo.insertedBy || '',
            updated: systemInfo.updated || '',
            updatedBy: systemInfo.updatedBy || ''
        },
        
        // Геометрия
        hasGeometry: !!feature.geometry,
        geometryType: feature.geometry?.type || '',
        
        // Метаданные
        totalCount: data.meta?.[0]?.totalCount || 0,
        categoryId: data.meta?.[0]?.categoryId || '',
        
        raw: data
    };
}

    // ============================================================
    // UI: ОТОБРАЖЕНИЕ ВСЕХ ДАННЫХ
    // ============================================================
    
 displayResult(data) {
    console.log('📊 displayResult вызван с данными:', data);
    
    let resultDiv = document.getElementById('cadResult');
    if (!resultDiv) {
        resultDiv = document.createElement('div');
        resultDiv.id = 'cadResult';
        resultDiv.style.cssText = 'margin-top: 12px; display: none;';
        const searchPanel = document.querySelector('#mapTab .bg-white.p-3.rounded-xl');
        if (searchPanel && searchPanel.parentNode) {
            searchPanel.parentNode.insertBefore(resultDiv, searchPanel.nextSibling);
        } else {
            const mapTab = document.getElementById('mapTab');
            if (mapTab) mapTab.insertBefore(resultDiv, mapTab.firstChild);
        }
    }
    
    resultDiv.style.display = 'block';

    const formatPrice = (num) => {
        if (!num || num === 0) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    };

    const formatDate = (date) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString('ru-RU');
    };

    // ============================================
    // ОПРЕДЕЛЯЕМ ТИП ОБЪЕКТА
    // ============================================
    const objectType = data.object_type || data.categoryName || '';
    const isBuilding = objectType.includes('Здание') || objectType.includes('Здания');
    const isStructure = objectType.includes('Сооружение') || objectType.includes('Сооружения');
    const isConstruction = objectType.includes('Объект незавершенного строительства');
    const isComplex = objectType.includes('Единый недвижимый комплекс');
    const isLand = objectType.includes('Земельный участок');

    // ============================================
    // БАЗОВЫЕ ПОЛЯ ДЛЯ ВСЕХ ТИПОВ
    // ============================================
    const fields = [
        { label: 'Кадастровый номер', value: data.cadastral_number || '—', important: true },
        { label: 'Тип объекта', value: objectType || '—', important: true },
        { label: 'Статус', value: data.status || '—' },
        { label: 'Форма собственности', value: data.ownership_type || '—' },
        { label: 'Адрес', value: data.address || '—', important: true },
        { label: 'Кадастровый квартал', value: data.quarter_cad_number || '—' },
        { label: 'Кадастровая стоимость', value: data.cadastral_value > 0 ? formatPrice(data.cadastral_value) : '—', important: true },
        { label: 'УПКС', value: data.cadastral_index > 0 ? data.cadastral_index.toFixed(2) + ' ₽/м²' : '—', important: true },
    ];

    // ============================================
    // ДОБАВЛЯЕМ ПОЛЯ В ЗАВИСИМОСТИ ОТ ТИПА
    // ============================================
    
    if (isBuilding) {
        // ЗДАНИЕ
        fields.push(
            { label: 'Наименование', value: data.object_name || data.building_name || '—' },
            { label: 'Назначение', value: data.purpose || '—' },
            { label: 'Площадь', value: data.area > 0 ? data.area.toFixed(1) + ' м²' : data.build_record_area ? data.build_record_area + ' м²' : '—' },
            { label: 'Этажность', value: data.params_floors || data.floors || '—' },
            { label: 'Подземных этажей', value: data.params_underground_floors || data.underground_floors || '—' },
            { label: 'Год постройки', value: data.year_built || '—' },
            { label: 'Год ввода в эксплуатацию', value: data.year_commisioning || '—' },
            { label: 'Материал стен', value: data.materials || '—' },
        );
    } else if (isStructure) {
        // СООРУЖЕНИЕ
        fields.push(
            { label: 'Наименование', value: data.object_name || '—', important: true },
            { label: 'Назначение', value: data.purpose || '—' },
            { label: 'Протяженность', value: data.params_extension > 0 ? data.params_extension + ' м' : '—' },
            { label: 'Объем', value: data.params_volume > 0 ? data.params_volume + ' м³' : '—' },
            { label: 'Высота', value: data.params_height > 0 ? data.params_height + ' м' : '—' },
            { label: 'Глубина', value: data.params_depth > 0 ? data.params_depth + ' м' : '—' },
            { label: 'Год постройки', value: data.year_built || '—' },
        );
    } else if (isConstruction) {
        // ОБЪЕКТ НЕЗАВЕРШЕННОГО СТРОИТЕЛЬСТВА
        fields.push(
            { label: 'Назначение', value: data.purpose || '—' },
            { label: 'Площадь застройки', value: data.params_built_up_area > 0 ? data.params_built_up_area + ' м²' : data.built_up_area ? data.built_up_area + ' м²' : '—' },
            { label: 'Степень готовности', value: data.degree_readiness ? data.degree_readiness + '%' : '—' },
            { label: 'Тип права', value: data.right_type || '—' },
            { label: 'Объем', value: data.params_volume > 0 ? data.params_volume + ' м³' : '—' },
        );
    } else if (isComplex) {
        // ЕДИНЫЙ НЕДВИЖИМЫЙ КОМПЛЕКС
        fields.push(
            { label: 'Наименование', value: data.object_name || data.name || '—', important: true },
            { label: 'Назначение', value: data.purpose || '—' },
        );
    } else if (isLand) {
        // ЗЕМЕЛЬНЫЙ УЧАСТОК
        fields.push(
            { label: 'Площадь', value: data.area > 0 ? data.area.toFixed(1) + ' м²' : '—' },
            { label: 'Категория земель', value: data.categoryName || '—' },
            { label: 'Вид разрешенного использования', value: data.permitted_uses_name || data.purpose || '—' },
        );
    }

    // ============================================
    // ДОБАВЛЯЕМ ДАТЫ (для всех типов)
    // ============================================
    fields.push(
        { label: 'Дата регистрации', value: data.registration_date ? formatDate(data.registration_date) : '—' },
        { label: 'Дата определения стоимости', value: data.cost_determination_date ? formatDate(data.cost_determination_date) : '—' },
        { label: 'Дата применения стоимости', value: data.cost_application_date ? formatDate(data.cost_application_date) : '—' },
        { label: 'Дата регистрации стоимости', value: data.cost_registration_date ? formatDate(data.cost_registration_date) : '—' },
        { label: 'Основание оценки', value: data.determination_couse ? data.determination_couse.replace(/\n/g, ' ').trim() : '—' },
    );

    // ============================================
    // ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ
    // ============================================
    fields.push(
        { label: 'Категория', value: data.categoryName || data.category || '—' },
        { label: 'Подкатегория', value: data.subcategory || '—' },
        { label: 'Тип геометрии', value: data.geometryType || '—' },
        { label: 'Наличие геометрии', value: data.hasGeometry ? 'Да' : 'Нет' },
        { label: 'ID объекта', value: data.interactionId || '—' },
    );

    // Убираем поля с '—' (чтобы не захламлять)
    const visibleFields = fields.filter(f => f.value !== '—');

    // ============================================
    // ОТОБРАЖЕНИЕ
    // ============================================
    resultDiv.innerHTML = `
        <div style="
            background: white;
            border-radius: 8px;
            padding: 14px 16px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            max-height: 500px;
            overflow-y: auto;
            font-family: 'Inter', sans-serif;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1; flex-wrap: wrap; gap: 8px;">
                <span style="font-weight: 600; font-size: 13px; color: #1e293b;">📋 Данные из НСПД</span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 9px; color: #10b981; background: #dcfce7; padding: 2px 10px; border-radius: 20px; font-weight: 500;">Найден</span>
                    <span style="font-size: 9px; color: #64748b; background: #f1f5f9; padding: 2px 10px; border-radius: 20px; font-weight: 500;">
                        ${objectType || 'Объект'}
                    </span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; font-size: 12px;">
                ${visibleFields.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f8fafc; ${item.important ? 'background: #f8fafc; border-radius: 4px; padding-left: 4px; padding-right: 4px;' : ''}">
                        <span style="color: #64748b; font-weight: 500; font-size: 10px; white-space: nowrap; min-width: 40%;">${item.label}:</span>
                        <span style="color: #1e293b; text-align: right; word-break: break-word; font-size: 10px; max-width: 60%; ${item.important ? 'font-weight: 600;' : ''}">${item.value}</span>
                    </div>
                `).join('')}
            </div>
            
            ${data.systemInfo?.updated ? `
            <div style="margin-top: 12px; padding: 8px 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #f1f5f9; font-size: 9px; color: #94a3b8;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px;">
                    <span>📅 Создано: ${data.systemInfo.inserted ? new Date(data.systemInfo.inserted).toLocaleString('ru-RU') : '—'}</span>
                    <span>✏️ Обновлено: ${data.systemInfo.updated ? new Date(data.systemInfo.updated).toLocaleString('ru-RU') : '—'}</span>
                </div>
            </div>
            ` : ''}
            
            <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                <button onclick="nspdApp.copyData()" 
                        style="padding: 5px 14px; background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: 500; transition: all 0.2s;">
                    Копировать
                </button>
                <button onclick="nspdApp.clear()" 
                        style="padding: 5px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: 500; transition: all 0.2s;">
                    Очистить
                </button>
                <a href="https://nspd.gov.ru/map?text=${encodeURIComponent(data.cadastral_number)}" target="_blank" 
                   style="padding: 5px 14px; background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 10px; text-decoration: none; font-weight: 500; transition: all 0.2s;">
                    Открыть в НСПД
                </a>
                ${data.quarter_cad_number && data.quarter_cad_number !== '—' ? `
                <button onclick="searchQuarterByNumber('${data.quarter_cad_number}')" 
                        style="padding: 5px 14px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 6px; cursor: pointer; font-size: 10px; font-weight: 500; transition: all 0.2s;">
                    Найти квартал
                </button>
                ` : ''}
            </div>
            
            <div style="margin-top: 8px; font-size: 8px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 6px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px;">
                <span>ID: ${data.interactionId || '—'}</span>
                <span>Всего найдено: ${data.totalCount || 0}</span>
                <span>${data.hasGeometry ? '📍 С геометрией' : '❌ Без геометрии'}</span>
            </div>
        </div>
    `;
    
    console.log('✅ Данные отображены в карточке');
}

    // ============================================================
    // UI: СОСТОЯНИЯ
    // ============================================================
    
    showLoading() {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="text-align: center; padding: 12px; color: #94a3b8; font-size: 13px;">
                <span class="animate-spin" style="display:inline-block; margin-right:8px;">⏳</span>
                Поиск в НСПД...
            </div>
        `;
    }

    showError(message) {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;
        
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 10px 12px;
                color: #dc2626;
                font-size: 12px;
            ">
                ❌ ${message}
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };

        document.querySelectorAll('.nspd-notification').forEach(el => el.remove());

        const notification = document.createElement('div');
        notification.className = 'nspd-notification';
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 13px;
            z-index: 10000;
            max-width: 400px;
            animation: nspdSlideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            notification.style.transition = 'all 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ============================================================
    
    copyData() {
        const data = this.currentResult;
        if (!data) {
            this.showNotification('Нет данных для копирования', 'warning');
            return;
        }

        const fields = {
            'Кадастровый номер': data.cadastral_number,
            'Тип объекта': data.object_type,
            'Статус': data.status,
            'Форма собственности': data.ownership_type,
            'Наименование': data.object_name,
            'Назначение': data.purpose,
            'Адрес': data.address,
            'Кадастровый квартал': data.quarter_cad_number,
            'Площадь': data.area > 0 ? data.area.toFixed(1) + ' м²' : null,
            'Кадастровая стоимость': data.cadastral_value > 0 ? data.cadastral_value.toLocaleString() + ' ₽' : null,
            'УПКС': data.cadastral_index > 0 ? data.cadastral_index.toFixed(2) + ' ₽/м²' : null,
            'Год постройки': data.year_built,
            'Дата определения стоимости': data.cost_determination_date || null,
            'Дата регистрации': data.registration_date || null,
            'Протяженность': data.params_extension > 0 ? data.params_extension + ' м' : null,
            'Объем': data.params_volume > 0 ? data.params_volume + ' м³' : null,
            'Высота': data.params_height > 0 ? data.params_height + ' м' : null,
            'Глубина': data.params_depth > 0 ? data.params_depth + ' м' : null,
            'Этажность': data.params_floors || null,
            'Площадь застройки': data.params_built_up_area > 0 ? data.params_built_up_area + ' м²' : null,
            'Основание оценки': data.determination_couse ? data.determination_couse.replace(/\n/g, ' ').trim() : null,
            'Категория': data.categoryName || null,
            'ID объекта': data.interactionId || null
        };

        const text = Object.entries(fields)
            .filter(([_, value]) => value && value !== '—' && value !== null && value !== '')
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');

        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Данные скопированы в буфер обмена', 'success');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            this.showNotification('Данные скопированы в буфер обмена', 'success');
        });
    }

    clear() {
        this.currentResult = null;
        const resultDiv = document.getElementById('cadResult');
        if (resultDiv) {
            resultDiv.style.display = 'none';
            resultDiv.innerHTML = '';
        }
        const input = document.getElementById('cadSearchInput');
        if (input) {
            input.value = '';
            input.focus();
        }
    }

    // ============================================================
    // НАСТРОЙКА ОБРАБОТЧИКОВ
    // ============================================================
    
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target && e.target.classList && e.target.classList.contains('nspd-check-btn')) {
                const cadNumber = e.target.dataset.cadNumber;
                if (cadNumber) {
                    const input = document.getElementById('cadSearchInput');
                    if (input) {
                        input.value = cadNumber;
                    }
                    this.search();
                }
            }
        });
    }
}

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

console.log('NSPD Integration загружается...');

window.nspdApp = new NSPDIntegration();

setTimeout(() => {
    if (window.nspdApp) {
        window.nspdApp.init();
    }
}, 200);

console.log('NSPD Integration загружена');
