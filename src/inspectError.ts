import * as fs from "fs"
import * as path from "path"
import { assert, assertDefined, assertNoMoreOptions } from "./common/utils.js"
import { 
    BitWriter, 
    ByteArrayData,
    ConstrData, 
    IntData,
    ListData, 
    MapData, 
    Site, 
    UplcConst, 
    UplcData, 
    UplcDataValue, 
    UplcInt, 
    UplcByteArray,
    UplcProgram, 
    bytesToHex
} from "helios"

type InspectErrorOptions = {}

function parseDagOptions(args: string[]): InspectErrorOptions {
    assertNoMoreOptions(args)
    
    return {}
}

let argCount = 0

function unstring(str: string): string {
    let n = str.length

    assert(str[0] == '"' && str[n-1] == '"', "doesn't start and end with double quotes")

    str = str.substring(1, n-1)

    n = str.length

    const chars: string[] = []

    let escaping = false
    for (let i = 0; i < n; i++) {
        const c = str.charAt(i)

        if (!escaping) {
            if (c == '\\') {
                escaping = true
            } else {
                chars.push(c)
            }
        } else {
            if (c == '\\') {
                chars.push(c)
            } else if (c == '"') {
                chars.push(c)
            } else if (c == 'n') {
                chars.push('\n')
            } else {
                throw new Error("unrecognized escape \\" + c)
            }

            escaping = false
        }
    }

    return chars.join("")
}

const expectedPrefix = "transaction submit error"

const byteMap: {[sequence: string]: number} = (() => {
    const obj = {
        "0": 0,
        NUL: 0,
        SOH: 1,
        STX: 2,
        ETX: 3,
        EOT: 4,
        ENQ: 5,
        ACK: 6,
        BEL: 7,
        a: 7,
        BS: 8,
        b: 8,
        HT: 9,
        t: 9,
        LF: 10,
        n: 10,
        VT: 11,
        v: 11,
        FF: 12,
        f: 12,
        CR: 13,
        r: 13,
        SO: 14,
        SI: 15,
        DLE: 16,
        DC1: 17,
        DC2: 18,
        DC3: 19,
        DC4: 20,
        NAK: 21,
        SYN: 22,
        ETB: 23,
        CAN: 24,
        EM: 25,
        SUB: 26,
        ESC: 27,
        FS: 28,
        GS: 29,
        RS: 30,
        US: 31,
        DEL: 127
    }

    for (let i = 128; i <= 255; i++) {
        obj[i.toString()] = i
    }

    return obj
})()

function splitGroup(g: string, fs: string = ','): string[] {
    if (g.trim() == "") {
        return []
    }

    if (g.charAt(0) == "(") {
        g = g.slice(1, g.length - 1)
    } else if (g.charAt(0) == "[") {
        g = g.slice(1, g.length - 1)
    } else {
        throw new Error("unexpected group" + g)
    }

    let count = 0
    let insideString = false
    let escaping = false

    let chars: string[] = []
    let fields: string[] = []

    for (let i = 0; i < g.length; i++) {
        assert(count >= 0)
        const c = g.charAt(i)

        if (insideString) {
            if (escaping) {
                escaping = false
            } else {
                if (c == '\\') {
                    escaping = true
                } else if (c == '"') {
                    insideString = false
                }
            }
        } else {
            if (c == '(' || c == '[') {
                count += 1
            } else if (c == ')' || c == ']') {
                count -= 1
            } else if (c == fs && count == 0) {
                fields.push(chars.join(""))
                chars = []
                continue
            } else if (c == '"') {
                insideString = true
            }
        }

        chars.push(c)
    }

    assert(count == 0)

    if (chars.length > 0) {
        fields.push(chars.join(""))
    }

    return fields
}

class Source {
    #raw: string
    #pos: number

    constructor(raw: string) {
        this.#raw = raw
        this.#pos = 0

        this.eatWhitespace()
    }

    peekChar() {
        if (this.#pos >=this.#raw.length) {
            return ''
        } else {
            return this.#raw.charAt(this.#pos)
        }
    }

    eatChar() {
        const pos = this.#pos
        this.#pos += 1
        return this.#raw.charAt(pos)
    }

    eatWhitespace() {
        let c = this.peekChar()

        while (c == ' ' || c == '\n' || c == '\t') {
            this.#pos += 1
            c = this.peekChar()
        }
    }

    eatNumber() {
        let chars: string[] = []

        let c = this.#raw[this.#pos]

        while (c >= '0' && c <= '9') {
            chars.push(c)
            this.#pos += 1

            c = this.#raw[this.#pos]
        }

        this.eatWhitespace()

        return BigInt(chars.join(""))
    }

    eatUplcData(): (UplcData | null) {
        this.eatWhitespace()

        const tmp = this.#raw.slice(this.#pos);

        if (this.#raw[this.#pos] == 'B' && this.#raw[this.#pos+1] == ' ') {
            this.eatWord()

            let bytes: (number | string)[] = []

            let escaping = false
            let sequence = ""

            assert(this.eatChar() == '"')

            while (this.#pos < this.#raw.length) {
                const c = this.#raw[this.#pos]

                this.#pos += 1

                if (!escaping) {
                    if (c == '\\') {
                        escaping = true
                    } else if (c == '"') {
                        break
                    } else {
                        bytes.push(c)
                    }
                } else {
                    if (c == '\\') {
                        bytes.push(c)
                        escaping = false
                    } else if (c == 'n') {
                        bytes.push('\n')
                        escaping = false
                    } else if (c == '"') {
                        bytes.push('"')
                        escaping = false
                    } else if (c == '&') {
                        //bytes.push('&')
                        escaping = false
                    } else {
                        sequence = sequence + c

                        if (sequence in byteMap && !((sequence + this.#raw[this.#pos]) in byteMap)) {
                            bytes.push(assertDefined(byteMap[sequence]))
                            sequence = ""
                            escaping = false
                        } else if (sequence.length > 3) {
                            throw new Error("invalid sequence " + sequence)
                        }
                    }
                }
            }

            assert(sequence.length == 0, "invalid sequence " + sequence)

            const bs = bytes.map(b => {
                if (typeof b == "number") {
                    return b
                } else {
                    return b.charCodeAt(0)
                }
            })

            return new ByteArrayData(bs)
        } else if (this.#raw[this.#pos] == 'I' && this.#raw) {
            this.eatWord()

            const x = this.eatNumber()

            return new IntData(x)
        } else if (this.#raw.slice(this.#pos).startsWith("List [")) {
            this.eatWord()

            const g = this.eatGroup()

            const fields = splitGroup(g)

            return new ListData(fields.map(f => assertDefined((new Source(f)).eatUplcData())))
        } else if (this.#raw.slice(this.#pos).startsWith("Map [")) {
            this.eatWord()

            const g = this.eatGroup()

            const fields = splitGroup(g)

            return new MapData(fields.map(f => {
                const kv = splitGroup(f)

                assert(kv.length == 2)

                return [
                    assertDefined((new Source(kv[0]).eatUplcData())),
                    assertDefined((new Source(kv[1]).eatUplcData()))
                ]
            }))
        } else if (this.#raw.slice(this.#pos).startsWith("Constr ")) {
            this.eatWord()

            const index = this.eatNumber()
            const g = this.eatGroup()
            const fields = splitGroup(g)

            return new ConstrData(Number(index), fields.map(f => {
                return assertDefined((new Source(f)).eatUplcData())
            }))
        } else {
            return null
        }
    }

    eatSymbol(): string {
        let c = this.peekChar()

        const chars: string[] = []

        while (c == ':' || c == '.' || c == '{' || c == '|' || c == '}' || c == '-' || c == ',' || c == ';' || c == '=') {
            chars.push(c)

            this.#pos += 1
            c = this.peekChar()
        }

        this.eatWhitespace()

        return chars.join("")
    }

    eatWord(): string {
        let c = this.peekChar()

        const chars: string[] = []

        while ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_' || (c >= '0' && c <= '9')) {
            chars.push(c)

            this.#pos += 1
            c = this.peekChar()
        }

        this.eatWhitespace()

        return chars.join("")
    }

    eatGroup(): string {
        let open = this.peekChar()

        let close: string
        
        if (open == '[') {
            close = ']'
        } else if (open == '(') {
            close = ')'
        } else {
            return ""
        }

        const start = this.#pos

        this.eatChar()

        let count = 1
        let insideString = false
        let escaping = false

        while (count > 0 && this.#pos < this.#raw.length) {
            const c = this.#raw.charAt(this.#pos)

            if (insideString) {
                if (escaping) {
                    escaping = false
                } else if (c == '\\') {
                    escaping = true
                } else if (c == '"') {
                    insideString = false
                }
            } else {
                if (c == '"') {
                    insideString = true
                } else if (c == close) {
                    count -= 1
                } else if (c == open) {
                    count += 1
                }
            }

            this.#pos += 1
        }

        const g = this.#raw.slice(start, this.#pos)

        this.eatWhitespace()

        assert(g.trim() != "", "empty group")

        return g
    }

    eatString(): string {
        let c = this.peekChar()

        if (c != '"') {
            return ""
        }

        this.eatChar()

        let escaping = false

        const chars: string[] = []

        while (this.#pos < this.#raw.length) {
            const c = this.#raw.charAt(this.#pos)

            this.#pos += 1

            if (escaping) {
                if (c == '\\') {
                    chars.push(c)
                } else if (c == 'n') {
                    chars.push('\n')
                } else if (c == 't') {
                    chars.push('\t')
                } else if (c == '"') {
                    chars.push(c)
                } else {
                    throw new Error("unrecognized escape \\" + c)
                }
                
                escaping = false
            } else {
                if (c == '\\') {
                    escaping = true
                } else if (c == '"') {
                    break
                } else {
                    chars.push(c)
                }
            }
        }

        return '"' + chars.join("") + '"'
    }

    eatToken(): string {
        this.eatWhitespace()

        const d = this.eatUplcData() 

        if (d) {
            const value = (new UplcDataValue(Site.dummy(), d))

            const ct = new UplcConst(value)

            const bw = new BitWriter()

            ct.toFlat(bw)

            UplcByteArray.writeBytes(bw, d.toCbor(), false)

            const by = bw.finalize(false)

            const pr = new UplcProgram(ct)

            const pb = pr.serializeBytes()

            fs.writeFileSync(`./arg-${argCount}-as-program.flat`, new Uint8Array(pb))

            fs.writeFileSync(`./arg-${argCount}.flat`, new Uint8Array(by))

            fs.writeFileSync(`./arg-${argCount}-as-program.cborHex`, bytesToHex(pr.toCbor()))

            const s = `${argCount}=${value.toString()}`

            argCount++

            return s;
        }

        const w = this.eatWord()

        if (w.length > 0) {
            return w
        }

        const sy = this.eatSymbol()

        if (sy.length > 0) {
            return sy
        }

        const g = this.eatGroup()

        if (g.length > 0) {
            return g
        }

        const s = this.eatString()

        if (s.length > 0) {
            return s
        }

        return ""
    }

    rest(): string {
        return this.#raw.slice(this.#pos)
    }
}

const TAB = "  "

function unwrap(src: Source, indent: string = ""): string[][] {
    let t = src.eatToken()

    const ts: string[] = []
    while (t.length > 0) {
        ts.push(t)

        t = src.eatToken()
    }

    let lines: string[][] = [[indent]]

    ts.forEach(t => {
        const current = lines[lines.length - 1]

        if (t.startsWith("(")) {
            current.push("(")
            lines = lines.concat(unwrap(new Source(t.slice(1, t.length-1)), indent + TAB))
            lines.push([indent, ")"])
        } else if (t.startsWith("[")) {
            current.push("[")
            lines = lines.concat(unwrap(new Source(t.slice(1, t.length-1)), indent + TAB))
            lines.push([indent, "]"])
        } else if (t.startsWith('"')) {
            current.push('"')
            lines = lines.concat(unwrap(new Source(t.slice(1, t.length-1)), indent + TAB))
            lines.push([indent, '"'])
        } else {
            current.push(t)
        }
    })

    return lines
}

export default async function cmd(args: string[]) {
    void parseDagOptions(args)

    const relFilePath = assertDefined(args.shift(), "no file specified")

    const filePath = path.resolve(relFilePath)

    if (!fs.existsSync(filePath)) {
        throw new Error("file " + filePath + " doesn't exist")
    }

    const obj = JSON.parse(fs.readFileSync(filePath).toString())

    let message = assertDefined(obj["message"], "obj.message not found") as string

    message = unstring(message)

    const res = unwrap(new Source(message)).map(ts => ts.join(" ")).join("\n")

    console.log(res)
}