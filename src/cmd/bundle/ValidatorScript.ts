import {
    IRDefinitions,
    Program, 
    ScriptPurpose,
    Type,
    UplcProgram,
    UserError,
    bytesToHex,
    exportedForBundling
} from "helios"

const {
    IR,
    IRProgram,
    IRParametricProgram,
    MintingPolicyHashType,
    StakingValidatorHashType,
    ValidatorHashType
} = exportedForBundling

import {
    assertDefined
} from "../../utils.js"

import { ContextScript } from "./ContextScript.js"

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
                this.#program = Program.new(this.src, this.moduleSrcs, this.scriptTypes, {
                    allowPosParams: false,
                    invertEntryPoint: true 
                });
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

    get type(): exportedForBundling.ScriptHashType {
        switch(this.purpose) {
            case "spending":
                return ValidatorHashType
            case "minting":
                return MintingPolicyHashType
            case "staking":
                return StakingValidatorHashType
            default:
                throw new Error("unhandled validator type")
        }
    }
    
    registerValidators(validators: ValidatorScript[]) {
        this.#validators = validators
    }

    toTestIR(): exportedForBundling.IR {
        const extra: IRDefinitions = new Map()
    
        for (let scriptName in this.scriptTypes) {
            extra.set(`__helios__scripts__${scriptName}`, new IR(`#`))
        }

        return this.program.toIR(extra)
    }

    compile(callers: string[], simplify: boolean = false): UplcProgram {
        if (callers.some(c => c == this.name)) {
            throw new Error(`circular dependecy detected: ${callers.join(" -> ")} -> ${this.name}`)
        }

        const program = this.program

        const testIR = this.toTestIR()

        const extra: IRDefinitions = new Map()

        for (let scriptName in this.scriptTypes) {
            const key = `__helios__scripts__${scriptName}`;

            if (testIR.includes(key)) {
                if (scriptName == this.name) {
                    let ir = new IR(`__PARAM_${this.program.nPosParams - 1}`);

                    switch (this.purpose) {
                        case "spending":
                            ir = new IR([
                                new IR(`__helios__scriptcontext__get_current_validator_hash(`),
                                ir,
                                new IR(`)()`)
                            ]);
                            break;
                        case "minting":
                            ir = new IR([
                                new IR(`__helios__scriptcontext__get_current_minting_policy_hash(`),
                                ir,
                                new IR(`)()`)
                            ]);
                            break;
                        default:
                            throw new Error("unhandled purpose");
                    }

                    extra.set(key, ir);
                } else {
                    const script = assertDefined(this.validators.find(v => v.name == scriptName))

                    const scriptUplc = script.compile(callers.concat([this.name]), simplify)

                    extra.set(key, new IR(`#${bytesToHex(scriptUplc.hash())}`))
                }
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