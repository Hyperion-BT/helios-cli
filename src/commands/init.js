import { Command } from "commander";
import * as fs from "../fs_helpers.js";

const DEFAULT_CONTRACT_FILE =
`spending always_true
            
    func main(context: ScriptContext) -> Bool {
        true
    }`;

const DEFAULT_TEST_FILE =
`testing always_true

    func main() -> Bool {
        false
    }`;

const DEFAULT_PARAM_FILE =
`{}`;


const init = new Command("init")
    .description("Initializes a Helios project.")
    .argument("project_name", "The name of your Helios project.")
    .action((project_name) => {
        fs.mkdir(project_name);
        let config = fs.DEFAULT_CONFIG;

        let contracts_dir = fs.append_path(project_name, config.srcDir);
        let tests_dir = fs.append_path(project_name, config.testsDir);
        let params_dir = fs.append_path(project_name, config.paramsDir);

        fs.write_to_file(
            fs.append_path(project_name, "heph.config.json"),
            JSON.stringify(fs.DEFAULT_CONFIG)
        )
        fs.mkdir(contracts_dir);
        fs.mkdir(tests_dir);
        fs.mkdir(params_dir)
        fs.write_to_file(
            fs.append_path(contracts_dir, "contract.hl"),
            DEFAULT_CONTRACT_FILE,
        )
        fs.write_to_file(
            fs.append_path(tests_dir, "contract.test.hl"),
            DEFAULT_TEST_FILE
        )
        fs.write_to_file(
           fs.append_path(params_dir, "contract.params.json"),
           "{}"
        )
    })

export { init }