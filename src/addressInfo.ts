import {
    Address,
    RootPrivateKey,
    SimpleWallet,
    Network,
    WalletHelper,
    bytesToHex,
    Bip32PrivateKey,
    hexToBytes
} from "helios"

import {
    UsageError,
    assertEmpty, 
    assertNoMoreOptions,
    parseFlag,
    readFile
} from "./common/utils.js"


function parseOptions(args: string[]) {
	assertNoMoreOptions(args)
}

export default async function cmd(args: string[]) {
	parseOptions(args)

    const rawAddress = args.shift()

    assertEmpty(args)

    if (rawAddress === undefined) { 
        throw new UsageError("not address specified")
    }

    const address = Address.fromBech32(rawAddress)

    const pkh = address.pubKeyHash

    if (pkh) {
        console.log("PubKeyHash:", pkh.hex)
    }
}