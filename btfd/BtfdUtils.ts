import { Psbt, Network, Payment, Transaction } from 'bitcoinjs-lib';
import { AbiCoder } from 'ethers';
import { Buffer } from 'buffer';
import { InscriptionUtils } from './InscriptionUtils';
import mempoolJS from '@mempool/mempool.js';
import { AddressTxsUtxo } from '@mempool/mempool.js/lib/interfaces';

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
    return new AbiCoder().encode(
      ['uint256', 'address', 'bytes', 'address'],
      [remoteCall.remoteChainId,
      remoteCall.remoteContract,
      remoteCall.remoteMethodCall,
      remoteCall.beneficiary]);
  }

  static async createPsbt(
    network: Network,
    qpAddress: string,
    from: string,
    fromPublicKey: Buffer,
    remoteCall: BtfdRemoteCall,
    signerToHex: (t: Psbt) => Promise<string>,
    utxoProvider: IUtxoProvider = BtfdUtils.utxoProvider(network, 'http://localhost:3000', 'blockstream'),
    ): Promise<[Transaction, Transaction]> {

    // Create the inscription PSBT
    const [commitTx, commitPayment] = await BtfdUtils.createInscriptionPsbt(network, from, fromPublicKey, remoteCall, signerToHex, utxoProvider);

    const txid = await utxoProvider.broadcastTx(commitTx.toHex());
    console.log('Commit txid:', txid);

    // Create the reveal PSBT
    const revealPsbt = await this.createRevealPsbt(network, qpAddress, from, fromPublicKey, commitTx, commitPayment, remoteCall, signerToHex, utxoProvider);

    return [commitTx, revealPsbt];
  }

  private static async createInscriptionPsbt(
      network: Network,
      from: string,
      fromPublicKey: Buffer,
      remoteCall: BtfdRemoteCall,
      signerHex: (p: Psbt) => Promise<string>,
      utxoProvider: IUtxoProvider,
      ): Promise<[Transaction, Payment]> {
    const encodedRemoteCall = BtfdUtils.encodeRemoteCall(remoteCall);
    const inscription = InscriptionUtils.createTextInscription(encodedRemoteCall);
    const commitOutput = InscriptionUtils.createCommitTx(network, fromPublicKey, inscription); 

    // Creating the commit transaction
    const commitInput = await InscriptionUtils.standardInput(network, from, fromPublicKey, utxoProvider);
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
      utxoProvider: IUtxoProvider,
    ): Promise<Transaction> {
    // TODO: Take the amount for the commit tx fee, from commitPsbt inputs, out of the utxo from addressTxsUtxo
    const revealPayment = await InscriptionUtils.standardInput(network, from, fromPublicKey, utxoProvider);
    const reveal = InscriptionUtils.createRevealPsbt(network, qpAddress, revealPayment, commitPayment, commitTx);

    // Sign the PSBT, and return hex encoded result
    const revealPsbtHex = await signerToHex(reveal);
    const revealPsbt =  InscriptionUtils.finalizeCommitPsbt(Psbt.fromHex(revealPsbtHex));
    // const revealPsbt =  InscriptionUtils.finalizeRevealPsbt(Psbt.fromHex(revealPsbtHex), commitPayment);
    return revealPsbt.extractTransaction();
  }

  static utxoProvider(network: Network, endpoint: string, serverType: 'mempool' | 'blockstream'): IUtxoProvider {
    if (serverType === 'mempool') {
      return new MempoolUtxoProvider(endpoint);
    }
    if (serverType === 'blockstream') {
      return new BlockstreamUtxoProvider(endpoint);
    }
    throw new Error('Server type not supported');
  }
}

export function assert(condition: any, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

export interface IUtxoProvider {
  getUtxos(address: string): Promise<AddressTxsUtxo[]>;
  txBlobByHash(hash: string): Promise<Buffer>;
  broadcastTx(tx: string): Promise<string>;
}

class MempoolUtxoProvider implements IUtxoProvider {
  private mempool: any;
  constructor(endpoint: string) {
    this.mempool = mempoolJS({ hostname: endpoint });
  }

  async getUtxos(address: string): Promise<AddressTxsUtxo[]> {
    return this.mempool.bitcoin.addresses.getAddressTxsUtxo({address});
  }

  async txBlobByHash(hash: string): Promise<Buffer> {
    return this.mempool.bitcoin.transactions.getTransactionByHash({hash});
  }

  async broadcastTx(tx: string): Promise<string> {
    return this.mempool.bitcoin.transactions.broadcastTransaction({tx});
  }
}

class BlockstreamUtxoProvider implements IUtxoProvider {
  private endpoint: string;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
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