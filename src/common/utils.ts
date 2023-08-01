import fs from "node:fs"
import { resolve as absPath } from "node:path"

import {
    extractScriptPurposeAndName
} from "helios"

const EXT: string = ".hl"
const TAB: string = "    "

export class CliError extends Error {
	readonly code: number;

	constructor(message: string, code: number) {
		super(message);

		this.code = code;
	}
}

export class UsageError extends CliError {
	constructor(message: string, code: number = 1) {
		super(message, code);
	}
}

export class Writer {
	#indent: string
	#lines: string[]

	constructor() {
		this.#indent = ""
		this.#lines = []
	}

	indent(): void {
		this.#indent = `${this.#indent}${TAB}`
	}

	undent(): void {
		this.#indent = this.#indent.slice(0, this.#indent.length - TAB.length)
	}

	write(text: string): void {
		const lines = text.split("\n")

		lines.forEach(line => {
			this.#lines.push(`${this.#indent}${line}`)
		})
	}

	toString(): string {
		return this.#lines.join("\n")
	}
}

// args is mutated
// returns empty if not found
// returns list (with usually only one entry)
export function parseOption(args: string[], shortName: string, longName: string, allowMultiple: boolean = false): (string | string[]) {
	const result: string[] = []

	while (true) {
		const i = args.findIndex(a => a === shortName || a === longName)

		if (i === -1) {
			break
		}

		const isShort = args[i] === shortName

		const option = args.splice(i, 2).slice(1).shift()

		if (option === undefined) {
			throw new UsageError(`${isShort ? shortName : longName} expects an argument`)
		}

		if (result.findIndex(o => o === option) !== -1) {
			throw new UsageError(`duplicate ${shortName ?? ""}${shortName !== null && longName !== null ? "|" : ""}${longName ?? ""} arg ${option}`)
		}

		result.push(option)

		if (result.length > 1) {
			throw new UsageError(`duplicate ${shortName ?? ""}${shortName !== null && longName !== null ? "|" : ""}${longName ?? ""} option`)
		} 
	}

	if (allowMultiple) {
		return result
	} else {
		switch (result.length) {
			case 0:
				return []
			case 1:
				return result[0]
			default:
				throw new Error("should've been caught before")
		}
	}
}

export function parseNamedOption(args: string[], shortName: string): any {
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

	return result
}

// returns a boolean of allowMultiple === false
export function parseFlag(args: string[], shortName: string, longName: string, allowMultiple: boolean = false): (number | boolean) {
	let count = 0

	while (true) {
		const i = args.findIndex(a => a === shortName || a === longName)

		if (i === -1) {
			break
		}

		args.splice(i, 1)

		count += 1

		if (count > 1 && !allowMultiple) {
			throw new UsageError(`duplicate ${shortName ?? ""}${shortName !== null && longName !== null ? "|" : ""}${longName ?? ""} option`)
		}
	}

	if (allowMultiple) {
		return count
	} else if (count === 1) {
		return true
	} else {
		return false
	}
}

export function assert(cond: boolean, msg: string = "unexpected"): void {
	if (!cond) {
		throw new Error(msg)
	}
}

export function assertDefined<T>(x: undefined | null | T, msg: string = "unexpected"): T {
    if (x === undefined || x === null) {
        throw new Error(msg)
    }

    return x
}

export function assertNoMoreOptions(args: string[]) {
	args.forEach((a: string) => {
		if (a.startsWith("-")) {
			throw new UsageError(`invalid option ${a}`)
		}
	})
}

export function assertEmpty(args: string[]) {
	if (args.length > 0) {
		throw new UsageError(`unused arg '${args[0]}'`)
	}
}

export function readFile(path: string): string {
	if (!fs.existsSync(path)) {
		throw new CliError(`"${path}" not found`, 2)
	} else if (!fs.lstatSync(path).isFile()) {
		throw new CliError(`"${path}" isn't a file`, 2)
	} else {
		return fs.readFileSync(path, 'utf8')
	}
}

export function listIncludes(inputFile: string, dirs: string[]) {
	const paths = [absPath(inputFile)];

	dirs.forEach((d: string) => {
		if (!fs.existsSync(d)) {
			throw new CliError(`"${d}" not found`, 2)
		} else if (!fs.lstatSync(d).isDirectory()) {
			throw new CliError(`"${d}" isn't a directory`, 2)
		} else {
			fs.readdirSync(d).forEach(f => {
				const abs = absPath(f)

				if (f.endsWith(EXT) && paths.findIndex(p => p === abs) === -1) {
					paths.push(abs)
				}
			})
		}
	})

	return paths
}

export function filterModules(sources: string[]): string[] {
	return sources.filter((src: string) => {
		const purposeName = extractScriptPurposeAndName(src);

		if (!purposeName) {
			throw new Error("unexpected")
		}
		const [purpose, _] = purposeName

		return purpose == "module"
	})
}

export async function listFiles(dir: string): Promise<string[]> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })

    const files = await Promise.all(entries.map((entry) => {
        const res = absPath(dir, entry.name)

        if (entry.isDirectory()) {
            if (entry.name.endsWith("node_modules")) {
                return []
            } else {
                return listFiles(res)
            }
        } else {
            return res
        }
    }))

    return files.flat().filter(name => name.endsWith(EXT))
}