"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apply_and_write_result = exports.apply_and_log_result = void 0;
const node_fs_helpers_1 = require("./node_fs_helpers");
const apply_and_log_result = (func) => (source_file_path, verbose) => {
    let src = node_fs_helpers_1.read_source_file(source_file_path);
    if (verbose) {
        console.log(`\nSource File: ${source_file_path}`);
    }
    let output_data = func(src);
    console.log(output_data);
};
exports.apply_and_log_result = apply_and_log_result;
const apply_and_write_result = (func) => (source_file_path, output_file_path, file_extension, verbose) => {
    if (!output_file_path) {
        output_file_path = node_fs_helpers_1.get_file_name(source_file_path);
    }
    output_file_path += "." + file_extension;
    let src = node_fs_helpers_1.read_source_file(source_file_path);
    let output_data = func(src);
    node_fs_helpers_1.write_to_output_file(output_file_path, output_data);
    console.log(`Output writen to: '${output_file_path}'`);
};
exports.apply_and_write_result = apply_and_write_result;
