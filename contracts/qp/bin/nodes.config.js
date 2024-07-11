const chains = require('../config/chain.js');
const networks = Object.keys(chains.CHAIN_CONFIG);
const forkChains = networks.filter(n => chains.CHAIN_CONFIG[n].forkPort).map(n => ({
  name: n,
  script: `npx hardhat node --fork ${chains.CHAIN_CONFIG[n].url} --port ${chains.CHAIN_CONFIG[n].forkPort}`,
}));

module.exports = {
  apps: forkChains,
}