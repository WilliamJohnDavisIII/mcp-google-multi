# gmcp on the Mac mini: runbook

Fork of mcp-google-multi v6.0.0 with two patches (branch `gmcp`):

1. `feat(scopes)`: five narrow bundles (`gmail_readonly`, `gmail_compose`, `calendar_readonly`, `calendar_events`, `drive_readonly`), used through the `narrow` scope profile with `includesBase: false`. The server's own mechanism; `BASE_SCOPES` is untouched.
2. `feat(cli)`: `token-check` makes one live Gmail call per alias and exits non-zero if any fails. Doctor only probes the first healthy alias.

Repo on the mini: `~/Documents/code/me/mcp-google-multi`. Node 22 LTS is installed keg-only at `/opt/homebrew/opt/node@22` (your default `node` stays 26).

Tunnel hostname: `gmcp.davisregenerative.com`. Owner address (the one account allowed to connect Claude): `liam@davisregenerative.com`.

---

## Accounts

| Account | Served by | Alias |
|---|---|---|
| Personal Gmail | gmcp | `personal` |
| Davis Regenerative (`liam@davisregenerative.com`, you admin it) | gmcp | `davisregen` |
| Lampstand Digital (`liam@lampstand.digital`, you don't admin it) | claude.ai's built-in Gmail, Calendar and Drive connectors, unchanged | none |

Lampstand stays on the built-in connectors, so its admin never has to approve this app. Keep those connectors connected.

## M0 · Fork and verify: done

- Pinned at `v6.0.0` (upstream has only one release-CI line changed since).
- On the mini, Node 22.23.3: 105 test files, 1670 passed, 10 skipped; typecheck, build OK.
- Optional: push the fork. `gh repo fork bakissation/mcp-google-multi --remote --remote-name fork`, then `git push fork gmcp`.

## M1 · Google Cloud + local test (one evening)

Signed in as `liam@davisregenerative.com`, at console.cloud.google.com:

1. New project (e.g. `gmcp`). APIs & Services → enable **Gmail API**, **Google Calendar API**, **Google Drive API**.
2. Google Auth Platform → **Branding**: app name, your email as support + developer contact. No logo.
3. **Audience**: External. Add your personal Gmail and `liam@davisregenerative.com` as test users.
4. **Data access**: add `gmail.readonly`, `gmail.compose`, `calendar.readonly`, `calendar.events`, `drive.readonly`, `openid`, `email`.
5. **Clients → Create → Web application**. Redirect URIs:
   - `https://gmcp.davisregenerative.com/callback`
   - `http://localhost:4243/callback` (for this milestone; delete after M3a)

   Put the client ID and secret in your password manager.

Then on the mini, a hand-run test as yourself (not the service user):

```bash
cd ~/Documents/code/me/mcp-google-multi
export PATH=/opt/homebrew/opt/node@22/bin:$PATH
export XDG_CONFIG_HOME=$HOME/.gmcp-m1
mkdir -p $XDG_CONFIG_HOME/mcp-google-multi && cp deploy/macos/config.example.json $XDG_CONFIG_HOME/mcp-google-multi/config.json
# edit that config.json: keep only "personal" with your gmail address
export MCP_TRANSPORT=http MCP_PUBLIC_URL=http://localhost:4243 MCP_OWNER_EMAILS=liam@davisregenerative.com
export MCP_ALLOWED_ORIGINS=http://localhost:6274 GOOGLE_TOOLSETS=gmail
export GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
node dist/index.js
```

In a second terminal on the mini (or over `ssh -L 4243:localhost:4243 -L 6274:localhost:6274 macmini`): `npx @modelcontextprotocol/inspector`, connect to `http://localhost:4243/mcp`, sign in, call `gmail_search` with `account: personal`. The first call returns a link; open it, consent, call again.

**Pass:** `gmail_search` returns your mail. Then `rm -rf ~/.gmcp-m1`.

## M2 · Scope check + production (one evening)

The scope patch is already in. On the consent screen from M1, confirm it lists only the five Google scopes plus your email address.

Then **Audience → Publish app → In production**. Set a reminder for **23 Oct 2026** (8 days).

**Pass:** on day 8, a call still works without re-linking.

## M3a · Service user, tunnel, connector (one evening)

Service user + app (each asks for your password):

```bash
cd ~/Documents/code/me/mcp-google-multi
sudo deploy/macos/setup-user.sh        # creates hidden user gmcp, keys, asks for the client secret
sudo -u gmcp nano /Users/gmcp/gmcp.env  # MCP_PUBLIC_URL, MCP_OWNER_EMAILS, GOOGLE_CLIENT_ID, allowlist
sudo -u gmcp nano /Users/gmcp/.config/mcp-google-multi/config.json   # your real aliases + emails
sudo deploy/macos/deploy-app.sh
(cd /Users/gmcp && sudo -u gmcp /Users/gmcp/run.sh config check)   # from your repo dir it fails with EACCES uv_cwd
sudo deploy/macos/install-services.sh   # loads both LaunchDaemons, curls /health
```

Copy `/Users/gmcp/.config/mcp-google-multi/master.key` and `mcp-jwt.key` into your password manager (`sudo cat` them once).

Cloudflare tunnel:

```bash
brew install cloudflared && brew pin cloudflared node@22
mv ~/.cloudflared/cert.pem ~/.cloudflared/cert-artosmarket.pem   # keep the artos cert; login refuses to overwrite it
cloudflared tunnel login                     # pick davisregenerative.com
cloudflared tunnel create gmcp               # note the UUID
sudo mkdir -p /etc/cloudflared
sudo install -m 600 ~/.cloudflared/<UUID>.json /etc/cloudflared/
# write /etc/cloudflared/config.yml from deploy/macos/cloudflared-config.example.yml
cloudflared tunnel route dns gmcp gmcp.davisregenerative.com
sudo cloudflared service install
# the macOS daemon is installed without "tunnel run"; fix its arguments:
sudo plutil -replace ProgramArguments -json '["/opt/homebrew/bin/cloudflared","--no-autoupdate","--config","/etc/cloudflared/config.yml","tunnel","run"]' /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
sudo launchctl bootout system/com.cloudflare.cloudflared; sudo launchctl bootstrap system /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
```

From off your network: `curl https://gmcp.davisregenerative.com/health` returns `{"status":"ok",…}`.

claude.ai → Settings → Connectors → Add custom connector. Name "Google (all accounts)", URL `https://gmcp.davisregenerative.com/mcp`, default OAuth. Sign in as the owner address.

**Pass:** Gmail search works from the Claude mobile app on cellular.

## M3b · WAF + rate limit

Cloudflare dashboard → your zone → Security → WAF → Custom rules → Create:

```
(http.request.uri.path in {"/mcp" "/token" "/register"} or starts_with(http.request.uri.path, "/.well-known")) and not ip.src in {160.79.104.0/21}
```

Action: **Block**. Add your home IP to the set if you'll use Claude Code against it.

Rate limiting rules → one per-IP rule: `http.request.uri.path in {"/authorize" "/callback"}`, e.g. 20 requests / 1 minute, Block for 10 minutes.

Remove `http://localhost:4243/callback` from the OAuth client.

**Pass:** M3a still works, a re-auth link still works, and `curl -i https://gmcp.davisregenerative.com/mcp` from outside gets 403.

## M4 · Davis Regenerative + Calendar + Drive

1. Davis Regenerative Admin console (admin.google.com) → Security → Access and data control → API controls → Manage Third-Party App Access → Configured apps → Add app → by client ID → scope to an OU/group with only you → **Trusted**.
2. Toolsets are already `gmail,calendar,drive` in `gmcp.env`. Add `davisregen` to `config.json` if it isn't, then `sudo launchctl kickstart -k system/local.gmcp.server`.
3. Run the plan's per-alias test lines for `personal` and `davisregen`, plus "Search every account for 'invoice' this month."

## M5 · Writes

1. In `/Users/gmcp/gmcp.env`, uncomment `GOOGLE_WRITE_ALLOW`, set `GOOGLE_OUTBOUND_ALLOWLIST` to every domain you write to, restart.
2. `sudo -u gmcp /Users/gmcp/run.sh config check`: confirm exactly `gmail_create_draft`, `calendar_create_event` and `calendar_update_event` are enabled.
3. If your plan has per-tool permissions, set those three to ask before running.

**Pass:** draft created; "send it" refused; invite to stranger@example.com refused. Keep the built-in Gmail, Calendar and Drive connectors: they serve Lampstand.

## M6 · Unattended operation

```bash
sudo pmset -a sleep 0 disksleep 0 powernap 0 autorestart 1 womp 1
```

(Today `sleep` is 1 and only Amphetamine keeps the mini awake; `autorestart` and `womp` are already on.)

- Uptime monitor (Better Stack or UptimeRobot): `https://gmcp.davisregenerative.com/health` every 5 min, phone push.
- Healthchecks.io: a daily check with a 1-hour grace; paste its URL into `HEALTHCHECKS_URL` in `gmcp.env`. The check runs at 06:15. Try it now with `sudo launchctl kickstart system/local.gmcp.tokencheck`, then `cat /Users/gmcp/logs/token-check.log`.
- Cloudflare → Notifications → Tunnel health alert.
- UPS on the mini and router.
- Pre-boot SSH unlock: System Settings → General → Sharing → Remote Login on, then test it once from the LAN after a reboot. From away you need a Tailscale subnet router at home (Apple TV or Pi).
- Planned restarts: `sudo fdesetup authrestart`.

**Pass:** pull the power, restore it, get alerted, unlock remotely, connector recovers on its own.

---

## Day-to-day

| Task | Command |
|---|---|
| Restart server | `sudo launchctl kickstart -k system/local.gmcp.server` |
| Logs | `tail -f /Users/gmcp/logs/server.err.log` |
| Token check now | `sudo -u gmcp /Users/gmcp/run.sh token-check` |
| Diagnose | `sudo -u gmcp /Users/gmcp/run.sh doctor` |
| Deployed version | `cat /Users/gmcp/app/DEPLOYED_VERSION` |
| Upgrade | `git fetch origin --tags`, read `git diff v6.0.0 <new-tag>`, rebase `gmcp`, run tests, `sudo deploy/macos/deploy-app.sh` |
| Kill switch | `GOOGLE_READ_ONLY=true` in `gmcp.env` + restart, or `sudo launchctl bootout system/local.gmcp.server` |
| Add an account | Add a line to `config.json` with `"scopeProfile": "narrow"`, restart, ask Claude to use the alias, follow the link |
| Remove an account | Delete its line, restart, delete `tokens/<alias>.enc`, revoke at myaccount.google.com → Security → Third-party connections |

Log rotation restarts the server (SIGTERM, launchd restarts it in ~10 s) when `server.log` passes 10 MB, because the process holds its log file open.
