// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../../quantumPortal/poc/utils/WithQp.sol";
import "../../quantumPortal/poc/utils/WithRemotePeers.sol";
import "foundry-contracts/contracts/common/SafeAmount.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";

contract QpBridge is ReentrancyGuard, WithQp, WithRemotePeers {
    using SafeERC20 for IERC20;
    address public constant NATIVE_TOKEN = address(0x0000000000000000000000000000000000000001);
    struct PendingSwap {
        address token;
        uint256 amount;
        address recipient;
    }

    constructor(address admin) 
        Ownable(admin)
    {}

    receive() external payable {}

    mapping(address => mapping(uint256 => address)) public remotePairs;
    mapping(address => PendingSwap[]) public pendingSwaps;

    function pendingSwapsLength(address user) external view returns (uint256) {
        return pendingSwaps[user].length;
    }

    function updateRemotePair(uint256 remoteChainId, address token, address remoteToken) external onlyOwner {
        if (remoteToken == address(0)) {
            delete remotePairs[token][remoteChainId];
        } else {
            remotePairs[token][remoteChainId] = remoteToken;
        }
    }

    function swap(uint remoteChainId, address token, uint256 amount, uint256 nativeGas) external payable nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(token != address(0), "Token address cannot be 0");
        address remotePair = remotePairs[token][remoteChainId];
        require(remotePair != address(0), "Remote pair not found");

        if (token == NATIVE_TOKEN) {
            require(msg.value >= amount + nativeGas, "Insufficient native token balance");
        } else {
            require(msg.value >= nativeGas, "Native token balance should be enough for gas");
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        bytes memory encodedCall = abi.encodeWithSelector(
            this.remoteSwap.selector,
            remotePair,
            amount,
            msg.sender
        );
        console.log("** remotePeers[remoteChainId]", remotePeers[remoteChainId]);
        portal.runNativeFee{value: nativeGas}(uint64(remoteChainId), remotePeers[remoteChainId], address(this), encodedCall);
    }

    function remoteSwap(address token, uint256 amount, address recipient) external {
        (uint256 sourceNetwork, address sourceMsgSender,) = portal.msgSender();
        console.log("remoteSwap called");
        console.log("sourceNetwork", sourceNetwork);
        console.log("sourceMsgSender", sourceMsgSender);
        require(sourceMsgSender == remotePeers[sourceNetwork], "Call not allowed");
        PendingSwap memory pendingSwap = PendingSwap({
            token: NATIVE_TOKEN,
            amount: amount,
            recipient: recipient
        });
        console.log("token", token);
        // console.log("recipient", recipient);
        // console.log("pendingSwaps[msg.sender].length", pendingSwaps[recipient].length);
        pendingSwaps[recipient].push(pendingSwap);
        // console.log("pendingSwaps[msg.sender].length", pendingSwaps[recipient].length);
        // Above has predictable gas. But transfer can be unpredictable and fail.
        // We call this method and balance reduction attomically and as the last command
        // so if it fails, we have the balance updated. And user can claim it later
        (bool success, ) = address(this).call(abi.encodeWithSelector(
            this.transferAndSetBalance.selector,
            token,
            amount,
            recipient
        ));
        console.log("success", success);
        console.log("pendingSwaps[msg.sender].length", pendingSwaps[recipient].length);
    }

    function withdrawAllPendingSwaps(address user) external {
        uint256 swapLength = pendingSwaps[user].length;
        for (uint256 i = 0; i < swapLength; i++) {
            _withdrawLastPendingSwap(user);
        }
    }

    function clearUserPendingSwaps(address user) external onlyAdmin {
        delete pendingSwaps[user];
    }

    function sweepTokens(address token, address recipient) external onlyOwner {
        IERC20(token).safeTransfer(recipient, IERC20(token).balanceOf(address(this)));
    }

    function sweepNativeTokens(address recipient) external onlyOwner {
        SafeAmount.safeTransferETH(recipient, address(this).balance);
    }

    function transferAndSetBalance(address token, uint256 amount, address recipient) external {
        require(msg.sender == address(this), "Only this contract can call this function");
        console.log(">pendingSwaps[msg.sender].length", pendingSwaps[recipient].length);
        pendingSwaps[recipient].pop();
        if (token == NATIVE_TOKEN) {
            console.log("Our balance", address(this).balance);
           SafeAmount.safeTransferETH(recipient, amount);
        } else {
            console.log("Our balance token", IERC20(token).balanceOf(address(this)));
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    function _withdrawLastPendingSwap(address user) internal {
        PendingSwap memory pswap = pendingSwaps[user][pendingSwaps[user].length - 1];
        pendingSwaps[user].pop();
        if (pswap.token == NATIVE_TOKEN) {
            SafeAmount.safeTransferETH(user, pswap.amount);
        } else {
            IERC20(pswap.token).safeTransfer(user, pswap.amount);
        }
    }
}
