import {
    Address,
    RootPrivateKey,
    SimpleWallet,
    Network,
    bytesToHex,
    Bip32PrivateKey,
    hexToBytes
} from "helios"

import {
    assertEmpty, 
    assertNoMoreOptions
} from "./common/utils.js"


function parseOptions(args: string[]) {
	assertNoMoreOptions(args)
}

export default async function cmd(args: string[]) {
	parseOptions(args)

    if (args.length == 1) {
        const rootSpendingKey = new Bip32PrivateKey(hexToBytes(args[0]))
        const wallet = new SimpleWallet(undefined as unknown as Network, rootSpendingKey)
        const pkh = wallet.pubKeyHash

        console.log("BaseAddress (testnet):", Address.fromPubKeyHash(pkh, null, true).toBech32())
        console.log("BaseAddress (mainnet):", Address.fromPubKeyHash(pkh, null, false).toBech32())
        console.log("PubKeyHash:", pkh.hex)
    } else {
        const phrase = args.splice(0, args.length)

        assertEmpty(args)

        const rootKey = RootPrivateKey.fromPhrase(phrase)
        const spendingKey = rootKey.deriveSpendingKey()
        const wallet = new SimpleWallet(undefined as unknown as Network, spendingKey)
        const pkh = wallet.pubKeyHash

        console.log("BaseAddress (testnet):", Address.fromPubKeyHash(pkh, null, true).toBech32())
        console.log("BaseAddress (mainnet):", Address.fromPubKeyHash(pkh, null, false).toBech32())
        console.log("PubKeyHash:", pkh.hex)
        console.log("PrivateKey:", bytesToHex(spendingKey.bytes))
    }
}