
-- Create storage bucket for monthly reports
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on reports bucket
CREATE POLICY "Public read reports" ON storage.objects FOR SELECT TO public USING (bucket_id = 'reports');

-- Allow service role to insert reports
CREATE POLICY "Service insert reports" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'reports');

-- Create table to track generated reports
CREATE TABLE public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  report_month text NOT NULL,
  file_path text NOT NULL,
  generated_by text NOT NULL DEFAULT 'system',
  UNIQUE(report_month)
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read monthly_reports" ON public.monthly_reports FOR SELECT TO public USING (true);
CREATE POLICY "Public insert monthly_reports" ON public.monthly_reports FOR INSERT TO public WITH CHECK (true);
