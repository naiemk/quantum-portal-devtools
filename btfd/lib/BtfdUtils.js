import { Psbt } from 'bitcoinjs-lib';
import { AbiCoder } from 'ethers';
import { Buffer } from 'buffer';
import { InscriptionUtils } from './InscriptionUtils';
import mempoolJS from '@mempool/mempool.js';
import { NetworkFeeEstimator } from './NetworkFeeEstimator';
export class BtfdUtils {
    static encodeRemoteCall(remoteCall) {
        return new AbiCoder().encode(['uint256', 'address', 'bytes', 'address', 'bytes32'], [remoteCall.remoteChainId,
            remoteCall.remoteContract,
            remoteCall.remoteMethodCall,
            remoteCall.beneficiary,
            remoteCall.salt]);
    }
    static async createPsbt(network, qpAddress, from, fromPublicKey, remoteCall, signerToHex, utxoProvider = BtfdUtils.utxoProvider(network, 'http://localhost:3000', 'blockstream'), options = { signerWillFinalize: false }) {
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
        const feeRate = await utxoProvider.getFeeRate();
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
export function assert(condition, msg) {
    if (!condition) {
        throw new Error(msg);
    }
}
class MempoolUtxoProvider {
    constructor(endpoint) {
        this.mempool = mempoolJS({ hostname: endpoint });
    }
    async getFeeRate() {
        const fees = await this.mempool.fees.getFeesRecommended();
        return fees.fastestFee;
    }
    async getUtxos(address) {
        return this.mempool.addresses.getAddressTxsUtxo(address);
    }
    async txBlobByHash(hash) {
        return Buffer.from(await this.mempool.transactions.getTxRaw(hash), 'hex');
    }
    async broadcastTx(tx) {
        return this.mempool.transactions.postTx(tx);
    }
}
class BlockstreamUtxoProvider {
    constructor(endpoint) {
        this.endpoint = endpoint;
    }
    async getFeeRate() {
        const response = await fetch(`${this.endpoint}/fee-estimates`);
        const feeEstiamtes = await response.json();
        return Number(feeEstiamtes['1'] || feeEstiamtes['2'] || feeEstiamtes['3']);
    }
    async getUtxos(address) {
        const response = await fetch(`${this.endpoint}/address/${address}/utxo`);
        return response.json();
    }
    async txBlobByHash(hash) {
        const response = await fetch(`${this.endpoint}/tx/${hash}/hex`);
        return Buffer.from(await response.text(), 'hex');
    }
    async broadcastTx(tx) {
        // send the commit transaction to the network
        const res = await fetch('http://localhost:3000/tx', { method: 'POST', body: tx });
        const txid = await res.text();
        console.log('broadcasted tx', txid);
        assert(Buffer.from(txid, 'hex').length === 32, 'Invalid txid: ' + txid);
        return txid;
    }
}
//# sourceMappingURL=BtfdUtils.js.map