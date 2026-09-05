// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";

import { Aqua } from "@1inch/aqua/src/Aqua.sol";
import { AquaSwapVMRouter } from "@1inch/swap-vm/src/routers/AquaSwapVMRouter.sol";

import { TestToken } from "../src/mocks/TestToken.sol";
import { TestWETH } from "../src/mocks/TestWETH.sol";

/// @notice Phase 0 (07): redeploys the official, unmodified Aqua and SwapVM to Sepolia
/// together with demo tokens, and writes `deployments/<chainId>.json` for
/// `scripts/write-addresses.mjs` to turn into `packages/core/src/addresses.ts`.
///
/// Env: `WETH_ADDRESS` (optional — a TestWETH is deployed when absent).
/// The broadcaster becomes the router owner (`Rescuable`); nothing else is privileged.
contract Deploy is Script {
    function run() external {
        address weth = vm.envOr("WETH_ADDRESS", address(0));
        address owner = msg.sender;

        vm.startBroadcast();
        Aqua aqua = new Aqua();
        if (weth == address(0)) {
            weth = address(new TestWETH());
        }
        AquaSwapVMRouter router = new AquaSwapVMRouter(address(aqua), weth, owner, "AquaSwapVMRouter", "1");
        TestToken wbtc = new TestToken("Test Wrapped BTC", "tWBTC", 8);
        TestToken usdc = new TestToken("Test USD Coin", "tUSDC", 6);
        vm.stopBroadcast();

        console2.log("chainId           ", block.chainid);
        console2.log("Aqua              ", address(aqua));
        console2.log("WETH              ", weth);
        console2.log("AquaSwapVMRouter  ", address(router));
        console2.log("tWBTC             ", address(wbtc));
        console2.log("tUSDC             ", address(usdc));

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "aqua", address(aqua));
        vm.serializeAddress(obj, "weth", weth);
        vm.serializeAddress(obj, "swapVmRouter", address(router));
        vm.serializeAddress(obj, "testWbtc", address(wbtc));
        string memory json = vm.serializeAddress(obj, "testUsdc", address(usdc));
        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
    }
}
