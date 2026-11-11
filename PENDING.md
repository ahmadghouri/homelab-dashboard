# Pending Tasks

Tasks still to do for the Homelab Dashboard. Full design is in [PLAN.md](PLAN.md).

How to use:

- When a task is finished, move it to [DONE.md](DONE.md) with the date.
- Work milestones in order. Each milestone should end with something that can be demoed.

---

## M0: Planning and setup

- [ ] Fix the encoding bug in `Agent.md/scripts/sync-agent-rules.ps1` (`Get-Content -Encoding UTF8`) and add `safety.md`
- [ ] Complete the truncated rules in the Agent.md repo (`engineering`, `quality`, `security`, `testing`)
- [ ] Rename the project folder from `Desktop/test` to `Desktop/homelab-dashboard` (stop dev servers and close VS Code first)
- [ ] Draw final diagrams for the FYP proposal (architecture, ERD, flows) into `docs/`
- [ ] Submit the FYP proposal

## M1: Auth + base layout

M1 is done (see DONE.md). Moved to the milestone where they are first used, so they are built against real data:

- `UsageBar`, `MetricChart`, `DataTable`, `FormDialog`, `ConfirmDialog` → M2
- Change password + user management in Settings → M4
- API tests for auth (Supertest) → M8

## M2: Agent + live PC monitoring

- [ ] Client: `UsageBar` (shadcn `progress`, color by threshold)
- [ ] Client: `MetricChart` (shadcn `chart` + range `tabs`)
- [ ] Client: `DataTable` (TanStack Table: sort, filter, paginate)
- [ ] Client: `FormDialog` and `ConfirmDialog` (used by Add Device and Remove Device)
- [ ] Client: route-level code splitting (`React.lazy`) when the chart bundle grows (build warns about a chunk over 500 kB)

- [ ] Server: Device model, add device route that returns a one-time agent token
- [ ] Server: Socket.io `/agent` namespace with token auth
- [ ] Agent: connect with token, send `agent:hello`
- [ ] Agent: collect metrics with `systeminformation`, send `agent:metrics` every 5s
- [ ] Agent: auto reconnect when the server restarts
- [ ] Server: forward live metrics to the `/dashboard` namespace
- [ ] Server: save one averaged MetricSample per minute, TTL index
- [ ] Server: offline detection (no heartbeat for 30s)
- [ ] Server: metrics history route (`1h`, `24h`, `7d`)
- [ ] Client: `useSocket` hook that writes `device:metrics` and `device:status` into the TanStack Query cache
- [ ] Client: devices feature (`api.js`, `queryKeys.js`, `useDevices`, `useDevice`, `useDeviceMetrics`, `useAddDevice` mutation)
- [ ] Client: Devices page (`DeviceCard` with `UsageBar` and `StatusBadge`)
- [ ] Client: Device detail page (live `MetricChart`, history range tabs, specs, top processes `DataTable`)
- [ ] Client: Add Device `FormDialog` that shows the token once
- [ ] Test the agent on Windows and on Linux

## M3: Network scanner

- [ ] Server: NetworkDevice model
- [ ] Server: scanner service (ping sweep + ARP table + MAC vendor lookup)
- [ ] Server: scheduled scan every 5 minutes + "scan now" route
- [ ] Server: detect new MAC and emit `network:update`
- [ ] Client: network feature hooks (`useNetworkDevices`, `useUpdateNetworkDevice`, `useScanNow`), invalidate on `network:update`
- [ ] Client: Network page (`DataTable`, filter unknown, rename, mark trusted)

## M4: Alerts + Telegram

- [ ] Create the Telegram bot with BotFather, get chat ID
- [ ] Server: Telegram service + test message route
- [ ] Server: AlertRule and Alert models, default rules seed
- [ ] Server: alert engine (thresholds, duration, no duplicate open alerts, auto resolve)
- [ ] Server: hook alerts into metrics, offline detection, and network scan
- [ ] Client: bell icon with unread count, `sonner` toast on `alert:new`, invalidate alert queries
- [ ] Client: Alerts page and rule editor
- [ ] Client: Settings page (Telegram setup, test button)
- [ ] Settings: change password, add / remove users (admin only), viewer role
- [ ] Prepare mid-evaluation demo (M1 to M4)

## M5: Internet + service monitoring

- [ ] Server: SpeedTest model, speed test service, scheduled every 30 to 60 min
- [ ] Server: downtime detection (failed tests or failed pings to 1.1.1.1 / 8.8.8.8)
- [ ] Client: Internet page (speed chart, downtime list, run now)
- [ ] Server: Service and ServiceCheck models
- [ ] Server: HTTP and TCP checker, per-service interval
- [ ] Server: `service_down` alerts
- [ ] Client: Services page (status, response time, uptime %)
- [ ] Client: Overview page with all summary cards

## M6: Remote commands

- [ ] Agent: whitelisted commands (`lock`, `restart`, `shutdown`) mapped per OS
- [ ] Server: command route (admin only, whitelist check), CommandLog model
- [ ] Server: send `agent:command`, store `agent:command:result`
- [ ] Client: action buttons with confirm dialog, command history

## M7: Backups

- [ ] Server: BackupJob and BackupRun models, CRUD routes
- [ ] Server: schedule jobs with `node-cron`, run now route
- [ ] Agent: zip sources with `archiver`, keep last N copies
- [ ] Agent: restore to a chosen folder
- [ ] Server: `backup_failed` alert
- [ ] Client: Backups page (jobs, history, run now, restore)

## M8: Polish, security, testing

- [ ] Validate all request bodies and agent payloads
- [ ] Unit tests: alert engine, validators, metric averaging
- [ ] API tests with Supertest: auth (login, wrong password, rate limit, me, logout), roles, main routes
- [ ] Turn the browser smoke test (login, navigation, theme, mobile sidebar, logout) into a Playwright test
- [ ] Viewer role (read only) checks in UI and API
- [ ] Responsive layout check on phone
- [ ] Loading, empty, and error states on every page
- [ ] Load check with 5 agents
- [ ] `npm audit` on all packages

## M9: Deployment + documentation

- [ ] Run server as a service (PM2 or Docker Compose) on the home server
- [ ] Run agent at startup on each PC (Windows Task Scheduler / systemd)
- [ ] Remote access through Tailscale or WireGuard
- [ ] README with setup steps
- [ ] Screenshots and demo video
- [ ] FYP report (chapters: intro, literature review, design, implementation, testing, conclusion)
- [ ] Viva presentation slides
