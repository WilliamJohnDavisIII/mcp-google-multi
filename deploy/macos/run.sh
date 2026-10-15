#!/bin/zsh
# launchd entry point (also: run.sh token-check | doctor | config check).
# Secrets come from 0600 files, never the world-readable plist.
set -euo pipefail

export HOME=/Users/gmcp
CONF="$HOME/.config/mcp-google-multi"

set -a
source "$HOME/gmcp.env"
set +a

export MCP_TRANSPORT=http MCP_HTTP_HOST=127.0.0.1 MCP_HTTP_PORT=4243

# Pin both keys to their files: the server never falls back to the Keychain,
# which a headless daemon can't unlock.
for f in "$HOME/secrets/google-client-secret" "$CONF/master.key" "$CONF/mcp-jwt.key"; do
  [[ -s "$f" ]] || { print -u2 "run.sh: missing or empty $f"; exit 78; }
done
export GOOGLE_CLIENT_SECRET="$(<"$HOME/secrets/google-client-secret")"
export MASTER_KEY="$(<"$CONF/master.key")"
export MCP_JWT_KEY="$(<"$CONF/mcp-jwt.key")"

# exec keeps this PID, so newsyslog can signal the server after rotating its log.
[[ $# -eq 0 ]] && print $$ > "$HOME/run/server.pid"
exec /opt/homebrew/opt/node@22/bin/node "$HOME/app/dist/index.js" "$@"
