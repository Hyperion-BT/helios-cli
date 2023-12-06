import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

import { resolve } from "node:path"

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

    const heliosConfigPath = resolve("./helios.config.js")

    const config: Config = existsSync("./helios.config.json") ?
        JSON.parse(readFileSync("./helios.config.json").toString()) : (
            existsSync(heliosConfigPath) ?
                await eval(`import("${heliosConfigPath}")`) : 
                {stages: {main: {}}}
        )

    for (let key in config.stages) {
        const stageConfig = config.stages[key]
        const include = new Set(stageConfig.include ?? [])
        const exclude = new Set(stageConfig.exclude ?? [])

        if (include.size > 0 && exclude.size > 0) {
            throw new Error(`can't defined both include and exclude (see config for stage ${name})`)
        }

        const bundle = await Bundle.initHere(stageConfig?.define ?? {}, options)

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
    
            bundle.writeDefs(w, isIncluded, !(stageConfig.isMainnet ?? false), config.extraDatumTypes ?? {})
    
            writeFileSync(`dist/${key}/index.js`, w.toString())
        }

        if (options.lock) {
            bundle.writeLock()
        }
    }
    
}