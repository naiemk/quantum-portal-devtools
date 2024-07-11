// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IQuantumPortalStakeWithDelegate {
    function stakeOfDelegate(
        address operator
    ) external view returns (uint256);
}