import * as  fs from 'fs';
import * as path from 'path';

export const get_file_name = (file_path_string: string): string => {
    return path.parse(file_path_string).name;
}

export const read_source_file = (source_file_path: string): string => {
    return fs.readFileSync(source_file_path).toString();
}

export const write_to_output_file = (output_file_path: string, output_file_data: string): boolean => {
    console.log("Success")
    fs.writeFileSync(output_file_path, output_file_data);
    return true;
}