import { 
    ByteArrayData,
    Program, 
    ScriptPurpose,
    Type,
    UplcProgram,
    UserError,
    bytesToHex,
    exportedForBundling
} from "helios"

const {
    ArgType,
    FuncType,
    IRProgram,
    IRParametricProgram,
    MintingPolicyHashType,
    Site,
    ValidatorHashType,
    Word
} = exportedForBundling

import { 
    assert,
    assertDefined
} from "../../utils"

import { ContextScript } from "./ContextScript"

export class ValidatorScript extends ContextScript {
    #purpose: ScriptPurpose
    #program: null | Program
    #validators: null | ValidatorScript[]

    constructor(path: string, src: string, name: string, purpose: ScriptPurpose) {
        super(path, src, name)

        this.#purpose = purpose
        this.#program = null
        this.#validators = null
    }

    /**
     * Returns list of tuples of name-Type
     * TODO: convert to Map
     */
    get parameters(): Type[] {
        return this.program.posParams
    }

    get purpose(): ScriptPurpose {
        return this.#purpose
    }

    get program(): Program {
        if (!this.#program) {
            try {
                this.#program = Program.new(this.src, this.modules.map(m => m.src))
            } catch(e) {
                if (e instanceof UserError && e.src.fileIndex !== null) {
                    throw new Error(`'${[this.path].concat(this.modules.map(m => m.path))[e.src.fileIndex]}': ${e.message}`)
                }

                throw e
            }
        }

        return this.#program
    }

    get validators(): ValidatorScript[] {
        if (!this.#validators) {
            throw new Error("validators not yet registered")
        }

        return this.#validators
    }

    get type(): Type {
        switch(this.purpose) {
            case "spending":
                return ValidatorHashType
            case "minting":
                return MintingPolicyHashType
            default:
                throw new Error("unhandled validator type")
        }
    }

    get parametricType(): Type {
        const baseType = this.type

        const params = this.parameters

        if (params.length == 0) {
            return baseType
        } else {
            return new FuncType(
                params, 
                baseType
            )
        }
    }

    hasParameters(params: string[]): boolean {
        const ownParams = this.parameters

        return params.every(p => ownParams.findIndex(op => op[0] == p) != -1)
    }

    registerValidators(validators: ValidatorScript[]) {
        this.#validators = validators
    }

    compile(callers: string[], simplify: boolean = false): UplcProgram {
        if (callers.some(c => c == this.name)) {
            throw new Error(`circular dependecy detected: ${callers.join(", ")}, ${this.name}`)
        }
        const program = Program.new(this.src, this.moduleSrcs, this.validatorTypes)

        const testIR = program.toIR()

        const extra = new Map()

        for (let validatorName in this.validatorTypes) {
            if (testIR.includes(`__helios__scriptcollection__${validatorName}`)) {
                const validator = assertDefined(this.validators.find(v => v.name == validatorName))

                const validatorUplc = validator.compile(callers.concat([this.name]), simplify)

                extra.set(`__helios__scriptcollection__${validatorName}`, `##${bytesToHex((new ByteArrayData(validatorUplc.hash())).toCbor())}`)
            }
        }
    
        const ir = program.toIR(extra)

        if (program.nPosParams > 0) {
            const irProgram = IRParametricProgram.new(ir, this.#purpose, program.nPosParams, simplify);

		    return irProgram.toUplc()
        } else {
            const irProgram = IRProgram.new(ir, this.#purpose, simplify)
            
            return irProgram.toUplc()
        }
    }
}