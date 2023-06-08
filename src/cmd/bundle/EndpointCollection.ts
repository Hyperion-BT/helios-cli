import { Collection } from "./Collection"
import { EndpointScript } from "./EndpointScript"
import { ValidatorTypes } from "./ContextScript"
import { Writer } from "../../utils"

export class EndpointCollection extends Collection<EndpointScript> {
    constructor(collection: EndpointScript[] = []) {
        super(collection)
    }

    registerValidatorTypes(types: ValidatorTypes): void {
        this.items.forEach(item => item.registerValidatorTypes(types))
    }

    writeDecls(w: Writer): void {
        this.items.forEach(item => item.writeDecl(w))
    }
}