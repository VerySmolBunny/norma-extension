/**
 * Norma Hub - Controlador del Consultor Inteligente de Monday.com (Cartera Master)
 * Maneja el flujo conversacional, chips de atajos rápidos, renderizado de respuestas con IA
 * y sincronización con el tablero de Monday.com.
 */

import { MondayChatService } from '../services/monday_chat_service.js';
import { showToast } from '../core/ui_helpers.js';

let chatHistory = [];
let isQuerying = false;
let currentClients = [];

export function initPortfolioController(state) {
  const btnSendChat = document.getElementById('btnSendPortfolioChat');
  const inputChat = document.getElementById('inputPortfolioPrompt');
  const btnRefreshPortfolio = document.getElementById('btnRefreshPortfolio');
  const btnClearChat = document.getElementById('btnClearPortfolioChat');
  const chkPortfolioOnlyVigentes = document.getElementById('chkPortfolioOnlyVigentes');

  // 1. Envío de mensajes por botón y por tecla Enter (Shift+Enter para nueva línea)
  if (btnSendChat && inputChat) {
    btnSendChat.addEventListener('click', () => {
      const text = inputChat.value.trim();
      if (text) {
        processUserPrompt(text);
        inputChat.value = '';
        autoResizeTextarea(inputChat);
      }
    });

    inputChat.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = inputChat.value.trim();
        if (text) {
          processUserPrompt(text);
          inputChat.value = '';
          autoResizeTextarea(inputChat);
        }
      }
    });

    inputChat.addEventListener('input', () => {
      autoResizeTextarea(inputChat);
    });
  }

  // 2. Chips de Atajos Rápidos
  const promptChips = document.querySelectorAll('.portfolio-prompt-chip');
  promptChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        processUserPrompt(prompt);
      }
    });
  });

  // 3. Botón de Recargar Datos en Vivo de Monday
  if (btnRefreshPortfolio) {
    btnRefreshPortfolio.addEventListener('click', async () => {
      await loadPortfolioData(true);
      showToast('🔄 Cartera de Monday.com actualizada en tiempo real.');
    });
  }

  // 4. Botón de Limpiar Chat
  if (btnClearChat) {
    btnClearChat.addEventListener('click', () => {
      chatHistory = [];
      const messagesContainer = document.getElementById('portfolioChatMessages');
      if (messagesContainer) {
        messagesContainer.innerHTML = '';
        renderWelcomeMessage();
      }
      showToast('🧹 Conversación reiniciada.');
    });
  }

  // 5. Toggle de Vigentes
  if (chkPortfolioOnlyVigentes) {
    chkPortfolioOnlyVigentes.addEventListener('change', (e) => {
      updateHeaderBadges();
      showToast(e.target.checked ? 'Filtrando: Solo clientes vigentes' : 'Filtrando: Toda la cartera');
    });
  }

  // Cargar datos iniciales de Monday
  loadPortfolioData(false);
}

/**
 * Carga los datos de clientes y actualiza los badges de estado
 */
export async function loadPortfolioData(forceRefresh = false) {
  const badgeMondayCount = document.getElementById('badgeMondayClientCount');
  const btnRefreshPortfolio = document.getElementById('btnRefreshPortfolio');

  if (btnRefreshPortfolio) {
    btnRefreshPortfolio.classList.add('spinning');
  }

  try {
    currentClients = await MondayChatService.getPortfolioData(forceRefresh);
    updateHeaderBadges();
  } catch (err) {
    console.error('Error cargando cartera:', err);
    if (badgeMondayCount) badgeMondayCount.textContent = '11 clientes (Snapshot)';
  } finally {
    if (btnRefreshPortfolio) {
      btnRefreshPortfolio.classList.remove('spinning');
    }
  }
}

function updateHeaderBadges() {
  const badgeMondayCount = document.getElementById('badgeMondayClientCount');
  const chkPortfolioOnlyVigentes = document.getElementById('chkPortfolioOnlyVigentes');
  const onlyVigentes = chkPortfolioOnlyVigentes ? chkPortfolioOnlyVigentes.checked : true;

  if (badgeMondayCount && currentClients) {
    const count = onlyVigentes 
      ? currentClients.filter(c => c.estado === 'Vigente' || c.group === 'Vigente' || !c.etapa.toLowerCase().includes('finalizado')).length
      : currentClients.length;
    badgeMondayCount.textContent = `👥 ${count} clientes ${onlyVigentes ? 'vigentes' : 'totales'}`;
  }
}

/**
 * Procesa el prompt enviado por el usuario
 */
async function processUserPrompt(promptText) {
  if (isQuerying) return;
  isQuerying = true;

  const messagesContainer = document.getElementById('portfolioChatMessages');
  const btnSendChat = document.getElementById('btnSendPortfolioChat');
  const inputChat = document.getElementById('inputPortfolioPrompt');
  const chkPortfolioOnlyVigentes = document.getElementById('chkPortfolioOnlyVigentes');
  const onlyVigentes = chkPortfolioOnlyVigentes ? chkPortfolioOnlyVigentes.checked : true;

  if (btnSendChat) btnSendChat.disabled = true;
  if (inputChat) inputChat.disabled = true;

  // 1. Agregar mensaje del usuario a la vista
  appendUserMessage(promptText, messagesContainer);
  chatHistory.push({ role: 'user', text: promptText, timestamp: new Date() });

  // 2. Agregar burbuja de pensamiento de Norma
  const thinkingEl = appendThinkingMessage(messagesContainer);
  scrollToBottom(messagesContainer);

  try {
    // 3. Consultar al servicio de Chatbot
    const result = await MondayChatService.queryAssistant(promptText, chatHistory, {
      onlyVigentes: onlyVigentes,
      forceRefresh: false
    });

    // 4. Remover burbuja de pensamiento
    if (thinkingEl && thinkingEl.parentNode) {
      thinkingEl.parentNode.removeChild(thinkingEl);
    }

    // 5. Agregar respuesta del asistente
    appendAssistantMessage(result.text, result.source, result.model, messagesContainer);
    chatHistory.push({ role: 'assistant', text: result.text, source: result.source, model: result.model, timestamp: new Date() });

  } catch (error) {
    console.error('Error al procesar consulta:', error);
    if (thinkingEl && thinkingEl.parentNode) {
      thinkingEl.parentNode.removeChild(thinkingEl);
    }
    appendAssistantMessage(`❌ Ocurrió un error al procesar tu consulta: ${error.message}`, 'error', 'error', messagesContainer);
  } finally {
    isQuerying = false;
    if (btnSendChat) btnSendChat.disabled = false;
    if (inputChat) {
      inputChat.disabled = false;
      inputChat.focus();
    }
    scrollToBottom(messagesContainer);
  }
}

function appendUserMessage(text, container) {
  if (!container) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message message-user';
  msgEl.innerHTML = `
    <div class="message-avatar">TÚ</div>
    <div class="message-content-wrapper">
      <div class="message-meta">
        <span class="sender-name">Tú</span>
        <span class="message-time">${formatTime(new Date())}</span>
      </div>
      <div class="message-bubble">${escapeHtml(text)}</div>
    </div>
  `;
  container.appendChild(msgEl);
}

function appendThinkingMessage(container) {
  if (!container) return null;
  const thinkingEl = document.createElement('div');
  thinkingEl.className = 'chat-message message-assistant thinking';
  thinkingEl.innerHTML = `
    <div class="message-avatar bot-avatar">N</div>
    <div class="message-content-wrapper">
      <div class="message-meta">
        <span class="sender-name">Norma AI</span>
        <span class="message-time">Razonando con Gemini 3.7 Flash...</span>
      </div>
      <div class="message-bubble thinking-bubble">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
        <span style="margin-left: 8px; font-size: 12px; color: #64748b; font-weight: 600;">Consultando tablero Master (1400120846)...</span>
      </div>
    </div>
  `;
  container.appendChild(thinkingEl);
  return thinkingEl;
}

function appendAssistantMessage(markdownText, source, model, container) {
  if (!container) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message message-assistant';

  let modelLabel = '✨ Gemini 3.7 Flash';
  if (model === 'gemini-2.5-flash') modelLabel = '✨ Gemini 2.5 Flash';
  if (model === 'gemini-2.5-pro') modelLabel = '✨ Gemini 2.5 Pro';
  if (model === 'gemini-2.0-flash') modelLabel = '✨ Gemini 2.0 Flash';

  const sourceBadge = source === 'gemini' 
    ? `<span class="model-badge gemini">${modelLabel}</span>` 
    : '<span class="model-badge native">⚡ Motor Monday Nativo</span>';

  const formattedHtml = parseMarkdownToHtml(markdownText);

  msgEl.innerHTML = `
    <div class="message-avatar bot-avatar">N</div>
    <div class="message-content-wrapper">
      <div class="message-meta">
        <span class="sender-name">Norma AI</span>
        ${sourceBadge}
        <span class="message-time">${formatTime(new Date())}</span>
      </div>
      <div class="message-bubble markdown-body">${formattedHtml}</div>
      <div class="message-actions">
        <button type="button" class="btn-msg-action btn-copy-msg" title="Copiar respuesta">
          <span>📋 Copiar</span>
        </button>
      </div>
    </div>
  `;

  // Listener para botón de copiar
  const copyBtn = msgEl.querySelector('.btn-copy-msg');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(markdownText).then(() => {
          showToast('📋 Respuesta copiada al portapapeles');
        });
      }
    });
  }

  container.appendChild(msgEl);
}

function renderWelcomeMessage() {
  const messagesContainer = document.getElementById('portfolioChatMessages');
  if (!messagesContainer) return;

  const welcomeEl = document.createElement('div');
  welcomeEl.className = 'chat-message message-assistant welcome-message';
  welcomeEl.innerHTML = `
    <div class="message-avatar bot-avatar">N</div>
    <div class="message-content-wrapper">
      <div class="message-meta">
        <span class="sender-name">Norma AI</span>
        <span class="model-badge">🟢 Conectado</span>
      </div>
      <div class="message-bubble markdown-body">
        <h3>👋 ¡Hola! Soy tu Consultor Inteligente de Monday.com</h3>
        <p>Estoy conectado en tiempo real con tu tablero <strong>Master de Clientes Asistencia (1400120846)</strong>, métricas de atraso y calendario. Puedes hacerme cualquier consulta sobre tu cartera.</p>
        <p><strong>💡 Prueba hacer clic en cualquiera de los atajos rápidos de arriba o escribe tu propia pregunta abajo.</strong></p>
      </div>
    </div>
  `;
  messagesContainer.appendChild(welcomeEl);
}

/**
 * Convierte Markdown a HTML seguro, estructurado y sin pérdida de datos
 */
function parseMarkdownToHtml(md) {
  if (!md) return '';

  const lines = md.split('\n');
  let html = '';
  let inList = false;
  let listType = null; // 'ul' | 'ol'
  let inTable = false;
  let tableHeaderDone = false;
  let inBlockquote = false;

  function closeOpenBlocks() {
    if (inList) {
      html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
      inList = false;
      listType = null;
    }
    if (inTable) {
      html += '</tbody></table></div>\n';
      inTable = false;
      tableHeaderDone = false;
    }
    if (inBlockquote) {
      html += '</blockquote>\n';
      inBlockquote = false;
    }
  }

  function inlineFormat(text) {
    let s = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="chat-link">$1 ↗</a>');
    return s;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Línea vacía
    if (!trimmed) {
      closeOpenBlocks();
      continue;
    }

    // 2. Encabezados (#, ##, ###, ####)
    if (/^#{1,4}\s+/.test(trimmed)) {
      closeOpenBlocks();
      const level = trimmed.match(/^(#{1,4})\s+/)[1].length;
      const titleText = trimmed.replace(/^#{1,4}\s+/, '');
      const tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
      html += `<${tag}>${inlineFormat(titleText)}</${tag}>\n`;
      continue;
    }

    // 3. Separadores (--- o ***)
    if (/^(\-{3,}|\*{3,})$/.test(trimmed)) {
      closeOpenBlocks();
      html += `<hr class="chat-divider">\n`;
      continue;
    }

    // 4. Tablas (| col1 | col2 |)
    if (trimmed.startsWith('|') || (trimmed.includes('|') && trimmed.split('|').length >= 3)) {
      if (trimmed.includes('---')) {
        // Línea divisora de tabla | :--- | :--- |
        tableHeaderDone = true;
        continue;
      }

      if (!inTable) {
        closeOpenBlocks();
        inTable = true;
        tableHeaderDone = false;
        html += '<div class="chat-table-wrapper"><table class="chat-table">\n';
      }

      const rawCells = trimmed.split('|').map(c => c.trim());
      // Remover primer y último elemento si están vacíos debido a pipes iniciales/finales
      if (rawCells.length > 0 && rawCells[0] === '') rawCells.shift();
      if (rawCells.length > 0 && rawCells[rawCells.length - 1] === '') rawCells.pop();

      if (!tableHeaderDone) {
        html += '<thead><tr>';
        rawCells.forEach(cell => {
          html += `<th>${inlineFormat(cell)}</th>`;
        });
        html += '</tr></thead><tbody>\n';
      } else {
        html += '<tr>';
        rawCells.forEach(cell => {
          html += `<td>${inlineFormat(cell)}</td>`;
        });
        html += '</tr>\n';
      }
      continue;
    } else if (inTable) {
      html += '</tbody></table></div>\n';
      inTable = false;
      tableHeaderDone = false;
    }

    // 5. Citas / Blockquotes (> ...)
    if (trimmed.startsWith('>')) {
      if (!inBlockquote) {
        closeOpenBlocks();
        inBlockquote = true;
        html += '<blockquote class="chat-blockquote">\n';
      }
      const quoteText = trimmed.replace(/^>\s*/, '');
      html += `<p>${inlineFormat(quoteText)}</p>\n`;
      continue;
    } else if (inBlockquote) {
      html += '</blockquote>\n';
      inBlockquote = false;
    }

    // 6. Listas numeradas (1. ...)
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList || listType !== 'ol') {
        closeOpenBlocks();
        inList = true;
        listType = 'ol';
        html += '<ol class="chat-list">\n';
      }
      html += `<li>${inlineFormat(orderedMatch[2])}</li>\n`;
      continue;
    }

    // 7. Listas con viñetas (- ..., * ..., • ...)
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') {
        closeOpenBlocks();
        inList = true;
        listType = 'ul';
        html += '<ul class="chat-list">\n';
      }
      html += `<li>${inlineFormat(bulletMatch[1])}</li>\n`;
      continue;
    }

    // 8. Elementos anidados / identados en listas (ej: "   - Etapa: ...")
    if (inList && /^\s{2,}[-*•]\s+(.*)$/.test(rawLine)) {
      const nestedText = rawLine.trim().replace(/^[-*•]\s+/, '');
      html += `<li class="nested-li" style="margin-left: 18px; list-style-type: circle;">${inlineFormat(nestedText)}</li>\n`;
      continue;
    }

    // Si no es lista y estábamos en lista, cerrar
    if (inList) {
      html += listType === 'ul' ? '</ul>\n' : '</ol>\n';
      inList = false;
      listType = null;
    }

    // 9. Párrafo normal
    html += `<p>${inlineFormat(trimmed)}</p>\n`;
  }

  closeOpenBlocks();
  return html.trim();
}

function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function scrollToBottom(container) {
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
