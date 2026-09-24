/**
 * Norma Hub - Enrutador de Vistas y Navegación
 */

export function initNavigation(onViewChange) {
  const navItems = [
    { btnId: 'navSync', viewId: 'viewSync', title: 'Sincronizador de Reuniones' },
    { btnId: 'navOnboarding', viewId: 'viewOnboarding', title: 'Asignación & Onboarding de Clientes' },
    { btnId: 'navCierre', viewId: 'viewCierre', title: 'Cierre de Implementación' },
    { btnId: 'navDrive', viewId: 'viewDrive', title: 'Carpetas & Grabaciones' },
    { btnId: 'navTemplates', viewId: 'viewTemplates', title: 'Plantillas de Correo Electrónico' },
    { btnId: 'navSettings', viewId: 'viewSettings', title: 'Ajustes & Configuración' }
  ];

  const titleEl = document.getElementById('currentViewTitle');

  navItems.forEach(({ btnId, viewId, title }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
      const activeView = document.getElementById(viewId);
      if (activeView) activeView.classList.add('active');

      if (titleEl) titleEl.textContent = title;

      if (typeof onViewChange === 'function') {
        onViewChange(viewId);
      }
    });
  });
}

export function navigateTo(viewId) {
  const viewMap = {
    'viewSync': 'navSync',
    'viewOnboarding': 'navOnboarding',
    'viewCierre': 'navCierre',
    'viewDrive': 'navDrive',
    'viewTemplates': 'navTemplates',
    'viewSettings': 'navSettings'
  };
  const btnId = viewMap[viewId];
  if (btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.click();
  }
}
