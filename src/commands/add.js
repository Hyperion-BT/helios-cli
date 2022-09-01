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

        if (!["spending", "minting", "testing"].includes(script_purpose)) {
            console.log(`❌ Invalid script purpose '${script_purpose}', must 'spending' or 'minting'.`)
            return
        }

        // Create the contract in the source directory.
        let contract_path = fs.append_path(config.srcDir, `${contract_name}.hl`)
        fs.write_to_file(
            contract_path,
            fs.make_contract(contract_name, script_purpose)
        )
        console.log(`Created '${contract_path}' to store the contract`)

        // Create a test file for the contract.
        let test_path =  fs.append_path(config.testsDir, `${contract_name}.test.hl`);
        fs.write_to_file(
            test_path,
            fs.make_contract(contract_name, "testing")
        )
        console.log(`Created '${test_path}' to store the tests.`)

        // Create a params file for the contract.
        let params_path = fs.append_path(config.paramsDir, `${contract_name}.params.json`);
        fs.write_to_file(
            params_path,
            "{}",
        )
        console.log(`Created '${params_path}' to store the contract params.`)
    })

export { add_cmd }