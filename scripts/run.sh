#!/usr/bin/env bash
set -e
[ -z "$HOME" ] && export HOME="/home/anon"
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh" >/dev/null
nvm use default >/dev/null
cd /home/anon/Repos/chrome-extension-session-switcher
echo "node $(node -v) | npm $(npm -v)"
echo "+ $*"
"$@"
