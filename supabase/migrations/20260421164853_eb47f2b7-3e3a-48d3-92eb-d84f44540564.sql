DROP POLICY IF EXISTS "Admins insert equipment" ON public.equipment;
CREATE POLICY "Authenticated insert equipment" ON public.equipment
FOR INSERT TO authenticated WITH CHECK (true);