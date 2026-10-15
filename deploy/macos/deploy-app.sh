#!/bin/zsh
# Build the committed HEAD of this checkout and install it to /Users/gmcp/app.
# Usage: sudo deploy/macos/deploy-app.sh   (builds as you, installs as root)
set -euo pipefail
[[ $EUID -eq 0 && -n "${SUDO_USER:-}" ]] || { print -u2 "Run with sudo from your own account."; exit 1; }

REPO="${0:A:h:h:h}"
NODE_BIN=/opt/homebrew/opt/node@22/bin
as_user() { sudo -u "$SUDO_USER" env PATH="$NODE_BIN:/opt/homebrew/bin:/usr/bin:/bin" "$@"; }

[[ -z "$(as_user git -C "$REPO" status --porcelain --untracked-files=no)" ]] \
  || { print -u2 "Uncommitted changes in $REPO; commit first so the deploy matches a commit."; exit 1; }
VERSION="$(as_user git -C "$REPO" describe --tags --always) ($(as_user git -C "$REPO" rev-parse --short HEAD))"

STAGE="$(as_user mktemp -d -t gmcp-build)"
trap 'rm -rf "$STAGE"' EXIT
as_user git -C "$REPO" archive HEAD | as_user tar -x -C "$STAGE"
(cd "$STAGE" && as_user npm ci --no-audit --no-fund --loglevel=error && as_user npm run -s build && as_user npm prune --omit=dev --no-audit --no-fund --loglevel=error)

rsync -a --delete --exclude DEPLOYED_VERSION "$STAGE/dist" "$STAGE/skills" "$STAGE/node_modules" "$STAGE/package.json" /Users/gmcp/app/
print -r -- "$VERSION" > /Users/gmcp/app/DEPLOYED_VERSION
chown -R root:wheel /Users/gmcp/app
chmod -R go-w /Users/gmcp/app
print "Installed $VERSION"

if launchctl print system/local.gmcp.server >/dev/null 2>&1; then
  launchctl kickstart -k system/local.gmcp.server
  print "Restarted local.gmcp.server"
fi
