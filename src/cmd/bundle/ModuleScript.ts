import {
    dirname, 
    join
} from "node:path"

import { Script } from "./Script.js"

const IMPORT_RE = /import\s*?\{[\s\S]*?\}[\s]*?from[\s]*?(\"[^\"]*?\")/m

export class ModuleScript extends Script {
    #modules: null | ModuleScript[]

    constructor(path: string, src: string, name: string) {
        super(path, src, name)

        this.#modules = null
    }

    get modules(): ModuleScript[] {
        if (this.#modules === null) {
            throw new Error("modules not yet registered")
        } else {
            return this.#modules
        }
    }

    get moduleSrcs(): string[] {
        return this.modules.map(m => m.src)
    }

    registerModules(modules: ModuleScript[]) {
        this.#modules = modules

        // also in-place change of path import statements
		let statement = this.src.match(IMPORT_RE);
		while (statement) {
			const hlPath = statement[1]
			const hlPathInner = hlPath.slice(1, hlPath.length - 1)

			const depPath = join(dirname(this.path), hlPathInner)

			const depModule = this.#modules.find(m => m.path == depPath)

            if (!depModule) {
                throw new Error(`dependency ${depPath} not found`)
            }

			const depName = depModule.name

			if (statement.index == undefined) {
				throw new Error("unexpected")
			}

			// change the path by the name of the module
			this.src = this.src.slice(0, statement.index) + statement[0].slice(0, statement[0].length - statement[1].length) + depName + this.src.slice(statement.index + statement[0].length)

			statement = this.src.match(IMPORT_RE);
		}
    }
}