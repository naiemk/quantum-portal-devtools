# Quantum Portal Developer Contracts

This repo contains a modified set of QP contracts by stripping down the whole mining/finalizing system. This will allow us to deploy test versions of the QP contract with a dummy miner.

- QuantumPortalNativeFeeRpo
- QuantumPortalFeeConvertorDirect
- QuantumPortalState
- QuantumPortalLedgerMgr
- QuantumPortalPoc
- QuantumPortalGateway

All other dependencies are replaced with:

- QpDependenciesDev

# In-transaction Simulation

You can use `QuantumPortalContextSim` to simulate getting remote calls in your test contracts:

```solidity

  function simulateARemoteCall(uint myRemoteChain, address myRemoteCaller) {
    // Set the expected call from portal
    portal = new QuantumPortalContextSim();
    portal.setContext(myRemoteCaller, testBeneficiary, someTokenOnRemoteChain, someAmount);

    // Initiate a portal call
    portal.run(
      myRemoteChain,
      address(this), // This contract will be called from protal
      testBeneficiary,
      abi.encodeWithSelector(ThisContract.MyMethod.selector, par1, par2)
    );
  }

```