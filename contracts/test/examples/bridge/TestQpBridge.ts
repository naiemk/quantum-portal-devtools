import { ethers } from "hardhat";
import { QuantumPortalUtils, deployAll } from '../../quantumPortal/QuantumPortalUtils';
import { QpBridge } from '../../../typechain-types/QpBridge';
import { Wei } from "foundry-contracts/dist/test/common/Utils";

function prettyLog(msg: string) {
    console.log(`\x1b[32;1;4m >>>>>>>>>>>>>>>>>>>>>>>>>> ${msg}\x1b[0m`);
}

describe('Test QP Bridge', function() {
	it('Can swap cross-chain', async function() {
    const ctx = await deployAll(); // Deploy QP
    console.log('Create the multi-chain QP Bridge');

    const bridgeF = await ethers.getContractFactory('QpBridge');

    const gasEstimateEnough = Wei.from('0.01'); // Arbitrary number for simpler example
    const p1 = await bridgeF.deploy(ctx.owner) as QpBridge;
    const p2 = await bridgeF.deploy(ctx.owner) as QpBridge;
    console.log(`Funding nativeFeeRepo`)
    await ctx.chain1.token.transfer(await ctx.chain1.poc.nativeFeeRepo(), Wei.from('10'));
    await ctx.chain2.token.transfer(await ctx.chain2.poc.nativeFeeRepo(), Wei.from('10'));
    await ctx.chain1.token.transfer(ctx.acc1, Wei.from('2'));
    console.log("Funding the bridge with liquidity")
    await ctx.chain1.token.transfer(p1.address, Wei.from('10'));
    await ctx.signers.owner.sendTransaction({
      to: p2.address,
      value: Wei.from('1')
    });

    console.log('// Initialize the bridge: Chain 1 TST <=> Chain 2 ETH');
    await p1.updateRemotePair(ctx.chain2.chainId, ctx.chain1.token.address, await p1.NATIVE_TOKEN());
    await p2.updateRemotePair(ctx.chain1.chainId, await p2.NATIVE_TOKEN(), ctx.chain1.token.address);

    console.log('// Initializing multi-chain connections');
    // Initializing multi-chain connections
    p1.updateRemotePeers([ctx.chain2.chainId],[p2.address]);
    p1.initializeWithQp(ctx.chain1.poc.address);
    p2.updateRemotePeers([ctx.chain1.chainId],[p1.address]);
    p2.initializeWithQp(ctx.chain2.poc.address);

    console.log('// Send some token to contracts for gas');
    await ctx.chain1.token.transfer(p1.address, Wei.from('10'));
    await ctx.chain2.token.transfer(p2.address, Wei.from('10'));

    let epoch = 1;

    console.log('// Swap 1 token from chain 1 to chain 2');
    const totalETH = BigInt(Wei.from('1')) + BigInt(gasEstimateEnough);
    console.log(`Owner is: ${ctx.owner}`);
    console.log(`Token balance of the owner on chain 1: ${await ctx.chain1.token.balanceOf(ctx.owner)}`);
    console.log(`ETH balance of the owner on chain 1: ${Wei.to((await ctx.signers.owner.getBalance()).toString())}`);
    
    prettyLog('================================================');
    prettyLog('** Swap with enough liquidity');
    prettyLog(`Liquidity of the bridge on chain 2: ${Wei.to((await ethers.provider.getBalance(p2.address)).toString())}`)
    // prettyLog(`ETH balance of the acc1 - INIT: ${Wei.to((await ctx.signers.acc1.getBalance()).toString())}`);
    await ctx.chain1.token.connect(ctx.signers.acc1).approve(p1.address, Wei.from('2'));
    await p1.connect(ctx.signers.acc1).swap(
      ctx.chain2.chainId, ctx.chain1.token.address, Wei.from('1'), gasEstimateEnough, {value: gasEstimateEnough});
    // await p1.swap(ctx.chain2.chainId, await p1.NATIVE_TOKEN(), Wei.from('1'), gasEstimate, {value: totalETH});

    console.log('// Mine and finalize the swap');
    prettyLog(`ETH balance of the acc1 -  PRE: ${Wei.to((await ctx.signers.acc1.getBalance()).toString())}`);
    await QuantumPortalUtils.mineAndFinilizeOneToTwo(ctx, epoch);
    prettyLog(`ETH balance of the acc1 - POST: ${Wei.to((await ctx.signers.acc1.getBalance()).toString())}`);
    prettyLog(`Pending swaps: ${await p2.pendingSwapsLength(ctx.acc1)}`);

    prettyLog('================================================');
    prettyLog('Swap with low liquidity');
    prettyLog(`Liquidity of the bridge on chain 2: ${Wei.to((await ethers.provider.getBalance(p2.address)).toString())}`)

    await p1.connect(ctx.signers.acc1).swap(
      ctx.chain2.chainId, ctx.chain1.token.address, Wei.from('1'), gasEstimateEnough, {value: gasEstimateEnough});
    epoch++;
    prettyLog(`ETH balance of the acc1 - PRE: ${Wei.to((await ctx.signers.acc1.getBalance()).toString())}`);
    await QuantumPortalUtils.mineAndFinilizeOneToTwo(ctx, epoch);
    prettyLog(`ETH balance of the acc1 - POST: ${Wei.to((await ctx.signers.acc1.getBalance()).toString())}`);
    prettyLog(`Pending swaps: ${await p2.pendingSwapsLength(ctx.acc1)}`);
    
    console.log(`Let's add liquidity then withdraw`);
    await ctx.signers.owner.sendTransaction({
      to: p2.address,
      value: Wei.from('1')
    });
    await p2.withdrawAllPendingSwaps(ctx.acc1);
    prettyLog(`ETH balance of the acc1 - POST: ${Wei.to((await ctx.signers.acc1.getBalance()).toString())}`);
    prettyLog(`Pending swaps: ${await p2.pendingSwapsLength(ctx.acc1)}`);

    prettyLog('================================================');
    prettyLog('Do a reverse swap');
    await p2.connect(ctx.signers.acc1).swap(
      ctx.chain1.chainId, await p2.NATIVE_TOKEN(), Wei.from('1'), gasEstimateEnough, {value: totalETH});
    prettyLog(`Token balance of the bridge: ${Wei.to((await ctx.chain1.token.balanceOf(p1.address)).toString())}`);
    prettyLog(`Token balance of the acc1 - PRE: ${Wei.to((await ctx.chain1.token.balanceOf(ctx.acc1)).toString())}`);
    await QuantumPortalUtils.mineAndFinilizeTwoToOne(ctx, 1);
    prettyLog(`ETH balance of the acc1 - POST: ${Wei.to((await ctx.chain1.token.balanceOf(ctx.acc1)).toString())}`);
    });
});
