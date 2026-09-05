// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from "forge-std/Test.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { TokenMock } from "@1inch/solidity-utils/contracts/mocks/TokenMock.sol";

import { Aqua } from "@1inch/aqua/src/Aqua.sol";
import { SwapVM } from "@1inch/swap-vm/src/SwapVM.sol";
import { ISwapVM } from "@1inch/swap-vm/src/interfaces/ISwapVM.sol";
import { AquaSwapVMRouter } from "@1inch/swap-vm/src/routers/AquaSwapVMRouter.sol";
import { TakerTraitsLib } from "@1inch/swap-vm/src/libs/TakerTraits.sol";
import { CoreInvariants } from "@1inch/swap-vm/test/invariants/CoreInvariants.t.sol";
import { dynamic } from "@1inch/swap-vm/test/utils/Dynamic.sol";

import { MoorProgram } from "../src/MoorProgram.sol";

/// @notice SwapVM's own invariant harness (docs/PROGRAMS.md) run over Moor's program in the one
/// direction it executes. A program that breaks exact-in/exact-out symmetry, quote/swap
/// consistency, monotonicity or maker-favouring rounding behaves strangely with real takers
/// even if every Moor test is green (AGENTS.md, Tests come first).
contract MoorProgramInvariants is Test, CoreInvariants {
    Aqua internal aqua;
    AquaSwapVMRouter internal swapVM;
    TokenMock internal tokenA;
    TokenMock internal tokenB;
    address internal maker = vm.addr(0x1234);
    address internal taker;

    uint256 internal constant COMMITTED_A = 100_000e18;

    function setUp() public {
        taker = address(this);
        aqua = new Aqua();
        swapVM = new AquaSwapVMRouter(address(aqua), address(0), address(this), "SwapVM", "1");
        tokenA = new TokenMock("Token A", "TKA");
        tokenB = new TokenMock("Token B", "TKB");
        if (tokenA > tokenB) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }

        // The taker (this contract) pays through transferFrom → Aqua push, like an EOA would.
        tokenA.approve(address(swapVM), type(uint256).max);
        tokenB.approve(address(swapVM), type(uint256).max);
        tokenB.mint(taker, 10_000_000e18);
        vm.warp(1_700_000_000);
    }

    function _order() internal view returns (ISwapVM.Order memory) {
        return MoorProgram.order(
            maker,
            MoorProgram.Params({
                tokenA: address(tokenA),
                tokenB: address(tokenB),
                takerTokenIn: address(tokenB),
                feeBps: 30_000,
                deadline: 1_800_000_000,
                sqrtPriceMin: Math.sqrt(0.5e18 * 1e18),
                sqrtPriceMax: Math.sqrt(2e18 * 1e18)
            })
        );
    }

    function _ship(ISwapVM.Order memory order) internal {
        tokenA.mint(maker, COMMITTED_A);
        vm.startPrank(maker);
        tokenA.approve(address(aqua), type(uint256).max);
        tokenB.approve(address(aqua), type(uint256).max);
        aqua.ship(
            address(swapVM),
            abi.encode(order),
            dynamic([address(tokenA), address(tokenB)]),
            dynamic([COMMITTED_A, uint256(0)])
        );
        vm.stopPrank();
    }

    function _takerData(bool isExactIn) internal view returns (bytes memory) {
        return TakerTraitsLib.build(
            TakerTraitsLib.Args({
                taker: taker,
                isExactIn: isExactIn,
                shouldUnwrapWeth: false,
                isStrictThresholdAmount: false,
                isFirstTransferFromTaker: false,
                useTransferFromAndAquaPush: true,
                isAToB: false, // the taker brings tokenB
                allowPartialFill: false,
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
    }

    function _executeSwap(
        SwapVM _swapVM,
        ISwapVM.Order memory order,
        address,
        address,
        uint256 amount,
        bytes memory takerData
    )
        internal
        override
        returns (uint256 amountIn, uint256 amountOut)
    {
        (amountIn, amountOut,) = _swapVM.swap(order, amount, takerData);
    }

    function test_coreInvariants_inTheAllowedDirection() public {
        ISwapVM.Order memory order = _order();
        _ship(order);

        InvariantConfig memory config = _getDefaultConfig();
        config.testAmounts = dynamic([uint256(1e18), uint256(10e18), uint256(50e18)]);
        config.exactInTakerData = _takerData(true);
        config.exactOutTakerData = _takerData(false);

        assertAllInvariantsWithConfig(swapVM, order, address(tokenB), address(tokenA), config);
    }
}
