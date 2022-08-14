// import { Command } from "commander";
// import * as fs from "../node_fs_helpers";

// const init = new Command("init")
//     .description("Initializes a Helios project.")
//     .argument("project_name", "The name of your Helios project.")
//     .action((project_name: string) => {
//         fs.mkdir(project_name);
//         let contracts_dir = project_name + "/contracts/";
//         let tests_dir = project_name + "/tests/";
//         fs.mkdir(contracts_dir);
//         fs.mkdir(tests_dir);
//         fs.write_to_file(
//             contracts_dir + "main.hel",
//             `
//             validator always_true
            
//             func main(context: ScriptContext) -> Bool {
//                 true
//             }
//             `
//         )
//         fs.write_to_file(
//             tests_dir + "test.hel",
//             `
//             test always_true

//             func main() -> Bool {
//                 false
//             }
//             `
//         )

//     })