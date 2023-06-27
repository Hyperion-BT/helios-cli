import { 
    DataType,
    LinkingProgram,
    Type,
    UplcProgram,
    UserError,
    bytesToHex,
    exportedForBundling
} from "helios"

const {
    IR,
    IRProgram,
    TxType
} = exportedForBundling

import { ContextScript } from "./ContextScript.js"

import { 
    Writer,
    assertDefined
} from "../../utils.js"

export class EndpointScript extends ContextScript {
    #program: null | LinkingProgram

    constructor(path: string, src: string, name: string) {
        super(path, src, name)

        this.#program = null
    }

    get program(): LinkingProgram {
        if (!this.#program) {
            try {
                this.#program = LinkingProgram.new(this.src, this.moduleSrcs, this.scriptTypes)
            } catch (e) {
                if (e instanceof UserError && e.src.fileIndex !== null) {
                    throw new Error(`'${[this.path].concat(this.modules.map(m => m.path))[e.src.fileIndex]}': ${e.message}`)
                }

                throw e
            }
        }

        return this.#program
    }

    get nArgs(): number {
        return this.program.mainFunc.nArgs;
    }

    get argNames(): string[] {
        return this.program.mainFunc.argNames
    }
    
    /**
     * Each argument of a function statement is named
     */
    get argTypes(): Map<string, DataType> {
        const argNames = this.argNames
		const argTypes = this.program.mainArgTypes

        const types: Map<string, DataType> = new Map()

        // the last argument is the ContractContext, which isn't relevant outside of helios
        for (let i = 0; i < argTypes.length - 1; i++) {
            types.set(argNames[i], argTypes[i])
        }

		return types
	}

    get returnType(): DataType {
        const types = this.program.mainFunc.retTypes

        if (types.length != 1) {
            throw new Error("expected a single return value")
        }

        return assertDefined(types[0].asDataType)
    }

    compile(simplify: boolean = false): UplcProgram {
        const program = LinkingProgram.new(this.src, this.moduleSrcs, this.scriptTypes)
    
        const extra = new Map()
    
        for (let scriptName in this.scriptTypes) {
            extra.set(`__helios__scripts__${scriptName}`, new IR(`__core__macro__compile("${scriptName}", ())`))
        }
    
        const ir = program.toIR(extra)
    
        const irProgram = IRProgram.new(ir, "linking", simplify)
        
        return irProgram.toUplc()
    }

    writeDecl(w: Writer): void {
        
        w.write(
`\nasync ${this.name}(${Array.from(this.argTypes.entries()).slice(0, this.nArgs-1).map(([name, type]) => `${name}: ${assertDefined(type.typeDetails?.inputType, `type details missing for arg '${name}: ${type.name}'`)}`).join(", ")}): Promise<${assertDefined(this.returnType.typeDetails?.outputType)}>;`
        )
    }

    writeDef(w: Writer, simplify: boolean = false): void {
        w.write(`\nasync ${this.name}(${this.argNames.slice(0, this.nArgs-1).join(", ")}) {`)
        
        w.indent()

        Array.from(this.argTypes.entries()).slice(0, this.nArgs-1).forEach(([name, type]) => {
            w.write(`${name} = helios.jsToUplc(${JSON.stringify(assertDefined(type.typeDetails?.internalType))}, ${name});`)
        })

        w.undent()

        w.write(`
    const program = helios.UplcProgram.fromCbor("${bytesToHex(this.compile(simplify).toCbor())}");

    const result = await this.runLinkingProgram(program, [${this.argNames.slice(0, this.nArgs-1).join(", ")}]);`
        )

        if (this.returnType == TxType) {
            w.write(`
    const txId = helios.uplcToJs(${JSON.stringify(assertDefined(this.returnType.typeDetails?.internalType))}, result);
    
    for (let i = 0; i < this.#txs.length; i++) {
        const tx = this.#txs[i];
        if (tx.id().eq(txId)) {
            this.#txs = this.#txs.slice(0, i).concat(this.#txs.slice(i+1));
            return tx;
        }
    }
    
    throw new Error("tx not found");`
            )
        } else {
            w.write(`
    return helios.uplcToJs(${JSON.stringify(assertDefined(this.returnType.typeDetails?.internalType))}, result);`
            )
        }

        w.write(`\n}`)
    }

}
