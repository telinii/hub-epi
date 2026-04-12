CREATE TABLE public.equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ca TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  department TEXT,
  role TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  supplier TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipment(id),
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read equipment" ON public.equipment FOR SELECT USING (true);
CREATE POLICY "Public insert equipment" ON public.equipment FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update equipment" ON public.equipment FOR UPDATE USING (true);
CREATE POLICY "Public delete equipment" ON public.equipment FOR DELETE USING (true);

CREATE POLICY "Public read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Public insert employees" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update employees" ON public.employees FOR UPDATE USING (true);
CREATE POLICY "Public delete employees" ON public.employees FOR DELETE USING (true);

CREATE POLICY "Public read invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Public insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update invoices" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Public delete invoices" ON public.invoices FOR DELETE USING (true);

CREATE POLICY "Public read invoice_items" ON public.invoice_items FOR SELECT USING (true);
CREATE POLICY "Public insert invoice_items" ON public.invoice_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update invoice_items" ON public.invoice_items FOR UPDATE USING (true);

CREATE POLICY "Public read deliveries" ON public.deliveries FOR SELECT USING (true);
CREATE POLICY "Public insert deliveries" ON public.deliveries FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();