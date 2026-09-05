#!/usr/bin/env node
// Phase 3 (07): signs each flow transaction against Speculos (see emu.mjs) and
// stores the rendered screens under screens/. CI diffs them, so a descriptor
// change that alters a screen fails the build, not the demo.
//
// Blocked until two things exist: the contracts the holder signs against
// (MoorRegistrar, phase 2) and a way to hand Speculos' Ethereum app our
// unsigned ERC-7730 descriptors — spec/feedback/03_ledger.md tracks that.
console.error(
	"ledger:screens: not wired yet — needs phase 2 contracts and local descriptor loading (see packages/erc7730/README.md).",
);
process.exit(1);
