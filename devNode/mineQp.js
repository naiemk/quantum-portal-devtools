const { mineQp, deployContracts, } = require('./devMiner.js');

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (command === 'mine') {
    await mineQp();
    return;
  } else if (command === 'deploy') {
    await deployContracts();
    return;
  } else {
    throw new Error(`Invalid command "${command}"`);
  }
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});