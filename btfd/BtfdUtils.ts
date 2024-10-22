import { Psbt, Network, Payment, Transaction, networks } from 'bitcoinjs-lib';
import { AbiCoder } from 'ethers';
import { Buffer } from 'buffer';
import { CommitInput, InscriptionUtils } from './InscriptionUtils';
import { NetworkFeeEstimator } from './NetworkFeeEstimator';
import { BlockstreamUtxoProvider, IUtxoProvider, MempoolUtxoProvider } from './IUtxoProvider';
import { assert } from 'console';
import { randomBytes } from 'crypto';

const BTFD_CHAIN_ID = {
  [networks.regtest.wif]: 21321,
  [networks.bitcoin.wif]: 12000, // TODO: Replace btfd chain ID
}

const BITCOIN_CONTRACT = {
  [networks.regtest.wif]: '0x0987654321098765432109876543210987654321',
  [networks.bitcoin.wif]: '0x0987654321098765432109876543210987654321', // TODO: Replace btfd chain ID
}


export interface BtfdRemoteCall {
  remoteChainId: number,
  remoteContract: string,
  remoteMethodCall: string,
  salt: string,
  beneficiary: string,
  amountSats: bigint,
  feeSats: bigint,
}

export interface CreatePsbtOptions {
  signerWillFinalize?: boolean;
  feeRate?: number
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
    options: CreatePsbtOptions = { signerWillFinalize: false },
    ): Promise<[Transaction, Transaction]> {
    assert(!!network, 'network is required');
    assert(!!from, 'from is required');
    assert(!!fromPublicKey, 'fromPublicKey is required');
    assert(!!remoteCall, 'remoteCall is required');
    assert(!!qpAddress, 'qpAddress is required');
    assert(!!utxoProvider, 'utxoProvider is required');
    assert(!!signerToHex, 'signerToHex is required');

    // Create the inscription PSBT
    const [commitTx, commitPayment, commitInput] = await BtfdUtils.createInscriptionPsbt(
      network, from, fromPublicKey, remoteCall, qpAddress, signerToHex, utxoProvider, options);

    // Create the reveal PSBT
    const revealPsbt = await this.createRevealPsbt(
      network,
      qpAddress,
      commitInput.sendAmountCommit,
      commitInput.sendAmountReveal,
      commitPayment,
      commitTx.getHash(),
      signerToHex,
      options);
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
      options: CreatePsbtOptions,
      ): Promise<[Transaction, Payment, CommitInput]> {
    const encodedRemoteCall = BtfdUtils.encodeRemoteCall(remoteCall);
    const inscription = InscriptionUtils.createTextInscription(encodedRemoteCall);
    const commitOutput = InscriptionUtils.createCommitTx(network, fromPublicKey, inscription); 
    const feeRate = options.feeRate || await utxoProvider.getFeeRate();

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
    let inscriptionPsbt = InscriptionUtils.commitPsbt(network, commitOutput, commitInput);

    // Sign the PSBT, and return hex encoded result
    const commitPsbtHex = await signerHex(inscriptionPsbt);
    inscriptionPsbt =Psbt.fromHex(commitPsbtHex);
    if (!options.signerWillFinalize) {
      inscriptionPsbt =  InscriptionUtils.finalizeCommitPsbt(inscriptionPsbt);
    }
    return [inscriptionPsbt.extractTransaction(), commitOutput, commitInput];
  }

  private static async createRevealPsbt(
      network: Network,
      qpAddress: string,
      commitedAmount: bigint,
      sendAmount: bigint,
      commitPayment: Payment,
      commitTxId: Uint8Array,
      signerToHex: (t: Psbt) => Promise<string>,
      options: CreatePsbtOptions,
    ): Promise<Transaction> {
    let reveal = InscriptionUtils.createRevealPsbt(network, qpAddress, commitedAmount, sendAmount, commitPayment, commitTxId);

    // Sign the PSBT, and return hex encoded result
    const revealPsbtHex = await signerToHex(reveal);
    reveal = Psbt.fromHex(revealPsbtHex);
    if (!options.signerWillFinalize) {
      reveal =  InscriptionUtils.finalizeCommitPsbt(reveal);
    }
    // const revealPsbt =  InscriptionUtils.finalizeRevealPsbt(Psbt.fromHex(revealPsbtHex), commitPayment);
    return reveal.extractTransaction();
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

export class BtfdCommonCalls {
  static remoteTransferBtc(network: Network, to: string, amountSats: string, feeSats: string): BtfdRemoteCall {
    return {
      remoteChainId: BTFD_CHAIN_ID[network.wif],
      remoteContract: BITCOIN_CONTRACT[network.wif],
      remoteMethodCall: '0x1234567890abcdef', // remoteaTransfer TODO: Replace with actual method call
      amountSats: BigInt(amountSats),
      feeSats: BigInt(feeSats),
      beneficiary: to,
      salt: '0x' + randomBytes(32).toString('hex'),
    } as BtfdRemoteCall;
  }
}