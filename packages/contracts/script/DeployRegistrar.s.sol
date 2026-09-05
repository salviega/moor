// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IVerifiableFactory } from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import { UserRegistry } from "@ensdomains/contracts-v2/registry/UserRegistry.sol";

import { MoorRegistrar, MoorRoles } from "../src/MoorRegistrar.sol";

/// @notice Phase 2 (07), the part anyone can pay for: deploys MoorRegistrar and the holder's UserRegistry
/// proxy through ENSv2's VerifiableFactory, with the holder as root of their own registry. Nothing here
/// needs the holder's signature; SetupHolder.s.sol is what the holder signs.
///
/// Env: MOOR_HOLDER (the name owner, e.g. salviega.eth's owner), MOOR_SALT (optional, default 1).
/// Run with --skip-simulation: forge's on-chain simulation reports a spurious CreateCollision on the
/// factory's CREATE2 even when the address is free (packages/contracts/README.md, toolchain notes).
/// ENSv2 Sepolia beta addresses are the ones app.ens.dev uses (05 §11).
contract DeployRegistrar is Script {
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef);
    address internal constant USER_REGISTRY_IMPL = 0x624a25d67B59D587752EbEc8DdeD8827dAe52050;

    function run() external {
        address holder = vm.envAddress("MOOR_HOLDER");
        uint256 salt = vm.envOr("MOOR_SALT", uint256(1));

        vm.startBroadcast();
        MoorRegistrar registrar = new MoorRegistrar();
        address holderRegistry = FACTORY.deployProxy(
            USER_REGISTRY_IMPL, salt, abi.encodeCall(UserRegistry.initialize, (holder, MoorRoles.HOLDER_REGISTRY_ROOT))
        );
        vm.stopBroadcast();

        console2.log("MoorRegistrar   ", address(registrar));
        console2.log("holder registry ", holderRegistry, "root:", holder);

        // vm.writeJson(value, path, key) only replaces existing keys, so the names live in their own file:
        // deployments/<chainId>.names.json, read by SetupHolder.s.sol and CreatePosition.s.sol.
        string memory json = "names";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "moorRegistrar", address(registrar));
        vm.serializeAddress(json, "holder", holder);
        json = vm.serializeAddress(json, "holderRegistry", holderRegistry);
        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".names.json"));
    }
}
