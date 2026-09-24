/**
 * Background Service Worker / Event Page para Norma
 * - Abre o enfoca el Dashboard de Norma Hub.
 * - Sincroniza eventos entre pestañas.
 * - Proxy de red para peticiones de Content Scripts que deban evadir restricciones de CSP.
 */

async function openOrFocusDashboard() {
  const dashboardUrl = chrome.runtime.getURL('dashboard.html');

  try {
    const tabs = await chrome.tabs.query({ url: dashboardUrl });
    if (tabs && tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url: dashboardUrl });
    }
  } catch (error) {
    console.error('Error al abrir dashboard tab:', error);
    chrome.tabs.create({ url: dashboardUrl });
  }
}

// Click en el icono de la extensión en la barra del navegador
chrome.action.onClicked.addListener(openOrFocusDashboard);

chrome.runtime.onInstalled.addListener(() => {
  console.log('Norma Assistant Extension instalada exitosamente.');
});

// Listener de mensajes unificado
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Abrir Dashboard solicitado desde Gmail u otra ventana
  if (message.action === 'OPEN_DASHBOARD') {
    openOrFocusDashboard().then(() => sendResponse({ success: true }));
    return true;
  }

  // 2. Proxy de fetch para evadir restricciones de CSP / CORS en content scripts
  if (message.action === 'FETCH_PROXY') {
    const { url, options = {} } = message;
    fetch(url, options)
      .then(async (res) => {
        const bodyText = await res.text();
        const headers = {};
        try {
          res.headers.forEach((val, key) => {
            headers[key] = val;
          });
        } catch (_) {}

        sendResponse({
          success: true,
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          headers,
          bodyText
        });
      })
      .catch((err) => {
        sendResponse({
          success: false,
          error: err.message || String(err)
        });
      });
    return true; // Asíncrono
  }

  // 3. Escuchar actualizaciones de plantillas para refrescar pestañas de Gmail en vivo
  if (message.action === 'TEMPLATES_UPDATED') {
    chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        tabs.forEach((tab) => {
          try {
            const sendPromise = chrome.tabs.sendMessage(tab.id, { action: 'RELOAD_TEMPLATES' });
            if (sendPromise && typeof sendPromise.catch === 'function') {
              sendPromise.catch(() => {});
            }
          } catch (_) {}
        });
      }
    });
    sendResponse({ success: true });
    return true;
  }

  return false;
});
