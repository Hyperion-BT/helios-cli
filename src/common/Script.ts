export class Script {
    #path: string
    #src:  string
    #name: string
    #codeMapFileIndices: null | Map<string, number>

    constructor(path: string, src: string, name: string) {
        this.#path = path
        this.#src = src
        this.#name = name
        this.#codeMapFileIndices = null;
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