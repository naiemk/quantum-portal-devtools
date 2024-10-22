import mempoolJS from '@mempool/mempool.js';
import { AddressTxsUtxo, MempoolReturn } from '@mempool/mempool.js/lib/interfaces';
import { assert } from './Common';


export interface IUtxoProvider {
  getFeeRate(): Promise<number>;
  getUtxos(address: string): Promise<AddressTxsUtxo[]>;
  txBlobByHash(hash: string): Promise<Buffer>;
  broadcastTx(tx: string): Promise<string>;
}

export class MempoolUtxoProvider implements IUtxoProvider {
  private mempool: MempoolReturn;
  constructor(endpoint: string) {
    this.mempool = mempoolJS({ hostname: endpoint }) as any;
  }

  async getFeeRate(): Promise<number> {
    const fees = await this.mempool.fees.getFeesRecommended();
    return fees.fastestFee;
  }

  async getUtxos(address: string): Promise<AddressTxsUtxo[]> {
    return this.mempool.addresses.getAddressTxsUtxo(address);
  }

  async txBlobByHash(hash: string): Promise<Buffer> {
    return Buffer.from(await this.mempool.transactions.getTxRaw(hash), 'hex');
  }

  async broadcastTx(tx: string): Promise<string> {
    return this.mempool.transactions.postTx(tx) as any;
  }
}

export class BlockstreamUtxoProvider implements IUtxoProvider {
  private endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getFeeRate(): Promise<number> {
    const response = await fetch(`${this.endpoint}/fee-estimates`);
    const feeEstiamtes = await response.json() as any;
    return Number(feeEstiamtes['1'] || feeEstiamtes['2'] || feeEstiamtes['3']);
  }

  async getUtxos(address: string): Promise<AddressTxsUtxo[]> {
    const response = await fetch(`${this.endpoint}/address/${address}/utxo`);
    return response.json() as any;
  }

  async txBlobByHash(hash: string): Promise<Buffer> {
    const response = await fetch(`${this.endpoint}/tx/${hash}/hex`);
    return Buffer.from(await response.text(), 'hex');
  }

  async broadcastTx(tx: string): Promise<string> {
    // send the commit transaction to the network
    const res = await fetch('http://localhost:3000/tx', { method: 'POST', body: tx });
    const txid = await res.text();
    console.log('broadcasted tx', txid);
    assert(Buffer.from(txid, 'hex').length === 32, 'Invalid txid: ' + txid);
    return txid;
  }
}