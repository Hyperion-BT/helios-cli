import process from "node:process"

import {
    existsSync,
    readFileSync,
    statSync,
    writeFileSync
} from "node:fs"

import {
    dirname, 
    extname,
    join
} from "node:path"

import { 
    Program,
    Source,
    StringLiteral,
    UplcProgram,
    bytesToHex,
    config as heliosConfig,
    extractScriptPurposeAndName,
    setImportPathTranslator
} from "helios"

import { 
    Writer,
    listFiles, 
    readFile
} from "./utils.js"

import { EndpointCollection } from "./EndpointCollection.js"
import { ValidatorCollection } from "./ValidatorCollection.js"
import { ModuleCollection } from "./ModuleCollection.js"
import { ValidatorScript } from "./ValidatorScript.js"
import { EndpointScript } from "./EndpointScript.js"
import { ModuleScript } from "./ModuleScript.js"
import { Dag } from "./Dag.js"
import { Config, DEFAULT_CONFIG } from "./Config.js"

export type BundleOptions = {
    dumpIR: string[]
    lock?: boolean
}

type IsIncluded = (name: string) => boolean

const RESERVED_ENDPOINTS = new Set([
    "agent",
    "network",
    "getSources",
    "jsToUplcHelpers",
    "uplcToJsHelpers",
    "runEndpointProgram"
])

export class Bundle {
    #sources: Source[]
    #validators: ValidatorCollection
    #modules: ModuleCollection
    #endpoints: EndpointCollection
    #config: Config
    #options: BundleOptions
    #lock: {[name: string]: string} // TODO: per-stage

    constructor(
        sources: Source[], 
        validators: ValidatorCollection, 
        modules: ModuleCollection, 
        endpoints: EndpointCollection, 
        config: Config,
        options: BundleOptions
    ) {
        this.#sources = sources
        this.#validators = validators
        this.#modules = modules
        this.#endpoints = endpoints
        this.#config = config
        this.#options = options
        this.#lock = existsSync("./helios-lock.json") ? JSON.parse(readFileSync("./helios-lock.json").toString()) : {}
    }

    static async initHere(config: Config = DEFAULT_CONFIG, options: BundleOptions = {dumpIR: []}): Promise<Bundle> {
        return Bundle.init(process.cwd(), config, options)
    }

    static async init(dir: string, config: Config, options: BundleOptions): Promise<Bundle> {
        heliosConfig.set({
            CHECK_CASTS: true,
            IGNORE_UNEVALUATED_CONSTANTS: true
        })

        const sources: Source[] = []

        // 1. recursively look for .hl files
        const files = await listFiles(dir)

        // 2. triage those files into different collections
        const validators = new ValidatorCollection()
        const modules = new ModuleCollection()
        const endpoints = new EndpointCollection()

        const names: Set<string> = new Set()

        files.forEach(path => {
            const src = readFile(path)

            const header = extractScriptPurposeAndName(src)

            if (!header) {
                throw new Error(`${path}: unable to parse header`)
            }

            const [purpose, name] = header

            if (names.has(name)) {
                throw new Error(`${path}: duplicate name '${name}'`)
            }

            names.add(name)
            sources.push(new Source(src, name));

            switch (purpose) {
                case "spending":
                case "minting":
                case "staking":
                    validators.add(new ValidatorScript(path, src, name, purpose))
                    break
                case "endpoint":
                    if (RESERVED_ENDPOINTS.has(name)) {
                        throw new Error(`'${name}' is reserved can be used as an endpoint name`)
                    }
                    endpoints.add(new EndpointScript(path, src, name))
                    break
                case "module":
                    modules.add(new ModuleScript(path, src, name))
                    break
                case "testing":
                    // TODO: run unit tests
                    break
                default:
                    throw new Error(`${path}: unhandled script purpose '${purpose}'`)
            }
        })

        // 3. register modules with all scripts, including with modules themselves
        validators.registerModules(modules)
        endpoints.registerModules(modules)
        modules.registerModules(modules)

        // 4. set the Helios path translator
        setImportPathTranslator((path: StringLiteral) => {
            const currentName = path.site.src.name
            const currentPath = files[sources.findIndex(s => s.name == currentName)]

            const importPath = path.value

			let depPath = join(currentPath ? dirname(currentPath) : process.cwd(), importPath)

            if (existsSync(depPath) && statSync(depPath).isDirectory()) {
                if (existsSync(join(depPath, "index.hl"))) {
                    depPath = join(depPath, "index.hl")
                } else if (existsSync(join(depPath, "index.helios"))) {
                    depPath = join(depPath, "index.helios")
                }
            } else if (!extname(depPath)) {
                if (existsSync(depPath + ".hl")) {
                    depPath += ".hl"
                } else if (existsSync(depPath + ".helios")) {
                    depPath += ".helios"
                }
            }

            const depFileIndex = files.findIndex(f => f == depPath)

            if (depFileIndex == -1) {
                throw new Error(`dependency ${depPath} of ${currentName} not found`)
            }

			return sources[depFileIndex].name
        })

        // 4. register validatorTypes with endpoints and other validators (register with validators first because they are used when determining parametric validator types)
        validators.registerValidatorTypes(validators.scriptTypes)
        endpoints.registerScriptTypes(validators.scriptTypes);

        // 5. register validators themselves
        validators.registerValidators()

        // 6. register codeMapping information
        const codeMapFileIndices: Map<string, number> = new Map()
        sources.forEach((src, i) => {
            codeMapFileIndices.set(src.name, i)
        })
        
        return new Bundle(sources, validators, modules, endpoints, config, options)
    }

    generateDag(): Dag {
        const dag: Dag = {}

        this.#validators.forEach(v => {
            dag[v.name] = v.dagDependencies
        })

        return dag
    }

    /**
     * Writes Typescript declarations.
     */
    writeDecls(w: Writer, isIncluded: IsIncluded) {
        w.write(
`import * as helios from "@hyperionbt/helios";

/**
 * Checks if UTxOs sitting at a Contract address have a valid Datum.
 * Returns true if the given UTxO is sitting at an unrecognized address.
 * Note: the original datum data must be attached for hashed datums.
 */ 
export function hasValidDatum(input: helios.TxInput): Promise<boolean>;

export default class Contract {
    constructor(agent: helios.Wallet, network: helios.Network);

    get agent(): helios.Wallet;
    get network(): helios.Network;
`
        )

        w.indent()

        this.#endpoints.forEach(item => {
            if (isIncluded(item.name)) {
                item.writeDecl(w)
            }
        })

        w.undent()

        w.write("\n}")
    }

    writePreamble(w: Writer) {
        w.write(`import * as helios from "@hyperionbt/helios";

const cache = {};

helios.config.set({AUTO_SET_VALIDITY_RANGE: true});

const site = helios.Site.dummy();
        `)
    }

    compileExtraDatumCheck(props: {file: string, typeName: string}): UplcProgram {
        const modules = this.#modules.items.slice()

        // TODO: allow resolution via module
        const mainSrc = `testing datumCheck
import {${props.typeName}} from "${props.file}"

func main(a: ${props.typeName}) -> ${props.typeName} {
    a
}`

        const program = Program.newInternal(mainSrc, modules.map(m => m.src), this.#validators.scriptTypes, {
            allowPosParams: false,
            invertEntryPoint: false 
        })

        return program.compile(false)
    }

    writeValidatorDefs(w: Writer, isIncluded: IsIncluded) {
        w.write(`\nconst validators = {`)

        w.indent()

        this.#validators.forEach(v => {
            if (isIncluded(v.name)) {
                const uplcProgram = v.compile(
                    [], 
                    true, 
                    this.#options.dumpIR.findIndex(d => d == v.name) != -1
                )

                const datumCheckProgram: (null | UplcProgram) = v.compileDatumCheck()

                if (v.purpose == "spending") {
                    const hash = uplcProgram.validatorHash.hex
                    const prev = this.#lock[v.name]
                    
                    if (prev && prev != hash) {
                        throw new Error(`hash changed for validator ${v.name}`)
                    }

                    this.#lock[v.name] = hash

                    console.log(`validator ${v.name}: ${hash}`)
                } else if (v.purpose == "minting") {
                    const hash = uplcProgram.mintingPolicyHash.hex
                    const prev = this.#lock[v.name]

                    if (prev && prev != hash) {
                        throw new Error(`hash changed for policy ${v.name}`)
                    }

                    this.#lock[v.name] = hash

                    console.log(`policy ${v.name}: ${hash}`)
                } else if (v.purpose == "staking") {
                    const hash = uplcProgram.stakingValidatorHash.hex
                    const prev = this.#lock[v.name]

                    if (prev && prev != hash) {
                        throw new Error(`hash changed for staking-validator ${v.name}`)
                    }

                    this.#lock[v.name] = hash

                    console.log(`staking-validator ${v.name}: ${hash}`)
                }

                const datumChecks: UplcProgram[] = []

                if (datumCheckProgram) {
                    datumChecks.push(datumCheckProgram)
                }

                // add others
                if (this.#config.extraDatumTypes) {
                    for (let datumType of (this.#config?.extraDatumTypes[v.name] ?? [])) {
                        datumChecks.push(this.compileExtraDatumCheck(datumType));
                    }
                }

                w.write(`
    ${v.name}: {
        cborHex: "${bytesToHex(uplcProgram.toCbor())}", 
        hash: "${bytesToHex(uplcProgram.hash())}", 
        properties: ${JSON.stringify({...uplcProgram.properties, name: v.name})}${datumCheckProgram ? `,
        datumCheck: [${datumChecks.map(dc => '"' + bytesToHex(dc.toCbor()) + '"').join(", ")}]`: ""}
    },`)
            }
        })

        w.undent()

        w.write("\n}")
    }

    genCodeMapFileIndices(isIncluded: IsIncluded): Map<string, number> {
        const codeMapFileIndices: Map<string, number> = new Map()

        let i = 0

        this.#sources.forEach(src => {
            if (isIncluded(src.name) || this.#modules.has(src.name)) {
                codeMapFileIndices.set(src.name, i)

                i += 1
            }
        })

        return codeMapFileIndices
    }

    writeUnsimplifiedValidatorDefs(w: Writer, isIncluded: IsIncluded) {
        w.write(`\nconst origValidators = {`)

        w.indent()

        const codeMapFileIndices = this.genCodeMapFileIndices(isIncluded)

        this.#validators.forEach(v => {
            if (isIncluded(v.name)) {
                const uplcProgram = v.compile(
                    [], 
                    false, 
                    false
                )

                w.write(`\n${v.name}: {cborHex: "${bytesToHex(uplcProgram.toCborWithMapping(codeMapFileIndices))}", properties: ${JSON.stringify({...uplcProgram.properties, name: v.name})}},`)
            }
        })

        w.undent()

        w.write("\n}")
    }

    writeCodeMapSource(w: Writer, isIncluded: IsIncluded) {
        w.write(`\nconst rawSources = [`)

        w.indent()

        this.#sources.forEach(s => {
            if (isIncluded(s.name) || this.#modules.has(s.name)) {
                w.write(`\n{name: "${s.name}", lines: [${s.raw.split("\n").map(l => l.length.toString()).join(",")}]},`)
            }
        })

        w.undent()

        w.write("\n]")
    }

    writeUtils(w: Writer) {
        w.write(`\nexport async function hasValidDatum(input) {
    const vh = input.address.validatorHash;

    if (vh) {
        if (input.output.datum) {
            const i = Object.values(validators).findIndex(v => v.hash == vh.hex);
            const v = Object.values(validators)[i];
            const name = Object.keys(validators)[i];

            try {
                if (v) {
                    for (let dc of v.datumCheck) {
                        const program = helios.UplcProgram.fromCbor(dc)

                        const data = input.output.datum.data

                        const res = await program.run([new helios.UplcDataValue(site, data)]);

                        if (res instanceof Error) {
                            continue;
                        }

                        helios.assert(res.data.toString() == data.toString(), "internal error, input data doesn't match output data");

                        return true;
                    }

                    return false;
                } else {
                    return true;
                }
            } catch(e) {
                console.error("input at " + input.address.toBech32() + " (" + name + ") failed datum check: ", e);

                return false;
            }
        } else {
            return false;
        }
    } else {
        return true;
    }
}`)
    }

    writeContractDefs(w: Writer, isIncluded: IsIncluded) {
        w.write(`\nexport default class Contract {`)

        w.indent()

        w.write(
`#agent;
#agentHelper;
#network;
#txs;
#sources;

constructor(agent, network) {
    this.#agent = agent;
    this.#agentHelper = new helios.WalletHelper(agent);
    this.#network = network;
    this.#txs = [];
    this.#sources = null;
}

get agent() {
    return this.#agent;
}

get network() {
    return this.#network;
}

getSources() {
    if (!this.#sources) {
        this.#sources = rawSources.map(obj => {
            const name = obj.name;

            const lines = obj.lines.map(n => (new Array(n)).fill(' ').join(""));
            const raw = lines.join("\\n");

            return new helios.Source(raw, name);
        });
    }

    return this.#sources;
}

get uplcToJsHelpers() {
    return {
        "Tx": async (data) => {
            const txId = helios.TxId.fromUplcData(data.fields[11]);

            for (let i = 0; i < this.#txs.length; i++) {
                const tx = this.#txs[i];
                if (tx.id().eq(txId)) {
                    this.#txs = this.#txs.slice(0, i).concat(this.#txs.slice(i+1));
                    return tx;
                }
            }
        }
    }
}

get jsToUplcHelpers() {
    return {
        "Tx": async (tx) => {
            await tx.completeInputData(async (id) => {
                return (await this.#network.getUtxo(id)).origOutput;
            })

            return tx.toTxData(await this.#network.getParameters());
        }
    }
}

async runEndpointProgram(uplcProgram, uplcDataArgs) {
    const [baseAddress, changeAddress] = await Promise.all([
        this.#agentHelper.baseAddress,
        this.#agentHelper.changeAddress
    ]);

    const contractContext = new helios.UplcDataValue(site, new helios.ConstrData(0, [
        baseAddress._toUplcData(),
        changeAddress._toUplcData()
    ]));

    const args = uplcDataArgs.map(d => new helios.UplcDataValue(site, d)).concat([contractContext]);

    const accessedAddresses = new Set();
    const accessedUtxos = new Set();

    const dummyMacros = {
        compile: async (rte, args) => {
            const key = args.shift().string;

            const raw = validators[key];

            if (raw.hash in cache) {
                return new helios.UplcByteArray(site, helios.hexToBytes(raw.hash));
            } else {
                const uplcProgram = helios.UplcProgram.fromCbor(raw.cborHex, raw.properties).apply(args);

                cache[raw.hash] = uplcProgram;

                return new helios.UplcByteArray(site, helios.hexToBytes(raw.hash));
            }
        },
        now: async (rte, args) => {
            return new helios.UplcAny(site);
        },
        finalize: async (rte, args) => {
            return new helios.UplcAny(site);
        },
        pick: async (rte, args) => {
            const address = helios.Address.fromUplcData(args[0].data);

            if (address.toBech32() != baseAddress.toBech32()) {
                accessedAddresses.add(address.toBech32());
            }

            return new helios.UplcAny(site);
        },
        get_utxo: async (rte, args) => {
            const id = helios.TxOutputId.fromUplcData(args[0].data);

            accessedUtxos.add(id.toString());

            return new helios.UplcAny(site);
        },
        utxos_at: async (rte, args) => {
            const addr = helios.Address.fromUplcData(args[0].data);

            accessedAddresses.add(addr.toBech32());

            return new helios.UplcAny(site);
        }
    };

    // dummy run to get all addresses and
    void await uplcProgram.run(args, {
        ...helios.DEFAULT_UPLC_RTE_CALLBACKS,
        macros: dummyMacros
    });

    const promises = [];

    promises.push(this.#network.getParameters());
    promises.push(this.#agent.utxos);
    
    for (let addr of accessedAddresses) {
        if (addr == baseAddress.toBech32()) {
            throw new Error("shouldn't be here");
        } else {
            promises.push(this.#network.getUtxos(helios.Address.fromBech32(addr)));
        }
    }

    for (let id of accessedUtxos) {
        promises.push(this.#network.getUtxo(new helios.TxOutputId(id)));
    }

    const start = (new Date()).getTime();
    const resolved = await Promise.all(promises);

    const networkParams = resolved.shift();
    const agentUtxos = resolved.shift();

    const cachedAddresses = new Map();
    const cachedUtxos = new Map();

    for (let addr of accessedAddresses) {
        cachedAddresses.set(addr, resolved.shift());
    }

    for (let id of accessedUtxos) {
        cachedUtxos.set(id, resolved.shift());
    }

    const result = await uplcProgram.run(args, {
        ...helios.DEFAULT_UPLC_RTE_CALLBACKS,
        macros: {
            ...dummyMacros,
            now: async (rte, args) => {
                const slot = networkParams.liveSlot;

                if (slot !== null) {
                    return new helios.UplcInt(site, networkParams.slotToTime(slot));
                } else {
                    return new helios.UplcInt(site, BigInt((new Date()).getTime()));
                }
            },
            finalize: async (rte, args) => {
                try {
                    const validators_ = Object.assign({}, cache);

                    // add all validators explicitly as well, because they might not yet be compiled
                    for (let key in validators) {
                        const raw = validators[key];
            
                        validators_[raw.hash] = () => {
                            const uplcProgram = helios.UplcProgram.fromCbor(raw.cborHex, raw.properties);

                            validators_[raw.hash] = uplcProgram;

                            return uplcProgram;
                        }
                    }

                    const tx = await helios.Tx.finalizeUplcData(args[0].data, networkParams, changeAddress, agentUtxos, validators_);

                    // make sure each output has a valid datum
                    for (let i = 0; i < tx.body.outputs.length; i++) {
                        const output = tx.body.outputs[i];
                        const input = new helios.TxInput(new helios.TxOutputId({txId: tx.id(), utxoId: i}), output);

                        if (!(await hasValidDatum(input))) {
                            const i = Object.values(validators).findIndex(v => v.hash == output.address.validatorHash.hex);

                            if (i != -1) {
                                const name = Object.keys(validators)[i];

                                return rte.error("output sent to " + name + " has an invalid datum");
                            } else {
                                return rte.error("output sent to " + output.address.toBech32() + " has an invalid datum");
                            }
                        }
                    }

                    this.#txs.push(tx);
    
                    return new helios.UplcDataValue(site, tx.toTxData(networkParams));
                } catch (e) {
                    if (e.context
                        && (e.context.name in origValidators) 
                        && ("Redeemer" in e.context) 
                        && ("ScriptContext" in e.context)
                    ) {
                        const raw = origValidators[e.context.name];

                        const uplcProgram = helios.UplcProgram.fromCborWithMapping(raw.cborHex, this.getSources(), raw.properties);

                        const args = [
                            helios.UplcData.fromCbor(e.context.Redeemer),
                            helios.UplcData.fromCbor(e.context.ScriptContext)
                        ];

                        if ("Datum" in e.context) {
                            args.unshift(helios.UplcData.fromCbor(e.context.Datum));
                        }

                        const res = await uplcProgram.run(
                            args.map(a => new helios.UplcDataValue(site, a))
                        );

                        if (res instanceof helios.RuntimeError) {
                            return rte.error(res);
                        } else {
                            console.log(res.toString());
                            throw e;
                        }
                    } else {
                        console.log("failed to build tx", e.context ?? "");

                        return rte.error(e.message);
                    }
                }
            },
            pick: async (rte, args) => {
                const address = helios.Address.fromUplcData(args[0].data);
                const value = helios.Value.fromUplcData(args[1].data);
                const algo = helios.CoinSelection.selectLargestFirst;

                let utxos;

                try {
                    if (address.toBech32() == baseAddress.toBech32()) {
                        utxos = algo(agentUtxos, value)[0];
                    } else if (cachedAddresses.has(address.toBech32())) {
                        utxos = algo(cachedAddresses.get(address.toBech32()), value)[0];
                    } else {
                        utxos = algo(await this.#network.getUtxos(address), value)[0];
                    }
                } catch (e) {
                    return rte.error(e.message);
                }

                return new helios.UplcList(site, helios.UplcType.newDataType(),
                    utxos.map(utxo => new helios.UplcDataValue(site, utxo.toData()))
                );
            },
            get_utxo: async (rte, args) => {
                const id = helios.TxOutputId.fromUplcData(args[0].data);

                let utxo;

                try {
                    if (cachedUtxos.has(id.toString())) {
                        utxo = cachedUtxos.get(id.toString());
                    } else {
                        utxo = await this.#network.getUtxo(id);
                    }
                } catch (e) {
                    return rte.error(e.message);
                }

                return new helios.UplcDataValue(site, utxo.toData());
            },
            utxos_at: async (rte, args) => {
                const addr = helios.Address.fromUplcData(args[0].data);

                let utxos;

                try {
                    if (cachedAddresses.has(addr.toBech32())) {
                        utxos = cachedAddresses.get(addr.toBech32());
                    } else {
                        utxos = await this.#network.getUtxos(addr);
                    }
                } catch (e) {
                    return rte.error(e.message);
                }

                return new helios.UplcList(site, helios.UplcType.newDataType(),
                    utxos.map(utxo => new helios.UplcDataValue(site, utxo.toData()))
                );
            }
        }
    })

    if (result instanceof Error) {
        throw result;
    } else {
        return result.data;
    }
}
`)

        const codeMapFileIndices = this.genCodeMapFileIndices(isIncluded)

        this.#endpoints.forEach(e => {
            if (isIncluded(e.name)) {
                e.writeDef(w, codeMapFileIndices)
            }
        })

        w.undent()

        w.write("\n}")
    }

    writeDefs(w: Writer, isIncluded: IsIncluded) {
        this.writePreamble(w)

        this.writeValidatorDefs(w, isIncluded)

        this.writeUnsimplifiedValidatorDefs(w, isIncluded)

        this.writeCodeMapSource(w, isIncluded)

        this.writeUtils(w)

        this.writeContractDefs(w, isIncluded)
    }

    writeLock() {
        writeFileSync("./helios-lock.json", JSON.stringify(this.#lock, undefined, 4))
    }
}