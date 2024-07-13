## QP Ping-pong example

We have created the example `PingPong.sol`. This contract uses QP to ping/pong between two chains until there is not enough fee to pay.
Look into the SDK version to undestadn how to use the **DevQP SDK** to deploy QP, deploy contracts, etc.

In general, to test a QP application you need to follow these steps:

 We refer to the root of this repo as `/`. Run the following commadn in the repo root folder:


```
$ export QP_HOME=`pwd`
```

1- Run forked networks
2- Run deploy QP contract
3- Deploy and configure your QP dApp contracts
4- Call your dApp that triggers a multi-chain transaction
5- Mine QP and inspect results

### 1- Run foked networks

Network configuration is done in a js file: `/contracts/config/chain.js`. Feel free to update. Make sure to provide `forkChainId` because hardhat fork uses a default chainId for the fork which will lead to all forks having the same chain ID.

Note that the `forkChainId` is only used inside QP, and does not change the actual chain ID.

```sh
$ cd $QP_HOME/contracts
$ ./bin/runForks.sh
```

To stop the forks

```sh
$ cd $QP_HOME/contracts
$ ./bin/runForks.sh stop
```

To monitor the logs
```sh
$ pm2 mnoit
```

### 2- Run deploy QP contracts

After deployging QP contracts, take note of the `gateway` contract. You are going to need this in future.

#### Using CLI

```sh
$ cd $QP_HOME/devNode
$ node ./mineQp.js deploy <network>
```

#### Using SDK

```js
const { deployContracts } = require('../devMiner.js');

async function main() {
  ...
  const qp = await deployContracts(network);
}
```

### 3- Deploy and configure your QP dApp contracts

You need to do this in a script. We provide some utilities to help wit the deployment.
In our example we use `typechain` but vanilla `ethers` or `web3` will work just as well.

Your contract can inherit `WithQp` and `WithRemotePeers` abstract contracts.
After deploying your contracts, make sure to initialize them.

- Initialize with QP, using `WithQp.initializeWithQp(portal)`. You need to provide the QP `portal` address to the initialize method. Note this is the `portal` address, and not the `gateway`.
- Configure remote peers, using `WithRemotePeers.updateRemotePeers([chainIds], [addresses])`. This will allow your contracts to understand which remote 
peers can be trusted, and which peers can be communicated with.


```js
  console.log('Deploying new PingPong on ethereum')
  ppEth = await (new PingPong__factory(ethWallet)).deploy(...);
  await ppEth.initializeWithQp(qpEth.portal.address);
  await ppPol.updateRemotePeers([remoteChainId], [remotePeerId]);
```

### 4- Call your dApp that triggers a multi-chain transaction

In your contracts, you can trigger a multi-chain transaction by calling one of the `run` interfaces in the `IQuantumPortalPol.sol`. 
This interface is all you need to communicate with QP. Both to read message or to send messages or tokens cross-chain.

```sol
  bytes memory remoteMethodCall = abi.encodeWithSelector(PingPong.remotePong.selector); 
  portal.run(remoteChainId, remotePeers[remoteChainId], msg.sender, remoteMethodCall);
```

You can then call the specific method on your contract which triggers the multi-chain transaction.

```js
  const ppfEth = PingPong__factory(contractAddress, signer);
  await ppEth.callPing(); // This will register the request to QP.
```

### 5- Mine QP and inspect results

#### Using CLI

```sh
$ cd $QP_HOME/devNode
$ node ./mineQp.js mine ethereum:<GATEWAY> polygon:<GATEWAY>
```

#### Using SDK

```js
const { mineQp } = require('../devMiner.js');

async function main() {
  await mineQp('ethereum:<GATEWAY ADDRESS>', 'polygon:<GATEWAY ADDRESS>');
}
```

We are working on a UI to help you inspect with the mine/finalize trasactions. Contact our team for more info.