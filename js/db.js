/**
 * js/db.js
 * Database abstraction layer using Puter.js (puter.kv) with a localStorage fallback.
 */

const DB = {
    useFallback: false,

    async init() {
        try {
            // Attempt to check Puter.js initialization within 3 seconds
            await Promise.race([
                (async () => {
                    if (typeof puter === 'undefined') throw new Error('Puter SDK not found');
                    // Simple ping to ensure kv is responsive
                    await puter.kv.get('__ping');
                })(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Puter SDK Timeout')), 3000))
            ]);
        } catch (error) {
            console.warn('Puter.js failed to init within 3s. Menggunakan localStorage.', error);
            this.useFallback = true;
            const banner = document.getElementById('fallback-warning');
            if (banner) banner.classList.remove('hidden');
        }
    },

    async set(key, value) {
        if (this.useFallback) {
            localStorage.setItem(key, JSON.stringify(value));
        } else {
            await puter.kv.set(key, JSON.stringify(value));
        }
    },

    async get(key) {
        if (this.useFallback) {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : null;
        } else {
            const val = await puter.kv.get(key);
            return val ? JSON.parse(val) : null;
        }
    },

    async list(prefix = '') {
        if (this.useFallback) {
            return Object.keys(localStorage)
                .filter(k => k.startsWith(prefix))
                .map(k => ({ key: k }));
        } else {
            // Puter.js v2 kv.list signature
            return await puter.kv.list(undefined, { prefix });
        }
    },

    async del(key) {
        if (this.useFallback) {
            localStorage.removeItem(key);
        } else {
            await puter.kv.del(key);
        }
    },

    async incrementCount() {
        const current = (await this.get('meta_count')) || 0;
        const next = current + 1;
        await this.set('meta_count', next);
        return next;
    },

    async decrementCount() {
        const current = (await this.get('meta_count')) || 0;
        const next = Math.max(0, current - 1);
        await this.set('meta_count', next);
        return next;
    },

    async getCount() {
        return (await this.get('meta_count')) || 0;
    }
};
