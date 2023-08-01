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
} from "./common/utils.js"


function parseOptions(args: string[]) {
	const options = {
		isMainnet: parseFlag(args, "-m", "--mainnet")
	}

	assertNoMoreOptions(args)

	return options
}

export default async function cmd(args: string[]) {
	const options = parseOptions(args)

	const inputFile = args.shift()

	if (inputFile === undefined) {
		throw new UsageError("no script file specified")
	}

	assertEmpty(args)

	const uplcProgram = deserializeUplc(readFile(inputFile))

	const address = new Address([options.isMainnet ? 0x71 : 0x70].concat(uplcProgram.hash().slice()))

	console.log(address.toBech32())
}