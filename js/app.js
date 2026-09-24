/**
 * Norma Hub - Dashboard Entry Point
 * Orquesta la navegación, servicios y controladores modulares
 */

import { initNavigation } from './core/router.js';
import { initSettingsController } from './controllers/settings_controller.js';
import { initSyncController } from './controllers/sync_controller.js';
import { initDriveController } from './controllers/drive_controller.js';
import { OnboardingController } from './controllers/onboarding_controller.js';
import { CierreController } from './controllers/cierre_controller.js';
import { initTemplatesController } from './controllers/templates_controller.js';

// Instancias globales de controladores de flujo
const onboardingController = new OnboardingController();
const cierreController = new CierreController();

// Estado global de la aplicación
const state = {
  isSyncing: false,
  currentDrafts: [],
  folderSyncData: null,
  recordingsData: null,
  activePreset: 'allday'
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Controladores
  initSettingsController();
  initSyncController(state);
  onboardingController.init();
  cierreController.init();
  window.cierreController = cierreController;
  initDriveController(state);
  const templatesController = initTemplatesController();
  window.templatesController = templatesController;

  // 2. Inicializar Enrutador
  initNavigation((viewId) => {
    if (viewId === 'viewOnboarding') {
      onboardingController.loadClients(false);
      onboardingController.loadTemplates();
    } else if (viewId === 'viewCierre') {
      cierreController.loadClients(false);
      cierreController.loadTemplate();
    } else if (viewId === 'viewTemplates' && templatesController && typeof templatesController.refresh === 'function') {
      templatesController.refresh();
    }
  });
});
