#!/bin/zsh
# One-time, idempotent: sudo deploy/macos/setup-user.sh
# Creates the hidden, non-admin gmcp user, its directories and 0600 key files.
set -euo pipefail
[[ $EUID -eq 0 ]] || { print -u2 "Run with sudo."; exit 1; }

HERE="${0:A:h}"
U=gmcp
H=/Users/$U
CONF=$H/.config/mcp-google-multi

if ! id -u $U >/dev/null 2>&1; then
  # Random password nobody keeps: the account never logs in interactively.
  sysadminctl -addUser $U -fullName "gmcp service" -home $H -shell /usr/bin/false \
    -password "$(openssl rand -base64 32)"
  dscl . -create /Users/$U IsHidden 1
  createhomedir -c -u $U >/dev/null
fi

# The service user must never be able to unlock FileVault.
if fdesetup list 2>/dev/null | cut -d, -f1 | grep -qx $U; then
  print -u2 "WARNING: $U is a FileVault unlock user; removing."
  fdesetup remove -user $U
fi

install -d -o $U -g staff -m 700 $H/.config $CONF $CONF/tokens $H/secrets $H/run
install -d -o $U -g staff -m 750 $H/logs
install -d -o root -g wheel -m 755 $H/app

for k in master.key mcp-jwt.key; do
  if [[ ! -s $CONF/$k ]]; then
    # Same shape the server generates: 32 random bytes, base64.
    (umask 077; openssl rand -base64 32 > $CONF/$k)
    print "Generated $CONF/$k. Copy it into your password manager."
  fi
  chown ${U}:staff $CONF/$k; chmod 600 $CONF/$k
done

if [[ ! -s $H/secrets/google-client-secret ]]; then
  print -n "Paste the Google OAuth client secret (input hidden, Enter to skip): "
  read -rs secret; print
  if [[ -n "$secret" ]]; then
    (umask 077; print -r -- "$secret" > $H/secrets/google-client-secret)
  fi
  unset secret
fi
[[ -e $H/secrets/google-client-secret ]] && { chown ${U}:staff $H/secrets/google-client-secret; chmod 600 $H/secrets/google-client-secret; }

[[ -e $H/gmcp.env ]] || install -o $U -g staff -m 600 "$HERE/gmcp.env.example" $H/gmcp.env
[[ -e $CONF/config.json ]] || install -o $U -g staff -m 600 "$HERE/config.example.json" $CONF/config.json

# Root-owned launchers: the service user cannot edit them in place.
install -o root -g wheel -m 755 "$HERE/run.sh" "$HERE/token-check.sh" $H/

print "\nDone. Next: edit $H/gmcp.env and $CONF/config.json (sudo -u $U nano <file>),"
print "then run deploy-app.sh."
