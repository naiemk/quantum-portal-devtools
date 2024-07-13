pragma solidity ^0.8.0;
import "../utils/WithQp.sol";
import "../utils/WithRemotePeers.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

/**
 * @notice Example application that ping/pongs on target chains until there is no more gas to pay
 */
contract PingPong is WithQp, WithRemotePeers {
    string constant public VERSION = "0.0.1";
    uint public counter = 0;
    uint64 remoteChainId;
    uint txGas;
    constructor(uint _remoteChainId, uint _txGas)Ownable(msg.sender) {
        remoteChainId = uint64(_remoteChainId);
        txGas = _txGas;
    }

    function remotePing() external {
        (uint remoteNetId, ,) = portal.msgSender();
        require(remoteNetId == remoteChainId, "Not allowed"); // Also check the remote msg sender in prod usecases
        console.log("PING FROM ", remoteNetId);
        counter++;
        callPong();
    }

    function remotePong() external {
        (uint remoteNetId, ,) = portal.msgSender();
        require(remoteNetId == remoteChainId, "Not allowed"); // Also check the remote msg sender in prod usecases
        console.log("PONG FROM ", remoteNetId);
        counter++;
        callPing();
    }

    function callPong() public {
        IERC20(portal.feeToken()).transfer(portal.feeTarget(), txGas); // Pay the QP fee
        bytes memory remoteMethodCall = abi.encodeWithSelector(PingPong.remotePong.selector); 
        portal.run(remoteChainId, remotePeers[remoteChainId], msg.sender, remoteMethodCall);
        console.log("CALLED PONG ON", remoteChainId);
    }

    function callPing() public {
        IERC20(portal.feeToken()).transfer(portal.feeTarget(), txGas); // Pay the QP fee
        bytes memory remoteMethodCall = abi.encodeWithSelector(PingPong.remotePing.selector); 
        portal.run(remoteChainId, remotePeers[remoteChainId], msg.sender, remoteMethodCall);
        console.log("CALLED PING ON", remoteChainId);
    }
}