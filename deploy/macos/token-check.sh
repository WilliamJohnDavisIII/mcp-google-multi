#!/bin/zsh
# Daily: one live Gmail call per alias. Pings Healthchecks only when every
# alias passes, so silence by morning means an account needs re-linking.
set -uo pipefail

HC="$(sed -n 's/^HEALTHCHECKS_URL=//p' /Users/gmcp/gmcp.env)"
print "== $(date -u +%FT%TZ)"
/Users/gmcp/run.sh token-check
rc=$?
if [[ -n "$HC" ]]; then
  if (( rc == 0 )); then url="$HC"; else url="$HC/fail"; fi
  curl -fsS -m 10 --retry 3 -o /dev/null "$url" || print -u2 "healthchecks ping failed"
fi
exit $rc
