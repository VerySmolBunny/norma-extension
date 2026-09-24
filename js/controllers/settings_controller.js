/**
 * Norma Hub - Controlador de Ajustes y Configuración
 */

import { getConfig, saveConfig } from '../core/config.js';
import { extractFolderId, extractFolderIds, showToast } from '../core/ui_helpers.js';
import { firebaseService } from '../services/firebase_service.js';
import { GasService } from '../services/gas_service.js';

const ALL_SETTINGS_INPUT_IDS = [
  // Conexiones Principales & IA
  'inputGasUrl',
  'inputMondayApiKey',
  'inputMondayKey',
  'inputCoeName',
  'inputCoeEmail',
  'inputBoardId',
  'inputGeminiApiKey',
  'selectGeminiModel',
  // Rutas de Google Drive
  'inputRootDriveFolder',
  'inputMeetRecordingsFolder',
  'inputSlidesKickoffTemplate',
  // Plantillas de Correo & Firebase
  'dashCfgProjectId',
  'dashCfgApiKey',
  'dashCfgCurrentUser',
  'dashCfgSenderName'
];

let isGlobalLocked = true;

/**
 * Controla el bloqueo/desbloqueo global de TODOS los campos de Ajustes
 */
export function setGlobalLock(locked) {
  isGlobalLocked = locked;

  ALL_SETTINGS_INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = locked;
    }
  });

  // Dashboard Global Badge & Toggle Button
  const badge = document.getElementById('globalLockStatusBadge');
  const icon = document.getElementById('globalLockIcon');
  const text = document.getElementById('globalLockText');

  if (badge) {
    if (locked) {
      badge.innerHTML = '🔒 Bloqueado';
      badge.style.background = '#f1f5f9';
      badge.style.color = '#64748b';
      badge.style.borderColor = '#e2e8f0';
    } else {
      badge.innerHTML = '🔓 Edición Habilitada';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
      badge.style.borderColor = '#fcd34d';
    }
  }

  if (icon && text) {
    if (locked) {
      icon.textContent = '🔓';
      text.textContent = 'Desbloquear para editar';
    } else {
      icon.textContent = '🔒';
      text.textContent = 'Volver a bloquear';
    }
  }

  // Sidepanel controls
  const spBadge = document.getElementById('sidepanelLockBadge');
  const spText = document.getElementById('textToggleLockSidepanel');
  if (spBadge) {
    if (locked) {
      spBadge.textContent = '🔒 Bloqueado';
      spBadge.style.background = '#f1f5f9';
      spBadge.style.color = '#64748b';
      spBadge.style.borderColor = '#e2e8f0';
    } else {
      spBadge.textContent = '🔓 Edición Habilitada';
      spBadge.style.background = '#fef3c7';
      spBadge.style.color = '#92400e';
      spBadge.style.borderColor = '#fcd34d';
    }
  }
  if (spText) {
    spText.textContent = locked ? '🔓 Desbloquear' : '🔒 Bloquear';
  }
}

// Aliases para compatibilidad
export const setConnectionsLock = setGlobalLock;
export const setFirebaseLock = setGlobalLock;

/**
 * Resuelve un ID o URL de asset a una URL utilizable para previsualización directa
 */
export function getBannerImageUrl(assetStr) {
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

export function initSettingsController() {
  loadSavedSettings();

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', handleSaveSettings);
  }

  // Botones para Autorizar Permisos en Google (Dashboard y Sidepanel)
  const handleAuthGas = async () => {
    const config = await getConfig();
    const inputGasUrl = document.getElementById('inputGasUrl');
    let gasUrl = (inputGasUrl && inputGasUrl.value.trim()) || config.gasUrl || '';

    if (!gasUrl) {
      showToast('⚠️ Por favor ingresa primero la URL de Google Apps Script');
      return;
    }

    if (gasUrl.includes('/edit') || (!gasUrl.includes('/exec') && !gasUrl.includes('/macros/s/'))) {
      alert('⚠️ ATENCIÓN: La URL guardada en Ajustes es del editor de código (termina en /edit), no de la aplicación web.\n\nPara obtener la URL correcta:\n1. En tu ventana de Apps Script, haz clic arriba a la derecha en el botón azul "Implementar" > "Administrar implementaciones".\n2. En la sección "Aplicación web", copia la "URL" (termina en /exec).\n3. Desbloquea Ajustes, pega esa URL en el campo y pulsa "Guardar Ajustes".\n4. Luego pulsa nuevamente este botón para autorizar los permisos.');
      return;
    }

    // Normalizar la URL (remover /a/macros/domain si existe para evitar restricciones)
    let cleanUrl = gasUrl.replace(/\/+$/, '').replace(/\/a\/macros\/[^/]+\/s\//i, '/macros/s/');
    const authUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=auth`;

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: authUrl });
    } else {
      window.open(authUrl, '_blank');
    }

    showToast('🚀 Abriendo página de autorización de Google...');
  };

  const btnAuthGas = document.getElementById('btnAuthGas');
  if (btnAuthGas) {
    btnAuthGas.addEventListener('click', handleAuthGas);
  }

  const btnAuthGasSidepanel = document.getElementById('btnAuthGasSidepanel');
  if (btnAuthGasSidepanel) {
    btnAuthGasSidepanel.addEventListener('click', handleAuthGas);
  }

  // Botón maestro de bloqueo/desbloqueo global en Dashboard
  const btnToggleGlobal = document.getElementById('btnToggleGlobalLock');
  if (btnToggleGlobal) {
    btnToggleGlobal.addEventListener('click', () => {
      setGlobalLock(!isGlobalLocked);
      if (!isGlobalLocked) {
        showToast('🔓 Toda la configuración ha sido desbloqueada para edición');
        const firstInput = document.getElementById('inputGasUrl');
        if (firstInput) firstInput.focus();
      } else {
        showToast('🔒 Toda la configuración ha sido bloqueada');
      }
    });
  }

  // Botón de bloqueo/desbloqueo en Sidepanel
  const btnToggleLockSidepanel = document.getElementById('btnToggleLockSidepanel');
  if (btnToggleLockSidepanel) {
    btnToggleLockSidepanel.addEventListener('click', () => {
      setGlobalLock(!isGlobalLocked);
      if (!isGlobalLocked) {
        showToast('🔓 Configuración desbloqueada para edición');
        const firstInput = document.getElementById('inputGasUrl');
        if (firstInput) firstInput.focus();
      } else {
        showToast('🔒 Configuración bloqueada');
      }
    });
  }

  // Soporte para modal de settings en Sidepanel
  const btnSettings = document.getElementById('btnSettings');
  const modalSettings = document.getElementById('modalSettings') || document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');

  if (btnSettings && modalSettings) {
    btnSettings.addEventListener('click', () => {
      loadSavedSettings();
      setGlobalLock(true);
      modalSettings.classList.add('active');
    });
  }

  if (btnCloseSettings && modalSettings) {
    btnCloseSettings.addEventListener('click', () => modalSettings.classList.remove('active'));
  }

  if (btnCancelSettings && modalSettings) {
    btnCancelSettings.addEventListener('click', () => modalSettings.classList.remove('active'));
  }
}

export async function loadSavedSettings() {
  const config = await getConfig();

  const inputGasUrl = document.getElementById('inputGasUrl');
  const inputMondayKey = document.getElementById('inputMondayApiKey') || document.getElementById('inputMondayKey');
  const inputCoeName = document.getElementById('inputCoeName');
  const inputCoeEmail = document.getElementById('inputCoeEmail');
  const inputBoardId = document.getElementById('inputBoardId');
  const inputDriveFolderId = document.getElementById('inputRootDriveFolder') || document.getElementById('inputDriveFolderId');
  const inputMeetRecordingsId = document.getElementById('inputMeetRecordingsFolder') || document.getElementById('inputMeetRecordingsId');
  const inputSlidesKickoffTemplate = document.getElementById('inputSlidesKickoffTemplate');
  const inputGeminiApiKey = document.getElementById('inputGeminiApiKey');
  const selectGeminiModel = document.getElementById('selectGeminiModel');

  if (inputGasUrl) inputGasUrl.value = config.gasUrl || '';
  if (inputMondayKey) inputMondayKey.value = config.mondayApiKey || '';
  if (inputCoeName) inputCoeName.value = config.coeName || '';
  if (inputCoeEmail) inputCoeEmail.value = config.coeEmail || '';
  if (inputBoardId) inputBoardId.value = config.boardId || '';
  if (inputDriveFolderId) inputDriveFolderId.value = config.rootDriveFolderId || '';
  if (inputMeetRecordingsId) inputMeetRecordingsId.value = config.meetRecordingsFolderId || '';
  if (inputSlidesKickoffTemplate) inputSlidesKickoffTemplate.value = config.slidesKickoffTemplateId || '';
  if (inputGeminiApiKey) inputGeminiApiKey.value = config.geminiApiKey || '';
  if (selectGeminiModel) selectGeminiModel.value = config.geminiModel || 'gemini-3.7-flash';

  // Auto-detectar la cuenta Google de la sesión activa de Chrome con chrome.identity
  if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getProfileUserInfo) {
    try {
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
        if (userInfo && userInfo.email) {
          if (inputCoeEmail && !inputCoeEmail.value) {
            inputCoeEmail.value = userInfo.email;
            saveConfig({ coeEmail: userInfo.email }).catch(() => {});
          }
          const badge = document.getElementById('googleAccountBadge');
          if (badge) {
            badge.textContent = `👤 Sesión Chrome: ${userInfo.email}`;
            badge.style.display = 'inline-block';
          }
        }
      });
    } catch (e) {
      console.warn('Error obteniendo perfil de Chrome identity:', e);
    }
  }

  // Verificar cuenta conectada en Google Apps Script
  if (config.gasUrl) {
    GasService.getConnectedAccount(config.gasUrl).then(accountInfo => {
      const badge = document.getElementById('gasConnectedAccountBadge');
      if (badge && accountInfo) {
        if (accountInfo.activeUser) {
          badge.innerHTML = `🟢 Google Apps Script ejecutando directamente como: <strong>${accountInfo.activeUser}</strong>`;
          badge.style.display = 'block';
          badge.style.borderColor = '#10b981';
          badge.style.background = '#ecfdf5';
          badge.style.color = '#065f46';
        } else if (accountInfo.effectiveUser) {
          badge.innerHTML = `⚠️ Google Apps Script ejecutando bajo la cuenta del creador: <strong>${accountInfo.effectiveUser}</strong>.<br><small style="font-size:11px;">Para que cada consultor use su propio correo/calendario automáticamente, la Web App debe desplegarse como "El usuario que accede a la aplicación web".</small>`;
          badge.style.display = 'block';
          badge.style.borderColor = '#f59e0b';
          badge.style.background = '#fffbeb';
          badge.style.color = '#92400e';
        }
      }
    }).catch(() => {});
  }

  // Mantener todos los campos bloqueados inicialmente
  setGlobalLock(true);

  // Cargar configuración de Firebase / Plantillas
  try {
    const fbConfig = await firebaseService.getConfig();
    const inputFbProjectId = document.getElementById('dashCfgProjectId');
    const inputFbApiKey = document.getElementById('dashCfgApiKey');
    const inputFbCurrentUser = document.getElementById('dashCfgCurrentUser');
    const inputFbSenderName = document.getElementById('dashCfgSenderName');

    if (inputFbProjectId) inputFbProjectId.value = fbConfig.projectId || '';
    if (inputFbApiKey) inputFbApiKey.value = fbConfig.apiKey || '';
    if (inputFbCurrentUser) inputFbCurrentUser.value = fbConfig.currentUserEmail || '';
    if (inputFbSenderName) inputFbSenderName.value = fbConfig.senderName || '';
  } catch (err) {
    console.warn('Error al cargar config de Firebase:', err);
  }

  updateDriveHeaderLinks(config);
}

export async function handleSaveSettings() {
  const currentConfig = await getConfig();

  const inputGasUrl = document.getElementById('inputGasUrl');
  const inputMondayKey = document.getElementById('inputMondayApiKey') || document.getElementById('inputMondayKey');
  const inputCoeName = document.getElementById('inputCoeName');
  const inputCoeEmail = document.getElementById('inputCoeEmail');
  const inputBoardId = document.getElementById('inputBoardId');
  const inputDriveFolderId = document.getElementById('inputRootDriveFolder') || document.getElementById('inputDriveFolderId');
  const inputMeetRecordingsId = document.getElementById('inputMeetRecordingsFolder') || document.getElementById('inputMeetRecordingsId');
  const inputSlidesKickoffTemplate = document.getElementById('inputSlidesKickoffTemplate');
  const inputGeminiApiKey = document.getElementById('inputGeminiApiKey');
  const selectGeminiModel = document.getElementById('selectGeminiModel');

  const newConfig = {
    ...currentConfig,
    gasUrl: inputGasUrl ? inputGasUrl.value.trim() : (currentConfig.gasUrl || ''),
    mondayApiKey: inputMondayKey ? inputMondayKey.value.trim() : (currentConfig.mondayApiKey || ''),
    coeName: inputCoeName ? inputCoeName.value.trim() : (currentConfig.coeName || ''),
    coeEmail: inputCoeEmail ? inputCoeEmail.value.trim() : (currentConfig.coeEmail || ''),
    boardId: inputBoardId ? inputBoardId.value.trim() : (currentConfig.boardId || ''),
    rootDriveFolderId: inputDriveFolderId ? inputDriveFolderId.value.trim() : (currentConfig.rootDriveFolderId || ''),
    meetRecordingsFolderId: inputMeetRecordingsId ? inputMeetRecordingsId.value.trim() : (currentConfig.meetRecordingsFolderId || ''),
    slidesKickoffTemplateId: inputSlidesKickoffTemplate ? inputSlidesKickoffTemplate.value.trim() : (currentConfig.slidesKickoffTemplateId || ''),
    geminiApiKey: inputGeminiApiKey ? inputGeminiApiKey.value.trim() : (currentConfig.geminiApiKey || ''),
    geminiModel: selectGeminiModel ? selectGeminiModel.value : (currentConfig.geminiModel || 'gemini-3.7-flash')
  };

  await saveConfig(newConfig);

  if (newConfig.gasUrl && newConfig.gasUrl.includes('/edit')) {
    alert('⚠️ AVISO: Has guardado una URL que termina en /edit (del editor de código de Apps Script).\n\nPara que la sincronización funcione, debes ingresar la URL de la aplicación web que termina en /exec (obtenida desde "Implementar" > "Administrar implementaciones" en Apps Script).');
  }

  // Guardar configuración de Firebase / Plantillas
  try {
    const inputFbProjectId = document.getElementById('dashCfgProjectId');
    const inputFbApiKey = document.getElementById('dashCfgApiKey');
    const inputFbCurrentUser = document.getElementById('dashCfgCurrentUser');
    const inputFbSenderName = document.getElementById('dashCfgSenderName');

    if (inputFbProjectId) {
      const fbConfig = {
        projectId: inputFbProjectId.value.trim(),
        apiKey: inputFbApiKey ? inputFbApiKey.value.trim() : '',
        currentUserEmail: inputFbCurrentUser ? inputFbCurrentUser.value.trim() : '',
        senderName: inputFbSenderName ? inputFbSenderName.value.trim() : ''
      };

      await firebaseService.saveConfig(fbConfig);
    }
  } catch (err) {
    console.warn('Error al guardar config de Firebase:', err);
  }

  updateDriveHeaderLinks(newConfig);

  // Volver a bloquear toda la configuración tras guardar
  setGlobalLock(true);

  const modalSettings = document.getElementById('modalSettings') || document.getElementById('settingsModal');
  if (modalSettings) modalSettings.classList.remove('active');

  showToast('💾 ¡Configuración guardada correctamente!');
}

export function updateDriveHeaderLinks(config) {
  const rootId = extractFolderId(config.rootDriveFolderId || '');
  const recIds = extractFolderIds(config.meetRecordingsFolderId || '');
  const primaryRecId = recIds.length > 0 ? recIds[0] : '';

  const linkRootFolder = document.getElementById('linkRootFolder');
  const linkRecordingsFolder = document.getElementById('linkRecordingsFolder');

  if (linkRootFolder) {
    if (rootId) {
      linkRootFolder.href = `https://drive.google.com/drive/folders/${rootId}`;
      linkRootFolder.style.pointerEvents = 'auto';
      linkRootFolder.style.opacity = '1';
    } else {
      linkRootFolder.href = '#';
      linkRootFolder.style.pointerEvents = 'none';
      linkRootFolder.style.opacity = '0.5';
    }
  }

  if (linkRecordingsFolder) {
    if (primaryRecId) {
      linkRecordingsFolder.href = `https://drive.google.com/drive/folders/${primaryRecId}`;
      linkRecordingsFolder.style.pointerEvents = 'auto';
      linkRecordingsFolder.style.opacity = '1';
    } else {
      linkRecordingsFolder.href = '#';
      linkRecordingsFolder.style.pointerEvents = 'none';
      linkRecordingsFolder.style.opacity = '0.5';
    }
  }
}
