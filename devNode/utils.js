const { DeployQp__factory } = require('../contracts/dist/typechain-types/factories/DeployQp__factory.js');
const { QuantumPortalGatewayDEV__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalGatewayDEV__factory.js');
const { QuantumPortalLedgerMgrTest__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalLedgerMgrTest__factory.js');
const { QuantumPortalPocTest__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalPocTest__factory.js');
const { QuantumPortalState__factory } = require('../contracts/dist/typechain-types/factories/QuantumPortalState__factory.js');
const { QpFeeToken__factory } = require('../contracts/dist/typechain-types/factories/QpFeeToken__factory.js');

const DUMMY_EXPIRY = Math.round(Date.now()/1000);
const DUMMY_SALT = '0x55bc0903bc420ed06691a01e7fa1ab13120158c63101e1ace9e9ee3dfb87963b';

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
      gateway: gate.address,
    };
  },

  connectGateway: async (signer, gateway) => {
    if (!gateway) {
      throw new Error('No gateway provided');
    }
    const gate = QuantumPortalGatewayDEV__factory.connect(gateway, signer);
    const poc = QuantumPortalPocTest__factory.connect(await gate.quantumPortalPoc(), signer);
    return this.connect(signer, await gate.quantumPortalLedgerMgr(), poc.address, await poc.feeToken());
  },

  connect: async (signer, mgr, portal, token, gateway) => {
    const mgrC = QuantumPortalLedgerMgrTest__factory.connect(mgr, signer);
    const chainId = (await mgrC.CHAIN_ID()).toNumber();
    return {
      chainId,
      mgr: mgrC,
      portal: QuantumPortalPocTest__factory.connect(portal, signer),
      token:  QpFeeToken__factory.connect(token, signer),
      gateway: QuantumPortalGatewayDEV__factory.connect(gateway, signer),
      state: QuantumPortalState__factory.connect(await mgrC.state(), signer),
    };
  },

  mine: async (chain1, chain2) => {
    const isBlRead = await chain1.mgr.isLocalBlockReady(chain2.chainId);
    if (!isBlRead) {
        console.log('Local block was not ready... Try later.');
        return;
    }
    const nonce = 1; //TODO: GEt the last nonce
    let key = (await chain1.mgr.getBlockIdx(chain2.chainId, nonce)).toString();
    const txLen = await chain1.state.getLocalBlockTransactionLength(key);
    console.log('Tx len for block', key, 'is', txLen.toString(), nonce);
    let tx = await chain1.state.getLocalBlockTransaction(key, 0); 
    const txs = [{
                token: tx.token.toString(),
                amount: tx.amount.toString(),
                gas: tx.gas.toString(),
                fixedFee: tx.fixedFee.toString(),
                methods: tx.methods.length ? [tx.methods[0].toString()] : [],
                remoteContract: tx.remoteContract.toString(),
                sourceBeneficiary: tx.sourceBeneficiary.toString(),
                sourceMsgSender: tx.sourceMsgSender.toString(),
                timestamp: tx.timestamp.toString(),
    }];
    await chain2.mgr.mineRemoteBlock(
        chain1.chainId,
        nonce.toString(),
        txs,
        DUMMY_SALT,
        DUMMY_EXPIRY,
        '0x',
    );

    console.log('Now finalizing on chain2');
    const block = await chain2.mgr.lastRemoteMinedBlock(chain1.chainId);
    const lastFin = await chain2.state.getLastFinalizedBlock(chain1.chainId);
    const blockNonce = block.nonce.toNumber();
    const fin = lastFin.nonce.toNumber();
    if (blockNonce > fin) {
        console.log(`Calling mgr.finalize(${chain1.chainId}, ${blockNonce.toString()})`);
        const expiry = DUMMY_EXPIRY;
        const salt = DUMMY_SALT;
        const finalizersHash = DUMMY_SALT;

        const gas = await chain2.mgr.estimateGas.finalize(sourceChainId,
            blockNonce,
            [],
            finalizersHash,
            [],
            salt,
            expiry,
            '0x',
            );
        console.log("Gas required to finalize is:", gas.toString());
        await chain2.mgr.finalize(chain1.chainId,
            blockNonce,
            [],
            finalizersHash,
            [], // TODO: Remove this parameter
            salt,
            expiry,
            '0x',
            );
    } else {
        console.log('Nothing to finalize...')
    }
  }
}