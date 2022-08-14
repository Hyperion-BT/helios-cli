// import { Command } from "commander";

// // hyperion parse <file_name>
// const parse = new Command("parse")
//     .description("Parses Helios code.")
//     .argument("file_path", "Path to the source file.")
//     .option("-o, --output_file <output_path>", "Add custom output file.")
//     .option("-v, --verbose", "Turn on verbose mode.")
//     .action((file_path, options) => {
//         let func = Helios.parseHelios;

//         if (!options.path) {
//             apply_and_log_result(func)(file_path, options.verbose)
//         } else {
//             apply_and_write_result(func)
//                 (file_path, options.output_path, ".uplc", options.verbose)
//         }
//     })

// export {  }