/**
 * Norma Hub - Gestor de Configuración y Almacenamiento Local
 */

export const DEFAULT_CONFIG = {
  mondayApiKey: '',
  boardId: '1400120846',
  gasUrl: '',
  rootDriveFolderId: '',
  meetRecordingsFolderId: '',
  slidesKickoffTemplateId: '',
  geminiApiKey: '',
  geminiModel: 'gemini-3.7-flash',
  coeName: '',
  coeEmail: '',
  templateHeaderAsset: '',
  templateFooterAsset: ''
};

export async function getConfig() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(DEFAULT_CONFIG, (stored) => {
        resolve(stored);
      });
    } else {
      resolve(DEFAULT_CONFIG);
    }
  });
}

export async function saveConfig(newConfig) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(newConfig, () => {
        resolve(true);
      });
    } else {
      resolve(true);
    }
  });
}
