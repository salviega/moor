// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IPermissionedRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import { IRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import { PermissionedResolver } from "@ensdomains/contracts-v2/resolver/PermissionedResolver.sol";
import { LibLabel } from "@ensdomains/contracts-v2/utils/LibLabel.sol";
import { NameCoder } from "@ens/contracts/utils/NameCoder.sol";

import { MoorRegistrar, MoorRoles } from "../src/MoorRegistrar.sol";

/// @notice Phase 2 (07): the first-time flow, signed by the holder (04 §4.0) — with a Ledger:
///   forge script script/SetupHolder.s.sol --rpc-url $SEPOLIA_RPC_URL --ledger --hd-paths "<path of the owner>" --broadcast
/// Four transactions, each clear-signable once the ERC-7730 descriptors exist:
///   0. ETHRegistry.setResolver(<holder label>, holderResolver) + addr  — the name resolves through the holder's resolver
///   1. ETHRegistry.setSubregistry(<holder label>, holderRegistry)   — the name grows a registry
///   2. holderRegistry.grantRootRoles(ROLE_REGISTRAR, MoorRegistrar) — Moor may create names, nothing else
///   3. resolver.grantRootRoles(text+addr+textAdmin, MoorRegistrar)  — Moor may write records and delegate agent keys
///   4. MoorRegistrar.setupAgent(...)                                 — the agent's identity and its one capability
///
/// Env: MOOR_PARENT_LABEL (default "salviega"), MOOR_AGENT (address), MOOR_AGENT_YEARS (default 2).
/// The holder's resolver is the one already set on the name (app.ens.dev deployed a PermissionedResolver).
contract SetupHolder is Script {
    IPermissionedRegistry internal constant ETH_REGISTRY =
        IPermissionedRegistry(0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2);

    function run() external {
        string memory dep =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".names.json"));
        MoorRegistrar registrar = MoorRegistrar(vm.parseJsonAddress(dep, ".moorRegistrar"));
        string memory label = vm.envOr("MOOR_PARENT_LABEL", string("salviega"));
        string memory parentName = string.concat(label, ".eth");
        address agent = vm.envAddress("MOOR_AGENT");
        uint64 agentExpiry = uint64(block.timestamp + vm.envOr("MOOR_AGENT_YEARS", uint256(2)) * 365 days);

        vm.startBroadcast();
        // Not msg.sender: with --ledger and no --sender, forge simulates with its default sender (0x1804…), and
        // whatever the script derives from it — like the setAddr value below — is what gets broadcast.
        address holder = vm.parseJsonAddress(dep, ".holder");
        IPermissionedRegistry holderRegistry = IPermissionedRegistry(vm.parseJsonAddress(dep, ".holderRegistry"));
        PermissionedResolver resolver = PermissionedResolver(vm.parseJsonAddress(dep, ".holderResolver"));

        uint256 anyId = LibLabel.id(label);
        // The name resolves through the holder's own resolver (DeployResolver.s.sol), not the one app.ens.dev
        // created: that one keeps its root on the wallet that registered the name.
        if (ETH_REGISTRY.getResolver(label) != address(resolver)) {
            ETH_REGISTRY.setResolver(anyId, address(resolver));
        }
        bytes32 parentNode = NameCoder.namehash(NameCoder.encode(parentName), 0);
        if (resolver.addr(parentNode) != holder) {
            resolver.setAddr(parentNode, holder);
        }
        if (address(ETH_REGISTRY.getSubregistry(label)) != address(holderRegistry)) {
            ETH_REGISTRY.setSubregistry(anyId, IRegistry(address(holderRegistry)));
        }
        if (!holderRegistry.hasRootRoles(MoorRoles.REGISTRAR_ON_REGISTRY, address(registrar))) {
            holderRegistry.grantRootRoles(MoorRoles.REGISTRAR_ON_REGISTRY, address(registrar));
        }
        if (!resolver.hasRootRoles(MoorRoles.REGISTRAR_ON_RESOLVER, address(registrar))) {
            resolver.grantRootRoles(MoorRoles.REGISTRAR_ON_RESOLVER, address(registrar));
        }
        // Idempotent: the agent's name is registered once per holder.
        bytes32 agentNode;
        if (holderRegistry.getResolver(MoorRegistrar.AGENT_LABEL) == address(0)) {
            agentNode = registrar.setupAgent(holderRegistry, resolver, parentName, agent, agentExpiry);
        } else {
            agentNode = registrar.node(parentName, MoorRegistrar.AGENT_LABEL);
            console2.log("agent name already registered; skipping setupAgent");
        }
        vm.stopBroadcast();

        console2.log("holder          ", holder);
        console2.log("holder registry ", address(holderRegistry));
        console2.log("resolver        ", address(resolver));
        console2.log("agent           ", agent);
        console2.log("agent node      ", vm.toString(agentNode));
    }
}
