/**
 * Norma Hub - Controlador de Plantillas de Correo Electrónico
 * Integración nativa del creador/editor WYSIWYG, gestión de etiquetas,
 * simulador en vivo de Gmail, variables dinámicas y mapeo con Monday.com.
 */

import { firebaseService } from '../services/firebase_service.js';
import { mondayService } from '../services/email_monday_service.js';
import { showToast, showConfirmDialog, escapeHtml } from '../core/ui_helpers.js';
import { GasService } from '../services/gas_service.js';
import { getConfig } from '../core/config.js';

export function initTemplatesController() {
  const fbStatusBadge = document.getElementById('fbStatusBadge');
  const roleBadge = document.getElementById('roleBadge');
  
  const btnNewTemplate = document.getElementById('btnNewTemplate');
  const dashSearchInput = document.getElementById('dashSearchInput');
  const dashCategoryFilters = document.getElementById('dashCategoryFilters');
  const dashTemplatesList = document.getElementById('dashTemplatesList');
  const templateCountLabel = document.getElementById('templateCountLabel');
  const btnRefreshList = document.getElementById('btnRefreshList');

  const modeTabBtns = document.querySelectorAll('.mode-tab-btn');
  const editorView = document.getElementById('editorView');
  const previewView = document.getElementById('previewView');

  const btnSaveTemplate = document.getElementById('btnSaveTemplate');
  const saveBtnLabel = document.getElementById('saveBtnLabel');
  const btnDeleteCurrentTemplate = document.getElementById('btnDeleteCurrentTemplate');
  const btnDuplicateCurrentTemplate = document.getElementById('btnDuplicateCurrentTemplate');

  const fullEditorForm = document.getElementById('fullEditorForm');
  const fullTemplateId = document.getElementById('fullTemplateId');
  const fullTemplateTitle = document.getElementById('fullTemplateTitle');
  const fullTemplateCategory = document.getElementById('fullTemplateCategory');
  const fullTemplateSubject = document.getElementById('fullTemplateSubject');
  const fullWysiwygEditor = document.getElementById('fullWysiwygEditor');
  const legacyWysiwygEditor = document.getElementById('legacyWysiwygEditor');
  const legacyFullToolbar = document.getElementById('legacyFullToolbar');
  const btnToggleEditorMode = document.getElementById('btnToggleEditorMode');
  const toggleEditorModeIcon = document.getElementById('toggleEditorModeIcon');
  const toggleEditorModeText = document.getElementById('toggleEditorModeText');

  const tplHeaderAssetInput = document.getElementById('tplHeaderAssetInput');
  const tplHeaderFileInput = document.getElementById('tplHeaderFileInput');
  const btnTplUploadHeader = document.getElementById('btnTplUploadHeader');
  const btnTplClearHeader = document.getElementById('btnTplClearHeader');
  const tplHeaderPreviewImg = document.getElementById('tplHeaderPreviewImg');
  const tplHeaderEmptyTxt = document.getElementById('tplHeaderEmptyTxt');
  const tplHeaderUploadStatus = document.getElementById('tplHeaderUploadStatus');

  const tplFooterAssetInput = document.getElementById('tplFooterAssetInput');
  const tplFooterFileInput = document.getElementById('tplFooterFileInput');
  const btnTplUploadFooter = document.getElementById('btnTplUploadFooter');
  const btnTplClearFooter = document.getElementById('btnTplClearFooter');
  const tplFooterPreviewImg = document.getElementById('tplFooterPreviewImg');
  const tplFooterEmptyTxt = document.getElementById('tplFooterEmptyTxt');
  const tplFooterUploadStatus = document.getElementById('tplFooterUploadStatus');

  const btnDashLink = document.getElementById('btnDashLink');
  const btnDashDriveLink = document.getElementById('btnDashDriveLink');
  const btnDashImage = document.getElementById('btnDashImage');
  const dashImageUpload = document.getElementById('dashImageUpload');
  const dashDynamicVarsWrapper = document.getElementById('dashDynamicVarsWrapper');
  const btnDashManageVars = document.getElementById('btnDashManageVars');
  const btnOpenVarManager = document.getElementById('btnOpenVarManager');

  const variablesModal = document.getElementById('variablesModal');
  const btnCloseVariablesModal = document.getElementById('btnCloseVariablesModal');
  const btnCloseVariablesFooter = document.getElementById('btnCloseVariablesFooter');
  const varFormTitle = document.getElementById('varFormTitle');
  const varEditId = document.getElementById('varEditId');
  const varInputKey = document.getElementById('varInputKey');
  const varInputLabel = document.getElementById('varInputLabel');
  const varSourceSelect = document.getElementById('varSourceSelect');
  const varMondayColumnGroup = document.getElementById('varMondayColumnGroup');
  const varMondayColumnSelect = document.getElementById('varMondayColumnSelect');
  const varCustomColumnInput = document.getElementById('varCustomColumnInput');
  const btnCancelVarEdit = document.getElementById('btnCancelVarEdit');
  const btnSaveVarItem = document.getElementById('btnSaveVarItem');
  const varCountBadge = document.getElementById('varCountBadge');
  const varTableBody = document.getElementById('varTableBody');

  const categoriesModal = document.getElementById('categoriesModal');
  const btnOpenCategoryManager = document.getElementById('btnOpenCategoryManager');
  const btnSidebarManageCategories = document.getElementById('btnSidebarManageCategories');
  const btnQuickManageCategories = document.getElementById('btnQuickManageCategories');
  const btnCloseCategoriesModal = document.getElementById('btnCloseCategoriesModal');
  const btnCloseCategoriesFooter = document.getElementById('btnCloseCategoriesFooter');
  const categoryFormTitle = document.getElementById('categoryFormTitle');
  const categoryEditOldName = document.getElementById('categoryEditOldName');
  const categoryInputName = document.getElementById('categoryInputName');
  const btnSaveCategoryItem = document.getElementById('btnSaveCategoryItem');
  const btnCancelCategoryEdit = document.getElementById('btnCancelCategoryEdit');
  const categoryCountBadge = document.getElementById('categoryCountBadge');
  const categoriesTableBody = document.getElementById('categoriesTableBody');
  const dashCategoriesList = document.getElementById('dashCategoriesList');

  const ctaButtonModal = document.getElementById('ctaButtonModal');
  const btnDashCtaButton = document.getElementById('btnDashCtaButton');
  const btnCloseCtaModal = document.getElementById('btnCloseCtaModal');
  const btnCancelCtaModal = document.getElementById('btnCancelCtaModal');
  const ctaInputText = document.getElementById('ctaInputText');
  const ctaInputUrl = document.getElementById('ctaInputUrl');
  const btnCtaPresetDrive = document.getElementById('btnCtaPresetDrive');
  const ctaRadiusSelect = document.getElementById('ctaRadiusSelect');
  const ctaAlignSelect = document.getElementById('ctaAlignSelect');
  const ctaTextColorSelect = document.getElementById('ctaTextColorSelect');
  const ctaCustomBgColor = document.getElementById('ctaCustomBgColor');
  const ctaPreviewContainer = document.getElementById('ctaPreviewContainer');
  const ctaPreviewButton = document.getElementById('ctaPreviewButton');
  const btnInsertCtaFinal = document.getElementById('btnInsertCtaFinal');
  let selectedCtaBgColor = '#2563eb';
  let savedEditorRange = null;

  const simSubjectDisplay = document.getElementById('simSubjectDisplay');
  const simBodyDisplay = document.getElementById('simBodyDisplay');

  let allTemplates = [];
  let managedCategories = [];
  let currentCategory = 'TODAS';
  let activeTemplateId = null;
  let isUserAdmin = true;
  let lastActiveEditorTarget = fullWysiwygEditor;
  let globalAppConfig = null;
  let sunEditorInstance = null;
  let editorMode = localStorage.getItem('norma_editor_mode') || localStorage.getItem('friday_editor_mode') || 'suneditor';

  init();

  async function init() {
    try {
      globalAppConfig = await getConfig();
    } catch (e) {
      console.warn('Aviso: no se pudo cargar la configuración de Ajustes:', e);
    }
    initSunEditor();
    await loadConfigStatus();
    await loadCategoriesData();
    await loadTemplatesData();
    setupToolbarEvents();
    setupEventListeners();

    if (allTemplates.length > 0) {
      selectTemplate(allTemplates[0].id);
    } else {
      createNewTemplate();
    }
  }

  function getEditorContent() {
    if (editorMode === 'suneditor' && sunEditorInstance) {
      return sunEditorInstance.getContents();
    }
    if (legacyWysiwygEditor && legacyWysiwygEditor.style.display !== 'none') {
      return legacyWysiwygEditor.innerHTML || '';
    }
    if (sunEditorInstance) {
      return sunEditorInstance.getContents();
    }
    if (legacyWysiwygEditor) {
      return legacyWysiwygEditor.innerHTML || '';
    }
    return fullWysiwygEditor ? (fullWysiwygEditor.value || fullWysiwygEditor.innerHTML || '') : '';
  }

  function setEditorContent(html) {
    const content = html || '';
    if (sunEditorInstance) {
      sunEditorInstance.setContents(content);
    }
    if (legacyWysiwygEditor) {
      legacyWysiwygEditor.innerHTML = content;
    }
    if (fullWysiwygEditor && fullWysiwygEditor.tagName === 'TEXTAREA') {
      fullWysiwygEditor.value = content;
    }
  }

  function insertEditorHtml(html) {
    if (editorMode === 'suneditor' && sunEditorInstance) {
      sunEditorInstance.insertHTML(html);
      return;
    }
    const target = legacyWysiwygEditor || fullWysiwygEditor;
    if (target) {
      target.focus();
      document.execCommand('insertHTML', false, html);
    }
  }

  function applyEditorModeUI() {
    const isSun = editorMode === 'suneditor' && sunEditorInstance;
    const sunWrapper = document.querySelector('.sun-editor');

    if (isSun) {
      if (sunWrapper) sunWrapper.style.display = '';
      if (legacyFullToolbar) legacyFullToolbar.style.display = 'none';
      if (legacyWysiwygEditor) legacyWysiwygEditor.style.display = 'none';
      if (toggleEditorModeIcon) toggleEditorModeIcon.textContent = '🔄';
      if (toggleEditorModeText) toggleEditorModeText.textContent = 'Volver a Editor Clásico';
      if (btnToggleEditorMode) {
        btnToggleEditorMode.title = 'Cambiar al editor simple anterior';
        btnToggleEditorMode.style.background = '#ffffff';
        btnToggleEditorMode.style.borderColor = '#cbd5e1';
      }
    } else {
      if (sunWrapper) sunWrapper.style.display = 'none';
      if (legacyFullToolbar) legacyFullToolbar.style.display = 'flex';
      if (legacyWysiwygEditor) legacyWysiwygEditor.style.display = 'block';
      if (toggleEditorModeIcon) toggleEditorModeIcon.textContent = '✨';
      if (toggleEditorModeText) toggleEditorModeText.textContent = 'Probar SunEditor';
      if (btnToggleEditorMode) {
        btnToggleEditorMode.title = 'Activar SunEditor con todas las opciones avanzadas de formato';
        btnToggleEditorMode.style.background = '#eff6ff';
        btnToggleEditorMode.style.borderColor = '#bfdbfe';
      }
    }
  }

  function toggleEditorMode() {
    const currentHtml = getEditorContent();
    if (editorMode === 'suneditor') {
      editorMode = 'classic';
      localStorage.setItem('norma_editor_mode', 'classic');
      localStorage.setItem('friday_editor_mode', 'classic');
      if (legacyWysiwygEditor) legacyWysiwygEditor.innerHTML = currentHtml;
      applyEditorModeUI();
      showToast('Cambiado a Editor Clásico.');
    } else {
      editorMode = 'suneditor';
      localStorage.setItem('norma_editor_mode', 'suneditor');
      localStorage.setItem('friday_editor_mode', 'suneditor');
      if (sunEditorInstance) {
        sunEditorInstance.setContents(currentHtml);
      }
      applyEditorModeUI();
      showToast('Cambiado a SunEditor con funciones avanzadas.');
    }
    updateSimulator();
  }

  function initSunEditor() {
    if (typeof window.SUNEDITOR === 'undefined') {
      console.warn('[TemplatesController] SunEditor no está disponible en window. Usando editor clásico.');
      editorMode = 'classic';
      applyEditorModeUI();
      return;
    }
    const target = document.getElementById('fullWysiwygEditor');
    if (!target) return;

    try {
      sunEditorInstance = window.SUNEDITOR.create('fullWysiwygEditor', {
        lang: (typeof window.SUNEDITOR_LANG !== 'undefined' && window.SUNEDITOR_LANG.es) ? window.SUNEDITOR_LANG.es : undefined,
        width: '100%',
        minHeight: '400px',
        height: 'auto',
        buttonList: [
          ['undo', 'redo'],
          ['font', 'fontSize', 'formatBlock'],
          ['paragraphStyle', 'blockquote'],
          ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
          ['fontColor', 'hiliteColor', 'textStyle'],
          ['removeFormat'],
          ['outdent', 'indent'],
          ['align', 'horizontalRule', 'list', 'lineHeight'],
          ['table', 'link', 'image'],
          ['fullScreen', 'showBlocks', 'codeView'],
          ['preview']
        ],
        font: [
          'Plus Jakarta Sans',
          'Arial',
          'Comic Sans MS',
          'Courier New',
          'Impact',
          'Georgia',
          'Tahoma',
          'Trebuchet MS',
          'Verdana'
        ],
        fontSize: [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 36],
        defaultStyle: 'font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;',
        colorList: [
          ['#000000', '#2563eb', '#1d4ed8', '#059669', '#10b981', '#f59e0b', '#dc2626', '#7c3aed', '#64748b'],
          ['#ffffff', '#dbeafe', '#bfdbfe', '#d1fae5', '#a7f3d0', '#fef3c7', '#fee2e2', '#ede9fe', '#f1f5f9']
        ]
      });

      sunEditorInstance.onChange = function(contents) {
        updateSimulator();
      };

      sunEditorInstance.onFocus = function() {
        lastActiveEditorTarget = sunEditorInstance;
      };

      applyEditorModeUI();
    } catch (err) {
      console.error('[TemplatesController] Error inicializando SunEditor:', err);
      editorMode = 'classic';
      applyEditorModeUI();
    }
  }

  async function loadConfigStatus() {
    if (!fbStatusBadge) return;
    try {
      const config = await firebaseService.getConfig();
      isUserAdmin = true;

      const isConfigured = Boolean(config.projectId && config.apiKey);
      const indicator = fbStatusBadge.querySelector('.status-indicator');
      const label = fbStatusBadge.querySelector('.status-label');

      if (indicator && label) {
        if (isConfigured) {
          indicator.className = 'status-indicator';
          label.textContent = 'Firestore: ' + config.projectId;
        } else {
          indicator.className = 'status-indicator offline';
          label.textContent = 'Modo Local / Demo';
        }
      }
    } catch (err) {
      console.warn('Error al verificar estado de Firebase:', err);
    }
  }

  async function loadCategoriesData() {
    try {
      if (typeof firebaseService !== 'undefined' && firebaseService.getCategories) {
        managedCategories = await firebaseService.getCategories();
      } else {
        managedCategories = ['Comercial', 'Ventas', 'Soporte', 'Operaciones', 'Bienvenida', 'General'];
      }
      renderCategoriesDataList();
      renderCategories();
      if (categoriesModal && categoriesModal.style.display === 'flex') {
        renderCategoriesTable();
      }
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  }

  function renderCategoriesDataList() {
    if (!dashCategoriesList) return;
    dashCategoriesList.innerHTML = '';
    managedCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      dashCategoriesList.appendChild(opt);
    });
  }

  async function loadTemplatesData(force = false) {
    try {
      allTemplates = await firebaseService.getTemplates(force);
      await loadCategoriesData();
      renderCategories();
      renderTemplatesList();
    } catch (err) {
      console.error('Error cargando plantillas en dashboard:', err);
    }
  }

  function renderCategories() {
    if (!dashCategoryFilters) return;
    const categories = new Set(['TODAS']);
    managedCategories.forEach(c => {
      if (c && c.trim()) categories.add(c.trim());
    });

    dashCategoryFilters.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'dash-cat-chip ' + (currentCategory === cat ? 'active' : '');
      chip.textContent = cat;
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        currentCategory = cat;
        renderCategories();
        renderTemplatesList();
      });
      dashCategoryFilters.appendChild(chip);
    });
  }

  function renderTemplatesList() {
    if (!dashTemplatesList) return;
    const query = (dashSearchInput ? dashSearchInput.value : '').toLowerCase().trim();

    const filtered = allTemplates.filter(t => {
      const matchesCat = currentCategory === 'TODAS' || t.category === currentCategory;
      const matchesQuery = !query ||
        (t.title && t.title.toLowerCase().includes(query)) ||
        (t.subject && t.subject.toLowerCase().includes(query)) ||
        (t.category && t.category.toLowerCase().includes(query)) ||
        (t.bodyHtml && t.bodyHtml.toLowerCase().includes(query));
      return matchesCat && matchesQuery;
    });

    if (templateCountLabel) {
      templateCountLabel.textContent = filtered.length + ' plantilla' + (filtered.length === 1 ? '' : 's');
    }
    dashTemplatesList.innerHTML = '';

    if (filtered.length === 0) {
      dashTemplatesList.innerHTML = `
        <div style="text-align: center; padding: 40px 10px; color: #64748b;">
          <p style="font-size: 14px; font-weight: 600;">No se encontraron plantillas</p>
          <small>Crea una nueva con el botón "+ Nueva Plantilla".</small>
        </div>
      `;
      return;
    }

    filtered.forEach(tpl => {
      const card = document.createElement('div');
      card.className = 'dash-template-card ' + (tpl.id === activeTemplateId ? 'active' : '');
      card.dataset.id = tpl.id;

      const varsHtml = (tpl.variables || []).map(v => '<span class="dtc-var-pill">{{' + escapeHtml(v) + '}}</span>').join('');

      card.innerHTML = `
        <div class="dtc-head">
          <span class="dtc-title">` + escapeHtml(tpl.title) + `</span>
          <div class="dtc-head-actions">
            <span class="dtc-category">` + escapeHtml(tpl.category || 'General') + `</span>
            <button type="button" class="btn-card-delete" title="Eliminar plantilla" data-id="` + escapeHtml(tpl.id) + `">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="dtc-subject">` + escapeHtml(tpl.subject) + `</div>
        ` + (varsHtml ? '<div class="dtc-vars">' + varsHtml + '</div>' : '') + `
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-card-delete')) return;
        selectTemplate(tpl.id);
      });

      const btnDel = card.querySelector('.btn-card-delete');
      if (btnDel) {
        btnDel.addEventListener('click', async (e) => {
          e.stopPropagation();
          e.preventDefault();
          await deleteSpecificTemplate(tpl.id, tpl.title);
        });
      }

      dashTemplatesList.appendChild(card);
    });
  }

  function getBannerDisplayUrl(assetStr) {
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

  function updateTplBannerPreviews() {
    const rawHeader = tplHeaderAssetInput?.value?.trim() || globalAppConfig?.templateHeaderAsset || '';
    let headerUrl = getBannerDisplayUrl(rawHeader);
    if (!headerUrl && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      headerUrl = chrome.runtime.getURL('assets/welcome_header.png');
    }

    if (tplHeaderPreviewImg && tplHeaderEmptyTxt) {
      if (headerUrl) {
        tplHeaderPreviewImg.src = headerUrl;
        tplHeaderPreviewImg.style.display = 'block';
        tplHeaderEmptyTxt.style.display = 'none';
      } else {
        tplHeaderPreviewImg.src = '';
        tplHeaderPreviewImg.style.display = 'none';
        tplHeaderEmptyTxt.style.display = 'inline';
      }
    }

    const rawFooter = tplFooterAssetInput?.value?.trim() || globalAppConfig?.templateFooterAsset || '';
    let footerUrl = getBannerDisplayUrl(rawFooter);
    if (!footerUrl && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      footerUrl = chrome.runtime.getURL('assets/welcome_footer.png');
    }

    if (tplFooterPreviewImg && tplFooterEmptyTxt) {
      if (footerUrl) {
        tplFooterPreviewImg.src = footerUrl;
        tplFooterPreviewImg.style.display = 'block';
        tplFooterEmptyTxt.style.display = 'none';
      } else {
        tplFooterPreviewImg.src = '';
        tplFooterPreviewImg.style.display = 'none';
        tplFooterEmptyTxt.style.display = 'inline';
      }
    }
  }

  async function handleTplBannerUpload(file, type) {
    if (!file) return;
    const statusEl = type === 'header' ? tplHeaderUploadStatus : tplFooterUploadStatus;
    const inputEl = type === 'header' ? tplHeaderAssetInput : tplFooterAssetInput;

    if (statusEl) statusEl.textContent = '⏳ Subiendo a Drive...';

    try {
      const config = await getConfig();
      if (!config.gasUrl) {
        throw new Error('Falta la URL de Apps Script (gasUrl) en Ajustes.');
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const base64Data = dataUrl.split(',')[1];
          const mimeType = file.type || 'image/png';

          const res = await GasService.uploadTemplateAsset(config.gasUrl, {
            fileName: `template_${type}_${Date.now()}_${file.name}`,
            fileBase64: base64Data,
            base64Data: base64Data,
            mimeType: mimeType,
            assetType: type
          });

          if (res && res.fileId) {
            if (inputEl) inputEl.value = res.fileId;
            updateTplBannerPreviews();
            updateSimulator();
            if (statusEl) statusEl.textContent = '✅ Subido';
            showToast(`✅ Banner ${type === 'header' ? 'superior' : 'inferior'} subido a Drive para esta plantilla.`);
          } else {
            throw new Error(res?.error || 'No se recibió ID de archivo.');
          }
        } catch (uploadErr) {
          if (statusEl) statusEl.textContent = '❌ Error';
          showToast('Error al subir: ' + uploadErr.message, 'error');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      if (statusEl) statusEl.textContent = '❌ Error';
      showToast('Error: ' + err.message, 'error');
    }
  }

  function selectTemplate(templateId) {
    const tpl = allTemplates.find(t => t.id === templateId);
    if (!tpl) return;

    activeTemplateId = tpl.id;
    if (fullTemplateId) fullTemplateId.value = tpl.id;
    if (fullTemplateTitle) fullTemplateTitle.value = tpl.title;
    if (fullTemplateCategory) fullTemplateCategory.value = tpl.category || 'General';
    if (fullTemplateSubject) fullTemplateSubject.value = tpl.subject;
    setEditorContent(tpl.bodyHtml);

    if (tplHeaderAssetInput) {
      tplHeaderAssetInput.value = tpl.headerAsset || '';
      if (!tpl.headerAsset && globalAppConfig?.templateHeaderAsset) {
        tplHeaderAssetInput.placeholder = `Global (Ajustes): ${globalAppConfig.templateHeaderAsset}`;
      } else {
        tplHeaderAssetInput.placeholder = 'ID de Drive o URL pública (opcional)';
      }
    }
    if (tplFooterAssetInput) {
      tplFooterAssetInput.value = tpl.footerAsset || '';
      if (!tpl.footerAsset && globalAppConfig?.templateFooterAsset) {
        tplFooterAssetInput.placeholder = `Global (Ajustes): ${globalAppConfig.templateFooterAsset}`;
      } else {
        tplFooterAssetInput.placeholder = 'ID de Drive o URL pública (opcional)';
      }
    }
    if (tplHeaderUploadStatus) tplHeaderUploadStatus.textContent = '';
    if (tplFooterUploadStatus) tplFooterUploadStatus.textContent = '';
    updateTplBannerPreviews();

    if (saveBtnLabel) saveBtnLabel.textContent = 'Actualizar Plantilla';
    if (btnDeleteCurrentTemplate) btnDeleteCurrentTemplate.style.display = 'inline-flex';
    if (btnDuplicateCurrentTemplate) btnDuplicateCurrentTemplate.style.display = 'inline-flex';

    updateSimulator();
    renderTemplatesList();
  }

  function createNewTemplate() {
    activeTemplateId = null;
    if (fullTemplateId) fullTemplateId.value = '';
    if (fullTemplateTitle) fullTemplateTitle.value = '';
    if (fullTemplateCategory) fullTemplateCategory.value = 'Comercial';
    if (fullTemplateSubject) fullTemplateSubject.value = '';
    setEditorContent('<p>Estimado/a <strong>{{nombre_cliente}}</strong>,</p><p>Escribe aquí el contenido de tu correo...</p>');

    if (tplHeaderAssetInput) tplHeaderAssetInput.value = '';
    if (tplFooterAssetInput) tplFooterAssetInput.value = '';
    if (tplHeaderUploadStatus) tplHeaderUploadStatus.textContent = '';
    if (tplFooterUploadStatus) tplFooterUploadStatus.textContent = '';
    updateTplBannerPreviews();

    if (saveBtnLabel) saveBtnLabel.textContent = 'Guardar Nueva Plantilla';
    if (btnDeleteCurrentTemplate) btnDeleteCurrentTemplate.style.display = 'none';
    if (btnDuplicateCurrentTemplate) btnDuplicateCurrentTemplate.style.display = 'none';

    updateSimulator();
    renderTemplatesList();
    if (fullTemplateTitle) fullTemplateTitle.focus();
  }

  async function saveCurrentTemplate() {
    if (!fullTemplateTitle.value.trim()) {
      showToast('⚠️ Por favor ingresa un título para la plantilla.');
      fullTemplateTitle.focus();
      return;
    }

    if (!fullTemplateSubject.value.trim()) {
      showToast('⚠️ Por favor ingresa el asunto del correo.');
      fullTemplateSubject.focus();
      return;
    }

    if (btnSaveTemplate) btnSaveTemplate.disabled = true;
    if (saveBtnLabel) saveBtnLabel.textContent = 'Guardando...';

    try {
      const templateData = {
        id: fullTemplateId.value || undefined,
        title: fullTemplateTitle.value.trim(),
        category: fullTemplateCategory.value.trim() || 'General',
        subject: fullTemplateSubject.value.trim(),
        bodyHtml: getEditorContent(),
        headerAsset: tplHeaderAssetInput ? tplHeaderAssetInput.value.trim() : '',
        footerAsset: tplFooterAssetInput ? tplFooterAssetInput.value.trim() : ''
      };

      const saved = await firebaseService.saveTemplate(templateData);
      activeTemplateId = saved.id;

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'TEMPLATES_UPDATED' });
      }

      await loadTemplatesData(false);
      selectTemplate(saved.id);

      if (saved.syncWarning) {
        showToast('⚠️ Plantilla guardada localmente (alerta en nube: ' + saved.syncWarning + ')');
      } else {
        showToast('✅ ¡Plantilla guardada con éxito!');
      }
    } catch (err) {
      showToast('❌ Error al guardar: ' + err.message);
    } finally {
      if (btnSaveTemplate) btnSaveTemplate.disabled = false;
      if (saveBtnLabel) saveBtnLabel.textContent = activeTemplateId ? 'Actualizar Plantilla' : 'Guardar Plantilla';
    }
  }

  function duplicateCurrentTemplate() {
    const title = fullTemplateTitle.value.trim();
    if (fullTemplateId) fullTemplateId.value = '';
    if (fullTemplateTitle) fullTemplateTitle.value = title + ' (Copia)';
    activeTemplateId = null;
    if (saveBtnLabel) saveBtnLabel.textContent = 'Guardar como Nueva Plantilla';
    if (btnDeleteCurrentTemplate) btnDeleteCurrentTemplate.style.display = 'none';
    if (btnDuplicateCurrentTemplate) btnDuplicateCurrentTemplate.style.display = 'none';
    showToast('📋 Copia preparada en el editor. Haz clic en "Guardar" para registrarla.');
  }

  async function deleteSpecificTemplate(templateId, templateTitle) {
    if (!templateId) return;
    const title = templateTitle || 'esta plantilla';

    const confirmed = await showConfirmDialog({
      title: '¿Eliminar plantilla?',
      message: '¿Estás seguro de que deseas eliminar permanentemente "' + title + '"?\n\nEsta acción no se puede deshacer.',
      confirmText: 'Eliminar Plantilla',
      danger: true
    });

    if (confirmed) {
      try {
        await firebaseService.deleteTemplate(templateId);
        
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: 'TEMPLATES_UPDATED' });
        }

        showToast('🗑️ Plantilla eliminada correctamente.');
        await loadTemplatesData(false);

        if (activeTemplateId === templateId) {
          if (allTemplates.length > 0) {
            selectTemplate(allTemplates[0].id);
          } else {
            createNewTemplate();
          }
        }
      } catch (err) {
        showToast('❌ Error al eliminar: ' + err.message);
      }
    }
  }

  async function deleteCurrentTemplate() {
    if (!activeTemplateId) return;
    const tpl = allTemplates.find(t => t.id === activeTemplateId);
    await deleteSpecificTemplate(activeTemplateId, tpl ? tpl.title : '');
  }

  function updateSimulator() {
    if (simSubjectDisplay) simSubjectDisplay.textContent = fullTemplateSubject.value || '(Sin asunto)';

    let bodyContent = getEditorContent() || '<p><em>(Sin contenido)</em></p>';

    // Cascada de banners: Específico de plantilla > Global de Ajustes > Asset oficial de extensión
    const rawHeader = tplHeaderAssetInput?.value?.trim() || globalAppConfig?.templateHeaderAsset || '';
    let headerUrl = getBannerDisplayUrl(rawHeader);
    if (!headerUrl && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      headerUrl = chrome.runtime.getURL('assets/welcome_header.png');
    }

    const rawFooter = tplFooterAssetInput?.value?.trim() || globalAppConfig?.templateFooterAsset || '';
    let footerUrl = getBannerDisplayUrl(rawFooter);
    if (!footerUrl && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      footerUrl = chrome.runtime.getURL('assets/welcome_footer.png');
    }

    const headerImgTag = headerUrl 
      ? `<img src="${headerUrl}" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`
      : '';
    const footerImgTag = footerUrl 
      ? `<img src="${footerUrl}" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />`
      : '';

    if (bodyContent.includes('{{header_banner}}')) {
      bodyContent = bodyContent.replace(/\{\{header_banner\}\}/gi, headerImgTag);
    } else if (headerImgTag && !bodyContent.includes(headerUrl)) {
      bodyContent = `<div style="text-align: center; margin-bottom: 20px;">${headerImgTag}</div>` + bodyContent;
    }

    if (bodyContent.includes('{{footer_banner}}')) {
      bodyContent = bodyContent.replace(/\{\{footer_banner\}\}/gi, footerImgTag);
    } else if (footerImgTag && !bodyContent.includes(footerUrl)) {
      bodyContent = bodyContent + `<div style="text-align: center; margin-top: 24px;">${footerImgTag}</div>`;
    }

    // Simular visualmente enlaces y botones de carpeta Drive en la vista previa
    const sampleDriveUrl = 'https://drive.google.com/drive/folders/ejemplo-grabaciones-cliente';
    bodyContent = bodyContent.replace(
      /(href=["'])(?:https?:\/\/)?(?:\{\{\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*\}\}|%7B%7B\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*%7D%7D)/gi,
      `$1${sampleDriveUrl}`
    );
    bodyContent = bodyContent.replace(/%7B%7B\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*%7D%7D/gi, sampleDriveUrl);
    bodyContent = bodyContent.replace(/\{\{\s*(?:link_carpeta|link_grabaciones|carpeta_drive|carpeta|grabaciones|url_carpeta)\s*\}\}/gi, sampleDriveUrl);

    if (simBodyDisplay) simBodyDisplay.innerHTML = bodyContent;
  }

  function initEditorFocusTracking() {
    [fullTemplateSubject, fullTemplateTitle].forEach(inp => {
      if (!inp) return;
      inp.addEventListener('focus', () => { lastActiveEditorTarget = inp; });
      inp.addEventListener('click', () => { lastActiveEditorTarget = inp; });
      inp.addEventListener('keyup', () => { lastActiveEditorTarget = inp; });
    });

    if (legacyWysiwygEditor) {
      legacyWysiwygEditor.addEventListener('focus', () => { lastActiveEditorTarget = legacyWysiwygEditor; });
      legacyWysiwygEditor.addEventListener('click', () => { lastActiveEditorTarget = legacyWysiwygEditor; });
      legacyWysiwygEditor.addEventListener('keyup', () => { 
        lastActiveEditorTarget = legacyWysiwygEditor; 
        updateSimulator();
      });
      legacyWysiwygEditor.addEventListener('input', () => {
        updateSimulator();
      });
    }

    if (fullWysiwygEditor) {
      fullWysiwygEditor.addEventListener('focus', () => { lastActiveEditorTarget = fullWysiwygEditor; });
      fullWysiwygEditor.addEventListener('click', () => { lastActiveEditorTarget = fullWysiwygEditor; });
      fullWysiwygEditor.addEventListener('keyup', () => { lastActiveEditorTarget = fullWysiwygEditor; });
    }
  }

  function setupToolbarEvents() {
    initEditorFocusTracking();

    document.querySelectorAll('.tb-btn[data-cmd]').forEach(btn => {
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.val || null;
        document.execCommand(cmd, false, val);
        if (legacyWysiwygEditor) legacyWysiwygEditor.focus();
        updateSimulator();
      });
    });

    if (btnDashLink) {
      btnDashLink.addEventListener('click', () => {
        const url = prompt('Ingresa la URL del enlace (ej: https://buk.cl):');
        if (url) {
          const linkHtml = `<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(url)}</a>`;
          insertEditorHtml(linkHtml);
          updateSimulator();
        }
      });
    }

    if (btnDashDriveLink) {
      btnDashDriveLink.addEventListener('mousedown', (e) => e.preventDefault());
      btnDashDriveLink.addEventListener('click', handleInsertDriveFolderLink);
    }

    if (btnDashImage) {
      btnDashImage.addEventListener('click', () => {
        if (dashImageUpload) {
          dashImageUpload.click();
        }
      });
    }

    if (dashImageUpload) {
      dashImageUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const imgHtml = `<img src="${event.target.result}" style="max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0;" alt="Imagen">`;
          insertEditorHtml(imgHtml);
          updateSimulator();
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnDashCtaButton) {
      btnDashCtaButton.addEventListener('click', openCtaModal);
    }

    loadAndRenderVariableChips();
  }

  function handleInsertDriveFolderLink() {
    let selectedText = '';
    if (editorMode === 'suneditor' && sunEditorInstance) {
      selectedText = (sunEditorInstance.getSelection()?.toString() || '').trim();
    } else {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        selectedText = selection.toString().trim();
      }
    }

    let linkHtml = '';
    if (selectedText) {
      linkHtml = `<a href="{{link_carpeta}}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${escapeHtml(selectedText)}</a>`;
    } else {
      const defaultText = prompt('Texto para el enlace a la Carpeta Drive del Cliente:', '📁 Carpeta de Grabaciones y Archivos');
      if (defaultText === null) return;
      const linkText = (defaultText || '').trim() || '📁 Carpeta de Grabaciones y Archivos';
      linkHtml = `<a href="{{link_carpeta}}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${escapeHtml(linkText)}</a>`;
    }
    insertEditorHtml(linkHtml);
    updateSimulator();
    showToast('📁 Enlace a Carpeta Drive ({{link_carpeta}}) insertado.');
  }

  async function loadAndRenderVariableChips() {
    if (!dashDynamicVarsWrapper) return;
    dashDynamicVarsWrapper.innerHTML = '';

    if (typeof mondayService === 'undefined') return;

    try {
      const variables = await mondayService.getVariableDefinitions();
      variables.forEach(v => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dash-var-chip';
        btn.dataset.var = '{{' + v.key + '}}';
        
        let tooltip = v.label || v.key;
        if (v.source === 'monday') {
          tooltip += ' (Columna Monday: ' + (v.columnTitle || v.key) + ')';
        } else if (v.source === 'drive') {
          tooltip += ' (Google Drive / Grabaciones)';
        }
        btn.title = tooltip;

        if (v.source === 'drive' || v.key === 'link_carpeta' || v.key === 'link_grabaciones') {
          btn.style.borderColor = '#6ee7b7';
          btn.style.color = '#047857';
          btn.style.background = '#ecfdf5';
          btn.textContent = '📁 + {{' + v.key + '}}';
        } else {
          btn.textContent = '+ {{' + v.key + '}}';
        }

        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', () => {
          insertVariableAtCursor('{{' + v.key + '}}');
        });

        dashDynamicVarsWrapper.appendChild(btn);
      });
    } catch (err) {
      console.warn('Error renderizando chips de variables:', err);
    }
  }

  function insertVariableAtCursor(text) {
    if (lastActiveEditorTarget === fullTemplateSubject || lastActiveEditorTarget === fullTemplateTitle) {
      const input = lastActiveEditorTarget;
      const start = (input.selectionStart !== null && input.selectionStart !== undefined) ? input.selectionStart : input.value.length;
      const end = (input.selectionEnd !== null && input.selectionEnd !== undefined) ? input.selectionEnd : input.value.length;
      const val = input.value;
      input.value = val.substring(0, start) + text + val.substring(end);
      const newPos = start + text.length;
      input.focus();
      input.setSelectionRange(newPos, newPos);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (editorMode === 'suneditor' && sunEditorInstance) {
      sunEditorInstance.insertHTML(text);
    } else if (legacyWysiwygEditor) {
      legacyWysiwygEditor.focus();
      document.execCommand('insertText', false, text);
    } else if (fullWysiwygEditor) {
      fullWysiwygEditor.focus();
      document.execCommand('insertText', false, text);
    }
    updateSimulator();
  }

  async function openVariablesModal() {
    if (typeof mondayService === 'undefined' || !variablesModal) return;

    if (varMondayColumnSelect) {
      varMondayColumnSelect.innerHTML = '<option value="">-- Selecciona una columna del tablero --</option>';
      try {
        const columns = await mondayService.getBoardColumns();
        columns.forEach(col => {
          const opt = document.createElement('option');
          opt.value = col.title;
          opt.textContent = col.title + ' (' + col.type + ')';
          varMondayColumnSelect.appendChild(opt);
        });

        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = '✏️ Otra columna personalizada...';
        varMondayColumnSelect.appendChild(customOpt);
      } catch (err) {
        console.warn('Error al cargar columnas para el selector:', err);
      }
    }

    resetVarForm();
    await renderVariablesTable();
    variablesModal.style.display = 'flex';
  }

  function closeVariablesModal() {
    if (!variablesModal) return;
    variablesModal.style.display = 'none';
    resetVarForm();
    loadAndRenderVariableChips();
  }

  async function renderVariablesTable() {
    if (typeof mondayService === 'undefined' || !varTableBody) return;

    const vars = await mondayService.getVariableDefinitions();
    varTableBody.innerHTML = '';
    if (varCountBadge) varCountBadge.textContent = vars.length + ' variables';

    if (vars.length === 0) {
      varTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">
            No hay variables configuradas. Crea una nueva variable arriba.
          </td>
        </tr>
      `;
      return;
    }

    vars.forEach(v => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';

      let sourceHtml = '';
      if (v.source === 'monday') {
        sourceHtml = '<span style="color: #166534; font-weight: 600;">📊 Monday:</span> <span style="background: #e2e8f0; padding: 1px 6px; border-radius: 4px;">' + escapeHtml(v.columnTitle || v.key) + '</span>';
      } else if (v.source === 'system_date') {
        sourceHtml = '<span style="color: #0369a1;">📅 Fecha Actual (Sistema)</span>';
      } else if (v.source === 'system_user') {
        sourceHtml = '<span style="color: #7c3aed;">👤 Remitente</span>';
      } else {
        sourceHtml = '<span style="color: #475569;">✍️ Relleno Manual</span>';
      }

      tr.innerHTML = `
        <td style="padding: 8px 12px; font-family: monospace; font-weight: bold; color: #2563eb;">{{` + escapeHtml(v.key) + `}}</td>
        <td style="padding: 8px 12px; color: #334155;">` + escapeHtml(v.label || v.key) + `</td>
        <td style="padding: 8px 12px;">` + sourceHtml + `</td>
        <td style="padding: 8px 12px; text-align: right;">
          <button type="button" class="btn-var-action edit-btn" style="background: none; border: none; cursor: pointer; color: #2563eb; font-size: 13px; margin-right: 6px;" title="Editar">✏️</button>
          <button type="button" class="btn-var-action del-btn" style="background: none; border: none; cursor: pointer; color: #dc2626; font-size: 13px;" title="Eliminar">🗑️</button>
        </td>
      `;

      tr.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        loadVariableIntoForm(v);
      });

      tr.querySelector('.del-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        const confirmed = await showConfirmDialog({
          title: '¿Eliminar variable dinámica?',
          message: '¿Deseas eliminar permanentemente la variable {{' + v.key + '}}?\n\nLas plantillas que contengan esta variable ya no la autocompletarán.',
          confirmText: 'Eliminar Variable',
          danger: true
        });

        if (confirmed) {
          try {
            await mondayService.deleteVariable(v.id || v.key);
            await renderVariablesTable();
            await loadAndRenderVariableChips();
            showToast('🗑️ Variable {{' + v.key + '}} eliminada correctamente.');
          } catch (err) {
            showToast('❌ Error al eliminar variable: ' + err.message);
          }
        }
      });

      varTableBody.appendChild(tr);
    });
  }

  function loadVariableIntoForm(v) {
    if (varFormTitle) varFormTitle.textContent = '✏️ Editando Variable: {{' + v.key + '}}';
    if (varEditId) varEditId.value = v.id || v.key;
    if (varInputKey) {
      varInputKey.value = v.key;
      varInputKey.disabled = true;
    }
    if (varInputLabel) varInputLabel.value = v.label || '';
    if (varSourceSelect) varSourceSelect.value = v.source || 'monday';

    handleSourceChange();
    if (v.source === 'monday' && varMondayColumnSelect) {
      let found = false;
      for (let i = 0; i < varMondayColumnSelect.options.length; i++) {
        if (varMondayColumnSelect.options[i].value === v.columnTitle) {
          varMondayColumnSelect.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found && v.columnTitle) {
        varMondayColumnSelect.value = '__custom__';
        if (varCustomColumnInput) {
          varCustomColumnInput.style.display = 'block';
          varCustomColumnInput.value = v.columnTitle;
        }
      } else if (varCustomColumnInput) {
        varCustomColumnInput.style.display = 'none';
      }
    }

    if (btnCancelVarEdit) btnCancelVarEdit.style.display = 'inline-block';
    if (btnSaveVarItem) btnSaveVarItem.textContent = 'Actualizar Variable';
    if (varInputLabel) varInputLabel.focus();
  }

  function resetVarForm() {
    if (varFormTitle) varFormTitle.textContent = '✨ Crear Nueva Variable Dinámica';
    if (varEditId) varEditId.value = '';
    if (varInputKey) {
      varInputKey.value = '';
      varInputKey.disabled = false;
    }
    if (varInputLabel) varInputLabel.value = '';
    if (varSourceSelect) varSourceSelect.value = 'monday';
    if (varMondayColumnSelect) varMondayColumnSelect.value = '';
    if (varCustomColumnInput) {
      varCustomColumnInput.value = '';
      varCustomColumnInput.style.display = 'none';
    }
    if (btnCancelVarEdit) btnCancelVarEdit.style.display = 'none';
    if (btnSaveVarItem) btnSaveVarItem.textContent = '+ Guardar Variable';
    handleSourceChange();
  }

  function handleSourceChange() {
    if (!varSourceSelect || !varMondayColumnGroup) return;
    if (varSourceSelect.value === 'monday') {
      varMondayColumnGroup.style.display = 'block';
    } else {
      varMondayColumnGroup.style.display = 'none';
    }
  }

  async function openCategoriesModal() {
    if (!categoriesModal) return;
    resetCategoryForm();
    await loadCategoriesData();
    renderCategoriesTable();
    categoriesModal.style.display = 'flex';
    if (categoryInputName) setTimeout(() => categoryInputName.focus(), 50);
  }

  function closeCategoriesModal() {
    if (!categoriesModal) return;
    categoriesModal.style.display = 'none';
    resetCategoryForm();
  }

  function resetCategoryForm() {
    if (categoryEditOldName) categoryEditOldName.value = '';
    if (categoryInputName) categoryInputName.value = '';
    if (categoryFormTitle) categoryFormTitle.textContent = '✨ Crear Nueva Etiqueta';
    if (btnSaveCategoryItem) btnSaveCategoryItem.textContent = '+ Guardar Etiqueta';
    if (btnCancelCategoryEdit) btnCancelCategoryEdit.style.display = 'none';
  }

  function renderCategoriesTable() {
    if (!categoriesTableBody) return;
    categoriesTableBody.innerHTML = '';

    if (categoryCountBadge) {
      categoryCountBadge.textContent = managedCategories.length + ' etiqueta' + (managedCategories.length === 1 ? '' : 's');
    }

    if (managedCategories.length === 0) {
      categoriesTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 24px; color: #64748b;">
            No hay etiquetas creadas todavía.
          </td>
        </tr>
      `;
      return;
    }

    managedCategories.forEach(cat => {
      const count = allTemplates.filter(t => (t.category || 'General').toLowerCase() === cat.toLowerCase()).length;
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f1f5f9';

      tr.innerHTML = `
        <td style="padding: 10px 14px; font-weight: 600; color: #1e293b;">
          <span style="display: inline-block; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">` + escapeHtml(cat) + `</span>
        </td>
        <td style="padding: 10px 14px; text-align: center; color: #64748b;">
          <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">` + count + ` plantilla` + (count === 1 ? '' : 's') + `</span>
        </td>
        <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
          <button type="button" class="btn-edit-cat" style="background: none; border: 1px solid #cbd5e1; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; margin-right: 4px; color: #0284c7;">✏️ Renombrar</button>
          <button type="button" class="btn-delete-cat" style="background: none; border: 1px solid #fecaca; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; color: #dc2626;">🗑️ Borrar</button>
        </td>
      `;

      tr.querySelector('.btn-edit-cat').addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (categoryEditOldName) categoryEditOldName.value = cat;
        if (categoryInputName) categoryInputName.value = cat;
        if (categoryFormTitle) categoryFormTitle.textContent = '✏️ Renombrar Etiqueta "' + cat + '"';
        if (btnSaveCategoryItem) btnSaveCategoryItem.textContent = 'Actualizar Etiqueta';
        if (btnCancelCategoryEdit) btnCancelCategoryEdit.style.display = 'inline-block';
        if (categoryInputName) {
          categoryInputName.focus();
          categoryInputName.select();
        }
      });

      tr.querySelector('.btn-delete-cat').addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (cat.trim().toLowerCase() === 'general') {
          showToast('⚠️ La etiqueta "General" es la predeterminada del sistema y no puede eliminarse.');
          return;
        }

        const promptMsg = count > 0 
          ? '¿Estás seguro de que deseas eliminar la etiqueta "' + cat + '"?\n\n⚠️ ' + count + ' plantilla(s) asociada(s) se reasignarán automáticamente a la etiqueta "General".'
          : '¿Estás seguro de que deseas eliminar la etiqueta "' + cat + '"?';

        const confirmed = await showConfirmDialog({
          title: '¿Eliminar etiqueta?',
          message: promptMsg,
          confirmText: 'Eliminar Etiqueta',
          danger: true
        });

        if (confirmed) {
          try {
            await firebaseService.deleteCategory(cat, 'General');
            await loadTemplatesData(true);
            await loadCategoriesData();
            renderCategoriesTable();
            showToast('🏷️ Etiqueta "' + cat + '" eliminada.');
          } catch (err) {
            showToast('❌ Error al eliminar etiqueta: ' + err.message);
          }
        }
      });

      categoriesTableBody.appendChild(tr);
    });
  }

  function openCtaModal() {
    if (!ctaButtonModal) return;

    if (editorMode === 'suneditor' && sunEditorInstance) {
      const selectedText = (sunEditorInstance.getSelection()?.toString() || '').trim();
      if (selectedText && ctaInputText) {
        ctaInputText.value = selectedText;
      }
      savedEditorRange = null;
    } else {
      const sel = window.getSelection();
      const editorTarget = legacyWysiwygEditor || fullWysiwygEditor;
      if (sel && sel.rangeCount > 0 && editorTarget) {
        const range = sel.getRangeAt(0);
        if (editorTarget.contains(range.commonAncestorContainer)) {
          savedEditorRange = range.cloneRange();
        } else {
          savedEditorRange = null;
        }
      } else {
        savedEditorRange = null;
      }

      if (savedEditorRange && !savedEditorRange.collapsed && ctaInputText) {
        const selectedText = savedEditorRange.toString().trim();
        if (selectedText) {
          ctaInputText.value = selectedText;
        }
      }
    }

    updateCtaPreview();
    ctaButtonModal.style.display = 'flex';
    if (ctaInputText) setTimeout(() => ctaInputText.focus(), 50);
  }

  function closeCtaModal() {
    if (!ctaButtonModal) return;
    ctaButtonModal.style.display = 'none';
  }

  function updateCtaPreview() {
    if (!ctaPreviewButton || !ctaPreviewContainer) return;

    const text = (ctaInputText ? ctaInputText.value.trim() : '') || 'Haz clic aquí para agendar tu primera sesión';
    const bgColor = selectedCtaBgColor || '#2563eb';
    const textColor = ctaTextColorSelect ? ctaTextColorSelect.value : '#ffffff';
    const radius = ctaRadiusSelect ? ctaRadiusSelect.value : '8px';
    const align = ctaAlignSelect ? ctaAlignSelect.value : 'center';

    ctaPreviewButton.textContent = text;
    ctaPreviewButton.style.backgroundColor = bgColor;
    ctaPreviewButton.style.color = textColor;
    ctaPreviewButton.style.borderRadius = radius;
    ctaPreviewContainer.style.textAlign = align;
  }

  function insertCtaButton() {
    const text = ctaInputText ? ctaInputText.value.trim() : '';
    let url = ctaInputUrl ? ctaInputUrl.value.trim() : '';

    if (!text) {
      showToast('⚠️ Por favor ingresa el texto del botón.');
      if (ctaInputText) ctaInputText.focus();
      return;
    }

    if (!url || url === 'https://' || url === 'http://') {
      showToast('⚠️ Por favor ingresa la URL de destino.');
      if (ctaInputUrl) ctaInputUrl.focus();
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('mailto:') && !url.startsWith('tel:') && !url.startsWith('{{') && !url.startsWith('%7B%7B')) {
      url = 'https://' + url;
    }

    const bgColor = selectedCtaBgColor || '#2563eb';
    const textColor = ctaTextColorSelect ? ctaTextColorSelect.value : '#ffffff';
    const radius = ctaRadiusSelect ? ctaRadiusSelect.value : '8px';
    const align = ctaAlignSelect ? ctaAlignSelect.value : 'center';

    let marginStyle = '18px auto';
    if (align === 'left') marginStyle = '18px auto 18px 0';
    else if (align === 'right') marginStyle = '18px 0 18px auto';

    const btnHtml = `
      <table border="0" cellpadding="0" cellspacing="0" style="margin: ` + marginStyle + `; text-align: ` + align + `; width: auto;">
        <tr>
          <td align="` + align + `" style="border-radius: ` + radius + `; background-color: ` + bgColor + `;">
            <a href="` + escapeHtml(url) + `" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ` + textColor + `; text-decoration: none; border-radius: ` + radius + `; padding: 12px 26px; border: 1px solid ` + bgColor + `; display: inline-block; font-weight: 600; line-height: 1.2; text-align: center;">
              ` + escapeHtml(text) + `
            </a>
          </td>
        </tr>
      </table>
      <p><br></p>
    `;

    insertEditorHtml(btnHtml);
    updateSimulator();
    closeCtaModal();
    showToast('🔘 Botón interactivo insertado.');
  }

  function setupEventListeners() {
    if (btnToggleEditorMode) btnToggleEditorMode.addEventListener('click', toggleEditorMode);
    if (btnNewTemplate) btnNewTemplate.addEventListener('click', createNewTemplate);
    if (btnSaveTemplate) btnSaveTemplate.addEventListener('click', saveCurrentTemplate);
    if (btnDuplicateCurrentTemplate) btnDuplicateCurrentTemplate.addEventListener('click', duplicateCurrentTemplate);
    if (btnDeleteCurrentTemplate) btnDeleteCurrentTemplate.addEventListener('click', deleteCurrentTemplate);
    if (dashSearchInput) dashSearchInput.addEventListener('input', renderTemplatesList);
    if (btnRefreshList) btnRefreshList.addEventListener('click', () => loadTemplatesData(true));

    modeTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        modeTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const view = btn.dataset.view;
        if (view === 'editor') {
          if (editorView) editorView.style.display = 'block';
          if (previewView) previewView.style.display = 'none';
        } else {
          updateSimulator();
          if (editorView) editorView.style.display = 'none';
          if (previewView) previewView.style.display = 'block';
        }
      });
    });

    if (btnOpenVarManager) btnOpenVarManager.addEventListener('click', openVariablesModal);
    if (btnDashManageVars) btnDashManageVars.addEventListener('click', openVariablesModal);
    if (btnCloseVariablesModal) btnCloseVariablesModal.addEventListener('click', closeVariablesModal);
    if (btnCloseVariablesFooter) btnCloseVariablesFooter.addEventListener('click', closeVariablesModal);
    if (varSourceSelect) varSourceSelect.addEventListener('change', handleSourceChange);
    if (btnCancelVarEdit) btnCancelVarEdit.addEventListener('click', resetVarForm);

    if (varMondayColumnSelect) {
      varMondayColumnSelect.addEventListener('change', () => {
        if (varMondayColumnSelect.value === '__custom__' && varCustomColumnInput) {
          varCustomColumnInput.style.display = 'block';
          varCustomColumnInput.focus();
        } else if (varCustomColumnInput) {
          varCustomColumnInput.style.display = 'none';
        }
      });
    }

    if (btnSaveVarItem) {
      btnSaveVarItem.addEventListener('click', async () => {
        const rawKey = varInputKey ? varInputKey.value.trim() : '';
        if (!rawKey) {
          showToast('⚠️ Ingresa un nombre o clave para la variable.');
          if (varInputKey) varInputKey.focus();
          return;
        }

        const cleanKey = rawKey.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
        const label = (varInputLabel ? varInputLabel.value.trim() : '') || cleanKey;
        const source = varSourceSelect ? varSourceSelect.value : 'monday';
        let columnTitle = '';

        if (source === 'monday') {
          if (varMondayColumnSelect && varMondayColumnSelect.value === '__custom__') {
            columnTitle = varCustomColumnInput ? varCustomColumnInput.value.trim() : '';
          } else if (varMondayColumnSelect) {
            columnTitle = varMondayColumnSelect.value.trim();
          }

          if (!columnTitle) {
            showToast('⚠️ Selecciona o escribe la columna de Monday.');
            if (varMondayColumnSelect) varMondayColumnSelect.focus();
            return;
          }
        }

        const varData = {
          id: (varEditId ? varEditId.value : '') || ('var_' + cleanKey),
          key: cleanKey,
          label: label,
          source: source,
          columnTitle: columnTitle
        };

        await mondayService.saveVariable(varData);
        resetVarForm();
        await renderVariablesTable();
        await loadAndRenderVariableChips();
        showToast('🏷️ Variable {{' + cleanKey + '}} guardada.');
      });
    }

    if (variablesModal) {
      variablesModal.addEventListener('click', (e) => {
        if (e.target === variablesModal) closeVariablesModal();
      });
    }

    if (btnOpenCategoryManager) btnOpenCategoryManager.addEventListener('click', openCategoriesModal);
    if (btnSidebarManageCategories) btnSidebarManageCategories.addEventListener('click', openCategoriesModal);
    if (btnQuickManageCategories) btnQuickManageCategories.addEventListener('click', openCategoriesModal);
    if (btnCloseCategoriesModal) btnCloseCategoriesModal.addEventListener('click', closeCategoriesModal);
    if (btnCloseCategoriesFooter) btnCloseCategoriesFooter.addEventListener('click', closeCategoriesModal);
    if (btnCancelCategoryEdit) btnCancelCategoryEdit.addEventListener('click', resetCategoryForm);

    if (btnSaveCategoryItem) {
      btnSaveCategoryItem.addEventListener('click', async () => {
        const name = categoryInputName ? categoryInputName.value.trim() : '';
        if (!name) {
          showToast('⚠️ Ingresa un nombre para la etiqueta.');
          if (categoryInputName) categoryInputName.focus();
          return;
        }

        const oldName = categoryEditOldName ? categoryEditOldName.value.trim() : '';
        if (oldName) {
          await firebaseService.renameCategory(oldName, name);
          showToast('🏷️ Etiqueta renombrada a "' + name + '".');
        } else {
          await firebaseService.saveCategory(name);
          showToast('🏷️ Nueva etiqueta "' + name + '" creada.');
        }

        resetCategoryForm();
        await loadTemplatesData(true);
        await loadCategoriesData();
        renderCategoriesTable();
      });
    }

    if (categoriesModal) {
      categoriesModal.addEventListener('click', (e) => {
        if (e.target === categoriesModal) closeCategoriesModal();
      });
    }

    const colorPresets = document.querySelectorAll('.cta-color-preset');
    colorPresets.forEach(preset => {
      preset.addEventListener('click', () => {
        colorPresets.forEach(p => {
          p.classList.remove('active');
          p.style.border = '1px solid #cbd5e1';
        });
        preset.classList.add('active');
        preset.style.border = '2px solid #0f172a';
        selectedCtaBgColor = preset.dataset.color;
        if (ctaCustomBgColor) ctaCustomBgColor.value = selectedCtaBgColor;
        updateCtaPreview();
      });
    });

    if (ctaCustomBgColor) {
      ctaCustomBgColor.addEventListener('input', (e) => {
        selectedCtaBgColor = e.target.value;
        colorPresets.forEach(p => {
          p.classList.remove('active');
          p.style.border = '1px solid #cbd5e1';
        });
        updateCtaPreview();
      });
    }

    if (ctaInputText) ctaInputText.addEventListener('input', updateCtaPreview);
    if (ctaInputUrl) ctaInputUrl.addEventListener('input', updateCtaPreview);
    if (btnCtaPresetDrive) {
      btnCtaPresetDrive.addEventListener('click', () => {
        if (ctaInputUrl) ctaInputUrl.value = '{{link_carpeta}}';
        if (ctaInputText && (!ctaInputText.value || ctaInputText.value === 'Haz clic aquí para agendar tu primera sesión')) {
          ctaInputText.value = '📁 Acceder a Carpeta de Grabaciones y Archivos';
        }
        updateCtaPreview();
      });
    }
    if (ctaRadiusSelect) ctaRadiusSelect.addEventListener('change', updateCtaPreview);
    if (ctaAlignSelect) ctaAlignSelect.addEventListener('change', updateCtaPreview);
    if (ctaTextColorSelect) ctaTextColorSelect.addEventListener('change', updateCtaPreview);
    if (btnInsertCtaFinal) btnInsertCtaFinal.addEventListener('click', insertCtaButton);
    if (btnCloseCtaModal) btnCloseCtaModal.addEventListener('click', closeCtaModal);
    if (btnCancelCtaModal) btnCancelCtaModal.addEventListener('click', closeCtaModal);
    if (ctaButtonModal) {
      ctaButtonModal.addEventListener('click', (e) => {
        if (e.target === ctaButtonModal) closeCtaModal();
      });
    }

    if (btnTplUploadHeader) btnTplUploadHeader.addEventListener('click', () => tplHeaderFileInput?.click());
    if (tplHeaderFileInput) tplHeaderFileInput.addEventListener('change', (e) => handleTplBannerUpload(e.target.files[0], 'header'));
    if (btnTplClearHeader) btnTplClearHeader.addEventListener('click', () => {
      if (tplHeaderAssetInput) tplHeaderAssetInput.value = '';
      if (tplHeaderUploadStatus) tplHeaderUploadStatus.textContent = '';
      updateTplBannerPreviews();
      updateSimulator();
    });
    if (tplHeaderAssetInput) tplHeaderAssetInput.addEventListener('input', () => {
      updateTplBannerPreviews();
      updateSimulator();
    });

    if (btnTplUploadFooter) btnTplUploadFooter.addEventListener('click', () => tplFooterFileInput?.click());
    if (tplFooterFileInput) tplFooterFileInput.addEventListener('change', (e) => handleTplBannerUpload(e.target.files[0], 'footer'));
    if (btnTplClearFooter) btnTplClearFooter.addEventListener('click', () => {
      if (tplFooterAssetInput) tplFooterAssetInput.value = '';
      if (tplFooterUploadStatus) tplFooterUploadStatus.textContent = '';
      updateTplBannerPreviews();
      updateSimulator();
    });
    if (tplFooterAssetInput) tplFooterAssetInput.addEventListener('input', () => {
      updateTplBannerPreviews();
      updateSimulator();
    });

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'TEMPLATES_UPDATED' || message.action === 'RELOAD_TEMPLATES') {
          loadTemplatesData(false);
        }
      });
    }
  }

  return {
    refresh: () => loadTemplatesData(true),
    selectTemplate: (id) => selectTemplate(id)
  };
}
