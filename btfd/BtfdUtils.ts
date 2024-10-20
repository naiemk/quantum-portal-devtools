import { Psbt, Network, Payment, Transaction } from 'bitcoinjs-lib';
import { AbiCoder } from 'ethers';
import { Buffer } from 'buffer';
import { CommitInput, InscriptionUtils } from './InscriptionUtils';
import mempoolJS from '@mempool/mempool.js';
import { AddressTxsUtxo, MempoolReturn } from '@mempool/mempool.js/lib/interfaces';
import { NetworkFeeEstimator } from './NetworkFeeEstimator';

export interface BtfdRemoteCall {
  remoteChainId: number,
  remoteContract: string,
  remoteMethodCall: string,
  salt: string,
  beneficiary: string,
  amountSats: bigint,
  feeSats: bigint,
}

export class BtfdUtils {
  static encodeRemoteCall(remoteCall: BtfdRemoteCall): string {
    return new AbiCoder().encode(
      ['uint256', 'address', 'bytes', 'address', 'bytes32'],
      [remoteCall.remoteChainId,
      remoteCall.remoteContract,
      remoteCall.remoteMethodCall,
      remoteCall.beneficiary,
      remoteCall.salt]);
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
    const [commitTx, commitPayment, commitInput] = await BtfdUtils.createInscriptionPsbt(
      network, from, fromPublicKey, remoteCall, qpAddress, signerToHex, utxoProvider);

    // Create the reveal PSBT
    const revealPsbt = await this.createRevealPsbt(
      network,
      qpAddress,
      commitInput.sendAmountCommit,
      commitInput.sendAmountReveal,
      commitPayment,
      commitTx.getHash(),
      signerToHex);
    return [commitTx, revealPsbt];
  }

  private static async createInscriptionPsbt(
      network: Network,
      from: string,
      fromPublicKey: Buffer,
      remoteCall: BtfdRemoteCall,
      qpAddress: string,
      signerHex: (p: Psbt) => Promise<string>,
      utxoProvider: IUtxoProvider,
      ): Promise<[Transaction, Payment, CommitInput]> {
    const encodedRemoteCall = BtfdUtils.encodeRemoteCall(remoteCall);
    const inscription = InscriptionUtils.createTextInscription(encodedRemoteCall);
    const commitOutput = InscriptionUtils.createCommitTx(network, fromPublicKey, inscription); 
    const feeRate = await utxoProvider.getFeeRate();

    // Creating the commit transaction
    const commitInput = await InscriptionUtils.standardInput(
      network,
      from,
      fromPublicKey,
      remoteCall.amountSats + remoteCall.feeSats,
      NetworkFeeEstimator.estimateFee(
        feeRate, NetworkFeeEstimator.estimateLenForCommit(NetworkFeeEstimator.inputType(from, network))),
      NetworkFeeEstimator.estimateFee(
        feeRate, NetworkFeeEstimator.estimateLenForInscription(inscription.content.length, NetworkFeeEstimator.inputType(qpAddress, network))),
      utxoProvider);
    const inscriptionPsbt = InscriptionUtils.commitPsbt(network, commitOutput, commitInput);

    // Sign the PSBT, and return hex encoded result
    const commitPsbtHex = await signerHex(inscriptionPsbt);
    const commitPsbt =  InscriptionUtils.finalizeCommitPsbt(Psbt.fromHex(commitPsbtHex));
    return [commitPsbt.extractTransaction(), commitOutput, commitInput];
  }

  private static async createRevealPsbt(
      network: Network,
      qpAddress: string,
      commitedAmount: bigint,
      sendAmount: bigint,
      commitPayment: Payment,
      commitTxId: Uint8Array,
      signerToHex: (t: Psbt) => Promise<string>,
    ): Promise<Transaction> {
    const reveal = InscriptionUtils.createRevealPsbt(network, qpAddress, commitedAmount, sendAmount, commitPayment, commitTxId);

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
  getFeeRate(): Promise<number>;
  getUtxos(address: string): Promise<AddressTxsUtxo[]>;
  txBlobByHash(hash: string): Promise<Buffer>;
  broadcastTx(tx: string): Promise<string>;
}

class MempoolUtxoProvider implements IUtxoProvider {
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

class BlockstreamUtxoProvider implements IUtxoProvider {
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