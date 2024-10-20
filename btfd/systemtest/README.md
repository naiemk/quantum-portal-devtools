# Tests using bitgon regtest

We use nigiri to run a set of bitcoin node and peripherals.

```bash
$ nigiri start
```

```bash
$ bitcoin-cli -rpcconnect=0.0.0.0 -rpcport=18443 -rpcuser=admin1 -rpcpassword=123 -getinfo
```

## Set config for bitcoin-cli

```
$ vim ~/Library/Application\ Support/Bitcoin/bitcoin.conf
regtest=1
rpcconnect=0.0.0.0
rpcport=18443
rpcuser=admin1
rpcpassword=123
```

## Create wallet
```bash
$ bitcoin-cli createwallet "testwallet" false false "" false false
$ bitcoin-cli -rpcwallet=testwallet getnewaddress "adr1" "p2sh-segwit"
2MuqkkdRF7UAQpJgKcSuub8NRLYXwqknhJR
$ bitcoin-cli -rpcwallet=testwallet  dumpprivkey 2MuqkkdRF7UAQpJgKcSuub8NRLYXwqknhJR
cRApu4jyLFcebmsNwbWBQEHkXHve3zLr1j4AVWCiq3T79xv5AQw9 
ef6b113fe49093c9a6257245a502e0ad36a13a4c39b6582d2b16258b502fadbff401
$ # Generate some BTC
$ bitcoin-cli -rpcwallet=testwallet generatetoaddress 1 2MuqkkdRF7UAQpJgKcSuub8NRLYXwqknhJR
```

## bitcoin-cli quick help

https://github.com/BlockchainCommons/Learning-Bitcoin-from-the-Command-Line/blob/master/03_2_Knowing_Your_Bitcoin_Setup.md
