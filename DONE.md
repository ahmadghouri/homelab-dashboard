# Done

Completed tasks for the Homelab Dashboard. Newest first. Pending work is in [PENDING.md](PENDING.md).

---

## 2026-11-12 (M11: Drive, Storage Hub)

Join any number of Google Drive accounts into one file store with per-user permissions. Inspired by the open-source 9Drive, built as our own MERN version. Built by seven parallel agents against a shared contract, then integrated and tested by the lead.

- [x] Server: Google OAuth for admins only (hashed, single-use state bound to the admin), `drive.file` scope (the app sees only its own files), tokens encrypted with AES-256-GCM, refresh with rotation, quota sync job, `storage_account_full` and `storage_account_error` alerts
- [x] Server: unlimited accounts with upload routing (most free space, round robin, priority order) and atomic space reservation, so two uploads can never take the same last free space
- [x] Server: per-user Drive access (view, download, upload, delete, share; all folders or selected folders with their subfolders), checked on every route; admins always have full access
- [x] Server: virtual folders, files, search, rename, move, batch actions, trash with restore and 30-day purge, share links (only a hash is stored, optional expiry, download on / off, view count), activity log
- [x] Server: resumable chunked uploads (8 MB chunks streamed to Google, offset tracked on the server, expired sessions cleaned up), ranged streaming for previews and video seeking, risky types (HTML, SVG, scripts) always downloaded, sandbox CSP on content
- [x] Client: Drive page (grid and list views, breadcrumbs, search, kind filter, selection, drag and drop upload), upload panel that keeps running while you move between pages, preview dialog (image, video, audio, PDF, text), share dialog, public share page `/s/:token`, trash view
- [x] Client: Drive accounts page (Google setup guide, connect through a popup, totals, per-account usage, accept uploads switch, priority, sync, disconnect, routing mode) and a Drive access dialog for each user in Settings > Users
- [x] Main JS chunk cut from about 650 kB to about 57 kB (pages lazy loaded, vendor code split)
- [x] Fixed during integration: the server crashed when a visitor closed a share link (or a preview) before the download started (an aborted stream raised an unhandled error); the stream is now cleaned up safely. Also: broken account pictures fall back to the first letter, and the "account connected" toast no longer shows twice
- [x] Verified: agent tests S1 17/17, S2 35/37 + 30/30 (the 2 failures were a placeholder at the time), S3 151/152 (test bug) + 11/11, S4 42/42 + 9/9 + 2/2; abort stress test (120 cancelled downloads, server stays up); headless Chrome run 28/28 against a mock Google server and a throwaway database (connect two accounts through the popup, folder, three uploads including 20 MB in chunks, image preview, range request 206, share link opened without login, view-only user scoped to one folder with download and upload blocked, trash and restore, phone layout, no console errors)
- [ ] Not tested with real Google yet (no OAuth client on the dev PC)

## 2026-11-12 (M10: Multi-Link Manager)

Built by five parallel agents against a shared contract, then integrated and tested by the lead.

- [x] Agent: detects internet lines (Wi-Fi, Ethernet, phone USB tethering; VPN and virtual adapters skipped), health every 15 s with connections bound to each line's IP (latency, loss, up / down), per-line speed test (10 MB), settings from the dashboard (mode, sticky, role, data cap; tethering starts as Backup)
- [x] Agent: local load-balancing proxy on 127.0.0.1 only: HTTP (CONNECT + plain HTTP) and SOCKS5; each new connection bound to a chosen line; modes Balanced, Weighted by speed, Failover; Backup lines; sticky sites; retry on the next line with cooldown for failing lines; per-line bytes, rates, connections, data caps (persisted)
- [x] Agent: `MULTILINK` (off by default), `MULTILINK_HTTP_PORT`, `MULTILINK_SOCKS_PORT`; never changes OS network or proxy settings
- [x] Fixed during integration: settings and usage files are per device (short hash of the agent token), so two agents on one PC never share them
- [x] Server: `MultiLinkSetting` model, snapshot store, `multilink:update` event, `link_down` alerts, settings pushed on connect, API under `/api/devices/:id/multilink` (status, settings, per-line speed test, usage reset)
- [x] Client: Multi-Link page (PC picker, off card with how to turn it on, totals, proxy addresses with copy, mode and sticky, line cards with role, cap, speed test, reset, live throughput chart, setup guide with honest limits)
- [x] Verified: proxy tests 36/36 (exact balanced and weighted splits, failover, backup, caps, sticky, retry, SOCKS5 replies, byte counts), agent core 9/9 + engine test, server 40/40, real requests over the Wi-Fi line (HTTP, HTTPS, SOCKS5 to example.com), one real line speed test (37.4 Mbps), and a headless Chrome run 13/13 (off card on the real PC, temp PC with the proxy running, request through the proxy counted, mode and cap pushed to the agent, chart, reset, phone layout, proxy port closed afterwards, no console errors)
- [ ] Only one real line exists on the dev PC: a real test with Wi-Fi + Ethernet + phone tethering together is left for the user

## 2026-11-12 (M7: Developer Workspace Manager, M8: Network Pro, M9: Router + DNS integration)

Built by eleven parallel agents against a shared contract (separate file ownership), then integrated and tested by the lead.

**M7: Developer Workspace Manager**
- [x] Agent: per-PC `workspace.json` (projects + OS services, validated, reloaded on change), example file, `WORKSPACE_FILE`, `WORKSPACE_CONTROL` (off by default; status is always reported)
- [x] Agent: start / stop / restart dev projects (Windows through `cmd.exe`, so projects keep running after the agent exits), output kept in files and a 1000-line buffer, log file tail, error count, crash detection, "external" projects (port in use but not started by the agent)
- [x] Agent: Docker containers through the CLI (graceful "not installed"), OS services (`sc` / `systemctl`), listening ports with process names and conflict detection
- [x] Agent: snapshot every 10 s and after changes; action and log requests with acknowledgements
- [x] Fixed after integration: stopping a project left its `node` child running on Windows; descendants are now killed by PID from a fresh process list before `taskkill /T`
- [x] Server: snapshot validation and store, `workspace:update` and `workspace:action` events, `WorkspaceActionLog` (90 days), `project_crashed` alerts, API under `/api/devices/:id/workspace` (status, actions, action history, logs (admin)), pending actions failed after a restart
- [x] Client: Workspace page (PC picker, offline and control-off banners, setup help with example JSON, projects, containers, services, ports with conflicts, log viewer with error highlight / errors only / auto refresh, action history)

**M8: Network Pro**
- [x] Server: quality monitor pings the default gateway and 1.1.1.1 every minute (10 pings each): packet loss, latency, jitter, `QualitySample` time series (90 days), `packet_loss_high` alerts, `GET /api/internet/quality`
- [x] Server: ISP report `GET /api/reports/isp?month=` (speed, availability, outages, quality, daily rows) and PDF `GET /api/reports/isp.pdf?month=` with `pdfkit`
- [x] Client: Internet page quality card (loss and latency charts per target) and ISP report card (last 12 months, Download PDF)
- [x] Client: Network map at `/network/map` (custom SVG, router in the centre, devices by kind guessed from vendor, filters, search, tooltips, details panel, zoom and pan, keyboard access)

**M9: Router and DNS integration (optional, off until configured)**
- [x] Server: MikroTik RouterOS 7 REST client (basic auth, timeouts, safe errors, optional self-signed TLS): status, WAN lines, per-device usage with simple queues, priority and speed limit, block / unblock with an address list and one drop rule; `RouterDeviceSetting` model; `/api/router/*`
- [x] Server: AdGuard Home client (status, stats, protection on / off with fallback for older versions); `/api/dns/*`
- [x] Client: Router page (setup help when not configured, status and WAN lines, devices table with usage, priority, block, DNS card) and "Block on router" in the Network device menu (only when a router is configured)
- [x] Tested only against mock RouterOS and AdGuard servers; nothing was sent to the real LAN router

**Lead integration**
- [x] New alert rules: High packet loss, Dev project crashed; stable alert ids for targets without a document
- [x] Sidebar: Workspace, Router; Network page "Map view"; header title for the map; live updates for workspace
- [x] `apiClient.put`; `.env.example` entries for router, AdGuard, and workspace; `agent/workspace.json` gitignored
- [x] Bundle: pages lazy loaded and libraries split into cached chunks (main file about 1.1 MB to 57 kB, no build warning)
- [x] Verified: each agent's own tests (mock router 16/16, mock AdGuard 9/9, workspace server 32/32, ping and gateway parsers, PDF rendering), plus a headless Chrome run with throwaway projects: start, logs with error highlight, crash alert, stop (no process left), action history, Docker-not-installed state, MongoDB status, network map, quality and report cards, router setup help, new alert rules, no overflow on phones, no console errors

## 2026-11-11 (M5: Internet + service monitoring, M6: Remote commands)

Built by six parallel agents against a shared contract (each owned separate files), then integrated and tested by the lead.

- [x] Server (internet): connectivity check every 30 s (TCP to 1.1.1.1, 8.8.8.8, 9.9.9.9; offline after 2 failures), `InternetOutage` history (stale outages closed on start), Cloudflare speed test with built-in `fetch` (ping, jitter, download 25 MB, upload 10 MB), one test at a time, scheduled every `internet.speedTestIntervalMin` (default 60, 0 = off), `internet_down` alert rule
- [x] Server (internet) API: `GET /api/internet/status`, `GET /api/internet/speedtests?range=24h|7d|30d`, `POST /api/internet/speedtests` (admin, 409 while running), `GET /api/internet/outages`; events `internet:status`, `internet:speedtest:running`, `internet:speedtest`
- [x] Server (services): HTTP and TCP checks per service on their own interval, no overlapping checks, `ServiceCheck` time series (30 days), uptime 24h / 7d in one aggregation, history in 15 / 120 min bins, `service_down` alert rule (paused services close their alert)
- [x] Server (services) API: `/api/services` list / add / edit / delete, `POST /:id/check`, `GET /:id/checks?range=24h|7d`; events `service:update`, `service:deleted`
- [x] Remote commands: fixed whitelist `lock`, `restart`, `shutdown`, `cancel_shutdown` (restart / shutdown after 60 s so they can be cancelled), agent runs fixed OS commands with `execFile` (no shell), **off by default** (`REMOTE_COMMANDS=on` per PC), dry-run mode for testing (`REMOTE_COMMANDS_DRY_RUN=true`)
- [x] Remote commands server: `CommandLog` (90 days), `POST /api/devices/:id/commands` (admin, 409 when offline, 15 s answer timeout), `GET /api/devices/:id/commands`, event `command:updated`; logs deleted with the device; pending logs marked failed after a server restart
- [x] Alert engine: generic down timers for internet and services; `onServiceRemoved` takes a reason ("Service paused")
- [x] Settings: speed test interval (Settings > Network)
- [x] Client: Internet page (connection, download, upload, ping / jitter cards, speed history chart 24h / 7d / 30d, outages table, Run speed test)
- [x] Client: Services page (summary cards, table with status, response time, uptime 24h / 7d, actions: check now, edit, pause / resume, delete; add / edit dialog with field errors; uptime and response time chart)
- [x] Client: Power menu on the device page (Lock, Restart, Shut down, Cancel shutdown with confirmations, disabled when offline) and command history card
- [x] Client: Overview cards for internet download and services up; live updates for internet, services, and commands
- [x] Fixed: device page showed "undefined · undefined" before the agent sent its details; speed chart axis labels wrapped
- [x] Removed Backups from the project scope (sidebar, router, plan, tasks, README); removed the unused "coming soon" page
- [x] Verified: each agent tested its own API with curl (validation, auth, roles, 404 / 409), a real speed test (about 61 to 69 Mbps down, 49 to 52 Mbps up), service alerts opening and closing, command timeout and offline paths; remote commands only in dry-run mode on a temporary device (the real PC refused a `lock` because commands are off); headless Chrome: M5 / M6 suite 26/26, M3 / M4 21/21, M2 15/15, no console errors, no horizontal overflow on phones

## 2026-11-11 (M3: Network scanner)

- [x] Server: `NetworkDevice` model (by MAC: IP, vendor, private MAC flag, hostname, custom name, trusted, online, first / last seen)
- [x] Server: discovery without admin rights: one UDP packet to every address in the subnet (max /24), then read the ARP table (`arp -a` on Windows and macOS, `/proc/net/arp` on Linux); this server added as "Server"
- [x] Server: offline vendor lookup with `oui-data` (IEEE list, MACs never leave the server); private (random) MACs detected; reverse DNS names when available
- [x] Server: scan job (default every 5 minutes, interval from Settings, rescheduled on change), one scan at a time, first scan builds the list without alerts
- [x] Server: `/api/network/devices` (list + scan status), rename / trust (admin), forget (admin), `POST /api/network/scan` (admin); socket events `network:scan` and `network:update`
- [x] Client: network feature (api, query keys, hooks, live updates); Network page with summary cards, search, "Unknown only" filter, sortable and paginated table (numeric IP sort), rename / trust / forget, Scan now
- [x] Client: `DataTable` pagination (TanStack Table v9 `rowPaginationFeature`), keeps page and sort when live data refreshes
- [x] Verified on the real network: 48 devices found in about 2.3 s with vendors

## 2026-11-11 (M4: Alerts, Telegram, settings, users)

- [x] Server: `AlertRule` (6 fixed rules: high CPU, high RAM, disk almost full, high CPU temperature, PC offline, unknown network device; each can be turned on / off and tuned) and `Alert` models; default rules created on start
- [x] Server: alert engine: metric rules with threshold + duration and 5-point hysteresis, PC offline with a delay (also after a server restart), unknown device on scan, one open alert per rule and target, auto resolve (back to normal, back online, trusted, forgotten, removed, rule turned off)
- [x] Server: Telegram through the Bot API with `fetch` (no extra package), token only in `.env`, send test, "find my chat" from recent messages, failures saved on the alert
- [x] Server: `/api/alerts` (list by status, acknowledge, resolve), `/api/alert-rules` (list, update with per-rule limits), `/api/settings` (Telegram, scan interval), `/api/users` (list, add, change role, delete; cannot remove the last admin or yourself), `POST /api/auth/change-password` (signs out other sessions)
- [x] Server: socket events `alert:new`, `alert:resolved`, `alert:updated`; `Settings` model with in-memory cache
- [x] Client: bell with open alert count in the top bar, live toasts for new and resolved alerts
- [x] Client: Alerts page (Open / Resolved / All tabs, Seen and Resolve actions) and rules card (switch, edit dialog with limits)
- [x] Client: Settings page: Notifications (setup steps or chat ID + find chat + test), Network (scan interval), Users (add, role, delete), Account (change password); viewers only see Account
- [x] Client: Overview cards for network devices and open alerts, recent alerts list; Network, Alerts, and Settings out of "coming soon"
- [x] Verified: alert flows with real data (CPU alert open and auto resolve, new network device open and resolve on trust, PC offline open and resolve on removal), roles and permissions, password change signing out other sessions, headless Chrome test 21/21 for M3 + M4 and 15/15 for M2 again (no console errors)

## 2026-11-11 (M2: Agent + live PC monitoring)

- [x] Server: `Device` model (agent token stored as a SHA-256 hash, shown only once on create / regenerate)
- [x] Server: `MetricSample` as a MongoDB time series collection with 30-day automatic expiry
- [x] Server: `/api/devices` routes: list, get, add (admin), rename (admin), delete with history (admin), new token (admin), history `?range=1h|24h|7d` (bucketed to 1 / 5 / 30 minutes)
- [x] Server: Socket.io `/agent` namespace (token auth, payloads validated with zod, one connection per device) and `/dashboard` namespace (session cookie auth)
- [x] Server: live metrics kept in memory, averaged and saved once per minute; offline detected within about 20 seconds (ping 10s + timeout 10s); all devices reset to offline on server start
- [x] Server: `validateQuery` and `validateObjectId` middleware
- [x] Agent: CPU, RAM, network every 5s; disks, battery, temperature, top 5 processes every 30s (slow on Windows); hardware info on connect; auto reconnect; clear message for a missing or invalid token
- [x] Client: shared `dashboardSocket`, `useDashboardSocket`, `useSocketEvent` (React 19 `useEffectEvent`)
- [x] Client: devices feature (`api`, `queryKeys`, `cache`, `useDevices`, `useDevice`, `useDeviceHistory`, `useDeviceLiveSeries`, `useDeviceLiveUpdates`, mutations); socket events are written into the TanStack Query cache
- [x] Client: common components `UsageBar`, `MetricChart`, `DataTable` (TanStack Table v9), `FormDialog`, `ConfirmDialog`; `lib/format.js`, `lib/usage.js`; colored chart palette
- [x] Client: Devices page (live cards), Device detail page (live stats, live chart, history chart with 1h / 24h / 7d, disks, system info, top processes, rename / new token / remove), Add device dialog with one-time token and setup steps
- [x] Client: Overview "PCs online" card; device detail page lazy loaded (charts in their own chunk)
- [x] Verified: device API with curl (auth, validation, 400 / 404), agent on Windows 11 sending real data, offline on agent exit, invalid token rejected, headless Chrome test 15/15 (live CPU updates over the socket, detail page, charts, add device + token dialog, remove device, mobile layout, no console errors)

## 2026-11-11 (GitHub)

- [x] First commit pushed to https://github.com/ahmadghouri/homelab-dashboard (`main`)
- [x] Added `.gitattributes` (LF line endings)
- [x] Added root [README.md](README.md): problem, features, stack, architecture, setup, scripts, API, security, roadmap

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
