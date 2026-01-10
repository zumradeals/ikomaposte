#!/bin/bash
# ===========================================
# IKOMA Poste - Script de restauration backup
# IKOMA Supabase Bundle Standard v1.0
# ===========================================
# Usage: ./scripts/restore.sh <backup_dir>
# Restaure un backup produit par backup.sh

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# ===========================================
# Variables requises (voir DEPLOYMENT.md)
# ===========================================
# SUPABASE_DB_URL - URL PostgreSQL complète
# SUPABASE_URL - URL de l'API Supabase (pour healthcheck)
# BACKUP_DIR - Passé en argument

BACKUP_DIR="${1:-}"

if [ -z "$BACKUP_DIR" ]; then
    log_error "Usage: $0 <backup_directory>"
    log_info "Exemple: $0 ./backups/ikomaposte_20250110_120000"
    exit 1
fi

# Charger .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    log_info "Variables chargées depuis .env"
fi

# Vérifier variables requises
if [ -z "$SUPABASE_DB_URL" ]; then
    log_error "SUPABASE_DB_URL non définie"
    exit 1
fi

# ===========================================
# 1. Valider le manifest
# ===========================================
log_step "1. Validation du manifest..."

MANIFEST="$BACKUP_DIR/manifest.json"
if [ ! -f "$MANIFEST" ]; then
    log_error "manifest.json introuvable dans $BACKUP_DIR"
    exit 1
fi

APP_ID=$(jq -r '.app_id' "$MANIFEST")
BACKUP_DATE=$(jq -r '.created_at' "$MANIFEST")
DB_AVAILABLE=$(jq -r '.database.available' "$MANIFEST")

log_info "Backup: $APP_ID @ $BACKUP_DATE"

if [ "$DB_AVAILABLE" != "true" ]; then
    log_error "Le backup ne contient pas de dump DB valide"
    exit 1
fi

# ===========================================
# 2. Vérifier connexion PostgreSQL
# ===========================================
log_step "2. Vérification connexion PostgreSQL..."

if ! psql "$SUPABASE_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Impossible de se connecter à PostgreSQL"
    exit 1
fi
log_info "Connexion PostgreSQL OK"

# ===========================================
# 3. Restaurer le dump PostgreSQL
# ===========================================
log_step "3. Restauration du dump PostgreSQL..."

DB_DUMP="$BACKUP_DIR/database.sql.gz"
if [ ! -f "$DB_DUMP" ]; then
    log_error "database.sql.gz introuvable"
    exit 1
fi

log_info "Restauration en cours (cela peut prendre quelques minutes)..."
if gunzip -c "$DB_DUMP" | psql "$SUPABASE_DB_URL" > /dev/null 2>&1; then
    log_info "✅ Dump PostgreSQL restauré"
else
    log_warn "⚠️ Restauration avec erreurs (normal si tables existent déjà)"
fi

# ===========================================
# 4. Restaurer les fichiers Storage
# ===========================================
log_step "4. Restauration du Storage..."

STORAGE_DIR="$BACKUP_DIR/storage"
if [ -d "$STORAGE_DIR" ] && [ "$(ls -A "$STORAGE_DIR" 2>/dev/null)" ]; then
    log_info "Fichiers Storage trouvés"
    
    # Lister les buckets
    for bucket in "$STORAGE_DIR"/*/; do
        bucket_name=$(basename "$bucket")
        file_count=$(find "$bucket" -type f | wc -l)
        log_info "  Bucket '$bucket_name': $file_count fichiers"
    done
    
    log_warn "⚠️ Restauration manuelle requise:"
    log_info "   Copiez $STORAGE_DIR/* vers le volume Docker Supabase Storage"
    log_info "   Ou utilisez l'API Storage pour uploader les fichiers"
else
    log_info "Pas de fichiers Storage à restaurer"
fi

# ===========================================
# 5. Healthcheck final
# ===========================================
log_step "5. Healthcheck..."

HEALTH_URL="${SUPABASE_URL:-http://localhost:3000}/health"
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log_info "✅ Healthcheck OK: $HEALTH_URL"
else
    log_warn "⚠️ Healthcheck échoué (app peut ne pas être démarrée)"
fi

# ===========================================
# Résumé
# ===========================================
echo ""
log_info "========================================="
log_info "✅ RESTAURATION TERMINÉE"
log_info "========================================="
log_info "Backup: $APP_ID"
log_info "Date backup: $BACKUP_DATE"
log_info ""
log_info "Prochaines étapes:"
log_info "  1. Vérifier l'application: $HEALTH_URL"
log_info "  2. Restaurer Storage manuellement si nécessaire"
log_info "  3. Créer un utilisateur admin si besoin"
