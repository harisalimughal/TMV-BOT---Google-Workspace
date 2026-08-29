# node:24-slim for this stage only, not 22: adding the mongodb driver regenerated
# package-lock.json under npm 11 (Node 24's bundled npm) locally; npm 10 (Node 22's
# bundled npm) resolves some of its transitive deps (gcp-metadata, gaxios,
# google-logging-utils, pulled in via googleapis/google-auth-library) differently and
# rejects the lockfile as out of sync under `npm ci`. The runtime stage below
# deliberately stays on node:22-slim -- Node 24's OpenSSL fails the TLS handshake
# against MongoDB Atlas from inside a container (see tmv-pwa's Dockerfile, which hit
# the identical pair of issues first). None of the runtime deps have native bindings,
# so copying node_modules built under 24 into a 22 runtime is safe.
# ---- build ----
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
# npm ci, not npm install: the lockfile is present and builds must be reproducible.
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# /admin dashboard server compiles against the same node_modules already installed above
# (dashboard/package.json has no lockfile of its own and its only runtime dep, luxon, is
# already a root dependency). Must land at dashboard/dist/dashboard/server/... to match
# the require() path server.ts falls back to when dashboard/dist isn't pre-built.
COPY dashboard/tsconfig.json ./dashboard/tsconfig.json
COPY dashboard/server ./dashboard/server
RUN npx tsc -p dashboard/tsconfig.json
RUN npm prune --omit=dev

# ---- dashboard-web build ----
FROM node:22-slim AS web-build
WORKDIR /app/dashboard/web
COPY dashboard/web/package*.json ./
RUN npm ci
COPY dashboard/web ./
RUN npm run build

# ---- runtime ----
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dashboard/dist ./dashboard/dist
COPY --from=web-build /app/dashboard/web/dist ./dashboard/web/dist
COPY package.json ./
# Drop root.
USER node
EXPOSE 8080
# --enable-source-maps makes stack traces point at .ts lines.
CMD ["node", "--enable-source-maps", "dist/server.js"]
