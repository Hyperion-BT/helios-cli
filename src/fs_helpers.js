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
 * @param {string} source_file_path 
 * @param {Function} action 
 * @param {string} action_name 
 * @returns {string}
 */
function map_file_to_string(
    source_file_path, 
    action, 
    action_name,
) {
    console.log(`${action_name} ${source_file_path}`)
    return action(read_file(source_file_path));
}

/**
 * 
 * @param {string} source_file_path 
 * @param {Function} action 
 * @param {string} action_name 
 * @param {string} output_file_path 
 */
function map_file_to_file(
    source_file_path, 
    action, 
    action_name,
    output_file_path
) {
    let payload = map_file_to_string(source_file_path, action, action_name);
    write_to_file(output_file_path, payload);
}

/**
 * 
 * @param {string} source_dir 
 * @param {string} target_dir 
 * @param {Function} action 
 * @param {string} action_name 
 * @param {Function} formatter 
 * @param {string} file_extension 
 */
function map_dir_to_dir(
    source_dir,
    target_dir,
    action,
    action_name,
    formatter,
    file_extension
) {
    let dir = fs.opendirSync(source_dir);

    let source_file_paths = [];
    
    let dirent = dir.readSync();
    console.log(source_dir);
    console.log(target_dir);
    while (dirent) {
        if (dirent.name.endsWith(file_extension)) {
            let _path = dirent.name
            console.log(`Directory member: ${_path}`)
            source_file_paths.push(_path);
        }
        dirent = dir.readSync();
    }

    // Makes directory if doesn't exists
    mkdir(target_dir)
     
    source_file_paths.forEach((file_name) => {
        let source_path = source_dir + (source_dir.endsWith("/") ? "" : "/") + file_name
        let target_path = target_dir + (target_dir.endsWith("/") ? "" : "/") + formatter(file_name)
        console.log(`Source Path: ${source_path}`)
        map_file_to_file(source_path, action, action_name, target_path)
    })
}

export { 
    exists,
    mkdir,
    rm_dir,
    parse_file_path,
    format_file_path,
    read_file,
    write_to_file,
    map_file_to_file,
    map_file_to_string,
    map_dir_to_dir,
}