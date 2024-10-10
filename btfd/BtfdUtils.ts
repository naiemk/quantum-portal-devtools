import { Psbt, Network, Payment, Transaction } from 'bitcoinjs-lib';
import { AbiCoder } from 'ethers';
import { Buffer } from 'buffer';
import { InscriptionUtils } from './InscriptionUtils';
import mempoolJS from '@mempool/mempool.js';

export interface BtfdRemoteCall {
  remoteChainId: number,
  remoteContract: string,
  remoteMethodCall: string,
  beneficiary: string,
  amount: string,
  fee: string,
}

export class BtfdUtils {
  static encodeRemoteCall(remoteCall: BtfdRemoteCall): string {
    return Buffer.from(new AbiCoder().encode(
      ['uint256', 'address', 'bytes', 'address'],
      [remoteCall.remoteChainId,
      remoteCall.remoteContract,
      remoteCall.remoteMethodCall,
      remoteCall.beneficiary]), 'hex').toString('base64');
  }

  static async createPsbt(
    network: Network,
    qpAddress: string,
    from: string,
    fromPublicKey: Buffer,
    remoteCall: BtfdRemoteCall,
    signerToHex: (t: Psbt) => Promise<string>,
    ): Promise<[Transaction, Transaction]> {

    // Create the inscription PSBT
    const [commitTx, commitPayment] = await BtfdUtils.createInscriptionPsbt(network, from, fromPublicKey, remoteCall, signerToHex);

    // Create the reveal PSBT
    const revealPsbt = await this.createRevealPsbt(network, qpAddress, from, fromPublicKey, commitTx, commitPayment, remoteCall, signerToHex);

    return [commitTx, revealPsbt];
  }

  private static async createInscriptionPsbt(
      network: Network,
      from: string,
      fromPublicKey: Buffer,
      remoteCall: BtfdRemoteCall,
      signerHex: (p: Psbt) => Promise<string>,
      ): Promise<[Transaction, Payment]> {
    const encodedRemoteCall = BtfdUtils.encodeRemoteCall(remoteCall);
    const inscription = InscriptionUtils.createTextInscription(encodedRemoteCall);
    const commitOutput = InscriptionUtils.createCommitTx(network, fromPublicKey, inscription); 

    // Creating the commit transaction
    const mempool = mempoolJS();
    const addressTxsUtxo = await mempool.bitcoin.addresses.getAddressTxsUtxo({address: from});
    const commitInput = InscriptionUtils.standardInput(network, from, fromPublicKey, addressTxsUtxo);
    const inscriptionPsbt = InscriptionUtils.commitPsbt(network, commitOutput, commitInput);

    // Sign the PSBT, and return hex encoded result
    const commitPsbtHex = await signerHex(inscriptionPsbt);
    const commitPsbt =  InscriptionUtils.finalizeCommitPsbt(Psbt.fromHex(commitPsbtHex));
    return [commitPsbt.extractTransaction(), commitOutput];
  }

  private static async createRevealPsbt(
      network: Network,
      qpAddress: string,
      from: string,
      fromPublicKey: Buffer,
      commitTx: Transaction,
      commitPayment: Payment,
      call: BtfdRemoteCall,
      signerToHex: (t: Psbt) => Promise<string>,
    ): Promise<Transaction> {
    const mempool = mempoolJS();
    const addressTxsUtxo = await mempool.bitcoin.addresses.getAddressTxsUtxo({address: from});
    // TODO: Take the amount for the commit tx fee, from commitPsbt inputs, out of the utxo from addressTxsUtxo
    const revealPayment = InscriptionUtils.standardInput(network, from, fromPublicKey, addressTxsUtxo);
    const reveal = InscriptionUtils.createRevealPsbt(network, qpAddress, revealPayment, commitPayment, commitTx, addressTxsUtxo);

    // Sign the PSBT, and return hex encoded result
    const revealPsbtHex = await signerToHex(reveal);
    const revealPsbt =  InscriptionUtils.finalizeRevealPsbt(Psbt.fromHex(revealPsbtHex), commitPayment);
    return revealPsbt.extractTransaction();
  }
}
