// import { Command } from "commander";

// // ! Low Priority
// // TODO
// // hyperion deserialize <file_name>
// // hyperion deserialize <file_name> --bytes
// // hyperion deserialize <file_name> --hex
// export const deserialize_command = new Command()
//     .name("deserialize")
//     .description("Deserialze Plutus Core from bytes.")
//     .argument("file_path", "Path to the source file.")
//     .option("-o, --output_file <output_path>", "Add custom output file.")
//     .option("-v, --verbose", "Turn on verbose mode.")
//     .option("-b, --bytes", "Deserialize Plutus Core from CBOR bytes.")
//     .option("-h, --hex", "Deserialize Plutus Core CBOR HexString.")
//     .action((file_path, options) => {
//         let func = Helios.deserializePlutusCoreBytes;
//         if (options.bytes) { func = Helios.deserializePlutusCoreCborBytes}
//         if (options.hex) { func = Helios.deserializePlutusCoreCborHexString}

//         if (!options.path) {
//             apply_and_log_result(func)(file_path, options.verbose)
//         } else {
//             apply_and_write_result(func)
//                 (file_path, options.output_path, ".uplc", options.verbose)
//         }
//     })
