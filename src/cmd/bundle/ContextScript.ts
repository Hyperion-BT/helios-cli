import { ScriptTypes } from "helios"
import { ModuleScript } from "./ModuleScript"

export class ContextScript extends ModuleScript {
    #scriptTypes: null | ScriptTypes

    constructor(path: string, src: string, name: string) {
        super(path, src, name)

        this.#scriptTypes = null
    }

    get scriptTypes(): ScriptTypes {
        if (this.#scriptTypes === null) {
            throw new Error("validatorTypes not yet registered")
        } else {
            return this.#scriptTypes
        }
    }

    registerScriptTypes(types: ScriptTypes) {
        this.#scriptTypes = types
    }
}