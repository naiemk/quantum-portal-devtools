import { expect, test, describe } from "bun:test";
import { InscriptionUtils } from './InscriptionUtils';
import { Network, networks, Psbt } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { AddressTxsUtxo } from '@mempool/mempool.js/lib/interfaces';

const ECPair = ECPairFactory(ecc);

describe('InscriptionUtils', () => {
  const network: Network = networks.testnet;
  const keyPair = ECPair.makeRandom({ network });
  const publicKey = Buffer.from(keyPair.publicKey);

  console.log('Test setup - Public Key:', publicKey.toString('hex'));

  const validUtxo: AddressTxsUtxo = {
    txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    vout: 0,
    status: {
      confirmed: true,
      block_height: 700000,
      block_hash: 'blockhash',
      block_time: 1600000000,
    },
    value: 2000,
  };

  const invalidUtxo: AddressTxsUtxo = {
    ...validUtxo,
    value: 1000, // Not enough for sendAmount + fee
  };

  describe('createTextInscription', () => {
    test('should create a valid text inscription', () => {
      const text = 'Hello, World!';
      const inscription = InscriptionUtils.createTextInscription(text);

      expect(inscription.contentType).toEqual(Buffer.from('text/plain;base64'));
      expect(inscription.content).toEqual(Buffer.from(text, 'base64'));
      expect(inscription.postage).toBe(10000);
    });
  });

  describe('createCommitTx', () => {
    test('should create a valid commit transaction', () => {
      const inscription = InscriptionUtils.createTextInscription('Hello, World!');
      const commitTx = InscriptionUtils.createCommitTx(network, publicKey, inscription);

      expect(commitTx).toBeDefined();
      expect(commitTx.address).toBeDefined();
      expect(commitTx.output).toBeDefined();
      expect(commitTx.redeem).toBeDefined();
      console.log('Commit transaction address:', commitTx.address);
    });
  });

  describe('commitPsbt', () => {
    test('should create a valid PSBT', () => {
      const inscription = InscriptionUtils.createTextInscription('Hello, World!');
      const commitTx = InscriptionUtils.createCommitTx(network, publicKey, inscription);
      console.log('Commit transaction address:', commitTx.address);
      const commitInput = InscriptionUtils.standardInput(network, commitTx.address!, publicKey, [validUtxo]);
      const psbt = InscriptionUtils.commitPsbt(network, commitTx, commitInput);

      expect(psbt).toBeDefined();
      expect(psbt.txInputs.length).toBe(1);
      expect(psbt.txOutputs.length).toBe(2);
    });
  });

  describe('finalizeCommitPsbt', () => {
    test('should finalize the PSBT', () => {
      const inscription = InscriptionUtils.createTextInscription('Hello, World!');
      const commitTx = InscriptionUtils.createCommitTx(network, publicKey, inscription);
      console.log('Commit transaction address:', commitTx.address);
      const commitInput = InscriptionUtils.standardInput(network, commitTx.address!, publicKey, [validUtxo]);
      const psbt = InscriptionUtils.commitPsbt(network, commitTx, commitInput);

      console.log('PSBT before signing:', psbt.toBase64());

      // Sign the PSBT
      psbt.data.inputs.forEach((input, index) => {
        try {
          psbt.signInput(index, keyPair);
          console.log(`Input ${index} signed successfully`);
        } catch (error) {
          console.error(`Error signing input ${index}:`, error);
        }
      });

      console.log('PSBT after signing:', psbt.toBase64());

      const finalizedPsbt = InscriptionUtils.finalizeCommitPsbt(psbt);
      expect(finalizedPsbt).toBeDefined();

      const isValid = finalizedPsbt.validateSignaturesOfAllInputs(ecc.verify);
      console.log('Signature validation result:', isValid);
      expect(isValid).toBe(true);

      // Extract the transaction
      const tx = finalizedPsbt.extractTransaction();
      expect(tx).toBeDefined();
      expect(tx.ins.length).toBe(1);
      expect(tx.outs.length).toBe(2);
    });
  });

  // Existing tests for standardInput...
  describe('standardInput', () => {
    test('should create correct input for p2pkh address', () => {
      const address = 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'; // testnet p2pkh address
      const result = InscriptionUtils.standardInput(network, address, publicKey, [validUtxo]);
      
      expect(result.input.hash).toBe(validUtxo.txid);
      expect(result.input.index).toBe(validUtxo.vout);
      expect(result.input.nonWitnessUtxo).toBeDefined();
      expect(result.sendAmount).toBe(BigInt(1000));
      expect(result.refundAddress).toBe(address);
      expect(result.refundAmount).toBe(BigInt(500));
      expect(result.fee).toBe(BigInt(500));
    });

    test('should create correct input for p2sh address', () => {
      const address = '2N3wh1eYqMeqoLxuKFv8PBsYR4f8gYn8dHm'; // testnet p2sh address
      const result = InscriptionUtils.standardInput(network, address, publicKey, [validUtxo]);
      
      expect(result.input.hash).toBe(validUtxo.txid);
      expect(result.input.index).toBe(validUtxo.vout);
      expect(result.input.redeemScript).toBeDefined();
      expect(result.sendAmount).toBe(BigInt(1000));
      expect(result.refundAddress).toBe(address);
      expect(result.refundAmount).toBe(BigInt(500));
      expect(result.fee).toBe(BigInt(500));
    });

    test('should create correct input for p2wpkh address', () => {
      const address = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'; // testnet p2wpkh address
      const result = InscriptionUtils.standardInput(network, address, publicKey, [validUtxo]);
      
      expect(result.input.hash).toBe(validUtxo.txid);
      expect(result.input.index).toBe(validUtxo.vout);
      expect(result.input.witnessUtxo).toBeDefined();
      expect(result.input.witnessUtxo!.value).toBe(BigInt(validUtxo.value));
      expect(result.sendAmount).toBe(BigInt(1000));
      expect(result.refundAddress).toBe(address);
      expect(result.refundAmount).toBe(BigInt(500));
      expect(result.fee).toBe(BigInt(500));
    });

    test('should create correct input for p2tr address', () => {
      const address = 'tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c'; // testnet p2tr address
      const result = InscriptionUtils.standardInput(network, address, publicKey, [validUtxo]);
      
      expect(result.input.hash).toBe(validUtxo.txid);
      expect(result.input.index).toBe(validUtxo.vout);
      expect(result.input.witnessUtxo).toBeDefined();
      expect(result.input.witnessUtxo!.value).toBe(BigInt(validUtxo.value));
      expect(result.input.tapInternalKey).toBeDefined();
      expect(result.sendAmount).toBe(BigInt(1000));
      expect(result.refundAddress).toBe(address);
      expect(result.refundAmount).toBe(BigInt(500));
      expect(result.fee).toBe(BigInt(500));
    });

    test('should throw error for unsupported address type', () => {
      const address = 'unsupported_address_type';
      expect(() => {
        InscriptionUtils.standardInput(network, address, publicKey, [validUtxo]);
      }).toThrow('Unsupported address type');
    });

    test('should throw error when no valid UTXO is found', () => {
      const address = 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn'; // testnet p2pkh address
      expect(() => {
        InscriptionUtils.standardInput(network, address, publicKey, [invalidUtxo]);
      }).toThrow('No UTXO found with enough value to send the inscription');
    });
  });
});