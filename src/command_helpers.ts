import { read_source_file, get_file_name, write_to_output_file } from "./node_fs_helpers";

export const apply_and_log_result = (func: Function) => (source_file_path: string, verbose: boolean) => {
	let src = read_source_file(source_file_path);
    if (verbose) { console.log(`\nSource File: ${source_file_path}`) }

	let output_data = func(src) as string;
	console.log(output_data);
}

export const apply_and_write_result = (func: Function) => (source_file_path: string, output_file_path: string, file_extension: string, verbose:  boolean) => {
    if (!output_file_path) { output_file_path = get_file_name(source_file_path)}
	output_file_path += "." + file_extension;

	let src = read_source_file(source_file_path);

	let output_data = func(src) as string;
	write_to_output_file(output_file_path, output_data as string);

    console.log(`Output writen to: '${output_file_path}'`);
}