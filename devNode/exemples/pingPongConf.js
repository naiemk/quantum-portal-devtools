const GATEWAY_CONFIG = {
  ethereum: '0xAACa323D13C96d5D8516B79c4d2C3ED1ED9306f7',
  polygon: '0xAACa323D13C96d5D8516B79c4d2C3ED1ED9306f7',
}

const PINGPONG_CONFIG = {
  ethereum: '0x1b81491D24Bfc7F65f0e58d769dCCAA069758148',
  polygon: '0x4A508c1842A7719ad298f88699Bc9Ea088E547f1',
}

function prettyLog(msg) {
    console.log(`\x1b[32;1;4m >>>>>>>>>>>>>>>>>>>>>>>>>> ${msg}\x1b[0m`);
}

async function printCounters(ppEth, ppPol) {
  prettyLog(`ETH COUNTER: ${(await ppEth.counter()).toString()}`);
  prettyLog(`POL COUNTER: ${(await ppPol.counter()).toString()}`);
}

module.exports = {
  GATEWAY_CONFIG, PINGPONG_CONFIG, printCounters,
}