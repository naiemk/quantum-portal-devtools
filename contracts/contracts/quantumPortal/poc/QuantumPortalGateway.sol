// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IQuantumPortalPoc.sol";
import "./IQuantumPortalLedgerMgr.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "foundry-contracts/contracts/common/IFerrumDeployer.sol";
import "foundry-contracts/contracts/common/WithAdmin.sol";
import "foundry-contracts/contracts/common/SafeAmount.sol";

/**
 * @notice Quantum portal gateway. This is the entry point allowing
 *     upate of QP contract logics. Always use this contract to interact
 *     with QP
 */
contract QuantumPortalGatewayDEV is WithAdmin {
    string public constant VERSION = "000.010";
    IQuantumPortalPoc public quantumPortalPoc;
    IQuantumPortalLedgerMgr public quantumPortalLedgerMgr;

    constructor() Ownable(msg.sender) {
    }

    /**
     * @notice The authority manager contract
     */
    function quantumPortalAuthorityMgr() external view returns (address) {
        return
            IQuantumPortalLedgerMgrDependencies(address(quantumPortalLedgerMgr))
                .authorityMgr();
    }

    /**
     * @notice Restricted: Upgrade the contract
     * @param poc The POC contract
     * @param ledgerMgr The ledger manager
     */
    function upgrade(
        address poc,
        address ledgerMgr
    ) external onlyAdmin {
        quantumPortalPoc = IQuantumPortalPoc(poc);
        quantumPortalLedgerMgr = IQuantumPortalLedgerMgr(ledgerMgr);
    }

    /**
     * @notice The state contract
     */
    function state() external returns (address) {
        return address(quantumPortalLedgerMgr.state());
    }

    /**
     * @notice Proxy methods for IQuantumPortalPoc
     */
    function feeTarget() external view returns (address) {
        return quantumPortalPoc.feeTarget();
    }

    /**
     * @notice The fee token
     */
    function feeToken() external view returns (address) {
        return quantumPortalPoc.feeToken();
    }
}
