import { 
    DataType,
    IR,
    IRProgram,
    Program,
    Type,
    TxType,
    UplcProgram,
    UserError,
    bytesToHex
} from "helios"

import { ContextScript } from "./ContextScript.js"

import { 
    Writer,
    assertDefined
} from "./utils.js"

export class EndpointScript extends ContextScript {
    #program: null | Program

    constructor(path: string, src: string, name: string) {
        super(path, src, name)

        this.#program = null
    }

    get program(): Program {
        if (!this.#program) {
            this.#program = Program.newInternal(this.src, this.moduleSrcs, this.scriptTypes)
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

    compile(): UplcProgram {
        const program = Program.newInternal(this.src, this.moduleSrcs, this.scriptTypes)
    
        const extra = new Map()
    
        for (let scriptName in this.scriptTypes) {
            extra.set(`__helios__scripts__${scriptName}`, new IR(`__core__macro__compile("${scriptName}", ())`))
        }
    
        const ir = program.toIR(extra)
    
        const irProgram = IRProgram.new(ir, "linking", false)
        
        return irProgram.toUplc()
    }

    writeDecl(w: Writer): void {
        // don't need the async keyword because we have the Promise return type
        w.write(
`\n${this.name}(${Array.from(this.argTypes.entries()).slice(0, this.nArgs-1).map(([name, type]) => `${name}: ${assertDefined(type.typeDetails?.inputType, `type details missing for arg '${name}: ${type.name}'`)}`).join(", ")}): Promise<${assertDefined(this.returnType.typeDetails?.outputType)}>;`
        )
    }

    writeDef(w: Writer, codeMapFileIndices: Map<string, number>): void {
        w.write(`\nasync ${this.name}(${this.argNames.slice(0, this.nArgs-1).join(", ")}) {`)
        
        w.indent()

        Array.from(this.argTypes.entries()).slice(0, this.nArgs-1).forEach(([name, type]) => {
            w.write(`${name} = await helios.jsToUplc(${JSON.stringify(assertDefined(type.typeDetails?.internalType))}, ${name}, this.jsToUplcHelpers);`)
        })

        w.undent()

        w.write(`
    const program = helios.UplcProgram.fromCborWithMapping("${bytesToHex(this.compile().toCborWithMapping(codeMapFileIndices))}", this.getSources());

    const result = await this.runLinkingProgram(program, [${this.argNames.slice(0, this.nArgs-1).join(", ")}]);
    
    return await helios.uplcToJs(${JSON.stringify(assertDefined(this.returnType.typeDetails?.internalType))}, result, this.uplcToJsHelpers);`
        )

        w.write(`\n}`)
    }

}
