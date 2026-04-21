
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ HAS_ROLE FUNCTION (security definer) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ ADMIN REQUESTS ============
CREATE TABLE public.admin_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  justification TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT
);
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_admin_requests_status ON public.admin_requests(status);
CREATE INDEX idx_admin_requests_user ON public.admin_requests(user_id);

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name);

-- ============ TRIGGER: criar profile + role no signup ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;

  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BOOTSTRAP: garantir admin para usuários já existentes ============
INSERT INTO public.profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Promove TODOS os usuários já existentes a admin (preserva acesso atual)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- ============ TRIGGER: impede remover o último admin ============
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining_admins INTEGER;
BEGIN
  IF OLD.role = 'admin' THEN
    SELECT COUNT(*) INTO remaining_admins
    FROM public.user_roles
    WHERE role = 'admin' AND user_id != OLD.user_id;
    IF remaining_admins = 0 THEN
      RAISE EXCEPTION 'Não é possível remover o último administrador do sistema';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_last_admin_removal
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_admin_removal();

-- ============ TRIGGER: usuário comum só altera quantity em equipment ============
CREATE OR REPLACE FUNCTION public.restrict_equipment_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.ca IS DISTINCT FROM OLD.ca
     OR NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.min_quantity IS DISTINCT FROM OLD.min_quantity THEN
    RAISE EXCEPTION 'Usuários comuns só podem alterar a quantidade do EPI';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_equipment_updates
BEFORE UPDATE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.restrict_equipment_updates();

-- ============ TRIGGER: auditoria genérica ============
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data)
  VALUES (
    auth.uid(),
    v_user_email,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_equipment AFTER INSERT OR UPDATE OR DELETE ON public.equipment
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_deliveries AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
CREATE TRIGGER audit_admin_requests AFTER INSERT OR UPDATE OR DELETE ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ============ updated_at em profiles ============
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users see own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins see all profiles" ON public.profiles
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Users see own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_requests
CREATE POLICY "Users see own requests" ON public.admin_requests
FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own requests" ON public.admin_requests
FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins see all requests" ON public.admin_requests
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update requests" ON public.admin_requests
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- audit_log
CREATE POLICY "Admins see audit log" ON public.audit_log
FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ============ SUBSTITUIR POLICIES PÚBLICAS POR AUTH-BASED ============

-- equipment
DROP POLICY IF EXISTS "Public read equipment" ON public.equipment;
DROP POLICY IF EXISTS "Public insert equipment" ON public.equipment;
DROP POLICY IF EXISTS "Public update equipment" ON public.equipment;
DROP POLICY IF EXISTS "Public delete equipment" ON public.equipment;

CREATE POLICY "Authenticated read equipment" ON public.equipment
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert equipment" ON public.equipment
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated update equipment" ON public.equipment
FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins delete equipment" ON public.equipment
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- employees
DROP POLICY IF EXISTS "Public read employees" ON public.employees;
DROP POLICY IF EXISTS "Public insert employees" ON public.employees;
DROP POLICY IF EXISTS "Public update employees" ON public.employees;
DROP POLICY IF EXISTS "Public delete employees" ON public.employees;

CREATE POLICY "Authenticated read employees" ON public.employees
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage employees" ON public.employees
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- invoices
DROP POLICY IF EXISTS "Public read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public delete invoices" ON public.invoices;

CREATE POLICY "Authenticated read invoices" ON public.invoices
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert invoices" ON public.invoices
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update invoices" ON public.invoices
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete invoices" ON public.invoices
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- invoice_items
DROP POLICY IF EXISTS "Public read invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Public insert invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Public update invoice_items" ON public.invoice_items;

CREATE POLICY "Authenticated read invoice_items" ON public.invoice_items
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert invoice_items" ON public.invoice_items
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update invoice_items" ON public.invoice_items
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete invoice_items" ON public.invoice_items
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- deliveries
DROP POLICY IF EXISTS "Public read deliveries" ON public.deliveries;
DROP POLICY IF EXISTS "Public insert deliveries" ON public.deliveries;

CREATE POLICY "Authenticated read deliveries" ON public.deliveries
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert deliveries" ON public.deliveries
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins update deliveries" ON public.deliveries
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete deliveries" ON public.deliveries
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- monthly_reports
DROP POLICY IF EXISTS "Public read monthly_reports" ON public.monthly_reports;
DROP POLICY IF EXISTS "Public insert monthly_reports" ON public.monthly_reports;

CREATE POLICY "Authenticated read monthly_reports" ON public.monthly_reports
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert monthly_reports" ON public.monthly_reports
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
