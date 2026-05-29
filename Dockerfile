# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies first (better layer cache)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY index.html server.js ./

# ── Runtime config ───────────────────────────────────────────────────────────
# NFS_BASE_PATH and PORT are injected at runtime via Nomad env stanza.
# Defaults:  PORT=3000  NFS_BASE_PATH=/nfs/whitelabels/theme_lab
ENV NODE_ENV=production \
    PORT=3000 \
    NFS_BASE_PATH=/nfs/whitelabels/theme_lab

EXPOSE 3000

# ── Security ─────────────────────────────────────────────────────────────────
# The `node` user (UID 1000) is built into node:alpine.
# The NFS export must grant write permission to UID 1000 (or whichever UID the
# cluster's NFS policy requires). If root_squash is active on the NFS server,
# ensure the NFS export has `anonuid=1000,anongid=1000` or that UID 1000 is
# mapped with write rights.
USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/health || exit 1

CMD ["node", "server.js"]
