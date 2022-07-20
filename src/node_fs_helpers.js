"use strict";
exports.__esModule = true;
exports.write_to_output_file = exports.read_source_file = exports.get_file_name = void 0;
var fs = require("fs");
var path = require("path");
var get_file_name = function (file_path_string) {
    return path.parse(file_path_string).name;
};
exports.get_file_name = get_file_name;
var read_source_file = function (source_file_path) {
    return fs.readFileSync(source_file_path).toString();
};
exports.read_source_file = read_source_file;
var write_to_output_file = function (output_file_path, output_file_data) {
    console.log("Success");
    fs.writeFileSync(output_file_path, output_file_data);
    return true;
};
exports.write_to_output_file = write_to_output_file;
