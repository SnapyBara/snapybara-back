# ==========================================
# MULTI-STAGE DOCKERFILE POUR NESTJS
# ==========================================

ARG NODE_VERSION=20

# ==========================================
# STAGE 1: Base image avec outils système
# ==========================================
FROM node:${NODE_VERSION}-alpine AS base

# Métadonnées
LABEL maintainer="votre-email@example.com"
LABEL description="NestJS API with MongoDB, Redis, Supabase"
LABEL version="1.0.0"

# Installation des dépendances système
RUN apk add --no-cache \
    dumb-init \
    curl \
    tzdata \
    && rm -rf /var/cache/apk/*

# Configuration utilisateur non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Configuration timezone
ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Variables d'environnement
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

WORKDIR /usr/src/app

# ==========================================
# STAGE 2: Installation des dépendances
# ==========================================
FROM base AS dependencies

# Configuration npm pour optimisation
RUN npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-retries 3

# Copie des fichiers de dépendances depuis le contexte backend
COPY package*.json ./
COPY yarn.lock* ./

# Installation des dépendances avec cache
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.yarn \
    if [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile --production=false; \
    else \
        npm ci --include=dev; \
    fi

# ==========================================
# STAGE 3: Build de l'application
# ==========================================
FROM dependencies AS build

# Copie du code source
COPY . .

# Build de l'application
RUN npm run build

# Nettoyage des dev dependencies
RUN --mount=type=cache,target=/root/.npm \
    if [ -f yarn.lock ]; then \
        yarn install --frozen-lockfile --production=true && yarn cache clean; \
    else \
        npm ci --omit=dev && npm cache clean --force; \
    fi

# ==========================================
# STAGE 4: Production finale
# ==========================================
FROM base AS production

# Installation de curl pour health checks
RUN apk add --no-cache curl

# Copie des fichiers nécessaires depuis le stage build
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /usr/src/app/package*.json ./

# Création des dossiers avec permissions
RUN mkdir -p uploads logs tmp && \
    chown -R nestjs:nodejs uploads logs tmp

# Configuration sécurité
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Exposition du port
EXPOSE 3000

# Point d'entrée avec dumb-init pour gestion signaux
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

# ==========================================
# STAGE 5: Développement (avec hot reload)
# ==========================================
FROM dependencies AS development

# Installation des outils de développement
RUN apk add --no-cache git

# Variables d'environnement développement
ENV NODE_ENV=development

# Copie du code source
COPY . .

# Permissions pour hot reload
RUN chown -R nestjs:nodejs /usr/src/app

USER nestjs

# Health check pour développement
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
EXPOSE 9229

# Mode développement avec hot reload
CMD ["npm", "run", "start:dev"]

# ==========================================
# STAGE 6: Tests
# ==========================================
FROM dependencies AS test

# Installation des dépendances de test
COPY . .

# Variables d'environnement test
ENV NODE_ENV=test

USER nestjs

# Commande par défaut pour les tests
CMD ["npm", "run", "test"]