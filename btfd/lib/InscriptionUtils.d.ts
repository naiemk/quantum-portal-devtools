import { Network, Payment, Psbt } from 'bitcoinjs-lib';
import { TransactionInput } from 'bitcoinjs-lib/src/psbt';
import { PsbtInput } from 'bip174';
import { Buffer } from 'buffer';
import { IUtxoProvider } from './BtfdUtils';
export interface Inscription {
    contentType: Buffer;
    content: Buffer;
    postage: number;
}
export interface CommitInput {
    input: PsbtInput & TransactionInput;
    sendAmountCommit: bigint;
    sendAmountReveal: bigint;
    refundAddress: string;
    refundAmount: bigint;
    fee: bigint;
}
export declare class InscriptionUtils {
    static createTextInscription(text: string, postage?: number): Inscription;
    static createCommitTx(network: Network, publicKey: Buffer, inscription: Inscription): Payment;
    static commitPsbt(network: Network, commitOutput: Payment, commitInput: CommitInput): Psbt;
    static finalizeCommitPsbt(psbt: Psbt): Psbt;
    static createRevealPsbt(network: Network, qpAddress: string, commitedAmount: bigint, sendAmount: bigint, commitPayment: Payment, // First output of the previous commit transaction
    commitTxHash: Uint8Array): Psbt;
    static finalizeRevealPsbt(psbt: Psbt, psbtPayment: Payment): Psbt;
    static standardInput(network: Network, address: string, publicKey: Buffer, sendAmount: bigint, networkFeeCommit: bigint, networkFeeReveal: bigint, utxoProvider: IUtxoProvider): Promise<CommitInput>;
}
