// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IPermissionedRegistry } from "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import { PermissionedResolver } from "@ensdomains/contracts-v2/resolver/PermissionedResolver.sol";

import { MoorRegistrar } from "../src/MoorRegistrar.sol";

/// @notice Phase 2 (07): names an existing Aqua position under the holder's name, signed by the holder.
///   MOOR_POSITION=deployments/positions/<file>.json MOOR_LABEL=btc-dip \
///   forge script script/CreatePosition.s.sol --rpc-url $SEPOLIA_RPC_URL --ledger --hd-paths "<path>" --broadcast
/// Records follow 04 §3. Phase 3 does this from the Live App in the same session as `ship`.
contract CreatePosition is Script {
    IPermissionedRegistry internal constant ETH_REGISTRY =
        IPermissionedRegistry(0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2);

    function run() external {
        string memory dep =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".names.json"));
        string memory pos = vm.readFile(vm.envString("MOOR_POSITION"));
        MoorRegistrar registrar = MoorRegistrar(vm.parseJsonAddress(dep, ".moorRegistrar"));
        string memory parentLabel = vm.envOr("MOOR_PARENT_LABEL", string("salviega"));
        string memory parentName = string.concat(parentLabel, ".eth");
        string memory label = vm.envOr("MOOR_LABEL", string("btc-dip"));

        MoorRegistrar.Record[] memory records = new MoorRegistrar.Record[](7);
        records[0] = MoorRegistrar.Record("moor.version", "1");
        records[1] = MoorRegistrar.Record(
            "moor.strategy",
            string.concat(vm.toString(block.chainid), ":", vm.toString(vm.parseJsonBytes32(pos, ".strategyHash")))
        );
        records[2] = MoorRegistrar.Record("moor.program", vm.toString(vm.parseJsonBytes(pos, ".data")));
        records[3] = MoorRegistrar.Record(
            "moor.pair",
            string.concat(
                vm.toLowercase(vm.toString(vm.parseJsonAddress(pos, ".tokenA"))),
                ":",
                vm.toLowercase(vm.toString(vm.parseJsonAddress(pos, ".tokenB")))
            )
        );
        records[4] = MoorRegistrar.Record("moor.side", "buy");
        records[5] = MoorRegistrar.Record(
            "moor.range",
            string.concat(vm.envOr("MOOR_PRICE_MIN", string("58000")), ":", vm.envOr("MOOR_PRICE_MAX", string("62000")))
        );
        records[6] = MoorRegistrar.Record("moor.agent", string.concat("agent.", parentName));
        uint64 expiry = uint64(vm.parseJsonUint(pos, ".deadline"));

        vm.startBroadcast();
        address holder = vm.parseJsonAddress(dep, ".holder"); // not msg.sender: see SetupHolder.s.sol
        IPermissionedRegistry holderRegistry = IPermissionedRegistry(vm.parseJsonAddress(dep, ".holderRegistry"));
        PermissionedResolver resolver = PermissionedResolver(ETH_REGISTRY.getResolver(parentLabel));
        bytes32 node = registrar.createPosition(holderRegistry, resolver, parentName, label, expiry, records);
        vm.stopBroadcast();

        console2.log("name  ", string.concat(label, ".", parentName));
        console2.log("node  ", vm.toString(node));
        console2.log("expiry", uint256(expiry));
    }
}
