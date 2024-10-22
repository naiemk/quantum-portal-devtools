import { Psbt, networks } from 'bitcoinjs-lib';
import { AbiCoder } from 'ethers';
import { InscriptionUtils } from './InscriptionUtils';
import { NetworkFeeEstimator } from './NetworkFeeEstimator';
import { BlockstreamUtxoProvider, MempoolUtxoProvider } from './IUtxoProvider';
import { assert } from 'console';
import { randomBytes } from 'crypto';
const BTFD_CHAIN_ID = {
    [networks.regtest.wif]: 21321,
    [networks.bitcoin.wif]: 12000, // TODO: Replace btfd chain ID
};
const BITCOIN_CONTRACT = {
    [networks.regtest.wif]: '0x0987654321098765432109876543210987654321',
    [networks.bitcoin.wif]: '0x0987654321098765432109876543210987654321', // TODO: Replace btfd chain ID
};
export class BtfdUtils {
    static encodeRemoteCall(remoteCall) {
        return new AbiCoder().encode(['uint256', 'address', 'bytes', 'address', 'bytes32'], [remoteCall.remoteChainId,
            remoteCall.remoteContract,
            remoteCall.remoteMethodCall,
            remoteCall.beneficiary,
            remoteCall.salt]);
    }
    static async createPsbt(network, qpAddress, from, fromPublicKey, remoteCall, signerToHex, utxoProvider = BtfdUtils.utxoProvider(network, 'http://localhost:3000', 'blockstream'), options = { signerWillFinalize: false }) {
        assert(!!network, 'network is required');
        assert(!!from, 'from is required');
        assert(!!fromPublicKey, 'fromPublicKey is required');
        assert(!!remoteCall, 'remoteCall is required');
        assert(!!qpAddress, 'qpAddress is required');
        assert(!!utxoProvider, 'utxoProvider is required');
        assert(!!signerToHex, 'signerToHex is required');
        // Create the inscription PSBT
        const [commitTx, commitPayment, commitInput] = await BtfdUtils.createInscriptionPsbt(network, from, fromPublicKey, remoteCall, qpAddress, signerToHex, utxoProvider, options);
        // Create the reveal PSBT
        const revealPsbt = await this.createRevealPsbt(network, qpAddress, commitInput.sendAmountCommit, commitInput.sendAmountReveal, commitPayment, commitTx.getHash(), signerToHex, options);
        return [commitTx, revealPsbt];
    }
    static async createInscriptionPsbt(network, from, fromPublicKey, remoteCall, qpAddress, signerHex, utxoProvider, options) {
        const encodedRemoteCall = BtfdUtils.encodeRemoteCall(remoteCall);
        const inscription = InscriptionUtils.createTextInscription(encodedRemoteCall);
        const commitOutput = InscriptionUtils.createCommitTx(network, fromPublicKey, inscription);
        const feeRate = options.feeRate || await utxoProvider.getFeeRate();
        // Creating the commit transaction
        const commitInput = await InscriptionUtils.standardInput(network, from, fromPublicKey, remoteCall.amountSats + remoteCall.feeSats, NetworkFeeEstimator.estimateFee(feeRate, NetworkFeeEstimator.estimateLenForCommit(NetworkFeeEstimator.inputType(from, network))), NetworkFeeEstimator.estimateFee(feeRate, NetworkFeeEstimator.estimateLenForInscription(inscription.content.length, NetworkFeeEstimator.inputType(qpAddress, network))), utxoProvider);
        let inscriptionPsbt = InscriptionUtils.commitPsbt(network, commitOutput, commitInput);
        // Sign the PSBT, and return hex encoded result
        const commitPsbtHex = await signerHex(inscriptionPsbt);
        inscriptionPsbt = Psbt.fromHex(commitPsbtHex);
        if (!options.signerWillFinalize) {
            inscriptionPsbt = InscriptionUtils.finalizeCommitPsbt(inscriptionPsbt);
        }
        return [inscriptionPsbt.extractTransaction(), commitOutput, commitInput];
    }
    static async createRevealPsbt(network, qpAddress, commitedAmount, sendAmount, commitPayment, commitTxId, signerToHex, options) {
        let reveal = InscriptionUtils.createRevealPsbt(network, qpAddress, commitedAmount, sendAmount, commitPayment, commitTxId);
        // Sign the PSBT, and return hex encoded result
        const revealPsbtHex = await signerToHex(reveal);
        reveal = Psbt.fromHex(revealPsbtHex);
        if (!options.signerWillFinalize) {
            reveal = InscriptionUtils.finalizeCommitPsbt(reveal);
        }
        // const revealPsbt =  InscriptionUtils.finalizeRevealPsbt(Psbt.fromHex(revealPsbtHex), commitPayment);
        return reveal.extractTransaction();
    }
    static utxoProvider(network, endpoint, serverType) {
        if (serverType === 'mempool') {
            return new MempoolUtxoProvider(endpoint);
        }
        if (serverType === 'blockstream') {
            return new BlockstreamUtxoProvider(endpoint);
        }
        throw new Error('Server type not supported');
    }
}
export class BtfdCommonCalls {
    static remoteTransferBtc(network, to, amountSats, feeSats) {
        return {
            remoteChainId: BTFD_CHAIN_ID[network.wif],
            remoteContract: BITCOIN_CONTRACT[network.wif],
            remoteMethodCall: '0x1234567890abcdef', // remoteaTransfer TODO: Replace with actual method call
            amountSats: BigInt(amountSats),
            feeSats: BigInt(feeSats),
            beneficiary: to,
            salt: '0x' + randomBytes(32).toString('hex'),
        };
    }
}
//# sourceMappingURL=BtfdUtils.js.map