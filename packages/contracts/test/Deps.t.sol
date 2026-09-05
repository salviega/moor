// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";

// SwapVM + Aqua — the engine (05 §1)
import { Aqua } from "@1inch/aqua/src/Aqua.sol";
import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { AquaSwapVMRouter } from "@1inch/swap-vm/src/routers/AquaSwapVMRouter.sol";

// ENSv2 — the name (05 §7)
import { IPermissionedRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import { RegistryRolesLib } from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import { PermissionedResolver } from "@ensdomains/contracts-v2/resolver/PermissionedResolver.sol";
import { VerifiableFactory } from "@ensdomains/verifiable-factory/VerifiableFactory.sol";

/// @notice Phase 0 smoke test: the three protocols compile together under one
/// toolchain. Nothing about Moor is asserted here yet — that starts in phase 1.
contract DepsTest is Test {
    function test_dependenciesCompileTogether() public pure {
        assertGt(type(Aqua).creationCode.length, 0, "Aqua");
        assertGt(type(AquaSwapVMRouter).creationCode.length, 0, "AquaSwapVMRouter");
        assertGt(type(PermissionedResolver).creationCode.length, 0, "PermissionedResolver");
        assertGt(type(VerifiableFactory).creationCode.length, 0, "VerifiableFactory");
        assertTrue(type(IAqua).interfaceId != bytes4(0), "IAqua");
        assertTrue(type(IPermissionedRegistry).interfaceId != bytes4(0), "IPermissionedRegistry");
        assertTrue(RegistryRolesLib.ROLE_REGISTRAR != 0, "ROLE_REGISTRAR");
    }
}
