import { script, opcodes, payments, Network, Payment, Psbt, initEccLib } from 'bitcoinjs-lib';
import { TransactionInput } from 'bitcoinjs-lib/src/psbt'
import { PsbtInput } from 'bip174';
import { Buffer } from 'buffer';
//@ts-ignore
import assert from 'minimalistic-assert';
import {
  LEAF_VERSION_TAPSCRIPT,
  tapleafHash,
} from 'bitcoinjs-lib/src/payments/bip341';
import { AddressTxsUtxo } from '@mempool/mempool.js/lib/interfaces';
import * as ecc from 'tiny-secp256k1';

// Initialize the ECC library
initEccLib(ecc);

const encoder = new TextEncoder()

export interface Inscription {
  contentType: Buffer,
  content: Buffer,
  postage: number,
}

export interface CommitInput {
  input: PsbtInput&TransactionInput,
  sendAmount: bigint,
  refundAddress: string,
  refundAmount: bigint,
  fee: bigint,
}

export class InscriptionUtils {
  static createTextInscription(text: string, postage: number = 10000): Inscription {
    const contentType = Buffer.from(encoder.encode('text/plain;base64'));
    const content = Buffer.from(text, 'base64');
    return { contentType, content, postage }
  }

  static createCommitTx(network: Network, publicKey: Buffer, inscription: Inscription): Payment {
    assert(publicKey, 'encodePublic is required')
    assert(inscription, 'inscription is required')
    const xOnlyPublicKey = toXOnly(publicKey)
    const code = createInscriptionScript(xOnlyPublicKey, inscription);
    const outputScript = script.compile(code);

    const scriptTree = {
      output: outputScript,
      redeemVersion: LEAF_VERSION_TAPSCRIPT,
    }

    const scriptTaproot = payments.p2tr({
      internalPubkey: xOnlyPublicKey,
      scriptTree,
      redeem: scriptTree,
      network,
    })
    assert(!!scriptTaproot?.hash, 'scriptTaproot.hash was note created');
    return scriptTaproot!;
  }

  static commitPsbt(network: Network, commitPayment: Payment, commitInput: CommitInput): Psbt {
    assert(network, 'network is required');
    assert(commitPayment, 'commitPayment is required');
    assert(commitInput, 'input is required');
    // Create a new Psbt (Partially Signed Bitcoin Transaction)
    const psbt = new Psbt({ network });

    // Add the UTXOs as inputs to the transaction
    psbt.addInput({
      ...commitInput.input,
      witnessUtxo: {
        script: commitPayment.output!,
        value: commitInput.sendAmount + commitInput.fee,
      },
      tapInternalKey: commitPayment.internalPubkey,
      tapMerkleRoot: commitPayment.hash,
      tapLeafScript: [
        {
          leafVersion: commitPayment.redeemVersion!,
          script: commitPayment.redeem!.output!,
          controlBlock: commitPayment.witness![commitPayment.witness!.length - 1],
        },
      ],
    });

    psbt.addOutput({
      value: commitInput.sendAmount,
      address: commitPayment.address!,
    });
    psbt.addOutput({
      value: commitInput.refundAmount,
      address: commitInput.refundAddress,
    });
    return psbt;
  }

  static finalizeCommitPsbt(psbt: Psbt) {
    assert(psbt, 'psbt is required');
    psbt.finalizeAllInputs();
    return psbt;
  }

  static standardInput(network: Network, address: string, publicKey: Buffer, utxos: AddressTxsUtxo[]): CommitInput {
    assert(network, 'network is required');
    assert(address, 'address is required');
    assert(publicKey, 'publicKey is required');
    assert(utxos.length > 0, 'utxos is required');

    const sendAmount = BigInt(1000);
    const fee = BigInt(500);

    // Find the first UTXO with more than sendAmount + fee
    const utxo = utxos.find(utxo => BigInt(utxo.value) > sendAmount + fee);
    assert(!!utxo, 'No UTXO found with enough value to send the inscription');

    const refundAmount = BigInt(utxo!.value) - sendAmount - fee;

    // Identify the type of bitcoin address
    let addressType: string;
    let input: PsbtInput & TransactionInput;

    if (address.startsWith('1') || address.startsWith('m') || address.startsWith('n')) {
      addressType = 'p2pkh';
    } else if (address.startsWith('3') || address.startsWith('2')) {
      addressType = 'p2sh';
    } else if (address.startsWith('bc1q') || address.startsWith('tb1q')) {
      addressType = 'p2wpkh';
    } else if (address.startsWith('bc1p') || address.startsWith('tb1p')) {
      addressType = 'p2tr';
    } else {
      throw new Error('Unsupported address type: ' + address);
    }

    // Create the appropriate input based on the address type
    switch (addressType) {
      case 'p2pkh':
        input = {
          hash: utxo!.txid,
          index: utxo!.vout,
          nonWitnessUtxo: Buffer.from(utxo!.txid, 'hex'), // This should be the full transaction, not just the txid
        };
        break;
      case 'p2sh':
        input = {
          hash: utxo!.txid,
          index: utxo!.vout,
          redeemScript: payments.p2sh({ redeem: { output: script.compile([publicKey, opcodes.OP_CHECKSIG]), network } }).redeem!.output!,
        };
        break;
      case 'p2wpkh':
        input = {
          hash: utxo!.txid,
          index: utxo!.vout,
          witnessUtxo: {
            script: payments.p2wpkh({ pubkey: publicKey, network }).output!,
            value: BigInt(utxo!.value),
          },
        };
        break;
      case 'p2tr':
        input = {
          hash: utxo!.txid,
          index: utxo!.vout,
          witnessUtxo: {
            script: payments.p2tr({ internalPubkey: toXOnly(publicKey), network }).output!,
            value: BigInt(utxo!.value),
          },
          tapInternalKey: toXOnly(publicKey),
        };
        break;
      default:
        throw new Error('Unsupported address type');
    }

    return {
      input,
      sendAmount,
      refundAddress: address,
      refundAmount,
      fee,
    };
  }
}

function toXOnly(pubkey: Buffer) {
  return pubkey.subarray(1, 33)
}

function createInscriptionScript(xOnlyPublicKey: Buffer, inscription: Inscription) {
  assert(inscription, `inscription is required`)
  const protocolId = Buffer.from(encoder.encode('ord'))
  return [
    xOnlyPublicKey,
    opcodes.OP_CHECKSIG,
    opcodes.OP_0,
    opcodes.OP_IF,
    protocolId,
    1,
    1, // ISSUE, Buffer.from([1]) is replaced to 05 rather asMinimalOP than 0101 here https://github.com/bitcoinjs/bitcoinjs-lib/blob/master/src/script.js#L53
    // this may not be an issue but it generates a different script address. Unsure if ordinals indexer detect 05 as the content type separator
    inscription.contentType,
    opcodes.OP_0,
    inscription.content,
    opcodes.OP_ENDIF,
  ]
}
