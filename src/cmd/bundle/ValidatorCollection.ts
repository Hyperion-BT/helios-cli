import { ValidatorScript } from "./ValidatorScript"
import { Collection } from "./Collection"
import { ValidatorTypes } from "./ContextScript"


export class ValidatorCollection extends Collection<ValidatorScript> {
    constructor(collection: ValidatorScript[] = []) {
        super(collection)
    }

    get validatorTypes(): ValidatorTypes {
        return this.map(item => item.type)
    }

    get parametricValidatorTypes(): ValidatorTypes {
        return this.map(item => item.parametricType)
    }

    registerValidatorTypes(types: ValidatorTypes) {
        this.items.forEach(item => item.registerValidatorTypes(types))
    }

    registerValidators() {
        this.items.forEach(item => item.registerValidators(this.items))
    }
}