import * as fs from "fs"
import * as path from "path"
import { Address, Site, UplcConst, UplcData, UplcDataValue, UplcProgram, bytesToHex, hexToBytes } from "helios"
import { assert, assertDefined, assertNoMoreOptions, parseOption } from "./common/utils.js"

type ConvertToFlatOptions = {
    output: string
}

function parseInspectTxOptions(args: string[]): ConvertToFlatOptions {
    const options = {
        output: parseOption(args, "-o", "--output") as string,
    }

    assertNoMoreOptions(args)
    
    return options
}

function readHexOrBytes(filePath: string) {

    const buffer = fs.readFileSync(filePath)

    let start = true
    let isAsciiHex = true
    let firstNonAscii = -1

    let bytes: number[] = []

    let i = 0
    let b = buffer.at(i)

    while (b) {
        bytes.push(b)

        if (start && b != 32 && b != 13 && b != 10 && b != 9) {
            start = false
        }

        if (!start && isAsciiHex && (b < 48 || (b > 57 && b < 65) || (b > 90 && b < 97) || (b > 122))) {
            isAsciiHex = false
            firstNonAscii = i
        }

        i += 1

        b = buffer.at(i)
    }
    
    if (!isAsciiHex) {
        let endingIsWhitespace = true

        for (let i = firstNonAscii; i < bytes.length; i++)  {
            const b = bytes[i]

            if (b != 32 && b != 13 && b != 10 && b != 9) {
                endingIsWhitespace = false
            }
        }

        if (endingIsWhitespace) {
            isAsciiHex = true
        }
    }

    if (isAsciiHex) {
        bytes = hexToBytes(String.fromCharCode(...bytes).trim())
    }

    return bytes
}

export default async function cmd(args: string[]) {
    const options = parseInspectTxOptions(args);

    const relFilePath = assertDefined(args.shift(), "no file specified");

    const filePath = path.resolve(relFilePath);

    if (!fs.existsSync(filePath)) {
        throw new Error("file " + filePath + " doesn't exist")
    }

    const outputPath = (options.output?.length ?? 0) > 0 ? options.output : filePath + ".flat"

    const bytes = readHexOrBytes(filePath)

    try {
        const program = UplcProgram.fromCbor(bytes.slice())

        console.log("hash of input: ", bytesToHex(program.hash()))
        console.log("mainnet enterprise addr of input (only valid for spending validators): ", Address.fromHash(program.validatorHash, false).toBech32())
        console.log("testnet enterprise addr of input (only valid for spending validators): ", Address.fromHash(program.validatorHash, true).toBech32())

        fs.writeFileSync(outputPath, new Uint8Array(program.serializeBytes()))
    } catch (_e) {
        const data = UplcData.fromCbor(bytes)

        const value = new UplcDataValue(Site.dummy(), data)

        const expr = new UplcConst(value)

        const program = new UplcProgram(expr)

        fs.writeFileSync(outputPath, new Uint8Array(program.serializeBytes()))
    }
}