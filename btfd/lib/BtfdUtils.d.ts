import { Psbt, Network, Transaction } from 'bitcoinjs-lib';
import { Buffer } from 'buffer';
import { IUtxoProvider } from './IUtxoProvider';
export interface BtfdRemoteCall {
    remoteChainId: number;
    remoteContract: string;
    remoteMethodCall: string;
    salt: string;
    beneficiary: string;
    amountSats: bigint;
    feeSats: bigint;
}
export interface CreatePsbtOptions {
    signerWillFinalize?: boolean;
    feeRate?: number;
}
export declare class BtfdUtils {
    static encodeRemoteCall(remoteCall: BtfdRemoteCall): string;
    static createPsbt(network: Network, qpAddress: string, from: string, fromPublicKey: Buffer, remoteCall: BtfdRemoteCall, signerToHex: (t: Psbt) => Promise<string>, utxoProvider?: IUtxoProvider, options?: CreatePsbtOptions): Promise<[Transaction, Transaction]>;
    private static createInscriptionPsbt;
    private static createRevealPsbt;
    static utxoProvider(network: Network, endpoint: string, serverType: 'mempool' | 'blockstream'): IUtxoProvider;
}
export declare class BtfdCommonCalls {
    static remoteTransferBtc(network: Network, to: string, amountSats: string, feeSats: string): BtfdRemoteCall;
}
