// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IAqua } from "@1inch/aqua/src/interfaces/IAqua.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { MakerTraits } from "@1inch/swap-vm/src/libs/MakerTraits.sol";
import { TakerTraitsLib } from "@1inch/swap-vm/src/libs/TakerTraits.sol";

import { TestToken } from "../src/mocks/TestToken.sol";

/// @notice Demo infrastructure, not product (05 §8): there are no takers on Sepolia, so this fills a
/// position on purpose. The broadcaster is the taker; it mints the base token it brings.
///
/// Env:
///   MOOR_POSITION   path of the JSON written by ShipDemo.s.sol (required)
///   MOOR_AMOUNT_IN  base raw the taker brings, exactIn (default 1e6 = 0.01 tWBTC)
///   MOOR_REVERSE    "1" to attempt the forbidden direction instead and report the revert
contract DemoTaker is Script {
    function run() external {
        string memory pos = vm.readFile(vm.envString("MOOR_POSITION"));
        string memory dep =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
        IAqua aqua = IAqua(vm.parseJsonAddress(dep, ".aqua"));
        ISwapVM router = ISwapVM(vm.parseJsonAddress(dep, ".swapVmRouter"));

        ISwapVM.Order memory order = ISwapVM.Order({
            maker: vm.parseJsonAddress(pos, ".maker"),
            traits: MakerTraits.wrap(vm.parseJsonUint(pos, ".traits")),
            data: vm.parseJsonBytes(pos, ".data")
        });
        bytes32 strategyHash = vm.parseJsonBytes32(pos, ".strategyHash");
        address tokenA = vm.parseJsonAddress(pos, ".tokenA");
        address tokenB = vm.parseJsonAddress(pos, ".tokenB");
        address allowedIn = vm.parseJsonAddress(pos, ".takerTokenIn");
        bool reverse = vm.envOr("MOOR_REVERSE", false);
        address tokenIn = reverse ? (allowedIn == tokenA ? tokenB : tokenA) : allowedIn;
        uint256 amountIn = vm.envOr("MOOR_AMOUNT_IN", uint256(1e6));

        (uint256 balA0, uint256 balB0) = aqua.safeBalances(order.maker, address(router), strategyHash, tokenA, tokenB);
        console2.log("position balances before  A/B", balA0, balB0);

        vm.startBroadcast();
        address taker = msg.sender;
        bytes memory takerData = TakerTraitsLib.build(
            TakerTraitsLib.Args({
                taker: taker,
                isExactIn: true,
                shouldUnwrapWeth: false,
                isStrictThresholdAmount: false,
                isFirstTransferFromTaker: false,
                useTransferFromAndAquaPush: true,
                isAToB: tokenIn == tokenA,
                allowPartialFill: true,
                threshold: "",
                to: address(0),
                deadline: 0,
                hasPreTransferInCallback: false,
                hasPreTransferOutCallback: false,
                preTransferInHookData: "",
                postTransferInHookData: "",
                preTransferOutHookData: "",
                postTransferOutHookData: "",
                preTransferInCallbackData: "",
                preTransferOutCallbackData: "",
                instructionsArgs: "",
                signature: ""
            })
        );

        if (reverse) {
            // The forbidden direction must revert with DeadlineReached(0) — the trap at PC 31. A static quote is
            // enough to show it; nothing needs broadcasting.
            vm.stopBroadcast();
            (bool ok, bytes memory ret) =
                address(router).staticcall(abi.encodeCall(ISwapVM.quote, (order, amountIn, takerData)));
            require(!ok, "reverse direction did not revert");
            console2.log("reverse direction reverted as designed, selector:", vm.toString(bytes4(ret)));
            return;
        }

        if (TestToken(tokenIn).balanceOf(taker) < amountIn) {
            TestToken(tokenIn).mint(taker, amountIn);
        }
        if (IERC20(tokenIn).allowance(taker, address(router)) < amountIn) {
            IERC20(tokenIn).approve(address(router), type(uint256).max);
        }

        (uint256 quotedIn, uint256 quotedOut,) = router.quote(order, amountIn, takerData);
        console2.log("quote in/out", quotedIn, quotedOut);
        (uint256 amountInDone, uint256 amountOut,) = router.swap(order, amountIn, takerData);
        vm.stopBroadcast();

        (uint256 balA1, uint256 balB1) = aqua.safeBalances(order.maker, address(router), strategyHash, tokenA, tokenB);
        console2.log("swap  in/out", amountInDone, amountOut);
        console2.log("position balances after   A/B", balA1, balB1);
    }
}
