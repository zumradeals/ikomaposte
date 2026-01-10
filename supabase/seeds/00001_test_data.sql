-- Seed: 00001_test_data.sql
-- Description: Test data for development environment ONLY
-- Author: IKOMA Generator
-- Date: 2025-01-10
-- IKOMA Supabase Bundle Standard v1.0
-- ⚠️  NE PAS UTILISER EN PRODUCTION

-- Vérification: empêcher l'exécution accidentelle en prod
DO $$
BEGIN
    -- Vérifier si des données existent déjà
    IF EXISTS (SELECT 1 FROM public.workers LIMIT 1) THEN
        RAISE NOTICE '⚠️  Des données existent déjà. Seed ignoré.';
        RAISE EXCEPTION 'SEED_ABORTED: Base non vide. Utilisez --force pour écraser.' 
            USING HINT = 'Videz les tables ou utilisez une base de test';
    END IF;
END $$;

-- ============================================
-- Catégories de travailleurs
-- ============================================
INSERT INTO public.categories (id, nom, taux_horaire, devise, actif) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Opérateur', 1500, 'XOF', true),
    ('22222222-2222-2222-2222-222222222222', 'Technicien', 2500, 'XOF', true),
    ('33333333-3333-3333-3333-333333333333', 'Superviseur', 4000, 'XOF', true),
    ('44444444-4444-4444-4444-444444444444', 'Stagiaire', 750, 'XOF', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Travailleurs de test
-- ============================================
INSERT INTO public.workers (id, matricule, nom_affiche, category_id, qr_token, actif) VALUES
    ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OP-001', 'Mamadou Diallo', '11111111-1111-1111-1111-111111111111', 'QR_MAMADOU_001', true),
    ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OP-002', 'Fatou Sow', '11111111-1111-1111-1111-111111111111', 'QR_FATOU_002', true),
    ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OP-003', 'Ousmane Ba', '11111111-1111-1111-1111-111111111111', 'QR_OUSMANE_003', true),
    ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TC-001', 'Ibrahima Ndiaye', '22222222-2222-2222-2222-222222222222', 'QR_IBRAHIMA_004', true),
    ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'TC-002', 'Aminata Fall', '22222222-2222-2222-2222-222222222222', 'QR_AMINATA_005', true),
    ('cccc1111-cccc-cccc-cccc-cccccccccccc', 'SV-001', 'Cheikh Mbaye', '33333333-3333-3333-3333-333333333333', 'QR_CHEIKH_006', true),
    ('dddd1111-dddd-dddd-dddd-dddddddddddd', 'ST-001', 'Aissatou Diop', '44444444-4444-4444-4444-444444444444', 'QR_AISSATOU_007', true),
    ('dddd2222-dddd-dddd-dddd-dddddddddddd', 'OP-004', 'Modou Gueye', '11111111-1111-1111-1111-111111111111', 'QR_MODOU_008', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Appareils/Kiosques de test
-- ============================================
INSERT INTO public.devices (id, device_id, device_secret, label, site_id, actif) VALUES
    ('dev11111-1111-1111-1111-111111111111', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'Kiosque Entrée Principale', 'SITE-A', true),
    ('dev22222-2222-2222-2222-222222222222', 'KIOSK-ATELIER-01', 'secret_atelier_01_dev', 'Kiosque Atelier 1', 'SITE-A', true),
    ('dev33333-3333-3333-3333-333333333333', 'KIOSK-ATELIER-02', 'secret_atelier_02_dev', 'Kiosque Atelier 2', 'SITE-A', true),
    ('dev44444-4444-4444-4444-444444444444', 'KIOSK-SORTIE-01', 'secret_sortie_01_dev', 'Kiosque Sortie', 'SITE-A', true),
    ('dev55555-5555-5555-5555-555555555555', 'KIOSK-TEST', 'secret_test_dev', 'Kiosque de Test', 'SITE-TEST', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Événements de travail (exemple sur 3 jours)
-- ============================================

-- Jour 1: Hier - Journée complète pour Mamadou
INSERT INTO public.work_events (id, worker_id, device_id, device_secret, event_type, occurred_at, trust_status) VALUES
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '1 day' + INTERVAL '8 hours', 'trusted'),
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ATELIER-01', 'secret_atelier_01_dev', 'PAUSE', NOW() - INTERVAL '1 day' + INTERVAL '12 hours', 'trusted'),
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ATELIER-01', 'secret_atelier_01_dev', 'RESUME', NOW() - INTERVAL '1 day' + INTERVAL '13 hours', 'trusted'),
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-SORTIE-01', 'secret_sortie_01_dev', 'END', NOW() - INTERVAL '1 day' + INTERVAL '17 hours', 'trusted')
ON CONFLICT DO NOTHING;

-- Jour 1: Hier - Fatou (sans pause)
INSERT INTO public.work_events (id, worker_id, device_id, device_secret, event_type, occurred_at, trust_status) VALUES
    (gen_random_uuid(), 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '1 day' + INTERVAL '8 hours 15 minutes', 'trusted'),
    (gen_random_uuid(), 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-SORTIE-01', 'secret_sortie_01_dev', 'END', NOW() - INTERVAL '1 day' + INTERVAL '16 hours 30 minutes', 'trusted')
ON CONFLICT DO NOTHING;

-- Jour 2: Avant-hier - Mamadou demi-journée
INSERT INTO public.work_events (id, worker_id, device_id, device_secret, event_type, occurred_at, trust_status) VALUES
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', 'trusted'),
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-SORTIE-01', 'secret_sortie_01_dev', 'END', NOW() - INTERVAL '2 days' + INTERVAL '12 hours', 'trusted')
ON CONFLICT DO NOTHING;

-- Jour 3: Aujourd'hui - Plusieurs travailleurs actifs (sans END)
INSERT INTO public.work_events (id, worker_id, device_id, device_secret, event_type, occurred_at, trust_status) VALUES
    (gen_random_uuid(), 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '3 hours', 'trusted'),
    (gen_random_uuid(), 'aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '2 hours 45 minutes', 'trusted'),
    (gen_random_uuid(), 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '2 hours 30 minutes', 'trusted'),
    (gen_random_uuid(), 'cccc1111-cccc-cccc-cccc-cccccccccccc', 'KIOSK-ENTREE-01', 'secret_entree_01_dev', 'TAKE', NOW() - INTERVAL '2 hours', 'trusted')
ON CONFLICT DO NOTHING;

-- ============================================
-- Résumé
-- ============================================
DO $$
DECLARE
    cat_count INTEGER;
    worker_count INTEGER;
    device_count INTEGER;
    event_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO cat_count FROM public.categories;
    SELECT COUNT(*) INTO worker_count FROM public.workers;
    SELECT COUNT(*) INTO device_count FROM public.devices;
    SELECT COUNT(*) INTO event_count FROM public.work_events;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ SEED TERMINÉ';
    RAISE NOTICE '   Catégories: %', cat_count;
    RAISE NOTICE '   Travailleurs: %', worker_count;
    RAISE NOTICE '   Appareils: %', device_count;
    RAISE NOTICE '   Événements: %', event_count;
    RAISE NOTICE '';
    RAISE NOTICE '🔐 QR Tokens de test:';
    RAISE NOTICE '   Mamadou: QR_MAMADOU_001';
    RAISE NOTICE '   Fatou: QR_FATOU_002';
    RAISE NOTICE '   Ousmane: QR_OUSMANE_003';
END $$;
