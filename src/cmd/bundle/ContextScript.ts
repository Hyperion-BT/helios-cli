import { Type } from "helios"
import { ModuleScript } from "./ModuleScript"

export type ValidatorTypes = {[name: string]: Type}

export class ContextScript extends ModuleScript {
    #validatorTypes: null | ValidatorTypes

    constructor(path: string, src: string, name: string) {
        super(path, src, name)

        this.#validatorTypes = null
    }

    get validatorTypes(): ValidatorTypes {
        if (this.#validatorTypes === null) {
            throw new Error("validatorTypes not yet registered")
        } else {
            return this.#validatorTypes
        }
    }

    registerValidatorTypes(types: ValidatorTypes) {
        this.#validatorTypes = types
    }
}