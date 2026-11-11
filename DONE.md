# Done

Completed tasks for the Homelab Dashboard. Newest first. Pending work is in [PENDING.md](PENDING.md).

---

## 2026-11-11 (M1: Auth + base layout)

- [x] Server: `cookie-parser`, `jsonwebtoken`, `bcryptjs` (pure JS, no native build on Windows), `express-rate-limit`, `zod`
- [x] Server: `User` model (password hash never returned), `npm run create-admin` script (random password when none given)
- [x] Server: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` with JWT in an httpOnly, SameSite=strict cookie
- [x] Server: `requireAuth` and `requireRole` middleware, `validateBody` (zod), `HttpError`, login rate limit (5 failed tries / 15 min), timing-safe login
- [x] Server: `JWT_SECRET` added to `.env.example` and generated in local `server/.env`
- [x] Server: dev mode switched to `nodemon` (Node's `--watch` restarted on `node_modules` changes on Windows, causing 502s)
- [x] Client: auth feature (`api.js`, `queryKeys.js`, `session.js`, `useMe`, `useLogin`, `useLogout`), global 401 handling in `QueryClient`
- [x] Client: React Router with `RequireAuth` guard (returns to the requested page after login)
- [x] Client: Login page (shadcn `card`, `field`, `input`), field-level and general errors
- [x] Client: `AppLayout` with shadcn `sidebar` (collapsible, mobile sheet), topbar, user menu with logout
- [x] Client: common components `PageHeader`, `StatusBadge`, `StatCard`, `EmptyState`, `ErrorState`, `ThemeToggle`, `ThemeProvider`
- [x] Client: replaced `next-themes` with our own `ThemeProvider` (removed a React 19 console error), no theme flash on load
- [x] Client: Overview page (summary cards, live system status), placeholder pages for all other routes, 404 page
- [x] Verified: server auth with curl (no login, bad input, wrong password, login, me, logout, duplicate admin), lint in all packages, client build, and a headless Chrome test with 15/15 checks passing (redirects, login errors, navigation, theme switch and persistence, mobile layout, logout, no console errors)

## 2026-11-11 (M0 setup)

- [x] Initialized Git (`main` branch), root `.gitignore` (`node_modules`, `.env`, build output, `Agent.md/`), Prettier config
- [x] `client/`: Vite 8 + React 19 + Tailwind CSS 4, `@/` path alias, dev proxy for `/api` and `/socket.io` to port 4000
- [x] `client/`: shadcn/ui initialized (Radix, Nova preset, dark theme by default) + status color tokens (`success`, `warning`, `danger`, `info`)
- [x] `client/`: shadcn components added: `button`, `card`, `badge`, `input`, `label`, `field` (replaces the old `form`), `dialog`, `alert-dialog`, `dropdown-menu`, `sidebar`, `sheet`, `skeleton`, `sonner`, `tooltip`, `tabs`, `table`, `progress`, `chart`, `separator`
- [x] `client/`: TanStack Query + Devtools, TanStack Table, React Router installed
- [x] `client/`: shared fetch client (`api/client.js`), `QueryClient` with no retries on 4xx, providers in `main.jsx`
- [x] `client/`: `health` feature (api, query keys, `useHealth` hook) and a temporary M0 status page
- [x] `server/`: Express 5 + Mongoose 9 + helmet + CORS, env validation, DB connection, `/api/health`, 404 and error handlers, graceful shutdown
- [x] `agent/`: package skeleton with config validation
- [x] `.env.example` for server and agent (local `server/.env` created from it, no secrets)
- [x] MongoDB: local MongoDB service is running and connects
- [x] Linting: `oxlint` in all three packages (shadcn `components/ui` excluded), npm scripts `dev`, `start`, `lint`, `test`
- [x] Verified: server health route, 404 route, client lint, client production build, Vite proxy to API with database connected

## 2026-11-11 (planning)

- [x] Selected the FYP idea: **Homelab Dashboard** (monitor PCs, home network, and servers from one place)
- [x] Selected the tech stack: MERN (MongoDB, Express, React, Node.js) + Socket.io, with a Node.js agent per PC
- [x] Cloned the agent rules repo into `Agent.md/`
- [x] Installed the agent rules into `.claude/rules/` (6 always-on rules, 7 path-scoped rules), with formatting fixed (stray wrappers removed, frontmatter fixed, code blocks closed)
- [x] Wrote the project plan: [PLAN.md](PLAN.md) (problem, scope, architecture, flows, database, API, socket events, UI design, security, folder structure, timeline, testing, risks)
- [x] Created the task tracking files: [PENDING.md](PENDING.md) and this file
- [x] Added the frontend component and data plan: shadcn/ui reusable components, TanStack Query for server state, TanStack Table for data tables, Socket.io updates written into the query cache (PLAN.md sections 5, 11.4, 11.5, 13)
