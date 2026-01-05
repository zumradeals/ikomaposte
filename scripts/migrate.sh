#!/bin/bash
# ===========================================
# IKOMA Poste - Script de migration Supabase
# ===========================================
# Usage: ./scripts/migrate.sh
# Applique toutes les migrations SQL sur Supabase self-host

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Charger .env si présent
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    log_info "Variables chargées depuis .env"
fi

# Vérifier SUPABASE_DB_URL
if [ -z "$SUPABASE_DB_URL" ]; then
    log_error "SUPABASE_DB_URL non définie. Définissez-la dans .env ou en variable d'environnement."
    log_info "Exemple: SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres"
    exit 1
fi

# Vérifier que PostgreSQL est accessible
log_info "Vérification de la connexion à PostgreSQL..."
if ! psql "$SUPABASE_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Impossible de se connecter à PostgreSQL."
    log_info "Vérifiez que Supabase est démarré: docker compose -f supabase/docker-compose.yml ps"
    exit 1
fi
log_info "Connexion PostgreSQL OK"

# Répertoire des migrations
MIGRATIONS_DIR="supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    log_warn "Aucun répertoire de migrations trouvé: $MIGRATIONS_DIR"
    exit 0
fi

# Créer la table de suivi des migrations si elle n'existe pas
log_info "Initialisation de la table de suivi des migrations..."
psql "$SUPABASE_DB_URL" <<EOF
CREATE TABLE IF NOT EXISTS public._migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);
EOF

# Appliquer chaque migration
MIGRATIONS_APPLIED=0
MIGRATIONS_SKIPPED=0

for migration in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    migration_name=$(basename "$migration")
    
    # Vérifier si déjà appliquée
    already_applied=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM public._migrations WHERE name = '$migration_name'" | tr -d ' ')
    
    if [ "$already_applied" -gt 0 ]; then
        log_info "⏭️  Déjà appliquée: $migration_name"
        ((MIGRATIONS_SKIPPED++))
        continue
    fi
    
    log_info "📦 Application: $migration_name"
    
    if psql "$SUPABASE_DB_URL" -f "$migration" > /dev/null 2>&1; then
        # Enregistrer la migration comme appliquée
        psql "$SUPABASE_DB_URL" -c "INSERT INTO public._migrations (name) VALUES ('$migration_name')" > /dev/null
        log_info "✅ Succès: $migration_name"
        ((MIGRATIONS_APPLIED++))
    else
        log_error "❌ Échec: $migration_name"
        log_info "Corrigez l'erreur et relancez le script."
        exit 1
    fi
done

echo ""
log_info "=== Résumé ==="
log_info "Migrations appliquées: $MIGRATIONS_APPLIED"
log_info "Migrations ignorées (déjà présentes): $MIGRATIONS_SKIPPED"
echo ""
log_info "✅ Migrations terminées avec succès!"
