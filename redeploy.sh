#!/bin/bash
# redeploy.sh
# pm2 start dist/server.js --name opl --node-args="--env-file=.env" --time --attach

git pull origin main

bun install --production 

bun _build

pm2 restart opl --update-env
