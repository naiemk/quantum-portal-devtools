const { printCounters, PINGPONG_CONFIG, GATEWAY_CONFIG } = require("./pingPongConf.js");
const { connectGateway, NotDeployedError, isContract, sleep, mineEthBlock } = require('../utils.js');
const { getWallet, getProvider, mineQp, deployContracts } = require('../devMiner.js');
const { PingPong__factory } = require('../../contracts/dist/typechain-types/factories/PingPong__factory.js');
const { ethers } = require('ethers');

const DEFAULT_GAS = 700000 * 10**9;

async function prepare() {
  const {ethereum: gateEth, polygon: gatePol} = GATEWAY_CONFIG;
  if (!gateEth || !gatePol) { throw new Error('Bed config!') }
  const ethP = await getProvider('ethereum');
  const polP = await getProvider('polygon');
  const ethWallet = (await getWallet()).connect(ethP.provider);
  const polWallet = (await getWallet()).connect(polP.provider);

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
  const newPpEth =  !pingEth || !isContract(ethWallet.provider, pingEth);
  const newPpPol = !pingPol || !isContract(polWallet.provider, pingPol);

  let ppEth;
  let ppPol;
  if (newPpEth) {
    console.log('Deploying new PingPong on ethereum')
    ppEth = await (new PingPong__factory(ethWallet)).deploy(polP.chainId, DEFAULT_GAS);
    await ppEth.initializeWithQp(qpEth.portal.address);
  } else {
    ppEth = PingPong__factory.connect(pingEth, ethWallet);
  }
  if (newPpPol) {
    console.log('Deploying new PingPong on polygon')
    ppPol = await (new PingPong__factory(polWallet)).deploy(ethP.chainId, DEFAULT_GAS);
    await ppPol.initializeWithQp(qpPol.portal.address);
  } else {
    ppPol = PingPong__factory.connect(pingPol, polWallet);
  }
  if (newPpEth || newPpPol) {
    await ppEth.updateRemotePeers([polP.chainId], [ppPol.address]);
    await ppPol.updateRemotePeers([ethP.chainId], [ppEth.address]);
  }

  console.log('Connected to ping pongs - (eth, pol):', ethP.chainId, ppEth.address, ',', polP.chainId, ppPol.address);

  // Send fee to the ping-pong contract. Note that in this exmaple,
  // fee management is handled by the contract itself. But it is
  // more likely that the dApp will charge the user for gas in real
  // world applications.
  if (newPpEth || newPpPol) {
    console.log('Sending a bunch of fee to contracts');
    await qpEth.token.transfer(ppEth.address, ethers.utils.parseEther('10'));
    await qpPol.token.transfer(ppPol.address, ethers.utils.parseEther('10'));
  }

  console.log('Calling the "ping()" on eth');
  await ppEth.callPing(); // This will register the request to QP.

  await printCounters(ppEth, ppPol); // Counters will not be incremented yet.

  console.log('Triggering QP mining. eth => pol');
  await sleep(3000);
  console.log('Calling:');
  console.log('./mineQp.js mine',`ethereum:${qpEth.gateway.address}`, `polygon:${qpPol.gateway.address}`);
  await mineQp(`ethereum:${qpEth.gateway.address}`, `polygon:${qpPol.gateway.address}`); // Now mine and finalize...

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