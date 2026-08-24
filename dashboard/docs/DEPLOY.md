# TMV Operations Dashboard (/ops) — Deployment & Runtime Guide

## 1. Overview & Isolation Guarantee

The **TMV Operations Dashboard** is mounted at `/ops` on the existing Express application. It executes strictly within the same single Node.js runtime container on Cloud Run (`PORT=8080`, concurrency pinned to 1).

- **Zero Bot Modifications:** No existing handlers, webhooks, or workflow engine files were altered.
- **Authentication:** Reuses `requireAdminSession` from `src/admin/admin.auth.ts`. Session cookies issued at `/admin/login` work seamlessly on `/ops`.
- **Read-Only Data Layer:** Strictly no write paths to Google Sheets from the dashboard.
- **SWR Caching:** Batched reads with in-memory Stale-While-Revalidate caching ensure queries return in <5ms and never delay Google Chat webhooks.

---

## 2. Docker Multi-Stage Build

The root `Dockerfile` includes the additive `web-build` stage:

```dockerfile
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
COPY --from=web-build /app/dashboard/web/dist ./dashboard/web/dist
COPY package.json ./
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/server.js"]
```

---

## 3. Environment Variables

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `TMV_DASHBOARD_CACHE_TTL_MS` | Integer | `30000` | SWR cache duration for sheet batch reads (ms) |
| `TMV_DASHBOARD_RATE_LIMIT_WINDOW_MS` | Integer | `60000` | Sliding rate limit window (ms) |
| `TMV_DASHBOARD_RATE_LIMIT_MAX` | Integer | `120` | Maximum requests per IP per window |
| `TMV_ADMIN_PASSWORD` | String | *Required* | Shared admin login password |
| `TMV_SIGNATURE_LINK_SECRET` | String | *Required* | HMAC secret used to sign session cookies |

---

## 4. Verification Quality Gates

1. **Root Typecheck & Tests:**
   ```bash
   npm run typecheck && npm test
   ```
2. **Dashboard Server Tests:**
   ```bash
   npm run dashboard:test
   ```
3. **Frontend Build:**
   ```bash
   npm run dashboard:build
   ```
