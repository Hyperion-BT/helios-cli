import * as fs from "fs"
import * as path from "path"
import { assertClass, TxOutput, BlockfrostV0, Tx, hexToBytes } from "helios"
import { assert, assertDefined, assertNoMoreOptions } from "./common/utils.js"

type InspectTxOptions = {}

function parseInspectTxOptions(args: string[]): InspectTxOptions {
    assertNoMoreOptions(args)
    
    return {}
}

export default async function cmd(args: string[]) {
    void parseInspectTxOptions(args);

    const relFilePath = assertDefined(args.shift(), "no file specified");

    const filePath = path.resolve(relFilePath);

    if (!fs.existsSync(filePath)) {
        throw new Error("file " + filePath + " doesn't exist")
    }

    const bytes = hexToBytes(fs.readFileSync(filePath).toString().trim())

    const tx = Tx.fromCbor(bytes)

    const network = await BlockfrostV0.resolveUsingUtxo(tx.body.inputs[0], {
        "preview": "previewIMakoqNtbySYNVIpOsPKv16ZV4vhes6B",
        "preprod": "preprod0pfhlHkVoJ3Bkwn3Ap3lP1VAysoIqwFl",
        "mainnet": "mainnetqsDaHl6e6lo3M2vnfMfddXxOrJoKtoIA"
    })
    
    const params = await network.getParameters()
    
    await tx.completeInputData(async (id) => {
        return await network.getUtxo(id).then(inp => {
            return assertDefined(assertClass(inp.origOutput, TxOutput))
        })
    })

    const obj = tx.dump(params)

    console.log(JSON.stringify(obj, undefined, 4))
}