import { Psbt, Network, Transaction } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import { AddressTxsUtxo } from '@mempool/mempool.js/lib/interfaces';
export interface BtfdRemoteCall {
    remoteChainId: number;
    remoteContract: string;
    remoteMethodCall: string;
    salt: string;
    beneficiary: string;
    amountSats: bigint;
    feeSats: bigint;
}
export declare class BtfdUtils {
    static encodeRemoteCall(remoteCall: BtfdRemoteCall): string;
    static createPsbt(network: Network, qpAddress: string, from: string, fromPublicKey: Buffer, remoteCall: BtfdRemoteCall, signerToHex: (t: Psbt) => Promise<string>, utxoProvider?: IUtxoProvider): Promise<[Transaction, Transaction]>;
    private static createInscriptionPsbt;
    private static createRevealPsbt;
    static utxoProvider(network: Network, endpoint: string, serverType: 'mempool' | 'blockstream'): IUtxoProvider;
}
export declare function assert(condition: any, msg: string): void;
export interface IUtxoProvider {
    getFeeRate(): Promise<number>;
    getUtxos(address: string): Promise<AddressTxsUtxo[]>;
    txBlobByHash(hash: string): Promise<Buffer>;
    broadcastTx(tx: string): Promise<string>;
}
