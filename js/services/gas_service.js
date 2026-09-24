/**
 * Norma Hub - Servicio de Comunicación con Google Apps Script
 */

function utf8ToBase64(str) {
  if (!str) return '';
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (err) {
    console.warn('Error codificando a Base64:', err);
    return '';
  }
}

export class GasService {
  /**
   * Sincroniza reuniones desde Google Calendar
   */
  static async fetchMeetings(gasUrl, params = {}) {
    const { dateStr, startTime, endTime, mondayApiKey, boardId, geminiApiKey, geminiModel } = params;
    const url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=sync_meetings&date=${encodeURIComponent(dateStr || '')}&start_time=${encodeURIComponent(startTime || '00:00')}&end_time=${encodeURIComponent(endTime || '23:59')}&monday_api_key=${encodeURIComponent(mondayApiKey || '')}&board_id=${encodeURIComponent(boardId || '1400120846')}&gemini_api_key=${encodeURIComponent(geminiApiKey || '')}&gemini_model=${encodeURIComponent(geminiModel || 'gemini-3.7-flash')}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      if (text.includes('Sign in') || text.includes('accounts.google.com')) {
        throw new Error('Tu Web App en Apps Script requiere permisos. Asegúrate de configurarla con "Acceso: Cualquier usuario" al desplegar.');
      }
      throw new Error('Respuesta no válida de Apps Script: ' + text.slice(0, 100));
    }

    if (data.status === 'error') {
      throw new Error(data.message || 'Error desconocido en Apps Script');
    }

    return data;
  }

  /**
   * Compara carpetas en Drive con clientes de Monday
   */
  static async syncFolders(gasUrl, params = {}) {
    const { rootFolderId, mondayApiKey, boardId, startDate, endDate, excludeFinished } = params;
    let url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=sync_folders&root_folder_id=${encodeURIComponent(rootFolderId)}&monday_api_key=${encodeURIComponent(mondayApiKey || '')}&board_id=${encodeURIComponent(boardId || '1400120846')}`;
    if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
    if (excludeFinished) url += `&exclude_finished=true`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Obtiene o busca la carpeta de un cliente en Google Drive
   */
  static async getClientFolder(gasUrl, params = {}) {
    const { rootFolderId, clientName, createIfMissing = false } = params;
    let url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=get_client_folder&root_folder_id=${encodeURIComponent(rootFolderId)}&client_name=${encodeURIComponent(clientName || '')}`;
    if (createIfMissing) url += `&create_if_missing=true`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Crea carpetas faltantes en Google Drive
   */
  static async createMissingFolders(gasUrl, params = {}) {
    const { rootFolderId, mondayApiKey, boardId, startDate, endDate, excludeFinished } = params;
    let url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=create_missing_folders&root_folder_id=${encodeURIComponent(rootFolderId)}&monday_api_key=${encodeURIComponent(mondayApiKey || '')}&board_id=${encodeURIComponent(boardId || '1400120846')}`;
    if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;
    if (excludeFinished) url += `&exclude_finished=true`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Escanea grabaciones en carpetas de Meet
   */
  static async scanRecordings(gasUrl, params = {}) {
    const { recordingsFolderIds, rootFolderId, mondayApiKey, boardId, startDate, endDate } = params;
    let url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=scan_recordings&recordings_folder_id=${encodeURIComponent(recordingsFolderIds)}&root_folder_id=${encodeURIComponent(rootFolderId)}&monday_api_key=${encodeURIComponent(mondayApiKey || '')}&board_id=${encodeURIComponent(boardId || '1400120846')}`;
    if (startDate) url += `&start_date=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&end_date=${encodeURIComponent(endDate)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Mueve grabaciones a sus respectivas carpetas de clientes
   */
  static async moveRecordings(gasUrl, moves) {
    const url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=move_recordings&moves=${encodeURIComponent(JSON.stringify(moves))}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Obtiene clientes pendientes de Kick Off desde Monday vía Apps Script
   */
  static async getKOPendingClients(gasUrl, params = {}) {
    const { mondayApiKey, boardId } = params;
    const url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}action=get_ko_pending_clients&monday_api_key=${encodeURIComponent(mondayApiKey || '')}&board_id=${encodeURIComponent(boardId || '1400120846')}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Crea un borrador de correo de bienvenida en Gmail vía Apps Script
   */
  static async createWelcomeDraft(gasUrl, params = {}) {
    const { clientName, recipient, agendaUrl, subject, htmlBody, headerAsset, footerAsset } = params;

    // Sanitizar residuos corruptos de emojis antes de enviar
    const cleanSubject = (subject || '').replace(/[\uFFFD\uFFFE]+/g, '🚀');

    // Convertir emojis en htmlBody a entidades numéricas HTML estándar (&#128522;, &#128073;, etc.)
    // para que sean 100% inmunes a cualquier problema de transporte, proxies o Google Apps Script
    const safeHtmlBody = (htmlBody || '')
      .replace(/[\uFFFD\uFFFE]+/g, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, (match) => `&#${match.codePointAt(0)};`);

    const payload = {
      action: 'create_welcome_draft',
      client_name: clientName || '',
      client_name_b64: utf8ToBase64(clientName || ''),
      recipient: recipient || '',
      agenda_url: agendaUrl || '',
      subject: cleanSubject,
      subject_b64: utf8ToBase64(cleanSubject),
      html_body: safeHtmlBody,
      html_body_b64: utf8ToBase64(safeHtmlBody),
      header_asset: headerAsset || '',
      footer_asset: footerAsset || '',
      _b64_encoded: true
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Sube una imagen de banner (header o footer) a Google Drive vía Apps Script
   */
  static async uploadTemplateAsset(gasUrl, params = {}) {
    const { rootFolderId, fileName, mimeType, fileBase64, base64Data, assetType } = params;

    const payload = {
      action: 'upload_template_asset',
      root_folder_id: rootFolderId || '',
      file_name: fileName || ('banner_' + Date.now() + '.png'),
      mime_type: mimeType || 'image/png',
      file_base64: fileBase64 || base64Data || '',
      asset_type: assetType || 'header'
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Crea y personaliza la presentación de Google Slides para Kick Off
   */
  static async createKickOffSlides(gasUrl, params = {}) {
    const {
      slidesTemplateId,
      rootFolderId,
      folderId,
      clientName,
      urlBuk,
      dotacion,
      recintos,
      tipoMarcaje,
      contraparte,
      correoContraparte,
      telefonoContraparte
    } = params;

    const payload = {
      action: 'create_kickoff_slides',
      slides_template_id: slidesTemplateId || '',
      root_folder_id: rootFolderId || '',
      folder_id: folderId || '',
      client_name: clientName || '',
      client_name_b64: utf8ToBase64(clientName || ''),
      url_buk: urlBuk || '',
      dotacion: dotacion || '',
      recintos: recintos || '',
      tipo_marcaje: tipoMarcaje || '',
      contraparte: contraparte || '',
      correo_contraparte: correoContraparte || '',
      telefono_contraparte: telefonoContraparte || '',
      _b64_encoded: true
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Ejecuta la automatización integral de onboarding (Drive + Slides + Monday + Gmail Draft)
   */
  static async onboardClient(gasUrl, params = {}) {
    const {
      clientName,
      clientId,
      recipient,
      agendaUrl,
      rootFolderId,
      slidesTemplateId,
      mondayApiKey,
      boardId,
      createFolder,
      createSlides,
      updateMonday,
      createDraft,
      subject,
      htmlBody,
      urlBuk,
      dotacion,
      recintos,
      tipoMarcaje,
      contraparte,
      correoContraparte,
      telefonoContraparte
    } = params;

    const payload = {
      action: 'onboard_client',
      client_name: clientName || '',
      client_name_b64: utf8ToBase64(clientName || ''),
      client_id: clientId || '',
      recipient: recipient || '',
      agenda_url: agendaUrl || '',
      root_folder_id: rootFolderId || '',
      slides_template_id: slidesTemplateId || '',
      monday_api_key: mondayApiKey || '',
      board_id: boardId || '1400120846',
      create_folder: createFolder,
      create_slides: createSlides,
      update_monday: updateMonday,
      create_draft: createDraft,
      subject: subject || '',
      subject_b64: utf8ToBase64(subject || ''),
      html_body: htmlBody || '',
      html_body_b64: utf8ToBase64(htmlBody || ''),
      url_buk: urlBuk || '',
      dotacion: dotacion || '',
      recintos: recintos || '',
      tipo_marcaje: tipoMarcaje || '',
      contraparte: contraparte || '',
      correo_contraparte: correoContraparte || '',
      telefono_contraparte: telefonoContraparte || '',
      _b64_encoded: true
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  }

  /**
   * Obtiene todas las transcripciones y documentos de texto de la carpeta del cliente en Drive
   */
  static async getClientTranscripts(gasUrl, params = {}) {
    const { folderId, folderUrl, clientName, rootFolderId } = params;

    const payload = {
      action: 'get_client_transcripts',
      folder_id: folderId || '',
      folder_url: folderUrl || '',
      client_name: clientName || '',
      root_folder_id: rootFolderId || ''
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'error') throw new Error(data.message || 'Error al obtener transcripciones de Drive');
    return data;
  }

  /**
   * Crea un borrador en Gmail con la plantilla de Cierre de Implementación
   */
  static async createCierreDraft(gasUrl, params = {}) {
    const { clientName, recipient, subject, htmlBody, headerAsset, footerAsset } = params;
    return this.createWelcomeDraft(gasUrl, {
      clientName,
      recipient,
      subject,
      htmlBody,
      headerAsset,
      footerAsset,
      agendaUrl: ''
    });
  }
}
