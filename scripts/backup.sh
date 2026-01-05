#!/bin/bash
# ===========================================
# IKOMA Poste - Script de backup complet
# ===========================================
# Usage: ./scripts/backup.sh [app_id]
# Crée un backup complet (DB + Storage + manifest)
# Restaurable sur tout VPS avec Supabase self-host

set -e

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Configuration
APP_ID="${1:-ikomaposte}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups/${APP_ID}/${TIMESTAMP}"

# Charger .env si présent
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    log_info "Variables chargées depuis .env"
fi

# Vérifier les variables requises
if [ -z "$SUPABASE_DB_URL" ]; then
    log_error "SUPABASE_DB_URL non définie."
    log_info "Format attendu: postgresql://postgres:password@localhost:5432/postgres"
    exit 1
fi

# Extraire les composants de l'URL pour le storage
# Format: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$SUPABASE_DB_URL" | sed -E 's/.*@([^:]+):.*/\1/')
STORAGE_URL="${SUPABASE_STORAGE_URL:-http://${DB_HOST}:8000}"

log_info "=== Backup IKOMA Poste ==="
log_info "App ID: $APP_ID"
log_info "Timestamp: $TIMESTAMP"
log_info "Destination: $BACKUP_DIR"

# Créer la structure de dossiers
mkdir -p "$BACKUP_DIR/storage"

# ===========================================
# 1. Vérification des connexions
# ===========================================
log_step "1/4 - Vérification des connexions..."

# Test PostgreSQL
if ! psql "$SUPABASE_DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    log_error "❌ PostgreSQL inaccessible."
    log_info "Vérifiez que Supabase est démarré et SUPABASE_DB_URL est correct."
    exit 1
fi
log_info "✅ PostgreSQL accessible"

# Test Storage (optionnel - on continue même si indisponible)
STORAGE_AVAILABLE=true
if ! curl -sf "${STORAGE_URL}/storage/v1/bucket" > /dev/null 2>&1; then
    log_warn "⚠️  Storage API non accessible à ${STORAGE_URL}"
    log_warn "   Les fichiers Storage ne seront pas sauvegardés."
    STORAGE_AVAILABLE=false
else
    log_info "✅ Storage API accessible"
fi

# ===========================================
# 2. Dump PostgreSQL
# ===========================================
log_step "2/4 - Dump PostgreSQL (schéma + données)..."

DUMP_FILE="$BACKUP_DIR/database.sql.gz"

# Dump complet avec schéma et données
if pg_dump "$SUPABASE_DB_URL" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --exclude-schema=supabase_functions \
    --exclude-schema=supabase_migrations \
    --exclude-schema=extensions \
    --exclude-schema=graphql \
    --exclude-schema=graphql_public \
    --exclude-schema=net \
    --exclude-schema=pgsodium \
    --exclude-schema=pgsodium_masks \
    --exclude-schema=realtime \
    --exclude-schema=vault \
    | gzip > "$DUMP_FILE"; then
    
    DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    log_info "✅ Dump créé: $DUMP_FILE ($DUMP_SIZE)"
else
    log_error "❌ Échec du dump PostgreSQL"
    exit 1
fi

# ===========================================
# 3. Export Supabase Storage
# ===========================================
log_step "3/4 - Export Supabase Storage..."

if [ "$STORAGE_AVAILABLE" = true ]; then
    # Récupérer la liste des buckets
    BUCKETS=$(psql "$SUPABASE_DB_URL" -t -c "SELECT id FROM storage.buckets" 2>/dev/null | tr -d ' ' | grep -v '^$')
    
    if [ -n "$BUCKETS" ]; then
        for bucket in $BUCKETS; do
            log_info "📦 Export bucket: $bucket"
            BUCKET_DIR="$BACKUP_DIR/storage/$bucket"
            mkdir -p "$BUCKET_DIR"
            
            # Récupérer les métadonnées des objets
            psql "$SUPABASE_DB_URL" -t -A -F'|' -c "
                SELECT name, bucket_id, created_at, updated_at, metadata
                FROM storage.objects
                WHERE bucket_id = '$bucket'
            " > "$BUCKET_DIR/_metadata.csv" 2>/dev/null || true
            
            # Compter les fichiers
            FILE_COUNT=$(wc -l < "$BUCKET_DIR/_metadata.csv" | tr -d ' ')
            log_info "   → $FILE_COUNT fichiers référencés"
            
            # Note: Le téléchargement réel des fichiers nécessite l'API Storage
            # avec authentification. On sauvegarde les métadonnées pour permettre
            # une restauration manuelle ou via script avec les bons credentials.
        done
        
        log_info "✅ Métadonnées Storage exportées"
        log_warn "   Note: Les fichiers binaires doivent être copiés depuis"
        log_warn "   le volume Docker 'supabase_storage_data' pour un backup complet."
    else
        log_info "Aucun bucket Storage trouvé"
    fi
else
    log_warn "⏭️  Storage ignoré (API non accessible)"
    echo "STORAGE_SKIPPED=true" > "$BACKUP_DIR/storage/_status.txt"
fi

# ===========================================
# 4. Création du manifest
# ===========================================
log_step "4/4 - Création du manifest..."

# Récupérer les infos git
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
GIT_TAG=$(git describe --tags --always 2>/dev/null || echo "none")

# Récupérer la version depuis package.json si disponible
APP_VERSION=$(grep -o '"version": *"[^"]*"' package.json 2>/dev/null | head -1 | cut -d'"' -f4 || echo "0.0.0")

# Compter les tables et lignes
TABLE_STATS=$(psql "$SUPABASE_DB_URL" -t -A -F',' -c "
    SELECT 
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as tables,
        (SELECT COALESCE(SUM(n_tup_ins - n_tup_del), 0) FROM pg_stat_user_tables WHERE schemaname = 'public') as rows
" 2>/dev/null || echo "0,0")

TABLE_COUNT=$(echo "$TABLE_STATS" | cut -d',' -f1)
ROW_COUNT=$(echo "$TABLE_STATS" | cut -d',' -f2)

# Créer le manifest JSON
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "backup": {
    "app_id": "$APP_ID",
    "timestamp": "$TIMESTAMP",
    "created_at": "$(date -Iseconds)",
    "created_by": "$(whoami)@$(hostname)"
  },
  "git": {
    "commit": "$GIT_COMMIT",
    "branch": "$GIT_BRANCH",
    "tag": "$GIT_TAG"
  },
  "app": {
    "version": "$APP_VERSION"
  },
  "database": {
    "dump_file": "database.sql.gz",
    "tables_count": $TABLE_COUNT,
    "estimated_rows": $ROW_COUNT
  },
  "storage": {
    "available": $STORAGE_AVAILABLE,
    "buckets": [$(echo "$BUCKETS" | sed 's/^/"/' | sed 's/$/"/' | tr '\n' ',' | sed 's/,$//' || echo "")]
  },
  "restore_instructions": {
    "database": "gunzip -c database.sql.gz | psql $SUPABASE_DB_URL",
    "storage": "Copier les fichiers depuis le volume Docker ou utiliser l'API Storage"
  }
}
EOF

log_info "✅ Manifest créé: $BACKUP_DIR/manifest.json"

# ===========================================
# Résumé final
# ===========================================
echo ""
log_info "=========================================="
log_info "✅ BACKUP TERMINÉ AVEC SUCCÈS"
log_info "=========================================="
log_info "Emplacement: $BACKUP_DIR"
log_info "Contenu:"
ls -lh "$BACKUP_DIR" | tail -n +2 | while read line; do
    echo "   $line"
done

echo ""
log_info "Pour restaurer sur un autre VPS:"
log_info "  1. Copier le dossier $BACKUP_DIR"
log_info "  2. Décompresser: gunzip -c database.sql.gz | psql \$SUPABASE_DB_URL"
log_info "  3. Restaurer le storage depuis les volumes Docker"

# Créer un lien symbolique vers le dernier backup
LATEST_LINK="backups/${APP_ID}/latest"
rm -f "$LATEST_LINK"
ln -s "$TIMESTAMP" "$LATEST_LINK"
log_info "Lien 'latest' mis à jour: $LATEST_LINK"
