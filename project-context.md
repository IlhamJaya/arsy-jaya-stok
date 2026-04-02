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

## 4. User Roles & Access

| Role | Menu Akses | Capabilities |
|---|---|---|
| **SPV** | Approval, Inventory, Reports, Profiles, Settings, Lapor Kendala | Full access: approve reports, manage items, stock-in, manage users, edit settings, manage/delete defects. |
| **OP_CETAK** | Approval, Input Laporan, Inventory, Reports, Lapor Kendala | Submit usage/damage (mempengaruhi stok), read-only inventory, submit defect QC. |
| **OP_CUTTING** | Approval, Input Laporan, Inventory, Reports, Lapor Kendala | Submit tracking cutting (tidak potong stok), submit defect QC. |
| **SALES** | Approval, Input Laporan, Inventory, Reports, Lapor Kendala | Input laporan cetak, stock-in, submit defect QC. |
| **HRD** | Approval, Inventory, Reports, Lapor Kendala | View only reports + submit defect QC. |

### Route Protection (`App.jsx`)
- `/profiles` dan `/settings` → **SPV only**
- `/input-report` → OP_CETAK, OP_CUTTING, SALES (excluded: SPV, HRD)
- `/suppliers`, `/reports`, **`/weekly-report`** → **SPV** dan **HRD** saja
- `/defects` → All authenticated users (delete action restricted to SPV)
- Semua route lain → all authenticated users

---

## 5. Database Schema

### Master Tables

**`mst_items`** — Master data barang
- `id`, `name`, `code`, `brand`, `category`, `unit`, `stock` (current), `min_stock` (minimum threshold; UI/legacy mungkin menyebut `min_stock_m`), `width`, `price_per_roll`, `created_at`

**`mst_suppliers`** — Partner & Supplier (halaman `/suppliers`)
- `id`, `name`, `contact_number`, `wa_template`, `address`, `created_at`, `updated_at`
- **RLS:** SPV + HRD bisa baca; hanya SPV bisa insert/update/delete.

**`profiles`** — User profiles (linked to auth.users)
- `id` (FK → auth.users), `full_name`, `role`, `avatar_url`, `created_at`

**`app_settings`** — Application config (single row, id=1)
- `id`, `app_title`, `app_subtitle`, `app_logo_svg`
- `wa_threshold` (min lembar rusak untuk WA), `spv_wa_number` (Target Pribadi), `spv_wa_group` (Target Grup JS Fonnte)
- `wa_template_damage`, `wa_template_usage`, `wa_template_stockin`, `wa_template_cutting`, `wa_template_defect`, `wa_template_restock_usage` (tersedia di DB/Settings; Edge Function `fonnte-alert` saat ini **tidak** mengirim WA dari baris `trx_stock_log` selain `stock_in`)
- Toggle notifikasi: `is_active_usage`, `is_active_damage`, `is_active_stockin`, `is_active_cutting`, `is_active_defect`, `is_active_restock`, `is_active_bot`
- `defect_sources` & `defect_categories` (JSONB arrays editable by SPV for QC Dropdowns)

### Transaction Tables

**`trx_reports`** — Laporan Operator Cetak (Berdampak pada Stok)
- `id`, `item_id` (FK), `operator_id` (FK)
- `type`: `'Usage'` | `'Damage'`
- `quantity`, `notes`, `status`: `'Pending'` | `'Approved'` | `'Rejected'`
- **RLS:** tidak ada `INSERT` langsung dari klien (`WITH CHECK (false)`); baris dibuat lewat RPC `submit_report_direct` / alur `approve_pending_report` (SECURITY DEFINER).

**`trx_stock_log`** — Final stock movement history
- `id`, `item_id`, `report_id` (nullable), `changed_by`
- `change_amount`, `previous_stock`, `final_stock`
- `source` (nilai dari RPC, contoh): `'REPORT_USAGE'`, `'REPORT_DAMAGE'`, `'STOCK_IN'`, `'AUDIT'` — di `fonnte-alert` dibandingkan dengan `toLowerCase()` (mis. `stock_in`, `report_usage` untuk WA restok vs stok masuk).

**`processed_events`** — Dedup webhook Fonnte (`event_key` = `table:record.id:INSERT`)

**`trx_cutting_log`** — Tracking cutting stiker harian
- `id`, `operator_id`, `order_name`, `qty_cut`, `notes`, `item_id` (opsional)
- *TIDAK mengubah `mst_items.stock`*. Murni untuk menghitung performa cutting.

**`trx_defects`** — Laporan Kendala & Quality Control (NEW)
- `id`, `reporter_id` (FK), `order_name`, `error_source`, `error_category`, `quantity`, `notes`
- *TIDAK mengubah `mst_items.stock`*. Murni untuk evaluasi kegagalan cetak/mesin/human error.

---

## 6. Business Logic & Data Flow (Golden Rules)

### 1. Modul Stok (OP_CETAK) - *MENGURANGI STOK*
Hanya kesalahan/penggunaan bahan pada saat *Cetak* yang boleh mengurangi stok fisik.
- OP_CETAK submit form → RPC `submit_report_direct()` (**backend memverifikasi role = OP_CETAK**) → Insert `trx_reports` (status Approved) + kurangi `mst_items.stock` + `trx_stock_log` — atomik.
- Validation: Tidak merender sisa stok menjadi negatif atau di bawah 0. Warning diberikan jika input melewati `min_stock` (minimum item).

### 2. Modul Cutting (OP_CUTTING) - *TIDAK MENGURANGI STOK*
Hanya mencatat berapa lembar yang berhasil dipotong dari total yang sudah dicetak.
- OP_CUTTING submit form → Insert ke `trx_cutting_log`.
- Logika kalkulasi sisa belum dipotong = Total (Approved Usage OP_CETAK) - Total (Cutting Log OP_CUTTING) per periode waktu tertentu.

### 3. Modul Lapor Kendala / Defect QC - *TIDAK MENGURANGI STOK*
Hanya untuk evaluasi kinerja (Salah desain, mesin rusak, dll) agar bisa dilacak terdakwanya.
- Semua role yang punya menu **Lapor Kendala** (sidebar menyembunyikan untuk `OP_CETAK`) → insert ke `trx_defects`.
- Dropdown "Pihak Terlapor" dan "Kategori Kendala" bersifat dinamis dari Settings (JSONB array di `app_settings`).

### 4. Notifikasi WhatsApp (Fonnte Edge Function)
Webhook / trigger `INSERT` menuju Edge Function `fonnte-alert`. Deploy dengan **JWT verification off** (`supabase/config.toml` → `[functions.fonnte-alert] verify_jwt = false`).

**Routing `fonnte-alert` (ringkas):**
- **`trx_reports`** (Usage/Damage, tipe case-insensitive; baris tipe tidak dikenal diabaikan) → Damage hanya jika QTY >= `wa_threshold`; template pemakaian/kerusakan; toggle `is_active_usage` / `is_active_damage` di `app_settings`.
- **`trx_stock_log`**:
  - `source` setara **`stock_in`** → template stok masuk (`is_active_stockin`).
  - `source` setara **`report_usage`** / **`report_damage`** → jika `final_stock ≤ min_stock` dan `min_stock > 0` → WA **peringatan restok** (`wa_template_restock_usage`, `is_active_restock`).
- **`trx_cutting_log`**, **`trx_defects`** (dengan toggle `is_active_*` yang sesuai).

**Dedup:** insert ke `processed_events` (duplikat = abaikan; error selain unik = gagal terlihat di log).

**Token Fonnte:** env `FONNTE_API_TOKEN` dan/atau kolom `fonnte_api_token` di `app_settings` (prioritas di function).

**RPC `submit_report_direct`:** meng-update `mst_items.stock` **sebelum** `INSERT trx_reports` agar webhook membaca stok konsisten (lihat juga `supabase/migrations/20260328120000_wa_template_restock_and_submit_order.sql` dan `supabase/schema/04_rpc_functions.sql`).

**Webhook `trx_reports`:** harus mencakup **Usage** dan **Damage** (bukan filter hanya Damage); lihat `20260328140000_fonnte_trx_reports_include_usage.sql`.

**Troubleshooting WA tidak jalan (webhook sudah ke `trx_reports`):**
1. **JWT:** Edge Function `fonnte-alert` harus **`verify_jwt = false`** (lihat `supabase/config.toml`). Deploy: `supabase functions deploy fonnte-alert --no-verify-jwt`. Tanpa ini, Database Webhook sering dapat **401** dan body tidak pernah diproses.
2. **Filter webhook:** Buka detail webhook `trx_reports` → pastikan tidak ada **condition** yang membatasi hanya `Damage`.
3. **Migrasi:** Jalankan `20260328120000_...` (urutan `submit_report_direct` + kolom template restok) agar `mst_items.stock` saat dibaca function = sisa stok setelah pemakaian.
4. **Secrets:** `FONNTE_API_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` terpasang di Edge Function secrets.
5. **Logs:** Supabase Dashboard → Edge Functions → `fonnte-alert` → Logs, saat submit pemakaian.

---

## 7. Supabase RPC Functions

Sumber skema terpusat: **`supabase/schema/04_rpc_functions.sql`** (urutan apply: `01` → `06`).

| Function | Purpose |
|---|---|
| `get_my_role()` | Role user saat ini |
| `cleanup_processed_events()` | Hapus baris dedup Fonnte > 10 menit |
| `submit_report_direct(...)` | Submit laporan + stok + `trx_stock_log` atomik (**hanya `OP_CETAK`**) |
| `approve_pending_report(...)` | Approve laporan pending + stok + log |
| `add_incoming_stock(...)` | Stok masuk + log |
| `audit_physical_stock(...)` | Audit / koreksi stok + log |
| `spv_update_trx_report_notes(...)` | SPV ubah catatan laporan |
| `spv_delete_trx_report_and_restore_stock(...)` | Hapus laporan + kembalikan stok |

---

## 8. File Structure Map

```
src/
├── App.jsx                          # Router + Protect Routes (Role-based)
├── supabaseClient.js                # Supabase init
├── index.css                        # Theme System
├── store/
│   └── useAppStore.js               # Global state (Theme, Branding config)
├── components/layout/
│   ├── Sidebar.jsx              
│   └── MainLayout.jsx           
└── pages/dashboard/
    ├── ApprovalDashboard.jsx    # Riwayat Laporan (list semua report)
    ├── InventoryDashboard.jsx   # Tab stok, masuk, supplier, correction
    ├── InputReportDashboard.jsx # Tab Laporan Cetak & Tracking Cutting
    ├── DefectsDashboard.jsx     # UI Lapor Kendala produksi (Non-stok)
    ├── SuppliersDashboard.jsx   # Data supplier & kontak
    ├── ReportsDashboard.jsx     # Chart & Excel Export
    ├── WeeklyReportDashboard.jsx # Rekap mingguan (usage/cutting/damage per kategori)
    ├── ProfilesDashboard.jsx    # SPV: User management
    └── SettingsDashboard.jsx    # SPV: WA Template, Defect config

supabase/
├── config.toml                      # fonnte-alert: verify_jwt = false
├── schema/                          # Skema berurutan (SQL Editor / baseline)
│   ├── 01_extensions_types.sql … 06_seed_defaults.sql
│   └── 99_patch_existing_database.sql
├── migrations/                      # Migrasi ber-tanggal (restok, toggle, Fonnte token, dll.)
├── functions/
│   ├── fonnte-alert/index.ts        # Webhook → Fonnte (pemakaian, restok, stok masuk, cutting, defect)
│   └── fonnte-bot/index.ts          # Bot auto-reply WA
└── docs/                            # Serah terima / catatan ops (opsional)
```

## 9. Environment Variables (.env)

```env
VITE_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
VITE_SUPABASE_ANON_KEY="..."
VITE_SUPABASE_SERVICE_ROLE_KEY="..."
```
*(Catatan: Token Fonnte dan Webhook disimpan didalam Supabase Dashboard Secrets sebagai `FONNTE_API_TOKEN`, tidak terekspos ke frontend).*
