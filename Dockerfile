# syntax=docker/dockerfile:1

# Debian 12/13 ship unfixed glibc/zlib advisories, so the whole image chain is
# built on Alpine 3.24, whose current packages have no known advisories.
# Building on Alpine also compiles better-sqlite3 against musl, so the native
# addon matches the runtime it is copied into.

FROM node:24-alpine3.24 AS deps
WORKDIR /app
RUN apk upgrade --no-cache \
 && apk add --no-cache python3 make g++ linux-headers
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine3.24 AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine3.24 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data

# Apply distro security updates before dropping privileges.
# Keep an (empty) /var/cache/apk directory: image scanners read that path to
# enumerate installed apk packages and fail when it is absent.
RUN apk upgrade --no-cache \
 && apk add --no-cache ca-certificates \
 && rm -rf /var/cache/apk/* \
 && mkdir -p /var/cache/apk /data \
 && chown node:node /data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server.js"]
