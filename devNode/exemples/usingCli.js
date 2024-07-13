const { printCounters, PINGPONG_CONFIG } = require("./pingPongConf.js");
const { getWallet, getProvider } = require('../devMiner.js');
const { PingPong__factory } = require('../../contracts/dist/typechain-types/factories/PingPong__factory.js');

/**
 * Make sure the chain is configured and contracts are deployed.
 * To call this method to trigget the ping - pong:
 * $ node ./examples/usingCli.js --cick-off-ping
 * 
 * To call to pring counters:
 * $ node ./examples/usingCli.js
 * 
 * Then use cli to mine, and call this method to print counters
 */
async function main() {
  const {ethereum: pingEth, polygon: pingPol} = PINGPONG_CONFIG;

  const ethWallet = (await getWallet()).connect((await getProvider('ethereum')).provider);
  const polWallet = (await getWallet()).connect((await getProvider('polygon')).provider);

  const ppEth = PingPong__factory.connect(pingEth, ethWallet);
  const ppPol = PingPong__factory.connect(pingPol, polWallet);

  await printCounters(ppEth, ppPol);
  if (process.argv.indexOf('--cick-off-ping') > 0) {
    console.log('Cicking off ping-pong')
    await ppEth.callPing();
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

