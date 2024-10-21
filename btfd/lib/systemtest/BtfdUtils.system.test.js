import { networks, payments } from 'bitcoinjs-lib';
// Explicitly import Jest types
import { expect, describe, it } from '@jest/globals';
import { BtfdUtils } from '../BtfdUtils';
import { ECPairFactory } from 'ecpair';
import bs58check from 'bs58check';
import * as ecc from 'tiny-secp256k1';
import { randomBytes } from 'crypto';
const ECPair = ECPairFactory(ecc);
describe('BtfdUtils System Test', () => {
    it('Create Psbts', async () => {
        const remoteCall = {
            remoteChainId: 1,
            remoteContract: '0x1234567890123456789012345678901234567890',
            remoteMethodCall: '0x1234567890abcdef',
            beneficiary: '0x0987654321098765432109876543210987654321',
            salt: '0x' + randomBytes(32).toString('hex'),
            amountSats: BigInt(1000000),
            feeSats: BigInt(1000),
        };
        const QP_ADDRESS = '2MxFYZjevGc9Xm8m3ackiSrcj4YQ2i4uMGH';
        const from = '2NBNwx58nRuajywbNs8ZZztZBi4A3vMeomT';
        const fromSkRaw = bs58check.decode('cSomyfhDmXx8qqNu6zpmn4SBYiLDUrU7Fn2pNob9XRpU6MfemnXu');
        const ver = fromSkRaw[0] & 0xff;
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
        expect(address).toBe(from); //'Addresses could not be confirmed');
        const provider = BtfdUtils.utxoProvider(networks.regtest, 'http://localhost:3000', 'blockstream');
        const [tx1, tx2] = await BtfdUtils.createPsbt(networks.regtest, QP_ADDRESS, from, Buffer.from(fromPk), remoteCall, async (psbt) => {
            const signer = ECPair.fromPrivateKey(fromSk);
            return psbt.signInput(0, signer).toHex();
        }, provider);
        const txid1 = await provider.broadcastTx(tx1.toHex());
        console.log('Txid1:', txid1);
        const txid2 = await provider.broadcastTx(tx2.toHex());
        console.log('Txid2:', txid2);
        console.log('Transactions', tx1, tx2);
    }, 1000 * 10000);
});
//# sourceMappingURL=BtfdUtils.system.test.js.map