import {
    existsSync,
    statSync
} from "node:fs"

import {
    dirname, 
    extname,
    join
} from "node:path"

import { Script } from "./Script.js"

//const IMPORT_RE = /import\s*?\{[\s\S]*?\}[\s]*?from[\s]*?(\"[^\"]*?\")/m

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
    }
}