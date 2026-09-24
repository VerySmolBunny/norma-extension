/**
 * Norma Hub - Controlador de Asignación & Onboarding de Nuevos Clientes
 * Gestiona el flujo para clientes en estado 'Por celebrar KO':
 * 1. Visualización y selección de clientes pendientes de Kick Off.
 * 2. Cambio de etapa en Monday a 'Coordinando Kick Off'.
 * 3. Creación de subcarpeta en Google Drive (/Clientes/[NombreCliente]).
 * 4. Generación del borrador oficial de bienvenida en Gmail (Google Workspace).
 */

import { getConfig } from '../core/config.js';
import { MondayService } from '../services/monday_service.js';
import { GasService } from '../services/gas_service.js';
import { firebaseService } from '../services/firebase_service.js';
import { navigateTo } from '../core/router.js';
import { DEFAULT_WELCOME_TEMPLATE_HTML, DEFAULT_HEADER_BANNER_HTML, DEFAULT_FOOTER_BANNER_HTML } from '../core/welcome_assets.js';
import { DriveFolderService } from '../services/drive_folder_service.js';

export class OnboardingController {
  constructor() {
    this.clients = [];
    this.selectedClient = null;
    this.isLoading = false;
    this.agendaUrl = '';
    this.templates = [];
    this.selectedTemplateId = 'tpl_bienvenida_asistencia';
    this.selectedTemplate = null;
    this.driveFoldersCache = null;
    DriveFolderService.getFoldersCache().then(cache => {
      this.driveFoldersCache = cache;
    }).catch(() => {});
    this.bannerConfig = { header: '', footer: '' };
  }

  async init() {
    try {
      const config = await getConfig();
      this.bannerConfig = {
        header: config.templateHeaderAsset || '',
        footer: config.templateFooterAsset || ''
      };
    } catch (e) {
      console.warn('No se pudo cargar bannerConfig:', e);
    }
    this.bindEvents();
    await this.loadTemplates();
    await this.loadClients();
    this.initTemplateSyncListeners();
  }

  /**
   * Carga las plantillas registradas en Firebase / Almacenamiento local
   */
  async loadTemplates(forceRefresh = false) {
    try {
      if (typeof firebaseService !== 'undefined' && firebaseService.getTemplates) {
        this.templates = await firebaseService.getTemplates(forceRefresh);
      } else {
        this.templates = [];
      }
    } catch (e) {
      console.warn('Error cargando plantillas en OnboardingController:', e);
      this.templates = [];
    }

    this.selectDefaultTemplate();
    this.renderTemplateSelector();

    if (this.selectedClient) {
      this.applyTemplateToSelectedClient();
    }
  }

  /**
   * Identifica y selecciona por defecto la plantilla oficial "Bienvenida a Buk Asistencia"
   */
  selectDefaultTemplate() {
    if (!this.templates || this.templates.length === 0) return;

    let found = null;

    // 1. Intentar por ID seleccionado o ID oficial
    if (this.selectedTemplateId) {
      found = this.templates.find(t => t.id === this.selectedTemplateId);
    }

    // 2. Intentar buscar por coincidencia en el título con "Bienvenida a Buk Asistencia"
    if (!found) {
      found = this.templates.find(t => t.title && t.title.toLowerCase().includes('bienvenida a buk asistencia'));
    }

    // 3. Intentar buscar por categoría 'Bienvenida' o 'Onboarding'
    if (!found) {
      found = this.templates.find(t => t.category && (t.category.toLowerCase() === 'bienvenida' || t.category.toLowerCase() === 'onboarding'));
    }

    // 4. Intentar buscar cualquier plantilla que contenga "bienvenida"
    if (!found) {
      found = this.templates.find(t => t.title && t.title.toLowerCase().includes('bienvenida'));
    }

    // 5. Fallback a la primera plantilla disponible
    if (!found) {
      found = this.templates[0];
    }

    if (found) {
      this.selectedTemplate = found;
      this.selectedTemplateId = found.id;
    }
  }

  /**
   * Renderiza el selector de plantillas en la sección de correo de Onboarding
   */
  renderTemplateSelector() {
    const selectEl = document.getElementById('selectOnboardingTemplate');
    if (!selectEl) return;

    selectEl.innerHTML = '';
    if (!this.templates || this.templates.length === 0) {
      const opt = document.createElement('option');
      opt.value = 'tpl_bienvenida_asistencia';
      opt.textContent = '🚀 Bienvenida a Buk Asistencia (Por defecto)';
      selectEl.appendChild(opt);
      return;
    }

    this.templates.forEach(tpl => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = `${tpl.title} (${tpl.category || 'General'})`;
      if (tpl.id === this.selectedTemplateId) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  /**
   * Escucha eventos de actualización de plantillas para mantener la sincronización en vivo
   */
  initTemplateSyncListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'TEMPLATES_UPDATED' || message.action === 'RELOAD_TEMPLATES') {
          this.loadTemplates(false);
        }
      });
    }
  }

  bindEvents() {
    const btnRefresh = document.getElementById('btnRefreshOnboarding');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.loadTemplates(true);
        this.loadClients(true);
      });
    }

    const selectTemplate = document.getElementById('selectOnboardingTemplate');
    if (selectTemplate) {
      selectTemplate.addEventListener('change', (e) => {
        this.selectedTemplateId = e.target.value;
        this.selectedTemplate = this.templates.find(t => t.id === this.selectedTemplateId) || null;
        if (this.selectedClient) {
          this.applyTemplateToSelectedClient();
        } else {
          this.updateEmailPreview();
        }
      });
    }

    const btnEditTpl = document.getElementById('btnEditTemplateInManager');
    if (btnEditTpl) {
      btnEditTpl.addEventListener('click', () => {
        navigateTo('viewTemplates');
        if (window.templatesController && typeof window.templatesController.selectTemplate === 'function' && this.selectedTemplateId) {
          setTimeout(() => {
            window.templatesController.selectTemplate(this.selectedTemplateId);
          }, 120);
        }
      });
    }

    const btnRunAll = document.getElementById('btnExecuteFullOnboarding');
    if (btnRunAll) {
      btnRunAll.addEventListener('click', () => this.executeFullOnboarding());
    }

    const btnCreateDraft = document.getElementById('btnCreateGmailDraft');
    if (btnCreateDraft) {
      btnCreateDraft.addEventListener('click', () => this.createGmailDraft());
    }

    const btnCreateDrive = document.getElementById('btnCreateDriveFolder');
    if (btnCreateDrive) {
      btnCreateDrive.addEventListener('click', () => this.createDriveFolder());
    }

    const btnCreateSlides = document.getElementById('btnCreateKickoffSlides');
    if (btnCreateSlides) {
      btnCreateSlides.addEventListener('click', () => this.createKickOffSlides());
    }

    const btnUpdateStage = document.getElementById('btnUpdateMondayStage');
    if (btnUpdateStage) {
      btnUpdateStage.addEventListener('click', () => this.updateMondayStage());
    }

    const btnCopyEmail = document.getElementById('btnCopyEmailText');
    if (btnCopyEmail) {
      btnCopyEmail.addEventListener('click', () => this.copyEmailContent());
    }

    const btnOpenGmailWeb = document.getElementById('btnOpenGmailWeb');
    if (btnOpenGmailWeb) {
      btnOpenGmailWeb.addEventListener('click', () => this.openGmailWeb());
    }

    // Pestañas de vista de correo (Vista Previa vs Editar)
    const tabPreview = document.getElementById('tabEmailPreview');
    const tabEdit = document.getElementById('tabEmailEdit');
    const previewContainer = document.getElementById('emailPreviewContainer');
    const editContainer = document.getElementById('emailEditContainer');

    if (tabPreview && tabEdit && previewContainer && editContainer) {
      tabPreview.addEventListener('click', () => {
        tabPreview.classList.add('active');
        tabEdit.classList.remove('active');
        previewContainer.style.display = 'block';
        editContainer.style.display = 'none';
        this.updateEmailPreview();
      });

      tabEdit.addEventListener('click', () => {
        tabEdit.classList.add('active');
        tabPreview.classList.remove('active');
        previewContainer.style.display = 'none';
        editContainer.style.display = 'block';
      });
    }

    // Eventos de edición en vivo
    ['editClientGreetingName', 'editRecipientEmail', 'editAgendaUrl', 'editEmailSubject'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateEmailPreview());
      }
    });
  }

  /**
   * Carga los clientes asignados en estado 'Por celebrar KO' desde Monday o Apps Script
   */
  async loadClients(forceRefresh = false) {
    this.isLoading = true;
    this.renderLoadingState();

    try {
      const config = await getConfig();
      let koClients = [];

      // 1. Intentar consultar Monday directamente vía GraphQL
      if (config.mondayApiKey) {
        try {
          koClients = await MondayService.getKOPendingClients(config.mondayApiKey, config.boardId, config.coeName);
        } catch (err) {
          console.warn('Error consultando Monday directamente, intentando Apps Script:', err);
        }
      }

      // 2. Si no hay clientes o falló, intentar vía Apps Script
      if ((!koClients || koClients.length === 0) && config.gasUrl) {
        try {
          const gasRes = await GasService.getKOPendingClients(config.gasUrl, {
            mondayApiKey: config.mondayApiKey,
            boardId: config.boardId
          });
          if (gasRes && gasRes.clients) {
            koClients = gasRes.clients;
          }
        } catch (err) {
          console.warn('Error consultando Apps Script:', err);
        }
      }

      // 3. Fallback de respaldo
      if (!koClients || koClients.length === 0) {
        koClients = this.getFallbackKOClients();
      }

      this.clients = koClients;
      this.updateSidebarBadge(this.clients.length);
      this.renderClientsList();

      if (this.clients.length > 0) {
        // Seleccionar por defecto el primer cliente si no hay ninguno seleccionado
        const currentSelectedId = this.selectedClient?.id;
        const exists = this.clients.find(c => c.id === currentSelectedId);
        this.selectClient(exists ? exists : this.clients[0]);
      } else {
        this.renderEmptyState();
      }
    } catch (error) {
      console.error('Error cargando clientes de Onboarding:', error);
      this.renderErrorState(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Clientes de contingencia de alta fidelidad detectados en el tablero Master
   */
  getFallbackKOClients() {
    return [];
  }

  /**
   * Actualiza el badge numérico en el sidebar de la extensión
   */
  updateSidebarBadge(count) {
    const badge = document.getElementById('sidebarOnboardingBadge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  /**
   * Renderiza la lista de tarjetas de clientes pendientes de Kick Off
   */
  renderClientsList() {
    const listEl = document.getElementById('onboardingClientsList');
    if (!listEl) return;

    listEl.innerHTML = '';

    this.clients.forEach(client => {
      const isSelected = this.selectedClient?.id === client.id;
      const card = document.createElement('div');
      card.className = `onboarding-client-card ${isSelected ? 'active' : ''}`;
      card.dataset.id = client.id;

      card.innerHTML = `
        <div class="card-header-row">
          <span class="client-badge-status">🚀 Por celebrar KO</span>
          <span class="client-assignment-date">📅 ${client.fechaAsignacion || 'Reciente'}</span>
        </div>
        <h3 class="client-card-title">${this.escapeHtml(client.name)}</h3>
        <div class="client-card-footer">
          <span class="stage-tag">🎯 ${this.escapeHtml(client.etapa || 'Coordinando Kick Off')}</span>
          <button class="client-select-btn ${isSelected ? 'active' : ''}">${isSelected ? '✓ Seleccionado' : 'Seleccionar'}</button>
        </div>
      `;

      card.addEventListener('click', () => this.selectClient(client));
      listEl.appendChild(card);
    });
  }

  /**
   * Selecciona un cliente y actualiza el panel de onboarding
   */
  selectClient(client) {
    this.selectedClient = client;

    // Actualizar clases activas en tarjetas
    document.querySelectorAll('.onboarding-client-card').forEach(card => {
      card.classList.toggle('active', card.dataset.id === client.id);
    });

    // Actualizar detalles del cliente en la interfaz
    const nameEl = document.getElementById('selectedClientName');
    if (nameEl) nameEl.textContent = client.name;

    const contraparteEl = document.getElementById('selectedClientContraparte');
    if (contraparteEl) contraparteEl.textContent = client.contraparte || 'No registrada';

    const emailEl = document.getElementById('selectedClientEmail');
    if (emailEl) emailEl.textContent = client.correoContraparte || 'No registrado';

    const phoneEl = document.getElementById('selectedClientPhone');
    if (phoneEl) phoneEl.textContent = client.telefonoContraparte || 'No registrado';

    const urlEl = document.getElementById('selectedClientUrl');
    if (urlEl) {
      if (client.urlBuk) {
        urlEl.innerHTML = `<a href="https://${client.urlBuk}" target="_blank" class="link-primary">${client.urlBuk}</a>`;
      } else {
        urlEl.textContent = 'No registrada';
      }
    }

    const dotacionEl = document.getElementById('selectedClientDotacion');
    if (dotacionEl) dotacionEl.textContent = `${client.dotacion || 'N/A'} colaboradores (${client.recintos || 1} recintos)`;

    const salesNotesEl = document.getElementById('selectedClientSalesNotes');
    if (salesNotesEl) {
      salesNotesEl.textContent = client.comentariosSales || 'Sin notas comerciales registradas en Monday.';
    }

    const drivePathEl = document.getElementById('targetDriveFolderPath');
    if (drivePathEl) {
      drivePathEl.textContent = `/Clientes/${client.name}`;
    }

    // Resetear estados visuales de acciones
    this.resetActionStates();

    // Aplicar la plantilla seleccionada al cliente
    this.applyTemplateToSelectedClient();
  }

  /**
   * Resuelve la URL pública o de visualización para un ID o enlace de Google Drive
   */
  getBannerAssetUrl(assetStr) {
    if (!assetStr) return '';
    const s = assetStr.trim();
    if (s.startsWith('http://') || s.startsWith('https://')) {
      const driveMatch = s.match(/[-\w]{25,}/);
      if (driveMatch && (s.includes('drive.google.com') || s.includes('docs.google.com'))) {
        return `https://drive.google.com/thumbnail?id=${driveMatch[0]}&sz=w800`;
      }
      return s;
    }
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) {
      return `https://drive.google.com/thumbnail?id=${s}&sz=w800`;
    }
    return s;
  }

  /**
   * Resuelve de forma inteligente las variables dinámicas {{variable}} en la plantilla de correo
   */
  resolveTemplateVariables(template, client, customOverrides = {}, options = {}) {
    const companyName = customOverrides.companyName || client?.name || 'Cliente';
    const contactName = customOverrides.contactName || client?.contraparte || client?.name || 'Equipo';
    const agendaUrl = customOverrides.agendaUrl || this.agendaUrl;
    const recipientEmail = customOverrides.recipientEmail || client?.correoContraparte || '';
    const phone = client?.telefonoContraparte || '';
    const senderName = customOverrides.senderName || '';
    const dotacion = client?.dotacion ? `${client.dotacion}` : 'N/A';
    const recintos = client?.recintos ? `${client.recintos}` : '1';
    const urlBuk = client?.urlBuk || '';
    const dateStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    let folderUrl = customOverrides.folderUrl 
      || client?.folderUrl 
      || client?.driveFolderUrl 
      || client?.linkCarpeta;

    if (!folderUrl && client?.allValues && typeof client.allValues === 'object') {
      for (const [k, val] of Object.entries(client.allValues)) {
        if (/carpeta|drive|grabacion|enlace.*carpeta|link.*carpeta/i.test(k) && typeof val === 'string' && val.startsWith('http')) {
          folderUrl = val.trim();
          break;
        }
      }
    }

    if (!folderUrl && this.driveFoldersCache) {
      const cId = client?.id ? String(client.id) : '';
      if (cId && this.driveFoldersCache.byClientId && this.driveFoldersCache.byClientId[cId]) {
        folderUrl = this.driveFoldersCache.byClientId[cId];
      }
      if (!folderUrl) {
        const cName = (client?.name || client?.empresa || companyName || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cName && this.driveFoldersCache.byClientName && this.driveFoldersCache.byClientName[cName]) {
          folderUrl = this.driveFoldersCache.byClientName[cName];
        }
      }
    }
    folderUrl = folderUrl || '';

    let rawSubject = (customOverrides.subject !== undefined) ? customOverrides.subject : (template?.subject || `¡Bienvenid@ a Buk! 🚀 Coordinación de Kick Off - Módulo Control de Asistencia | {{empresa}}`);

    // Sanitización proactiva de emojis para evitar caracteres corrompidos (\uFFFD / rombos negros)
    rawSubject = (rawSubject || '').replace(/[\uFFFD\uFFFE]+/g, '🚀');
    if (!rawSubject.includes('🚀') && rawSubject.includes('¡Bienvenid@ a Buk!')) {
      rawSubject = rawSubject.replace('¡Bienvenid@ a Buk!', '¡Bienvenid@ a Buk! 🚀');
    }

    let rawBodyHtml = template?.bodyHtml || this.buildDefaultEmailHtml(companyName, agendaUrl);

    // Reparar emojis que hayan podido ser corrompidos por codificación en el template guardado
    rawBodyHtml = (rawBodyHtml || '')
      .replace(/¡Hola equipo([^!]+)!\s*[\uFFFD\uFFFE]+/gi, '¡Hola equipo$1! 😊')
      .replace(/[\uFFFD\uFFFE]+\s*(?:Puedes hacer click)/gi, '👉 Puedes hacer click')
      .replace(/[\uFFFD\uFFFE]+/g, '');

    const replaceMap = [
      { regex: /\{\{\s*(?:empresa|cliente|nombre_empresa|razon_social)\s*\}\}/gi, val: companyName },
      { regex: /\{\{\s*(?:nombre_cliente|contacto|contraparte|destinatario)\s*\}\}/gi, val: contactName },
      { regex: /\{\{\s*(?:agenda_url|link_agenda|url_agenda|agenda)\s*\}\}/gi, val: agendaUrl },
      { regex: /\{\{\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*\}\}/gi, val: folderUrl },
      { regex: /\{\{\s*(?:mi_nombre|remitente|asesor|ejecutivo|autor)\s*\}\}/gi, val: senderName },
      { regex: /\{\{\s*(?:correo|email|correo_contraparte)\s*\}\}/gi, val: recipientEmail },
      { regex: /\{\{\s*(?:telefono|fono)\s*\}\}/gi, val: phone },
      { regex: /\{\{\s*(?:dotacion|colaboradores|usuarios)\s*\}\}/gi, val: dotacion },
      { regex: /\{\{\s*(?:recintos|sucursales|sedes)\s*\}\}/gi, val: recintos },
      { regex: /\{\{\s*(?:url_buk|buk_url|plataforma)\s*\}\}/gi, val: urlBuk },
      { regex: /\{\{\s*(?:fecha|fecha_hoy|date)\s*\}\}/gi, val: dateStr }
    ];

    let resolvedSubject = rawSubject;
    let resolvedHtml = rawBodyHtml;

    // Evitar enlaces duplicados tipo href="https://https://drive.google.com/..."
    if (folderUrl && /^https?:\/\//i.test(folderUrl)) {
      resolvedHtml = resolvedHtml.replace(
        /(href=["'])(?:https?:\/\/)?(?:\{\{\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*\}\}|%7B%7B\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*%7D%7D)/gi,
        `$1${folderUrl}`
      );
    }
    resolvedHtml = resolvedHtml.replace(/%7B%7B\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*%7D%7D/gi, folderUrl);

    replaceMap.forEach(({ regex, val }) => {
      resolvedSubject = resolvedSubject.replace(regex, val);
      resolvedHtml = resolvedHtml.replace(regex, val);
    });

    // Inyección de Banners según contexto: en la UI y copiado se renderizan imágenes, para Gmail se envían placeholders limpios
    if (options.forDashboardPreview) {
      const headerAsset = customOverrides.headerAsset !== undefined 
        ? customOverrides.headerAsset 
        : (template?.headerAsset || this.bannerConfig?.header || '');
      const footerAsset = customOverrides.footerAsset !== undefined 
        ? customOverrides.footerAsset 
        : (template?.footerAsset || this.bannerConfig?.footer || '');

      let headerImgHtml = '';
      if (headerAsset) {
        const headerUrl = this.getBannerAssetUrl(headerAsset);
        headerImgHtml = `<img src="${headerUrl}" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`;
      } else if (template?.id === 'tpl_bienvenida_asistencia' || !template) {
        const localHeader = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('assets/welcome_header.png') : '';
        headerImgHtml = localHeader
          ? `<img src="${localHeader}" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`
          : DEFAULT_HEADER_BANNER_HTML;
      }

      let footerImgHtml = '';
      if (footerAsset) {
        const footerUrl = this.getBannerAssetUrl(footerAsset);
        footerImgHtml = `<img src="${footerUrl}" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`;
      } else if (template?.id === 'tpl_bienvenida_asistencia' || !template) {
        const localFooter = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('assets/welcome_footer.png') : '';
        footerImgHtml = localFooter
          ? `<img src="${localFooter}" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`
          : DEFAULT_FOOTER_BANNER_HTML;
      }

      if (resolvedHtml.includes('header_banner')) {
        resolvedHtml = resolvedHtml.replace(/\{\{\s*header_banner\s*\}\}/gi, headerImgHtml);
      } else if (headerImgHtml) {
        resolvedHtml = `<div style="text-align: center; margin-bottom: 20px;">${headerImgHtml}</div>` + resolvedHtml;
      }

      if (resolvedHtml.includes('footer_banner')) {
        resolvedHtml = resolvedHtml.replace(/\{\{\s*footer_banner\s*\}\}/gi, footerImgHtml);
      } else if (footerImgHtml) {
        resolvedHtml = resolvedHtml + `<div style="text-align: center; margin-top: 24px;">${footerImgHtml}</div>`;
      }
    }

    // Crear versión plainText para portapapeles
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = resolvedHtml;
    const resolvedPlainText = tempDiv.innerText || tempDiv.textContent || '';

    return {
      subject: resolvedSubject,
      htmlBody: resolvedHtml,
      plainText: resolvedPlainText
    };
  }

  /**
   * Aplica la plantilla activa rellenando los campos de edición y previsualización
   */
  applyTemplateToSelectedClient() {
    if (!this.selectedClient) return;

    const resolved = this.resolveTemplateVariables(this.selectedTemplate, this.selectedClient);

    // Campos de edición de correo
    const editGreeting = document.getElementById('editClientGreetingName');
    if (editGreeting) editGreeting.value = this.selectedClient.name;

    const editRecipient = document.getElementById('editRecipientEmail');
    if (editRecipient) editRecipient.value = this.selectedClient.correoContraparte || '';

    const editSubject = document.getElementById('editEmailSubject');
    if (editSubject) {
      editSubject.value = resolved.subject;
    }

    const editAgenda = document.getElementById('editAgendaUrl');
    if (editAgenda) editAgenda.value = this.agendaUrl;

    // Actualizar previsualización de correo
    this.updateEmailPreview();
  }

  /**
   * Plantilla HTML de respaldo oficial de Buk Asistencia
   */
  buildDefaultEmailHtml(clientName, agendaUrl) {
    const cleanClient = clientName ? clientName.trim() : 'Equipo';
    const url = agendaUrl || this.agendaUrl;

    return DEFAULT_WELCOME_TEMPLATE_HTML
      .replace(/\{\{\s*(?:empresa|cliente|nombre_empresa|razon_social)\s*\}\}/gi, cleanClient)
      .replace(/\{\{\s*(?:nombre_cliente|contacto|contraparte|destinatario)\s*\}\}/gi, cleanClient)
      .replace(/\{\{\s*(?:agenda_url|link_agenda|url_agenda|agenda)\s*\}\}/gi, url)
      .replace(/\{\{\s*(?:mi_nombre|remitente|asesor|ejecutivo|autor)\s*\}\}/gi, '');
  }

  /**
   * Genera el HTML de previsualización del correo de bienvenida
   */
  buildEmailHtml(clientName, agendaUrl) {
    if (this.selectedTemplate) {
      const resolved = this.resolveTemplateVariables(this.selectedTemplate, this.selectedClient, {
        companyName: clientName,
        agendaUrl: agendaUrl
      });
      return resolved.htmlBody;
    }
    return this.buildDefaultEmailHtml(clientName, agendaUrl);
  }

  /**
   * Actualiza el contenedor visual con la previsualización del correo
   */
  updateEmailPreview() {
    const previewContainer = document.getElementById('emailPreviewContainer');
    if (!previewContainer) return;

    const editGreeting = document.getElementById('editClientGreetingName');
    const editRecipient = document.getElementById('editRecipientEmail');
    const editAgenda = document.getElementById('editAgendaUrl');
    const editSubject = document.getElementById('editEmailSubject');

    const companyName = editGreeting?.value || this.selectedClient?.name || 'Equipo';
    const recipientEmail = editRecipient?.value || this.selectedClient?.correoContraparte || '';
    const agendaUrl = editAgenda?.value || this.agendaUrl;
    const customSubject = editSubject?.value;

    const resolved = this.resolveTemplateVariables(this.selectedTemplate, this.selectedClient, {
      companyName,
      recipientEmail,
      agendaUrl,
      subject: customSubject
    }, { forDashboardPreview: true });

    previewContainer.innerHTML = resolved.htmlBody;
  }

  /**
   * Copia el correo en formato enriquecido (Rich HTML) y texto plano al portapapeles
   */
  async copyEmailContent() {
    if (!this.selectedClient) {
      this.showToast('Por favor selecciona un cliente primero.', 'warning');
      return;
    }

    const editGreeting = document.getElementById('editClientGreetingName');
    const editRecipient = document.getElementById('editRecipientEmail');
    const editAgenda = document.getElementById('editAgendaUrl');
    const editSubject = document.getElementById('editEmailSubject');

    const companyName = editGreeting?.value || this.selectedClient.name;
    const recipientEmail = editRecipient?.value || this.selectedClient.correoContraparte || '';
    const agendaUrl = editAgenda?.value || this.agendaUrl;
    const customSubject = editSubject?.value;

    const resolved = this.resolveTemplateVariables(this.selectedTemplate, this.selectedClient, {
      companyName,
      recipientEmail,
      agendaUrl,
      subject: customSubject
    }, { forDashboardPreview: true });

    const htmlContent = resolved.htmlBody;
    const plainText = resolved.plainText;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        });
        await navigator.clipboard.write([clipboardItem]);
        this.showToast('📋 ¡Correo copiado con plantilla oficial y diseño! Al pegarlo en Gmail mantendrá el formato corporativo.', 'success');
      } else {
        await navigator.clipboard.writeText(plainText);
        this.showToast('📋 Texto del correo copiado al portapapeles', 'info');
      }
    } catch (e) {
      console.warn('Fallback a texto plano:', e);
      try {
        await navigator.clipboard.writeText(plainText);
        this.showToast('📋 Texto del correo copiado al portapapeles', 'info');
      } catch (err) {
        this.showToast('No se pudo copiar: ' + err.message, 'error');
      }
    }
  }

  /**
   * Abre la bandeja de borradores en Gmail Web
   */
  openGmailWeb() {
    if (this.lastDraftCreated) {
      window.open('https://mail.google.com/mail/u/0/#drafts', '_blank');
      return;
    }

    // Si aún no se ha creado el borrador, abrir borradores o compositor
    this.showToast('💡 Te recomendamos usar "Crear Borrador en Gmail" para generar el diseño gráfico oficial con banners.', 'info');
    window.open('https://mail.google.com/mail/u/0/#drafts', '_blank');
  }

  /**
   * 1. Actualizar Etapa en Monday a 'Coordinando Kick Off'
   */
  async updateMondayStage() {
    if (!this.selectedClient) return false;
    this.setStepStatus('Monday', 'processing', { text: 'Actualizando Monday...' });

    try {
      const config = await getConfig();
      await MondayService.updateClientStageToCoordinatingKO(this.selectedClient.id, config.boardId, config.mondayApiKey);
      
      this.selectedClient.etapa = 'Coordinando KickOffr';
      this.setStepStatus('Monday', 'success', { label: 'Etapa en Monday' });
      this.showToast('🎯 Etapa actualizada a "Coordinando Kick Off" en Monday.com', 'success');
      this.renderClientsList();
      return true;
    } catch (error) {
      console.error('Error actualizando etapa en Monday:', error);
      this.setStepStatus('Monday', 'error', { errorMsg: 'Error en Monday' });
      this.showToast('Error en Monday: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * 2. Crear Subcarpeta en Google Drive
   */
  async createDriveFolder() {
    if (!this.selectedClient) return false;
    this.setStepStatus('Drive', 'processing', { text: 'Verificando Drive...' });

    try {
      const config = await getConfig();
      if (!config.gasUrl) {
        throw new Error('Falta la URL de Apps Script (gasUrl) en Ajustes.');
      }

      const rootFolderId = config.rootDriveFolderId || config.rootClientsFolderId || config.rootFolderId || '';
      if (!rootFolderId) {
        throw new Error('Configura la URL de tu Carpeta Raíz de Google Drive en Ajustes (⚙️).');
      }

      const res = await GasService.onboardClient(config.gasUrl, {
        clientName: this.selectedClient.name,
        clientId: this.selectedClient.id,
        rootFolderId: rootFolderId,
        mondayApiKey: config.mondayApiKey,
        boardId: config.boardId,
        createFolder: true,
        updateMonday: false,
        createDraft: false
      });

      this.selectedClient.folderUrl = res.folderUrl || '';
      if (res.folderUrl) {
        DriveFolderService.addFolderToCache({
          clientId: this.selectedClient.id,
          clientName: this.selectedClient.name,
          folderId: res.folderId,
          folderUrl: res.folderUrl
        }).catch(e => console.warn(e));
      }

      this.setStepStatus('Drive', 'success', {
        label: 'Carpeta lista',
        linkUrl: res.folderUrl || '',
        linkLabel: 'Ver Drive ↗'
      });
      this.showToast(`📁 Subcarpeta de ${this.selectedClient.name} lista en Google Drive`, 'success');
      return true;
    } catch (error) {
      console.error('Error creando carpeta en Drive:', error);
      this.setStepStatus('Drive', 'error', { errorMsg: 'Error en Drive' });
      this.showToast('Error en Drive: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * 3. Crear y Personalizar Presentación de Google Slides para Kick Off
   */
  async createKickOffSlides() {
    if (!this.selectedClient) return false;
    this.setStepStatus('Slides', 'processing', { text: 'Generando Google Slides...' });

    try {
      const config = await getConfig();
      if (!config.gasUrl) {
        throw new Error('Falta la URL de Apps Script (gasUrl) en Ajustes.');
      }

      const slidesTemplateId = config.slidesKickoffTemplateId || '';
      const rootFolderId = config.rootDriveFolderId || config.rootClientsFolderId || config.rootFolderId || '';
      if (!rootFolderId) {
        throw new Error('Configura la URL de tu Carpeta Raíz de Google Drive en Ajustes (⚙️).');
      }

      const res = await GasService.createKickOffSlides(config.gasUrl, {
        slidesTemplateId: slidesTemplateId,
        rootFolderId: rootFolderId,
        clientName: this.selectedClient.name,
        urlBuk: this.selectedClient.urlBuk || '',
        dotacion: this.selectedClient.dotacion || '',
        recintos: this.selectedClient.recintos || '',
        tipoMarcaje: this.selectedClient.tipoMarcaje || '',
        contraparte: this.selectedClient.contraparte || '',
        correoContraparte: this.selectedClient.correoContraparte || '',
        telefonoContraparte: this.selectedClient.telefonoContraparte || ''
      });

      this.lastSlidesCreated = res;
      const slidesUrl = res.presentationUrl || `https://docs.google.com/presentation/d/${res.presentationId}/edit`;

      this.setStepStatus('Slides', 'success', {
        label: 'Slides listo',
        linkUrl: slidesUrl,
        linkLabel: 'Abrir Slides ↗',
        linkTitle: 'Abrir Google Slides personalizado'
      });
      this.showToast(`📊 Presentación de Kick Off lista y personalizada para ${this.selectedClient.name}`, 'success');
      return true;
    } catch (error) {
      console.error('Error generando Google Slides:', error);
      this.setStepStatus('Slides', 'error', { errorMsg: 'Error en Slides' });
      this.showToast('Error en Google Slides: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * 4. Crear Borrador en Gmail utilizando la plantilla oficial resuelta
   */
  async createGmailDraft() {
    if (!this.selectedClient) return false;
    this.setStepStatus('Gmail', 'processing', { text: 'Creando borrador en Gmail...' });

    try {
      const config = await getConfig();
      if (!config.gasUrl) {
        throw new Error('Falta la URL de Apps Script (gasUrl) en Ajustes.');
      }

      const editRecipient = document.getElementById('editRecipientEmail');
      const editSubject = document.getElementById('editEmailSubject');
      const editGreeting = document.getElementById('editClientGreetingName');
      const editAgenda = document.getElementById('editAgendaUrl');

      const companyName = editGreeting?.value || this.selectedClient.name;
      const recipient = editRecipient?.value || this.selectedClient.correoContraparte || '';
      const agendaUrl = editAgenda?.value || this.agendaUrl;
      const customSubject = editSubject?.value;

      // Para Gmail dejamos los placeholders {{header_banner}} y {{footer_banner}} intactos
      // para que Google Apps Script inyecte los Blobs nativamente como cid:
      const resolved = this.resolveTemplateVariables(this.selectedTemplate, this.selectedClient, {
        companyName,
        recipientEmail: recipient,
        agendaUrl,
        subject: customSubject
      }, { forDashboardPreview: false });

      const res = await GasService.createWelcomeDraft(config.gasUrl, {
        clientName: companyName,
        recipient: recipient,
        agendaUrl: agendaUrl,
        subject: resolved.subject,
        htmlBody: resolved.htmlBody,
        headerAsset: this.selectedTemplate?.headerAsset || config.templateHeaderAsset || this.bannerConfig?.header || '',
        footerAsset: this.selectedTemplate?.footerAsset || config.templateFooterAsset || this.bannerConfig?.footer || ''
      });

      this.lastDraftCreated = res;

      this.setStepStatus('Gmail', 'success', {
        label: 'Borrador creado',
        linkUrl: 'https://mail.google.com/mail/u/0/#drafts',
        linkLabel: 'Ver Gmail ↗',
        linkTitle: 'Ver borrador en Gmail'
      });
      this.showToast('✉️ Borrador con plantilla oficial Buk creado exitosamente en tu Gmail', 'success');
      return true;
    } catch (error) {
      console.error('Error creando borrador en Gmail:', error);
      this.setStepStatus('Gmail', 'error', { errorMsg: 'Error en Gmail' });
      this.showToast('Error en Gmail: ' + error.message, 'error');
      return false;
    }
  }

  /**
   * ✨ Automatización Completa de Onboarding (1-Clic - 4 Pasos)
   */
  async executeFullOnboarding() {
    if (!this.selectedClient) {
      this.showToast('Por favor selecciona un cliente primero.', 'warning');
      return;
    }

    const btn = document.getElementById('btnExecuteFullOnboarding');
    const originalText = btn?.innerHTML || '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-small"></span> Ejecutando Automatización (4 Pasos)...';
    }

    this.showToast(`🚀 Iniciando Onboarding integral para ${this.selectedClient.name}...`, 'info');

    try {
      // 1. Cambiar etapa en Monday
      const mondayOk = await this.updateMondayStage();

      // 2. Crear subcarpeta en Drive
      const driveOk = await this.createDriveFolder();

      // 3. Generar presentación en Google Slides
      const slidesOk = await this.createKickOffSlides();

      // 4. Crear borrador en Gmail
      const gmailOk = await this.createGmailDraft();

      if (mondayOk && driveOk && slidesOk && gmailOk) {
        this.showToast(`🎉 ¡Onboarding de ${this.selectedClient.name} completado con éxito (4/4 pasos)!`, 'success');
      } else {
        this.showToast(`⚠️ Onboarding ejecutado con algunas advertencias. Revisa los estados de cada paso.`, 'warning');
      }
    } catch (error) {
      console.error('Error en ejecución completa de onboarding:', error);
      this.showToast('Error durante la automatización: ' + error.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Resetea el estado visual de los 4 pasos a su estado inicial limpio (sin cajas de 'pendiente')
   */
  resetActionStates() {
    ['Monday', 'Drive', 'Slides', 'Gmail'].forEach(stepKey => {
      this.setStepStatus(stepKey, 'idle');
    });
  }

  /**
   * Controla el estado visual de los 4 pasos (idle, processing, success, error)
   * Mostrando tickets (✓) de completitud y eliminando estados pendientes invasivos.
   */
  setStepStatus(stepKey, status, data = {}) {
    const stepCards = {
      Monday: {
        card: 'stepCardMonday',
        num: 'stepNumMonday',
        ticket: 'stepTicketMonday',
        badge: 'statusMondayUpdate',
        btn: 'btnUpdateMondayStage',
        numVal: '1',
        defaultBtn: '<span>🎯 Actualizar Etapa</span>',
        successBtn: '<span>✓ Etapa Actualizada</span>'
      },
      Drive: {
        card: 'stepCardDrive',
        num: 'stepNumDrive',
        ticket: 'stepTicketDrive',
        badge: 'statusDriveFolder',
        btn: 'btnCreateDriveFolder',
        numVal: '2',
        defaultBtn: '<span>📁 Crear / Verificar Carpeta</span>',
        successBtn: '<span>✓ Carpeta Lista</span>'
      },
      Slides: {
        card: 'stepCardSlides',
        num: 'stepNumSlides',
        ticket: 'stepTicketSlides',
        badge: 'statusKickoffSlides',
        btn: 'btnCreateKickoffSlides',
        numVal: '3',
        defaultBtn: '<span>📊 Generar Google Slides</span>',
        successBtn: '<span>✓ Slides Generados</span>'
      },
      Gmail: {
        card: 'stepCardGmail',
        num: 'stepNumGmail',
        ticket: 'stepTicketGmail',
        badge: 'statusGmailDraft',
        btn: 'btnCreateGmailDraft',
        numVal: '4',
        defaultBtn: '<span>✉️ Crear Borrador</span>',
        successBtn: '<span>✓ Borrador Creado</span>'
      }
    };

    const config = stepCards[stepKey];
    if (!config) return;

    const cardEl = document.getElementById(config.card);
    const numEl = document.getElementById(config.num);
    const ticketEl = document.getElementById(config.ticket);
    const badgeEl = document.getElementById(config.badge);
    const btnEl = document.getElementById(config.btn);

    if (status === 'idle') {
      if (cardEl) cardEl.classList.remove('completed');
      if (numEl) {
        numEl.classList.remove('completed');
        numEl.textContent = config.numVal;
      }
      if (ticketEl) ticketEl.style.display = 'none';
      if (badgeEl) {
        badgeEl.className = 'status-step-badge hidden';
        badgeEl.innerHTML = '';
      }
      if (btnEl) {
        btnEl.innerHTML = config.defaultBtn;
        btnEl.classList.remove('completed');
      }
    } else if (status === 'processing') {
      if (badgeEl) {
        badgeEl.className = 'status-step-badge processing';
        badgeEl.innerHTML = `<span class="spinner-small"></span> ${data.text || 'Procesando...'}`;
      }
    } else if (status === 'success') {
      if (cardEl) cardEl.classList.add('completed');
      if (numEl) {
        numEl.classList.add('completed');
        numEl.textContent = '✓';
      }
      if (ticketEl) ticketEl.style.display = 'inline-flex';
      if (btnEl) {
        btnEl.innerHTML = config.successBtn;
        btnEl.classList.add('completed');
      }
      if (badgeEl) {
        if (data.showBadge !== false) {
          badgeEl.className = 'status-step-badge success';
          let badgeHtml = `
            <div class="badge-content-row">
              <span class="badge-status-icon">✓</span>
              <span>${data.label || 'Listo'}</span>
            </div>
          `;
          if (data.linkUrl) {
            badgeHtml += `<a href="${data.linkUrl}" target="_blank" class="step-badge-link-btn" title="${data.linkTitle || ''}">${data.linkLabel || 'Abrir ↗'}</a>`;
          }
          badgeEl.innerHTML = badgeHtml;
        } else {
          badgeEl.className = 'status-step-badge hidden';
          badgeEl.innerHTML = '';
        }
      }
    } else if (status === 'error') {
      if (badgeEl) {
        badgeEl.className = 'status-step-badge error';
        badgeEl.innerHTML = `
          <div class="badge-content-row">
            <span class="badge-status-icon">❌</span>
            <span>${data.errorMsg || 'Error'}</span>
          </div>
        `;
      }
    }
  }

  renderLoadingState() {
    const listEl = document.getElementById('onboardingClientsList');
    if (listEl) {
      listEl.innerHTML = `
        <div class="loading-state-box">
          <div class="spinner"></div>
          <p>Consultando clientes en "Por celebrar KO" desde Monday.com...</p>
        </div>
      `;
    }
  }

  renderEmptyState() {
    const listEl = document.getElementById('onboardingClientsList');
    if (listEl) {
      listEl.innerHTML = `
        <div class="empty-state-box">
          <div class="empty-icon">🎉</div>
          <h3>¡Al día con los Kick Offs!</h3>
          <p>No tienes clientes en estado "Por celebrar KO" pendientes de onboarding.</p>
        </div>
      `;
    }
  }

  renderErrorState(msg) {
    const listEl = document.getElementById('onboardingClientsList');
    if (listEl) {
      listEl.innerHTML = `
        <div class="error-state-box">
          <div class="error-icon">⚠️</div>
          <h3>No se pudieron cargar los clientes</h3>
          <p>${this.escapeHtml(msg)}</p>
          <button class="btn btn-sm btn-primary mt-2" id="btnRetryLoadOnboarding">Reintentar</button>
        </div>
      `;
      const retryBtn = document.getElementById('btnRetryLoadOnboarding');
      if (retryBtn) retryBtn.addEventListener('click', () => this.loadClients(true));
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `onboarding-toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
