import { assertNoMoreOptions } from "./common/utils.js"
import { Bundle } from "./common/Bundle.js"

type DagOptions = {}

function parseDagOptions(args: string[]): DagOptions {
    assertNoMoreOptions(args)
    
    return {}
}

export default async function cmd(args: string[]) {
    void parseDagOptions(args)

    const bundle = await Bundle.initHere()

    const dag = bundle.generateDag()

    console.log(JSON.stringify(dag, undefined, 4))
}