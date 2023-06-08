import { Collection } from "./Collection";
import { ModuleScript } from "./ModuleScript";

export class ModuleCollection extends Collection<ModuleScript> {
    constructor(collection: ModuleScript[] = []) {
        super(collection)
    }
}