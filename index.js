#!/usr/bin/env node
import fs from 'node:fs';
import { resolve as absPath } from 'node:path';
import process from 'node:process';
import { 
	Address,
	deserializeUplc,
	extractScriptPurposeAndName,
	Program,
	UserError as HeliosError,
	VERSION as HELIOS_VERSION
} from 'helios';

const VERSION = "0.13.7";

const USAGE = `Usage:
  helios [-h|--help] <command> <command-options>

Commands:
  address <json-file>
    -m, --mainnet

  compile <input-file> 
    -I, --include   <include-module-dir>
    -o, --output    <output-file>
    -O, --optimize
    -D<param-name>  <param-value>

  eval <input-file> <param-name>
    -I, --include   <include-module-dir>
    -D<param-name>  <param-value>

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

		const option = args.splice(i, 2).slice(1).shift();

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

function parseNamedOption(args, shortName) {
	const result = {}

	while (true) {
		const i = args.findIndex(a => a.startsWith(shortName));

		if (i === -1) {
			break;
		}

		const [paramName_, paramValue] = args.splice(i, 2);

		if (paramName_ == undefined) {
			throw new Error("unexpected");
		} else if (paramValue == undefined) {
			throw new UsageError(`expected value after ${paramName_}`);
		}

		const paramName = paramName_.slice(shortName.length);

		if (paramName in result) {
			throw new UsageError(`duplicate ${paramName_} option`);
		}

		result[paramName] = paramValue;
	}

	return result;
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

function assertEmpty(args) {
	if (args.length > 0) {
		throw new UsageError(`unused arg '${args[0]}'`);
	}
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

function parseCalcScriptAddressOptions(args) {
	const options = {
		isMainnet: parseFlag(args, "-m", "--mainnet")
	};

	assertNoMoreOptions(args);

	return options;
}

async function calcScriptAddress(args) {
	const options = parseCalcScriptAddressOptions(args);


	const inputFile = args.shift();

	if (inputFile === undefined) {
		throw new UsageError("no script file specified")
	}

	assertEmpty(args);

	const uplcProgram = deserializeUplc(readFile(inputFile));

	const address = new Address([options.isMainnet ? 0x71 : 0x70].concat(uplcProgram.hash().slice()));

	console.log(address.toBech32());
}

function parseCompileOptions(args) {
	const options = {
		output: parseOption(args, "-o", "--output"),
		includeDirs: parseOption(args, "-I", "--include", true),
		parameters: parseNamedOption(args, "-D"),
		optimize: parseFlag(args, "-O", "--optimize")
	};

	assertNoMoreOptions(args);

	return options;
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

function filterModules(sources) {
	return sources.filter(src => {
		const [purpose, _] = extractScriptPurposeAndName(src);

		return purpose == "module"
	});
}

async function compile(args) {
	const options = parseCompileOptions(args)

	const inputFile = args.shift();

	if (inputFile === undefined) {
		throw new UsageError("no input-file specified")
	}

	assertEmpty(args);

	const includeDirs = options.includeDirs.slice();
	includeDirs.unshift(".");

	PATHS = listIncludes(inputFile, includeDirs);

	const sources = PATHS.map(p => readFile(p));

	const inputSource = sources.shift();

	const program = Program.new(inputSource, filterModules(sources));

	if (Object.keys(options.parameters).length > 0) {
		program.parameters = options.parameters;
	}

	const uplc = program.compile(options.optimize).serialize();

	if (options.output != null) {
		fs.writeFileSync(options.output, uplc);
	} else {
		console.log(uplc);
	}
}

function parseEvalParamOptions(args) {
	const options = {
		includeDirs: parseOption(args, "-I", "--include", true),
		parameters: parseNamedOption(args, "-D")
	};

	assertNoMoreOptions(args);

	return options;
}

async function evalParam(args) {
	const options = parseEvalParamOptions(args);

	const inputFile = args.shift();

	if (inputFile === undefined) {
		throw new UsageError("no input-file specified")
	}

	const paramName = args.shift();

	if (paramName === undefined) {
		throw new UsageError("no param-name specified");
	}

	assertEmpty(args);

	const includeDirs = options.includeDirs.slice();
	includeDirs.unshift(".");

	PATHS = listIncludes(inputFile, includeDirs);

	const sources = PATHS.map(p => readFile(p));

	const inputSource = sources.shift();

	const program = Program.new(inputSource, filterModules(sources));

	if (Object.keys(options.parameters).length > 0) {
		program.parameters = options.parameters;
	}

	const json = program.parameters[paramName].toSchemaJson();

	console.log(json);
}

function printVersion() {
	console.log(`Helios-CLI version: ${VERSION}`);
	console.log(`Helios lib version: ${HELIOS_VERSION}`);
}

async function mainInternal(args) {
	if (args.some(a => a === "-h" || a === "--help")) {
		console.log(USAGE);
		return;
	}

	if (args.length === 0) {
		throw new UsageError("expected 1 or more args");
	}

	const command = args.shift()

	if (command.startsWith("-")) {
		throw new UsageError("options must come after command");
	}

	switch (command) {
		case "address":
			await calcScriptAddress(args);
			break;
		case "compile":
			await compile(args);
			break;
		case "eval":
			await evalParam(args);
			break;
		case "version":
			printVersion();
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
