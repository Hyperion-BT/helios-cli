import {
    Program
} from "helios"

import {
    UsageError,
    assertEmpty,
    assertNoMoreOptions,
    filterModules,
    listIncludes,
    parseOption,
    parseNamedOption,
    readFile
} from "./common/utils.js"

function parseOptions(args: string[]) {
	const options = {
		includeDirs: parseOption(args, "-I", "--include", true) as string[],
		parameters: parseNamedOption(args, "-D")
	}

	assertNoMoreOptions(args)

	return options
}

export default async function cmd(args: string[]) {
	const options = parseOptions(args)

	const inputFile = args.shift()

	if (inputFile === undefined) {
		throw new UsageError("no input-file specified")
	}

	const paramName = args.shift();

	if (paramName === undefined) {
		throw new UsageError("no param-name specified")
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

	const json = program.parameters[paramName].toSchemaJson()

	console.log(json)
}