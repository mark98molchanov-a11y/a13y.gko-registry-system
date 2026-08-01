// ============================================================
// ИНТЕГРАЦИЯ С НСПД - ПОИСК ПО КОНКРЕТНОМУ КАДАСТРОВОМУ НОМЕРУ
// ============================================================

class NSPDIntegration {
    constructor() {
        this.config = window.NSPD_CONFIG || {};
        this.currentResult = null;
        this.allResults = [];
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
        console.log('НСПД Integration готова к работе (поиск по конкретному номеру)');
        return this;
    }

    // ============================================================
    // 🔍 ПОИСК ПО КОНКРЕТНОМУ КАДАСТРОВОМУ НОМЕРУ
    // ============================================================
    
    async search() {
        console.log('🔍 Поиск по конкретному кадастровому номеру');
        const input = document.getElementById('cadSearchInput');
        if (!input) {
            console.warn('⚠️ Поле cadSearchInput не найдено');
            this.showError('Поле поиска не найдено. Обновите страницу.');
            return;
        }
        
        const cadNumber = input.value.trim();
        if (!cadNumber) {
            this.showError('Введите кадастровый номер');
            return;
        }

        // ✅ Ищем ПОЛНЫЙ кадастровый номер (НЕ извлекаем квартал!)
        console.log(`📤 Ищем конкретный объект: ${cadNumber}`);
        this.showLoading();

        try {
            // ✅ Отправляем запрос с ПОЛНЫМ номером
            const response = await this.makeRequest(cadNumber);
            console.log('📥 Ответ от НСПД получен:', response);
            
            if (response && response.error) {
                console.warn('⚠️ Ошибка в ответе:', response.error);
                this.showError(response.error);
                return;
            }

            if (!response || !response.features || response.features.length === 0) {
                console.warn(`⚠️ Объект ${cadNumber} не найден`);
                this.showError(`Объект ${cadNumber} не найден в НСПД`);
                return;
            }

            console.log(`✅ Найдено объектов: ${response.features.length}`);

            // ✅ Ищем ТОЧНОЕ совпадение с полным номером
            const exactMatch = this.findExactMatch(response.features, cadNumber);
            
            if (exactMatch) {
                console.log(`✅ Найден точный объект: ${exactMatch.cadastral_number}`);
                this.currentResult = exactMatch;
                this.allResults = response.features;
                this.displayResult(exactMatch);
                this.showNotification(`Найден объект: ${exactMatch.cadastral_number}`, 'success');
            } else {
                console.warn(`⚠️ Точное совпадение для ${cadNumber} не найдено`);
                
                // ✅ Если точного нет - показываем все найденные объекты
                this.allResults = response.features;
                this.displayAllResults(response.features, cadNumber);
                this.showNotification(`Найдено ${response.features.length} объектов, но точного совпадения нет`, 'warning');
            }

        } catch (error) {
            console.error('❌ Ошибка запроса к НСПД:', error);
            this.showError('Не удалось получить данные. Проверьте номер или попробуйте позже.');
        }
    }

    // ============================================================
    // 📤 ЗАПРОС К API С ПОЛНЫМ НОМЕРОМ
    // ============================================================

    async makeRequest(query) {
        // ✅ Ищем ПОЛНЫЙ кадастровый номер (НЕ квартал!)
        const url = `${this.baseUrl}?thematicSearchId=1&query=${encodeURIComponent(query)}&limit=500`;
        
        console.log(`📤 Запрос к НСПД с полным номером: ${url}`);
        
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
                    return { error: 'Объект не найден в НСПД', features: [] };
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
    // 🔍 ПОИСК ТОЧНОГО СОВПАДЕНИЯ
    // ============================================================

    findExactMatch(features, targetCadNumber) {
        console.log(`🔍 Ищем точное совпадение: ${targetCadNumber} среди ${features.length} объектов`);
        
        // ✅ Нормализуем целевой номер (убираем пробелы, приводим к верхнему регистру)
        const normalizedTarget = targetCadNumber.replace(/\s/g, '').toUpperCase();
        
        for (const item of features) {
            const itemCad = item.cadastral_number || '';
            const normalizedItem = itemCad.replace(/\s/g, '').toUpperCase();
            
            // ✅ Сравниваем ПОЛНЫЕ номера
            if (normalizedItem === normalizedTarget) {
                console.log(`✅ Точное совпадение найдено: ${itemCad}`);
                return item;
            }
        }
        
        // ✅ Если точного нет - ищем частичное совпадение
        for (const item of features) {
            const itemCad = item.cadastral_number || '';
            if (itemCad.includes(targetCadNumber) || targetCadNumber.includes(itemCad)) {
                console.log(`⚠️ Частичное совпадение: ${itemCad} содержит ${targetCadNumber}`);
                return item;
            }
        }
        
        console.log(`❌ Точное совпадение для ${targetCadNumber} не найдено`);
        return null;
    }

    // ============================================================
    // 📋 НОРМАЛИЗАЦИЯ ОТВЕТА
    // ============================================================
    
normalizeResponse(data) {
    console.log('🔄 Нормализация ответа...');
    
    if (!data || !data.data || !data.data.features || data.data.features.length === 0) {
        console.warn('⚠️ Нет данных в ответе');
        return { error: 'Объект не найден', features: [] };
    }

    const features = data.data.features.map(feature => {
        const props = feature.properties || {};
        const options = props.options || {};
        const systemInfo = props.systemInfo || {};
        
        // ✅ ИЗВЛЕКАЕМ ЭТАЖ ИЗ МАССИВА
        let floorValue = '';
        if (options.floor && Array.isArray(options.floor) && options.floor.length > 0) {
            floorValue = options.floor[0]; // "04/Этаж"
        }
        
        // ✅ ИЗВЛЕКАЕМ ПАРАМЕТРЫ (params_type)
        let paramsType = options.params_type || '';
        
        // ✅ ИЗВЛЕКАЕМ КАДАСТРОВЫЙ НОМЕР
        const cadNumber = options.cad_number || props.externalKey || props.label || props.descr || '';
        
        // ✅ ИЗВЛЕКАЕМ КАДАСТРОВЫЙ КВАРТАЛ (первые 3 части)
        let cadastralQuarter = '';
        if (cadNumber) {
            const parts = cadNumber.split(':');
            if (parts.length >= 3) {
                cadastralQuarter = parts.slice(0, 3).join(':');
            }
        }
        
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
            
            // ✅ КАДАСТРОВЫЙ НОМЕР
            cadastral_number: cadNumber,
            
            // ✅ КАДАСТРОВЫЙ КВАРТАЛ (первые 3 части)
            cadastral_quarter: cadastralQuarter,
            
            // ✅ ТИП ОБЪЕКТА
            object_type: options.type || options.object_type_value || options.land_record_type || props.categoryName || '',
            status: options.common_data_status || options.status || '',
            ownership_type: options.ownership_type || '',
            object_name: options.params_name || options.name || options.building_name || '',
            purpose: options.purpose || options.params_purpose || options.permitted_use_established_by_document || '',
            
            // ✅ АДРЕС
            address: options.readable_address || options.address_readable_address || '',
            
            // ✅ РОДИТЕЛЬСКИЙ ОБЪЕКТ (здание/сооружение)
            parent_cad_number: options.parent_cad_number || '',
            
            // ✅ ПАРАМЕТРЫ ТИПА (Квартира, Комната, и т.д.)
            params_type: paramsType,
            
            // Площадь
            area: parseFloat(options.area) || parseFloat(options.params_area) || parseFloat(options.build_record_area) || parseFloat(options.specified_area) || 0,
            specified_area: parseFloat(options.specified_area) || 0,
            
            // ✅ ЭТАЖ
            floor: floorValue,
            
            year_built: options.year_built || options.params_year_built || '',
            year_commisioning: options.year_commisioning || options.params_year_commisioning || '',
            params_extension: parseFloat(options.params_extension) || parseFloat(options.extension) || 0,
            params_volume: parseFloat(options.params_volume) || parseFloat(options.volume) || 0,
            params_height: parseFloat(options.params_height) || parseFloat(options.height) || 0,
            params_depth: parseFloat(options.params_depth) || parseFloat(options.depth) || 0,
            params_floors: options.params_floors || options.floors || '',
            params_built_up_area: parseFloat(options.params_built_up_area) || parseFloat(options.built_up_area) || 0,
            params_occurence_depth: parseFloat(options.params_occurence_depth) || parseFloat(options.occurence_depth) || 0,
            params_underground_floors: options.params_underground_floors || options.underground_floors || '',
            
            // ✅ КАДАСТРОВАЯ СТОИМОСТЬ И УПКС
            cadastral_value: parseFloat(options.cost_value) || 0,
            cadastral_index: parseFloat(options.cost_index) || 0,
            
            cost_determination_date: options.cost_determination_date || '',
            cost_application_date: options.cost_application_date || '',
            cost_registration_date: options.cost_registration_date || '',
            cost_approvement_date: options.cost_approvement_date || '',
            determination_couse: options.determination_couse || '',
            
            registration_date: options.registration_date || options.build_record_registration_date || options.land_record_reg_date || '',
            
            cultural_heritage_val: options.cultural_heritage_val || options.cultural_heritage_object || '',
            facility_cad_number: options.facility_cad_number || '',
            united_cad_number: options.united_cad_number || options.united_cad_numbers || '',
            permitted_uses_name: options.permitted_uses_name || options.permitted_use_established_by_document || '',
            degree_readiness: options.degree_readiness || '',
            right_type: options.right_type || '',
            built_up_area: parseFloat(options.built_up_area) || 0,
            materials: options.materials || '',
            floors: options.floors || '',
            underground_floors: options.underground_floors || '',
            building_name: options.building_name || '',
            build_record_area: parseFloat(options.build_record_area) || 0,
            name: options.name || '',
            land_record_category_type: options.land_record_category_type || '',
            land_record_subtype: options.land_record_subtype || '',
            
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
            
            raw: feature
        };
    });

    return { features };
}
    // ============================================================
    // 📋 ПОКАЗ ВСЕХ НАЙДЕННЫХ ОБЪЕКТОВ
    // ============================================================

    displayAllResults(features, searchQuery) {
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

        let html = `
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; background: white; z-index: 1; flex-wrap: wrap; gap: 8px;">
                    <div>
                        <span style="font-size: 13px; color: #1e293b; font-weight: 600;">🔍 Результаты поиска</span>
                        <span style="font-size: 11px; color: #64748b; margin-left: 8px;">${features.length} объектов</span>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <span style="font-size: 9px; color: #f59e0b; background: #fef3c7; padding: 2px 10px; border-radius: 20px;">
                            ⚠️ Точного совпадения нет
                        </span>
                        <button onclick="nspdApp.clear()" 
                                style="padding: 3px 12px; background: #f1f5f9; color: #475569; border: none; border-radius: 6px; cursor: pointer; font-size: 10px;">
                            ✕ Закрыть
                        </button>
                    </div>
                </div>
                
                <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">
                    Искали: <strong>${searchQuery}</strong>
                    <span style="color: #94a3b8; margin-left: 8px;">(точное совпадение не найдено)</span>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 6px;">
        `;

        features.forEach((item, index) => {
            const cad = item.cadastral_number || '—';
            const type = item.object_type || '—';
            const area = item.area > 0 ? item.area.toFixed(1) + ' м²' : '—';
            const address = item.address || '—';
            const upks = item.cadastral_index > 0 ? item.cadastral_index.toFixed(2) + ' ₽/м²' : '—';
            
            const isExactMatch = cad.replace(/\s/g, '').toUpperCase() === searchQuery.replace(/\s/g, '').toUpperCase();
            
            html += `
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: ${isExactMatch ? '#f0fdf4' : (index % 2 === 0 ? '#f8fafc' : '#ffffff')};
                    border-radius: 6px;
                    border: ${isExactMatch ? '2px solid #22c55e' : '1px solid #f1f5f9'};
                    transition: all 0.2s;
                    cursor: pointer;
                    flex-wrap: wrap;
                    gap: 6px;
                "
                onmouseover="this.style.borderColor='#0ea5e9'; this.style.background='#f0f9ff';"
                onmouseout="this.style.borderColor='${isExactMatch ? '#22c55e' : '#f1f5f9'}'; this.style.background='${isExactMatch ? '#f0fdf4' : (index % 2 === 0 ? '#f8fafc' : '#ffffff')}';"
                onclick="nspdApp.showObjectDetails('${cad}')">
                    
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
                        ${isExactMatch ? '<span style="font-size: 14px;">✅</span>' : ''}
                        <span style="font-family: monospace; font-size: 11px; color: #1e293b; font-weight: ${isExactMatch ? '600' : '400'};">
                            ${cad}
                        </span>
                        <span style="font-size: 9px; color: #64748b; background: #f1f5f9; padding: 1px 6px; border-radius: 10px;">
                            ${area}
                        </span>
                        ${isExactMatch ? '<span style="font-size: 8px; color: #16a34a; background: #dcfce7; padding: 1px 8px; border-radius: 10px;">ТОЧНОЕ СОВПАДЕНИЕ</span>' : ''}
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 10px; color: #64748b;">
                        <span>${type}</span>
                        ${upks !== '—' ? `<span style="color: #0ea5e9;">${upks}</span>` : ''}
                        <span style="color: #94a3b8; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${address.length > 25 ? address.slice(0, 25) + '…' : address}
                        </span>
                        <button onclick="event.stopPropagation(); nspdApp.copyCadastral('${cad}')"
                                style="padding: 2px 8px; background: #f1f5f9; color: #475569; border: none; border-radius: 4px; cursor: pointer; font-size: 9px;">
                            📋
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #f1f5f9; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="nspdApp.clear()" 
                            style="padding: 4px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 10px;">
                        Очистить
                    </button>
                    <button onclick="nspdApp.exportResults()" 
                            style="padding: 4px 14px; background: #0ea5e9; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 10px;">
                        📥 Экспорт
                    </button>
                </div>
            </div>
        `;
        
        resultDiv.innerHTML = html;
    }

    // ============================================================
    // 📄 ПОКАЗ ДЕТАЛЕЙ КОНКРЕТНОГО ОБЪЕКТА
    // ============================================================

    showObjectDetails(cadNumber) {
        console.log(`📄 Показ деталей: ${cadNumber}`);
        
        // Ищем объект в сохраненных результатах
        if (this.allResults && this.allResults.length > 0) {
            const found = this.allResults.find(item => 
                item.cadastral_number.replace(/\s/g, '').toUpperCase() === cadNumber.replace(/\s/g, '').toUpperCase()
            );
            if (found) {
                this.currentResult = found;
                this.displayResult(found);
                this.showNotification(`Детали: ${cadNumber}`, 'success');
                return;
            }
        }
        
        // Если не нашли - делаем новый поиск
        const input = document.getElementById('cadSearchInput');
        if (input) {
            input.value = cadNumber;
            this.search();
        }
    }

    // ============================================================
    // 📋 КОПИРОВАНИЕ КАДАСТРОВОГО НОМЕРА
    // ============================================================

    copyCadastral(cadNumber) {
        if (!cadNumber) return;
        navigator.clipboard.writeText(cadNumber)
            .then(() => this.showNotification('✅ Кадастровый номер скопирован!', 'success'))
            .catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = cadNumber;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
                this.showNotification('✅ Кадастровый номер скопирован!', 'success');
            });
    }

    // ============================================================
    // 📥 ЭКСПОРТ РЕЗУЛЬТАТОВ
    // ============================================================

    exportResults() {
        if (!this.allResults || this.allResults.length === 0) {
            this.showNotification('Нет данных для экспорта', 'warning');
            return;
        }

        const data = this.allResults.map(item => ({
            'Кадастровый номер': item.cadastral_number || '—',
            'Тип объекта': item.object_type || '—',
            'Наименование': item.object_name || '—',
            'Площадь': item.area > 0 ? item.area.toFixed(1) : '—',
            'Адрес': item.address || '—',
            'Статус': item.status || '—',
            'Год постройки': item.year_built || '—',
            'Этажность': item.params_floors || '—',
            'Кадастровая стоимость': item.cadastral_value > 0 ? item.cadastral_value.toLocaleString() : '—',
            'УПКС': item.cadastral_index > 0 ? item.cadastral_index.toFixed(2) : '—',
            'Квартал': item.quarter_cad_number || '—'
        }));

        if (typeof XLSX !== 'undefined') {
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'НСПД');
            XLSX.writeFile(wb, `НСПД_поиск_${new Date().toISOString().split('T')[0]}.xlsx`);
            this.showNotification(`✅ Экспортировано ${data.length} объектов`, 'success');
        } else {
            const headers = Object.keys(data[0]);
            let csv = headers.join(',') + '\n';
            data.forEach(row => {
                csv += headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `НСПД_поиск_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification(`✅ Экспортировано ${data.length} объектов`, 'success');
        }
    }

    // ============================================================
    // 🏗️ ИЗВЛЕЧЕНИЕ КВАРТАЛА (для кнопки "Найти квартал")
    // ============================================================

    extractQuarter(cadNumber) {
        if (!cadNumber) return '';
        cadNumber = cadNumber.trim();
        const parts = cadNumber.split(':');
        
        if (parts.length >= 3) {
            return parts.slice(0, 3).join(':');
        }
        return '';
    }

    // ============================================================
    // 🔘 ДОБАВЛЕНИЕ КНОПКИ "НАЙТИ КВАРТАЛ" В КАРТОЧКУ
    // ============================================================

    addQuarterButton(quarter) {
        const resultDiv = document.getElementById('cadResult');
        if (!resultDiv) return;
        
        // Проверяем, есть ли уже кнопка
        const existingBtn = resultDiv.querySelector('.nspd-quarter-btn');
        if (existingBtn) return;
        
        // Находим контейнер с кнопками
        const buttonsContainer = resultDiv.querySelector('div:last-child');
        if (buttonsContainer) {
            const btn = document.createElement('button');
            btn.className = 'nspd-quarter-btn';
            btn.innerHTML = `🗺️ Найти квартал: ${quarter}`;
            btn.style.cssText = `
                padding: 5px 14px;
                background: #f0fdf4;
                color: #16a34a;
                border: 1px solid #bbf7d0;
                border-radius: 6px;
                cursor: pointer;
                font-size: 10px;
                transition: all 0.2s;
                font-family: 'Inter', sans-serif;
            `;
            btn.onmouseover = function() { 
                this.style.background = '#dcfce7'; 
                this.style.borderColor = '#86efac';
            };
            btn.onmouseout = function() { 
                this.style.background = '#f0fdf4'; 
                this.style.borderColor = '#bbf7d0';
            };
            btn.onclick = function() {
                window.nspdApp.searchQuarter(quarter);
            };
            buttonsContainer.appendChild(btn);
        }
    }

    // ============================================================
    // UI: ОТОБРАЖЕНИЕ ВСЕХ ДАННЫХ (БЕЗ ИЗМЕНЕНИЙ)
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

    // ОПРЕДЕЛЯЕМ ТИП ОБЪЕКТА
    const objectType = data.object_type || data.categoryName || '';
    const isBuilding = objectType.includes('Здание') || objectType.includes('Здания');
    const isPremises = objectType.includes('Помещение') || objectType.includes('Помещения');
    const isStructure = objectType.includes('Сооружение') || objectType.includes('Сооружения');
    const isConstruction = objectType.includes('Объект незавершенного строительства');
    const isComplex = objectType.includes('Единый недвижимый комплекс');
    const isLand = objectType.includes('Земельный участок');

    // ВЫЧИСЛЯЕМ УПКС
    let upksValue = data.cadastral_index || 0;
    if (upksValue === 0) {
        const cost = data.cadastral_value || 0;
        const area = data.specified_area || data.area || 0;
        if (cost > 0 && area > 0) {
            upksValue = cost / area;
        }
    }

    // ✅ БАЗОВЫЕ ПОЛЯ
    const fields = [
        { label: 'Кадастровый номер', value: data.cadastral_number || '—', important: true },
        { label: 'Кадастровый квартал', value: data.cadastral_quarter || '—' },
        { label: 'Тип объекта', value: objectType || '—', important: true },
        { label: 'Статус', value: data.status || '—' },
        { label: 'Форма собственности', value: data.ownership_type || '—' },
        { label: 'Адрес', value: data.address || '—', important: true },
        { label: 'Кадастровая стоимость', value: data.cadastral_value > 0 ? formatPrice(data.cadastral_value) : '—', important: true },
        { label: 'УПКС', value: upksValue > 0 ? upksValue.toFixed(2) + ' ₽/м²' : '—', important: true },
        { label: 'Назначение', value: data.purpose || '—' },
    ];

    // ✅ ДЛЯ ПОМЕЩЕНИЙ — ДОБАВЛЯЕМ СПЕЦИФИЧЕСКИЕ ПОЛЯ
    if (isPremises) {
        fields.push(
            { label: 'Тип помещения', value: data.params_type || data.object_name || '—' },
            { label: 'Площадь', value: data.area > 0 ? data.area.toFixed(1) + ' м²' : '—', important: true },
            { label: 'Этаж', value: data.floor || '—' },
            { label: 'Родительский объект', value: data.parent_cad_number || '—' },
            { label: 'Год постройки', value: data.year_built || '—' },
            { label: 'Год ввода в эксплуатацию', value: data.year_commisioning || '—' },
        );
    } else if (isBuilding) {
        fields.push(
            { label: 'Наименование', value: data.object_name || data.building_name || '—' },
            { label: 'Площадь', value: data.area > 0 ? data.area.toFixed(1) + ' м²' : '—', important: true },
            { label: 'Этажность', value: data.params_floors || data.floors || '—' },
            { label: 'Год постройки', value: data.year_built || '—' },
            { label: 'Год ввода в эксплуатацию', value: data.year_commisioning || '—' },
            { label: 'Материал стен', value: data.materials || '—' },
        );
    } else if (isStructure) {
        fields.push(
            { label: 'Наименование', value: data.object_name || '—' },
            { label: 'Протяженность', value: data.params_extension > 0 ? data.params_extension + ' м' : '—' },
            { label: 'Объем', value: data.params_volume > 0 ? data.params_volume + ' м³' : '—' },
            { label: 'Высота', value: data.params_height > 0 ? data.params_height + ' м' : '—' },
            { label: 'Глубина', value: data.params_depth > 0 ? data.params_depth + ' м' : '—' },
            { label: 'Год постройки', value: data.year_built || '—' },
        );
    } else if (isLand) {
        const areaValue = data.specified_area > 0 
            ? data.specified_area.toFixed(1) + ' м²' 
            : (data.area > 0 ? data.area.toFixed(1) + ' м²' : '—');
        
        fields.push(
            { label: 'Площадь', value: areaValue, important: true },
            { label: 'Категория земель', value: data.land_record_category_type || data.categoryName || '—' },
            { label: 'ВРИ', value: data.permitted_uses_name || data.purpose || '—' },
        );
    }

    // ДАТЫ (только если есть)
    if (data.registration_date) {
        fields.push({ label: 'Дата регистрации', value: formatDate(data.registration_date) });
    }

    const visibleFields = fields.filter(f => f.value && f.value !== '—' && f.value !== '');

    // КВАРТАЛ ДЛЯ КНОПКИ (используем кадастровый квартал)
    const quarter = data.cadastral_quarter || this.extractQuarter(data.cadastral_number);
    console.log('🏠 Кадастровый квартал для кнопки:', quarter);
    
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
                <span style="font-size: 13px; color: #1e293b;">Данные из НСПД</span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <span style="font-size: 9px; color: #10b981; background: #dcfce7; padding: 2px 10px; border-radius: 20px;">Найден</span>
                    <span style="font-size: 9px; color: #64748b; background: #f1f5f9; padding: 2px 10px; border-radius: 20px;">
                        ${objectType || 'Объект'}
                    </span>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; font-size: 12px;">
                ${visibleFields.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f8fafc; ${item.important ? 'background: #f8fafc; border-radius: 4px; padding-left: 4px; padding-right: 4px;' : ''}">
                        <span style="color: #64748b; font-size: 10px; white-space: nowrap; min-width: 40%;">${item.label}:</span>
                        <span style="color: #1e293b; text-align: right; word-break: break-word; font-size: 10px; max-width: 60%;">${item.value}</span>
                    </div>
                `).join('')}
            </div>
            
            <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                <button onclick="nspdApp.clear()" 
                        style="padding: 5px 14px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 10px;">
                    Очистить
                </button>
                ${quarter && quarter !== '—' && quarter !== '' ? `
                <button onclick="window.nspdApp.searchQuarter('${quarter}')" 
                        style="padding: 5px 14px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 6px; cursor: pointer; font-size: 10px;">
                    🗺️ Найти квартал: ${quarter}
                </button>
                ` : ''}
                <button onclick="nspdApp.copyData()" 
                        style="padding: 5px 14px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 6px; cursor: pointer; font-size: 10px;">
                    📋 Копировать
                </button>
            </div>
            
            <div style="margin-top: 8px; font-size: 8px; color: #cbd5e1; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                <span>Всего найдено: ${data.totalCount || 0}</span>
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
        this.allResults = [];
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

    searchQuarter(quarterNumber) {
        console.log('🔍 Поиск квартала:', quarterNumber);
        
        window._isNSPDSearch = true;
        console.log('🔒 Флаг _isNSPDSearch = true');
        
        const searchInput = document.getElementById('quarter-search-input');
        
        if (searchInput) {
            console.log('✅ Найдено поле поиска квартала:', searchInput);
            
            searchInput.value = '';
            searchInput.value = quarterNumber;
            searchInput.focus();
            
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            
            setTimeout(() => {
                searchInput.dispatchEvent(enterEvent);
            }, 100);
            
            const searchButton = searchInput.closest('div')?.querySelector('button') ||
                                searchInput.nextElementSibling?.querySelector('button') ||
                                searchInput.parentElement?.querySelector('button');
            
            if (searchButton) {
                setTimeout(() => {
                    console.log('🖱️ Клик по кнопке поиска:', searchButton);
                    searchButton.click();
                }, 200);
            }
            
            setTimeout(() => {
                window._isNSPDSearch = false;
                console.log('🔓 Флаг _isNSPDSearch сброшен');
            }, 3000);
            
            this.showNotification(`🔍 Квартал: ${quarterNumber}`, 'info');
            
        } else {
            console.error('❌ Поле quarter-search-input не найдено');
            this.showNotification('Поле поиска квартала не найдено', 'error');
            window._isNSPDSearch = false;
        }
    }
    
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
