import { BtfdUtils, BtfdRemoteCall } from './BtfdUtils';
import { networks, Psbt, payments, Transaction } from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import { Buffer } from 'buffer';

// Explicitly import Jest types
import { jest, expect, describe, it } from '@jest/globals';

// Define the type for UTXO
type UTXO = {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
};

// Mock the mempoolJS function
jest.mock('@mempool/mempool.js', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      bitcoin: {
        addresses: {
          getAddressTxsUtxo: (jest.fn().mockResolvedValue as any)([
            {
              txid: 'dummy_txid',
              vout: 0,
              value: 100000000, // 1 BTC
              status: {
                confirmed: true,
                block_height: 123456,
                block_hash: 'dummy_block_hash',
                block_time: 1600000000,
              },
            } as UTXO,
          ] as UTXO[]),
        },
      },
    })),
  };
});

const ECPair = ECPairFactory(ecc);

describe('BtfdUtils System Test', () => {
  it('should create PSBT and extract transactions', async () => {
    const remoteCall: BtfdRemoteCall = {
      remoteChainId: 1,
      remoteContract: '0x1234567890123456789012345678901234567890',
      remoteMethodCall: '0x1234567890abcdef',
      beneficiary: '0x0987654321098765432109876543210987654321',
      amount: '0.001',
      fee: '0.0001',
    };

    const network = networks.testnet;
    const qpAddress = 'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7';

    const keyPair = ECPair.makeRandom({ network });
    const { address } = payments.p2wpkh({ pubkey: keyPair.publicKey, network });

    if (!address) throw new Error('Failed to generate address');

    const mockSignerToHex = jest.fn((psbt: Psbt) => {
      psbt.signAllInputs(keyPair);
      return Promise.resolve(psbt.toHex());
    });

    const [commitTx, revealTx] = await BtfdUtils.createPsbt(
      network,
      qpAddress,
      address,
      Buffer.from(keyPair.publicKey),
      remoteCall,
      mockSignerToHex
    );

    // Verify commit transaction
    expect(commitTx).toBeInstanceOf(Transaction);
    expect(commitTx.outs.length).toBe(1);
    expect(commitTx.ins.length).toBe(1);
    expect(commitTx.outs[0].value).toBeGreaterThan(0);

    // Verify reveal transaction
    expect(revealTx).toBeInstanceOf(Transaction);
    expect(revealTx.outs.length).toBe(1);
    expect(revealTx.ins.length).toBe(1);

    // Verify that the reveal transaction spends the commit transaction output
    expect(revealTx.ins[0].hash.toString('hex')).toBe(commitTx.getId());

    // Verify that mockSignerToHex was called twice (once for commit, once for reveal)
    expect(mockSignerToHex).toBeCalledTimes(2);

    // Verify that the qpAddress is the recipient of the reveal transaction
    const qpAddressOutput = revealTx.outs.find(out => {
      const outAddress = payments.p2wpkh({ output: out.script, network }).address;
      return outAddress === qpAddress;
    });
    expect(qpAddressOutput).toBeDefined();
    
    if (qpAddressOutput) {
      // Verify the amount sent to qpAddress matches the remoteCall amount
      const satoshis = Math.floor(parseFloat(remoteCall.amount) * 100000000);
      expect(qpAddressOutput.value).toBe(satoshis);
    }

    // Verify the encoded remote call in the OP_RETURN output
    const opReturnOutput = commitTx.outs.find(out => out.script[0] === 0x6a); // OP_RETURN
    expect(opReturnOutput).toBeDefined();
    if (opReturnOutput) {
      const encodedRemoteCall = opReturnOutput.script.slice(2).toString('base64');
      const decodedRemoteCall = Buffer.from(encodedRemoteCall, 'base64').toString('hex');
      expect(decodedRemoteCall).toContain(remoteCall.remoteContract.slice(2).toLowerCase());
      expect(decodedRemoteCall).toContain(remoteCall.remoteMethodCall.slice(2).toLowerCase());
      expect(decodedRemoteCall).toContain(remoteCall.beneficiary.slice(2).toLowerCase());
    }
  });
});