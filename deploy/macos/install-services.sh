#!/bin/zsh
# Install (or reinstall) the LaunchDaemons and log rotation.
# Usage: sudo deploy/macos/install-services.sh
set -euo pipefail
[[ $EUID -eq 0 ]] || { print -u2 "Run with sudo."; exit 1; }
HERE="${0:A:h}"

install -o root -g wheel -m 644 "$HERE/newsyslog-gmcp.conf" /etc/newsyslog.d/gmcp.conf
install -o root -g wheel -m 755 "$HERE/run.sh" "$HERE/token-check.sh" /Users/gmcp/

for job in local.gmcp.server local.gmcp.tokencheck; do
  plutil -lint -s "$HERE/$job.plist"
  launchctl bootout system/$job 2>/dev/null || true
  install -o root -g wheel -m 644 "$HERE/$job.plist" /Library/LaunchDaemons/$job.plist
  launchctl bootstrap system /Library/LaunchDaemons/$job.plist
  print "Loaded $job"
done

sleep 3
curl -fsS http://127.0.0.1:4243/health && print || print -u2 "Server not answering yet; see /Users/gmcp/logs/server.err.log"
