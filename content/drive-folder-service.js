/**
 * Servicio de Resolución de Carpetas de Google Drive por Cliente para scripts de contenido de Gmail.
 * Lee desde chrome.storage.local el caché sincronizado por Norma y ofrece resolución en tiempo real.
 */

(function() {
    const DRIVE_FOLDERS_CACHE_KEY = 'norma_drive_folders_cache';
    const LEGACY_DRIVE_FOLDERS_CACHE_KEY = 'friday_drive_folders_cache';

    function normalizeDriveClientName(name) {
        if (!name) return '';
        return name.toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    class DriveFolderContentService {
        /**
         * Obtiene el caché estructurado de carpetas desde storage local
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
         * Resuelve automáticamente la URL de la carpeta de Drive de un cliente
         */
        static async resolveClientFolderUrl(client) {
            if (!client) return '';

            // 1. Propiedades directas
            if (client.folderUrl && client.folderUrl.startsWith('http')) return client.folderUrl;
            if (client.driveFolderUrl && client.driveFolderUrl.startsWith('http')) return client.driveFolderUrl;
            if (client.linkCarpeta && client.linkCarpeta.startsWith('http')) return client.linkCarpeta;

            // 2. Columna en Monday (allValues)
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

            // 4. Búsqueda difusa en items
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

            return '';
        }

        /**
         * Reemplaza variables en un texto o HTML asegurando que no se generen errores de codificación URI
         * ni URLs duplicadas con https://https://
         */
        static replaceVariableInHtml(html, varKey, value) {
            if (!html) return '';
            const val = value || '';

            const regexPlain = new RegExp(`\\{\\{\\s*${varKey}\\s*\\}\\}`, 'gi');
            const regexEncoded = new RegExp(`%7B%7B\\s*${varKey}\\s*%7D%7D`, 'gi');

            let res = html;

            if (val && /^https?:\/\//i.test(val)) {
                const hrefRegex = new RegExp(`(href=["'])(?:https?:\\/\\/)?(?:\\{\\{\\s*${varKey}\\s*\\}\\}|%7B%7B\\s*${varKey}\\s*%7D%7D)`, 'gi');
                res = res.replace(hrefRegex, `$1${val}`);
            }

            res = res.replace(regexPlain, val);
            res = res.replace(regexEncoded, val);
            return res;
        }
    }

    window.DriveFolderContentService = DriveFolderContentService;
})();
