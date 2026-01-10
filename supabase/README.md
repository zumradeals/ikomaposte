# IKOMA Poste - Supabase Bundle

> **IKOMA Supabase Bundle Standard v1.0**

## 📋 Tables

| Table | Description | RLS |
|-------|-------------|-----|
| `categories` | Catégories de travailleurs avec taux horaires | ✅ Public read, Admin write |
| `workers` | Employés avec QR tokens | ✅ Public read, Admin write |
| `devices` | Kiosques de pointage autorisés | ✅ Public read, Admin write |
| `work_events` | Événements TAKE/PAUSE/RESUME/END | ✅ Public read, Kiosk insert |
| `work_summaries` | Résumés quotidiens calculés | ✅ Admin only |
| `correction_events` | Corrections d'anomalies | ✅ Admin only |
| `user_roles` | Rôles applicatifs (admin/user) | ✅ User own roles |

## 🔐 Security

- **RLS activé** sur toutes les tables
- **SECURITY DEFINER** function `has_role()` pour éviter la récursion RLS
- Les kiosques peuvent insérer des `work_events` sans authentification
- Les admins ont accès complet via le rôle `admin` dans `user_roles`

## 📦 Storage Buckets

| Bucket | Public | Description |
|--------|--------|-------------|
| `worker-photos` | ✅ | Photos de profil des employés |
| `work-snapshots` | ❌ | Captures lors du pointage |

## 🚀 Deployment

Le bundle est géré automatiquement par IKOMA Platform via `ikoma.json`.

### Manuel (self-host)

```bash
# Appliquer les migrations
./scripts/migrate.sh

# Seeds (dev only)
psql $SUPABASE_DB_URL -f supabase/seeds/00001_test_data.sql
```

## 📁 Structure

> ⚠️ Note: Les migrations sont dans `migrations/` à la racine (pas dans `supabase/migrations/`) pour la portabilité self-host.

```
/
├── migrations/                  # Source de vérité pour self-host
│   ├── 0001_enums.sql          # Types enum
│   ├── 0002_tables.sql         # Tables et indexes
│   ├── 0003_functions.sql      # Fonctions SQL
│   ├── 0004_triggers.sql       # Triggers updated_at
│   ├── 0005_rls.sql            # RLS et policies
│   └── 0006_storage.sql        # Buckets storage
├── supabase/
│   ├── seeds/
│   │   └── 00001_test_data.sql # Données de test (dev)
│   ├── config.toml             # Configuration Supabase
│   └── README.md               # Ce fichier
├── scripts/
│   ├── migrate.sh              # Script d'application des migrations
│   ├── backup.sh               # Backup DB + Storage
│   └── seed.sql                # Alias vers seeds
└── ikoma.json                  # Manifest IKOMA
```

## 🔄 Enums

| Enum | Values |
|------|--------|
| `app_role` | admin, moderator, user |
| `work_event_type` | TAKE, PAUSE, RESUME, END |
| `anomaly_type` | missing_end, missing_take, duplicate_take, ... |
| `correction_action` | add_virtual_event, ignore_event, adjust_time, ... |

---

> **IKOMA Supabase Bundle Standard v1.0** — Compatible self-host et Supabase Cloud
