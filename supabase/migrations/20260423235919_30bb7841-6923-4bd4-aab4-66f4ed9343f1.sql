ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS ca_expiry_date DATE NULL,
  ADD COLUMN IF NOT EXISTS ca_status_note TEXT NULL;