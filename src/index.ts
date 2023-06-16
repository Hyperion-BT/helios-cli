#!/usr/bin/env node

import process from "node:process"

import {
	UserError as HeliosError,
	VERSION as HELIOS_VERSION
} from "helios"

import {
	CliError,
	UsageError
} from "./utils"

import {
	calcScriptAddress
} from "./cmd/address"

import {
	main as bundle
} from "./cmd/bundle"

import {
	compile
} from "./cmd/compile"

import {
	evalParam
} from "./cmd/eval"

const VERSION: string = "0.14.2"

const USAGE: string = `Usage:
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
`

function printVersion() {
	console.log(`Helios-CLI version: ${VERSION}`)
	console.log(`Helios lib version: ${HELIOS_VERSION}`)
}

async function mainInternal(args: string[]) {
	if (args.some(a => a === "-h" || a === "--help")) {
		console.log(USAGE)
		return
	}

	const command = args.shift()

	if (!command) {
		throw new UsageError("expected 1 or more args")
	}
	
	if (command.startsWith("-")) {
		throw new UsageError("options must come after command")
	}

	switch (command) {
		case "address":
			await calcScriptAddress(args)
			break
		case "bundle":
			await bundle(args)
			break
		case "compile":
			await compile(args)
			break
		case "eval":
			await evalParam(args)
			break
		case "version":
			printVersion()
			break
		default:
			throw new UsageError(`unrecognized command "${command}"`)
	}
}

async function main() {
	try {
		await mainInternal(process.argv.slice(2))
	} catch (e) {
		if (e instanceof UsageError) {
			console.error(`Error: ${e.message}\n`)
			console.error(USAGE)
			process.exit(e.code)
		} else if (e instanceof CliError) {
			console.error(`Error: ${e.message}\n`)
			process.exit(e.code)
		} else if (e instanceof HeliosError) {
			if (e.src.fileIndex !== null) {
				console.error(`Error in file-no ${e.src.fileIndex}`)
			}

			console.error(e.message)
			process.exit(4)
		} else {
			throw e
		}
	}
}

main()
