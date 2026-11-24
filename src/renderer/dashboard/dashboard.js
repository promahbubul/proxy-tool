let currentStore = null;
let toastTimeout = null;
const selectedProxyIds = new Set();

// Pagination State
let currentPage = 1;
let pageSize = 10;

// DOM Elements
const statTotal = document.getElementById('statTotal');
const statReady = document.getElementById('statReady');
const statUsed = document.getElementById('statUsed');
const statActive = document.getElementById('statActive');
const lblGlobalHotkey = document.getElementById('lblGlobalHotkey');

const proxyTableBody = document.getElementById('proxyTableBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const statusFilter = document.getElementById('statusFilter');

const btnOpenOverlay = document.getElementById('btnOpenOverlay');
const btnOpenImport = document.getElementById('btnOpenImport');
const btnExportCSV = document.getElementById('btnExportCSV');
const btnOpenAdd = document.getElementById('btnOpenAdd');
const btnClearAll = document.getElementById('btnClearAll');
const btnDeleteSelected = document.getElementById('btnDeleteSelected');
const btnMarkDoneSelected = document.getElementById('btnMarkDoneSelected');
const btnMarkActiveSelected = document.getElementById('btnMarkActiveSelected');
const selectedCount = document.getElementById('selectedCount');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');

// Pagination Elements
const paginationBar = document.getElementById('paginationBar');
const paginationInfo = document.getElementById('paginationInfo');
const pageStart = document.getElementById('pageStart');
const pageEnd = document.getElementById('pageEnd');
const pageTotal = document.getElementById('pageTotal');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const pageNumbers = document.getElementById('pageNumbers');
const btnFirstPage = document.getElementById('btnFirstPage');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const btnLastPage = document.getElementById('btnLastPage');

// Modals
const modalImport = document.getElementById('modalImport');
const btnCloseImportModal = document.getElementById('btnCloseImportModal');
const btnCancelImport = document.getElementById('btnCancelImport');
const btnSubmitImport = document.getElementById('btnSubmitImport');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const txtImport = document.getElementById('txtImport');
const importDefaultType = document.getElementById('importDefaultType');

const modalAdd = document.getElementById('modalAdd');
const btnCloseAddModal = document.getElementById('btnCloseAddModal');
const btnCancelAdd = document.getElementById('btnCancelAdd');
const btnSubmitAdd = document.getElementById('btnSubmitAdd');

// Settings Form
const cfgTargetBrowser = document.getElementById('cfgTargetBrowser');
const cfgGlobalHotkey = document.getElementById('cfgGlobalHotkey');
const cfgFillMode = document.getElementById('cfgFillMode');
const cfgDelayMs = document.getElementById('cfgDelayMs');
const cfgStartField = document.getElementById('cfgStartField');
const cfgAutoAdvance = document.getElementById('cfgAutoAdvance');
const btnSaveSettings = document.getElementById('btnSaveSettings');

const dashToast = document.getElementById('dashToast');

// Navigation Tabs
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

    btn.classList.add('active');
    const tabName = btn.dataset.tab;
    const view = document.getElementById(`view-${tabName}`);
    if (view) view.classList.add('active');
  });
});

function showToast(message, type = 'info') {
  if (toastTimeout) clearTimeout(toastTimeout);
  dashToast.textContent = message;
  dashToast.className = `dashboard-toast show ${type}`;
  toastTimeout = setTimeout(() => {
    dashToast.className = 'dashboard-toast';
  }, 2500);
}

function updateBulkDeleteUI() {
  const count = selectedProxyIds.size;
  selectedCount.textContent = count;
  if (count > 0) {
    btnDeleteSelected.style.display = 'inline-flex';
    if (btnMarkDoneSelected) btnMarkDoneSelected.style.display = 'inline-flex';
    if (btnMarkActiveSelected) btnMarkActiveSelected.style.display = 'inline-flex';
  } else {
    btnDeleteSelected.style.display = 'none';
    if (btnMarkDoneSelected) btnMarkDoneSelected.style.display = 'none';
    if (btnMarkActiveSelected) btnMarkActiveSelected.style.display = 'none';
  }
}

function render(data) {
  try {
    currentStore = data;
    const proxies = currentStore ? (currentStore.proxies || []) : [];
    const settings = currentStore ? (currentStore.settings || {}) : {};

    // Clean up selected IDs that no longer exist
    const existingIds = new Set(proxies.map(p => p.id));
    for (let id of Array.from(selectedProxyIds)) {
      if (!existingIds.has(id)) {
        selectedProxyIds.delete(id);
      }
    }
    updateBulkDeleteUI();

    const checkIsDone = (p) => p.status === 'done' || p.status === 'used' || p.status === 'inactive';
    const activeProxies = proxies.filter(p => !checkIsDone(p));

    // Determine which active proxy is current for the toolbar
    let currentActiveProxy = null;
    if (activeProxies.length > 0) {
      if (settings.activeProxyId) {
        currentActiveProxy = activeProxies.find(p => p.id === settings.activeProxyId) || activeProxies[0];
      } else {
        const idx = (typeof settings.activeProxyIndex === 'number' && settings.activeProxyIndex >= 0 && settings.activeProxyIndex < activeProxies.length) ? settings.activeProxyIndex : 0;
        currentActiveProxy = activeProxies[idx] || activeProxies[0];
      }
    }

    // Stats
    statTotal.textContent = proxies.length;
    statReady.textContent = activeProxies.length;
    statUsed.textContent = proxies.length - activeProxies.length;
    statActive.textContent = currentActiveProxy ? `${currentActiveProxy.host}:${currentActiveProxy.port}` : 'None';
    lblGlobalHotkey.textContent = settings.globalHotkey || 'Alt + F';

    // Settings tab values
    if (cfgTargetBrowser) {
      cfgTargetBrowser.value = settings.targetBrowser || 'geelark';
    }
    if (cfgGlobalHotkey) cfgGlobalHotkey.value = settings.globalHotkey || 'Alt+F';
    if (cfgFillMode) cfgFillMode.value = settings.fillMode || 'tab-sequence';
    if (cfgDelayMs) cfgDelayMs.value = settings.fillDelayMs || 45;
    if (cfgStartField) {
      cfgStartField.value = settings.startField || 'host-only';
    }
    if (cfgAutoAdvance) cfgAutoAdvance.checked = settings.autoAdvanceOnFill !== false;

    // Filter and search
    const query = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
    const selectedType = typeFilter ? (typeFilter.value || 'ALL') : 'ALL';
    const selectedStatus = statusFilter ? (statusFilter.value || 'ALL') : 'ALL';

    const filtered = proxies.filter((p) => {
      if (selectedType && selectedType.toUpperCase() !== 'ALL') {
        const pType = (p.type || 'HTTP').toUpperCase();
        if (selectedType.toUpperCase() === 'HTTP') {
          if (pType !== 'HTTP' && pType !== 'HTTPS') return false;
        } else if (pType !== selectedType.toUpperCase()) {
          return false;
        }
      }
      const isDone = checkIsDone(p);
      if (selectedStatus === 'active' && isDone) return false;
      if (selectedStatus === 'done' && !isDone) return false;

      if (query) {
        const tags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? [p.tags] : []);
        const match = (
          (p.name || '').toLowerCase().includes(query) ||
          (p.host || '').toLowerCase().includes(query) ||
          (p.port || '').toString().includes(query) ||
          (p.username || '').toLowerCase().includes(query) ||
          tags.some(t => String(t).toLowerCase().includes(query))
        );
        if (!match) return false;
      }

      return true;
    });

    // Sort: Active/Unused proxies at TOP, Inactive/Done proxies at the BOTTOM
    filtered.sort((a, b) => {
      const aDone = checkIsDone(a) ? 1 : 0;
      const bDone = checkIsDone(b) ? 1 : 0;
      if (aDone !== bDone) {
        return aDone - bDone; // 0 (Active) first, 1 (Inactive) last
      }
      const aOrig = proxies.findIndex(item => item.id === a.id);
      const bOrig = proxies.findIndex(item => item.id === b.id);
      return aOrig - bOrig;
    });

    // Pagination calculation
    const totalCount = filtered.length;
    const actualPageSize = pageSize === 'all' ? (totalCount || 1) : parseInt(pageSize, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / actualPageSize));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * actualPageSize;
    const endIndex = Math.min(startIndex + actualPageSize, totalCount);
    const pageItems = filtered.slice(startIndex, endIndex);

    // Update pagination indicators
    if (pageStart) pageStart.textContent = totalCount === 0 ? 0 : startIndex + 1;
    if (pageEnd) pageEnd.textContent = endIndex;
    if (pageTotal) pageTotal.textContent = totalCount;

    renderPaginationControls(totalPages);

    proxyTableBody.innerHTML = '';

    if (pageItems.length === 0) {
      emptyState.style.display = 'block';
      selectAllCheckbox.checked = false;
    } else {
      emptyState.style.display = 'none';

      // Check if all filtered on current page are selected
      const allPageSelected = pageItems.every(p => selectedProxyIds.has(p.id));
      selectAllCheckbox.checked = allPageSelected && pageItems.length > 0;

      pageItems.forEach((p, idx) => {
        const displayIndex = startIndex + idx;
        const isDone = checkIsDone(p);
        const isCurrent = currentActiveProxy && currentActiveProxy.id === p.id;
        const isChecked = selectedProxyIds.has(p.id);

        const tr = document.createElement('tr');
        if (isCurrent) tr.classList.add('active-row');
        if (isDone) tr.classList.add('inactive-row');

        const statusBadge = `
        <span class="status-badge ${isDone ? 'inactive' : 'active'}">
          <span class="status-dot ${isDone ? 'used' : 'ready'}"></span>
          ${isDone ? 'Inactive' : 'Active'}
        </span>
      `;
        const typeBadge = `<button class="table-badge ${(p.type || 'SOCKS5').toLowerCase()}" data-action="toggle-type" data-id="${p.id}" title="Click to toggle SOCKS5 / HTTP">${p.type || 'SOCKS5'}</button>`;
        const tagsHtml = (p.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('');

        tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="row-checkbox" data-id="${p.id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td>
          <button class="active-badge-btn ${isCurrent ? 'active' : ''}" data-action="set-active" data-id="${p.id}" title="${isCurrent ? 'Current proxy in floating toolbar' : 'Select for Auto-Fill in floating toolbar'}">
            ${isCurrent ? '★ Current' : (isDone ? 'Reactivate' : 'Select')}
          </button>
        </td>
        <td style="color: #64748b; font-weight: 600;">#${displayIndex + 1}</td>
        <td>${typeBadge}</td>
        <td style="${isDone ? 'text-decoration: line-through; color: #94a3b8;' : ''}"><b>${p.host}</b> : ${p.port}</td>
        <td>${p.username ? `<span title="${p.username}">${p.username}</span>` : '<span style="color:#64748b">—</span>'}</td>
        <td>${p.password ? `<span style="font-family:monospace">••••••</span>` : '<span style="color:#64748b">—</span>'}</td>
        <td>${tagsHtml || '<span style="color:#64748b">—</span>'}</td>
        <td>${statusBadge}</td>
        <td style="font-weight: 600; color: #94a3b8;">${p.usedCount || 0}</td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn btn-icon ${isDone ? 'cross-action' : 'check-action'}" 
                    title="${isDone ? 'Click to Re-activate (Make Active & move to top)' : 'Mark as Done / Inactive (Move to bottom & remove from toolbar)'}" 
                    data-action="toggle-status" 
                    data-id="${p.id}">
              ${isDone ?
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' :
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
          }
            </button>
            <button class="btn btn-icon" title="Copy (host:port:user:pass)" data-action="copy" data-id="${p.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="btn btn-icon" title="Fill into Active Field" data-action="fill" data-id="${p.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </button>
            <button class="btn btn-icon danger" title="Delete Proxy" data-action="delete" data-id="${p.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </td>
      `;

        // Row Checkbox change
        const chk = tr.querySelector('.row-checkbox');
        chk.addEventListener('change', (e) => {
          if (e.target.checked) {
            selectedProxyIds.add(p.id);
          } else {
            selectedProxyIds.delete(p.id);
          }
          updateBulkDeleteUI();
          selectAllCheckbox.checked = pageItems.every(item => selectedProxyIds.has(item.id));
        });

        proxyTableBody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error in render():', err);
  }
}

function renderPaginationControls(totalPages) {
  if (!pageNumbers) return;
  pageNumbers.innerHTML = '';

  if (btnFirstPage) btnFirstPage.disabled = currentPage <= 1;
  if (btnPrevPage) btnPrevPage.disabled = currentPage <= 1;
  if (btnNextPage) btnNextPage.disabled = currentPage >= totalPages;
  if (btnLastPage) btnLastPage.disabled = currentPage >= totalPages;

  if (totalPages <= 1) return;

  let startP = Math.max(1, currentPage - 2);
  let endP = Math.min(totalPages, startP + 4);
  if (endP - startP < 4) {
    startP = Math.max(1, endP - 4);
  }

  for (let p = startP; p <= endP; p++) {
    const btn = document.createElement('button');
    btn.className = `page-num ${p === currentPage ? 'active' : ''}`;
    btn.textContent = p;
    btn.dataset.page = p;
    btn.addEventListener('click', () => {
      currentPage = p;
      render(currentStore);
    });
    pageNumbers.appendChild(btn);
  }
}

// Pagination Controls Handlers
if (pageSizeSelect) {
  pageSizeSelect.addEventListener('change', (e) => {
    pageSize = e.target.value;
    currentPage = 1;
    if (currentStore) render(currentStore);
  });
}

if (btnFirstPage) {
  btnFirstPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage = 1;
      if (currentStore) render(currentStore);
    }
  });
}

if (btnPrevPage) {
  btnPrevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      if (currentStore) render(currentStore);
    }
  });
}

if (btnNextPage) {
  btnNextPage.addEventListener('click', () => {
    currentPage++;
    if (currentStore) render(currentStore);
  });
}

if (btnLastPage) {
  btnLastPage.addEventListener('click', () => {
    const proxies = currentStore ? currentStore.proxies || [] : [];
    const actualPageSize = pageSize === 'all' ? (proxies.length || 1) : parseInt(pageSize, 10);
    currentPage = Math.max(1, Math.ceil(proxies.length / actualPageSize));
    if (currentStore) render(currentStore);
  });
}

// Select All Checkbox Handler
selectAllCheckbox.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  const proxies = currentStore ? currentStore.proxies || [] : [];

  // Filter currently visible
  const query = (searchInput && searchInput.value ? searchInput.value : '').toLowerCase().trim();
  const selectedType = typeFilter ? (typeFilter.value || 'ALL') : 'ALL';
  const selectedStatus = statusFilter ? (statusFilter.value || 'ALL') : 'ALL';

  const filtered = proxies.filter((p) => {
    if (selectedType && selectedType.toUpperCase() !== 'ALL') {
      const pType = (p.type || 'HTTP').toUpperCase();
      if (selectedType.toUpperCase() === 'HTTP') {
        if (pType !== 'HTTP' && pType !== 'HTTPS') return false;
      } else if (pType !== selectedType.toUpperCase()) {
        return false;
      }
    }
    const isDone = (p.status === 'done' || p.status === 'used' || p.status === 'inactive');
    if (selectedStatus === 'active' && isDone) return false;
    if (selectedStatus === 'done' && !isDone) return false;
    if (query) {
      const tags = Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? [p.tags] : []);
      const match = (
        (p.name || '').toLowerCase().includes(query) ||
        (p.host || '').toLowerCase().includes(query) ||
        (p.port || '').toString().includes(query) ||
        (p.username || '').toLowerCase().includes(query) ||
        tags.some(t => String(t).toLowerCase().includes(query))
      );
      if (!match) return false;
    }
    return true;
  });

  filtered.forEach(p => {
    if (isChecked) {
      selectedProxyIds.add(p.id);
    } else {
      selectedProxyIds.delete(p.id);
    }
  });

  // Re-render check state
  document.querySelectorAll('.row-checkbox').forEach(chk => {
    const id = chk.dataset.id;
    chk.checked = selectedProxyIds.has(id);
  });

  updateBulkDeleteUI();
});

// Bulk Mark Done / Active Selected
if (btnMarkDoneSelected) {
  btnMarkDoneSelected.addEventListener('click', async () => {
    if (selectedProxyIds.size === 0) return;
    const ids = Array.from(selectedProxyIds);
    await window.api.setProxiesStatusBulk(ids, 'done');
    showToast(`Marked ${ids.length} proxies as Done / Inactive`, 'info');
  });
}

if (btnMarkActiveSelected) {
  btnMarkActiveSelected.addEventListener('click', async () => {
    if (selectedProxyIds.size === 0) return;
    const ids = Array.from(selectedProxyIds);
    await window.api.setProxiesStatusBulk(ids, 'active');
    showToast(`Marked ${ids.length} proxies as Active`, 'success');
  });
}

// Bulk Delete Selected
btnDeleteSelected.addEventListener('click', async () => {
  const count = selectedProxyIds.size;
  if (count === 0) return;

  if (confirm(`Are you sure you want to delete ${count} selected proxies?`)) {
    const ids = Array.from(selectedProxyIds);
    await window.api.deleteProxiesBulk(ids);
    selectedProxyIds.clear();
    updateBulkDeleteUI();
    showToast(`Successfully deleted ${count} proxies`, 'info');
  }
});

// Table action buttons delegation
proxyTableBody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'set-active') {
    await window.api.setActiveProxy(id);
    const proxy = (currentStore.proxies || []).find(p => p.id === id);
    showToast(`Selected ${proxy ? proxy.host + ':' + proxy.port : 'proxy'} for auto-fill!`, 'info');
  } else if (action === 'copy') {
    const proxy = (currentStore.proxies || []).find(p => p.id === id);
    if (proxy) {
      const text = `${proxy.host}:${proxy.port}${proxy.username ? `:${proxy.username}:${proxy.password}` : ''}`;
      navigator.clipboard.writeText(text);
      showToast(`Copied: ${text}`, 'success');
    }
  } else if (action === 'fill') {
    await window.api.setActiveProxy(id);
    await window.api.triggerFill(true);
  } else if (action === 'delete') {
    await window.api.deleteProxy(id);
    selectedProxyIds.delete(id);
    updateBulkDeleteUI();
    showToast('Proxy removed', 'info');
  } else if (action === 'toggle-status') {
    const res = await window.api.toggleProxyStatus(id);
    const isNowDone = res && (res.status === 'done' || res.status === 'used' || res.status === 'inactive');
    showToast(isNowDone ? 'Marked as Inactive (Moved to bottom & removed from toolbar)' : 'Re-activated as Active (Moved to top & added to toolbar)', isNowDone ? 'info' : 'success');
  } else if (action === 'toggle-type') {
    const res = await window.api.toggleProxyType(id);
    showToast(`Protocol changed to ${res ? res.type : 'updated'}`, 'info');
  }
});

// Export CSV Feature
btnExportCSV.addEventListener('click', async () => {
  const proxies = currentStore ? currentStore.proxies || [] : [];
  if (proxies.length === 0) {
    showToast('No proxies to export!', 'error');
    return;
  }

  // Generate standard CSV with clear headers
  const headers = ['host', 'port', 'username', 'password', 'type', 'tags', 'status', 'usedCount'];
  const rows = proxies.map(p => {
    const host = `"${(p.host || '').replace(/"/g, '""')}"`;
    const port = `"${(p.port || '').replace(/"/g, '""')}"`;
    const user = `"${(p.username || '').replace(/"/g, '""')}"`;
    const pass = `"${(p.password || '').replace(/"/g, '""')}"`;
    const type = `"${(p.type || 'HTTP').replace(/"/g, '""')}"`;
    const tags = `"${(p.tags || []).join(';').replace(/"/g, '""')}"`;
    const status = `"${(p.usedCount > 0 ? 'used' : 'ready')}"`;
    const usedCount = p.usedCount || 0;
    return [host, port, user, pass, type, tags, status, usedCount].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');

  try {
    const res = await window.api.saveCSVFile(csvContent);
    if (res && res.success) {
      showToast(`Exported ${proxies.length} proxies to CSV!`, 'success');
    } else if (res && res.canceled) {
      // User canceled save dialog
    } else {
      // Fallback web download
      downloadCSVFallback(csvContent, 'smartfill_proxies.csv');
    }
  } catch (err) {
    downloadCSVFallback(csvContent, 'smartfill_proxies.csv');
  }
});

function downloadCSVFallback(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`CSV downloaded: ${filename}`, 'success');
}

// Search & Filter listeners
searchInput.addEventListener('input', () => {
  currentPage = 1;
  render(currentStore);
});
typeFilter.addEventListener('change', () => {
  currentPage = 1;
  render(currentStore);
});
statusFilter.addEventListener('change', () => {
  currentPage = 1;
  render(currentStore);
});

// Modals open/close
btnOpenImport.addEventListener('click', () => {
  modalImport.classList.add('show');
  txtImport.focus();
});

btnCloseImportModal.addEventListener('click', () => modalImport.classList.remove('show'));
btnCancelImport.addEventListener('click', () => modalImport.classList.remove('show'));

btnOpenAdd.addEventListener('click', () => {
  modalAdd.classList.add('show');
  document.getElementById('addHost').focus();
});

btnCloseAddModal.addEventListener('click', () => modalAdd.classList.remove('show'));
btnCancelAdd.addEventListener('click', () => modalAdd.classList.remove('show'));

btnOpenOverlay.addEventListener('click', () => {
  showToast('Floating overlay is on your screen!', 'info');
});

// Clear all proxies
btnClearAll.addEventListener('click', async () => {
  if (confirm('Are you sure you want to remove all proxies?')) {
    await window.api.clearProxies();
    selectedProxyIds.clear();
    updateBulkDeleteUI();
    showToast('All proxies cleared', 'info');
  }
});

// Import Proxies logic
btnSubmitImport.addEventListener('click', async () => {
  const text = txtImport.value.trim();
  if (!text) {
    showToast('Please paste proxy lines or drop a CSV file', 'error');
    return;
  }

  const defaultProto = importDefaultType ? importDefaultType.value : 'SOCKS5';
  const added = await window.api.importProxies(text, defaultProto);
  modalImport.classList.remove('show');
  txtImport.value = '';
  showToast(`Successfully imported ${added.length} proxies (${defaultProto})!`, 'success');
});

// Dropzone file handling
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      txtImport.value = evt.target.result;
      showToast(`Loaded ${file.name}`, 'info');
    };
    reader.readAsText(file);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (evt) => {
      txtImport.value = evt.target.result;
      showToast(`Loaded ${file.name}`, 'info');
    };
    reader.readAsText(file);
  }
});

// Add Single Proxy logic
btnSubmitAdd.addEventListener('click', async () => {
  const host = document.getElementById('addHost').value.trim();
  const port = document.getElementById('addPort').value.trim();

  if (!host || !port) {
    showToast('Host and Port are required!', 'error');
    return;
  }

  const newProxy = {
    name: document.getElementById('addName').value.trim(),
    type: document.getElementById('addType').value,
    host,
    port,
    username: document.getElementById('addUser').value.trim(),
    password: document.getElementById('addPass').value.trim(),
    tags: document.getElementById('addTags').value.trim()
  };

  await window.api.addProxy(newProxy);
  modalAdd.classList.remove('show');

  // Reset form
  document.getElementById('addName').value = '';
  document.getElementById('addHost').value = '';
  document.getElementById('addPort').value = '';
  document.getElementById('addUser').value = '';
  document.getElementById('addPass').value = '';
  document.getElementById('addTags').value = '';

  showToast('Proxy added successfully!', 'success');
});

// Save Settings
btnSaveSettings.addEventListener('click', async () => {
  const targetBrowser = cfgTargetBrowser ? cfgTargetBrowser.value : 'geelark';
  const hotkey = cfgGlobalHotkey.value.trim() || 'Alt+F';
  const fillMode = cfgFillMode ? cfgFillMode.value : 'tab-sequence';
  const delay = parseInt(cfgDelayMs.value, 10) || 45;
  const startField = cfgStartField ? cfgStartField.value : 'host-with-protocol';
  const autoAdvance = cfgAutoAdvance.checked;

  await window.api.updateSettings({
    targetBrowser,
    globalHotkey: hotkey,
    fillMode,
    fillDelayMs: delay,
    startField,
    autoAdvanceOnFill: autoAdvance
  });

  showToast('Settings saved & hotkey updated!', 'success');
});

// Realtime listeners
window.api.onStoreUpdated((updated) => {
  render(updated);
});

window.api.onNotify(({ message, type }) => {
  showToast(message, type);
});

// Initial load
window.api.getStore().then(render);
