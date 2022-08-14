//@ts-check
import { Command } from "commander";
import * as fs from "../fs_helpers.js";
import * as Helios from "@hyperionbt/helios";

/**
 * @typedef {Object.<string, string>} TemplateParams
 */

// TODO hyperion compile <file_name> --params <param_file>
// TODO hyperion compile <file_name> --out_file <out_file>
// TODO hyperion compile --directory <dir-name>        // Compiles all helios files in the directory and writes then
// TODO hyperion compile                   
const compile= new Command("compile")
    .description("Compiles a Helios or Helios Data file to JSON.")
    .argument("file_path", "Path to the source file.")
    .option("-v, --verbose", "Turn on verbose mode.")
    .option("-o, --output_file <path>", "Add custom output file.")
    .option("-p, --params <param_path>", "Prints the result of the compilation")
    .action((src_file_path, options) => {
        console.log(`🔨 Compiling ${src_file_path}`)

        // Get the source_file as a string
        /** @type {string} */
        let src = fs.read_file(src_file_path)

        // Get the selected verbosity
        /** @type {boolean} */
        let verbose = false;
        if (options.verbose) {
            verbose = true;
        }

        // Get the output file name
        /** @type {fs.Path} */
        let output_file_path= fs.parse_file_path(src_file_path);
        if (options.output_file) {
            output_file_path = fs.parse_file_path(options.output_file);
        }

        // Change the output file's extension to JSON and format it into a string.
        /** @type {string} */
        let output_file_path_str = fs.format_file_path(output_file_path);
        output_file_path_str = output_file_path_str.split(".")[0] + ".json"

        console.log(`Written to ${output_file_path_str}`)

        // Get the contract params
        /**
         * @type {TemplateParams} 
         */
        let templateParameters = {};
        if (options.params) {
            templateParameters = JSON.parse(fs.read_file(options.params));
        }

        // Compile the user program
        /** @type {string} */
        let compilation_result = Helios.compile(
            src, 
            {verbose, templateParameters, stage: Helios.CompilationStage.Final}
        ).toString();

        fs.write_to_file(output_file_path_str, compilation_result);

        console.log(`✅ Done`)
    })
export { compile }