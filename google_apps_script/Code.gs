/**
 * Norma - Google Apps Script Backend (Web App)
 * Sincronizador de Reuniones de Calendar, Notas de Gemini/Docs, Monday.com y Gestor de Drive
 */

const CONFIG = {
  MONDAY_API_KEY: '', // Se recibe dinámicamente desde la extensión o definir aquí para pruebas
  BOARD_ID: 1400120846, // Master de Clientes Asistencia
  COE_NAME: '', // Nombre del Consultor/COE en Monday (ej. 'Constanza Diaz Contreras')
  ROOT_CLIENTS_FOLDER_ID: '', // ID o URL de la carpeta raíz de clientes en Google Drive
  MEET_RECORDINGS_FOLDER_ID: '', // ID o URL de la carpeta de grabaciones de Google Meet
  SLIDES_KICKOFF_TEMPLATE_ID: '', // ID o URL de la plantilla maestra de Google Slides
  GEMINI_API_KEY: ''
};

/**
 * FUNCIÓN DE TEST Y DIAGNÓSTICO DIRECTO
 * Selecciona "testDirectFolderCreation" en el menú desplegable de arriba y presiona "Ejecutar" (Run ▶️).
 * Esto probará la conexión con Google Drive y creará carpetas de prueba directamente en el editor.
 */
function testDirectFolderCreation() {
  try {
    const folderId = CONFIG.ROOT_CLIENTS_FOLDER_ID;
    if (!folderId) {
      Logger.log('⚠️ Para ejecutar esta prueba directa en Apps Script, define ROOT_CLIENTS_FOLDER_ID en el objeto CONFIG arriba.');
      return;
    }
    Logger.log('1. Conectando a carpeta raíz con ID: ' + folderId);
    const rootFolder = DriveApp.getFolderById(folderId);
    Logger.log('   ✅ Conectado a carpeta raíz: "' + rootFolder.getName() + '"');
    Logger.log('   URL: ' + rootFolder.getUrl());

    // Crear carpeta de prueba de diagnóstico
    const testName = '_TEST_FRIDAY_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HHmmss');
    Logger.log('2. Intentando crear carpeta de prueba: ' + testName);
    const testFolder = rootFolder.createFolder(testName);
    Logger.log('   🎉 ¡CARPETA DE PRUEBA CREADA EXITOSAMENTE!');
    Logger.log('   ID: ' + testFolder.getId() + ' | URL: ' + testFolder.getUrl());

    // Probar sincronización con filtro Jun-Sep
    Logger.log('3. Consultando clientes en Monday con filtro Jun-Sep 2026...');
    const syncRes = syncClientFolders(folderId, CONFIG.MONDAY_API_KEY, CONFIG.BOARD_ID, '2026-06-01', '2026-09-30', true);
    Logger.log('   Clientes activos encontrados: ' + syncRes.totalClientsMonday);
    Logger.log('   Carpetas existentes: ' + syncRes.existingCount);
    Logger.log('   Carpetas faltantes: ' + syncRes.missingCount);

    if (syncRes.missingFolders.length > 0) {
      Logger.log('4. Intentando crear las primeras 3 carpetas faltantes como prueba...');
      const sampleNames = syncRes.missingFolders.slice(0, 3).map(m => m.clientName);
      Logger.log('   Clientes a crear: ' + JSON.stringify(sampleNames));
      const createRes = createMissingFolders(folderId, sampleNames);
      Logger.log('   Resultado: ' + JSON.stringify(createRes, null, 2));
    } else {
      Logger.log('   No hay carpetas faltantes por crear en este filtro.');
    }

    Logger.log('🏁 DIAGNÓSTICO FINALIZADO CON ÉXITO');
  } catch (err) {
    Logger.log('❌ ERROR EN DIAGNÓSTICO: ' + err.toString());
    Logger.log('Stack: ' + err.stack);
  }
}

/**
 * Función de prueba para autorizar permisos de Google Drive
 */
function testDrivePermissions() {
  testDirectFolderCreation();
}

/**
 * Función de prueba directa para Escaneo y Clasificación de Grabaciones con Filtro de Fecha
 */
function testScanRecordingsDirectly() {
  try {
    const recordingsFolderId = CONFIG.MEET_RECORDINGS_FOLDER_ID;
    const rootFolderId = CONFIG.ROOT_CLIENTS_FOLDER_ID;
    if (!recordingsFolderId || !rootFolderId) {
      Logger.log('⚠️ Para ejecutar esta prueba directa, define MEET_RECORDINGS_FOLDER_ID y ROOT_CLIENTS_FOLDER_ID en CONFIG arriba.');
      return;
    }
    Logger.log('1. Escaneando grabaciones en carpeta: ' + recordingsFolderId);
    Logger.log('   Filtro de prueba: Junio a Septiembre 2026 (2026-06-01 a 2026-09-30)');

    const result = scanRecordingsToClassify(recordingsFolderId, rootFolderId, CONFIG.MONDAY_API_KEY, CONFIG.BOARD_ID, '2026-06-01', '2026-09-30');
    Logger.log('   Total grabaciones analizadas: ' + result.totalRecordings);
    Logger.log('   Grabaciones clasificadas para mover: ' + result.classifiedCount);
    Logger.log('   Grabaciones sin coincidencia: ' + result.unmatchedCount);
    Logger.log('Detalle clasificadas: ' + JSON.stringify(result.classified, null, 2));
    Logger.log('🏁 TEST DE GRABACIONES COMPLETADO CON ÉXITO');
  } catch (err) {
    Logger.log('❌ ERROR EN TEST DE GRABACIONES: ' + err.toString() + '\n' + err.stack);
  }
}

/**
 * Web App Endpoint (GET y POST)
 * Permite atender solicitudes desde la Extensión de Chrome Norma Hub
 */
function doGet(e) {
  const params = e ? e.parameter : {};
  const action = (params && params.action) ? params.action.toLowerCase() : '';

  // Flujo interactivo de autorización y verificación desde el navegador (1 clic desde la extensión)
  if (!action || action === 'auth' || action === 'authorize' || action === 'test_auth') {
    let userEmail = '';
    try {
      userEmail = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
    } catch (err) {}

    // Llamadas simples para forzar la activación y verificación de todos los permisos requeridos
    try {
      DriveApp.getRootFolder().getName();
      CalendarApp.getDefaultCalendar();
      GmailApp.getDrafts();
    } catch (ignoreErr) {}

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Norma Hub - Autorización Exitosa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
      line-height: 1;
    }
    .badge {
      display: inline-block;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid #10b981;
      color: #34d399;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 9999px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    p {
      font-size: 15px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .permissions-box {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    }
    .perm-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13.5px;
      color: #cbd5e1;
      margin-bottom: 8px;
    }
    .perm-item:last-child {
      margin-bottom: 0;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: #0284c7;
      color: #ffffff;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 20px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .btn:hover {
      background: #0369a1;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .note {
      font-size: 12px;
      color: #64748b;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✨</div>
    <div class="badge">Conexión Verificada</div>
    <h1>¡Permisos Autorizados con Éxito!</h1>
    <p>La cuenta <strong>${userEmail || 'de Google'}</strong> ha concedido acceso a Google Apps Script para sincronizarse con <strong>Norma Hub</strong>.</p>
    
    <div class="permissions-box">
      <div class="perm-item">📁 <strong>Google Drive:</strong> Carpetas de clientes y grabaciones</div>
      <div class="perm-item">📅 <strong>Google Calendar:</strong> Lectura de reuniones y minutas</div>
      <div class="perm-item">✉️ <strong>Gmail:</strong> Creación de borradores de bienvenida</div>
      <div class="perm-item">📊 <strong>Google Slides:</strong> Generación de presentaciones KO</div>
    </div>

    <button class="btn" onclick="window.close()">Cerrar esta ventana</button>
    <div class="note">Ya puedes volver a la extensión y continuar trabajando normalmente.</div>
  </div>
</body>
</html>`;

    return HtmlService.createHtmlOutput(html)
      .setTitle('Norma Hub - Autorización Exitosa')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return handleRequest(params);
}

function decodeUtf8Base64(b64Str) {
  if (!b64Str) return '';
  try {
    const decodedBytes = Utilities.base64Decode(b64Str);
    return Utilities.newBlob(decodedBytes, 'text/plain; charset=utf-8').getDataAsString('UTF-8');
  } catch (err) {
    return '';
  }
}

function doPost(e) {
  let params = {};
  try {
    if (e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter;
    }
  } catch (err) {
    params = e ? e.parameter : {};
  }

  // Decodificar campos Base64 seguros en UTF-8 si están presentes para prevenir emojis corruptos
  if (params && params._b64_encoded) {
    if (params.subject_b64) {
      const decodedSubject = decodeUtf8Base64(params.subject_b64);
      if (decodedSubject) params.subject = decodedSubject;
    }
    if (params.html_body_b64) {
      const decodedHtml = decodeUtf8Base64(params.html_body_b64);
      if (decodedHtml) params.html_body = decodedHtml;
    }
    if (params.client_name_b64) {
      const decodedClient = decodeUtf8Base64(params.client_name_b64);
      if (decodedClient) params.client_name = decodedClient;
    }
  }

  return handleRequest(params);
}

function handleRequest(params) {
  try {
    const action = params.action || 'sync_meetings';
    const mondayApiKey = params.monday_api_key || CONFIG.MONDAY_API_KEY;
    const boardId = params.board_id || CONFIG.BOARD_ID;
    const coeName = params.coe_name || params.person_name || CONFIG.COE_NAME || '';
    let rawRoot = params.root_folder_id;
    if (!rawRoot || rawRoot === 'undefined' || rawRoot === 'null') {
      rawRoot = CONFIG.ROOT_CLIENTS_FOLDER_ID;
    }
    const rootFolderId = extractDriveFolderId(rawRoot) || CONFIG.ROOT_CLIENTS_FOLDER_ID;
    const recordingsFolderIds = extractDriveFolderIds(params.recordings_folder_id || params.recordings_folder_ids || CONFIG.MEET_RECORDINGS_FOLDER_ID);

    const startDate = params.start_date || '';
    const endDate = params.end_date || '';
    const excludeFinished = params.exclude_finished === 'true' || params.exclude_finished === true;
    const geminiApiKey = params.gemini_api_key || CONFIG.GEMINI_API_KEY || '';

    let responseData = {};

    switch (action) {
      // 1. Sincronización de Reuniones de Calendar
      case 'sync_meetings': {
        const dateParam = params.date;
        const startTimeParam = params.start_time;
        const endTimeParam = params.end_time;

        let targetDate = new Date();
        if (dateParam) {
          const parts = dateParam.split('-');
          if (parts.length === 3) {
            targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          }
        }

        const result = generateDraftsForDate(targetDate, startTimeParam, endTimeParam, mondayApiKey, boardId, geminiApiKey, coeName);
        responseData = {
          status: 'success',
          date: Utilities.formatDate(targetDate, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          startTime: startTimeParam || '00:00',
          endTime: endTimeParam || '23:59',
          drafts: result.drafts,
          debug: result.debug
        };
        break;
      }

      // 2. Comparar Clientes de Monday vs Carpetas de Drive (con filtros)
      case 'sync_folders': {
        const result = syncClientFolders(rootFolderId, mondayApiKey, boardId, startDate, endDate, excludeFinished, coeName);
        responseData = {
          status: 'success',
          rootFolderId: rootFolderId,
          ...result
        };
        break;
      }

      // 3. Crear Carpetas Faltantes en Google Drive
      case 'create_missing_folders': {
        let clientNames = [];
        if (typeof params.client_names === 'string' && params.client_names.trim()) {
          try {
            clientNames = JSON.parse(params.client_names);
          } catch (err) {
            clientNames = params.client_names.split(',').map(s => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(params.client_names)) {
          clientNames = params.client_names;
        }

        // Si no se pasaron nombres específicos, autocalcular desde Monday aplicando los filtros de fecha
        if (!clientNames || clientNames.length === 0) {
          const syncRes = syncClientFolders(rootFolderId, mondayApiKey, boardId, startDate, endDate, excludeFinished, coeName);
          clientNames = syncRes.missingFolders.map(m => m.clientName);
        }

        const result = createMissingFolders(rootFolderId, clientNames);
        responseData = {
          status: 'success',
          ...result
        };
        break;
      }

      // 3b. Obtener o Buscar Carpeta de un Cliente Específico
      case 'get_client_folder': {
        const clientName = params.client_name || params.clientName || '';
        if (!rootFolderId || !clientName) {
          throw new Error('Falta rootFolderId o client_name');
        }
        const createIfMissing = params.create_if_missing === true || params.create_if_missing === 'true';
        const res = getOrCreateClientFolder(rootFolderId, clientName, createIfMissing);
        responseData = {
          status: 'success',
          rootFolderId: rootFolderId,
          ...res
        };
        break;
      }

      // 4. Escanear y Preclasificar Grabaciones de Google Meet (Soporte multi-carpetas)
      case 'scan_recordings': {
        const result = scanRecordingsToClassify(recordingsFolderIds, rootFolderId, mondayApiKey, boardId, startDate, endDate, coeName);
        responseData = {
          status: 'success',
          recordingsFolderIds: recordingsFolderIds,
          rootFolderId: rootFolderId,
          ...result
        };
        break;
      }

      // 5. Mover Grabaciones Clasificadas a las Carpetas de Clientes
      case 'move_recordings': {
        let moves = [];
        if (typeof params.moves === 'string') {
          try {
            moves = JSON.parse(params.moves);
          } catch (err) {
            moves = [];
          }
        } else if (Array.isArray(params.moves)) {
          moves = params.moves;
        }

        const result = moveClassifiedRecordings(moves);
        responseData = {
          status: 'success',
          ...result
        };
        break;
      }

      // 6. Obtener Clientes Asignados Pendientes de Kick Off ("Por celebrar KO")
      case 'get_ko_pending_clients': {
        const clients = getKOPendingClientsFromMonday(mondayApiKey, boardId, coeName);
        responseData = {
          status: 'success',
          total: clients.length,
          clients: clients
        };
        break;
      }

      // 7. Crear Borrador de Correo de Bienvenida en Gmail
      case 'create_welcome_draft': {
        const clientName = params.client_name || '';
        const recipient = params.recipient || '';
        const agendaUrl = params.agenda_url || 'https://calendar.app.google/pB82UFn8EE2AsXi19';
        const customHtml = params.html_body || '';
        const customSubject = params.subject || '';
        const headerAsset = params.header_asset || '';
        const footerAsset = params.footer_asset || '';

        const draftResult = createWelcomeGmailDraft(clientName, recipient, agendaUrl, customHtml, customSubject, {
          headerAsset: headerAsset,
          footerAsset: footerAsset
        });
        responseData = {
          status: 'success',
          ...draftResult
        };
        break;
      }

      // 7.1 Subir Imagen de Banner (Header / Footer) a Google Drive
      case 'upload_template_asset': {
        const rootFolderId = params.root_folder_id || CONFIG.ROOT_CLIENTS_FOLDER_ID;
        const fileName = params.file_name || ('asset_' + new Date().getTime() + '.png');
        const mimeType = params.mime_type || 'image/png';
        const fileBase64 = params.file_base64 || '';
        const assetType = params.asset_type || 'header';

        if (!fileBase64) {
          throw new Error('No se recibió el contenido del archivo en Base64.');
        }

        const rootFolder = DriveApp.getFolderById(rootFolderId);
        const assetFolders = rootFolder.getFoldersByName('_Plantillas_Assets');
        let assetFolder;
        if (assetFolders.hasNext()) {
          assetFolder = assetFolders.next();
        } else {
          assetFolder = rootFolder.createFolder('_Plantillas_Assets');
        }

        const cleanB64 = fileBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').replace(/\s+/g, '');
        const decodedBytes = Utilities.base64Decode(cleanB64);
        const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
        const file = assetFolder.createFile(blob);

        try {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e) {
          Logger.log('Aviso al configurar permisos de archivo: ' + e);
        }

        const fileId = file.getId();
        const directImageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
        const webViewLink = file.getUrl();

        responseData = {
          status: 'success',
          fileId: fileId,
          fileName: fileName,
          assetType: assetType,
          directImageUrl: directImageUrl,
          webViewLink: webViewLink
        };
        break;
      }

      // 8. Crear y Personalizar Presentación de Google Slides para Kick Off
      case 'create_kickoff_slides': {
        const templateId = params.slides_template_id || params.template_id || CONFIG.SLIDES_KICKOFF_TEMPLATE_ID;
        let folderId = params.folder_id || '';
        const clientName = params.client_name || '';

        if (!folderId && rootFolderId && clientName) {
          const folderRes = getOrCreateClientFolder(rootFolderId, clientName);
          folderId = folderRes.folderId;
        }

        const slidesResult = createClientKickOffPresentation(templateId, folderId, {
          name: clientName,
          urlBuk: params.url_buk || '',
          dotacion: params.dotacion || '',
          recintos: params.recintos || '',
          tipoMarcaje: params.tipo_marcaje || '',
          contraparte: params.contraparte || '',
          correoContraparte: params.correo_contraparte || params.recipient || '',
          telefonoContraparte: params.telefono_contraparte || ''
        });

        responseData = {
          status: 'success',
          ...slidesResult
        };
        break;
      }

      // 9. Automatización Integral de Onboarding (1-Clic - 4 Pasos)
      case 'onboard_client': {
        const clientName = params.client_name || '';
        const clientId = params.client_id || '';
        const recipient = params.recipient || '';
        const agendaUrl = params.agenda_url || 'https://calendar.app.google/pB82UFn8EE2AsXi19';
        const slidesTemplateId = params.slides_template_id || params.template_id || CONFIG.SLIDES_KICKOFF_TEMPLATE_ID;
        const createFolder = params.create_folder !== 'false' && params.create_folder !== false;
        const createSlides = params.create_slides !== 'false' && params.create_slides !== false;
        const updateMonday = params.update_monday !== 'false' && params.update_monday !== false;
        const createDraft = params.create_draft !== 'false' && params.create_draft !== false;
        const customHtml = params.html_body || '';
        const customSubject = params.subject || '';

        const result = executeClientOnboarding({
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
          customHtml,
          customSubject,
          urlBuk: params.url_buk || '',
          dotacion: params.dotacion || '',
          recintos: params.recintos || '',
          tipoMarcaje: params.tipo_marcaje || '',
          contraparte: params.contraparte || '',
          correoContraparte: params.correo_contraparte || recipient || '',
          telefonoContraparte: params.telefono_contraparte || ''
        });

        responseData = {
          status: 'success',
          ...result
        };
        break;
      }

      // 10. Obtener Transcripciones de la Carpeta del Cliente en Google Drive
      case 'get_client_transcripts': {
        const clientName = params.client_name || params.clientName || '';
        const folderId = params.folder_id || params.folderId || '';
        const folderUrl = params.folder_url || params.folderUrl || '';
        const transcriptsData = fetchClientTranscripts(folderId, folderUrl, clientName, rootFolderId);
        responseData = {
          status: 'success',
          ...transcriptsData
        };
        break;
      }

      default:
        throw new Error('Acción no soportada: ' + action);
    }

    return ContentService.createTextOutput(JSON.stringify(responseData)).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString(),
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Extrae el ID limpio de una carpeta de Google Drive a partir de una URL o ID directo
 */
function extractDriveFolderId(input) {
  if (!input) return '';
  const str = input.toString().trim();
  if (str === 'undefined' || str === 'null' || !str) return '';
  const match = str.match(/folders\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  const matchId = str.match(/id=([a-zA-Z0-9_-]+)/i);
  if (matchId) return matchId[1];
  const cleaned = str.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleaned === 'undefined' || cleaned === 'null') return '';
  return cleaned;
}

/**
 * Extrae el ID limpio de un archivo de Google Drive / Slides a partir de una URL o ID directo
 */
function extractDriveFileId(input) {
  if (!input) return '';
  const str = input.toString().trim();
  if (str === 'undefined' || str === 'null' || !str) return '';
  const matchD = str.match(/\/d\/([a-zA-Z0-9_-]+)/i);
  if (matchD) return matchD[1];
  const matchPresent = str.match(/presentation\/d\/([a-zA-Z0-9_-]+)/i);
  if (matchPresent) return matchPresent[1];
  const matchId = str.match(/id=([a-zA-Z0-9_-]+)/i);
  if (matchId) return matchId[1];
  const cleaned = str.replace(/[^a-zA-Z0-9_-]/g, '');
  if (cleaned === 'undefined' || cleaned === 'null') return '';
  return cleaned;
}

/**
 * ⚡ EJECUTA ESTA FUNCIÓN 1 SOLA VEZ EN EL EDITOR DE GOOGLE APPS SCRIPT
 * para autorizar los permisos de Google Slides, Gmail, Drive y Calendar.
 * (Al hacer clic en "Ejecutar" ▶️, Google abrirá la ventana de "Revisar permisos" y "Permitir").
 */
function autorizarPermisosDeGoogleSlides() {
  // Forzar activación del scope de SlidesApp y DriveApp
  const testDeck = SlidesApp.create('Test_Auth_Norma');
  const deckId = testDeck.getId();
  testDeck.saveAndClose();
  DriveApp.getFileById(deckId).setTrashed(true);
  Logger.log('🎉 ¡Permisos de Google Slides autorizados exitosamente!');
}

function autorizarPermisosDeGmail() {
  const testDraft = GmailApp.createDraft(
    'test@ejemplo.com',
    'Activación de Permisos - Norma Hub',
    'Permisos de Gmail autorizados correctamente para Norma Hub.'
  );
  testDraft.deleteDraft();
  Logger.log('🎉 ¡Permisos de Gmail autorizados exitosamente!');
}

function autorizarTodosLosPermisosNorma() {
  autorizarPermisosDeGoogleSlides();
  autorizarPermisosDeGmail();
  Logger.log('🎉 ¡TODOS LOS PERMISOS AUTORIZADOS CON ÉXITO PARA FRIDAY HUB!');
}

/**
 * Extrae una lista de IDs únicos de carpetas de Google Drive a partir de múltiples URLs o IDs
 * (Soporta cadenas separadas por coma, punto y coma, salto de línea o arrays)
 */
function extractDriveFolderIds(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    const list = [];
    input.forEach(it => {
      const extracted = extractDriveFolderIds(it);
      extracted.forEach(id => list.push(id));
    });
    return Array.from(new Set(list));
  }
  const str = input.toString().trim();
  const tokens = str.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const ids = [];
  tokens.forEach(tok => {
    const id = extractDriveFolderId(tok);
    if (id) ids.push(id);
  });
  return Array.from(new Set(ids));
}

/**
 * Normaliza nombres para comparación (sin tildes, sin signos, minúsculas)
 */
function normalizeName(name) {
  if (!name) return '';
  return name.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9]/g, ' ')       // Reemplaza caracteres especiales por espacio
    .replace(/\s+/g, ' ')            // Unifica espacios
    .trim();
}

/**
 * HERRAMIENTA 2A: Comparar Clientes Monday vs Carpetas Drive con Filtros de Fecha
 */
function syncClientFolders(rootFolderId, mondayApiKey, boardId, startDate, endDate, excludeFinished, coeName) {
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const rootFolderName = rootFolder.getName();
  const rootFolderUrl = rootFolder.getUrl();

  // 1. Obtener clientes filtrados de Monday
  const clients = getClientsFromMonday(mondayApiKey, boardId, startDate, endDate, excludeFinished, coeName);

  // 2. Obtener subcarpetas existentes en Drive
  const existingSubfolders = [];
  const folderIterator = rootFolder.getFolders();
  while (folderIterator.hasNext()) {
    const f = folderIterator.next();
    existingSubfolders.push({
      id: f.getId(),
      name: f.getName(),
      url: f.getUrl(),
      normalizedName: normalizeName(f.getName())
    });
  }

  const existingFolders = [];
  const missingFolders = [];

  clients.forEach(client => {
    const normClient = normalizeName(client.name);
    const cleanClient = normClient.replace(/\s+/g, '');

    // Buscar coincidencia en Drive
    const matchedFolder = existingSubfolders.find(f => {
      const normF = f.normalizedName;
      const cleanF = normF.replace(/\s+/g, '');
      if (normF === normClient || cleanF === cleanClient) return true;
      if (normClient.length >= 4 && (normF.includes(normClient) || normClient.includes(normF))) return true;
      return false;
    });

    if (matchedFolder) {
      existingFolders.push({
        clientId: client.id,
        clientName: client.name,
        etapa: client.etapa,
        fechaAsignacion: client.fechaAsignacion,
        folderId: matchedFolder.id,
        folderName: matchedFolder.name,
        folderUrl: matchedFolder.url
      });
    } else {
      missingFolders.push({
        clientId: client.id,
        clientName: client.name,
        etapa: client.etapa,
        fechaAsignacion: client.fechaAsignacion,
        suggestedName: client.name
      });
    }
  });

  return {
    rootFolderName: rootFolderName,
    rootFolderUrl: rootFolderUrl,
    totalClientsMonday: clients.length,
    existingCount: existingFolders.length,
    missingCount: missingFolders.length,
    existingFolders: existingFolders,
    missingFolders: missingFolders
  };
}

/**
 * HERRAMIENTA 2A: Crear Carpetas Faltantes en Drive
 */
function createMissingFolders(rootFolderId, clientNames) {
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const createdFolders = [];
  const errors = [];

  Logger.log('Iniciando creación para ' + clientNames.length + ' clientes...');

  clientNames.forEach(name => {
    try {
      let cleanName = (name || '').toString().trim();
      if (!cleanName) return;

      // Limpiar caracteres no válidos para nombres de carpetas
      cleanName = cleanName.replace(/[\/\\:*?"<>|]/g, '-').trim();

      // Verificar si ya existe antes de crear
      const existing = rootFolder.getFoldersByName(cleanName);
      if (existing.hasNext()) {
        const f = existing.next();
        Logger.log('ℹ️ Ya existía: ' + cleanName + ' (' + f.getId() + ')');
        createdFolders.push({
          clientName: cleanName,
          folderId: f.getId(),
          folderUrl: f.getUrl(),
          alreadyExisted: true
        });
      } else {
        const newFolder = rootFolder.createFolder(cleanName);
        Logger.log('✨ Creada nueva carpeta: ' + cleanName + ' (' + newFolder.getId() + ')');
        createdFolders.push({
          clientName: cleanName,
          folderId: newFolder.getId(),
          folderUrl: newFolder.getUrl(),
          alreadyExisted: false
        });
      }
    } catch (err) {
      Logger.log('❌ Error creando carpeta para "' + name + '": ' + err.toString());
      errors.push({ clientName: name, error: err.toString() });
    }
  });

  const newlyCreated = createdFolders.filter(f => !f.alreadyExisted).length;

  return {
    createdCount: newlyCreated,
    totalProcessed: createdFolders.length,
    createdFolders: createdFolders,
    errors: errors
  };
}

/**
 * HERRAMIENTA 2B: Escanear y Clasificar Grabaciones de Google Meet (Soporte Multi-Carpetas y Subcarpetas de Sesión)
 */
function scanRecordingsToClassify(recordingsFolderIds, rootFolderId, mondayApiKey, boardId, startDate, endDate, coeName) {
  const folderIds = extractDriveFolderIds(recordingsFolderIds);
  const rootFolder = DriveApp.getFolderById(rootFolderId);
  const tz = Session.getScriptTimeZone();

  // 1. Obtener todas las subcarpetas de clientes en Drive
  const clientFolders = [];
  const folderIter = rootFolder.getFolders();
  while (folderIter.hasNext()) {
    const f = folderIter.next();
    clientFolders.push({
      id: f.getId(),
      name: f.getName(),
      url: f.getUrl(),
      normalizedName: normalizeName(f.getName())
    });
  }

  // 2. Obtener clientes de Monday
  const clients = getClientsFromMonday(mondayApiKey, boardId, startDate, endDate, false, coeName);

  // 3. Escanear elementos (subcarpetas de reuniones y archivos sueltos) en cada carpeta de grabaciones
  const classified = [];
  const unmatched = [];
  const seenIds = {};
  const scannedFoldersInfo = [];

  // Helper para clasificar cualquier ítem (subcarpeta o archivo)
  function evaluateItemMatch(itemName) {
    const normName = normalizeName(itemName);
    let bestMatch = null;
    let highestScore = 0;

    // A. Comparar contra subcarpetas de clientes en Drive
    for (const folder of clientFolders) {
      let score = 0;
      const folderNorm = folder.normalizedName;
      const cleanFolder = folderNorm.replace(/\s+/g, '');
      const cleanItem = normName.replace(/\s+/g, '');

      if (cleanItem.includes(cleanFolder) && cleanFolder.length >= 3) {
        score = 90;
      } else if (normName.includes(folderNorm) && folderNorm.length >= 3) {
        score = 85;
      } else {
        const words = folderNorm.split(' ').filter(w => w.length > 3 && !['asistencia', 'control', 'buk', 'implementacion', 'capacitacion', 'reunion', 'sesion'].includes(w));
        let matchedWords = 0;
        words.forEach(w => {
          if (normName.includes(w)) matchedWords++;
        });
        if (words.length > 0 && matchedWords === words.length) {
          score = 75;
        } else if (matchedWords > 0) {
          score = 40 + (matchedWords * 15);
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = {
          folderId: folder.id,
          folderName: folder.name,
          clientName: folder.name
        };
      }
    }

    // B. Si no superó el umbral, comparar contra clientes de Monday y contrapartes
    if (highestScore < 70) {
      for (const client of clients) {
        let score = 0;
        const clientNorm = normalizeName(client.name);
        if (normName.includes(clientNorm) && clientNorm.length >= 3) {
          score = 80;
        }
        if (client.contraparte && normName.includes(normalizeName(client.contraparte))) {
          score = Math.max(score, 75);
        }

        if (score > highestScore) {
          const matchingFolder = clientFolders.find(f => f.normalizedName.includes(clientNorm) || clientNorm.includes(f.normalizedName));
          if (matchingFolder) {
            highestScore = score;
            bestMatch = {
              folderId: matchingFolder.id,
              folderName: matchingFolder.name,
              clientName: client.name
            };
          }
        }
      }
    }

    return { highestScore, bestMatch };
  }

  // Extraer fecha del nombre (YYYY/MM/DD o YYYY-MM-DD) o fecha de modificación
  function extractItemDate(itemName, lastUpdatedDate) {
    const match = itemName.match(/(\d{4})[\/-](\d{2})[\/-](\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return Utilities.formatDate(lastUpdatedDate, tz, 'yyyy-MM-dd');
  }

  folderIds.forEach(fId => {
    try {
      const recFolder = DriveApp.getFolderById(fId);
      const srcName = recFolder.getName();
      scannedFoldersInfo.push({ id: fId, name: srcName });

      // A. Escanear SUBCARPETAS de sesiones Meet (formato actual de Google Workspace)
      const subfolderIter = recFolder.getFolders();
      while (subfolderIter.hasNext()) {
        const subfolder = subfolderIter.next();
        const subfolderId = subfolder.getId();
        if (seenIds[subfolderId]) continue;
        seenIds[subfolderId] = true;

        const subfolderName = subfolder.getName();
        const dateStr = extractItemDate(subfolderName, subfolder.getLastUpdated());

        // Filtro por fecha si fue especificado
        if (startDate && dateStr < startDate) continue;
        if (endDate && dateStr > endDate) continue;

        const { highestScore, bestMatch } = evaluateItemMatch(subfolderName);

        const itemInfo = {
          fileId: subfolderId,
          itemId: subfolderId,
          itemType: 'folder',
          fileName: subfolderName,
          fileUrl: subfolder.getUrl(),
          sizeBytes: 0,
          lastUpdated: dateStr,
          sourceFolderId: fId,
          sourceFolderName: srcName
        };

        if (highestScore >= 70 && bestMatch) {
          classified.push({
            ...itemInfo,
            clientName: bestMatch.clientName,
            targetFolderId: bestMatch.folderId,
            targetFolderName: bestMatch.folderName,
            confidence: highestScore >= 85 ? 'Alta' : 'Media'
          });
        } else {
          unmatched.push({
            ...itemInfo,
            reason: 'No se identificó cliente o subcarpeta coincidente con suficiente certeza'
          });
        }
      }

      // B. Escanear ARCHIVOS sueltos en la raíz de la carpeta (videos mp4/mkv individuales)
      const filesIter = recFolder.getFiles();
      while (filesIter.hasNext()) {
        const file = filesIter.next();
        const fileId = file.getId();
        if (seenIds[fileId]) continue;
        seenIds[fileId] = true;

        const fileName = file.getName();
        const dateStr = extractItemDate(fileName, file.getLastUpdated());

        // Filtro por fecha si fue especificado
        if (startDate && dateStr < startDate) continue;
        if (endDate && dateStr > endDate) continue;

        const { highestScore, bestMatch } = evaluateItemMatch(fileName);

        const itemInfo = {
          fileId: fileId,
          itemId: fileId,
          itemType: 'file',
          fileName: fileName,
          fileUrl: file.getUrl(),
          sizeBytes: file.getSize(),
          lastUpdated: dateStr,
          sourceFolderId: fId,
          sourceFolderName: srcName
        };

        if (highestScore >= 70 && bestMatch) {
          classified.push({
            ...itemInfo,
            clientName: bestMatch.clientName,
            targetFolderId: bestMatch.folderId,
            targetFolderName: bestMatch.folderName,
            confidence: highestScore >= 85 ? 'Alta' : 'Media'
          });
        } else {
          unmatched.push({
            ...itemInfo,
            reason: 'No se identificó cliente o subcarpeta coincidente con suficiente certeza'
          });
        }
      }
    } catch (err) {
      Logger.log('Error escaneando carpeta ' + fId + ': ' + err.toString());
    }
  });

  return {
    scannedFolders: scannedFoldersInfo,
    totalRecordings: classified.length + unmatched.length,
    classifiedCount: classified.length,
    unmatchedCount: unmatched.length,
    classified: classified,
    unmatched: unmatched
  };
}

/**
 * HERRAMIENTA 2B: Mover Grabaciones y Subcarpetas de Sesión Aprobadas
 */
function moveClassifiedRecordings(moves) {
  const moved = [];
  const errors = [];

  moves.forEach(item => {
    const itemId = item.itemId || item.fileId;
    const itemType = item.itemType || item.type || 'file';

    try {
      const targetFolder = DriveApp.getFolderById(item.targetFolderId);
      let name = '';

      if (itemType === 'folder') {
        const folder = DriveApp.getFolderById(itemId);
        name = folder.getName();
        moveFolderSafely(folder, targetFolder);
      } else {
        const file = DriveApp.getFileById(itemId);
        name = file.getName();
        moveFileSafely(file, targetFolder);
      }

      moved.push({
        fileId: itemId,
        itemId: itemId,
        fileName: name,
        targetFolderName: targetFolder.getName()
      });
    } catch (err) {
      errors.push({
        fileId: itemId,
        itemId: itemId,
        error: err.toString()
      });
    }
  });

  return {
    movedCount: moved.length,
    moved: moved,
    errors: errors
  };
}

/**
 * Helpers para mover carpetas y archivos de forma 100% segura en Google Drive
 */
function moveFolderSafely(folder, targetFolder) {
  try {
    if (typeof folder.moveTo === 'function') {
      folder.moveTo(targetFolder);
      return;
    }
  } catch (e) {
    Logger.log('moveTo directo de carpeta falló, usando add/remove: ' + e.toString());
  }
  targetFolder.addFolder(folder);
  const parents = folder.getParents();
  while (parents.hasNext()) {
    parents.next().removeFolder(folder);
  }
}

function moveFileSafely(file, targetFolder) {
  try {
    if (typeof file.moveTo === 'function') {
      file.moveTo(targetFolder);
      return;
    }
  } catch (e) {
    Logger.log('moveTo directo de archivo falló, usando add/remove: ' + e.toString());
  }
  targetFolder.addFile(file);
  const parents = file.getParents();
  while (parents.hasNext()) {
    parents.next().removeFile(file);
  }
}

/**
 * HERRAMIENTA 1: Sincronizador de Reuniones de Calendar
 */
function generateDraftsForDate(targetDate, startTimeStr, endTimeStr, mondayApiKey, boardId, geminiApiKey, coeName) {
  const calendar = CalendarApp.getDefaultCalendar();
  const tz = Session.getScriptTimeZone();

  let startHour = 0, startMin = 0;
  let endHour = 23, endMin = 59;

  if (startTimeStr && startTimeStr.includes(':')) {
    const sParts = startTimeStr.split(':');
    startHour = parseInt(sParts[0], 10) || 0;
    startMin = parseInt(sParts[1], 10) || 0;
  }
  if (endTimeStr && endTimeStr.includes(':')) {
    const eParts = endTimeStr.split(':');
    endHour = parseInt(eParts[0], 10) || 23;
    endMin = parseInt(eParts[1], 10) || 59;
  }

  const startWindow = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), startHour, startMin, 0);
  const endWindow = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), endHour, endMin, 59);

  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);
  const allDayEvents = calendar.getEvents(dayStart, dayEnd);

  const clients = getClientsFromMonday(mondayApiKey, boardId, null, null, false, coeName);
  const drafts = [];
  const debug = {
    totalDayEvents: allDayEvents.length,
    totalClientsLoaded: clients.length,
    eventsInWindow: 0,
    eventsList: []
  };

  for (const event of allDayEvents) {
    const evStart = event.getStartTime();
    const evEnd = event.getEndTime();

    if (evEnd <= startWindow || evStart >= endWindow) {
      continue;
    }

    debug.eventsInWindow++;

    const title = event.getTitle();
    const description = event.getDescription() || '';
    const attendees = event.getGuestList().map(g => g.getEmail().toLowerCase());
    const evStartFormatted = Utilities.formatDate(evStart, tz, 'HH:mm');
    const evEndFormatted = Utilities.formatDate(evEnd, tz, 'HH:mm');

    const isIgnored = isInternalOrIgnored(title, attendees);
    const matchedClient = matchClient(title, attendees, description, clients);

    debug.eventsList.push({
      title: title,
      time: `${evStartFormatted} - ${evEndFormatted}`,
      attendees: attendees,
      isIgnored: isIgnored,
      matchedClient: matchedClient ? matchedClient.name : null
    });

    if (isIgnored) continue;
    if (!matchedClient) continue;

    const docInfo = findMeetingDoc(event, matchedClient, targetDate);
    const isKickOff = isKickOffMeeting(title, description + ' ' + (docInfo ? docInfo.text : ''));
    const dateFormatted = Utilities.formatDate(targetDate, tz, 'dd-MM-yyyy');

    const minutaDraft = isKickOff 
      ? buildKickOffMinuta(dateFormatted, docInfo, description, title, matchedClient, geminiApiKey, coeName)
      : buildFollowUpMinuta(dateFormatted, docInfo, description, title, matchedClient, geminiApiKey, coeName);

    let nextMeetingCard = null;
    const nextEvent = findNextMeetingForClient(matchedClient, new Date());
    if (nextEvent) {
      nextMeetingCard = buildNextMeetingCard(dateFormatted, nextEvent);
    }

    drafts.push({
      clientId: matchedClient.id,
      itemId: matchedClient.id,
      clientName: matchedClient.name,
      meetingTitle: title,
      meetingTime: `${evStartFormatted} - ${evEndFormatted}`,
      timeStr: `${evStartFormatted} - ${evEndFormatted}`,
      meetingType: isKickOff ? 'Kick Off' : 'Seguimiento',
      date: dateFormatted,
      dateStr: dateFormatted,
      docSource: docInfo ? docInfo.title : null,
      minutaDraft: minutaDraft,
      nextMeetingCard: nextMeetingCard
    });
  }

  return { drafts: drafts, debug: debug };
}

function findMeetingDoc(event, client, targetDate) {
  const fullText = (event.getDescription() || '') + ' ' + (event.getTitle() || '') + ' ' + (event.getLocation() || '');
  const match = fullText.match(/docs\.google\.com\/(?:document\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  if (match) {
    try {
      const doc = DocumentApp.openById(match[1]);
      return {
        id: match[1],
        title: doc.getName(),
        text: doc.getBody().getText()
      };
    } catch (e) {
      Logger.log('Error abriendo doc por URL: ' + e.message);
    }
  }

  // Revisar adjuntos directos del evento de Google Calendar
  try {
    if (typeof event.getAttachments === 'function') {
      const atts = event.getAttachments();
      if (atts && atts.length > 0) {
        for (const att of atts) {
          const mime = att.getMimeType ? att.getMimeType() : '';
          const name = (att.getName ? att.getName() : '').toLowerCase();
          if (mime === 'application/vnd.google-apps.document' || name.includes('notas') || name.includes('gemini')) {
            const docId = att.getFileId ? att.getFileId() : extractDriveFolderId(att.getUrl ? att.getUrl() : '');
            if (docId) {
              const doc = DocumentApp.openById(docId);
              return {
                id: docId,
                title: doc.getName(),
                text: doc.getBody().getText()
              };
            }
          }
        }
      }
    }
  } catch (errAtt) {
    Logger.log('Error revisando adjuntos de Calendar: ' + errAtt.message);
  }

  // Buscar en Google Drive archivos del día de la reunión (filtrando estrictamente por nombre de cliente y fecha exacta)
  try {
    const candidates = [];
    const eventTitle = event.getTitle().toLowerCase();
    const clientName = client ? client.name.toLowerCase() : '';
    const cleanClientName = clientName.replace(/[^a-z0-9]/g, '');

    const targetTime = targetDate ? targetDate.getTime() : new Date().getTime();
    const maxDiffMs = 24 * 60 * 60 * 1000; // Estrictamente el mismo día (máx 24h)

    if (clientName && clientName.length >= 3) {
      const q = `mimeType = 'application/vnd.google-apps.document' and trashed = false and title contains '${client.name.replace(/['\\]/g, '')}'`;
      try {
        const files = DriveApp.searchFiles(q);
        while (files.hasNext()) {
          const file = files.next();
          const fileName = file.getName().toLowerCase();
          const lastUpdated = file.getLastUpdated();
          const diffMs = Math.abs(lastUpdated.getTime() - targetTime);

          // Si el archivo no es del mismo día de la sesión, ignorar estrictamente
          if (diffMs > maxDiffMs) {
            continue;
          }

          let score = 50;
          if (fileName.includes(clientName) || (cleanClientName && fileName.replace(/[^a-z0-9]/g, '').includes(cleanClientName))) score += 40;
          if (fileName.includes('gemini') || fileName.includes('notas')) score += 10;

          candidates.push({
            file: file,
            name: file.getName(),
            score: score,
            lastUpdated: lastUpdated
          });
        }
      } catch (errQ) {
        Logger.log('Error en búsqueda de Drive: ' + errQ.message);
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0].file;
      const doc = DocumentApp.openById(best.getId());
      return {
        id: best.getId(),
        title: best.getName(),
        text: doc.getBody().getText()
      };
    }
  } catch (err) {
    Logger.log('Error buscando en Drive: ' + err.message);
  }

  return null;
}

function buildKickOffMinuta(datePrefix, docInfo, rawDescription, title, client, geminiApiKey, coeName) {
  if (!docInfo || !docInfo.text || docInfo.text.trim().length < 20) {
    return `${datePrefix}\n\n⚠️ No se encontraron notas ni transcripción de Kick Off para esta reunión. (No se generó borrador para evitar datos incorrectos).`;
  }

  // 1. Intentar redactar con Gemini API usando el prompt exacto de la Gema de Kick Off
  if (geminiApiKey) {
    const aiMinuta = generateMinutaWithGemini(docInfo.text, rawDescription, 'Kick Off', client ? client.name : '', datePrefix, geminiApiKey, coeName);
    if (aiMinuta) return aiMinuta;
  }

  // 2. Formateador nativo estructurado según la Gema
  return parseAndFormatManualStyle(docInfo.text, rawDescription, 'Kick Off', client, datePrefix, coeName);
}

function buildFollowUpMinuta(datePrefix, docInfo, rawDescription, title, client, geminiApiKey, coeName) {
  if (!docInfo || !docInfo.text || docInfo.text.trim().length < 20) {
    return `${datePrefix}\n\n⚠️ No se encontraron notas ni transcripción de Seguimiento para esta reunión. (No se generó borrador para evitar datos incorrectos).`;
  }

  // 1. Intentar redactar con Gemini API usando el prompt exacto de la Gema de Seguimiento
  if (geminiApiKey) {
    const aiMinuta = generateMinutaWithGemini(docInfo.text, rawDescription, 'Seguimiento', client ? client.name : '', datePrefix, geminiApiKey, coeName);
    if (aiMinuta) return aiMinuta;
  }

  // 2. Formateador nativo estructurado según la Gema
  return parseAndFormatManualStyle(docInfo.text, rawDescription, 'Seguimiento', client, datePrefix, coeName);
}

/**
 * Genera la minuta utilizando la API de Google Gemini adoptando las instrucciones exactas de las Gemas de Buk
 */
function generateMinutaWithGemini(docText, rawDescription, meetingType, clientName, dateFormatted, apiKey, coeName) {
  if (!apiKey) return null;
  try {
    let prompt = '';
    const coeLabel = (coeName || '').trim();
    const coeRef = coeLabel ? `"${coeLabel}"` : 'el/la Consultor/a';

    if (meetingType === 'Kick Off') {
      prompt = `Eres el asistente de operaciones de Buk para el/la Consultor/a COE (identificado/a estrictamente como "la COE").
Por favor, toma el contenido del archivo de notas y:

1. Reestructura las notas en las siguientes 6 secciones, comenzando siempre con la fecha ${dateFormatted} en la primera línea:

${dateFormatted}

- Detalles del Cliente: detalles de como funciona su empresa (por ejemplo, por que contrato Buk, cuantas personas marcaran asistencia, horarios de trabajo, como marcaran asistencia , etc) en un formato de lista punteada.
- Notas de la Sesión: Esta sección debe resumir lo que se habló y se hizo durante la reunión, ojala el resumen no dure mas de 1 párrafo. Intenta ser lo mas resumido posible.
- Temas que se revisaran en la siguiente sesión:
- Tareas del Cliente: Esta sección debe detallar qué se le solicitó originalmente a la persona que hiciera para la próxima reunión.
- Tareas del PM: Esta sección debe detallar a qué cosas se comprometió originalmente la persona identificada como ${coeRef} o 'la COE'.
- Fecha exacta de la próxima reunión, de no encontrarla omitir esta instrucción.
- Si después de analizar las notas, no encuentras información que encaje específicamente en alguna de estas categorías, indica "no aplica" para esa sección.

2. Una vez que las notas estén reestructuradas según el punto anterior, realiza los siguientes reemplazos en todo el texto resultante:

- Reemplaza todas las instancias de ${coeLabel ? `"${coeLabel}", ` : ''}"Constanza Diaz", "Constanza Díaz", "Cony" por "la COE".
- Reemplaza todas las instancias de "Book" (cuando se refiere al software o módulo) por "Buk".

REGLAS OBLIGATORIAS:
- Cero alucinación: Utiliza ÚNICAMENTE la información explícita de las notas. No agregues datos inventados.
- Omite artefactos de Google Meet como marcas de tiempo "(00:01:58)", "Invitado", "Registros de la reunión", etc.
- Devuelve ÚNICAMENTE el texto final de la minuta listo para Monday.com, sin explicaciones ni bloques \`\`\`.`;
    } else {
      prompt = `Eres el asistente de operaciones de Buk para el/la Consultor/a COE (identificado/a estrictamente como "la COE").
Por favor, toma el contenido del archivo y:

1. Reestructura las notas en las siguientes 5 secciones, comenzando siempre con la fecha ${dateFormatted} en la primera línea:

${dateFormatted}

- Notas de la Sesión: Esta sección debe resumir lo que se habló y se hizo durante la reunión, ojala el resumen no dure mas de 2 párrafos. Intenta ser lo mas resumido posible.
- Temas que se revisaran en la siguiente sesión:
- Tareas del Cliente: Esta sección debe detallar qué se le solicitó originalmente a la persona que hiciera para la próxima reunión.
- Tareas del PM: Esta sección debe detallar a qué cosas se comprometió originalmente la persona identificada como ${coeRef} o 'la COE'.
- Fecha exacta de la próxima reunión, de no encontrarla omitir esta instrucción.
- Si después de analizar las notas, no encuentras información que encaje específicamente en alguna de estas categorías, indica "no aplica" para esa sección.

2. Una vez que las notas estén reestructuradas según el punto anterior, realiza los siguientes reemplazos en todo el texto resultante:

- Reemplaza todas las instancias de ${coeLabel ? `"${coeLabel}", ` : ''}"Constanza Diaz", "Constanza Díaz", "Cony" por "la COE".
- Reemplaza todas las instancias de "Book" (cuando se refiere al software o módulo) por "Buk".

REGLAS OBLIGATORIAS:
- Cero alucinación: Utiliza ÚNICAMENTE la información explícita de las notas. No agregues datos inventados.
- Omite artefactos de Google Meet como marcas de tiempo "(00:01:58)", "Invitado", "Registros de la reunión", etc.
- Devuelve ÚNICAMENTE el texto final de la minuta listo para Monday.com, sin explicaciones ni bloques \`\`\`.`;
    }

    const payload = {
      contents: [{
        parts: [{ text: `${prompt}\n\nNOTAS BRUTAS / TRANSCRIPCIÓN DE LA REUNIÓN (${clientName}):\n${docText}\n\nINFORMACIÓN ADICIONAL DEL EVENTO:\n${rawDescription}` }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192
      }
    };

    const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const options = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const json = JSON.parse(response.getContentText());

        if (json.error) {
          Logger.log('Error de Gemini API en modelo ' + model + ': ' + JSON.stringify(json.error));
          continue;
        }

        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts && json.candidates[0].content.parts[0]) {
          const finishReason = json.candidates[0].finishReason;
          Logger.log('Gemini finishReason para ' + clientName + ': ' + finishReason);
          const generated = json.candidates[0].content.parts[0].text.trim();
          if (generated.length > 50) {
            return applyStandardReplacements(generated, coeName);
          }
        }
      } catch (e) {
        Logger.log('Excepción con modelo ' + model + ': ' + e.toString());
      }
    }
  } catch (err) {
    Logger.log('Error general en generateMinutaWithGemini: ' + err.toString());
  }
  return null;
}

/**
 * Formateador estructurado de respaldo nativo sin invención de datos
 */
function parseAndFormatManualStyle(docText, rawDescription, meetingType, client, datePrefix, coeName) {
  const isKO = meetingType === 'Kick Off';
  const cleanDoc = cleanDocText(docText);
  const lines = cleanDoc.split('\n').map(l => l.trim()).filter(Boolean);

  let detallesCliente = '';
  const contraparteText = cleanHtml(rawDescription);
  const progMatch = contraparteText.match(/Programada por[:\s]+([^<\n\r]+)/i);
  const cargoMatch = contraparteText.match(/Cargo[:\s]+([^<\n\r]+)/i);

  if (progMatch) {
    detallesCliente = `- Contraparte: ${progMatch[1].trim()}`;
    if (cargoMatch) detallesCliente += ` (${cargoMatch[1].trim()})`;
  } else if (client && (client.contraparte || client.correoContraparte)) {
    detallesCliente = `- Contraparte: ${client.contraparte || ''} ${client.correoContraparte ? '<' + client.correoContraparte + '>' : ''}`;
  } else {
    detallesCliente = 'no aplica';
  }

  const clientTasks = [];
  const pmTasks = [];
  const nextTopics = [];
  const narrativeLines = [];
  let fechaProxima = '';

  const coeLower = (coeName || '').toLowerCase().trim();
  const coeFirst = coeLower ? coeLower.split(' ')[0] : '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lLower = line.toLowerCase();

    // Descartar basura de Meet
    if (lLower.includes('revisa las') || lLower.includes('calidad de estas notas') || lLower.includes('cómo es la calidad') || lLower.includes('descubre cómo gemini') || lLower.includes('tomar notas en la reunión') || lLower.includes('archivos adjuntos') || lLower.includes('registros de la reunión') || lLower === 'invitado' || lLower === 'detalles' || lLower === 'decisiones' || lLower === 'acordada') {
      continue;
    }

    // Detectar tareas asignadas con formato [Nombre] Tarea: Descripción o similar
    const taskMatch = line.match(/^[-*•]?\s*\[([^\]]+)\]\s*([^:]+)?:\s*(.+)$/) || line.match(/^[-*•]?\s*\[([^\]]+)\]\s*(.+)$/);
    if (taskMatch) {
      const person = taskMatch[1].trim();
      const taskDesc = (taskMatch[3] ? `${taskMatch[2].trim() ? taskMatch[2].trim() + ': ' : ''}${taskMatch[3].trim()}` : taskMatch[2] ? taskMatch[2].trim() : '').trim();
      const personLower = person.toLowerCase();

      const isCoe = (coeFirst && personLower.includes(coeFirst)) || (coeLower && personLower.includes(coeLower)) || personLower.includes('constanza') || personLower.includes('cony') || personLower.includes('coe') || personLower.includes('pm');
      if (isCoe) {
        pmTasks.push(`- la COE: ${taskDesc}`);
      } else {
        clientTasks.push(`- ${person}: ${taskDesc}`);
      }
      continue;
    }

    // Detectar tareas manuales con formato > Nombre: Tarea o - Nombre: Tarea
    const manualTaskMatch = line.match(/^[-*•>]?\s*([^:]+):\s*(.+)$/);
    if (manualTaskMatch && manualTaskMatch[1].length < 30) {
      const person = manualTaskMatch[1].trim();
      const taskDesc = manualTaskMatch[2].trim();
      const personLower = person.toLowerCase();

      const isCoe = (coeFirst && personLower.includes(coeFirst)) || (coeLower && personLower.includes(coeLower)) || personLower.includes('constanza') || personLower.includes('cony') || personLower.includes('coe');
      if (isCoe) {
        pmTasks.push(`- la COE: ${taskDesc}`);
      } else if (personLower.includes('cliente') || personLower.includes('contraparte') || person.length > 2) {
        clientTasks.push(`- ${person}: ${taskDesc}`);
      }
      continue;
    }

    // Detectar acuerdos de próxima reunión
    if (lLower.includes('programación de reunión') || lLower.includes('reunión de seguimiento') || lLower.includes('sesión de seguimiento') || lLower.includes('próxima reunión') || lLower.includes('siguiente reunión')) {
      const cleanTopic = line.replace(/^(?:programación de reunión|acordada|decisiones)[:\s]*/i, '').replace(/\(\d{2}:\d{2}:\d{2}\)/g, '').trim();
      if (cleanTopic.length > 15 && !nextTopics.includes(`- ${cleanTopic}`)) {
        nextTopics.push(`- ${cleanTopic}`);
      }
      
      const timeMatch = line.match(/(?:próximo|el)\s+(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|\d{1,2}(?:\s+de\s+[a-z]+)?)\s+(?:a las\s+)?(\d{1,2}:\d{2})/i);
      if (timeMatch) {
        fechaProxima = `${timeMatch[0].charAt(0).toUpperCase() + timeMatch[0].slice(1)} hrs`;
      }
      continue;
    }

    // Narrativa de lo conversado
    const cleanNarrative = line.replace(/\(\d{2}:\d{2}:\d{2}\)/g, '').replace(/^[•\-\*]\s*/, '').trim();
    if (cleanNarrative.length > 25 && !cleanNarrative.startsWith('[') && !cleanNarrative.startsWith('>')) {
      narrativeLines.push(cleanNarrative);
    }
  }

  // Notas de la sesión: resumido en 1 párrafo (KO) o máx 2 párrafos (Seguimiento)
  let notasSesion = '';
  if (narrativeLines.length > 0) {
    notasSesion = narrativeLines.slice(0, isKO ? 2 : 4).join('. ') + '.';
  } else {
    notasSesion = 'no aplica';
  }

  let content = `${datePrefix}\n\n`;
  if (isKO) {
    content += `Detalles del Cliente:\n${detallesCliente.startsWith('-') ? detallesCliente : '- ' + detallesCliente}\n\n`;
  }
  content += `Notas de la Sesión:\n${notasSesion}\n\n`;
  content += `Temas que se revisaran en la siguiente sesión:\n${nextTopics.length > 0 ? nextTopics.join('\n') : 'no aplica'}\n\n`;
  content += `Tareas del Cliente:\n${clientTasks.length > 0 ? clientTasks.join('\n') : 'no aplica'}\n\n`;
  content += `Tareas del PM:\n${pmTasks.length > 0 ? pmTasks.join('\n') : 'no aplica'}\n`;

  if (fechaProxima) {
    content += `\nFecha exacta de la próxima reunión:\n${fechaProxima}\n`;
  }

  return applyStandardReplacements(content, coeName);
}

function cleanHtml(str) {
  if (!str) return '';
  return str
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();
}

function cleanDocText(text) {
  if (!text) return '';
  return text
    .replace(/Notas de Gemini/gi, '')
    .replace(/Tomar notas en la reunión/gi, '')
    .trim();
}

function buildNextMeetingCard(datePrefix, nextEvent) {
  const title = nextEvent.getTitle();
  const startTime = nextEvent.getStartTime();
  const endTime = nextEvent.getEndTime();
  const meetLink = extractMeetLink(nextEvent);

  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const diaSemana = dias[startTime.getDay()];
  const diaNum = startTime.getDate();
  const mes = meses[startTime.getMonth()];
  const anio = startTime.getFullYear();

  const horaInicio = Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm');
  const horaFin = Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm');

  const guests = nextEvent.getGuestList().map(g => g.getEmail()).filter(e => !e.includes('buk.cl')).join(', ');

  let card = `${datePrefix} | 📆 Próxima Sesión Agendada en Google Calendar\n\n`;
  card += `📌 Evento: ${title}\n`;
  card += `📅 Fecha: ${diaSemana} ${diaNum} de ${mes} de ${anio}\n`;
  card += `⏰ Horario: ${horaInicio} a ${horaFin} hrs\n`;
  if (meetLink) card += `📹 Google Meet: ${meetLink}\n`;
  if (guests) card += `👥 Invitados: ${guests}\n`;
  card += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return card;
}

function applyStandardReplacements(text, coeName) {
  if (!text) return '';
  let result = text
    .replace(/Constanza D[ií]az/gi, 'la COE')
    .replace(/\bBook\b/gi, 'Buk');

  if (coeName && coeName.trim()) {
    try {
      const escaped = coeName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), 'la COE');
    } catch (e) {}
  }
  return result;
}

function matchClient(eventTitle, attendees, description, clients) {
  const cleanTitle = eventTitle.toLowerCase();
  for (const c of clients) {
    const cName = c.name.toLowerCase();
    const cNameClean = cName.replace(/[^a-z0-9]/g, '');
    if ((cName.length >= 3 && cleanTitle.includes(cName)) || (cNameClean.length >= 3 && cleanTitle.replace(/[^a-z0-9]/g, '').includes(cNameClean))) return c;
    if (c.contraparte && c.contraparte.length > 3 && cleanTitle.includes(c.contraparte.toLowerCase())) return c;
  }
  for (const email of attendees) {
    if (email.includes('buk.cl')) continue;
    const domain = email.split('@')[1]?.split('.')[0];
    for (const c of clients) {
      if (c.correoContraparte && c.correoContraparte.toLowerCase() === email) return c;
      if (domain && domain.length >= 3) {
        if (c.urlBuk && c.urlBuk.toLowerCase().includes(domain)) return c;
        if (c.name.toLowerCase().includes(domain)) return c;
        if (c.name.replace(/[^a-z0-9]/g, '').toLowerCase().includes(domain)) return c;
      }
    }
  }
  const cleanDesc = description.toLowerCase();
  for (const c of clients) {
    const cName = c.name.toLowerCase();
    if (cName.length >= 3 && cleanDesc.includes(cName)) return c;
    if (c.contraparte && c.contraparte.length > 3 && cleanDesc.includes(c.contraparte.toLowerCase())) return c;
  }
  return null;
}

function findNextMeetingForClient(client, fromDate) {
  const calendar = CalendarApp.getDefaultCalendar();
  const toDate = new Date(fromDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  const events = calendar.getEvents(fromDate, toDate);

  for (const ev of events) {
    const title = ev.getTitle().toLowerCase();
    if (title.includes(client.name.toLowerCase())) return ev;
    const guests = ev.getGuestList().map(g => g.getEmail().toLowerCase());
    if (client.correoContraparte && guests.includes(client.correoContraparte.toLowerCase())) return ev;
  }
  return null;
}

function extractMeetLink(event) {
  const desc = (event.getDescription() || '') + ' ' + (event.getLocation() || '');
  const match = desc.match(/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i);
  return match ? `https://${match[0]}` : '';
}

function isKickOffMeeting(title, text) {
  const t = (title + ' ' + text).toLowerCase();
  return t.includes('kick off') || t.includes('kickoff') || t.includes(' ko ') || t.startsWith('ko');
}

function isInternalOrIgnored(title, attendees) {
  const t = title.toLowerCase();
  if (t.includes('almuerzo') || t.includes('1:1') || t.includes('daily') || t.includes('sync coe') || t.includes('planning') || t.includes('capacitación interna')) return true;
  const external = attendees.filter(e => !e.includes('buk.cl'));
  if (external.length === 0 && !t.includes('cliente') && !t.includes('ko') && !t.includes('seguimiento')) return true;
  return false;
}

/**
 * Consulta los clientes en Monday con soporte para filtros de persona/COE, fecha de asignación y etapa
 */
function getClientsFromMonday(apiKey, boardId, startDate, endDate, excludeFinished, coeName) {
  const token = apiKey || CONFIG.MONDAY_API_KEY;
  const bId = boardId || CONFIG.BOARD_ID;
  const person = (coeName || CONFIG.COE_NAME || '').trim();

  if (!token || token.includes('TU_API_KEY')) {
    Logger.log('Error: Monday API key no configurada');
    return [];
  }

  let query;
  if (person) {
    query = `
      query {
        items_page_by_column_values(
          board_id: ${bId},
          columns: [{ column_id: "person", column_values: ["${person}"] }],
          limit: 500
        ) {
          items {
            id
            name
            column_values(ids: [
              "dup__of_url_buk_reflejo6__1",
              "lookup",
              "texto7",
              "dup__of_contraparte_corp4",
              "fecha_Mjj44wY8",
              "dup__of_criticidad4"
            ]) {
              id
              text
            }
          }
        }
      }
    `;
  } else {
    query = `
      query {
        boards(ids: [${bId}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: [
                "dup__of_url_buk_reflejo6__1",
                "lookup",
                "texto7",
                "dup__of_contraparte_corp4",
                "fecha_Mjj44wY8",
                "dup__of_criticidad4"
              ]) {
                id
                text
              }
            }
          }
        }
      }
    `;
  }

  const res = callMondayAPI(query, token);
  const rawItems = res?.data?.items_page_by_column_values?.items || res?.data?.boards?.[0]?.items_page?.items || [];

  const allClients = rawItems.map(it => {
    const colMap = {};
    it.column_values.forEach(cv => colMap[cv.id] = cv.text);
    return {
      id: it.id,
      name: it.name,
      urlBuk: colMap['dup__of_url_buk_reflejo6__1'] || colMap['lookup'] || '',
      contraparte: colMap['texto7'] || '',
      correoContraparte: colMap['dup__of_contraparte_corp4'] || '',
      fechaAsignacion: colMap['fecha_Mjj44wY8'] || '',
      etapa: colMap['dup__of_criticidad4'] || ''
    };
  });

  // Aplicar filtros
  return allClients.filter(c => {
    // Filtro por fecha de asignación COE Asist (Asign)
    if (startDate && c.fechaAsignacion && c.fechaAsignacion < startDate) return false;
    if (endDate && c.fechaAsignacion && c.fechaAsignacion > endDate) return false;

    // Si se especificó un rango de fecha pero el cliente no tiene fecha asignada, se excluye
    if ((startDate || endDate) && !c.fechaAsignacion) return false;

    // Filtro de exclusión de finalizados
    if (excludeFinished && c.etapa && c.etapa.toLowerCase().includes('finalizado')) return false;

    return true;
  });
}

/** Alias de compatibilidad hacia atrás */
function getConyClientsFromMonday(apiKey, boardId, startDate, endDate, excludeFinished, coeName) {
  return getClientsFromMonday(apiKey, boardId, startDate, endDate, excludeFinished, coeName);
}

function callMondayAPI(query, apiKey) {
  const token = apiKey || CONFIG.MONDAY_API_KEY;
  const options = {
    method: 'post',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      'API-Version': '2024-01'
    },
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://api.monday.com/v2', options);
  return JSON.parse(response.getContentText());
}

/**
 * Obtiene los clientes asignados en Monday cuyo estado sea 'Por celebrar KO'
 */
function getKOPendingClientsFromMonday(apiKey, boardId, customCoeName) {
  const bId = boardId || CONFIG.BOARD_ID;
  const token = apiKey || CONFIG.MONDAY_API_KEY;
  const coeName = (customCoeName || CONFIG.COE_NAME || '').trim();

  let query;
  if (coeName) {
    query = `
      query GetKOPendingClients {
        items_page_by_column_values(
          board_id: ${bId},
          columns: [{ column_id: "person", column_values: ["${coeName}"] }],
          limit: 150
        ) {
          items {
            id
            name
            column_values {
              id
              text
              value
            }
          }
        }
      }
    `;
  } else {
    query = `
      query GetKOPendingClients {
        boards(ids: [${bId}]) {
          items_page(limit: 150) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
  }

  const res = callMondayAPI(query, token);
  const items = res?.data?.items_page_by_column_values?.items || res?.data?.boards?.[0]?.items_page?.items || [];

  const koClients = [];
  items.forEach(it => {
    const colMap = {};
    it.column_values.forEach(cv => colMap[cv.id] = cv.text || '');

    const statusVal = colMap['status'] || '';
    const etapaVal = colMap['dup__of_criticidad4'] || '';

    // Filtrar clientes en estado 'Por celebrar KO' o en etapa 'Coordinando KickOffr'
    if (statusVal.toLowerCase().includes('por celebrar') || statusVal.toLowerCase().includes('celebrar ko') || etapaVal.toLowerCase().includes('coordinando kickoff')) {
      let urlBuk = colMap['dup__of_url_buk_reflejo6__1'] || colMap['lookup'] || '';
      urlBuk = urlBuk.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();

      koClients.push({
        id: it.id,
        name: it.name,
        status: statusVal || 'Por celebrar KO',
        etapa: etapaVal || 'Coordinando KickOffr',
        contraparte: colMap['texto7'] || '',
        correoContraparte: colMap['dup__of_contraparte_corp4'] || '',
        telefonoContraparte: colMap['dup__of_mail_contraparte_corp'] || '',
        urlBuk: urlBuk,
        dotacion: parseInt(colMap['registros_estimados'] || colMap['numeric'] || '0', 10) || 0,
        recintos: parseInt(colMap['recintos_a_implementar'] || '1', 10) || 1,
        tipoMarcaje: colMap['estado3'] || 'APPs Móviles / Web',
        comentariosSales: colMap['texto0'] || '',
        fechaAsignacion: colMap['fecha_Mjj44wY8'] || '',
        lider: colMap['multiple_person'] || colMap['multiple_person_mm511g3a'] || 'Rusmeli Angel',
        celula: colMap['c_lula__1'] || 'Célula S Asistencia'
      });
    }
  });

  return koClients;
}

/**
 * Genera el cuerpo HTML oficial y estilizado del correo de bienvenida para el cliente
 * Usa entidades HTML estándar (&#128153;, &#128522;, &#128073;, &#128640;) para garantizar
 * que los emojis se vean perfectos a todo color en cualquier cliente de correo sin problemas de encoding.
 */
function buildWelcomeEmailHtml(clientName, agendaUrl) {
  const url = agendaUrl || 'https://calendar.app.google/pB82UFn8EE2AsXi19';
  const cleanClientName = clientName ? clientName.trim() : 'Equipo';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; line-height: 1.6; margin: 0; padding: 0; }
    .email-container { max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .header-banner { background: #1b3d8b; color: #ffffff; padding: 30px 20px; text-align: center; }
    .header-title { font-size: 26px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.5px; }
    .header-subtitle { font-size: 16px; color: #f59e0b; margin: 0 0 12px 0; font-weight: 600; }
    .header-brand { font-size: 14px; opacity: 0.9; }
    .email-body { padding: 30px 35px; font-size: 15px; color: #334155; }
    .greeting { font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 18px; }
    .cta-container { text-align: center; margin: 30px 0; }
    .cta-link { color: #1a73e8; font-size: 16px; font-weight: 700; text-decoration: underline; display: inline-block; padding: 10px 18px; }
    .footer-section { margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 14px; color: #475569; }
    .footer-brand { color: #2563eb; font-weight: 700; font-size: 15px; }
    .footer-banner { background: #374151; color: #e2e8f0; padding: 20px; text-align: center; font-size: 13px; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-banner">
      <div style="font-size: 13px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8; margin-bottom: 4px;">&#161;Bienvenid@ a Buk! &#128153;</div>
      <h1 class="header-title">&#161;Bienvenid@ al m&oacute;dulo de Asistencia!</h1>
      <div class="header-subtitle">Comencemos este nuevo desaf&iacute;o ;)</div>
      <div class="header-brand"><strong>buk</strong> &bull; Gesti&oacute;n de Personas</div>
    </div>

    <div class="email-body">
      <div class="greeting">&#161;Hola equipo ${cleanClientName}! &#128522;</div>

      <p>Mi nombre es <strong>Cony</strong> y ser&eacute; qui&eacute;n les acompa&ntilde;e en esta etapa de implementaci&oacute;n de nuestro m&oacute;dulo <strong>Control de Asistencia</strong>.</p>

      <p>Como primer paso, realizaremos nuestra reuni&oacute;n "kick off", la cual consiste en una instancia virtual para conocernos y revisar los puntos necesarios para comenzar el proceso de implementaci&oacute;n.</p>

      <div class="cta-container">
        <a href="${url}" target="_blank" class="cta-link">
          &#128073; Puedes hacer click aqui para agendar tu primera sesi&oacute;n.
        </a>
      </div>

      <p>En caso de que no puedas asistir a la reuni&oacute;n programada, com&eacute;ntamelo y as&iacute; podremos agendar una nueva fecha.</p>

      <p style="margin-top: 24px;">Quedo atenta y disponible para ayudarte.</p>

      <div class="footer-section">
        <p style="margin: 0 0 4px 0;">Saludos,</p>
        <div class="footer-brand">Tu experiencia con Buk</div>
      </div>
    </div>

    <div class="footer-banner">
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">&#128640; S&uacute;mate a la experiencia Buk</div>
      <div style="opacity: 0.85;">Descubre Buk &bull; Crea un lugar de trabajo m&aacute;s feliz</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Crea un borrador oficial en la bandeja de borradores de Gmail (Google Workspace)
 */
function createWelcomeGmailDraft(clientName, recipient, agendaUrl, customHtml, customSubject, bannerOptions) {
  const cleanClient = clientName ? clientName.trim() : '';
  const to = recipient ? recipient.trim() : '';
  bannerOptions = bannerOptions || {};
  
  // Usar el asunto personalizado recibido o el asunto por defecto
  let subject = customSubject ? customSubject.trim() : '';
  if (!subject) {
    subject = `¡Bienvenid@ a Buk! 🚀 Coordinación de Kick Off - Módulo Control de Asistencia | ${cleanClient}`;
  } else {
    // Sanitizar residuos de caracteres corruptos \uFFFD o \uFFFE
    subject = subject.replace(/[\uFFFD\uFFFE]+/g, '🚀');
    if (!subject.includes('🚀') && subject.includes('Coordinación de Kick Off')) {
      subject = subject.replace(/¡?Bienvenid@? a Buk!?\s*[^a-zA-Z0-9\s]*\s*Coordinación/i, '¡Bienvenid@ a Buk! 🚀 Coordinación');
    }
  }

  let htmlBody = customHtml;
  if (!htmlBody || !htmlBody.trim()) {
    htmlBody = buildWelcomeEmailHtml(cleanClient, agendaUrl);
  }

  const inlineImages = {};

  // Plantillas oficiales de respaldo para banners Buk en HTML limpio por si no hay imagen de Drive configurada
  const fallbackHeaderHtml = '<div style="background-color: #1b3d8b; color: #ffffff; padding: 28px 20px; text-align: center; border-radius: 8px 8px 0 0; margin-bottom: 24px;">' +
    '<div style="font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85; margin-bottom: 4px; font-weight: 600;">&#161;Bienvenid@ a Buk! &#128153;</div>' +
    '<h1 style="font-size: 24px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.5px; color: #ffffff;">&#161;Bienvenid@ al m&oacute;dulo de Asistencia!</h1>' +
    '<div style="font-size: 15px; color: #f59e0b; margin: 0 0 8px 0; font-weight: 600;">Comencemos este nuevo desaf&iacute;o ;)</div>' +
    '<div style="font-size: 13px; opacity: 0.9;"><strong>buk</strong> &bull; Gesti&oacute;n de Personas</div>' +
    '</div>';

  const fallbackFooterHtml = '<div style="background-color: #ffffff; border-top: 2px solid #e2e8f0; color: #1e3a8a; padding: 20px; text-align: center; font-size: 13px; border-radius: 0 0 8px 8px; margin-top: 30px;">' +
    '<div style="font-weight: 700; font-size: 15px; margin-bottom: 4px; color: #1e3a8a;">&#128640; S&uacute;mate a la experiencia Buk</div>' +
    '<div style="opacity: 0.85; color: #475569;">Descubre Buk &bull; Crea un lugar de trabajo m&aacute;s feliz</div>' +
    '</div>';

  // 1. Procesar Banner Superior (Header) si viene de Drive o Base64 Data URL
  const headerAsset = bannerOptions.headerAsset;
  const headerFileId = extractDriveFileId(headerAsset);
  if (headerFileId) {
    try {
      const headerFile = DriveApp.getFileById(headerFileId);
      const headerBlob = headerFile.getBlob().setName('welcome_header.png');
      inlineImages['welcome_header'] = headerBlob;
      if (htmlBody.includes('{{header_banner}}')) {
        htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, '<img src="cid:welcome_header" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />');
      } else if (htmlBody.includes('{{header_image_url}}')) {
        htmlBody = htmlBody.replace(/\{\{header_image_url\}\}/g, 'cid:welcome_header');
      } else {
        htmlBody = '<div style="text-align: center; margin-bottom: 20px;"><img src="cid:welcome_header" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" /></div>' + htmlBody;
      }
    } catch (e) {
      Logger.log('Aviso al procesar header de Drive: ' + e);
      htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, fallbackHeaderHtml);
    }
  } else if (typeof headerAsset === 'string' && headerAsset.startsWith('data:image/')) {
    try {
      const headerB64 = headerAsset.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').replace(/\s+/g, '');
      const headerBytes = Utilities.base64Decode(headerB64);
      const headerBlob = Utilities.newBlob(headerBytes, 'image/png', 'welcome_header.png');
      inlineImages['welcome_header'] = headerBlob;
      if (htmlBody.includes('{{header_banner}}')) {
        htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, '<img src="cid:welcome_header" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />');
      } else {
        htmlBody = '<div style="text-align: center; margin-bottom: 20px;"><img src="cid:welcome_header" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" /></div>' + htmlBody;
      }
    } catch (e) {
      Logger.log('Aviso al procesar header base64: ' + e);
      htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, fallbackHeaderHtml);
    }
  } else if (typeof headerAsset === 'string' && headerAsset.startsWith('http')) {
    if (htmlBody.includes('{{header_banner}}')) {
      htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, '<img src="' + headerAsset + '" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />');
    } else if (htmlBody.includes('{{header_image_url}}')) {
      htmlBody = htmlBody.replace(/\{\{header_image_url\}\}/g, headerAsset);
    } else {
      htmlBody = '<div style="text-align: center; margin-bottom: 20px;"><img src="' + headerAsset + '" alt="Buk Asistencia" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" /></div>' + htmlBody;
    }
  } else {
    // Si no se proveyó imagen, sustituir {{header_banner}} con banner Buk corporativo elegante
    htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, fallbackHeaderHtml);
  }

  // 2. Procesar Banner Inferior (Footer) si viene de Drive o Base64 Data URL
  const footerAsset = bannerOptions.footerAsset;
  const footerFileId = extractDriveFileId(footerAsset);
  if (footerFileId) {
    try {
      const footerFile = DriveApp.getFileById(footerFileId);
      const footerBlob = footerFile.getBlob().setName('welcome_footer.png');
      inlineImages['welcome_footer'] = footerBlob;
      if (htmlBody.includes('{{footer_banner}}')) {
        htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, '<img src="cid:welcome_footer" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />');
      } else if (htmlBody.includes('{{footer_image_url}}')) {
        htmlBody = htmlBody.replace(/\{\{footer_image_url\}\}/g, 'cid:welcome_footer');
      } else {
        htmlBody = htmlBody + '<div style="text-align: center; margin-top: 24px;"><img src="cid:welcome_footer" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" /></div>';
      }
    } catch (e) {
      Logger.log('Aviso al procesar footer de Drive: ' + e);
      htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, fallbackFooterHtml);
    }
  } else if (typeof footerAsset === 'string' && footerAsset.startsWith('data:image/')) {
    try {
      const footerB64 = footerAsset.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').replace(/\s+/g, '');
      const footerBytes = Utilities.base64Decode(footerB64);
      const footerBlob = Utilities.newBlob(footerBytes, 'image/png', 'welcome_footer.png');
      inlineImages['welcome_footer'] = footerBlob;
      if (htmlBody.includes('{{footer_banner}}')) {
        htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, '<img src="cid:welcome_footer" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />');
      } else {
        htmlBody = htmlBody + '<div style="text-align: center; margin-top: 24px;"><img src="cid:welcome_footer" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" /></div>';
      }
    } catch (e) {
      Logger.log('Aviso al procesar footer base64: ' + e);
      htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, fallbackFooterHtml);
    }
  } else if (typeof footerAsset === 'string' && footerAsset.startsWith('http')) {
    if (htmlBody.includes('{{footer_banner}}')) {
      htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, '<img src="' + footerAsset + '" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" />');
    } else if (htmlBody.includes('{{footer_image_url}}')) {
      htmlBody = htmlBody.replace(/\{\{footer_image_url\}\}/g, footerAsset);
    } else {
      htmlBody = htmlBody + '<div style="text-align: center; margin-top: 24px;"><img src="' + footerAsset + '" alt="Experiencia Buk" style="width: 100%; max-width: 650px; height: auto; display: block; margin: 0 auto; border: 0;" /></div>';
    }
  } else {
    // Si no se proveyó imagen, sustituir {{footer_banner}} con banner Buk corporativo elegante
    htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, fallbackFooterHtml);
  }

  // Limpiar cualquier residuo de etiquetas para asegurar que jamás aparezcan en el correo
  htmlBody = htmlBody.replace(/\{\{header_banner\}\}/g, '');
  htmlBody = htmlBody.replace(/\{\{footer_banner\}\}/g, '');

  // 3. Procesar imágenes inline de respaldo (convertir cualquier Data URL base64 restante a Blobs)
  let imgIndex = 0;
  htmlBody = htmlBody.replace(/<img([^>]*)\ssrc=["']data:image\/([a-zA-Z0-9+.-]+);base64,([a-zA-Z0-9+/= \r\n]+)["']([^>]*)>/gi, function(match, prefix, mimeType, b64Data, suffix) {
    imgIndex++;
    const cid = 'welcome_img_' + imgIndex;
    try {
      const cleanB64 = b64Data.replace(/\s+/g, '');
      const decodedBytes = Utilities.base64Decode(cleanB64);
      const cleanMime = mimeType === 'svg+xml' ? 'image/svg+xml' : (mimeType.includes('png') ? 'image/png' : 'image/jpeg');
      const ext = mimeType.includes('png') ? 'png' : (mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png');
      const blob = Utilities.newBlob(decodedBytes, cleanMime, cid + '.' + ext);
      inlineImages[cid] = blob;
      return '<img' + prefix + ' src="cid:' + cid + '"' + suffix + '>';
    } catch (e) {
      return match;
    }
  });

  const plainTextBody = `¡Hola equipo ${cleanClient}! 😊\n\n` +
    `Mi nombre es Cony y seré quién les acompañe en esta etapa de implementación de nuestro módulo Control de Asistencia.\n\n` +
    `Como primer paso, realizaremos nuestra reunión "kick off", la cual consiste en una instancia virtual para conocernos y revisar los puntos necesarios para comenzar el proceso de implementación.\n\n` +
    `👉 Puedes hacer click aqui para agendar tu primera sesión:\n${agendaUrl || 'https://calendar.app.google/pB82UFn8EE2AsXi19'}\n\n` +
    `En caso de que no puedas asistir a la reunión programada, coméntamelo y así podremos agendar una nueva fecha.\n\n` +
    `Quedo atenta y disponible para ayudarte.\n\n` +
    `Saludos,\nTu experiencia con Buk`;

  const options = {
    htmlBody: htmlBody
  };

  if (Object.keys(inlineImages).length > 0) {
    options.inlineImages = inlineImages;
  }

  const draft = GmailApp.createDraft(to, subject, plainTextBody, options);

  return {
    draftId: draft.getId(),
    draftMessageId: draft.getMessage().getId(),
    recipient: to,
    subject: subject,
    imagesInlined: Object.keys(inlineImages).length,
    created: true
  };
}

/**
 * Busca o crea la subcarpeta de un cliente en la carpeta raíz de Clientes de Google Drive
 */
function getOrCreateClientFolder(rootFolderId, clientName, createIfMissing = true) {
  const root = DriveApp.getFolderById(rootFolderId);
  const cleanName = (clientName || '').toString().trim();
  const existingFolders = root.getFoldersByName(cleanName);

  if (existingFolders.hasNext()) {
    const folder = existingFolders.next();
    return {
      folderId: folder.getId(),
      folderUrl: folder.getUrl(),
      folderName: folder.getName(),
      alreadyExisted: true
    };
  }

  // Fallback de coincidencia normalizada (sin tildes, mayúsculas o espacios múltiples)
  const normClient = normalizeName(cleanName);
  const cleanClient = normClient.replace(/\s+/g, '');
  if (normClient) {
    const subIter = root.getFolders();
    while (subIter.hasNext()) {
      const f = subIter.next();
      const normF = normalizeName(f.getName());
      const cleanF = normF.replace(/\s+/g, '');
      if (normF === normClient || cleanF === cleanClient || (normClient.length >= 4 && (normF.includes(normClient) || normClient.includes(normF)))) {
        return {
          folderId: f.getId(),
          folderUrl: f.getUrl(),
          folderName: f.getName(),
          alreadyExisted: true
        };
      }
    }
  }

  if (createIfMissing) {
    const sanitizedName = cleanName.replace(/[\/\\:*?"<>|]/g, '-').trim();
    const newFolder = root.createFolder(sanitizedName || 'Cliente Sin Nombre');
    return {
      folderId: newFolder.getId(),
      folderUrl: newFolder.getUrl(),
      folderName: newFolder.getName(),
      alreadyExisted: false
    };
  }

  return {
    folderId: null,
    folderUrl: null,
    folderName: null,
    alreadyExisted: false
  };
}

/**
 * Actualiza la columna de Etapa (dup__of_criticidad4) de un cliente en Monday.com
 */
function updateMondayClientStage(clientId, stageLabel, apiKey, boardId) {
  const bId = boardId || CONFIG.BOARD_ID;
  const token = apiKey || CONFIG.MONDAY_API_KEY;
  const stage = stageLabel || 'Coordinando KickOffr';

  const colValues = JSON.stringify({
    "dup__of_criticidad4": { "label": stage }
  });

  const query = `
    mutation UpdateStage {
      change_multiple_column_values(
        board_id: ${bId},
        item_id: ${clientId},
        column_values: ${JSON.stringify(colValues)}
      ) {
        id
        name
      }
    }
  `;

  const res = callMondayAPI(query, token);
  return res?.data?.change_multiple_column_values || null;
}

/**
 * Crea una copia de la presentación maestra de Google Slides en la carpeta del cliente
 * y reemplaza automáticamente los datos en la diapositiva "Alcance del proyecto".
 */
function createClientKickOffPresentation(templateId, folderId, clientData) {
  if (!templateId) {
    throw new Error('Falta el ID o URL de la plantilla de Google Slides (SLIDES_KICKOFF_TEMPLATE_ID).');
  }
  if (!folderId) {
    throw new Error('Falta el ID de la carpeta destino en Google Drive.');
  }

  const cleanTemplateId = extractDriveFileId(templateId);
  const cleanFolderId = extractDriveFolderId(folderId);

  const templateFile = DriveApp.getFileById(cleanTemplateId);
  const targetFolder = DriveApp.getFolderById(cleanFolderId);

  const clientName = (clientData.name || clientData.clientName || 'Cliente').trim();
  const newPresentationName = `Kick Off - ${clientName}`;

  // Verificar si ya existe una presentación de Kick Off en la carpeta para no duplicar innecesariamente
  const existingFiles = targetFolder.getFilesByName(newPresentationName);
  let presentationFile;
  let alreadyExisted = false;

  if (existingFiles.hasNext()) {
    presentationFile = existingFiles.next();
    alreadyExisted = true;
  } else {
    presentationFile = templateFile.makeCopy(newPresentationName, targetFolder);
  }

  const presentationId = presentationFile.getId();
  const presentation = SlidesApp.openById(presentationId);

  // Preparar datos limpios y formateados
  let cleanBukUrl = (clientData.urlBuk || clientData.url_buk || '').replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();
  const fullBukUrl = cleanBukUrl ? `https://${cleanBukUrl}/` : '';
  
  const rawDotacion = clientData.dotacion;
  const dotacionNum = rawDotacion ? parseInt(rawDotacion, 10) : null;
  const dotacionText = dotacionNum ? `${dotacionNum} colaboradores` : (rawDotacion ? `${rawDotacion} colaboradores` : '');

  const rawRecintos = clientData.recintos;
  const recintosNum = rawRecintos ? parseInt(rawRecintos, 10) : null;
  const recintosText = recintosNum ? `${recintosNum} ${recintosNum === 1 ? 'lugar de trabajo' : 'lugares de trabajo'}` : (rawRecintos ? `${rawRecintos} lugares de trabajo` : '');

  const marcajeText = (clientData.tipoMarcaje || clientData.tipo_marcaje || '').trim();
  const contraparteText = (clientData.contraparte || '').trim();
  const correoText = (clientData.correoContraparte || clientData.correo_contraparte || clientData.recipient || '').trim();
  const telefonoText = (clientData.telefonoContraparte || clientData.telefono_contraparte || '').trim();

  // 1. Reemplazo de tags explícitos {{...}}
  if (clientName) {
    presentation.replaceAllText('{{CLIENTE}}', clientName);
    presentation.replaceAllText('{{NOMBRE_CLIENTE}}', clientName);
    presentation.replaceAllText('{{NOMBRE}}', clientName);
    presentation.replaceAllText('{{EMPRESA}}', clientName);
  }
  if (fullBukUrl) {
    presentation.replaceAllText('{{URL_BUK}}', fullBukUrl);
    presentation.replaceAllText('{{URL}}', fullBukUrl);
  }
  if (dotacionText) {
    presentation.replaceAllText('{{DOTACION}}', dotacionText);
  }
  if (recintosText) {
    presentation.replaceAllText('{{RECINTOS}}', recintosText);
  }
  if (marcajeText) {
    presentation.replaceAllText('{{MARCAJE}}', marcajeText);
    presentation.replaceAllText('{{TIPO_MARCAJE}}', marcajeText);
  }
  if (contraparteText) {
    presentation.replaceAllText('{{CONTRAPARTE}}', contraparteText);
    presentation.replaceAllText('{{CONTRAPARTE_CLIENTE}}', contraparteText);
    presentation.replaceAllText('{{CONTACTO}}', contraparteText);
  }
  if (correoText) {
    presentation.replaceAllText('{{CORREO}}', correoText);
    presentation.replaceAllText('{{EMAIL}}', correoText);
  }
  if (telefonoText) {
    presentation.replaceAllText('{{TELEFONO}}', telefonoText);
  }

  // 2. Reemplazo de los textos por defecto exactos de la diapositiva estándar "Alcance del proyecto"
  // (según la plantilla visual de Buk)
  if (clientName) {
    presentation.replaceAllText('Nombre cliente', clientName);
  }
  if (fullBukUrl) {
    presentation.replaceAllText('https://[nombre].buk.cl/', fullBukUrl);
    presentation.replaceAllText('https://[nombre].buk.cl', fullBukUrl);
  }
  if (dotacionText) {
    presentation.replaceAllText('XX colaboradores', dotacionText);
  }
  if (recintosText) {
    presentation.replaceAllText('XX lugares de trabajo', recintosText);
  }
  if (contraparteText) {
    presentation.replaceAllText('Nombre Apellido', contraparteText);
  }
  if (marcajeText) {
    presentation.replaceAllText('App. Móvil y equipo XX con el soporte de Buk', marcajeText);
  }

  presentation.saveAndClose();

  return {
    presentationId: presentationId,
    presentationUrl: presentationFile.getUrl(),
    presentationName: newPresentationName,
    alreadyExisted: alreadyExisted
  };
}

/**
 * Automatización integral de Onboarding en 1 clic (4 Pasos):
 * 1. Crea/obtiene la subcarpeta en Drive (/Clientes/[Nombre])
 * 2. Genera y personaliza la presentación de Google Slides para Kick Off
 * 3. Cambia la etapa en Monday a 'Coordinando Kick Off'
 * 4. Crea el borrador oficial en Gmail
 */
function executeClientOnboarding(options) {
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
    customHtml,
    customSubject,
    urlBuk,
    dotacion,
    recintos,
    tipoMarcaje,
    contraparte,
    correoContraparte,
    telefonoContraparte
  } = options;

  const results = {
    clientName: clientName,
    clientId: clientId,
    steps: {}
  };

  // 1. Google Drive Folder
  let targetClientFolderId = '';
  if (createFolder && rootFolderId && clientName) {
    try {
      const folderRes = getOrCreateClientFolder(rootFolderId, clientName);
      targetClientFolderId = folderRes.folderId;
      results.steps.drive = {
        success: true,
        ...folderRes
      };
    } catch (e) {
      results.steps.drive = {
        success: false,
        error: e.toString()
      };
    }
  }

  // 2. Google Slides Kick Off Presentation
  const templateId = slidesTemplateId || CONFIG.SLIDES_KICKOFF_TEMPLATE_ID;
  const shouldCreateSlides = createSlides !== false && createSlides !== 'false';
  
  if (shouldCreateSlides && templateId && targetClientFolderId) {
    try {
      const slidesRes = createClientKickOffPresentation(templateId, targetClientFolderId, {
        name: clientName,
        urlBuk: urlBuk || '',
        dotacion: dotacion || '',
        recintos: recintos || '',
        tipoMarcaje: tipoMarcaje || '',
        contraparte: contraparte || '',
        correoContraparte: correoContraparte || recipient || '',
        telefonoContraparte: telefonoContraparte || ''
      });
      results.steps.slides = {
        success: true,
        ...slidesRes
      };
    } catch (e) {
      results.steps.slides = {
        success: false,
        error: e.toString()
      };
    }
  }

  // 3. Monday Stage Update
  if (updateMonday && clientId) {
    try {
      const mondayRes = updateMondayClientStage(clientId, 'Coordinando KickOffr', mondayApiKey, boardId);
      results.steps.monday = {
        success: true,
        data: mondayRes
      };
    } catch (e) {
      results.steps.monday = {
        success: false,
        error: e.toString()
      };
    }
  }

  // 4. Gmail Draft Creation
  if (createDraft) {
    try {
      const draftRes = createWelcomeGmailDraft(clientName, recipient, agendaUrl, customHtml, customSubject, {
        headerAsset: params.header_asset || params.templateHeaderAsset || '',
        footerAsset: params.footer_asset || params.templateFooterAsset || ''
      });
      results.steps.gmail = {
        success: true,
        ...draftRes
      };
    } catch (e) {
      results.steps.gmail = {
        success: false,
        error: e.toString()
      };
    }
  }

  return results;
}

/**
 * Escanea la carpeta del cliente en Google Drive y extrae el texto de todos los
 * Google Docs (transcripciones de Meet, minutas, notas) y archivos de texto.
 */
function fetchClientTranscripts(folderId, folderUrl, clientName, rootFolderId) {
  let folder = null;

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log('Aviso abriendo carpeta por folderId: ' + e.message);
    }
  }

  if (!folder && folderUrl) {
    const extractedId = extractDriveFolderId(folderUrl);
    if (extractedId) {
      try {
        folder = DriveApp.getFolderById(extractedId);
      } catch (e) {
        Logger.log('Aviso abriendo carpeta por folderUrl: ' + e.message);
      }
    }
  }

  if (!folder && clientName && rootFolderId) {
    const res = getOrCreateClientFolder(rootFolderId, clientName, false);
    if (res && res.folderId) {
      try {
        folder = DriveApp.getFolderById(res.folderId);
      } catch (e) {
        Logger.log('Aviso abriendo carpeta por nombre de cliente: ' + e.message);
      }
    }
  }

  if (!folder) {
    throw new Error('No se pudo encontrar la carpeta del cliente en Google Drive.');
  }

  const transcripts = [];
  const tz = Session.getScriptTimeZone();
  const seenDocIds = {};

  function scanFolderFiles(targetFolder, depth) {
    if (depth > 3) return;

    // Escanear archivos en la carpeta actual
    const files = targetFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const fileId = file.getId();
      if (seenDocIds[fileId]) continue;

      const mime = file.getMimeType();
      const name = file.getName();
      const nameLower = name.toLowerCase();

      let textContent = '';
      let isDoc = false;

      if (mime === 'application/vnd.google-apps.document') {
        isDoc = true;
        try {
          const doc = DocumentApp.openById(fileId);
          textContent = doc.getBody().getText();
        } catch (errDoc) {
          Logger.log('Error leyendo Google Doc ' + name + ': ' + errDoc.message);
        }
      } else if (
        mime === 'text/plain' ||
        nameLower.endsWith('.txt') ||
        nameLower.endsWith('.vtt') ||
        nameLower.endsWith('.sbv')
      ) {
        isDoc = true;
        try {
          textContent = file.getBlob().getDataAsString();
        } catch (errTxt) {
          Logger.log('Error leyendo archivo de texto ' + name + ': ' + errTxt.message);
        }
      }

      if (isDoc && textContent && textContent.trim().length > 20) {
        seenDocIds[fileId] = true;
        const lastUpdated = file.getLastUpdated();
        const formattedDate = Utilities.formatDate(lastUpdated, tz, 'dd-MM-yyyy HH:mm');
        transcripts.push({
          id: fileId,
          name: name,
          url: file.getUrl(),
          date: formattedDate,
          timestamp: lastUpdated.getTime(),
          folderName: targetFolder.getName(),
          text: textContent.trim(),
          charCount: textContent.trim().length
        });
      }
    }

    // Escanear subcarpetas recursivamente (ej. 'Grabaciones', 'Notas', etc.)
    const subfolders = targetFolder.getFolders();
    while (subfolders.hasNext()) {
      const sub = subfolders.next();
      scanFolderFiles(sub, depth + 1);
    }
  }

  scanFolderFiles(folder, 0);

  // Ordenar cronológicamente (más antiguo al más reciente)
  transcripts.sort((a, b) => a.timestamp - b.timestamp);

  // Construir texto combinado estructurado para Gemini
  let combinedText = '';
  transcripts.forEach((t, idx) => {
    combinedText += `\n\n=========================================\n`;
    combinedText += `DOCUMENTO #${idx + 1}: ${t.name} (Carpeta: ${t.folderName} | Fecha: ${t.date})\n`;
    combinedText += `=========================================\n\n`;
    combinedText += t.text;
    combinedText += `\n`;
  });

  return {
    folderId: folder.getId(),
    folderName: folder.getName(),
    folderUrl: folder.getUrl(),
    totalDocuments: transcripts.length,
    documents: transcripts.map(t => ({
      id: t.id,
      name: t.name,
      url: t.url,
      date: t.date,
      folderName: t.folderName,
      charCount: t.charCount
    })),
    combinedText: combinedText.trim()
  };
}
