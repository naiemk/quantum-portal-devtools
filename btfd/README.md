  # BFTD toolkit

  ## Intstall

  ```
  $ npm install 'https://gitpkg.vercel.app/ferrumnet/quantum-portal-devtools/btfd?main'
  ```

  ## BTFD Calls

  A BTFD call, differs from a standard QP call by the sense that the call will be originated from the Bitcoin network.

  Dev tools for BTFD needs to include the following items at the minimum:

  - An SDK to create PSBTs, that contain the relevant inscriptions for a proper remote QP call.
  - Estimate the gas of the remote transaction in sats (to ensure the transaction does not fail).

  Optional tools:

  - In-process simulation of BTFD infrastructure, e.g. ERC20 BTC / Rune tokens.

  ## Common Calls

  Some remote call, templates are provided for convenience:

  ```
  import { BtfdCommonCalls } from 'btfd/lib/BtfdUtils';
  const remoteCall = BtfdCommonCalls.remoteTransferBtc(network to, amountSats, feeSats);
  ```

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

## Using with react (or webpack 5+)

We need a whole bunch of polyfils to make `bitcoinjs-lib` work with front-end UI (create-react-app)

```
$ npm i react-app-rewired
```

Then install polyfills

```
$ npm i browserify buffer util bufferutil
```

Set the config-overrides.js as follows:

***Content of config-overrides.js***
```js
const webpack = require("webpack");

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    crypto: require.resolve("crypto-browserify") ,
    stream: require.resolve("stream-browserify"),
    buffer: require.resolve("buffer"),
    util: require.resolve("util"),
    assert: false, // require.resolve("assert") can be polyfilled here if needed
    http: false, // require.resolve("stream-http") can be polyfilled here if needed
    https: false, // require.resolve("https-browserify") can be polyfilled here if needed
    os: false, // require.resolve("os-browserify") can be polyfilled here if needed
    url: false, // require.resolve("url") can be polyfilled here if needed
    zlib: false, // require.resolve("browserify-zlib") can be polyfilled here if needed
    net: false,
    tls: false,
    vm: false,
    bufferutil: require.resolve('bufferutil'),
    'utf-8-validate': false,
    fs: false,
    path: false,
    console: require.resolve("console-browserify"),
  });
  config.resolve.fallback = fallback;
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
  ]);

  config.experiments = {
    asyncWebAssembly: true,
  };

  config.ignoreWarnings = [/Failed to parse source map/];
  config.module.rules.push({
    test: /\.(js|mjs|jsx)$/,
    enforce: "pre",
    loader: require.resolve("source-map-loader"),
    resolve: {
      fullySpecified: false,
    },
  });
  config.module.rules = config.module.rules.map((rule) => {
    if (rule.oneOf instanceof Array) {
      return {
        ...rule,
        oneOf: [{ test: /\.wasm$/, type: 'webassembly/async' }, ...rule.oneOf],
      };
    }
    return rule;
  });
  return config;
};
```

Then update your `package.json` to be as follows: 

```json
  "scripts": {
    "start": "react-app-rewired start",
    "build": "react-app-rewired build",
    "test": "react-app-rewired test",
    "eject": "react-scripts eject"
  },
```
