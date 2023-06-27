import process from "node:process"
import { writeFileSync } from "node:fs"

import { 
    Writer,
    parseFlag,
    assertNoMoreOptions
} from "../../utils.js"

import { 
    Bundle,
    BundleOptions
} from "./Bundle.js"

function parseCompileOptions(args: string[]): BundleOptions {
	const options = {
		simplify: parseFlag(args, "-O", "--optimize") as boolean
	}

	assertNoMoreOptions(args)

	return options
}

export async function main(args: string[]) {
    const options = parseCompileOptions(args)

    const bundle = await Bundle.init(process.cwd(), options)

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