/**
 * Norma Hub - Servicio de IA para Redacción y Pulido de Minutas con Google Gemini
 * Implementa la estructura, tono y directrices idénticas de las Gemas de Gemini de Buk
 */

export class MinutaAiService {
  /**
   * Genera o pule la minuta de una reunión usando Gemini API directamente
   * @param {Object} params
   * @param {string} params.docText - Texto de las notas de la reunión / Google Doc
   * @param {string} params.rawDescription - Descripción del evento de Calendar
   * @param {string} params.meetingType - 'Kick Off' o 'Seguimiento'
   * @param {string} params.clientName - Nombre del cliente
   * @param {string} params.dateStr - Fecha en formato DD-MM-YYYY
   * @param {string} params.apiKey - Gemini API Key
   * @param {string} [params.model] - Modelo preferido (default: gemini-3.7-flash)
   * @returns {Promise<{text: string, model: string}>}
   */
  static async generateMinuta({
    docText = '',
    rawDescription = '',
    meetingType = 'Seguimiento',
    clientName = '',
    dateStr = '',
    apiKey = '',
    model = 'gemini-3.7-flash'
  }) {
    if (!apiKey) {
      throw new Error('No se ha configurado la API Key de Gemini en Ajustes (⚙️).');
    }

    const isKickOff = meetingType.toLowerCase().includes('kick') || meetingType.toLowerCase().includes('ko');
    const formattedDate = dateStr || new Date().toISOString().split('T')[0].split('-').reverse().join('-');

    const systemInstructionText = `Eres el asistente de operaciones de Buk para el/la Consultor/a de Implementación (identificado/a estrictamente como "el/la COE").
Tu función es estructurar minutas de reuniones de implementación de Buk en formato profesional para Monday.com a partir de las notas o transcripciones de Google Meet.

REGLAS OBLIGATORIAS:
- Cero alucinación: Utiliza ÚNICAMENTE la información explícita de las notas. No inventes acuerdos, fechas ni asistentes.
- Omite artefactos técnicos de Google Meet como marcas de tiempo "(00:01:58)", "Invitado", "Registros de la reunión", etc.
- No uses bloques de código con triple comilla invertida (\`\`\`). Devuelve directamente el texto formateado.
- Reemplaza cualquier mención de nombre del/la consultor/a por "el/la COE".
- Reemplaza "Book" (cuando refiera al software o módulo) por "Buk".`;

    let userPrompt = '';

    if (isKickOff) {
      userPrompt = `Toma las siguientes notas de la reunión de Kick Off con el cliente "${clientName}" y reestrúcturalas en las siguientes 6 secciones, comenzando SIEMPRE con la fecha ${formattedDate} en la primera línea:

${formattedDate}

Detalles del Cliente:
- Detalles de cómo funciona su empresa (por ejemplo: por qué contrató Buk, cuántas personas marcarán asistencia, horarios de trabajo, cómo marcarán asistencia, políticas internas, etc.) en formato de lista con viñetas ("- ").

Notas de la Sesión:
Esta sección debe resumir lo que se habló y se hizo durante la reunión en un formato ejecutivo, fluido y profesional.
Redacta exactamente 1 párrafo cohesionado en tono formal e impersonal ("Durante la reunión se revisaron los requerimientos técnicos y operativos...", "La COE aclaró que...", "Se explicaron las configuraciones necesarias...").

Temas que se revisaran en la siguiente sesión:
- Lista con viñetas de los temas agendados para la próxima sesión. Si no hay temas, indica "no aplica".

Tareas del Cliente:
- Lista con viñetas detallando qué se le solicitó originalmente al cliente que hiciera para la próxima reunión. Si no hay tareas, indica "no aplica".

Tareas del PM:
- Lista con viñetas detallando a qué compromisos llegó "el/la COE". Si no hay tareas, indica "no aplica".

Fecha exacta de la próxima reunión:
Fecha y hora pactada (ej. "Jueves 3 de octubre a las 9:30 AM"). Si no se pactó fecha en las notas, OMITIR esta sección por completo.

Si tras analizar las notas no encuentras información para alguna categoría (salvo la fecha que se omite), indica "no aplica".

NOTAS DE LA REUNIÓN:
${docText}

${rawDescription ? `DETALLES ADICIONALES DEL EVENTO:\n${rawDescription}` : ''}`;
    } else {
      userPrompt = `Toma las siguientes notas de la reunión de Seguimiento con el cliente "${clientName}" y reestrúcturalas en las siguientes 5 secciones, comenzando SIEMPRE con la fecha ${formattedDate} en la primera línea:

${formattedDate}

Notas de la Sesión:
Esta sección debe resumir lo que se habló y se hizo durante la reunión en un estilo ejecutivo, fluido y formal.
ESTRUCTURA OBLIGATORIA DE NOTAS DE LA SESIÓN: Redacta EXACTAMENTE 2 párrafos separados por una línea en blanco:
- Párrafo 1: El foco principal de la sesión y las herramientas o módulos de Buk explorados/revisados (ej. "La sesión se enfocó en...", "Durante la reunión se revisó el portal Buk para...").
- Párrafo 2: Los acuerdos operativos, configuraciones realizadas, resolución de incidencias, lógica de marcas, horas extra, permisos o lineamientos abordados (ej. "Asimismo, se definió...", "Adicionalmente, se instruyó sobre...", "Se clarificó el flujo para...").

Temas que se revisaran en la siguiente sesión:
- Lista con viñetas de los temas agendados para la próxima reunión. Si no hay temas, indica "no aplica".

Tareas del Cliente:
- Lista con viñetas detallando qué se le solicitó originalmente al cliente que hiciera para la próxima reunión. Si no hay tareas, indica "no aplica".

Tareas del PM:
- Lista con viñetas detallando a qué compromisos llegó "el/la COE". Si no hay tareas, indica "no aplica".

Fecha exacta de la próxima reunión:
Fecha y hora pactada (ej. "Miércoles 19 de agosto de 2026 a las 16:00 horas"). Si no se pactó fecha en las notas, OMITIR esta sección por completo.

Si tras analizar las notas no encuentras información para alguna categoría (salvo la fecha que se omite), indica "no aplica".

NOTAS DE LA REUNIÓN:
${docText}

${rawDescription ? `DETALLES ADICIONALES DEL EVENTO:\n${rawDescription}` : ''}`;
    }

    const res = await this._callGemini({
      systemInstructionText,
      userPrompt,
      apiKey,
      model
    });

    return {
      text: this.postProcessMinuta(res.text),
      model: res.model
    };
  }

  /**
   * Genera el Resumen de Cierre de Implementación a partir de las transcripciones de Google Drive
   * estructurado en los 3 puntos oficiales definidos por la COE:
   * 1. Detalles sobre el funcionamiento de la empresa
   * 2. Estado actual de la implementación
   * 3. Características de la contraparte y sus opiniones
   * 
   * @param {Object} params
   * @param {string} params.transcriptsText - Texto consolidado de transcripciones/documentos
   * @param {string} params.clientName - Nombre del cliente
   * @param {string} params.apiKey - Gemini API Key
   * @param {string} [params.model] - Modelo preferido
   * @returns {Promise<{text: string, model: string}>}
   */
  static async generateCierreSummary({
    transcriptsText = '',
    clientName = '',
    apiKey = '',
    model = 'gemini-3.7-flash'
  }) {
    if (!apiKey) {
      throw new Error('No se ha configurado la API Key de Gemini en Ajustes (⚙️).');
    }
    if (!transcriptsText || transcriptsText.trim().length < 30) {
      throw new Error('No se encontró contenido suficiente en las transcripciones para generar el resumen.');
    }

    const systemInstructionText = `Eres el asistente de operaciones de Buk para el/la Consultor/a de Implementación (identificado/a como "el/la COE").
Tu objetivo es analizar integralmente todas las notas y transcripciones de las sesiones de implementación del cliente "${clientName}" y generar un resumen profesional, claro y fidedigno para la documentación interna.

REGLAS OBLIGATORIAS:
- Cero alucinación: Basa tus respuestas ÚNICAMENTE en lo discutido o registrado en las transcripciones. Si de algún punto no hay información en las notas, indica explícitamente "No se menciona en las sesiones registradas".
- No inventes módulos, turnos, acuerdos ni nombres.
- Omite marcas de tiempo de video, registros técnicos de Google Meet o muletillas de transcripción.
- Mantén un tono formal, analítico y ejecutivo para la documentación interna de Buk.
- Reemplaza cualquier mención de nombre del/la consultor/a por "el/la COE".
- Reemplaza "Book" por "Buk".
- Devuelve directamente el texto formateado con títulos en negrita y viñetas limpias, sin envolverlo en bloques de código (\`\`\`).`;

    const userPrompt = `Toma todas las notas adjuntas crea un resumen que contenga los siguientes puntos:

1. Detalles sobre el funcionamiento de la empresa:
- Razón por la que contrataron el modulo de asistencia y como registraban la asistencia anteriormente 
- Como funcionan sus turnos, 
- método de marcaje que se configuro
- si desean sincronizar las asistencia con remuneraciones o no

2. Estado actual de la implementación (fue o no finalizada) y si quedaron tareas pendientes luego de la ultima sesión 

3. Características de la contraparte y sus opiniones e impresiones que tenga el cliente con la plataforma

NOTAS Y TRANSCRIPCIONES DE LAS SESIONES DE IMPLEMENTACIÓN:
${transcriptsText}`;

    const res = await this._callGemini({
      systemInstructionText,
      userPrompt,
      apiKey,
      model
    });

    return {
      text: this.postProcessMinuta(res.text),
      model: res.model
    };
  }

  /**
   * Ejecutor interno con reintentos y cascada de modelos para Gemini
   * @private
   */
  static async _callGemini({ systemInstructionText, userPrompt, apiKey, model }) {
    const payloadWithSystem = {
      system_instruction: {
        parts: [{ text: systemInstructionText }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 8192
      }
    };

    // Cascada de modelos
    const modelsToTry = [model, 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);

    let lastError = null;

    for (const currentModel of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadWithSystem)
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText && rawText.trim().length > 10) {
            return {
              text: rawText.trim(),
              model: currentModel
            };
          }
        } else {
          // Intentar sin system_instruction si el endpoint o modelo no lo soporta directamente
          const fallbackPayload = {
            contents: [{
              role: 'user',
              parts: [{ text: `${systemInstructionText}\n\n${userPrompt}` }]
            }],
            generationConfig: {
              temperature: 0.6,
              maxOutputTokens: 8192
            }
          };

          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
          });

          if (retryRes.ok) {
            const data = await retryRes.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText && rawText.trim().length > 10) {
              return {
                text: rawText.trim(),
                model: currentModel
              };
            }
          }

          const errText = await res.text();
          console.warn(`[MinutaAiService] Modelo ${currentModel} falló:`, errText);
          let errMsg = `status ${res.status}`;
          try {
            const errObj = JSON.parse(errText);
            if (errObj.error && errObj.error.message) {
              errMsg = errObj.error.message;
            }
          } catch (_) {}
          lastError = new Error(`${currentModel}: ${errMsg}`);
        }
      } catch (err) {
        console.warn(`[MinutaAiService] Excepción en modelo ${currentModel}:`, err);
        lastError = err;
      }
    }

    throw lastError || new Error('No se pudo procesar la solicitud con ninguno de los modelos de Gemini.');
  }

  /**
   * Post-procesa el texto para asegurar reemplazos normativos y limpieza de markdown excesivo
   */
  static postProcessMinuta(text) {
    let clean = text.trim();

    // Eliminar posibles bloques ```markdown o ```
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Reemplazos de software
    clean = clean.replace(/\bBook\b/gi, 'Buk');

    // Eliminar guiones extraños antes de los títulos de sección principales si el modelo los puso
    clean = clean.replace(/^-\s*(Detalles del Cliente:)/gim, '$1');
    clean = clean.replace(/^-\s*(Notas de la Sesión:?)/gim, '$1');
    clean = clean.replace(/^-\s*(Temas que se revisaran en la siguiente sesión:?)/gim, '$1');
    clean = clean.replace(/^-\s*(Tareas del Cliente:?)/gim, '$1');
    clean = clean.replace(/^-\s*(Tareas del PM:?)/gim, '$1');
    clean = clean.replace(/^-\s*(Fecha exacta de la próxima reunión:?)/gim, '$1');

    return clean;
  }
}
