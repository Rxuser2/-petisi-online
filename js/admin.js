/**
 * js/admin.js
 * Logic for the admin dashboard
 */

const PIN = "SMP2025";
let allSignatures = [];
let filteredSignatures = [];
let currentPage = 1;
const rowsPerPage = 20;
let currentSort = { col: 'timestamp', asc: false };
let keyToDelete = null;

document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
    
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('search-input').addEventListener('input', handleSearch);
    document.getElementById('export-btn').addEventListener('click', exportCSV);
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.sort));
    });

    document.getElementById('prev-btn').addEventListener('click', () => changePage(-1));
    document.getElementById('next-btn').addEventListener('click', () => changePage(1));

    document.getElementById('cancel-delete-btn').addEventListener('click', closeModal);
    document.getElementById('confirm-delete-btn').addEventListener('click', executeDelete);
});

function checkSession() {
    if (sessionStorage.getItem('admin_session') === 'true') {
        showDashboard();
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const lockUntil = localStorage.getItem('admin_lock');
    if (lockUntil && Date.now() < parseInt(lockUntil)) {
        const remaining = Math.ceil((parseInt(lockUntil) - Date.now()) / 1000);
        showLoginError(`Terkunci. Coba lagi dalam ${remaining} detik.`);
        return;
    }

    const input = document.getElementById('pin-input').value;
    if (input === PIN) {
        sessionStorage.setItem('admin_session', 'true');
        localStorage.removeItem('admin_attempts');
        showDashboard();
    } else {
        let attempts = parseInt(localStorage.getItem('admin_attempts') || '0') + 1;
        if (attempts >= 3) {
            localStorage.setItem('admin_lock', Date.now() + 30000);
            localStorage.setItem('admin_attempts', '0');
            showLoginError('Terlalu banyak percobaan. Terkunci 30 detik.');
        } else {
            localStorage.setItem('admin_attempts', attempts);
            showLoginError(`PIN salah. Percobaan ${attempts}/3`);
        }
    }
}

function showLoginError(msg) {
    const err = document.getElementById('login-err');
    err.textContent = msg;
    err.classList.remove('hidden');
}

async function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    try {
        await DB.init();
        await loadData();
    } catch (err) {
        showAdminError('Gagal memuat database.');
    }
}

function handleLogout() {
    sessionStorage.removeItem('admin_session');
    location.reload();
}

async function loadData() {
    try {
        showTableLoading();
        const items = await DB.list('sig_');
        
        allSignatures = [];
        const chunkSize = 50;
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            const promises = chunk.map(async (item) => {
                const data = await DB.get(item.key);
                if (data) {
                    data._key = item.key;
                    return data;
                }
                return null;
            });
            const results = await Promise.all(promises);
            allSignatures.push(...results.filter(r => r !== null));
        }

        applySort(); 
        updateKPIs();
        renderTable();
    } catch (err) {
        showAdminError('Gagal mengambil data dari server.');
    }
}

function updateKPIs() {
    const total = allSignatures.length;
    document.getElementById('kpi-total').textContent = total;
    
    const percent = Math.min(100, Math.round((total / 500) * 100));
    document.getElementById('kpi-percent').textContent = `${percent}%`;
    
    const classCount = {};
    let todayCount = 0;
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);

    allSignatures.forEach(sig => {
        classCount[sig.role] = (classCount[sig.role] || 0) + 1;
        if (sig.timestamp >= startOfToday.getTime()) {
            todayCount++;
        }
    });

    let topClass = '-';
    let max = 0;
    for (const [cls, count] of Object.entries(classCount)) {
        if (count > max) { max = count; topClass = cls; }
    }
    
    document.getElementById('kpi-top-class').textContent = max > 0 ? `${topClass} (${max})` : '-';
    document.getElementById('kpi-today').textContent = todayCount;
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    filteredSignatures = allSignatures.filter(sig => 
        sig.name.toLowerCase().includes(query) || 
        sig.role.toLowerCase().includes(query)
    );
    currentPage = 1;
    applySortOnly();
    renderTable();
}

function handleSort(col) {
    if (currentSort.col === col) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.col = col;
        currentSort.asc = true;
    }
    
    document.querySelectorAll('th data-sort').forEach(th => {
        th.querySelector('.sort-icon').textContent = '';
    });
    const activeTh = document.querySelector(`th[data-sort="${col}"]`);
    if(activeTh) {
        activeTh.querySelector('.sort-icon').textContent = currentSort.asc ? '▲' : '▼';
    }

    applySortOnly();
    renderTable();
}

function applySort() {
    filteredSignatures = [...allSignatures];
    applySortOnly();
}

function applySortOnly() {
    filteredSignatures.sort((a, b) => {
        let valA = a[currentSort.col];
        let valB = b[currentSort.col];
        
        if (currentSort.col === 'index') {
            valA = a.timestamp; 
            valB = b.timestamp;
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginated = filteredSignatures.slice(start, end);

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">Tidak ada data ditemukan.</td></tr>`;
    }

    paginated.forEach((sig, index) => {
        const globalIndex = currentSort.asc ? start + index + 1 : filteredSignatures.length - (start + index);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors';
        
        const d = new Date(sig.timestamp);
        const timeStr = `${d.getDate()} ${d.toLocaleString('id-ID', {month:'short'})} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} WIB`;

        tr.innerHTML = `
            <td class="p-4 text-slate-500">${globalIndex}</td>
            <td class="p-4 font-medium text-slate-900">${sanitizeHTML(sig.name)}</td>
            <td class="p-4 text-slate-600"><span class="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-xs font-medium">${sanitizeHTML(sig.role)}</span></td>
            <td class="p-4 text-slate-600 max-w-xs truncate" title="${sanitizeHTML(sig.reason)}">${sanitizeHTML(sig.reason) || '<span class="text-slate-300 italic">Tidak ada</span>'}</td>
            <td class="p-4 text-slate-500 text-sm whitespace-nowrap">${timeStr}</td>
            <td class="p-4 text-right">
                <button onclick="requestDelete('${sig._key}')" class="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors" title="Hapus">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const totalPages = Math.ceil(filteredSignatures.length / rowsPerPage);
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage === totalPages || totalPages === 0;
    
    const displayEnd = Math.min(end, filteredSignatures.length);
    document.getElementById('page-info').textContent = `Menampilkan ${filteredSignatures.length === 0 ? 0 : start + 1}-${displayEnd} dari ${filteredSignatures.length}`;
}

function changePage(delta) {
    currentPage += delta;
    renderTable();
}

function requestDelete(key) {
    keyToDelete = key;
    const modal = document.getElementById('confirm-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        document.getElementById('confirm-modal-content').classList.remove('scale-95');
        document.getElementById('confirm-modal-content').classList.add('scale-100');
    }, 10);
}

function closeModal() {
    document.getElementById('confirm-modal-content').classList.remove('scale-100');
    document.getElementById('confirm-modal-content').classList.add('scale-95');
    setTimeout(() => {
        document.getElementById('confirm-modal').classList.add('hidden');
        keyToDelete = null;
    }, 200);
}

async function executeDelete() {
    if (!keyToDelete) return;
    const btn = document.getElementById('confirm-delete-btn');
    const ogText = document.getElementById('del-btn-text').textContent;
    
    try {
        btn.disabled = true;
        document.getElementById('del-btn-text').textContent = 'Menghapus...';
        
        await DB.del(keyToDelete);
        await DB.decrementCount();
        
        allSignatures = allSignatures.filter(s => s._key !== keyToDelete);
        
        const query = document.getElementById('search-input').value.toLowerCase();
        filteredSignatures = allSignatures.filter(sig => 
            sig.name.toLowerCase().includes(query) || 
            sig.role.toLowerCase().includes(query)
        );
        applySortOnly();
        
        const totalPages = Math.ceil(filteredSignatures.length / rowsPerPage);
        if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
        
        updateKPIs();
        renderTable();
        closeModal();
    } catch (err) {
        showAdminError('Gagal menghapus data.');
        closeModal();
    } finally {
        btn.disabled = false;
        document.getElementById('del-btn-text').textContent = ogText;
    }
}

function exportCSV() {
    if (allSignatures.length === 0) return;
    
    const headers = ['No', 'Nama', 'Kelas', 'Alasan', 'Waktu'];
    const toExport = [...allSignatures].sort((a, b) => a.timestamp - b.timestamp);
    
    const rows = toExport.map((sig, i) => {
        const d = new Date(sig.timestamp);
        const timeStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        
        const escName = `"${sig.name.replace(/"/g, '""')}"`;
        const escRole = `"${sig.role.replace(/"/g, '""')}"`;
        const escReason = `"${(sig.reason || '').replace(/"/g, '""')}"`;
        
        return [i+1, escName, escRole, escReason, timeStr].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    link.setAttribute('href', url);
    link.setAttribute('download', `petisi_ssp_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showAdminError(msg) {
    const err = document.getElementById('admin-error');
    err.textContent = msg;
    err.classList.remove('hidden');
    setTimeout(() => err.classList.add('hidden'), 5000);
}

function showTableLoading() {
    document.getElementById('table-body').innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 flex justify-center items-center gap-2"><svg class="animate-spin h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Memuat data...</td></tr>`;
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
