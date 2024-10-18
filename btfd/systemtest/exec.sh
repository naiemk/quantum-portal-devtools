sleep 10

/build/electrs -vvvv --network regtest --daemon-dir /config --daemon-rpc-addr bitcoin-core:18443 --cookie mempool:mempool --http-addr 0.0.0.0:3002 --electrum-rpc-addr 0.0.0.0:60401 --cors "*" --jsonrpc-import
