//@ts-check

import * as fs from "fs";
import { type } from "os";

import * as path from 'path';

/**
 * @enum {string}
 */
const FSError =  {
    AccessDenied: "access to file denied.",
    FileNotFound: "file not found.",
    FileNotReadable: "file not readable.",
    FileNotWritable: "file not writable.",
}

/**
 * @typedef {Object} Path
 * @property {string} root 
 * @property {string} dir  - Parent directory of the path.
 * @property {string} base - Base of the path e.g 'h.txt' from.
 * @property {string} ext  - File extension of the file at the end of the file.
 * @property {string} name - Name of the file e.g 'h' from 'h.txt'.
 */

/**
 * 
 * @param {string} file_path_string 
 * @returns {Path}
 */
function parse_file_path(file_path_string) {
    return path.parse(file_path_string);
}

/**
 * 
 * @param {Path} file_path_string 
 * @returns {string}
 */
function format_file_path(file_path_string) {
    return path.format(file_path_string);
}


/**
 * 
 * @param {string} file_path 
 * @returns {boolean}
 */
function exists(file_path) {
    return fs.existsSync(file_path)
}

/**
 * 
 * @param {string} file_path 
 * @returns {boolean}
 */
function file_is_readable(file_path) {
    try {
        fs.accessSync(file_path, fs.constants.R_OK);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 
 * @param {string} file_path 
 * @returns {boolean}
 */
function file_is_writeable(file_path) {
    try {
        fs.accessSync(file_path, fs.constants.W_OK);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * 
 * @param {string} file_path 
 * @returns {string}
 */
function read_file(file_path) {
    if (!exists(file_path)) {
        throw `Error reading ${file_path}, ${FSError.FileNotFound}`
    } else if (!file_is_readable(file_path)) {
        throw `Error reading ${file_path}, ${FSError.FileNotReadable}`
    } else {
        return fs.readFileSync(file_path).toString()
    }
}


/**
 * 
 * @param {string} file_path 
 * @param {string} output_file_data 
 */
function write_to_file(file_path, output_file_data) {
    if (exists(file_path)) {
        if (!file_is_writeable(file_path)) { 
            throw `${file_path}, ${FSError.FileNotWritable}`
        }
    } else {
        fs.writeFileSync(file_path, output_file_data);
        // console.log(`Just Read: ${read_file(file_path)}`)
    }
}

/**
 * 
 * @param {string} file_path 
 */
function delete_file(file_path) {
    if (!file_is_writeable(file_path)) {
        throw `Error deleting ${file_path}, ${FSError.FileNotWritable}`
    } else {
        fs.unlink(file_path, (e) => console.log("Shouldn't print in 'delete file'"))
    }
}

/**
 * 
 * @param {string} file_path 
 */
function rm_dir(file_path) {
    if (!fs.existsSync(file_path)) {
        fs.rmdirSync(file_path);
    }
}

/**
 * 
 * @param {string} dir_name 
 */
function mkdir(dir_name) {
    if (!fs.existsSync(dir_name)) {
        fs.mkdirSync(dir_name)
    }
}

/**
 * 
 * @param {string} source_dir 
 * @param {string} file_extension
 * @returns {string[]}
 */
function get_files_in_dir(source_dir, file_extension) {
    /** @type {string[]} */
    let files = fs.readdirSync(source_dir)
        .filter((file_name) => file_name.endsWith(file_extension))
        .map((file_name) => source_dir + (source_dir.endsWith("/") ? "" : "/") + file_name)

    return files
}

/**
 * 
 * @param {string} source_dir 
 * @param {string} file_extension
 * @returns {string[]}
 */
function get_file_names_in_dir(source_dir, file_extension) {
    /** @type {string[]} */
    let files = fs.readdirSync(source_dir)
        .filter((file_name) => file_name.endsWith(file_extension))
        .map(file_name => file_extension.split(".")[0])

    return files
}

/** 
 * @typedef {Object} HephConfig
 * @property {string} srcDir     - Directory for Helios source files.
 * @property {string} outDir     - Directory for storing compilation artifacts.
 * @property {string} paramsDir   - Directory for storing contract parameters. In format 'contract_name.params.json'.
 */

/** @type {HephConfig} */
const DEFAULT_CONFIG = {
    srcDir: "./src",
    outDir: "./build",
    paramsDir: "./params"
}

/**
 * @returns {HephConfig}
 */
function get_config() {
    let default_path = "./heph.config.json"
    if (exists(default_path)) {
        return JSON.parse(read_file(default_path))
    } else {
        return DEFAULT_CONFIG
    }
}

export { 
    exists,
    mkdir,
    rm_dir,
    parse_file_path,
    format_file_path,
    read_file,
    write_to_file,
    get_files_in_dir,
    get_file_names_in_dir,
    get_config,
}