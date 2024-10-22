import { AddressTxsUtxo } from '@mempool/mempool.js/lib/interfaces';
export interface IUtxoProvider {
    getFeeRate(): Promise<number>;
    getUtxos(address: string): Promise<AddressTxsUtxo[]>;
    txBlobByHash(hash: string): Promise<Buffer>;
    broadcastTx(tx: string): Promise<string>;
}
export declare class MempoolUtxoProvider implements IUtxoProvider {
    private mempool;
    constructor(endpoint: string);
    getFeeRate(): Promise<number>;
    getUtxos(address: string): Promise<AddressTxsUtxo[]>;
    txBlobByHash(hash: string): Promise<Buffer>;
    broadcastTx(tx: string): Promise<string>;
}
export declare class BlockstreamUtxoProvider implements IUtxoProvider {
    private endpoint;
    constructor(endpoint: string);
    getFeeRate(): Promise<number>;
    getUtxos(address: string): Promise<AddressTxsUtxo[]>;
    txBlobByHash(hash: string): Promise<Buffer>;
    broadcastTx(tx: string): Promise<string>;
}
