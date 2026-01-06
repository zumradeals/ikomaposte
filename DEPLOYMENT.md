# 🚀 Guide de Déploiement - IKOMA Poste

Ce guide permet de déployer IKOMA Poste sur un VPS vierge avec Supabase self-host, **sans dépendance à Lovable Cloud**.

---

## 📋 Prérequis

- VPS Ubuntu 22.04+ (ou Debian 12+)
- Docker 24+ et Docker Compose v2
- Git
- Domaine configuré (ex: `poste.ikomadigit.com`)
- Ports 80/443 ouverts

---

## 1️⃣ Installation Docker (si absent)

```bash
# Installer Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Se reconnecter pour appliquer les permissions
exit
# Puis reconnecter

# Vérifier l'installation
docker --version
docker compose version
```

---

## 2️⃣ Installer Supabase Self-Host

### Option A : Installation rapide (recommandée)

```bash
# Créer le répertoire Supabase
mkdir -p ~/supabase && cd ~/supabase

# Cloner le repo officiel
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copier et configurer les variables
cp .env.example .env
nano .env  # Modifier les secrets (voir section Secrets ci-dessous)

# Démarrer Supabase
docker compose up -d
```

### Secrets à configurer dans `.env` Supabase :

```env
POSTGRES_PASSWORD=<mot-de-passe-fort>
JWT_SECRET=<clé-jwt-32-caractères-minimum>
ANON_KEY=<générer-avec-jwt-secret>
SERVICE_ROLE_KEY=<générer-avec-jwt-secret>
```

> 💡 Utilisez https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys pour générer les clés.

### Vérifier que Supabase fonctionne :

```bash
curl http://localhost:8000/rest/v1/
# Doit retourner un JSON (même vide)
```

---

## 3️⃣ Cloner IKOMA Poste

```bash
cd ~
git clone https://github.com/zumradeals/ikomaposte.git
cd ikomaposte
```

---

## 4️⃣ Configurer les Variables d'Environnement

```bash
# Copier le template
cp .env.example .env

# Éditer avec vos valeurs
nano .env
```

### Variables obligatoires :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | URL Supabase (Kong gateway) | `http://localhost:8000` ou `https://supabase.votredomaine.com` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key Supabase | `eyJhbGciOiJI...` |
| `SUPABASE_DB_URL` | URL PostgreSQL pour migrations | `postgresql://postgres:password@localhost:5432/postgres` |

---

## 5️⃣ Appliquer les Migrations

```bash
# Rendre le script exécutable
chmod +x scripts/migrate.sh

# Installer psql si absent
sudo apt install -y postgresql-client

# Exécuter les migrations
./scripts/migrate.sh
```

Le script :
- ✅ Vérifie la connexion PostgreSQL
- ✅ Crée une table de suivi `_migrations`
- ✅ Applique les migrations non-exécutées
- ✅ Est idempotent (peut être relancé sans risque)

---

## 6️⃣ Build et Démarrage

### Build de l'image Docker :

```bash
docker compose build
```

### Démarrer l'application :

```bash
docker compose up -d
```

### Vérifier le statut :

```bash
docker compose ps
docker compose logs -f web
```

---

## 7️⃣ Healthcheck

L'application expose un endpoint de santé :

```bash
curl http://localhost:80/
# ou
curl http://localhost:80/health
```

Réponse attendue : HTML de l'application ou JSON `{"status":"ok"}`

---

## 8️⃣ Reverse Proxy (Caddy)

### Installation Caddy :

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### Configuration Caddyfile :

```bash
sudo nano /etc/caddy/Caddyfile
```

```caddyfile
poste.ikomadigit.com {
    reverse_proxy localhost:80
}

# Optionnel : Supabase sur sous-domaine
supabase.ikomadigit.com {
    reverse_proxy localhost:8000
}
```

### Redémarrer Caddy :

```bash
sudo systemctl restart caddy
```

Caddy gère automatiquement les certificats SSL Let's Encrypt.

---

## 🔄 Mise à Jour

```bash
cd ~/ikomaposte
git pull origin main
docker compose build
docker compose up -d
./scripts/migrate.sh  # Si nouvelles migrations
```

---

## 🐛 Dépannage

### L'app ne démarre pas

```bash
docker compose logs web
```

### Erreur de connexion Supabase

1. Vérifier que Supabase tourne : `docker ps | grep supabase`
2. Vérifier l'URL dans `.env`
3. Tester la connexion : `curl $VITE_SUPABASE_URL/rest/v1/`

### Migrations échouent

1. Vérifier `SUPABASE_DB_URL` dans `.env`
2. Tester la connexion : `psql $SUPABASE_DB_URL -c "SELECT 1"`
3. Consulter les logs PostgreSQL : `docker logs supabase-db`

### Erreur 502 Bad Gateway

1. Vérifier que le conteneur tourne : `docker compose ps`
2. Vérifier le port dans `docker-compose.yml`
3. Vérifier Caddyfile pointe vers le bon port

---

## 📁 Structure du Projet

```
ikomaposte/
├── .env.example          # Template variables d'environnement
├── Dockerfile            # Build multi-stage (Node.js)
├── docker-compose.yml    # Orchestration conteneurs
├── server.js             # Serveur Node.js production
├── scripts/
│   ├── migrate.sh        # Script migrations SQL
│   ├── backup.sh         # Backup complet (DB + Storage)
│   └── seed.sql          # Données de test (DEV only)
├── migrations/           # Fichiers SQL versionnés pour self-host
│   ├── 0001_enums.sql    # Types enum (app_role, work_event_type, etc.)
│   ├── 0002_tables.sql   # Tables avec indexes
│   ├── 0003_functions.sql # Fonctions SQL (has_role, updated_at)
│   ├── 0004_triggers.sql # Triggers auto-update
│   ├── 0005_rls.sql      # Politiques Row Level Security
│   └── 0006_storage.sql  # Buckets Storage + policies
├── backups/              # Dossier créé par backup.sh
├── src/                  # Code source React/TypeScript
└── DEPLOYMENT.md         # Ce guide
```

---

## 🗄️ Backup & Restauration

### Créer un backup complet

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

Le script crée un dossier `backups/ikomaposte/<timestamp>/` contenant :
- `database.sql.gz` - Dump PostgreSQL compressé (schéma + données)
- `storage/` - Métadonnées des fichiers par bucket
- `manifest.json` - Infos du backup (date, commit git, version)

### Restaurer sur un autre VPS

```bash
# 1. Copier le dossier backup sur le nouveau serveur
scp -r backups/ikomaposte/20250105_120000/ user@new-server:~/

# 2. Sur le nouveau serveur, après avoir configuré Supabase
cd ~/20250105_120000
gunzip -c database.sql.gz | psql $SUPABASE_DB_URL

# 3. Restaurer les fichiers Storage depuis le volume Docker
# (copier le contenu du volume 'supabase_storage_data')
```

---

## 🧪 Données de Test (DEV)

Pour initialiser l'environnement de développement avec des données de test :

```bash
# Après les migrations
psql $SUPABASE_DB_URL -f scripts/seed.sql
```

⚠️ **NE PAS utiliser en production** - Le script refuse de s'exécuter si des données existent déjà.

Données créées :
- 4 catégories (Opérateur, Technicien, Superviseur, Stagiaire)
- 8 travailleurs avec QR tokens
- 5 kiosques/appareils
- Événements de travail sur 3 jours
- Résumés de travail calculés

---

## ✅ Checklist Finale

- [ ] Docker et Docker Compose installés
- [ ] Supabase self-host démarré et accessible
- [ ] `.env` configuré avec les bonnes valeurs
- [ ] Migrations appliquées sans erreur
- [ ] Application démarrée (`docker compose up -d`)
- [ ] Healthcheck OK (`curl localhost:80/`)
- [ ] Caddy configuré avec SSL
- [ ] Domaine accessible publiquement

---

## 📞 Support

Pour toute question, ouvrir une issue sur le dépôt GitHub.
