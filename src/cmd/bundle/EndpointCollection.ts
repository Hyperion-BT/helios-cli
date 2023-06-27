import { ScriptTypes } from "helios"
import { Collection } from "./Collection.js"
import { EndpointScript } from "./EndpointScript.js"
import { Writer } from "../../utils.js"

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