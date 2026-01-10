# ============================================
# IKOMA Deploy-Ready — node_server
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY bun.lockb* ./
RUN npm ci --legacy-peer-deps

COPY . .

# Build arguments for Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

RUN npm run build

# --- Production ---
FROM node:20-alpine AS production

WORKDIR /app

# Copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json

# Port configurable
ENV PORT=3000
EXPOSE 3000

# L'app DOIT fournir /health
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# L'app écoute sur 0.0.0.0:$PORT
CMD ["node", "server.js"]
