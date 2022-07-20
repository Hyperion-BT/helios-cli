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
exports.write_to_output_file = exports.read_source_file = exports.get_file_name = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const get_file_name = (file_path_string) => {
    return path.parse(file_path_string).name;
};
exports.get_file_name = get_file_name;
const read_source_file = (source_file_path) => {
    return fs.readFileSync(source_file_path).toString();
};
exports.read_source_file = read_source_file;
const write_to_output_file = (output_file_path, output_file_data) => {
    console.log("Success");
    fs.writeFileSync(output_file_path, output_file_data);
    return true;
};
exports.write_to_output_file = write_to_output_file;
