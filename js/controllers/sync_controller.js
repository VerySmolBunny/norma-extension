/**
 * Norma Hub - Controlador de Sincronización de Reuniones
 */

import { getConfig } from '../core/config.js';
import { showToast, showStatusAlert, clearStatusAlert } from '../core/ui_helpers.js';
import { GasService } from '../services/gas_service.js';
import { MondayService } from '../services/monday_service.js';
import { ETAPAS_ASISTENCIA, detectStageFromNotes } from '../services/etapas_config.js';
import { MinutaAiService } from '../services/minuta_ai_service.js';

export function initSyncController(state) {
  initDateHeader();
  initDateInput();
  initPresetHandlers(state);

  const btnSync = document.getElementById('btnSync');
  if (btnSync) {
    btnSync.addEventListener('click', () => handleSyncMeetings(state));
  }

  const btnPublishAll = document.getElementById('btnPublishAll');
  if (btnPublishAll) {
    btnPublishAll.addEventListener('click', () => handlePublishAll(state));
  }
}

function initDateHeader() {
  const todayBadge = document.getElementById('todayBadge');
  if (!todayBadge) return;
  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  todayBadge.textContent = '📅 ' + now.toLocaleDateString('es-ES', options);
}

function initDateInput() {
  const targetDate = document.getElementById('targetDate');
  if (!targetDate) return;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  targetDate.value = `${yyyy}-${mm}-${dd}`;
}

function initPresetHandlers(state) {
  const chipMorning = document.getElementById('chipMorning');
  const chipAfternoon = document.getElementById('chipAfternoon');
  const chipAllDay = document.getElementById('chipAllDay') || document.getElementById('chipAll');
  const startTime = document.getElementById('startTime');
  const endTime = document.getElementById('endTime');

  const chips = [chipMorning, chipAfternoon, chipAllDay].filter(Boolean);

  function setActiveChip(activeChip) {
    chips.forEach(c => c.classList.remove('active'));
    if (activeChip) activeChip.classList.add('active');
  }

  chipMorning?.addEventListener('click', () => {
    setActiveChip(chipMorning);
    if (startTime) startTime.value = '08:00';
    if (endTime) endTime.value = '13:30';
    state.activePreset = 'morning';
  });

  chipAfternoon?.addEventListener('click', () => {
    setActiveChip(chipAfternoon);
    if (startTime) startTime.value = '13:30';
    if (endTime) endTime.value = '20:00';
    state.activePreset = 'afternoon';
  });

  chipAllDay?.addEventListener('click', () => {
    setActiveChip(chipAllDay);
    if (startTime) startTime.value = '00:00';
    if (endTime) endTime.value = '23:59';
    state.activePreset = 'allday';
  });
}

export async function handleSyncMeetings(state) {
  if (state.isSyncing) return;

  const config = await getConfig();
  if (!config.gasUrl) {
    const navSettings = document.getElementById('navSettings');
    if (navSettings) navSettings.click();
    showToast('⚠️ Por favor ingresa la URL de tu Google Apps Script');
    return;
  }

  const targetDate = document.getElementById('targetDate');
  const startTime = document.getElementById('startTime');
  const endTime = document.getElementById('endTime');

  const dateStr = targetDate?.value || '';
  const startStr = startTime?.value || '00:00';
  const endStr = endTime?.value || '23:59';

  try {
    setSyncingState(true);
    showLoading('Buscando reuniones en Google Calendar y analizando notas...');

    const data = await GasService.fetchMeetings(config.gasUrl, {
      dateStr,
      startTime: startStr,
      endTime: endStr,
      mondayApiKey: config.mondayApiKey,
      boardId: config.boardId,
      geminiApiKey: config.geminiApiKey,
      geminiModel: config.geminiModel || 'gemini-3.7-flash',
      coeName: config.coeName
    });

    const rawDrafts = data.drafts || [];

    state.currentDrafts = rawDrafts.map((draft, idx) => {
      const detected = detectStageFromNotes(draft.minutaDraft || '');
      const resolvedItemId = draft.itemId || draft.clientId || null;
      const resolvedTimeStr = draft.timeStr || draft.meetingTime || '';
      const resolvedDateStr = draft.dateStr || draft.date || '';

      return {
        ...draft,
        id: `draft_${idx}_${Date.now()}`,
        itemId: resolvedItemId,
        clientId: resolvedItemId,
        timeStr: resolvedTimeStr,
        dateStr: resolvedDateStr,
        docText: draft.docText || '',
        rawDescription: draft.rawDescription || '',
        aiGenerated: draft.aiGenerated === true,
        aiModel: draft.aiModel || null,
        detectedStage: detected,
        selectedStage: detected ? detected.mondayLabel : '',
        isPublished: false
      };
    });

    renderDrafts(state);

    // Auto-pulido con Gemini si GAS devolvió borrador preliminar y hay API Key en la extensión
    if (config.geminiApiKey) {
      const unpolishedDrafts = state.currentDrafts.filter(d => !d.aiGenerated && d.docText && d.docText.trim().length > 30);
      if (unpolishedDrafts.length > 0) {
        showStatusAlert('info', `✨ Pulir minutas con Gemini (${config.geminiModel || 'gemini-3.7-flash'})...`);
        Promise.allSettled(unpolishedDrafts.map(async (draft) => {
          try {
            const aiRes = await MinutaAiService.generateMinuta({
              docText: draft.docText,
              rawDescription: draft.rawDescription,
              meetingType: draft.meetingType,
              clientName: draft.clientName,
              dateStr: draft.dateStr,
              apiKey: config.geminiApiKey,
              model: config.geminiModel || 'gemini-3.7-flash'
            });
            draft.minutaDraft = aiRes.text;
            draft.aiGenerated = true;
            draft.aiModel = aiRes.model;
            draft.detectedStage = detectStageFromNotes(draft.minutaDraft);
            if (draft.detectedStage) draft.selectedStage = draft.detectedStage.mondayLabel;
          } catch (e) {
            console.warn(`No se pudo auto-pulir minuta para ${draft.clientName}:`, e);
          }
        })).then(() => {
          renderDrafts(state);
          clearStatusAlert();
        });
      }
    }

    if (state.currentDrafts.length === 0) {
      showStatusAlert('info', `ℹ️ No se encontraron reuniones de clientes entre las ${startStr} y las ${endStr} para el ${dateStr}.`);
    } else {
      clearStatusAlert();
      showToast(`🎉 Se encontraron ${state.currentDrafts.length} reuniones`);
    }
  } catch (error) {
    console.error(error);
    showStatusAlert('error', `❌ Error al sincronizar: ${error.message}`);
  } finally {
    setSyncingState(false);
  }
}

function setSyncingState(isSyncing) {
  const btnSync = document.getElementById('btnSync');
  if (!btnSync) return;
  btnSync.disabled = isSyncing;
  btnSync.innerHTML = isSyncing 
    ? '<span>⏳ Sincronizando...</span>' 
    : '<span>🔄 Sincronizar Reuniones</span>';
}

function showLoading(msg) {
  const container = document.getElementById('draftsContainer');
  if (!container) return;
  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
      <div style="font-size: 28px; margin-bottom: 12px; animation: pulse 1.5s infinite;">⏳</div>
      <div style="font-weight: 600; font-size: 14px;">${msg}</div>
    </div>
  `;
}

export function renderDrafts(state) {
  const container = document.getElementById('draftsContainer');
  const resultsHeader = document.getElementById('resultsHeader');
  const resultsTitle = document.getElementById('resultsTitle');

  if (!container) return;

  if (state.currentDrafts.length === 0) {
    if (resultsHeader) resultsHeader.style.display = 'none';
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: white; border-radius: var(--radius-lg); border: 1px dashed var(--border);">
        <div style="font-size: 32px; margin-bottom: 8px;">📋</div>
        <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Sin borradores para mostrar</div>
        <div style="font-size: 12px;">Selecciona una fecha y haz clic en "Sincronizar Reuniones"</div>
      </div>
    `;
    return;
  }

  if (resultsHeader) resultsHeader.style.display = 'flex';
  if (resultsTitle) resultsTitle.textContent = `Borradores Listos (${state.currentDrafts.length})`;

  container.innerHTML = '';

  state.currentDrafts.forEach((draft, idx) => {
    const isKO = draft.meetingType === 'Kick Off';
    const badgeClass = isKO ? 'badge-ko' : 'badge-seg';
    const badgeText = isKO ? '🎯 Kick Off' : '🔄 Seguimiento';

    const stageOptions = ETAPAS_ASISTENCIA.map(e => {
      const isSelected = draft.selectedStage === e.mondayLabel ? 'selected' : '';
      return `<option value="${e.mondayLabel}" ${isSelected}>${e.name} (${e.mondayLabel})</option>`;
    }).join('');

    const detectedInfo = draft.detectedStage 
      ? `<div style="font-size: 11px; color: #10b981; font-weight: 600; margin-top: 4px;">✨ ${draft.detectedStage.reason}</div>`
      : '<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">ℹ️ Selecciona la etapa manualmente si aplica</div>';

    const card = document.createElement('div');
    card.className = `draft-card ${draft.isPublished ? 'published' : ''}`;
    card.id = `card_${draft.id}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="client-name">
          <span>🏢 ${draft.clientName}</span>
        </div>
        <div class="badges-row">
          <span class="badge ${badgeClass}">${badgeText}</span>
          <span class="badge badge-time">⏰ ${draft.timeStr || ''}</span>
          ${draft.aiGenerated 
            ? `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:600;">✨ IA: ${draft.aiModel || 'Gemini'}</span>` 
            : `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-size:11px; padding:2px 8px; border-radius:12px; font-weight:600;">⚠️ Borrador preliminar</span>`
          }
          ${draft.itemId 
            ? `<span class="badge badge-success">ID: ${draft.itemId}</span>` 
            : `<button class="btn-link-client" data-idx="${idx}" style="background:#fef3c7; color:#92400e; border:1px solid #fcd34d; border-radius:12px; padding:2px 8px; font-size:11px; cursor:pointer; font-weight:600;">🔗 Vincular ID Monday</button>`
          }
        </div>
      </div>

      <!-- Selector de Etapa Monday -->
      <div class="stage-selector-container">
        <div class="stage-label-group">
          <span class="stage-title">🏷️ Actualizar Etapa en Monday</span>
          <span class="stage-col-name">Columna: Etapa Asistencia (dup__of_criticidad4)</span>
          ${detectedInfo}
        </div>
        <select class="stage-select" data-idx="${idx}">
          <option value="">-- No modificar etapa --</option>
          ${stageOptions}
        </select>
      </div>

      <!-- Minuta / Resumen de Sesión -->
      <div class="comment-box-group">
        <div class="comment-box-header" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span>📝 Minuta / Resumen de Sesión</span>
            <span style="font-size:11px; color:#64748b; font-weight:normal;">(Se publicará como comentario en Monday)</span>
          </div>
          <button type="button" class="btn-refine-ai" data-idx="${idx}" title="Generar o pulir con Gemini" style="background:#f0f9ff; color:#0284c7; border:1px solid #bae6fd; border-radius:6px; padding:4px 10px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
            <span>✨ Pulir con Gemini</span>
          </button>
        </div>
        <textarea class="comment-textarea minuta-input" data-idx="${idx}">${draft.minutaDraft || ''}</textarea>
      </div>

      <div class="card-actions">
        ${draft.isPublished 
          ? '<span style="color:var(--success); font-weight:700; display:flex; align-items:center; gap:6px;">✅ Publicado en Monday</span>'
          : `<button class="btn-card-publish" data-idx="${idx}">
              <span>📤 Publicar en Monday</span>
             </button>`
        }
      </div>
    `;

    container.appendChild(card);
  });

  // Auto-ajustar altura de los textareas para mostrar todo el contenido sin cortes visuales
  container.querySelectorAll('.comment-textarea').forEach(txt => {
    txt.style.height = 'auto';
    txt.style.height = Math.max(150, txt.scrollHeight + 8) + 'px';

    txt.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.max(150, e.target.scrollHeight + 8) + 'px';
    });
  });

  // Event Listeners dinámicos de los borradores
  container.querySelectorAll('.stage-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = e.target.getAttribute('data-idx');
      state.currentDrafts[idx].selectedStage = e.target.value;
    });
  });

  container.querySelectorAll('.minuta-input').forEach(txt => {
    txt.addEventListener('input', (e) => {
      const idx = e.target.getAttribute('data-idx');
      state.currentDrafts[idx].minutaDraft = e.target.value;
    });
  });

  // Listener para pulir minuta con IA cliente
  container.querySelectorAll('.btn-refine-ai').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetBtn = btn;
      const idx = targetBtn.getAttribute('data-idx');
      const draft = state.currentDrafts[idx];
      const origBtnHtml = targetBtn.innerHTML;

      targetBtn.disabled = true;
      targetBtn.innerHTML = '<span>⏳ Redactando...</span>';

      try {
        const config = await getConfig();
        if (!config.geminiApiKey) {
          showToast('⚠️ Configura tu Gemini API Key en Ajustes (⚙️) para pulir con IA.');
          targetBtn.disabled = false;
          targetBtn.innerHTML = origBtnHtml;
          return;
        }

        const sourceText = draft.docText || draft.minutaDraft || '';
        const aiRes = await MinutaAiService.generateMinuta({
          docText: sourceText,
          rawDescription: draft.rawDescription || '',
          meetingType: draft.meetingType || 'Seguimiento',
          clientName: draft.clientName || '',
          dateStr: draft.dateStr || draft.date || '',
          apiKey: config.geminiApiKey,
          model: config.geminiModel || 'gemini-3.7-flash'
        });

        draft.minutaDraft = aiRes.text;
        draft.aiGenerated = true;
        draft.aiModel = aiRes.model;

        // Re-evaluar detección de etapa si aplica
        draft.detectedStage = detectStageFromNotes(draft.minutaDraft);
        if (draft.detectedStage) {
          draft.selectedStage = draft.detectedStage.mondayLabel;
        }

        showToast(`✨ Minuta pulida con éxito (${aiRes.model})`);
        renderDrafts(state);
      } catch (err) {
        console.error('Error puliendo minuta con IA:', err);
        showToast(`❌ Error al pulir minuta: ${err.message || err}`);
        targetBtn.disabled = false;
        targetBtn.innerHTML = origBtnHtml;
      }
    });
  });

  container.querySelectorAll('.btn-link-client').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      const draft = state.currentDrafts[idx];
      const manualId = prompt(`Ingresa el ID del cliente en Monday.com para "${draft.clientName}":`, draft.itemId || '');
      if (manualId && manualId.trim()) {
        draft.itemId = manualId.trim();
        draft.clientId = manualId.trim();
        showToast(`✅ ID ${manualId.trim()} asignado a ${draft.clientName}`);
        renderDrafts(state);
      }
    });
  });

  container.querySelectorAll('.btn-card-publish').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      await publishSingleDraft(state.currentDrafts[idx], state);
    });
  });
}

export async function publishSingleDraft(draft, state) {
  if (!draft.itemId) {
    const manualId = prompt(`⚠️ "${draft.clientName}" no tiene ID de Monday asociado.\nPor favor ingresa el Item ID de Monday para publicar:`);
    if (manualId && manualId.trim()) {
      draft.itemId = manualId.trim();
      draft.clientId = manualId.trim();
    } else {
      showToast(`⚠️ No se puede publicar: ${draft.clientName} no tiene ID de Monday asociado.`);
      return false;
    }
  }

  const card = document.getElementById(`card_${draft.id}`);
  const publishBtn = card?.querySelector('.btn-card-publish');

  try {
    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = '<span>⏳ Publicando...</span>';
    }

    let updateBody = '';
    if (draft.minutaDraft) {
      updateBody = draft.minutaDraft.replace(/\n/g, '<br>');
    }

    // 1. Publicar Update en Monday
    await MondayService.addUpdate(draft.itemId, updateBody);

    // 2. Si existe tarjeta de próxima sesión agendada en Calendar, publicarla
    if (draft.nextMeetingCard) {
      try {
        await MondayService.addUpdate(draft.itemId, draft.nextMeetingCard.replace(/\n/g, '<br>'));
      } catch (errCard) {
        console.warn('No se pudo publicar la tarjeta de próxima reunión:', errCard);
      }
    }

    // 3. Actualizar Etapa si está seleccionada
    if (draft.selectedStage) {
      try {
        await MondayService.updateClientStage(draft.itemId, draft.selectedStage);
      } catch (stageErr) {
        console.warn('No se pudo actualizar la columna de etapa:', stageErr);
      }
    }

    draft.isPublished = true;
    showToast(`✅ Publicado con éxito en ${draft.clientName}`);
    renderDrafts(state);
    return true;
  } catch (error) {
    console.error(error);
    showToast(`❌ Error al publicar en ${draft.clientName}: ${error.message}`);
    if (publishBtn) {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<span>📤 Publicar en Monday</span>';
    }
    return false;
  }
}

export async function handlePublishAll(state) {
  const unpublished = state.currentDrafts.filter(d => !d.isPublished && (d.itemId || d.clientId));
  if (unpublished.length === 0) {
    showToast('ℹ️ No hay borradores pendientes para publicar');
    return;
  }

  const btnPublishAll = document.getElementById('btnPublishAll');
  if (btnPublishAll) {
    btnPublishAll.disabled = true;
    btnPublishAll.innerHTML = `<span>⏳ Publicando (${unpublished.length})...</span>`;
  }

  let successCount = 0;
  for (const draft of unpublished) {
    const ok = await publishSingleDraft(draft, state);
    if (ok) successCount++;
  }

  if (btnPublishAll) {
    btnPublishAll.disabled = false;
    btnPublishAll.innerHTML = '<span>⚡ Publicar Todo en Monday</span>';
  }

  showToast(`🎉 Proceso completado: ${successCount} de ${unpublished.length} publicados.`);
}
