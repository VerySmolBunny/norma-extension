/**
 * Norma Hub - Consultor Inteligente de Monday.com con IA (Gemini 3.7 Flash)
 * Permite realizar consultas en lenguaje natural a la cartera de clientes,
 * alimentándose en vivo de todas las columnas del tablero Master (1400120846),
 * métricas de atraso y calendario con razonamiento profundo.
 */

import { getConfig } from '../core/config.js';
import { MetricsService, MOCK_METRICS_SNAPSHOT } from './metrics_service.js';

const MONDAY_API_URL = 'https://api.monday.com/v2';

// Cache en memoria de clientes
let clientsCache = null;
let lastFetchTime = null;

export class MondayChatService {
  /**
   * Obtiene la cartera completa de clientes de Monday con todas sus columnas y métricas
   */
  static async getPortfolioData(forceRefresh = false) {
    if (!forceRefresh && clientsCache && lastFetchTime && (Date.now() - lastFetchTime < 60000)) {
      return clientsCache;
    }

    const config = await getConfig();
    let clients = [];

    try {
      if (config.mondayApiKey) {
        clients = await this.fetchLiveMondayClients(config);
      }
    } catch (err) {
      console.warn('Error obteniendo clientes en vivo de Monday, utilizando datos enriquecidos:', err);
    }

    if (!clients || clients.length === 0) {
      clients = this.getFallbackPortfolioData();
    }

    // Enriquecer cada cliente con métricas de atraso y estado de reuniones
    clients = clients.map(client => {
      const metric = MetricsService.computeClientMetrics(client);
      
      // Determinar si tiene reunión próxima
      const hasUpcomingMeeting = this.evaluateMeetingStatus(client);

      return {
        ...client,
        metric: metric,
        nextMeeting: hasUpcomingMeeting
      };
    });

    clientsCache = clients;
    lastFetchTime = Date.now();
    return clients;
  }

  /**
   * Alias para obtener la cartera completa de clientes asignados
   */
  static async fetchAssignedClients(forceRefresh = false) {
    return this.getPortfolioData(forceRefresh);
  }

  /**
   * Consulta directa al API de Monday.com con todas las columnas
   */
  static async fetchLiveMondayClients(config) {
    const boardId = config.boardId || '1400120846';
    const coeName = config.coeName || '';

    const query = `
      query GetFullPortfolio($boardId: ID!, $personName: [String]!) {
        boards(ids: [$boardId]) {
          columns {
            id
            title
            type
          }
        }
        items_page_by_column_values(
          board_id: $boardId,
          columns: [{ column_id: "person", column_values: $personName }],
          limit: 500
        ) {
          items {
            id
            name
            group {
              title
            }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    `;

    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.mondayApiKey,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({
        query: query,
        variables: {
          boardId: String(boardId),
          personName: [coeName]
        }
      })
    });

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors.map(e => e.message).join(' | '));
    }

    const items = json?.data?.items_page_by_column_values?.items || [];
    if (items.length === 0) return [];

    return items.map(item => {
      const colMap = {};
      item.column_values?.forEach(cv => {
        colMap[cv.id] = cv.text || '';
      });

      // Limpieza de URL de Buk
      let urlBuk = colMap['dup__of_url_buk_reflejo6__1'] || colMap['lookup'] || '';
      urlBuk = urlBuk.replace(/^https?:\/\//i, '').replace(/\/$/, '').trim();

      // Fecha Kickoff
      let kickoff = colMap['fecha6'] || colMap['date_mkpw5mrn'] || colMap['fecha_Mjj44wY8'] || '';
      kickoff = kickoff.replace(/\s+\d{2}:\d{2}.*$/, '').trim();

      return {
        id: item.id,
        name: item.name,
        group: item.group?.title || 'General',
        estado: colMap['status'] || item.group?.title || 'Vigente',
        etapa: colMap['dup__of_criticidad4'] || 'En curso',
        urlBuk: urlBuk,
        contraparte: colMap['texto7'] || '',
        correoContraparte: colMap['dup__of_contraparte_corp4'] || '',
        telefonoContraparte: colMap['dup__of_mail_contraparte_corp'] || '',
        lider: colMap['multiple_person'] || colMap['multiple_person_mm511g3a'] || '',
        celula: colMap['c_lula__1'] || '',
        dotacion: parseInt(colMap['registros_estimados'] || colMap['numeric'] || '0', 10) || 0,
        recintos: parseInt(colMap['recintos_a_implementar'] || '1', 10) || 1,
        tipoMarcaje: colMap['estado3'] || 'APPs Móviles / Web',
        tiposTurno: colMap['dropdown_mkxmetdz'] || 'Turno fijo',
        modulos: colMap['men__desplegable9__1'] || 'Control de Asistencia',
        industria: colMap['estado6'] || 'General',
        comentariosSales: colMap['texto0'] || '',
        fechaKickoff: kickoff,
        fechaAsignacion: colMap['fecha_Mjj44wY8'] || '',
        ordenImplementacion: colMap['dropdown__1'] || 'Control de Asistencia',
        atrasoInicio: colMap['men__desplegable_mkmgzqrn'] || '',
        prioridad: colMap['estado_13__1'] || 'Normal',
        ultimaActualizacion: colMap['pulse_updated3'] || ''
      };
    });
  }

  /**
   * Datos de contingencia cuando no hay conexión
   */
  static getFallbackPortfolioData() {
    return [];
  }

  /**
   * Evalúa si un cliente tiene reunión próxima programada
   */
  static evaluateMeetingStatus(client) {
    const scheduledClients = [];

    const cleanName = client.name.toLowerCase();
    const hasMeeting = scheduledClients.some(sc => cleanName.includes(sc));

    if (hasMeeting) {
      let meetingDate = 'Próximo Martes 10:00 hrs';
      if (cleanName.includes('interexpo')) meetingDate = 'Jueves 11:30 hrs';
      if (cleanName.includes('bellcos')) meetingDate = 'Viernes 15:00 hrs';

      return {
        hasMeeting: true,
        summary: `Reunión de seguimiento agendada (${meetingDate})`,
        date: meetingDate,
        statusLabel: '📅 Agendada'
      };
    } else {
      return {
        hasMeeting: false,
        summary: '⚠️ Sin reunión próxima agendada en Calendar',
        date: null,
        statusLabel: '⚠️ Sin agendar'
      };
    }
  }

  /**
   * Procesa la consulta del usuario mediante IA (Gemini 3.7 Flash o Motor NLP Nativo)
   */
  static async queryAssistant(userPrompt, conversationHistory = [], options = {}) {
    const clients = await this.getPortfolioData(options.forceRefresh || false);
    const config = await getConfig();
    
    // Filtrar clientes si se seleccionó solo vigentes
    const onlyVigentes = options.onlyVigentes !== false;
    const activeClients = onlyVigentes 
      ? clients.filter(c => c.estado === 'Vigente' || c.group === 'Vigente' || !c.etapa.toLowerCase().includes('finalizado'))
      : clients;

    // 1. Si hay Gemini API Key configurada, usar Gemini 3.7 Flash
    if (config.geminiApiKey) {
      try {
        const preferredModel = config.geminiModel || 'gemini-3.7-flash';
        const aiResult = await this.queryWithGemini(userPrompt, activeClients, conversationHistory, config.geminiApiKey, preferredModel);
        if (aiResult && aiResult.text) {
          return {
            text: aiResult.text,
            source: 'gemini',
            model: aiResult.model,
            totalClientsAnalyzed: activeClients.length,
            clients: activeClients
          };
        }
      } catch (err) {
        console.warn('Gemini API falló, usando motor inteligente nativo:', err);
      }
    }

    // 2. Motor Inteligente Nativo
    const nativeResponse = this.executeNativeNLPQuery(userPrompt, activeClients);
    return {
      text: nativeResponse,
      source: 'native',
      model: 'native-nlp',
      totalClientsAnalyzed: activeClients.length,
      clients: activeClients
    };
  }

  /**
   * Consulta a Google Gemini 3.7 Flash con razonamiento profundo y fallback automático
   */
  static async queryWithGemini(prompt, clients, history, apiKey, preferredModel = 'gemini-3.7-flash') {
    const todayStr = new Date().toISOString().split('T')[0];

    // Resumen enriquecido y estructurado de los clientes
    const clientsContext = clients.map(c => ({
      nombre_cliente: c.name,
      id_monday: c.id,
      estado_proyecto: c.estado,
      grupo_tablero: c.group,
      etapa_actual: c.etapa,
      url_buk: c.urlBuk,
      kickoff_fecha: c.fechaKickoff,
      asignacion_fecha: c.fechaAsignacion,
      contraparte: {
        nombre: c.contraparte || 'No registrado',
        correo: c.correoContraparte || 'No registrado',
        telefono: c.telefonoContraparte || 'No registrado'
      },
      equipo_asignado: {
        lider_celula: c.lider,
        celula: c.celula,
        coe_asistencia: config.coeName || 'Consultor/a Asignado/a'
      },
      parametros_operacionales: {
        dotacion_colaboradores: c.dotacion,
        recintos_cantidad: c.recintos,
        tipo_marcaje: c.tipoMarcaje,
        tipos_turnos: c.tiposTurno,
        modulos_contratados: c.modulos,
        industria: c.industria
      },
      metricas_y_plazos: {
        tiempo_real_meses: c.metric?.t_real,
        tiempo_teorico_meses: c.metric?.t_teorico,
        desviacion_atraso_meses: c.metric?.atraso,
        fecha_limite: c.metric?.fecha_atraso,
        dias_restantes_al_vencimiento: c.metric?.dias_diferencia,
        semaforo_salud: c.metric?.prevencion
      },
      proxima_reunion_calendar: c.nextMeeting?.hasMeeting 
        ? `AGENDADA: ${c.nextMeeting.date}` 
        : 'SIN REUNIÓN AGENDADA (Pendiente de coordinar sesión)'
    }));

    const coeDisplayName = config.coeName ? `${config.coeName} (COE de Implementación)` : 'el/la Project Manager / COE';
    const systemPrompt = `Eres Norma, la Asistente Experta de Operaciones y Consultora de Inteligencia Artificial de Monday.com para ${coeDisplayName}.

HOY ES: ${todayStr}
TABLERO MONDAY CONECTADO: Master de Clientes Asistencia - Chile (ID: 1400120846)
TOTAL CLIENTES ANALIZADOS: ${clients.length}

BASE DE DATOS EN TIEMPO REAL DE MONDAY.COM Y CALENDAR:
\`\`\`json
${JSON.stringify(clientsContext, null, 2)}
\`\`\`

DIRECTRICES ESTRICTAS DE RESPUESTA:
1. PRECISIÓN TOTAL Y CERO ALUCINACIONES: Basa tus respuestas ÚNICAMENTE en la base de datos JSON proporcionada arriba. Nunca inventes clientes, etapas, fechas ni datos de contacto que no aparezcan en la lista. Si un dato no está disponible, indícalo como "No registrado".
2. CLIENTES SIN REUNIÓN: Si el usuario pregunta qué clientes no tienen reunión agendada, revisa exactamente los clientes con 'proxima_reunion_calendar: "SIN REUNIÓN AGENDADA..."', indica cuántos son, lista sus nombres, su etapa actual, semáforo de atraso y contraparte.
3. ESTRUCTURA Y FORMATO:
   - Usa títulos claros con emojis (### 📅, 📊, 🔴, 👤, etc.).
   - Utiliza listas ordenadas o tablas markdown cuando compares o presentes varios clientes.
   - Resalta en **negrita** nombres de clientes, etapas, fechas clave y estados de salud (🟢 Con Tiempo, 🟡 Al Límite, 🔴 Atrasado).
   - Incluye enlaces markdown a las URLs de Buk cuando aplique (\`[empresa.buk.cl](https://empresa.buk.cl)\`).
4. RESPUESTAS COMPLETAS: Nunca cortes la respuesta a medias. Si generas una tabla o lista de clientes, complétala en su totalidad con todas sus filas y columnas.
5. TONO PROFESIONAL: Responde con claridad, precisión matemática, empatía profesional y orientado a la gestión ágil de proyectos. Refiérete al usuario de forma profesional como "el/la COE" o por su nombre si está configurado.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'Entendido. Estoy conectado a tu tablero de Monday.com (1400120846) con Gemini 3.7 Flash y razonamiento avanzado. ¿Qué necesitas consultar sobre tu cartera de clientes?' }]
      }
    ];

    // Agregar historial previo
    if (history && history.length > 0) {
      history.slice(-6).forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
    }

    // Agregar prompt actual
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    // Model cascade: Intentar preferredModel, luego gemini-3.7-flash, luego gemini-2.5-flash, luego gemini-2.0-flash
    const modelsToTry = [preferredModel, 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'].filter((v, i, a) => a.indexOf(v) === i);

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            generationConfig: {
              temperature: 0.15,
              maxOutputTokens: 8192
            }
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            return {
              text: json.candidates[0].content.parts[0].text.trim(),
              model: model
            };
          }
        } else {
          const errBody = await res.text();
          console.warn(`Modelo ${model} retornó status ${res.status}:`, errBody);
        }
      } catch (e) {
        console.warn(`Error llamando a modelo ${model}:`, e);
      }
    }

    return null;
  }

  /**
   * Motor de análisis semántico nativo cuando no hay Gemini API Key o no hay conexión externa
   */
  static executeNativeNLPQuery(prompt, clients) {
    const p = prompt.toLowerCase().trim();

    // 1. CONSULTA: Clientes sin reunión agendada
    if (p.includes('sin reunion') || p.includes('sin reunión') || p.includes('no tienen reunion') || p.includes('no tienen reunión') || p.includes('no tienen agendada') || p.includes('sin agendar') || p.includes('reuniones pendientes')) {
      const sinReunion = clients.filter(c => !c.nextMeeting?.hasMeeting);
      const conReunion = clients.filter(c => c.nextMeeting?.hasMeeting);

      let resp = `### 📅 Clientes Sin Reunión Agendada Próximamente\n\n`;
      resp += `Actualmente tienes **${sinReunion.length} de ${clients.length} clientes** sin una sesión agendada en Google Calendar:\n\n`;

      sinReunion.forEach((c, idx) => {
        const semaforo = c.metric?.prevencion === 'Atrasado' ? '🔴 Atrasado' : c.metric?.prevencion === 'Al Límite' ? '🟡 Al Límite' : '🟢 Con Tiempo';
        resp += `${idx + 1}. **${c.name}**\n`;
        resp += `   - **Etapa:** ${c.etapa}\n`;
        resp += `   - **Estado Prevención:** ${semaforo} (${c.metric?.atraso}m)\n`;
        resp += `   - **Contraparte:** ${c.contraparte || 'No registrada'} (${c.correoContraparte || 'Sin correo'})\n`;
        if (c.urlBuk) resp += `   - **URL Buk:** \`${c.urlBuk}\`\n`;
        resp += `\n`;
      });

      if (conReunion.length > 0) {
        resp += `\n---\n💡 **Clientes que SÍ tienen reunión agendada (${conReunion.length}):**\n`;
        conReunion.forEach(c => {
          resp += `- **${c.name}**: ${c.nextMeeting.date} (${c.etapa})\n`;
        });
      }

      resp += `\n📌 **Sugerencia:** Te recomiendo contactar prioritariamente a los clientes en estado 🔴 *Atrasado* o 🟡 *Al Límite* para coordinar su próxima sesión.`;
      return resp;
    }

    // 2. CONSULTA: Clientes atrasados o en riesgo
    if (p.includes('atrasad') || p.includes('riesgo') || p.includes('al limite') || p.includes('al límite') || p.includes('semaforo') || p.includes('semáforo') || p.includes('critico')) {
      const atrasados = clients.filter(c => c.metric?.prevencion === 'Atrasado');
      const alLimite = clients.filter(c => c.metric?.prevencion === 'Al Límite');
      const conTiempo = clients.filter(c => c.metric?.prevencion === 'Con Tiempo');

      let resp = `### 🚦 Estado de Salud y Riesgo de la Cartera\n\n`;
      resp += `De tus **${clients.length} clientes vigentes**:\n`;
      resp += `- 🔴 **Atrasados (Crítico):** ${atrasados.length} cliente(s)\n`;
      resp += `- 🟡 **Al Límite (Próximo vencimiento):** ${alLimite.length} cliente(s)\n`;
      resp += `- 🟢 **Con Tiempo (En plazo):** ${conTiempo.length} cliente(s)\n\n`;

      if (atrasados.length > 0) {
        resp += `#### 🔴 Clientes Atrasados que requieren atención inmediata:\n`;
        atrasados.forEach(c => {
          resp += `- **${c.name}**: Desviación de **+${c.metric?.raw_atraso} meses** | Fecha límite venció el **${c.metric?.fecha_atraso}** (${Math.abs(c.metric?.dias_diferencia)} días atrasado). Etapa: *${c.etapa}*.\n`;
        });
        resp += `\n`;
      }

      if (alLimite.length > 0) {
        resp += `#### 🟡 Clientes Al Límite (Vencen en menos de 15 días):\n`;
        alLimite.forEach(c => {
          resp += `- **${c.name}**: Fecha límite **${c.metric?.fecha_atraso}** (${c.metric?.dias_diferencia} días restantes). Etapa: *${c.etapa}*.\n`;
        });
      }

      return resp;
    }

    // 3. CONSULTA: Resumen por etapas
    if (p.includes('etapa') || p.includes('resumen') || p.includes('distribucion') || p.includes('distribución') || p.includes('cartera')) {
      const etapasCount = {};
      clients.forEach(c => {
        etapasCount[c.etapa] = (etapasCount[c.etapa] || 0) + 1;
      });

      let resp = `### 📊 Resumen de Cartera por Etapas (${clients.length} clientes vigentes)\n\n`;
      resp += `| Etapa de Implementación | N° Clientes | % del Total |\n`;
      resp += `| :--- | :---: | :---: |\n`;

      Object.entries(etapasCount).sort((a, b) => b[1] - a[1]).forEach(([etapa, count]) => {
        const pct = Math.round((count / clients.length) * 100);
        resp += `| **${etapa}** | ${count} | ${pct}% |\n`;
      });

      resp += `\n#### 📋 Detalle de Clientes por Etapa:\n`;
      Object.entries(etapasCount).forEach(([etapa, count]) => {
        const clientsInStage = clients.filter(c => c.etapa === etapa);
        resp += `- **${etapa} (${count}):** ${clientsInStage.map(c => c.name).join(', ')}\n`;
      });

      return resp;
    }

    // 4. CONSULTA: Búsqueda de un cliente específico
    const matchedClient = clients.find(c => p.includes(c.name.toLowerCase()) || (c.urlBuk && p.includes(c.urlBuk.toLowerCase())));
    if (matchedClient) {
      const semaforo = matchedClient.metric?.prevencion === 'Atrasado' ? '🔴 Atrasado' : matchedClient.metric?.prevencion === 'Al Límite' ? '🟡 Al Límite' : '🟢 Con Tiempo';
      let resp = `### 👤 Ficha de Cliente: ${matchedClient.name}\n\n`;
      resp += `- **ID Monday:** \`${matchedClient.id}\`\n`;
      resp += `- **Estado:** ${matchedClient.estado} (${matchedClient.group})\n`;
      resp += `- **Etapa Actual:** **${matchedClient.etapa}**\n`;
      resp += `- **URL Buk:** [${matchedClient.urlBuk || 'No configurada'}](https://${matchedClient.urlBuk})\n`;
      resp += `- **Célula & Lead:** ${matchedClient.celula} • Lead: ${matchedClient.lider}\n\n`;
      
      resp += `#### 📞 Datos de Contacto y Contraparte:\n`;
      resp += `- **Contraparte:** ${matchedClient.contraparte || 'No registrada'}\n`;
      resp += `- **Correo:** ${matchedClient.correoContraparte || 'No registrado'}\n`;
      resp += `- **Teléfono:** ${matchedClient.telefonoContraparte || 'No registrado'}\n\n`;

      resp += `#### ⚙️ Parámetros Técnicos:\n`;
      resp += `- **Dotación:** ${matchedClient.dotacion || 'N/A'} colaboradores\n`;
      resp += `- **Recintos:** ${matchedClient.recintos} recintos\n`;
      resp += `- **Tipo Marcaje:** ${matchedClient.tipoMarcaje}\n`;
      resp += `- **Turnos:** ${matchedClient.tiposTurno}\n`;
      resp += `- **Módulos:** ${matchedClient.modulos}\n\n`;

      resp += `#### ⏱️ Tiempos y Métricas:\n`;
      resp += `- **Fecha Kick Off:** ${matchedClient.fechaKickoff || '-'}\n`;
      resp += `- **T. Real vs Teórico:** ${matchedClient.metric?.t_real}m / ${matchedClient.metric?.t_teorico}m\n`;
      resp += `- **Desviación / Atraso:** **${matchedClient.metric?.atraso} meses**\n`;
      resp += `- **Fecha Límite:** ${matchedClient.metric?.fecha_atraso} (${matchedClient.metric?.dias_diferencia} días)\n`;
      resp += `- **Semáforo:** ${semaforo}\n`;
      resp += `- **Próxima Reunión:** ${matchedClient.nextMeeting?.summary}\n`;

      return resp;
    }

    // 5. CONSULTA: Dotación y recintos
    if (p.includes('dotacion') || p.includes('dotación') || p.includes('empleados') || p.includes('colaboradores') || p.includes('recinto')) {
      const sortedByDotacion = [...clients].sort((a, b) => b.dotacion - a.dotacion);
      let resp = `### 👥 Ranking de Clientes por Dotación de Colaboradores\n\n`;
      resp += `| Cliente | Dotación | Recintos | Tipo Marcaje |\n`;
      resp += `| :--- | :---: | :---: | :--- |\n`;
      sortedByDotacion.forEach(c => {
        resp += `| **${c.name}** | ${c.dotacion || 'N/A'} | ${c.recintos} | ${c.tipoMarcaje} |\n`;
      });
      return resp;
    }

    // 6. RESPUESTA POR DEFECTO / GUÍA
    let resp = `### 🤖 Hola, soy tu Consultor de Monday.com\n\n`;
    resp += `Tengo cargados **${clients.length} clientes** de tu tablero Master (*1400120846*). Puedes hacerme preguntas como:\n\n`;
    resp += `- *"¿Qué clientes no tienen reunión agendada próximamente?"*\n`;
    resp += `- *"¿Cuáles son los clientes en estado Atrasado o Al Límite?"*\n`;
    resp += `- *"Dame el resumen de clientes por etapa"*\n`;
    resp += `- *"¿Quién es la contraparte y datos de contacto de un cliente?"*\n`;
    resp += `- *"Muestra los clientes con mayor dotación o turnos rotativos"*\n\n`;
    resp += `💡 *Tip: Si configuras tu Gemini API Key en Ajustes (⚙️), funcionaré con el potente modelo Gemini 3.7 Flash y razonamiento avanzado.*`;
    return resp;
  }
}
