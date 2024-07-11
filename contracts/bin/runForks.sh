#!/bin/bash

if [[ "$1" == "stop" ]]; then
  echo STOPPING...
  npx pm2 stop all && npx pm2 delete all
else
 npx pm2 start ./bin/nodes.config.js
fi


