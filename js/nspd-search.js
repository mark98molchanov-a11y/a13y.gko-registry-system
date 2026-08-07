(function() {
    console.log('🚀 Загрузка модуля поиска НСПД...');

    const AREA_TOLERANCE = 0.2;

    // 🔥 ПАРАМЕТРЫ ДЛЯ ПОИСКА (ПЕРЕКЛЮЧАТЕЛЬ)
    const SEARCH_PARAMS = {
        'area': {
            label: 'Площадь',
            unit: 'м²',
            getValue: (opts) => parseFloat(opts.area) || parseFloat(opts.params_area) || parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0,
            searchType: 'quarter'
        },
        'built_up_area': {
            label: 'Площадь застройки',
            unit: 'м²',
            getValue: (opts) => parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
            searchType: 'address'
        },
        'volume': {
            label: 'Объем',
            unit: 'м³',
            getValue: (opts) => parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
            searchType: 'address'
        },
        'extension': {
            label: 'Протяженность',
            unit: 'м',
            getValue: (opts) => parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
            searchType: 'address'
        },
        'land_area': {
            label: 'Площадь ЗУ',
            unit: 'м²',
            getValue: (opts) => parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
            searchType: 'address'
        },
        'depth': {
            label: 'Глубина',
            unit: 'м',
            getValue: (opts) => parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
            searchType: 'address'
        }
    };
    function normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function extractHouseNumber(address) {
        if (!address) return '';
        const match = address.match(/\b(?:дом|д|д\.)\s*(\d+[А-Яа-я]?)/i);
        return match ? match[1] : '';
    }

    function extractPlotNumber(address) {
        if (!address) return '';
        const match = address.match(/\b(?:участок|уч\.?)\s*(\d+[А-Яа-я]?)/i);
        return match ? match[1] : '';
    }

    function extractStreetFromAddress(address) {
        if (!address) return '';
        const patterns = [
            /ул(?:ица)?\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /проспект\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /пер(?:еулок)?\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /бульвар\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /набережная\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /шоссе\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /площадь\s+([^,\d]+?)(?:\s*[,д]|$)/i,
            /аллея\s+([^,\d]+?)(?:\s*[,д]|$)/i,
        ];
        for (const pattern of patterns) {
            const match = address.match(pattern);
            if (match) return match[1].trim();
        }
        return '';
    }

    function extractCadastralQuarter(cadNumber) {
        if (!cadNumber) return '';
        const parts = cadNumber.split(':');
        if (parts.length >= 3) {
            return parts.slice(0, 3).join(':');
        }
        return '';
    }

    function formatPrice(num) {
        if (!num || num === 0) return '—';
        return num.toLocaleString('ru-RU') + ' ₽';
    }

    function getFloorValue(floor) {
        if (!floor) return '—';
        let floorStr = floor;
        if (Array.isArray(floor)) floorStr = floor.length > 0 ? floor[0] : '—';
        if (typeof floorStr !== 'string') floorStr = String(floorStr);
        const match = floorStr.match(/^(\d+)/);
        return match ? match[1] : floorStr;
    }

    function isAreaMatch(area, targetArea) {
        return Math.abs(area - targetArea) <= AREA_TOLERANCE;
    }

    function isExtensionMatch(extension, targetExtension) {
        if (!targetExtension || targetExtension <= 0) return true;
        return Math.abs(extension - targetExtension) <= AREA_TOLERANCE;
    }

    function isBuiltUpAreaMatch(builtUpArea, targetBuiltUpArea) {
        if (!targetBuiltUpArea || targetBuiltUpArea <= 0) return true;
        return Math.abs(builtUpArea - targetBuiltUpArea) <= AREA_TOLERANCE;
    }

    function isVolumeMatch(volume, targetVolume) {
        if (!targetVolume || targetVolume <= 0) return true;
        return Math.abs(volume - targetVolume) <= AREA_TOLERANCE;
    }

    function isLandAreaMatch(landArea, targetLandArea) {
        if (!targetLandArea || targetLandArea <= 0) return true;
        return Math.abs(landArea - targetLandArea) <= AREA_TOLERANCE;
    }

    function isDepthMatch(depth, targetDepth) {
        if (!targetDepth || targetDepth <= 0) return true;
        return Math.abs(depth - targetDepth) <= AREA_TOLERANCE;
    }

    function getAddress(opts, props) {
        return opts.readable_address || opts.address_readable_address || props.descr || '';
    }

    function getCadNumber(opts, props) {
        return opts.cad_number || 
               opts.cad_num || 
               props.externalKey || 
               opts.externalKey || 
               props.label || 
               opts.label || 
               props.descr || 
               opts.descr || 
               '';
    }

    // ============================================================
    // ФУНКЦИЯ ПОИСКА ПО АДРЕСУ (ДЛЯ КАСКАДНОГО ПОИСКА)
    // ============================================================
    async function searchByAddress(address, param, value) {
        const addressVariants = [
            address,
            address.split(',').slice(0, -1).join(',').trim(),
            address.split(',').slice(0, -2).join(',').trim(),
            address.split(',').slice(0, 1).join(',').trim()
        ].filter(a => a && a.length > 0);
        
        const uniqueVariants = [...new Set(addressVariants)];
        let allFound = [];
        const seenCadNumbers = new Set();
        
        for (const variant of uniqueVariants) {
            const url = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(variant)}&thematicSearchId=1&limit=200`;
            try {
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const features = data?.data?.features || [];
                    
                    const filtered = features.filter(f => {
                        const opts = f.properties?.options || {};
                        const paramValue = param.getValue(opts);
                        const cadNumber = getCadNumber(opts, {});
                        return paramValue > 0 && Math.abs(paramValue - value) <= AREA_TOLERANCE && cadNumber;
                    });
                    
                    for (const f of filtered) {
                        const opts = f.properties?.options || {};
                        const cadNumber = getCadNumber(opts, {});
                        if (cadNumber && !seenCadNumbers.has(cadNumber)) {
                            seenCadNumbers.add(cadNumber);
                            allFound.push(f);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Ошибка поиска по варианту "${variant}":`, e.message);
            }
        }
        return allFound;
    }

    // ============================================================
    // 🔥 ФУНКЦИИ ДЛЯ МАССОВОГО ПОИСКА
    // ============================================================

    function extractAllFields(item) {
        const data = item.rawData;
        const opts = data.opts || {};
        const props = data.props || {};

        const objectType = item.type || data.props.categoryName || '';
        
        const categoryName = props.categoryName || opts.categoryName || '';
        const materials = opts.materials || opts.wall_material || props.materials || '';
        
        const isLand = objectType.includes('Земельный участок') || 
                       objectType.includes('Земельный') || 
                       objectType.includes('земельный участок');
        
        let upksValue = parseFloat(opts.cost_index) || 0;
        if (upksValue === 0) {
            const cost = parseFloat(opts.cost_value) || 0;
            const area = parseFloat(opts.specified_area) || item.area || parseFloat(opts.params_built_up_area) || 0;
            if (cost > 0 && area > 0) {
                upksValue = cost / area;
            }
        }

        let objectName = opts.params_name || opts.name || opts.building_name || '';
        if (!objectName && objectType) {
            objectName = objectType;
        }

        const floorValue = getFloorValue(opts.floor);
        const extensionValue = item.extension || parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
        const builtUpAreaValue = item.builtUpArea || parseFloat(opts.params_built_up_area) || parseFloat(opts.built_up_area) || 0;
        const volumeValue = item.volume || parseFloat(opts.params_volume) || parseFloat(opts.volume) || 0;
        const landAreaValue = item.landArea || parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0;
        const depthValue = item.depth || parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
        const address = getAddress(opts, props);
        
        const determinationCouse = opts.determination_couse || '';

        let displayArea = item.area;
        if (!displayArea || displayArea === 0) {
            const opts2 = data.opts || {};
            displayArea = parseFloat(opts2.area) || 
                          parseFloat(opts2.params_area) || 
                          parseFloat(opts2.specified_area) || 
                          parseFloat(opts2.build_record_area) || 0;
        }

        return {
            'Кадастровый номер': item.cadNumber || '—',
            'Вид объекта': categoryName || objectType || '—',
            'Наименование': objectName || '—',
            'Материал стен': materials || '—',
            'Адрес': address || '—',
            'Площадь (м²)': displayArea > 0 ? displayArea.toFixed(1) : '—',
            'Площадь застройки (м²)': builtUpAreaValue > 0 ? builtUpAreaValue.toFixed(1) : '—',
            'Объем (м³)': volumeValue > 0 ? volumeValue.toFixed(1) : '—',
            'Протяженность (м)': extensionValue > 0 ? extensionValue.toFixed(1) : '—',
            'Глубина (м)': depthValue > 0 ? depthValue.toFixed(1) : '—',
            'Площадь ЗУ (м²)': landAreaValue > 0 ? landAreaValue.toFixed(1) : '—',
            'Кадастровая стоимость': opts.cost_value ? formatPrice(parseFloat(opts.cost_value)) : '—',
            'УПКС (₽/м²)': upksValue > 0 ? upksValue.toFixed(2) : '—',
            'Назначение': opts.purpose || opts.params_purpose || opts.permitted_use_established_by_document || '—',
            'Статус': opts.common_data_status || opts.status || '—',
            'Форма собственности': opts.ownership_type || '—',
            'Этаж': floorValue,
            'Год постройки': opts.year_built || opts.params_year_built || '—',
            'ВРИ': isLand ? (opts.permitted_uses_name || opts.purpose || opts.params_purpose || '—') : '—',
            'Категория земель': isLand ? (opts.land_record_category_type || props.categoryName || '—') : '—',
            'Дата регистрации': opts.registration_date || opts.build_record_registration_date || opts.land_record_reg_date || '—',
            'Основание оценки': determinationCouse || '—'
        };
    }

    function exportResults() {
        const table = document.querySelector('#nspd-search-results table');
        if (!table) {
            alert('Нет данных для экспорта');
            return;
        }
        
        const rows = [];
        const headers = [];
        const ths = table.querySelectorAll('thead th');
        ths.forEach(th => headers.push(th.textContent.trim()));
        rows.push(headers);
        
        const trs = table.querySelectorAll('tbody tr');
        trs.forEach(tr => {
            const row = [];
            const tds = tr.querySelectorAll('td');
            tds.forEach(td => row.push(td.textContent.trim()));
            rows.push(row);
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length * 1.5, 15) }));
        XLSX.utils.book_append_sheet(wb, ws, 'Результаты');
        XLSX.writeFile(wb, 'nspd_search_results.xlsx');
    }

    function downloadTemplate() {
        if (typeof XLSX === 'undefined') {
            const headers = ['Адрес', 'Параметр', 'Значение'];
            const example = [
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, жилрайон Коротчаево', 'Протяженность', '113'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, мкр Мирный, д 1, корп 7, кв 84', 'Площадь', '66.8'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, улица Шоссейная, земельный участок 55', 'Площадь ЗУ', '1465'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Геологоразведчиков, д 12', 'Площадь застройки', '450'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул 26 Съезда КПСС, д 8', 'Объем', '1250'],
                ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Строителей, д 5', 'Глубина', '4555']
            ];
            
            let csv = '\uFEFF' + headers.join(';') + '\n';
            example.forEach(row => {
                csv += row.join(';') + '\n';
            });
            
            csv += '\n# Доступные параметры (пишите как в списке):\n';
            for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
                csv += `# ${param.label}\n`;
            }
            csv += '# Допуск: ±0.2\n';
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'nspd_search_template.csv';
            link.click();
            URL.revokeObjectURL(link.href);
            return;
        }

        const data = [
            ['Адрес', 'Параметр', 'Значение'],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, жилрайон Коротчаево', 'Протяженность', 113],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, мкр Мирный, д 1, корп 7, кв 84', 'Площадь', 66.8],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, улица Шоссейная, земельный участок 55', 'Площадь ЗУ', 1465],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Геологоразведчиков, д 12', 'Площадь застройки', 450],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул 26 Съезда КПСС, д 8', 'Объем', 1250],
            ['Ямало-Ненецкий автономный округ, г Новый Уренгой, ул Строителей, д 5', 'Глубина', 4555]
        ];
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 70 }, { wch: 25 }, { wch: 15 }];
        
        const paramLabels = Object.values(SEARCH_PARAMS).map(p => p.label);
        const validation = {
            type: 'list',
            operator: 'between',
            formula1: '"' + paramLabels.join(',') + '"',
            showErrorMessage: true,
            errorTitle: 'Ошибка ввода',
            error: 'Выберите значение из списка: ' + paramLabels.join(', ')
        };
        
        ws['!validations'] = [];
        for (let i = 2; i <= 100; i++) {
            ws['!validations'].push({
                ref: 'B' + i,
                validation: validation
            });
        }
        
        XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
        XLSX.writeFile(wb, 'nspd_search_template.xlsx');
    }

   function displayMassResults(candidates, notFoundCount, container, searchParamLabel) {
    const tableData = candidates.map(item => {
        const fields = extractAllFields(item);
        // Добавляем поле с названием параметра поиска
        fields['Параметр поиска'] = searchParamLabel || '—';
        return fields;
    });
    
    const orderedColumns = [
        'Параметр поиска',  // 🔥 НОВАЯ КОЛОНКА ПЕРВАЯ
        'Кадастровый номер',
        'Вид объекта',
        'Наименование',
        'Материал стен',
        'Адрес',
        'Площадь (м²)',
        'Площадь застройки (м²)',
        'Объем (м³)',
        'Протяженность (м)',
        'Глубина (м)',
        'Площадь ЗУ (м²)',
        'Кадастровая стоимость',
        'УПКС (₽/м²)',
        'Назначение',
        'Статус',
        'Форма собственности',
        'Этаж',
        'Год постройки',
        'ВРИ',
        'Категория земель',
        'Дата регистрации',
        'Основание оценки'
    ];

    let html = '';
    if (notFoundCount > 0) {
        html += `
            <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg text-sm mb-3">
                ✅ Найдено: <strong>${candidates.length}</strong> объектов | 
                ❌ Не найдено: <strong>${notFoundCount}</strong>
            </div>
        `;
    } else {
        html += `
            <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-3">
                ✅ Найдено: <strong>${candidates.length}</strong> объектов
            </div>
        `;
    }

    html += `
        <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" style="max-height: 600px; overflow-y: auto;">
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif;">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                            <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 30px;">#</th>
                            ${orderedColumns.map(col => `
                                <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: ${col.includes('Кадастровый') ? '150px' : col.includes('Адрес') ? '200px' : '100px'}; max-width: ${col.includes('Адрес') ? '250px' : '200px'};">
                                    ${col}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (candidates.length === 0) {
        html += `
            <tr>
                <td colspan="${orderedColumns.length + 1}" style="padding: 20px; text-align: center; color: #94a3b8;">
                    Объекты не найдены
                </td>
            </tr>
        `;
    } else {
        tableData.forEach((row, index) => {
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            html += `
                <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                    ${orderedColumns.map(col => {
                        let val = row[col] || '—';
                        return `<td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${val}">${val}</td>`;
                    }).join('')}
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; padding: 0 4px; flex-wrap: wrap; gap: 8px;">
            <span>Всего объектов: <strong>${candidates.length}</strong></span>
            <div style="display: flex; gap: 8px;">
                <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                        style="padding: 4px 16px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 11px;">
                    ✕ Очистить
                </button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    const exportBtn = document.getElementById('nspd-export-results');
    if (exportBtn && candidates.length > 0) {
        exportBtn.style.display = 'inline-flex';
    }
}

    async function uploadData(file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const fileName = file.name.toLowerCase();
            const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
            
            if (!isExcel) {
                const container = document.getElementById('nspd-search-results');
                if (container) container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Поддерживаются только файлы Excel (.xlsx, .xls)</div>`;
                return;
            }
            
            if (typeof XLSX === 'undefined') {
                const container = document.getElementById('nspd-search-results');
                if (container) container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Библиотека XLSX не загружена</div>`;
                return;
            }
            
            function getParamKeyByLabel(label) {
                for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
                    if (param.label === label.trim()) {
                        return key;
                    }
                }
                return null;
            }
            
            function processRows(rows) {
                let attempts = 0;
                const maxAttempts = 100;
                
                function waitForContainer() {
                    const container = document.getElementById('nspd-search-results');
                    
                    if (container) {
                        if (rows.length === 0) {
                            container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Нет данных для обработки. Проверьте названия параметров.</div>`;
                            return;
                        }
                        
                        const progressContainer = document.getElementById('nspd-progress-container');
                        const progressBar = document.getElementById('nspd-progress-bar');
                        const progressText = document.getElementById('nspd-progress-text');
                        if (progressContainer) progressContainer.style.display = 'block';
                        if (progressBar) progressBar.style.width = '0%';
                        if (progressText) progressText.textContent = '0%';
                        
                        let allResults = [];
                        let notFoundCount = 0;
                        let total = rows.length;
                        
                        (async function() {
                            for (let i = 0; i < rows.length; i++) {
                                const row = rows[i];
                                const percent = Math.round(((i + 1) / total) * 100);
                                if (progressBar) progressBar.style.width = percent + '%';
                                if (progressText) progressText.textContent = `${percent}% (${i + 1}/${total})`;
                                
                                const param = SEARCH_PARAMS[row.param];
                                if (!param) {
                                    notFoundCount++;
                                    continue;
                                }
                                
                            try {
    const features = await searchByAddress(row.address, param, row.value);
    if (features.length > 0) {
        let candidates = features.map(f => {
            const props = f.properties || {};
            const opts = props.options || {};
            return {
                feature: f,
                area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                builtUpArea: parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
                volume: parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
                extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                landArea: parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
                depth: parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
                address: opts.address_readable_address || opts.readable_address || '',
                cadNumber: getCadNumber(opts, props),
                type: opts.type || opts.object_type_value || '—',
                cadastralCost: parseFloat(opts.cost_value) || 0,
                name: opts.params_name || opts.name || '',
                determination_couse: opts.determination_couse || '',
                rawData: { feature: f, opts: opts, props: props }
            };
        });
        
        // 🔥 НОВЫЙ БЛОК: оставляем ТОЛЬКО ОДИН самый точный объект
        if (candidates.length > 1) {
            // Функция для подсчёта точности совпадения адреса
            function getAddressScore(candidateAddress, targetAddress) {
                if (!candidateAddress || !targetAddress) return 0;
                const normalizedTarget = normalizeString(targetAddress);
                const normalizedCandidate = normalizeString(candidateAddress);
                
                let score = 0;
                // Проверяем полное совпадение
                if (normalizedCandidate === normalizedTarget) return 100;
                
                // Проверяем вхождение
                if (normalizedCandidate.includes(normalizedTarget)) score += 50;
                if (normalizedTarget.includes(normalizedCandidate)) score += 30;
                
                // Проверяем наличие номера дома
                const targetHouse = extractHouseNumber(targetAddress);
                const candidateHouse = extractHouseNumber(candidateAddress);
                if (targetHouse && candidateHouse && targetHouse === candidateHouse) score += 20;
                
                // Проверяем наличие номера участка
                const targetPlot = extractPlotNumber(targetAddress);
                const candidatePlot = extractPlotNumber(candidateAddress);
                if (targetPlot && candidatePlot && targetPlot === candidatePlot) score += 20;
                
                // Учитываем длину адреса (чем длиннее, тем точнее)
                score += normalizedCandidate.length / 10;
                
                return score;
            }
            
            // Сортируем по точности (от большего к меньшему)
            candidates.sort((a, b) => {
                const scoreA = getAddressScore(a.address, row.address);
                const scoreB = getAddressScore(b.address, row.address);
                return scoreB - scoreA;
            });
            
            // Оставляем только первый (самый точный)
            candidates = candidates.slice(0, 1);
        }
        
        allResults = allResults.concat(candidates);
    } else {
        notFoundCount++;
    }
}
                            
                            if (progressContainer) progressContainer.style.display = 'none';

// Получаем название параметра из первой строки (если есть)
const searchParamLabel = rows.length > 0 ? SEARCH_PARAMS[rows[0].param]?.label || '—' : '—';
displayMassResults(allResults, notFoundCount, container, searchParamLabel);
                        })();
                    } else {
                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(waitForContainer, 100);
                        } else {
                            console.error('❌ resultsContainer не появился после ожидания');
                            const container = document.getElementById('nspd-search-results');
                            if (container) {
                                container.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Ошибка: контейнер результатов не найден. Попробуйте обновить страницу.</div>`;
                            }
                        }
                    }
                }
                
                waitForContainer();
            }
            
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            
            const nonEmptyRows = jsonData.filter(row => row.some(cell => cell !== undefined && cell !== null && cell !== ''));
            const headerRow = nonEmptyRows[0] || [];
            const dataRows = nonEmptyRows.slice(1);
            
            const headers = headerRow.map(h => String(h || '').trim().toLowerCase());
            
            let addressIdx = headers.findIndex(h => 
                h.includes('адрес') || h.includes('address') || h.includes('объект') || 
                h.includes('местоположение') || h.includes('location')
            );
            
            let paramIdx = headers.findIndex(h => 
                h.includes('параметр') || h.includes('param') || h.includes('тип') || 
                h.includes('характеристика') || h.includes('показатель')
            );
            
            let valueIdx = headers.findIndex(h => 
                h.includes('значение') || h.includes('value') || h.includes('число') ||
                h.includes('площадь') || h.includes('протяженность') || h.includes('глубина')
            );
            
            if (addressIdx === -1 || paramIdx === -1 || valueIdx === -1) {
                addressIdx = 0;
                paramIdx = 1;
                valueIdx = 2;
            }
            
            console.log(`📋 Заголовки:`, headers);
            console.log(`📍 Используем колонки: Адрес=${addressIdx}, Параметр=${paramIdx}, Значение=${valueIdx}`);
            
            const rows = [];
            for (const row of dataRows) {
                if (row.length > Math.max(addressIdx, paramIdx, valueIdx)) {
                    const paramValue = String(row[paramIdx] || '').trim();
                    let paramKey = getParamKeyByLabel(paramValue);
                    if (!paramKey && SEARCH_PARAMS[paramValue]) {
                        paramKey = paramValue;
                    }
                    if (!paramKey) {
                        for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
                            if (paramValue.toLowerCase().includes(param.label.toLowerCase()) || 
                                param.label.toLowerCase().includes(paramValue.toLowerCase())) {
                                paramKey = key;
                                break;
                            }
                        }
                    }
                    if (paramKey) {
                        rows.push({
                            address: String(row[addressIdx] || '').trim(),
                            param: paramKey,
                            value: parseFloat(row[valueIdx]) || 0
                        });
                    }
                }
            }
            
            console.log(`✅ Распаршено ${rows.length} строк`);
            processRows(rows);
        };
        
        reader.readAsArrayBuffer(file);
    }

    // ============================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ============================================================

    window.initNSPDSearch = function(containerId) {
        console.log(`🔍 Инициализация поиска НСПД в контейнере: ${containerId}`);
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Контейнер ${containerId} не найден`);
            return;
        }

        container.innerHTML = '';

        let paramOptions = '';
        for (const [key, param] of Object.entries(SEARCH_PARAMS)) {
            paramOptions += `<option value="${key}">${param.label} (${param.unit})</option>`;
        }

        const html = `
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h2 class="text-xl font-bold text-slate-800 mb-6">Поиск объектов в НСПД</h2>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Адрес / Улица</label>
                        <input type="text" id="nspd-search-address" 
                               placeholder="Введите адрес или улицу" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Параметр</label>
                        <select id="nspd-search-param" 
                                class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition bg-white">
                            ${paramOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Значение</label>
                        <input type="number" id="nspd-search-value" 
                               placeholder="Введите значение" 
                               class="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition">
                        <span class="text-xs text-slate-400 mt-1 block" id="nspd-search-unit">Допуск ±${AREA_TOLERANCE}</span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-3 mb-4">
                    <button id="nspd-search-btn" 
                            class="px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Найти объект
                    </button>

                    <button id="nspd-download-template" 
                            class="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Скачать шаблон
                    </button>

                    <label id="nspd-upload-btn" 
                           class="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                        </svg>
                        Загрузить данные
                        <input type="file" id="nspd-file-input" accept=".xlsx,.xls,.csv" style="display:none">
                    </label>

                    <button id="nspd-export-results" 
                            class="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition flex items-center justify-center gap-2" style="display:none;">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Экспорт в Excel
                    </button>
                </div>

                <div id="nspd-progress-container" style="display:none;" class="mb-4">
                    <div class="flex justify-between text-sm text-slate-600 mb-1">
                        <span>Обработка...</span>
                        <span id="nspd-progress-text">0%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-2.5">
                        <div id="nspd-progress-bar" class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                </div>

                <div id="nspd-search-results" class="mt-6">
                    <div class="text-center text-slate-400 py-8 text-sm">
                        Введите адрес, выберите параметр и значение, нажмите "Найти объект"
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        const searchBtn = document.getElementById('nspd-search-btn');
        const addressInput = document.getElementById('nspd-search-address');
        const paramSelect = document.getElementById('nspd-search-param');
        const valueInput = document.getElementById('nspd-search-value');
        const unitLabel = document.getElementById('nspd-search-unit');
        const resultsContainer = document.getElementById('nspd-search-results');

        if (!searchBtn || !addressInput || !paramSelect || !valueInput || !resultsContainer) {
            console.error('❌ Не удалось найти элементы управления');
            return;
        }

        paramSelect.addEventListener('change', function() {
            const paramKey = this.value;
            const param = SEARCH_PARAMS[paramKey];
            if (param) {
                unitLabel.textContent = `Допуск ±${AREA_TOLERANCE} ${param.unit}`;
            }
        });

        // ============================================================
        // 🔥 ОБНОВЛЕННАЯ ФУНКЦИЯ findBestMatch С ПРОВЕРКОЙ ПО НОМЕРУ УЧАСТКА И ГЛУБИНЕ
        // ============================================================

        function findBestMatch(features, targetArea, targetBuiltUpArea, targetVolume, targetExtension, targetLandArea, targetDepth, targetAddress) {
            const normalizedTargetAddress = normalizeString(targetAddress);
            const targetHouse = extractHouseNumber(targetAddress);
            const targetStreet = normalizeString(extractStreetFromAddress(targetAddress));
            const targetPlot = extractPlotNumber(targetAddress);

            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                if (targetArea && targetArea > 0 && !isAreaMatch(area, targetArea)) continue;

                let builtUpArea = parseFloat(opts.built_up_area) || 
                                  parseFloat(opts.params_built_up_area) || 
                                  parseFloat(opts.area) || 0;
                if (targetBuiltUpArea && targetBuiltUpArea > 0 && !isBuiltUpAreaMatch(builtUpArea, targetBuiltUpArea)) continue;

                let volume = parseFloat(opts.volume) || 
                             parseFloat(opts.params_volume) || 0;
                if (targetVolume && targetVolume > 0 && !isVolumeMatch(volume, targetVolume)) continue;

                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                if (targetExtension && targetExtension > 0 && !isExtensionMatch(extension, targetExtension)) continue;

                let landArea = parseFloat(opts.land_record_area) || 
                               parseFloat(opts.specified_area) || 0;
                if (targetLandArea && targetLandArea > 0 && !isLandAreaMatch(landArea, targetLandArea)) continue;

                let depth = parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
                if (targetDepth && targetDepth > 0 && !isDepthMatch(depth, targetDepth)) continue;

                const address = getAddress(opts, props);
                const addressLower = address.toLowerCase();
                const nspdHouse = extractHouseNumber(addressLower);
                const nspdStreet = normalizeString(extractStreetFromAddress(addressLower));
                const nspdPlot = extractPlotNumber(address);

                let streetMatch = false;
                if (targetStreet && nspdStreet) {
                    streetMatch = nspdStreet.includes(targetStreet) || 
                                  targetStreet.includes(nspdStreet) ||
                                  normalizeString(targetStreet) === normalizeString(nspdStreet);
                }

                let houseMatch = false;
                if (targetHouse && nspdHouse) {
                    houseMatch = nspdHouse === targetHouse;
                }

                let plotMatch = false;
                if (targetPlot && nspdPlot) {
                    plotMatch = nspdPlot === targetPlot;
                }

                let fullAddressMatch = false;
                if (targetAddress && address) {
                    const normalizedAddress = normalizeString(address);
                    const normalizedTarget = normalizeString(targetAddress);
                    fullAddressMatch = normalizedAddress.includes(normalizedTarget) || 
                                       normalizedTarget.includes(normalizedAddress);
                }

                if (streetMatch || houseMatch || plotMatch || fullAddressMatch) {
                    candidates.push({ 
                        feature, 
                        area, 
                        builtUpArea: builtUpArea,
                        volume: volume,
                        extension: extension,
                        landArea: landArea,
                        depth: depth,
                        address: address,
                        house: nspdHouse,
                        street: nspdStreet,
                        cadNumber: getCadNumber(opts, props),
                        type: opts.type || opts.object_type_value || '—',
                        cadastralCost: parseFloat(opts.cost_value) || 0,
                        name: opts.params_name || opts.name || '',
                        determination_couse: opts.determination_couse || '',
                        rawData: {
                            feature: feature,
                            opts: opts,
                            props: props
                        }
                    });
                }
            }

            candidates.sort((a, b) => {
                const diffA = Math.abs(a.area - targetArea) + Math.abs(a.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(a.volume - targetVolume) + Math.abs(a.extension - targetExtension) +
                              Math.abs(a.landArea - targetLandArea) + Math.abs(a.depth - targetDepth);
                const diffB = Math.abs(b.area - targetArea) + Math.abs(b.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(b.volume - targetVolume) + Math.abs(b.extension - targetExtension) +
                              Math.abs(b.landArea - targetLandArea) + Math.abs(b.depth - targetDepth);
                return diffA - diffB;
            });
            return candidates;
        }

        // ============================================================
        // ФУНКЦИЯ findInQuarter
        // ============================================================

        function findInQuarter(features, targetArea, targetBuiltUpArea, targetVolume, targetExtension, targetLandArea, targetDepth, targetQuarter) {
            let candidates = [];
            for (const feature of features) {
                const props = feature.properties || {};
                const opts = props.options || {};
                
                const cadNumber = getCadNumber(opts, props);
                const quarter = extractCadastralQuarter(cadNumber);
                if (quarter !== targetQuarter) continue;

                let area = parseFloat(opts.area) || parseFloat(opts.params_area) || 
                           parseFloat(opts.specified_area) || parseFloat(opts.build_record_area) || 0;
                if (targetArea && targetArea > 0 && !isAreaMatch(area, targetArea)) continue;

                let builtUpArea = parseFloat(opts.built_up_area) || 
                                  parseFloat(opts.params_built_up_area) || 
                                  parseFloat(opts.area) || 0;
                if (targetBuiltUpArea && targetBuiltUpArea > 0 && !isBuiltUpAreaMatch(builtUpArea, targetBuiltUpArea)) continue;

                let volume = parseFloat(opts.volume) || 
                             parseFloat(opts.params_volume) || 0;
                if (targetVolume && targetVolume > 0 && !isVolumeMatch(volume, targetVolume)) continue;

                let extension = parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0;
                if (targetExtension && targetExtension > 0 && !isExtensionMatch(extension, targetExtension)) continue;

                let landArea = parseFloat(opts.land_record_area) || 
                               parseFloat(opts.specified_area) || 0;
                if (targetLandArea && targetLandArea > 0 && !isLandAreaMatch(landArea, targetLandArea)) continue;

                let depth = parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0;
                if (targetDepth && targetDepth > 0 && !isDepthMatch(depth, targetDepth)) continue;

                const address = getAddress(opts, props);

                candidates.push({ 
                    feature, 
                    area, 
                    builtUpArea: builtUpArea,
                    volume: volume,
                    extension: extension,
                    landArea: landArea,
                    depth: depth,
                    address: address,
                    house: extractHouseNumber(address),
                    street: normalizeString(extractStreetFromAddress(address)),
                    cadNumber: cadNumber || '—',
                    type: opts.type || opts.object_type_value || '—',
                    cadastralCost: parseFloat(opts.cost_value) || 0,
                    name: opts.params_name || opts.name || '',
                    determination_couse: opts.determination_couse || '',
                    rawData: {
                        feature: feature,
                        opts: opts,
                        props: props
                    }
                });
            }

            candidates.sort((a, b) => {
                const diffA = Math.abs(a.area - targetArea) + Math.abs(a.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(a.volume - targetVolume) + Math.abs(a.extension - targetExtension) +
                              Math.abs(a.landArea - targetLandArea) + Math.abs(a.depth - targetDepth);
                const diffB = Math.abs(b.area - targetArea) + Math.abs(b.builtUpArea - targetBuiltUpArea) + 
                              Math.abs(b.volume - targetVolume) + Math.abs(b.extension - targetExtension) +
                              Math.abs(b.landArea - targetLandArea) + Math.abs(b.depth - targetDepth);
                return diffA - diffB;
            });
            return candidates;
        }


        async function performSearch(container) {
            const address = addressInput.value.trim();
            const paramKey = paramSelect.value;
            const value = parseFloat(valueInput.value) || 0;

            // Используем переданный container или ищем по id
            const resultsContainer = container || document.getElementById('nspd-search-results');
            
            if (!resultsContainer) {
                console.error('❌ resultsContainer не найден');
                return;
            }

            if (!address && value <= 0) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Введите адрес и/или значение параметра.</div>`;
                return;
            }
            if (!address) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Введите адрес.</div>`;
                return;
            }

            const param = SEARCH_PARAMS[paramKey];
            if (!param) {
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ Неизвестный параметр.</div>`;
                return;
            }

            resultsContainer.innerHTML = `
                <div class="flex justify-center items-center py-8 text-slate-500">
                    <svg class="animate-spin h-5 w-5 mr-3 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Поиск в НСПД...
                </div>
            `;

            try {
                let candidates = [];
                let searchMethod = '';

                console.log(`🔍 Поиск по адресу: ${address}`);
                console.log(`🔍 Параметр: ${param.label} = ${value} ${param.unit}`);

                // ШАГ 1: ПОИСК ПО АДРЕСУ
                console.log(`📡 ШАГ 1: Поиск по адресу (как для extension)`);
                const addressFeatures = await searchByAddress(address, param, value);
                
                if (addressFeatures.length > 0) {
                    candidates = addressFeatures.map(f => {
                        const props = f.properties || {};
                        const opts = props.options || {};
                        return {
                            feature: f,
                            area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                            builtUpArea: parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
                            volume: parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
                            extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                            landArea: parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
                            depth: parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
                            address: opts.address_readable_address || opts.readable_address || '',
                            cadNumber: getCadNumber(opts, props),
                            type: opts.type || opts.object_type_value || '—',
                            cadastralCost: parseFloat(opts.cost_value) || 0,
                            name: opts.params_name || opts.name || '',
                            determination_couse: opts.determination_couse || '',
                            rawData: {
                                feature: f,
                                opts: opts,
                                props: props
                            }
                        };
                    });
                    searchMethod = `адрес + ${param.label}`;
                    console.log(`✅ Найдено ${candidates.length} объектов по адресу`);
                }

                // ШАГ 2: ЕСЛИ НЕ НАШЛИ — ПОИСК ПО КВАРТАЛАМ (ТОЛЬКО ДЛЯ area)
                if (candidates.length === 0 && paramKey === 'area') {
                    console.log(`📡 ШАГ 2: Поиск по кварталам (fallback для площади)`);
                    searchMethod = `кварталы + ${param.label}`;
                    
                    const firstUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=200`;
                    const firstResponse = await fetch(firstUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (firstResponse.ok) {
                        const firstData = await firstResponse.json();
                        const firstFeatures = firstData?.data?.features || [];
                        
                        const quarters = new Set();
                        for (const feature of firstFeatures) {
                            const opts = feature.properties?.options || {};
                            const cadNumber = getCadNumber(opts, {});
                            if (cadNumber) {
                                const quarter = extractCadastralQuarter(cadNumber);
                                if (quarter) {
                                    quarters.add(quarter);
                                }
                            }
                        }
                        console.log(`🏘️ Найдено ${quarters.size} уникальных кварталов`);

                        for (const quarter of quarters) {
                            console.log(`🔍 Поиск по кварталу ${quarter}`);
                            const quarterUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=500`;
                            const quarterResponse = await fetch(quarterUrl, {
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            });

                            if (quarterResponse.ok) {
                                const quarterData = await quarterResponse.json();
                                const qFeatures = quarterData?.data?.features || [];
                                console.log(`   В квартале ${quarter} найдено ${qFeatures.length} объектов`);
                                
                                const qCandidates = findInQuarter(qFeatures, value, 0, 0, 0, 0, 0, quarter);
                                if (qCandidates.length > 0) {
                                    candidates = candidates.concat(qCandidates);
                                    console.log(`   ✅ Найдено ${qCandidates.length} объектов в квартале ${quarter}`);
                                }
                            }
                        }
                    }
                }

                // ШАГ 3: ЕСЛИ ВСЕ ЕЩЕ НЕ НАШЛИ — ПОИСК ПО КВАРТАЛАМ ДЛЯ ВСЕХ
                if (candidates.length === 0) {
                    console.log(`📡 ШАГ 3: Поиск по кварталам (финальный fallback)`);
                    
                    const firstUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${encodeURIComponent(address)}&thematicSearchId=1&limit=200`;
                    const firstResponse = await fetch(firstUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });
                    
                    if (firstResponse.ok) {
                        const firstData = await firstResponse.json();
                        const firstFeatures = firstData?.data?.features || [];
                        
                        const quarters = new Set();
                        for (const feature of firstFeatures) {
                            const opts = feature.properties?.options || {};
                            const cadNumber = getCadNumber(opts, {});
                            if (cadNumber) {
                                const quarter = extractCadastralQuarter(cadNumber);
                                if (quarter) {
                                    quarters.add(quarter);
                                }
                            }
                        }
                        console.log(`🏘️ Найдено ${quarters.size} уникальных кварталов`);

                        for (const quarter of quarters) {
                            console.log(`🔍 Поиск по кварталу ${quarter}`);
                            const quarterUrl = `https://nspd.gov.ru/api/geoportal/v2/search/geoportal?query=${quarter}&thematicSearchId=1&limit=500`;
                            const quarterResponse = await fetch(quarterUrl, {
                                headers: {
                                    'Accept': 'application/json',
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            });

                            if (quarterResponse.ok) {
                                const quarterData = await quarterResponse.json();
                                const qFeatures = quarterData?.data?.features || [];
                                console.log(`   В квартале ${quarter} найдено ${qFeatures.length} объектов`);
                                
                                const filtered = qFeatures.filter(f => {
                                    const opts = f.properties?.options || {};
                                    const paramValue = param.getValue(opts);
                                    const cadNumber = getCadNumber(opts, {});
                                    return paramValue > 0 && Math.abs(paramValue - value) <= AREA_TOLERANCE && cadNumber;
                                });
                                
                                if (filtered.length > 0) {
                                    const formatted = filtered.map(f => {
                                        const props = f.properties || {};
                                        const opts = props.options || {};
                                        return {
                                            feature: f,
                                            area: parseFloat(opts.area) || parseFloat(opts.params_area) || 0,
                                            builtUpArea: parseFloat(opts.built_up_area) || parseFloat(opts.params_built_up_area) || parseFloat(opts.area) || 0,
                                            volume: parseFloat(opts.volume) || parseFloat(opts.params_volume) || 0,
                                            extension: parseFloat(opts.params_extension) || parseFloat(opts.extension) || 0,
                                            landArea: parseFloat(opts.land_record_area) || parseFloat(opts.specified_area) || 0,
                                            depth: parseFloat(opts.params_depth) || parseFloat(opts.depth) || 0,
                                            address: opts.address_readable_address || opts.readable_address || '',
                                            cadNumber: getCadNumber(opts, props),
                                            type: opts.type || opts.object_type_value || '—',
                                            cadastralCost: parseFloat(opts.cost_value) || 0,
                                            name: opts.params_name || opts.name || '',
                                            determination_couse: opts.determination_couse || '',
                                            rawData: {
                                                feature: f,
                                                opts: opts,
                                                props: props
                                            }
                                        };
                                    });
                                    candidates = candidates.concat(formatted);
                                    console.log(`   ✅ Найдено ${formatted.length} объектов в квартале ${quarter}`);
                                }
                            }
                        }
                    }
                }

                if (candidates.length === 0) {
                    resultsContainer.innerHTML = `
                        <div class="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
                            🔍 Объекты не найдены<br>
                            <span class="text-xs">Метод: ${searchMethod || 'все методы'}</span>
                            ${address ? `<br><span class="text-xs">Адрес: ${address}</span>` : ''}
                            ${value > 0 ? `<br><span class="text-xs">Параметр: ${param.label} = ${value} ${param.unit} ±${AREA_TOLERANCE}</span>` : ''}
                            <br><span class="text-xs text-slate-500 mt-2 block">💡 Попробуйте уточнить адрес или значение</span>
                        </div>
                    `;
                    return;
                }

                // Сортируем по близости значения параметра
                candidates.sort((a, b) => {
                    const valA = param.getValue(a.rawData.opts || {});
                    const valB = param.getValue(b.rawData.opts || {});
                    return Math.abs(valA - value) - Math.abs(valB - value);
                });

                const tableData = candidates.map(item => extractAllFields(item));
                const allKeys = Object.keys(tableData[0] || {});
                const columnsToShow = allKeys.filter(key => {
                    return tableData.some(row => row[key] && row[key] !== '—' && row[key] !== '');
                });

                const paramLabel = param.label + ' (' + param.unit + ')';
                const firstColumn = paramLabel;
                const restColumns = columnsToShow.filter(col => col !== firstColumn);
                const orderedColumns = [firstColumn, ...restColumns];

                let tableHtml = `
                    <div class="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" style="max-height: 600px; overflow-y: auto;">
                        <div style="overflow-x: auto;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Inter', sans-serif;">
                                <thead style="position: sticky; top: 0; z-index: 10;">
                                    <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                        <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: 30px;">#</th>
                                        ${orderedColumns.map(col => `
                                            <th style="padding: 8px 10px; text-align: left; font-weight: 600; color: #475569; white-space: nowrap; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; min-width: ${col.includes('Кадастровый') ? '150px' : col.includes('Адрес') ? '200px' : '100px'}; max-width: ${col.includes('Адрес') ? '250px' : '200px'};">
                                                ${col}
                                            </th>
                                        `).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                `;

                tableData.forEach((row, index) => {
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                    
                    const paramValue = row[firstColumn];
                    const isMatch = paramValue !== '—' && value > 0 && 
                                   Math.abs(parseFloat(paramValue) - value) <= AREA_TOLERANCE;
                    
                    const highlightStyle = isMatch ? 'background: #dbeafe; border-left: 3px solid #3b82f6;' : '';
                    
                    tableHtml += `
                        <tr style="background: ${bgColor}; border-bottom: 1px solid #f1f5f9; transition: background 0.15s; ${highlightStyle}" 
                            onmouseover="this.style.background='#f0f9ff'" 
                            onmouseout="this.style.background='${isMatch ? '#dbeafe' : bgColor}'">
                            <td style="padding: 6px 10px; text-align: center; color: #94a3b8; font-weight: 500; font-size: 10px;">${index + 1}</td>
                            ${orderedColumns.map(col => {
                                let val = row[col] || '—';
                                if (col === 'Основание оценки' && val.length > 100) {
                                    val = val.substring(0, 100) + '...';
                                }
                                
                                if (col === firstColumn && val !== '—' && value > 0) {
                                    const numVal = parseFloat(val);
                                    if (Math.abs(numVal - value) <= AREA_TOLERANCE) {
                                        return `<td style="padding: 6px 10px; font-weight: 700; color: #2563eb; font-size: 10px;">${val}</td>`;
                                    }
                                }
                                return `
                                    <td style="padding: 6px 10px; color: #1e293b; font-size: 10px; word-break: break-word; max-width: 200px; overflow: hidden; text-overflow: ellipsis;" 
                                        title="${val}">
                                        ${val}
                                    </td>
                                `;
                            }).join('')}
                        </tr>
                    `;
                });

                tableHtml += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; padding: 0 4px; flex-wrap: wrap; gap: 8px;">
                        <span>Найдено объектов: <strong>${candidates.length}</strong></span>
                        <span style="font-size: 10px; color: #94a3b8;">Метод: ${searchMethod}</span>
                        <button onclick="document.getElementById('nspd-search-results').innerHTML = ''; location.reload();" 
                                style="padding: 4px 16px; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer; font-size: 11px; transition: all 0.2s;"
                                onmouseover="this.style.background='#fee2e2'"
                                onmouseout="this.style.background='#fef2f2'">
                            ✕ Очистить результаты
                        </button>
                    </div>
                `;

                resultsContainer.innerHTML = tableHtml;

                // 🔥 Показываем кнопку экспорта после успешного поиска
                const exportBtn = document.getElementById('nspd-export-results');
                if (exportBtn && candidates.length > 0) {
                    exportBtn.style.display = 'inline-flex';
                }
displayMassResults(candidates, 0, resultsContainer, param.label);
            } catch (error) {
                console.error('❌ Ошибка поиска:', error);
                resultsContainer.innerHTML = `<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">❌ Ошибка: ${error.message}</div>`;
            }
        }

        searchBtn.addEventListener('click', function() { performSearch(resultsContainer); });
        addressInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') performSearch(resultsContainer); });
        valueInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') performSearch(resultsContainer); });

        const downloadBtn = document.getElementById('nspd-download-template');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadTemplate);
        }

        const fileInput = document.getElementById('nspd-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', function(e) {
                if (this.files && this.files.length > 0) {
                    uploadData(this.files[0]);
                    this.value = '';
                }
            });
        }

        // 🔥 Обработчик для кнопки экспорта
        const exportBtn = document.getElementById('nspd-export-results');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportResults);
        }

        console.log('✅ Интерфейс поиска НСПД успешно загружен.');
    };

    console.log('✅ Модуль поиска НСПД загружен.');
})();
