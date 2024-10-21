import { address } from 'bitcoinjs-lib';
export class NetworkFeeEstimator {
    static inputType(addr, network) {
        try {
            const ver = address.fromBase58Check(addr).version;
            switch (ver) {
                case network.pubKeyHash: return 'p2pkh';
                case network.scriptHash: return 'p2sh';
                default: throw new Error(`Invalid base58 address. Unexpected version ${ver}`);
            }
        }
        catch (e) {
            if (e instanceof TypeError) {
                const ver = address.fromBech32(addr).version;
                switch (ver) {
                    case 0x00: 'p2wpkh';
                    case 0x01: 'p2tr';
                    default: throw new Error(`Invalid bench32 address. Unexpected version ${ver}`);
                }
            }
            else {
                throw e;
            }
        }
    }
    /**
     * Returns the vsize for the Commit transaction. The commit transaction takes funds from the
     * user's wallet and sends them to the commit address. The commit address is a p2tr address.
     * These sizes are calclated empirically.
     */
    static estimateLenForCommit(inputType) {
        switch (inputType) {
            case 'p2pkh': return BigInt(148);
            case 'p2sh': return BigInt(91);
            case 'p2wpkh': return BigInt(68);
            case 'p2wsh': return BigInt(91);
            default: throw new Error(`Unsupported address type ${inputType}`);
        }
    }
    static estimateLenForInscription(inscriptionLength, outputType) {
        const fistPartLen = BigInt(inscriptionLength + 58);
        switch (outputType) {
            case 'p2pkh': return BigInt(148) + fistPartLen;
            case 'p2sh': return BigInt(91) + fistPartLen;
            case 'p2wpkh': return BigInt(68) + fistPartLen;
            case 'p2wsh': return BigInt(91) + fistPartLen;
            default: throw new Error(`Unsupported address type ${outputType}`);
        }
    }
    static estimateFee(feeRate, txLen) {
        return BigInt(feeRate * 10000) * txLen / BigInt(10000);
    }
}
//# sourceMappingURL=NetworkFeeEstimator.js.map