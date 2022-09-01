import { Command } from "commander";
import * as fs from "../fs_helpers.js";

const init_cmd = new Command("init")
    .description("Initializes a Helios project.")
    .argument("project-name", "The name of your Helios project.")
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
            fs.append_path(contracts_dir, `${project_name}.hl`),
            fs.make_contract(project_name, "spending"),
        )
        fs.write_to_file(
            fs.append_path(tests_dir, `${project_name}.test.hl`),
            fs.make_contract(project_name, "testing"),
        )
        fs.write_to_file(
           fs.append_path(params_dir, `${project_name}.params.json`),
           "{}"
        )
    })

export { init_cmd }