const bitcoin = require('bitcoinjs-lib');
const axios = require('axios');
const ecc = require('tiny-secp256k1');
const ElectrumClient = require('electrum-client');
const ECPair = ECPairFactory(ecc);
const { createTextInscription, createCommitTxData, createRevealTx, witnessStackToScriptWitness } = require('./inscription');
const btc = require('@scure/btc-signer');
const ordinals = require('micro-ordinals');
const { hex, utf8 } = require('@scure/base');
const { ethers } = require('ethers');
const crypto = require('crypto');
const { send } = require('process');
const { unmountComponentAtNode } = require('react-dom');
const privateKeyWIF = 'cVDUgUEahS1swavidSk1zdSHQpCy1Ac9XSQHkaxmZKcTTfEA5vTY';
const qpBTCAddress = 'mx5zVKcjohqsu4G8KJ83esVxN52XiMvGTY';
const rpcUrl = 'http://ghostnet.dev.svcs.ferrumnetwork.io/:18443'; // Regtest RPC URL
const rpcUser = 'admin1';
const rpcPassword = '123';
const regtest = { bech32: 'bcrt', pubKeyHash: 0x6f, scriptHash: 0xc4 };
const privKey = hex.decode('0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a');
const pubKey = btc.utils.pubSchnorr(privKey);
const customScripts = [ordinals.OutOrdinalReveal];

async function createCommitAndRevealTx(encoded_call) {
    const secret = 'fc7458de3d5616e7803fdc81d688b9642641be32fee74c4558ce680cac3d4111'
    const privateKey = Buffer.from(secret, 'hex')
    const keypair = ECPair.fromPrivateKey(privateKey, regtest);
    const publicKey = keypair.publicKey
    const { address } = bitcoin.payments.p2pkh({ pubkey: publicKey, network: bitcoin.networks.regtest });
    console.log({ address });
    // console.log("HERER");
    const network = bitcoin.networks.regtest;
    const inscription = createTextInscription({ text: encoded_call });
    const commitTxData = createCommitTxData({ publicKey, inscription });
    console.log(commitTxData);
    // Get the UTXOs (unspent transaction outputs) for the address
    var utxos = await getUTXOs(address, network);
    console.log("Got utxos", utxos);
    if (utxos.length === 0) {
        throw new Error('No UTXOs available for this address.');
    }
    // Create a new Psbt (Partially Signed Bitcoin Transaction)
    const psbt = new bitcoin.Psbt({ network });
    let sendAmount = 1000;
    const { cblock, scriptTaproot, outputScript } = commitTxData
    const tapLeafScript = {
        leafVersion: scriptTaproot.redeemVersion, // 192 0xc0
        script: outputScript,
        controlBlock: Buffer.from(cblock, 'hex'),
    }
    const utxo = utxos[0];
    // Add the UTXOs as inputs to the transaction
    psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: { value: utxo.value, script: scriptTaproot.output },
        tapLeafScript: [tapLeafScript],
    });
    psbt.addOutput({
        value: 1000, // generally 1000 for nfts, 549 for brc20
        address: "bcrt1pvu2s0vhdzlak28s2hh9trpksgaa2zeh8cjatwry8z2qdld769d8s0sr4rr",
    });
    psbt.addOutput({
        value: utxo.value - 1000 - 500, // generally 1000 for nfts, 549 for brc20
        address: address,
    });
    await psbt.signInput(0, keypair)
    console.log("processed utxos");
    //const signature = psbt.data.inputs[0].tapScriptSig[0].signature.toString('hex')
    // We have to construct our witness script in a custom finalizer
    const customFinalizer = (_inputIndex, input) => {
        const witness = [input.tapScriptSig[0].signature]
            .concat(outputScript)
            .concat(tapLeafScript.controlBlock)
        return {
            finalScriptWitness: witnessStackToScriptWitness(witness),
        }
    }
    psbt.finalizeInput(0, customFinalizer)
    const committx = psbt.extractTransaction();
    console.log(committx);
    const commitrawTx = committx.toBuffer().toString('hex')
    const committxId = committx.getId();
    const toAddress = 'bcrt1pvu2s0vhdzlak28s2hh9trpksgaa2zeh8cjatwry8z2qdld769d8s0sr4rr'
    const padding = 549
    const txSize = 600 + Math.floor(inscription.content.length / 4)
    const feeRate = 2
    const minersFee = txSize * feeRate
    const requiredAmount = 550 + minersFee + padding
    //expect(requiredAmount).toEqual(2301)
    const commitTxResult = {
        txId: committxId,
        sendUtxoIndex: 1,
        sendAmount: requiredAmount,
    }
    const revelRawTx = await createRevealTx({
        commitTxData,
        commitTxResult,
        toAddress,
        privateKey,
        amount: padding,
    });
    console.log(revelRawTx.txId);
    console.log(revelRawTx.rawTx);
    return { commit: committxId, reveal: revelRawTx.txId }
}
// Function to create, sign, and broadcast a Bitcoin transaction
async function createAndBroadcastTransaction(amount, privateKeyWIF, inscription, evm_address, method, target_address, chain_id) {
    try {
        // Setup network parameters for regtest
        const network = bitcoin.networks.regtest;
        const { commit, reveal } = await createCommitAndRevealTx(inscription);
        let commitBroadcastResult = await broadcastTransactionToElectrum(commit);
        let revealBroadcastResult = await broadcastTransactionToElectrum(reveal);
        // Decode the private key (WIF format) to keypair
        const privateKey = Buffer.from(privateKeyWIF, 'hex')
        const keyPair = ECPair.fromPrivateKey(privateKey, network);
        console.log(keyPair);
        const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network: bitcoin.networks.regtest });
        console.log({ address });
    } catch (error) {
        console.error('Error creating or broadcasting transaction:', error);
    }
}
// Function to list unspent transaction outputs (UTXOs)
async function getUTXOs(address, network) {
    const client = new ElectrumClient(50000, 'localhost', 'tcp');
    await client.connect();
    console.log("Connected");
    const scriptHash = bitcoin.crypto.sha256(Buffer.from(bitcoin.address.toOutputScript(address, network))).reverse().toString('hex');
    const utxos = await client.blockchainScripthash_listunspent(scriptHash);
    // const header = await client.blockchain_relayfee();
    console.log('utxos:', utxos)
    return await Promise.all(utxos.map(async utxo => {
        const tx = await client.blockchainTransaction_get(utxo.tx_hash, true);
        console.log(tx);
        return {
            txid: utxo.tx_hash,
            vout: utxo.tx_pos,
            value: utxo.value,
            hex: tx
        };
    }));
}
async function broadcastTransactionToElectrum(txHex) {
    try {
        const client = new ElectrumClient(50000, 'localhost', 'tcp');
        await client.connect();
        console.log("Connected");
        const result = await client.blockchainTransaction_broadcast(txHex);
        // const header = await client.blockchain_relayfee();
        console.log('result:', result)
        return result;
    } catch (error) {
        console.error('Error posting transaction:', error.message);
        throw error;
    }
}
export {}
