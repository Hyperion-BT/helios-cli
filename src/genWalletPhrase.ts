import { getRandomValues } from "node:crypto"

import {
    Address,
    RootPrivateKey,
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
	assertNoMoreOptions(args)
}

export default async function cmd(args: string[]) {
	parseOptions(args)

	assertEmpty(args)

    const entropy = getRandomValues(new Uint8Array(32))

    const rootPrivateKey = new RootPrivateKey(Array.from(entropy))

    const phrase = rootPrivateKey.toPhrase()

	console.log(JSON.stringify(phrase, null, 4))
}