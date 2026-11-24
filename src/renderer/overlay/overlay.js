let store = null;
let toastTimeout = null;

const elType = document.getElementById('proxyType');
const elIndex = document.getElementById('proxyIndex');
const elHost = document.getElementById('proxyHost');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnFill = document.getElementById('btnFill');
const btnDone = document.getElementById('btnDone');
const lblDoneText = document.getElementById('lblDoneText');
const btnCopy = document.getElementById('btnCopy');
const btnDashboard = document.getElementById('btnDashboard');
const btnClose = document.getElementById('btnClose');
const elToast = document.getElementById('toast');

function showToast(message, type = 'info') {
  if (toastTimeout) clearTimeout(toastTimeout);
  elToast.textContent = message;
  elToast.className = `toast show ${type}`;
  toastTimeout = setTimeout(() => {
    elToast.className = 'toast';
  }, 2200);
}

function updateUI(data) {
  store = data;
  const proxies = store.proxies || [];
  const isDone = (p) => p.status === 'done' || p.status === 'used' || p.status === 'inactive';
  
  // Filter ONLY active / unused proxies for the floating toolbar
  const activeProxies = proxies.filter(p => !isDone(p));
  const s = store.settings || {};

  if (activeProxies.length === 0) {
    elType.textContent = proxies.length > 0 ? 'ALL DONE' : 'NONE';
    elType.className = 'type-badge';
    elIndex.textContent = '0 / 0';
    elHost.textContent = proxies.length > 0 ? 'All proxies inactive / used' : 'No proxy loaded';
    elHost.title = 'Open dashboard to add or re-activate proxies';
    elHost.style.textDecoration = 'none';
    elHost.style.opacity = '0.6';
    btnFill.style.opacity = '0.4';
    btnFill.style.pointerEvents = 'none';
    btnDone.style.display = 'none';
    return;
  }

  btnFill.style.opacity = '1';
  btnFill.style.pointerEvents = 'auto';
  btnDone.style.display = 'inline-flex';

  let currentIdx = 0;
  if (s.activeProxyId) {
    const foundIdx = activeProxies.findIndex(p => p.id === s.activeProxyId);
    if (foundIdx !== -1) {
      currentIdx = foundIdx;
    }
  } else if (typeof s.activeProxyIndex === 'number' && s.activeProxyIndex >= 0 && s.activeProxyIndex < activeProxies.length) {
    currentIdx = s.activeProxyIndex;
  }

  const active = activeProxies[currentIdx];
  elType.textContent = active.type || 'HTTP';
  elType.className = `type-badge ${(active.type || '').toLowerCase()}`;
  elIndex.textContent = `${currentIdx + 1} / ${activeProxies.length}`;
  elHost.textContent = `${active.host}:${active.port}`;
  elHost.title = `${active.host}:${active.port} (${active.username ? active.username + '@' : ''} Click to copy)`;
  elHost.style.textDecoration = 'none';
  elHost.style.opacity = '1';

  btnDone.className = 'done-btn';
  lblDoneText.textContent = 'Done';
  btnDone.title = 'Mark as Done & Remove from Toolbar (Alt+D)';
}

// Button Events
btnPrev.addEventListener('click', async () => {
  await window.api.prevProxy();
});

btnNext.addEventListener('click', async () => {
  await window.api.nextProxy();
});

btnDone.addEventListener('click', async () => {
  btnDone.style.transform = 'scale(0.92)';
  setTimeout(() => { btnDone.style.transform = ''; }, 150);
  await window.api.toggleProxyStatus();
});

btnFill.addEventListener('click', async () => {
  btnFill.style.transform = 'scale(0.92)';
  setTimeout(() => { btnFill.style.transform = ''; }, 150);
  await window.api.triggerFill(true);
});

btnCopy.addEventListener('click', async () => {
  const copied = await window.api.copyCurrent();
  if (copied) {
    showToast('Copied to clipboard!', 'success');
  } else {
    showToast('Nothing to copy', 'error');
  }
});

elHost.addEventListener('click', async () => {
  const copied = await window.api.copyCurrent();
  if (copied) {
    showToast('Copied: ' + copied, 'success');
  }
});

btnDashboard.addEventListener('click', async () => {
  await window.api.openDashboard();
});

btnClose.addEventListener('click', async () => {
  await window.api.closeOverlay();
});

// Listen to backend events
window.api.onStoreUpdated((updatedStore) => {
  updateUI(updatedStore);
});

window.api.onNotify(({ message, type }) => {
  showToast(message, type);
});

// Initial load
window.api.getStore().then((data) => {
  updateUI(data);
});
