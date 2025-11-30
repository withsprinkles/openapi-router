#!/usr/bin/env bun
//MISE description="Build the library"
//MISE outputs = ["dist"]

import { build } from "./build/build.ts";

await build();
