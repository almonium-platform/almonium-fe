#!/bin/bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
# Source nvm to make npm and node available
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/kuzanoleg/almonium-fe
git reset --hard
git clean -fd
git pull
npm install
npm run build -- --configuration production
