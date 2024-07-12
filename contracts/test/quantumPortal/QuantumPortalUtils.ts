import { ethers } from "hardhat";
import { advanceTimeAndBlock } from "foundry-contracts/dist/test/common/TimeTravel";
import { randomSalt } from "foundry-contracts/dist/test/common/Eip712Utils";
import { abi, expiryInFuture, getCtx, isAllZero, TestContext} from 
    'foundry-contracts/dist/test/common/Utils';
import { QuantumPortalLedgerMgrTest } from "../../typechain-types/QuantumPortalLedgerMgrTest";
import { QuantumPortalPocTest } from "../../typechain-types/QuantumPortalPocTest";
import { QuantumPortalState } from '../../typechain-types/QuantumPortalState';
import { DeployQp } from '../../typechain-types/DeployQp';
import { QuantumPortalGatewayDEV } from "../../typechain-types/QuantumPortalGatewayDEV";
import { QpFeeToken } from '../../typechain-types/QpFeeToken';

async function state(mgr: QuantumPortalLedgerMgrTest) {
    const stateF = await ethers.getContractFactory('QuantumPortalState');
    return stateF.attach(await mgr.state()) as QuantumPortalState;
}

export class QuantumPortalUtils {
    static FIXED_FEE_SIZE = 32*9;

    static async mine(
        chain1: number,
        chain2: number,
        source: QuantumPortalLedgerMgrTest,
        target: QuantumPortalLedgerMgrTest,
        // minerSk: string,
    ): Promise<boolean> {
        const blockReady = await source.isLocalBlockReady(chain2);
        console.log('Local block ready?', blockReady)
        if (!blockReady) { return false; }
        const sourceState = await state(source);
        const lastB = await sourceState.getLastLocalBlock(chain2);
        const nonce = lastB.nonce.toNumber();
        const lastMinedBlock = await target.lastRemoteMinedBlock(chain1);
        const minedNonce = lastMinedBlock.nonce.toNumber();
        console.log(`Local block (chain ${chain1}) nonce is ${nonce}. Remote mined block (chain ${chain2}) is ${minedNonce}`)
        if (minedNonce >= nonce) {
            console.log('Nothing to mine.');
            return false;
        }
        console.log('Last block is on chain1 for target c2 is', lastB);
        // Is block already mined?
        const alreadyMined = await QuantumPortalUtils.minedBlockHash(chain1, nonce, target);
        if (!!alreadyMined) {
            throw new Error(`Block is already mined at ${alreadyMined}`);
        }
        const sourceBlock = await source.localBlockByNonce(chain2, nonce);
        const txs = sourceBlock[1].map(tx => ({
            timestamp: tx.timestamp.toString(),
            remoteContract: tx.remoteContract.toString(),
            sourceMsgSender: tx.sourceMsgSender.toString(),
            sourceBeneficiary: tx.sourceBeneficiary.toString(),
            token: tx.token.toString(),
            amount: tx.amount.toString(),
            methods: [tx.methods[0].toString()],
            fixedFee: tx.fixedFee.toString(),
            gas: tx.gas.toString(),
        }));
        console.log('About to mine block',
            sourceBlock[0].metadata.chainId.toString(),
            sourceBlock[0].metadata.nonce.toString(),
            sourceBlock[0],
            txs);
        if (!txs.length) {
            console.log('Nothing to mine');
            return false;
        }
        await target.mineRemoteBlock(
            chain1,
            sourceBlock[0].metadata.nonce.toString(),
            txs,
            randomSalt(),
            expiryInFuture(),
            '0x',
        );
        return true;
    }

    static async finalize(
        sourceChainId: number,
        mgr: QuantumPortalLedgerMgrTest,
    ) {
        const _state = await state(mgr);
        const block = await mgr.lastRemoteMinedBlock(sourceChainId);
        const lastFin = await _state.getLastFinalizedBlock(sourceChainId);
        const blockNonce = block.nonce.toNumber();
        const fin = lastFin.nonce.toNumber();
        if (blockNonce > fin) {
            console.log(`Calling mgr.finalize(${sourceChainId}, ${blockNonce.toString()})`);
            const expiry = expiryInFuture().toString();
            const salt = randomSalt();
            const finalizersHash = randomSalt();

            const gas = await mgr.estimateGas.finalize(sourceChainId,
                blockNonce,
                [],
                finalizersHash,
                [], // TODO: Remove this parameter
                salt,
                expiry,
                '0x',
                );
            console.log("Gas required to finalize is:", gas.toString());
            await mgr.finalize(sourceChainId,
                blockNonce,
                [],
                finalizersHash,
                [], // TODO: Remove this parameter
                salt,
                expiry,
                '0x',
                );
        } else {
            console.log('Nothing to finalize...')
        }
    }

    static async mineAndFinilizeOneToOne(ctx: PortalContext, nonce: number, invalid: boolean = false) {
        let isBlRead = await ctx.chain1.ledgerMgr.isLocalBlockReady(ctx.chain1.chainId);
        if (!isBlRead) {
            await advanceTimeAndBlock(10000);
            console.log('Local block was not ready... Advancing time.');
        }
        isBlRead = await ctx.chain1.ledgerMgr.isLocalBlockReady(ctx.chain1.chainId);

        let key = (await ctx.chain1.ledgerMgr.getBlockIdx(ctx.chain1.chainId, nonce)).toString();
        const _state = await state(ctx.chain1.ledgerMgr);
        const txLen = await _state.getLocalBlockTransactionLength(key);
        console.log('Tx len for block', key, 'is', txLen.toString());
        let tx = await _state.getLocalBlockTransaction(key, 0); 
        const txs = [{
                    token: tx.token.toString(),
                    amount: tx.amount.toString(),
                    gas: tx.gas.toString(),
                    fixedFee: tx.fixedFee.toString(),
                    methods: tx.methods.length ? [tx.methods[0].toString()] : [],
                    remoteContract: tx.remoteContract.toString(),
                    sourceBeneficiary: tx.sourceBeneficiary.toString(),
                    sourceMsgSender: tx.sourceMsgSender.toString(),
                    timestamp: tx.timestamp.toString(),
            }];
        await ctx.chain1.ledgerMgr.mineRemoteBlock(
            ctx.chain1.chainId,
            nonce.toString(),
            txs,
            randomSalt(),
            expiryInFuture(),
            '0x',
        );
        console.log('Now finalizing on chain1', invalid ? [nonce.toString()] : []);
        await QuantumPortalUtils.finalize(
            ctx.chain1.chainId,
            ctx.chain1.ledgerMgr,
        );
    }

    static async mineAndFinilizeOneToTwo(ctx: PortalContext, nonce: number, invalid: boolean = false) {
        let isBlRead = await ctx.chain1.ledgerMgr.isLocalBlockReady(ctx.chain2.chainId);
        if (!isBlRead) {
            await advanceTimeAndBlock(10000);
            console.log('Local block was not ready... Advancing time.');
        }
        isBlRead = await ctx.chain1.ledgerMgr.isLocalBlockReady(ctx.chain2.chainId);

        const _state = await state(ctx.chain1.ledgerMgr);
        let key = (await ctx.chain1.ledgerMgr.getBlockIdx(ctx.chain2.chainId, nonce)).toString();
        const txLen = await _state.getLocalBlockTransactionLength(key);
        console.log('Tx len for block', key, 'is', txLen.toString(), nonce);
        let tx = await _state.getLocalBlockTransaction(key, 0); 
        const txs = [{
                    token: tx.token.toString(),
                    amount: tx.amount.toString(),
                    gas: tx.gas.toString(),
                    fixedFee: tx.fixedFee.toString(),
                    methods: tx.methods.length ? [tx.methods[0].toString()] : [],
                    remoteContract: tx.remoteContract.toString(),
                    sourceBeneficiary: tx.sourceBeneficiary.toString(),
                    sourceMsgSender: tx.sourceMsgSender.toString(),
                    timestamp: tx.timestamp.toString(),
            }];
        await ctx.chain2.ledgerMgr.mineRemoteBlock(
            ctx.chain1.chainId,
            nonce.toString(),
            txs,
            randomSalt(),
            expiryInFuture(),
            '0x',
        );
        console.log('Now finalizing on chain2', invalid ? [nonce.toString()] : []);
        await QuantumPortalUtils.finalize(
            ctx.chain1.chainId,
            ctx.chain2.ledgerMgr,
        );
    }

    static async mineAndFinilizeTwoToOne(ctx: PortalContext, nonce: number, invalid: boolean = false) {
        const _state = await state(ctx.chain2.ledgerMgr);
        let key = (await ctx.chain2.ledgerMgr.getBlockIdx(ctx.chain1.chainId, nonce)).toString();
        console.log('Key is', key, nonce);
        let tx = await _state.getLocalBlockTransaction(key, 0); 
        const txs = [{
                    token: tx.token.toString(),
                    amount: tx.amount.toString(),
                    gas: tx.gas.toString(),
                    fixedFee: tx.fixedFee.toString(),
                    methods: [tx.methods[0].toString()],
                    remoteContract: tx.remoteContract.toString(),
                    sourceBeneficiary: tx.sourceBeneficiary.toString(),
                    sourceMsgSender: tx.sourceMsgSender.toString(),
                    timestamp: tx.timestamp.toString(),
            }];
        await ctx.chain1.ledgerMgr.mineRemoteBlock(
            ctx.chain2.chainId,
            nonce.toString(),
            txs,
            randomSalt(),
            expiryInFuture(),
            '0x',
        );
        console.log('Now finalizing on chain1');
        await QuantumPortalUtils.finalize(
            ctx.chain2.chainId,
            ctx.chain1.ledgerMgr,
        );
    }
    
    static async minedBlockHash(
        chain: number,
        nonce: number,
        mgr: QuantumPortalLedgerMgrTest,
    ): Promise<string | undefined> {
        const existingBlock = await mgr.minedBlockByNonce(chain, nonce);
        const block = existingBlock[0].blockHash.toString();
        return isAllZero(block) ? undefined : block;
    }
}

export interface PortalContext extends TestContext {
    chain1: {
        chainId: number;
        ledgerMgr: QuantumPortalLedgerMgrTest;
        poc: QuantumPortalPocTest;
        token: QpFeeToken;
    },
    chain2: {
        chainId: number;
        ledgerMgr: QuantumPortalLedgerMgrTest;
        poc: QuantumPortalPocTest;
        token: QpFeeToken;
    },
}

export async function deployAll(): Promise<PortalContext> {
	const ctx = await getCtx();
    const depF = await ethers.getContractFactory('DeployQp');
    const dep1 = await depF.deploy() as DeployQp;
    const dep2 = await depF.deploy() as DeployQp;
    console.log('Deployed basic deployers');

    const gateF = await ethers.getContractFactory('QuantumPortalGatewayDEV');

    const chainId1 = (await dep1.realChainId()).toNumber();
    const chainId2 = 2;
    console.log(`Chain IDS: ${chainId1} / ${chainId2}`);

    const mgrF = await ethers.getContractFactory('QuantumPortalLedgerMgrTest');
    const mgr1 = await mgrF.deploy(chainId1) as QuantumPortalLedgerMgrTest;
    await mgr1.transferOwnership(dep1.address);
    const mgr2 = await mgrF.deploy(chainId2) as QuantumPortalLedgerMgrTest;
    await mgr2.transferOwnership(dep2.address);
    const pocF = await ethers.getContractFactory('QuantumPortalPocTest');
    const poc1 = await pocF.deploy(chainId1) as QuantumPortalPocTest;
    await poc1.transferOwnership(dep1.address);
    const poc2 = await pocF.deploy(chainId2) as QuantumPortalPocTest;
    await poc2.transferOwnership(dep2.address);

    await dep1.deployWithToken(chainId1, mgr1.address, poc1.address);
    await dep2.deployWithToken(chainId2, mgr2.address, poc2.address);
    const gate1 = gateF.attach(await dep1.gateway()) as QuantumPortalGatewayDEV;
    const gate2 = gateF.attach(await dep2.gateway()) as QuantumPortalGatewayDEV;

    const tokF = await ethers.getContractFactory('QpFeeToken');
    console.log('Deploy complete')

	return {
        ...ctx,
        chain1: {
            chainId: chainId1,
            ledgerMgr: mgrF.attach(await gate1.quantumPortalLedgerMgr()),
            poc: pocF.attach(await gate1.quantumPortalPoc()),
            token:  tokF.attach(await gate1.feeToken()),
        },
        chain2: {
            chainId: chainId2,
            ledgerMgr: mgrF.attach(await gate2.quantumPortalLedgerMgr()),
            poc: pocF.attach(await gate2.quantumPortalPoc()),
            token:  tokF.attach(await gate2.feeToken()),
        }
    } as PortalContext;
}

export async function estimateGasUsingEthCall(contract: string, encodedAbiForEstimateGas: string) {
    const res = await ethers.provider.call({
        data: encodedAbiForEstimateGas,
        to: contract,
    });
    console.log(`Result of eth_call: `, res);

    // Check if the result represents an error
    if (res.startsWith("0x08c379a0")) {
        const errorMessage = abi.decode(['string'], '0x'+res.substring(10)) as any as string;
        return Number.parseInt(errorMessage);
    } else {
        // Parse the result for successful execution (if needed)
        throw new Error('Estimate gas method call must fail, but this call will succeed');
    }
}