// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IVerifiableFactory } from "@ensdomains/verifiable-factory/IVerifiableFactory.sol";
import { PermissionedResolver } from "@ensdomains/contracts-v2/resolver/PermissionedResolver.sol";

import { MoorRoles } from "../src/MoorRegistrar.sol";

/// @notice Phase 2 (07): the holder's own PermissionedResolver, a proxy of the ENSv2 Sepolia implementation
/// deployed through VerifiableFactory with the holder as root. Anyone can pay for it (the deployer does);
/// SetupHolder.s.sol is where the holder points their name at it. Needed because the resolver app.ens.dev
/// creates at registration stays rooted at the registering wallet even after the name is transferred.
///
/// Env: MOOR_SALT (optional, default keccak256("moor-resolver", holder)). Reads holder and the other addresses
/// from deployments/<chainId>.names.json (DeployRegistrar.s.sol) and adds `holderResolver` to it.
/// Run with --skip-simulation, like DeployRegistrar.s.sol.
contract DeployResolver is Script {
    IVerifiableFactory internal constant FACTORY = IVerifiableFactory(0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef);
    address internal constant PERMISSIONED_RESOLVER_IMPL = 0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e;

    function run() external {
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".names.json");
        string memory dep = vm.readFile(path);
        address holder = vm.parseJsonAddress(dep, ".holder");
        address registrar = vm.parseJsonAddress(dep, ".moorRegistrar");
        address holderRegistry = vm.parseJsonAddress(dep, ".holderRegistry");
        uint256 salt = vm.envOr("MOOR_SALT", uint256(keccak256(abi.encode("moor-resolver", holder))));

        vm.startBroadcast();
        address holderResolver = FACTORY.deployProxy(
            PERMISSIONED_RESOLVER_IMPL,
            salt,
            abi.encodeCall(PermissionedResolver.initialize, (holder, MoorRoles.HOLDER_RESOLVER_ROOT, new bytes[](0)))
        );
        vm.stopBroadcast();

        console2.log("holder resolver ", holderResolver, "root:", holder);

        string memory json = "names";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "moorRegistrar", registrar);
        vm.serializeAddress(json, "holder", holder);
        vm.serializeAddress(json, "holderRegistry", holderRegistry);
        json = vm.serializeAddress(json, "holderResolver", holderResolver);
        vm.writeJson(json, path);
    }
}
