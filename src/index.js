#!/usr/bin/env node

import { Command } from "commander";

import { compile_cmd } from "./commands/compile.js";
import { init_cmd } from "./commands/init.js";
import { add_cmd } from "./commands/add.js";

const Heph = new Command("heph")
    .description("A simple CLI for the Helios Language.")
    .version("0.2.0")
    .addCommand(compile_cmd)
    .addCommand(init_cmd)
    .addCommand(add_cmd)

Heph.parse()