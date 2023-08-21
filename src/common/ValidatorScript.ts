import {
    assertDefined,
    IRDefinitions,
    DatumRedeemerProgram,
    Program, 
    ScriptPurpose,
    Type,
    ToIRContext,
    UplcProgram,
    UserError,
    bytesToHex,
    IR,
    IRProgram,
    IRParametricProgram,
    MintingPolicyHashType,
    ScriptHashType,
    StakingValidatorHashType,
    ValidatorHashType
} from "helios"

import { ContextScript } from "./ContextScript.js"

export class ValidatorScript extends ContextScript {
    #purpose: ScriptPurpose
    #program: null | Program
    #validators: null | ValidatorScript[]
    #dagDependencies: Set<string>

    constructor(path: string, src: string, name: string, purpose: ScriptPurpose) {
        super(path, src, name)

        this.#purpose = purpose
        this.#program = null
        this.#validators = null
        this.#dagDependencies = new Set()
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
            this.#program = Program.newInternal(this.src, this.moduleSrcs, this.scriptTypes, {
                allowPosParams: false,
                invertEntryPoint: true 
            });
        }

        return this.#program
    }

    get validators(): ValidatorScript[] {
        if (!this.#validators) {
            throw new Error("validators not yet registered")
        }

        return this.#validators
    }

    get type(): ScriptHashType {
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

    get dagDependencies(): string[] {
        if (this.#dagDependencies.size == 0) {
            void this.compile([], false)
        }

        return Array.from(this.#dagDependencies)
    }
    
    registerValidators(validators: ValidatorScript[]) {
        this.#validators = validators
    }

    toTestIR(): IR {
        const extra: IRDefinitions = new Map()
    
        for (let scriptName in this.scriptTypes) {
            extra.set(`__helios__scripts__${scriptName}`, new IR(`#`))
        }

        return this.program.toIR(new ToIRContext(false), extra)
    }

    compileDatumCheck(): null | UplcProgram {
        const program = this.program

        if (program instanceof DatumRedeemerProgram) {
            return program.compileDatumCheck()
        } else {
            return null
        }
    }

    compile(callers: string[], simplify: boolean, dumpIR: boolean = false, simplifyDeps: boolean = true): UplcProgram {
        if (callers.some(c => c == this.name)) {
            throw new Error(`circular dependecy detected: ${callers.join(" -> ")} -> ${this.name}`)
        }

        const program = this.program

        const testIR = this.toTestIR()

        const extra: IRDefinitions = new Map()

        this.#dagDependencies = new Set()

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
                    this.#dagDependencies.add(scriptName)

                    const script = this.validators.find(v => v.name == scriptName)
                    
                    if (!script) {
                        throw new Error(`script ${scriptName} not found`)
                    }

                    const scriptUplc = script.compile(callers.concat([this.name]), simplifyDeps, false)

                    extra.set(key, new IR(`#${bytesToHex(scriptUplc.hash())}`))
                }
            }
        }

        const ir = program.toIR(new ToIRContext(simplify), extra)

        if (program.nPosParams > 0) {
            const irProgram = IRParametricProgram.new(ir, this.#purpose, program.nPosParams, simplify);

            if (dumpIR) {
                console.log(irProgram.program.expr.toString());
            }

		    return irProgram.toUplc()
        } else {
            const irProgram = IRProgram.new(ir, this.#purpose, simplify)
            
            if (dumpIR) {
                console.log(irProgram.expr.toString());
            }

            return irProgram.toUplc()
        }
    }
}