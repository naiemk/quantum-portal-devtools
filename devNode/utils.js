const { DeployQp__factory } = require('../contracts/dist/typechain-types/factories/DeployQp__factory.js');
const { QuantumPortalGatewayDEV__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalGatewayDEV__factory.js');
const { QuantumPortalLedgerMgrTest__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalLedgerMgrTest__factory.js');
const { QuantumPortalPocTest__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalPocTest__factory.js');
const { QpFeeToken__factory } = require('../contracts/dist/typechain-types/factories/QpFeeToken__factory.js');

module.exports = {
  deploy: async (signer, chainId) => {
    const depF = new DeployQp__factory(signer);
    const dep = await depF.deploy();
    console.log('DeployQP deployed', dep.address);

    const mgrF = new QuantumPortalLedgerMgrTest__factory(signer);
    const mgr = await mgrF.deploy(chainId);
    await mgr.transferOwnership(dep.address);
    console.log('QuantumPortalLedgerMgrTest deployed', mgr.address);
    const ledgerF = new QuantumPortalPocTest__factory(signer);
    const ledger = await ledgerF.deploy(chainId);
    await ledger.transferOwnership(dep.address);
    console.log('QuantumPortalPocTest deployed', ledger.address);

    await dep.deployWithToken(chainId, mgr.address, ledger.address);
    const gate = QuantumPortalGatewayDEV__factory.connect(await dep.gateway(), signer);
    console.log('Deploy complete for chain', chainId)

    return {
      chainId,
      mgr: await gate.quantumPortalLedgerMgr(),
      portal: await gate.quantumPortalPoc(),
      token: await dep.feeToken(),
    };
  },

  connect: async (signer, mgr, portal, token) => {
    const mgrC = QuantumPortalLedgerMgrTest__factory.connect(mgr, signer);
    const chainId = (await mgrC.realChainId()).toNumber();
    return {
      chainId,
      mgr: mgrC,
      portal: QuantumPortalPocTest__factory.connect(portal, signer),
      token:  QpFeeToken__factory.connect(token, signer),
    };
  }
}