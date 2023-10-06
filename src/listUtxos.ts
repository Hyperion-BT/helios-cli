import {
    Address,
    KoiosV0
} from "helios"

import {
    UsageError,
    assertNoMoreOptions
} from "./common/utils.js"


function parseOptions(args: string[]) {
	assertNoMoreOptions(args)
}

export default async function cmd(args: string[]) {
	parseOptions(args)

	const networkName = args.shift()

	if (networkName === undefined) {
		throw new UsageError("no network-name specified")
	}

    const rawAddress = args.shift()

    if (rawAddress === undefined) {
        throw new UsageError("no address specified")
    }

    const address = Address.fromBech32(rawAddress)

    if (networkName != "mainnet" && networkName != "preprod" && networkName != "preview") {
        throw new UsageError(`unexpected network-name ${networkName}, expected "mainnet"/"preprod"/"preview"`)
    }

    const koios = new KoiosV0(networkName)

    const utxos = await koios.getUtxos(address)

    const obj = utxos.map(utxo => utxo.dump())

    console.log(JSON.stringify(obj, null, 4))
}