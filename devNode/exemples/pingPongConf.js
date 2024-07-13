const GATEWAY_CONFIG = {
  ethereum: '0x69D59296446de83FFfb3EC8dE16dBE9D5395f9BB',
  polygon: '0xdB0852D8c064e32be56b5eA4c1FADA2DaC30EafF',
}

const PINGPONG_CONFIG = {
  ethereum: '0xFa094d05f9D8a69Fdb090Aa825A408b9b7614Dc0',
  polygon: '0x49018edD1a873B91DDd26cE88cCBB0c860Db890e',
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