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

## M1 to M6

Done (see DONE.md). Left over:

- [ ] **You:** create a Telegram bot with @BotFather, put `TELEGRAM_BOT_TOKEN` in `server/.env`, restart the server, then set the chat ID in Settings > Notifications and send a test message (the code is done, but it was not tested with a real bot because no token was available)
- [ ] **You:** to use power actions on a PC, set `REMOTE_COMMANDS=on` in that PC's `agent/.env` and restart its agent (off by default on purpose)
- [ ] Prepare the mid-evaluation demo (M1 to M4)
- [ ] Test the agent, network scanner, and remote commands on Linux (tested on Windows 11 only; restart / shutdown were only tested in dry-run mode)
- [ ] Agent: run at startup as a service (M13)
- [ ] Network: device names. Reverse DNS rarely works on home networks; try mDNS / NetBIOS names
- [ ] Network: option to ignore devices with private (random) MACs, which change and can cause repeat "unknown device" alerts on busy networks
- [ ] Alerts: per-device rules (today every rule applies to all PCs)
- [ ] Alerts: a PC offline rule turned on later does not start timers for PCs that are already offline (they are picked up at the next status change or server restart)
- [ ] Services: response time chart axis may need more width for long values (Internet chart already widened)

## M7 to M9

Done (see DONE.md). Left over:

- [ ] **You:** to control dev projects on a PC, copy `agent/workspace.example.json` to `agent/workspace.json`, list your projects, set `WORKSPACE_CONTROL=on` in that PC's `agent/.env`, and run the agent with `npm start` (under `npm run dev` nodemon can stop projects the agent started)
- [ ] **You (optional):** router features need your own MikroTik router (RouterOS 7, REST API on, a dedicated user) in `server/.env`; DNS ad blocking needs AdGuard Home. Both were tested only against mock servers
- [ ] The quality monitor pings the default gateway every minute; on a network you do not own, remove the gateway target in `server/src/services/qualityService.js` if pings to the router are not wanted
- [ ] Ports list: inside the development sandbox `netstat` hides most listening sockets, so ports 4000 / 5173 were not seen there; check the Workspace ports card on a normal run
- [ ] Docker, Laravel, and Redis paths are written and unit tested but not run for real (not installed on the dev PC)
- [ ] Network map: kinds are guesses from vendor names; "Open in table" does not pre-fill the search
- [ ] Router: settings are not re-applied if the router loses them; queue target is updated only on the next track / priority change when a device's IP changes
- [ ] ISP PDF: outage table header is not repeated on the second page

## M10: Multi-Link Manager

Done (see DONE.md). Left over:

- [ ] **You:** real test with three lines: Wi-Fi + Ethernet cable + phone over USB tethering, `MULTILINK=on` in `agent/.env`, Windows proxy set to 127.0.0.1:8080, then download a large file with IDM and watch the Multi-Link page
- [ ] DNS lookups use the normal Windows resolver (only the TCP connection is bound to a line)
- [ ] Speed test data does not count toward a line's data cap
- [ ] WebSocket upgrades over plain HTTP proxying are not supported (WebSockets over HTTPS / CONNECT work)
- [ ] Optional add-on: true bonding of a single connection needs an outside bonding server (VPS)

## M11: Drive (Storage Hub)

Done (see DONE.md). Left over:

- [ ] **You:** create a Google Cloud OAuth client (Web application), turn on the Google Drive API, add `http://localhost:4000/api/storage/google/callback` as a redirect URI, add your Google accounts as test users, then put `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `server/.env` and restart the server (steps are also on the Drive accounts page)
- [ ] Real test with two real Google accounts: connect, upload a large video, play it with seeking, share link, view-only user
- [ ] While the Google app is in "Testing" mode, Google expires refresh tokens after 7 days (the account shows "Needs reconnect"); publish the app or reconnect weekly
- [ ] Files already in a Google Drive are not imported (the `drive.file` scope only sees files uploaded by this app)
- [ ] One upload goes to one account, so a single file must fit in one account's free space
- [ ] When the client is served by Express in production (M13), allow Google profile pictures (`lh3.googleusercontent.com`) in the CSP `img-src`
- [ ] No video thumbnails yet (an icon is shown); image thumbnails load the full image

## M12: Polish, security, testing

- [ ] Validate all request bodies and agent payloads
- [ ] Unit tests: alert engine, validators, metric averaging
- [ ] API tests with Supertest: auth (login, wrong password, rate limit, me, logout), roles, main routes
- [ ] Turn the browser smoke test (login, navigation, theme, mobile sidebar, logout) into a Playwright test
- [ ] Viewer role (read only) checks in UI and API
- [ ] Responsive layout check on phone
- [ ] Loading, empty, and error states on every page
- [ ] Load check with 5 agents
- [ ] `npm audit` on all packages

## M13: Deployment + documentation

- [ ] Run server as a service (PM2 or Docker Compose) on the home server
- [ ] Run agent at startup on each PC (Windows Task Scheduler / systemd)
- [ ] Remote access through Tailscale or WireGuard
- [ ] README with setup steps
- [ ] Screenshots and demo video
- [ ] FYP report (chapters: intro, literature review, design, implementation, testing, conclusion)
- [ ] Viva presentation slides
