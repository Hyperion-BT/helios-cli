import { ScriptPurpose } from "helios"

export class Script {
    #path: string
    #src:  string
    #name: string

    constructor(path: string, src: string, name: string) {
        this.#path = path
        this.#src = src
        this.#name = name
    }

    get path() {
        return this.#path
    }

    get src() {
        return this.#src
    }
    
    protected set src(src: string) {
        this.#src = src
    }

    get name() {
        return this.#name
    }
}