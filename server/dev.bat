@echo off
REM /guild local dev server
REM Uses separate DB and localhost mediasoup config
set PORT=3001
set ANNOUNCED_IP=127.0.0.1
set DB_PATH=./data/messenger-dev.db
node src/index.js
