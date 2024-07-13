#!node
const { mineQp, deployContracts, } = require('./devMiner.js');

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] || '';
  if (command === 'mine') {
    const argv = process.argv.slice(3);
    const ngate1 = argv[0];
    const ngate2 = argv[1];
    await mineQp(ngate1, ngate2);
    return;
  } else if (command === 'deploy') {
    const argv = process.argv.slice(3);
    const network = argv[0];
    await deployContracts(network);
    return;
  } else {
    throw new Error(`Invalid command "${command}"`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
