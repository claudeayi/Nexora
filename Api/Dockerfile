# syntax=docker/dockerfile:1

############################
# Stage 1: deps + Prisma
############################
FROM node:18-alpine AS deps
WORKDIR /app

# Librairies nécessaires pour Prisma sur Alpine
RUN apk add --no-cache openssl libc6-compat

# Install prod deps (reproductible si package-lock.json présent)
COPY package*.json ./
RUN npm ci --only=production

# Génération du client Prisma (nécessite le schéma)
COPY prisma ./prisma
RUN npx prisma generate

############################
# Stage 2: runner
############################
FROM node:18-alpine AS runner
WORKDIR /app

# Librairies runtime pour Prisma
RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=4000

# Exécuter en utilisateur non-root
USER node

# Dépendances + Prisma client généré
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=deps /app/prisma ./prisma

# Code applicatif (doit contenir app.js + routes/ + lib/ etc.)
COPY --chown=node:node . .

EXPOSE 4000

# Healthcheck basique (nécessite la route /healthz)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "app.js"]
