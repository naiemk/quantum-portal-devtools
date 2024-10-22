import React, { useState } from 'react';
import * as randomBytes from 'randombytes';
import { Buffer } from 'buffer';
import { networks } from 'bitcoinjs-lib';
import { BtfdUtils } from 'btfd/lib/BtfdUtils';
// import { ECPairFactory } from 'ecpair';
// import bs58check from 'bs58check';
// import * as ecc from 'tiny-secp256k1';
// const ECPair = ECPairFactory(ecc);
import './App.css';

// function sign(psbt) {
//   const fromSkRaw = bs58check.decode('cTVyrF1RaCeJuvgi2PM6WETJimXvDs213157Xi8LngYMvg1mJMXc');
//   const isCompressed = fromSkRaw.length === 33 + 1;
//   const fromSk = isCompressed ? fromSkRaw.subarray(1, fromSkRaw.length - 1) : fromSkRaw.subarray(1);
//   const kp = ECPair.fromPrivateKey(fromSk);
//   const pubk = kp.publicKey;
//   console.log('pubk', pubk);
//   return psbt.signInput(0, kp).toHex();
// }

const NETWORK = 'regtest';

const remoteCall = {
  remoteChainId: 1,
  remoteContract: '0x1234567890123456789012345678901234567890',
  remoteMethodCall: '0x1234567890abcdef',
  beneficiary: '0x0987654321098765432109876543210987654321',
  salt: '0x' + randomBytes(32).toString('hex'),
  amountSats: BigInt(1000000),
  feeSats: BigInt(1000),
};

function apiEndpoint() {
  return NETWORK === 'regtest' ? 'http://localhost:3000' : 'https://blockstream.info/api';
}

function explorerEndpoint() {
  return NETWORK === 'regtest' ? 'http://localhost:5000' : 'https://blockstream.info';
}

function explorerlinkAddr(address) {
  return `${explorerEndpoint()}/address/${address}`;
}

function explorerlinkTx(txid) {
  return `${explorerEndpoint()}/tx/${txid}`;
}

function App() {
  const [unisatAddresses, setUnisatAddresses] = useState([]);
  const [commitTx, setCommitTx] = useState('');
  const [revealTx, setRevealTx] = useState('');
  const unisatExists = !!window.unisat;
  const wallet = unisatAddresses.length ? unisatAddresses[0] : null;

  const handleConnectUniSat = async () => {
    try {
      let accounts = await window.unisat.requestAccounts();
      console.log("connect success", accounts);
      setUnisatAddresses(accounts);
    } catch (e) {
      console.log("connect failed", e);
    }
  };
  const handleDisconnectUnisat = async () => {
    try {
      let accounts = await window.unisat.removeAllListeners();
      console.log("disconnect success", accounts);
      setUnisatAddresses(accounts);
    } catch (e) {
      console.log("disconnect failed", e);
    }
  };
  const handleExecute = async () => {
    try {
      const QP_ADDRESS = '2MxFYZjevGc9Xm8m3ackiSrcj4YQ2i4uMGH';
      const from = wallet;
      const publicKey = await window.unisat.getPublicKey();
      console.log("publicKey", publicKey);
      const provider = BtfdUtils.utxoProvider(networks.regtest, apiEndpoint(), 'blockstream');
      const [tx1, tx2] = await BtfdUtils.createPsbt(
        networks.regtest,
        QP_ADDRESS,
        from,
        Buffer.from(publicKey, 'hex'),
        remoteCall,
        async psbt => {
          console.log('psbt', psbt);
          // return sign(psbt);
            const res = await window.unisat.signPsbt(psbt.toHex(), {
              autoFinalize: true,
              // address: wallet,
              toSignInputs: [{index: 0, publicKey: publicKey, disableTweakSigner: true}],
            });
            // console.log('res', res);
            // const psbt2 = Psbt.fromHex(res);
            // console.log('psbt2', psbt2);
            // const tx = psbt2.extractTransaction();
            // await provider.broadcastTx(tx.toHex());
            return res;
        },
        provider,
        { signerWillFinalize: true },
      );
      const txid1 = await provider.broadcastTx(tx1.toHex());
      setCommitTx(txid1);
      console.log('Txid1:', txid1);
      const txid2 = await provider.broadcastTx(tx2.toHex());
      setRevealTx(txid2);
      console.log('Txid2:', txid2);
      console.log('Transactions', tx1, tx2);
    } catch (e) {
      console.log("execute failed", e);
    }
  }


  return (
    <div className="App">
      <h1>BTFD Test</h1>
      <br />
      <br />
      <button disabled={!unisatExists}
        onClick={() => !unisatAddresses.length ? handleConnectUniSat() : handleDisconnectUnisat()}>
          {unisatAddresses.length ? 'Disconnect' : 'Connect to BTC wallet'}</button>
      <br />
      <h3><a href={explorerlinkAddr(wallet)} target='_blank' rel="noreferrer">Wallet: {wallet}</a></h3>
      <button disabled={!wallet} onClick={() => handleExecute()}>Execute method on QP and send BTC</button>
      <br />
      <br />
      <br />
      {commitTx && <h3>Commit Tx: <a href={explorerlinkTx(commitTx)} target='_blank' rel="noreferrer">{commitTx}</a></h3>}<br/>
      {revealTx && <h3>Reveal Tx: <a href={explorerlinkTx(revealTx)} target='_blank' rel="noreferrer">{revealTx}</a></h3>}

    </div>
  );
}

export default App;
