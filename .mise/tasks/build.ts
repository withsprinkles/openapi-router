#!/usr/bin/env bun
//MISE description="Build the library"
//MISE outputs = ["dist"]

import { rm } from "node:fs/promises";
import { $ } from "bun";
import { build } from "./build/build.ts";

await rm("dist", { recursive: true, force: true });
await $`mise run check`;
await build();
