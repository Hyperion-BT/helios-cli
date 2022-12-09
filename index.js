#!/usr/bin/env node
import fs from 'node:fs';
import { resolve as absPath } from 'node:path';
import process from 'node:process';
import { 
	Program,
	UserError as HeliosError
} from 'helios';

const VERSION = "0.1.0";

const USAGE = `Usage:
  helios [-h|--help] <command> <command-options>

Commands:
  compile <input-file> 
    -I, --include   <include-module-dir>
    -o, --output    <output-file>
    -O, --optimize

  version
`;

const EXT = ".hl";

// list of helios sources in current compilation
var PATHS = [];

class CliError extends Error {
	#code;

	constructor(message, code) {
		super(message);

		this.#code = code;
	}
}

class UsageError extends CliError {
	constructor(message, code = 1) {
		super(message, code);
	}
}

// args is mutated
// returns empty if not found
// returns list (with usually only one entry)
function parseOption(args, shortName, longName, allowMultiple = false) {
	const result = [];

	while (true) {
		const i = args.findIndex(a => a === shortName || a === longName);

		if (i === -1) {
			break;
		}

		const isShort = args[i] === shortName;

		const option = args.splice(i, 2).shift();

		if (option === undefined) {
			throw new UsageError(`${isShort ? shortName : longName} expects an argument`);
		}

		if (result.findIndex(o => o === option) !== -1) {
			throw new UsageError(`duplicate ${shortName ?? ""}${shortName !== null && longName !== null ? "|" : ""}${longName ?? ""} arg ${option}`);
		}

		result.push(option);

		if (result.length > 1) {
			throw new UsageError(`duplicate ${shortName ?? ""}${shortName !== null && longName !== null ? "|" : ""}${longName ?? ""} option`);
		} 
	}

	if (allowMultiple) {
		return result;
	} else {
		switch (result.length) {
			case 0:
				return null;
			case 1:
				return result[0];
			default:
				throw new Error("should've been caught before");
		}
	}
}

// returns a boolean of allowMultiple === false
function parseFlag(args, shortName, longName, allowMultiple = false) {
	let count = 0;

	while (true) {
		const i = args.findIndex(a => a === shortName || a === longName);

		if (i === -1) {
			break;
		}

		args.splice(i, 1);

		count += 1;

		if (count > 1 && !allowMultiple) {
			throw new UsageError(`duplicate ${shortName ?? ""}${shortName !== null && longName !== null ? "|" : ""}${longName ?? ""} option`);
		}
	}

	if (allowMultiple) {
		return count;
	} else if (count === 1) {
		return true;
	} else {
		return false;
	}
}

function assertNoMoreOptions(args) {
	args.forEach(a => {
		if (a.startsWith("-")) {
			throw new UsageError(`invalid option ${a}`);
		}
	});
}

function parseCompileOptions(args) {
	const options = {
		output: parseOption(args, "-o", "--output"),
		includeDirs: parseOption(args, "-I", "--include", true),
		optimize: parseFlag(args, "-O", "--optimize")
	};

	assertNoMoreOptions(args);

	return options;
}

function readFile(path) {
	if (!fs.existsSync(path)) {
		throw new CliError(`"${path}" not found`, 2);
	} else if (!fs.lstatSync(path).isFile()) {
		throw new CliError(`"${path}" isn't a file`, 2);
	} else {
		return fs.readFileSync(path, 'utf8');
	}
}

function listIncludes(inputFile, dirs) {
	const paths = [absPath(inputFile)];

	dirs.forEach(d => {
		if (!fs.existsSync(d)) {
			throw new CliError(`"${d}" not found`, 2);
		} else if (!fs.lstatSync(d).isDirectory()) {
			throw new Code(`"${d}" isn't a directory`, 2);
		} else {
			fs.readdirSync(d).forEach(f => {
				const abs = absPath(f);

				if (f.endsWith(EXT) && paths.findIndex(p => p === abs) === -1) {
					paths.push(abs);
				}
			});
		}
	});

	return paths;
}

async function compile(args) {
	const options = parseCompileOptions(args)

	const inputFile = args.shift();

	if (inputFile === undefined) {
		throw new UsageError("no input-file specified")
	}

	const includeDirs = options.includeDirs.slice();
	includeDirs.unshift(".");

	PATHS = listIncludes(inputFile, includeDirs);

	const sources = PATHS.map(p => readFile(p));

	const inputSource = sources.shift();

	const uplc = Program.new(inputSource, sources).compile(options.optimize).serialize();

	console.log(uplc);
}

async function mainInternal(args) {
	if (args.some(a => a === "-h" || a === "--help")) {
		console.log(USAGE);
		return;
	}

	if (args.length === 0) {
		throw new UsageError("expected 1 or more args, got 0");
	}

	const command = args.shift()

	if (command.startsWith("-")) {
		throw new UsageError("options must come after command");
	}

	switch (command) {
		case "compile":
			await compile(args);
			break;
		case "version":
			console.log(VERSION);
			break;
		default:
			throw new UsageError(`unrecognized command "${command}"`);
	}
}

async function main() {
	try {
		await mainInternal(process.argv.slice(2));
	} catch (e) {
		if (e instanceof UsageError) {
			console.error(`Error: ${e.message}\n`);
			console.error(USAGE);
			process.exit(e.code);
		} else if (e instanceof CliError) {
			console.error(`Error: ${e.message}\n`);
			process.exit(e.code);
		} else if (e instanceof HeliosError) {
			if (e.src.fileIndex !== null) {
				console.error(`Error in ${PATHS[e.src.fileIndex]}`);
			}

			console.error(e.message);
			process.exit(4);
		} else {
			throw e;
		}
	}
}

main();
