/**
 * Norma Hub - Controlador del Cierre de Implementación
 * 
 * Flujo de 3 Pasos Oficiales:
 * 1. Correo de Cierre en Gmail (Borrador con plantilla oficial tpl_cierre_implementacion y link de Drive resuelto)
 * 2. Resumen IA de Implementación (Lectura de transcripciones de Meet en Drive -> Prompt de 3 secciones con Gemini -> Copia al portapapeles)
 * 3. Actualización en Monday.com (Estado: 'Finalizado' y Etapa: 'Finalizado')
 */

import { MondayService } from '../services/monday_service.js';
import { MondayChatService } from '../services/monday_chat_service.js';
import { GasService } from '../services/gas_service.js';
import { MinutaAiService } from '../services/minuta_ai_service.js';
import { DriveFolderService } from '../services/drive_folder_service.js';
import firebaseService from '../services/firebase_service.js';
import { getConfig } from '../core/config.js';
import { showToast } from '../core/ui_helpers.js';
import { DEFAULT_HEADER_BANNER_HTML, DEFAULT_FOOTER_BANNER_HTML } from '../core/welcome_assets.js';

export class CierreController {
  constructor() {
    this.clients = [];
    this.selectedClient = null;
    this.filterVigentes = true;
    this.cierreTemplate = null;
    this.bannerConfig = { header: '', footer: '' };
    this.transcriptsData = null;

    this.isCreatingDraft = false;
    this.isGeneratingAi = false;
    this.isFinalizingMonday = false;
    this.isExecutingFull = false;
  }

  /**
   * Inicializa eventos y carga de datos iniciales
   */
  async init() {
    this.bindEvents();
    this.initTemplateSyncListeners();
    await this.loadTemplate();
  }

  /**
   * Enlaza los elementos de la interfaz con sus acciones
   */
  bindEvents() {
    // 1. Botón de refrescar clientes
    const btnRefresh = document.getElementById('btnRefreshCierreClients');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadClients(true));
    }

    // 2. Buscador de clientes
    const searchInput = document.getElementById('cierreClientSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderClientsList());
    }

    // 3. Filtros Vigentes / Todos
    const chipVigentes = document.getElementById('chipCierreFilterVigentes');
    const chipAll = document.getElementById('chipCierreFilterAll');

    if (chipVigentes && chipAll) {
      chipVigentes.addEventListener('click', () => {
        this.filterVigentes = true;
        chipVigentes.classList.add('active');
        chipAll.classList.remove('active');
        this.renderClientsList();
      });

      chipAll.addEventListener('click', () => {
        this.filterVigentes = false;
        chipAll.classList.add('active');
        chipVigentes.classList.remove('active');
        this.renderClientsList();
      });
    }

    // 4. Paso 1: Crear Borrador en Gmail
    const btnDraft = document.getElementById('btnCreateCierreDraft');
    if (btnDraft) {
      btnDraft.addEventListener('click', () => this.handleCreateDraft());
    }

    // 5. Paso 2: Generar Resumen con Gemini
    const btnAi = document.getElementById('btnGenerateCierreSummary');
    if (btnAi) {
      btnAi.addEventListener('click', () => this.handleGenerateAiSummary());
    }

    // 6. Paso 2: Copiar Resumen al Portapapeles
    const btnCopy = document.getElementById('btnCopyCierreSummary');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => this.handleCopySummary());
    }

    // 7. Paso 3: Finalizar en Monday
    const btnMonday = document.getElementById('btnFinalizeMondayStage');
    if (btnMonday) {
      btnMonday.addEventListener('click', () => this.handleFinalizeMonday());
    }

    // 8. Botón Maestro: Ejecutar Flujo Completo
    const btnFull = document.getElementById('btnExecuteFullCierre');
    if (btnFull) {
      btnFull.addEventListener('click', () => this.executeFullCierre());
    }
  }

  /**
   * Escucha eventos de actualización de plantillas para mantener la sincronización en vivo
   */
  initTemplateSyncListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'TEMPLATES_UPDATED' || message.action === 'RELOAD_TEMPLATES') {
          this.loadTemplate(false).then(() => {
            if (this.selectedClient) this.renderEmailPreview();
          });
        }
      });
    }
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
   * Carga la plantilla oficial de cierre y configuración de banners
   */
  async loadTemplate(forceRefresh = false) {
    try {
      const config = await getConfig();
      this.bannerConfig = {
        header: config.templateHeaderAsset || '',
        footer: config.templateFooterAsset || ''
      };

      const templates = await firebaseService.getTemplates(forceRefresh);
      this.cierreTemplate = templates.find(t => t.id === 'tpl_cierre_implementacion')
        || templates.find(t => t.category === 'Cierre')
        || templates.find(t => t.title && t.title.toLowerCase().includes('cierre'))
        || templates.find(t => t.title && t.title.toLowerCase().includes('finalización'))
        || templates.find(t => t.subject && t.subject.toLowerCase().includes('finalización'))
        || (templates.length > 0 ? templates[0] : null);
    } catch (err) {
      console.warn('[CierreController] Error cargando plantilla de cierre:', err);
    }
  }

  /**
   * Obtiene la cartera de clientes asignados desde Monday
   */
  async loadClients(forceRefresh = false) {
    const listContainer = document.getElementById('cierreClientsList');
    if (listContainer && (!this.clients || this.clients.length === 0 || forceRefresh)) {
      listContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">Cargando clientes de Monday.com... ⏳</div>';
    }

    try {
      const config = await getConfig();
      if (!config.mondayApiKey) {
        if (listContainer) {
          listContainer.innerHTML = '<div style="padding: 16px; text-align: center; color: #ef4444; font-size: 12px;">Falta configurar la API Key de Monday.com en Ajustes (⚙️).</div>';
        }
        return;
      }

      this.clients = await MondayChatService.getPortfolioData(forceRefresh);
      this.renderClientsList();
      showToast(forceRefresh ? '🔄 Lista de clientes actualizada.' : '✅ Cartera cargada.');
    } catch (err) {
      console.error('[CierreController] Error cargando clientes:', err);
      if (listContainer) {
        listContainer.innerHTML = `<div style="padding: 16px; text-align: center; color: #ef4444; font-size: 12px;">Error al cargar cartera: ${err.message}</div>`;
      }
      showToast('❌ Error al conectar con Monday.com: ' + err.message);
    }
  }

  /**
   * Renderiza la lista filtrable de clientes en la barra lateral
   */
  renderClientsList() {
    const listContainer = document.getElementById('cierreClientsList');
    if (!listContainer) return;

    const searchInput = document.getElementById('cierreClientSearch');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

    let filtered = (this.clients || []).filter(c => {
      // Filtro por texto
      if (query) {
        const nameMatch = (c.name || '').toLowerCase().includes(query);
        const contactMatch = (c.contraparte || '').toLowerCase().includes(query);
        const emailMatch = (c.correoContraparte || '').toLowerCase().includes(query);
        if (!nameMatch && !contactMatch && !emailMatch) return false;
      }

      // Filtro por estado/vigencia
      if (this.filterVigentes) {
        const estadoLower = (c.estado || '').toLowerCase();
        const etapaLower = (c.etapa || '').toLowerCase();
        if (estadoLower.includes('finaliz') || etapaLower.includes('finaliz')) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div style="padding: 24px; text-align: center; color: #94a3b8; font-size: 12px;">No se encontraron clientes con el filtro aplicado.</div>';
      return;
    }

    listContainer.innerHTML = filtered.map(c => {
      const isSelected = this.selectedClient && this.selectedClient.id === c.id;
      const estadoBadgeClass = (c.estado || '').toLowerCase().includes('finaliz') ? 'badge-success' : 'badge-accent';
      const etapaBadgeClass = (c.etapa || '').toLowerCase().includes('finaliz') ? 'badge-success' : 'badge-warning';

      return `
        <div class="onboarding-client-card ${isSelected ? 'selected' : ''}" data-client-id="${c.id}" style="cursor: pointer; padding: 10px 12px; margin-bottom: 8px; border-radius: 8px; border: 1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}; background: ${isSelected ? '#eff6ff' : '#ffffff'};">
          <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 4px;">${c.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            ${c.contraparte ? `👤 ${c.contraparte}` : 'Sin contraparte'}
          </div>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            <span class="badge ${estadoBadgeClass}" style="font-size: 10px; padding: 1px 6px;">${c.estado || 'Sin estado'}</span>
            <span class="badge ${etapaBadgeClass}" style="font-size: 10px; padding: 1px 6px;">${c.etapa || 'Sin etapa'}</span>
          </div>
        </div>
      `;
    }).join('');

    // Agregar evento clic a cada tarjeta
    listContainer.querySelectorAll('.onboarding-client-card').forEach(card => {
      card.addEventListener('click', () => {
        const clientId = card.getAttribute('data-client-id');
        const client = this.clients.find(c => String(c.id) === String(clientId));
        if (client) {
          this.selectClient(client);
        }
      });
    });
  }

  /**
   * Selecciona un cliente y prepara todos los pasos en pantalla
   */
  async selectClient(client) {
    this.selectedClient = client;
    this.transcriptsData = null;
    this.renderClientsList();

    // Actualizar encabezado del Hero Card
    const nameEl = document.getElementById('cierreSelectedClientName');
    if (nameEl) nameEl.textContent = client.name;

    const btnFull = document.getElementById('btnExecuteFullCierre');
    if (btnFull) btnFull.style.display = 'inline-flex';

    // Badges de Estado y Etapa
    const badgeEstado = document.getElementById('cierreBadgeEstado');
    if (badgeEstado) {
      badgeEstado.textContent = `Estado: ${client.estado || 'En curso'}`;
      badgeEstado.className = `badge ${(client.estado || '').toLowerCase().includes('finaliz') ? 'badge-success' : 'badge-accent'}`;
      badgeEstado.style.display = 'inline-block';
    }

    const badgeEtapa = document.getElementById('cierreBadgeEtapa');
    if (badgeEtapa) {
      badgeEtapa.textContent = `Etapa: ${client.etapa || 'En curso'}`;
      badgeEtapa.className = `badge ${(client.etapa || '').toLowerCase().includes('finaliz') ? 'badge-success' : 'badge-warning'}`;
      badgeEtapa.style.display = 'inline-block';
    }

    // Grid de datos
    const contraparteEl = document.getElementById('cierreClientContraparte');
    if (contraparteEl) contraparteEl.textContent = client.contraparte || '-';

    const emailEl = document.getElementById('cierreClientEmail');
    if (emailEl) emailEl.textContent = client.correoContraparte || client.email || '-';

    const phoneEl = document.getElementById('cierreClientPhone');
    if (phoneEl) phoneEl.textContent = client.telefonoContraparte || client.telefono || '-';

    const urlEl = document.getElementById('cierreClientUrl');
    if (urlEl) {
      if (client.urlBuk) {
        urlEl.innerHTML = `<a href="https://${client.urlBuk}" target="_blank" style="color: #2563eb; text-decoration: underline;">${client.urlBuk} ↗</a>`;
      } else {
        urlEl.textContent = '-';
      }
    }

    // Resetear estados visuales de los pasos
    this.resetStepBadges();

    // Resolver URL de la carpeta de Drive
    await this.resolveClientFolder(client);

    // Asegurar que la plantilla y los banners estén cargados
    if (!this.cierreTemplate) {
      await this.loadTemplate(false);
    }

    // Renderizar Vista Previa del Correo de Cierre
    this.renderEmailPreview();
  }

  /**
   * Resuelve y enlaza la carpeta de Drive del cliente
   */
  async resolveClientFolder(client) {
    const driveLinkEl = document.getElementById('cierreClientDriveLink');
    if (driveLinkEl) {
      driveLinkEl.innerHTML = '<span style="color: #64748b;">Buscando carpeta en Drive... ⏳</span>';
    }

    try {
      const config = await getConfig();
      const folderUrl = await DriveFolderService.resolveClientFolderUrl(client, {
        gasUrl: config.gasUrl,
        rootFolderId: config.rootClientsFolderId || config.rootDriveFolderId
      });

      if (folderUrl) {
        client.resolvedFolderUrl = folderUrl;
        if (driveLinkEl) {
          driveLinkEl.innerHTML = `<a href="${folderUrl}" target="_blank" style="color: #2563eb; font-weight: 600; text-decoration: underline;">Abrir en Drive 📁 ↗</a>`;
        }
      } else {
        client.resolvedFolderUrl = '';
        if (driveLinkEl) {
          driveLinkEl.innerHTML = '<span style="color: #ef4444;">No se detectó carpeta en Drive</span>';
        }
      }
    } catch (err) {
      console.warn('[CierreController] Error resolviendo carpeta de Drive:', err);
      if (driveLinkEl) {
        driveLinkEl.innerHTML = '<span style="color: #ef4444;">Error al consultar carpeta</span>';
      }
    }
  }

  /**
   * Resetea badges y estados de los 3 pasos
   */
  resetStepBadges() {
    ['CierreMail', 'CierreAi', 'CierreMonday'].forEach(step => {
      const ticket = document.getElementById(`stepTicket${step}`);
      if (ticket) ticket.style.display = 'none';

      const statusBadge = document.getElementById(`status${step}`);
      if (statusBadge) {
        statusBadge.className = 'status-step-badge hidden';
        statusBadge.textContent = '';
      }
    });

    const transcriptsDesc = document.getElementById('cierreTranscriptsFoundDesc');
    if (transcriptsDesc) transcriptsDesc.textContent = 'Lee transcripciones de Drive';

    const modelBadge = document.getElementById('cierreModelBadge');
    if (modelBadge) modelBadge.style.display = 'none';

    const docsContainer = document.getElementById('cierreDocsListContainer');
    if (docsContainer) docsContainer.style.display = 'none';

    const summaryTextarea = document.getElementById('cierreSummaryTextarea');
    if (summaryTextarea) summaryTextarea.value = '';

    const copyFeedback = document.getElementById('cierreCopyFeedback');
    if (copyFeedback) copyFeedback.style.display = 'none';
  }

  /**
   * Renderiza la vista previa del correo de cierre usando las variables del cliente y banners visuales
   */
  renderEmailPreview() {
    if (!this.selectedClient) return;

    const client = this.selectedClient;
    const recipientInput = document.getElementById('cierreRecipientPreview');
    if (recipientInput) {
      recipientInput.value = client.correoContraparte || client.email || '';
    }

    const { subject, htmlBody } = this.resolveCierreTemplate(client, { forDashboardPreview: true });

    const subjectInput = document.getElementById('cierreSubjectPreview');
    if (subjectInput) {
      subjectInput.value = subject;
    }

    const previewContainer = document.getElementById('cierreEmailPreviewContainer');
    if (previewContainer) {
      previewContainer.innerHTML = htmlBody;
    }
  }

  /**
   * Sustituye variables dinámicas en la plantilla de cierre e inyecta los banners
   */
  resolveCierreTemplate(client, options = {}) {
    const template = this.cierreTemplate;
    const companyName = client.name || 'Cliente';
    const contactName = client.contraparte || client.name || 'Equipo';
    const folderUrl = client.resolvedFolderUrl || 'https://drive.google.com';
    const senderName = options.senderName || '';
    const dateStr = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });

    let subject = template?.subject || 'Finalización de Implementación Buk Control de Asistencia - {{empresa}}';
    let bodyHtml = template?.bodyHtml || `
      <p>Hola <strong>{{nombre_cliente}}</strong> y equipo de <strong>{{empresa}}</strong>,</p>
      <p>¡Esperamos que se encuentren muy bien!</p>
      <p>Queremos felicitarlos formalmente por culminar con éxito la etapa de implementación y puesta en marcha del módulo de <strong>Control de Asistencia</strong> en Buk. Ha sido un placer trabajar junto a ustedes durante todo este proceso. 🚀</p>
      <p>Tal como conversamos en nuestra última reunión de cierre, les comparto el acceso directo a su carpeta de Google Drive, donde encontrarán alojadas <strong>todas las grabaciones de las sesiones realizadas</strong>, manuales de uso y los archivos clave del proyecto:</p>
      <table border="0" cellpadding="0" cellspacing="0" style="margin: 20px auto; text-align: center; width: auto;">
        <tr>
          <td align="center" style="border-radius: 8px; background-color: #2563eb;">
            <a href="{{link_carpeta}}" target="_blank" style="font-size: 14px; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 28px; border: 1px solid #2563eb; display: inline-block; font-weight: 600;">
              📁 Acceder a Carpeta de Grabaciones y Archivos
            </a>
          </td>
        </tr>
      </table>
      <p>También puedes acceder directamente haciendo clic en este enlace: <a href="{{link_carpeta}}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Abrir carpeta en Google Drive</a>.</p>
      <p>¡Mucho éxito en esta nueva etapa!</p>
      <p>Un abrazo,<br/><strong>{{mi_nombre}}</strong></p>
    `;

    // Reemplazos de variables dinámicas
    const map = [
      { regex: /\{\{\s*(?:empresa|cliente|nombre_empresa|razon_social)\s*\}\}/gi, val: companyName },
      { regex: /\{\{\s*(?:nombre_cliente|contacto|contraparte|destinatario)\s*\}\}/gi, val: contactName },
      { regex: /\{\{\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*\}\}/gi, val: folderUrl },
      { regex: /\{\{\s*(?:mi_nombre|remitente|asesor|ejecutivo|autor)\s*\}\}/gi, val: senderName },
      { regex: /\{\{\s*(?:correo|email|correo_contraparte)\s*\}\}/gi, val: client.correoContraparte || client.email || '' },
      { regex: /\{\{\s*(?:telefono|fono)\s*\}\}/gi, val: client.telefonoContraparte || '' },
      { regex: /\{\{\s*(?:fecha|fecha_hoy|date)\s*\}\}/gi, val: dateStr }
    ];

    if (folderUrl && /^https?:\/\//i.test(folderUrl)) {
      bodyHtml = bodyHtml.replace(
        /(href=["'])(?:https?:\/\/)?(?:\{\{\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*\}\}|%7B%7B\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*%7D%7D)/gi,
        `$1${folderUrl}`
      );
    }
    bodyHtml = bodyHtml.replace(/%7B%7B\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*%7D%7D/gi, folderUrl);

    map.forEach(({ regex, val }) => {
      subject = subject.replace(regex, val);
      bodyHtml = bodyHtml.replace(regex, val);
    });

    // Obtener assets de banners (prioridad: plantilla -> ajustes globales)
    const headerAsset = template?.headerAsset || this.bannerConfig?.header || '';
    const footerAsset = template?.footerAsset || this.bannerConfig?.footer || '';

    if (options.forDashboardPreview) {
      let headerImgHtml = '';
      if (headerAsset) {
        const headerUrl = this.getBannerAssetUrl(headerAsset);
        headerImgHtml = `<img src="${headerUrl}" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`;
      } else {
        const localHeader = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('assets/welcome_header.png') : '';
        headerImgHtml = localHeader
          ? `<img src="${localHeader}" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`
          : DEFAULT_HEADER_BANNER_HTML;
      }

      let footerImgHtml = '';
      if (footerAsset) {
        const footerUrl = this.getBannerAssetUrl(footerAsset);
        footerImgHtml = `<img src="${footerUrl}" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`;
      } else {
        const localFooter = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('assets/welcome_footer.png') : '';
        footerImgHtml = localFooter
          ? `<img src="${localFooter}" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`
          : DEFAULT_FOOTER_BANNER_HTML;
      }

      if (bodyHtml.includes('{{header_banner}}')) {
        bodyHtml = bodyHtml.replace(/\{\{\s*header_banner\s*\}\}/gi, headerImgHtml);
      } else if (headerImgHtml) {
        bodyHtml = `<div style="text-align: center; margin-bottom: 20px;">${headerImgHtml}</div>` + bodyHtml;
      }

      if (bodyHtml.includes('{{footer_banner}}')) {
        bodyHtml = bodyHtml.replace(/\{\{\s*footer_banner\s*\}\}/gi, footerImgHtml);
      } else if (footerImgHtml) {
        bodyHtml = bodyHtml + `<div style="text-align: center; margin-top: 24px;">${footerImgHtml}</div>`;
      }
    } else {
      // Para Gmail: asegurar que existan los placeholders {{header_banner}} y {{footer_banner}}
      // para que Google Apps Script inyecte los Blobs nativamente como inline cid:
      if (!bodyHtml.includes('{{header_banner}}')) {
        bodyHtml = '{{header_banner}}\n' + bodyHtml;
      }
      if (!bodyHtml.includes('{{footer_banner}}')) {
        bodyHtml = bodyHtml + '\n{{footer_banner}}';
      }
    }

    return { subject, htmlBody: bodyHtml, headerAsset, footerAsset };
  }

  /**
   * PASO 1: Crear Borrador en Gmail
   */
  async handleCreateDraft() {
    if (!this.selectedClient) {
      showToast('⚠️ Primero selecciona un cliente de la lista.');
      return;
    }
    if (this.isCreatingDraft) return;

    const btn = document.getElementById('btnCreateCierreDraft');
    const statusBadge = document.getElementById('statusCierreMail');
    const ticketTag = document.getElementById('stepTicketCierreMail');

    const recipientInput = document.getElementById('cierreRecipientPreview');
    const subjectInput = document.getElementById('cierreSubjectPreview');
    const recipient = recipientInput ? recipientInput.value.trim() : (this.selectedClient.correoContraparte || '');

    const { subject: defaultSubject, htmlBody, headerAsset, footerAsset } = this.resolveCierreTemplate(this.selectedClient, { forDashboardPreview: false });
    const subject = subjectInput && subjectInput.value.trim() ? subjectInput.value.trim() : defaultSubject;

    this.isCreatingDraft = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Creando Borrador...</span>';
    }

    try {
      const config = await getConfig();
      if (!config.gasUrl) {
        throw new Error('Falta configurar la URL de Apps Script en Ajustes (⚙️).');
      }

      await GasService.createCierreDraft(config.gasUrl, {
        clientName: this.selectedClient.name,
        recipient: recipient,
        subject: subject,
        htmlBody: htmlBody,
        headerAsset: headerAsset,
        footerAsset: footerAsset
      });

      if (ticketTag) ticketTag.style.display = 'inline-block';
      if (statusBadge) {
        statusBadge.className = 'status-step-badge success';
        statusBadge.textContent = 'Borrador creado en Gmail ✓';
      }

      showToast('✉️ ¡Borrador creado con éxito en tu bandeja de Gmail!');
    } catch (err) {
      console.error('[CierreController] Error creando borrador:', err);
      if (statusBadge) {
        statusBadge.className = 'status-step-badge error';
        statusBadge.textContent = 'Error: ' + err.message;
      }
      showToast('❌ Error creando borrador: ' + err.message);
    } finally {
      this.isCreatingDraft = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>✉️ Crear Borrador</span>';
      }
    }
  }

  /**
   * PASO 2: Extraer Transcripciones de Drive y Resumir con Gemini
   */
  async handleGenerateAiSummary() {
    if (!this.selectedClient) {
      showToast('⚠️ Primero selecciona un cliente de la lista.');
      return;
    }
    if (this.isGeneratingAi) return;

    const btn = document.getElementById('btnGenerateCierreSummary');
    const statusBadge = document.getElementById('statusCierreAi');
    const ticketTag = document.getElementById('stepTicketCierreAi');
    const transcriptsDesc = document.getElementById('cierreTranscriptsFoundDesc');
    const textarea = document.getElementById('cierreSummaryTextarea');
    const modelBadge = document.getElementById('cierreModelBadge');
    const docsContainer = document.getElementById('cierreDocsListContainer');
    const docsList = document.getElementById('cierreDocsList');

    this.isGeneratingAi = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Leyendo Transcripciones...</span>';
    }
    if (statusBadge) {
      statusBadge.className = 'status-step-badge active';
      statusBadge.textContent = 'Buscando en Drive...';
    }

    try {
      const config = await getConfig();
      if (!config.gasUrl) {
        throw new Error('Falta configurar la URL de Google Apps Script en Ajustes.');
      }
      if (!config.geminiApiKey) {
        throw new Error('Falta configurar la Gemini API Key en Ajustes (⚙️).');
      }

      let transcriptsText = '';
      const existingText = textarea ? textarea.value.trim() : '';

      // Si el usuario ya pegó o escribió notas/transcripción en el textarea, usarlas directamente
      if (existingText.length > 50 && !existingText.includes('Haz clic en') && !existingText.startsWith('1. Detalles sobre el funcionamiento')) {
        transcriptsText = existingText;
        if (transcriptsDesc) {
          transcriptsDesc.textContent = 'Usando texto/notas ingresadas';
        }
      } else {
        // 1. Obtener transcripciones y documentos desde Google Apps Script
        const transcriptsResult = await GasService.getClientTranscripts(config.gasUrl, {
          folderUrl: this.selectedClient.resolvedFolderUrl || '',
          clientName: this.selectedClient.name,
          rootFolderId: config.rootClientsFolderId || config.rootDriveFolderId
        });

        this.transcriptsData = transcriptsResult;
        const docCount = transcriptsResult.totalDocuments || 0;

        if (transcriptsDesc) {
          transcriptsDesc.textContent = `${docCount} documento(s) encontrado(s)`;
        }

        // Renderizar listado de documentos detectados
        if (docsContainer && docsList && Array.isArray(transcriptsResult.documents) && transcriptsResult.documents.length > 0) {
          docsList.innerHTML = transcriptsResult.documents.map(d => `
            <li>
              <a href="${d.url}" target="_blank" style="color: #2563eb; text-decoration: underline;">${d.name}</a>
              <span style="color: #94a3b8; font-size: 11px;"> (${d.date} • ${d.folderName})</span>
            </li>
          `).join('');
          docsContainer.style.display = 'block';
        }

        if (!transcriptsResult.combinedText || transcriptsResult.combinedText.trim().length < 30) {
          throw new Error(`Se encontraron ${docCount} documentos en la carpeta, pero no contienen texto legible de transcripción.`);
        }

        transcriptsText = transcriptsResult.combinedText;
      }

      // 2. Invocar Gemini con el prompt oficial de 3 secciones
      if (btn) {
        btn.innerHTML = '<span>🤖 Resumiendo con Gemini...</span>';
      }
      if (statusBadge) {
        statusBadge.textContent = 'Analizando con Gemini...';
      }

      const aiResponse = await MinutaAiService.generateCierreSummary({
        transcriptsText: transcriptsText,
        clientName: this.selectedClient.name,
        apiKey: config.geminiApiKey,
        model: config.geminiModel || 'gemini-3.7-flash'
      });

      // 3. Renderizar resultado en el textarea
      if (textarea) {
        textarea.value = aiResponse.text;
      }

      if (modelBadge) {
        modelBadge.textContent = aiResponse.model || 'Gemini 3.7 Flash';
        modelBadge.style.display = 'inline-block';
      }

      if (ticketTag) ticketTag.style.display = 'inline-block';
      if (statusBadge) {
        statusBadge.className = 'status-step-badge success';
        statusBadge.textContent = 'Resumen generado ✓';
      }

      showToast('🤖 ¡Resumen de cierre generado con éxito!');

      // Hacer scroll suave hacia la sección del resumen
      const summarySec = document.getElementById('cierreSummarySection');
      if (summarySec) summarySec.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      console.error('[CierreController] Error generando resumen IA:', err);
      const isGasActionError = err.message && err.message.includes('get_client_transcripts');
      if (statusBadge) {
        statusBadge.className = 'status-step-badge error';
        statusBadge.textContent = isGasActionError 
          ? 'Google Apps Script necesita desplegar la nueva versión'
          : ('Error: ' + err.message);
      }
      if (isGasActionError) {
        showToast('⚠️ Apps Script desactualizado. Despliega la nueva versión en Apps Script o pega las notas en el cuadro de abajo y haz clic de nuevo en Generar.', 7000);
      } else {
        showToast('❌ Error en Resumen IA: ' + err.message);
      }
    } finally {
      this.isGeneratingAi = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🤖 Generar Resumen IA</span>';
      }
    }
  }

  /**
   * Copia el texto del resumen al portapapeles
   */
  async handleCopySummary() {
    const textarea = document.getElementById('cierreSummaryTextarea');
    const feedback = document.getElementById('cierreCopyFeedback');
    const text = textarea ? textarea.value.trim() : '';

    if (!text) {
      showToast('⚠️ No hay texto para copiar. Genera primero el resumen.');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      if (feedback) {
        feedback.style.display = 'inline';
        setTimeout(() => {
          feedback.style.display = 'none';
        }, 3000);
      }
      showToast('📋 ¡Resumen copiado al portapapeles!');
    } catch (err) {
      console.warn('Error con navigator.clipboard, usando fallback textarea select:', err);
      textarea.select();
      document.execCommand('copy');
      if (feedback) {
        feedback.style.display = 'inline';
        setTimeout(() => {
          feedback.style.display = 'none';
        }, 3000);
      }
      showToast('📋 ¡Resumen copiado al portapapeles!');
    }
  }

  /**
   * PASO 3: Finalizar Cliente en Monday.com (Estado y Etapa = "Finalizado")
   */
  async handleFinalizeMonday() {
    if (!this.selectedClient) {
      showToast('⚠️ Primero selecciona un cliente de la lista.');
      return;
    }
    if (this.isFinalizingMonday) return;

    const btn = document.getElementById('btnFinalizeMondayStage');
    const statusBadge = document.getElementById('statusCierreMonday');
    const ticketTag = document.getElementById('stepTicketCierreMonday');

    this.isFinalizingMonday = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Actualizando Monday...</span>';
    }

    try {
      const config = await getConfig();
      if (!config.mondayApiKey) {
        throw new Error('Falta la API Key de Monday.com en Ajustes (⚙️).');
      }

      await MondayService.finalizeClient(
        this.selectedClient.id,
        config.boardId || '1400120846',
        config.mondayApiKey
      );

      // Actualizar estado en el objeto local
      this.selectedClient.estado = 'Finalizado';
      this.selectedClient.etapa = 'Finalizado';

      // Actualizar badges
      const badgeEstado = document.getElementById('cierreBadgeEstado');
      if (badgeEstado) {
        badgeEstado.textContent = 'Estado: Finalizado';
        badgeEstado.className = 'badge badge-success';
      }

      const badgeEtapa = document.getElementById('cierreBadgeEtapa');
      if (badgeEtapa) {
        badgeEtapa.textContent = 'Etapa: Finalizado';
        badgeEtapa.className = 'badge badge-success';
      }

      if (ticketTag) ticketTag.style.display = 'inline-block';
      if (statusBadge) {
        statusBadge.className = 'status-step-badge success';
        statusBadge.textContent = 'Finalizado en Monday ✓';
      }

      this.renderClientsList();
      showToast(`🎯 ${this.selectedClient.name} marcado como Finalizado en Monday.`);

    } catch (err) {
      console.error('[CierreController] Error finalizando en Monday:', err);
      if (statusBadge) {
        statusBadge.className = 'status-step-badge error';
        statusBadge.textContent = 'Error: ' + err.message;
      }
      showToast('❌ Error al actualizar Monday: ' + err.message);
    } finally {
      this.isFinalizingMonday = false;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🎯 Marcar Finalizado</span>';
      }
    }
  }

  /**
   * Ejecución Maestro: Corre los 3 pasos en secuencia automática
   */
  async executeFullCierre() {
    if (!this.selectedClient) {
      showToast('⚠️ Selecciona un cliente primero.');
      return;
    }
    if (this.isExecutingFull) return;

    this.isExecutingFull = true;
    const btnFull = document.getElementById('btnExecuteFullCierre');
    if (btnFull) {
      btnFull.disabled = true;
      btnFull.innerHTML = '<span>⚡ Ejecutando Cierre (Paso 1/3)...</span>';
    }

    try {
      // 1. Borrador en Gmail
      showToast('1/3 Creando borrador de cierre en Gmail...');
      await this.handleCreateDraft();

      // 2. Resumen IA de transcripciones
      if (btnFull) btnFull.innerHTML = '<span>⚡ Ejecutando Cierre (Paso 2/3)...</span>';
      showToast('2/3 Extrayendo transcripciones y generando resumen con Gemini...');
      await this.handleGenerateAiSummary();

      // 3. Finalizar en Monday
      if (btnFull) btnFull.innerHTML = '<span>⚡ Ejecutando Cierre (Paso 3/3)...</span>';
      showToast('3/3 Marcando Estado y Etapa como Finalizado en Monday...');
      await this.handleFinalizeMonday();

      showToast(`🎉 ¡Flujo de cierre completado para ${this.selectedClient.name}!`);
    } catch (err) {
      console.error('[CierreController] Error en ejecución completa:', err);
      showToast('⚠️ Flujo de cierre interrumpido: ' + err.message);
    } finally {
      this.isExecutingFull = false;
      if (btnFull) {
        btnFull.disabled = false;
        btnFull.innerHTML = '<span>⚡ Ejecutar Flujo de Cierre (1-Clic)</span>';
      }
    }
  }
}
