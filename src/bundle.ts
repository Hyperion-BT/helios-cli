
import { writeFileSync } from "node:fs"

import { 
    Writer,
    parseFlag,
    parseOption,
    assertNoMoreOptions
} from "./common/utils.js"

import { 
    Bundle,
    BundleOptions
} from "./common/Bundle.js"

function parseOptions(args: string[]): BundleOptions {
	const options = {
        dumpIR: parseOption(args, "-d", "--dump-ir", true) as string[]
	}

	assertNoMoreOptions(args)

	return options
}

export default async function cmd(args: string[]) {
    const options = parseOptions(args)

    const bundle = await Bundle.initHere(options)

    {
        const w = new Writer()

        bundle.writeDecls(w)

        writeFileSync("dist/index.d.ts", w.toString())
    }

    {
        const w = new Writer()

        bundle.writeDefs(w)

        writeFileSync("dist/index.js", w.toString())
    }
}