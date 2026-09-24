/**
 * Servicio unificado de resolución y almacenamiento en caché de carpetas de Google Drive por cliente.
 * Utilizado para vincular automáticamente enlaces de carpetas y grabaciones en plantillas de correo y onboarding.
 */

import { GasService } from './gas_service.js';

export const DRIVE_FOLDERS_CACHE_KEY = 'norma_drive_folders_cache';
export const LEGACY_DRIVE_FOLDERS_CACHE_KEY = 'friday_drive_folders_cache';

export function normalizeDriveClientName(name) {
  if (!name) return '';
  return name.toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9]/g, ' ')       // Signos a espacios
    .replace(/\s+/g, ' ')            // Unifica espacios
    .trim();
}

export class DriveFolderService {
  /**
   * Obtiene el caché estructurado de carpetas desde chrome.storage.local
   */
  static async getFoldersCache() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([DRIVE_FOLDERS_CACHE_KEY, LEGACY_DRIVE_FOLDERS_CACHE_KEY], (res) => {
          const cache = res[DRIVE_FOLDERS_CACHE_KEY] || res[LEGACY_DRIVE_FOLDERS_CACHE_KEY] || {
            byClientId: {},
            byClientName: {},
            items: [],
            lastUpdated: null
          };
          resolve(cache);
        });
      } else {
        resolve({ byClientId: {}, byClientName: {}, items: [], lastUpdated: null });
      }
    });
  }

  /**
   * Guarda o combina una lista de carpetas en el caché persistente
   * @param {Array<{clientId?: string, clientName: string, folderId?: string, folderName?: string, folderUrl: string}>} foldersList
   */
  static async saveFoldersCache(foldersList) {
    if (!Array.isArray(foldersList) || foldersList.length === 0) return;

    const current = await this.getFoldersCache();
    const byClientId = { ...current.byClientId };
    const byClientName = { ...current.byClientName };
    const itemsMap = new Map();

    // Rehidratar items existentes
    (current.items || []).forEach(item => {
      const key = item.clientId || normalizeDriveClientName(item.clientName);
      if (key) itemsMap.set(key, item);
    });

    // Agregar nuevos items
    foldersList.forEach(f => {
      if (!f || !f.folderUrl) return;

      const normName = normalizeDriveClientName(f.clientName || f.folderName);
      const entry = {
        clientId: f.clientId ? String(f.clientId) : '',
        clientName: f.clientName || f.folderName || '',
        folderId: f.folderId || '',
        folderName: f.folderName || f.clientName || '',
        folderUrl: f.folderUrl,
        updatedAt: Date.now()
      };

      if (entry.clientId) {
        byClientId[entry.clientId] = entry.folderUrl;
        itemsMap.set(entry.clientId, entry);
      }
      if (normName) {
        byClientName[normName] = entry.folderUrl;
        itemsMap.set(normName, entry);
      }
    });

    const newCache = {
      byClientId,
      byClientName,
      items: Array.from(itemsMap.values()),
      lastUpdated: Date.now()
    };

    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          [DRIVE_FOLDERS_CACHE_KEY]: newCache,
          [LEGACY_DRIVE_FOLDERS_CACHE_KEY]: newCache
        }, () => resolve(newCache));
      } else {
        resolve(newCache);
      }
    });
  }

  /**
   * Registra una sola carpeta en el caché
   */
  static async addFolderToCache(folderData) {
    if (!folderData || !folderData.folderUrl) return;
    return await this.saveFoldersCache([folderData]);
  }

  /**
   * Resuelve automáticamente la URL de la carpeta de Drive de un cliente usando el flujo multi-nivel:
   * 1. Propiedad directa en el objeto cliente
   * 2. Columna en Monday (allValues)
   * 3. Búsqueda en Caché local por clientId o nombre normalizado
   * 4. Búsqueda difusa (substring matching)
   * 5. Opcional: Consulta en vivo a Google Apps Script
   */
  static async resolveClientFolderUrl(client, config = {}) {
    if (!client) return '';

    // 1. Propiedades directas
    if (client.folderUrl && client.folderUrl.startsWith('http')) return client.folderUrl;
    if (client.driveFolderUrl && client.driveFolderUrl.startsWith('http')) return client.driveFolderUrl;
    if (client.linkCarpeta && client.linkCarpeta.startsWith('http')) return client.linkCarpeta;

    // 2. Columnas en Monday (allValues)
    if (client.allValues && typeof client.allValues === 'object') {
      for (const [k, val] of Object.entries(client.allValues)) {
        if (/carpeta|drive|grabacion|enlace.*carpeta|link.*carpeta/i.test(k) && typeof val === 'string' && val.startsWith('http')) {
          return val.trim();
        }
      }
    }

    // 3. Caché local en chrome.storage
    const cache = await this.getFoldersCache();
    const clientId = client.id ? String(client.id) : '';
    if (clientId && cache.byClientId && cache.byClientId[clientId]) {
      return cache.byClientId[clientId];
    }

    const cName = client.name || client.empresa || client.cliente || '';
    const normName = normalizeDriveClientName(cName);
    if (normName && cache.byClientName && cache.byClientName[normName]) {
      return cache.byClientName[normName];
    }

    // 4. Búsqueda difusa en el listado de items del caché
    if (normName && normName.length >= 4 && Array.isArray(cache.items)) {
      const match = cache.items.find(item => {
        const itemNorm = normalizeDriveClientName(item.clientName || item.folderName);
        if (!itemNorm) return false;
        return itemNorm.includes(normName) || normName.includes(itemNorm);
      });
      if (match && match.folderUrl) {
        return match.folderUrl;
      }
    }

    // 5. Consulta en vivo a Google Apps Script si está disponible
    const gasUrl = config.gasUrl;
    const rootFolderId = config.rootDriveFolderId || config.rootClientsFolderId || config.rootFolderId;
    if (gasUrl && rootFolderId && cName) {
      try {
        const res = await GasService.getClientFolder(gasUrl, {
          rootFolderId,
          clientName: cName,
          createIfMissing: false
        });
        if (res && res.folderUrl) {
          await this.addFolderToCache({
            clientId,
            clientName: cName,
            folderId: res.folderId,
            folderName: res.folderName || cName,
            folderUrl: res.folderUrl
          });
          return res.folderUrl;
        }
      } catch (err) {
        console.warn('[DriveFolderService] No se pudo obtener carpeta desde GAS:', err.message);
      }
    }

    return '';
  }

  /**
   * Reemplaza variables en un texto o HTML asegurando que no se generen errores de codificación URI
   * ni URLs duplicadas con https://https://
   */
  static replaceVariableInHtml(html, varKey, value) {
    if (!html) return '';
    const val = value || '';

    // Reemplazo estándar {{varKey}}
    const regexPlain = new RegExp(`\\{\\{\\s*${varKey}\\s*\\}\\}`, 'gi');
    // Reemplazo con llaves codificadas por navegador %7B%7BvarKey%7D%7D
    const regexEncoded = new RegExp(`%7B%7B\\s*${varKey}\\s*%7D%7D`, 'gi');

    let res = html;

    // Si el valor ya es una URL con protocolo, limpiar prefijos duplicados en atributos href
    if (val && /^https?:\/\//i.test(val)) {
      const hrefRegex = new RegExp(`(href=["'])(?:https?:\\/\\/)?(?:\\{\\{\\s*${varKey}\\s*\\}\\}|%7B%7B\\s*${varKey}\\s*%7D%7D)`, 'gi');
      res = res.replace(hrefRegex, `$1${val}`);
    }

    res = res.replace(regexPlain, val);
    res = res.replace(regexEncoded, val);
    return res;
  }
}
