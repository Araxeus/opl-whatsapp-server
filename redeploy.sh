#!/bin/bash
# redeploy.sh

# pm2 start dist/server.js --name opl --node-args="--env-file=.env" --time
# pm2 start bun --name opl --time --interpreter none -- dist/server.js

# pm2 start pm2-log-forwarder.js --name log-forwarder --time --interpreter ~/.bun/bin/bun -- <SYSLOG_IP:PORT>

git pull origin main

bun install --production 

bun _build

pm2 restart log-forwarder --update-env
pm2 restart opl --update-env
