// import { Command } from "commander";

// // hyperion tokenize <file_name> --bytes
// // hyperion tokenize <file_name> --hex
// const tokenize = new Command("tokenize")
//     .description("Tokenizes Helios code.")
//     .argument("file_path", "Path to the source file.")
//     .option("-o, --output_file <output_path>", "Add custom output file.")
//     .option("-v, --verbose", "Turn on verbose mode.")
//     .option("-u, --upll", "Tokenize Untyped Helios.")
//     .action((file_path, options) => {
//         let func = Helios.tokenizeHelios;
//         if (options.upll) { func = Helios.tokenizeUntypedHelios}

//         if (!options.path) {
//             apply_and_log_result(func)(file_path, options.verbose)
//         } else {
//             apply_and_write_result(func)
//                 (file_path, options.output_path, ".uplc", options.verbose)
//         }
//     })