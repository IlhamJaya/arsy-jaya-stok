# Project Context: ARSY JAYA — Stock & Tracking Sistem

> **Last Updated**: 2026-03-28 | **Build Status**: ✅ Passing

---

## 1. App Identity & Vision

| Property | Value |
|---|---|
| **Nama Aplikasi** | ARSY JAYA |
| **Subtitle** | Stock & Tracking Sistem |
| **Versi** | 1.1.0 |
| **Supabase Project** | `osyfdkwqsssyjvrxtrht` |
| **Purpose** | Inventory management + Tracking + QC Defect system untuk percetakan A3+ (stiker/kertas) |
| **Target Users** | Supervisor (SPV), Operator Cetak, Operator Cutting, Sales, HRD |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Vite + React + Tailwind CSS v4 |
| **State Management** | Zustand (`src/store/useAppStore.js`) |
| **Backend / DB** | Supabase (PostgreSQL + Auth + Edge Functions + Realtime) |
| **WhatsApp Gateway** | Fonnte API (via Supabase Edge Function `fonnte-alert`) |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **Export** | xlsx (Excel only) |
| **Fonts** | Inter (UI), JetBrains Mono (Numbers) |

---

## 3. Theme System

- **Dual theme**: Dark (default) + Light mode
- **Mechanism**: CSS custom properties di `:root` dan `html.light` di `src/index.css`
- **Toggle**: Zustand store `toggleTheme()` → localStorage `app_theme` → toggle class pada `<html>`
- **Accent Color**: `--color-brand-green: #06b6d4` (CYAN)
- **Utility classes**: `.t-primary`, `.t-secondary`, `.t-muted`, `.bg-surface`, `.bg-input`, `.border-theme`, `.glass-card`, `.glass-panel`

---

## 4. User Roles, Menu & Routes (ringkas)

**Label navigasi (top bar / sidebar)** — satu baris per fitur; sub-halaman memakai query `?tab=`.

| Label UI | Path utama | Isi |
|---|---|---|
| **Dashboard** | `/dashboard` | Linimasa aktivitas harian (pemakaian, cutting, kendala, stok masuk, audit). |
| **Input & kendala** | `/input-report` | Hub: **Input laporan** (default) \| **Lapor kendala** (`?tab=kendala`). `OP_CETAK` hanya tab input. |
| **Stok & mitra** | `/inventory` | Hub: Data master & stok, Stok masuk (SPV/SALES), Mitra (`?tab=suppliers`, SPV/HRD). |
| **Laporan** | `/reports` | Hub: **Analisis & ekspor** \| **Rekap mingguan** (`?tab=rekap`). SPV & HRD. |
| **Pengaturan** | `/settings` | Hub: **Sistem & WA** \| **Pengguna** (`?tab=pengguna`). **SPV only.** |

**Redirect kompatibilitas (bookmark lama):**

| Lama | Baru |
|---|---|
| `/weekly-report` | `/reports?tab=rekap` |
| `/suppliers` | `/inventory?tab=suppliers` |
| `/profiles` | `/settings?tab=pengguna` |
| `/defects` | `/input-report?tab=kendala` |

### Route Protection (`App.jsx`)

- `/settings` → **SPV only**
- `/reports` → **SPV** dan **HRD**
- `/input-report` — semua user terautentikasi; tab kendala disembunyikan untuk `OP_CETAK` di UI (bukan route terpisah)
- Selain itu → semua user terautentikasi (sesuai menu per role)

### Role × kemampuan (bukan daftar menu panjang)

| Role | Catatan |
|---|---|
| **SPV** | Stok, supplier, laporan, pengaturan & pengguna, audit stok, hapus/edit sesuai UI. |
| **HRD** | Laporan + stok & mitra (baca); tidak akses pengaturan. |
| **OP_CETAK** | Input pemakaian/kerusakan (potong stok via RPC), dashboard, inventori baca. |
| **OP_CUTTING** | Input cutting + tab input (tanpa tab kendala di sidebar). |
| **SALES** | Stok masuk + input hub (sesuai aturan form). |

**Tidak ada alur persetujuan SPV** untuk laporan pemakaian/kerusakan: input operator **langsung** mengurangi stok lewat `submit_report_direct` (status baris `trx_reports` = `Approved` di DB untuk kompatibilitas & laporan).

---

## 5. Database Schema

### Master Tables

**`mst_items`** — Master data barang  
- `id`, `name`, `code`, `brand`, `category`, `unit`, `stock` (current), `min_stock`, `width`, `price_per_roll`, `created_at`

**`mst_suppliers`** — Mitra & supplier (di UI: tab **Mitra** pada `/inventory?tab=suppliers`)  
- `id`, `name`, `contact_number`, `wa_template`, `address`, `created_at`, `updated_at`  
- **RLS:** SPV + HRD bisa baca; hanya SPV bisa insert/update/delete.

**`profiles`** — User profiles (linked to auth.users)  
- `id` (FK → auth.users), `full_name`, `role`, `avatar_url`, `created_at`

**`app_settings`** — Application config (single row, id=1)  
- `id`, `app_title`, `app_subtitle`, `app_logo_svg`  
- `wa_threshold`, `spv_wa_number`, `spv_wa_group`  
- Template WA: `wa_template_damage`, `wa_template_usage`, `wa_template_stockin`, `wa_template_cutting`, `wa_template_defect`, `wa_template_restock_usage` (Edge Function `fonnte-alert` saat ini **tidak** mengirim WA dari baris `trx_stock_log` selain pola yang didokumentasikan di function)  
- Toggle: `is_active_usage`, `is_active_damage`, `is_active_stockin`, `is_active_cutting`, `is_active_defect`, `is_active_restock`, `is_active_bot`  
- `defect_sources` & `defect_categories` (JSONB, edit SPV)

### Transaction Tables

**`trx_reports`** — Laporan pemakaian / kerusakan (mempengaruhi stok)  
- `id`, `item_id` (FK), `operator_id` (FK)  
- `type`: `'Usage'` \| `'Damage'`  
- `quantity`, `notes`, `status` (nilai disimpan `'Approved'` untuk entri baru; kolom tetap ada untuk data lama / kompatibilitas)  
- **RLS:** tidak ada `INSERT` langsung dari klien (`WITH CHECK (false)`); insert hanya lewat RPC `submit_report_direct` (SECURITY DEFINER).

**`trx_stock_log`** — Riwayat pergerakan stok  
- `id`, `item_id`, `report_id` (nullable), `changed_by`  
- `change_amount`, `previous_stock`, `final_stock`  
- `source` (contoh): `'REPORT_USAGE'`, `'REPORT_DAMAGE'`, `'STOCK_IN'`, `'AUDIT'`

**`processed_events`** — Dedup webhook Fonnte  

**`trx_cutting_log`** — Tracking cutting (tidak mengubah `mst_items.stock`)  

**`trx_defects`** — Kendala QC (tidak mengubah stok)  

---

## 6. Business Logic & Data Flow (Golden Rules)

### 1. Modul Stok (OP_CETAK) — *MENGURANGI STOK*

- Submit form → RPC `submit_report_direct()` → kurangi `mst_items.stock` + insert `trx_reports` + `trx_stock_log` (atomik).  
- **Tidak ada** langkah persetujuan SPV.

### 2. Modul Cutting (OP_CUTTING) — *TIDAK MENGURANGI STOK*

- Insert `trx_cutting_log` saja.

### 3. Modul Kendala / Defect QC — *TIDAK MENGURANGI STOK*

- Insert `trx_defects`; dropdown dari `app_settings`.

### 4. Notifikasi WhatsApp (`fonnte-alert`)

- Sama seperti sebelumnya: webhook `INSERT` ke tabel terpantau, dedup `processed_events`, token dari env / `app_settings`.  
- Detail routing & troubleshooting tetap di section serupa pada deploy; **JWT webhook**: `verify_jwt = false` untuk `fonnte-alert` di `supabase/config.toml`.

---

## 7. Supabase RPC Functions

Sumber skema terpusat: **`supabase/schema/04_rpc_functions.sql`** (urutan apply: `01` → `06`).  
Migrasi **`20260328170000_drop_approve_pending_report.sql`** menghapus fungsi `approve_pending_report` di database yang sudah ada.

| Function | Purpose |
|---|---|
| `get_my_role()` | Role user saat ini |
| `cleanup_processed_events()` | Hapus baris dedup Fonnte > 10 menit |
| `submit_report_direct(...)` | Submit laporan + stok + `trx_stock_log` atomik (**hanya `OP_CETAK`**) |
| `add_incoming_stock(...)` | Stok masuk + log |
| `audit_physical_stock(...)` | Audit / koreksi stok + log |
| `spv_update_trx_report_notes(...)` | SPV ubah catatan laporan |
| `spv_delete_trx_report_and_restore_stock(...)` | Hapus laporan + kembalikan stok |

---

## 8. File Structure Map

```
src/
├── App.jsx                          # Router + redirects + role guard
├── supabaseClient.js
├── index.css
├── store/useAppStore.js
├── components/layout/
│   ├── Sidebar.jsx
│   └── MainLayout.jsx
└── pages/dashboard/
    ├── DashboardPage.jsx         # /dashboard — linimasa aktivitas
    ├── InputReportHub.jsx        # /input-report — tab input | kendala
    ├── InputReportDashboard.jsx
    ├── DefectsDashboard.jsx
    ├── InventoryDashboard.jsx    # tab stok, masuk, mitra
    ├── SuppliersDashboard.jsx    # dipakai embedded dari inventory
    ├── ReportsHub.jsx            # /reports — analisis | rekap
    ├── ReportsDashboard.jsx
    ├── WeeklyReportDashboard.jsx
    ├── SettingsHub.jsx           # /settings — sistem | pengguna
    ├── SettingsDashboard.jsx
    └── ProfilesDashboard.jsx

supabase/
├── config.toml
├── schema/
├── migrations/                     # termasuk drop approve_pending_report + default status
├── functions/
│   ├── fonnte-alert/index.ts
│   └── fonnte-bot/index.ts
└── docs/
```

---

## 9. Environment Variables (.env)

```env
VITE_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
VITE_SUPABASE_ANON_KEY="..."
VITE_SUPABASE_SERVICE_ROLE_KEY="..."
```

*(Token Fonnte dan secret deploy ada di Supabase Dashboard / Edge Function secrets.)*
