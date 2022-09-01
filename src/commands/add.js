import { Command } from "commander";
import * as fs from "../fs_helpers.js"

// TODO heph add <contract-name>
const add_cmd = new Command("add")
    .description("Adds a new contract to your project.")
    .argument("script-purpose", "Script purpose of the contract, can be 'spending' or 'minting'")
    .argument("contract-name", "The name of the contract.")
    .action((script_purpose, contract_name) => {
        let config = fs.get_config();

        if (!isNaN(contract_name)) {
            console.log(`❌ Contract name cant be a number. '${contract_name}' is invalid.`)
            return
        }

        // Create the contract in the source directory.
        fs.write_to_file(
            fs.append_path(config.srcDir, `${contract_name}.hl`),
            fs.make_contract(contract_name, script_purpose)
        )

        // Create a test file for the contract.
        fs.write_to_file(
            fs.append_path(config.testsDir, `${contract_name}.test.hl`),
            fs.make_contract(contract_name, "testing")
        )

        // Create a params file for the contract.
        fs.write_to_file(
            fs.append_path(config.paramsDir, `${contract_name}.params.json`),
            "{}"
        )
    })

export { add_cmd }