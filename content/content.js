/**
 * Content Script inyectado en Gmail (https://mail.google.com/*)
 * Detecta ventanas de redacción, inyecta el botón corporativo,
 * vincula clientes automáticamente desde Monday.com (Tablero: 1400120846)
 * y autocompleta variables dinámicas en las plantillas.
 */

(() => {
    let cachedTemplates = [];
    let currentCategory = 'TODAS';

    // 1. Cargar plantillas inicialmente
    async function loadTemplates(force = false) {
        try {
            if (typeof firebaseService !== 'undefined') {
                cachedTemplates = await firebaseService.getTemplates(force);
            }
        } catch (err) {
            console.error('[Plantillas Gmail] Error cargando plantillas:', err);
        }
    }

    // Escuchar actualizaciones desde el popup/background/dashboard
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'RELOAD_TEMPLATES' || message.action === 'TEMPLATES_UPDATED') {
                console.log('[Plantillas Gmail] Recargando plantillas actualizadas...');
                loadTemplates(false);
            }
        });
    }

    // 2. Observer para detectar ventanas de redacción (Compose / Reply)
    function observeGmailCompose() {
        const observer = new MutationObserver(() => {
            injectTemplateButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Ejecución periódica de respaldo para garantizar detección
        setInterval(injectTemplateButtons, 1000);

        // Ejecutar inmediatamente
        injectTemplateButtons();
    }

    // 3. Inyectar botón EXCLUSIVAMENTE en la barra de herramientas de redacción (Compose / Reply) de Gmail
    function injectTemplateButtons() {
        // 3.1 Limpiar botones erróneos que pudieran haberse inyectado fuera de ventanas de redacción
        document.querySelectorAll('.ext-cor-btn-wrapper, .ext-cor-btn-cell, .ext-cor-compose-btn').forEach(btnElem => {
            const wrapper = btnElem.classList.contains('ext-cor-compose-btn') ? btnElem.parentElement : btnElem;
            if (!wrapper) return;

            const composeContainer = wrapper.closest('div[role="dialog"], div[role="region"], form, .M9, .AD, .inboxsdk__compose, .dw');
            const hasEditableBody = composeContainer && composeContainer.querySelector('div[role="textbox"][contenteditable="true"], div[contenteditable="true"].editable, div.Am.Al.editable, div[aria-label*="Cuerpo del mensaje"], div[aria-label*="Message Body"]');
            const isInvalidLocation = wrapper.closest('[gh="tm"], .G-atb, .G-tF, .bqa, .brb, .brc, .mG, .ha, .aqL, .aeH, div[role="listbox"]');

            if (!composeContainer || !hasEditableBody || isInvalidLocation) {
                if (wrapper.parentNode) wrapper.remove();
            }
        });

        // 3.2 Buscar barras de herramientas de redacción válidas (tr.btC o .btC dentro de compose)
        const composeToolbars = [];

        // Método A: Buscar filas estándar tr.btC / .btC de redacción
        const standardToolbars = document.querySelectorAll('tr.btC, .btC');
        standardToolbars.forEach(tb => {
            if (!composeToolbars.includes(tb)) composeToolbars.push(tb);
        });

        // Método B: Encontrar barra a través del botón de Enviar / Send específico de redacción
        const sendButtons = document.querySelectorAll('div[role="button"][data-tooltip*="Enviar"], div[role="button"][aria-label*="Enviar"], div[role="button"][data-tooltip*="Send"], div[role="button"][aria-label*="Send"], div.T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
        sendButtons.forEach(btn => {
            const composeBox = btn.closest('div[role="dialog"], div[role="region"], form, .M9, .AD, .inboxsdk__compose, .dw');
            if (composeBox) {
                const tb = btn.closest('tr.btC') || btn.closest('.btC') || btn.closest('tr');
                if (tb && !composeToolbars.includes(tb)) {
                    composeToolbars.push(tb);
                }
            }
        });

        composeToolbars.forEach(toolbar => {
            // Ignorar si ya tiene el botón inyectado
            if (toolbar.querySelector('.ext-cor-btn-wrapper') || toolbar.querySelector('.ext-cor-btn-cell') || toolbar.querySelector('.ext-cor-compose-btn')) {
                return;
            }

            // Ignorar explícitamente barras fuera de compose (cabeceras, listas de correos, respuestas sugeridas)
            if (toolbar.closest('[gh="tm"], .G-atb, .G-tF, .bqa, .brb, .brc, .mG, .ha, .aqL, .aeH')) {
                return;
            }

            // Encontrar el contenedor de redacción padre
            const composeContainer = toolbar.closest('div[role="dialog"]') ||
                                     toolbar.closest('div[role="region"]') ||
                                     toolbar.closest('form') ||
                                     toolbar.closest('.M9') ||
                                     toolbar.closest('.AD') ||
                                     toolbar.closest('.inboxsdk__compose') ||
                                     toolbar.closest('.dw');

            // CRÍTICO: Verificar que este contenedor realmente sea una ventana de redacción con cuerpo editable
            if (!composeContainer) return;
            const editableBody = composeContainer.querySelector('div[role="textbox"][contenteditable="true"], div[contenteditable="true"].editable, div.Am.Al.editable, div[aria-label*="Cuerpo del mensaje"], div[aria-label*="Message Body"]');
            if (!editableBody) return;

            const isTableRow = toolbar.tagName === 'TR';
            const wrapper = document.createElement(isTableRow ? 'td' : 'div');
            wrapper.className = isTableRow ? 'gU ext-cor-btn-cell' : 'ext-cor-btn-wrapper';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ext-cor-compose-btn';
            btn.title = 'Insertar plantilla de correo corporativa';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span>Plantillas</span>
            `;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openTemplateModal(composeContainer);
            });

            wrapper.appendChild(btn);

            // Inyectar ordenadamente junto al botón de Enviar
            const sendBtnContainer = toolbar.querySelector('.gU.Up') || toolbar.querySelector('td.gU') || toolbar.querySelector('.Up') || toolbar.firstElementChild;
            if (sendBtnContainer && sendBtnContainer.nextSibling) {
                toolbar.insertBefore(wrapper, sendBtnContainer.nextSibling);
            } else if (sendBtnContainer) {
                sendBtnContainer.after(wrapper);
            } else {
                toolbar.appendChild(wrapper);
            }
        });
    }

    // Extraer correo o nombre del destinatario en Compose
    function extractRecipientFromCompose(composeContainer) {
        if (!composeContainer) return '';
        const chips = composeContainer.querySelectorAll('div[data-hovercard-id], span[email], div.vR span.vN');
        for (const chip of chips) {
            const email = chip.getAttribute('email') || chip.getAttribute('data-hovercard-id') || chip.textContent;
            if (email && email.includes('@')) return email.trim();
            if (chip.textContent && chip.textContent.trim()) return chip.textContent.trim();
        }
        const toInput = composeContainer.querySelector('input[name="to"], input[peoplekit-id], textarea[name="to"]');
        if (toInput && toInput.value) {
            return toInput.value.trim();
        }
        return '';
    }

    // Detectar de forma inteligente el nombre y correo del usuario/remitente actual de Gmail
    async function detectGmailSenderInfo(composeContainer) {
        let detectedName = '';
        let detectedEmail = '';

        // 1. Revisar si hay un nombre guardado en almacenamiento local
        try {
            const saved = await new Promise((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['ext_correo_user_sender_name', 'ext_correo_user_email'], (res) => resolve(res || {}));
                } else {
                    resolve({});
                }
            });
            if (saved.ext_correo_user_sender_name) detectedName = saved.ext_correo_user_sender_name;
            if (saved.ext_correo_user_email) detectedEmail = saved.ext_correo_user_email;
        } catch (e) {}

        // 2. Extraer del selector 'De' / 'From' del redactor de Gmail si existe
        if (composeContainer) {
            const fromElem = composeContainer.querySelector('input[name="from"], [name="from"] input, div[name="from"], div[aria-label*="De:"], div[aria-label*="From:"]');
            if (fromElem) {
                const raw = fromElem.value || fromElem.textContent || '';
                const match = raw.match(/([^<\n\r]+)<([^>]+)>/);
                if (match) {
                    if (!detectedName) detectedName = match[1].trim().replace(/^["']|["']$/g, '');
                    if (!detectedEmail) detectedEmail = match[2].trim();
                } else if (raw.includes('@')) {
                    if (!detectedEmail) detectedEmail = raw.trim();
                }
            }
        }

        // 3. Extraer del botón de Perfil de Google en la barra superior derecha
        if (!detectedName) {
            const accountSelectors = [
                'a[aria-label*="Cuenta de Google"]',
                'a[aria-label*="Google Account"]',
                'a[aria-label*="Google:"]',
                'div[aria-label*="Cuenta de Google"]',
                'div[aria-label*="Google Account"]',
                'a.gb_d[aria-label]',
                'a.gb_A[aria-label]',
                'a[href*="accounts.google.com"]'
            ];
            
            for (const sel of accountSelectors) {
                const elems = document.querySelectorAll(sel);
                for (const el of elems) {
                    const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
                    if (!label) continue;

                    // Formatos:
                    // "Cuenta de Google: Nombre Apellido\n(usuario@empresa.com)"
                    // "Google Account: Nombre Apellido (usuario@empresa.com)"
                    // "Nombre Apellido (usuario@empresa.com)"
                    const m = label.match(/(?:Cuenta de Google|Google Account|Google)?[:\s]*([^\n\(\<]+)(?:[\n\s\(\<]+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))?/i);
                    if (m && m[1]) {
                        const candidate = m[1].trim().replace(/^["']|["']$/g, '');
                        if (candidate && !candidate.toLowerCase().startsWith('cuenta de google') && !candidate.toLowerCase().startsWith('google account') && !candidate.includes('@')) {
                            detectedName = candidate;
                            if (m[2] && !detectedEmail) detectedEmail = m[2].trim();
                            break;
                        }
                    }
                }
                if (detectedName) break;
            }
        }

        // 4. Extraer de la foto de perfil en la barra superior (img con alt)
        if (!detectedName) {
            const profileImgs = document.querySelectorAll('img[alt*="Foto de perfil"], img[alt*="Profile photo"], img.gb_k, img.gb_m');
            for (const img of profileImgs) {
                const alt = img.getAttribute('alt') || '';
                const matchAlt = alt.match(/(?:Foto de perfil de|Profile photo of|Foto del perfil:?)\s*([^\n\(\<]+)/i);
                if (matchAlt && matchAlt[1]) {
                    const candidate = matchAlt[1].trim();
                    if (candidate && !candidate.includes('@')) {
                        detectedName = candidate;
                        break;
                    }
                }
            }
        }

        // 5. Extraer del título de la ventana si contiene el correo
        if (!detectedEmail) {
            const titleMatch = document.title.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
            if (titleMatch) {
                detectedEmail = titleMatch[1].trim();
            }
        }

        // 6. Si detectamos un nombre o correo nuevo, guardarlo en segundo plano en caché local
        if (detectedName && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ ext_correo_user_sender_name: detectedName, ext_correo_user_email: detectedEmail });
        }

        return { name: detectedName, email: detectedEmail };
    }

    // 4. Modal Flotante de Selección de Plantillas
    async function openTemplateModal(composeContainer) {
        closeTemplateModal();

        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'ext-cor-modal-overlay';
        modalOverlay.id = 'extCorModalOverlay';

        const modalContainer = document.createElement('div');
        modalContainer.className = 'ext-cor-modal-container';

        // Estructura interna del modal
        modalContainer.innerHTML = `
            <div class="ext-cor-header">
                <div class="ext-cor-header-title">
                    <img src="${chrome.runtime.getURL('icons/icon48.png')}" class="ext-cor-header-icon" alt="Logo">
                    <span>Plantillas Corporativas</span>
                </div>
                <div class="ext-cor-header-right">
                    <button type="button" class="ext-cor-dash-link-btn" id="extCorOpenDashBtn" title="Abrir Administrador a pantalla completa">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        <span>Administrar</span>
                    </button>
                    <button type="button" class="ext-cor-close-btn" id="extCorCloseBtn">&times;</button>
                </div>
            </div>

            <!-- Banner de Cliente Vinculado desde Monday.com -->
            <div class="ext-cor-monday-bar" id="extCorMondayBar">
                <div class="ext-cor-monday-info">
                    <span class="monday-badge-icon">📊</span>
                    <div class="monday-text-group">
                        <span class="monday-main-label" id="mondayClientLabel">Buscando cliente en Monday.com (Tablero 1400120846)...</span>
                        <span class="monday-sub-label" id="mondayClientSubLabel"></span>
                    </div>
                </div>
                <button type="button" class="monday-select-btn" id="extCorSelectMondayClientBtn">Seleccionar Cliente</button>
            </div>

            <!-- Selector desplegable de clientes de Monday -->
            <div class="ext-cor-client-picker" id="extCorClientPicker" style="display: none;">
                <input type="text" id="mondaySearchClientInput" placeholder="🔍 Buscar cliente en Monday (Tablero 1400120846)..." class="ext-cor-monday-search">
                <div class="ext-cor-client-results" id="mondayClientResults"></div>
            </div>

            <div class="ext-cor-search-section">
                <input type="text" class="ext-cor-search-input" id="extCorSearchInput" placeholder="🔍 Buscar por plantilla, asunto o contenido..." autofocus autocomplete="off">
                <div class="ext-cor-category-chips" id="extCorCategoryChips"></div>
            </div>

            <div class="ext-cor-list" id="extCorList"></div>

            <div class="ext-cor-var-filler" id="extCorVarFiller" style="display: none;">
                <!-- Selector Directo de Cliente de Monday dentro del rellenador -->
                <div class="ext-cor-filler-monday-box" id="fillerMondayBox">
                    <div class="filler-monday-header">
                        <div class="filler-monday-label">
                            <span style="font-size: 15px;">🏢</span>
                            <strong>Cliente / Empresa de Monday.com (Tablero 1400120846):</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="filler-monday-hint" id="fillerMondayHint">Busca y selecciona para autocompletar</span>
                            <button type="button" id="fillerForceSyncBtn" class="filler-sync-btn" title="Descargar clientes actualizados desde Monday">🔄 Sincronizar</button>
                        </div>
                    </div>

                    <div class="filler-monday-search-wrap" id="fillerSearchWrap">
                        <input type="text" id="fillerMondaySearchInput" class="filler-monday-search-input" placeholder="🔍 Escribe para buscar cliente o empresa (ej: Xiaomi, Buk)..." autocomplete="off">
                        <div id="fillerMondayResultsDropdown" class="filler-monday-dropdown" style="display: none;"></div>
                    </div>

                    <div id="fillerActiveClientBadge" class="filler-active-client-badge" style="display: none;">
                        <div class="filler-client-pill-info">
                            <span class="filler-check">✅</span>
                            <span id="fillerClientNameTxt" style="font-weight: 600;">Cliente Seleccionado</span>
                            <span id="fillerClientCompanyTxt" style="color: #15803d; font-size: 11px;">(Empresa)</span>
                        </div>
                        <button type="button" id="fillerClearClientBtn" class="filler-clear-client-btn" title="Cambiar o buscar otro cliente de Monday">Cambiar Cliente 🔄</button>
                    </div>
                </div>

                <div class="ext-cor-filler-title">📝 Datos de la plantilla:</div>
                <div class="ext-cor-filler-grid" id="extCorVarGrid"></div>
                <div class="ext-cor-filler-actions">
                    <button type="button" class="ext-cor-action-btn secondary" id="extCorBackToListBtn">Volver</button>
                    <button type="button" class="ext-cor-action-btn primary" id="extCorApplyVarsBtn">Insertar en Correo</button>
                </div>
            </div>
        `;

        modalOverlay.appendChild(modalContainer);
        document.body.appendChild(modalOverlay);

        // Referencias internas
        const closeBtn = modalContainer.querySelector('#extCorCloseBtn');
        const openDashBtn = modalContainer.querySelector('#extCorOpenDashBtn');
        const mondayBar = modalContainer.querySelector('#extCorMondayBar');
        const mondayClientLabel = modalContainer.querySelector('#mondayClientLabel');
        const mondayClientSubLabel = modalContainer.querySelector('#mondayClientSubLabel');
        const selectMondayClientBtn = modalContainer.querySelector('#extCorSelectMondayClientBtn');
        const clientPicker = modalContainer.querySelector('#extCorClientPicker');
        const mondaySearchClientInput = modalContainer.querySelector('#mondaySearchClientInput');
        const mondayClientResults = modalContainer.querySelector('#mondayClientResults');

        const searchInput = modalContainer.querySelector('#extCorSearchInput');
        const chipsContainer = modalContainer.querySelector('#extCorCategoryChips');
        const listContainer = modalContainer.querySelector('#extCorList');
        const varFillerSection = modalContainer.querySelector('#extCorVarFiller');
        const varGrid = modalContainer.querySelector('#extCorVarGrid');
        const backToListBtn = modalContainer.querySelector('#extCorBackToListBtn');
        const applyVarsBtn = modalContainer.querySelector('#extCorApplyVarsBtn');

        // Referencias de selección de cliente en el rellenador de variables
        const fillerSearchWrap = modalContainer.querySelector('#fillerSearchWrap');
        const fillerMondaySearchInput = modalContainer.querySelector('#fillerMondaySearchInput');
        const fillerMondayResultsDropdown = modalContainer.querySelector('#fillerMondayResultsDropdown');
        const fillerActiveClientBadge = modalContainer.querySelector('#fillerActiveClientBadge');
        const fillerClientNameTxt = modalContainer.querySelector('#fillerClientNameTxt');
        const fillerClientCompanyTxt = modalContainer.querySelector('#fillerClientCompanyTxt');
        const fillerClearClientBtn = modalContainer.querySelector('#fillerClearClientBtn');
        const fillerForceSyncBtn = modalContainer.querySelector('#fillerForceSyncBtn');
        const fillerMondayHint = modalContainer.querySelector('#fillerMondayHint');

        let selectedTemplateForVars = null;
        let activeMondayClient = null;

        // 4.1 Buscar cliente de Monday automáticamente según el destinatario
        const recipientQuery = extractRecipientFromCompose(composeContainer);
        if (typeof mondayService !== 'undefined') {
            const onSyncProgress = (count, done) => {
                if (fillerMondayHint) {
                    fillerMondayHint.textContent = done ? `${count} clientes listos` : `Cargando: ${count} clientes...`;
                }
                if (!activeMondayClient && !recipientQuery && mondayClientLabel) {
                    mondayClientLabel.textContent = `Tablero Monday (1400120846) • ${count} clientes`;
                }
            };

            // Sincronizar progresivamente en segundo plano
            mondayService.syncClients(false, onSyncProgress).catch(console.warn);

            let cachedClients = await mondayService.getCachedClients();
            if (cachedClients && cachedClients.length > 0) {
                if (fillerMondayHint) {
                    fillerMondayHint.textContent = `${cachedClients.length} clientes listos`;
                }
                if (recipientQuery) {
                    const matched = await mondayService.findClientByEmailOrName(recipientQuery);
                    if (matched) {
                        setMatchedMondayClient(matched);
                    } else {
                        mondayClientLabel.textContent = `Tablero Monday (1400120846) • ${cachedClients.length} clientes`;
                        mondayClientSubLabel.textContent = `No se detectó "${recipientQuery}". Puedes buscarlo en la plantilla.`;
                    }
                } else {
                    mondayClientLabel.textContent = `Tablero Monday (1400120846) • ${cachedClients.length} clientes`;
                    mondayClientSubLabel.textContent = 'Busca una empresa o cliente para autocompletar variables';
                }
            } else {
                mondayBar.style.display = 'none';
            }
        } else {
            mondayBar.style.display = 'none';
        }

        function setMatchedMondayClient(client) {
            activeMondayClient = client;
            mondayClientLabel.innerHTML = `✨ Cliente: <strong>${escapeHtml(client.contacto || client.name || client.empresa)}</strong>`;
            const extra = [client.empresa, client.email, client.telefono].filter(Boolean).join(' • ');
            mondayClientSubLabel.textContent = extra || 'Datos sincronizados desde tablero 1400120846';
            selectMondayClientBtn.textContent = 'Cambiar';
            clientPicker.style.display = 'none';
        }

        // Selector manual de clientes de Monday
        selectMondayClientBtn.addEventListener('click', () => {
            if (clientPicker.style.display === 'none') {
                clientPicker.style.display = 'block';
                renderMondayClientSearch('');
                mondaySearchClientInput.focus();
            } else {
                clientPicker.style.display = 'none';
            }
        });

        mondaySearchClientInput.addEventListener('input', () => {
            renderMondayClientSearch(mondaySearchClientInput.value);
        });

        async function renderMondayClientSearch(query) {
            if (typeof mondayService === 'undefined') return;
            const results = await mondayService.searchClients(query);
            mondayClientResults.innerHTML = '';

            if (results.length === 0) {
                mondayClientResults.innerHTML = '<div style="padding: 10px; color: #64748b; font-size: 12px;">No se encontraron clientes en el tablero 1400120846</div>';
                return;
            }

            results.forEach(client => {
                const item = document.createElement('div');
                item.className = 'monday-client-item';
                item.innerHTML = `
                    <div style="font-weight: 600; color: #0f172a;">${escapeHtml(client.contacto || client.name)}</div>
                    <div style="font-size: 11px; color: #64748b;">
                        ${client.empresa ? `🏢 ${escapeHtml(client.empresa)} ` : ''}
                        ${client.email ? `✉️ ${escapeHtml(client.email)} ` : ''}
                        ${client.telefono ? `📞 ${escapeHtml(client.telefono)}` : ''}
                    </div>
                `;
                item.addEventListener('click', () => {
                    setMatchedMondayClient(client);
                });
                mondayClientResults.appendChild(item);
            });
        }

        // 4.2 Renderizar categorías
        async function renderChips() {
            let managedCats = [];
            if (typeof firebaseService !== 'undefined' && firebaseService.getCategories) {
                try {
                    managedCats = await firebaseService.getCategories();
                } catch (e) {}
            }

            const categories = new Set(['TODAS']);
            managedCats.forEach(c => categories.add(c));
            cachedTemplates.forEach(t => { if (t.category) categories.add(t.category); });

            chipsContainer.innerHTML = '';
            categories.forEach(cat => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = `ext-cor-chip ${currentCategory === cat ? 'active' : ''}`;
                chip.textContent = cat;
                chip.addEventListener('click', () => {
                    currentCategory = cat;
                    renderChips();
                    renderList();
                });
                chipsContainer.appendChild(chip);
            });
        }

        // 4.3 Renderizar listado de plantillas
        function renderList() {
            const query = (searchInput.value || '').toLowerCase().trim();

            const filtered = cachedTemplates.filter(t => {
                const matchesCat = currentCategory === 'TODAS' || t.category === currentCategory;
                const matchesQuery = !query ||
                    (t.title && t.title.toLowerCase().includes(query)) ||
                    (t.subject && t.subject.toLowerCase().includes(query)) ||
                    (t.category && t.category.toLowerCase().includes(query)) ||
                    (t.bodyHtml && t.bodyHtml.toLowerCase().includes(query));
                return matchesCat && matchesQuery;
            });

            listContainer.innerHTML = '';

            if (filtered.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 30px 10px; color: #64748b;">
                        <p style="font-weight: 600;">No se encontraron plantillas</p>
                        <small>Prueba con otra búsqueda o categoría</small>
                    </div>
                `;
                return;
            }

            filtered.forEach(template => {
                const item = document.createElement('div');
                item.className = 'ext-cor-item';

                const varsHtml = (template.variables || []).map(v => `<span class="ext-cor-var-tag">{{${v}}}</span>`).join('');

                item.innerHTML = `
                    <div class="ext-cor-item-head">
                        <span class="ext-cor-item-title">${escapeHtml(template.title)}</span>
                        <span class="ext-cor-item-badge">${escapeHtml(template.category || 'General')}</span>
                    </div>
                    <div class="ext-cor-item-subject"><strong>Asunto:</strong> ${escapeHtml(template.subject)}</div>
                    ${varsHtml ? `<div class="ext-cor-item-vars">${varsHtml}</div>` : ''}
                `;

                item.addEventListener('click', () => {
                    handleTemplateSelection(template);
                });

                listContainer.appendChild(item);
            });
        }

        // 4.4 Manejar selección de plantilla y autollenado de variables desde Monday
        async function handleTemplateSelection(template) {
            // Extraer variables tanto del asunto como del cuerpo
            let vars = (template.variables && Array.isArray(template.variables) && template.variables.length > 0) 
                ? [...template.variables] 
                : [];

            const varsFound = new Set(vars);
            const regex = /\{\{([^}]+)\}\}/g;
            let match;
            const fullContent = (template.subject || '') + ' ' + (template.bodyHtml || '');
            while ((match = regex.exec(fullContent)) !== null) {
                varsFound.add(match[1].trim());
            }
            vars = Array.from(varsFound);
            template.variables = vars;

            if (vars.length > 0) {
                selectedTemplateForVars = template;
                listContainer.style.display = 'none';
                chipsContainer.style.display = 'none';
                searchInput.style.display = 'none';
                mondayBar.style.display = 'none';
                clientPicker.style.display = 'none';
                varFillerSection.style.display = 'block';

                updateFillerMondayClientView();
                await populateFillerVariableFields();

                if (!activeMondayClient) {
                    setTimeout(() => fillerMondaySearchInput.focus(), 50);
                }
            } else {
                insertTemplateIntoGmail(composeContainer, template.subject, template.bodyHtml);
                closeTemplateModal();
            }
        }

        const isValidVal = (val) => Boolean(val && typeof val === 'string' && !['n/a', 'na', 'n / a', '-', 'null', 'undefined', '#n/a'].includes(val.trim().toLowerCase()));

        // Actualiza el aspecto del bloque de cliente de Monday en la pantalla de variables
        function updateFillerMondayClientView() {
            if (activeMondayClient) {
                fillerSearchWrap.style.display = 'none';
                fillerActiveClientBadge.style.display = 'flex';

                let compName = '';
                if (isValidVal(activeMondayClient.empresa)) compName = activeMondayClient.empresa;
                else if (isValidVal(activeMondayClient.cliente)) compName = activeMondayClient.cliente;
                else if (isValidVal(activeMondayClient.name)) compName = activeMondayClient.name;
                else if (isValidVal(activeMondayClient.contacto)) compName = activeMondayClient.contacto;
                else compName = 'Cliente';

                let contactName = '';
                if (isValidVal(activeMondayClient.contacto) && activeMondayClient.contacto !== compName) {
                    contactName = activeMondayClient.contacto;
                } else if (isValidVal(activeMondayClient.name) && activeMondayClient.name !== compName) {
                    contactName = activeMondayClient.name;
                }

                fillerClientNameTxt.textContent = compName;
                fillerClientCompanyTxt.textContent = contactName ? `(${contactName})` : '';
            } else {
                fillerActiveClientBadge.style.display = 'none';
                fillerSearchWrap.style.display = 'block';
                fillerMondayResultsDropdown.style.display = 'none';
                fillerMondaySearchInput.value = '';
            }
        }

        // Rellena la cuadrícula de inputs con los valores resueltos de variables
        async function populateFillerVariableFields() {
            if (!selectedTemplateForVars) return;
            const vars = selectedTemplateForVars.variables || [];
            varGrid.innerHTML = '';

            const hoy = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
            const senderInfo = await detectGmailSenderInfo(composeContainer);

            let varDefs = [];
            if (typeof mondayService !== 'undefined') {
                varDefs = await mondayService.getVariableDefinitions();
            }

            for (const varName of vars) {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'ext-cor-filler-field';

                const vLower = varName.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
                const def = varDefs.find(d => d.key === vLower || d.key === varName);

                let suggestedValue = '';
                let sourceTag = '';
                let isAuto = false;

                if (def && typeof mondayService !== 'undefined') {
                    suggestedValue = mondayService.resolveVariableValue(def, activeMondayClient, senderInfo.name);
                    if (def.source === 'drive' || def.key === 'link_carpeta' || def.key === 'link_grabaciones') {
                        if (suggestedValue) {
                            sourceTag = `<span style="color: #059669; font-weight: normal; font-size: 10px;">(📁 Google Drive)</span>`;
                            isAuto = true;
                        }
                    } else if (def.source === 'monday' && suggestedValue) {
                        sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Monday: ${escapeHtml(def.columnTitle || def.key)})</span>`;
                        isAuto = true;
                    } else if (def.source === 'system_date') {
                        sourceTag = `<span style="color: #0369a1; font-weight: normal; font-size: 10px;">(Fecha Actual)</span>`;
                        isAuto = true;
                    } else if (def.source === 'system_user' && suggestedValue) {
                        sourceTag = `<span style="color: #6366f1; font-weight: normal; font-size: 10px;">(Gmail: ${escapeHtml(senderInfo.name)})</span>`;
                        isAuto = true;
                    }
                }

                // Si aún no hay valor para variables de Drive, intentar resolver con DriveFolderContentService
                if (!suggestedValue && (def?.source === 'drive' || vLower === 'link_carpeta' || vLower === 'link_grabaciones' || vLower === 'carpeta_drive' || vLower === 'carpeta' || vLower === 'grabaciones')) {
                    if (activeMondayClient && window.DriveFolderContentService) {
                        suggestedValue = await window.DriveFolderContentService.resolveClientFolderUrl(activeMondayClient);
                        if (suggestedValue) {
                            sourceTag = `<span style="color: #059669; font-weight: normal; font-size: 10px;">(📁 Google Drive)</span>`;
                            isAuto = true;
                        }
                    }
                }

                if (!suggestedValue && !def) {
                    // Fallback heurístico
                    if (vLower === 'mi_nombre' || vLower === 'remitente' || vLower === 'mi_remitente' || vLower === 'sender' || vLower === 'asesor' || vLower === 'ejecutivo' || vLower === 'usuario' || vLower === 'nombre_remitente') {
                        suggestedValue = senderInfo.name || '';
                        if (suggestedValue) {
                            sourceTag = `<span style="color: #6366f1; font-weight: normal; font-size: 10px;">(Gmail: ${escapeHtml(senderInfo.name)})</span>`;
                            isAuto = true;
                        }
                    } else if (vLower === 'mi_email' || vLower === 'mi_correo' || vLower === 'correo_remitente') {
                        suggestedValue = senderInfo.email || '';
                        if (suggestedValue) {
                            sourceTag = `<span style="color: #6366f1; font-weight: normal; font-size: 10px;">(Gmail: ${escapeHtml(senderInfo.email)})</span>`;
                            isAuto = true;
                        }
                    } else if (activeMondayClient) {
                        if (vLower === 'empresa' || vLower === 'clientes' || vLower === 'cliente' || vLower === 'company' || vLower === 'razon_social') {
                            if (isValidVal(activeMondayClient.empresa)) suggestedValue = activeMondayClient.empresa;
                            else if (isValidVal(activeMondayClient.cliente)) suggestedValue = activeMondayClient.cliente;
                            else if (isValidVal(activeMondayClient.name)) suggestedValue = activeMondayClient.name;
                            sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Auto Monday)</span>`;
                            isAuto = true;
                        } else if (vLower === 'nombre_cliente' || vLower === 'contacto' || vLower === 'nombre') {
                            if (isValidVal(activeMondayClient.contacto)) suggestedValue = activeMondayClient.contacto;
                            else if (isValidVal(activeMondayClient.name)) suggestedValue = activeMondayClient.name;
                            sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Auto Monday)</span>`;
                            isAuto = true;
                        } else if (vLower === 'telefono' || vLower === 'celular' || vLower === 'movil') {
                            suggestedValue = isValidVal(activeMondayClient.telefono) ? activeMondayClient.telefono : '';
                            if (suggestedValue) {
                                sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Auto Monday)</span>`;
                                isAuto = true;
                            }
                        } else if (vLower === 'cargo' || vLower === 'posicion') {
                            suggestedValue = isValidVal(activeMondayClient.cargo) ? activeMondayClient.cargo : '';
                            if (suggestedValue) {
                                sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Auto Monday)</span>`;
                                isAuto = true;
                            }
                        } else if (vLower === 'email' || vLower === 'correo') {
                            suggestedValue = isValidVal(activeMondayClient.email) ? activeMondayClient.email : '';
                            if (suggestedValue) {
                                sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Auto Monday)</span>`;
                                isAuto = true;
                            }
                        } else if (activeMondayClient.allValues && isValidVal(activeMondayClient.allValues[vLower])) {
                            suggestedValue = activeMondayClient.allValues[vLower];
                            sourceTag = `<span style="color: #16a34a; font-weight: normal; font-size: 10px;">(Auto Monday)</span>`;
                            isAuto = true;
                        }
                    }

                    if (!suggestedValue && (vLower === 'fecha' || vLower === 'date')) {
                        suggestedValue = hoy;
                        sourceTag = `<span style="color: #0369a1; font-weight: normal; font-size: 10px;">(Fecha Actual)</span>`;
                        isAuto = true;
                    }
                }

                const labelText = def ? (def.label || def.key) : varName.replace(/_/g, ' ').toUpperCase();

                fieldDiv.innerHTML = `
                    <label for="extCorVar_${varName}">
                        ${escapeHtml(labelText)} ${sourceTag}
                    </label>
                    <input type="text" id="extCorVar_${varName}" class="${isAuto && suggestedValue ? 'auto-filled' : ''}" data-var="${varName}" value="${escapeHtml(suggestedValue)}" placeholder="Ingresa ${varName}...">
                `;
                varGrid.appendChild(fieldDiv);
            }
        }

        let fillerSearchDebounce = null;
        let fillerSearchSeq = 0;

        // Botón de sincronización manual de Monday
        if (fillerForceSyncBtn) {
            fillerForceSyncBtn.addEventListener('click', async () => {
                fillerForceSyncBtn.disabled = true;
                fillerForceSyncBtn.textContent = '🔄 Sincronizando...';
                if (fillerMondayHint) fillerMondayHint.textContent = 'Descargando clientes...';

                try {
                    const clients = await mondayService.syncClients(true, (count, done) => {
                        if (fillerMondayHint) {
                            fillerMondayHint.textContent = done ? `${count} clientes listos` : `Cargando: ${count} clientes...`;
                        }
                    });
                    fillerForceSyncBtn.textContent = `✅ ${clients.length} clientes`;
                    if (fillerMondayHint) fillerMondayHint.textContent = `${clients.length} clientes listos`;
                    
                    // Si había un texto en el buscador, re-filtrar
                    if (fillerMondaySearchInput.value.trim()) {
                        fillerMondaySearchInput.dispatchEvent(new Event('input'));
                    }

                    setTimeout(() => {
                        fillerForceSyncBtn.textContent = '🔄 Sincronizar';
                        fillerForceSyncBtn.disabled = false;
                    }, 3000);
                } catch (err) {
                    console.warn('[Monday] Error sincronizando clientes:', err);
                    fillerForceSyncBtn.textContent = '⚠️ Reintentar';
                    fillerForceSyncBtn.disabled = false;
                }
            });
        }

        // Búsqueda en vivo de cliente de Monday en el formulario de variables
        fillerMondaySearchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(fillerSearchDebounce);

            if (!query) {
                fillerMondayResultsDropdown.style.display = 'none';
                return;
            }

            const currentSeq = ++fillerSearchSeq;

            fillerSearchDebounce = setTimeout(async () => {
                if (typeof mondayService === 'undefined') return;

                const results = await mondayService.searchClients(query);
                if (currentSeq !== fillerSearchSeq) return; // Descartar si el usuario siguió escribiendo

                fillerMondayResultsDropdown.innerHTML = '';

                if (results.length === 0) {
                    fillerMondayResultsDropdown.innerHTML = `
                        <div style="padding: 10px; font-size: 12px; color: #64748b; text-align: center;">
                            No se encontró ningún cliente o empresa con "${escapeHtml(query)}" en Monday.
                            <div style="margin-top: 5px; font-size: 11px; color: #94a3b8;">
                                Puedes pulsar el botón "🔄 Sincronizar" arriba si fue agregado recientemente.
                            </div>
                        </div>
                    `;
                    fillerMondayResultsDropdown.style.display = 'flex';
                    return;
                }

                results.forEach(client => {
                    const item = document.createElement('div');
                    item.className = 'filler-monday-dropdown-item';

                    let compName = '';
                    if (isValidVal(client.empresa)) compName = client.empresa;
                    else if (isValidVal(client.cliente)) compName = client.cliente;
                    else if (isValidVal(client.name)) compName = client.name;
                    else if (isValidVal(client.contacto)) compName = client.contacto;
                    else compName = 'Empresa / Cliente';

                    const contactDisplay = isValidVal(client.contacto) ? client.contacto : (isValidVal(client.name) && client.name !== compName ? client.name : '');
                    const emailDisplay = isValidVal(client.email) ? client.email : '';
                    const phoneDisplay = isValidVal(client.telefono) ? client.telefono : '';

                    let metaParts = [];
                    if (contactDisplay && contactDisplay !== compName) metaParts.push(`👤 ${contactDisplay}`);
                    if (emailDisplay) metaParts.push(`✉️ ${emailDisplay}`);
                    if (phoneDisplay) metaParts.push(`📞 ${phoneDisplay}`);

                    item.innerHTML = `
                        <div class="filler-item-title">🏢 ${escapeHtml(compName)}</div>
                        ${metaParts.length > 0 ? `<div class="filler-item-meta">${escapeHtml(metaParts.join(' • '))}</div>` : ''}
                    `;

                    item.addEventListener('click', async () => {
                        activeMondayClient = client;
                        fillerMondayResultsDropdown.style.display = 'none';
                        updateFillerMondayClientView();
                        await populateFillerVariableFields();
                    });

                    fillerMondayResultsDropdown.appendChild(item);
                });

                fillerMondayResultsDropdown.style.display = 'flex';
            }, 80);
        });

        // Cerrar dropdown si se hace clic fuera del buscador
        modalContainer.addEventListener('click', (e) => {
            if (fillerMondayResultsDropdown && !fillerMondaySearchInput.contains(e.target) && !fillerMondayResultsDropdown.contains(e.target)) {
                fillerMondayResultsDropdown.style.display = 'none';
            }
        });

        // Botón cambiar cliente de Monday en el formulario
        fillerClearClientBtn.addEventListener('click', async () => {
            activeMondayClient = null;
            updateFillerMondayClientView();
            fillerMondaySearchInput.focus();
            await populateFillerVariableFields();
        });

        // Botón volver de variables
        backToListBtn.addEventListener('click', () => {
            varFillerSection.style.display = 'none';
            listContainer.style.display = 'flex';
            chipsContainer.style.display = 'flex';
            searchInput.style.display = 'block';
            if (activeMondayClient) mondayBar.style.display = 'flex';
            selectedTemplateForVars = null;
        });

        // Botón aplicar variables
        applyVarsBtn.addEventListener('click', () => {
            if (!selectedTemplateForVars) return;

            let finalSubject = selectedTemplateForVars.subject || '';
            let finalBodyHtml = selectedTemplateForVars.bodyHtml || '';

            const inputs = varGrid.querySelectorAll('input[data-var]');
            inputs.forEach(input => {
                const varKey = input.dataset.var;
                const userVal = input.value.trim() || `[${varKey}]`;
                const vLower = varKey.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');

                // Si el usuario confirmó o editó su nombre de remitente, recordarlo
                if (vLower === 'mi_nombre' || vLower === 'remitente' || vLower === 'mi_remitente' || vLower === 'sender' || vLower === 'asesor' || vLower === 'ejecutivo' || vLower === 'nombre_remitente') {
                    if (userVal && !userVal.startsWith('[')) {
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ ext_correo_user_sender_name: userVal });
                        }
                    }
                }

                if (window.DriveFolderContentService && typeof window.DriveFolderContentService.replaceVariableInHtml === 'function') {
                    finalBodyHtml = window.DriveFolderContentService.replaceVariableInHtml(finalBodyHtml, varKey, userVal);
                } else {
                    const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
                    finalBodyHtml = finalBodyHtml.replace(regex, userVal);
                }

                const regex = new RegExp(`\\{\\{${varKey}\\}\\}`, 'g');
                finalSubject = finalSubject.replace(regex, userVal);
            });

            insertTemplateIntoGmail(composeContainer, finalSubject, finalBodyHtml);
            closeTemplateModal();
        });

        // Abrir Dashboard
        if (openDashBtn) {
            openDashBtn.addEventListener('click', () => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
                } else {
                    const dashUrl = chrome.runtime.getURL('dashboard.html');
                    window.open(dashUrl, '_blank');
                }
            });
        }

        // Eventos de búsqueda y cierre
        searchInput.addEventListener('input', renderList);
        closeBtn.addEventListener('click', closeTemplateModal);
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeTemplateModal();
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeTemplateModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Render inicial
        renderChips();
        renderList();
        setTimeout(() => searchInput.focus(), 50);
    }

    function closeTemplateModal() {
        const existing = document.getElementById('extCorModalOverlay');
        if (existing) {
            existing.remove();
        }
    }

    // 5. Inserción real en los campos de Gmail (Asunto y Cuerpo)
    function insertTemplateIntoGmail(composeContainer, subject, bodyHtml) {
        if (!composeContainer) return;

        // 5.1 Insertar Asunto
        const subjectInput = composeContainer.querySelector('input[name="subjectbox"]') ||
                             composeContainer.querySelector('input[name="subject"]') ||
                             composeContainer.querySelector('input[placeholder*="Asunto"], input[placeholder*="Subject"]');

        if (subjectInput && subject) {
            subjectInput.value = subject;
            subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
            subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 5.2 Insertar Cuerpo
        const bodyContainer = composeContainer.querySelector('div[aria-label="Message Body"]') ||
                              composeContainer.querySelector('div[aria-label="Cuerpo del mensaje"]') ||
                              composeContainer.querySelector('div[contenteditable="true"][role="textbox"]') ||
                              composeContainer.querySelector('div.editable');

        if (bodyContainer && bodyHtml) {
            bodyContainer.focus();
            bodyContainer.innerHTML = bodyHtml;
            bodyContainer.dispatchEvent(new Event('input', { bubbles: true }));
            bodyContainer.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Inicializar
    loadTemplates();
    observeGmailCompose();
})();
