#!/usr/bin/env node
import { compile } from "./commands/compile.js";
import { init } from "./commands/init.js";

import { Command } from "commander";

const Heph = new Command("heph")
    .description("A simple CLI for the Helios Language.")
    .version("0.2.0")
    .addCommand(compile)
    .addCommand(init)

Heph.parse()