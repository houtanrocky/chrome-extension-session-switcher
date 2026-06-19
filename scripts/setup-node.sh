#!/usr/bin/env bash
set -e
export NVM_DIR="$HOME/.nvm"
[ -z "$HOME" ] && export HOME="/home/anon" && export NVM_DIR="/home/anon/.nvm"
. "$NVM_DIR/nvm.sh"
echo "nvm $(nvm --version)"
nvm install 22
nvm alias default 22
echo "node $(node -v)"
echo "npm $(npm -v)"
