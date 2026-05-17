# Petisi Online - SMP Santo Yusup

Aplikasi web petisi tanpa server untuk proyek sekolah, menggunakan HTML, Tailwind CSS (via CDN), dan Puter.js untuk database cloud gratis.

## Cara Penggunaan

1. **Memulai:** Cukup klik dua kali file `index.html` pada perangkat Anda untuk membuka halaman publik petisi di browser. Tidak diperlukan instalasi `node_modules` atau server lokal.
2. **Database:** Aplikasi otomatis terhubung dengan `puter.kv` untuk menyimpan data secara online (anonim). Jika offline/gagal, aplikasi akan fallback menggunakan `localStorage` dengan peringatan banner kuning.
3. **Halaman Admin:** Buka `admin.html` di browser Anda.
   - **PIN Default:** `SMP2025`
   - Melalui dashboard, Anda bisa melihat, mencari, menghapus data petisi, serta mengekspor seluruh daftar ke CSV (kompatibel penuh dengan MS Excel).
4. **Deploy:** Anda bisa meng-hosting file HTML/JS ini secara statis menggunakan GitHub Pages, Vercel, Netlify Drop, atau penyedia hosting gratis lainnya.
