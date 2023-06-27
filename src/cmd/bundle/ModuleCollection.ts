import { Collection } from "./Collection.js";
import { ModuleScript } from "./ModuleScript.js";

export class ModuleCollection extends Collection<ModuleScript> {
    constructor(collection: ModuleScript[] = []) {
        super(collection)
    }
}