#!/usr/bin/env node

import process from "node:process"

import {
	UserError,
	RuntimeError,
	VERSION as HELIOS_VERSION
} from "helios"

import {
	CliError,
	UsageError
} from "./common/utils.js"

import addressCmd from "./address.js"
import bundleCmd from "./bundle.js"
import compileCmd from "./compile.js"
import dagCmd from "./dag.js"
import evalCmd from "./eval.js"
import inspectError from "./inspectError.js"
import inspectTx from "./inspectTx.js"
import convertToFlat from "./convertToFlat.js"
import listUtxos from "./listUtxos.js"
import genWalletPhrase from "./genWalletPhrase.js"

const VERSION: string = "0.16.1"

const USAGE: string = `Usage:
  helios [-h|--help] <command> <command-options>

Commands:

  address <json-file>
    -m, --mainnet

  bundle
    -l, --lock
	-d, --dump-ir <name-of-script>

  compile <input-file> 
    -I, --include   <include-module-dir>
    -o, --output    <output-file>
    -O, --optimize
    -D<param-name>  <param-value>

  dag

  eval <input-file> <param-name>
    -I, --include   <include-module-dir>
    -D<param-name>  <param-value>

  flat <input-file-with-cbor-hex>
    -o, --output    <output-file>  (defaults to <input-file>.flat)
  
  gen-wallet-phrase 

  inspect-blockfrost-error <input-file>

  inspect-tx <input-file-with-cbor-hex>

  list-utxos <network-name> <address>

  version
`

function printVersion() {
	console.log(`Helios cli version: ${VERSION}`)
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
			await addressCmd(args)
			break
		case "bundle":
			await bundleCmd(args)
			break
		case "compile":
			await compileCmd(args)
			break
		case "dag":
			await dagCmd(args)
			break
		case "eval":
			await evalCmd(args)
			break
		case "flat":
			await convertToFlat(args)
			break
		case "gen-wallet-phrase":
			await genWalletPhrase(args)
			break
		case "inspect-blockfrost-error":
			await inspectError(args)
			break;
		case "inspect-tx":
			await inspectTx(args)
			break;
		case "list-utxos":
			await listUtxos(args)
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
		} else if (e instanceof UserError || e instanceof RuntimeError) {
			console.error(e.message)
			process.exit(4)
		} else {
			throw e
		}
	}
}

main()
