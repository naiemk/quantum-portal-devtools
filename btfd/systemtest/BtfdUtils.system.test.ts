import { networks, payments } from 'bitcoinjs-lib';
// Explicitly import Jest types
import { jest, expect, describe, it } from '@jest/globals';
import { BtfdRemoteCall, BtfdUtils } from '../BtfdUtils';
import { ECPairFactory } from 'ecpair';
import bs58check from 'bs58check';
import * as ecc from 'tiny-secp256k1';
const ECPair = ECPairFactory(ecc);

describe('BtfdUtils System Test', () => {
  it('Create Psbts', async () => {
    const remoteCall: BtfdRemoteCall = {
      remoteChainId: 1,
      remoteContract: '0x1234567890123456789012345678901234567890',
      remoteMethodCall: '0x1234567890abcdef',
      beneficiary: '0x0987654321098765432109876543210987654321',
      amount: '0.001',
      fee: '0.0001',
    };
    const QP_ADDRESS = '2MxFYZjevGc9Xm8m3ackiSrcj4YQ2i4uMGH';
    const from = '2NBNwx58nRuajywbNs8ZZztZBi4A3vMeomT';
    const fromSkRaw = bs58check.decode('cSomyfhDmXx8qqNu6zpmn4SBYiLDUrU7Fn2pNob9XRpU6MfemnXu');
    const ver = fromSkRaw[0]&0xff;
    const isCompressed = fromSkRaw.length === 33 + 1;
    const fromSk = isCompressed ? fromSkRaw.subarray(1, fromSkRaw.length - 1) : fromSkRaw.subarray(1);
    console.log('Private key version:', ver);
    const fromPk = ECPair.fromPrivateKey(fromSk).publicKey;

    // Double check the keys
    const { address } = payments.p2sh({
      redeem: payments.p2wpkh({ pubkey: fromPk, network: networks.regtest }),
      network: networks.regtest,
    });
    console.log('Address:', address, 'compared to ', from);
    expect(address!).toBe(from); //'Addresses could not be confirmed');

    const provider = BtfdUtils.utxoProvider(networks.regtest, 'http://localhost:3000', 'blockstream');
    const signer = ECPair.fromPrivateKey(fromSk);
    const [tx1, tx2] = await BtfdUtils.createPsbt(
      networks.regtest,
      QP_ADDRESS,
      from,
      Buffer.from(fromPk),
      remoteCall,
      async psbt => psbt.signAllInputs(signer).toHex(),
      // async (psbt: Psbt) => {
      //   psbt.signInput(0, signer)
      //   psbt.signInput(1, signer)
      //   return psbt.toHex();
      // },
      provider
    );
    // const txid1 = await provider.broadcastTx(Buffer.from(tx1.toHex(), 'hex'));
    const txid2 = await provider.broadcastTx(tx2.toHex());
    console.log('Txid1:', 'Txid2:', txid2);
    console.log('Transactions', tx1, tx2);
  }, 1000 * 10000);
});
