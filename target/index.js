"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const Helios = __importStar(require("./Helios/helios"));
const command_helpers_1 = require("./command_helpers");
const program = new commander_1.Command();
program
    .name("Helios-Cli")
    .description("A small helper CLI for the Helios language.")
    .version("1.0.0");
// hyperion compile <file_name>
// hyperion compile <file_name> --data
program.command("compile")
    .description("Compiles a Plutus-Light or Plutus-Light Data file to JSON.")
    .argument("file_path", "Path to the source file.")
    .option("-o, --output_file <path>", "Add custom output file.")
    .option("-p, --print_output", "Prints the result of the compilation")
    .option("-d, --data", "Parse Plutus-Light Data.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .action((file_path, options) => {
    let func = Helios.compileHeliosProgram;
    if (options.data) {
        func = Helios.compileHeliosData;
    }
    if (options.print_output) {
        command_helpers_1.apply_and_log_result(func)(file_path, options.verbose);
    }
    else {
        command_helpers_1.apply_and_write_result(func)(file_path, options.output_file, "json", options.verbose);
    }
});
// hyperion pretty_print <file_name>
program.command("pretty_print")
    .description("Pretty print Plutus-Light source code.")
    .argument("file_path", "Path to the source file.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .action((file_path, options) => {
    let verbose = options.verbose;
    command_helpers_1.apply_and_log_result(Helios.prettySource)(file_path, verbose);
});
// ! Low Priority
// TODO
// hyperion deserialize <file_name>
// hyperion deserialize <file_name> --bytes
// hyperion deserialize <file_name> --hex
program.command("deserialize")
    .description("Deserialze Plutus Core from bytes.")
    .argument("file_path", "Path to the source file.")
    .option("-o, --output_file <output_path>", "Add custom output file.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .option("-b, --bytes", "Deserialize Plutus Core from CBOR bytes.")
    .option("-h, --hex", "Deserialize Plutus Core CBOR HexString.")
    .action((file_path, options) => {
    let func = Helios.deserializePlutusCoreBytes;
    if (options.bytes) {
        func = Helios.deserializePlutusCoreCborBytes;
    }
    if (options.hex) {
        func = Helios.deserializePlutusCoreCborHexString;
    }
    if (!options.path) {
        command_helpers_1.apply_and_log_result(func)(file_path, options.verbose);
    }
    else {
        command_helpers_1.apply_and_write_result(func)(file_path, options.output_path, ".uplc", options.verbose);
    }
});
// hyperion dump <file_name> --bytes
// hyperion dump <file_name> --hex
program.command("dump")
    .description("Dumps Plutus Core CBOR as bytes or a HexString.")
    .argument("file_path", "Path to the source file.")
    .option("-o, --output_file <output_path>", "Add custom output file.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .option("-h, --hex", "Deserialize Plutus Core CBOR HexString.")
    .action((file_path, options) => {
    let func = Helios.dumpPlutusCoreCborBytes;
    if (options.hex) {
        func = Helios.dumpPlutusCoreCborHexString;
    }
    if (!options.path) {
        command_helpers_1.apply_and_log_result(func)(file_path, options.verbose);
    }
    else {
        command_helpers_1.apply_and_write_result(func)(file_path, options.output_path, ".uplc", options.verbose);
    }
});
// hyperion parse <file_name>
program.command("parse")
    .description("Parses Plutus Light.")
    .argument("file_path", "Path to the source file.")
    .option("-o, --output_file <output_path>", "Add custom output file.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .action((file_path, options) => {
    let func = Helios.parseHelios;
    if (!options.path) {
        command_helpers_1.apply_and_log_result(func)(file_path, options.verbose);
    }
    else {
        command_helpers_1.apply_and_write_result(func)(file_path, options.output_path, ".uplc", options.verbose);
    }
});
// hyperion tokenize <file_name> --bytes
// hyperion tokenize <file_name> --hex
program.command("tokenize")
    .description("Tokenizes Plutus Light.")
    .argument("file_path", "Path to the source file.")
    .option("-o, --output_file <output_path>", "Add custom output file.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .option("-u, --upll", "Tokenize Untyped Plutus Light")
    .action((file_path, options) => {
    let func = Helios.tokenizeHelios;
    if (options.upll) {
        func = Helios.tokenizeUntypedHelios;
    }
    if (!options.path) {
        command_helpers_1.apply_and_log_result(func)(file_path, options.verbose);
    }
    else {
        command_helpers_1.apply_and_write_result(func)(file_path, options.output_path, ".uplc", options.verbose);
    }
});
program.parse();
