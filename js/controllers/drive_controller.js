/**
 * Norma Hub - Controlador de Drive & Grabaciones Meet
 */

import { getConfig } from '../core/config.js';
import { extractFolderId, extractFolderIds, showToast, showFolderAlert, clearFolderAlert, showRecordingAlert, clearRecordingAlert, formatDateYMD } from '../core/ui_helpers.js';
import { GasService } from '../services/gas_service.js';
import { DriveFolderService } from '../services/drive_folder_service.js';

export function initDriveController(state) {
  initSubtabs();
  initDatePresets(state);

  const btnSyncFolders = document.getElementById('btnSyncFolders');
  const btnCreateMissingFolders = document.getElementById('btnCreateMissingFolders');
  const btnScanRecordings = document.getElementById('btnScanRecordings');
  const btnMoveRecordings = document.getElementById('btnMoveRecordings');

  if (btnSyncFolders) btnSyncFolders.addEventListener('click', () => handleSyncFolders(state));
  if (btnCreateMissingFolders) btnCreateMissingFolders.addEventListener('click', () => handleCreateMissingFolders(state));
  if (btnScanRecordings) btnScanRecordings.addEventListener('click', () => handleScanRecordings(state));
  if (btnMoveRecordings) btnMoveRecordings.addEventListener('click', () => handleMoveRecordings(state));
}

function initSubtabs() {
  const subtabFolders = document.getElementById('subtabFolders');
  const subtabRecordings = document.getElementById('subtabRecordings');
  const subviewFolders = document.getElementById('subviewFolders');
  const subviewRecordings = document.getElementById('subviewRecordings');

  subtabFolders?.addEventListener('click', () => {
    subtabFolders.classList.add('active');
    subtabRecordings?.classList.remove('active');
    subviewFolders?.classList.add('active');
    subviewRecordings?.classList.remove('active');
  });

  subtabRecordings?.addEventListener('click', () => {
    subtabRecordings.classList.add('active');
    subtabFolders?.classList.remove('active');
    subviewRecordings?.classList.add('active');
    subviewFolders?.classList.remove('active');
  });
}

function initDatePresets(state) {
  const folderFilterStart = document.getElementById('folderFilterStart');
  const folderFilterEnd = document.getElementById('folderFilterEnd');
  const chipFilterJunSep = document.getElementById('chipFilterJunSep');
  const chipFilterLast30 = document.getElementById('chipFilterLast30');
  const chipFilter2026 = document.getElementById('chipFilter2026');
  const chipFilterAll = document.getElementById('chipFilterAll');

  const folderChips = [chipFilterJunSep, chipFilterLast30, chipFilter2026, chipFilterAll];

  function setActiveFolderChip(btn) {
    folderChips.forEach(b => b?.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  chipFilterJunSep?.addEventListener('click', () => {
    setActiveFolderChip(chipFilterJunSep);
    if (folderFilterStart) folderFilterStart.value = '2026-06-01';
    if (folderFilterEnd) folderFilterEnd.value = '2026-09-30';
    handleSyncFolders(state);
  });

  chipFilterLast30?.addEventListener('click', () => {
    setActiveFolderChip(chipFilterLast30);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    if (folderFilterStart) folderFilterStart.value = formatDateYMD(start);
    if (folderFilterEnd) folderFilterEnd.value = formatDateYMD(end);
    handleSyncFolders(state);
  });

  chipFilter2026?.addEventListener('click', () => {
    setActiveFolderChip(chipFilter2026);
    if (folderFilterStart) folderFilterStart.value = '2026-01-01';
    if (folderFilterEnd) folderFilterEnd.value = '2026-12-31';
    handleSyncFolders(state);
  });

  chipFilterAll?.addEventListener('click', () => {
    setActiveFolderChip(chipFilterAll);
    if (folderFilterStart) folderFilterStart.value = '';
    if (folderFilterEnd) folderFilterEnd.value = '';
    handleSyncFolders(state);
  });

  // Presets de Grabaciones
  const recFilterStart = document.getElementById('recordingFilterStart');
  const recFilterEnd = document.getElementById('recordingFilterEnd');
  const chipRecJunSep = document.getElementById('chipRecJunSep');
  const chipRecToday = document.getElementById('chipRecToday');
  const chipRecYesterday = document.getElementById('chipRecYesterday');
  const chipRecLast7 = document.getElementById('chipRecLast7');
  const chipRecLast30 = document.getElementById('chipRecLast30');
  const chipRecAll = document.getElementById('chipRecAll');

  const recChips = [chipRecJunSep, chipRecToday, chipRecYesterday, chipRecLast7, chipRecLast30, chipRecAll];

  function setActiveRecChip(btn) {
    recChips.forEach(b => b?.classList.remove('active'));
    if (btn) btn.classList.add('active');
  }

  chipRecJunSep?.addEventListener('click', () => {
    setActiveRecChip(chipRecJunSep);
    if (recFilterStart) recFilterStart.value = '2026-06-01';
    if (recFilterEnd) recFilterEnd.value = '2026-09-30';
    handleScanRecordings(state);
  });

  chipRecToday?.addEventListener('click', () => {
    setActiveRecChip(chipRecToday);
    const today = new Date();
    const formatted = formatDateYMD(today);
    if (recFilterStart) recFilterStart.value = formatted;
    if (recFilterEnd) recFilterEnd.value = formatted;
    handleScanRecordings(state);
  });

  chipRecYesterday?.addEventListener('click', () => {
    setActiveRecChip(chipRecYesterday);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formatted = formatDateYMD(yesterday);
    if (recFilterStart) recFilterStart.value = formatted;
    if (recFilterEnd) recFilterEnd.value = formatted;
    handleScanRecordings(state);
  });

  chipRecLast7?.addEventListener('click', () => {
    setActiveRecChip(chipRecLast7);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    if (recFilterStart) recFilterStart.value = formatDateYMD(start);
    if (recFilterEnd) recFilterEnd.value = formatDateYMD(end);
    handleScanRecordings(state);
  });

  chipRecLast30?.addEventListener('click', () => {
    setActiveRecChip(chipRecLast30);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    if (recFilterStart) recFilterStart.value = formatDateYMD(start);
    if (recFilterEnd) recFilterEnd.value = formatDateYMD(end);
    handleScanRecordings(state);
  });

  chipRecAll?.addEventListener('click', () => {
    setActiveRecChip(chipRecAll);
    if (recFilterStart) recFilterStart.value = '';
    if (recFilterEnd) recFilterEnd.value = '';
    handleScanRecordings(state);
  });
}

export async function handleSyncFolders(state) {
  const config = await getConfig();
  if (!config.gasUrl) {
    showToast('⚠️ Configura tu URL de Google Apps Script');
    return;
  }

  const rootFolderId = extractFolderId(config.rootDriveFolderId);
  if (!rootFolderId) {
    showToast('⚠️ Configura el ID o URL de tu carpeta raíz de clientes en Drive');
    return;
  }

  const folderFilterStart = document.getElementById('folderFilterStart');
  const folderFilterEnd = document.getElementById('folderFilterEnd');
  const chkExcludeFinished = document.getElementById('chkExcludeFinished');
  const btnSyncFolders = document.getElementById('btnSyncFolders');

  const startDate = folderFilterStart ? folderFilterStart.value : '';
  const endDate = folderFilterEnd ? folderFilterEnd.value : '';
  const excludeFinished = chkExcludeFinished ? chkExcludeFinished.checked : false;

  try {
    if (btnSyncFolders) {
      btnSyncFolders.disabled = true;
      btnSyncFolders.innerHTML = '<span>⏳ Comparando...</span>';
    }
    showFolderAlert('info', 'Consultando clientes en Monday.com y comparando con Google Drive...');

    const data = await GasService.syncFolders(config.gasUrl, {
      rootFolderId,
      mondayApiKey: config.mondayApiKey,
      boardId: config.boardId,
      startDate,
      endDate,
      excludeFinished,
      coeName: config.coeName,
      userEmail: config.coeEmail || ''
    });

    state.folderSyncData = data;
    if (data.existingFolders && Array.isArray(data.existingFolders)) {
      DriveFolderService.saveFoldersCache(data.existingFolders).catch(err => console.warn('Error saving drive cache:', err));
    }
    renderFolderSyncResults(data);
    clearFolderAlert();
    showToast(`✅ Análisis completo: ${data.existingCount} existentes, ${data.missingCount} por crear`);
  } catch (error) {
    console.error(error);
    showFolderAlert('error', `❌ Error al sincronizar carpetas: ${error.message}`);
  } finally {
    if (btnSyncFolders) {
      btnSyncFolders.disabled = false;
      btnSyncFolders.innerHTML = '<span>🔍 Comparar Monday vs Drive</span>';
    }
  }
}

function renderFolderSyncResults(data) {
  const folderStatsContainer = document.getElementById('folderStatsContainer');
  const kpiMondayClients = document.getElementById('kpiMondayClients');
  const kpiExistingFolders = document.getElementById('kpiExistingFolders');
  const kpiMissingFolders = document.getElementById('kpiMissingFolders');
  const missingActionRow = document.getElementById('missingActionRow');
  const folderResultsContainer = document.getElementById('folderResultsContainer');
  const badgeMissingCount = document.getElementById('badgeMissingCount');
  const missingList = document.getElementById('missingList');
  const badgeExistingCount = document.getElementById('badgeExistingCount');
  const existingList = document.getElementById('existingList');

  if (folderStatsContainer) folderStatsContainer.style.display = 'grid';
  if (kpiMondayClients) kpiMondayClients.textContent = data.totalClientsMonday || 0;
  if (kpiExistingFolders) kpiExistingFolders.textContent = data.existingCount || 0;
  if (kpiMissingFolders) kpiMissingFolders.textContent = data.missingCount || 0;

  if (missingActionRow) {
    missingActionRow.style.display = data.missingCount > 0 ? 'flex' : 'none';
  }

  if (folderResultsContainer) folderResultsContainer.style.display = 'block';

  if (badgeMissingCount) badgeMissingCount.textContent = data.missingCount || 0;
  if (missingList) {
    missingList.innerHTML = '';
    if (data.missingFolders.length === 0) {
      missingList.innerHTML = '<div style="color:#059669; font-size:12.5px; padding:8px 0; font-weight:600;">🎉 ¡Todos tus clientes en el filtro seleccionado ya tienen su carpeta creada en Google Drive!</div>';
    } else {
      data.missingFolders.forEach(m => {
        const item = document.createElement('div');
        item.className = 'folder-item-card';
        const dateTag = m.fechaAsignacion ? `<span style="color:#64748b; font-size:11px;">📅 Asignado: ${m.fechaAsignacion}</span>` : '';
        const stageTag = m.etapa ? `<span style="color:#64748b; font-size:11px;">🏷️ ${m.etapa}</span>` : '';
        item.innerHTML = `
          <div class="folder-item-info">
            <span class="folder-item-name">📁 ${m.clientName}</span>
            <div style="display:flex; gap:10px; align-items:center; margin-top:2px;">
              ${dateTag}
              ${stageTag}
            </div>
          </div>
          <span class="badge badge-warning">Por crear</span>
        `;
        missingList.appendChild(item);
      });
    }
  }

  if (badgeExistingCount) badgeExistingCount.textContent = data.existingCount || 0;
  if (existingList) {
    existingList.innerHTML = '';
    data.existingFolders.forEach(e => {
      const item = document.createElement('div');
      item.className = 'folder-item-card';
      const dateTag = e.fechaAsignacion ? `<span style="color:#64748b; font-size:11px;">📅 Asignado: ${e.fechaAsignacion}</span>` : '';
      const stageTag = e.etapa ? `<span style="color:#64748b; font-size:11px;">🏷️ ${e.etapa}</span>` : '';
      item.innerHTML = `
        <div class="folder-item-info">
          <span class="folder-item-name">📁 ${e.clientName}</span>
          <div style="display:flex; gap:10px; align-items:center; margin-top:2px;">
            <span class="folder-item-sub">Carpeta: ${e.folderName}</span>
            ${dateTag}
            ${stageTag}
          </div>
        </div>
        <a href="${e.folderUrl}" target="_blank" class="badge badge-success" style="text-decoration:none;">Abrir ↗</a>
      `;
      existingList.appendChild(item);
    });
  }
}

export async function handleCreateMissingFolders(state) {
  if (!state.folderSyncData || !state.folderSyncData.missingFolders || state.folderSyncData.missingFolders.length === 0) {
    showToast('ℹ️ No hay carpetas faltantes por crear');
    return;
  }

  const count = state.folderSyncData.missingFolders.length;
  const config = await getConfig();
  const rootFolderId = extractFolderId(config.rootDriveFolderId);

  const folderFilterStart = document.getElementById('folderFilterStart');
  const folderFilterEnd = document.getElementById('folderFilterEnd');
  const chkExcludeFinished = document.getElementById('chkExcludeFinished');
  const btnCreateMissingFolders = document.getElementById('btnCreateMissingFolders');

  const startDate = folderFilterStart ? folderFilterStart.value : '';
  const endDate = folderFilterEnd ? folderFilterEnd.value : '';
  const excludeFinished = chkExcludeFinished ? chkExcludeFinished.checked : false;

  try {
    if (btnCreateMissingFolders) {
      btnCreateMissingFolders.disabled = true;
      btnCreateMissingFolders.innerHTML = `<span>⏳ Creando ${count} carpetas en Drive...</span>`;
    }
    showFolderAlert('info', `Creando ${count} carpetas en tu Google Drive. Esto puede tomar unos segundos...`);

    const data = await GasService.createMissingFolders(config.gasUrl, {
      rootFolderId,
      mondayApiKey: config.mondayApiKey,
      boardId: config.boardId,
      startDate,
      endDate,
      excludeFinished,
      coeName: config.coeName,
      userEmail: config.coeEmail || ''
    });

    if (data.createdFolders && Array.isArray(data.createdFolders)) {
      DriveFolderService.saveFoldersCache(data.createdFolders).catch(err => console.warn('Error saving drive cache:', err));
    }

    if (data.errors && data.errors.length > 0) {
      showFolderAlert('warning', `⚠️ Se crearon ${data.createdCount || 0} carpetas, pero ${data.errors.length} fallaron: ${data.errors[0].error}`);
      showToast(`⚠️ Creadas: ${data.createdCount || 0} (${data.errors.length} errores)`);
    } else {
      showToast(`🎉 ¡Se crearon exitosamente ${data.createdCount} carpetas en Drive!`);
      showFolderAlert('success', `🎉 ¡Se crearon exitosamente ${data.createdCount} carpetas en tu Google Drive!`);
    }
    
    await handleSyncFolders(state);
  } catch (error) {
    console.error(error);
    showFolderAlert('error', `❌ Error al crear carpetas: ${error.message}`);
    showToast(`❌ Error al crear carpetas: ${error.message}`);
  } finally {
    if (btnCreateMissingFolders) {
      btnCreateMissingFolders.disabled = false;
      btnCreateMissingFolders.innerHTML = '<span>✨ Crear Carpetas Faltantes en Drive</span>';
    }
  }
}

export async function handleScanRecordings(state) {
  const config = await getConfig();
  if (!config.gasUrl) {
    showToast('⚠️ Configura tu URL de Google Apps Script');
    return;
  }

  const rootFolderId = extractFolderId(config.rootDriveFolderId);
  const recordingsFolderIds = extractFolderIds(config.meetRecordingsFolderId).join(',');

  const recordingFilterStart = document.getElementById('recordingFilterStart');
  const recordingFilterEnd = document.getElementById('recordingFilterEnd');
  const btnScanRecordings = document.getElementById('btnScanRecordings');

  const startDate = recordingFilterStart ? recordingFilterStart.value : '';
  const endDate = recordingFilterEnd ? recordingFilterEnd.value : '';

  try {
    if (btnScanRecordings) {
      btnScanRecordings.disabled = true;
      btnScanRecordings.innerHTML = '<span>⏳ Escaneando videos...</span>';
    }
    showRecordingAlert('info', 'Escaneando archivos en las carpetas de grabaciones especificadas...');

    const data = await GasService.scanRecordings(config.gasUrl, {
      recordingsFolderIds,
      rootFolderId,
      mondayApiKey: config.mondayApiKey,
      boardId: config.boardId,
      startDate,
      endDate,
      coeName: config.coeName,
      userEmail: config.coeEmail || ''
    });

    state.recordingsData = data;
    renderRecordingsResults(data);
    clearRecordingAlert();
    const folderCount = data.scannedFolders ? data.scannedFolders.length : 1;
    showToast(`🎥 Escaneo completado: ${data.classifiedCount} videos identificados en ${folderCount} carpeta(s)`);
  } catch (error) {
    console.error(error);
    showRecordingAlert('error', `❌ Error al escanear grabaciones: ${error.message}`);
  } finally {
    if (btnScanRecordings) {
      btnScanRecordings.disabled = false;
      btnScanRecordings.innerHTML = '<span>🔍 Escanear Grabaciones</span>';
    }
  }
}

function renderRecordingsResults(data) {
  const recordingStatsContainer = document.getElementById('recordingStatsContainer');
  const kpiTotalRecordings = document.getElementById('kpiTotalRecordings');
  const kpiClassifiedRecordings = document.getElementById('kpiClassifiedRecordings');
  const kpiUnmatchedRecordings = document.getElementById('kpiUnmatchedRecordings');
  const moveActionRow = document.getElementById('moveActionRow');
  const recordingResultsContainer = document.getElementById('recordingResultsContainer');
  const badgeClassifiedCount = document.getElementById('badgeClassifiedCount');
  const classifiedList = document.getElementById('classifiedList');
  const badgeUnmatchedCount = document.getElementById('badgeUnmatchedCount');
  const unmatchedList = document.getElementById('unmatchedList');

  if (recordingStatsContainer) recordingStatsContainer.style.display = 'grid';
  if (kpiTotalRecordings) kpiTotalRecordings.textContent = data.totalRecordings || 0;
  if (kpiClassifiedRecordings) kpiClassifiedRecordings.textContent = data.classifiedCount || 0;
  if (kpiUnmatchedRecordings) kpiUnmatchedRecordings.textContent = data.unmatchedCount || 0;

  if (moveActionRow) {
    moveActionRow.style.display = data.classifiedCount > 0 ? 'flex' : 'none';
  }

  if (recordingResultsContainer) recordingResultsContainer.style.display = 'block';

  if (badgeClassifiedCount) badgeClassifiedCount.textContent = data.classifiedCount || 0;
  if (classifiedList) {
    if (data.classified.length === 0) {
      classifiedList.innerHTML = '<div style="padding: 16px; color:#64748b; font-size:12.5px;">No hay grabaciones pendientes listas para clasificar en el período seleccionado.</div>';
    } else {
      let tableHtml = `
        <table class="recordings-table">
          <thead>
            <tr>
              <th style="width: 40px;"><input type="checkbox" id="checkAllRecordings" checked></th>
              <th>Grabación (Meet)</th>
              <th>Carpeta Origen</th>
              <th>Cliente Detectado</th>
              <th>Carpeta Destino</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
      `;

      data.classified.forEach((rec, idx) => {
        const typeBadge = rec.itemType === 'folder' 
          ? '<span style="font-size:11px; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; margin-right:4px;">📁 Sesión</span>' 
          : '<span style="font-size:11px; background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px; margin-right:4px;">🎥 Video</span>';

        tableHtml += `
          <tr>
            <td><input type="checkbox" class="rec-check" data-idx="${idx}" checked></td>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                ${typeBadge}
                <strong style="color:#0f172a;">${rec.fileName}</strong>
              </div>
            </td>
            <td>
              <span style="font-size:11.5px; color:#64748b;">📁 ${rec.sourceFolderName || 'Drive'}</span>
            </td>
            <td>
              <span class="badge badge-info">👤 ${rec.clientName}</span>
            </td>
            <td>
              <span style="color:#047857; font-weight:600;">📁 ${rec.targetFolderName}</span>
            </td>
            <td style="color:#64748b; font-size:11.5px;">${rec.lastUpdated || '-'}</td>
            <td>
              <a href="${rec.fileUrl}" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:600;">Ver ↗</a>
            </td>
          </tr>
        `;
      });

      tableHtml += '</tbody></table>';
      classifiedList.innerHTML = tableHtml;

      const checkAll = classifiedList.querySelector('#checkAllRecordings');
      checkAll?.addEventListener('change', (e) => {
        const checkboxes = classifiedList.querySelectorAll('.rec-check');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
      });
    }
  }

  if (badgeUnmatchedCount) badgeUnmatchedCount.textContent = data.unmatchedCount || 0;
  if (unmatchedList) {
    if (data.unmatched.length === 0) {
      unmatchedList.innerHTML = '<div style="padding: 16px; color:#047857; font-size:12.5px;">✅ Todas las grabaciones fueron identificadas con éxito.</div>';
    } else {
      let tableHtml = `
        <table class="recordings-table">
          <thead>
            <tr>
              <th>Grabación / Sesión Meet</th>
              <th>Carpeta Origen</th>
              <th>Motivo de permanencia</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
      `;

      data.unmatched.forEach(rec => {
        const typeBadge = rec.itemType === 'folder' 
          ? '<span style="font-size:11px; background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; margin-right:4px;">📁 Sesión</span>' 
          : '<span style="font-size:11px; background:#eff6ff; color:#1d4ed8; padding:2px 6px; border-radius:4px; margin-right:4px;">🎥 Video</span>';

        tableHtml += `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:6px;">
                ${typeBadge}
                <strong style="color:#475569;">${rec.fileName}</strong>
              </div>
            </td>
            <td><span style="font-size:11.5px; color:#64748b;">📁 ${rec.sourceFolderName || 'Drive'}</span></td>
            <td><span class="badge badge-neutral">Permanecerá en carpeta original</span></td>
            <td style="color:#64748b; font-size:11.5px;">${rec.lastUpdated || '-'}</td>
            <td>
              <a href="${rec.fileUrl}" target="_blank" style="color:#64748b; text-decoration:none; font-weight:600;">Revisar ↗</a>
            </td>
          </tr>
        `;
      });

      tableHtml += '</tbody></table>';
      unmatchedList.innerHTML = tableHtml;
    }
  }
}

export async function handleMoveRecordings(state) {
  if (!state.recordingsData || !state.recordingsData.classified || state.recordingsData.classified.length === 0) {
    showToast('ℹ️ No hay grabaciones para mover');
    return;
  }

  const classifiedList = document.getElementById('classifiedList');
  const btnMoveRecordings = document.getElementById('btnMoveRecordings');
  const checkboxes = classifiedList?.querySelectorAll('.rec-check:checked') || [];
  const moves = [];

  checkboxes.forEach(cb => {
    const idx = parseInt(cb.getAttribute('data-idx'), 10);
    const rec = state.recordingsData.classified[idx];
    if (rec) {
      moves.push({
        fileId: rec.fileId || rec.itemId,
        itemId: rec.itemId || rec.fileId,
        itemType: rec.itemType || 'file',
        targetFolderId: rec.targetFolderId
      });
    }
  });

  if (moves.length === 0) {
    showToast('⚠️ Selecciona al menos una grabación para mover');
    return;
  }

  const config = await getConfig();

  try {
    if (btnMoveRecordings) {
      btnMoveRecordings.disabled = true;
      btnMoveRecordings.innerHTML = '<span>⏳ Moviendo archivos...</span>';
    }

    const data = await GasService.moveRecordings(config.gasUrl, moves);
    showToast(`🎉 ¡Se movieron ${data.movedCount} grabaciones a sus carpetas de clientes!`);
    await handleScanRecordings(state);
  } catch (error) {
    console.error(error);
    showToast(`❌ Error al mover grabaciones: ${error.message}`);
  } finally {
    if (btnMoveRecordings) {
      btnMoveRecordings.disabled = false;
      btnMoveRecordings.innerHTML = '<span>🚀 Mover Grabaciones Seleccionadas</span>';
    }
  }
}
