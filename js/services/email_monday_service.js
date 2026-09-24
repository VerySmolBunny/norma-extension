/**
 * Servicio de Integración con la API GraphQL de Monday.com (v2)
 * Conexión exclusiva con el Tablero de Clientes (Board ID: 1400120846)
 * y Gestión de Mapeo de Variables Dinámicas Personalizadas.
 */

import { DriveFolderService, normalizeDriveClientName } from './drive_folder_service.js';

const DEFAULT_MONDAY_CONFIG = {
    apiToken: '', // Token de API personal de Monday.com
    boardId: '1400120846' // ID exclusivo del tablero de clientes
};

const DEFAULT_VARIABLE_DEFINITIONS = [
    {
        id: 'var_nombre_cliente',
        key: 'nombre_cliente',
        label: 'Nombre del Cliente / Contacto',
        source: 'monday',
        columnTitle: 'Contacto',
        description: 'Nombre de la persona o contacto del cliente en Monday'
    },
    {
        id: 'var_empresa',
        key: 'empresa',
        label: 'Empresa / Razón Social',
        source: 'monday',
        columnTitle: 'Empresa',
        description: 'Nombre de la empresa u organización del cliente'
    },
    {
        id: 'var_telefono',
        key: 'telefono',
        label: 'Teléfono / Móvil',
        source: 'monday',
        columnTitle: 'Teléfono',
        description: 'Número de teléfono o celular del cliente'
    },
    {
        id: 'var_email',
        key: 'email',
        label: 'Correo Electrónico',
        source: 'monday',
        columnTitle: 'Email',
        description: 'Correo electrónico registrado del cliente'
    },
    {
        id: 'var_cargo',
        key: 'cargo',
        label: 'Cargo / Puesto',
        source: 'monday',
        columnTitle: 'Cargo',
        description: 'Posición o cargo que ocupa en la empresa'
    },
    {
        id: 'var_link_carpeta',
        key: 'link_carpeta',
        label: 'Carpeta Drive (Grabaciones y Archivos)',
        source: 'drive',
        columnTitle: 'Carpeta Drive',
        description: 'URL de la carpeta en Google Drive con grabaciones y archivos del cliente'
    },
    {
        id: 'var_link_grabaciones',
        key: 'link_grabaciones',
        label: 'Link de Grabaciones (Drive)',
        source: 'drive',
        columnTitle: 'Grabaciones',
        description: 'Enlace directo a las grabaciones en Google Drive'
    },
    {
        id: 'var_fecha',
        key: 'fecha',
        label: 'Fecha Actual',
        source: 'system_date',
        columnTitle: '',
        description: 'Fecha de hoy formateada en español (ej: 25 de agosto de 2026)'
    },
    {
        id: 'var_mi_nombre',
        key: 'mi_nombre',
        label: 'Mi Nombre (Remitente)',
        source: 'system_user',
        columnTitle: '',
        description: 'Nombre del usuario que está redactando el correo'
    }
];

class MondayService {
    constructor() {
        this.configKey = 'ext_correo_monday_config';
        this.cacheKey = 'ext_correo_monday_clients_cache_v3';
        this.columnsCacheKey = 'ext_correo_monday_columns_cache_v3';
        this.variablesKey = 'ext_correo_variable_definitions';
        this.boardId = '1400120846'; // Tablero exclusivo garantizado
        this._memoryClients = null;
        this._isSyncing = false;
        this._syncPromise = null;
        this._driveFoldersCache = null;
        if (typeof DriveFolderService !== 'undefined') {
            DriveFolderService.getFoldersCache().then(cache => {
                this._driveFoldersCache = cache;
            }).catch(() => {});
        }
    }

    async resolveVariableValueAsync(varDef, client, userSenderName = '') {
        if (!this._driveFoldersCache && typeof DriveFolderService !== 'undefined') {
            this._driveFoldersCache = await DriveFolderService.getFoldersCache();
        }
        let val = this.resolveVariableValue(varDef, client, userSenderName);
        const k = (varDef?.key || '').toLowerCase();
        if (!val && (varDef?.source === 'drive' || k === 'link_carpeta' || k === 'link_grabaciones' || k === 'carpeta_drive')) {
            val = await DriveFolderService.resolveClientFolderUrl(client);
        }
        return val;
    }

    /**
     * Obtiene la configuración de Monday almacenada
     */
    async getConfig() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.configKey, 'mondayApiKey', 'boardId'], (result) => {
                    const cfg = result[this.configKey] || { ...DEFAULT_MONDAY_CONFIG };
                    if (!cfg.apiToken && result.mondayApiKey) {
                        cfg.apiToken = result.mondayApiKey;
                    }
                    cfg.boardId = cfg.boardId || result.boardId || this.boardId;
                    resolve(cfg);
                });
            } else {
                resolve(DEFAULT_MONDAY_CONFIG);
            }
        });
    }

    /**
     * Guarda la configuración de Monday
     */
    async saveConfig(config) {
        return new Promise((resolve) => {
            const finalConfig = {
                apiToken: (config.apiToken || '').trim(),
                boardId: (config.boardId || this.boardId).trim()
            };
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [this.configKey]: finalConfig }, () => resolve(true));
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Ejecuta una consulta GraphQL contra la API v2 de Monday.com
     */
    async _queryMonday(query, variables = {}) {
        const config = await this.getConfig();
        if (!config.apiToken) {
            throw new Error('No se ha configurado el API Token de Monday.com.');
        }

        const response = await fetch('https://api.monday.com/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': config.apiToken,
                'API-Version': '2024-01'
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Error en API Monday (${response.status}): ${err}`);
        }

        const json = await response.json();
        if (json.errors && json.errors.length > 0) {
            throw new Error(json.errors.map(e => e.message).join(', '));
        }

        return json.data;
    }

    /**
     * Obtiene las columnas reales disponibles en el Tablero 1400120846
     */
    async getBoardColumns(forceRefresh = false) {
        if (!forceRefresh) {
            const cached = await this._getCachedColumns();
            if (cached && cached.length > 0) return cached;
        }

        const config = await this.getConfig();
        if (!config.apiToken) {
            return [
                { id: 'name', title: 'Nombre del Elemento', type: 'name' },
                { id: 'email', title: 'Email / Correo', type: 'email' },
                { id: 'company', title: 'Empresa', type: 'text' },
                { id: 'phone', title: 'Teléfono', type: 'phone' },
                { id: 'title', title: 'Cargo', type: 'text' }
            ];
        }

        const query = `
            query GetColumns($boardId: [ID!]) {
                boards(ids: $boardId) {
                    id
                    name
                    columns {
                        id
                        title
                        type
                    }
                }
            }
        `;

        try {
            const data = await this._queryMonday(query, { boardId: [String(config.boardId || this.boardId)] });
            const boards = data.boards || [];
            if (boards.length > 0 && boards[0].columns) {
                const cols = boards[0].columns.filter(c => c.type !== 'subtasks' && c.type !== 'button');
                await this._saveCachedColumns(cols);
                return cols;
            }
        } catch (err) {
            console.warn('No se pudieron obtener columnas de Monday en vivo:', err);
        }

        return await this._getCachedColumns();
    }

    async _getCachedColumns() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.columnsCacheKey], (res) => {
                    resolve(res[this.columnsCacheKey] || []);
                });
            } else {
                resolve([]);
            }
        });
    }

    async _saveCachedColumns(cols) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [this.columnsCacheKey]: cols }, () => resolve(true));
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Gestión de Definición de Variables Dinámicas
     */
    async getVariableDefinitions() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.variablesKey], (res) => {
                    const list = res[this.variablesKey];
                    if (Array.isArray(list)) {
                        resolve(list);
                    } else if (list === undefined) {
                        chrome.storage.local.set({ [this.variablesKey]: DEFAULT_VARIABLE_DEFINITIONS });
                        resolve(DEFAULT_VARIABLE_DEFINITIONS);
                    } else {
                        resolve([]);
                    }
                });
            } else {
                resolve(DEFAULT_VARIABLE_DEFINITIONS);
            }
        });
    }

    async saveVariableDefinitions(variablesList) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [this.variablesKey]: variablesList }, () => resolve(true));
            } else {
                resolve(true);
            }
        });
    }

    async saveVariable(variableObj) {
        const vars = await this.getVariableDefinitions();
        const cleanKey = String(variableObj.key || '').toLowerCase().trim().replace(/[^a-zA-Z0-9_]/g, '_');
        const index = vars.findIndex(v => v.id === variableObj.id || v.key === cleanKey);

        const cleanVar = {
            id: variableObj.id || `var_${cleanKey || Date.now()}`,
            key: cleanKey,
            label: (variableObj.label || '').trim() || cleanKey,
            source: variableObj.source || 'monday',
            columnTitle: (variableObj.columnTitle || '').trim(),
            description: (variableObj.description || '').trim()
        };

        if (index >= 0) {
            vars[index] = cleanVar;
        } else {
            vars.push(cleanVar);
        }

        await this.saveVariableDefinitions(vars);
        return cleanVar;
    }

    async deleteVariable(varIdOrKey) {
        if (!varIdOrKey) return false;
        const target = String(varIdOrKey).trim().toLowerCase();
        const targetClean = target.startsWith('var_') ? target.slice(4) : target;

        const vars = await this.getVariableDefinitions();
        const filtered = vars.filter(v => {
            const id = String(v.id || '').trim().toLowerCase();
            const key = String(v.key || '').trim().toLowerCase();
            return id !== target && key !== target && key !== targetClean && ('var_' + key) !== target;
        });
        await this.saveVariableDefinitions(filtered);
        return true;
    }

    /**
     * Obtiene y sincroniza todos los clientes del tablero exclusivo (1400120846) de forma ultra rápida
     */
    async syncClients(forceRefresh = false, onProgress = null) {
        if (this._isSyncing && this._syncPromise) {
            return this._syncPromise;
        }

        const config = await this.getConfig();
        if (!config.apiToken) {
            return this.getCachedClients();
        }

        if (!forceRefresh) {
            const cached = await this.getCachedClients();
            if (cached && cached.length > 0) {
                this._memoryClients = cached;
                if (typeof onProgress === 'function') onProgress(cached.length, false);
                
                // Disparar sincronización silenciosa de fondo
                this._isSyncing = true;
                this._syncPromise = this._fetchClientsFromBoard(config.boardId || this.boardId, onProgress)
                    .then(fresh => {
                        this._memoryClients = fresh;
                        this._isSyncing = false;
                        this._syncPromise = null;
                        return fresh;
                    })
                    .catch(err => {
                        this._isSyncing = false;
                        this._syncPromise = null;
                        return cached;
                    });
                return cached;
            }
        }

        this._isSyncing = true;
        this._syncPromise = this._fetchClientsFromBoard(config.boardId || this.boardId, onProgress)
            .then(clients => {
                this._memoryClients = clients;
                this._isSyncing = false;
                this._syncPromise = null;
                return clients;
            })
            .catch(err => {
                this._isSyncing = false;
                this._syncPromise = null;
                console.warn('[Monday] Error sincronizando clientes:', err);
                return this.getCachedClients();
            });

        return this._syncPromise;
    }

    /**
     * Consulta el tablero exclusivo en Monday con payload ultra ligero y streaming progresivo
     */
    async _fetchClientsFromBoard(boardId, onProgress = null) {
        let allItems = [];
        let cursor = null;
        let boardColumns = [];

        // Página 1 (Payload ligero: solo id, name, column_values con id y text)
        const query1 = `
            query {
                boards(ids: [${String(boardId)}]) {
                    id
                    name
                    columns {
                        id
                        title
                    }
                    items_page(limit: 500) {
                        cursor
                        items {
                            id
                            name
                            column_values {
                                id
                                text
                            }
                        }
                    }
                }
            }
        `;

        const data = await this._queryMonday(query1);
        const boards = data.boards || [];
        if (boards.length === 0) {
            throw new Error(`No se encontró el tablero con ID ${boardId} en tu cuenta de Monday.`);
        }

        const board = boards[0];
        boardColumns = board.columns || [];
        await this._saveCachedColumns(boardColumns);

        if (board.items_page && board.items_page.items) {
            allItems.push(...board.items_page.items);
            cursor = board.items_page.cursor;
            
            // Carga progresiva instantánea: la primera página ya queda lista para buscar en memoria
            this._memoryClients = this._mapItemsToClients(allItems, boardColumns);
            if (typeof onProgress === 'function') onProgress(this._memoryClients.length, false);
        }

        // Páginas siguientes usando el cursor (carga progresiva)
        let pageCount = 1;
        while (cursor && pageCount < 30) {
            try {
                const nextQuery = `
                    query {
                        boards(ids: [${String(boardId)}]) {
                            items_page(cursor: ${JSON.stringify(cursor)}, limit: 500) {
                                cursor
                                items {
                                    id
                                    name
                                    column_values {
                                        id
                                        text
                                    }
                                }
                            }
                        }
                    }
                `;
                const nextData = await this._queryMonday(nextQuery);
                const nextBoard = (nextData && nextData.boards) ? nextData.boards[0] : null;
                
                if (nextBoard && nextBoard.items_page && nextBoard.items_page.items && nextBoard.items_page.items.length > 0) {
                    allItems.push(...nextBoard.items_page.items);
                    cursor = nextBoard.items_page.cursor;
                    pageCount++;
                    
                    // Actualizar memoria progresivamente
                    this._memoryClients = this._mapItemsToClients(allItems, boardColumns);
                    if (typeof onProgress === 'function') onProgress(this._memoryClients.length, false);
                } else {
                    // Fallback a next_items_page raíz
                    const rootQuery = `
                        query {
                            next_items_page(cursor: ${JSON.stringify(cursor)}, limit: 500) {
                                cursor
                                items {
                                    id
                                    name
                                    column_values {
                                        id
                                        text
                                    }
                                }
                            }
                        }
                    `;
                    const rootData = await this._queryMonday(rootQuery);
                    if (rootData && rootData.next_items_page && rootData.next_items_page.items && rootData.next_items_page.items.length > 0) {
                        allItems.push(...rootData.next_items_page.items);
                        cursor = rootData.next_items_page.cursor;
                        pageCount++;

                        this._memoryClients = this._mapItemsToClients(allItems, boardColumns);
                        if (typeof onProgress === 'function') onProgress(this._memoryClients.length, false);
                    } else {
                        cursor = null;
                    }
                }
            } catch (pageErr) {
                console.warn('[Monday] Error paginando clientes de Monday:', pageErr);
                cursor = null;
            }
        }

        console.log(`[Monday] Descarga completa: ${allItems.length} clientes indexados desde el tablero ${boardId}`);
        const clients = this._mapItemsToClients(allItems, boardColumns);
        this._memoryClients = clients;
        await this._saveCachedClients(clients);
        if (typeof onProgress === 'function') onProgress(clients.length, true);
        return clients;
    }

    /**
     * Mapea filas crudas de Monday a objetos de cliente estandarizados
     */
    _mapItemsToClients(allItems, columns = []) {
        const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        const isValidValue = (str) => {
            if (!str || typeof str !== 'string') return false;
            const s = str.trim().toLowerCase();
            return s !== '' && s !== 'n/a' && s !== 'na' && s !== 'n / a' && s !== '-' && s !== 'null' && s !== 'undefined' && s !== '#n/a';
        };

        return (allItems || []).map(item => {
            const rawName = (item.name || '').trim();
            const clientObj = {
                id: item.id,
                name: rawName,
                email: '',
                empresa: rawName, // En Monday, la primera columna "Cliente" es SIEMPRE el item.name
                cliente: rawName,
                telefono: '',
                cargo: '',
                contacto: '',
                allValues: {}
            };

            // 1. Guardar todos los valores crudos de las columnas
            (item.column_values || []).forEach(colVal => {
                const colDef = columns.find(c => c.id === colVal.id);
                const colTitle = colDef ? colDef.title.trim() : '';

                let colText = (colVal.text || '').trim();
                if (!colText) return;

                clientObj.allValues[colTitle] = colText;
                const sanitizedKey = colTitle.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
                clientObj.allValues[sanitizedKey] = colText;
                clientObj.allValues[colVal.id] = colText;
            });

            // 2. Extraer columnas específicas (Email, Teléfono, Cargo, Contacto)
            (item.column_values || []).forEach(colVal => {
                const colDef = columns.find(c => c.id === colVal.id);
                const colTitle = colDef ? colDef.title.trim() : '';
                const colTitleNorm = normalizeStr(colTitle);
                const colText = (clientObj.allValues[colTitle] || '').trim();

                if (!isValidValue(colText)) return;

                if (colTitleNorm.includes('email') || colTitleNorm.includes('correo')) {
                    if (!clientObj.email) clientObj.email = colText;
                } else if (colTitleNorm.includes('tel') || colTitleNorm.includes('phone') || colTitleNorm.includes('cel') || colTitleNorm.includes('movil')) {
                    if (!clientObj.telefono) clientObj.telefono = colText;
                } else if (colTitleNorm.includes('cargo') || colTitleNorm.includes('puesto') || colTitleNorm.includes('posicion') || colTitleNorm.includes('title')) {
                    if (!clientObj.cargo) clientObj.cargo = colText;
                } else if (colTitleNorm === 'contacto' || colTitleNorm === 'persona' || colTitleNorm === 'nombre' || colTitleNorm.includes('contacto')) {
                    if (!clientObj.contacto) clientObj.contacto = colText;
                }
            });

            // Si no hay contacto separado pero hay nombre del elemento, asignarlo
            if (!clientObj.contacto && isValidValue(rawName)) {
                clientObj.contacto = rawName;
            }

            return clientObj;
        });
    }

    /**
     * Búsqueda en vivo directa y de alta velocidad en la API de Monday por término de texto
     */
    async searchMondayLive(searchTerm) {
        if (!searchTerm || searchTerm.trim().length < 2) return [];
        const config = await this.getConfig();
        if (!config.apiToken) return [];

        const cleanTerm = searchTerm.trim();

        try {
            const query = `
                query {
                    boards(ids: [${String(config.boardId || this.boardId)}]) {
                        columns {
                            id
                            title
                        }
                        items_page(
                            limit: 50,
                            query_params: {
                                rules: [
                                    {
                                        column_id: "name",
                                        compare_value: [${JSON.stringify(cleanTerm)}],
                                        operator: contains_text
                                    }
                                ]
                            }
                        ) {
                            items {
                                id
                                name
                                column_values {
                                    id
                                    text
                                }
                            }
                        }
                    }
                }
            `;

            const data = await this._queryMonday(query);
            const boards = data.boards || [];
            if (boards.length === 0 || !boards[0].items_page || !boards[0].items_page.items) {
                return [];
            }

            const columns = boards[0].columns || [];
            const items = boards[0].items_page.items;
            const mapped = this._mapItemsToClients(items, columns);

            // Guardar los nuevos clientes encontrados en la memoria local y caché
            if (mapped.length > 0) {
                if (!this._memoryClients) {
                    this._memoryClients = await this.getCachedClients();
                }
                const existingIds = new Set(this._memoryClients.map(c => c.id));
                mapped.forEach(c => {
                    if (!existingIds.has(c.id)) {
                        this._memoryClients.push(c);
                        existingIds.add(c.id);
                    }
                });
                this._saveCachedClients(this._memoryClients).catch(console.warn);
            }

            return mapped;
        } catch (err) {
            console.warn('[Monday] Error en búsqueda en vivo:', err);
            return [];
        }
    }

    /**
     * Resuelve el valor de una variable según su definición y el cliente
     */
    resolveVariableValue(varDef, client, userSenderName = '') {
        if (!varDef) return '';

        if (varDef.source === 'system_date') {
            return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        }

        if (varDef.source === 'system_user') {
            return userSenderName || '';
        }

        if (varDef.source === 'manual') {
            return '';
        }

        const k = (varDef.key || '').toLowerCase();
        if (k === 'mi_nombre' || k === 'remitente' || k === 'mi_remitente' || k === 'sender' || k === 'asesor' || k === 'ejecutivo' || k === 'usuario' || k === 'nombre_remitente') {
            return userSenderName || '';
        }

        // Fuente Drive / Grabaciones
        if (varDef.source === 'drive' || k === 'link_carpeta' || k === 'link_grabaciones' || k === 'carpeta_drive' || k === 'carpeta' || k === 'grabaciones' || k === 'drive') {
            if (!client) return '';
            if (client.folderUrl && client.folderUrl.startsWith('http')) return client.folderUrl;
            if (client.driveFolderUrl && client.driveFolderUrl.startsWith('http')) return client.driveFolderUrl;
            if (client.linkCarpeta && client.linkCarpeta.startsWith('http')) return client.linkCarpeta;

            if (client.allValues) {
                for (const [key, val] of Object.entries(client.allValues)) {
                    if (/carpeta|drive|grabacion|enlace.*carpeta|link.*carpeta/i.test(key) && typeof val === 'string' && val.startsWith('http')) {
                        return val.trim();
                    }
                }
            }

            if (this._driveFoldersCache) {
                const cId = client.id ? String(client.id) : '';
                if (cId && this._driveFoldersCache.byClientId && this._driveFoldersCache.byClientId[cId]) {
                    return this._driveFoldersCache.byClientId[cId];
                }
                const cName = client.name || client.empresa || client.cliente || '';
                const normName = normalizeDriveClientName(cName);
                if (normName && this._driveFoldersCache.byClientName && this._driveFoldersCache.byClientName[normName]) {
                    return this._driveFoldersCache.byClientName[normName];
                }
            }
            return '';
        }

        // Fuente Monday
        if (!client) return '';

        const isValid = (str) => {
            if (!str || typeof str !== 'string') return false;
            const s = str.trim().toLowerCase();
            return s !== '' && s !== 'n/a' && s !== 'na' && s !== 'n / a' && s !== '-' && s !== 'null' && s !== 'undefined' && s !== '#n/a';
        };

        // Buscar por nombre de columna configurado (exacto o insensible a mayúsculas)
        if (varDef.columnTitle) {
            const reqTitle = varDef.columnTitle.trim().toLowerCase();

            // Buscar en allValues por coincidencia insensible a mayúsculas
            if (client.allValues) {
                for (const [key, val] of Object.entries(client.allValues)) {
                    if (key.trim().toLowerCase() === reqTitle && isValid(val)) {
                        return val;
                    }
                }
            }

            const sanitizedKey = varDef.columnTitle.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
            if (client.allValues && isValid(client.allValues[sanitizedKey])) {
                return client.allValues[sanitizedKey];
            }

            // Coincidencia con nombre de cliente o empresa
            if (reqTitle === 'clientes' || reqTitle === 'cliente' || reqTitle === 'empresa' || reqTitle.includes('cliente')) {
                if (isValid(client.empresa)) return client.empresa;
                if (isValid(client.cliente)) return client.cliente;
                if (isValid(client.name)) return client.name;
            }
            if (reqTitle === 'contacto' || reqTitle === 'nombre' || reqTitle === 'nombre del cliente') {
                if (isValid(client.contacto)) return client.contacto;
                if (isValid(client.name)) return client.name;
            }
        }

        // Fallbacks comunes por clave de variable
        if (k === 'empresa' || k === 'clientes' || k === 'cliente' || k === 'company' || k === 'razon_social') {
            if (isValid(client.empresa)) return client.empresa;
            if (isValid(client.cliente)) return client.cliente;
            if (isValid(client.name)) return client.name;
            if (isValid(client.contacto)) return client.contacto;
        } else if (k === 'nombre_cliente' || k === 'contacto' || k === 'nombre') {
            if (isValid(client.contacto)) return client.contacto;
            if (isValid(client.name)) return client.name;
            if (isValid(client.empresa)) return client.empresa;
        } else if (k === 'telefono' || k === 'celular' || k === 'fono') {
            return isValid(client.telefono) ? client.telefono : '';
        } else if (k === 'email' || k === 'correo') {
            return isValid(client.email) ? client.email : '';
        } else if (k === 'cargo' || k === 'puesto') {
            return isValid(client.cargo) ? client.cargo : '';
        }

        if (client.allValues) {
            for (const [key, val] of Object.entries(client.allValues)) {
                if (key.trim().toLowerCase() === k && isValid(val)) {
                    return val;
                }
            }
        }

        return (client.allValues && isValid(client.allValues[k])) ? client.allValues[k] : '';
    }

    /**
     * Obtiene los clientes en caché local
     */
    async getCachedClients() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.cacheKey], (result) => {
                    resolve(result[this.cacheKey] || []);
                });
            } else {
                resolve([]);
            }
        });
    }

    async _saveCachedClients(clients) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [this.cacheKey]: clients }, () => resolve(true));
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Busca un cliente en el tablero por correo electrónico o nombre
     */
    async findClientByEmailOrName(searchQuery) {
        if (!searchQuery) return null;
        const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const query = normalizeStr(searchQuery);
        
        let clients = this._memoryClients;
        if (!clients || clients.length === 0) {
            clients = await this.getCachedClients();
            this._memoryClients = clients;
        }

        return (clients || []).find(c => 
            (c.email && normalizeStr(c.email).includes(query)) ||
            (c.name && normalizeStr(c.name).includes(query)) ||
            (c.empresa && normalizeStr(c.empresa).includes(query)) ||
            (c.cliente && normalizeStr(c.cliente).includes(query)) ||
            (c.contacto && normalizeStr(c.contacto).includes(query)) ||
            (c.allValues && Object.values(c.allValues).some(v => typeof v === 'string' && normalizeStr(v).includes(query)))
        ) || null;
    }

    /**
     * Filtra clientes para autocompletado en vivo con búsqueda instantánea y fallback en directo a Monday
     */
    async searchClients(query) {
        const normalizeStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const q = normalizeStr(query);

        let clients = this._memoryClients;
        if (!clients || clients.length === 0) {
            clients = await this.getCachedClients();
            this._memoryClients = clients;
        }

        // Si la memoria y la caché local siguen vacías, sincronizar una vez
        if ((!clients || clients.length === 0) && !this._isSyncing) {
            clients = await this.syncClients(true);
        }

        if (!q) return (clients || []).slice(0, 30);

        const filterFn = (list) => (list || []).filter(c => {
            const name = normalizeStr(c.name);
            const empresa = normalizeStr(c.empresa);
            const cliente = normalizeStr(c.cliente);
            const contacto = normalizeStr(c.contacto);
            const email = normalizeStr(c.email);
            const phone = normalizeStr(c.telefono);

            if (name.includes(q) || empresa.includes(q) || cliente.includes(q) || contacto.includes(q) || email.includes(q) || phone.includes(q)) {
                return true;
            }
            if (c.allValues) {
                return Object.values(c.allValues).some(v => typeof v === 'string' && normalizeStr(v).includes(q));
            }
            return false;
        });

        const localMatches = filterFn(clients);
        if (localMatches.length > 0) {
            return localMatches.slice(0, 30);
        }

        // Si no hay coincidencias locales y el término tiene 2 o más letras, buscar directamente en el servidor de Monday
        if (q.length >= 2) {
            try {
                const liveMatches = await this.searchMondayLive(query);
                if (liveMatches && liveMatches.length > 0) {
                    return filterFn(liveMatches).slice(0, 30);
                }
            } catch (err) {
                console.warn('[Monday] Error buscando en vivo:', err);
            }
        }

        return [];
    }
}

// Exportar instancia singleton
const mondayService = new MondayService();
if (typeof module !== 'undefined') {
    module.exports = mondayService;
}
export default mondayService;
export { mondayService, MondayService, DEFAULT_VARIABLE_DEFINITIONS };

