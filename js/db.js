/**
 * js/db.js
 * Database abstraction layer using the Netlify API with a localStorage fallback.
 * localStorage fallback is used only when the network/API is unreachable.
 */

const DB = {
    useFallback: false,
    _cache: null,

    async init() {
        try {
            const res = await Promise.race([
                fetch('/api/count'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            if (!res.ok) throw new Error('API error: ' + res.status);
        } catch (error) {
            console.warn('API tidak tersedia. Menggunakan penyimpanan lokal.', error);
            this.useFallback = true;
            const banner = document.getElementById('fallback-warning');
            if (banner) banner.classList.remove('hidden');
        }
    },

    async set(key, value) {
        if (this.useFallback) {
            localStorage.setItem(key, JSON.stringify(value));
            return;
        }
        const res = await fetch('/api/signatures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, ...value })
        });
        if (!res.ok) throw new Error('Gagal menyimpan data ke server');
        // Invalidate cache so next list() re-fetches
        this._cache = null;
    },

    async get(key) {
        if (this.useFallback) {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : null;
        }
        // Use cache populated by the last list() call
        if (this._cache && key in this._cache) {
            return this._cache[key];
        }
        const res = await fetch('/api/signatures?key=' + encodeURIComponent(key));
        if (!res.ok) return null;
        const data = await res.json();
        return data;
    },

    async list(prefix = '') {
        if (this.useFallback) {
            return Object.keys(localStorage)
                .filter(k => k.startsWith(prefix))
                .map(k => ({ key: k }));
        }
        const res = await fetch('/api/signatures');
        if (!res.ok) return [];
        const signatures = await res.json();
        // Cache full data so subsequent get() calls avoid extra round-trips
        this._cache = {};
        signatures.forEach(s => { this._cache[s.key] = s; });
        return signatures.map(s => ({ key: s.key }));
    },

    async del(key) {
        if (this.useFallback) {
            localStorage.removeItem(key);
            return;
        }
        const res = await fetch('/api/signatures', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        if (!res.ok) throw new Error('Gagal menghapus data');
        if (this._cache) delete this._cache[key];
    },

    async incrementCount() {
        if (this.useFallback) {
            const current = parseInt(localStorage.getItem('meta_count') || '0', 10);
            const next = current + 1;
            localStorage.setItem('meta_count', next);
            return next;
        }
        // Server-side count is always derived from the DB; nothing to do here
        return 0;
    },

    async decrementCount() {
        if (this.useFallback) {
            const current = parseInt(localStorage.getItem('meta_count') || '0', 10);
            const next = Math.max(0, current - 1);
            localStorage.setItem('meta_count', next);
            return next;
        }
        return 0;
    },

    async getCount() {
        if (this.useFallback) {
            return parseInt(localStorage.getItem('meta_count') || '0', 10);
        }
        const res = await fetch('/api/count');
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count;
    }
};
