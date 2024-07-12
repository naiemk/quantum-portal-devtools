module.exports = {
  CHAIN_CONFIG: {
    ethereum: { url: 'https://gateway.tenderly.co/public/mainnet', forkPort: 8101, forkChainId: 1001},
    bsc: { url: 'https://binance.llamarpc.com', forkPort: 8102, forkChainId: 1002},
    polygon: { url: 'https://polygon-mainnet.g.allthatnode.com/archive/evm', forkPort: 8103, forkChainId: 1003},
    avalance: { url: 'https://avalanche-mainnet.g.allthatnode.com/archive/evm', forkPort: 8104, forkChainId: 1004},
    arbitrum: { url: 'https://arbitrum.llamarpc.com', forkPort: 8105},
    btfd_ghostnet: { url: '???', forkPort: 0}, // 8106},
    base: { url: 'https://base.llamarpc.com', forkPort: 8107},
  },
}
