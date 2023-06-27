import {
    Address,
    deserializeUplc
} from "helios"

import {
    UsageError,
    assertEmpty, 
    assertNoMoreOptions,
    parseFlag,
    readFile
} from "../../utils.js"


function parseCalcScriptAddressOptions(args: string[]) {
	const options = {
		isMainnet: parseFlag(args, "-m", "--mainnet")
	}

	assertNoMoreOptions(args)

	return options
}

export async function calcScriptAddress(args: string[]) {
	const options = parseCalcScriptAddressOptions(args)

	const inputFile = args.shift()

	if (inputFile === undefined) {
		throw new UsageError("no script file specified")
	}

	assertEmpty(args)

	const uplcProgram = deserializeUplc(readFile(inputFile))

	const address = new Address([options.isMainnet ? 0x71 : 0x70].concat(uplcProgram.hash().slice()))

	console.log(address.toBech32())
}