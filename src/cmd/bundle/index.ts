import process from "node:process"
import { join } from "node:path"
import { writeFileSync } from "node:fs"

import {
    Type,
    exportedForBundling
} from "helios"

const {
	AllType,
    ArgType,
    AddressType,
    FuncType,
	IntType,
    MintingPolicyHashType,
    ValidatorHashType,
    Word,
    Site
} = exportedForBundling

import { 
    HeliosFile,
    Writer,
    assertDefined,
    listFiles,
    readFile,
    parseFlag,
    assertNoMoreOptions
} from "../../utils"

import { 
    Bundle,
    BundleOptions
} from "./Bundle"


function writePreamle(w: Writer) {
    w.write(`import * as helios from "@hyperionbt/helios";\n`)
    w.write(
`const {
    ArgType,
    FuncType,
    IR,
    IRProgram,
    MintingPolicyHashType,
    Site,
    ValidatorHashType,
    Word
} = helios.exportedForBundling;

const site = Site.dummy();

function toAddress(expr) {
    return helios.Address.fromProps(expr)._toUplcData();
}

function toInt(expr) {
    return new helios.UplcDataValue(site, new helios.IntData(BigInt(expr)));
}

function toMintingPolicyHash(expr) {
    return helios.MintingPolicyHash.fromProps(expr)._toUplcData();
}

function toValidatorHash(expr) {
    return helios.ValidatorHash.fromProps(expr)._toUplcData();
}

function fromAddress(expr) {
    return helios.Address.fromUplcData(expr.data);
}

function fromInt(expr) {
    return expr.data.int;
}

function fromMintingPolicyHash(expr) {
    if (expr instanceof Error) {
        throw expr;
    } else {
        return helios.MintingPolicyHash.fromUplcData(expr.data);
    }
}

function fromValidatorHash(expr) {
    if (expr instanceof Error) {
        throw expr;
    } else {
        return helios.ValidatorHash.fromUplcData(expr.data);
    }
}

function compileProgram(mainSrc, options) {
    const program = helios.Program.new(mainSrc, Object.values(heliosModules));

    if (options.parameters) {
        for (let key in options.parameters) {
            program.changeParamSafe(key, options.parameters[key]);
        }
    }

    return program.compile(options.simplify);
}

function compileLinkingProgram(mainSrc, options) {
    const program = helios.LinkingProgram.new(mainSrc, Object.values(heliosModules), options.scripts);

    const extra = new Map();

    extra.set("__helios__contractcontext__agent", new IR("(self) -> {__helios__address__from_data(##" + helios.bytesToHex(options.agent._toUplcData().toCbor()) + ")}"));

    for (let key in options.scripts) {
        const t = options.scripts[key];

        if (!(t instanceof FuncType)) {
            extra.set("__helios__scriptcollection__" + key, new IR("(self) -> {__core__macro__compile(\\"" + key + "\\", ())}"));
        } else {
            const inputArgs = t.argTypes.map((_, i) => "arg" + i.toString()).join(", ");
            const compileArgs = t.argTypes.map((at, i) => at.path + "____to_data(arg" + i.toString() + ")").join(", ");
            extra.set("__helios__scriptcollection__" + key, new IR("(self) -> {(" + inputArgs + ") -> {__core__macro__compile(\\"" + key + "\\", " + compileArgs + ", ())}}"));
        }
    }

    const ir = program.toIR([], extra);

    const irProgram = IRProgram.new(ir, "unknown", options.simplify);
    
    return irProgram.toUplc();
}

async function runUplcProgram(uplcProgram, args) {
    return await uplcProgram.run(args, {
        ...helios.DEFAULT_UPLC_RTE_CALLBACKS,
        macros: {
            compile: (cargs) => {
                const key = cargs.shift().string;

                const generator = programGenerators[key];

                const options = {
                    simplify: false
                };

                const nParams = cargs.length;

                if (nParams > 0) {
                    options.parameters = {};

                    for (let i = 0; i < nParams; i++) {
                        const paramName = paramNames[key][i];

                        options.parameters[paramName] = cargs[i].data;
                    }
                }

                const uplcProgram = generator(options);

                return new helios.UplcByteArray(site, uplcProgram.hash());
            }
        }
    })
}
`)
}

function heliosTypeToJsType(t: Type, strict: boolean = true): string {
	if (IntType.isBaseOf(t)) {
		return strict ? "bigint" : "number | bigint"
    } else if (AddressType.isBaseOf(t)) {
        return strict ? "helios.Address" : "helios.Address | helios.AddressProps"
    } else if (MintingPolicyHashType.isBaseOf(t)) {
        return strict ? "helios.MintingPolicyHash" : "helios.MintingPolicyHash | helios.MintingPolicyHashProps"
    } else if (ValidatorHashType.isBaseOf(t)) {
        return strict ? "helios.ValidatorHash" : "helios.ValidatorHash | helios.ValidatorHashProps"
	} else if (t instanceof AllType) {
		return "any"
	} else {
		throw new Error(`off-chain support for Type ${t.toString()} not yet implemented`)
	}
}

function convertJsTypeToHeliosType(expr: string, t: Type): string {
	if (IntType.isBaseOf(t)) {
		return `toInt(${expr})`
    } else if (AddressType.isBaseOf(t)) {
        return `toAddress(${expr})`
    } else if (MintingPolicyHashType.isBaseOf(t)) {
        return `toMintingPolicyHash(${expr})`
    } else if (ValidatorHashType.isBaseOf(t)) {
        return `toValidatorHash(${expr})`
	} else {
		throw new Error(`off-chain support for Type ${t.toString()} not yet implemented`)
	}
}

function convertHeliosTypeToJsType(expr: string, t: Type): string {
	if (IntType.isBaseOf(t)) {
		return `fromInt(${expr})`
    } else if (AddressType.isBaseOf(t)) {
        return `fromAddress(${expr})`
    } else if (MintingPolicyHashType.isBaseOf(t)) {
        return `fromMintingPolicyHash(${expr})`
    } else if (ValidatorHashType.isBaseOf(t)) {
        return `fromValidatorHash(${expr})`
	} else {
		throw new Error(`off-chain support for Type ${t.toString()} not yet implemented`)
	}
}

function convertHeliosTypeToJsLiteral(t: Type): string {
    if (IntType.isBaseOf(t)) {
        return `IntType`;
    } else if (AddressType.isBaseOf(t)) {
        return `AddressType`;
    } else if (MintingPolicyHashType.isBaseOf(t)) {
        return "MintingPolicyHashType";
    } else if (ValidatorHashType.isBaseOf(t)) {
        return "ValidatorHashType";
    } else {
        throw new Error(`off-chain support for Type ${t.toString()} not yet implemented`)
    }
}

class BundleFile extends HeliosFile {
    static read(path: string): BundleFile {
        return new BundleFile(path, assertDefined(readFile(path)))
    }

	get jsArgTypes(): string {
		return this.argTypes.map(dt => heliosTypeToJsType(dt)).join(", ")
	}

	get jsArgNamesAndTypes(): string {
		const argNames = this.argNames

		return this.argTypes.map((dt, i) => `${argNames[i]}: ${heliosTypeToJsType(dt, false)}`).join(", ")
	}

	get jsArgNames(): string[] {
		return this.argNames
	}

	get jsReturnType(): string {
		return heliosTypeToJsType(this.returnType)
	}

    get simpleValidatorType(): Type {
        switch (this.program.purpose) {
            case "spending":
                return ValidatorHashType
            case "minting":
                return MintingPolicyHashType
            default:
                throw new Error("unsupported")
        }
    }

    get validatorType(): Type {
        let retType = this.simpleValidatorType

        const reqParams = this.program.requiredParameters;

        if (reqParams.length == 0) {
            return retType
        } else {
            return new FuncType(
                reqParams.map(([name, type]) => {
                    return new ArgType(new Word(Site.dummy(), name), type)
                }), 
                retType
            )
        }
    }

    get validatorTypeString(): string {
        let retType = ""
        
        switch (this.program.purpose) {
            case "spending":
                retType = "ValidatorHashType"
                break
            case "minting":
                retType = "MintingPolicyHashType"
                break
            default:
                throw new Error("unsupported")
        }

        const reqParams = this.program.requiredParameters;

        if (reqParams.length == 0) {
            return retType
        } else {
            return `new FuncType([${reqParams.map(([name, type]) => {
                return `new ArgType(new Word(site, "${name}"), ${convertHeliosTypeToJsLiteral(type)})`
            }).join(", ")}], ${retType})`
        }
    }
}

// read helios files in current dir, and write dist/index.js and dist/index.d.ts
export async function bundle() {
    const dir = process.cwd()

    // now recursively look for .hl files
    const files = await listFiles(dir)

    // filter files into two categories: validators and linking scripts
    // these are the actual sources
    const linking: BundleFile[] = []
    const validators: BundleFile[] = []
    const modules: BundleFile[] = []

    const uniquenessCheck: Set<string> = new Set();

    files.forEach(f => {
        const hf = BundleFile.read(f)

        if (uniquenessCheck.has(hf.name)) {
            throw new Error(`non-unique helios script name ${hf.name}`)
        } else {
            uniquenessCheck.add(hf.name)
        }

        switch(hf.purpose){
            case "spending":
            case "minting":
            case "staking":
                validators.push(hf)
                break
            case "testing":
                console.error("Warning: testing file not yet handled")
                break
            case "linking":
                linking.push(hf)
                break
            case "module":
                modules.push(hf)
                break
            default:
                throw new Error(`${f}: unhandled script-type ${hf.purpose}`)
        }
    })

    if (linking.length == 0) {
        throw new Error("no linking scripts found, exiting")
    }

    linking.forEach(l => l.registerModules(modules))
    modules.forEach(m => m.registerModules(modules))
    validators.forEach(v => v.registerModules(modules))

    const scripts = genValidatorTypes(validators)
    linking.forEach(l => l.registerScripts(scripts))

    // for each linking script => create an endpoint
    const w = new Writer()

    writePreamle(w)

    w.write(`const heliosModules = {
    ${modules.map(m => `${m.name}: \`${m.src}\``).join(",\n")}
}`)

    w.write(`const programGenerators = {`)

    validators.forEach(v => {
        w.write(`${v.name}: (options) => {
        const mainSrc = \`${v.src}\`;
        return compileProgram(mainSrc, options);
    },`)
    })

    linking.forEach(l => {
        w.write(`${l.name}: (options) => {
        const mainSrc = \`${l.src}\`;
        return compileLinkingProgram(mainSrc, options);
    },`)
    })

    w.write(``)
    w.write(`}`)

    w.write(`const scripts = ${genValidatorTypesString(validators)};`)

    w.write(`const paramNames = ${genValidatorParamNames(validators)};`)

    w.write(`export default class Contract {`)
    w.write(`#agent;`)
    w.write(`#network;`)
    w.write(`constructor(agent: helios.Wallet, network: helios.Network);`)
    w.write(`constructor(agent, network) {`)
    w.write(`this.#agent = new helios.WalletHelper(agent);`)
    w.write(`this.#network = network;`)
    w.write(`}`)

    w.write(`async __genCompileOptions() {
        return {
            simplify: false, 
            agent:    await this.#agent.changeAddress, 
            scripts:  scripts
        };
    }`)

    linking.forEach(hf => {
        const argTypes = hf.argTypes

        w.write(`async ${hf.name}(${hf.jsArgNamesAndTypes}): Promise<${hf.jsReturnType}>;`)
        w.write(`async ${hf.name}(${hf.jsArgNames.join(", ")}) {`)
        hf.jsArgNames.forEach((argName, i) => {
            const argType = argTypes[i]
            w.write(`${argName} = ${convertJsTypeToHeliosType(argName, argType)};`)
        })

        w.write(`const uplcProgram = programGenerators.${hf.name}(await this.__genCompileOptions());`)
        w.write(`const result = await runUplcProgram(uplcProgram, [${hf.jsArgNames.join(", ")}${hf.jsArgNames.length > 0 ? ", " : ""}new helios.UplcUnit(site)]);`)
        w.write(`return ${convertHeliosTypeToJsType("result", hf.returnType)}`)

        w.write(`}`)
    })

    w.write(`}`)

    const dstPath = join(dir, "/dist/index")
}

function genValidatorTypes(validators: BundleFile[]): {[name: string]: Type} {
    const obj: {[name: string]: Type} = {};

    validators.forEach(v => {
        obj[v.name] = v.validatorType
    })

    return obj
}

function genSimpleValidatorTypes(validators: BundleFile[]): {[name: string]: Type} {
    const obj: {[name: string]: Type} = {};

    validators.forEach(v => {
        obj[v.name] = v.simpleValidatorType
    })

    return obj
}

function genValidatorTypesString(validators: BundleFile[]): string {
    return `{
    ${validators.map(v => `${v.name}: ${v.validatorTypeString}`).join(`,\n`)}
}`;
}

function genValidatorParamNames(validators: BundleFile[]): string {
    return `{
    ${validators.map(v => {
        const params = v.program.requiredParameters;

        return `${v.name}: [${params.map(p => `"${p[0]}"`).join(", ")}]`
    }).join(`,\n`)}
}`
}

function parseCompileOptions(args: string[]): BundleOptions {
	const options = {
		simplify: parseFlag(args, "-O", "--optimize") as boolean
	}

	assertNoMoreOptions(args)

	return options
}

export async function main(args: string[]) {
    const options = parseCompileOptions(args)

    const bundle = await Bundle.init(process.cwd(), options)

    {
        const w = new Writer()

        bundle.writeDecls(w)

        writeFileSync("dist/index.d.ts", w.toString())
    }

    {
        const w = new Writer()

        bundle.writeDefs(w)

        writeFileSync("dist/index.js", w.toString())
    }
}