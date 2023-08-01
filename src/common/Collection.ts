import { ModuleScript } from "./ModuleScript.js"

export class Collection<T extends ModuleScript> {
    #collection: T[]

    constructor(collection: T[] = []) {
        this.#collection = collection
    }

    get items(): T[] {
        return this.#collection.slice()
    }

    add(script: T) {
        this.#collection.push(script)
    }

    forEach(fn: (item: T) => void) {
        this.#collection.forEach(fn)
    }

    map<Tout>(fn: (item: T) => Tout): {[name: string]: Tout} {
        const obj: {[name: string]: Tout} = {}

        this.#collection.forEach(item => {
            obj[item.name] = fn(item)
        })

        return obj
    }

    registerModules(modules: Collection<ModuleScript>) {
        this.#collection.forEach(s => s.registerModules(modules.items))
    }

    registerCodeMapFileIndices(codeMapFileIndices: Map<string, number>) {
        this.#collection.forEach(s => s.registerCodeMapFileIndices(codeMapFileIndices))
    }
}