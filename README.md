<div align="center">
  <img src="public/Logo.svg" alt="Arsy Jaya Logo" width="120" />
  
  # ARSY JAYA - Stock & Tracking Sistem
  
  **Sistem Manajemen Inventaris & Pelacakan Produksi Percetakan Terintegrasi**
  <br />
  <br />

  [![React](https://img.shields.io/badge/React-18.x-blue?style=flat-square&logo=react)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database_&_Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
  [![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styling-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
</div>

<br />

Selamat datang di repositori **Arsy Jaya Stock & Tracking Sistem**! Aplikasi ini dirancang secara khusus untuk mempermudah digitalisasi alur kerja pabrik / percetakan, mulai dari manajemen stok gudang (inventory), pelacakan kendala (defect) produksi mesin, pemakaian bahan potong (cutting), hingga integrasi notifikasi pesan otomatis (Bot WhatsApp) ke supervisor atau grup perusahaan.

Aplikasi ini menggunakan teknologi web modern dan didesain agar mudah digunakan (*user-friendly*) bagi operator, HRD, dan Supervisor (SPV).

---

## ✨ Fitur Utama (Key Features)

- 📦 **Manajemen Inventaris (Inventory Management)**  
  Pantau stok bahan masuk, stok keluar, hingga peringatan batas stok kritis *(restock alert)* secara *real-time*.
- 🔔 **Notifikasi Otomatis WhatsApp (Fonnte Integration)**  
  Aplikasi ini terhubung langsung ke layanan *Gateway Fonnte*. Setiap kejadian penting (seperti bahan rusak, pemakaian mesin, laporan kendala) dapat langsung diinfokan ke WhatsApp Supervisor secara otomatis.
- 🤖 **Bot WhatsApp (Cek Sisa Stok)**  
  Mendukung fitur Edge Function Supabase untuk menjawab pertanyaan *"laporkan sisa stok"* langsung via chat WhatsApp tanpa perlu membuka aplikasi web.
- ⚠️ **Pelaporan Kendala Produksi (Defect Tracking)**  
  Manajemen komprehensif untuk melaporkan masalah cetakan, hasil mesin error, kesalahan bahan, dll beserta identifikasi "terdakwa/pelapor".
- 👥 **Role-Based Access Control (RBAC)**  
  Tampilan dan akses fitur aplikasi dibatasi sesuai peran:
  - **SPV (Supervisor):** Akses penuh ke semua log, laporan, dan pengaturan (*Settings Dashboard*).
  - **HRD:** Dapat mengakses data *Supplier* dan membaca seluruh format Laporan.
  - **OP (Operator Cetak / Cutting dll):** Hanya dapat meng-input laporan harian di mesin mereka.
- 🎨 **Modern & Premium UI/UX**  
  Menggunakan kerangka kerja desain antarmuka *Bento Grid* bergaya modern *Glassmorphism* lengkap dengan *Dark Mode* / *Light Mode*.

---

## 🛠️ Teknologi yang Digunakan (Tech Stack)

- **Frontend:** React.js + Vite
- **Styling:** Tailwind CSS + Lucide React (Icons)
- **Backend / Database:** Supabase (PostgreSQL, Authentication & Edge Functions)
- **WhatsApp API Gateway:** Fonnte
- **PWA (Progressive Web App):** Mendukung instalasi langsung ke *Home Screen* HP layaknya aplikasi *Native*.

---

## 🚀 Panduan Instalasi (Getting Started)

Bagian ini khusus untuk pengguna PC/Admin yang ingin memasang dan menjalankan proyek ini di komputernya.

### 1. Prasyarat (Requirements)
Pastikan komputer Anda sudah terinstal perangkat lunak berikut:
- **Node.js** (Minimal versi 18 atau ke atas)
- **Git**

### 2. Kloning Repositori
Buka terminal/CMD Anda, lalu jalankan perintah berikut:
```bash
git clone https://github.com/IlhamJaya/arsy-jaya-stok.git
cd arsy-jaya-stok
```

### 3. Instalasi *Dependencies*
Download semua *package* (alat) yang dibutuhkan aplikasi dengan perintah:
```bash
npm install
```

### 4. Konfigurasi Database (Supabase)
Proyek ini membutuhkan akun [Supabase](https://supabase.com). 
1. Buat project baru di Supabase.
2. Temukan menu **SQL Editor**, dan pasang seluruh susunan tabel (*database migrations*) yang ada di dalam folder `supabase/migrations/` pada proyek ini satu-per-satu.
3. Buat file baru bernama `.env` di folder utama aplikasi ini.
4. Isi file `.env` dengan kredensial dari *Project Settings > API* di Supabase Anda:
    ```env
    VITE_APP_NAME="ARSY JAYA"
    VITE_APP_VERSION="1.0.0"

    VITE_SUPABASE_URL="URL-PROYEK-SUPABASE-ANDA"
    VITE_SUPABASE_ANON_KEY="ANON_KEY_ANDA"
    ```

### 5. Menjalankan Aplikasi
Setelah di-setting dengan benar, jalankan aplikasi lokal:
```bash
npm run dev
```
Buka browser (Google Chrome) dan akses `http://localhost:5173`. Aplikasi kini sudah bisa digunakan!

---

## ⚙️ Pengaturan Fitur Notifikasi WhatsApp (Fonnte API)

Agar aplikasi dapat mengirimkan pesan otomatis:
1. Daftar atau masuk ke [Fonnte.com](https://fonnte.com).
2. Dapatkan API TOKEN dari menu *Device*.
3. Buka halaman aplikasi Arsy Jaya di browser, masuk ke menu **Settings (Pengaturan)** (harus login sebagai SPV).
4. Masukkan sandi API TOKEN tersebut dan simpan. 
5. Di menu *Settings* ini, Anda juga bisa menata kerangka (template) format pesan notifikasi sesuai perusahaan Anda!

---

## 🤝 Kontribusi

Aplikasi ini dikembangkan untuk penggunaan skala instansi terbatas. Walau demikian, fitur masukan bug (issues) dan fitur perbaikan (pull request) yang mendukung modernisasi sistem industri percetakan sangat kami apresiasi.

---

> <br>
> **1lhmjya.**  
> *Dibuat dengan logika, dedikasi, & secangkir kopi. &copy; 2026*
> <br><br>
