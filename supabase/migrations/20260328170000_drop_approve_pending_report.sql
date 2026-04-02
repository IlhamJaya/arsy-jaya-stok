-- Menghapus RPC alur persetujuan SPV (laporan pemakaian/kerusakan langsung tercatat via submit_report_direct).
DROP FUNCTION IF EXISTS public.approve_pending_report(uuid, numeric, text);

-- Default baru: tercatat langsung (bukan menunggu persetujuan).
ALTER TABLE public.trx_reports ALTER COLUMN status SET DEFAULT 'Approved';
