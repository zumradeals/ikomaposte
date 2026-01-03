-- =============================================
-- IKOMA POSTE - Phase 2: Categories & Workers
-- =============================================

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  taux_horaire NUMERIC(10, 2) NOT NULL CHECK (taux_horaire > 0),
  devise TEXT NOT NULL DEFAULT 'XOF',
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create workers table
CREATE TABLE public.workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matricule TEXT NOT NULL UNIQUE,
  nom_affiche TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  photo_url TEXT,
  actif BOOLEAN NOT NULL DEFAULT true,
  qr_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

-- Categories: Public read (kiosk needs it), no public write
CREATE POLICY "Categories are publicly readable"
  ON public.categories
  FOR SELECT
  USING (true);

-- Workers: Public read (kiosk needs worker info for scan)
CREATE POLICY "Workers are publicly readable"
  ON public.workers
  FOR SELECT
  USING (true);

-- For admin operations (INSERT, UPDATE, DELETE), we allow all since this is a kiosk app
-- without user authentication - admin access is controlled at the app level via PIN
CREATE POLICY "Allow insert on categories"
  ON public.categories
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update on categories"
  ON public.categories
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow insert on workers"
  ON public.workers
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update on workers"
  ON public.workers
  FOR UPDATE
  USING (true);

-- No DELETE policies - workers and categories should not be deleted, only deactivated

-- Create storage bucket for worker photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-photos', 'worker-photos', true);

-- Storage policies for worker photos
CREATE POLICY "Worker photos are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'worker-photos');

CREATE POLICY "Anyone can upload worker photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'worker-photos');

CREATE POLICY "Anyone can update worker photos"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'worker-photos');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON public.workers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_workers_category_id ON public.workers(category_id);
CREATE INDEX idx_workers_qr_token ON public.workers(qr_token);
CREATE INDEX idx_workers_matricule ON public.workers(matricule);
CREATE INDEX idx_workers_actif ON public.workers(actif);
CREATE INDEX idx_categories_actif ON public.categories(actif);