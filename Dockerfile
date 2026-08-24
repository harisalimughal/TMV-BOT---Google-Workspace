# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
# npm ci, not npm install: the lockfile is present and builds must be reproducible.
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
# /ops dashboard server compiles against the same node_modules already installed above
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
