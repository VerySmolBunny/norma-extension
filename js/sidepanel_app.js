/**
 * Norma Hub - Sidepanel Entry Point
 * Versión ligera optimizada para el panel lateral de Chrome
 */

import { initSettingsController } from './controllers/settings_controller.js';
import { initSyncController } from './controllers/sync_controller.js';

const state = {
  isSyncing: false,
  currentDrafts: [],
  activePreset: 'allday'
};

document.addEventListener('DOMContentLoaded', () => {
  initSettingsController();
  initSyncController(state);
});
