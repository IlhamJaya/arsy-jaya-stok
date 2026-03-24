# Project Context: ARSY JAYA — Stock & Tracking Sistem

> **Last Updated**: 2026-03-04 | **Build Status**: ✅ Passing

---

## 1. App Identity & Vision

| Property | Value |
|---|---|
| **Nama Aplikasi** | ARSY JAYA |
| **Subtitle** | Stock & Tracking Sistem |
| **Versi** | 1.1.0 |
| **Supabase Project** | `ylypksowjlypuknmtztv` |
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
- `/defects` → All authenticated users (delete action restricted to SPV)
- Semua route lain → all authenticated users

---

## 5. Database Schema

### Master Tables

**`mst_items`** — Master data barang
- `id`, `name`, `code`, `brand`, `category`, `unit`, `stock` (current), `min_stock_m` (minimum threshold), `width`, `price_per_roll`, `created_at`

**`profiles`** — User profiles (linked to auth.users)
- `id` (FK → auth.users), `full_name`, `role`, `avatar_url`, `created_at`

**`app_settings`** — Application config (single row, id=1)
- `id`, `app_title`, `app_subtitle`, `app_logo_svg`
- `wa_threshold` (min lembar rusak untuk WA), `spv_wa_number` (Target Pribadi), `spv_wa_group` (Target Grup JS Fonnte)
- `wa_template_damage`, `wa_template_usage`, `wa_template_stockin`, `wa_template_cutting`, `wa_template_defect`
- `defect_sources` & `defect_categories` (JSONB arrays editable by SPV for QC Dropdowns)

### Transaction Tables

**`trx_reports`** — Laporan Operator Cetak (Berdampak pada Stok)
- `id`, `item_id` (FK), `operator_id` (FK)
- `type`: `'Usage'` | `'Damage'`
- `quantity`, `notes`, `status`: `'Pending'` | `'Approved'` | `'Rejected'`

**`trx_stock_log`** — Final stock movement history
- `id`, `item_id`, `report_id` (nullable), `changed_by`
- `change_amount`, `previous_stock`, `final_stock`
- `source`: `'report_approved'` | `'stock_in'` | `'audit'` | `'correction'`

**`trx_cutting_log`** — Tracking cutting stiker harian
- `id`, `operator_id`, `order_name`, `qty_cut`, `notes`
- *TIDAK mengubah `mst_items.stock`*. Murni untuk menghitung performa cutting.

**`trx_defects`** — Laporan Kendala & Quality Control (NEW)
- `id`, `reporter_id` (FK), `order_name`, `error_source`, `error_category`, `quantity`, `notes`
- *TIDAK mengubah `mst_items.stock`*. Murni untuk evaluasi kegagalan cetak/mesin/human error.

---

## 6. Business Logic & Data Flow (Golden Rules)

### 1. Modul Stok (OP_CETAK) - *MENGURANGI STOK*
Hanya kesalahan/penggunaan bahan pada saat *Cetak* yang boleh mengurangi stok fisik.
- OP_CETAK submit form → Panggil RPC `submit_report_direct()` → Insert ke `trx_reports` (status: Approved) + Kurangi `mst_items.stock` + Catat di `trx_stock_log` — semuanya atomik.
- Validation: Tidak merender sisa stok menjadi negatif atau di bawah 0. Warning diberikan jika input melewati `min_stock_m`.

### 2. Modul Cutting (OP_CUTTING) - *TIDAK MENGURANGI STOK*
Hanya mencatat berapa lembar yang berhasil dipotong dari total yang sudah dicetak.
- OP_CUTTING submit form → Insert ke `trx_cutting_log`.
- Logika kalkulasi sisa belum dipotong = Total (Approved Usage OP_CETAK) - Total (Cutting Log OP_CUTTING) per periode waktu tertentu.

### 3. Modul Lapor Kendala / Defect QC - *TIDAK MENGURANGI STOK*
Hanya untuk evaluasi kinerja (Salah desain, mesin rusak, dll) agar bisa dilacak terdakwanya.
- Siapapun (All Roles) submit form → Insert ke `trx_defects`.
- Dropdown "Pihak Terlapor" dan "Kategori Kendala" bersifat dinamis dari Settings (JSONB array di `app_settings`).

### 4. Notifikasi WhatsApp (Fonnte Edge Function)
Semua modul di atas dihubungkan ke Webhook Supabase trigger `INSERT` menuju Edge Function `fonnte-alert`.
Function `fonnte-alert` men-support 4 payload routing:
- `trx_reports` (Usage/Damage) → *Alert Damage hanya dikirim jika QTY >= wa_threshold*.
- `trx_stock_log` (Stock In)
- `trx_cutting_log` (Log Cutting)
- `trx_defects` (Defect/Kendala Baru)

*Pesan dikirim serentak ke `spv_wa_number` dan `spv_wa_group` (bisa multi target) memakai template text dinamis yang dapat diedit di menu Settings.*

---

## 7. Supabase RPC Functions

| Function | File | Purpose |
|---|---|---|
| `approve_report_with_stock()` | `approve_rpc.sql` | Approve report + update stock + insert log secara atomik |
| `handle_stock_in()` | `stok_masuk_rpc.sql` | Stock-in + log secara atomik |
| `handle_stock_audit()` | `audit_rpc.sql` | Audit base stock/Koreksi + log |

---

## 8. File Structure Map

```
src/
├── App.jsx                          # Router + Protect Routes (Role-based)
├── supabaseClient.js                # Supabase init
├── index.css                        # Theme System
├── store/
│   └── useAppStore.js               # Global state (Theme, Branding config)
├── layout/
│   ├── Sidebar.jsx              
│   └── MainLayout.jsx           
└── pages/dashboard/
    ├── ApprovalDashboard.jsx    # Riwayat Laporan (list semua report)
    ├── InventoryDashboard.jsx   # Tab stok, masuk, supplier, correction
    ├── InputReportDashboard.jsx # Tab Laporan Cetak & Tracking Cutting
    ├── DefectsDashboard.jsx     # NEW: UI Lapor Kendala produksi (Non-stok)
    ├── ReportsDashboard.jsx     # Chart & Excel Export
    ├── ProfilesDashboard.jsx    # SPV: User management
    └── SettingsDashboard.jsx    # SPV: Branding, WA Template, Drodown Defects config

supabase/
├── functions/
│   └── fonnte-alert/index.ts        # Edge Function Fonnte Webhooks
├── approve_rpc.sql                  
├── audit_rpc.sql                    
├── stok_masuk_rpc.sql               
├── add_defects.sql                  # Schema: trx_defects & Dropdowns
├── add_defect_webhook.sql           # Schema: defect triggers
├── add_wa_templates.sql             
└── add_wa_group.sql                 
```

## 9. Environment Variables (.env)

```env
VITE_SUPABASE_URL="https://[PROJECT_ID].supabase.co"
VITE_SUPABASE_ANON_KEY="..."
VITE_SUPABASE_SERVICE_ROLE_KEY="..."
```
*(Catatan: Token Fonnte dan Webhook disimpan didalam Supabase Dashboard Secrets sebagai `FONNTE_API_TOKEN`, tidak terekspos ke frontend).*
