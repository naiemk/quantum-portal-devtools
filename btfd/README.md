# BFTD toolkit

## Intstall

```
$ npm install 'https://gitpkg.vercel.app/ferrumnet/quantum-portal-devtools/btfd?main'
```

## Use

A BTFD call, differs from a standard QP call by the sense that the call will be originated from the Bitcoin network.

Dev tools for BTFD needs to include the following items at the minimum:

- An SDK to create PSBTs, that contain the relevant inscriptions for a proper remote QP call.
- Estimate the gas of the remote transaction in sats (to ensure the transaction does not fail).

Optional tools:

- In-process simulation of BTFD infrastructure, e.g. ERC20 BTC / Rune tokens.

## BTFD Bitcoin SDK

The SDK will be a typescript object, with the following API:

```typescript
const remoteCall: BtfdRemoteCall = {
  remoteChainId,  // e.g. 1 for Ethereum mainnet
  remoteContract, // The contract to be called by QP on Ethereum
  remoteMethodCall// abi.encoded remote call
  beneficiary,    // Who to mint QpBTC to, in case of tx failure
  amount,         // BTC amount to be sent to the remote contract in sats
  fee: 0,         // QP Fee in BTC (will be added to the amount)
};

const fee = await Btfd.estimateFee(remoteCall);
remoteCall.fee = fee;

const [psbtCommit, psbtReveal] = await BtfdUtils.createPsbt(remoteCall);
Wallet.sendPsbt([psbtCommit, psbtReveal]);
```

### Special cases

There are some special cases:

```typescript
const remoteTransferCallWithFee = await BtfdUtils.createRemoteTransferCallWithFee(amount, to) // Also estimates the fee

const remoteTransferCall = await BtfdUtils.createRemoteTransferCall(amount, to) // Also estimates the fee
```

### Commit an reveal transactions

Commit transaction will egrave the inscription.
The reveal transaction does two jobs: first, it reveals the inscription, by spending the commit utxo, and second, it sends BTC + fee to the QP address.


### QP Address

QP Address, is the address to receive BTC and BTFD messages.

- *BTFD Gostnet*: <PROVIDE ADDRESS>
- *BTFD Edgebet*: <PROVIDE ADDRESS>
- *BTFD Mainnet*: TBD, Address must be queried from contract, and will have a limitted validity
