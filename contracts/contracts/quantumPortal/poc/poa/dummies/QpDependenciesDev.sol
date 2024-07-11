// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IQuantumPortalMinerMgr.sol";
import "../IQuantumPortalMinerMembership.sol";
import "../IQuantumPortalWorkPoolClient.sol";
import "../IQuantumPortalAuthorityMgr.sol";
import "../IQuantumPortalWorkPoolServer.sol";
import "../stake/IQuantumPortalStakeWithDelegate.sol";
import "./TokenReceivable.sol";

import "hardhat/console.sol";

contract QpDependenciesDev is TokenReceivable, IQuantumPortalMinerMgr, IQuantumPortalMinerMembership, IQuantumPortalWorkPoolClient,
    IQuantumPortalAuthorityMgr, IQuantumPortalWorkPoolServer, IQuantumPortalStakeWithDelegate {
    address public baseToken;

    constructor (address _baseToken) {
        baseToken = _baseToken;
    }

    function setBaseToken(address _baseToken) external {
        baseToken = _baseToken;
    }

    function miningStake() external override view returns (address) {
        return address(this);
    }

    function extractMinerAddress(
        bytes32 msgHash,
        bytes32 salt,
        uint64 expiry,
        bytes memory multiSig
    ) external override view returns (address) {
        return address(0);
    }

    function verifyMinerSignature(
        bytes32 msgHash,
        bytes32 salt,
        uint64 expiry,
        bytes memory signature,
        uint256 msgValue,
        uint256 minStakeAllowed
    ) external override view returns (ValidationResult res, address) {
        return (ValidationResult.Valid, tx.origin);
    }

    function slashMinerForFraud(
        address miner,
        bytes32 blockHash,
        address beneficiary
    ) external override {
    }

    // IQuantumPortalMinerMembership

    function selectMiner(
        address requestedMiner,
        bytes32 blockHash,
        uint256 blockTimestamp
    ) external override returns (bool) {
        return true;
    }

    function registerMiner(address miner) external override {}

    function unregisterMiner(address miner) external override {}

    function unregister() external override {}

    function findMiner( bytes32 blockHash, uint256 blockTimestamp) external override view returns (address) { return address(0); }

    function findMinerAtTime(
        bytes32 blockHash,
        uint256 blockTimestamp,
        uint256 chainTimestamp
    ) external override view returns (address) { return address(0); }

    // IQuantumPortalWorkPoolClient
    function registerWork(
        uint256 remoteChain,
        address worker,
        uint256 work,
        uint256 _remoteEpoch
    ) external override {}

    // IQuantumPortalAuthorityMgr
    function validateAuthoritySignature(
        Action action,
        bytes32 msgHash,
        bytes32 salt,
        uint64 expiry,
        bytes memory signature
    ) external override {}

    // IQuantumPortalWorkPoolServer

    // We keep the fee collection working as real as possible
   function collectFee(
        uint256 targetChainId,
        uint256 localEpoch,
        uint256 fixedFee
    ) external override returns (uint256 varFee) {
         uint256 collected = sync(baseToken);
        require(collected >= fixedFee, "QPWPS: Not enough fee");
        console.log("CollectFee EPOCH", localEpoch, targetChainId);
        varFee = collected - fixedFee;
    }

    function withdrawFixedRemote(
        address to,
        uint256 workRatioX128,
        uint256 epoch
    ) external override {}

    function withdrawVariableRemote(
        address to,
        uint256 workRatioX128,
        uint256 epoch
    ) external override {}

    // IQuantumPortalStakeWithDelegate
    function stakeOfDelegate(
        address operator
    ) external override view returns (uint256) {
        return 10_000_000 ether; // plenty of stake to pass as miner
    }
}