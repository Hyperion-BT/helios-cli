import { 
    bytesToHex,
    extractScriptPurposeAndName
} from "helios"

import { 
    Writer,
    listFiles, 
    readFile
} from "../../utils.js"

import { EndpointCollection } from "./EndpointCollection.js"
import { ValidatorCollection } from "./ValidatorCollection.js"
import { ModuleCollection } from "./ModuleCollection.js"
import { ValidatorScript } from "./ValidatorScript.js"
import { EndpointScript } from "./EndpointScript.js"
import { ModuleScript } from "./ModuleScript.js"

export type BundleOptions = {
    simplify: boolean
}

export class Bundle {
    #validators: ValidatorCollection
    #modules: ModuleCollection
    #endpoints: EndpointCollection
    #options: BundleOptions

    constructor(validators: ValidatorCollection, modules: ModuleCollection, endpoints: EndpointCollection, options: BundleOptions) {
        this.#validators = validators
        this.#modules = modules
        this.#endpoints = endpoints
        this.#options = options
    }

    static async init(dir: string, options: BundleOptions): Promise<Bundle> {
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

        // 4. register validatorTypes with endpoints and other validators (register with validators first because they are used when determining parametric validator types)
        validators.registerValidatorTypes(validators.scriptTypes)
        endpoints.registerScriptTypes(validators.scriptTypes);

        // 5. register validators themselves
        validators.registerValidators()
        
        return new Bundle(validators, modules, endpoints, options)
    }

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

const {
    Site
} = helios.exportedForBundling;

const cache = {};

const site = Site.dummy();


        `)
    }

    writeValidatorDefs(w: Writer) {
        w.write(`\nconst validators = {`)

        w.indent()

        this.#validators.forEach(v => {
            const uplcProgram = v.compile([], this.#options.simplify)

            w.write(`\n${v.name}: {cborHex: "${bytesToHex(uplcProgram.toCbor())}", properties: ${JSON.stringify(uplcProgram.properties)}},`)
        })

        w.undent()

        w.write("\n}")
    }

    writeContractDefs(w: Writer) {
        w.write(`\nexport default class Contract {`)

        w.indent()

        w.write(
`#agent;
#agentHelper;
#network;
#txs;

constructor(agent, network) {
    this.#agent = agent;
    this.#agentHelper = new helios.WalletHelper(agent);
    this.#network = network;
    this.#txs = [];
}

async runLinkingProgram(uplcProgram, uplcDataArgs) {
    const networkParams = await this.#network.getParameters();
    const changeAddress = await this.#agentHelper.changeAddress;
    const utxos = await this.#agent.utxos;

    const result = await uplcProgram.run(uplcDataArgs.map(d => new helios.UplcDataValue(site, d)).concat([new helios.UplcDataValue(site, changeAddress._toUplcData())]), {
        ...helios.DEFAULT_UPLC_RTE_CALLBACKS,
        macros: {
            now: async (args) => {
                const slot = networkParams.liveSlot;

                if (slot !== null) {
                    return new helios.UplcInt(site, networkParams.slotToTime(slot));
                } else {
                    return new helios.UplcInt(site, BigInt((new Date()).getTime()));
                }
            },
            compile: async (args) => {
                const key = args.shift().string;

                const raw = validators[key];

                const uplcProgram = helios.UplcProgram.fromCbor(raw.cborHex, raw.properties).apply(args);

                const scriptHash = uplcProgram.hash();

                cache[helios.bytesToHex(scriptHash)] = uplcProgram;

                return new helios.UplcByteArray(site, scriptHash);
            },
            finalize: async (args) => {
                try {
                    const tx = await helios.Tx.finalizeUplcData(args[0].data, networkParams, changeAddress, utxos, cache);

                    this.#txs.push(tx);
    
                    return new helios.UplcDataValue(site, tx.toTxData(networkParams));
                } catch (e) {
                    console.log("failed to build tx", e.context);

                    throw e;
                }
            },
            pick: async (args) => {
                const address = helios.Address.fromUplcData(args[0].data);
                const value = helios.Value.fromUplcData(args[1].data);
                const algo = helios.CoinSelection.selectLargestFirst;

                let utxos;

                if (address.toBech32() == changeAddress.toBech32()) {
                    utxos = (await this.#agentHelper.pickUtxos(value, algo))[0];
                } else {
                    utxos = algo(await this.#network.getUtxos(address), value)[0];
                }

                return new helios.UplcList(site, helios.UplcType.newDataType(),
                    utxos.map(utxo => new helios.UplcDataValue(site, utxo.asTxInput.toData()))
                );
            },
            get_utxo: async (args) => {
                const id = helios.TxOutputId.fromUplcData(args[0].data);

                const utxo = await this.#network.getUtxo(id);

                return new helios.UplcDataValue(site, utxo.asTxInput.toData());
            }
        }
    })

    if (result instanceof helios.UserError) {
        throw result;
    } else {
        return result.data;
    }
}
`)

        this.#endpoints.forEach(e => e.writeDef(w))

        w.undent()

        w.write("\n}")
    }

    writeDefs(w: Writer) {
        this.writePreamble(w)

        this.writeValidatorDefs(w)

        this.writeContractDefs(w)
    }
}