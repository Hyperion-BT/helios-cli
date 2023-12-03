import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

import { 
    Writer,
    parseFlag,
    parseOption,
    assertNoMoreOptions
} from "./common/utils.js"

import { Config } from "./common/Config.js"

import { 
    Bundle,
    BundleOptions
} from "./common/Bundle.js"



function parseOptions(args: string[]): BundleOptions {
	const options = {
        dumpIR: parseOption(args, "-d", "--dump-ir", true) as string[],
        lock: parseFlag(args, "-l", "--lock") as boolean
	}

	assertNoMoreOptions(args)

	return options
}

export default async function cmd(args: string[]) {
    const options = parseOptions(args)

    const config: Config = existsSync("./helios.config.json") ?
        JSON.parse(readFileSync("./helios.config.json").toString()) : (
            existsSync("./helios.config.js") ?
                await eval('import("./helios.config.js")') : 
                {stages: {main: {}}}
        )

    for (let key in config.stages) {
        const include = new Set(config.stages[key].include ?? [])
        const exclude = new Set(config.stages[key].exclude ?? [])

        if (include.size > 0 && exclude.size > 0) {
            throw new Error(`can't defined both include and exclude (see config for stage ${name})`)
        }

        const bundle = await Bundle.initHere(config.stages[key]?.define ?? {}, options)

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
    
            bundle.writeDefs(w, isIncluded, config.extraDatumTypes ?? {})
    
            writeFileSync(`dist/${key}/index.js`, w.toString())
        }

        if (options.lock) {
            bundle.writeLock()
        }
    }
    
}