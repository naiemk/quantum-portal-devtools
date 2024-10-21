import { Network } from 'bitcoinjs-lib';
export type BtcAddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr';
export declare class NetworkFeeEstimator {
    static inputType(addr: string, network: Network): BtcAddressType;
    /**
     * Returns the vsize for the Commit transaction. The commit transaction takes funds from the
     * user's wallet and sends them to the commit address. The commit address is a p2tr address.
     * These sizes are calclated empirically.
     */
    static estimateLenForCommit(inputType: BtcAddressType): bigint;
    static estimateLenForInscription(inscriptionLength: number, outputType: BtcAddressType): any;
    static estimateFee(feeRate: number, txLen: bigint): bigint;
}
