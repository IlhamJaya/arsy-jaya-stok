# Serah terima: WA peringatan restok + `fonnte-alert`

Dokumen ini merangkum **kendala**, **perubahan kode/migrasi yang sudah dilakukan**, dan **status saat ini** agar agent berikutnya bisa melanjutkan perbaikan tanpa mengulang diskusi dari awal.

---

## 1. Kebutuhan bisnis (ringkas)

- Setiap **laporan pemakaian (Usage)** yang mengurangi stok: kirim WA **laporan pemakaian** (sudah ada).
- **Tambahan:** jika bahan **masih dalam zona kritis** (`sisa stok setelah pemakaian ≤ batas minimal`), kirim **pesan kedua** terpisah — **peringatan restok** — **setiap kali** ada pemakaian selama masih kritis (tanpa cooldown).
- Pesan berhenti saat stok kembali **di atas** batas minimal (restok / koreksi).

**Catatan UI:** Zona kritis di aplikasi mengacu ke `mst_items.stock <= mst_items.min_stock`. **Batas minimal harus diisi (`min_stock > 0`)** agar logika WA restok konsisten.

---

## 2. Kendala yang dilaporkan user

| Gejala | Observasi |
|--------|-----------|
| Hanya **satu** pesan WA (pemakaian), **tidak ada** pesan peringatan restok | Setelah satu kali input pemakaian, di Supabase muncul **dua** invocation `fonnte-alert` (normal: `trx_reports` + `trx_stock_log`). |
| Log invocation kecil (~102 byte response) | Pola respons **ignored** dari cabang lama `trx_stock_log` yang hanya memproses `stock_in`, sehingga baris `REPORT_USAGE` tidak pernah memicu WA restok. |
| Dugaan awal: filter webhook | User **tidak** menemukan filter di webhook **Stok Masuk** (`trx_stock_log`, INSERT only). Filter bukan penyebab utama. |
| Log HTTP 200 dengan JWT service_role | Bukan masalah 401 pada request yang sukses; function jalan tapi bisa **early-return** tanpa kirim Fonnte untuk restok. |

---

## 3. Perubahan yang sudah diimplementasi (repo)

### 3.1 Edge Function — `supabase/functions/fonnte-alert/index.ts`

- **Template & settings:** `select('*')` pada `app_settings`; placeholder `{stock}`, `{min_stock}` di `formatMessage`.
- **`trx_reports`:** Normalisasi tipe `Usage`/`Damage` (case-insensitive). **Hanya** WA pemakaian/kerusakan — **restok dihapus dari sini** (menghindari race dengan urutan RPC vs baca `mst_items.stock`).
- **`trx_stock_log`:**
  - `source` dinormalisasi lowercase.
  - **`report_usage`:** Kirim **satu** WA pakai template `wa_template_restock_usage` jika:
    - `min_stock > 0` pada item, dan
    - `final_stock` (dari **record log**) `<= min_stock`.
  - **`stock_in`:** Tetap template stok masuk.
  - Lainnya: ignored dengan pesan jelas.
- **Pengiriman Fonnte:** Satu `message` per invocation; flag respons `restock_sent` untuk jalur restok.
- **Catatan:** `sendFonnte` tidak memeriksa `response.ok` dari API Fonnte — gagal Fonnte bisa tetap terlihat `success` di layer function.

### 3.2 Migrasi / SQL

| File | Isi relevan |
|------|-------------|
| `supabase/migrations/20260328120000_wa_template_restock_and_submit_order.sql` | Kolom `app_settings.wa_template_restock_usage` + default teks; **urutan `submit_report_direct`:** `UPDATE mst_items` lalu `INSERT trx_reports` lalu `INSERT trx_stock_log`. |
| `supabase/migrations/20260328140000_fonnte_trx_reports_include_usage.sql` | Perbaikan fungsi `trigger_fonnte_alert()` agar **Usage + Damage** memicu HTTP (jika memakai trigger PL/pgSQL, bukan hanya Damage). URL project di file perlu disesuaikan ref proyek user. |
| `supabase/submit_report_direct.sql` | Diselaraskan urutan UPDATE → INSERT (dokumentasi/manual). |
| `supabase/fix_webhook.sql` | Logika trigger disamakan (Usage + Damage). |

### 3.3 Konfigurasi lokal Supabase

- `supabase/config.toml`: blok `[functions.fonnte-alert]` dengan `verify_jwt = false` agar Database Webhook / pg_net bisa memanggil function tanpa ditolak JWT.

### 3.4 Frontend

- `src/pages/dashboard/SettingsDashboard.jsx`: field template **Peringatan Restok**, state `hasRestockTemplate`, penyimpanan `wa_template_restock_usage`; teks bantuan menyebut webhook `trx_stock_log` dan `min_stock > 0`.

### 3.5 Dokumentasi

- `project-context.md`: bagian Fonnte + troubleshooting (JWT, webhook `trx_reports`, migrasi) diperbarui sebagian; sebaiknya disinkronkan lagi dengan perilaku **restok lewat `report_usage`**.

---

## 4. Yang belum terbukti berfungsi di lingkungan user / risiko sisa

1. **Deploy:** Perubahan `fonnte-alert` **wajib** di-deploy ke project Supabase yang dipakai (user memakai ref **`osyfdkwqsssyjvrxtrht`** di log). Tanpa deploy, server masih menjalankan versi lama.
2. **`verify_jwt`:** Di dashboard production, pastikan function setara **`--no-verify-jwt`** atau setting sama di project terhubung.
3. **`min_stock`:** Jika di DB **0 / NULL**, WA restok **sengaja tidak** dikirim — respons log: *min_stock not set*. Ini bisa salah diartikan sebagai “fitur rusak”.
4. **Nama kolom `source` di payload webhook:** Pastikan nilai dari Postgres untuk log pemakaian adalah **`REPORT_USAGE`** (sesuai `submit_report_direct`). Jika enum/string berbeda casing, sudah ditangani dengan `toLowerCase()` → `report_usage`.
5. **Duplikasi trigger vs webhook:** Jika ada **trigger SQL** dan **Database Webhook** bersamaan ke URL sama untuk satu tabel, bisa **double** notifikasi — perlu inventarisasi di DB user.
6. **Respons Fonnte:** Belum ada penanganan eksplisit jika `api.fonnte.com` mengembalikan error; disarankan log + return body ke response function untuk debugging.

---

## 5. Checklist — ✅ RESOLVED (2026-03-29)

- [x] Konfirmasi versi **deployed** `fonnte-alert` — user telah deploy versi terbaru secara manual.
- [x] WA restok berfungsi setelah update `index.ts` (tambah error handling, REPORT_DAMAGE restok, structured logging).
- [x] Migrasi `20260328120000` dijalankan (kolom `wa_template_restock_usage` + urutan RPC).
- [x] Migrasi `20260328140000` **TIDAK dijalankan** — user pakai Database Webhooks, bukan SQL trigger.
- [x] Structured logging `[fonnte-alert]` ditambahkan untuk debugging production.
- [x] Project cleanup: 12 file tidak terpakai dihapus, `project-context.md` disinkronkan.

**Root cause:** Edge function `fonnte-alert` di Supabase masih versi lama yang tidak memproses `trx_stock_log` dengan source `REPORT_USAGE`. Setelah deploy versi baru, WA restok berfungsi normal.

---

## 6. File utama untuk dibuka

```
supabase/functions/fonnte-alert/index.ts
supabase/config.toml
src/pages/dashboard/SettingsDashboard.jsx
project-context.md
```

---

*Dokumen serah terima — **RESOLVED** pada 2026-03-29. Root cause: fonnte-alert belum di-deploy ulang setelah perubahan kode.*
