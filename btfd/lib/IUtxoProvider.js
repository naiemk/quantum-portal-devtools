import mempoolJS from '@mempool/mempool.js';
import { assert } from './Common';
export class MempoolUtxoProvider {
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
export class BlockstreamUtxoProvider {
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
//# sourceMappingURL=IUtxoProvider.js.map