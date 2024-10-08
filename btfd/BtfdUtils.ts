import { Psbt, Network } from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
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
    from: string,
    remoteCall: BtfdRemoteCall,
    signerToHex: (t: Psbt) => Promise<string> ): Promise<[Psbt, Psbt]> {
    const inscriptionPsbt = new Psbt({network});
    const revealPsbt: any = new Psbt({network});

    // Create the inscription PSBT
    await this.createInscriptionPsbt(from, inscriptionPsbt, remoteCall);

    // Create the reveal PSBT
    await this.createRevealPsbt(from, revealPsbt, remoteCall);

    return [inscriptionPsbt, revealPsbt];
  }

  private static async createInscriptionPsbt(
      network: Network,
      from: string,
      fromPublicKey: Buffer,
      remoteCall: BtfdRemoteCall,
      signerHex: (p: Psbt) => Promise<string>,
      ): Promise<void> {
    // TODO: Implement the logic for creating the inscription PSBT
    const encodedRemoteCall = BtfdUtils.encodeRemoteCall(remoteCall);
    const inscription = InscriptionUtils.createTextInscription(encodedRemoteCall);
    const commitPayment = InscriptionUtils.createCommitTx(network, fromPublicKey, inscription); 

    // Creating the commit transaction
    const mempool = mempoolJS();
    const addressTxsUtxo = await mempool.bitcoin.addresses.getAddressTxsUtxo({address: from});
    const commitInput = InscriptionUtils.standardInput(network, from, fromPublicKey, addressTxsUtxo);
    const inscriptionPsbt = InscriptionUtils.commitPsbt(network, commitPayment, commitInput);

    // Sign the PSBT, and return hex encoded result
    const commitPsbtHex = await signerHex(inscriptionPsbt);
    const commitPsbt = Psbt.fromHex(commitPsbtHex);
  }

  private static async createRevealPsbt(from: string, psbt: Psbt, remoteCall: BtfdRemoteCall): Promise<void> {
    // TODO: Implement the logic for creating the reveal PSBT
    // 1. Add input UTXO from remoteCall, including sats sent to QP_WALLET
    // psbt.addInput({
    //   hash: ..., // Transaction hash of the UTXO
    //   index: ..., // Output index of the UTXO
    //   witnessUtxo: ..., // Witness UTXO data
    // });
    
    // 2. Add outputs (reveal transaction output, change output if needed)
    // psbt.addOutput({
    //   address: remoteCall.beneficiary,
    //   value: ..., // Calculate the correct value based on remoteCall.amount and fees
    // });
    
    // 3. Add any necessary metadata
    // psbt.addOutput({
    //   script: ..., // Any additional script data needed for the reveal transaction
    //   value: 0, // OP_RETURN outputs typically have 0 value
    // });
  }

  // TODO: Add any additional helper methods as needed
}
