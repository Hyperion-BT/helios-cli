// import { Command } from "commander";

// // hyperion dump <file_name> --bytes
// // hyperion dump <file_name> --hex
// const dump_command = new Command("dump")
//     .description("Dumps Plutus Core CBOR as bytes or a HexString.")
//     .argument("file_path", "Path to the source file.")
//     .option("-o, --output_file <output_path>", "Add custom output file.")
//     .option("-v, --verbose", "Turn on verbose mode.")
//     .option("-h, --hex", "Deserialize Plutus Core CBOR HexString.")
//     .action((file_path, options) => {
//         let func = Helios.dumpPlutusCoreCborBytes;
//         if (options.hex) { func = Helios.dumpPlutusCoreCborHexString}
        
//         if (!options.path) {
//             apply_and_log_result(func)(file_path, options.verbose)
//         } else {
//             apply_and_write_result(func)
//                 (file_path, options.output_path, ".uplc", options.verbose)
//         }
// })

// export { dump_command }