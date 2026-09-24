/**
 * Servicio de Sincronización y Conexión con Firebase Firestore
 * Utiliza la API REST de Firestore para máxima compatibilidad con Manifest V3 (sin bloqueos de CSP ni dependencias externas).
 */

import { DEFAULT_WELCOME_TEMPLATE_HTML } from '../core/welcome_assets.js';

const DEFAULT_CONFIG = {
    projectId: '', // Tu Project ID de Firebase
    apiKey: '',    // Tu Web API Key de Firebase
    adminEmails: ['admin@tuempresa.com'], // Correos con permisos de Administrador
    currentUserEmail: 'admin@tuempresa.com' // Correo actual configurado
};

// Plantillas de ejemplo iniciales (se usan si Firestore aún no está configurado)
const INITIAL_TEMPLATES = [
    {
        id: 'tpl_bienvenida_asistencia',
        title: 'Bienvenida a Buk Asistencia',
        category: 'Bienvenida',
        subject: '¡Bienvenid@ a Buk! 🚀 Coordinación de Kick Off - Módulo Control de Asistencia | {{empresa}}',
        bodyHtml: DEFAULT_WELCOME_TEMPLATE_HTML,
        variables: ['empresa', 'nombre_cliente', 'mi_nombre', 'agenda_url'],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'tpl_seguimiento',
        title: '📋 Seguimiento de Propuesta / Cotización',
        category: 'Ventas',
        subject: 'Seguimiento a nuestra propuesta - {{empresa}}',
        bodyHtml: `<p>Estimado/a <strong>{{nombre_cliente}}</strong>,</p>
<p>Espero que estés teniendo una excelente semana.</p>
<p>Te contacto brevemente para saber si tuviste oportunidad de revisar la propuesta que te enviamos el día <em>{{fecha_propuesta}}</em> y si tienes alguna duda respecto a los alcances o presupuesto.</p>
<p>Estaremos encantados de resolver cualquier inquietud o coordinar un breve llamado.</p>
<br/>
<p>Atentamente,<br/><strong>{{mi_nombre}}</strong></p>`,
        variables: ['empresa', 'nombre_cliente', 'fecha_propuesta', 'mi_nombre'],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'tpl_soporte',
        title: '🛠️ Confirmación de Ticket y Soporte Técnico',
        category: 'Soporte',
        subject: 'Requerimiento recibido: Ticket #{{numero_ticket}}',
        bodyHtml: `<p>Hola <strong>{{nombre_cliente}}</strong>,</p>
<p>Hemos recibido tu solicitud y ya ha sido asignada a nuestro equipo técnico bajo el número de seguimiento <strong>#{{numero_ticket}}</strong>.</p>
<p>Nuestro tiempo estimado de respuesta para este tipo de requerimiento es de <strong>24 a 48 horas hábiles</strong>.</p>
<p>Si deseas aportar más antecedentes, simplemente responde a este mismo correo.</p>
<br/>
<p>Atentamente,<br/><strong>Centro de Ayuda y Soporte</strong></p>`,
        variables: ['nombre_cliente', 'numero_ticket'],
        updatedAt: new Date().toISOString()
    },
    {
        id: 'tpl_cierre_implementacion',
        title: '🏁 Cierre de Implementación y Grabaciones',
        category: 'Cierre',
        subject: '¡Felicitaciones por finalizar tu Implementación! 🎉 Grabaciones y Accesos | {{empresa}}',
        bodyHtml: `<p>Hola <strong>{{nombre_cliente}}</strong> y equipo de <strong>{{empresa}}</strong>,</p>
<p>¡Esperamos que se encuentren muy bien!</p>
<p>Queremos felicitarlos formalmente por culminar con éxito la etapa de implementación y puesta en marcha del módulo de <strong>Control de Asistencia</strong> en Buk. Ha sido un placer trabajar junto a ustedes durante todo este proceso. 🚀</p>
<p>Tal como conversamos en nuestra última reunión de cierre, les comparto el acceso directo a su carpeta de Google Drive, donde encontrarán alojadas <strong>todas las grabaciones de las sesiones realizadas</strong>, manuales de uso y los archivos clave del proyecto:</p>
<table border="0" cellpadding="0" cellspacing="0" style="margin: 20px auto; text-align: center; width: auto;">
  <tr>
    <td align="center" style="border-radius: 8px; background-color: #2563eb;">
      <a href="{{link_carpeta}}" target="_blank" style="font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff; text-decoration: none; border-radius: 8px; padding: 12px 28px; border: 1px solid #2563eb; display: inline-block; font-weight: 600; line-height: 1.2; text-align: center;">
        📁 Acceder a Carpeta de Grabaciones y Archivos
      </a>
    </td>
  </tr>
</table>
<p>También puedes acceder directamente haciendo clic en este enlace: <a href="{{link_carpeta}}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Abrir carpeta en Google Drive</a>.</p>
<p>A partir de este momento, ante cualquier consulta operativa o soporte continuo, recuerden que pueden contactar a nuestro equipo de SAC / Soporte a través de los canales habituales en la plataforma.</p>
<br/>
<p>¡Mucho éxito en esta nueva etapa!</p>
<p>Un abrazo,<br/><strong>{{mi_nombre}}</strong></p>`,
        variables: ['empresa', 'nombre_cliente', 'link_carpeta', 'mi_nombre'],
        updatedAt: new Date().toISOString()
    }
];

class FirebaseService {
    constructor() {
        this.cacheKey = 'ext_correo_templates_cache';
        this.configKey = 'ext_correo_firebase_config';
    }

    /**
     * Obtiene la configuración almacenada en Chrome Storage
     */
    async getConfig() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.configKey], (result) => {
                    resolve(result[this.configKey] || DEFAULT_CONFIG);
                });
            } else {
                resolve(DEFAULT_CONFIG);
            }
        });
    }

    /**
     * Guarda la configuración de Firebase
     */
    async saveConfig(config) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [this.configKey]: config }, () => {
                    resolve(true);
                });
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Verifica si un correo tiene rol de administrador / permisos de edición.
     * Cualquier usuario que use la extensión puede crear y editar plantillas.
     */
    async isAdmin(email) {
        return true;
    }

    /**
     * Transforma un documento de Firestore REST a un objeto JavaScript simple
     */
    _fromFirestoreDoc(doc) {
        const id = doc.name ? doc.name.split('/').pop() : doc.id;
        const fields = doc.fields || {};
        
        return {
            id: id,
            title: fields.title ? fields.title.stringValue : '',
            category: fields.category ? fields.category.stringValue : 'General',
            subject: fields.subject ? fields.subject.stringValue : '',
            bodyHtml: fields.bodyHtml ? fields.bodyHtml.stringValue : '',
            headerAsset: fields.headerAsset ? fields.headerAsset.stringValue : '',
            footerAsset: fields.footerAsset ? fields.footerAsset.stringValue : '',
            variables: fields.variables && fields.variables.arrayValue && fields.variables.arrayValue.values
                ? fields.variables.arrayValue.values.map(v => v.stringValue)
                : [],
            updatedAt: fields.updatedAt ? fields.updatedAt.stringValue : new Date().toISOString()
        };
    }

    /**
     * Transforma un objeto JS a la estructura de campos de Firestore REST
     */
    _toFirestoreDoc(template) {
        const variables = template.variables || [];
        return {
            fields: {
                title: { stringValue: template.title || '' },
                category: { stringValue: template.category || 'General' },
                subject: { stringValue: template.subject || '' },
                bodyHtml: { stringValue: template.bodyHtml || '' },
                headerAsset: { stringValue: template.headerAsset || '' },
                footerAsset: { stringValue: template.footerAsset || '' },
                variables: {
                    arrayValue: {
                        values: variables.map(v => ({ stringValue: v }))
                    }
                },
                updatedAt: { stringValue: new Date().toISOString() }
            }
        };
    }

    /**
     * Obtiene la lista de plantillas desde Firestore con respaldo en caché local
     */
    async getTemplates(forceRefresh = false) {
        const config = await this.getConfig();

        // 1. Si no hay projectId de Firebase configurado, retornar de la caché o plantillas iniciales
        if (!config.projectId || !config.apiKey) {
            return this.getLocalTemplates();
        }

        // 2. Si no es refresh forzado, intentar leer primero de caché local para velocidad instantánea
        if (!forceRefresh) {
            const cached = await this.getLocalTemplates(false);
            if (cached && cached.length > 0) {
                // Actualizar en segundo plano sin bloquear
                this._fetchFromFirestore(config).catch(err => console.warn('Sync en segundo plano falló:', err));
                return cached;
            }
        }

        // 3. Obtener desde Firestore REST API
        try {
            return await this._fetchFromFirestore(config);
        } catch (error) {
            console.error('Error obteniendo plantillas de Firestore, usando caché:', error);
            return this.getLocalTemplates();
        }
    }

    async _fetchFromFirestore(config) {
        const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/templates?key=${config.apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Firestore API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const documents = data.documents || [];
        const remoteTemplates = documents.map(doc => this._fromFirestoreDoc(doc));

        // Si la base de datos remota está vacía, retornar caché local o plantillas iniciales
        if (remoteTemplates.length === 0) {
            const local = await this.getLocalTemplates(false);
            if (local && local.length > 0) return local;
            await this._saveLocalTemplates(INITIAL_TEMPLATES);
            return INITIAL_TEMPLATES;
        }

        // Combinar inteligentemente con la caché local respetando updatedAt más reciente
        const localTemplates = await this.getLocalTemplates(false);
        const localMap = new Map((localTemplates || []).map(t => [t.id, t]));
        
        const mergedList = remoteTemplates.map(remoteTpl => {
            const localTpl = localMap.get(remoteTpl.id);
            if (!localTpl) return remoteTpl;
            
            // Si la versión local es más reciente que la remota, conservar la versión local
            const remoteTime = remoteTpl.updatedAt ? new Date(remoteTpl.updatedAt).getTime() : 0;
            const localTime = localTpl.updatedAt ? new Date(localTpl.updatedAt).getTime() : 0;
            if (localTime > remoteTime) {
                return localTpl;
            }
            return remoteTpl;
        });

        // Incluir plantillas locales que aún no existen en el backend remoto
        const remoteIds = new Set(remoteTemplates.map(t => t.id));
        for (const localTpl of (localTemplates || [])) {
            if (!remoteIds.has(localTpl.id)) {
                mergedList.push(localTpl);
            }
        }

        // Guardar en caché local
        await this._saveLocalTemplates(mergedList);
        return mergedList;
    }

    /**
     * Obtiene plantillas guardadas localmente
     */
    async getLocalTemplates(fallbackToInitial = true) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([this.cacheKey], (result) => {
                    let list = result[this.cacheKey];
                    if (Array.isArray(list) && list.length > 0) {
                        resolve(list);
                    } else if (fallbackToInitial && (!list || (Array.isArray(list) && list.length === 0))) {
                        chrome.storage.local.set({ [this.cacheKey]: INITIAL_TEMPLATES });
                        resolve(INITIAL_TEMPLATES);
                    } else {
                        resolve(list || []);
                    }
                });
            } else {
                resolve(INITIAL_TEMPLATES);
            }
        });
    }

    async _saveLocalTemplates(templates) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [this.cacheKey]: templates }, () => resolve(true));
            } else {
                resolve(true);
            }
        });
    }

    /**
     * Guarda o actualiza una plantilla (solo para Administradores)
     */
    async saveTemplate(template) {
        const config = await this.getConfig();
        const id = template.id || `tpl_${Date.now()}`;
        const templateWithId = { ...template, id, updatedAt: new Date().toISOString() };

        // Extraer variables {{variable}} del subject y body
        const varsFound = new Set();
        const regex = /\{\{([^}]+)\}\}/g;
        let match;
        const fullContent = (template.subject || '') + ' ' + (template.bodyHtml || '');
        while ((match = regex.exec(fullContent)) !== null) {
            varsFound.add(match[1].trim());
        }
        templateWithId.variables = Array.from(varsFound);

        // Actualizar caché local de inmediato para garantizar persistencia local
        const currentList = await this.getLocalTemplates(false);
        const existingIndex = currentList.findIndex(t => t.id === id);
        let updatedList;
        if (existingIndex >= 0) {
            updatedList = [...currentList];
            updatedList[existingIndex] = templateWithId;
        } else {
            updatedList = [templateWithId, ...currentList];
        }
        await this._saveLocalTemplates(updatedList);

        // Guardar en Firestore si está configurado
        if (config.projectId && config.apiKey) {
            try {
                const docData = this._toFirestoreDoc(templateWithId);
                const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/templates/${id}?key=${config.apiKey}`;
                
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(docData)
                });

                if (!response.ok) {
                    const err = await response.text();
                    console.warn(`Error guardando en Firestore: ${err}`);
                    templateWithId.syncWarning = `Error en nube (${response.status}): ${err}`;
                }
            } catch (netErr) {
                console.warn('Fallo de red guardando en Firestore:', netErr);
                templateWithId.syncWarning = `Fallo de conexión con Firebase: ${netErr.message || netErr}`;
            }
        }

        return templateWithId;
    }

    /**
     * Elimina una plantilla (solo para Administradores)
     */
    async deleteTemplate(id) {
        const config = await this.getConfig();

        if (config.projectId && config.apiKey) {
            try {
                const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/templates/${id}?key=${config.apiKey}`;
                const response = await fetch(url, { method: 'DELETE' });
                if (!response.ok && response.status !== 404) {
                    const err = await response.text();
                    console.warn(`Error eliminando de Firestore: ${err}`);
                }
            } catch (netErr) {
                console.warn('Fallo de red eliminando en Firestore:', netErr);
            }
        }

        const currentList = await this.getLocalTemplates(false);
        const updatedList = currentList.filter(t => t.id !== id);
        await this._saveLocalTemplates(updatedList);
        return true;
    }

    /**
     * Obtiene la lista de categorías / etiquetas
     */
    async getCategories() {
        const defaultCats = ['Comercial', 'Ventas', 'Soporte', 'Operaciones', 'Bienvenida', 'General'];

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['ext_correo_custom_categories'], async (res) => {
                    let custom = res.ext_correo_custom_categories;
                    if (!Array.isArray(custom)) {
                        custom = [...defaultCats];
                        await new Promise(r => chrome.storage.local.set({ ext_correo_custom_categories: custom }, r));
                    }
                    this._memoryCategories = [...custom];
                    resolve(this._memoryCategories);
                });
            } else {
                if (!this._memoryCategories) {
                    this._memoryCategories = [...defaultCats];
                }
                resolve([...this._memoryCategories]);
            }
        });
    }

    /**
     * Guarda / añade una nueva categoría
     */
    async saveCategory(name) {
        if (!name || typeof name !== 'string') return;
        const cleanName = name.trim();
        if (!cleanName) return;

        const categories = await this.getCategories();
        if (!categories.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
            categories.push(cleanName);
        }
        this._memoryCategories = [...categories];

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ ext_correo_custom_categories: categories }, () => resolve(categories));
            } else {
                resolve(categories);
            }
        });
    }

    /**
     * Renombra una categoría y actualiza todas las plantillas asociadas
     */
    async renameCategory(oldName, newName) {
        if (!oldName || !newName) return;
        const cleanOld = oldName.trim();
        const cleanNew = newName.trim();
        if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) return;

        // Actualizar lista de categorías
        let categories = await this.getCategories();
        categories = categories.map(c => c.toLowerCase() === cleanOld.toLowerCase() ? cleanNew : c);
        const uniqueCats = Array.from(new Set(categories));
        this._memoryCategories = [...uniqueCats];

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise((res) => chrome.storage.local.set({ ext_correo_custom_categories: uniqueCats }, res));
        }

        // Actualizar plantillas que tengan la categoría antigua
        const templates = await this.getLocalTemplates(false);
        let changed = false;
        for (const t of templates) {
            if (t.category && t.category.trim().toLowerCase() === cleanOld.toLowerCase()) {
                t.category = cleanNew;
                changed = true;
                if (typeof this.saveTemplate === 'function') {
                    await this.saveTemplate(t).catch(e => console.warn('Error renombrando plantilla en Firestore:', e));
                }
            }
        }

        if (changed) {
            await this._saveLocalTemplates(templates);
        }

        return uniqueCats;
    }

    /**
     * Elimina una categoría y reasigna sus plantillas a una categoría por defecto
     */
    async deleteCategory(categoryName, fallbackCategory = 'General') {
        if (!categoryName) return;
        const cleanName = categoryName.trim().toLowerCase();

        let categories = await this.getCategories();
        categories = categories.filter(c => c.trim().toLowerCase() !== cleanName);
        if (!categories.some(c => c.trim().toLowerCase() === fallbackCategory.toLowerCase())) {
            categories.push(fallbackCategory);
        }
        this._memoryCategories = [...categories];

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await new Promise((res) => chrome.storage.local.set({ ext_correo_custom_categories: categories }, res));
        }

        // Reasignar plantillas con esa categoría
        const templates = await this.getLocalTemplates(false);
        let changed = false;
        for (const t of templates) {
            if (t.category && t.category.trim().toLowerCase() === cleanName) {
                t.category = fallbackCategory;
                changed = true;
                if (typeof this.saveTemplate === 'function') {
                    await this.saveTemplate(t).catch(e => console.warn('Error reasignando plantilla en Firestore:', e));
                }
            }
        }

        if (changed) {
            await this._saveLocalTemplates(templates);
        }

        return categories;
    }
}

// Exportar como singleton
const firebaseService = new FirebaseService();
if (typeof module !== 'undefined') {
    module.exports = firebaseService;
}
export default firebaseService;
export { firebaseService, FirebaseService };

