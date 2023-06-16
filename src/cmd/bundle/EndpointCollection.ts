import { ScriptTypes } from "helios"
import { Collection } from "./Collection"
import { EndpointScript } from "./EndpointScript"
import { Writer } from "../../utils"

export class EndpointCollection extends Collection<EndpointScript> {
    constructor(collection: EndpointScript[] = []) {
        super(collection)
    }

    registerScriptTypes(types: ScriptTypes): void {
        this.items.forEach(item => item.registerScriptTypes(types))
    }

    writeDecls(w: Writer): void {
        this.items.forEach(item => item.writeDecl(w))
    }
}