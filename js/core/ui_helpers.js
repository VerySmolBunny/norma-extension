/**
 * Norma Hub - Helpers de UI, Alertas y Parsers
 */

export function showToast(message) {
  const toast = document.getElementById('toastNotification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

export function showConfirmDialog({ title = '¿Estás seguro?', message = 'Esta acción no se puede deshacer.', icon = '🗑️', confirmText = 'Eliminar', cancelText = 'Cancelar', danger = true } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('appConfirmModal');
    if (!modal) {
      // Fallback si no está el modal en el DOM
      resolve(true);
      return;
    }

    const titleEl = document.getElementById('appConfirmTitle');
    const msgEl = document.getElementById('appConfirmMessage');
    const iconEl = document.getElementById('appConfirmIcon');
    const confirmBtn = document.getElementById('btnAppConfirmAction');
    const cancelBtn = document.getElementById('btnAppConfirmCancel');
    const closeBtn = document.getElementById('btnAppConfirmClose');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.style.backgroundColor = danger ? '#dc2626' : 'var(--primary, #2563eb)';
      confirmBtn.style.borderColor = danger ? '#dc2626' : 'var(--primary, #2563eb)';
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    const cleanup = () => {
      modal.style.display = 'none';
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      if (closeBtn) closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
    };

    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onBackdrop = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    if (closeBtn) closeBtn.removeEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);

    modal.style.display = 'flex';
  });
}

export function showStatusAlert(type, htmlContent) {
  const container = document.getElementById('statusContainer');
  if (!container) return;
  const bg = type === 'error' ? '#fef2f2' : type === 'info' ? '#eff6ff' : '#ecfdf5';
  const border = type === 'error' ? '#fecaca' : type === 'info' ? '#bfdbfe' : '#a7f3d0';
  const color = type === 'error' ? '#991b1b' : type === 'info' ? '#1e40af' : '#065f46';

  container.innerHTML = `
    <div style="background: ${bg}; border: 1px solid ${border}; color: ${color}; padding: 12px 16px; border-radius: var(--radius-md); font-size: 13px; margin-bottom: 16px;">
      ${htmlContent}
    </div>
  `;
}

export function clearStatusAlert() {
  const container = document.getElementById('statusContainer');
  if (container) container.innerHTML = '';
}

export function showFolderAlert(type, text) {
  const container = document.getElementById('folderStatusContainer');
  if (!container) return;
  const bg = type === 'error' ? '#fef2f2' : type === 'warning' ? '#fffbeb' : '#eff6ff';
  const color = type === 'error' ? '#991b1b' : type === 'warning' ? '#92400e' : '#1e40af';
  const border = type === 'error' ? '#fecaca' : type === 'warning' ? '#fde68a' : '#bfdbfe';
  container.innerHTML = `<div style="padding:10px 14px; border-radius:var(--radius-sm); font-size:12.5px; background:${bg}; color:${color}; border:1px solid ${border};">${text}</div>`;
}

export function clearFolderAlert() {
  const container = document.getElementById('folderStatusContainer');
  if (container) container.innerHTML = '';
}

export function showRecordingAlert(type, text) {
  const container = document.getElementById('recordingStatusContainer');
  if (!container) return;
  const bg = type === 'error' ? '#fef2f2' : '#eff6ff';
  const color = type === 'error' ? '#991b1b' : '#1e40af';
  const border = type === 'error' ? '#fecaca' : '#bfdbfe';
  container.innerHTML = `<div style="padding:10px 14px; border-radius:var(--radius-sm); font-size:12.5px; background:${bg}; color:${color}; border:1px solid ${border};">${text}</div>`;
}

export function clearRecordingAlert() {
  const container = document.getElementById('recordingStatusContainer');
  if (container) container.innerHTML = '';
}

export function extractFolderId(input) {
  if (!input) return '';
  const str = input.toString().trim();
  const match = str.match(/folders\/([a-zA-Z0-9_-]+)/i);
  if (match) return match[1];
  const matchId = str.match(/id=([a-zA-Z0-9_-]+)/i);
  if (matchId) return matchId[1];
  return str.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function extractFolderIds(input) {
  if (!input) return [];
  if (Array.isArray(input)) {
    const list = [];
    input.forEach(it => {
      const extracted = extractFolderIds(it);
      extracted.forEach(id => list.push(id));
    });
    return Array.from(new Set(list));
  }
  const str = input.toString().trim();
  const tokens = str.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const ids = [];
  tokens.forEach(tok => {
    const id = extractFolderId(tok);
    if (id) ids.push(id);
  });
  return Array.from(new Set(ids));
}

export function formatDateYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
