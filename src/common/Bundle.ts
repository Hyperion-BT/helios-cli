import process from "node:process"

import {
    existsSync,
    statSync
} from "node:fs"

import {
    dirname, 
    extname,
    join
} from "node:path"

import { 
    Source,
    StringLiteral,
    bytesToHex,
    config,
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

export type BundleOptions = {
    dumpIR: string[]
}

export class Bundle {
    #sources: Source[]
    #validators: ValidatorCollection
    #modules: ModuleCollection
    #endpoints: EndpointCollection
    #options: BundleOptions

    constructor(sources: Source[], validators: ValidatorCollection, modules: ModuleCollection, endpoints: EndpointCollection, options: BundleOptions) {
        this.#sources = sources
        this.#validators = validators
        this.#modules = modules
        this.#endpoints = endpoints
        this.#options = options
    }

    static async initHere(options: BundleOptions = {dumpIR: []}): Promise<Bundle> {
        return Bundle.init(process.cwd(), options)
    }

    static async init(dir: string, options: BundleOptions): Promise<Bundle> {
        config.IGNORE_UNEVALUATED_CONSTANTS = true

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
                case "linking":
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

			let depPath = join(dirname(currentPath), importPath)

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

        validators.registerCodeMapFileIndices(codeMapFileIndices)
        endpoints.registerCodeMapFileIndices(codeMapFileIndices)
        modules.registerCodeMapFileIndices(codeMapFileIndices)
        
        return new Bundle(sources, validators, modules, endpoints, options)
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
    writeDecls(w: Writer) {
        w.write(
`import * as helios from "@hyperionbt/helios";

export default class Contract {
    constructor(agent: helios.Wallet, network: helios.Network);
`
        )

        w.indent()

        this.#endpoints.writeDecls(w)

        w.undent()

        w.write("\n}")
    }

    writePreamble(w: Writer) {
        w.write(`import * as helios from "@hyperionbt/helios";

const cache = {};

helios.config.AUTO_SET_VALIDITY_RANGE = true;
helios.config.EXPERIMENTAL_CEK = true;

const site = helios.Site.dummy();
        `)
    }

    writeValidatorDefs(w: Writer) {
        w.write(`\nconst validators = {`)

        w.indent()

        this.#validators.forEach(v => {
            const uplcProgram = v.compile(
                [], 
                true, 
                this.#options.dumpIR.findIndex(d => d == v.name) != -1
            )

            if (v.purpose == "spending") {
                console.log(`validator ${v.name}: ${uplcProgram.validatorHash.hex}`)
            } else if (v.purpose == "minting") {
                console.log(`policy ${v.name}: ${uplcProgram.mintingPolicyHash.hex}`)
            }

            w.write(`\n${v.name}: {cborHex: "${bytesToHex(uplcProgram.toCbor())}", properties: ${JSON.stringify({...uplcProgram.properties, name: v.name})}},`)
        })

        w.undent()

        w.write("\n}")
    }

    genCodeMapFileIndices(): Map<string, number> {
        const codeMapFileIndices: Map<string, number> = new Map()

        this.#sources.forEach((src, i) => {
            codeMapFileIndices.set(src.name, i)
        })

        return codeMapFileIndices
    }

    writeUnsimplifiedValidatorDefs(w: Writer) {
        w.write(`\nconst origValidators = {`)

        w.indent()

        const codeMapFileIndices = this.genCodeMapFileIndices()

        this.#validators.forEach(v => {
            const uplcProgram = v.compile(
                [], 
                false, 
                false
            )

            w.write(`\n${v.name}: {cborHex: "${bytesToHex(uplcProgram.toCborWithMapping(codeMapFileIndices))}", properties: ${JSON.stringify({...uplcProgram.properties, name: v.name})}},`)
        })

        w.undent()

        w.write("\n}")
    }

    writeCodeMapSource(w: Writer) {
        w.write(`\nconst rawSources = [`)

        w.indent()

        this.#sources.forEach(s => {
            w.write(`\n{name: "${s.name}", lines: [${s.raw.split("\n").map(l => l.length.toString()).join(",")}]},`)
        })

        w.undent()

        w.write("\n]")
    }

    writeContractDefs(w: Writer) {
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

async runLinkingProgram(uplcProgram, uplcDataArgs) {
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

            const uplcProgram = helios.UplcProgram.fromCbor(raw.cborHex, raw.properties).apply(args);

            const scriptHash = uplcProgram.hash();

            cache[helios.bytesToHex(scriptHash)] = uplcProgram;

            return new helios.UplcByteArray(site, scriptHash);
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

                        const uplcProgram = helios.UplcProgram.fromCbor(raw.cborHex, raw.properties);
            
                        const scriptHash = uplcProgram.hash();
            
                        validators_[helios.bytesToHex(scriptHash)] = uplcProgram;            
                    }

                    const tx = await helios.Tx.finalizeUplcData(args[0].data, networkParams, changeAddress, agentUtxos, validators_);

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

                        throw e;
                    }
                }
            },
            pick: async (rte, args) => {
                const address = helios.Address.fromUplcData(args[0].data);
                const value = helios.Value.fromUplcData(args[1].data);
                const algo = helios.CoinSelection.selectLargestFirst;

                let utxos;

                if (address.toBech32() == baseAddress.toBech32()) {
                    utxos = algo(agentUtxos, value)[0];
                } else if (cachedAddresses.has(address.toBech32())) {
                    utxos = algo(cachedAddresses.get(address.toBech32()), value)[0];
                } else {
                    utxos = algo(await this.#network.getUtxos(address), value)[0];
                }

                return new helios.UplcList(site, helios.UplcType.newDataType(),
                    utxos.map(utxo => new helios.UplcDataValue(site, utxo.toData()))
                );
            },
            get_utxo: async (rte, args) => {
                const id = helios.TxOutputId.fromUplcData(args[0].data);

                let utxo;
                if (cachedUtxos.has(id.toString())) {
                    utxo = cachedUtxos.get(id.toString());
                } else {
                    utxo = await this.#network.getUtxo(id);
                }

                return new helios.UplcDataValue(site, utxo.toData());
            },
            utxos_at: async (rte, args) => {
                const addr = helios.Address.fromUplcData(args[0].data);

                let utxos;

                if (cachedAddresses.has(addr.toBech32())) {
                    utxos = cachedAddresses.get(addr.toBech32());
                } else {
                    utxos = await this.#network.getUtxos(addr);
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

        const codeMapFileIndices = this.genCodeMapFileIndices()

        this.#endpoints.forEach(e => e.writeDef(w, codeMapFileIndices))

        w.undent()

        w.write("\n}")
    }

    writeDefs(w: Writer) {
        this.writePreamble(w)

        this.writeValidatorDefs(w)

        this.writeUnsimplifiedValidatorDefs(w)

        this.writeCodeMapSource(w)

        this.writeContractDefs(w)
    }
}