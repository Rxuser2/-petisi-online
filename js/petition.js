/**
 * js/petition.js
 * Logic for the public index.html page
 */

const TARGET = 500;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await DB.init();
        
        const isSigned = await checkAlreadySigned();
        if (isSigned) {
            showSuccessCard(localStorage.getItem('ssp_signed_name') || 'Sobat Lingkungan');
        } else {
            setupForm();
        }

        await loadProgress();
        await loadRecentSigners();

        // Auto refresh feed every 30s
        setInterval(loadRecentSigners, 30000);
    } catch (err) {
        showError('Terjadi kesalahan saat memuat aplikasi. Muat ulang halaman.');
    }
});

function setupForm() {
    const reasonInput = document.getElementById('reason');
    const charCount = document.getElementById('char-count');
    const form = document.getElementById('petition-form');

    reasonInput.addEventListener('input', () => {
        const len = reasonInput.value.length;
        charCount.textContent = `${len} / 200`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();
        
        const nameInput = document.getElementById('name');
        const roleInput = document.getElementById('role');
        
        const name = nameInput.value.trim();
        const role = roleInput.value;
        const reason = sanitizeHTML(reasonInput.value.trim());

        let valid = true;
        if (name.length < 3) {
            showInlineError('err-name', 'Nama minimal 3 karakter.');
            valid = false;
        } else {
            document.getElementById('err-name').classList.add('hidden');
        }

        if (!role) {
            showInlineError('err-role', 'Pilih kelas / jabatan Anda.');
            valid = false;
        } else {
            document.getElementById('err-role').classList.add('hidden');
        }

        if (!valid) return;

        const submitBtn = document.getElementById('submit-btn');
        const spinner = document.getElementById('spinner');
        
        try {
            submitBtn.disabled = true;
            spinner.classList.remove('hidden');
            submitBtn.classList.add('opacity-80', 'cursor-not-allowed');

            const timestamp = Date.now();
            const random4 = Math.floor(1000 + Math.random() * 9000);
            const key = `sig_${timestamp}_${random4}`;

            const data = {
                name,
                role,
                reason,
                timestamp
            };

            await DB.set(key, data);
            await DB.incrementCount();

            const hash = await hashString(name.toLowerCase());
            localStorage.setItem('ssp_signed', hash);
            localStorage.setItem('ssp_signed_name', name);

            document.getElementById('petition-card').classList.add('hidden');
            showSuccessCard(name);
            
            await loadProgress();
            await loadRecentSigners();
            
            document.getElementById('recent-section').scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            showError('Gagal menyimpan data. Coba lagi.');
        } finally {
            submitBtn.disabled = false;
            spinner.classList.add('hidden');
            submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
        }
    });
}

async function loadProgress() {
    try {
        const count = await DB.getCount();
        const percentRaw = (count / TARGET) * 100;
        const percent = Math.min(100, Math.round(percentRaw));
        
        document.getElementById('progress-text').textContent = `${count} dari ${TARGET} tanda tangan`;
        
        const bar = document.getElementById('progress-bar');
        const pctText = document.getElementById('progress-percent');
        
        bar.style.width = `${percent}%`;
        pctText.textContent = `${percent}%`;
        
        if (percent > 15) {
            pctText.classList.remove('hidden');
        } else {
            pctText.classList.add('hidden');
        }

        // Color shifts based on target thresholds
        bar.className = bar.className.replace(/bg-emerald-500|bg-yellow-400|bg-green-400/g, '');
        if (percent < 40) bar.classList.add('bg-emerald-500');
        else if (percent < 80) bar.classList.add('bg-yellow-400');
        else bar.classList.add('bg-green-400');
        
    } catch (err) {
        console.error('Progress load err:', err);
    }
}

async function loadRecentSigners() {
    try {
        const listDiv = document.getElementById('recent-list');
        const items = await DB.list('sig_');
        
        if (items.length === 0) {
            listDiv.innerHTML = `
                <div class="text-center py-8 bg-white/50 rounded-xl border border-dashed border-slate-300">
                    <p class="text-3xl mb-2">👋</p>
                    <p class="text-slate-500 font-medium">Jadilah yang pertama menandatangani!</p>
                </div>
            `;
            return;
        }

        items.sort((a, b) => b.key.localeCompare(a.key));
        const top5Keys = items.slice(0, 5).map(item => item.key);
        
        const top5Data = [];
        for (const k of top5Keys) {
            const data = await DB.get(k);
            if (data) top5Data.push(data);
        }

        listDiv.innerHTML = '';
        top5Data.forEach((sig, index) => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between stagger-item';
            div.style.animationDelay = `${index * 50}ms`;
            
            const initials = sig.name.substring(0,2).toUpperCase();
            
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center text-sm shrink-0">
                        ${initials}
                    </div>
                    <div>
                        <p class="font-bold text-slate-800">${sanitizeHTML(sig.name)}</p>
                        <p class="text-xs text-slate-500">${sanitizeHTML(sig.role)}</p>
                    </div>
                </div>
                <div class="text-emerald-500">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
            `;
            listDiv.appendChild(div);
        });
        
    } catch (err) {
        console.error('Recent list err:', err);
    }
}

async function checkAlreadySigned() {
    const hash = localStorage.getItem('ssp_signed');
    return !!hash;
}

function showSuccessCard(name) {
    const card = document.getElementById('success-card');
    card.classList.remove('hidden');
    card.classList.add('slide-in-toast');
    document.getElementById('success-msg').textContent = `Terima kasih, ${sanitizeHTML(name)}, atas dukungan Anda untuk lingkungan sekolah kita.`;
}

function showError(msg) {
    const errDiv = document.getElementById('form-error');
    errDiv.textContent = msg;
    errDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('form-error').classList.add('hidden');
}

function showInlineError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.classList.remove('hidden');
}

async function hashString(str) {
    const msgUint8 = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
