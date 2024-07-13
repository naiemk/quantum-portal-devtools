const { connectGateway, NotDeployedError } = require('../utils.js');
const { getWallet, getProvider, mineQp, deployContracts } = require('../devMiner.js');
const { PingPong__factory } = require('../../contracts/dist/typechain-types/factories/PingPong__factory.js');
const { ethers } = require('ethers');

const GATEWAY_CONFIG = {
  ethereum: '',
  polygon: '',
}

const PINGPONG_CONFIG = {
  ethereum: '',
  polygon: '',
}

const DEFAULT_GAS = 700000 * 10**9;

function prettyLog(msg) {
    console.log(`\x1b[32;1;4m >>>>>>>>>>>>>>>>>>>>>>>>>> ${msg}\x1b[0m`);
}

async function printCounters(ppEth, ppPol) {
  prettyLog(`ETH COUNTER: ${(await ppEth.counter()).toString()}`);
  prettyLog(`POL COUNTER: ${(await ppPol.counter()).toString()}`);
}

async function prepare() {
  const {ethereum: gateEth, polygon: gatePol} = GATEWAY_CONFIG;
  if (!gateEth || !gatePol) { throw new Error('Bed config!') }
  const ethWallet = await getWallet().connect(await getProvider('ethereum'));
  const polWallet = await getWallet().connect(await getProvider('polygon'));

  let qpEth;
  try {
    qpEth = await connectGateway(ethWallet, gateEth);
  } catch (e) {
    if (e instanceof NotDeployedError) {
      qpEth = await deployContracts('ethereum');
    } else throw e;
  }

  let qpPol;
  try {
    qpPol = await connectGateway(polWallet, gatePol);
  } catch (e) {
    if (e instanceof NotDeployedError) {
      qpPol = await deployContracts('polygon');
    } else throw e;
  }
  console.log('Using gatewys - (eth, pol):', qpEth.gateway.address, qpPol.gateway.address);

  const {ethereum: pingEth, polygon: pingPol} = PINGPONG_CONFIG;
  const ppfEth = PingPong__factory(pingEth, ethWallet);
  const newPpEth = !await ppfEth.deployed();
  let ppEth;
  const ppfPol = new PingPong__factory(pingPol, polWallet);
  const newPpPol = !await ppfPol.deployed();
  let ppPol;
  if (newPpEth) {
    console.log('Deploying new PingPong on ethereum')
    ppEth = await (new PingPong__factory(ethWallet)).deploy(1001, DEFAULT_GAS); // 1001 Chain ID for eth
    await ppEth.initializeWithQp(qpEth.portal.address);
  }
  if (newPpPol) {
    console.log('Deploying new PingPong on polygon')
    ppPol = await (new PingPong__factory(polWallet)).deploy(1003, DEFAULT_GAS); // 1003 Chain ID for pol
    await ppPol.initializeWithQp(qpPol.portal.address);
  }
  if (newPpEth || newPpPol) {
    await ppEth.updateRemotePeers([1003], [ppPol.address]);
    await ppPol.updateRemotePeers([1001], [ppEth.address]);
  }

  console.log('Connected to ping pongs - (eth, pol):', ppEth.address, ppPol.address);

  // Send fee to the ping-pong contract. Note that in this exmaple,
  // fee management is handled by the contract itself. But it is
  // more likely that the dApp will charge the user for gas in real
  // world applications.
  if (newPpEth || newPpPol) {
    console.log('Sending a bunch of fee to contracts');
    await qpEth.token.transfer(ppEth.address(), ethers.utils.parseEther('10'));
    await qpPol.token.transfer(ppPol.address(), ethers.utils.parseEther('10'));
  }

  console.log('Calling the "ping()" on eth');
  await ppEth.callPing(); // This will register the request to QP.

  await printCounters(ppEth, ppPol); // Counters will not be incremented yet.

  console.log('Triggering QP mining. eth => pol');
  await mineQp(`ethereum:${gateEth}`, `polygon:${gatePol}`); // Now mine and finalize...

  await printCounters(ppEth, ppPol);
}

/**
 * This exmaple is utilizing the Miner DEV SDK as an exmaple to work with QP.
 * 
 * 1. Check if QP is deployed on the networks. If not deploy it.
 * 2. Deploy the ping pong example and send fee for the gas.
 * 3. Run the ping pong
 * 
 * NOTE: Wallet and network configurations come from the config files
 */
async function main() {
  await prepare();
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = {
  GATEWAY_CONFIG, PINGPONG_CONFIG, printCounters,
}