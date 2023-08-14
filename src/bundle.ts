import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

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

type Config = {
    stages: {
        [name: string]: {
            exclude?: string[]
            include?: string[]
        }
    }
}

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

    const config: Config = existsSync("./helios.config.json") ?
        JSON.parse(readFileSync("./helios.config.json").toString()) :
        {stages: {main: {}}}

    for (let key in config.stages) {
        const include = new Set(config.stages[key].include ?? [])
        const exclude = new Set(config.stages[key].exclude ?? [])

        if (include.size > 0 && exclude.size > 0) {
            throw new Error(`can't defined both include and exclude (see config for stage ${name})`)
        }

        const isIncluded = (name: string) => {
            if (include.size > 0) {
                return include.has(name) && !exclude.has(name)
            } else {
                return !exclude.has(name)
            }
        }

        if (!existsSync(`dist/${key}`)) {
            mkdirSync(`dist/${key}`)
        }

        {
            const w = new Writer()
            bundle.writeDecls(w, isIncluded)
            writeFileSync(`dist/${key}/index.d.ts`, w.toString())
        }
    
        {
            const w = new Writer()
    
            bundle.writeDefs(w, isIncluded)
    
            writeFileSync(`dist/${key}/index.js`, w.toString())
        }
    }
    
}