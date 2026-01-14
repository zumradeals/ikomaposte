-- ============================================
-- IKOMA POSTE - Admin Security Tables
-- ============================================

-- Table: admin_secrets (stockage sécurisé des PIN hashés)
CREATE TABLE public.admin_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global', -- 'global', 'site:<id>', 'device:<id>'
  pin_hash TEXT NOT NULL, -- bcrypt hash
  is_active BOOLEAN NOT NULL DEFAULT true,
  rotated_at TIMESTAMPTZ,
  rotated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index pour recherche rapide du PIN actif
CREATE INDEX idx_admin_secrets_active ON public.admin_secrets(scope, is_active) WHERE is_active = true;

-- Table: admin_audit (traces de tentatives de connexion)
CREATE TABLE public.admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  event TEXT NOT NULL, -- ADMIN_LOGIN_ATTEMPT, ADMIN_LOGIN_SUCCESS, ADMIN_LOGIN_FAIL, ADMIN_LOGOUT
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour recherche par date et device
CREATE INDEX idx_admin_audit_created ON public.admin_audit(created_at DESC);
CREATE INDEX idx_admin_audit_device ON public.admin_audit(device_id, created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.admin_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

-- admin_secrets: AUCUN accès client direct (même pas en lecture)
-- Seul le service_role ou edge function peut lire
-- Note: Pas de policy = accès refusé par défaut avec RLS activé

-- admin_audit: Lecture admin seulement
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- admin_audit: Insert autorisé anonyme (via edge function service_role uniquement)
-- Pas de policy INSERT = refusé côté client, mais service_role peut insérer

-- ============================================
-- PIN initial sécurisé (hash bcrypt de "1234" pour migration)
-- Ce hash sera remplacé lors de la première rotation
-- Hash généré avec bcrypt cost 10
-- ============================================
-- Note: L'insertion du PIN initial se fait via l'edge function ou seed sécurisé
-- On ne met PAS le hash en clair dans la migration publique