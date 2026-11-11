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

## M1 and M2

Done (see DONE.md). Left over:

- [ ] Test the agent on Linux (tested on Windows 11 only)
- [ ] Agent: run at startup as a service (moved to M9)
- [ ] `DataTable`: add filter and pagination when the Network page needs them (M3)
- [ ] Main JS chunk is about 620 kB: split vendor code or lazy load more pages (M8)
- [ ] Change password + user management in Settings (M4)

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
