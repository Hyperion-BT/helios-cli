import { ScriptTypes } from "helios"

import { ValidatorScript } from "./ValidatorScript.js"
import { Collection } from "./Collection.js"


export class ValidatorCollection extends Collection<ValidatorScript> {
    constructor(collection: ValidatorScript[] = []) {
        super(collection)
    }

    get scriptTypes(): ScriptTypes {
        return this.map(item => item.type)
    }

    registerValidatorTypes(types: ScriptTypes) {
        this.items.forEach(item => item.registerScriptTypes(types))
    }

    registerValidators() {
        this.items.forEach(item => item.registerValidators(this.items))
    }
}