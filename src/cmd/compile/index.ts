import fs from "node:fs";

import {
    Program
} from "helios"

import {
    UsageError,
    assertEmpty,
    assertNoMoreOptions,
    filterModules,
    listIncludes,
    parseFlag,
    parseOption,
    parseNamedOption,
    readFile
} from "../../utils"

function parseCompileOptions(args: string[]) {
	const options = {
		output: parseOption(args, "-o", "--output") as string,
		includeDirs: parseOption(args, "-I", "--include", true) as string[],
		parameters: parseNamedOption(args, "-D"),
		optimize: parseFlag(args, "-O", "--optimize") as boolean
	}

	assertNoMoreOptions(args)

	return options
}

export async function compile(args: string[]) {
	const options = parseCompileOptions(args)

	const inputFile = args.shift()

	if (inputFile === undefined) {
		throw new UsageError("no input-file specified")
	}

	assertEmpty(args)

	const includeDirs = options.includeDirs.slice()
	includeDirs.unshift(".")

	const paths = listIncludes(inputFile, includeDirs)

	const sources = paths.map((p: string) => readFile(p))

	const inputSource = sources.shift()

	if (!inputSource) {
		throw new Error("unexpected")
	}

	const program = Program.new(inputSource, filterModules(sources))

	if (Object.keys(options.parameters).length > 0) {
		program.parameters = options.parameters
	}

	const uplc = program.compile(options.optimize).serialize()

	if (options.output != null) {
		fs.writeFileSync(options.output, uplc)
	} else {
		console.log(uplc)
	}
}
