import React, { useEffect, useState } from 'react';
import * as randomBytes from 'randombytes';
import { networks, payments } from 'bitcoinjs-lib';
import { BtfdUtils, BtfdCommonCalls } from 'btfd/lib/BtfdUtils';
import { Buffer } from 'buffer';
import './App.css';

import { ECPairFactory } from 'ecpair';
import bs58check from 'bs58check';
import * as ecc from 'tiny-secp256k1';
const ECPair = ECPairFactory(ecc);

function skToKP(privateKeyWif) {
  const fromSkRaw = bs58check.decode(privateKeyWif);
  const isCompressed = fromSkRaw.length === 33 + 1;
  const fromSk = isCompressed ? fromSkRaw.subarray(1, fromSkRaw.length - 1) : fromSkRaw.subarray(1);
  const kp = ECPair.fromPrivateKey(fromSk);
  return kp;
}

// To sign with private key
function sign(kp, psbt) {
  const pubk = kp.publicKey;
  console.log('pubk', pubk);
  return psbt.signInput(0, kp).toHex();
}

const QP_ADDRESS = {
  [networks.regtest.wif]: '2MxFYZjevGc9Xm8m3ackiSrcj4YQ2i4uMGH',
  [networks.bitcoin.wif]: '', // TODO: set something
}

console.log(QP_ADDRESS)

const REMOTE_CALL_EXAMPLE = {
  remoteChainId: 1,
  remoteContract: '0x1234567890123456789012345678901234567890',
  remoteMethodCall: '0x1234567890abcdef',
  beneficiary: '0x0987654321098765432109876543210987654321',
  salt: '0x' + randomBytes(32).toString('hex'),
  amountSats: BigInt(1000000),
  feeSats: BigInt(1000),
};

function apiEndpoint(network) {
  return network === networks.regtest ? 'http://localhost:3000' : 'https://blockstream.info/api';
}

function explorerEndpoint(network) {
  return network === networks.regtest ? 'http://localhost:5000' : 'https://blockstream.info';
}

function explorerlinkAddr(network, address) {
  return `${explorerEndpoint(network)}/address/${address}`;
}

function explorerlinkTx(network, txid) {
  return `${explorerEndpoint(network)}/tx/${txid}`;
}

async function generateCommitAndReveal(network, wallet, publicKey, remoteCall, withSk, signer) {
  const from = wallet;
  console.log('from', {from, publicKey});
  const provider = BtfdUtils.utxoProvider(network, apiEndpoint(network), 'blockstream');
  const [tx1, tx2] = await BtfdUtils.createPsbt(
    network,
    QP_ADDRESS[network.wif],
    from,
    publicKey,
    remoteCall,
    signer,
    provider,
    {
      signerWillFinalize: !withSk, // If withSk, we need to finalize, otherwise we let the wallet (unisat) to finalize
      feeRate: 0, // Provide if you want to set a custom fee rate
     },
  );
  const txid1 = await provider.broadcastTx(tx1.toHex());
  console.log('Txid1:', txid1);
  const txid2 = await provider.broadcastTx(tx2.toHex());
  console.log('Txid2:', txid2);
  console.log('Transactions', tx1, tx2);
  return [txid1, txid2];
}

function App() {
  const [unisatAddresses, setUnisatAddresses] = useState([]);
  const [commitTx, setCommitTx] = useState('');
  const [revealTx, setRevealTx] = useState('');
  const [useWallet, setUseWallet] = useState(true);
  const [privateKeyWif, setPrivateKeyWif] = useState('');
  const [addressType, setAddressType] = useState('p2pkh');
  const [error, setError] = useState(null);
  const [selectedNet, setSelectedNet] = useState('regtest');
  const [remoteCall, setRemoteCall] = useState(REMOTE_CALL_EXAMPLE);
  const [templateType, setTemplateType] = useState('none');
  const unisatExists = !!window.unisat;
  const wallet = unisatAddresses.length ? unisatAddresses[0] : null;
  const network = selectedNet === 'regtest' ? networks.regtest : networks.bitcoin;
  useEffect(() => {
    if(privateKeyWif && addressType) {
      try {
      const kp = skToKP(privateKeyWif);
      let address;
      switch(addressType) {
        case 'p2pkh':
          {
          const uncompressedHex = ECPair.fromPublicKey(
              kp.publicKey,
              { compressed: false },
            ).publicKey;
          console.log('uncompressedHex', uncompressedHex);
          address = payments.p2pkh({
            pubkey: kp.publicKey,
            network: network,
          }).address;
          }
          break;
        case 'p2sh-p2wpkh':
          address = payments.p2sh({
            redeem: payments.p2wpkh({ pubkey: kp.publicKey, network }),
            network: network,
          }).address;
          break;
        default:
          address = 'NOT_SUPPORTED';
      }
      console.log('address', address);
      setUnisatAddresses([address]);
      } catch (e) {
        setError(e.toString());
      }
    }}, [privateKeyWif, addressType]);



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



  const handleExecuteSk = async () => {
    try {
      const kp = skToKP(privateKeyWif);
      const [tid1, tid2] = await generateCommitAndReveal(network, wallet, Buffer.from(kp.publicKey), remoteCall, true, 
        psbt => { console.log('signing', psbt); return sign(kp, psbt) }
        );
      setCommitTx(tid1);
      setRevealTx(tid2);
    } catch (e) {
      console.error("execute failed", e);
      setError(e.toString());
    }
  }
  const handleExecuteWallet = async () => {
    try {
      const publicKey = await window.unisat.getPublicKey();
      console.log("publicKey", publicKey);
      const [tid1, tid2] = await generateCommitAndReveal(network, wallet, Buffer.from(publicKey, 'hex'), remoteCall, false, async psbt => {
        console.log('psbt to sign with wallet', psbt);
        const res = await window.unisat.signPsbt(psbt.toHex(), {
          autoFinalize: true,
          toSignInputs: [{index: 0, publicKey: publicKey, disableTweakSigner: true}],
        });
        return res;
      });
      setCommitTx(tid1);
      setRevealTx(tid2);
    } catch (e) {
      console.error("execute failed", e);
      setError(e.toString());
    }
  }

  console.log('REMOTE_CALL', remoteCall);

  return (
    <div className="App bordered">
      <h1>BTFD Test</h1>
      <br />
      {error && <h3 className='error-text'>Error: {error}</h3>}
      <label>
      <input type="checkbox" checked={useWallet} onChange={() => setUseWallet(!useWallet)} /> Use Browser Extention Wallet</label>
      {useWallet && (
        <>
          <button disabled={!unisatExists}
            onClick={() => !unisatAddresses.length ? handleConnectUniSat() : handleDisconnectUnisat()}>
              {unisatAddresses.length ? 'Disconnect' : 'Connect to BTC wallet'}</button>
          <br />
        </>
      )}
      <KVP label={'Wallet'}
        value={<a href={explorerlinkAddr(network, wallet)} target='_blank' rel="noreferrer">{wallet}</a>} />
      <br />
      {!useWallet && (
        <>
        <KVP label={'Private key'}
          value={<input className='input-wide' type="text" value={privateKeyWif} placeholder="Private key WIF" onChange={e => setPrivateKeyWif(e.target.value)} />} />
        <KVP label={'Address type'}
          value={
              <select name='addressType' value={addressType} onChange={e => setAddressType(e.target.value)}>
                <option value='p2pkh'>P2PKH</option>
                <option value='p2wpkh'>P2WPKH</option>
                <option value='p2sh-p2wpkh'>P2SH-P2WPKH</option>
                <option value='p2wsh'>P2WSH</option>
              </select>
          } />
        <KVP label={'Network'}
          value={
        <select name='net' value={selectedNet} onChange={e => setSelectedNet(e.target.value)}>
          <option value='regtest'>REGTEST</option>
          <option value='bitcoin'>BITCOIN</option>
        </select>} />
        </>
      )}
      <br />
      <KVP label='Contract template' value={
          <select name='call' value={templateType} onChange={e => {
            const newTemp = e.target.value;
            setTemplateType(newTemp);
            if (newTemp === 'remoteTransfer') {
              setRemoteCall(BtfdCommonCalls.remoteTransferBtc(network, '', '0', '0', '0'))
            }
          }}>
            <option value='none'>You can select one</option>
            <option value='remoteTransfer'>Remote transfer</option>
          </select>} />
      <RemoteCall value={remoteCall} setValue={setRemoteCall} />
      <br />
      <button disabled={!wallet} onClick={() => useWallet ? handleExecuteWallet() : handleExecuteSk()}>Execute method on QP and send BTC</button>
      <br />
      {commitTx && 
        <KVP label='Commit tx' value={<a href={explorerlinkTx(network, commitTx)} target='_blank' rel="noreferrer">{commitTx}</a>}/>}
      {revealTx && 
        <KVP label='Reveal tx' value={<a href={explorerlinkTx(network, revealTx)} target='_blank' rel="noreferrer">{revealTx}</a>}/>}

    </div>
  );
}

function KVP({label, value}) {
  return (
    <div className='row'>
      <label>{label} </label>
      <div className='value'>{value}</div>
    </div>
  )
}

function Pair({keyName, value, setValue}) {
  return (
    <div className='row'>
      <label>{keyName} </label>
    <div className='value'>
      <input type='text' value={value} onChange={e => setValue(e.target.value)} className='input-mid'/>
    </div>
    </div>
  )
}

function RemoteCall({value, setValue}) {
  return (
    <div className='bordered'>
      <Pair keyName='remoteChainId' value={value.remoteChainId} setValue={v => setValue({...value, remoteChainId: v})} /> 
      <Pair keyName='remoteContract' value={value.remoteContract} setValue={v => setValue({...value, remoteContract: v})} /> 
      <Pair keyName='remoteMethodCall' value={value.remoteMethodCall} setValue={v => setValue({...value, remoteMethodCall: v})} /> 
      <Pair keyName='salt' value={value.salt} setValue={v => setValue({...value, salt: v})} /> 
      <Pair keyName='beneficiary' value={value.beneficiary} setValue={v => setValue({...value, beneficiary: v})} /> 
      <Pair keyName='amountSats' value={value.amountSats.toString()} setValue={v => setValue({...value, amountSats: BigInt(v)})} /> 
      <Pair keyName='feeSats' value={value.feeSats.toString()} setValue={v => setValue({...value, feeSats: BigInt(v)})} /> 
    </div>
  )
}

export default App;
